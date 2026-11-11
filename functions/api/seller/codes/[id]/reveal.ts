import { verifyMemberAuth } from '../../../../services/mission_service';
import { ensureMarketplaceSchema } from '../../../../services/d1_service';
import { decryptCode } from '../../../../services/marketplace_service';

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

// POST: Xem mã nguyên vẹn trong kho (ghi nhật ký kiểm toán)
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

    const codeId = params.id as string;
    const memberId = auth.member.id;

    // Tìm mã và kiểm tra quyền
    const codeRow = await env.DB
      .prepare(`
        SELECT sc.id, sc.seller_id, sc.code_encrypted, sc.status, s.owner_member_id
        FROM seller_codes sc
        JOIN sellers s ON sc.seller_id = s.id
        WHERE sc.id = ? AND sc.deleted_at IS NULL
          AND (s.owner_member_id = ? OR s.id IN (SELECT seller_id FROM seller_subaccounts WHERE member_id = ?))
        LIMIT 1
      `)
      .bind(codeId, memberId, memberId)
      .first<any>();

    if (!codeRow) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mã không tồn tại hoặc bạn không có quyền xem.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const plainCode = await decryptCode(codeRow.code_encrypted);
    const viewLogId = `scv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const ipAddress = request.headers.get('cf-connecting-ip') || '127.0.0.1';

    // Ghi audit log vào seller_code_views (§5.2)
    await env.DB
      .prepare(`
        INSERT INTO seller_code_views (
          id, code_id, seller_id, viewer_member_id, viewer_name, ip_address, viewed_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(
        viewLogId,
        codeRow.id,
        codeRow.seller_id,
        memberId,
        auth.member.username || auth.member.email,
        ipAddress
      )
      .run()
      .catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        code_id: codeRow.id,
        code: plainCode,
        status: codeRow.status,
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
