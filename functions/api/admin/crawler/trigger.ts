import { ensureSchemaUpgrades, logAdminAudit } from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';

interface Env {
  DB: D1Database;
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

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * POST /api/admin/crawler/trigger
 * Kích hoạt yêu cầu quét crawler tức thì (On-demand Crawl Trigger)
 * Body: { target?: 'ALL' | 'GAMES' | 'UPCOMING' | 'NEWS'; specificGameSlug?: string }
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

    const auth = await verifyAdminAuth(request, env as any, 'CRAWLER_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền CRAWLER_MANAGE, GAMES_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const target = body.target || 'ALL';
    const specificGameSlug = body.specificGameSlug || null;
    const jobId = `crawl_job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const triggerRecord = {
      jobId,
      target,
      specificGameSlug,
      requestedBy: auth.adminName || 'API Client',
      requestedAt: now,
      status: 'QUEUED',
    };

    // Lưu trigger record vào system_settings để crawler engine / GitHub Action kiểm tra
    await env.DB.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind('wcg_crawler_last_trigger', JSON.stringify(triggerRecord), now).run();

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'API Client',
      action: 'TRIGGER_CRAWLER_JOB',
      targetId: jobId,
      details: JSON.stringify(triggerRecord),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã kích hoạt yêu cầu chạy crawler thành công.',
        job: triggerRecord,
      }),
      { status: 202, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi kích hoạt crawler' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
