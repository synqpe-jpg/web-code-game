/**
 * Cloudflare Pages Function: Muse Bot Upcoming Games Ingestion API
 * Route: /api/crawler/ingest-upcoming-games
 * 
 * Cho phép Muse Bot hoặc các dịch vụ bên ngoài quản lý và nạp danh sách Game Chuẩn Bị Ra Mắt:
 * 1. Xác thực bằng API Key (Bearer Token, X-API-Key, hoặc query param ?api_key=...).
 * 2. Nạp/Cập nhật thông tin ngày giờ mở server (releaseDate), NPH, thể loại, link tải trước, và giftcode tân thủ dự kiến.
 * 3. Tự động chuẩn hóa slug, khử trùng dữ liệu và lưu vào Cloudflare D1 (SSOT).
 * 4. Ghi nhận lịch sử gọi API vào nhật ký Crawler Logs.
 */

import { getSettingD1, setSettingD1 } from '../../services/d1_service';

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

async function authenticateRequest(request: Request, env: Env, bodyApiKey?: string): Promise<{ authorized: boolean; botName: string; error?: string }> {
  const urlObj = new URL(request.url);
  const authHeader = request.headers.get('Authorization') || '';
  const apiKeyHeader = request.headers.get('X-API-Key') || request.headers.get('X-Sync-Key') || '';
  const queryKey = urlObj.searchParams.get('api_key') || urlObj.searchParams.get('key') || '';

  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || apiKeyHeader.trim() || queryKey.trim() || (bodyApiKey ? String(bodyApiKey).trim() : '');

  if (!token) {
    return { authorized: false, botName: '', error: 'Thiếu API Key xác thực (Bearer Token, header X-API-Key hoặc trường apiKey trong JSON payload)' };
  }

  // 1. Kiểm tra với ADMIN_SYNC_SECRET hoặc MUSE_API_KEY
  if (env.ADMIN_SYNC_SECRET && token === env.ADMIN_SYNC_SECRET) {
    return { authorized: true, botName: 'Admin Sync Secret' };
  }
  if (env.MUSE_API_KEY && token === env.MUSE_API_KEY) {
    return { authorized: true, botName: 'Muse Master Bot' };
  }

  // 2. Xác thực với khóa cấu hình đang lưu trong cơ sở dữ liệu D1
  if (env.DB) {
    try {
      const apiConfig = await getSettingD1(env.DB, 'wcg_crawler_api_config_v1');
      const configuredKey = apiConfig?.apiKey ? String(apiConfig.apiKey).trim() : '';
      if (configuredKey && token === configuredKey) {
        return { authorized: true, botName: apiConfig?.botName || 'Muse Bot' };
      }
    } catch (err) {
      console.error('[IngestUpcomingGames] Lỗi đọc cấu hình API từ D1:', err);
    }
  }

  return { authorized: false, botName: '', error: 'API Key không chính xác hoặc đã bị vô hiệu hóa.' };
}

function slugify(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status') || 'ALL';
  const targetSlug = url.searchParams.get('slug');

  let upcomingGames: any[] = [];
  if (env.DB) {
    try {
      const saved = await getSettingD1(env.DB, 'wcg_admin_upcoming_games_v1');
      if (Array.isArray(saved)) {
        upcomingGames = saved;
      }
    } catch (err) {
      console.error('[IngestUpcomingGames] Lỗi đọc upcoming_games từ D1:', err);
    }
  }

  if (targetSlug) {
    const single = upcomingGames.find((g) => g.slug === targetSlug || g.id === targetSlug);
    if (!single) {
      return new Response(JSON.stringify({ success: false, error: 'Không tìm thấy game sắp ra mắt' }), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }
    return new Response(JSON.stringify({ success: true, game: single }), {
      headers: CORS_HEADERS,
    });
  }

  let filtered = upcomingGames;
  if (statusFilter !== 'ALL') {
    filtered = upcomingGames.filter((g) => g.status === statusFilter);
  }

  return new Response(
    JSON.stringify({
      success: true,
      total: filtered.length,
      games: filtered,
      timestamp: new Date().toISOString(),
    }),
    { headers: CORS_HEADERS }
  );
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const startTime = Date.now();
  const sourceIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';

  let payload: any = null;
  try {
    payload = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Dữ liệu JSON gửi lên không hợp lệ.' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 1. Xác thực API Key
  const auth = await authenticateRequest(request, env, payload?.apiKey);
  if (!auth.authorized) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error || 'Truy cập bị từ chối.' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const botName = payload?.botName || payload?.source || auth.botName || 'Muse Upcoming Games Bot';

  // 2. Trích xuất danh sách game (hỗ trợ cả payload.games hoặc payload là array trực tiếp)
  const incomingList: any[] = Array.isArray(payload) ? payload : (Array.isArray(payload?.games) ? payload.games : [payload]);

  if (!incomingList || incomingList.length === 0 || !incomingList[0]?.name) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Payload cần chứa mảng "games" hoặc tối thiểu 1 game có trường "name".',
        sampleFormat: {
          apiKey: 'YOUR_API_KEY',
          botName: 'Muse Upcoming Games Bot',
          games: [
            {
              name: 'Strinova VN',
              slug: 'strinova-vn',
              publisher: 'iDreamSky / VPlay',
              releaseDate: '2026-10-23T10:00:00+07:00',
              category: 'Bắn Súng Anime 3D',
              platform: 'PC, Android, iOS',
              iconUrl: 'https://...',
              bannerUrl: 'https://...',
              description: 'Mô tả game...',
              preRegUrl: 'https://strinova.vplay.vn',
              expectedCodes: ['STRINOVAOB', 'VIP999'],
              status: 'UPCOMING'
            }
          ]
        }
      }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 3. Tải danh sách hiện tại từ D1
  let currentUpcomingGames: any[] = [];
  if (env.DB) {
    try {
      const saved = await getSettingD1(env.DB, 'wcg_admin_upcoming_games_v1');
      if (Array.isArray(saved)) {
        currentUpcomingGames = saved;
      }
    } catch (e) {
      console.warn('[IngestUpcomingGames] Warning reading existing upcoming games:', e);
    }
  }

  const existingMap = new Map<string, any>();
  for (const item of currentUpcomingGames) {
    if (item.slug) existingMap.set(item.slug.toLowerCase(), item);
    if (item.id) existingMap.set(item.id.toLowerCase(), item);
  }

  let addedCount = 0;
  let updatedCount = 0;
  const processedDetails: any[] = [];
  const nowIso = new Date().toISOString();

  for (const raw of incomingList) {
    if (!raw || typeof raw !== 'object' || !raw.name) continue;

    const name = String(raw.name).trim();
    const slug = raw.slug ? slugify(String(raw.slug).trim()) : slugify(name);
    if (!slug) continue;

    const publisher = raw.publisher ? String(raw.publisher).trim() : 'Nhà phát hành chính thức';
    const releaseDate = raw.releaseDate || raw.release_date || raw.launchDate || raw.launch_date || nowIso;
    const category = raw.category ? String(raw.category).trim() : 'Game Mới';
    const platform = raw.platform ? String(raw.platform).trim() : 'Android, iOS, PC';
    const iconUrl = raw.iconUrl || raw.icon_url || raw.icon || `/game_icons/${slug}.webp`;
    const bannerUrl = raw.bannerUrl || raw.banner_url || raw.banner || undefined;
    const description = raw.description || `Thông tin ngày mở server và giftcode tân thủ tựa game ${name}.`;
    const preRegUrl = raw.preRegUrl || raw.pre_reg_url || raw.downloadUrl || undefined;
    const status = raw.status === 'LAUNCHED' || raw.status === 'CANCELLED' ? raw.status : 'UPCOMING';

    // Parse expected giftcodes
    let expectedCodes: string[] = [];
    if (Array.isArray(raw.expectedCodes)) {
      expectedCodes = raw.expectedCodes.map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
    } else if (Array.isArray(raw.codes)) {
      expectedCodes = raw.codes.map((c: any) => String(c.code || c).trim().toUpperCase()).filter(Boolean);
    } else if (typeof raw.expectedCodes === 'string') {
      expectedCodes = raw.expectedCodes.split(/[,;\n]+/).map((s: string) => s.trim().toUpperCase()).filter(Boolean);
    }

    const existing = existingMap.get(slug.toLowerCase()) || (raw.id ? existingMap.get(String(raw.id).toLowerCase()) : null);

    if (existing) {
      // Cập nhật bản ghi hiện tại
      existing.name = name;
      existing.publisher = publisher;
      existing.releaseDate = releaseDate;
      existing.category = category;
      existing.platform = platform;
      if (iconUrl) existing.iconUrl = iconUrl;
      if (bannerUrl) existing.bannerUrl = bannerUrl;
      if (description) existing.description = description;
      if (preRegUrl) existing.preRegUrl = preRegUrl;
      existing.status = status;
      if (raw.subscribersCount) existing.subscribersCount = Number(raw.subscribersCount);
      existing.source = botName;
      existing.updatedAt = nowIso;

      // Hợp nhất giftcode dự kiến không trùng lặp
      const mergedCodes = new Set<string>((existing.expectedCodes || []).map((c: string) => c.toUpperCase()));
      expectedCodes.forEach((c) => mergedCodes.add(c));
      existing.expectedCodes = Array.from(mergedCodes);

      updatedCount++;
      processedDetails.push({ name, slug, action: 'UPDATED', status: existing.status, releaseDate });
    } else {
      // Tạo bản ghi mới
      const newRecord = {
        id: raw.id || `ug_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name,
        slug,
        publisher,
        releaseDate,
        category,
        platform,
        iconUrl,
        bannerUrl,
        description,
        preRegUrl,
        expectedCodes,
        subscribersCount: Number(raw.subscribersCount || 0),
        source: botName,
        status,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      currentUpcomingGames.unshift(newRecord);
      existingMap.set(slug.toLowerCase(), newRecord);
      addedCount++;
      processedDetails.push({ name, slug, action: 'ADDED', status: newRecord.status, releaseDate });
    }
  }

  // 4. Lưu lại vào D1
  if (env.DB) {
    try {
      await setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', currentUpcomingGames);
    } catch (err) {
      console.error('[IngestUpcomingGames] Lỗi ghi D1:', err);
      return new Response(
        JSON.stringify({ success: false, error: 'Không thể lưu dữ liệu vào cơ sở dữ liệu máy chủ.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  const durationMs = Date.now() - startTime;

  return new Response(
    JSON.stringify({
      success: true,
      message: `Đã xử lý ${incomingList.length} game chuẩn bị ra mắt thành công từ ${botName}!`,
      botName,
      sourceIp,
      durationMs,
      totalReceived: incomingList.length,
      totalAdded: addedCount,
      totalUpdated: updatedCount,
      totalUpcomingGamesInDatabase: currentUpcomingGames.length,
      details: processedDetails,
      timestamp: nowIso,
    }),
    {
      status: 200,
      headers: CORS_HEADERS,
    }
  );
}
