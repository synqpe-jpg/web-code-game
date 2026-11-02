import { computeSha256, hasScope } from '../../services/mission_service';
import { getSettingD1, setSettingD1, invalidateSettingMemoryCache } from '../../services/d1_service';
import type { GameEventItem } from '../../../src/types/gameEvent';
import { SEED_GAME_EVENTS } from '../../../src/data/seedGameEvents';

interface Env {
  DB?: D1Database;
  ADMIN_SYNC_SECRET?: string;
  JWT_SECRET?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-API-Key, x-api-key',
};

async function verifyAuth(request: Request, env: Env): Promise<boolean> {
  const secret = env.ADMIN_SYNC_SECRET || 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';
  const syncKey = request.headers.get('X-Sync-Key') || request.headers.get('X-Admin-Key');
  if (syncKey && syncKey === secret) return true;

  const apiKeyHeader = request.headers.get('X-API-Key') || request.headers.get('x-api-key');
  const authHeader = request.headers.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  const candidateKey = (apiKeyHeader || bearerToken).trim();
  if (candidateKey) {
    if (candidateKey === secret || (env.JWT_SECRET && candidateKey === env.JWT_SECRET)) return true;
    if (candidateKey.split('.').length === 3) return true;

    if (env.DB) {
      try {
        const hash = await computeSha256(candidateKey);
        const row: any = await env.DB.prepare(
          'SELECT id, scope, is_active, expires_at FROM mission_ai_api_keys WHERE api_key_hash = ? AND is_active = 1 LIMIT 1'
        ).bind(hash).first();
        if (row) {
          if (row.expires_at) {
            const expTime = new Date(row.expires_at).getTime();
            if (!isNaN(expTime) && Date.now() > expTime) return false;
          }
          if (hasScope(row.scope, 'NEWS_FULL') || hasScope(row.scope, 'ADMIN_FULL')) {
            env.DB.prepare("UPDATE mission_ai_api_keys SET last_used_at = datetime('now') WHERE id = ?").bind(row.id).run().catch(() => {});
            return true;
          }
        }
      } catch {}
    }
  }
  return false;
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, env } = context;
  const id = String(params.id || '');

  let events: GameEventItem[] = [];
  if (env.DB) {
    try {
      const row: any = await env.DB.prepare("SELECT value FROM system_settings WHERE key = 'wcg_game_events_v1' LIMIT 1").first();
      if (row?.value) {
        events = JSON.parse(row.value);
      }
    } catch {}
  }
  if (events.length === 0) events = [...SEED_GAME_EVENTS];

  const found = events.find((e) => e.id === id);
  if (!found) {
    return new Response(JSON.stringify({ success: false, error: 'Event not found' }), {
      status: 404,
      headers: CORS_HEADERS,
    });
  }

  return new Response(JSON.stringify({ success: true, event: found }), {
    headers: CORS_HEADERS,
  });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;
  const id = String(params.id || '');

  if (!(await verifyAuth(request, env))) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  const body: any = await request.json().catch(() => ({}));
  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'DB not available' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  let events: GameEventItem[] = [];
  try {
    const row: any = await env.DB.prepare("SELECT value FROM system_settings WHERE key = 'wcg_game_events_v1' LIMIT 1").first();
    if (row?.value) events = JSON.parse(row.value);
  } catch {}
  if (events.length === 0) events = [...SEED_GAME_EVENTS];

  const index = events.findIndex((e) => e.id === id);
  if (index < 0) {
    return new Response(JSON.stringify({ success: false, error: 'Event not found' }), {
      status: 404,
      headers: CORS_HEADERS,
    });
  }

  const existing = events[index];
  const nowIso = new Date().toISOString();

  // Handle action shortcuts: APPROVE or REJECT
  if (body.action === 'APPROVE') {
    existing.status = 'PUBLISHED';
  } else if (body.action === 'REJECT') {
    existing.status = 'REJECTED';
  } else {
    // Normal field updates
    if (body.title) existing.title = String(body.title).trim();
    if (body.game_name) existing.game_name = String(body.game_name).trim();
    if (body.game_slug) existing.game_slug = String(body.game_slug).trim().toLowerCase();
    if (body.game_icon) existing.game_icon = String(body.game_icon).trim();
    if (body.source_type) existing.source_type = body.source_type;
    if (body.source_name) existing.source_name = String(body.source_name).trim();
    if (body.source_url) existing.source_url = String(body.source_url).trim();
    if (body.start_time) existing.start_time = String(body.start_time).trim();
    if (body.end_time !== undefined) existing.end_time = body.end_time ? String(body.end_time).trim() : undefined;
    if (body.is_no_end_date !== undefined) existing.is_no_end_date = Boolean(body.is_no_end_date);
    if (body.how_to_join) existing.how_to_join = String(body.how_to_join).trim();
    if (body.related_code !== undefined) existing.related_code = body.related_code ? String(body.related_code).trim().toUpperCase() : undefined;
    if (body.status) existing.status = body.status;
  }
  existing.updated_at = nowIso;
  events[index] = existing;

  await setSettingD1(env.DB, 'wcg_game_events_v1', events);
  invalidateSettingMemoryCache('wcg_game_events_v1');

  return new Response(JSON.stringify({ success: true, message: 'Updated event', event: existing }), {
    headers: CORS_HEADERS,
  });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;
  const id = String(params.id || '');

  if (!(await verifyAuth(request, env))) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'DB not available' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  let events: GameEventItem[] = [];
  try {
    const row: any = await env.DB.prepare("SELECT value FROM system_settings WHERE key = 'wcg_game_events_v1' LIMIT 1").first();
    if (row?.value) events = JSON.parse(row.value);
  } catch {}
  if (events.length === 0) events = [...SEED_GAME_EVENTS];

  events = events.filter((e) => e.id !== id);
  await setSettingD1(env.DB, 'wcg_game_events_v1', events);
  invalidateSettingMemoryCache('wcg_game_events_v1');

  // Add to deleted tombstone
  let delList: string[] = [];
  try {
    const delRow: any = await env.DB.prepare("SELECT value FROM system_settings WHERE key = 'wcg_deleted_game_events_v1' LIMIT 1").first();
    if (delRow?.value) delList = JSON.parse(delRow.value);
  } catch {}
  if (!delList.includes(id)) {
    delList.push(id);
    await setSettingD1(env.DB, 'wcg_deleted_game_events_v1', delList);
    invalidateSettingMemoryCache('wcg_deleted_game_events_v1');
  }

  return new Response(JSON.stringify({ success: true, message: `Deleted event ${id}` }), {
    headers: CORS_HEADERS,
  });
};
