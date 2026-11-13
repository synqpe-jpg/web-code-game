import { PagesFunction } from '@cloudflare/workers-types';
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

// POST /api/admin/seller-ratings/:id/moderate: Phê duyệt hoặc từ chối đánh giá gian hàng
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyAdminAuth(request, env as any, 'MARKETPLACE_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Yêu cầu quyền Quản trị viên.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const ratingId = String(params.id || '').trim();
    const body = (await request.json().catch(() => ({}))) as any;
    const decision = String(body.decision || '').toUpperCase().trim();
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      return new Response(
        JSON.stringify({ success: false, error: 'Hành động không hợp lệ (chỉ chấp nhận APPROVED hoặc REJECTED).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const rating = await env.DB
      .prepare('SELECT * FROM seller_ratings WHERE id = ? LIMIT 1')
      .bind(ratingId)
      .first<any>();

    if (!rating) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy đánh giá này.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const moderatorName = (auth as any).member?.username || (auth as any).keyRecord?.key_name || 'Admin';
    const nowIso = new Date().toISOString();
    const rejectReason = decision === 'REJECTED' ? (reason || 'Nội dung không phù hợp với quy chuẩn đánh giá của sàn.') : null;

    await env.DB
      .prepare(`
        UPDATE seller_ratings
        SET status = ?,
            reject_reason = ?,
            moderated_by = ?,
            moderated_at = ?
        WHERE id = ?
      `)
      .bind(decision, rejectReason, moderatorName, nowIso, ratingId)
      .run();

    await logAdminAudit(env.DB, {
      adminEmail: moderatorName,
      action: 'MODERATE_SELLER_RATING',
      targetType: 'seller_ratings',
      targetId: ratingId,
      details: {
        seller_id: rating.seller_id,
        order_id: rating.order_id,
        stars: rating.stars,
        decision,
        reject_reason: rejectReason,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: decision === 'APPROVED' ? 'Đã duyệt đánh giá thành công!' : 'Đã từ chối đánh giá.',
        status: decision,
        reject_reason: rejectReason,
        moderated_at: nowIso,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[Moderate Rating Error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi xử lý kiểm duyệt đánh giá.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
