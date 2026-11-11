import { verifyMemberAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../services/d1_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET: Danh sách tài khoản phụ
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const memberId = auth.member.id;

    // Chỉ chủ gian hàng mới được quản lý tài khoản phụ
    const seller = await env.DB
      .prepare("SELECT id FROM sellers WHERE owner_member_id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(memberId)
      .first<{ id: string }>();

    if (!seller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chỉ chủ gian hàng mới có quyền xem danh sách tài khoản phụ.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const subaccounts = await env.DB
      .prepare(`
        SELECT sa.id, sa.member_id, sa.member_email, sa.role, sa.created_at, m.username, m.display_name
        FROM seller_subaccounts sa
        LEFT JOIN members m ON sa.member_id = m.id
        WHERE sa.seller_id = ?
        ORDER BY sa.created_at DESC
      `)
      .bind(seller.id)
      .all<any>();

    return new Response(
      JSON.stringify({ success: true, subaccounts: subaccounts.results || [] }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

// POST: Thêm tài khoản phụ (§6.5)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const memberId = auth.member.id;

    const seller = await env.DB
      .prepare("SELECT id, name FROM sellers WHERE owner_member_id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(memberId)
      .first<{ id: string; name: string }>();

    if (!seller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chỉ chủ gian hàng mới có quyền thêm tài khoản phụ.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const body = (await request.json().catch(() => ({}))) as any;
    const { email, role } = body;

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email thành viên không hợp lệ.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (role !== 'VIEW_ORDERS' && role !== 'MANAGE_STOCK') {
      return new Response(
        JSON.stringify({ success: false, error: 'Vai trò không hợp lệ (VIEW_ORDERS hoặc MANAGE_STOCK).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Tìm thành viên theo email
    const targetMember = await env.DB
      .prepare("SELECT id, email, username FROM members WHERE LOWER(email) = ? LIMIT 1")
      .bind(cleanEmail)
      .first<any>();

    if (!targetMember) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy tài khoản thành viên với email này trên website.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (targetMember.id === memberId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bạn đã là chủ gian hàng này, không thể thêm chính mình làm tài khoản phụ.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Kiểm tra xem đã được gán chưa
    const existingSub = await env.DB
      .prepare("SELECT id FROM seller_subaccounts WHERE seller_id = ? AND member_id = ? LIMIT 1")
      .bind(seller.id, targetMember.id)
      .first<any>();

    if (existingSub) {
      // Cập nhật lại role
      await env.DB
        .prepare("UPDATE seller_subaccounts SET role = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(role, existingSub.id)
        .run();

      return new Response(
        JSON.stringify({ success: true, message: 'Đã cập nhật quyền cho tài khoản phụ thành công.' }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    await env.DB
      .prepare(`
        INSERT INTO seller_subaccounts (
          id, seller_id, member_id, member_email, role, invited_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        subId,
        seller.id,
        targetMember.id,
        cleanEmail,
        role,
        memberId,
        nowIso,
        nowIso
      )
      .run();

    await logAdminAudit(env.DB, {
      actorName: auth.member.username || auth.member.email,
      actorEmail: auth.member.email,
      action: 'SELLER_ADD_SUBACCOUNT',
      targetId: subId,
      details: { seller_name: seller.name, sub_email: cleanEmail, role },
    });

    return new Response(
      JSON.stringify({ success: true, message: `Đã thêm ${cleanEmail} làm tài khoản phụ (${role}) thành công.` }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
