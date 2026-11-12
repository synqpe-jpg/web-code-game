import { verifyMemberAuth } from '../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../services/d1_service';
import {
  getMarketplaceConfig,
  isTestSellerAllowed,
  generateVietQrPayload,
} from '../../services/marketplace_service';

interface Env {
  DB: D1Database;
  SEPAY_API_KEY?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
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

    // 1. Xác thực người mua đăng nhập (verifyMemberAuth)
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập để thanh toán đơn hàng.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }
    const buyer = auth.member;

    // 2. Kiểm tra cấu hình SePay API Key (§5 trường hợp 6)
    let configuredApiKey = (env.SEPAY_API_KEY || '').trim();
    let bankName = 'TPBank';
    let accountNumber = '10004681879';
    let bankAccount = 'CODE GAME SHOP';
    let paymentPrefix = 'WCG';
    let qrOrderExpiryMinutes = 15;

    try {
      const sepaySetting = await env.DB.prepare(
        "SELECT value FROM system_settings WHERE key = 'wcg_admin_sepay_v4' LIMIT 1"
      ).first<any>();
      if (sepaySetting?.value) {
        const parsed = typeof sepaySetting.value === 'string' ? JSON.parse(sepaySetting.value) : sepaySetting.value;
        if (!configuredApiKey && parsed?.apiKey) configuredApiKey = parsed.apiKey.trim();
        if (parsed?.bankName) bankName = parsed.bankName.trim();
        if (parsed?.accountNumber) accountNumber = parsed.accountNumber.trim();
        if (parsed?.bankAccount) bankAccount = parsed.bankAccount.trim();
        if (parsed?.paymentPrefix) paymentPrefix = parsed.paymentPrefix.trim().toUpperCase() || 'WCG';
        if (parsed?.qrOrderExpiryMinutes && Number(parsed.qrOrderExpiryMinutes) > 0) {
          qrOrderExpiryMinutes = Number(parsed.qrOrderExpiryMinutes);
        }
      }

      if (!configuredApiKey) {
        const privSetting = await env.DB.prepare(
          "SELECT value FROM system_settings WHERE key = 'wcg_admin_sepay_private_v1' LIMIT 1"
        ).first<any>();
        if (privSetting?.value) {
          const parsedPriv = typeof privSetting.value === 'string' ? JSON.parse(privSetting.value) : privSetting.value;
          if (parsedPriv?.apiKey) configuredApiKey = parsedPriv.apiKey.trim();
        }
      }
    } catch {}

    if (!configuredApiKey && !env.ADMIN_SYNC_SECRET) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Chưa cấu hình SePay API Key trên máy chủ. Không thể tạo đơn thanh toán QR lúc này.',
        }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // 3. Phân tích giỏ hàng
    const body = (await request.json().catch(() => ({}))) as any;
    const items = Array.isArray(body?.items) ? body.items : (body?.product_id ? [{ product_id: body.product_id }] : []);

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Giỏ hàng trống. Vui lòng chọn sản phẩm.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const config = await getMarketplaceConfig(env.DB);
    const now = Date.now();
    const expiresAtMs = now + qrOrderExpiryMinutes * 60 * 1000;
    const expiresAt = new Date(expiresAtMs).toISOString();
    const nowIso = new Date(now).toISOString();

    const parentOrderId = `spord_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const parentOrderCode = `CGM-P-${now.toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    let totalAmount = 0;
    const childOrdersToInsert: any[] = [];
    const reserveCodeStatements: any[] = [];

    // 4. Kiểm tra từng sản phẩm và gian hàng (§4.1)
    for (const item of items) {
      const prodId = String(item.product_id || item.productId || '').trim();
      if (!prodId) continue;

      const product = await env.DB.prepare(`
        SELECT sp.*, s.owner_member_id, s.name as seller_name, s.status as seller_status, s.is_vacation, s.deleted_at as seller_deleted_at
        FROM seller_products sp
        JOIN sellers s ON sp.seller_id = s.id
        WHERE sp.id = ? AND sp.deleted_at IS NULL LIMIT 1
      `).bind(prodId).first<any>();

      if (!product) {
        return new Response(
          JSON.stringify({ success: false, error: `Sản phẩm (${prodId}) không tồn tại hoặc đã bị xóa.` }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (product.owner_member_id === buyer.id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Bạn không thể tự mua sản phẩm của chính gian hàng mình ("${product.seller_name}").`,
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (product.status !== 'APPROVED') {
        return new Response(
          JSON.stringify({ success: false, error: `Sản phẩm "${product.name}" chưa được duyệt bán.` }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (product.seller_deleted_at || (product.seller_status !== 'ACTIVE' && product.seller_status !== 'TRIAL')) {
        return new Response(
          JSON.stringify({ success: false, error: `Gian hàng "${product.seller_name}" hiện không mở bán.` }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (product.is_vacation === 1) {
        return new Response(
          JSON.stringify({ success: false, error: `Gian hàng "${product.seller_name}" đang trong chế độ tạm nghỉ bán.` }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Kiểm tra danh sách thử nghiệm tiền thật (§1.11)
      // Lưu ý: Các gian hàng ngoài danh sách này vẫn tiếp tục bán bằng ví Core bình thường; chỉ không sinh mã QR SePay tiền thật
      const isRealMoneyAllowed = isTestSellerAllowed(config, product.seller_id);

      // Tìm 1 mã IN_STOCK để giữ mã nguyên tử (§4.1: IN_STOCK -> RESERVED)
      const availableCode = await env.DB.prepare(`
        SELECT id FROM seller_codes
        WHERE product_id = ? AND status = 'IN_STOCK' AND deleted_at IS NULL
        ORDER BY created_at ASC LIMIT 1
      `).bind(product.id).first<any>();

      if (!availableCode) {
        return new Response(
          JSON.stringify({ success: false, error: `Sản phẩm "${product.name}" đã tạm hết mã trong kho.` }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const childOrderId = `sord_${now}_${Math.random().toString(36).substring(2, 7)}`;
      // Định dạng mã đơn con ORD-QR-S-... để khớp chuẩn SePay webhook
      const childOrderCode = `ORD-QR-S-${now.toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const priceCore = Number(product.price_core) || 0;
      totalAmount += priceCore;

      const transferContent = `${paymentPrefix} ${childOrderCode}`;
      const qrPayload = isRealMoneyAllowed
        ? generateVietQrPayload({
            bankName,
            accountNumber,
            amount: priceCore,
            content: transferContent,
          })
        : null;

      childOrdersToInsert.push({
        id: childOrderId,
        order_code: childOrderCode,
        parent_order_id: parentOrderId,
        seller_id: product.seller_id,
        seller_name: product.seller_name,
        product_id: product.id,
        product_name: product.name,
        game_slug: product.game_slug,
        code_id: availableCode.id,
        price_core: priceCore,
        status: 'PENDING_PAYMENT',
        payment_method: 'QR_SEPAY',
        expires_at: expiresAt,
        qr_allowed: isRealMoneyAllowed,
        qr_payload: qrPayload,
        qr_content: isRealMoneyAllowed ? transferContent : null,
        bank_name: bankName,
        account_number: accountNumber,
        bank_account: bankAccount,
      });

      // Statement giữ mã cho đơn con
      reserveCodeStatements.push(
        env.DB.prepare(`
          UPDATE seller_codes
          SET status = 'RESERVED', order_id = ?, updated_at = ?
          WHERE id = ? AND status = 'IN_STOCK'
        `).bind(childOrderId, nowIso, availableCode.id)
      );
    }

    if (childOrdersToInsert.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không thể tạo đơn hàng từ danh sách sản phẩm đã chọn.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 5. Thực thi Batch nguyên tử tạo đơn cha + các đơn con + giữ mã (§4.1)
    const batchStatements: any[] = [
      // Đơn cha
      env.DB.prepare(`
        INSERT INTO seller_parent_orders (
          id, parent_order_code, buyer_member_id, buyer_email,
          total_amount, payment_method, status, expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'QR_SEPAY', 'PENDING_PAYMENT', ?, ?, ?)
      `).bind(
        parentOrderId,
        parentOrderCode,
        buyer.id,
        buyer.email || buyer.username,
        totalAmount,
        expiresAt,
        nowIso,
        nowIso
      ),
      // Giữ các mã kho
      ...reserveCodeStatements,
    ];

    // Chèn từng đơn con
    for (const co of childOrdersToInsert) {
      batchStatements.push(
        env.DB.prepare(`
          INSERT INTO seller_orders (
            id, order_code, parent_order_id, buyer_member_id, buyer_name, buyer_email,
            seller_id, product_id, product_name, game_slug, code_id,
            price_core, payment_method, status, expires_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'QR_SEPAY', 'PENDING_PAYMENT', ?, ?, ?)
        `).bind(
          co.id,
          co.order_code,
          parentOrderId,
          buyer.id,
          buyer.username || buyer.email,
          buyer.email,
          co.seller_id,
          co.product_id,
          co.product_name,
          co.game_slug,
          co.code_id,
          co.price_core,
          expiresAt,
          nowIso,
          nowIso
        )
      );
    }

    await env.DB.batch(batchStatements);

    // Ghi nhật ký kiểm toán
    await logAdminAudit(env.DB, {
      actorName: buyer.username || buyer.email,
      actorEmail: buyer.email,
      action: 'SELLER_PARENT_ORDER_CREATED',
      targetId: parentOrderId,
      details: {
        parent_order_code: parentOrderCode,
        total_amount: totalAmount,
        child_orders_count: childOrdersToInsert.length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tạo đơn hàng đa gian hàng thành công!',
        parent_order: {
          id: parentOrderId,
          parent_order_code: parentOrderCode,
          total_amount: totalAmount,
          payment_method: 'QR_SEPAY',
          status: 'PENDING_PAYMENT',
          expires_at: expiresAt,
          seconds_left: Math.floor((expiresAtMs - now) / 1000),
        },
        child_orders: childOrdersToInsert.map((co) => ({
          id: co.id,
          order_code: co.order_code,
          seller_id: co.seller_id,
          seller_name: co.seller_name,
          product_id: co.product_id,
          product_name: co.product_name,
          price_core: co.price_core,
          status: co.status,
          expires_at: co.expires_at,
          qr_allowed: co.qr_allowed,
          qr_payload: co.qr_payload,
          qr_content: co.qr_content,
          bank_name: co.bank_name,
          account_number: co.account_number,
          bank_account: co.bank_account,
        })),
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[createSellerMultiOrder error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi khi tạo đơn hàng đa gian hàng.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
