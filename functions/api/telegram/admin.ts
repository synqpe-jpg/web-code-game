/**
 * Admin Endpoint: /api/telegram/admin
 * For CodeGame Administrator to view Telegram stats, trigger test messages to TELEGRAM_ADMIN_CHAT_ID only,
 * and view/set Webhook safely.
 */

import {
  ensureTelegramSchema,
  sendTelegramApiMessage,
  getTelegramWebhookInfo,
  setTelegramWebhook,
  recordPostedLog,
  getEffectiveTelegramConfig,
  saveTelegramConfigToDb,
} from '../../services/telegram_service';
import { verifyAdminAuth } from '../../services/mission_service';

interface Env {
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_GROUP_ID?: string;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_GROUP_LINK?: string;
  TELEGRAM_ADMIN_CHAT_ID?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_NOTIFY_KEY?: string;
  ADMIN_SYNC_SECRET?: string;
  JWT_SECRET?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key',
};

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  const adminCheck = await verifyAdminAuth(request, env as any, 'TELEGRAM_FULL');
  if (!adminCheck.authorized) {
    return new Response(JSON.stringify({ success: false, error: adminCheck.error || 'Unauthorized' }), {
      status: 401,
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

  try {
    // 1. Thống kê số user liên kết
    const linkedUserRes: any = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM members WHERE telegram_chat_id IS NOT NULL AND telegram_chat_id != "" AND telegram_chat_id NOT LIKE "web:%"'
    ).first();
    const totalLinkedUsers = linkedUserRes?.count || 0;

    // 2. Thống kê số lượt theo dõi theo game (Top 20 game được theo dõi nhiều nhất)
    const subsRes: any = await env.DB.prepare(`
      SELECT game_slug, COUNT(*) as count 
      FROM telegram_subscriptions 
      GROUP BY game_slug 
      ORDER BY count DESC 
      LIMIT 20
    `).all();
    const subscriptionsByGame = subsRes.results || [];

    // 3. Số DM đã gửi trong 7 ngày gần nhất
    const dm7dRes: any = await env.DB.prepare(`
      SELECT COUNT(*) as count 
      FROM telegram_posted_log 
      WHERE kind IN ('personal_dm', 'personal_dm_digest') 
        AND posted_at >= datetime('now', '-7 days')
    `).first().catch(() => ({ count: 0 }));
    const totalDmSent7d = dm7dRes?.count || 0;

    // 4. Số DM đang chờ trong telegram_pending_dm
    const pendingDmRes: any = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM telegram_pending_dm'
    ).first().catch(() => ({ count: 0 }));
    const totalPendingDm = pendingDmRes?.count || 0;

    // 5. 20 bài đăng nhóm gần nhất
    const logsRes: any = await env.DB.prepare(`
      SELECT id, message_id, kind, ref_key, target, thread_id, content_snippet, posted_at 
      FROM telegram_posted_log 
      WHERE kind NOT IN ('personal_dm', 'personal_dm_digest')
      ORDER BY id DESC 
      LIMIT 20
    `).all();
    const recentPosts = logsRes.results || [];

    // 6. 20 tin DM gần nhất (ẩn chat_id đầy đủ của người dùng)
    const dmLogsRes: any = await env.DB.prepare(`
      SELECT id, message_id, kind, ref_key, 
        CASE 
          WHEN LENGTH(target) > 4 THEN SUBSTR(target, 1, 4) || '***'
          ELSE '***'
        END as target,
        content_snippet, posted_at 
      FROM telegram_posted_log 
      WHERE kind IN ('personal_dm', 'personal_dm_digest')
      ORDER BY id DESC 
      LIMIT 20
    `).all().catch(() => ({ results: [] }));
    const recentDms = dmLogsRes.results || [];

    // 4. Lấy cấu hình kết nối Telegram (hợp nhất từ Cloudflare Env và D1 system_settings)
    const effectiveConfig = await getEffectiveTelegramConfig(env);
    const botToken = effectiveConfig.bot_token;

    let webhookInfo: any = null;
    if (botToken) {
      webhookInfo = await getTelegramWebhookInfo(botToken);
    }

    const configStatus = {
      has_token: Boolean(botToken),
      has_group_id: Boolean(effectiveConfig.group_id),
      has_admin_chat_id: Boolean(effectiveConfig.admin_chat_id),
      has_webhook_secret: Boolean(effectiveConfig.webhook_secret),
      has_notify_key: Boolean(effectiveConfig.notify_key),
      bot_username: effectiveConfig.bot_username || null,
      group_link: effectiveConfig.group_link || null,
      admin_chat_id_configured: effectiveConfig.admin_chat_id
        ? `Đã cấu hình (${effectiveConfig.admin_chat_id.slice(0, 4)}***)`
        : 'Chưa cấu hình',
    };

    const rawConfig = {
      bot_token: effectiveConfig.bot_token
        ? `${effectiveConfig.bot_token.slice(0, 6)}***${effectiveConfig.bot_token.slice(-4)}`
        : '',
      has_bot_token: Boolean(effectiveConfig.bot_token),
      group_id: effectiveConfig.group_id,
      bot_username: effectiveConfig.bot_username,
      group_link: effectiveConfig.group_link,
      admin_chat_id: effectiveConfig.admin_chat_id,
      webhook_secret: effectiveConfig.webhook_secret,
      notify_key: effectiveConfig.notify_key,
    };

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total_linked_users: totalLinkedUsers,
          subscriptions_by_game: subscriptionsByGame,
          total_dm_sent_7d: totalDmSent7d,
          total_pending_dm: totalPendingDm,
          recent_posts: recentPosts,
          recent_dms: recentDms,
        },
        webhook_info: webhookInfo,
        config: configStatus,
        raw_config: rawConfig,
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

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  const adminCheck = await verifyAdminAuth(request, env as any, 'TELEGRAM_FULL');
  if (!adminCheck.authorized) {
    return new Response(JSON.stringify({ success: false, error: adminCheck.error || 'Unauthorized' }), {
      status: 401,
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

  let body: any = {};
  try {
    body = await request.json();
  } catch {}

  const action = (body.action || '').trim();
  const effectiveConfig = await getEffectiveTelegramConfig(env);
  const botToken = effectiveConfig.bot_token;

  // ACTION 0: Lưu Cấu Hình Kết Nối Vào D1 Database (system_settings)
  if (action === 'save_config') {
    const cfg = body.config || {};
    const ok = await saveTelegramConfigToDb(env, cfg);
    if (!ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không thể lưu cấu hình vào cơ sở dữ liệu D1.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const refreshed = await getEffectiveTelegramConfig(env);
    let webhookResult: any = null;
    if (body.auto_set_webhook && refreshed.bot_token) {
      webhookResult = await setTelegramWebhook(
        refreshed.bot_token,
        'https://codegame.shop/api/telegram/webhook',
        refreshed.webhook_secret || undefined
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã lưu cấu hình kết nối Telegram thành công!',
        webhook_result: webhookResult,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // ACTION 1: Gửi tin thử tới TELEGRAM_ADMIN_CHAT_ID (Tuyệt đối không gửi lên nhóm thật theo Mục 3.5)
  if (action === 'send_test') {
    const adminChatId = effectiveConfig.admin_chat_id;
    if (!adminChatId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'admin_chat_id_missing',
          message: 'Chưa cấu hình Chat ID cá nhân của quản trị viên (Admin Chat ID). Nút gửi thử chỉ cho phép gửi tới chat ID cá nhân.',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!botToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'bot_token_missing',
          message: 'Chưa cấu hình Telegram Bot Token.',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const testMessage = [
      '🧪 <b>[TEST] Tin Nhắn Thử Nghiệm Từ Quản Trị Viên CodeGame.Shop</b>',
      '',
      'Đây là tin nhắn kiểm tra kết nối hệ thống Telegram Bot với website codegame.shop.',
      `⏰ Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
      '✅ <b>Trạng thái:</b> Kết nối Telegram Bot hoạt động hoàn hảo!',
      '📌 <i>Lưu ý: Bạn có thể tự xóa tin nhắn thử nghiệm này sau khi kiểm tra.</i>',
    ].join('\n');

    const sendRes = await sendTelegramApiMessage(botToken, adminChatId, testMessage, { parse_mode: 'HTML' });

    if (!sendRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: sendRes.error,
          message: `Lỗi gửi tin nhắn thử nghiệm tới admin: ${sendRes.error}`,
        }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const messageId = String(sendRes.message_id || Date.now());
    await recordPostedLog(
      env.DB,
      messageId,
      'admin_test',
      `admin_test|${Date.now()}`,
      adminChatId,
      null,
      testMessage
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã gửi tin nhắn thử nghiệm thành công tới TELEGRAM_ADMIN_CHAT_ID.',
        message_id: messageId,
        target_chat_id: adminChatId,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // ACTION 2: Kích hoạt / Cập nhật Webhook (Mục 3.5)
  if (action === 'set_webhook') {
    if (!botToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chưa cấu hình TELEGRAM_BOT_TOKEN' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const customUrl = (body.webhook_url || 'https://codegame.shop/api/telegram/webhook').trim();
    const secret = (effectiveConfig.webhook_secret || env.TELEGRAM_WEBHOOK_SECRET || '').trim();

    const res = await setTelegramWebhook(botToken, customUrl, secret || undefined);
    return new Response(JSON.stringify({ success: res.ok, result: res }), {
      status: res.ok ? 200 : 400,
      headers: CORS_HEADERS,
    });
  }

  // ACTION 3: Tra cứu trạng thái Webhook hiện tại
  if (action === 'get_webhook_info') {
    if (!botToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chưa cấu hình TELEGRAM_BOT_TOKEN' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }
    const res = await getTelegramWebhookInfo(botToken);
    return new Response(JSON.stringify({ success: res.ok, result: res }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  return new Response(JSON.stringify({ success: false, error: 'Hành động không hợp lệ' }), {
    status: 400,
    headers: CORS_HEADERS,
  });
}
