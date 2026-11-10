/**
 * Endpoint: POST /api/telegram/send-pending-digest
 * Endpoint xả hàng chờ thông báo DM (Mục 2.4 & 2.5 Đợt 2).
 * Phía Muse gọi vào cữ sáng 09:30 để gửi tin tổng hợp cho người theo dõi.
 * 
 * Xác thực:
 * - Khóa API mang scope TELEGRAM_NOTIFY hoặc TELEGRAM_FULL
 * - Hoặc khóa tĩnh TELEGRAM_NOTIFY_KEY từ env/config
 * - Hoặc Master Secret (ADMIN_SYNC_SECRET)
 */

import {
  ensureTelegramSchema,
  formatDigestDm,
  recordPostedLog,
  sendTelegramApiMessage,
  getEffectiveTelegramConfig,
} from '../../services/telegram_service';
import { verifyAiKeyAuth } from '../../services/mission_service';

interface Env {
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
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

  // 2. Tra cứu toàn bộ bản ghi trong hàng chờ telegram_pending_dm
  let pendingRows: any[] = [];
  try {
    const rowsRes: any = await env.DB.prepare(`
      SELECT id, user_id, chat_id, game_slug, code, payload_json, created_at 
      FROM telegram_pending_dm 
      ORDER BY chat_id, created_at ASC
    `).all();
    pendingRows = rowsRes.results || [];
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: `Lỗi truy vấn hàng chờ: ${err.message}` }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  if (pendingRows.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        sent: 0,
        errors: 0,
        total_pending: 0,
        message: 'Hàng chờ thông báo DM hiện đang trống.',
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  // 3. Gom nhóm theo chat_id (mỗi người dùng tối đa 1 tin tổng hợp)
  const byChatId = new Map<string, any[]>();
  for (const row of pendingRows) {
    const chatId = String(row.chat_id || '').trim();
    if (!chatId) continue;
    if (!byChatId.has(chatId)) {
      byChatId.set(chatId, []);
    }
    byChatId.get(chatId)!.push(row);
  }

  let sent = 0;
  let errors = 0;

  for (const [chatId, userRows] of byChatId) {
    // Parse thông tin từng item
    const digestItems = userRows.map((r) => {
      let parsed: any = {};
      try {
        parsed = JSON.parse(r.payload_json);
      } catch {}
      return {
        game_slug: r.game_slug,
        game_name: parsed.game_name || r.game_slug,
        code: r.code,
        rewards: parsed.rewards || '',
        expiry: parsed.expiry || '',
        game_url: parsed.game_url || `https://codegame.shop/game/${r.game_slug}`,
      };
    });

    const digestText = formatDigestDm(digestItems);

    try {
      const sendRes = await sendTelegramApiMessage(botToken, chatId, digestText, { parse_mode: 'HTML' });
      if (sendRes.ok) {
        sent++;
        const msgId = String(sendRes.message_id || Date.now());

        // Ghi log chống trùng cho các mã đã gửi trong digest
        for (const it of digestItems) {
          const refKey = `${it.game_slug}|${it.code}|dm:${chatId}`;
          await recordPostedLog(
            env.DB,
            msgId,
            'personal_dm_digest',
            refKey,
            chatId,
            null,
            `Digest item: ${it.game_name} - ${it.code}`
          );
        }

        // Xóa các bản ghi đã gửi thành công khỏi hàng chờ
        const rowIds = userRows.map((r) => r.id);
        const placeholders = rowIds.map(() => '?').join(',');
        await env.DB.prepare(
          `DELETE FROM telegram_pending_dm WHERE id IN (${placeholders})`
        ).bind(...rowIds).run().catch(() => {});
      } else {
        // Gửi lỗi (bot bị chặn, chat không còn) -> ghi log và xóa khỏi hàng chờ để không tắc nghẽn
        errors++;
        console.warn(`[SendPendingDigest] Gửi thất bại tới chat_id ${chatId}: ${sendRes.error}`);
        const rowIds = userRows.map((r) => r.id);
        const placeholders = rowIds.map(() => '?').join(',');
        await env.DB.prepare(
          `DELETE FROM telegram_pending_dm WHERE id IN (${placeholders})`
        ).bind(...rowIds).run().catch(() => {});
      }
    } catch (err: any) {
      errors++;
      console.warn(`[SendPendingDigest] Exception gửi tới chat_id ${chatId}: ${err?.message}`);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      sent,
      errors,
      total_processed: pendingRows.length,
      message: `Đã xả hàng chờ: gửi thành công ${sent} tin tổng hợp (${errors} lỗi chat/bot chặn).`,
    }),
    { status: 200, headers: CORS_HEADERS }
  );
}
