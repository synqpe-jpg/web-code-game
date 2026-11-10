import { ensureSchemaUpgrades, ensureCodeReportsSchema, logAdminAudit } from '../../../../services/d1_service';
import { verifyAdminAuth } from '../../../../services/mission_service';

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
 * POST /api/admin/code-reports/:id/resolve
 * Xử lý báo cáo lỗi giftcode (Confirmed | Invalid | Dismiss)
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'GAMES_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền GAMES_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const reportId = String(params.id || '').trim();
    if (!reportId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu report id' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    await ensureCodeReportsSchema(env.DB);

    const report = await env.DB.prepare(`
      SELECT * FROM code_reports WHERE id = ? LIMIT 1
    `).bind(reportId).first<any>();

    if (!report) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy báo cáo lỗi với ID này.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const body: any = await request.json().catch(() => ({}));
    const rawAction = String(body.action || '').toLowerCase().trim();
    const note = body.note ? String(body.note).trim() : null;

    let targetStatus: string;
    if (rawAction === 'confirmed') {
      targetStatus = 'RESOLVED_CONFIRMED';
    } else if (rawAction === 'invalid') {
      targetStatus = 'RESOLVED_INVALID';
    } else if (rawAction === 'dismiss' || rawAction === 'dismissed') {
      targetStatus = 'DISMISSED';
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Hành động không hợp lệ. Chỉ chấp nhận: confirmed, invalid, dismiss.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const adminActor = auth.adminName || 'Admin';

    await env.DB.prepare(`
      UPDATE code_reports 
      SET status = ?, 
          note = CASE WHEN ? IS NOT NULL THEN ? ELSE note END,
          resolved_by = ?, 
          resolved_at = datetime('now')
      WHERE id = ?
    `).bind(targetStatus, note, note, adminActor, reportId).run();

    await logAdminAudit(env.DB, {
      actorName: adminActor,
      action: 'RESOLVE_CODE_REPORT',
      targetId: reportId,
      targetUser: report.user_id,
      severity: 'INFO',
      details: {
        action: rawAction,
        new_status: targetStatus,
        game_slug: report.game_slug,
        code: report.code,
        note,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        report_id: reportId,
        action: rawAction,
        status: targetStatus,
        resolved_by: adminActor,
        message: 'Đã cập nhật trạng thái báo cáo thành công.',
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi xử lý báo cáo: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
