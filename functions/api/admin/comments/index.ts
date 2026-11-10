import { ensureSchemaUpgrades, ensureGameCommentsSchema } from '../../../services/d1_service';
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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/admin/comments
 * Danh sách bình luận game cho quản trị viên duyệt + lọc + phân trang
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available' }), { status: 500, headers: CORS_HEADERS });
    }

    const auth = await verifyAdminAuth(request, env as any, 'GAMES_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền GAMES_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    await ensureGameCommentsSchema(env.DB);

    const url = new URL(request.url);
    const status = (url.searchParams.get('status') || 'ALL').trim();
    const gameSlug = (url.searchParams.get('game_slug') || '').toLowerCase().trim();
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').toLowerCase().trim();

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    const offset = (page - 1) * limit;

    // 1. Thống kê theo trạng thái
    const countsRes = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected
      FROM game_comments
    `).first<any>();

    const counts = {
      total: countsRes?.total || 0,
      pending: countsRes?.pending || 0,
      approved: countsRes?.approved || 0,
      rejected: countsRes?.rejected || 0,
    };

    // 2. Lọc
    const whereClauses: string[] = ['1=1'];
    const binds: any[] = [];

    if (status !== 'ALL' && status !== '') {
      whereClauses.push('status = ?');
      binds.push(status);
    }

    if (gameSlug) {
      whereClauses.push('game_slug = ?');
      binds.push(gameSlug);
    }

    if (search) {
      whereClauses.push('(LOWER(content) LIKE ? OR LOWER(game_slug) LIKE ? OR LOWER(user_name) LIKE ?)');
      const s = `%${search}%`;
      binds.push(s, s, s);
    }

    const whereSql = whereClauses.join(' AND ');

    const countRes = await env.DB.prepare(`SELECT COUNT(*) as cnt FROM game_comments WHERE ${whereSql}`).bind(...binds).first<any>();
    const total = countRes?.cnt || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const listBinds = [...binds, limit, offset];
    const commentsRes = await env.DB.prepare(`
      SELECT * FROM game_comments 
      WHERE ${whereSql}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).bind(...listBinds).all<any>();

    return new Response(
      JSON.stringify({
        success: true,
        comments: commentsRes.results || [],
        pagination: { total, page, limit, totalPages },
        counts,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message }), { status: 500, headers: CORS_HEADERS });
  }
};
