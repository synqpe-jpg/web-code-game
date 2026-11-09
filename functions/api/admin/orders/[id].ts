import { ensureSchemaUpgrades } from '../../../services/d1_service';
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
 * GET /api/admin/orders/:id
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'STORE_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const url = new URL(request.url);
    let targetId = String(params?.id || '').trim();
    if (!targetId) {
      const parts = url.pathname.split('/').filter(Boolean);
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart !== 'orders') {
        targetId = lastPart;
      }
    }

    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã đơn hàng (:id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const order = await env.DB.prepare(`
      SELECT *
      FROM orders
      WHERE id = ?
      LIMIT 1
    `).bind(targetId).first<any>();

    if (!order) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy đơn hàng "${targetId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const deliveredCodes = await env.DB.prepare(`
      SELECT id, code_content, status, sold_at
      FROM inventory_codes
      WHERE order_id = ?
    `).bind(order.id).all<any>().catch(() => ({ results: [] }));

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: order.id,
          memberId: order.member_id,
          buyerName: order.buyer_email || 'Khách hàng',
          buyerEmail: order.buyer_email || '',
          productId: order.product_id,
          productTitle: order.product_title,
          amount: Number(order.total_amount || 0),
          totalAmount: Number(order.total_amount || 0),
          originalPrice: order.original_price !== null ? Number(order.original_price) : null,
          pricePaid: order.price_paid !== null ? Number(order.price_paid) : Number(order.total_amount || 0),
          discountType: order.discount_type,
          discountAmount: Number(order.discount_amount || 0),
          priceRule: order.price_rule,
          paymentMethod: order.payment_method || 'WALLET',
          paymentStatus: order.payment_status || 'PAID',
          status: order.status,
          expiresAt: order.expires_at,
          paidAt: order.paid_at,
          sepayTransactionId: order.sepay_transaction_id,
          deliveredCodes: (deliveredCodes?.results || []).map((c: any) => ({
            id: c.id,
            codeContent: c.code_content,
            status: c.status,
            soldAt: c.sold_at,
          })),
          createdAt: order.created_at,
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy chi tiết đơn hàng: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
