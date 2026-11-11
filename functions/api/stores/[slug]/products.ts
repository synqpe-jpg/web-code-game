import { ensureMarketplaceSchema } from '../../../services/d1_service';

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET: Danh sách sản phẩm của gian hàng công khai (§6.1: không lộ số lượng kho thật)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const slug = (params.slug as string || '').toLowerCase().trim();

    const seller = await env.DB
      .prepare("SELECT id, status, is_vacation FROM sellers WHERE slug = ? AND deleted_at IS NULL LIMIT 1")
      .bind(slug)
      .first<any>();

    if (!seller || (seller.status !== 'TRIAL' && seller.status !== 'ACTIVE')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Gian hàng không tồn tại hoặc chưa mở cửa.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (seller.is_vacation) {
      return new Response(
        JSON.stringify({
          success: true,
          is_vacation: true,
          products: [],
          message: 'Gian hàng hiện đang trong thời gian nghỉ bán.',
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const products = await env.DB
      .prepare(`
        SELECT 
          sp.id, sp.seller_id, sp.game_slug, sp.game_name, sp.name, sp.cover_url,
          sp.description, sp.price_core, sp.original_price_core, sp.warranty_type,
          sp.warranty_hours, sp.delivery_type, sp.created_at,
          (
            SELECT COUNT(*) FROM seller_codes sc
            WHERE sc.product_id = sp.id AND sc.status = 'IN_STOCK' AND sc.deleted_at IS NULL
          ) as stock_count
        FROM seller_products sp
        WHERE sp.seller_id = ? AND sp.status = 'APPROVED' AND sp.deleted_at IS NULL
        ORDER BY sp.created_at DESC
      `)
      .bind(seller.id)
      .all<any>();

    const safeProducts = (products.results || []).map((p) => ({
      id: p.id,
      seller_id: p.seller_id,
      game_slug: p.game_slug,
      game_name: p.game_name,
      name: p.name,
      cover_url: p.cover_url,
      description: p.description,
      price_core: p.price_core,
      original_price_core: p.original_price_core,
      warranty_type: p.warranty_type,
      warranty_hours: p.warranty_hours,
      delivery_type: p.delivery_type,
      has_stock: (p.stock_count || 0) > 0, // Không lộ số lượng thật (§6.1)
    }));

    return new Response(
      JSON.stringify({
        success: true,
        is_vacation: false,
        products: safeProducts,
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
