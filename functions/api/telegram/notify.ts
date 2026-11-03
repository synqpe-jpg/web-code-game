/**
 * Internal Endpoint: POST /api/telegram/notify
 * Authenticated API for Muse Bot and system services to publish notifications to the Telegram group or DMs.
 * 
 * Authentication:
 * - Scoped Dynamic API Key: TELEGRAM_NOTIFY or TELEGRAM_FULL
 * - OR Static Secret: TELEGRAM_NOTIFY_KEY
 * - Master Secret (ADMIN_SYNC_SECRET)
 */

import {
  ensureTelegramSchema,
  formatTelegramPost,
  formatTelegramDm,
  generateRefKey,
  isDuplicatePost,
  recordPostedLog,
  sendTelegramApiMessage,
  isWithinVietnamNotificationWindow,
  NotifyPayload,
} from '../../services/telegram_service';
import { verifyAiKeyAuth } from '../../services/mission_service';

interface Env {
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_GROUP_ID?: string;
  TELEGRAM_NOTIFY_KEY?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key, X-Telegram-Notify-Key',
};

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
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

  // 1. Xác thực quyền gọi:
  // Ưu tiên 1: Khóa tĩnh TELEGRAM_NOTIFY_KEY
  const notifyHeader = request.headers.get('X-Telegram-Notify-Key') || '';
  const authHeader = request.headers.get('Authorization') || '';
  const apiKeyHeader = request.headers.get('X-Api-Key') || '';
  const rawKey = (notifyHeader || apiKeyHeader || authHeader.replace(/^Bearer\s+/i, '')).trim();

  let isAuthorized = false;
  let callerIdentity = 'unknown';

  if (env.TELEGRAM_NOTIFY_KEY && rawKey === env.TELEGRAM_NOTIFY_KEY.trim()) {
    isAuthorized = true;
    callerIdentity = 'Static TELEGRAM_NOTIFY_KEY';
  } else if (env.ADMIN_SYNC_SECRET && rawKey === env.ADMIN_SYNC_SECRET.trim()) {
    isAuthorized = true;
    callerIdentity = 'Master Secret';
  } else {
    // Ưu tiên 2: Khóa API mang scope TELEGRAM_NOTIFY hoặc TELEGRAM_FULL
    const authResult = await verifyAiKeyAuth(request, env.DB, env as any, 'TELEGRAM_NOTIFY');
    if (authResult.authorized) {
      isAuthorized = true;
      callerIdentity = authResult.keyRecord?.key_name || 'Scoped API Key';
    }
  }

  if (!isAuthorized) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized',
        message: 'Khóa API không hợp lệ hoặc thiếu quyền TELEGRAM_NOTIFY.',
      }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  // 2. Kiểm tra cấu hình Telegram
  const botToken = (env.TELEGRAM_BOT_TOKEN || '').trim();
  const groupId = (env.TELEGRAM_GROUP_ID || '').trim();

  if (!botToken || !groupId) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'telegram_not_configured',
        message: 'Hệ thống chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_GROUP_ID trên môi trường.',
      }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 3. Phân tích Payload
  let payload: NotifyPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'JSON payload không hợp lệ' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (!payload.game_name && !payload.title) {
    return new Response(
      JSON.stringify({ success: false, error: 'Thiếu thông tin game_name hoặc title' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 4. Kiểm tra chống trùng lặp (Deduplication qua ref_key trong 7 ngày)
  const refKey = generateRefKey(payload);
  const isDup = await isDuplicatePost(env.DB, refKey);
  if (isDup) {
    return new Response(
      JSON.stringify({
        success: true,
        ok: true,
        duplicate: true,
        ref_key: refKey,
        message: 'Bài viết đã được đăng trước đó trong 7 ngày gần nhất.',
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // 5. Gửi thông báo lên Nhóm Telegram
  const postHtml = formatTelegramPost(payload);
  const sendOptions: {
    parse_mode?: string;
    message_thread_id?: number | null;
  } = {
    parse_mode: 'HTML',
  };

  if (typeof payload.thread_id === 'number' && !isNaN(payload.thread_id)) {
    sendOptions.message_thread_id = payload.thread_id;
  }

  const groupRes = await sendTelegramApiMessage(botToken, groupId, postHtml, sendOptions);

  if (!groupRes.ok) {
    // Báo lỗi rõ ràng nếu sai thread_id theo mục 3.2
    if (groupRes.error?.includes('message thread not found')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'thread_not_found',
          message: `Thread ID (${payload.thread_id}) không tồn tại trong nhóm Telegram.`,
          details: groupRes.error,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'send_failed',
        message: `Lỗi gửi tin nhắn Telegram: ${groupRes.error}`,
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  const messageId = String(groupRes.message_id || Date.now());

  // Ghi log vào telegram_posted_log
  await recordPostedLog(
    env.DB,
    messageId,
    payload.kind || 'group_post',
    refKey,
    groupId,
    payload.thread_id,
    postHtml
  );

  // 6. Gửi DM cho người theo dõi nếu có danh sách target_chat_ids (Mục 3.4)
  const dmResults: { sent: number; skipped: number } = { sent: 0, skipped: 0 };
  if (Array.isArray(payload.target_chat_ids) && payload.target_chat_ids.length > 0) {
    if (isWithinVietnamNotificationWindow()) {
      const dmHtml = formatTelegramDm(payload);
      for (const targetChatId of payload.target_chat_ids) {
        if (!targetChatId) continue;
        try {
          const dmRes = await sendTelegramApiMessage(botToken, targetChatId, dmHtml, { parse_mode: 'HTML' });
          if (dmRes.ok) {
            dmResults.sent++;
            await recordPostedLog(
              env.DB,
              String(dmRes.message_id || Date.now()),
              'personal_dm',
              `${refKey}|dm|${targetChatId}`,
              targetChatId,
              null,
              dmHtml
            );
          } else {
            dmResults.skipped++;
          }
        } catch {
          dmResults.skipped++;
        }
      }
    } else {
      dmResults.skipped = payload.target_chat_ids.length;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      ok: true,
      duplicate: false,
      ref_key: refKey,
      message_ids: [messageId],
      dm_sent: dmResults.sent,
      caller: callerIdentity,
      message: 'Đăng thông báo lên nhóm Telegram thành công.',
    }),
    { status: 200, headers: CORS_HEADERS }
  );
}
