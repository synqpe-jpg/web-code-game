import {
  createQrOrderD1,
  ensureSchemaUpgrades,
  getFirstPurchaseConfigD1,
  isProductExcludedFromFirstPurchase,
  getProductFirstPurchaseOffer,
  isMemberEmailVerified,
  getEscalatingPriceD1,
} from '../../services/d1_service';
import { verifyToken, extractUserIdFromToken } from '../../services/auth_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  JWT_SECRET?: string;
  SEPAY_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Requested-With, Idempotency-Key, idempotency-key',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const body: any = await request.json().catch(() => ({}));
    const {
      productId,
      utilityId,
      productTitle,
      quantity = 1,
      expected_price,
      client_displayed_price,
    } = body || {};

    const targetId = String(productId || utilityId || '').trim();
    if (!targetId && !productTitle) {
      return new Response(
        JSON.stringify({ success: false, message: 'Thiếu thông tin mã sản phẩm.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const rawKey = request.headers.get('Idempotency-Key') || body?.idempotencyKey || '';
    const idempotencyKey = typeof rawKey === 'string' ? rawKey.trim() : '';

    const qty = Math.max(1, Math.min(999, Math.floor(Number(quantity) || 1)));

    // 1. Xác thực tài khoản khách hàng bắt buộc (Session Token hoặc Bearer Token)
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Vui lòng đăng nhập tài khoản để thực hiện mua mã.',
        }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const { valid, userId: tokenUserId } = await verifyToken(token, [env.JWT_SECRET, env.ADMIN_SYNC_SECRET]);

    let member: any = null;
    if (token) {
      member = await env.DB.prepare(
        'SELECT * FROM members WHERE session_token = ? LIMIT 1'
      ).bind(token).first<any>();
    }

    if (!member && valid && tokenUserId) {
      member = await env.DB.prepare(
        'SELECT * FROM members WHERE id = ? OR username = ? OR email = ? LIMIT 1'
      ).bind(tokenUserId, tokenUserId, tokenUserId).first<any>();
    }

    if (!member && token) {
      const extractedUserId = extractUserIdFromToken(token);
      if (extractedUserId) {
        member = await env.DB.prepare(
          'SELECT * FROM members WHERE id = ? OR username = ? LIMIT 1'
        ).bind(extractedUserId, extractedUserId).first<any>();
      }
    }

    if (!member) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
        }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    if (member.status === 'BANNED') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Tài khoản của bạn đã bị khóa.',
        }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // 2. Tìm kiếm sản phẩm trong D1
    let product: any = null;
    if (targetId) {
      product = await env.DB.prepare('SELECT * FROM store_products WHERE id = ? LIMIT 1').bind(targetId).first<any>();
      if (!product) {
        product = await env.DB.prepare('SELECT * FROM utilities WHERE id = ? LIMIT 1').bind(targetId).first<any>();
      }
    }

    if (!product && productTitle) {
      const cleanTitle = String(productTitle).trim().toLowerCase();
      product = await env.DB.prepare('SELECT * FROM store_products WHERE LOWER(title) = ? LIMIT 1').bind(cleanTitle).first<any>();
      if (!product) {
        product = await env.DB.prepare('SELECT * FROM utilities WHERE LOWER(title) = ? LIMIT 1').bind(cleanTitle).first<any>();
      }
    }

    if (!product) {
      return new Response(
        JSON.stringify({ success: false, message: 'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (product.is_active === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Sản phẩm hiện đang tạm ngừng bán.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Tính toán giá sản phẩm chuẩn xác từ máy chủ (Server-Authoritative Price Engine)
    const isEscalating = String(product.sale_mode || '').toLowerCase() === 'escalating';

    if (isEscalating && qty > 1) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Hình thức mua Nâng Giá chỉ áp dụng tối đa số lượng 1 gói mỗi đơn hàng.',
          code: 'ESCALATING_SINGLE_QTY_ONLY',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let finalTotalAmount = 0;
    let originalPriceTotal = 0;
    let pricePaidTotal = 0;
    let effectiveUnitPrice = 0;
    let discountAmount = 0;
    let discountType: string = 'none';
    let priceRule: string = 'normal';

    if (isEscalating) {
      const epInfo = await getEscalatingPriceD1(env.DB, product);
      const serverCalculatedPrice = epInfo.current_calculated_price;

      // Slippage Protection: Nếu giá máy chủ tính ra cao hơn giá kỳ vọng của client
      const clientExpectedPrice = expected_price ?? client_displayed_price;
      if (
        typeof clientExpectedPrice === 'number' &&
        clientExpectedPrice > 0 &&
        serverCalculatedPrice > clientExpectedPrice
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            code: 'PRICE_ESCALATED',
            old_price: clientExpectedPrice,
            new_price: serverCalculatedPrice,
            completed_count: epInfo.completed_count,
            message: `Giá gói vừa tăng lên ${serverCalculatedPrice.toLocaleString('vi-VN')} Core (đã có người mua trước bạn). Bạn có muốn mua với giá mới không?`,
          }),
          { status: 409, headers: CORS_HEADERS }
        );
      }

      finalTotalAmount = serverCalculatedPrice;
      originalPriceTotal = serverCalculatedPrice;
      pricePaidTotal = serverCalculatedPrice;
      effectiveUnitPrice = serverCalculatedPrice;
      priceRule = 'escalating';
    } else {
      const regularUnitPrice = Number(product.current_price) || 0;
      effectiveUnitPrice = regularUnitPrice;
      originalPriceTotal = regularUnitPrice * qty;
      finalTotalAmount = regularUnitPrice * qty;
      pricePaidTotal = finalTotalAmount;

      // Kiểm tra Ưu Đãi Mua Lần Đầu
      const campaignConfig = await getFirstPurchaseConfigD1(env.DB);
      const pkgOffer = getProductFirstPurchaseOffer(product, campaignConfig);

      if (pkgOffer.enabled) {
        const isExcluded = isProductExcludedFromFirstPurchase(product, campaignConfig.excluded_products);
        let emailVerifiedOk = true;
        if (campaignConfig.require_verified_email) {
          emailVerifiedOk = isMemberEmailVerified(member);
        }

        if (!isExcluded && emailVerifiedOk) {
          // Kiểm tra xem thành viên đã từng mua gói này hay chưa
          const priorCount = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM orders 
            WHERE (member_id = ? OR buyer_email = ?) 
              AND product_id = ? AND status = 'COMPLETED'
              AND created_at > (
                SELECT COALESCE(MAX(reset_at), '1970-01-01T00:00:00.000Z') 
                FROM first_purchase_resets 
                WHERE (member_id = ? OR member_id = ?) AND product_id = ?
              )
          `).bind(member.id, member.email, product.id, member.id, member.email, product.id).first<any>();

          const isEligible = Number(priorCount?.count || 0) === 0;
          if (isEligible) {
            const offerPrice = pkgOffer.offer_price;
            if (offerPrice < regularUnitPrice) {
              const firstPackPrice = offerPrice;
              const remainingPacksPrice = (qty - 1) * regularUnitPrice;
              finalTotalAmount = firstPackPrice + remainingPacksPrice;
              pricePaidTotal = finalTotalAmount;
              discountAmount = regularUnitPrice - offerPrice;
              discountType = 'first_purchase';
              priceRule = 'first_purchase';
            }
          }
        }
      }
    }

    // 4. Đọc cấu hình SePay từ D1 system_settings
    let bankName = 'TPBank';
    let accountNumber = '10004681879';
    let bankAccount = 'CODE GAME SHOP';
    let paymentPrefix = 'WCG';
    let minQrAmount = 2000;
    let qrOrderExpiryMinutes = 15;

    try {
      const sepaySetting = await env.DB.prepare(
        "SELECT value FROM system_settings WHERE key = 'wcg_admin_sepay_v4' LIMIT 1"
      ).first<any>();
      if (sepaySetting?.value) {
        const parsed = typeof sepaySetting.value === 'string' ? JSON.parse(sepaySetting.value) : sepaySetting.value;
        if (parsed?.bankName) bankName = parsed.bankName.trim();
        if (parsed?.accountNumber) accountNumber = parsed.accountNumber.trim();
        if (parsed?.bankAccount) bankAccount = parsed.bankAccount.trim();
        if (parsed?.paymentPrefix) paymentPrefix = parsed.paymentPrefix.trim().toUpperCase() || 'WCG';
        if (parsed?.minQrAmount && Number(parsed.minQrAmount) > 0) minQrAmount = Number(parsed.minQrAmount);
        if (parsed?.qrOrderExpiryMinutes && Number(parsed.qrOrderExpiryMinutes) > 0) qrOrderExpiryMinutes = Number(parsed.qrOrderExpiryMinutes);
      }
    } catch {}

    // 5. Kiểm tra Ngưỡng tối thiểu thanh toán trực tiếp qua mã QR (Mặc định 2.000 Core/VND)
    // Tỷ giá cố định: 1 VND = 1 Core
    if (finalTotalAmount < minQrAmount) {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'BELOW_MIN_QR_AMOUNT',
          message: `Thanh toán trực tiếp bằng mã QR chỉ áp dụng cho đơn hàng từ ${minQrAmount.toLocaleString('vi-VN')} Core (tương đương ${minQrAmount.toLocaleString('vi-VN')}đ) trở lên. Vui lòng thanh toán bằng số dư Core trong ví.`,
          minQrAmount,
          finalTotalAmount,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 6. Khởi tạo mã đơn hàng duy nhất và tạo đơn chờ thanh toán trong D1
    const orderId = `ORD-QR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const qrResult = await createQrOrderD1(env.DB, {
      orderId,
      userId: member.id,
      buyerEmail: member.email,
      productId: product.id,
      productTitle: product.title,
      quantity: qty,
      unitPrice: effectiveUnitPrice,
      totalAmount: finalTotalAmount,
      expiryMinutes: qrOrderExpiryMinutes,
      idempotencyKey: idempotencyKey || undefined,
      originalPrice: originalPriceTotal,
      pricePaid: pricePaidTotal,
      discountType,
      discountAmount,
      priceRule,
    });

    if (!qrResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          code: qrResult.code || 'CREATE_QR_FAILED',
          message: qrResult.error || 'Không thể tạo đơn thanh toán QR.',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 7. Tạo thông tin VietQR (1 VND = 1 Core)
    const transferAmount = finalTotalAmount;
    const memoContent = `${paymentPrefix} ${orderId}`;
    const cleanAcc = accountNumber.replace(/\s+/g, '');
    const cleanBank = bankName.replace(/\s+/g, '');

    const primaryQrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(cleanAcc)}&bank=${encodeURIComponent(cleanBank)}&amount=${transferAmount}&des=${encodeURIComponent(memoContent)}&template=qr_only`;
    const fallbackQrUrl = `https://img.vietqr.io/image/${encodeURIComponent(cleanBank)}-${encodeURIComponent(cleanAcc)}-qr_only.svg?amount=${transferAmount}&addInfo=${encodeURIComponent(memoContent)}&accountName=${encodeURIComponent(bankAccount)}`;

    return new Response(
      JSON.stringify({
        success: true,
        qrUrls: {
          primary: primaryQrUrl,
          fallback: fallbackQrUrl,
        },
        order: {
          id: orderId,
          orderId,
          productId: product.id,
          productTitle: product.title,
          quantity: qty,
          unitPrice: effectiveUnitPrice,
          totalAmount: finalTotalAmount,
          status: 'PENDING_PAYMENT',
          paymentStatus: 'PENDING_PAYMENT',
          paymentMethod: 'VIETQR',
          expiresAt: qrResult.expiresAt,
          currencyRatio: '1 VND = 1 Core',
          bankInfo: {
            bankName,
            accountNumber: cleanAcc,
            bankAccount,
            amount: transferAmount,
            content: memoContent,
            formattedAmount: `${transferAmount.toLocaleString('vi-VN')} đ`,
          },
          qrUrls: {
            primary: primaryQrUrl,
            fallback: fallbackQrUrl,
          },
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[Create QR Order Error]:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Lỗi máy chủ khi tạo mã QR thanh toán: ' + (err?.message || String(err)),
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
