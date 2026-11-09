import { ensureSchemaUpgrades, logAdminAudit } from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';
import {
  ensureNotificationTablesD1,
  dispatchEmail,
  buildCyberpunkEmailHtml,
  EmailProviderConfig,
  DEFAULT_EMAIL_CONFIG,
} from '../../notifications/_emailHelper';

interface Env {
  DB: D1Database;
  GAME_DATA_KV?: KVNamespace;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

const EMAIL_CONFIG_KEY = 'wcg_email_provider_config';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * POST /api/admin/notifications/broadcast
 * Gửi email chiến dịch thông báo hàng loạt cho subscribers hoặc danh sách email tùy chọn
 * Body: {
 *   subject: string;
 *   title: string;
 *   description: string;
 *   type?: 'CODE_DROP' | 'GIVEAWAY' | 'FLASH_SALE' | 'BROADCAST' | 'TEST';
 *   gameName?: string;
 *   gameIconUrl?: string;
 *   codes?: Array<{ code: string; rewards?: string; expires?: string }>;
 *   ctaText?: string;
 *   ctaUrl?: string;
 *   targetAudience?: 'ALL_ACTIVE_SUBSCRIBERS' | 'FOLLOWERS_OF_GAME' | 'CUSTOM_EMAILS';
 *   customEmails?: string[];
 *   gameSlug?: string;
 * }
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'NOTIFICATIONS_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền NOTIFICATIONS_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    await ensureNotificationTablesD1(env.DB);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Body JSON không hợp lệ' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const subject = String(body.subject || '').trim();
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();

    if (!subject || !title || !description) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tiêu đề email (subject), tiêu đề nội dung (title) và mô tả (description) là bắt buộc.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Lấy cấu hình email provider từ D1 hoặc KV
    let emailConfig: EmailProviderConfig = { ...DEFAULT_EMAIL_CONFIG };
    const settingRow = await env.DB.prepare('SELECT value FROM system_settings WHERE key = ?')
      .bind(EMAIL_CONFIG_KEY)
      .first<any>();

    if (settingRow && settingRow.value) {
      try {
        emailConfig = { ...emailConfig, ...JSON.parse(settingRow.value) };
      } catch {}
    } else if (env.GAME_DATA_KV) {
      const rawKv = await env.GAME_DATA_KV.get(EMAIL_CONFIG_KEY);
      if (rawKv) {
        try {
          emailConfig = { ...emailConfig, ...JSON.parse(rawKv) };
        } catch {}
      }
    }

    if (!emailConfig.isEnabled) {
      return new Response(
        JSON.stringify({ success: false, error: 'Hệ thống gửi email đang tạm tắt trong Cài đặt Admin.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!emailConfig.apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chưa cấu hình API Key cho nhà cung cấp email (Resend / Brevo).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 2. Xác định danh sách email người nhận
    let recipientEmails: string[] = [];
    const targetAudience = body.targetAudience || 'ALL_ACTIVE_SUBSCRIBERS';

    if (targetAudience === 'CUSTOM_EMAILS' && Array.isArray(body.customEmails)) {
      recipientEmails = body.customEmails.map((e: any) => String(e).trim().toLowerCase()).filter(Boolean);
    } else if (targetAudience === 'FOLLOWERS_OF_GAME' && body.gameSlug) {
      const slug = String(body.gameSlug).trim().toLowerCase();
      const rows = await env.DB.prepare("SELECT email, subscribed_games FROM email_subscribers WHERE is_active = 1").all<any>();
      recipientEmails = (rows?.results || [])
        .filter((r: any) => {
          try {
            const games = JSON.parse(r.subscribed_games || '[]');
            return Array.isArray(games) && games.map((g: string) => g.toLowerCase()).includes(slug);
          } catch {
            return false;
          }
        })
        .map((r: any) => r.email);
    } else {
      // Mặc định: Gửi cho tất cả active subscribers
      const rows = await env.DB.prepare("SELECT email FROM email_subscribers WHERE is_active = 1").all<any>();
      recipientEmails = (rows?.results || []).map((r: any) => r.email);
    }

    if (recipientEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy người nhận nào phù hợp với bộ lọc đã chọn.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Xây dựng nội dung HTML email chuẩn Cyberpunk
    const htmlContent = buildCyberpunkEmailHtml({
      type: body.type || 'BROADCAST',
      title,
      description,
      badgeTitle: body.badgeTitle,
      gameName: body.gameName,
      gameIconUrl: body.gameIconUrl,
      codes: body.codes,
      ctaText: body.ctaText || 'Khám Phá Ngay',
      ctaUrl: body.ctaUrl || 'https://codegame.shop/',
    });

    // 4. Gửi email hàng loạt theo đợt tối đa 50 người
    const batchSize = 50;
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < recipientEmails.length; i += batchSize) {
      const batch = recipientEmails.slice(i, i + batchSize);
      const res = await dispatchEmail(emailConfig, {
        to: batch,
        subject,
        html: htmlContent,
      });

      if (res.success) {
        successCount += batch.length;
      } else {
        failedCount += batch.length;
        if (res.error) errors.push(res.error);
      }
    }

    // 5. Ghi log vào email_notification_logs
    const logId = `em_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO email_notification_logs (id, type, title, subject, recipient_count, success_count, status, sent_by, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      logId,
      body.type || 'BROADCAST',
      title,
      subject,
      recipientEmails.length,
      successCount,
      failedCount === 0 ? 'SENT' : (successCount > 0 ? 'PARTIAL' : 'FAILED'),
      auth.adminName || 'API Client',
      errors.length > 0 ? errors.join('; ') : null,
      now
    ).run().catch(() => {});

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'API Client',
      action: 'BROADCAST_EMAIL_CAMPAIGN',
      targetId: logId,
      details: JSON.stringify({
        subject,
        targetAudience,
        totalRecipients: recipientEmails.length,
        successCount,
        failedCount,
      }),
    });

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        message: `Đã gửi thành công ${successCount}/${recipientEmails.length} email.`,
        campaignLogId: logId,
        stats: {
          totalRecipients: recipientEmails.length,
          successCount,
          failedCount,
          errors: errors.slice(0, 5),
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi gửi email chiến dịch' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
