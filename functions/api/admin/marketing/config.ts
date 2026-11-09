import { ensureSchemaUpgrades, logAdminAudit } from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';
import canonicalBackup from '../../../data/canonical_backup_state.json';

interface Env {
  DB: D1Database;
  GAME_DATA_KV?: KVNamespace;
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

const MARKETING_SETTINGS_KEY = 'wcg_admin_marketing_v4';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/admin/marketing/config
 * Đọc cấu hình tiếp thị FOMO (bật/tắt, tần suất, danh sách tài khoản ảo, template)
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

    const auth = await verifyAdminAuth(request, env as any, 'MARKETING_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền MARKETING_FULL, STORE_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const settingRow = await env.DB.prepare('SELECT value FROM system_settings WHERE key = ?')
      .bind(MARKETING_SETTINGS_KEY)
      .first<any>();

    let marketingConfig: any = null;
    if (settingRow && settingRow.value) {
      try {
        marketingConfig = JSON.parse(settingRow.value);
      } catch {}
    }

    if (!marketingConfig && env.GAME_DATA_KV) {
      try {
        const rawKv = await env.GAME_DATA_KV.get(MARKETING_SETTINGS_KEY);
        if (rawKv) marketingConfig = JSON.parse(rawKv);
      } catch {}
    }

    if (!marketingConfig) {
      marketingConfig = (canonicalBackup as any)?.marketingConfig || {
        enabled: true,
        fomoMode: true,
        minDelaySeconds: 4,
        maxDelaySeconds: 12,
        soundEnabled: false,
        position: 'bottom-left',
        types: {
          BUY_PRODUCT: true,
          CLAIM_GIVEAWAY: true,
          COPY_CODE: true,
          RESTOCK_PRODUCT: true,
        },
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        config: marketingConfig,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi đọc cấu hình marketing' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * PUT /api/admin/marketing/config
 * Cập nhật cấu hình tiếp thị FOMO và đồng bộ tức thì vào D1 & KV
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

    const auth = await verifyAdminAuth(request, env as any, 'MARKETING_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền MARKETING_FULL, STORE_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Body JSON không hợp lệ' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const jsonStr = JSON.stringify(body);
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(MARKETING_SETTINGS_KEY, jsonStr, now).run();

    if (env.GAME_DATA_KV) {
      await env.GAME_DATA_KV.put(MARKETING_SETTINGS_KEY, jsonStr).catch(() => {});
    }

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'API Client',
      action: 'UPDATE_MARKETING_CONFIG',
      targetId: MARKETING_SETTINGS_KEY,
      details: JSON.stringify({
        enabled: body.enabled,
        fomoMode: body.fomoMode,
        minDelay: body.minDelaySeconds,
        maxDelay: body.maxDelaySeconds,
      }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã cập nhật cấu hình tiếp thị FOMO thành công.',
        config: body,
        updatedAt: now,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi cập nhật cấu hình marketing' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
