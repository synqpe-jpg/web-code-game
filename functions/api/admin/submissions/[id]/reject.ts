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
 * POST /api/admin/submissions/:id/reject
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
      const rejIdx = parts.lastIndexOf('reject');
      if (rejIdx > 0) {
        targetId = parts[rejIdx - 1];
      }
    }

    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã đóng góp (:id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let reason = 'Mã không hợp lệ hoặc đã hết hạn';
    try {
      const body: any = await request.json();
      if (body?.reason) reason = String(body.reason).trim();
    } catch {}

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
    sub.status = 'REJECTED';
    sub.rejectionReason = reason;
    sub.rejectedAt = new Date().toISOString();
    sub.rejectedBy = auth.adminName || 'Admin';

    list[idx] = sub;
    await setSettingD1(env.DB, 'wcg_admin_submissions_v4', list);

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'REJECT_GIFTCODE_SUBMISSION',
      targetId,
      details: {
        code: sub.codeValue || sub.code,
        gameSlug: sub.gameSlug || sub.game_slug,
        reason,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã từ chối mã đóng góp.',
        submission: sub,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi từ chối mã đóng góp: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
