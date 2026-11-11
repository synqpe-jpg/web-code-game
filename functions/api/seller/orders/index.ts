import { verifyMemberAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema } from '../../../services/d1_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET: Danh sách đơn hàng bán ra của gian hàng
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const memberId = auth.member.id;

    // Tìm seller của member
    const seller = await env.DB
      .prepare(`
        SELECT s.id FROM sellers s
        WHERE (s.owner_member_id = ? OR s.id IN (SELECT seller_id FROM seller_subaccounts WHERE member_id = ?))
          AND s.deleted_at IS NULL
        LIMIT 1
      `)
      .bind(memberId, memberId)
      .first<{ id: string }>();

    if (!seller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bạn không có quyền truy cập gian hàng này.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '30', 10)));
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, order_code, buyer_member_id, buyer_name, product_id, product_name, game_slug,
             price_core, status, report_reason, report_note, reported_at,
             resolution_type, resolution_note, resolved_at, created_at, updated_at
      FROM seller_orders
      WHERE seller_id = ?
    `;
    const binds: any[] = [seller.id];

    if (statusFilter) {
      query += ` AND status = ?`;
      binds.push(statusFilter);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    binds.push(limit, offset);

    const ordersResult = await env.DB.prepare(query).bind(...binds).all<any>();

    let countQuery = `SELECT COUNT(*) as total FROM seller_orders WHERE seller_id = ?`;
    const countBinds: any[] = [seller.id];
    if (statusFilter) {
      countQuery += ` AND status = ?`;
      countBinds.push(statusFilter);
    }
    const countResult = await env.DB.prepare(countQuery).bind(...countBinds).first<{ total: number }>();

    return new Response(
      JSON.stringify({
        success: true,
        orders: ordersResult.results || [],
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
