import { ensureSchemaUpgrades } from '../../../services/d1_service';
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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/admin/members
 * Danh sách thành viên + lọc theo role, status + tìm kiếm + phân trang
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cơ sở dữ liệu Cloudflare D1 chưa được kích hoạt.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'MEMBERS_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền MEMBERS_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20));
    const role = (url.searchParams.get('role') || 'ALL').toUpperCase().trim();
    const status = (url.searchParams.get('status') || 'ALL').toUpperCase().trim();
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();

    const conditions: string[] = [];
    const params: any[] = [];

    if (role !== 'ALL' && role !== '') {
      conditions.push('role = ?');
      params.push(role);
    }

    if (status !== 'ALL' && status !== '') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(id = ? OR username LIKE ? OR display_name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const wild = `%${search}%`;
      params.push(search, wild, wild, wild, wild);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM members ${whereClause}`;
    const totalRow = await env.DB.prepare(countSql).bind(...params).first<any>();
    const total = Number(totalRow?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const dataSql = `
      SELECT id, username, display_name, email, phone, role, balance, total_spent, status, email_verified, created_at
      FROM members
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await env.DB.prepare(dataSql).bind(...params, limit, offset).all<any>();

    const members = (rows?.results || []).map((m: any) => ({
      id: m.id,
      username: m.username || '',
      displayName: m.display_name || m.username || 'Thành viên',
      email: m.email || '',
      phone: m.phone || '',
      role: m.role || 'MEMBER',
      balance: Number(m.balance || 0),
      totalSpent: Number(m.total_spent || 0),
      status: m.status || 'ACTIVE',
      emailVerified: m.email_verified === 1 || m.email_verified === true,
      createdAt: m.created_at,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        page,
        limit,
        total,
        totalPages,
        members,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy danh sách thành viên: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
