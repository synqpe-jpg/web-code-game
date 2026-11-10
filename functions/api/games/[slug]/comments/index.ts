import { ensureSchemaUpgrades, ensureGameCommentsSchema } from '../../../../services/d1_service';
import { verifyMemberAuth } from '../../../../services/mission_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/games/:slug/comments
 * Lấy danh sách bình luận đã duyệt + tổng quan sao & xác nhận còn dùng được
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const gameSlug = String(params.slug || '').toLowerCase().trim();
    if (!gameSlug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu game_slug' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    await ensureGameCommentsSchema(env.DB);

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10) || 10));
    const offset = (page - 1) * limit;

    // 1. Thống kê tổng quan đánh giá đã duyệt
    const statsRes = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_approved,
        COUNT(rating) as rating_count,
        AVG(rating) as avg_rating,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as star_1,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as star_2,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as star_3,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as star_4,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as star_5,
        SUM(CASE WHEN confirmed_working = 1 AND created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as confirmed_working_7d
      FROM game_comments 
      WHERE game_slug = ? AND status = 'APPROVED'
    `).bind(gameSlug).first<any>();

    const totalApproved = statsRes?.total_approved || 0;
    const ratingCount = statsRes?.rating_count || 0;
    const avgRating = statsRes?.avg_rating ? Math.round(Number(statsRes.avg_rating) * 10) / 10 : 0;
    const confirmedWorkingCount = statsRes?.confirmed_working_7d || 0;

    const distribution = {
      '5': statsRes?.star_5 || 0,
      '4': statsRes?.star_4 || 0,
      '3': statsRes?.star_3 || 0,
      '2': statsRes?.star_2 || 0,
      '1': statsRes?.star_1 || 0,
    };

    // 2. Lấy danh sách bình luận đã duyệt phân trang
    const commentsRes = await env.DB.prepare(`
      SELECT id, game_slug, user_id, user_name, rating, content, confirmed_working, status, created_at
      FROM game_comments
      WHERE game_slug = ? AND status = 'APPROVED'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(gameSlug, limit, offset).all<any>();

    // 3. Kiểm tra xem người dùng hiện tại có đánh giá chờ duyệt của chính mình không
    let myComment: any = null;
    try {
      const auth = await verifyMemberAuth(request, env as any).catch(() => ({ authorized: false }));
      if (auth.authorized && auth.member) {
        myComment = await env.DB.prepare(`
          SELECT id, game_slug, user_id, user_name, rating, content, confirmed_working, status, created_at, rejection_reason
          FROM game_comments
          WHERE game_slug = ? AND user_id = ?
          LIMIT 1
        `).bind(gameSlug, auth.member.id).first<any>();
      }
    } catch {}

    const totalPages = Math.ceil(totalApproved / limit) || 1;

    return new Response(
      JSON.stringify({
        success: true,
        comments: commentsRes.results || [],
        overview: {
          average_rating: avgRating,
          rating_count: ratingCount,
          total_comments: totalApproved,
          distribution,
          confirmed_working_count: confirmedWorkingCount,
        },
        pagination: {
          total: totalApproved,
          page,
          limit,
          totalPages,
        },
        my_comment: myComment,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi tải bình luận: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * POST /api/games/:slug/comments
 * Gửi đánh giá / bình luận mới hoặc cập nhật đánh giá cũ của mình (chờ duyệt)
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập để bình luận hoặc đánh giá game.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const gameSlug = String(params.slug || '').toLowerCase().trim();
    if (!gameSlug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu game_slug' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const member = auth.member;
    const body: any = await request.json().catch(() => ({}));

    let rating: number | null = null;
    if (body.rating !== undefined && body.rating !== null && body.rating !== '') {
      const r = parseInt(String(body.rating), 10);
      if (r >= 1 && r <= 5) {
        rating = r;
      }
    }

    let content: string | null = null;
    if (body.content && typeof body.content === 'string') {
      content = body.content.trim();
    }

    const confirmedWorking = body.confirmed_working ? 1 : 0;

    // Quy tắc: Phải có ít nhất sao HOẶC chữ
    if (!rating && (!content || content.length === 0)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng chọn số sao (1-5★) hoặc nhập nội dung bình luận.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Giới hạn chữ tối đa 500 ký tự
    if (content && content.length > 500) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nội dung bình luận tối đa 500 ký tự.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Chặn đường link / URL chống spam
    if (content) {
      const urlPattern = /(https?:\/\/|www\.)[^\s]+/i;
      if (urlPattern.test(content)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Bình luận không được chứa đường dẫn liên kết (link/URL).' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    await ensureSchemaUpgrades(env.DB);
    await ensureGameCommentsSchema(env.DB);

    // Kiểm tra xem người dùng đã có bình luận cho game này chưa
    const existing = await env.DB.prepare(`
      SELECT id, created_at FROM game_comments 
      WHERE user_id = ? AND game_slug = ? 
      LIMIT 1
    `).bind(member.id, gameSlug).first<any>();

    // Rate limit: 1 bình luận / 5 phút nếu gửi mới cho game khác
    if (!existing) {
      const recentPost = await env.DB.prepare(`
        SELECT id FROM game_comments 
        WHERE user_id = ? AND created_at >= datetime('now', '-5 minutes') 
        LIMIT 1
      `).bind(member.id).first<any>();

      if (recentPost) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Vui lòng đợi 5 phút trước khi đăng bình luận tiếp theo.',
          }),
          { status: 429, headers: CORS_HEADERS }
        );
      }
    }

    const userName = member.display_name || member.username || 'Thành viên';

    if (existing) {
      // 1 người chỉ có 1 đánh giá cho 1 game: Cập nhật bản ghi cũ và đưa về trạng thái PENDING
      await env.DB.prepare(`
        UPDATE game_comments 
        SET rating = ?, 
            content = ?, 
            confirmed_working = ?, 
            status = 'PENDING', 
            created_at = datetime('now'),
            reviewed_by = NULL,
            reviewed_at = NULL,
            rejection_reason = NULL
        WHERE id = ?
      `).bind(rating, content, confirmedWorking, existing.id).run();

      return new Response(
        JSON.stringify({
          success: true,
          id: existing.id,
          status: 'PENDING',
          message: 'Đã cập nhật đánh giá của bạn! Bình luận đang chờ kiểm duyệt trước khi hiển thị công khai.',
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } else {
      // Tạo mới đánh giá
      const commentId = `cm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await env.DB.prepare(`
        INSERT INTO game_comments (id, game_slug, user_id, user_name, rating, content, confirmed_working, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', datetime('now'))
      `).bind(commentId, gameSlug, member.id, userName, rating, content, confirmedWorking).run();

      return new Response(
        JSON.stringify({
          success: true,
          id: commentId,
          status: 'PENDING',
          message: 'Cảm ơn bạn đã đánh giá! Bình luận của bạn đang chờ kiểm duyệt trước khi hiển thị công khai.',
        }),
        { status: 201, headers: CORS_HEADERS }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi gửi bình luận: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
