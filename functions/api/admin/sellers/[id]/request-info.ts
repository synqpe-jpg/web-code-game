import { verifyAdminAuth } from '../../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../../services/d1_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// POST: Yêu cầu bổ sung thông tin (§3.2)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyAdminAuth(request, env as any, 'MARKETPLACE_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Yêu cầu quyền Quản trị viên (MARKETPLACE_MANAGE).' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const sellerId = params.id as string;
    const body = (await request.json().catch(() => ({}))) as any;
    const note = (body.note || '').trim();

    if (!note || note.length < 5) {
      return new Response(
        JSON.stringify({ success: false, error: 'Ghi chú yêu cầu bổ sung thông tin là bắt buộc (tối thiểu 5 ký tự).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const seller = await env.DB
      .prepare("SELECT * FROM sellers WHERE id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(sellerId)
      .first<any>();

    if (!seller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy gian hàng.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const nowIso = new Date().toISOString();
    await env.DB
      .prepare(`
        UPDATE sellers
        SET request_info_note = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(note, nowIso, sellerId)
      .run();

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'ADMIN_REQUEST_SELLER_INFO',
      targetId: sellerId,
      details: { seller_name: seller.name, note },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã gửi yêu cầu bổ sung thông tin tới gian hàng "${seller.name}".`,
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
