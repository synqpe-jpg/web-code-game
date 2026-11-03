/**
 * User Endpoint: /api/telegram/user
 * For logged-in users to manage Telegram linking and subscription preferences:
 * - GET /api/telegram/user: Check link status and subscriptions
 * - POST /api/telegram/user (action: generate_link): Generate 1-time 15-minute token
 * - POST /api/telegram/user (action: unlink): Cleanly remove chat_id and all subscriptions
 * - POST /api/telegram/user (action: update_preferences): Update notify types for followed games
 */

import { ensureTelegramSchema } from '../../services/telegram_service';
import { verifyToken, extractUserIdFromToken } from '../../services/auth_service';

interface Env {
  DB?: D1Database;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_BOT_TOKEN?: string;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function authenticateMember(request: Request, env: Env): Promise<any | null> {
  if (!env.DB) return null;
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    let member: any = await env.DB.prepare(
      'SELECT * FROM members WHERE session_token = ? LIMIT 1'
    ).bind(token).first();

    if (!member) {
      const { valid, userId } = await verifyToken(token, [env.JWT_SECRET, env.ADMIN_SYNC_SECRET]);
      if (valid && userId) {
        member = await env.DB.prepare(
          'SELECT * FROM members WHERE id = ? OR username = ? OR email = ? LIMIT 1'
        ).bind(userId, userId, userId).first();
      }
    }

    if (!member) {
      const extractedUserId = extractUserIdFromToken(token);
      if (extractedUserId) {
        member = await env.DB.prepare(
          'SELECT * FROM members WHERE id = ? OR username = ? OR email = ? LIMIT 1'
        ).bind(extractedUserId, extractedUserId, extractedUserId).first();
      }
    }

    return member || null;
  } catch {
    return null;
  }
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database not available' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  await ensureTelegramSchema(env.DB);

  const member = await authenticateMember(request, env);
  if (!member) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized: Vui lòng đăng nhập' }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  const isLinked = Boolean(member.telegram_chat_id && member.telegram_chat_id.trim());
  let subscriptions: any[] = [];

  if (isLinked) {
    try {
      const subsRes: any = await env.DB.prepare(`
        SELECT game_slug, notify_types, created_at, updated_at 
        FROM telegram_subscriptions 
        WHERE user_id = ? OR chat_id = ?
        ORDER BY created_at DESC
      `).bind(member.id, member.telegram_chat_id).all();
      subscriptions = subsRes.results || [];
    } catch {}
  }

  return new Response(
    JSON.stringify({
      success: true,
      is_linked: isLinked,
      telegram_username: member.telegram_username ? `@${member.telegram_username.replace(/^@/, '')}` : null,
      telegram_linked_at: member.telegram_linked_at || null,
      subscriptions,
    }),
    { status: 200, headers: CORS_HEADERS }
  );
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database not available' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  await ensureTelegramSchema(env.DB);

  const member = await authenticateMember(request, env);
  if (!member) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized: Vui lòng đăng nhập' }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const action = (body.action || '').trim();

  // ACTION 1: Sinh mã liên kết 1 lần hết hạn sau 15 phút (Mục 3.3)
  if (action === 'generate_link') {
    const botUsername = (env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
    if (!botUsername) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'bot_username_missing',
          message: 'Chưa cấu hình TELEGRAM_BOT_USERNAME trên hệ thống.',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Tạo token ngẫu nhiên an toàn 24 ký tự
    const rawArray = new Uint8Array(18);
    crypto.getRandomValues(rawArray);
    const token = Array.from(rawArray).map((b) => b.toString(16).padStart(2, '0')).join('');

    // Hết hạn sau đúng 15 phút (900.000 ms)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    try {
      await env.DB.prepare(`
        INSERT INTO telegram_link_tokens (token, user_id, created_at, expires_at, used_at)
        VALUES (?, ?, datetime('now'), ?, NULL)
      `).bind(token, member.id, expiresAt).run();

      const linkUrl = `https://t.me/${botUsername}?start=link_${token}`;

      return new Response(
        JSON.stringify({
          success: true,
          link_url: linkUrl,
          expires_at: expiresAt,
          expires_in_seconds: 900,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err: any) {
      return new Response(JSON.stringify({ success: false, error: err?.message }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  }

  // ACTION 2: Hủy liên kết Telegram (Xóa sạch chat_id và mọi subscriptions của user theo Mục 3.3)
  if (action === 'unlink') {
    try {
      const oldChatId = member.telegram_chat_id;
      await env.DB.prepare(`
        UPDATE members 
        SET telegram_chat_id = NULL, 
            telegram_username = NULL, 
            telegram_linked_at = NULL 
        WHERE id = ?
      `).bind(member.id).run();

      if (oldChatId) {
        await env.DB.prepare(
          'DELETE FROM telegram_subscriptions WHERE user_id = ? OR chat_id = ?'
        ).bind(member.id, oldChatId).run();
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Đã hủy liên kết Telegram và xóa toàn bộ đăng ký theo dõi thành công.',
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err: any) {
      return new Response(JSON.stringify({ success: false, error: err?.message }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  }

  // ACTION 3: Cập nhật tùy chọn thông báo (toggles: new_code, expiring, event)
  if (action === 'update_preferences') {
    const gameSlug = (body.game_slug || '').toLowerCase().trim();
    const notifyTypes = (body.notify_types || 'new_code,expiring,event').trim();

    if (!member.telegram_chat_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chưa liên kết tài khoản với Telegram' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    try {
      if (gameSlug) {
        await env.DB.prepare(`
          UPDATE telegram_subscriptions 
          SET notify_types = ?, updated_at = datetime('now')
          WHERE (user_id = ? OR chat_id = ?) AND game_slug = ?
        `).bind(notifyTypes, member.id, member.telegram_chat_id, gameSlug).run();
      } else {
        // Cập nhật cho tất cả các game đã theo dõi
        await env.DB.prepare(`
          UPDATE telegram_subscriptions 
          SET notify_types = ?, updated_at = datetime('now')
          WHERE user_id = ? OR chat_id = ?
        `).bind(notifyTypes, member.id, member.telegram_chat_id).run();
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Đã cập nhật tùy chọn thông báo thành công.',
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err: any) {
      return new Response(JSON.stringify({ success: false, error: err?.message }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  }

  // ACTION 4: Theo dõi hoặc bỏ theo dõi một game trực tiếp từ giao diện web
  if (action === 'toggle_follow_game') {
    const gameSlug = (body.game_slug || '').toLowerCase().trim();
    const follow = Boolean(body.follow);

    if (!gameSlug) {
      return new Response(JSON.stringify({ success: false, error: 'Thiếu game_slug' }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    if (!member.telegram_chat_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'requires_link', message: 'Vui lòng liên kết Telegram trước khi bật theo dõi game.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    try {
      if (follow) {
        await env.DB.prepare(`
          INSERT INTO telegram_subscriptions (user_id, chat_id, game_slug, notify_types, created_at, updated_at)
          VALUES (?, ?, ?, 'new_code,expiring,event', datetime('now'), datetime('now'))
          ON CONFLICT(chat_id, game_slug) DO UPDATE SET updated_at = datetime('now')
        `).bind(member.id, member.telegram_chat_id, gameSlug).run();
      } else {
        await env.DB.prepare(`
          DELETE FROM telegram_subscriptions 
          WHERE (user_id = ? OR chat_id = ?) AND game_slug = ?
        `).bind(member.id, member.telegram_chat_id, gameSlug).run();
      }

      return new Response(
        JSON.stringify({ success: true, follow, game_slug: gameSlug }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err: any) {
      return new Response(JSON.stringify({ success: false, error: err?.message }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Action không hợp lệ' }), {
    status: 400,
    headers: CORS_HEADERS,
  });
}
