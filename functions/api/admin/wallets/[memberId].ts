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
 * GET /api/admin/wallets/:memberId
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

    const auth = await verifyAdminAuth(request, env as any, 'WALLET_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const url = new URL(request.url);
    let memberId = String(params?.memberId || '').trim();
    if (!memberId) {
      const parts = url.pathname.split('/').filter(Boolean);
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart !== 'wallets') {
        memberId = lastPart;
      }
    }

    if (!memberId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã thành viên (:memberId).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const member = await env.DB.prepare(`
      SELECT id, username, display_name, email, phone, role, balance, total_spent, status
      FROM members
      WHERE id = ? OR username = ? OR email = ?
      LIMIT 1
    `).bind(memberId, memberId, memberId).first<any>();

    if (!member) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy thành viên "${memberId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const statsRow = await env.DB.prepare(`
      SELECT 
        COUNT(*) as totalTx,
        COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount ELSE 0 END), 0) as totalDeposit,
        COALESCE(SUM(CASE WHEN type = 'PURCHASE' THEN amount ELSE 0 END), 0) as totalPurchase,
        COALESCE(SUM(CASE WHEN type = 'REFUND' THEN amount ELSE 0 END), 0) as totalRefund
      FROM wallet_transactions
      WHERE member_id = ? OR member_email = ?
    `).bind(member.id, member.email || member.id).first<any>();

    const recentTx = await env.DB.prepare(`
      SELECT id, type, amount, balance_before, balance_after, description, status, order_id, created_at
      FROM wallet_transactions
      WHERE member_id = ? OR member_email = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(member.id, member.email || member.id).all<any>();

    return new Response(
      JSON.stringify({
        success: true,
        member: {
          id: member.id,
          username: member.username,
          displayName: member.display_name || member.username,
          email: member.email,
          phone: member.phone,
          balance: Number(member.balance || 0),
          totalSpent: Number(member.total_spent || 0),
          status: member.status,
        },
        stats: {
          totalTransactions: Number(statsRow?.totalTx || 0),
          totalDeposit: Number(statsRow?.totalDeposit || 0),
          totalPurchase: Number(statsRow?.totalPurchase || 0),
          totalRefund: Number(statsRow?.totalRefund || 0),
        },
        recentTransactions: (recentTx?.results || []).map((t: any) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount || 0),
          balanceBefore: Number(t.balance_before || 0),
          balanceAfter: Number(t.balance_after || 0),
          description: t.description || '',
          status: t.status,
          orderId: t.order_id,
          createdAt: t.created_at,
        })),
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy thông tin ví: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
