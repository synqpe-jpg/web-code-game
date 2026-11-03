/**
 * Public Endpoint: GET /api/telegram/config
 * Returns basic public configuration for Telegram features:
 * - bot_username
 * - group_link
 * - enabled (true only when TELEGRAM_BOT_TOKEN and TELEGRAM_GROUP_ID are both present)
 * NEVER returns token, keys, group ID, or user chat IDs.
 */

import { getEffectiveTelegramConfig } from '../../services/telegram_service';

interface Env {
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_GROUP_ID?: string;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_GROUP_LINK?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { env } = context;

  const cfg = await getEffectiveTelegramConfig(env);
  const enabled = Boolean(cfg.bot_token && cfg.group_id);

  return new Response(
    JSON.stringify({
      success: true,
      enabled,
      bot_username: cfg.bot_username || null,
      group_link: cfg.group_link || null,
    }),
    {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    }
  );
}
