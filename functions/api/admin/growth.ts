import { ensureSchemaUpgrades, getSettingD1, setSettingD1, logAdminAudit } from '../../services/d1_service';
import { verifyAdminAuth } from '../../services/mission_service';
import canonicalBackupState from '../../data/canonical_backup_state.json';

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

/**
 * GET /api/admin/growth
 * Đọc cấu hình tăng trưởng & viral từ Cloudflare D1
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

    const auth = await verifyAdminAuth(request, env as any, 'GROWTH_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền GROWTH_FULL hoặc STORE_FULL' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const fallbackConfig = (canonicalBackupState as any)?.growthConfig || {};
    const config = await getSettingD1<any>(env.DB, 'wcg_growth_config_v1', fallbackConfig);

    return new Response(
      JSON.stringify({
        success: true,
        data: config || fallbackConfig,
        config: config || fallbackConfig,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('[Admin Growth GET Error]:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy cấu hình tăng trưởng: ' + (error?.message || String(error)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * PUT /api/admin/growth
 * Cập nhật cấu hình tăng trưởng & viral (cho phép partial update)
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'GROWTH_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền GROWTH_FULL hoặc STORE_FULL' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Payload không hợp lệ (yêu cầu JSON format).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const payload = body.config || body.data || body;
    if (!payload || typeof payload !== 'object') {
      return new Response(
        JSON.stringify({ success: false, error: 'Dữ liệu cấu hình không hợp lệ.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const fallbackConfig = (canonicalBackupState as any)?.growthConfig || {};
    const currentConfig = await getSettingD1<any>(env.DB, 'wcg_growth_config_v1', fallbackConfig);

    const mergedConfig = {
      ...(typeof currentConfig === 'object' ? currentConfig : {}),
      ...payload,
      updated_at: new Date().toISOString(),
      updated_by: auth.adminName || auth.keyName || 'Admin',
    };

    await setSettingD1(env.DB, 'wcg_growth_config_v1', mergedConfig);

    await logAdminAudit(env.DB, {
      action: 'UPDATE_GROWTH_CONFIG',
      targetId: 'wcg_growth_config_v1',
      actor: auth.adminName || auth.keyName || 'Admin',
      actorEmail: auth.adminId || 'admin@codegame.shop',
      severity: 'INFO',
      details: {
        updatedFields: Object.keys(payload),
        updatedAt: mergedConfig.updated_at,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã cập nhật cấu hình tăng trưởng & viral thành công.',
        config: mergedConfig,
        data: mergedConfig,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('[Admin Growth PUT Error]:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi cập nhật cấu hình tăng trưởng: ' + (error?.message || String(error)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
