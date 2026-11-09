import { ensureSchemaUpgrades, logAdminAudit } from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';
import { ensureNotificationTablesD1 } from '../../notifications/_emailHelper';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/admin/notifications/subscribers
 * Danh sách người dùng đăng ký nhận email thông báo + phân trang + tìm kiếm
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

    const auth = await verifyAdminAuth(request, env as any, 'NOTIFICATIONS_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền NOTIFICATIONS_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    await ensureNotificationTablesD1(env.DB);

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    const status = (url.searchParams.get('status') || 'ALL').toUpperCase().trim();
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();

    const conditions: string[] = [];
    const sqlParams: any[] = [];

    if (status === 'ACTIVE') {
      conditions.push('is_active = 1');
    } else if (status === 'UNSUBSCRIBED' || status === 'INACTIVE') {
      conditions.push('is_active = 0');
    }

    if (search) {
      conditions.push('(email LIKE ? OR user_id LIKE ?)');
      const wild = `%${search}%`;
      sqlParams.push(wild, wild);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = await env.DB.prepare(`SELECT COUNT(*) as total FROM email_subscribers ${whereClause}`)
      .bind(...sqlParams)
      .first<any>();
    const total = Number(countRow?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const rows = await env.DB.prepare(`
      SELECT id, email, user_id, notify_followed_codes, notify_giveaways, notify_sales, subscribed_games, is_active, created_at, updated_at
      FROM email_subscribers
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).bind(...sqlParams, limit, offset).all<any>();

    const summaryRow = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_count
      FROM email_subscribers
    `).first<any>();

    const subscribers = (rows?.results || []).map((r: any) => {
      let games: string[] = [];
      try {
        games = JSON.parse(r.subscribed_games || '[]');
      } catch {}
      return {
        id: r.id,
        email: r.email,
        userId: r.user_id || null,
        notifyFollowedCodes: Boolean(r.notify_followed_codes),
        notifyGiveaways: Boolean(r.notify_giveaways),
        notifySales: Boolean(r.notify_sales),
        subscribedGames: games,
        isActive: Boolean(r.is_active),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: Number(summaryRow?.total_count || 0),
          active: Number(summaryRow?.active_count || 0),
          unsubscribed: Number(summaryRow?.inactive_count || 0),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        subscribers,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi truy vấn danh sách người đăng ký' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * DELETE /api/admin/notifications/subscribers
 * Xóa hoặc hủy đăng ký email nhận tin
 * Body: { id?: string; email?: string }
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

    const auth = await verifyAdminAuth(request, env as any, 'NOTIFICATIONS_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền NOTIFICATIONS_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    await ensureNotificationTablesD1(env.DB);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Body JSON không hợp lệ' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const id = body.id ? String(body.id).trim() : '';
    const email = body.email ? String(body.email).trim().toLowerCase() : '';

    if (!id && !email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng cung cấp id hoặc email của người đăng ký cần xóa' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let res;
    if (id) {
      res = await env.DB.prepare('DELETE FROM email_subscribers WHERE id = ?').bind(id).run();
    } else {
      res = await env.DB.prepare('DELETE FROM email_subscribers WHERE email = ?').bind(email).run();
    }

    const deleted = Number(res?.meta?.changes || 0);

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'API Client',
      action: 'DELETE_EMAIL_SUBSCRIBER',
      targetId: id || email,
      details: JSON.stringify({ deletedCount: deleted }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: deleted > 0 ? 'Đã xóa người đăng ký thành công.' : 'Không tìm thấy người đăng ký phù hợp.',
        deletedCount: deleted,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi xóa người đăng ký email' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
