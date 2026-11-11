import { verifyMemberAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../services/d1_service';
import { checkAndFreezeBatchIfHighErrorRate } from '../../../services/marketplace_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// POST: Khách hàng báo mã lỗi một chạm cho đơn hàng đã mua (§6.3)
export const onRequestPost: PagesFunction<Env> = async (context) => {
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

    const orderId = params.id as string;
    const buyerId = auth.member.id;
    const body = (await request.json().catch(() => ({}))) as any;
    const { reason, note } = body;

    // Lý do chuẩn theo đặc tả: not_working hoặc expired
    const validReason = reason === 'expired' ? 'expired' : 'not_working';

    // 1. Kiểm tra đơn hàng thuộc về chính khách hàng
    const order = await env.DB
      .prepare(`
        SELECT so.*, sc.batch_id
        FROM seller_orders so
        LEFT JOIN seller_codes sc ON so.code_id = sc.id
        WHERE so.id = ? AND so.buyer_member_id = ?
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

    if (order.status === 'REPORTED') {
      return new Response(
        JSON.stringify({ success: false, error: 'Đơn hàng này đã được gửi báo lỗi trước đó và đang chờ người bán xử lý.' }),
        { status: 409, headers: CORS_HEADERS }
      );
    }

    if (order.status !== 'DELIVERED') {
      return new Response(
        JSON.stringify({ success: false, error: `Không thể báo lỗi cho đơn hàng đang ở trạng thái ${order.status}.` }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const nowIso = new Date().toISOString();

    // 2. Chuyển trạng thái đơn và mã kho sang REPORTED
    const batchUpdates: D1PreparedStatement[] = [
      env.DB.prepare(`
        UPDATE seller_orders
        SET status = 'REPORTED',
            report_reason = ?,
            report_note = ?,
            reported_at = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(
        validReason,
        note?.trim() || null,
        nowIso,
        nowIso,
        order.id
      ),
    ];

    if (order.code_id) {
      batchUpdates.push(
        env.DB.prepare(`
          UPDATE seller_codes
          SET status = 'REPORTED', reported_at = ?, updated_at = ?
          WHERE id = ?
        `).bind(nowIso, nowIso, order.code_id)
      );
    }

    await env.DB.batch(batchUpdates);

    // 3. Tự động kiểm tra tỷ lệ lỗi của lô mã và đóng băng nếu vượt ngưỡng 25% (§5.2)
    if (order.batch_id) {
      await checkAndFreezeBatchIfHighErrorRate(env.DB, order.batch_id);
    }

    // Ghi audit log
    await logAdminAudit(env.DB, {
      actorName: auth.member.username || auth.member.email,
      actorEmail: auth.member.email,
      action: 'SELLER_ORDER_REPORT_CODE',
      targetId: order.id,
      details: {
        reason: validReason,
        product_name: order.product_name,
        seller_id: order.seller_id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Báo lỗi thành công! Yêu cầu của bạn đã được chuyển tới người bán để đổi mã mới hoặc hoàn tiền.',
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
