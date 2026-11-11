import { verifyAdminAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../services/d1_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET: Lịch sử đối soát và danh sách ngoại lệ
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'D1 Database chưa sẵn sàng.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyAdminAuth(request, env as any, 'MARKETPLACE_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Yêu cầu quyền Quản trị viên (MARKETPLACE_MANAGE).' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const url = new URL(request.url);
    const exceptionStatus = url.searchParams.get('status') || ''; // 'OPEN', 'RESOLVED', or ''

    // 1. Danh sách phiên đối soát gần nhất
    const runsRes = await env.DB.prepare(`
      SELECT * FROM reconciliation_runs
      ORDER BY run_date DESC, created_at DESC
      LIMIT 30
    `).all<any>();

    // 2. Danh sách ngoại lệ
    let exQuery = `SELECT * FROM reconciliation_exceptions WHERE 1=1`;
    const exBinds: any[] = [];
    if (exceptionStatus) {
      exQuery += ` AND status = ?`;
      exBinds.push(exceptionStatus);
    }
    exQuery += ` ORDER BY created_at DESC LIMIT 100`;

    const exRes = await env.DB.prepare(exQuery).bind(...exBinds).all<any>();

    const openCountRes = await env.DB.prepare(
      "SELECT COUNT(*) as open_count FROM reconciliation_exceptions WHERE status = 'OPEN'"
    ).first<{ open_count: number }>();

    return new Response(
      JSON.stringify({
        success: true,
        runs: runsRes?.results || [],
        exceptions: exRes?.results || [],
        open_exceptions_count: openCountRes?.open_count || 0,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[getReconciliation error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

// POST: Đánh dấu xử lý ngoại lệ đối soát (§7)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'D1 Database chưa sẵn sàng.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyAdminAuth(request, env as any, 'MARKETPLACE_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Yêu cầu quyền Quản trị viên (MARKETPLACE_MANAGE).' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body = (await request.json().catch(() => ({}))) as any;
    const exceptionId = String(body.exception_id || body.id || '').trim();
    const resolutionNote = String(body.note || body.resolution_note || '').trim();

    if (!exceptionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã ngoại lệ (exception_id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const nowIso = new Date().toISOString();
    const adminName = auth.adminName || 'Admin';

    await env.DB.prepare(`
      UPDATE reconciliation_exceptions
      SET status = 'RESOLVED',
          resolved_by = ?,
          resolved_note = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(adminName, resolutionNote || 'Đã kiểm tra và xử lý xong.', nowIso, exceptionId).run();

    await logAdminAudit(env.DB, {
      actorName: adminName,
      action: 'RECONCILIATION_EXCEPTION_RESOLVED',
      targetId: exceptionId,
      details: { note: resolutionNote },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Đã giải quyết ngoại lệ đối soát thành công.' }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[resolveReconciliationException error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
