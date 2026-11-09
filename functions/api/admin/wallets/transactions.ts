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
 * GET /api/admin/wallets/transactions
 * Danh sách biến động số dư ví (Lịch sử giao dịch ví) + phân trang + lọc
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
    const memberId = (url.searchParams.get('memberId') || url.searchParams.get('userId') || url.searchParams.get('member_id') || '').trim();
    const type = (url.searchParams.get('type') || 'ALL').toUpperCase().trim();
    const status = (url.searchParams.get('status') || 'ALL').toUpperCase().trim();
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();

    const conditions: string[] = [];
    const params: any[] = [];

    if (memberId) {
      conditions.push('(member_id = ? OR member_email = ?)');
      params.push(memberId, memberId);
    }

    if (type !== 'ALL' && type !== '') {
      conditions.push('type = ?');
      params.push(type);
    }

    if (status !== 'ALL' && status !== '') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(id LIKE ? OR member_email LIKE ? OR description LIKE ? OR order_id LIKE ?)');
      const wild = `%${search}%`;
      params.push(wild, wild, wild, wild);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM wallet_transactions ${whereClause}`;
    const totalRow = await env.DB.prepare(countSql).bind(...params).first<any>();
    const total = Number(totalRow?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const summarySql = `
      SELECT 
        SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END) as totalDeposit,
        SUM(CASE WHEN type = 'PURCHASE' THEN amount ELSE 0 END) as totalPurchase,
        SUM(CASE WHEN type = 'REFUND' THEN amount ELSE 0 END) as totalRefund
      FROM wallet_transactions
      ${whereClause}
    `;
    const summaryRow = await env.DB.prepare(summarySql).bind(...params).first<any>().catch(() => ({}));

    const dataSql = `
      SELECT id, member_id, member_email, type, amount, balance_before, balance_after, description, status, order_id, created_at
      FROM wallet_transactions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await env.DB.prepare(dataSql).bind(...params, limit, offset).all<any>();

    const transactions = (rows?.results || []).map((t: any) => ({
      id: t.id,
      memberId: t.member_id,
      memberEmail: t.member_email || '',
      type: t.type,
      amount: Number(t.amount || 0),
      balanceBefore: Number(t.balance_before || 0),
      balanceAfter: Number(t.balance_after || 0),
      description: t.description || '',
      status: t.status || 'COMPLETED',
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
        summary: {
          totalDeposit: Number(summaryRow?.totalDeposit || 0),
          totalPurchase: Number(summaryRow?.totalPurchase || 0),
          totalRefund: Number(summaryRow?.totalRefund || 0),
        },
        transactions,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy lịch sử ví: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
