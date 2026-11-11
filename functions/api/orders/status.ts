import { checkAndExpireOrdersD1, checkAndExpireSellerOrdersD1, ensureMarketplaceSchema, ensureSchemaUpgrades } from '../../services/d1_service';

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa sẵn sàng.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const url = new URL(request.url);
    const orderId = (url.searchParams.get('order_id') || url.searchParams.get('orderId') || url.searchParams.get('id') || '').trim();

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Thiếu mã đơn hàng (order_id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Tự động kiểm tra và hết hạn nếu quá 15 phút
    await checkAndExpireOrdersD1(env.DB, orderId);
    await checkAndExpireSellerOrdersD1(env.DB, orderId);

    const order = await env.DB.prepare(
      'SELECT * FROM orders WHERE id = ? COLLATE NOCASE LIMIT 1'
    ).bind(orderId).first<any>();

    if (!order) {
      // 1b. Tra cứu đơn cha sàn TMĐT (seller_parent_orders)
      await ensureMarketplaceSchema(env.DB);
      const parentOrder = await env.DB.prepare(
        'SELECT * FROM seller_parent_orders WHERE (id = ? OR parent_order_code = ?) COLLATE NOCASE LIMIT 1'
      ).bind(orderId, orderId).first<any>();

      if (parentOrder) {
        const childOrdersRes = await env.DB.prepare(
          'SELECT * FROM seller_orders WHERE parent_order_id = ? ORDER BY created_at ASC'
        ).bind(parentOrder.id).all<any>();
        const childOrders = childOrdersRes?.results || [];

        const expiresAtMs = parentOrder.expires_at ? new Date(parentOrder.expires_at).getTime() : Date.now() + 15 * 60 * 1000;
        const secondsLeft = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));

        const isFullyCompleted = parentOrder.status === 'PAID' || parentOrder.status === 'COMPLETED';

        return new Response(
          JSON.stringify({
            success: true,
            isSellerParentOrder: true,
            status: isFullyCompleted ? 'COMPLETED' : parentOrder.status,
            secondsLeft,
            message: isFullyCompleted ? 'Đơn hàng đa gian hàng đã thanh toán thành công!' : 'Đang chờ thanh toán các đơn con.',
            order: {
              id: parentOrder.id,
              orderId: parentOrder.id,
              parentOrderCode: parentOrder.parent_order_code,
              status: parentOrder.status,
              totalAmount: parentOrder.total_amount,
              expiresAt: parentOrder.expires_at,
              childOrders: childOrders.map((co: any) => ({
                id: co.id,
                orderCode: co.order_code,
                sellerId: co.seller_id,
                productId: co.product_id,
                productName: co.product_name,
                priceCore: co.price_core,
                status: co.status,
                deliveredCode: co.delivered_code,
                holdUntil: co.hold_until,
              })),
            },
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          }
        );
      }

      // 1c. Tra cứu đơn con sàn TMĐT (seller_orders)
      const sellerOrder = await env.DB.prepare(
        'SELECT * FROM seller_orders WHERE (id = ? OR order_code = ?) COLLATE NOCASE LIMIT 1'
      ).bind(orderId, orderId).first<any>();

      if (sellerOrder) {
        const expiresAtMs = sellerOrder.expires_at ? new Date(sellerOrder.expires_at).getTime() : Date.now() + 15 * 60 * 1000;
        const secondsLeft = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
        const isCompleted = sellerOrder.status === 'PAID' || sellerOrder.status === 'COMPLETED' || sellerOrder.status === 'DELIVERED';

        return new Response(
          JSON.stringify({
            success: true,
            isSellerChildOrder: true,
            status: isCompleted ? 'COMPLETED' : sellerOrder.status,
            secondsLeft,
            message: isCompleted ? 'Đơn hàng sàn đã thanh toán thành công!' : 'Đang chờ quét mã QR và chuyển khoản.',
            order: {
              id: sellerOrder.id,
              orderId: sellerOrder.id,
              orderCode: sellerOrder.order_code,
              sellerId: sellerOrder.seller_id,
              productId: sellerOrder.product_id,
              productName: sellerOrder.product_name,
              priceCore: sellerOrder.price_core,
              totalAmount: sellerOrder.price_core,
              status: sellerOrder.status,
              deliveredCodes: sellerOrder.delivered_code ? [sellerOrder.delivered_code] : [],
              deliveredCode: sellerOrder.delivered_code,
              holdUntil: sellerOrder.hold_until,
              expiresAt: sellerOrder.expires_at,
            },
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: false, message: 'Không tìm thấy đơn hàng.', orderId }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // 1. Đã thanh toán thành công
    if (order.status === 'COMPLETED' || order.payment_status === 'PAID') {
      let deliveredCodes: string[] = [];
      try {
        deliveredCodes = typeof order.delivered_codes === 'string'
          ? JSON.parse(order.delivered_codes)
          : (Array.isArray(order.delivered_codes) ? order.delivered_codes : []);
      } catch {
        deliveredCodes = order.delivered_codes ? [String(order.delivered_codes)] : [];
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: 'COMPLETED',
          message: 'Đơn hàng đã thanh toán thành công!',
          order: {
            id: order.id,
            orderId: order.id,
            status: 'COMPLETED',
            paymentStatus: 'PAID',
            deliveredCodes,
            totalAmount: order.total_amount,
            paidAt: order.paid_at,
            sepayTransactionId: order.sepay_transaction_id,
          },
        }),
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // 2. Đã hết hạn hoặc bị hủy
    if (order.status === 'CANCELLED' || order.payment_status === 'EXPIRED') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'EXPIRED',
          message: 'Mã QR đã hết hạn thanh toán (quá 15 phút). Mã hàng đã được hoàn trả lại kho.',
          order: {
            id: order.id,
            orderId: order.id,
            status: 'CANCELLED',
            paymentStatus: 'EXPIRED',
          },
        }),
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // 3. Đang chờ thanh toán (PENDING_PAYMENT)
    const expiresAtMs = order.expires_at ? new Date(order.expires_at).getTime() : Date.now() + 15 * 60 * 1000;
    const secondsLeft = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));

    return new Response(
      JSON.stringify({
        success: true,
        status: 'PENDING_PAYMENT',
        secondsLeft,
        message: 'Đang chờ khách hàng quét mã và chuyển khoản.',
        order: {
          id: order.id,
          orderId: order.id,
          status: 'PENDING_PAYMENT',
          paymentStatus: 'PENDING_PAYMENT',
          expiresAt: order.expires_at,
          totalAmount: order.total_amount,
        },
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('[Order Status Check Error]:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Lỗi máy chủ khi kiểm tra trạng thái đơn: ' + (err?.message || String(err)),
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
