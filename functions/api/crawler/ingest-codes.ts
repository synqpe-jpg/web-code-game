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
 * Chuẩn hóa chuỗi tìm kiếm game (bỏ tiền tố / hậu tố rác, NPH, nền tảng)
 */
export function cleanGameSearchTerm(str: string): string {
  if (!str) return '';
  return str
    .replace(/^giftcode\s+/i, '')
    .replace(/^code\s+/i, '')
    .replace(/^nhan\s+code\s+/i, '')
    .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ')
    .replace(/[\s\-_:]+(VN|Mobile|Online|Gzone|VTC\s*Mobile|VTC\s*Game|VTC|VPlay|SohaGame|Soha|Funtap|Gosu|Gamota|VNG|DigiGames|JoyGames|Kplay|ZingPlay|Game Tam Quốc|BigUpdate|3 Kingdoms|Chuẩn Audition|FT|Lite).*$/i, '')
    .replace(/\s*x\s*(naruto|one piece|dragon ball|shippuden).*$/i, '')
    .replace(/\s*(mới nhất|moi nhat|2024|2025|2026|full code|vip)\s*$/i, '')
    .replace(/[\(\)\[\]:!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nhận diện các ứng dụng tiện ích, cổng game, app xác thực hoặc phần mềm không phải trò chơi độc lập
 */
export function isNonGameApplication(item: any): boolean {
  if (!item) return false;
  const pkg = String(item.packageId || item.packageName || item.android_package_name || '').trim().toLowerCase();
  const name = String(item.name || item.title || item.slug || '').trim().toLowerCase();
  const normName = normalizeVietnamese(name);

  // Blacklist package IDs
  const nonGamePackages = [
    'com.garena.android.authenticator',
    'vn.choingay.portal',
    'com.erp.gamifications',
    'com.gmt.playee',
    'tv.kidsstar.app.vn.pretendland',
  ];
  if (nonGamePackages.some((p) => pkg === p || pkg.includes(p))) {
    return true;
  }

  // Blacklist package fragments
  if (
    pkg.includes('.authenticator') ||
    pkg.endsWith('.authenticator') ||
    pkg.includes('.portal') ||
    pkg.includes('.gamifications') ||
    pkg.includes('pretendland')
  ) {
    return true;
  }

  // Blacklist name keywords
  const nonGameKeywords = [
    'authenticator',
    'xac thuc',
    'choi ngay game vui ve',
    'cong choi ngay',
    'gosu one',
    'gig gamota',
    'gig - gamota',
    'cong gig',
    'gokko world',
    'tro choi tre em gokko world',
  ];
  if (nonGameKeywords.some((kw) => normName.includes(kw) || name.includes(kw))) {
    return true;
  }

  return false;
}

/**
 * Trích xuất Base Slug chuẩn hóa (bỏ hậu tố nền tảng / NPH / collab)
 */
export function getBaseSlug(str: string): string {
  if (!str) return '';
  return stripAccents(str)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-(vplay|vtc|gosu|gamota|soha|sohagame|funtap|vng|garena|vn|mobile|joygames|efun|online|game-tam-quoc|ft|lite|3-kingdoms|bigupdate)$/g, '')
    .replace(/-(x-naruto|x-naruto-shippuden|naruto|shippuden)$/g, '')
    .replace(/^-+|-+$/g, '');
}

export interface LiveGameIndex {
  packagesMap: Map<string, string>;
  exactSlugsMap: Map<string, string>;
  normNamesMap: Map<string, string>;
  baseSlugsMap: Map<string, string>;
  franchisePrefixes: Array<{ prefix: string; slug: string }>;
}

/**
 * Xây dựng Index O(1) cho live games để kiểm tra trùng lặp siêu tốc (<1ms) không gây quá tải Worker CPU
 */
export function buildLiveGameIndex(liveGames: any[]): LiveGameIndex {
  const index: LiveGameIndex = {
    packagesMap: new Map(),
    exactSlugsMap: new Map(),
    normNamesMap: new Map(),
    baseSlugsMap: new Map(),
    franchisePrefixes: [],
  };

  if (!Array.isArray(liveGames)) return index;

  for (const live of liveGames) {
    if (!live || live.is_active === false || live.status === 'PENDING') continue;
    const liveSlug = String(live.slug || live.id || '').trim().toLowerCase();
    if (!liveSlug) continue;

    const livePkg = String(live.android_package_name || live.packageId || live.packageName || '').trim().toLowerCase();
    if (livePkg && livePkg.length > 3) {
      index.packagesMap.set(livePkg, liveSlug);
    }
    const playUrl = String(live.google_play_url || live.download_android || '').toLowerCase();
    const pkgMatch = playUrl.match(/[?&]id=([a-zA-Z0-9._]+)/);
    if (pkgMatch && pkgMatch[1]) {
      index.packagesMap.set(pkgMatch[1].toLowerCase(), liveSlug);
    }

    index.exactSlugsMap.set(liveSlug, liveSlug);
    const liveId = String(live.id || '').trim().toLowerCase();
    if (liveId) index.exactSlugsMap.set(liveId, liveSlug);

    const cleanName = cleanGameSearchTerm(live.name || '');
    const normName = normalizeVietnamese(cleanName);
    if (normName && normName.length >= 3) {
      index.normNamesMap.set(normName, liveSlug);
    }

    const baseSlug = getBaseSlug(liveSlug);
    if (baseSlug && baseSlug.length >= 4) {
      index.baseSlugsMap.set(baseSlug, liveSlug);

      const tokenCount = baseSlug.split('-').length;
      const isKnownFranchise =
        baseSlug.startsWith('free-fire') ||
        baseSlug.startsWith('crossfire') ||
        baseSlug.startsWith('arena-breakout') ||
        baseSlug.startsWith('mobile-legends') ||
        baseSlug.startsWith('revelation') ||
        baseSlug.startsWith('kiem-rong') ||
        baseSlug.startsWith('omg-3q');

      if (tokenCount >= 3 || isKnownFranchise) {
        index.franchisePrefixes.push({ prefix: baseSlug, slug: liveSlug });
      }
    }
  }

  return index;
}

/**
 * Phát hiện trùng lặp siêu tốc O(1) qua LiveGameIndex
 */
export function detectDuplicateOfIndexed(pendingItem: any, index: LiveGameIndex): string | null {
  if (!pendingItem || !index) return null;
  const pkg = String(pendingItem.packageName || pendingItem.packageId || pendingItem.android_package_name || '').trim().toLowerCase();
  const slug = String(pendingItem.slug || pendingItem.id || '').trim().toLowerCase();

  // 1. Khớp theo android_package_name (O(1))
  if (pkg && index.packagesMap.has(pkg)) {
    return index.packagesMap.get(pkg)!;
  }

  // 2. Khớp tuyệt đối theo slug hoặc id (O(1))
  if (slug && index.exactSlugsMap.has(slug)) {
    return index.exactSlugsMap.get(slug)!;
  }

  // 3. Khớp theo tên chuẩn hóa sau khi làm sạch (O(1))
  const cleanName = cleanGameSearchTerm(pendingItem.name || '');
  const normName = normalizeVietnamese(cleanName);
  if (normName && index.normNamesMap.has(normName)) {
    return index.normNamesMap.get(normName)!;
  }

  // 4. Khớp theo Base Slug (O(1))
  const baseSlug = getBaseSlug(slug);
  if (baseSlug && index.baseSlugsMap.has(baseSlug)) {
    return index.baseSlugsMap.get(baseSlug)!;
  }

  // 5. Khớp theo Franchise Prefixes (~15 phần tử)
  if (baseSlug && baseSlug.length >= 6) {
    for (const { prefix, slug: liveSlug } of index.franchisePrefixes) {
      if (baseSlug.startsWith(prefix + '-') || prefix.startsWith(baseSlug + '-')) {
        return liveSlug;
      }
    }
  }

  return null;
}

/**
 * Phát hiện trùng lặp giữa game chờ duyệt và danh mục game live đang hoạt động
 */
export function detectDuplicateOf(pendingItem: any, liveGames: any[]): string | null {
  if (!pendingItem || !Array.isArray(liveGames)) return null;
  const index = buildLiveGameIndex(liveGames);
  return detectDuplicateOfIndexed(pendingItem, index);
}

/**
 * Đếm số lượng giftcode thật cho một tựa game (chỉ duyệt các mã khớp slug để tối ưu CPU <0.5ms)
 */
export function countRealCodesForSlug(
  targetGame: any,
  customCodes: any[] = [],
  d1Codes: any[] = [],
  bundledCodes: any[] = []
): number {
  if (!targetGame) return 0;
  const slug = String(targetGame.slug || targetGame.id || '').trim().toLowerCase();
  const rawId = String(targetGame.id || slug).trim().toLowerCase();
  const nameSlug = targetGame.name ? stripAccents(targetGame.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';

  const matchSlug = (item: any) => {
    if (!item) return false;
    const s = String(item.gameSlug || item.game_slug || item.slug || item.gameId || '').trim().toLowerCase();
    return s === slug || s === rawId || (nameSlug && s === nameSlug) || s === slug.replace(/-mobile$/i, '');
  };

  const seenCodes = new Set<string>();

  for (const c of customCodes) {
    if (matchSlug(c)) {
      const codeVal = String(c.code || c.codeValue || c.gift_code || '').trim().toUpperCase();
      if (codeVal) seenCodes.add(codeVal);
    }
  }

  for (const c of d1Codes) {
    if (matchSlug(c)) {
      const codeVal = String(c.code || c.codeValue || c.gift_code || '').trim().toUpperCase();
      if (codeVal) seenCodes.add(codeVal);
    }
  }

  for (const c of bundledCodes) {
    if (matchSlug(c)) {
      const codeVal = String(c.code || c.codeValue || c.gift_code || '').trim().toUpperCase();
      if (codeVal) seenCodes.add(codeVal);
    }
  }

  return seenCodes.size;
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
      const matchedWords = inputWords.filter((w) => 
        gWordSet.has(w) || 
        gWords.some((gw) => (gw.length >= 4 && w.length >= 4) && (gw.startsWith(w) || w.startsWith(gw)))
      );
      const overlapRatio = matchedWords.length / Math.max(inputWords.length, 1);

      // Nếu chứa toàn bộ tên hoặc tỷ lệ từ khóa >= 70% (chỉ chấp nhận substring nếu độ dài >= 4 để tránh chuỗi 2 ký tự như "au" khớp bừa)
      const isSub = (gNorm.length >= 4 && normCleanInput.includes(gNorm)) || 
                    (normCleanInput.length >= 4 && gNorm.includes(normCleanInput));
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

  const defaultReward = item.rewards || item.description || 'Thưởng của NPH';
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
      'Toàn quyền chỉnh sửa Cách Nhập Code (instructions / guide) và Link đổi quà (redeemUrl): hỗ trợ cập nhật độc lập hoặc kèm giftcode.',
      'Quản lý hàng chờ game chưa đăng: action "list_pending_games" và action "publish_game".',
      'Quản lý hàng chờ mã giftcode: action "list_pending_codes", action "approve_codes" và action "reject_codes".',
      'Tự động chuẩn hóa Hạn Sử Dụng (expiresAt) đa định dạng: YYYY-MM-DD, DD/MM/YYYY, timestamp, hoặc "Hết hạn" / "Vĩnh viễn".',
      'Tự động phân loại trạng thái: Khi mã hết hạn (hoặc ngày hết hạn < hiện tại), hệ thống tự động gán status: EXPIRED và chuyển sang mục Đã hết hạn của game.',
      'Cập nhật bộ đếm codes_count và tự động xóa cache biên CDN.',
    ],
    supportedActions: [
      { action: 'ingest_codes', description: 'Nạp mã giftcode mới vào game (mặc định nếu không chỉ định action)' },
      { action: 'update_instructions', description: 'Cập nhật hướng dẫn nhập code và link redeem của game' },
      { action: 'list_pending_games', description: 'Lấy toàn bộ danh sách game chưa đăng lên web khách (hỗ trợ limit, offset)' },
      { action: 'publish_game', description: 'Chuyển một game từ hàng chờ sang đã đăng công khai theo slug hoặc id (idempotent)' },
      { action: 'list_pending_codes', description: 'Lấy toàn bộ mã giftcode đang chờ duyệt (hỗ trợ limit, offset)' },
      { action: 'approve_codes', description: 'Duyệt mảng mã chờ duyệt (ids: string[]) và kích hoạt lên web khách' },
      { action: 'reject_codes', description: 'Từ chối và loại bỏ mảng mã khỏi hàng chờ duyệt (ids: string[])' },
      { action: 'cleanup_test_codes', description: 'Dọn dẹp sạch sẽ mã test theo Rule 7 (Zero Test Artifacts)' },
    ],
    sampleCurl: `curl -X POST "${urlObj.origin}/api/crawler/ingest-codes" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <API_KEY>" \\
  -d '{
    "gameName": "Ta Là Hắc Ngộ Không",
    "instructions": "Bước 1: Nhân vật đạt Cấp 51 mở Sảnh Phúc Lợi.\\nBước 2: Chọn Đổi Mã Quà Tặng.\\nBước 3: Nhập mã và nhận quà qua Hộp Thư.",
    "codes": ["TALAHACNGOKHONG", "VIP666", "VIP888"],
    "rewards": "Quà tặng tân thủ độc quyền",
    "expiresAt": "2026-12-31",
    "source": "Muse Crawler Bot"
  }'`,
    sampleUpdateInstructionsCurl: `curl -X POST "${urlObj.origin}/api/crawler/ingest-codes" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <API_KEY>" \\
  -d '{
    "action": "update_instructions",
    "gameName": "Ta Là Hắc Ngộ Không",
    "instructions": "Bước 1: Mở game > Đạt cấp 51 > Vào Sảnh Phúc Lợi.\\nBước 2: Chọn mục Mã Quà Tặng.\\nBước 3: Dán mã và nhấn Xác nhận.",
    "redeemUrl": "https://nap.vplay.vn"
  }'`,
    sampleListPendingGamesCurl: `curl -X POST "${urlObj.origin}/api/crawler/ingest-codes" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <API_KEY>" \\
  -d '{"action": "list_pending_games", "limit": 50, "offset": 0}'`,
    samplePublishGameCurl: `curl -X POST "${urlObj.origin}/api/crawler/ingest-codes" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <API_KEY>" \\
  -d '{"action": "publish_game", "slug": "dau-nho-noi-gian"}'`,
    sampleListPendingCodesCurl: `curl -X POST "${urlObj.origin}/api/crawler/ingest-codes" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <API_KEY>" \\
  -d '{"action": "list_pending_codes"}'`,
    sampleApproveCodesCurl: `curl -X POST "${urlObj.origin}/api/crawler/ingest-codes" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <API_KEY>" \\
  -d '{"action": "approve_codes", "ids": ["pending_code_id_1", "pending_code_id_2"]}'`,
    sampleRejectCodesCurl: `curl -X POST "${urlObj.origin}/api/crawler/ingest-codes" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <API_KEY>" \\
  -d '{"action": "reject_codes", "ids": ["pending_code_id_1"]}'`,
    samplePython: `import requests

url = "${urlObj.origin}/api/crawler/ingest-codes"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer <API_KEY>"
}
payload = {
    "gameName": "Ta Là Hắc Ngộ Không",
    "instructions": "Bước 1: Mở game > Đạt Cấp 51 > Sảnh Phúc Lợi\\nBước 2: Đổi Quà Tặng\\nBước 3: Nhận thư",
    "codes": [
        {"code": "NGOKHONGVIP", "rewards": "100 Kim Cương + 5 Vé Quay"},
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

  try {
    // 3. Tối ưu hóa tải cài đặt từ D1 theo từng Action nhằm triệt tiêu lãng phí CPU & I/O (Error 1102)
    const requiredKeys = ['wcg_admin_games_v5'];
    if (body?.action === 'cleanup_test_codes') {
      requiredKeys.push('wcg_admin_custom_free_codes_v1');
    } else if (body?.action === 'list_pending_games') {
      requiredKeys.push('wcg_crawler_pending_games_v1');
    } else if (body?.action === 'list_pending_codes') {
      requiredKeys.push('wcg_crawler_pending_codes_v1', 'wcg_admin_submissions_v4');
    } else if (body?.action === 'approve_codes' || body?.action === 'reject_codes') {
      requiredKeys.push('wcg_crawler_pending_codes_v1', 'wcg_admin_submissions_v4', 'wcg_admin_custom_free_codes_v1');
    } else if (body?.action === 'publish_game') {
      requiredKeys.push('wcg_crawler_pending_games_v1', 'wcg_admin_free_codes_v5', 'wcg_admin_custom_free_codes_v1');
    } else {
      // Luồng nạp mã giftcode chính
      requiredKeys.push(
        'wcg_crawler_pending_games_v1',
        'wcg_admin_free_codes_v5',
        'wcg_admin_custom_free_codes_v1',
        'wcg_crawler_api_logs_v1',
        'wcg_crawler_pending_codes_v1',
        'wcg_admin_submissions_v4'
      );
    }

    const settings = await getMultipleSettingsD1(env.DB, requiredKeys);

    // =========================================================================
    // ACTION 1: Lấy toàn bộ danh sách game chưa đăng lên web khách
    // =========================================================================
    if (body && body.action === 'list_pending_games') {
      const pendingGamesRaw = Array.isArray(settings['wcg_crawler_pending_games_v1'])
        ? settings['wcg_crawler_pending_games_v1']
        : [];

      const activeGamesRaw = Array.isArray(settings['wcg_admin_games_v5'])
        ? settings['wcg_admin_games_v5']
        : [];
      const unpublishedInCatalog = activeGamesRaw.filter((g: any) => g && (g.is_active === false || g.status === 'PENDING'));

      const seenSlugs = new Set<string>();
      const combinedList: any[] = [];
      let nonGamesFilteredCount = 0;
      const liveIndex = buildLiveGameIndex(activeGamesRaw);

      const addGame = (g: any) => {
        if (!g) return;
        if (isNonGameApplication(g)) {
          nonGamesFilteredCount++;
          return;
        }
        const slug = String(g.slug || g.id || '').trim().toLowerCase();
        if (!slug || seenSlugs.has(slug)) return;
        seenSlugs.add(slug);

        const duplicateOf = detectDuplicateOfIndexed(g, liveIndex);

        combinedList.push({
          id: String(g.id || slug),
          name: String(g.name || slug),
          slug: String(g.slug || slug),
          publisher: String(g.developer || g.publisher || 'NPH Chính Thức'),
          platform: String(g.platform || 'Android, iOS'),
          packageName: g.packageId || g.packageName || g.android_package_name || null,
          source: g.source || g.sourceType || (g.sourceUrl?.includes('codemoi') ? 'Code Mới' : 'Google Play Store VN'),
          status: g.status || 'PENDING',
          codes_count: Number(g.activeCodesCount || g.codes_count || 0),
          duplicate_of: duplicateOf || null,
          created_at: g.crawledAt || g.created_at || g.releaseDate || new Date().toISOString(),
        });
      };

      pendingGamesRaw.forEach(addGame);
      unpublishedInCatalog.forEach(addGame);

      const duplicatesCount = combinedList.filter((g) => g.duplicate_of !== null).length;

      let filteredList = combinedList;
      if (body.exclude_duplicates === true) {
        filteredList = combinedList.filter((g) => g.duplicate_of === null);
      }

      const total = filteredList.length;
      const limit = body.limit !== undefined ? Math.max(1, parseInt(body.limit, 10)) : total;
      const offset = body.offset !== undefined ? Math.max(0, parseInt(body.offset, 10)) : 0;
      const pagedGames = filteredList.slice(offset, offset + limit);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'list_pending_games',
          total,
          count: pagedGames.length,
          duplicates_count: duplicatesCount,
          non_games_filtered: nonGamesFilteredCount,
          limit,
          offset,
          games: pagedGames,
        }),
        { headers: CORS_HEADERS }
      );
    }

    // =========================================================================
    // ACTION 2: Chuyển một game từ chờ duyệt sang đã đăng (published) trên web khách (idempotent)
    // =========================================================================
    if (body && body.action === 'publish_game') {
      const targetSlug = String(body.slug || body.id || '').trim().toLowerCase();
      if (!targetSlug) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu tham số slug hoặc id của game cần publish.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Re-fetch FRESH settings from D1 để chống triệt để Race Condition / Overwrite
      const freshSettings = await getMultipleSettingsD1(env.DB, [
        'wcg_admin_games_v5',
        'wcg_crawler_pending_games_v1',
        'wcg_admin_custom_free_codes_v1',
        'wcg_admin_free_codes_v5',
      ]);

      const activeGames: any[] = Array.isArray(freshSettings['wcg_admin_games_v5'])
        ? [...freshSettings['wcg_admin_games_v5']]
        : [...(fallbackGamesData as any[])];

      const pendingGames: any[] = Array.isArray(freshSettings['wcg_crawler_pending_games_v1'])
        ? [...freshSettings['wcg_crawler_pending_games_v1']]
        : [];

      const customCodes: any[] = Array.isArray(freshSettings['wcg_admin_custom_free_codes_v1'])
        ? [...freshSettings['wcg_admin_custom_free_codes_v1']]
        : [];

      const d1Codes: any[] = Array.isArray(freshSettings['wcg_admin_free_codes_v5'])
        ? [...freshSettings['wcg_admin_free_codes_v5']]
        : [];

      const bundledCodes: any[] = Array.isArray(fallbackCodesData)
        ? (fallbackCodesData as any[])
        : [];

      // Kiểm tra xem game đã được publish trong activeGames chưa (Idempotent)
      const existingPublishedIdx = activeGames.findIndex(
        (g: any) => g && (String(g.slug).toLowerCase() === targetSlug || String(g.id).toLowerCase() === targetSlug)
      );

      if (existingPublishedIdx !== -1 && activeGames[existingPublishedIdx].is_active !== false && activeGames[existingPublishedIdx].status !== 'PENDING') {
        const publishedGame = activeGames[existingPublishedIdx];
        const realCount = countRealCodesForSlug(publishedGame, customCodes, d1Codes, bundledCodes);

        // Cập nhật lại codes_count nếu trước đó bị snapshot cũ lưu sai thành 0
        if (publishedGame.codes_count !== realCount || publishedGame.free_codes_count !== realCount) {
          activeGames[existingPublishedIdx] = {
            ...publishedGame,
            codes_count: realCount,
            free_codes_count: realCount,
            updated_at: new Date().toISOString(),
          };
          await setSettingD1(env.DB, 'wcg_admin_games_v5', activeGames);
          invalidateGamesCatalogCache();
          await invalidateCatalogEdgeCache(context as any, request, env, [
            `https://codegame.shop/api/games?slug=${targetSlug}`,
            `https://codegame.shop/api/games?id=${targetSlug}`,
            new URL(`/api/games?slug=${targetSlug}`, request.url).toString(),
            `https://codegame.shop/game/${targetSlug}`,
          ]).catch(() => {});
        }

        return new Response(
          JSON.stringify({
            success: true,
            slug: activeGames[existingPublishedIdx].slug || targetSlug,
            status: 'published',
            codes_count: realCount,
            message: 'Game đã được đăng trước đó (idempotent)',
            game: activeGames[existingPublishedIdx],
          }),
          { headers: CORS_HEADERS }
        );
      }

      // Tìm trong pending games
      const pendingIdx = pendingGames.findIndex(
        (g: any) => g && (String(g.slug).toLowerCase() === targetSlug || String(g.id).toLowerCase() === targetSlug)
      );

      let gameToPublish: any = null;
      if (pendingIdx !== -1) {
        gameToPublish = pendingGames[pendingIdx];
      } else if (existingPublishedIdx !== -1) {
        gameToPublish = activeGames[existingPublishedIdx];
      }

      if (!gameToPublish) {
        return new Response(
          JSON.stringify({ success: false, error: `Không tìm thấy game với slug hoặc id "${targetSlug}" trong hàng chờ duyệt.` }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      // Chặn đăng app tiện ích/xác thực/cổng không phải game độc lập
      if (isNonGameApplication(gameToPublish) && !body.force) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Không thể đăng ứng dụng "${gameToPublish.name || targetSlug}" vì đây là tiện ích/xác thực/cổng không phải game độc lập. Dùng { force: true } nếu vẫn muốn đăng.`,
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Chặn đăng trùng lặp với game live đã có
      const liveIndex = buildLiveGameIndex(activeGames);
      const duplicateOf = detectDuplicateOfIndexed(gameToPublish, liveIndex);
      if (duplicateOf && duplicateOf !== targetSlug && !body.force) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Game này bị trùng với game đang hoạt động "${duplicateOf}". Vui lòng gộp hoặc sử dụng { force: true } nếu muốn đăng riêng.`,
            duplicate_of: duplicateOf,
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Loại bỏ khỏi pending games
      if (pendingIdx !== -1) {
        pendingGames.splice(pendingIdx, 1);
      }

      const finalSlug = String(gameToPublish.slug || gameToPublish.id || targetSlug).trim().toLowerCase();
      const finalName = String(gameToPublish.name || finalSlug).trim();
      const finalDeveloper = String(gameToPublish.developer || gameToPublish.publisher || 'NPH Chính Thức').trim();

      const isCodeMoi = gameToPublish.sourceType === 'codemoi' || (gameToPublish.sourceUrl && gameToPublish.sourceUrl.includes('codemoi.net'));
      let targetIcon = gameToPublish.iconUrl || gameToPublish.localIconPath || `/game_icons/${finalSlug}.webp`;
      if (!targetIcon || targetIcon.includes('codemoi.net')) {
        targetIcon = `/game_icons/${finalSlug}.webp`;
      }

      // Tính số mã code THỰC TẾ từ toàn bộ kho code
      const tempGameForCounting = { id: finalSlug, slug: finalSlug, name: finalName };
      const realCodesCount = countRealCodesForSlug(tempGameForCounting, customCodes, d1Codes, bundledCodes);

      const publishedRecord = {
        id: finalSlug,
        slug: finalSlug,
        name: finalName,
        publisher: finalDeveloper,
        category: gameToPublish.category || 'Nhập Vai',
        rating: Number(gameToPublish.rating || 4.8),
        icon_url: targetIcon,
        cover_image_url: targetIcon,
        banner_url: gameToPublish.banner_url || '',
        description: gameToPublish.description || `${finalName} là tựa game mobile mới phát hành chính thức bởi ${finalDeveloper}.`,
        short_description: `${finalName} - Game Mobile Mới`,
        instructions: gameToPublish.instructions || 'Bước 1: Mở game > Nhấn Avatar nhân vật\nBước 2: Chọn Cài đặt > Nhập Giftcode\nBước 3: Dán mã và nhấn Xác nhận.',
        platform: gameToPublish.platform || 'Android, iOS, PC',
        release_date: gameToPublish.releaseDate || new Date().toISOString().split('T')[0],
        download_android: gameToPublish.playStoreUrl || (gameToPublish.packageId ? `https://play.google.com/store/apps/details?id=${gameToPublish.packageId}` : ''),
        google_play_url: gameToPublish.playStoreUrl || '',
        app_store_url: gameToPublish.app_store_url || '',
        android_package_name: gameToPublish.packageId || gameToPublish.packageName || '',
        redeem_url: gameToPublish.redeem_url || '',
        is_featured: false,
        is_hot: false,
        is_new: true,
        is_active: true,
        status: 'ACTIVE',
        codes_count: realCodesCount,
        free_codes_count: realCodesCount,
        source: isCodeMoi ? 'Code Mới (codemoi.net)' : 'Google Play Store VN',
        created_at: gameToPublish.crawledAt || gameToPublish.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existingPublishedIdx !== -1) {
        activeGames[existingPublishedIdx] = { ...activeGames[existingPublishedIdx], ...publishedRecord };
      } else {
        activeGames.unshift(publishedRecord);
      }

      await setSettingD1(env.DB, 'wcg_admin_games_v5', activeGames);
      await setSettingD1(env.DB, 'wcg_crawler_pending_games_v1', pendingGames);

      // Cập nhật trực tiếp bảng games trên D1 (P1 Precomputed Columns & Instant SQL)
      try {
        await env.DB.prepare(`
          INSERT INTO games (
            id, name, slug, publisher, category, rating, icon_url, banner_url,
            description, instructions, platform, release_date, download_android,
            google_play_url, app_store_url, android_package_name, redeem_url,
            is_featured, is_hot, is_new, is_active, status, active_codes_count, total_codes_count, last_code_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(slug) DO UPDATE SET
            name = excluded.name,
            publisher = excluded.publisher,
            category = excluded.category,
            rating = excluded.rating,
            icon_url = excluded.icon_url,
            description = excluded.description,
            instructions = excluded.instructions,
            is_active = 1,
            status = 'ACTIVE',
            active_codes_count = (SELECT COUNT(*) FROM codes WHERE codes.game_slug = games.slug AND (codes.status = 'active' OR codes.status = 'verified') AND (codes.expires_at IS NULL OR codes.expires_at = '' OR codes.expires_at >= date('now'))),
            total_codes_count = (SELECT COUNT(*) FROM codes WHERE codes.game_slug = games.slug),
            last_code_at = datetime('now'),
            updated_at = datetime('now');
        `).bind(
          finalSlug, finalName, finalSlug, finalDeveloper, publishedRecord.category, publishedRecord.rating,
          publishedRecord.icon_url, publishedRecord.banner_url, publishedRecord.description, publishedRecord.instructions,
          publishedRecord.platform, publishedRecord.release_date, publishedRecord.download_android,
          publishedRecord.google_play_url, publishedRecord.app_store_url, publishedRecord.android_package_name,
          publishedRecord.redeem_url, 0, 0, 1, 1, 'ACTIVE', realCodesCount, realCodesCount
        ).run().catch(() => {});
      } catch (d1Err) {
        console.warn('[PublishGame D1 Table Sync Warning]', d1Err);
      }

      invalidateGamesCatalogCache();
      const specificUrls = [
        `https://codegame.shop/api/games?slug=${finalSlug}`,
        `https://codegame.shop/api/games?id=${finalSlug}`,
        `https://web-code-game.pages.dev/api/games?slug=${finalSlug}`,
        `https://web-code-game.pages.dev/api/games?id=${finalSlug}`,
        new URL(`/api/games?slug=${finalSlug}`, request.url).toString(),
        new URL(`/api/games?id=${finalSlug}`, request.url).toString(),
        `https://codegame.shop/game/${finalSlug}`,
        `https://web-code-game.pages.dev/game/${finalSlug}`,
        new URL(`/game/${finalSlug}`, request.url).toString(),
        'https://codegame.shop/api/games',
        'https://web-code-game.pages.dev/api/games',
        new URL('/api/games', request.url).toString(),
      ];
      await invalidateCatalogEdgeCache(context as any, request, env, specificUrls).catch(() => {});

      return new Response(
        JSON.stringify({
          success: true,
          slug: finalSlug,
          status: 'published',
          codes_count: realCodesCount,
          message: `Đã đăng thành công game "${finalName}" lên web khách!`,
          game: publishedRecord,
        }),
        { headers: CORS_HEADERS }
      );
    }

    // =========================================================================
    // ACTION 3: Lấy toàn bộ mã giftcode đang chờ duyệt
    // =========================================================================
    if (body && body.action === 'list_pending_codes') {
      const pendingCodesRaw = Array.isArray(settings['wcg_crawler_pending_codes_v1'])
        ? settings['wcg_crawler_pending_codes_v1']
        : [];

      const submissionsRaw = Array.isArray(settings['wcg_admin_submissions_v4'])
        ? settings['wcg_admin_submissions_v4']
        : [];
      const pendingSubmissions = submissionsRaw.filter((s: any) => s && s.status === 'PENDING');

      const combinedCodes: any[] = [];
      const seenIds = new Set<string>();

      for (const item of pendingCodesRaw) {
        if (!item) continue;
        const id = String(item.id || `pending_${Date.now()}`);
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        combinedCodes.push({
          id,
          gameSlug: String(item.gameSlug || item.gameId || '').trim(),
          gameName: String(item.gameName || item.gameSlug || '').trim(),
          code: String(item.code || item.codeValue || '').trim().toUpperCase(),
          rewards: item.rewards || item.description || null,
          source: item.sourceName || item.sourceUrl || item.sourceType || item.source || 'Crawler',
          created_at: item.createdAt || item.created_at || new Date().toISOString(),
          expires_at: item.expiresAt || item.expires_at || '2026-12-31',
        });
      }

      for (const item of pendingSubmissions) {
        if (!item) continue;
        const id = String(item.id || `sub_${Date.now()}`);
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        combinedCodes.push({
          id,
          gameSlug: String(item.gameSlug || '').trim(),
          gameName: String(item.gameName || item.gameSlug || '').trim(),
          code: String(item.codeValue || item.code || '').trim().toUpperCase(),
          rewards: item.rewards || null,
          source: `Đóng góp bởi ${item.submitterName || 'Thành viên'}`,
          created_at: item.createdAt || new Date().toISOString(),
          expires_at: item.expiresAt || '2026-12-31',
        });
      }

      const total = combinedCodes.length;
      const limit = body.limit !== undefined ? Math.max(1, parseInt(body.limit, 10)) : total;
      const offset = body.offset !== undefined ? Math.max(0, parseInt(body.offset, 10)) : 0;
      const pagedCodes = combinedCodes.slice(offset, offset + limit);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'list_pending_codes',
          total,
          count: pagedCodes.length,
          limit,
          offset,
          codes: pagedCodes,
        }),
        { headers: CORS_HEADERS }
      );
    }

    // =========================================================================
    // ACTION 4 & 5: Duyệt (approve_codes) hoặc Từ chối (reject_codes) mã chờ duyệt
    // =========================================================================
    if (body && (body.action === 'approve_codes' || body.action === 'reject_codes')) {
      let targetIds: string[] = [];
      if (Array.isArray(body.ids)) {
        targetIds = body.ids.map((x: any) => typeof x === 'object' ? String(x.id || '') : String(x)).filter(Boolean);
      } else if (Array.isArray(body.items)) {
        targetIds = body.items.map((x: any) => typeof x === 'object' ? String(x.id || '') : String(x)).filter(Boolean);
      } else if (body.id) {
        targetIds = [String(body.id)];
      }

      if (targetIds.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu danh sách ids mã cần duyệt hoặc từ chối (ids: string[])' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const targetIdSet = new Set(targetIds.map(String));

      const pendingCodesList: any[] = Array.isArray(settings['wcg_crawler_pending_codes_v1'])
        ? [...settings['wcg_crawler_pending_codes_v1']]
        : [];

      const customCodesList: any[] = Array.isArray(settings['wcg_admin_custom_free_codes_v1'])
        ? [...settings['wcg_admin_custom_free_codes_v1']]
        : [];

      const activeGamesList: any[] = Array.isArray(settings['wcg_admin_games_v5'])
        ? [...settings['wcg_admin_games_v5']]
        : [...(fallbackGamesData as any[])];

      if (body.action === 'approve_codes') {
        const results: any[] = [];
        const approvedCustomRecords: any[] = [];
        const remainingPending: any[] = [];
        const affectedGameSlugs = new Set<string>();

        for (const item of pendingCodesList) {
          if (item && targetIdSet.has(String(item.id))) {
            const targetSlug = String(item.gameSlug || item.gameId || '').trim().toLowerCase();
            const finalCode = String(item.code || item.codeValue || '').trim().toUpperCase();

            const rawExpiry = item.expiresAt || item.expires_at || '2026-12-31';
            const parsedExp = parseExpirationDate(rawExpiry);
            const isExp = parsedExp.isExpired || (item.status && String(item.status).toLowerCase() === 'expired');

            const approvedItem = {
              id: `code_${targetSlug}_${finalCode}_${Date.now().toString(36)}`,
              gameId: targetSlug,
              gameSlug: targetSlug,
              slug: targetSlug,
              gameName: item.gameName || targetSlug,
              code: finalCode,
              codeValue: finalCode,
              code_value: finalCode,
              gift_code: finalCode,
              rewards: item.rewards || item.description || 'Quà tặng tân thủ & sự kiện',
              description: item.rewards || item.description || 'Quà tặng tân thủ & sự kiện',
              status: isExp ? 'EXPIRED' : 'ACTIVE',
              is_active: !isExp,
              is_verified: true,
              isVerified: true,
              expires_at: parsedExp.formatted || rawExpiry,
              expiresAt: parsedExp.formatted || rawExpiry,
              expiry: parsedExp.formatted || rawExpiry,
              sourceUrl: item.sourceUrl || `https://codegame.shop/game/${targetSlug}`,
              source: item.sourceName || item.sourceUrl || item.sourceType || 'Crawler Approved',
              copyCount: 0,
              createdAt: new Date().toISOString(),
              created_at: new Date().toISOString(),
              added_at: new Date().toISOString(),
            };

            approvedCustomRecords.push(approvedItem);
            if (targetSlug) affectedGameSlugs.add(targetSlug);

            results.push({
              id: item.id,
              success: true,
              code: finalCode,
              gameSlug: targetSlug,
              status: 'approved',
            });
          } else if (item) {
            remainingPending.push(item);
          }
        }

        // Kiểm tra các ids không có trong pending (idempotent: nếu đã có trong customCodesList)
        for (const id of targetIds) {
          if (!results.some((r) => r.id === id)) {
            const alreadyApproved = customCodesList.some((c: any) => String(c.id).includes(id) || String(c.code) === id);
            if (alreadyApproved) {
              results.push({ id, success: true, status: 'already_approved', message: 'Mã đã được duyệt trước đó' });
            } else {
              results.push({ id, success: false, error: 'Không tìm thấy mã trong hàng chờ duyệt' });
            }
          }
        }

        if (approvedCustomRecords.length > 0) {
          const mergedCustom = [...approvedCustomRecords, ...customCodesList];
          await setSettingD1(env.DB, 'wcg_admin_custom_free_codes_v1', mergedCustom);
          await setSettingD1(env.DB, 'wcg_crawler_pending_codes_v1', remainingPending);

          // Cập nhật codes_count cho các game
          for (const slug of affectedGameSlugs) {
            const gIdx = activeGamesList.findIndex((g: any) => g && (String(g.slug).toLowerCase() === slug || String(g.id).toLowerCase() === slug));
            if (gIdx !== -1) {
              const currentCount = Number(activeGamesList[gIdx].codes_count || 0);
              const addedForGame = approvedCustomRecords.filter((c) => c.gameSlug === slug).length;
              activeGamesList[gIdx] = {
                ...activeGamesList[gIdx],
                codes_count: currentCount + addedForGame,
                free_codes_count: currentCount + addedForGame,
                updated_at: new Date().toISOString(),
              };
            }
          }
          await setSettingD1(env.DB, 'wcg_admin_games_v5', activeGamesList);

          invalidateGamesCatalogCache();
          await invalidateCatalogEdgeCache(context as any, request, env).catch(() => {});
        }

        return new Response(
          JSON.stringify({
            success: true,
            action: 'approve_codes',
            totalRequested: targetIds.length,
            approvedCount: results.filter((r) => r.success).length,
            results,
            remainingPendingCount: remainingPending.length,
          }),
          { headers: CORS_HEADERS }
        );
      }

      // action === 'reject_codes'
      if (body.action === 'reject_codes') {
        const results: any[] = [];
        const remainingPending: any[] = [];
        let rejectedCount = 0;

        for (const item of pendingCodesList) {
          if (item && targetIdSet.has(String(item.id))) {
            rejectedCount++;
            results.push({
              id: item.id,
              success: true,
              code: item.code || item.codeValue,
              status: 'rejected',
              message: 'Đã loại bỏ mã khỏi hàng chờ duyệt',
            });
          } else if (item) {
            remainingPending.push(item);
          }
        }

        for (const id of targetIds) {
          if (!results.some((r) => r.id === id)) {
            results.push({ id, success: true, status: 'already_rejected', message: 'Mã không còn trong hàng chờ' });
          }
        }

        if (rejectedCount > 0) {
          await setSettingD1(env.DB, 'wcg_crawler_pending_codes_v1', remainingPending);
        }

        return new Response(
          JSON.stringify({
            success: true,
            action: 'reject_codes',
            totalRequested: targetIds.length,
            rejectedCount,
            results,
            remainingPendingCount: remainingPending.length,
          }),
          { headers: CORS_HEADERS }
        );
      }
    }

    // Xử lý action đặc biệt: Dọn dẹp sạch mã test theo Rule 7 (Zero Test Artifacts on Production)
    if (body && body.action === 'cleanup_test_codes') {
      const prefix = String(body.prefix || 'TEST').toUpperCase();
      const existingCustomCodes = Array.isArray(settings['wcg_admin_custom_free_codes_v1'])
        ? [...settings['wcg_admin_custom_free_codes_v1']]
        : [];

      const beforeCount = existingCustomCodes.length;
      const cleanCustomCodes = existingCustomCodes.filter((c: any) => {
        const val = String(c.code || c.codeValue || c.gift_code || '').trim().toUpperCase();
        return !val.startsWith(prefix);
      });
      const removedCount = beforeCount - cleanCustomCodes.length;

      if (removedCount > 0) {
        await setSettingD1(env.DB, 'wcg_admin_custom_free_codes_v1', cleanCustomCodes);
        invalidateGamesCatalogCache();
        await invalidateCatalogEdgeCache(context as any, request, env).catch(() => {});
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Đã dọn dẹp ${removedCount} mã test có tiền tố "${prefix}".`,
          removedCount,
        }),
        { headers: CORS_HEADERS }
      );
    }

    // 2. Chuẩn hóa payload thành mảng các mục cần nạp (cho luồng nạp mã giftcode thông thường)
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
      const inputGameName = String(
        rawItem.gameSlug ||
        rawItem.game_slug ||
        rawItem.slug ||
        rawItem.gameName ||
        rawItem.game_name ||
        rawItem.name ||
        rawItem.game ||
        ''
      ).trim();
      const codesToIngest = extractCodesFromPayload(rawItem);

      // Trích xuất Cách Nhập Code (instructions) và Link nhập quà (redeemUrl)
      const extractedInstructions = String(
        rawItem.instructions !== undefined ? rawItem.instructions :
        rawItem.instructionsText !== undefined ? rawItem.instructionsText :
        rawItem.instructions_text !== undefined ? rawItem.instructions_text :
        rawItem.guide !== undefined ? rawItem.guide :
        rawItem.guideText !== undefined ? rawItem.guideText :
        rawItem.huongDan !== undefined ? rawItem.huongDan :
        rawItem.huong_dan !== undefined ? rawItem.huong_dan :
        rawItem.cachNhapCode !== undefined ? rawItem.cachNhapCode :
        rawItem.cach_nhap_code !== undefined ? rawItem.cach_nhap_code :
        rawItem.howToRedeem !== undefined ? rawItem.howToRedeem :
        rawItem.how_to_redeem !== undefined ? rawItem.how_to_redeem :
        ''
      ).trim();

      const extractedRedeemUrl = String(
        rawItem.redeemUrl !== undefined ? rawItem.redeemUrl :
        rawItem.redeem_url !== undefined ? rawItem.redeem_url :
        rawItem.link_nhap_code !== undefined ? rawItem.link_nhap_code :
        rawItem.linkNhapCode !== undefined ? rawItem.linkNhapCode :
        rawItem.redemption_url !== undefined ? rawItem.redemption_url :
        ''
      ).trim();

      const isUpdateInstructionsAction = rawItem.action === 'update_instructions' || rawItem.action === 'set_instructions' || body.action === 'update_instructions';
      const hasInstructionsUpdate = Boolean(extractedInstructions || extractedRedeemUrl);

      if (!inputGameName) {
        executionResults.push({
          success: false,
          error: 'Thiếu tên game (gameName)',
          inputName: '',
          codesCount: codesToIngest.length,
        });
        continue;
      }

      // Nếu không có mã code VÀ không có nội dung hướng dẫn nhập code hợp lệ
      if (codesToIngest.length === 0 && !hasInstructionsUpdate && !isUpdateInstructionsAction) {
        executionResults.push({
          success: false,
          error: 'Không tìm thấy mã giftcode hoặc nội dung hướng dẫn nhập code trong payload.',
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
      const nowIso = new Date().toISOString();

      // 4.2. TRƯỜNG HỢP: CHỈ CẬP NHẬT CÁCH NHẬP CODE (Không có mã code đính kèm)
      if (codesToIngest.length === 0 && (hasInstructionsUpdate || isUpdateInstructionsAction)) {
        if (source === 'active') {
          const activeIdx = activeGamesList.findIndex((g) => g && (g.slug === gameSlug || g.id === gameSlug));
          if (activeIdx !== -1) {
            activeGamesList[activeIdx] = {
              ...activeGamesList[activeIdx],
              instructions: extractedInstructions || activeGamesList[activeIdx].instructions,
              redeem_url: extractedRedeemUrl || activeGamesList[activeIdx].redeem_url,
              updated_at: nowIso,
            };
            stateModified = true;
          }
        } else if (source === 'pending') {
          const pendingIdx = pendingGamesList.findIndex((p) => p && (p.slug === gameSlug || p.id === gameSlug));
          if (pendingIdx !== -1) {
            pendingGamesList[pendingIdx] = {
              ...pendingGamesList[pendingIdx],
              instructions: extractedInstructions || pendingGamesList[pendingIdx].instructions,
              redeemUrl: extractedRedeemUrl || pendingGamesList[pendingIdx].redeemUrl,
              updated_at: nowIso,
            };
            stateModified = true;
          }
        }

        executionResults.push({
          success: true,
          action: 'INSTRUCTIONS_UPDATED',
          inputName: inputGameName,
          matchedGame: {
            id: gameSlug,
            slug: gameSlug,
            name: gameName,
            publisher: matchedGame.publisher || matchedGame.developer || 'NPH Chính Thức',
            icon_url: matchedGame.icon_url || `/game_icons/${gameSlug}.webp`,
            instructions: extractedInstructions,
            redeem_url: extractedRedeemUrl || undefined,
          },
          sourceBeforeIngest: source,
          matchType,
          matchConfidence,
          instructionsUpdated: Boolean(extractedInstructions),
          redeemUrlUpdated: Boolean(extractedRedeemUrl),
          message: `Đã cập nhật cách nhập code cho game "${gameName}" thành công!`,
        });
        continue;
      }

      const existingCodesSet = existingCodeValuesBySlug.get(gameSlug) || new Set<string>();
      const addedForThisGame: string[] = [];
      const duplicateCodes: string[] = [];

      // 4.3. LỌC TRÙNG & TẠO BẢN GHI MÃ CODE MỚI
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

      // 4.4. NẾU GAME NẰM TRONG HÀNG CHỜ DUYỆT (CHƯA CÓ CODE TRƯỚC ĐÓ) -> TỰ ĐỘNG XUẤT BẢN LÊN WEB KHÁCH!
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
            instructions: extractedInstructions || pGame.instructions || 'Bước 1: Mở game > Nhấn Avatar nhân vật\nBước 2: Chọn Cài đặt > Nhập Giftcode\nBước 3: Dán mã và nhấn Xác nhận.',
            redeem_url: extractedRedeemUrl || pGame.redeemUrl || '',
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
      } else if (source === 'active') {
        // Cập nhật bộ đếm code của game đang hoạt động và cập nhật cách nhập code nếu có
        const activeIdx = activeGamesList.findIndex((g) => g && (g.slug === gameSlug || g.id === gameSlug));
        if (activeIdx !== -1) {
          const currentCount = Number(activeGamesList[activeIdx].codes_count || 0);
          const updatedActiveGame: any = {
            ...activeGamesList[activeIdx],
            codes_count: currentCount + addedForThisGame.length,
            free_codes_count: Number(activeGamesList[activeIdx].free_codes_count || currentCount) + addedForThisGame.length,
            updated_at: nowIso,
          };
          if (extractedInstructions) {
            updatedActiveGame.instructions = extractedInstructions;
          }
          if (extractedRedeemUrl) {
            updatedActiveGame.redeem_url = extractedRedeemUrl;
          }
          activeGamesList[activeIdx] = updatedActiveGame;
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
          instructions: extractedInstructions || matchedGame.instructions,
          redeem_url: extractedRedeemUrl || matchedGame.redeem_url,
        },
        sourceBeforeIngest: source,
        matchType,
        matchConfidence,
        autoPublished: wasAutoPublished,
        instructionsUpdated: Boolean(extractedInstructions),
        redeemUrlUpdated: Boolean(extractedRedeemUrl),
        receivedCount: codesToIngest.length,
        addedCount: addedForThisGame.length,
        duplicateCount: duplicateCodes.length,
        addedCodes: addedForThisGame,
        duplicateCodes,
      });
    }

    // 5. LƯU VÀO D1 DATABASE & ĐỒNG BỘ NGUYÊN TỬ (ATOMIC DELTA RE-FETCH MERGE)
    if (stateModified) {
      const nowIso = new Date().toISOString();
      // 5.0. Re-fetch FRESH settings from D1 ngay trước khi lưu để chống Race Condition / Overwrite
      const freshD1Settings = await getMultipleSettingsD1(env.DB, [
        'wcg_admin_custom_free_codes_v1',
        'wcg_admin_games_v5',
        'wcg_crawler_pending_games_v1',
        'wcg_admin_free_codes_v5',
      ]);

      // 5.1. Merge mã code mới vào danh sách tươi từ D1
      const freshCustomCodes: any[] = Array.isArray(freshD1Settings['wcg_admin_custom_free_codes_v1'])
        ? [...freshD1Settings['wcg_admin_custom_free_codes_v1']]
        : [];

      const customCodesMap = new Map<string, any>();
      for (const fc of freshCustomCodes) {
        if (!fc) continue;
        const s = String(fc.gameSlug || fc.slug || fc.gameId || '').trim().toLowerCase();
        const c = String(fc.code || fc.codeValue || '').trim().toUpperCase();
        if (s && c) {
          customCodesMap.set(`${s}_${c}`, fc);
        }
      }

      for (const nc of newlyAddedCodes) {
        const s = String(nc.gameSlug || nc.slug || nc.gameId || '').trim().toLowerCase();
        const c = String(nc.code || nc.codeValue || '').trim().toUpperCase();
        if (s && c) {
          customCodesMap.set(`${s}_${c}`, nc);
        }
      }

      const mergedCustomCodesList = Array.from(customCodesMap.values());
      await setSettingD1(env.DB, 'wcg_admin_custom_free_codes_v1', mergedCustomCodesList);

      // 5.2. Merge Active Games & Auto-Published Games vào freshActiveGames
      const freshActiveGames: any[] = Array.isArray(freshD1Settings['wcg_admin_games_v5'])
        ? [...freshD1Settings['wcg_admin_games_v5']]
        : [...(fallbackGamesData as any[])];

      const freshPendingGames: any[] = Array.isArray(freshD1Settings['wcg_crawler_pending_games_v1'])
        ? [...freshD1Settings['wcg_crawler_pending_games_v1']]
        : [];

      const publishedSlugsSet = new Set<string>();

      for (const res of executionResults) {
        if (!res || !res.matchedGame) continue;
        const slug = String(res.matchedGame.slug).trim().toLowerCase();

        // Tính số lượng mã THỰC TẾ siêu tốc O(1)
        const realCount = countRealCodesForSlug(
          { slug, id: slug, name: res.matchedGame.name },
          mergedCustomCodesList,
          Array.isArray(freshD1Settings['wcg_admin_free_codes_v5']) ? freshD1Settings['wcg_admin_free_codes_v5'] : [],
          Array.isArray(fallbackCodesData) ? (fallbackCodesData as any[]) : []
        );

        const activeIdx = freshActiveGames.findIndex((g) => g && (String(g.slug).toLowerCase() === slug || String(g.id).toLowerCase() === slug));

        if (res.autoPublished) {
          publishedSlugsSet.add(slug);
          const pGame = freshPendingGames.find((p) => p && (String(p.slug).toLowerCase() === slug || String(p.id).toLowerCase() === slug));
          const pDeveloper = pGame?.developer || pGame?.publisher || res.matchedGame.publisher || 'NPH Chính Thức';
          const pIcon = pGame?.localIconPath || pGame?.iconUrl || `/game_icons/${slug}.webp`;

          const publishedRecord = {
            id: slug,
            slug,
            name: res.matchedGame.name,
            publisher: pDeveloper,
            category: pGame?.category || 'Nhập Vai',
            rating: Number(pGame?.rating || 4.8),
            icon_url: pIcon,
            cover_image_url: pIcon,
            banner_url: pGame?.banner_url || '',
            description: pGame?.description || `${res.matchedGame.name} là tựa game mobile mới phát hành chính thức.`,
            short_description: `${res.matchedGame.name} - Đã cập nhật ${realCount} giftcode mới`,
            instructions: res.matchedGame.instructions || pGame?.instructions || 'Bước 1: Mở game > Nhấn Avatar nhân vật\nBước 2: Chọn Cài đặt > Nhập Giftcode\nBước 3: Dán mã và nhấn Xác nhận.',
            redeem_url: res.matchedGame.redeem_url || pGame?.redeemUrl || '',
            platform: 'Android, iOS, PC',
            release_date: pGame?.releaseDate || nowIso.split('T')[0],
            download_android: pGame?.playStoreUrl || (pGame?.packageId ? `https://play.google.com/store/apps/details?id=${pGame.packageId}` : ''),
            google_play_url: pGame?.playStoreUrl || '',
            app_store_url: pGame?.app_store_url || '',
            android_package_name: pGame?.packageId || pGame?.packageName || '',
            is_featured: false,
            is_hot: true,
            is_new: true,
            is_active: true,
            status: 'ACTIVE',
            codes_count: realCount,
            free_codes_count: realCount,
            source: auth.botName || 'Muse External Ingest API',
            created_at: nowIso,
            updated_at: nowIso,
          };

          if (activeIdx !== -1) {
            freshActiveGames[activeIdx] = { ...freshActiveGames[activeIdx], ...publishedRecord };
          } else {
            freshActiveGames.unshift(publishedRecord);
          }
        } else if (activeIdx !== -1) {
          // Game đã active: LUÔN LUÔN cập nhật codes_count và instructions
          freshActiveGames[activeIdx] = {
            ...freshActiveGames[activeIdx],
            codes_count: realCount,
            free_codes_count: realCount,
            instructions: res.matchedGame.instructions || freshActiveGames[activeIdx].instructions,
            redeem_url: res.matchedGame.redeem_url || freshActiveGames[activeIdx].redeem_url,
            updated_at: nowIso,
          };
        }
      }

      // LUÔN LƯU freshActiveGames mỗi khi có mã được nạp hoặc game được xuất bản!
      await setSettingD1(env.DB, 'wcg_admin_games_v5', freshActiveGames);

      // 5.2b. Cập nhật trực tiếp vào bảng codes và games trên D1 (P1 Precomputed Columns & Instant SQL)
      try {
        const codeStmts = [];
        for (const nc of newlyAddedCodes) {
          const s = String(nc.gameSlug || nc.slug || nc.gameId || '').trim().toLowerCase();
          const c = String(nc.code || nc.codeValue || '').trim().toUpperCase();
          if (!s || !c) continue;
          const id = nc.id || `code_${s}_${c}`;
          const rewards = nc.rewards || nc.description || 'Quà tân thủ & vật phẩm ingame';
          const isExp = isCodeExpired(nc);
          const status = nc.status === 'expired' || isExp ? 'expired' : 'active';
          const expiresAt = nc.expires_at || nc.expiresAt || nc.expiry || '';
          const source = nc.source || auth.botName || 'crawler';
          const addedAt = nc.added_at || nc.updated_at || nc.created_at || nowIso;

          codeStmts.push(
            env.DB.prepare(`
              INSERT OR REPLACE INTO codes (id, game_slug, code, rewards, status, expires_at, source, added_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(id, s, c, rewards, status, expiresAt, source, addedAt)
          );
        }
        if (codeStmts.length > 0) {
          for (let i = 0; i < codeStmts.length; i += 50) {
            await env.DB.batch(codeStmts.slice(i, i + 50)).catch(() => {});
          }
        }

        // Cập nhật precomputed counter cho từng game bị ảnh hưởng
        for (const res of executionResults) {
          if (!res || !res.matchedGame) continue;
          const slug = String(res.matchedGame.slug).trim().toLowerCase();
          await env.DB.prepare(`
            UPDATE games SET
              total_codes_count = (SELECT COUNT(*) FROM codes WHERE codes.game_slug = games.slug),
              active_codes_count = (SELECT COUNT(*) FROM codes WHERE codes.game_slug = games.slug AND (codes.status = 'active' OR codes.status = 'verified') AND (codes.expires_at IS NULL OR codes.expires_at = '' OR codes.expires_at >= date('now'))),
              last_code_at = datetime('now'),
              status = 'ACTIVE',
              is_active = 1,
              updated_at = datetime('now')
            WHERE slug = ?;
          `).bind(slug).run().catch(() => {});
        }
      } catch (err) {
        console.warn('[IngestCodes D1 Table Sync Warning]', err);
      }

      // 5.3. Loại bỏ game đã xuất bản khỏi freshPendingGames
      if (publishedSlugsSet.size > 0) {
        const remainingFreshPending = freshPendingGames.filter(
          (p) => p && !publishedSlugsSet.has(String(p.slug || p.id || '').trim().toLowerCase())
        );
        await setSettingD1(env.DB, 'wcg_crawler_pending_games_v1', remainingFreshPending);
      }

      // 5.4. Xóa Cache Biên (Edge Cache)
      invalidateGamesCatalogCache();
      const ingestedSlugs = executionResults.map((r) => r.matchedGame?.slug).filter(Boolean);
      const specificGameUrls: string[] = [];
      for (const s of ingestedSlugs) {
        specificGameUrls.push(
          `https://codegame.shop/api/games?slug=${s}`,
          `https://codegame.shop/api/games?id=${s}`,
          `https://web-code-game.pages.dev/api/games?slug=${s}`,
          `https://web-code-game.pages.dev/api/games?id=${s}`,
          new URL(`/api/games?slug=${s}`, request.url).toString(),
          new URL(`/api/games?id=${s}`, request.url).toString(),
          `https://codegame.shop/game/${s}`,
          `https://web-code-game.pages.dev/game/${s}`,
          new URL(`/game/${s}`, request.url).toString()
        );
      }
      specificGameUrls.push(
        'https://codegame.shop/api/games',
        'https://web-code-game.pages.dev/api/games',
        new URL('/api/games', request.url).toString()
      );
      await invalidateCatalogEdgeCache(context as any, request, env, specificGameUrls).catch(() => {});
    }

    // 6. Ghi nhật ký API Log
    try {
      const existingLogs = (await getSettingD1(env.DB, 'wcg_crawler_api_logs_v1')) || [];
      const logsArray = Array.isArray(existingLogs) ? existingLogs : [];
      const totalInstructionsUpdated = executionResults.filter((r) => r.instructionsUpdated).length;
      const newLogEntry = {
        id: `api_log_${Date.now()}`,
        botName: auth.botName,
        sourceIp: request.headers.get('CF-Connecting-IP') || 'unknown',
        totalItemsProcessed: rawItems.length,
        totalCodesReceived: rawItems.reduce((acc, it) => acc + extractCodesFromPayload(it).length, 0),
        totalCodesAdded: newlyAddedCodes.length,
        totalInstructionsUpdated,
        autoPublishedGamesCount: autoPublishedCount,
        details: executionResults.map((r) => ({
          input: r.inputName,
          matched: r.matchedGame?.name,
          added: r.addedCount || 0,
          instructionsUpdated: Boolean(r.instructionsUpdated),
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
    const totalInstructionsUpdated = executionResults.filter((r) => r.instructionsUpdated).length;

    let summaryMessage = `Đã xử lý thành công! Nạp mới ${totalAdded} mã code, bỏ qua ${totalDuplicates} mã trùng lặp.`;
    if (totalAdded === 0 && totalInstructionsUpdated > 0) {
      summaryMessage = `Đã cập nhật cách nhập code thành công cho ${totalInstructionsUpdated} tựa game!`;
    } else if (totalAdded > 0 && totalInstructionsUpdated > 0) {
      summaryMessage = `Đã xử lý thành công! Nạp mới ${totalAdded} mã code và cập nhật cách nhập code cho ${totalInstructionsUpdated} tựa game.`;
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          message: summaryMessage,
          botName: auth.botName,
          totalAdded,
          totalDuplicates,
          totalInstructionsUpdated,
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
