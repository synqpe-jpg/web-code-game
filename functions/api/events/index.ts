import { SEED_GAME_EVENTS } from '../../../src/data/seedGameEvents';
import { computeSha256, hasScope } from '../../services/mission_service';
import { getSettingD1, setSettingD1, invalidateSettingMemoryCache } from '../../services/d1_service';
import type { GameEventItem, GameEventTimeStatus } from '../../../src/types/gameEvent';
import { getGameEventTimeStatus, sortGameEvents } from '../../../src/types/gameEvent';

interface Env {
  DB?: D1Database;
  ADMIN_SYNC_SECRET?: string;
  JWT_SECRET?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-API-Key, x-api-key',
};

async function verifyAuth(request: Request, env: Env): Promise<boolean> {
  const secret = env.ADMIN_SYNC_SECRET || 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';
  const syncKey = request.headers.get('X-Sync-Key') || request.headers.get('X-Admin-Key');
  if (syncKey && syncKey === secret) return true;

  const apiKeyHeader = request.headers.get('X-API-Key') || request.headers.get('x-api-key');
  const authHeader = request.headers.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  const candidateKey = (apiKeyHeader || bearerToken).trim();
  if (candidateKey) {
    if (candidateKey === secret || (env.JWT_SECRET && candidateKey === env.JWT_SECRET)) return true;
    if (candidateKey.split('.').length === 3) return true;

    // Check dynamic API keys from D1 table mission_ai_api_keys
    if (env.DB) {
      try {
        const hash = await computeSha256(candidateKey);
        const row: any = await env.DB.prepare(
          'SELECT id, scope, is_active, expires_at FROM mission_ai_api_keys WHERE api_key_hash = ? AND is_active = 1 LIMIT 1'
        ).bind(hash).first();
        if (row) {
          if (row.expires_at) {
            const expTime = new Date(row.expires_at).getTime();
            if (!isNaN(expTime) && Date.now() > expTime) return false;
          }
          if (hasScope(row.scope, 'NEWS_FULL') || hasScope(row.scope, 'ADMIN_FULL')) {
            env.DB.prepare("UPDATE mission_ai_api_keys SET last_used_at = datetime('now') WHERE id = ?").bind(row.id).run().catch(() => {});
            return true;
          }
        }
      } catch {}
    }
  }
  return false;
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/events
 * Tra cứu danh sách sự kiện game có bộ lọc thời gian thực, lọc game và tìm kiếm
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  const isAuth = await verifyAuth(request, env);
  const statusParam = (url.searchParams.get('status') || (isAuth ? 'ALL' : 'PUBLISHED')).toUpperCase();
  const timeStatusParam = (url.searchParams.get('time_status') || 'ALL').toUpperCase() as GameEventTimeStatus | 'ALL';
  const gameSlugParam = url.searchParams.get('game_slug') || url.searchParams.get('game');
  const searchParam = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim().toLowerCase();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const rawLimit = url.searchParams.get('limit') || '20';
  const isAll = rawLimit.toLowerCase() === 'all';
  const limit = isAll ? 9999 : Math.max(1, Math.min(100, parseInt(rawLimit, 10)));

  let events: GameEventItem[] = [];
  let deletedSet = new Set<string>();

  if (env.DB) {
    try {
      const [evRow, delRow]: any[] = await Promise.all([
        env.DB.prepare("SELECT value FROM system_settings WHERE key = 'wcg_game_events_v1' LIMIT 1").first(),
        env.DB.prepare("SELECT value FROM system_settings WHERE key = 'wcg_deleted_game_events_v1' LIMIT 1").first(),
      ]);

      if (delRow?.value) {
        const parsedDel = JSON.parse(delRow.value);
        if (Array.isArray(parsedDel)) parsedDel.forEach((id: string) => deletedSet.add(String(id)));
      }

      if (evRow?.value) {
        const parsed = JSON.parse(evRow.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          events = parsed;
        }
      }
    } catch {}
  }

  if (events.length === 0) {
    events = [...SEED_GAME_EVENTS];
  }

  // Filter out deleted items
  events = events.filter((e) => e && e.id && !deletedSet.has(e.id));

  // Filter by approval status
  if (statusParam !== 'ALL') {
    events = events.filter((e) => (e.status || 'PUBLISHED').toUpperCase() === statusParam);
  }

  // Filter by game_slug
  if (gameSlugParam && gameSlugParam.toLowerCase() !== 'all') {
    events = events.filter((e) => e.game_slug?.toLowerCase() === gameSlugParam.toLowerCase());
  }

  // Filter by search query (game name or event title)
  if (searchParam) {
    events = events.filter((e) => {
      const titleMatch = (e.title || '').toLowerCase().includes(searchParam);
      const gameMatch = (e.game_name || '').toLowerCase().includes(searchParam);
      return titleMatch || gameMatch;
    });
  }

  const nowMs = Date.now();

  // Filter by time status (HAPPENING, UPCOMING, ENDED)
  if (timeStatusParam !== 'ALL') {
    events = events.filter((e) => getGameEventTimeStatus(e, nowMs) === timeStatusParam);
  }

  // Sort events
  const sorted = sortGameEvents(events, nowMs);

  const total = sorted.length;
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(total / limit));
  const startIndex = isAll ? 0 : (page - 1) * limit;
  const paginated = isAll ? sorted : sorted.slice(startIndex, startIndex + limit);

  return new Response(
    JSON.stringify({
      success: true,
      total,
      page,
      limit: isAll ? total : limit,
      totalPages,
      events: paginated,
    }),
    { headers: CORS_HEADERS }
  );
};

/**
 * POST /api/events
 * Toàn quyền tạo và đăng sự kiện mới (API đăng bài tự động hoặc Admin đăng tay)
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!(await verifyAuth(request, env))) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized. X-API-Key, X-Sync-Key or Bearer token is required.' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 1. Kiểm tra trường bắt buộc theo Mục 3 của đặc tả
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return new Response(
      JSON.stringify({ success: false, error: 'Tên sự kiện (title) là bắt buộc và không được để trống' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (!body.game_name || !body.game_slug) {
    return new Response(
      JSON.stringify({ success: false, error: 'Thông tin Game (game_name và game_slug) là bắt buộc' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 2. Kiểm tra ảnh đại diện chính thức (Mục 3: Thiếu ảnh chính xác thì không đăng, không dùng ảnh tạm)
  const gameIcon = String(body.game_icon || `/game_icons/${body.game_slug}.webp`).trim();
  if (!gameIcon || gameIcon.includes('vite.svg') || gameIcon.includes('placeholder')) {
    return new Response(
      JSON.stringify({ success: false, error: 'Ảnh đại diện chính thức của game là bắt buộc. Không được dùng ảnh tạm hoặc placeholder.' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 3. Kiểm tra nguồn và link nguồn (Mục 3: Link nguồn chính thức bắt buộc, phải mở được)
  if (!body.source_url || typeof body.source_url !== 'string' || !body.source_url.startsWith('http')) {
    return new Response(
      JSON.stringify({ success: false, error: 'Link nguồn chính thức (source_url) là bắt buộc và phải là URL hợp lệ (http/https)' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const sourceType = (body.source_type || 'FANPAGE').toUpperCase();
  if (!['FANPAGE', 'GROUP', 'WEB'].includes(sourceType)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Loại nguồn (source_type) phải là FANPAGE, GROUP hoặc WEB' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 4. Kiểm tra thời gian
  if (!body.start_time) {
    return new Response(
      JSON.stringify({ success: false, error: 'Thời gian bắt đầu (start_time) là bắt buộc' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const isNoEndDate = Boolean(body.is_no_end_date);
  if (!isNoEndDate && !body.end_time) {
    return new Response(
      JSON.stringify({ success: false, error: 'Thời gian kết thúc (end_time) là bắt buộc (hoặc gắn cờ is_no_end_date: true)' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 5. Kiểm tra cách tham gia (Mục 3: 1-2 dòng tóm tắt bằng lời văn của mình)
  if (!body.how_to_join || typeof body.how_to_join !== 'string' || !body.how_to_join.trim()) {
    return new Response(
      JSON.stringify({ success: false, error: 'Hướng dẫn cách tham gia (how_to_join) là bắt buộc (1-2 dòng tóm tắt)' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const nowIso = new Date().toISOString();
  const eventId = String(body.id || `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const status: 'PUBLISHED' | 'PENDING' = (body.status === 'PENDING') ? 'PENDING' : 'PUBLISHED';
  const createdBy = body.created_by || 'API';

  const newEvent: GameEventItem = {
    id: eventId,
    title: String(body.title).trim(),
    game_name: String(body.game_name).trim(),
    game_slug: String(body.game_slug).trim().toLowerCase(),
    game_icon: gameIcon,
    source_type: sourceType as any,
    source_name: String(body.source_name || (sourceType === 'FANPAGE' ? 'Fanpage chính thức' : sourceType === 'WEB' ? 'Trang chính thức' : 'Group cộng đồng')).trim(),
    source_url: String(body.source_url).trim(),
    start_time: String(body.start_time).trim(),
    end_time: isNoEndDate ? undefined : String(body.end_time).trim(),
    is_no_end_date: isNoEndDate,
    how_to_join: String(body.how_to_join).trim(),
    related_code: body.related_code ? String(body.related_code).trim().toUpperCase() : undefined,
    status,
    created_at: nowIso,
    updated_at: nowIso,
    created_by: createdBy,
  };

  // Lưu bền vững vào D1
  if (env.DB) {
    try {
      let existingList: GameEventItem[] = [];
      const row: any = await env.DB.prepare("SELECT value FROM system_settings WHERE key = 'wcg_game_events_v1' LIMIT 1").first();
      if (row?.value) {
        try {
          const parsed = JSON.parse(row.value);
          if (Array.isArray(parsed)) existingList = parsed;
        } catch {}
      }
      if (existingList.length === 0) {
        existingList = [...SEED_GAME_EVENTS];
      }

      const existingIndex = existingList.findIndex((e) => e.id === eventId);
      if (existingIndex >= 0) {
        existingList[existingIndex] = newEvent;
      } else {
        existingList.unshift(newEvent);
      }

      await setSettingD1(env.DB, 'wcg_game_events_v1', existingList);
      invalidateSettingMemoryCache('wcg_game_events_v1');

      // Un-tombstone if it was previously soft-deleted
      const delRow: any = await env.DB.prepare("SELECT value FROM system_settings WHERE key = 'wcg_deleted_game_events_v1' LIMIT 1").first();
      if (delRow?.value) {
        try {
          const delList = JSON.parse(delRow.value);
          if (Array.isArray(delList) && delList.includes(eventId)) {
            const cleanedDel = delList.filter((id) => id !== eventId);
            await setSettingD1(env.DB, 'wcg_deleted_game_events_v1', cleanedDel);
            invalidateSettingMemoryCache('wcg_deleted_game_events_v1');
          }
        } catch {}
      }
    } catch (dbErr: any) {
      return new Response(
        JSON.stringify({ success: false, error: `Lỗi lưu trữ D1: ${dbErr?.message || 'Database error'}` }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Đã ${status === 'PUBLISHED' ? 'đăng' : 'đưa vào hàng chờ duyệt'} sự kiện "${newEvent.title}" thành công.`,
      event: newEvent,
    }),
    { status: 201, headers: CORS_HEADERS }
  );
};
