import { ensureSchemaUpgrades, ensureGameCommentsSchema } from '../../../../services/d1_service';
import { verifyMemberAuth } from '../../../../services/mission_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * PUT /api/games/:slug/comments/:id (Sửa bình luận chính chủ -> chuyển về PENDING)
 * DELETE /api/games/:slug/comments/:id (Xóa bình luận chính chủ)
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  try {
    if (!env.DB) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available' }), { status: 500, headers: CORS_HEADERS });
    }

    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
    }

    const commentId = String(params.id || '').trim();
    const gameSlug = String(params.slug || '').toLowerCase().trim();

    await ensureSchemaUpgrades(env.DB);
    await ensureGameCommentsSchema(env.DB);

    const comment = await env.DB.prepare(`
      SELECT * FROM game_comments WHERE id = ? AND game_slug = ? LIMIT 1
    `).bind(commentId, gameSlug).first<any>();

    if (!comment) {
      return new Response(JSON.stringify({ success: false, error: 'Không tìm thấy bình luận' }), { status: 404, headers: CORS_HEADERS });
    }

    if (comment.user_id !== auth.member.id && auth.member.role !== 'ADMIN' && auth.member.role !== 'SUPER_ADMIN') {
      return new Response(JSON.stringify({ success: false, error: 'Bạn không có quyền sửa bình luận này' }), { status: 403, headers: CORS_HEADERS });
    }

    const body: any = await request.json().catch(() => ({}));
    let rating: number | null = null;
    if (body.rating !== undefined && body.rating !== null && body.rating !== '') {
      const r = parseInt(String(body.rating), 10);
      if (r >= 1 && r <= 5) rating = r;
    }

    let content: string | null = null;
    if (body.content && typeof body.content === 'string') {
      content = body.content.trim();
    }

    const confirmedWorking = body.confirmed_working ? 1 : 0;

    if (!rating && (!content || content.length === 0)) {
      return new Response(JSON.stringify({ success: false, error: 'Vui lòng chọn sao hoặc nhập nội dung bình luận' }), { status: 400, headers: CORS_HEADERS });
    }

    if (content && content.length > 500) {
      return new Response(JSON.stringify({ success: false, error: 'Nội dung tối đa 500 ký tự' }), { status: 400, headers: CORS_HEADERS });
    }

    if (content && /(https?:\/\/|www\.)[^\s]+/i.test(content)) {
      return new Response(JSON.stringify({ success: false, error: 'Không được chèn link vào bình luận' }), { status: 400, headers: CORS_HEADERS });
    }

    await env.DB.prepare(`
      UPDATE game_comments 
      SET rating = ?, 
          content = ?, 
          confirmed_working = ?, 
          status = 'PENDING', 
          created_at = datetime('now'),
          reviewed_by = NULL,
          reviewed_at = NULL,
          rejection_reason = NULL
      WHERE id = ?
    `).bind(rating, content, confirmedWorking, commentId).run();

    return new Response(
      JSON.stringify({ success: true, message: 'Đã cập nhật bình luận. Đang chờ quản trị viên duyệt lại.' }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message }), { status: 500, headers: CORS_HEADERS });
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  try {
    if (!env.DB) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available' }), { status: 500, headers: CORS_HEADERS });
    }

    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
    }

    const commentId = String(params.id || '').trim();
    const gameSlug = String(params.slug || '').toLowerCase().trim();

    await ensureSchemaUpgrades(env.DB);
    await ensureGameCommentsSchema(env.DB);

    const comment = await env.DB.prepare(`
      SELECT * FROM game_comments WHERE id = ? AND game_slug = ? LIMIT 1
    `).bind(commentId, gameSlug).first<any>();

    if (!comment) {
      return new Response(JSON.stringify({ success: false, error: 'Không tìm thấy bình luận' }), { status: 404, headers: CORS_HEADERS });
    }

    if (comment.user_id !== auth.member.id && auth.member.role !== 'ADMIN' && auth.member.role !== 'SUPER_ADMIN') {
      return new Response(JSON.stringify({ success: false, error: 'Bạn không có quyền xóa bình luận này' }), { status: 403, headers: CORS_HEADERS });
    }

    await env.DB.prepare(`DELETE FROM game_comments WHERE id = ?`).bind(commentId).run();

    return new Response(
      JSON.stringify({ success: true, message: 'Đã xóa bình luận thành công.' }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message }), { status: 500, headers: CORS_HEADERS });
  }
};
