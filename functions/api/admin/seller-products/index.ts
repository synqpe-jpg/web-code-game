import { verifyAdminAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema } from '../../../services/d1_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET: Danh sách sản phẩm sàn TMĐT chờ duyệt / quản lý (§5.3)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyAdminAuth(request, env as any, 'MARKETPLACE_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Yêu cầu quyền Quản trị viên (MARKETPLACE_MANAGE).' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '30', 10)));
    const offset = (page - 1) * limit;

    let query = `
      SELECT sp.*, s.name as seller_name, s.slug as seller_slug, s.status as seller_status,
             (SELECT COUNT(*) FROM seller_codes sc WHERE sc.product_id = sp.id AND sc.status = 'IN_STOCK' AND sc.deleted_at IS NULL) as in_stock_count
      FROM seller_products sp
      JOIN sellers s ON sp.seller_id = s.id
      WHERE sp.deleted_at IS NULL
    `;
    const binds: any[] = [];

    if (statusFilter) {
      query += ` AND sp.status = ?`;
      binds.push(statusFilter);
    }

    query += ` ORDER BY sp.created_at DESC LIMIT ? OFFSET ?`;
    binds.push(limit, offset);

    const prodsResult = await env.DB.prepare(query).bind(...binds).all<any>();

    let countQuery = `SELECT COUNT(*) as total FROM seller_products WHERE deleted_at IS NULL`;
    const countBinds: any[] = [];
    if (statusFilter) {
      countQuery += ` AND status = ?`;
      countBinds.push(statusFilter);
    }
    const countResult = await env.DB.prepare(countQuery).bind(...countBinds).first<{ total: number }>();

    return new Response(
      JSON.stringify({
        success: true,
        products: prodsResult.results || [],
        pagination: {
          page,
          limit,
          total: countResult?.total || 0,
          totalPages: Math.ceil((countResult?.total || 0) / limit),
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
