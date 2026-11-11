import { verifyAdminAuth } from '../../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../../services/d1_service';
import { getMarketplaceConfig } from '../../../../services/marketplace_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// POST: Duyệt hồ sơ gian hàng -> TRIAL (§3.2)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyAdminAuth(request, env as any, 'MARKETPLACE_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Yêu cầu quyền Quản trị viên (MARKETPLACE_MANAGE).' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const sellerId = params.id as string;
    const seller = await env.DB
      .prepare("SELECT * FROM sellers WHERE id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(sellerId)
      .first<any>();

    if (!seller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy gian hàng.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const config = await getMarketplaceConfig(env.DB);
    const nowIso = new Date().toISOString();
    await env.DB
      .prepare(`
        UPDATE sellers
        SET status = 'TRIAL', 
            trial_product_limit = ?, 
            trial_order_max = ?, 
            reject_reason = NULL, 
            request_info_note = NULL, 
            updated_at = ?
        WHERE id = ?
      `)
      .bind(
        config.default_trial_product_limit,
        config.default_trial_order_max,
        nowIso,
        sellerId
      )
      .run();

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'ADMIN_APPROVE_SELLER',
      targetId: sellerId,
      details: {
        seller_name: seller.name,
        new_status: 'TRIAL',
        trial_product_limit: config.default_trial_product_limit,
        trial_order_max: config.default_trial_order_max,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã duyệt gian hàng "${seller.name}" vào giai đoạn thử việc (TRIAL).`,
        status: 'TRIAL',
        trial_product_limit: config.default_trial_product_limit,
        trial_order_max: config.default_trial_order_max,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
