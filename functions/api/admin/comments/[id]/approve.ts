import { ensureSchemaUpgrades, ensureGameCommentsSchema, logAdminAudit } from '../../../../services/d1_service';
import { verifyAdminAuth } from '../../../../services/mission_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * POST /api/admin/comments/:id/approve
 * Duyệt bình luận game hiển thị công khai
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  try {
    if (!env.DB) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available' }), { status: 500, headers: CORS_HEADERS });
    }

    const auth = await verifyAdminAuth(request, env as any, 'GAMES_FULL');
    if (!auth.authorized) {
      return new Response(JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
    }

    const commentId = String(params.id || '').trim();
    if (!commentId) {
      return new Response(JSON.stringify({ success: false, error: 'Thiếu comment id' }), { status: 400, headers: CORS_HEADERS });
    }

    await ensureSchemaUpgrades(env.DB);
    await ensureGameCommentsSchema(env.DB);

    const comment = await env.DB.prepare(`SELECT * FROM game_comments WHERE id = ? LIMIT 1`).bind(commentId).first<any>();
    if (!comment) {
      return new Response(JSON.stringify({ success: false, error: 'Không tìm thấy bình luận' }), { status: 404, headers: CORS_HEADERS });
    }

    const adminName = auth.adminName || 'Admin';

    await env.DB.prepare(`
      UPDATE game_comments 
      SET status = 'APPROVED', 
          reviewed_by = ?, 
          reviewed_at = datetime('now'),
          rejection_reason = NULL
      WHERE id = ?
    `).bind(adminName, commentId).run();

    await logAdminAudit(env.DB, {
      actorName: adminName,
      action: 'APPROVE_GAME_COMMENT',
      targetId: commentId,
      targetUser: comment.user_id,
      severity: 'INFO',
      details: {
        game_slug: comment.game_slug,
        rating: comment.rating,
        content: comment.content,
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Đã duyệt bình luận thành công.' }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message }), { status: 500, headers: CORS_HEADERS });
  }
};
