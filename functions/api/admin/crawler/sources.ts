import { ensureSchemaUpgrades, logAdminAudit } from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';
const defaultSources = [
  { id: "src_gamek", name: "GameK Giftcode", url: "https://gamek.vn", game_slug: "*", active: true },
  { id: "src_gameland", name: "Gameland VN", url: "https://gamelandvn.com", game_slug: "*", active: true }
];

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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

const CRAWLER_SOURCES_KEY = 'wcg_crawler_sources_v1';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/admin/crawler/sources
 * Lấy danh sách các nguồn cào tự động
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

    const auth = await verifyAdminAuth(request, env as any, 'CRAWLER_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền CRAWLER_MANAGE, GAMES_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const settingRow = await env.DB.prepare('SELECT value FROM system_settings WHERE key = ?')
      .bind(CRAWLER_SOURCES_KEY)
      .first<any>();

    let sources: any[] = [];
    if (settingRow && settingRow.value) {
      try {
        sources = JSON.parse(settingRow.value);
      } catch {}
    }

    if (!Array.isArray(sources) || sources.length === 0) {
      sources = (defaultSources as any[]) || [];
    }

    const url = new URL(request.url);
    const type = (url.searchParams.get('type') || '').trim();
    const isEnabledParam = url.searchParams.get('isEnabled');

    let filtered = [...sources];
    if (type) {
      filtered = filtered.filter((s) => s.type === type);
    }
    if (isEnabledParam !== null && isEnabledParam !== '') {
      const isEnabled = isEnabledParam === 'true' || isEnabledParam === '1';
      filtered = filtered.filter((s) => Boolean(s.isEnabled) === isEnabled);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: filtered.length,
        sources: filtered,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi truy vấn nguồn cào' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * POST /api/admin/crawler/sources
 * Thêm nguồn cào mới
 * Body: { name: string; url: string; type?: string; description?: string; isEnabled?: boolean }
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'CRAWLER_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền CRAWLER_MANAGE, GAMES_FULL hoặc ADMIN_FULL.' }),
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

    const name = String(body.name || '').trim();
    const url = String(body.url || '').trim();
    if (!name || !url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tên nguồn (name) và đường link (url) là bắt buộc' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const settingRow = await env.DB.prepare('SELECT value FROM system_settings WHERE key = ?')
      .bind(CRAWLER_SOURCES_KEY)
      .first<any>();

    let sources: any[] = [];
    if (settingRow && settingRow.value) {
      try {
        sources = JSON.parse(settingRow.value);
      } catch {}
    }
    if (!Array.isArray(sources) || sources.length === 0) {
      sources = [...((defaultSources as any[]) || [])];
    }

    const newSource = {
      id: body.id ? String(body.id).trim() : `src_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      url,
      type: body.type || 'reputable_web',
      isEnabled: body.isEnabled !== false,
      description: body.description || '',
      createdAt: new Date().toISOString(),
    };

    sources.push(newSource);

    const jsonStr = JSON.stringify(sources);
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(CRAWLER_SOURCES_KEY, jsonStr, now).run();

    if (env.GAME_DATA_KV) {
      await env.GAME_DATA_KV.put(CRAWLER_SOURCES_KEY, jsonStr).catch(() => {});
    }

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'API Client',
      action: 'ADD_CRAWLER_SOURCE',
      targetId: newSource.id,
      details: JSON.stringify({ name: newSource.name, url: newSource.url }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Thêm nguồn cào thành công.',
        source: newSource,
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi thêm nguồn cào' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
