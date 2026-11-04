/**
 * Webhook Endpoint: POST /api/telegram/webhook
 * Single entry point for receiving Telegram Bot updates (commands and private interactions).
 * 
 * Security:
 * - Verified via X-Telegram-Bot-Api-Secret-Token header matching TELEGRAM_WEBHOOK_SECRET.
 */

import {
  ensureTelegramSchema,
  sendTelegramApiMessage,
  escapeHtml,
  getEffectiveTelegramConfig,
  saveTelegramWebhookMessage,
} from '../../services/telegram_service';

interface Env {
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Bot-Api-Secret-Token',
};

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(): Promise<Response> {
  return new Response(JSON.stringify({ status: 'active', message: 'Telegram Webhook is listening.' }), {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  const effectiveConfig = await getEffectiveTelegramConfig(env);
  const webhookSecret = effectiveConfig.webhook_secret;

  // 1. Xác thực Secret Token từ Telegram
  const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (webhookSecret && secretHeader !== webhookSecret.trim()) {
    return new Response(JSON.stringify({ success: false, error: 'Forbidden: Invalid secret token' }), {
      status: 403,
      headers: CORS_HEADERS,
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database not available' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  await ensureTelegramSchema(env.DB);

  let update: any;
  try {
    update = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const message = update?.message || update?.channel_post || update?.edited_message;
  if (!message) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: CORS_HEADERS });
  }

  // Luôn lưu mọi tin nhắn nhận được vào bảng telegram_messages để API get_recent_messages phục vụ Muse
  await saveTelegramWebhookMessage(env.DB, message);

  const text = (message.text || message.caption || '').trim();
  if (!text) {
    return new Response(JSON.stringify({ ok: true, saved: true }), { status: 200, headers: CORS_HEADERS });
  }

  const chatId = message.chat?.id;
  const fromUser = message.from;
  const username = fromUser?.username || '';
  const botToken = effectiveConfig.bot_token;

  if (!chatId || !botToken) {
    return new Response(JSON.stringify({ ok: true, saved: true }), { status: 200, headers: CORS_HEADERS });
  }

  // 2. Xử lý lệnh /start link_<token> (Liên kết tài khoản 1 lần, hết hạn 15 phút)
  if (text.startsWith('/start link_') || text.startsWith('/start link=')) {
    const token = text.replace(/^\/start\s+link[=_]/i, '').trim();
    if (!token) {
      await sendTelegramApiMessage(
        botToken,
        chatId,
        '⚠️ <b>Mã liên kết không hợp lệ.</b>\nVui lòng truy cập lại trang Tài khoản trên website <a href="https://codegame.shop">codegame.shop</a> để lấy link liên kết mới.',
        { parse_mode: 'HTML' }
      );
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS_HEADERS });
    }

    try {
      const tokenRecord: any = await env.DB.prepare(`
        SELECT token, user_id, expires_at, used_at 
        FROM telegram_link_tokens 
        WHERE token = ? 
        LIMIT 1
      `).bind(token).first();

      const now = new Date().toISOString();

      if (!tokenRecord || tokenRecord.used_at || tokenRecord.expires_at < now) {
        await sendTelegramApiMessage(
          botToken,
          chatId,
          '⚠️ <b>Mã liên kết đã hết hạn (quá 15 phút) hoặc đã được sử dụng.</b>\nVui lòng vào lại trang Tài khoản trên website để lấy mã liên kết mới.',
          { parse_mode: 'HTML' }
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS_HEADERS });
      }

      // Đánh dấu mã đã dùng
      await env.DB.prepare(`
        UPDATE telegram_link_tokens 
        SET used_at = datetime('now') 
        WHERE token = ?
      `).bind(token).run();

      // Cập nhật chat_id cho user trong bảng members
      const userId = tokenRecord.user_id;
      await env.DB.prepare(`
        UPDATE members 
        SET telegram_chat_id = ?, 
            telegram_username = ?, 
            telegram_linked_at = datetime('now') 
        WHERE id = ?
      `).bind(String(chatId), username, userId).run();

      // Gửi tin nhắn xác nhận kèm hướng dẫn lệnh
      const replyMsg = [
        '🎉 <b>Liên kết tài khoản thành công!</b>',
        '',
        `Tài khoản CodeGame.Shop của bạn đã được kết nối với Telegram (@${username || chatId}).`,
        'Từ bây giờ, bạn có thể nhận thông báo riêng về Giftcode mới và các sự kiện game bạn quan tâm.',
        '',
        '📌 <b>Các lệnh hỗ trợ:</b>',
        '• <code>/theodoi &lt;slug&gt;</code>: Theo dõi nhận mã game (VD: <code>/theodoi genshin-impact</code>)',
        '• <code>/huytheodoi &lt;slug&gt;</code>: Bỏ theo dõi game',
        '• <code>/danhsach</code>: Xem danh sách game đang theo dõi',
        '• <code>/dung</code>: Dừng toàn bộ thông báo riêng',
        '',
        '🔗 Truy cập website: <a href="https://codegame.shop">codegame.shop</a>',
      ].join('\n');

      await sendTelegramApiMessage(botToken, chatId, replyMsg, { parse_mode: 'HTML' });
      return new Response(JSON.stringify({ ok: true, linked: true }), { status: 200, headers: CORS_HEADERS });
    } catch (err: any) {
      console.error('[Telegram Webhook Link Error]', err);
      await sendTelegramApiMessage(
        botToken,
        chatId,
        '❌ <b>Đã có sự cố xảy ra khi liên kết tài khoản.</b> Vui lòng thử lại sau giây lát.',
        { parse_mode: 'HTML' }
      );
      return new Response(JSON.stringify({ ok: true, error: err?.message }), { status: 200, headers: CORS_HEADERS });
    }
  }

  // 3. Xử lý lệnh theo dõi game: /theodoi <slug> hoặc /follow <slug>
  if (text.startsWith('/theodoi') || text.startsWith('/follow')) {
    const parts = text.split(/\s+/);
    const slug = (parts[1] || '').toLowerCase().trim();
    if (!slug) {
      await sendTelegramApiMessage(
        botToken,
        chatId,
        '⚠️ Vui lòng nhập mã định danh (slug) của game bạn muốn theo dõi.\nVí dụ: <code>/theodoi genshin-impact</code> hoặc <code>/theodoi free-fire</code>',
        { parse_mode: 'HTML' }
      );
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS_HEADERS });
    }

    try {
      // Tìm user_id liên kết với chat_id nếu có
      const member: any = await env.DB.prepare('SELECT id FROM members WHERE telegram_chat_id = ? LIMIT 1').bind(String(chatId)).first();
      const userId = member?.id || null;

      await env.DB.prepare(`
        INSERT INTO telegram_subscriptions (user_id, chat_id, game_slug, notify_types, created_at, updated_at)
        VALUES (?, ?, ?, 'new_code,expiring,event', datetime('now'), datetime('now'))
        ON CONFLICT(chat_id, game_slug) DO UPDATE SET updated_at = datetime('now')
      `).bind(userId, String(chatId), slug).run();

      await sendTelegramApiMessage(
        botToken,
        chatId,
        `✅ <b>Đã theo dõi thành công tựa game: <code>${escapeHtml(slug)}</code>!</b>\nBạn sẽ nhận được tin nhắn riêng ngay khi có Giftcode mới hoặc sự kiện hot được duyệt trên web.`,
        { parse_mode: 'HTML' }
      );
      return new Response(JSON.stringify({ ok: true, followed: slug }), { status: 200, headers: CORS_HEADERS });
    } catch (err: any) {
      console.error('[Telegram Webhook TheoDoi Error]', err);
      return new Response(JSON.stringify({ ok: true, error: err?.message }), { status: 200, headers: CORS_HEADERS });
    }
  }

  // 4. Xử lý lệnh hủy theo dõi: /huytheodoi <slug> hoặc /unfollow <slug>
  if (text.startsWith('/huytheodoi') || text.startsWith('/unfollow')) {
    const parts = text.split(/\s+/);
    const slug = (parts[1] || '').toLowerCase().trim();
    if (!slug) {
      await sendTelegramApiMessage(
        botToken,
        chatId,
        '⚠️ Vui lòng nhập slug game bạn muốn bỏ theo dõi.\nVí dụ: <code>/huytheodoi genshin-impact</code>',
        { parse_mode: 'HTML' }
      );
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS_HEADERS });
    }

    try {
      await env.DB.prepare('DELETE FROM telegram_subscriptions WHERE chat_id = ? AND game_slug = ?').bind(String(chatId), slug).run();
      await sendTelegramApiMessage(
        botToken,
        chatId,
        `✅ Đã hủy theo dõi tựa game: <code>${escapeHtml(slug)}</code>. Bạn sẽ không nhận thông báo riêng của game này nữa.`,
        { parse_mode: 'HTML' }
      );
      return new Response(JSON.stringify({ ok: true, unfollowed: slug }), { status: 200, headers: CORS_HEADERS });
    } catch (err: any) {
      console.error('[Telegram Webhook HuyTheoDoi Error]', err);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS_HEADERS });
    }
  }

  // 5. Xử lý lệnh xem danh sách theo dõi: /danhsach hoặc /list
  if (text.startsWith('/danhsach') || text.startsWith('/list')) {
    try {
      const rows: any = await env.DB.prepare(`
        SELECT game_slug, notify_types, created_at 
        FROM telegram_subscriptions 
        WHERE chat_id = ?
        ORDER BY created_at DESC
      `).bind(String(chatId)).all();

      const items = rows.results || [];
      if (items.length === 0) {
        await sendTelegramApiMessage(
          botToken,
          chatId,
          '📋 Bạn hiện chưa theo dõi tựa game nào.\nHãy dùng lệnh <code>/theodoi &lt;slug&gt;</code> để bắt đầu nhận mã nhé!',
          { parse_mode: 'HTML' }
        );
      } else {
        const listText = items.map((it: any, i: number) => `${i + 1}. <b>${escapeHtml(it.game_slug)}</b> (${escapeHtml(it.notify_types)})`).join('\n');
        await sendTelegramApiMessage(
          botToken,
          chatId,
          `📋 <b>Danh sách game bạn đang theo dõi (${items.length}):</b>\n\n${listText}\n\n• Bỏ theo dõi: <code>/huytheodoi &lt;slug&gt;</code>\n• Dừng tất cả: <code>/dung</code>`,
          { parse_mode: 'HTML' }
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS_HEADERS });
    } catch (err: any) {
      console.error('[Telegram Webhook DanhSach Error]', err);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS_HEADERS });
    }
  }

  // 6. Xử lý lệnh dừng thông báo: /dung hoặc /stop
  if (text.startsWith('/dung') || text.startsWith('/stop')) {
    try {
      await env.DB.prepare('DELETE FROM telegram_subscriptions WHERE chat_id = ?').bind(String(chatId)).run();
      await sendTelegramApiMessage(
        botToken,
        chatId,
        '🛑 <b>Đã dừng toàn bộ thông báo riêng.</b>\nBạn có thể theo dõi lại bất cứ lúc nào bằng lệnh <code>/theodoi &lt;slug&gt;</code>.',
        { parse_mode: 'HTML' }
      );
      return new Response(JSON.stringify({ ok: true, stopped: true }), { status: 200, headers: CORS_HEADERS });
    } catch (err: any) {
      console.error('[Telegram Webhook Dung Error]', err);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS_HEADERS });
    }
  }

  // 7. Lệnh mặc định hoặc trợ giúp (/help, /start bình thường, hoặc câu hỏi lạ)
  const helpText = [
    '👋 <b>Xin chào bạn! Đây là Bot hỗ trợ CodeGame.Shop</b>',
    '',
    '📌 <b>Các lệnh bạn có thể sử dụng:</b>',
    '• <code>/theodoi &lt;slug&gt;</code>: Theo dõi nhận mã game',
    '• <code>/huytheodoi &lt;slug&gt;</code>: Bỏ theo dõi game',
    '• <code>/danhsach</code>: Xem danh sách game đang theo dõi',
    '• <code>/dung</code>: Dừng toàn bộ thông báo riêng',
    '',
    '🔗 Để liên kết tài khoản web, vui lòng vào trang Cá nhân trên <a href="https://codegame.shop">codegame.shop</a> và ấn "Liên kết Telegram".',
  ].join('\n');

  await sendTelegramApiMessage(botToken, chatId, helpText, { parse_mode: 'HTML' });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS_HEADERS });
}
