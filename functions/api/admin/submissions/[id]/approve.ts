import { ensureSchemaUpgrades, getSettingD1, setSettingD1, logAdminAudit } from '../../../../services/d1_service';
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
 * POST /api/admin/submissions/:id/approve
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
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

    const url = new URL(request.url);
    let targetId = String(params?.id || '').trim();
    if (!targetId) {
      const parts = url.pathname.split('/').filter(Boolean);
      const appIdx = parts.lastIndexOf('approve');
      if (appIdx > 0) {
        targetId = parts[appIdx - 1];
      }
    }

    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã đóng góp (:id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const rawSubs = await getSettingD1<any[]>(env.DB, 'wcg_admin_submissions_v4').catch(() => []);
    const list: any[] = Array.isArray(rawSubs) ? rawSubs : [];

    const idx = list.findIndex((s) => String(s?.id) === targetId);
    if (idx === -1) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy mã đóng góp "${targetId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const sub = list[idx];
    sub.status = 'APPROVED';
    sub.approvedAt = new Date().toISOString();
    sub.approvedBy = auth.adminName || 'Admin';

    list[idx] = sub;
    await setSettingD1(env.DB, 'wcg_admin_submissions_v4', list);

    // Tự động đẩy mã vào bảng codes
    const codeValue = String(sub.codeValue || sub.code || '').trim();
    const gameSlug = String(sub.gameSlug || sub.game_slug || '').trim();
    const rewards = String(sub.rewards || 'Mã quà tặng do thành viên đóng góp').trim();

    if (codeValue && gameSlug) {
      await env.DB.prepare(`
        INSERT INTO codes (game_slug, game_name, code, rewards, status, expires_at, is_hot, created_at)
        VALUES (?, ?, ?, ?, 'active', NULL, 0, datetime('now'))
      `).bind(gameSlug, sub.gameName || gameSlug, codeValue, rewards).run().catch(() => {});
    }

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'APPROVE_GIFTCODE_SUBMISSION',
      targetId,
      details: {
        code: codeValue,
        gameSlug,
        submitter: sub.submitterEmail || sub.submitterName,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã phê duyệt mã giftcode "${codeValue}" và tự động phát hành vào kho mã thành công.`,
        submission: sub,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi duyệt mã đóng góp: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
