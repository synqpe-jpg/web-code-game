import { verifyMemberAuth } from '../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../services/d1_service';
import { decryptCode } from '../../services/marketplace_service';

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

// POST: Mua hàng bằng ví Core & giao mã tự động tức thì (§6.2)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập để thanh toán mua mã.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const buyer = auth.member;
    const body = (await request.json().catch(() => ({}))) as any;
    const { product_id } = body;

    if (!product_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã sản phẩm (product_id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Kiểm tra sản phẩm và thông tin gian hàng
    const product = await env.DB
      .prepare(`
        SELECT sp.*, s.name as seller_name, s.status as seller_status, s.is_vacation, s.owner_member_id
        FROM seller_products sp
        JOIN sellers s ON sp.seller_id = s.id
        WHERE sp.id = ? AND sp.deleted_at IS NULL AND s.deleted_at IS NULL
        LIMIT 1
      `)
      .bind(product_id)
      .first<any>();

    if (!product) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sản phẩm không tồn tại hoặc đã bị xóa.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (product.status !== 'APPROVED') {
      return new Response(
        JSON.stringify({ success: false, error: 'Sản phẩm hiện chưa được mở bán.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (product.seller_status !== 'TRIAL' && product.seller_status !== 'ACTIVE') {
      return new Response(
        JSON.stringify({ success: false, error: 'Gian hàng này hiện đang tạm ngừng hoạt động.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (product.is_vacation) {
      return new Response(
        JSON.stringify({ success: false, error: 'Gian hàng hiện đang nghỉ bán, tạm thời không nhận đơn mới.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (product.owner_member_id === buyer.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bạn không thể tự mua sản phẩm của chính gian hàng mình.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 2. Tìm 1 mã IN_STOCK sẵn sàng
    const availableCode = await env.DB
      .prepare(`
        SELECT id, code_encrypted FROM seller_codes
        WHERE product_id = ? AND status = 'IN_STOCK' AND deleted_at IS NULL
        ORDER BY created_at ASC
        LIMIT 1
      `)
      .bind(product.id)
      .first<any>();

    if (!availableCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sản phẩm tạm thời hết mã trong kho. Vui lòng quay lại sau.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Kiểm tra số dư Core của người mua
    const memberRow = await env.DB
      .prepare("SELECT id, core_balance, email, username FROM members WHERE id = ? LIMIT 1")
      .bind(buyer.id)
      .first<any>();

    const userCore = memberRow?.core_balance || 0;
    const priceCore = product.price_core;

    if (userCore < priceCore) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Số dư ví không đủ để thanh toán. Bạn có ${userCore} Core, đơn hàng cần ${priceCore} Core.`,
          required_core: priceCore,
          current_balance_core: userCore,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 4. Giải mã code trước để giao ngay
    const plainDeliveredCode = await decryptCode(availableCode.code_encrypted);

    const orderId = `sord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const orderCode = `CGM-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const nowIso = new Date().toISOString();

    // 5. Giao dịch nguyên tử qua D1 Batch:
    // - Trừ Core người mua (có điều kiện core_balance >= priceCore chống race-condition)
    // - Đổi mã kho sang SOLD gắn order_id
    // - Cộng pending_balance_core cho gian hàng
    // - Thêm bản ghi đơn hàng seller_orders
    const batchResults = await env.DB.batch([
      // Statement 0: Trừ Core người mua
      env.DB.prepare(`
        UPDATE members
        SET core_balance = core_balance - ?, updated_at = ?
        WHERE id = ? AND core_balance >= ?
      `).bind(priceCore, nowIso, buyer.id, priceCore),

      // Statement 1: Đổi trạng thái mã kho sang SOLD
      env.DB.prepare(`
        UPDATE seller_codes
        SET status = 'SOLD', order_id = ?, sold_at = ?, updated_at = ?
        WHERE id = ? AND status = 'IN_STOCK'
      `).bind(orderId, nowIso, nowIso, availableCode.id),

      // Statement 2: Cộng Core chờ rút cho gian hàng
      env.DB.prepare(`
        UPDATE sellers
        SET pending_balance_core = pending_balance_core + ?, updated_at = ?
        WHERE id = ?
      `).bind(priceCore, nowIso, product.seller_id),

      // Statement 3: Thêm đơn hàng hoàn tất
      env.DB.prepare(`
        INSERT INTO seller_orders (
          id, order_code, buyer_member_id, buyer_name, buyer_email,
          seller_id, product_id, product_name, game_slug, code_id,
          delivered_code, price_core, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DELIVERED', ?, ?)
      `).bind(
        orderId,
        orderCode,
        buyer.id,
        buyer.username || buyer.email,
        buyer.email,
        product.seller_id,
        product.id,
        product.name,
        product.game_slug,
        availableCode.id,
        plainDeliveredCode,
        priceCore,
        nowIso,
        nowIso
      ),
    ]);

    // Kiểm tra hàng bị tác động của statement 0 (trừ tiền)
    const updateMemberMeta = (batchResults[0] as any)?.meta;
    if (updateMemberMeta && updateMemberMeta.changes === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Số dư không đủ hoặc có giao dịch khác đang thực hiện cùng lúc.' }),
        { status: 409, headers: CORS_HEADERS }
      );
    }

    // Ghi audit log
    await logAdminAudit(env.DB, {
      actorName: buyer.username || buyer.email,
      actorEmail: buyer.email,
      action: 'SELLER_ORDER_PURCHASE',
      targetId: orderId,
      details: {
        order_code: orderCode,
        product_name: product.name,
        price_core: priceCore,
        seller_id: product.seller_id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Thanh toán thành công! Mã của bạn đã được giao ngay lập tức.',
        order: {
          id: orderId,
          order_code: orderCode,
          product_name: product.name,
          game_slug: product.game_slug,
          price_core: priceCore,
          delivered_code: plainDeliveredCode,
          status: 'DELIVERED',
          created_at: nowIso,
        },
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
