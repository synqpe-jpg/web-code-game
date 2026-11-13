import { PagesFunction } from '@cloudflare/workers-types';
import { verifyMemberAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema } from '../../../services/d1_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// POST /api/seller-orders/:id/rate: Khách hàng đánh giá gian hàng cho đơn con đã mua (PAID hoặc COMPLETED)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập để đánh giá gian hàng.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const orderId = String(params.id || '').trim();
    const buyerId = auth.member.id;
    const body = (await request.json().catch(() => ({}))) as any;
    const rawStars = Number(body.stars);
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

    if (!Number.isInteger(rawStars) || rawStars < 1 || rawStars > 5) {
      return new Response(
        JSON.stringify({ success: false, error: 'Số sao đánh giá phải từ 1 đến 5 sao.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (comment.length > 500) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bình luận không được vượt quá 500 ký tự.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Kiểm tra đơn hàng thuộc về chính người mua và trạng thái PAID hoặc COMPLETED
    const order = await env.DB
      .prepare(`
        SELECT id, order_code, seller_id, buyer_member_id, status 
        FROM seller_orders 
        WHERE id = ? AND buyer_member_id = ?
        LIMIT 1
      `)
      .bind(orderId, buyerId)
      .first<any>();

    if (!order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy đơn hàng hoặc đơn hàng không thuộc về bạn.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (order.status !== 'PAID' && order.status !== 'COMPLETED' && order.status !== 'DELIVERED') {
      return new Response(
        JSON.stringify({ success: false, error: `Chỉ có thể đánh giá đơn hàng đã thanh toán hoặc đã giao (trạng thái hiện tại: ${order.status}).` }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 2. Kiểm tra xem đơn hàng đã từng được đánh giá chưa
    const existingRating = await env.DB
      .prepare('SELECT id FROM seller_ratings WHERE order_id = ? LIMIT 1')
      .bind(orderId)
      .first<any>();

    if (existingRating) {
      return new Response(
        JSON.stringify({ success: false, error: 'Đơn hàng này đã được đánh giá trước đó. Mỗi đơn con chỉ được đánh giá 1 lần.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Chống spam: kiểm tra bình luận trùng lặp nguyên văn của cùng người mua
    if (comment.length > 0) {
      const duplicateComment = await env.DB
        .prepare('SELECT id FROM seller_ratings WHERE buyer_member_id = ? AND TRIM(comment) = ? LIMIT 1')
        .bind(buyerId, comment)
        .first<any>();

      if (duplicateComment) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nội dung bình luận bị trùng lặp nguyên văn với đánh giá trước của bạn.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    const ratingId = `srat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    await env.DB
      .prepare(`
        INSERT INTO seller_ratings (
          id, seller_id, order_id, buyer_member_id, stars, comment, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
      `)
      .bind(ratingId, order.seller_id, orderId, buyerId, rawStars, comment || null, nowIso)
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đánh giá gian hàng thành công! Đánh giá của bạn đang được kiểm duyệt trước khi hiển thị công khai.',
        rating: {
          id: ratingId,
          seller_id: order.seller_id,
          order_id: orderId,
          stars: rawStars,
          comment: comment || null,
          status: 'PENDING',
          created_at: nowIso,
        },
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[Rate Store Error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi xử lý đánh giá gian hàng.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
