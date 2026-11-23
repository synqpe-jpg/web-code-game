import { bulkReplaceBrandAndDomain } from '../../../services/branding_service';
import { verifyAdminAuth } from '../../../services/mission_service';
import { logAdminAudit } from '../../../services/d1_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
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
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

/**
 * POST /api/admin/branding/bulk-replace
 * Thay thế hàng loạt tên thương hiệu và tên miền cũ thành mới trong bài tin, mã code và cấu hình CMS
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  const auth = await verifyAdminAuth(request, env as any, 'BRANDING_MANAGE');
  if (!auth.authorized) {
    return new Response(
      JSON.stringify({
        success: false,
        message: auth.error || 'Yêu cầu quyền Quản trị viên (ADMIN hoặc SUPER_ADMIN).',
      }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  try {
    const body: any = await request.json().catch(() => ({}));
    const oldDomain = String(body.oldDomain || '').trim();
    const newDomain = String(body.newDomain || '').trim();
    const oldBrand = String(body.oldBrand || '').trim();
    const newBrand = String(body.newBrand || '').trim();

    if (!oldDomain && !oldBrand) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Vui lòng cung cấp ít nhất tên miền cũ (oldDomain) hoặc tên thương hiệu cũ (oldBrand) cần thay thế.',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const replaceResult = await bulkReplaceBrandAndDomain(env?.DB, {
      oldDomain,
      newDomain,
      oldBrand,
      newBrand,
    });

    const actorName = auth.adminName || 'Admin';
    if (env?.DB) {
      const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
      await logAdminAudit(env.DB, {
        actorName,
        action: 'BULK_REPLACE_BRANDING',
        severity: 'WARN',
        ipAddress: clientIp,
        targetId: 'bulk_replace',
        details: {
          oldDomain,
          newDomain,
          oldBrand,
          newBrand,
          affected: replaceResult.affected,
        },
      }).catch((e) => console.warn('[BrandingAudit] Error recording audit log:', e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Hoàn tất thay thế hàng loạt tên miền và thương hiệu trong toàn bộ bài tin, mã code và nội dung CMS!',
        affected: replaceResult.affected,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: err?.message || 'Lỗi khi thực hiện thay thế hàng loạt.',
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
