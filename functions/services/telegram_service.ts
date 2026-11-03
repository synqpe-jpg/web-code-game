/**
 * Telegram Service for CodeGame.Shop
 * Centralized service for Telegram Bot API communication, D1 schema maintenance,
 * deduplication, message chunking, and strict HTML formatting.
 */

export interface TelegramConfig {
  botToken?: string;
  groupId?: string;
  botUsername?: string;
  groupLink?: string;
  webhookSecret?: string;
  adminChatId?: string;
  notifyKey?: string;
}

export interface NotifyCodeItem {
  code: string;
  rewards?: string;
}

export interface NotifyPayload {
  kind: 'new_code' | 'event' | 'news' | 'digest';
  game_slug: string;
  game_name: string;
  title?: string;
  codes?: NotifyCodeItem[];
  expiry?: string | null;
  how_to?: string | null;
  game_url?: string;
  source_name?: string;
  source_url?: string;
  thread_id?: number | null;
  target_chat_ids?: string[]; // Cho thông báo riêng (DM)
}

let schemaChecked = false;

/**
 * Khởi tạo 3 bảng D1 cho tính năng Telegram theo tài liệu đặc tả:
 * 1. telegram_subscriptions
 * 2. telegram_posted_log
 * 3. telegram_link_tokens
 */
export async function ensureTelegramSchema(db: D1Database): Promise<void> {
  if (schemaChecked) return;
  try {
    // 1. telegram_subscriptions
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS telegram_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        chat_id TEXT NOT NULL,
        game_slug TEXT NOT NULL,
        notify_types TEXT NOT NULL DEFAULT 'new_code,expiring,event',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});

    await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_tg_sub_chat_slug ON telegram_subscriptions(chat_id, game_slug);').run().catch(() => {});
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_tg_sub_slug ON telegram_subscriptions(game_slug);').run().catch(() => {});
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_tg_sub_user ON telegram_subscriptions(user_id);').run().catch(() => {});

    // 2. telegram_posted_log
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS telegram_posted_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        ref_key TEXT NOT NULL,
        target TEXT NOT NULL,
        thread_id INTEGER,
        content_snippet TEXT,
        posted_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});

    await db.prepare('CREATE INDEX IF NOT EXISTS idx_tg_posted_ref_key ON telegram_posted_log(ref_key);').run().catch(() => {});
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_tg_posted_posted_at ON telegram_posted_log(posted_at);').run().catch(() => {});

    // 3. telegram_link_tokens
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS telegram_link_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        used_at TEXT
      );
    `).run().catch(() => {});

    await db.prepare('CREATE INDEX IF NOT EXISTS idx_tg_tokens_user ON telegram_link_tokens(user_id);').run().catch(() => {});
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_tg_tokens_expires ON telegram_link_tokens(expires_at);').run().catch(() => {});

    // Bổ sung các cột liên kết Telegram vào bảng members nếu chưa có
    try {
      const colsQuery: any = await db.prepare("PRAGMA table_info('members');").all();
      const cols = new Set((colsQuery.results || []).map((r: any) => r.name));
      if (!cols.has('telegram_chat_id')) {
        await db.prepare('ALTER TABLE members ADD COLUMN telegram_chat_id TEXT;').run().catch(() => {});
      }
      if (!cols.has('telegram_username')) {
        await db.prepare('ALTER TABLE members ADD COLUMN telegram_username TEXT;').run().catch(() => {});
      }
      if (!cols.has('telegram_linked_at')) {
        await db.prepare('ALTER TABLE members ADD COLUMN telegram_linked_at TEXT;').run().catch(() => {});
      }
    } catch {}

    schemaChecked = true;
  } catch (err) {
    console.warn('[ensureTelegramSchema error]', err);
  }
}

/**
 * Thoát ký tự HTML nhạy cảm trong văn bản thường
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Định dạng bài đăng Telegram theo quy chuẩn bắt buộc của Mục 4
 */
export function formatTelegramPost(payload: NotifyPayload): string {
  const { kind, game_name, title, codes, expiry, how_to, game_url, source_name, source_url } = payload;
  const escapedGame = escapeHtml(game_name || 'Game');
  const safeGameUrl = game_url || `https://codegame.shop/${payload.game_slug ? `code/${payload.game_slug}` : ''}`;

  if (kind === 'event') {
    // Mẫu bài Sự Kiện lên nhóm:
    // 📅 <Tên game> — <Tên sự kiện>
    // <1–2 dòng cách tham gia, diễn đạt lại, không chép nguyên văn>
    // ⏰ Thời gian: <thời gian, chỉ khi có>
    // 🔗 Xem mã <Tên game>: <link trang mã đúng game>
    // 📌 Nguồn: <tên nguồn + link nguồn>
    const eventTitle = escapeHtml(title || 'Sự Kiện Mới');
    const lines: string[] = [`📅 <b>${escapedGame} — ${eventTitle}</b>`];
    if (how_to && how_to.trim()) {
      lines.push(escapeHtml(how_to.trim()));
    }
    if (expiry && expiry.trim()) {
      lines.push(`⏰ Thời gian: ${escapeHtml(expiry.trim())}`);
    }
    lines.push(`🔗 Xem mã ${escapedGame}: <a href="${safeGameUrl}">${safeGameUrl}</a>`);
    if (source_name && source_name.trim()) {
      const srcName = escapeHtml(source_name.trim());
      if (source_url && source_url.trim()) {
        lines.push(`📌 Nguồn: <a href="${source_url.trim()}">${srcName}</a>`);
      } else {
        lines.push(`📌 Nguồn: ${srcName}`);
      }
    }
    return lines.join('\n');
  }

  if (kind === 'digest') {
    // Mẫu Digest:
    // • <Tên game> — <MÃ> (hạn <ngày>): <link trang mã>
    const codeList = (codes || []).map((c) => `<code>${escapeHtml(c.code)}</code>`).join(', ');
    const expiryStr = expiry ? ` (hạn ${escapeHtml(expiry)})` : '';
    return `• <b>${escapedGame}</b> — ${codeList || 'Có Giftcode mới'}${expiryStr}: <a href="${safeGameUrl}">${safeGameUrl}</a>`;
  }

  // Mặc định: Bài Mã Mới lên nhóm
  // 🎮 <Tên game> — <Tên sự kiện>
  // <code><MÃ 1></code> — <thưởng ngắn gọn>
  // <code><MÃ 2></code> — <thưởng ngắn gọn>
  // ⏰ Hạn: <ngày, chỉ khi có>
  // 👉 <cách nhận 1 dòng, chỉ khi có>
  // 🔗 Xem tất cả mã <Tên game>: <link trang mã đúng game>
  // 📌 Nguồn: <tên nguồn>
  const subTitle = title && title.trim() ? ` — ${escapeHtml(title.trim())}` : '';
  const lines: string[] = [`🎮 <b>${escapedGame}${subTitle}</b>`];

  if (codes && codes.length > 0) {
    for (const c of codes) {
      if (!c.code) continue;
      const codeHtml = `<code>${escapeHtml(c.code.trim())}</code>`;
      const rewardHtml = c.rewards && c.rewards.trim() ? ` — ${escapeHtml(c.rewards.trim())}` : '';
      lines.push(`${codeHtml}${rewardHtml}`);
    }
  }

  if (expiry && expiry.trim()) {
    lines.push(`⏰ Hạn: ${escapeHtml(expiry.trim())}`);
  }
  if (how_to && how_to.trim()) {
    lines.push(`👉 ${escapeHtml(how_to.trim())}`);
  }
  lines.push(`🔗 Xem tất cả mã ${escapedGame}: <a href="${safeGameUrl}">${safeGameUrl}</a>`);
  if (source_name && source_name.trim()) {
    lines.push(`📌 Nguồn: ${escapeHtml(source_name.trim())}`);
  }

  return lines.join('\n');
}

/**
 * Định dạng tin nhắn DM gửi riêng cho người theo dõi (ngắn gọn hơn bài nhóm)
 */
export function formatTelegramDm(payload: NotifyPayload): string {
  const { game_name, title, codes, expiry, game_url } = payload;
  const escapedGame = escapeHtml(game_name || 'Game');
  const safeGameUrl = game_url || `https://codegame.shop/${payload.game_slug ? `code/${payload.game_slug}` : ''}`;

  const lines: string[] = [`🔔 <b>Thông báo từ CodeGame.Shop</b>`, `🎮 <b>${escapedGame}</b>`];
  if (title && title.trim()) {
    lines.push(`⚡ ${escapeHtml(title.trim())}`);
  }
  if (codes && codes.length > 0) {
    for (const c of codes) {
      if (c.code) {
        lines.push(`Mã mới: <code>${escapeHtml(c.code.trim())}</code>`);
      }
    }
  }
  if (expiry && expiry.trim()) {
    lines.push(`⏰ Hạn dùng: ${escapeHtml(expiry.trim())}`);
  }
  lines.push(`👉 Xem chi tiết và nhận mã: <a href="${safeGameUrl}">${safeGameUrl}</a>`);
  return lines.join('\n');
}

/**
 * Tạo ref_key chống trùng lặp theo quy ước của Mục 3.2
 */
export function generateRefKey(payload: NotifyPayload): string {
  const slug = (payload.game_slug || 'general').toLowerCase().trim();
  if (payload.kind === 'digest') {
    const today = new Date().toISOString().slice(0, 10);
    return `${slug}|digest|${today}`;
  }
  if (payload.codes && payload.codes.length > 0) {
    const codeList = payload.codes.map((c) => c.code.trim().toUpperCase()).sort().join(',');
    return `${slug}|${codeList}|${payload.title ? payload.title.trim().toLowerCase() : ''}`;
  }
  return `${slug}|event|${payload.title ? payload.title.trim().toLowerCase() : ''}`;
}

/**
 * Kiểm tra xem bài đăng đã tồn tại trong 7 ngày gần nhất chưa
 */
export async function isDuplicatePost(db: D1Database, refKey: string): Promise<boolean> {
  try {
    const row: any = await db.prepare(`
      SELECT id FROM telegram_posted_log 
      WHERE ref_key = ? 
        AND posted_at >= datetime('now', '-7 days')
      LIMIT 1
    `).bind(refKey).first();
    return Boolean(row && row.id);
  } catch (err) {
    console.warn('[isDuplicatePost check error]', err);
    return false;
  }
}

/**
 * Ghi log bài đăng vào bảng telegram_posted_log
 */
export async function recordPostedLog(
  db: D1Database,
  messageId: string,
  kind: string,
  refKey: string,
  target: string,
  threadId?: number | null,
  snippet?: string
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO telegram_posted_log (message_id, kind, ref_key, target, thread_id, content_snippet, posted_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      messageId,
      kind,
      refKey,
      target,
      threadId ?? null,
      snippet ? snippet.slice(0, 200) : null
    ).run();
  } catch (err) {
    console.error('[recordPostedLog error]', err);
  }
}

/**
 * Tách tin nhắn thành nhiều phần nếu vượt quá 4096 ký tự
 */
export function chunkMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];
  const lines = text.split('\n');
  const chunks: string[] = [];
  let currentChunk = '';

  for (const line of lines) {
    if ((currentChunk + '\n' + line).length > maxLen) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n' + line : line;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

/**
 * Gửi tin nhắn qua Telegram Bot API kèm thử lại 1 lần duy nhất khi lỗi mạng
 */
export async function sendTelegramApiMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  options?: {
    parse_mode?: string;
    message_thread_id?: number | null;
    disable_web_page_preview?: boolean;
  }
): Promise<{ ok: boolean; message_id?: number; error?: string }> {
  if (!botToken || !chatId) {
    return { ok: false, error: 'Thiếu TELEGRAM_BOT_TOKEN hoặc chatId' };
  }

  const chunks = chunkMessage(text);
  let lastMessageId: number | undefined;

  for (const chunk of chunks) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const body: Record<string, any> = {
      chat_id: chatId,
      text: chunk,
      parse_mode: options?.parse_mode || 'HTML',
      disable_web_page_preview: options?.disable_web_page_preview ?? false,
    };
    if (typeof options?.message_thread_id === 'number') {
      body.message_thread_id = options.message_thread_id;
    }

    let success = false;
    let lastError = '';

    // Thử gửi (tối đa 2 lần = 1 lần chính + 1 lần thử lại khi lỗi mạng)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data: any = await res.json();
        if (data.ok && data.result) {
          success = true;
          lastMessageId = data.result.message_id;
          break;
        } else {
          lastError = data.description || `HTTP ${res.status}`;
          // Nếu lỗi là do sai thread_id, không thử lại
          if (lastError.includes('message thread not found')) {
            break;
          }
        }
      } catch (err: any) {
        lastError = err?.message || 'Lỗi kết nối Telegram API';
      }
    }

    if (!success) {
      return { ok: false, error: lastError };
    }
  }

  return { ok: true, message_id: lastMessageId };
}

/**
 * Lấy thông tin trạng thái Webhook hiện tại từ Telegram
 */
export async function getTelegramWebhookInfo(botToken: string): Promise<any> {
  if (!botToken) return { ok: false, error: 'Thiếu bot token' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Lỗi kết nối getWebhookInfo' };
  }
}

/**
 * Đăng ký hoặc cập nhật Webhook trên Telegram Bot API
 */
export async function setTelegramWebhook(
  botToken: string,
  webhookUrl: string,
  secretToken?: string
): Promise<any> {
  if (!botToken) return { ok: false, error: 'Thiếu bot token' };
  try {
    const body: Record<string, any> = {
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    };
    if (secretToken) {
      body.secret_token = secretToken;
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Lỗi kết nối setWebhook' };
  }
}

/**
 * Kiểm tra khung giờ gửi DM (09:00 - 22:00 giờ Việt Nam = UTC+7)
 */
export function isWithinVietnamNotificationWindow(): boolean {
  const now = new Date();
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const hour = vnTime.getUTCHours();
  return hour >= 9 && hour < 22;
}

/**
 * Legacy Store & Order Notification Compatibility
 */
export interface TelegramEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DB?: D1Database;
}

const DEFAULT_OWNER_CHAT_ID = '7791142901';

async function getTelegramCredentials(env: TelegramEnv): Promise<{ botToken: string; chatId: string }> {
  let botToken = (env.TELEGRAM_BOT_TOKEN || '').trim();
  let chatId = (env.TELEGRAM_CHAT_ID || '').trim() || DEFAULT_OWNER_CHAT_ID;

  if (!botToken && env.DB) {
    try {
      const stmt = env.DB.prepare("SELECT value FROM system_settings WHERE key = 'wcg_news_schedule_config_v1' LIMIT 1");
      const row: any = await stmt.first();
      if (row?.value) {
        const cfg = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        if (cfg?.telegramBotToken) botToken = String(cfg.telegramBotToken).trim();
        if (cfg?.telegramChatId) chatId = String(cfg.telegramChatId).trim() || chatId;
      }
    } catch (e: any) {
      console.warn('[TelegramService] Cannot load config from D1:', e?.message);
    }
  }

  return { botToken, chatId };
}

export async function sendTelegramMessage(env: TelegramEnv, message: string): Promise<boolean> {
  try {
    const { botToken, chatId } = await getTelegramCredentials(env);
    if (!botToken || !chatId) {
      return false;
    }

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    return res.ok;
  } catch (err: any) {
    console.warn('[TelegramService] Failed to send telegram message:', err?.message);
    return false;
  }
}

export async function sendOutOfStockAlert(
  env: TelegramEnv,
  payload: { productId: string; productTitle: string; remainingStock: number }
): Promise<boolean> {
  const timeStr = new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const msg = `🚨 <b>[CẢNH BÁO HẾT HÀNG TRONG KHO]</b>
📦 <b>Sản phẩm:</b> ${payload.productTitle}
🆔 <b>Mã định danh:</b> <code>${payload.productId}</code>
⚠️ <b>Tồn kho khả dụng:</b> 0 mã (HẾT HÀNG)
⏰ <b>Thời điểm:</b> ${timeStr} (GMT+7)

👉 <i>Vui lòng truy cập trang Quản trị Admin để bổ sung tồn kho mới!</i>`;

  return sendTelegramMessage(env, msg);
}

export async function sendNewOrderAlert(
  env: TelegramEnv,
  payload: {
    orderId: string;
    productTitle: string;
    quantity: number;
    totalAmount: number;
    buyerName: string;
  }
): Promise<boolean> {
  const timeStr = new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const formattedAmount = Number(payload.totalAmount || 0).toLocaleString('vi-VN');
  const msg = `💰 <b>[ĐƠN HÀNG MỚI THÀNH CÔNG]</b>
🧾 <b>Mã đơn:</b> <code>${payload.orderId}</code>
📦 <b>Sản phẩm:</b> ${payload.productTitle} (x${payload.quantity})
💵 <b>Tổng thanh toán:</b> ${formattedAmount}đ
👤 <b>Khách hàng:</b> ${payload.buyerName}
⏰ <b>Thời điểm:</b> ${timeStr} (GMT+7)`;

  return sendTelegramMessage(env, msg);
}
