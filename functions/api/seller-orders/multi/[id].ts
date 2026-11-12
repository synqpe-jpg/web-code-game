import { ensureMarketplaceSchema, checkAndExpireSellerOrdersD1 } from '../../../services/d1_service';
import { generateVietQrPayload, getMarketplaceConfig, isTestSellerAllowed } from '../../../services/marketplace_service';

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, env } = context;
  const orderId = String(params.id || '').trim();

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'D1 Database chưa sẵn sàng.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã đơn hàng đa gian hàng.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    await ensureMarketplaceSchema(env.DB);
    await checkAndExpireSellerOrdersD1(env.DB, orderId);

    // 1. Tìm đơn cha
    const parentOrder = await env.DB.prepare(`
      SELECT * FROM seller_parent_orders
      WHERE (id = ? OR parent_order_code = ?) AND deleted_at IS NULL
      LIMIT 1
    `).bind(orderId, orderId).first<any>();

    if (!parentOrder) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy đơn hàng đa gian hàng.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // 2. Tìm cấu hình SePay
    let bankName = 'TPBank';
    let accountNumber = '10004681879';
    let bankAccount = 'CODE GAME SHOP';
    let paymentPrefix = 'WCG';
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
      }
    } catch {}

    const config = await getMarketplaceConfig(env.DB);

    // 3. Tìm các đơn con
    const childOrdersRes = await env.DB.prepare(`
      SELECT so.*, s.name as seller_name, s.avatar_url as seller_avatar
      FROM seller_orders so
      LEFT JOIN sellers s ON so.seller_id = s.id
      WHERE so.parent_order_id = ? AND so.deleted_at IS NULL
      ORDER BY so.created_at ASC
    `).bind(parentOrder.id).all<any>();

    const childOrders = (childOrdersRes?.results || []).map((co: any) => {
      const isRealMoneyAllowed = isTestSellerAllowed(config, co.seller_id);
      const transferContent = `${paymentPrefix} ${co.order_code}`;
      const qrPayload = isRealMoneyAllowed
        ? generateVietQrPayload({
            bankName,
            accountNumber,
            amount: co.price_core,
            content: transferContent,
          })
        : null;

      return {
        id: co.id,
        order_code: co.order_code,
        seller_id: co.seller_id,
        seller_name: co.seller_name,
        seller_avatar: co.seller_avatar,
        product_id: co.product_id,
        product_name: co.product_name,
        price_core: co.price_core,
        status: co.status,
        delivered_code: co.delivered_code,
        hold_until: co.hold_until,
        expires_at: co.expires_at,
        qr_allowed: isRealMoneyAllowed,
        qr_payload: qrPayload,
        qr_content: isRealMoneyAllowed ? transferContent : null,
        bank_name: bankName,
        account_number: accountNumber,
        bank_account: bankAccount,
      };
    });

    const now = Date.now();
    const expiresAtMs = parentOrder.expires_at ? new Date(parentOrder.expires_at).getTime() : now;
    const secondsLeft = Math.max(0, Math.floor((expiresAtMs - now) / 1000));

    return new Response(
      JSON.stringify({
        success: true,
        parent_order: {
          id: parentOrder.id,
          parent_order_code: parentOrder.parent_order_code,
          total_amount: parentOrder.total_amount,
          payment_method: parentOrder.payment_method,
          status: parentOrder.status,
          expires_at: parentOrder.expires_at,
          seconds_left: secondsLeft,
        },
        child_orders: childOrders,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[getSellerMultiOrder error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi khi tra cứu đơn hàng.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
