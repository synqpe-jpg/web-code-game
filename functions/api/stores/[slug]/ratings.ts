import { PagesFunction } from '@cloudflare/workers-types';
import { ensureMarketplaceSchema } from '../../../services/d1_service';

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

function maskBuyerName(raw: string): string {
  const clean = (raw || 'Khách hàng').trim();
  if (clean.length <= 2) return clean.charAt(0) + '***';
  return clean.charAt(0) + '***' + clean.charAt(clean.length - 1);
}

// GET /api/stores/:slug/ratings: Công khai - Danh sách đánh giá đã duyệt và sao trung bình của gian hàng
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const slug = String(params.slug || '').trim();

    if (!slug) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu slug gian hàng.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const seller = await env.DB
      .prepare('SELECT id, name, slug FROM sellers WHERE slug = ? AND deleted_at IS NULL LIMIT 1')
      .bind(slug)
      .first<any>();

    if (!seller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Gian hàng không tồn tại hoặc đã ngừng hoạt động.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // 1. Tính sao trung bình và tổng số đánh giá ĐÃ DUYỆT (APPROVED)
    const stats = await env.DB
      .prepare(`
        SELECT 
          COUNT(*) as total_ratings,
          AVG(stars) as avg_stars
        FROM seller_ratings
        WHERE seller_id = ? AND status = 'APPROVED'
      `)
      .bind(seller.id)
      .first<any>();

    const totalRatings = Number(stats?.total_ratings) || 0;
    const avgStars = totalRatings > 0 ? Math.round(Number(stats?.avg_stars) * 10) / 10 : null;

    // 2. Lấy danh sách đánh giá đã duyệt (mới nhất xếp trước)
    const rows = await env.DB
      .prepare(`
        SELECT 
          sr.id, sr.stars, sr.comment, sr.created_at,
          m.username, m.email
        FROM seller_ratings sr
        LEFT JOIN members m ON sr.buyer_member_id = m.id
        WHERE sr.seller_id = ? AND sr.status = 'APPROVED'
        ORDER BY sr.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(seller.id, limit, offset)
      .all<any>();

    const ratings = (rows?.results || []).map((r) => {
      const rawName = r.username || (r.email ? r.email.split('@')[0] : 'Khách hàng');
      return {
        id: r.id,
        stars: r.stars,
        comment: r.comment || '',
        buyer_name: maskBuyerName(rawName),
        created_at: r.created_at,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        seller_id: seller.id,
        seller_name: seller.name,
        seller_slug: seller.slug,
        avg_stars: avgStars,
        total_ratings: totalRatings,
        ratings,
        page,
        limit,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[Get Store Ratings Error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi lấy đánh giá gian hàng.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
