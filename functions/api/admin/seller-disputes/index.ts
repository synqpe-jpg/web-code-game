import { PagesFunction } from '@cloudflare/workers-types';
import { verifyAdminAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema } from '../../../services/d1_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET /api/admin/seller-disputes: Quản trị viên lấy danh sách và thống kê khiếu nại sàn TMĐT (§B)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyAdminAuth(request, env as any, 'MARKETPLACE_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Yêu cầu quyền Quản trị viên.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const url = new URL(request.url);
    const statusFilter = (url.searchParams.get('status') || '').toUpperCase().trim();
    const abusiveFilter = url.searchParams.get('is_flagged_abusive');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '30', 10)));
    const offset = (page - 1) * limit;

    // 1. Thống kê theo trạng thái và cờ lạm dụng
    const statsRow = await env.DB
      .prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_count,
          SUM(CASE WHEN status = 'WAITING_SELLER' THEN 1 ELSE 0 END) as waiting_seller_count,
          SUM(CASE WHEN status = 'RESOLVED_REFUNDED' THEN 1 ELSE 0 END) as refunded_count,
          SUM(CASE WHEN status = 'RESOLVED_REPLACED' THEN 1 ELSE 0 END) as replaced_count,
          SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_count,
          SUM(CASE WHEN is_flagged_abusive = 1 THEN 1 ELSE 0 END) as abusive_count
        FROM seller_disputes
      `)
      .first<any>();

    // 2. Lấy danh sách khiếu nại
    let sql = `
      SELECT 
        sd.*,
        s.name as seller_name,
        s.slug as seller_slug,
        so.order_code,
        so.product_name,
        so.price_core,
        so.delivered_code,
        so.hold_until,
        so.status as order_status,
        m.username as buyer_username,
        m.email as buyer_email,
        COALESCE(scv.view_count, 0) as buyer_view_count
      FROM seller_disputes sd
      LEFT JOIN sellers s ON sd.seller_id = s.id
      LEFT JOIN seller_orders so ON sd.order_id = so.id
      LEFT JOIN members m ON sd.buyer_member_id = m.id
      LEFT JOIN (
        SELECT code_id, COUNT(*) as view_count
        FROM seller_code_views
        GROUP BY code_id
      ) scv ON so.code_id = scv.code_id
      WHERE 1=1
    `;
    const binds: any[] = [];

    if (statusFilter && statusFilter !== 'ALL') {
      sql += ` AND sd.status = ?`;
      binds.push(statusFilter);
    }

    if (abusiveFilter === '1' || abusiveFilter === 'true') {
      sql += ` AND sd.is_flagged_abusive = 1`;
    }

    let countSql = `SELECT COUNT(*) as count FROM seller_disputes WHERE 1=1`;
    const countBinds: any[] = [];
    if (statusFilter && statusFilter !== 'ALL') {
      countSql += ` AND status = ?`;
      countBinds.push(statusFilter);
    }
    if (abusiveFilter === '1' || abusiveFilter === 'true') {
      countSql += ` AND is_flagged_abusive = 1`;
    }

    const countRes = await env.DB.prepare(countSql).bind(...countBinds).first<any>();
    const totalFiltered = Number(countRes?.count) || 0;

    sql += ` ORDER BY sd.created_at DESC LIMIT ? OFFSET ?`;
    binds.push(limit, offset);

    const rowsRes = await env.DB.prepare(sql).bind(...binds).all<any>();

    const disputes = (rowsRes?.results || []).map((d) => ({
      ...d,
      buyer_has_viewed_code: Number(d.buyer_view_count) > 0,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total: Number(statsRow?.total) || 0,
          open_count: Number(statsRow?.open_count) || 0,
          waiting_seller_count: Number(statsRow?.waiting_seller_count) || 0,
          refunded_count: Number(statsRow?.refunded_count) || 0,
          replaced_count: Number(statsRow?.replaced_count) || 0,
          rejected_count: Number(statsRow?.rejected_count) || 0,
          abusive_count: Number(statsRow?.abusive_count) || 0,
        },
        disputes,
        pagination: {
          page,
          limit,
          total: totalFiltered,
          total_pages: Math.ceil(totalFiltered / limit),
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[Admin Get Disputes Error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi lấy danh sách khiếu nại.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
