import { PagesFunction } from '@cloudflare/workers-types';
import { verifyMemberAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema } from '../../../services/d1_service';
import { getMarketplaceConfig } from '../../../services/marketplace_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

const VALID_REASONS = ['WRONG_CODE', 'USED_CODE', 'EXPIRED_CODE', 'NOT_AS_DESCRIBED'];

// POST: Người mua gửi khiếu nại tự động cho đơn con trong thời gian giữ tiền (PAID) (§B)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập để gửi khiếu nại.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const orderId = String(params.id || '').trim();
    const buyerId = auth.member.id;
    const body = (await request.json().catch(() => ({}))) as any;
    const reason = String(body.reason || '').toUpperCase().trim();
    const detail = typeof body.detail === 'string' ? body.detail.trim() : '';

    if (!VALID_REASONS.includes(reason)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Lý do khiếu nại không hợp lệ. Chọn 1 trong 4 lý do: Mã sai (WRONG_CODE), Mã đã dùng (USED_CODE), Mã hết hạn (EXPIRED_CODE), Mã không đúng mô tả (NOT_AS_DESCRIBED).',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (detail.length > 500) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mô tả chi tiết không được vượt quá 500 ký tự.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Kiểm tra đơn hàng thuộc về chính khách hàng
    const order = await env.DB
      .prepare(`
        SELECT id, order_code, seller_id, buyer_member_id, status, price_core, hold_until
        FROM seller_orders
        WHERE id = ? AND buyer_member_id = ?
        LIMIT 1
      `)
      .bind(orderId, buyerId)
      .first<any>();

    if (!order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy đơn hàng của bạn.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Chỉ cho phép khiếu nại khi đơn đang trong thời gian giữ tiền (PAID)
    if (order.status === 'COMPLETED') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Đơn hàng đã hoàn tất sau 168 giờ giữ tiền và đã giải ngân, không thể gửi khiếu nại tự động. Vui lòng liên hệ Quản trị viên để được hỗ trợ thủ công.',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (order.status === 'DISPUTED') {
      return new Response(
        JSON.stringify({ success: false, error: 'Đơn hàng này đang trong quá trình khiếu nại và xử lý.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (order.status === 'REFUNDED') {
      return new Response(
        JSON.stringify({ success: false, error: 'Đơn hàng này đã được hoàn tiền trước đó.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (order.status !== 'PAID') {
      return new Response(
        JSON.stringify({ success: false, error: `Chỉ có thể khiếu nại đơn hàng đang ở trạng thái PAID (trạng thái hiện tại: ${order.status}).` }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 2. Kiểm tra xem đơn hàng đã có khiếu nại đang mở chưa
    const existingDispute = await env.DB
      .prepare(`
        SELECT id, status FROM seller_disputes
        WHERE order_id = ? AND status IN ('OPEN', 'WAITING_SELLER')
        LIMIT 1
      `)
      .bind(orderId)
      .first<any>();

    if (existingDispute) {
      return new Response(
        JSON.stringify({ success: false, error: 'Đơn hàng này đang có một khiếu nại đang mở chưa được giải quyết.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Cơ chế chống lạm dụng: Kiểm tra số khiếu nại bị REJECTED của buyer trong 30 ngày qua
    const rejectedCountRow = await env.DB
      .prepare(`
        SELECT COUNT(*) as count 
        FROM seller_disputes 
        WHERE buyer_member_id = ? 
          AND status = 'REJECTED' 
          AND datetime(created_at) >= datetime('now', '-30 days')
      `)
      .bind(buyerId)
      .first<any>();

    const config = await getMarketplaceConfig(env.DB);
    const threshold = config.max_rejected_disputes_30d || 3;
    const isFlaggedAbusive = (Number(rejectedCountRow?.count) || 0) >= threshold ? 1 : 0;

    const disputeId = `sdisp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    // 4. Batch nguyên tử: Tạo bản ghi seller_disputes và cập nhật trạng thái đơn con sang DISPUTED
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO seller_disputes (
          id, order_id, buyer_member_id, seller_id, reason, detail,
          status, is_flagged_abusive, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)
      `).bind(
        disputeId,
        orderId,
        buyerId,
        order.seller_id,
        reason,
        detail || null,
        isFlaggedAbusive,
        nowIso,
        nowIso
      ),
      env.DB.prepare(`
        UPDATE seller_orders
        SET status = 'DISPUTED',
            report_reason = ?,
            reported_at = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(reason, nowIso, nowIso, orderId),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        message: isFlaggedAbusive
          ? 'Đã gửi khiếu nại thành công. Lưu ý: Do bạn có nhiều khiếu nại bị từ chối gần đây, khiếu nại này được chuyển sang diện xem xét đặc biệt bởi Quản trị viên.'
          : 'Đã gửi khiếu nại thành công! Đơn hàng đã được chuyển sang trạng thái tranh chấp (DISPUTED) và tạm dừng giải ngân tiền để người bán và Quản trị viên xử lý.',
        dispute_id: disputeId,
        status: 'OPEN',
        is_flagged_abusive: Boolean(isFlaggedAbusive),
        created_at: nowIso,
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[Create Dispute Error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi gửi khiếu nại đơn hàng.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

// GET: Người mua xem chi tiết khiếu nại của đơn hàng
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const orderId = String(params.id || '').trim();
    const buyerId = auth.member.id;

    const dispute = await env.DB
      .prepare(`
        SELECT sd.*, s.name as seller_name, so.order_code, so.product_name, so.price_core, so.delivered_code
        FROM seller_disputes sd
        JOIN sellers s ON sd.seller_id = s.id
        JOIN seller_orders so ON sd.order_id = so.id
        WHERE sd.order_id = ? AND sd.buyer_member_id = ?
        ORDER BY sd.created_at DESC
        LIMIT 1
      `)
      .bind(orderId, buyerId)
      .first<any>();

    if (!dispute) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chưa có khiếu nại nào cho đơn hàng này.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ success: true, dispute }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[Get Order Dispute Error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi lấy thông tin khiếu nại.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
