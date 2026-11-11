import { verifyMemberAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../services/d1_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// DELETE: Xóa tài khoản phụ
export const onRequestDelete: PagesFunction<Env> = async (context) => {
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

    const subId = params.id as string;
    const memberId = auth.member.id;

    // Tìm subaccount và kiểm tra người xóa có phải là chủ shop không
    const sub = await env.DB
      .prepare(`
        SELECT sa.id, sa.seller_id, sa.member_email, s.owner_member_id
        FROM seller_subaccounts sa
        JOIN sellers s ON sa.seller_id = s.id
        WHERE sa.id = ? AND s.owner_member_id = ?
        LIMIT 1
      `)
      .bind(subId, memberId)
      .first<any>();

    if (!sub) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy tài khoản phụ hoặc bạn không phải chủ gian hàng.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    await env.DB.prepare("DELETE FROM seller_subaccounts WHERE id = ?").bind(subId).run();

    await logAdminAudit(env.DB, {
      actorName: auth.member.username || auth.member.email,
      actorEmail: auth.member.email,
      action: 'SELLER_REMOVE_SUBACCOUNT',
      targetId: subId,
      details: { member_email: sub.member_email },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Đã xóa quyền tài khoản phụ thành công.' }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
