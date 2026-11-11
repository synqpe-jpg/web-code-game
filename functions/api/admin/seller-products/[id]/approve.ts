import { verifyAdminAuth } from '../../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../../services/d1_service';

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

// POST: Duyệt sản phẩm gian hàng -> APPROVED (§5.3)
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

    const productId = params.id as string;
    const prod = await env.DB
      .prepare("SELECT * FROM seller_products WHERE id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(productId)
      .first<any>();

    if (!prod) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy sản phẩm.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const nowIso = new Date().toISOString();
    await env.DB
      .prepare("UPDATE seller_products SET status = 'APPROVED', reject_reason = NULL, updated_at = ? WHERE id = ?")
      .bind(nowIso, productId)
      .run();

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'ADMIN_APPROVE_SELLER_PRODUCT',
      targetId: productId,
      details: { product_name: prod.name, seller_id: prod.seller_id },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã duyệt sản phẩm "${prod.name}" thành công. Sản phẩm hiện đã sẵn sàng mở bán.`,
        status: 'APPROVED',
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
