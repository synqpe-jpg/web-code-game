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

// DELETE: Xóa mềm mã kho chưa bán (§5.2: cấm xóa/sửa mã đã bán)
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

    const codeId = params.id as string;
    const memberId = auth.member.id;

    const codeRow = await env.DB
      .prepare(`
        SELECT sc.id, sc.seller_id, sc.product_id, sc.status
        FROM seller_codes sc
        JOIN sellers s ON sc.seller_id = s.id
        WHERE sc.id = ? AND sc.deleted_at IS NULL
          AND (s.owner_member_id = ? OR s.id IN (SELECT seller_id FROM seller_subaccounts WHERE member_id = ? AND role = 'MANAGE_STOCK'))
        LIMIT 1
      `)
      .bind(codeId, memberId, memberId)
      .first<any>();

    if (!codeRow) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mã không tồn tại hoặc bạn không có quyền xóa.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (codeRow.status !== 'IN_STOCK' && codeRow.status !== 'RECALLED') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Không thể xóa mã ở trạng thái ${codeRow.status}. Tuyệt đối không xóa mã đã bán hoặc đang tranh chấp.`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const nowIso = new Date().toISOString();
    await env.DB
      .prepare("UPDATE seller_codes SET deleted_at = ?, updated_at = ? WHERE id = ?")
      .bind(nowIso, nowIso, codeId)
      .run();

    await logAdminAudit(env.DB, {
      actorName: auth.member.username || auth.member.email,
      actorEmail: auth.member.email,
      action: 'SELLER_DELETE_CODE',
      targetId: codeId,
      details: { product_id: codeRow.product_id },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Đã xóa mã khỏi kho thành công.' }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
