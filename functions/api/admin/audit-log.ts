import { ensureSchemaUpgrades } from '../../services/d1_service';
import { verifyAdminAuth } from '../../services/mission_service';

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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const url = new URL(request.url);
    const scopeParam = (url.searchParams.get('scope') || 'all').toLowerCase().trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
    const offset = (page - 1) * limit;

    // Phân quyền theo scope
    let requiredScope = 'ADMIN_FULL';
    if (scopeParam === 'first-purchase') {
      requiredScope = 'FIRST_PURCHASE_MANAGE';
    } else if (scopeParam === 'escalating') {
      requiredScope = 'ESCALATING_MANAGE';
    }

    const authCheck = await verifyAdminAuth(request, env as any, requiredScope);
    if (!authCheck.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: authCheck.error || 'Yêu cầu quyền Quản trị viên.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Xây dựng điều kiện lọc theo scope
    let whereClause = '';
    const bindings: any[] = [];

    if (scopeParam === 'first-purchase') {
      whereClause = "WHERE action LIKE '%FIRST_PURCHASE%'";
    } else if (scopeParam === 'escalating') {
      whereClause = "WHERE action LIKE '%ESCALATING%'";
    }

    // Đếm tổng số bản ghi
    const countQuery = `SELECT COUNT(*) as total FROM security_logs ${whereClause}`;
    const countRow = await env.DB.prepare(countQuery).first<any>();
    const total = Number(countRow?.total) || 0;
    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    // Lấy danh sách bản ghi
    const selectQuery = `
      SELECT id, actor_name, actor_email, action, target_id, ip_address, severity, details, created_at
      FROM security_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rowsRes = await env.DB.prepare(selectQuery).bind(limit, offset).all<any>();
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
        ip_address: row.ip_address,
        severity: row.severity,
        details: parsedDetails,
        created_at: row.created_at,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        scope: scopeParam,
        page,
        limit,
        total,
        total_pages: totalPages,
        logs,
      }),
      { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Lỗi truy vấn nhật ký kiểm toán: ' + (err?.message || 'Không xác định'),
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
