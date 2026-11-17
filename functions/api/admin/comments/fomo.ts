import { ensureSchemaUpgrades, ensureGameCommentsSchema } from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';
import { generateFomoComments, FOMO_USERNAMES, POSITIVE_COMMENTS_5_STAR, POSITIVE_COMMENTS_4_STAR, EXPIRED_FEEDBACK_COMMENTS } from '../../../services/fomo_comments_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/admin/comments/fomo
 * Tra cứu & mô phỏng động cơ FOMO Reviews cho một tựa game hoặc toàn sàn
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available' }), { status: 500, headers: CORS_HEADERS });
    }

    const auth = await verifyAdminAuth(request, env as any, 'GAME_COMMENTS_MANAGE');
    if (!auth.authorized) {
      return new Response(JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const gameSlug = (url.searchParams.get('slug') || url.searchParams.get('game_slug') || 'idle-heroes-ky-nguyen-anh-hung').toLowerCase().trim();

    await ensureSchemaUpgrades(env.DB);
    await ensureGameCommentsSchema(env.DB);

    let gameMeta: any = {};
    try {
      const gRow = await env.DB.prepare(`
        SELECT is_hot, is_featured, is_new, total_codes_count, active_codes_count
        FROM games
        WHERE slug = ?
        LIMIT 1
      `).bind(gameSlug).first<any>();
      if (gRow) {
        gameMeta = gRow;
      }
    } catch {}

    const nowMs = Date.now();
    const fomoData = generateFomoComments(gameSlug, gameMeta, nowMs);

    return new Response(
      JSON.stringify({
        success: true,
        game_slug: gameSlug,
        game_meta: gameMeta,
        stats: {
          total_sample_usernames: FOMO_USERNAMES.length,
          total_5_star_templates: POSITIVE_COMMENTS_5_STAR.length,
          total_4_star_templates: POSITIVE_COMMENTS_4_STAR.length,
          total_expired_feedback_templates: EXPIRED_FEEDBACK_COMMENTS.length,
        },
        fomo_overview: fomoData.overview,
        preview_comments: fomoData.comments.slice(0, 15),
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message }), { status: 500, headers: CORS_HEADERS });
  }
};
