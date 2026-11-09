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
 * GET /api/admin/dashboard/stats
 * Báo cáo tổng quan số liệu hệ thống (Doanh thu, Đơn hàng, Ví, Thành viên, Tồn kho, Game & Code)
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

    const auth = await verifyAdminAuth(request, env as any, 'DASHBOARD_STATS_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền DASHBOARD_STATS_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    // 1. Thống kê Thành viên & Ví
    const memberStats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_members,
        SUM(CASE WHEN role = 'ADMIN' OR role = 'SUPER_ADMIN' THEN 1 ELSE 0 END) as total_admins,
        SUM(CASE WHEN status = 'BANNED' THEN 1 ELSE 0 END) as banned_members,
        SUM(COALESCE(balance, 0)) as total_wallet_balance,
        SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as new_members_today
      FROM members
    `).first<any>().catch(() => ({}));

    // 2. Thống kê Đơn hàng & Doanh thu
    const orderStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'REFUNDED' THEN 1 ELSE 0 END) as refunded_orders,
        SUM(CASE WHEN status = 'COMPLETED' THEN COALESCE(price_paid, 0) ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'COMPLETED' AND date(created_at) = date('now') THEN COALESCE(price_paid, 0) ELSE 0 END) as revenue_today,
        SUM(CASE WHEN status = 'COMPLETED' AND datetime(created_at) >= datetime('now', '-7 days') THEN COALESCE(price_paid, 0) ELSE 0 END) as revenue_last_7_days,
        SUM(CASE WHEN status = 'COMPLETED' AND datetime(created_at) >= datetime('now', '-30 days') THEN COALESCE(price_paid, 0) ELSE 0 END) as revenue_last_30_days
      FROM orders
    `).first<any>().catch(() => ({}));

    // 3. Thống kê SePay Nạp tiền
    const sepayStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_deposits,
        SUM(COALESCE(transfer_amount, 0)) as total_deposited_amount,
        SUM(CASE WHEN date(transaction_date) = date('now') THEN COALESCE(transfer_amount, 0) ELSE 0 END) as deposit_amount_today
      FROM sepay_transactions
    `).first<any>().catch(() => ({}));

    // 4. Thống kê Game & Giftcode
    const gameCount = await env.DB.prepare('SELECT COUNT(*) as total FROM games').first<any>().catch(() => ({ total: 0 }));
    const codeStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_codes,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_codes,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_codes
      FROM codes
    `).first<any>().catch(() => ({}));

    // 5. Thống kê Tồn kho mã bán (inventory_codes)
    const inventoryStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_codes,
        SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_codes,
        SUM(CASE WHEN status = 'SOLD' THEN 1 ELSE 0 END) as sold_codes
      FROM inventory_codes
    `).first<any>().catch(() => ({}));

    // 6. Thống kê Nhiệm vụ đang chờ duyệt (Pending Submissions)
    const missionStats = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_submissions,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_submissions,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved_submissions
      FROM mission_submissions
    `).first<any>().catch(() => ({}));

    // 7. Thống kê Tiện ích (utilities)
    const utilityCount = await env.DB.prepare('SELECT COUNT(*) as total FROM utilities').first<any>().catch(() => ({ total: 0 }));

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        stats: {
          members: {
            total: Number(memberStats?.total_members || 0),
            admins: Number(memberStats?.total_admins || 0),
            banned: Number(memberStats?.banned_members || 0),
            newToday: Number(memberStats?.new_members_today || 0),
            totalWalletBalance: Number(memberStats?.total_wallet_balance || 0),
          },
          orders: {
            total: Number(orderStats?.total_orders || 0),
            completed: Number(orderStats?.completed_orders || 0),
            pending: Number(orderStats?.pending_orders || 0),
            refunded: Number(orderStats?.refunded_orders || 0),
            totalRevenue: Number(orderStats?.total_revenue || 0),
            revenueToday: Number(orderStats?.revenue_today || 0),
            revenueLast7Days: Number(orderStats?.revenue_last_7_days || 0),
            revenueLast30Days: Number(orderStats?.revenue_last_30_days || 0),
          },
          deposits: {
            totalCount: Number(sepayStats?.total_deposits || 0),
            totalAmount: Number(sepayStats?.total_deposited_amount || 0),
            amountToday: Number(sepayStats?.deposit_amount_today || 0),
          },
          catalog: {
            totalGames: Number(gameCount?.total || 0),
            totalCodes: Number(codeStats?.total_codes || 0),
            activeCodes: Number(codeStats?.active_codes || 0),
            expiredCodes: Number(codeStats?.expired_codes || 0),
            totalUtilities: Number(utilityCount?.total || 0),
          },
          inventory: {
            totalPaidCodes: Number(inventoryStats?.total_codes || 0),
            availablePaidCodes: Number(inventoryStats?.available_codes || 0),
            soldPaidCodes: Number(inventoryStats?.sold_codes || 0),
          },
          missions: {
            totalSubmissions: Number(missionStats?.total_submissions || 0),
            pendingSubmissions: Number(missionStats?.pending_submissions || 0),
            approvedSubmissions: Number(missionStats?.approved_submissions || 0),
          },
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi xử lý thống kê dashboard' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
