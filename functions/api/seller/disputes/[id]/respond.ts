import { PagesFunction } from '@cloudflare/workers-types';
import { verifyMemberAuth } from '../../../../services/mission_service';
import { ensureMarketplaceSchema } from '../../../../services/d1_service';

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

// POST /api/seller/disputes/:id/respond: Người bán phản hồi khiếu nại (kèm mã thay thế nếu có) (§B)
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

    const disputeId = String(params.id || '').trim();
    const memberId = auth.member.id;
    const body = (await request.json().catch(() => ({}))) as any;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const replacementCode = typeof body.replacement_code === 'string' ? body.replacement_code.trim() : '';

    if (!message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng nhập nội dung phản hồi cho khiếu nại.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (message.length > 1000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nội dung phản hồi không được vượt quá 1000 ký tự.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Kiểm tra khiếu nại tồn tại
    const dispute = await env.DB
      .prepare('SELECT * FROM seller_disputes WHERE id = ? LIMIT 1')
      .bind(disputeId)
      .first<any>();

    if (!dispute) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy khiếu nại này.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // 2. Kiểm tra quyền của người gọi đối với gian hàng
    const seller = await env.DB
      .prepare(`
        SELECT id FROM sellers
        WHERE id = ? 
          AND (owner_member_id = ? OR id IN (SELECT seller_id FROM seller_subaccounts WHERE member_id = ?))
          AND deleted_at IS NULL
        LIMIT 1
      `)
      .bind(dispute.seller_id, memberId, memberId)
      .first<any>();

    if (!seller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bạn không có quyền quản lý gian hàng của khiếu nại này.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    if (dispute.status !== 'OPEN' && dispute.status !== 'WAITING_SELLER') {
      return new Response(
        JSON.stringify({ success: false, error: `Khiếu nại này đã kết thúc với trạng thái ${dispute.status}, không thể phản hồi thêm.` }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const nowIso = new Date().toISOString();

    // 3. Cập nhật phản hồi của người bán và chuyển trạng thái sang WAITING_SELLER
    await env.DB
      .prepare(`
        UPDATE seller_disputes
        SET seller_response = ?,
            seller_replacement_code = ?,
            seller_responded_at = ?,
            status = 'WAITING_SELLER',
            updated_at = ?
        WHERE id = ?
      `)
      .bind(
        message,
        replacementCode || dispute.seller_replacement_code || null,
        nowIso,
        nowIso,
        disputeId
      )
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã gửi phản hồi khiếu nại thành công! Thông tin phản hồi đã được chuyển cho Quản trị viên và Khách hàng.',
        dispute_status: 'WAITING_SELLER',
        seller_response: message,
        seller_replacement_code: replacementCode || dispute.seller_replacement_code || null,
        updated_at: nowIso,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[Seller Respond Dispute Error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi gửi phản hồi khiếu nại.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
