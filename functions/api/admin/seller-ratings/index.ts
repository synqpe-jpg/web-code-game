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

// GET /api/admin/seller-ratings: Quản trị viên lấy danh sách và thống kê đánh giá gian hàng
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
    const sellerId = (url.searchParams.get('seller_id') || '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '30', 10)));
    const offset = (page - 1) * limit;

    // 1. Thống kê theo trạng thái
    const statsRow = await env.DB
      .prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved_count,
          SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_count
        FROM seller_ratings
      `)
      .first<any>();

    // 2. Lấy danh sách đánh giá
    let sql = `
      SELECT 
        sr.*,
        s.name as seller_name,
        s.slug as seller_slug,
        so.order_code,
        so.product_name,
        so.price_core,
        m.username as buyer_username,
        m.email as buyer_email
      FROM seller_ratings sr
      LEFT JOIN sellers s ON sr.seller_id = s.id
      LEFT JOIN seller_orders so ON sr.order_id = so.id
      LEFT JOIN members m ON sr.buyer_member_id = m.id
      WHERE 1=1
    `;
    const binds: any[] = [];

    if (statusFilter && statusFilter !== 'ALL') {
      sql += ` AND sr.status = ?`;
      binds.push(statusFilter);
    }

    if (sellerId) {
      sql += ` AND sr.seller_id = ?`;
      binds.push(sellerId);
    }

    let countSql = `SELECT COUNT(*) as count FROM seller_ratings sr WHERE 1=1`;
    const countBinds: any[] = [];
    if (statusFilter && statusFilter !== 'ALL') {
      countSql += ` AND sr.status = ?`;
      countBinds.push(statusFilter);
    }
    if (sellerId) {
      countSql += ` AND sr.seller_id = ?`;
      countBinds.push(sellerId);
    }

    const countRes = await env.DB.prepare(countSql).bind(...countBinds).first<any>();
    const totalFiltered = Number(countRes?.count) || 0;

    sql += ` ORDER BY sr.created_at DESC LIMIT ? OFFSET ?`;
    binds.push(limit, offset);

    const rowsRes = await env.DB.prepare(sql).bind(...binds).all<any>();

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total: Number(statsRow?.total) || 0,
          pending_count: Number(statsRow?.pending_count) || 0,
          approved_count: Number(statsRow?.approved_count) || 0,
          rejected_count: Number(statsRow?.rejected_count) || 0,
        },
        ratings: rowsRes?.results || [],
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
    console.error('[Admin Get Ratings Error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi lấy danh sách đánh giá.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
