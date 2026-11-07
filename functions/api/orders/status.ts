import { checkAndExpireOrdersD1, ensureSchemaUpgrades } from '../../services/d1_service';

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

    const order = await env.DB.prepare(
      'SELECT * FROM orders WHERE id = ? COLLATE NOCASE LIMIT 1'
    ).bind(orderId).first<any>();

    if (!order) {
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
