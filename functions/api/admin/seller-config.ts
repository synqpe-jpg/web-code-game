import { verifyAdminAuth } from '../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../services/d1_service';
import { getMarketplaceConfig } from '../../services/marketplace_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET: Lấy cấu hình sàn TMĐT
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyAdminAuth(request, env as any, 'MARKETPLACE_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Yêu cầu quyền Quản trị viên (MARKETPLACE_MANAGE).' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const config = await getMarketplaceConfig(env.DB);

    return new Response(
      JSON.stringify({ success: true, config }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

// PUT: Cập nhật cấu hình sàn TMĐT
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyAdminAuth(request, env as any, 'MARKETPLACE_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Yêu cầu quyền Quản trị viên (MARKETPLACE_MANAGE).' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body = (await request.json().catch(() => ({}))) as any;
    const newConfig = {
      default_trial_product_limit: Math.max(1, parseInt(body.default_trial_product_limit || 5, 10)),
      default_trial_order_max: Math.max(10, parseInt(body.default_trial_order_max || 200, 10)),
      batch_freeze_error_rate: Math.min(1, Math.max(0.05, parseFloat(body.batch_freeze_error_rate || 0.25))),
      min_batch_size_for_freeze: Math.max(2, parseInt(body.min_batch_size_for_freeze || 5, 10)),
    };

    const nowIso = new Date().toISOString();
    await env.DB
      .prepare(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ('wcg_marketplace_config_v1', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `)
      .bind(JSON.stringify(newConfig), nowIso)
      .run();

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'ADMIN_UPDATE_MARKETPLACE_CONFIG',
      targetId: 'wcg_marketplace_config_v1',
      details: newConfig,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Đã cập nhật cấu hình sàn TMĐT thành công.', config: newConfig }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
