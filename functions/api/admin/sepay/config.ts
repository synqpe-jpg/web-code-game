import { ensureSchemaUpgrades, getSettingD1, setSettingD1, logAdminAudit } from '../../../services/d1_service';
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
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

const DEFAULT_SEPAY_CONFIG = {
  bankName: 'TPBank',
  accountNumber: '10004681879',
  accountHolder: 'CODEGAME SHOP',
  qrTemplate: 'compact2',
  isActive: true,
  autoConfirm: true,
  webhookUrl: 'https://codegame.shop/api/webhooks/sepay',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/admin/sepay/config
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

    const auth = await verifyAdminAuth(request, env as any, 'WALLET_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const saved = await getSettingD1(env.DB, 'wcg_sepay_config_v1').catch(() => null);
    const config = {
      ...DEFAULT_SEPAY_CONFIG,
      ...(saved && typeof saved === 'object' ? saved : {}),
    };

    // Mask sensitive API token if present
    if (config.apiToken && typeof config.apiToken === 'string' && config.apiToken.length > 8) {
      config.apiToken = `${config.apiToken.slice(0, 4)}••••••••${config.apiToken.slice(-4)}`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        config,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy cấu hình SePay: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * PUT /api/admin/sepay/config
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

    const auth = await verifyAdminAuth(request, env as any, 'WALLET_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON payload required' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const saved = await getSettingD1(env.DB, 'wcg_sepay_config_v1').catch(() => null);
    const existing = {
      ...DEFAULT_SEPAY_CONFIG,
      ...(saved && typeof saved === 'object' ? saved : {}),
    };

    const updated = {
      ...existing,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    // Không vô tình ghi đè chuỗi đã che mặt nạ
    if (body.apiToken && body.apiToken.includes('••••')) {
      updated.apiToken = existing.apiToken;
    }

    await setSettingD1(env.DB, 'wcg_sepay_config_v1', updated);

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'UPDATE_SEPAY_CONFIG',
      details: {
        bankName: updated.bankName,
        accountNumber: updated.accountNumber,
        isActive: updated.isActive,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã cập nhật cấu hình SePay thành công.',
        config: updated,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi cập nhật cấu hình SePay: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
