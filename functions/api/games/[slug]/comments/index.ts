import { ensureSchemaUpgrades, ensureGameCommentsSchema } from '../../../../services/d1_service';
import { verifyMemberAuth } from '../../../../services/mission_service';
import { generateFomoComments } from '../../../../services/fomo_comments_service';
import fallbackCodesData from '../../../../../src/data/crawled_codes_188.json';

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

    // 1. Lấy thông tin metadata của game (để tính độ HOT và mức tăng trưởng FOMO)
    let gameMeta: any = {};
    try {
      const gRow = await env.DB.prepare(`
        SELECT is_hot, is_featured, is_new, total_codes_count, active_codes_count
        FROM games
        WHERE slug = ?
        LIMIT 1
      `).bind(gameSlug).first<any>();
      if (gRow) {
        gameMeta = gRow;
      }
    } catch {}

    // Kiểm tra xem game có mã hay không (tính theo D1 + fallback catalog)
    // Ngoại lệ bắt buộc: Đấu Trường Chân Lý Mobile luôn tính là có mã (68 mã)
    const isDtcl = gameSlug === 'dau-truong-chan-ly-mobile' || gameSlug === 'dau-truong-chan-ly';
    let totalCodesCount = 0;

    if (isDtcl) {
      totalCodesCount = 68;
    } else {
      // 1. Kiểm tra từ D1 bảng codes
      try {
        const isWwm = gameSlug === 'where-winds-meet' || gameSlug === 'where-winds-meet-mobile' || gameSlug === 'yen-van-thap-luc-thanh';
        const codesCountRow = await env.DB.prepare(
          isWwm
            ? `SELECT COUNT(*) as cnt FROM codes WHERE (game_slug = 'where-winds-meet' OR game_slug = 'where-winds-meet-mobile' OR game_slug = 'yen-van-thap-luc-thanh') AND status != 'deleted'`
            : `SELECT COUNT(*) as cnt FROM codes WHERE (game_slug = ? OR game_slug = ?) AND status != 'deleted'`
        ).bind(...(isWwm ? [] : [gameSlug, gameSlug.replace(/-mobile$/, '')])).first<any>();
        totalCodesCount = Number(codesCountRow?.cnt || 0);
      } catch {}

      // 2. Nếu D1 bảng codes = 0, kiểm tra bảng games
      if (totalCodesCount <= 0 && gameMeta) {
        totalCodesCount = Number(gameMeta.total_codes_count || gameMeta.active_codes_count || 0);
      }

      // 3. Nếu vẫn <= 0, kiểm tra file tĩnh fallback (crawled_codes_188.json)
      if (totalCodesCount <= 0) {
        const fbCodes = (fallbackCodesData as Record<string, any[]>)[gameSlug] || (fallbackCodesData as Record<string, any[]>)[gameSlug.replace(/-mobile$/, '')];
        if (Array.isArray(fbCodes) && fbCodes.length > 0) {
          totalCodesCount = fbCodes.length;
        }
      }
    }

    const hasCodes = totalCodesCount > 0;

    // 2. Thống kê & lấy danh sách bình luận THẬT đã duyệt từ DB
    const realCommentsRes = await env.DB.prepare(`
      SELECT id, game_slug, user_id, user_name, rating, content, confirmed_working, status, created_at
      FROM game_comments
      WHERE game_slug = ? AND status = 'APPROVED'
      ORDER BY created_at DESC
    `).bind(gameSlug).all<any>();

    const realComments: any[] = realCommentsRes.results || [];

    // 3. Sinh danh sách đánh giá FOMO theo độ HOT và số ngày trôi qua (chỉ sinh khi game CÓ MÃ)
    const nowMs = Date.now();
    const fomo = hasCodes
      ? generateFomoComments(gameSlug, gameMeta, nowMs)
      : {
          comments: [],
          overview: {
            average_rating: 0,
            rating_count: 0,
            total_comments: 0,
            distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
            confirmed_working_count: 0,
          },
        };

    // Ghép bình luận thật đã duyệt lên đầu, bình luận FOMO nối tiếp sau
    const allComments = [
      ...realComments.map((c) => ({ ...c, is_real: true })),
      ...fomo.comments.map((c) => ({ ...c, is_fomo: true })),
    ];

    // Lọc trùng nội dung bình luận sinh tự động trong danh sách cuối cùng
    const seenAutoContents = new Set<string>();
    const deduplicatedComments: any[] = [];
    for (const c of allComments) {
      if (c.is_real) {
        deduplicatedComments.push(c);
      } else {
        const norm = String(c.content || '').trim().toLowerCase();
        if (!seenAutoContents.has(norm)) {
          seenAutoContents.add(norm);
          deduplicatedComments.push(c);
        }
      }
    }

    // 4. Tính toán phân bố sao và điểm đánh giá trung bình tổng thể
    let combinedDistribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let combinedConfirmedWorking = 0;
    let combinedAverageRating = 0;
    const totalCommentsCount = deduplicatedComments.length;

    if (totalCommentsCount > 0) {
      let totalRatingSum = 0;
      for (const c of deduplicatedComments) {
        const starKey = String(Math.max(1, Math.min(5, Math.round(Number(c.rating) || 5)))) as '1' | '2' | '3' | '4' | '5';
        combinedDistribution[starKey] = (combinedDistribution[starKey] || 0) + 1;
        totalRatingSum += Number(c.rating) || 5;
        if (Number(c.confirmed_working) === 1) {
          combinedConfirmedWorking += 1;
        }
      }

      const calcAvg = totalRatingSum / totalCommentsCount;
      if (hasCodes) {
        // Game có mã kèm FOMO: Đảm bảo đánh giá chung luôn >= 4.5 sao theo quy chuẩn
        combinedAverageRating = Math.max(4.5, Math.min(5.0, Math.round(calcAvg * 10) / 10));
      } else {
        // Game không có mã nhưng có bình luận thật: tính theo điểm thật
        combinedAverageRating = Math.round(calcAvg * 10) / 10;
      }
    }

    // 5. Cắt phân trang
    const pagedComments = deduplicatedComments.slice(offset, offset + limit);
    const totalPages = Math.ceil(totalCommentsCount / limit) || 1;

    // 6. Kiểm tra xem người dùng hiện tại có đánh giá chờ duyệt của chính mình không
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

    return new Response(
      JSON.stringify({
        success: true,
        comments: pagedComments,
        overview: {
          average_rating: combinedAverageRating,
          rating_count: totalCommentsCount,
          total_comments: totalCommentsCount,
          distribution: combinedDistribution,
          confirmed_working_count: combinedConfirmedWorking,
        },
        pagination: {
          total: totalCommentsCount,
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
