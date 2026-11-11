import { verifyMemberAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../services/d1_service';
import { verifySellerAccess } from '../../../services/marketplace_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET: Danh sách sản phẩm của gian hàng
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const memberId = auth.member.id;

    // Tìm seller của member
    const seller = await env.DB
      .prepare(`
        SELECT s.id FROM sellers s
        WHERE (s.owner_member_id = ? OR s.id IN (SELECT seller_id FROM seller_subaccounts WHERE member_id = ?))
          AND s.deleted_at IS NULL
        LIMIT 1
      `)
      .bind(memberId, memberId)
      .first<{ id: string }>();

    if (!seller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bạn chưa có gian hàng hoặc chưa được gán quyền.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const products = await env.DB
      .prepare(`
        SELECT 
          sp.*,
          (SELECT COUNT(*) FROM seller_codes sc WHERE sc.product_id = sp.id AND sc.status = 'IN_STOCK' AND sc.deleted_at IS NULL) as in_stock_count,
          (SELECT COUNT(*) FROM seller_codes sc WHERE sc.product_id = sp.id AND sc.status = 'SOLD' AND sc.deleted_at IS NULL) as sold_count,
          (SELECT COUNT(*) FROM seller_codes sc WHERE sc.product_id = sp.id AND sc.status = 'REPORTED' AND sc.deleted_at IS NULL) as reported_count
        FROM seller_products sp
        WHERE sp.seller_id = ? AND sp.deleted_at IS NULL
        ORDER BY sp.created_at DESC
      `)
      .bind(seller.id)
      .all<any>();

    return new Response(
      JSON.stringify({ success: true, products: products.results || [] }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

// POST: Tạo sản phẩm mới (§5.1, §5.3)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const memberId = auth.member.id;
    const body = (await request.json().catch(() => ({}))) as any;
    const {
      game_slug,
      name,
      description,
      price_core,
      original_price_core,
      warranty_type,
      warranty_hours,
      delivery_type,
      low_stock_threshold,
    } = body;

    // 1. Tìm thông tin gian hàng & kiểm tra quyền
    const sellerRow = await env.DB
      .prepare(`
        SELECT s.* FROM sellers s
        WHERE (s.owner_member_id = ? OR s.id IN (SELECT seller_id FROM seller_subaccounts WHERE member_id = ? AND role = 'MANAGE_STOCK'))
          AND s.deleted_at IS NULL
        LIMIT 1
      `)
      .bind(memberId, memberId)
      .first<any>();

    if (!sellerRow) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bạn không có quyền quản lý sản phẩm cho gian hàng này.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // 2. Kiểm tra trạng thái gian hàng
    if (sellerRow.status === 'SUSPENDED' || sellerRow.status === 'REJECTED') {
      return new Response(
        JSON.stringify({ success: false, error: 'Gian hàng đang bị khóa hoặc bị từ chối, không thể tạo sản phẩm.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // 3. Kiểm tra giới hạn sản phẩm khi ở TRIAL (§3.2, §5.1)
    if (sellerRow.status === 'TRIAL') {
      const activeProdCount = await env.DB
        .prepare("SELECT COUNT(*) as count FROM seller_products WHERE seller_id = ? AND deleted_at IS NULL")
        .bind(sellerRow.id)
        .first<{ count: number }>();

      const limit = sellerRow.trial_product_limit || 5;
      if ((activeProdCount?.count || 0) >= limit) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Gian hàng đang trong giai đoạn thử việc (TRIAL) chỉ được đăng tối đa ${limit} sản phẩm. Vui lòng chờ nâng cấp gian hàng.`,
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    // 4. Kiểm tra game_slug và lấy ảnh bìa chính thức của game (§5.1)
    if (!game_slug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng chọn tựa game từ danh mục.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const game = await env.DB
      .prepare("SELECT slug, name, icon_url FROM games WHERE slug = ? LIMIT 1")
      .bind(game_slug)
      .first<any>();

    if (!game) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tựa game không tồn tại trong danh mục hệ thống.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const officialCoverUrl = game.icon_url || `/game_icons/${game.slug}-thumb.webp`;

    // 5. Kiểm tra giá Core
    const priceCore = parseInt(price_core, 10);
    if (isNaN(priceCore) || priceCore <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Giá Core bán ra phải lớn hơn 0.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Nếu ở TRIAL, kiểm tra giới hạn giá tối đa 1 đơn (§3.2: mặc định 200 Core)
    if (sellerRow.status === 'TRIAL' && priceCore > (sellerRow.trial_order_max || 200)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Gian hàng thử việc chỉ được đặt giá tối đa ${sellerRow.trial_order_max || 200} Core cho mỗi sản phẩm.`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!name || name.trim().length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tên sản phẩm phải từ 3 ký tự trở lên.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 6. Xác định trạng thái duyệt sản phẩm (§5.3):
    // Gian hàng TRIAL -> Luôn đưa vào PENDING_REVIEW để admin duyệt
    // Gian hàng ACTIVE -> APPROVED tự động
    const initialStatus = sellerRow.status === 'ACTIVE' ? 'APPROVED' : 'PENDING_REVIEW';
    const prodId = `sprod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    await env.DB
      .prepare(`
        INSERT INTO seller_products (
          id, seller_id, game_slug, game_name, name, cover_url, description,
          price_core, original_price_core, warranty_type, warranty_hours,
          delivery_type, low_stock_threshold, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        prodId,
        sellerRow.id,
        game.slug,
        game.name,
        name.trim(),
        officialCoverUrl,
        description?.trim() || null,
        priceCore,
        original_price_core ? parseInt(original_price_core, 10) : null,
        warranty_type || '24H',
        warranty_hours ? parseInt(warranty_hours, 10) : 24,
        delivery_type === 'MANUAL' ? 'MANUAL' : 'AUTO',
        low_stock_threshold ? parseInt(low_stock_threshold, 10) : 2,
        initialStatus,
        nowIso,
        nowIso
      )
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        message: initialStatus === 'APPROVED' ? 'Đã tạo sản phẩm thành công.' : 'Sản phẩm đã tạo và đang chờ Quản trị viên duyệt trước khi công khai.',
        product_id: prodId,
        status: initialStatus,
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
