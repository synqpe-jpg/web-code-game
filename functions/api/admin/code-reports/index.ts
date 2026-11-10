import { ensureSchemaUpgrades, ensureCodeReportsSchema } from '../../../services/d1_service';
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
 * GET /api/admin/code-reports
 * Danh sách báo mã lỗi + đếm số người cùng báo + phân trang chuẩn
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
    await ensureCodeReportsSchema(env.DB);

    const url = new URL(request.url);
    const status = (url.searchParams.get('status') || 'ALL').trim();
    const reason = (url.searchParams.get('reason') || 'ALL').trim();
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').toLowerCase().trim();

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    const offset = (page - 1) * limit;

    // 1. Thống kê số lượng từng trạng thái
    const countsRes = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'RESOLVED_CONFIRMED' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'RESOLVED_INVALID' THEN 1 ELSE 0 END) as invalid,
        SUM(CASE WHEN status = 'DISMISSED' THEN 1 ELSE 0 END) as dismissed
      FROM code_reports
    `).first<any>();

    const counts = {
      total: countsRes?.total || 0,
      pending: countsRes?.pending || 0,
      confirmed: countsRes?.confirmed || 0,
      invalid: countsRes?.invalid || 0,
      dismissed: countsRes?.dismissed || 0,
    };

    // 2. Xây dựng câu truy vấn lọc
    const whereClauses: string[] = ['1=1'];
    const binds: any[] = [];

    if (status !== 'ALL' && status !== '') {
      whereClauses.push('r.status = ?');
      binds.push(status);
    }

    if (reason !== 'ALL' && reason !== '') {
      whereClauses.push('r.reason = ?');
      binds.push(reason);
    }

    if (search) {
      whereClauses.push('(LOWER(r.code) LIKE ? OR LOWER(r.game_slug) LIKE ? OR LOWER(r.user_name) LIKE ?)');
      const s = `%${search}%`;
      binds.push(s, s, s);
    }

    const whereSql = whereClauses.join(' AND ');

    // Đếm tổng số bản ghi khớp bộ lọc
    const filteredCountRes = await env.DB.prepare(`
      SELECT COUNT(*) as cnt 
      FROM code_reports r 
      WHERE ${whereSql}
    `).bind(...binds).first<any>();

    const filteredTotal = filteredCountRes?.cnt || 0;
    const totalPages = Math.ceil(filteredTotal / limit) || 1;

    // Lấy dữ liệu kèm số người khác nhau đã báo cùng mã
    const queryBinds = [...binds, limit, offset];
    const reportsRes = await env.DB.prepare(`
      SELECT 
        r.*,
        COALESCE(sc.reporters_count, 1) as same_code_reporters,
        CASE WHEN COALESCE(sc.reporters_count, 1) >= 3 THEN 1 ELSE 0 END as needs_attention
      FROM code_reports r
      LEFT JOIN (
        SELECT game_slug, code, COUNT(DISTINCT user_id) as reporters_count
        FROM code_reports
        GROUP BY game_slug, code
      ) sc ON sc.game_slug = r.game_slug AND sc.code = r.code
      WHERE ${whereSql}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...queryBinds).all<any>();

    return new Response(
      JSON.stringify({
        success: true,
        reports: reportsRes.results || [],
        pagination: {
          total: filteredTotal,
          page,
          limit,
          totalPages,
        },
        counts,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy danh sách báo lỗi mã: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
