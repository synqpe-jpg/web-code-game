import { ensureSchemaUpgrades, getSettingD1 } from '../../../services/d1_service';
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
 * GET /api/admin/submissions
 * Danh sách giftcode do thành viên/khách đóng góp + lọc trạng thái
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

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
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền GAMES_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const url = new URL(request.url);
    const status = (url.searchParams.get('status') || 'ALL').toUpperCase().trim();
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').toLowerCase().trim();

    const rawSubs = await getSettingD1<any[]>(env.DB, 'wcg_admin_submissions_v4').catch(() => []);
    const allSubs: any[] = Array.isArray(rawSubs) ? rawSubs : [];

    let filtered = [...allSubs];

    if (status !== 'ALL' && status !== '') {
      filtered = filtered.filter((s) => String(s?.status || 'PENDING').toUpperCase() === status);
    }

    if (search) {
      filtered = filtered.filter((s) => {
        const cVal = String(s?.codeValue || s?.code || '').toLowerCase();
        const gSlug = String(s?.gameSlug || s?.game_slug || '').toLowerCase();
        const sName = String(s?.submitterName || s?.name || '').toLowerCase();
        const sEmail = String(s?.submitterEmail || s?.email || '').toLowerCase();
        return cVal.includes(search) || gSlug.includes(search) || sName.includes(search) || sEmail.includes(search);
      });
    }

    const total = allSubs.length;
    const pendingCount = allSubs.filter((s) => String(s?.status || 'PENDING').toUpperCase() === 'PENDING').length;
    const approvedCount = allSubs.filter((s) => String(s?.status).toUpperCase() === 'APPROVED').length;
    const rejectedCount = allSubs.filter((s) => String(s?.status).toUpperCase() === 'REJECTED').length;

    return new Response(
      JSON.stringify({
        success: true,
        total,
        pendingCount,
        approvedCount,
        rejectedCount,
        count: filtered.length,
        submissions: filtered,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy danh sách mã đóng góp: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
