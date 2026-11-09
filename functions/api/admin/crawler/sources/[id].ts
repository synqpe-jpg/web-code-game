import { ensureSchemaUpgrades, logAdminAudit } from '../../../../../services/d1_service';
import { verifyAdminAuth } from '../../../../../services/mission_service';
import defaultSources from '../../../../../data/crawler_sources.json';

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
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

const CRAWLER_SOURCES_KEY = 'wcg_crawler_sources_v1';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * PUT /api/admin/crawler/sources/:id
 * Chỉnh sửa nguồn cào (bật/tắt, đổi URL, đổi tên)
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;
  const sourceId = String(params.id || '').trim();

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

    const idx = sources.findIndex((s) => s.id === sourceId);
    if (idx === -1) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy nguồn cào với ID này' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const updated = {
      ...sources[idx],
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.url !== undefined ? { url: String(body.url).trim() } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.isEnabled !== undefined ? { isEnabled: Boolean(body.isEnabled) } : {}),
      updatedAt: new Date().toISOString(),
    };

    sources[idx] = updated;

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
      action: 'UPDATE_CRAWLER_SOURCE',
      targetId: sourceId,
      details: JSON.stringify(updated),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cập nhật nguồn cào thành công.',
        source: updated,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi cập nhật nguồn cào' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * DELETE /api/admin/crawler/sources/:id
 * Xóa nguồn cào
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;
  const sourceId = String(params.id || '').trim();

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
      sources = [...((defaultSources as any[]) || [])];
    }

    const initialLength = sources.length;
    sources = sources.filter((s) => s.id !== sourceId);

    if (sources.length === initialLength) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy nguồn cào với ID này' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

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
      action: 'DELETE_CRAWLER_SOURCE',
      targetId: sourceId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã xóa nguồn cào thành công.',
        deletedId: sourceId,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi xóa nguồn cào' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
