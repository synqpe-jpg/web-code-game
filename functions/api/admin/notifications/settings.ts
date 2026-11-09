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

const SETTINGS_KEY = 'wcg_email_settings_v1';

const DEFAULT_SETTINGS = {
  provider: 'resend', // 'resend' | 'brevo' | 'smtp'
  sender_name: 'CodeGame.Shop',
  sender_email: 'no-reply@codegame.shop',
  reply_to: 'support@codegame.shop',
  notify_on_new_code: true,
  notify_on_order_completed: true,
  notify_on_deposit_success: true,
  batch_size: 50,
  daily_limit: 1000,
  resend_api_key_configured: false,
  brevo_api_key_configured: false,
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/admin/notifications/settings
 * Lấy cấu hình email & thông báo hệ thống
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

    const authCheck = await verifyAdminAuth(request, env as any, 'NOTIFICATIONS_FULL');
    if (!authCheck.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: authCheck.error || 'Yêu cầu quyền NOTIFICATIONS_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const row = await env.DB.prepare(
      'SELECT value FROM system_settings WHERE key = ? LIMIT 1'
    ).bind(SETTINGS_KEY).first<{ value: string }>();

    let settings = { ...DEFAULT_SETTINGS };
    if (row && row.value) {
      try {
        const parsed = JSON.parse(row.value);
        settings = {
          ...settings,
          ...parsed,
          // Che dấu secret keys, chỉ trả flag boolean
          resend_api_key_configured: Boolean(parsed.resend_api_key),
          brevo_api_key_configured: Boolean(parsed.brevo_api_key),
        };
        // Xóa key thô khỏi payload trả về
        delete (settings as any).resend_api_key;
        delete (settings as any).brevo_api_key;
      } catch {
        // Fallback default
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: settings,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Lỗi lấy cấu hình email.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * PUT /api/admin/notifications/settings
 * Cập nhật cấu hình email & thông báo hệ thống
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

    const authCheck = await verifyAdminAuth(request, env as any, 'NOTIFICATIONS_FULL');
    if (!authCheck.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: authCheck.error || 'Yêu cầu quyền NOTIFICATIONS_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const body = await request.json<any>().catch(() => ({}));

    // Đọc config hiện tại
    const row = await env.DB.prepare(
      'SELECT value FROM system_settings WHERE key = ? LIMIT 1'
    ).bind(SETTINGS_KEY).first<{ value: string }>();

    let currentConfig: any = { ...DEFAULT_SETTINGS };
    if (row && row.value) {
      try {
        currentConfig = JSON.parse(row.value);
      } catch {
        // ignore
      }
    }

    // Merge config mới
    const updatedConfig = {
      ...currentConfig,
      provider: body.provider !== undefined ? String(body.provider) : currentConfig.provider,
      sender_name: body.sender_name !== undefined ? String(body.sender_name) : currentConfig.sender_name,
      sender_email: body.sender_email !== undefined ? String(body.sender_email) : currentConfig.sender_email,
      reply_to: body.reply_to !== undefined ? String(body.reply_to) : currentConfig.reply_to,
      notify_on_new_code: body.notify_on_new_code !== undefined ? Boolean(body.notify_on_new_code) : currentConfig.notify_on_new_code,
      notify_on_order_completed: body.notify_on_order_completed !== undefined ? Boolean(body.notify_on_order_completed) : currentConfig.notify_on_order_completed,
      notify_on_deposit_success: body.notify_on_deposit_success !== undefined ? Boolean(body.notify_on_deposit_success) : currentConfig.notify_on_deposit_success,
      batch_size: typeof body.batch_size === 'number' ? Math.max(1, Math.min(200, body.batch_size)) : currentConfig.batch_size,
      daily_limit: typeof body.daily_limit === 'number' ? Math.max(10, body.daily_limit) : currentConfig.daily_limit,
    };

    // Nếu người dùng cung cấp API Key mới
    if (body.resend_api_key !== undefined) {
      updatedConfig.resend_api_key = String(body.resend_api_key).trim();
    }
    if (body.brevo_api_key !== undefined) {
      updatedConfig.brevo_api_key = String(body.brevo_api_key).trim();
    }

    const now = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).bind(SETTINGS_KEY, JSON.stringify(updatedConfig), now).run();

    // Audit log
    await env.DB.prepare(`
      INSERT INTO security_logs (id, actor_name, actor_email, action, target_id, severity, details, created_at)
      VALUES (?, ?, ?, 'NOTIFICATIONS_SETTINGS_UPDATE', 'system_settings', 'INFO', ?, ?)
    `).bind(
      `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      (authCheck.keyRecord as any)?.name || 'Admin API',
      (authCheck.keyRecord as any)?.actor_email || 'admin@codegame.shop',
      JSON.stringify({ provider: updatedConfig.provider, sender_email: updatedConfig.sender_email }),
      now
    ).run().catch(() => null);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cập nhật cấu hình email thông báo thành công.',
        data: {
          ...updatedConfig,
          resend_api_key_configured: Boolean(updatedConfig.resend_api_key),
          brevo_api_key_configured: Boolean(updatedConfig.brevo_api_key),
          resend_api_key: undefined,
          brevo_api_key: undefined,
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Lỗi lưu cấu hình email.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
