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
 * GET /api/admin/orders
 * Danh sách đơn hàng code + phân trang + lọc trạng thái & thanh toán
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

    const auth = await verifyAdminAuth(request, env as any, 'STORE_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền STORE_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
    const status = (url.searchParams.get('status') || 'ALL').toUpperCase().trim();
    const paymentMethod = (url.searchParams.get('paymentMethod') || url.searchParams.get('method') || 'ALL').toUpperCase().trim();
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();

    const conditions: string[] = [];
    const params: any[] = [];

    if (status !== 'ALL' && status !== '') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (paymentMethod !== 'ALL' && paymentMethod !== '') {
      conditions.push('payment_method = ?');
      params.push(paymentMethod);
    }

    if (search) {
      conditions.push('(id LIKE ? OR buyer_name LIKE ? OR buyer_email LIKE ? OR product_title LIKE ? OR sepay_transaction_id LIKE ?)');
      const wild = `%${search}%`;
      params.push(wild, wild, wild, wild, wild);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM orders ${whereClause}`;
    const totalRow = await env.DB.prepare(countSql).bind(...params).first<any>();
    const total = Number(totalRow?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const dataSql = `
      SELECT 
        id, member_id, buyer_name, buyer_email, product_id, product_title, amount,
        original_price, price_paid, discount_type, discount_amount, price_rule,
        payment_method, payment_status, status, expires_at, paid_at, sepay_transaction_id, created_at
      FROM orders
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await env.DB.prepare(dataSql).bind(...params, limit, offset).all<any>();

    const orders = (rows?.results || []).map((o: any) => ({
      id: o.id,
      memberId: o.member_id,
      buyerName: o.buyer_name || 'Khách hàng',
      buyerEmail: o.buyer_email || '',
      productId: o.product_id,
      productTitle: o.product_title || '',
      amount: Number(o.amount || 0),
      originalPrice: o.original_price !== null && o.original_price !== undefined ? Number(o.original_price) : null,
      pricePaid: o.price_paid !== null && o.price_paid !== undefined ? Number(o.price_paid) : Number(o.amount || 0),
      discountType: o.discount_type || null,
      discountAmount: Number(o.discount_amount || 0),
      priceRule: o.price_rule || null,
      paymentMethod: o.payment_method || 'WALLET',
      paymentStatus: o.payment_status || 'PAID',
      status: o.status || 'PAID',
      expiresAt: o.expires_at || null,
      paidAt: o.paid_at || null,
      sepayTransactionId: o.sepay_transaction_id || null,
      createdAt: o.created_at,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        page,
        limit,
        total,
        totalPages,
        orders,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy danh sách đơn hàng: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
