/**
 * Endpoint: POST /api/telegram/notify-followers
 * Endpoint gửi thông báo mã mới cho người theo dõi game (chuẩn Đợt 2).
 * Phía Muse gọi sau khi cào mã mới lên web thành công.
 * 
 * Xác thực:
 * - Khóa API mang scope TELEGRAM_NOTIFY hoặc TELEGRAM_FULL
 * - Hoặc khóa tĩnh TELEGRAM_NOTIFY_KEY từ env/config
 * - Hoặc Master Secret (ADMIN_SYNC_SECRET)
 */

import {
  ensureTelegramSchema,
  formatFollowerDm,
  isDuplicatePost,
  recordPostedLog,
  sendTelegramApiMessage,
  isWithinVietnamNotificationWindow,
  getEffectiveTelegramConfig,
  normalizeCodes,
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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key, X-Telegram-Notify-Key, X-Sync-Key',
};

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  if (!env.DB) {
    return new Response(JSON.stringify({ ok: false, error: 'Database not available' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  await ensureTelegramSchema(env.DB);

  // 1. Xác thực quyền gọi
  const effectiveConfig = await getEffectiveTelegramConfig(env);
  const notifyKey = effectiveConfig.notify_key;

  const notifyHeader = request.headers.get('X-Telegram-Notify-Key') || '';
  const authHeader = request.headers.get('Authorization') || '';
  const apiKeyHeader = request.headers.get('X-Api-Key') || '';
  const syncHeader = request.headers.get('X-Sync-Key') || '';
  const rawKey = (notifyHeader || apiKeyHeader || syncHeader || authHeader.replace(/^Bearer\s+/i, '')).trim();

  let isAuthorized = false;

  if (notifyKey && rawKey === notifyKey.trim()) {
    isAuthorized = true;
  } else if (env.ADMIN_SYNC_SECRET && rawKey === env.ADMIN_SYNC_SECRET.trim()) {
    isAuthorized = true;
  } else {
    const authResult = await verifyAiKeyAuth(request, env.DB, env as any, 'TELEGRAM_NOTIFY');
    if (authResult.authorized) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Unauthorized: Khóa API không hợp lệ hoặc thiếu quyền TELEGRAM_NOTIFY.',
      }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const botToken = effectiveConfig.bot_token;
  if (!botToken) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'telegram_not_configured: Chưa cấu hình TELEGRAM_BOT_TOKEN.',
      }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 2. Đọc và kiểm tra payload
  let payload: any = {};
  try {
    payload = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid JSON payload' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const gameSlug = (payload.game_slug || '').toLowerCase().trim();
  const gameName = (payload.game_name || '').trim();
  let rawCodes = Array.isArray(payload.codes) ? payload.codes : [];

  if (!gameSlug || rawCodes.length === 0) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Thiếu game_slug hoặc danh sách codes' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Giới hạn tối đa 20 mã cho 1 lần gọi
  let truncated = false;
  if (rawCodes.length > 20) {
    rawCodes = rawCodes.slice(0, 20);
    truncated = true;
  }

  const normalizedCodes = normalizeCodes(rawCodes).filter((c) => Boolean(c.code));
  if (normalizedCodes.length === 0) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Không có mã hợp lệ trong danh sách codes' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 3. Tra cứu người đăng ký theo dõi tựa game này
  let subscribers: any[] = [];
  try {
    const subsRes: any = await env.DB.prepare(`
      SELECT user_id, chat_id, notify_types 
      FROM telegram_subscriptions 
      WHERE game_slug = ?
    `).bind(gameSlug).all();
    subscribers = subsRes.results || [];
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: `Lỗi truy vấn người theo dõi: ${err.message}` }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  if (subscribers.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        sent: 0,
        held: 0,
        skipped: 0,
        duplicate: false,
        truncated,
        message: 'Chưa có người dùng nào đăng ký theo dõi tựa game này.',
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // 4. Lọc người đủ 3 điều kiện:
  // (a) Đã liên kết: chat_id hợp lệ (không null, không rỗng, không bắt đầu bằng 'web:')
  // (b) Đang theo dõi game đó (đã có trong danh sách subscribers)
  // (c) Loại new_code đang bật trong notify_types
  let skipped = 0;
  const eligibleSubscribers: Array<{ user_id?: string; chat_id: string }> = [];

  for (const sub of subscribers) {
    const chatId = String(sub.chat_id || '').trim();
    const notifyTypes = String(sub.notify_types || '').toLowerCase();

    // Điều kiện 1: chat_id hợp lệ
    const isTelegramLinked = Boolean(chatId && !chatId.startsWith('web:'));
    // Điều kiện 3: new_code đang bật
    const isNewCodeEnabled = notifyTypes.includes('new_code');

    if (isTelegramLinked && isNewCodeEnabled) {
      eligibleSubscribers.push({ user_id: sub.user_id, chat_id: chatId });
    } else {
      skipped++;
    }
  }

  if (eligibleSubscribers.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        sent: 0,
        held: 0,
        skipped,
        duplicate: false,
        truncated,
        message: 'Không có người theo dõi nào thỏa mãn điều kiện nhận DM (thiếu chat_id Telegram hoặc đã tắt new_code).',
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // 5. Kiểm tra chống trùng lặp từng cặp (game + mã + chat_id)
  // ref_key dạng: <game_slug>|<mã>|dm:<chat_id>
  let totalCandidates = 0;
  let duplicateCount = 0;
  const toProcess: Array<{
    user_id?: string;
    chat_id: string;
    codesToSend: typeof normalizedCodes;
  }> = [];

  for (const sub of eligibleSubscribers) {
    const unpostedCodes: typeof normalizedCodes = [];
    for (const c of normalizedCodes) {
      totalCandidates++;
      const refKey = `${gameSlug}|${c.code}|dm:${sub.chat_id}`;
      const isDup = await isDuplicatePost(env.DB, refKey);
      if (isDup) {
        duplicateCount++;
      } else {
        unpostedCodes.push(c);
      }
    }
    if (unpostedCodes.length > 0) {
      toProcess.push({
        user_id: sub.user_id,
        chat_id: sub.chat_id,
        codesToSend: unpostedCodes,
      });
    }
  }

  // Nếu tất cả các cặp đều đã được gửi trước đó -> duplicate = true
  if (totalCandidates > 0 && duplicateCount === totalCandidates) {
    return new Response(
      JSON.stringify({
        ok: true,
        sent: 0,
        held: 0,
        skipped,
        duplicate: true,
        truncated,
        message: 'Toàn bộ mã này đã được gửi DM trước đó tới người theo dõi (chống gửi trùng).',
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // 6. Kiểm tra khung giờ 09:00 - 22:00 giờ Việt Nam
  const inWindow = isWithinVietnamNotificationWindow();

  if (!inWindow) {
    // Ngoài khung giờ: Lưu vào telegram_pending_dm để xả vào digest sáng
    let held = 0;
    for (const item of toProcess) {
      for (const c of item.codesToSend) {
        const payloadJson = JSON.stringify({
          game_slug: gameSlug,
          game_name: gameName,
          code: c.code,
          rewards: c.rewards || '',
          expiry: c.expiry || '',
          game_url: payload.game_url || `https://codegame.shop/game/${gameSlug}`,
          source_name: payload.source_name || '',
        });

        await env.DB.prepare(`
          INSERT INTO telegram_pending_dm (user_id, chat_id, game_slug, code, payload_json, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `).bind(item.user_id || null, item.chat_id, gameSlug, c.code, payloadJson).run().catch(() => {});
        held++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent: 0,
        held,
        skipped,
        duplicate: false,
        truncated,
        message: `Ngoài khung giờ 09:00–22:00 VN: Đã đưa ${held} thông báo DM vào hàng chờ telegram_pending_dm.`,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // 7. Trong khung giờ: Tiến hành gửi DM ngay
  let sent = 0;
  for (const item of toProcess) {
    const dmText = formatFollowerDm({
      game_name: gameName,
      game_slug: gameSlug,
      codes: item.codesToSend,
      game_url: payload.game_url || `https://codegame.shop/game/${gameSlug}`,
    });

    const res = await sendTelegramApiMessage(botToken, item.chat_id, dmText, { parse_mode: 'HTML' });
    if (res.ok) {
      sent++;
      const msgId = String(res.message_id || Date.now());
      // Ghi log chống trùng cho từng mã đã gửi
      for (const c of item.codesToSend) {
        const refKey = `${gameSlug}|${c.code}|dm:${item.chat_id}`;
        await recordPostedLog(
          env.DB,
          msgId,
          'personal_dm',
          refKey,
          item.chat_id,
          null,
          dmText
        );
      }
    } else {
      skipped++;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      sent,
      held: 0,
      skipped,
      duplicate: false,
      truncated,
      message: `Đã gửi thành công ${sent} tin nhắn DM thông báo mã mới tới người theo dõi.`,
    }),
    { status: 200, headers: CORS_HEADERS }
  );
}
