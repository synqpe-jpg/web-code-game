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

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

function extractTargetKey(params: any, url: URL): string {
  let targetKey = String(params?.key || url.searchParams.get('key') || '').trim();
  if (!targetKey) {
    const parts = url.pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart !== 'content') {
      targetKey = lastPart;
    }
  }
  return targetKey;
}

/**
 * GET /api/admin/content/:key
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'NEWS_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    const targetKey = extractTargetKey(params, new URL(request.url));
    if (!targetKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu key nội dung (:key).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const rawContent = await getSettingD1<any[]>(env.DB, 'wcg_admin_content_v4').catch(() => []);
    const items: any[] = Array.isArray(rawContent) ? rawContent : [];

    const found = items.find((c) => String(c?.key) === targetKey);
    if (!found) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy nội dung có key "${targetKey}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ success: true, item: found }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy nội dung: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * PUT /api/admin/content/:key
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'NEWS_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    const targetKey = extractTargetKey(params, new URL(request.url));
    if (!targetKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu key nội dung (:key).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON payload required' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const rawContent = await getSettingD1<any[]>(env.DB, 'wcg_admin_content_v4').catch(() => []);
    const list: any[] = Array.isArray(rawContent) ? rawContent : [];

    const idx = list.findIndex((c) => String(c?.key) === targetKey);
    let record: any;

    if (idx !== -1) {
      record = {
        ...list[idx],
        ...body,
        key: targetKey,
        updatedAt: new Date().toISOString(),
      };
      list[idx] = record;
    } else {
      record = {
        ...body,
        id: `cnt_${Date.now()}`,
        key: targetKey,
        title: body.title || targetKey,
        content: body.content || '',
        type: body.type || 'TEXT',
        updatedAt: new Date().toISOString(),
      };
      list.unshift(record);
    }

    await setSettingD1(env.DB, 'wcg_admin_content_v4', list);

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'UPDATE_CONTENT',
      targetId: targetKey,
      details: {
        key: targetKey,
        title: record.title,
        type: record.type,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã cập nhật khối nội dung "${targetKey}" thành công.`,
        item: record,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi cập nhật nội dung: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
