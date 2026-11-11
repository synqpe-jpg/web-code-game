import { verifyAdminAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../services/d1_service';
import { releaseDueSellerOrders } from '../../../services/marketplace_service';

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

    const adminName = auth.adminName || 'Admin';
    const result = await releaseDueSellerOrders(env.DB, adminName);

    await logAdminAudit(env.DB, {
      actorName: adminName,
      action: 'RELEASE_HELD_ORDERS_MANUAL',
      targetId: 'seller_orders',
      details: {
        processed: result.processed,
        successCount: result.successCount,
        errors: result.errors,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã xử lý giải ngân ${result.successCount}/${result.processed} đơn hàng hết thời gian giữ tiền.`,
        result,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[releaseHeldOrders error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống khi giải ngân.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
