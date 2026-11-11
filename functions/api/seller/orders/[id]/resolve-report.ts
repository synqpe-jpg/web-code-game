import { verifyMemberAuth } from '../../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../../services/d1_service';
import { decryptCode, checkAndFreezeBatchIfHighErrorRate } from '../../../../services/marketplace_service';

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

// POST: Người bán giải quyết khiếu nại đơn báo lỗi (§6.3, §5.2)
// Hỗ trợ 2 phương án: Đổi mã mới (REPLACE_CODE) hoặc Hoàn lại Core (REFUND_CORE)
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
    const memberId = auth.member.id;
    const body = (await request.json().catch(() => ({}))) as any;
    const { resolution_type, note } = body;

    if (resolution_type !== 'REPLACE_CODE' && resolution_type !== 'REFUND_CORE') {
      return new Response(
        JSON.stringify({ success: false, error: 'Phương án xử lý không hợp lệ (REPLACE_CODE hoặc REFUND_CORE).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Kiểm tra đơn hàng & quyền người bán
    const order = await env.DB
      .prepare(`
        SELECT so.*, s.owner_member_id, sc.batch_id as original_batch_id
        FROM seller_orders so
        JOIN sellers s ON so.seller_id = s.id
        LEFT JOIN seller_codes sc ON so.code_id = sc.id
        WHERE so.id = ? AND (s.owner_member_id = ? OR s.id IN (SELECT seller_id FROM seller_subaccounts WHERE member_id = ? AND role = 'MANAGE_STOCK'))
        LIMIT 1
      `)
      .bind(orderId, memberId, memberId)
      .first<any>();

    if (!order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Đơn hàng không tồn tại hoặc bạn không có quyền xử lý.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (order.status !== 'REPORTED') {
      return new Response(
        JSON.stringify({ success: false, error: `Đơn hàng đang ở trạng thái ${order.status}, không phải trạng thái khiếu nại báo lỗi.` }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const nowIso = new Date().toISOString();

    if (resolution_type === 'REPLACE_CODE') {
      // 2a. Đổi mã mới: Tìm 1 mã IN_STOCK của sản phẩm đó
      const newCodeRow = await env.DB
        .prepare(`
          SELECT id, code_encrypted FROM seller_codes
          WHERE product_id = ? AND status = 'IN_STOCK' AND deleted_at IS NULL
          ORDER BY created_at ASC
          LIMIT 1
        `)
        .bind(order.product_id)
        .first<any>();

      if (!newCodeRow) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Kho đã hết mã để đổi mới. Vui lòng chọn phương án Hoàn Core hoặc nạp thêm mã vào kho trước.',
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const plainNewCode = await decryptCode(newCodeRow.code_encrypted);

      // Cập nhật nguyên tử:
      // - Mã mới -> SOLD, gắn order_id
      // - Đơn hàng -> DELIVERED, cập nhật replacement_code_id, replacement_code
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE seller_codes
          SET status = 'SOLD', order_id = ?, sold_at = ?, updated_at = ?
          WHERE id = ? AND status = 'IN_STOCK'
        `).bind(order.id, nowIso, nowIso, newCodeRow.id),
        env.DB.prepare(`
          UPDATE seller_orders
          SET status = 'DELIVERED',
              replacement_code_id = ?,
              replacement_code = ?,
              resolution_type = 'REPLACE_CODE',
              resolution_note = ?,
              resolved_at = ?,
              updated_at = ?
          WHERE id = ?
        `).bind(
          newCodeRow.id,
          plainNewCode,
          note?.trim() || 'Người bán đã đổi mã mới thành công',
          nowIso,
          nowIso,
          order.id
        ),
      ]);

      // Tự động kiểm tra tỷ lệ lỗi lô của mã cũ và đóng băng nếu cần
      if (order.original_batch_id) {
        await checkAndFreezeBatchIfHighErrorRate(env.DB, order.original_batch_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Đã đổi mã mới thành công cho khách hàng.',
          resolution_type: 'REPLACE_CODE',
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } else {
      // 2b. Hoàn tiền Core: Trừ pending_balance_core của shop, hoàn ví Core cho khách
      const priceCore = order.price_core;

      await env.DB.batch([
        // Trừ Core chờ rút của shop
        env.DB.prepare(`
          UPDATE sellers
          SET pending_balance_core = MAX(0, pending_balance_core - ?), updated_at = ?
          WHERE id = ?
        `).bind(priceCore, nowIso, order.seller_id),

        // Hoàn Core vào số dư của khách
        env.DB.prepare(`
          UPDATE members
          SET core_balance = core_balance + ?, updated_at = ?
          WHERE id = ?
        `).bind(priceCore, nowIso, order.buyer_member_id),

        // Đơn hàng sang REFUNDED
        env.DB.prepare(`
          UPDATE seller_orders
          SET status = 'REFUNDED',
              resolution_type = 'REFUND_CORE',
              resolution_note = ?,
              resolved_at = ?,
              updated_at = ?
          WHERE id = ?
        `).bind(
          note?.trim() || 'Người bán đã hoàn lại số dư Core cho khách',
          nowIso,
          nowIso,
          order.id
        ),
      ]);

      // Tự động kiểm tra tỷ lệ lỗi lô của mã cũ và đóng băng nếu cần
      if (order.original_batch_id) {
        await checkAndFreezeBatchIfHighErrorRate(env.DB, order.original_batch_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Đã hoàn lại ${priceCore} Core thành công cho người mua.`,
          resolution_type: 'REFUND_CORE',
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
