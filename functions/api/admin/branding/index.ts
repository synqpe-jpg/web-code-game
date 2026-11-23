import {
  getBrandingConfig,
  saveBrandingConfig,
  validateBrandingConfig,
  BrandingConfig,
} from '../../../services/branding_service';
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
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

/**
 * GET /api/admin/branding
 * Lấy cấu hình thương hiệu & tên miền hiện tại
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
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
    const branding = await getBrandingConfig(env?.DB);
    return new Response(
      JSON.stringify({
        success: true,
        branding,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: err?.message || 'Lỗi khi đọc cấu hình thương hiệu.',
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * PUT /api/admin/branding
 * Cập nhật cấu hình thương hiệu & tên miền
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
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
    const body: Partial<BrandingConfig> = await request.json().catch(() => ({}));
    const validation = validateBrandingConfig(body);

    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các trường thông tin.',
          errors: validation.errors,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const actorName = auth.adminName || 'Admin';
    const saved = await saveBrandingConfig(env?.DB, body, actorName);

    // Ghi nhật ký kiểm toán (Audit Log)
    if (env?.DB) {
      const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
      await logAdminAudit(env.DB, {
        actorName,
        action: 'UPDATE_BRANDING_SETTINGS',
        severity: 'INFO',
        ipAddress: clientIp,
        targetId: 'wcg_branding_v1',
        details: {
          changedFields: Object.keys(body),
          brandDisplay: saved.brandDisplay,
          baseUrl: saved.baseUrl,
          emailFromAddress: saved.emailFromAddress,
        },
      }).catch((e) => console.warn('[BrandingAudit] Error recording audit log:', e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cập nhật cấu hình thương hiệu và tên miền thành công!',
        branding: saved,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: err?.message || 'Lỗi khi lưu cấu hình thương hiệu.',
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
