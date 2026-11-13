import { verifyMemberAuth } from '../services/mission_service';
import { ensureMarketplaceSchema } from '../services/d1_service';

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

// GET: Tủ mã đã mua của khách hàng (§6.3)
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

    const buyerId = auth.member.id;
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(5, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const ordersResult = await env.DB
      .prepare(`
        SELECT 
          so.id, so.order_code, so.seller_id, s.name as seller_name, s.slug as seller_slug,
          so.product_id, so.product_name, so.game_slug, so.delivered_code, so.replacement_code,
          so.price_core, so.status, so.report_reason, so.resolution_type, so.resolution_note,
          so.reported_at, so.resolved_at, so.created_at, sp.cover_url, sp.warranty_type,
          sr.id as rating_id, sr.stars as rating_stars, sr.comment as rating_comment,
          sr.status as rating_status, sr.reject_reason as rating_reject_reason,
          sd.id as dispute_id, sd.status as dispute_status, sd.reason as dispute_reason,
          sd.detail as dispute_detail, sd.seller_response as dispute_seller_response,
          sd.resolution_note as dispute_resolution_note
        FROM seller_orders so
        LEFT JOIN sellers s ON so.seller_id = s.id
        LEFT JOIN seller_products sp ON so.product_id = sp.id
        LEFT JOIN seller_ratings sr ON so.id = sr.order_id
        LEFT JOIN seller_disputes sd ON so.id = sd.order_id
        WHERE so.buyer_member_id = ?
        ORDER BY so.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(buyerId, limit, offset)
      .all<any>();

    const countResult = await env.DB
      .prepare("SELECT COUNT(*) as total FROM seller_orders WHERE buyer_member_id = ?")
      .bind(buyerId)
      .first<{ total: number }>();

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
