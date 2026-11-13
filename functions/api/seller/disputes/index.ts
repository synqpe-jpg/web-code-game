import { PagesFunction } from '@cloudflare/workers-types';
import { verifyMemberAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema } from '../../../services/d1_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET /api/seller/disputes: Người bán xem danh sách khiếu nại của gian hàng mình (§B)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const memberId = auth.member.id;

    // Tìm gian hàng của thành viên
    const seller = await env.DB
      .prepare(`
        SELECT s.id, s.name, s.slug FROM sellers s
        WHERE (s.owner_member_id = ? OR s.id IN (SELECT seller_id FROM seller_subaccounts WHERE member_id = ?))
          AND s.deleted_at IS NULL
        LIMIT 1
      `)
      .bind(memberId, memberId)
      .first<{ id: string; name: string; slug: string }>();

    if (!seller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bạn không sở hữu hoặc quản lý gian hàng nào.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const url = new URL(request.url);
    const statusFilter = (url.searchParams.get('status') || '').toUpperCase().trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '30', 10)));
    const offset = (page - 1) * limit;

    // Đếm số khiếu nại chưa xử lý (OPEN hoặc WAITING_SELLER)
    const countUnresolvedRow = await env.DB
      .prepare(`
        SELECT COUNT(*) as unresolved_count
        FROM seller_disputes
        WHERE seller_id = ? AND status IN ('OPEN', 'WAITING_SELLER')
      `)
      .bind(seller.id)
      .first<any>();

    let sql = `
      SELECT 
        sd.*,
        so.order_code,
        so.product_name,
        so.price_core,
        so.delivered_code,
        so.replacement_code as order_replacement_code,
        so.hold_until,
        so.status as order_status,
        m.username as buyer_username
      FROM seller_disputes sd
      LEFT JOIN seller_orders so ON sd.order_id = so.id
      LEFT JOIN members m ON sd.buyer_member_id = m.id
      WHERE sd.seller_id = ?
    `;
    const binds: any[] = [seller.id];

    if (statusFilter && statusFilter !== 'ALL') {
      sql += ` AND sd.status = ?`;
      binds.push(statusFilter);
    }

    let countSql = `SELECT COUNT(*) as count FROM seller_disputes WHERE seller_id = ?`;
    const countBinds: any[] = [seller.id];
    if (statusFilter && statusFilter !== 'ALL') {
      countSql += ` AND status = ?`;
      countBinds.push(statusFilter);
    }

    const countRes = await env.DB.prepare(countSql).bind(...countBinds).first<any>();
    const totalFiltered = Number(countRes?.count) || 0;

    sql += ` ORDER BY sd.created_at DESC LIMIT ? OFFSET ?`;
    binds.push(limit, offset);

    const rowsRes = await env.DB.prepare(sql).bind(...binds).all<any>();

    return new Response(
      JSON.stringify({
        success: true,
        seller_id: seller.id,
        seller_name: seller.name,
        unresolved_count: Number(countUnresolvedRow?.unresolved_count) || 0,
        disputes: rowsRes?.results || [],
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
    console.error('[Seller Get Disputes Error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi lấy danh sách khiếu nại của gian hàng.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
