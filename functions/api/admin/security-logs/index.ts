import { ensureSchemaUpgrades } from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/admin/security-logs
 * Tra cứu danh sách nhật ký kiểm toán và cảnh báo bảo mật
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const authCheck = await verifyAdminAuth(request, env as any, 'SECURITY_LOGS_FULL');
    if (!authCheck.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: authCheck.error || 'Yêu cầu quyền SECURITY_LOGS_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
    const offset = (page - 1) * limit;

    const action = url.searchParams.get('action')?.trim();
    const actor = url.searchParams.get('actor')?.trim();
    const severity = url.searchParams.get('severity')?.toUpperCase().trim();
    const targetId = url.searchParams.get('target_id')?.trim();
    const search = url.searchParams.get('search')?.trim();
    const fromDate = url.searchParams.get('from_date')?.trim();
    const toDate = url.searchParams.get('to_date')?.trim();

    const conditions: string[] = [];
    const bindings: any[] = [];

    if (action) {
      conditions.push('action LIKE ?');
      bindings.push(`%${action}%`);
    }
    if (actor) {
      conditions.push('(actor_name LIKE ? OR actor_email LIKE ?)');
      bindings.push(`%${actor}%`, `%${actor}%`);
    }
    if (severity) {
      conditions.push('severity = ?');
      bindings.push(severity);
    }
    if (targetId) {
      conditions.push('target_id LIKE ?');
      bindings.push(`%${targetId}%`);
    }
    if (fromDate) {
      conditions.push('created_at >= ?');
      bindings.push(fromDate);
    }
    if (toDate) {
      conditions.push('created_at <= ?');
      bindings.push(toDate);
    }
    if (search) {
      conditions.push('(action LIKE ? OR details LIKE ? OR actor_name LIKE ? OR actor_email LIKE ? OR ip_address LIKE ?)');
      bindings.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM security_logs ${whereClause}`;
    const countRow = await env.DB.prepare(countQuery).bind(...bindings).first<{ total: number }>();
    const total = Number(countRow?.total) || 0;
    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    const selectQuery = `
      SELECT id, actor_name, actor_email, action, target_id, target_user, ip_address, severity, details, created_at
      FROM security_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rowsRes = await env.DB.prepare(selectQuery).bind(...bindings, limit, offset).all<any>();
    const rawLogs = rowsRes.results || [];

    const logs = rawLogs.map((row: any) => {
      let parsedDetails = row.details;
      if (typeof row.details === 'string') {
        try {
          parsedDetails = JSON.parse(row.details);
        } catch {
          parsedDetails = row.details;
        }
      }
      return {
        id: row.id,
        actor_name: row.actor_name,
        actor_email: row.actor_email,
        action: row.action,
        target_id: row.target_id,
        target_user: row.target_user,
        ip_address: row.ip_address,
        severity: row.severity,
        details: parsedDetails,
        created_at: row.created_at,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: logs,
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Lỗi tra cứu nhật ký bảo mật.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * POST /api/admin/security-logs
 * Ghi nhận nhật ký bảo mật / audit log thủ công từ client quản trị hoặc remote agent
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const authCheck = await verifyAdminAuth(request, env as any, 'SECURITY_LOGS_FULL');
    if (!authCheck.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: authCheck.error || 'Yêu cầu quyền SECURITY_LOGS_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const body = await request.json<any>().catch(() => ({}));
    if (!body.action) {
      return new Response(
        JSON.stringify({ success: false, message: 'Thiếu trường action.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const id = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const actorName = String(body.actor_name || (authCheck.keyRecord as any)?.name || 'Remote Agent').trim();
    const actorEmail = String(body.actor_email || (authCheck.keyRecord as any)?.actor_email || 'admin@codegame.shop').trim();
    const action = String(body.action).trim().toUpperCase();
    const targetId = body.target_id ? String(body.target_id).trim() : null;
    const targetUser = body.target_user ? String(body.target_user).trim() : null;
    const clientIp = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || body.ip_address || 'unknown';
    const severity = ['INFO', 'WARNING', 'CRITICAL', 'ALERT'].includes(String(body.severity || '').toUpperCase())
      ? String(body.severity).toUpperCase()
      : 'INFO';

    let detailsStr = '';
    if (typeof body.details === 'object' && body.details !== null) {
      detailsStr = JSON.stringify(body.details);
    } else {
      detailsStr = String(body.details || '');
    }

    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO security_logs (id, actor_name, actor_email, action, target_id, target_user, ip_address, severity, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, actorName, actorEmail, action, targetId, targetUser, clientIp, severity, detailsStr, now).run();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Ghi nhật ký bảo mật thành công.',
        data: {
          id,
          actor_name: actorName,
          actor_email: actorEmail,
          action,
          target_id: targetId,
          target_user: targetUser,
          ip_address: clientIp,
          severity,
          created_at: now,
        },
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Lỗi ghi nhật ký bảo mật.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
