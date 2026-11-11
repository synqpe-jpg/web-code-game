import { verifyAdminAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema } from '../../../services/d1_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'D1 Database chưa sẵn sàng.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureMarketplaceSchema(env.DB);

    const auth = await verifyAdminAuth(request, env as any, 'MARKETPLACE_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Yêu cầu quyền Quản trị viên (MARKETPLACE_MANAGE).' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const url = new URL(request.url);
    const sellerId = (url.searchParams.get('seller_id') || '').trim();
    const typeFilter = (url.searchParams.get('type') || '').trim();
    const dateFilter = (url.searchParams.get('date') || '').trim();
    const limit = Math.min(200, Math.max(10, parseInt(url.searchParams.get('limit') || '50', 10)));
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const offset = (page - 1) * limit;

    // 1. Tổng hợp 3 ngăn số dư toàn sàn
    const totalBalancesRes = await env.DB.prepare(`
      SELECT 
        SUM(pending_balance_core) as total_held,
        SUM(available_balance_core) as total_available,
        SUM(withdrawn_balance_core) as total_withdrawn
      FROM sellers
      WHERE deleted_at IS NULL
    `).first<any>();

    // 2. Thống kê theo từng gian hàng
    const sellersSummaryRes = await env.DB.prepare(`
      SELECT id, name, slug, status, is_vacation,
             pending_balance_core, available_balance_core, withdrawn_balance_core
      FROM sellers
      WHERE deleted_at IS NULL
      ORDER BY (pending_balance_core + available_balance_core + withdrawn_balance_core) DESC
    `).all<any>();

    // 3. Truy vấn sổ cái seller_ledger
    let ledgerQuery = `
      SELECT sl.*, s.name as seller_name, so.order_code
      FROM seller_ledger sl
      LEFT JOIN sellers s ON sl.seller_id = s.id
      LEFT JOIN seller_orders so ON sl.order_id = so.id
      WHERE 1=1
    `;
    const binds: any[] = [];

    if (sellerId) {
      ledgerQuery += ` AND sl.seller_id = ?`;
      binds.push(sellerId);
    }
    if (typeFilter) {
      ledgerQuery += ` AND sl.type = ?`;
      binds.push(typeFilter);
    }
    if (dateFilter) {
      ledgerQuery += ` AND date(sl.created_at, '+7 hours') = ?`;
      binds.push(dateFilter);
    }

    ledgerQuery += ` ORDER BY sl.created_at DESC LIMIT ? OFFSET ?`;
    binds.push(limit, offset);

    const ledgerRes = await env.DB.prepare(ledgerQuery).bind(...binds).all<any>();

    let countQuery = `SELECT COUNT(*) as total FROM seller_ledger sl WHERE 1=1`;
    const countBinds: any[] = [];
    if (sellerId) {
      countQuery += ` AND sl.seller_id = ?`;
      countBinds.push(sellerId);
    }
    if (typeFilter) {
      countQuery += ` AND sl.type = ?`;
      countBinds.push(typeFilter);
    }
    if (dateFilter) {
      countQuery += ` AND date(sl.created_at, '+7 hours') = ?`;
      countBinds.push(dateFilter);
    }
    const countRes = await env.DB.prepare(countQuery).bind(...countBinds).first<{ total: number }>();

    // 4. Kiểm tra cảnh báo khóa SePay (§5 Trường hợp 7)
    let sepayAlert = null;
    try {
      const alertRow = await env.DB.prepare(
        "SELECT value FROM system_settings WHERE key = 'wcg_sepay_unauthorized_alert' LIMIT 1"
      ).first<any>();
      if (alertRow?.value) {
        sepayAlert = typeof alertRow.value === 'string' ? JSON.parse(alertRow.value) : alertRow.value;
      }
    } catch {}

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_held_core: Number(totalBalancesRes?.total_held) || 0,
          total_available_core: Number(totalBalancesRes?.total_available) || 0,
          total_withdrawn_core: Number(totalBalancesRes?.total_withdrawn) || 0,
          total_revenue_core:
            (Number(totalBalancesRes?.total_held) || 0) +
            (Number(totalBalancesRes?.total_available) || 0) +
            (Number(totalBalancesRes?.total_withdrawn) || 0),
        },
        sellers: sellersSummaryRes?.results || [],
        ledger: ledgerRes?.results || [],
        sepay_alert: sepayAlert,
        pagination: {
          page,
          limit,
          total: countRes?.total || 0,
          total_pages: Math.ceil((countRes?.total || 0) / limit),
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[getAdminSellerFinance error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
