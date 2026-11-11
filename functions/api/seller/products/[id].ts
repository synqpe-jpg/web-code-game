import { verifyMemberAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema } from '../../../services/d1_service';
import { getMarketplaceConfig } from '../../../services/marketplace_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET: Chi tiết 1 sản phẩm
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const productId = params.id as string;
    const memberId = auth.member.id;

    const product = await env.DB
      .prepare(`
        SELECT sp.* FROM seller_products sp
        JOIN sellers s ON sp.seller_id = s.id
        WHERE sp.id = ? AND sp.deleted_at IS NULL
          AND (s.owner_member_id = ? OR s.id IN (SELECT seller_id FROM seller_subaccounts WHERE member_id = ?))
        LIMIT 1
      `)
      .bind(productId, memberId, memberId)
      .first<any>();

    if (!product) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sản phẩm không tồn tại hoặc bạn không có quyền truy cập.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ success: true, product }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

// PUT: Cập nhật sản phẩm
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const productId = params.id as string;
    const memberId = auth.member.id;
    const body = (await request.json().catch(() => ({}))) as any;

    const product = await env.DB
      .prepare(`
        SELECT sp.*, s.status as seller_status, s.trial_order_max
        FROM seller_products sp
        JOIN sellers s ON sp.seller_id = s.id
        WHERE sp.id = ? AND sp.deleted_at IS NULL
          AND (s.owner_member_id = ? OR s.id IN (SELECT seller_id FROM seller_subaccounts WHERE member_id = ? AND role = 'MANAGE_STOCK'))
        LIMIT 1
      `)
      .bind(productId, memberId, memberId)
      .first<any>();

    if (!product) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sản phẩm không tồn tại hoặc bạn không có quyền chỉnh sửa.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const {
      name,
      description,
      price_core,
      original_price_core,
      warranty_type,
      warranty_hours,
      delivery_type,
      low_stock_threshold,
    } = body;

    let newStatus = product.status;
    let newPrice = product.price_core;

    if (price_core !== undefined) {
      const parsedPrice = parseInt(price_core, 10);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Giá Core không hợp lệ.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const marketplaceConfig = await getMarketplaceConfig(env.DB);
      const maxOrderPrice = (product.trial_order_max !== null && product.trial_order_max !== undefined)
        ? Number(product.trial_order_max)
        : marketplaceConfig.default_trial_order_max;

      if (product.seller_status === 'TRIAL' && parsedPrice > maxOrderPrice) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Gian hàng thử việc chỉ được đặt giá tối đa ${maxOrderPrice} Core.`,
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
      newPrice = parsedPrice;
      // Nếu ở TRIAL mà đổi giá thì cần duyệt lại
      if (product.seller_status === 'TRIAL' && newPrice !== product.price_core) {
        newStatus = 'PENDING_REVIEW';
      }
    }

    const nowIso = new Date().toISOString();

    await env.DB
      .prepare(`
        UPDATE seller_products
        SET name = COALESCE(?, name),
            description = COALESCE(?, description),
            price_core = ?,
            original_price_core = COALESCE(?, original_price_core),
            warranty_type = COALESCE(?, warranty_type),
            warranty_hours = COALESCE(?, warranty_hours),
            delivery_type = COALESCE(?, delivery_type),
            low_stock_threshold = COALESCE(?, low_stock_threshold),
            status = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .bind(
        name?.trim() || null,
        description !== undefined ? description?.trim() : null,
        newPrice,
        original_price_core !== undefined ? parseInt(original_price_core, 10) : null,
        warranty_type || null,
        warranty_hours !== undefined ? parseInt(warranty_hours, 10) : null,
        delivery_type || null,
        low_stock_threshold !== undefined ? parseInt(low_stock_threshold, 10) : null,
        newStatus,
        nowIso,
        productId
      )
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã cập nhật sản phẩm.',
        status: newStatus,
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

// DELETE: Xóa mềm sản phẩm (§0: cấm hard delete)
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const productId = params.id as string;
    const memberId = auth.member.id;

    const product = await env.DB
      .prepare(`
        SELECT sp.id, sp.seller_id FROM seller_products sp
        JOIN sellers s ON sp.seller_id = s.id
        WHERE sp.id = ? AND sp.deleted_at IS NULL
          AND (s.owner_member_id = ? OR s.id IN (SELECT seller_id FROM seller_subaccounts WHERE member_id = ? AND role = 'MANAGE_STOCK'))
        LIMIT 1
      `)
      .bind(productId, memberId, memberId)
      .first<any>();

    if (!product) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sản phẩm không tồn tại hoặc bạn không có quyền xóa.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Kiểm tra xem có đơn hàng nào đang ở trạng thái REPORTED của sản phẩm này không
    const pendingDispute = await env.DB
      .prepare("SELECT COUNT(*) as count FROM seller_orders WHERE product_id = ? AND status = 'REPORTED'")
      .bind(productId)
      .first<{ count: number }>();

    if (pendingDispute && pendingDispute.count > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Không thể xóa sản phẩm khi đang có đơn hàng khiếu nại báo lỗi chưa giải quyết.',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const nowIso = new Date().toISOString();
    // Xóa mềm sản phẩm
    await env.DB
      .prepare("UPDATE seller_products SET deleted_at = ?, updated_at = ? WHERE id = ?")
      .bind(nowIso, nowIso, productId)
      .run();

    return new Response(
      JSON.stringify({ success: true, message: 'Đã xóa sản phẩm thành công.' }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
