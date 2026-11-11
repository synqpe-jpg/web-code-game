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
    const statusFilter = (url.searchParams.get('status') || '').trim();
    const sellerId = (url.searchParams.get('seller_id') || '').trim();
    const limit = Math.min(200, Math.max(10, parseInt(url.searchParams.get('limit') || '50', 10)));
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const offset = (page - 1) * limit;

    let query = `
      SELECT sw.*, s.name as seller_name, s.slug as seller_slug, s.available_balance_core
      FROM seller_withdrawals sw
      LEFT JOIN sellers s ON sw.seller_id = s.id
      WHERE sw.deleted_at IS NULL
    `;
    const binds: any[] = [];

    if (statusFilter) {
      query += ` AND sw.status = ?`;
      binds.push(statusFilter);
    }
    if (sellerId) {
      query += ` AND sw.seller_id = ?`;
      binds.push(sellerId);
    }

    query += ` ORDER BY sw.created_at DESC LIMIT ? OFFSET ?`;
    binds.push(limit, offset);

    const withdrawalsRes = await env.DB.prepare(query).bind(...binds).all<any>();

    let countQuery = `SELECT COUNT(*) as total FROM seller_withdrawals WHERE deleted_at IS NULL`;
    const countBinds: any[] = [];
    if (statusFilter) {
      countQuery += ` AND status = ?`;
      countBinds.push(statusFilter);
    }
    if (sellerId) {
      countQuery += ` AND seller_id = ?`;
      countBinds.push(sellerId);
    }
    const countRes = await env.DB.prepare(countQuery).bind(...countBinds).first<{ total: number }>();

    // Đếm số lượng PENDING và APPROVED
    const statsRes = await env.DB.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN status = 'PAID' THEN amount_core ELSE 0 END) as total_paid_core
      FROM seller_withdrawals
      WHERE deleted_at IS NULL
    `).first<any>();

    return new Response(
      JSON.stringify({
        success: true,
        withdrawals: withdrawalsRes?.results || [],
        stats: {
          pending_count: Number(statsRes?.pending_count) || 0,
          approved_count: Number(statsRes?.approved_count) || 0,
          total_paid_core: Number(statsRes?.total_paid_core) || 0,
        },
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
    console.error('[getAdminWithdrawals error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
