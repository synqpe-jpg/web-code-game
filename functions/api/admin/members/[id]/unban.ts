import { ensureSchemaUpgrades, logAdminAudit } from '../../../../services/d1_service';
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
 * POST /api/admin/members/:id/unban
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

    const auth = await verifyAdminAuth(request, env as any, 'MEMBERS_FULL');
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
      const unbanIdx = parts.lastIndexOf('unban');
      if (unbanIdx > 0) {
        targetId = parts[unbanIdx - 1];
      }
    }

    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã thành viên (:id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const member = await env.DB.prepare(`
      SELECT id, username, display_name, email, role, status
      FROM members
      WHERE id = ? OR username = ? OR email = ?
      LIMIT 1
    `).bind(targetId, targetId, targetId).first<any>();

    if (!member) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy thành viên "${targetId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    await env.DB.prepare(`
      UPDATE members
      SET status = 'ACTIVE'
      WHERE id = ?
    `).bind(member.id).run();

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'UNBAN_MEMBER',
      targetId: member.id,
      targetUser: member.username,
      details: { previousStatus: member.status },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã mở khóa tài khoản thành viên "${member.display_name || member.username}".`,
        member: {
          id: member.id,
          username: member.username,
          status: 'ACTIVE',
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi mở khóa tài khoản: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
