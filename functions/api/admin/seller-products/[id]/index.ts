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
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// DELETE: Xóa sản phẩm sàn TMĐT (§5.3 / Zero Test Artifacts)
export const onRequestDelete: PagesFunction<Env> = async (context) => {
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
      .prepare('SELECT * FROM seller_products WHERE id = ? LIMIT 1')
      .bind(productId)
      .first<any>();

    if (!prod) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy sản phẩm.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Xóa toàn bộ kho mã của sản phẩm test
    await env.DB
      .prepare('DELETE FROM seller_codes WHERE product_id = ?')
      .bind(productId)
      .run()
      .catch(() => {});

    // Xóa cứng bản ghi sản phẩm khỏi CSDL D1
    await env.DB
      .prepare('DELETE FROM seller_products WHERE id = ?')
      .bind(productId)
      .run();

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'ADMIN_DELETE_SELLER_PRODUCT',
      targetId: productId,
      details: { product_name: prod.name, seller_id: prod.seller_id },
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã xóa sản phẩm "${prod.name}" thành công.`,
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
