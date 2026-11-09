import { ensureSchemaUpgrades, logAdminAudit } from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

function extractTargetId(params: any, url: URL): string {
  let targetId = String(params?.id || url.searchParams.get('id') || '').trim();
  if (!targetId) {
    const parts = url.pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart !== 'free-codes') {
      targetId = lastPart;
    }
  }
  return targetId;
}

/**
 * PUT /api/admin/free-codes/:id
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'GAMES_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    const targetId = extractTargetId(params, new URL(request.url));
    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã định danh code (:id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON payload required' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const existing = await env.DB.prepare('SELECT * FROM codes WHERE id = ? LIMIT 1').bind(targetId).first<any>();
    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy giftcode có id "${targetId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const newCode = body.code !== undefined ? String(body.code).trim() : existing.code;
    const newRewards = body.rewards !== undefined ? String(body.rewards).trim() : existing.rewards;
    const newStatus = body.status !== undefined ? String(body.status).toLowerCase().trim() : existing.status;
    const newExpiresAt = body.expires_at !== undefined ? body.expires_at : (body.expiresAt !== undefined ? body.expiresAt : existing.expires_at);
    const newGameSlug = body.game_slug !== undefined ? String(body.game_slug).trim() : existing.game_slug;

    await env.DB.prepare(`
      UPDATE codes
      SET code = ?,
          rewards = ?,
          status = ?,
          expires_at = ?,
          game_slug = ?
      WHERE id = ?
    `).bind(newCode, newRewards, newStatus, newExpiresAt, newGameSlug, targetId).run();

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'UPDATE_FREE_CODE',
      targetId,
      details: {
        code: newCode,
        gameSlug: newGameSlug,
        rewards: newRewards,
        status: newStatus,
      },
    });

    const updated = await env.DB.prepare(`
      SELECT c.id, c.game_slug, g.name as game_name, c.code, c.rewards, c.status, c.expires_at, c.created_at
      FROM codes c
      LEFT JOIN games g ON c.game_slug = g.slug
      WHERE c.id = ?
      LIMIT 1
    `).bind(targetId).first<any>();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã cập nhật giftcode thành công.',
        code: {
          id: updated?.id || targetId,
          gameSlug: updated?.game_slug || newGameSlug,
          gameName: updated?.game_name || newGameSlug,
          code: updated?.code || newCode,
          rewards: updated?.rewards || newRewards,
          status: updated?.status || newStatus,
          expiresAt: updated?.expires_at || newExpiresAt,
          createdAt: updated?.created_at || existing.created_at,
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi cập nhật giftcode: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * DELETE /api/admin/free-codes/:id
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'GAMES_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    const targetId = extractTargetId(params, new URL(request.url));
    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã định danh code (:id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const existing = await env.DB.prepare('SELECT * FROM codes WHERE id = ? LIMIT 1').bind(targetId).first<any>();
    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy mã giftcode có id "${targetId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    await env.DB.prepare('DELETE FROM codes WHERE id = ?').bind(targetId).run();

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'DELETE_FREE_CODE',
      targetId,
      details: { code: existing.code, gameSlug: existing.game_slug },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã xóa mã giftcode "${existing.code}" thành công.`,
        deletedCount: 1,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi xóa mã giftcode: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
