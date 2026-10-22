/**
 * Cloudflare Pages Function: External Crawler & Bot Giftcode Ingestion API
 * Route: /api/crawler/ingest-codes
 * 
 * Cho phép Muse, Python Bots, cURL hoặc các bộ máy cào ngoại vi gửi mã giftcode lên hệ thống:
 * 1. Xác thực bằng API Key (Bearer Token, X-API-Key, X-Sync-Key, hoặc query param ?api_key=...).
 * 2. Tự động nhận diện và "lọc tên game" (Smart Vietnamese Fuzzy Matching) khớp vào đúng game.
 * 3. Nếu game nằm trong Hàng Chờ Duyệt (chưa có code), tự động kích hoạt & đăng lên Web Khách.
 * 4. Lọc trùng lặp mã code (Deduplication) và nạp mã mới vào đúng game.
 * 5. Cập nhật số lượng codes_count và xóa cache biên để Web Khách cập nhật tức thì.
 */

import { getSettingD1, setSettingD1, getMultipleSettingsD1 } from '../../services/d1_service';
import { normalizeVietnamese, stripAccents, GAME_ACRONYM_MAP, invalidateGamesCatalogCache } from '../games';
import { invalidateCatalogEdgeCache } from '../../services/cache_service';
import { parseExpirationDate, isCodeExpired } from '../../../src/utils/codeUtils';
import fallbackGamesData from '../../../src/data/games188.json';
import fallbackCodesData from '../../../src/data/crawled_codes_188.json';

export interface Env {
  DB?: D1Database;
  ADMIN_SYNC_SECRET?: string;
  JWT_SECRET?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Sync-Key, X-Requested-With',
};

/**
 * Xác thực API Key
 * Chỉ chấp nhận DUY NHẤT khóa đang lưu trong cơ sở dữ liệu D1 (cùng nguồn dữ liệu module Crawler & Auto Sync).
 * Không tồn tại bất kỳ khóa mặc định hay khóa dự phòng hardcode nào.
 */
async function authenticateRequest(request: Request, env: Env): Promise<{ authorized: boolean; botName: string; error?: string }> {
  const urlObj = new URL(request.url);
  const authHeader = request.headers.get('Authorization') || '';
  const apiKeyHeader = request.headers.get('X-API-Key') || request.headers.get('X-Sync-Key') || '';
  const queryKey = urlObj.searchParams.get('api_key') || urlObj.searchParams.get('key') || '';

  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || apiKeyHeader.trim() || queryKey.trim();

  if (!token) {
    return { authorized: false, botName: '', error: 'Thiếu API Key xác thực (Bearer Token, header X-API-Key hoặc tham số ?api_key=...)' };
  }

  // Xác thực duy nhất với khóa cấu hình đang lưu trong cơ sở dữ liệu D1
  if (env.DB) {
    try {
      const apiConfig = await getSettingD1(env.DB, 'wcg_crawler_api_config_v1');
      const configuredKey = apiConfig?.apiKey ? String(apiConfig.apiKey).trim() : '';
      if (configuredKey && token === configuredKey) {
        return { authorized: true, botName: apiConfig?.botName || 'External Bot' };
      }
    } catch (err) {
      console.error('[IngestCodes] Lỗi đọc cấu hình API từ D1:', err);
    }
  }

  return { authorized: false, botName: '', error: 'API Key không chính xác hoặc đã bị vô hiệu hóa.' };
}

/**
 * Chuẩn hóa chuỗi tìm kiếm game (bỏ tiền tố / hậu tố rác)
 */
function cleanGameSearchTerm(str: string): string {
  if (!str) return '';
  return str
    .replace(/^giftcode\s+/i, '')
    .replace(/^code\s+/i, '')
    .replace(/^nhan\s+code\s+/i, '')
    .replace(/\s*-\s*(VN|Mobile|Online|Gzone|VTC|VPlay|SohaGame|Funtap|Gosu|Gamota|VNG|DigiGames).*$/i, '')
    .replace(/\s*(mới nhất|moi nhat|2026|full code|vip)\s*$/i, '')
    .replace(/[\(\)\[\]:!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Thuật toán lọc và khớp tên game thông minh (Smart Game Filter & Matching)
 */
function findBestMatchingGame(
  inputNameOrSlug: string,
  activeGames: any[],
  pendingGames: any[]
): { game: any; source: 'active' | 'pending'; matchConfidence: number; matchType: string } | null {
  if (!inputNameOrSlug || !inputNameOrSlug.trim()) return null;

  const rawInput = inputNameOrSlug.trim();
  const rawInputLower = rawInput.toLowerCase();
  const normInput = normalizeVietnamese(rawInput);
  const cleanInput = cleanGameSearchTerm(rawInput);
  const normCleanInput = normalizeVietnamese(cleanInput);
  const cleanSlug = stripAccents(cleanInput).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const allCandidates: Array<{ game: any; source: 'active' | 'pending' }> = [
    ...activeGames.map((g) => ({ game: g, source: 'active' as const })),
    ...pendingGames.map((p) => ({ game: p, source: 'pending' as const })),
  ];

  // 1. TIER 1: Khớp chính xác Tuyệt Đối theo Slug hoặc ID
  for (const { game, source } of allCandidates) {
    const slug = (game.slug || '').toLowerCase();
    const id = (game.id || '').toLowerCase();
    if (slug === rawInputLower || id === rawInputLower || slug === cleanSlug) {
      return { game, source, matchConfidence: 1.0, matchType: 'exact_slug' };
    }
  }

  // 2. TIER 2: Khớp chính xác 100% theo Tên chuẩn hóa (Normalized Name)
  for (const { game, source } of allCandidates) {
    const gName = (game.name || '').trim();
    const gNorm = normalizeVietnamese(gName);
    const gClean = cleanGameSearchTerm(gName);
    const gNormClean = normalizeVietnamese(gClean);

    if (gNorm === normInput || gNormClean === normCleanInput || gNorm === normCleanInput || gNormClean === normInput) {
      return { game, source, matchConfidence: 1.0, matchType: 'exact_name' };
    }
  }

  // 3. TIER 3: Khớp theo Tên Viết Tắt Game (Gaming Acronym Mapping: lq, ff, gi, hsr, vltk...)
  const compactInput = normInput.replace(/\s+/g, '');
  const expansions = GAME_ACRONYM_MAP[compactInput];
  if (expansions && expansions.length > 0) {
    for (const exp of expansions) {
      const expNorm = normalizeVietnamese(exp);
      for (const { game, source } of allCandidates) {
        const gNorm = normalizeVietnamese(game.name || '');
        if (gNorm.includes(expNorm)) {
          return { game, source, matchConfidence: 0.95, matchType: 'acronym_match' };
        }
      }
    }
  }

  // 4. TIER 4: Khớp chuỗi con và độ tương đồng từ khóa (Token Overlap >= 70%)
  let bestCandidate: { game: any; source: 'active' | 'pending'; matchConfidence: number; matchType: string } | null = null;
  let highestScore = 0;

  const inputWords = normCleanInput.split(/\s+/).filter((w) => w.length >= 2);

  if (inputWords.length > 0) {
    for (const { game, source } of allCandidates) {
      const gName = game.name || '';
      const gNorm = normalizeVietnamese(cleanGameSearchTerm(gName));
      const gWords = gNorm.split(/\s+/).filter((w) => w.length >= 2);
      if (gWords.length === 0) continue;

      const gWordSet = new Set(gWords);
      const matchedWords = inputWords.filter((w) => gWordSet.has(w) || gWords.some((gw) => gw.startsWith(w) || w.startsWith(gw)));
      const overlapRatio = matchedWords.length / Math.max(inputWords.length, 1);

      // Nếu chứa toàn bộ tên hoặc tỷ lệ từ khóa >= 70%
      const isSub = gNorm.includes(normCleanInput) || normCleanInput.includes(gNorm);
      const confidence = isSub ? 0.9 : overlapRatio;

      if (confidence >= 0.7 && confidence > highestScore) {
        highestScore = confidence;
        bestCandidate = {
          game,
          source,
          matchConfidence: Number(confidence.toFixed(2)),
          matchType: isSub ? 'substring_match' : 'token_overlap',
        };
      }
    }
  }

  return bestCandidate;
}

interface ExtractedCodeItem {
  code: string;
  rewards: string;
  expiresAt: string;
  isExpired: boolean;
  rawStatus?: string;
}

/**
 * Trích xuất và làm sạch danh sách mã code từ input (chuẩn hóa Hạn Sử Dụng & Trạng Thái)
 */
function extractCodesFromPayload(item: any): Array<ExtractedCodeItem> {
  const result: Array<ExtractedCodeItem> = [];

  const defaultReward = item.rewards || item.description || 'Quà tặng giftcode cập nhật tự động qua Muse API';
  const defaultRawExp =
    item.expiresAt ||
    item.expires_at ||
    item.expiry ||
    item.expire_date ||
    item.expireDate ||
    item.expirationDate ||
    item.expiration_date ||
    item.hsd ||
    item.han_su_dung;

  const parseItemCode = (rawCode: any, rawReward?: any, rawExp?: any, rawStatus?: any) => {
    const val = String(rawCode || '').trim().toUpperCase().replace(/^#/, '');
    if (val.length < 3 || val.length > 40) return;

    const expInput = rawExp !== undefined && rawExp !== null && rawExp !== '' ? rawExp : defaultRawExp;
    const parsedExp = parseExpirationDate(expInput);

    const explicitStatus = rawStatus !== undefined && rawStatus !== null && rawStatus !== '' ? String(rawStatus) : item.status;
    const explicitExpired = explicitStatus && (
      String(explicitStatus).toLowerCase() === 'expired' ||
      String(explicitStatus).toLowerCase() === 'hết hạn' ||
      String(explicitStatus).toLowerCase() === 'het han'
    );

    const isExpired = parsedExp.isExpired || Boolean(explicitExpired);
    const formattedExpiry = parsedExp.formatted || (isExpired ? 'Hết hạn' : '2026-12-31');

    result.push({
      code: val,
      rewards: String(rawReward || defaultReward).trim(),
      expiresAt: formattedExpiry,
      isExpired,
      rawStatus: explicitStatus ? String(explicitStatus) : undefined,
    });
  };

  // Trường hợp 1: Array of objects [{ code, rewards, expiresAt }]
  if (Array.isArray(item.codes) && item.codes.length > 0) {
    for (const c of item.codes) {
      if (typeof c === 'string') {
        parseItemCode(c);
      } else if (c && typeof c === 'object') {
        const val = c.code || c.codeValue || c.code_value || c.gift_code || c.giftcode || c.val;
        const rewards = c.rewards || c.description || c.reward || c.qua || c.items;
        const exp =
          c.expiresAt ||
          c.expires_at ||
          c.expiry ||
          c.expire_date ||
          c.expireDate ||
          c.expirationDate ||
          c.expiration_date ||
          c.hsd ||
          c.han_su_dung ||
          c.hanSuDung;
        const status = c.status || c.statusValue || c.trangThai || c.trang_thai;
        parseItemCode(val, rewards, exp, status);
      }
    }
  }

  // Trường hợp 2: Single code property
  if (item.code && typeof item.code === 'string') {
    parseItemCode(item.code, item.rewards, defaultRawExp, item.status);
  }

  // Trường hợp 3: Khối văn bản thô (rawText) chứa nhiều code cách nhau bằng dấu phẩy hoặc xuống dòng
  if (typeof item.rawText === 'string' && item.rawText.trim()) {
    const tokens = item.rawText
      .split(/[\r\n,;|\s]+/)
      .map((t: string) => t.trim().toUpperCase().replace(/^#/, ''))
      .filter((t: string) => t.length >= 3 && t.length <= 40 && /^[A-Z0-9_\-]+$/.test(t));

    for (const val of tokens) {
      if (!result.some((r) => r.code === val)) {
        parseItemCode(val, item.rewards, defaultRawExp, item.status);
      }
    }
  }

  return result;
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET: Trả về tài liệu hướng dẫn sử dụng API & Health Check cho Bot / Muse
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const urlObj = new URL(request.url);

  let activeGamesCount = 532;
  let pendingGamesCount = 192;
  if (env.DB) {
    try {
      const g = await getSettingD1(env.DB, 'wcg_admin_games_v5');
      if (Array.isArray(g)) activeGamesCount = g.length;
      const p = await getSettingD1(env.DB, 'wcg_crawler_pending_games_v1');
      if (Array.isArray(p)) pendingGamesCount = p.length;
    } catch {}
  }

  const doc = {
    service: 'CodeGame Crawler & Bot Ingestion API (Muse Integration)',
    version: '1.0.0',
    status: 'ONLINE',
    endpoint: `${urlObj.origin}/api/crawler/ingest-codes`,
    authInstructions: {
      header: 'Authorization: Bearer <API_KEY> hoặc X-API-Key: <API_KEY>',
      queryParam: '?api_key=<API_KEY>',
    },
    capabilities: [
      'Tự động lọc và khớp tên game tiếng Việt thông minh (Fuzzy Vietnamese Accent Matching).',
      'Tự động kích hoạt & đăng game lên Web Khách nếu game đang ở Hàng Chờ Duyệt (Auto-Publish on Code arrival).',
      'Tự động lọc trùng lặp mã code (Deduplication) và nạp mã mới vào đúng game.',
      'Tự động chuẩn hóa Hạn Sử Dụng (expiresAt) đa định dạng: YYYY-MM-DD, DD/MM/YYYY, timestamp, hoặc "Hết hạn" / "Vĩnh viễn".',
      'Tự động phân loại trạng thái: Khi mã hết hạn (hoặc ngày hết hạn < hiện tại), hệ thống tự động gán status: EXPIRED và chuyển sang mục Đã hết hạn của game.',
      'Cập nhật bộ đếm codes_count và tự động xóa cache biên CDN.',
    ],
    sampleCurl: `curl -X POST "${urlObj.origin}/api/crawler/ingest-codes" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <API_KEY>" \\
  -d '{
    "gameName": "Mộng Thiên Kiếm",
    "codes": ["MONGTHIENKIEM", "VIP666", "VIP888"],
    "rewards": "Quà tặng tân thủ độc quyền",
    "expiresAt": "2026-12-31",
    "source": "Muse Crawler Bot"
  }'`,
    samplePython: `import requests

url = "${urlObj.origin}/api/crawler/ingest-codes"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer <API_KEY>"
}
payload = {
    "gameName": "Mộng Thiên Kiếm",
    "codes": [
        {"code": "MONGTHIENKIEM", "rewards": "100 Kim Cương + 5 Vé Quay"},
        {"code": "VIP666", "rewards": "Rương trang bị hoàng kim"}
    ],
    "source": "Muse Python Crawler"
}
response = requests.post(url, headers=headers, json=payload)
print(response.json())`,
    systemMetrics: {
      totalActivePublishedGames: activeGamesCount,
      totalPendingModerationGames: pendingGamesCount,
    },
  };

  return new Response(JSON.stringify(doc, null, 2), {
    headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache' },
  });
};

/**
 * POST: Thực thi nhận code, lọc tên game và thêm code vào đúng game
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // 1. Xác thực API Key
  const auth = await authenticateRequest(request, env);
  if (!auth.authorized) {
    return new Response(
      JSON.stringify({
        success: false,
        error: auth.error || 'Truy cập bị từ chối.',
        hint: 'Cung cấp API Key qua Header "Authorization: Bearer <KEY>" hoặc "X-API-Key: <KEY>"',
      }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  if (!env.DB) {
    return new Response(
      JSON.stringify({ success: false, error: 'Database D1 chưa được cấu hình.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Dữ liệu JSON không hợp lệ: ' + err?.message }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 2. Chuẩn hóa payload thành mảng các mục cần nạp
  const rawItems: any[] = [];
  if (Array.isArray(body)) {
    rawItems.push(...body);
  } else if (Array.isArray(body.items)) {
    rawItems.push(...body.items);
  } else if (body && typeof body === 'object') {
    rawItems.push(body);
  }

  if (rawItems.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'Payload không chứa dữ liệu game hoặc mã giftcode.' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    // 3. Tải danh mục games, pending games và free codes hiện tại
    const settings = await getMultipleSettingsD1(env.DB, [
      'wcg_admin_games_v5',
      'wcg_crawler_pending_games_v1',
      'wcg_admin_free_codes_v5',
      'wcg_admin_custom_free_codes_v1',
      'wcg_crawler_api_logs_v1',
    ]);

    const activeGamesList: any[] = Array.isArray(settings['wcg_admin_games_v5'])
      ? [...settings['wcg_admin_games_v5']]
      : [...(fallbackGamesData as any[])];

    const pendingGamesList: any[] = Array.isArray(settings['wcg_crawler_pending_games_v1'])
      ? [...settings['wcg_crawler_pending_games_v1']]
      : [];

    const existingCustomCodes: any[] = Array.isArray(settings['wcg_admin_custom_free_codes_v1'])
      ? [...settings['wcg_admin_custom_free_codes_v1']]
      : [];

    const existingCatalogCodes: any[] = Array.isArray(settings['wcg_admin_free_codes_v5'])
      ? [...settings['wcg_admin_free_codes_v5']]
      : [...(fallbackCodesData as any[])];

    // Tạo tập hợp mã code hiện có theo gameSlug để chống trùng lặp (Deduplication)
    const existingCodeValuesBySlug = new Map<string, Set<string>>();
    const registerExisting = (list: any[]) => {
      for (const item of list) {
        if (!item) continue;
        const slug = (item.gameSlug || item.game_slug || item.slug || item.gameId || '').toLowerCase().trim();
        const val = String(item.code || item.codeValue || item.gift_code || '').trim().toUpperCase();
        if (slug && val) {
          if (!existingCodeValuesBySlug.has(slug)) {
            existingCodeValuesBySlug.set(slug, new Set());
          }
          existingCodeValuesBySlug.get(slug)!.add(val);
        }
      }
    };
    registerExisting(existingCustomCodes);
    registerExisting(existingCatalogCodes);

    const newlyAddedCodes: any[] = [];
    const executionResults: any[] = [];
    let stateModified = false;
    let autoPublishedCount = 0;

    // 4. Xử lý từng game được gửi tới
    for (const rawItem of rawItems) {
      const inputGameName = String(rawItem.gameName || rawItem.name || rawItem.game || rawItem.slug || '').trim();
      const codesToIngest = extractCodesFromPayload(rawItem);

      if (!inputGameName) {
        executionResults.push({
          success: false,
          error: 'Thiếu tên game (gameName)',
          inputName: '',
          codesCount: codesToIngest.length,
        });
        continue;
      }

      if (codesToIngest.length === 0) {
        executionResults.push({
          success: false,
          error: 'Không tìm thấy mã code hợp lệ trong payload',
          inputName: inputGameName,
          codesCount: 0,
        });
        continue;
      }

      // 4.1. LỌC TÊN GAME THÔNG MINH
      const matchResult = findBestMatchingGame(inputGameName, activeGamesList, pendingGamesList);

      if (!matchResult) {
        executionResults.push({
          success: false,
          error: `Không tìm thấy game nào khớp với "${inputGameName}". Vui lòng kiểm tra lại tên game hoặc tạo trước trong Hàng Chờ Duyệt.`,
          inputName: inputGameName,
          receivedCodes: codesToIngest.map((c) => c.code),
        });
        continue;
      }

      const { game: matchedGame, source, matchConfidence, matchType } = matchResult;
      const gameSlug = String(matchedGame.slug || matchedGame.id).trim().toLowerCase();
      const gameName = String(matchedGame.name || inputGameName).trim();

      const existingCodesSet = existingCodeValuesBySlug.get(gameSlug) || new Set<string>();
      const addedForThisGame: string[] = [];
      const duplicateCodes: string[] = [];

      // 4.2. LỌC TRÙNG & TẠO BẢN GHI MÃ CODE MỚI
      const nowIso = new Date().toISOString();
      for (const c of codesToIngest) {
        const isExp = c.isExpired || (c.rawStatus && (String(c.rawStatus).toLowerCase() === 'expired' || String(c.rawStatus).toLowerCase() === 'hết hạn'));
        const codeStatus = isExp ? 'EXPIRED' : 'ACTIVE';

        if (existingCodesSet.has(c.code)) {
          duplicateCodes.push(c.code);
          // Nếu mã code đã tồn tại nhưng Muse/Bot gửi thông tin hạn dùng mới -> cập nhật hạn & trạng thái hết hạn tức thì!
          const existingIdx = existingCustomCodes.findIndex((ec) =>
            ec &&
            (ec.gameSlug === gameSlug || ec.slug === gameSlug || ec.gameId === gameSlug) &&
            String(ec.code || ec.codeValue || '').toUpperCase() === c.code
          );
          if (existingIdx !== -1) {
            existingCustomCodes[existingIdx] = {
              ...existingCustomCodes[existingIdx],
              expiresAt: c.expiresAt,
              expires_at: c.expiresAt,
              expiry: c.expiresAt,
              status: codeStatus,
              is_active: !isExp,
              rewards: c.rewards || existingCustomCodes[existingIdx].rewards,
              updatedAt: nowIso,
              updated_at: nowIso,
            };
            stateModified = true;
          }
          continue;
        }

        const newCodeRecord = {
          id: `code_${gameSlug}_${c.code}`,
          gameId: gameSlug,
          gameSlug: gameSlug,
          game_slug: gameSlug,
          slug: gameSlug,
          gameName: gameName,
          code: c.code,
          codeValue: c.code,
          code_value: c.code,
          gift_code: c.code,
          rewards: c.rewards,
          description: c.rewards,
          status: codeStatus,
          is_active: !isExp,
          is_verified: true,
          isVerified: true,
          expires_at: c.expiresAt,
          expiresAt: c.expiresAt,
          expiry: c.expiresAt,
          sourceUrl: rawItem.sourceUrl || `https://codegame.shop/game/${gameSlug}`,
          source: rawItem.source || auth.botName || 'Muse External Ingest API',
          copyCount: 100 + Math.floor(Math.random() * 200),
          createdAt: nowIso,
          created_at: nowIso,
          added_at: nowIso,
        };

        existingCodesSet.add(c.code);
        existingCodeValuesBySlug.set(gameSlug, existingCodesSet);
        newlyAddedCodes.push(newCodeRecord);
        existingCustomCodes.unshift(newCodeRecord);
        addedForThisGame.push(c.code);
        stateModified = true;
      }

      // 4.3. NẾU GAME NẰM TRONG HÀNG CHỜ DUYỆT (CHƯA CÓ CODE TRƯỚC ĐÓ) -> TỰ ĐỘNG XUẤT BẢN LÊN WEB KHÁCH!
      let wasAutoPublished = false;
      if (source === 'pending' && addedForThisGame.length > 0) {
        const pendingIdx = pendingGamesList.findIndex((p) => p && (p.slug === gameSlug || p.id === gameSlug));
        if (pendingIdx !== -1) {
          const pGame = pendingGamesList[pendingIdx];
          const publishedGameRecord = {
            id: gameSlug,
            slug: gameSlug,
            name: gameName,
            publisher: pGame.developer || pGame.publisher || 'NPH Chính Thức',
            category: pGame.category || 'Nhập Vai',
            rating: pGame.rating || 4.8,
            icon_url: pGame.localIconPath || pGame.iconUrl || `/game_icons/${gameSlug}.webp`,
            cover_image_url: pGame.localIconPath || pGame.iconUrl || `/game_icons/${gameSlug}.webp`,
            banner_url: '',
            description: pGame.description || `${gameName} là tựa game mobile mới phát hành chính thức.`,
            short_description: `${gameName} - Đã cập nhật ${addedForThisGame.length} giftcode mới`,
            instructions: 'Bước 1: Mở game > Nhấn Avatar nhân vật\nBước 2: Chọn Cài đặt > Nhập Giftcode\nBước 3: Dán mã và nhấn Xác nhận.',
            platform: 'Android, iOS, PC',
            release_date: pGame.releaseDate || nowIso.split('T')[0],
            download_android: pGame.playStoreUrl || '',
            is_featured: false,
            is_hot: true,
            is_new: true,
            is_active: true,
            status: 'ACTIVE',
            codes_count: addedForThisGame.length,
            free_codes_count: addedForThisGame.length,
            source: rawItem.source || auth.botName || 'Muse External Ingest API',
            created_at: nowIso,
            updated_at: nowIso,
          };

          // Chuyển sang danh mục chính thức
          activeGamesList.unshift(publishedGameRecord);
          pendingGamesList.splice(pendingIdx, 1);
          wasAutoPublished = true;
          autoPublishedCount++;
          stateModified = true;
        }
      } else if (source === 'active' && addedForThisGame.length > 0) {
        // Cập nhật bộ đếm code của game đang hoạt động
        const activeIdx = activeGamesList.findIndex((g) => g && (g.slug === gameSlug || g.id === gameSlug));
        if (activeIdx !== -1) {
          const currentCount = Number(activeGamesList[activeIdx].codes_count || 0);
          activeGamesList[activeIdx] = {
            ...activeGamesList[activeIdx],
            codes_count: currentCount + addedForThisGame.length,
            free_codes_count: Number(activeGamesList[activeIdx].free_codes_count || currentCount) + addedForThisGame.length,
            updated_at: nowIso,
          };
          stateModified = true;
        }
      }

      executionResults.push({
        success: true,
        inputName: inputGameName,
        matchedGame: {
          id: gameSlug,
          slug: gameSlug,
          name: gameName,
          publisher: matchedGame.publisher || matchedGame.developer || 'NPH Chính Thức',
          icon_url: matchedGame.icon_url || `/game_icons/${gameSlug}.webp`,
        },
        sourceBeforeIngest: source,
        matchType,
        matchConfidence,
        autoPublished: wasAutoPublished,
        receivedCount: codesToIngest.length,
        addedCount: addedForThisGame.length,
        duplicateCount: duplicateCodes.length,
        addedCodes: addedForThisGame,
        duplicateCodes,
      });
    }

    // 5. LƯU VÀO D1 DATABASE & ĐỒNG BỘ NGUYÊN TỬ
    if (stateModified) {
      // 5.1. Lưu mã code mới vào D1 Custom Free Codes
      await setSettingD1(env.DB, 'wcg_admin_custom_free_codes_v1', existingCustomCodes);

      // 5.2. Nếu có game được tự động đăng hoặc cập nhật bộ đếm -> Lưu Games Catalog
      await setSettingD1(env.DB, 'wcg_admin_games_v5', activeGamesList);

      // 5.3. Nếu có game rời khỏi hàng chờ duyệt -> Lưu Pending Games Catalog
      if (autoPublishedCount > 0) {
        await setSettingD1(env.DB, 'wcg_crawler_pending_games_v1', pendingGamesList);
      }

      // 5.4. Xóa Cache Biên (Edge Cache)
      invalidateGamesCatalogCache();
      await invalidateCatalogEdgeCache(context as any, request, env).catch(() => {});
    }

    // 6. Ghi nhật ký API Log
    try {
      const existingLogs = (await getSettingD1(env.DB, 'wcg_crawler_api_logs_v1')) || [];
      const logsArray = Array.isArray(existingLogs) ? existingLogs : [];
      const newLogEntry = {
        id: `api_log_${Date.now()}`,
        botName: auth.botName,
        sourceIp: request.headers.get('CF-Connecting-IP') || 'unknown',
        totalItemsProcessed: rawItems.length,
        totalCodesReceived: rawItems.reduce((acc, it) => acc + extractCodesFromPayload(it).length, 0),
        totalCodesAdded: newlyAddedCodes.length,
        autoPublishedGamesCount: autoPublishedCount,
        details: executionResults.map((r) => ({
          input: r.inputName,
          matched: r.matchedGame?.name,
          added: r.addedCount || 0,
          status: r.success ? 'SUCCESS' : 'FAILED',
        })),
        timestamp: new Date().toISOString(),
      };
      logsArray.unshift(newLogEntry);
      const trimmedLogs = logsArray.slice(0, 50); // Giữ lại 50 logs gần nhất
      await setSettingD1(env.DB, 'wcg_crawler_api_logs_v1', trimmedLogs);
    } catch {}

    const totalAdded = newlyAddedCodes.length;
    const totalDuplicates = executionResults.reduce((acc, r) => acc + (r.duplicateCount || 0), 0);

    return new Response(
      JSON.stringify(
        {
          success: true,
          message: `Đã xử lý thành công! Nạp mới ${totalAdded} mã code, bỏ qua ${totalDuplicates} mã trùng lặp.`,
          botName: auth.botName,
          totalAdded,
          totalDuplicates,
          autoPublishedGamesCount: autoPublishedCount,
          results: executionResults,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      ),
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Lỗi máy chủ khi nạp giftcode: ' + (err?.message || String(err)),
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
