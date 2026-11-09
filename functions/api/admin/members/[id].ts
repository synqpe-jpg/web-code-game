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
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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
    if (lastPart && lastPart !== 'members') {
      targetId = lastPart;
    }
  }
  return targetId;
}

/**
 * GET /api/admin/members/:id
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
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
    const targetId = extractTargetId(params, new URL(request.url));
    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã thành viên (:id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const member = await env.DB.prepare(`
      SELECT id, username, display_name, email, phone, role, balance, total_spent, status, email_verified, created_at
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

    return new Response(
      JSON.stringify({
        success: true,
        member: {
          id: member.id,
          username: member.username || '',
          displayName: member.display_name || member.username,
          email: member.email || '',
          phone: member.phone || '',
          role: member.role || 'MEMBER',
          balance: Number(member.balance || 0),
          totalSpent: Number(member.total_spent || 0),
          status: member.status || 'ACTIVE',
          emailVerified: member.email_verified === 1 || member.email_verified === true,
          createdAt: member.created_at,
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * PUT /api/admin/members/:id
 * Sửa thông tin thành viên (displayName, email, phone, role, status)
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

    const auth = await verifyAdminAuth(request, env as any, 'MEMBERS_FULL');
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
        JSON.stringify({ success: false, error: 'Thiếu mã thành viên (:id).' }),
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

    const existing = await env.DB.prepare(`
      SELECT id, username, display_name, email, phone, role, balance, total_spent, status, email_verified, created_at
      FROM members
      WHERE id = ? OR username = ? OR email = ?
      LIMIT 1
    `).bind(targetId, targetId, targetId).first<any>();

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy thành viên "${targetId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const newDisplayName = body.displayName !== undefined || body.display_name !== undefined
      ? String(body.displayName ?? body.display_name ?? '').trim()
      : existing.display_name;

    const newEmail = body.email !== undefined
      ? String(body.email || '').trim()
      : existing.email;

    const newPhone = body.phone !== undefined
      ? String(body.phone || '').trim()
      : existing.phone;

    let newRole = existing.role;
    if (body.role !== undefined) {
      const r = String(body.role).toUpperCase().trim();
      if (['MEMBER', 'ADMIN', 'SUPER_ADMIN'].includes(r)) {
        newRole = r;
      }
    }

    let newStatus = existing.status;
    if (body.status !== undefined) {
      const s = String(body.status).toUpperCase().trim();
      if (['ACTIVE', 'BANNED', 'PENDING'].includes(s)) {
        newStatus = s;
      }
    }

    await env.DB.prepare(`
      UPDATE members
      SET display_name = ?,
          email = ?,
          phone = ?,
          role = ?,
          status = ?
      WHERE id = ?
    `).bind(newDisplayName, newEmail, newPhone, newRole, newStatus, existing.id).run();

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'UPDATE_MEMBER',
      targetId: existing.id,
      targetUser: existing.username,
      details: {
        before: { displayName: existing.display_name, email: existing.email, phone: existing.phone, role: existing.role, status: existing.status },
        after: { displayName: newDisplayName, email: newEmail, phone: newPhone, role: newRole, status: newStatus },
      },
    });

    const updated = await env.DB.prepare(`
      SELECT id, username, display_name, email, phone, role, balance, total_spent, status, email_verified, created_at
      FROM members
      WHERE id = ?
      LIMIT 1
    `).bind(existing.id).first<any>();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã cập nhật thông tin thành viên thành công.',
        member: {
          id: updated.id,
          username: updated.username,
          displayName: updated.display_name,
          email: updated.email,
          phone: updated.phone,
          role: updated.role,
          balance: Number(updated.balance || 0),
          totalSpent: Number(updated.total_spent || 0),
          status: updated.status,
          emailVerified: updated.email_verified === 1 || updated.email_verified === true,
          createdAt: updated.created_at,
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi cập nhật thành viên: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
