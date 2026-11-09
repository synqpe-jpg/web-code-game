import { ensureSchemaUpgrades } from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';

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

const SITE_SETTINGS_KEY = 'wcg_site_settings_v1';

const DEFAULT_SITE_SETTINGS = {
  maintenance_mode: false,
  maintenance_message: 'Hệ thống đang bảo trì định kỳ để nâng cấp dịch vụ. Vui lòng quay lại sau ít phút!',
  allow_registration: true,
  deposit_bonus_percent: 0,
  min_deposit_amount: 10000,
  max_deposit_amount: 50000000,
  site_announcement: '',
  site_announcement_enabled: false,
  support_telegram: '@codegame_admin',
  support_zalo: '0988888888',
  support_email: 'support@codegame.shop',
  auto_fulfill_orders: true,
  updated_at: new Date().toISOString(),
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/admin/settings
 * Lấy danh mục cấu hình hệ thống và trạng thái bảo trì
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const authCheck = await verifyAdminAuth(request, env as any, 'SYSTEM_SETTINGS_FULL');
    if (!authCheck.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: authCheck.error || 'Yêu cầu quyền SYSTEM_SETTINGS_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const row = await env.DB.prepare(
      'SELECT value, updated_at FROM system_settings WHERE key = ? LIMIT 1'
    ).bind(SITE_SETTINGS_KEY).first<{ value: string; updated_at: string }>();

    let currentSettings = { ...DEFAULT_SITE_SETTINGS };
    if (row && row.value) {
      try {
        const parsed = JSON.parse(row.value);
        currentSettings = {
          ...currentSettings,
          ...parsed,
          updated_at: row.updated_at || currentSettings.updated_at,
        };
      } catch {
        // use default
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: currentSettings,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Lỗi lấy cấu hình hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * PUT /api/admin/settings
 * Cập nhật cấu hình hệ thống và trạng thái bảo trì
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const authCheck = await verifyAdminAuth(request, env as any, 'SYSTEM_SETTINGS_FULL');
    if (!authCheck.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: authCheck.error || 'Yêu cầu quyền SYSTEM_SETTINGS_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const body = await request.json<any>().catch(() => ({}));

    // Đọc settings hiện tại
    const row = await env.DB.prepare(
      'SELECT value FROM system_settings WHERE key = ? LIMIT 1'
    ).bind(SITE_SETTINGS_KEY).first<{ value: string }>();

    let current = { ...DEFAULT_SITE_SETTINGS };
    if (row && row.value) {
      try {
        current = { ...current, ...JSON.parse(row.value) };
      } catch {
        // ignore
      }
    }

    const updated = {
      ...current,
      maintenance_mode: body.maintenance_mode !== undefined ? Boolean(body.maintenance_mode) : current.maintenance_mode,
      maintenance_message: body.maintenance_message !== undefined ? String(body.maintenance_message).trim() : current.maintenance_message,
      allow_registration: body.allow_registration !== undefined ? Boolean(body.allow_registration) : current.allow_registration,
      deposit_bonus_percent: typeof body.deposit_bonus_percent === 'number' ? Math.max(0, Math.min(100, body.deposit_bonus_percent)) : current.deposit_bonus_percent,
      min_deposit_amount: typeof body.min_deposit_amount === 'number' ? Math.max(1000, body.min_deposit_amount) : current.min_deposit_amount,
      max_deposit_amount: typeof body.max_deposit_amount === 'number' ? Math.max(100000, body.max_deposit_amount) : current.max_deposit_amount,
      site_announcement: body.site_announcement !== undefined ? String(body.site_announcement).trim() : current.site_announcement,
      site_announcement_enabled: body.site_announcement_enabled !== undefined ? Boolean(body.site_announcement_enabled) : current.site_announcement_enabled,
      support_telegram: body.support_telegram !== undefined ? String(body.support_telegram).trim() : current.support_telegram,
      support_zalo: body.support_zalo !== undefined ? String(body.support_zalo).trim() : current.support_zalo,
      support_email: body.support_email !== undefined ? String(body.support_email).trim() : current.support_email,
      auto_fulfill_orders: body.auto_fulfill_orders !== undefined ? Boolean(body.auto_fulfill_orders) : current.auto_fulfill_orders,
      updated_at: new Date().toISOString(),
    };

    const now = updated.updated_at;

    await env.DB.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).bind(SITE_SETTINGS_KEY, JSON.stringify(updated), now).run();

    // Audit log
    await env.DB.prepare(`
      INSERT INTO security_logs (id, actor_name, actor_email, action, target_id, severity, details, created_at)
      VALUES (?, ?, ?, 'SYSTEM_SETTINGS_UPDATE', 'system_settings', 'WARNING', ?, ?)
    `).bind(
      `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      (authCheck.keyRecord as any)?.name || 'Admin API',
      (authCheck.keyRecord as any)?.actor_email || 'admin@codegame.shop',
      JSON.stringify({
        maintenance_mode: updated.maintenance_mode,
        deposit_bonus_percent: updated.deposit_bonus_percent,
        site_announcement_enabled: updated.site_announcement_enabled,
      }),
      now
    ).run().catch(() => null);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cập nhật cấu hình hệ thống thành công.',
        data: updated,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Lỗi cập nhật cấu hình hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
