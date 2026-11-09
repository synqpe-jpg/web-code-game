import { ensureSchemaUpgrades, logAdminAudit } from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/admin/free-codes
 * Danh sách giftcode miễn phí + phân trang + lọc theo game, trạng thái
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'GAMES_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền GAMES_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    const gameSlug = (url.searchParams.get('gameSlug') || url.searchParams.get('game_slug') || '').trim();
    const status = (url.searchParams.get('status') || 'ALL').trim();
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();

    const conditions: string[] = [];
    const params: any[] = [];

    if (gameSlug) {
      conditions.push('c.game_slug = ?');
      params.push(gameSlug);
    }

    if (status !== 'ALL' && status !== '') {
      conditions.push('c.status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(c.code LIKE ? OR c.rewards LIKE ? OR c.game_slug LIKE ? OR g.name LIKE ?)');
      const wild = `%${search}%`;
      params.push(wild, wild, wild, wild);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM codes c LEFT JOIN games g ON c.game_slug = g.slug ${whereClause}`;
    const totalRow = await env.DB.prepare(countSql).bind(...params).first<any>();
    const total = Number(totalRow?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const dataSql = `
      SELECT c.id, c.game_slug, g.name as game_name, c.code, c.rewards, c.status, c.expires_at, c.created_at
      FROM codes c
      LEFT JOIN games g ON c.game_slug = g.slug
      ${whereClause}
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await env.DB.prepare(dataSql).bind(...params, limit, offset).all<any>();

    const codes = (rows?.results || []).map((c: any) => ({
      id: c.id,
      gameSlug: c.game_slug,
      gameName: c.game_name || c.game_slug,
      code: c.code,
      rewards: c.rewards || '',
      status: c.status || 'active',
      expiresAt: c.expires_at || null,
      createdAt: c.created_at,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        page,
        limit,
        total,
        totalPages,
        codes,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy danh sách giftcode: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * POST /api/admin/free-codes
 * Thêm mã giftcode mới vào kho code miễn phí
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'GAMES_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON payload required' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const code = String(body.code || body.codeValue || '').trim();
    const gameSlug = String(body.game_slug || body.gameSlug || '').trim();
    const gameName = String(body.game_name || body.gameName || gameSlug).trim();
    const rewards = String(body.rewards || '').trim();
    const expiresAt = body.expires_at || body.expiresAt || null;
    const status = String(body.status || 'active').toLowerCase().trim();
    const isHot = body.is_hot === true || body.isHot === true ? 1 : 0;

    if (!code || !gameSlug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu thông tin bắt buộc: code và game_slug.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const newId = `code_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await env.DB.prepare(`
      INSERT INTO codes (id, game_slug, code, rewards, status, expires_at, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'admin', datetime('now'))
    `).bind(newId, gameSlug, code, rewards, status, expiresAt).run();

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'CREATE_FREE_CODE',
      targetId: newId,
      details: { id: newId, code, gameSlug, gameName, rewards },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã thêm giftcode "${code}" cho tựa game "${gameName}" thành công.`,
        code: {
          id: newId,
          gameSlug,
          gameName,
          code,
          rewards,
          status,
          expiresAt,
        },
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi thêm giftcode: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * DELETE /api/admin/free-codes
 * Xóa hàng loạt giftcode qua body { ids: [1, 2, 3] }
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'GAMES_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Yêu cầu body dạng JSON { ids: [...] }.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const ids = Array.isArray(body?.ids) ? body.ids : [];
    if (ids.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Danh sách mã cần xóa (ids) trống.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const placeholders = ids.map(() => '?').join(',');
    await env.DB.prepare(`DELETE FROM codes WHERE id IN (${placeholders})`).bind(...ids).run();

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'DELETE_FREE_CODES_BULK',
      details: { deletedIds: ids, count: ids.length },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã xóa thành công ${ids.length} mã giftcode.`,
        deletedCount: ids.length,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi xóa mã giftcode: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
