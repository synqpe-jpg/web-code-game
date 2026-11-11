import { verifyAdminAuth } from '../../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../../services/d1_service';
import { runDailyReconciliation } from '../../../../services/marketplace_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

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
    const targetDate = body?.date ? String(body.date).trim() : undefined;
    const adminName = auth.adminName || 'Admin';

    const result = await runDailyReconciliation(env.DB, targetDate, adminName);

    await logAdminAudit(env.DB, {
      actorName: adminName,
      action: 'RECONCILIATION_RUN_MANUAL',
      targetId: result.runId,
      details: {
        run_date: result.runDate,
        total_orders: result.totalOrders,
        total_sepay: result.totalSepay,
        total_ledger: result.totalLedger,
        matched_count: result.matchedCount,
        exception_count: result.exceptionCount,
        status: result.status,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: result.status === 'COMPLETED'
          ? `Đối soát ngày ${result.runDate} thành công: 100% dữ liệu 3 nguồn khớp chuẩn xác!`
          : `Đối soát ngày ${result.runDate} hoàn tất với ${result.exceptionCount} ngoại lệ cần kiểm tra.`,
        result,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[runReconciliationManual error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống khi chạy đối soát.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
