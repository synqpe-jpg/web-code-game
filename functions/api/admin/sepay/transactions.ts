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
 * GET /api/admin/sepay/transactions
 * Danh sách giao dịch biến động số dư SePay / VietQR ngân hàng + phân trang + lọc
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

    const auth = await verifyAdminAuth(request, env as any, 'WALLET_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền WALLET_MANAGE hoặc MEMBERS_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
    const status = (url.searchParams.get('status') || 'ALL').toUpperCase().trim();
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();

    const conditions: string[] = [];
    const params: any[] = [];

    if (status !== 'ALL' && status !== '') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(CAST(transaction_id AS TEXT) LIKE ? OR transaction_content LIKE ? OR member_id LIKE ? OR account_number LIKE ? OR gateway LIKE ?)');
      const wild = `%${search}%`;
      params.push(wild, wild, wild, wild, wild);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total, COALESCE(SUM(amount_in), 0) as totalAmount FROM sepay_transactions ${whereClause}`;
    const countRow = await env.DB.prepare(countSql).bind(...params).first<any>();
    const total = Number(countRow?.total || 0);
    const totalAmount = Number(countRow?.totalAmount || 0);
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const dataSql = `
      SELECT id, transaction_id, gateway, account_number, amount_in, transaction_content, member_id, status, note, order_id, created_at
      FROM sepay_transactions
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await env.DB.prepare(dataSql).bind(...params, limit, offset).all<any>();

    const transactions = (rows?.results || []).map((t: any) => ({
      id: t.id,
      transactionId: t.transaction_id,
      gateway: t.gateway,
      accountNumber: t.account_number,
      amountIn: Number(t.amount_in || 0),
      transactionContent: t.transaction_content,
      memberId: t.member_id || null,
      status: t.status,
      note: t.note || null,
      orderId: t.order_id || null,
      createdAt: t.created_at,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        page,
        limit,
        total,
        totalPages,
        totalAmount,
        transactions,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy danh sách giao dịch SePay: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
