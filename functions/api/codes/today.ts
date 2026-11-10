import { ensureSchemaUpgrades } from '../../services/d1_service';

interface Env {
  DB: D1Database;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/codes/today
 * Lấy danh sách mã giftcode ngày hôm nay (expires_at = ngày hiện tại theo giờ VN UTC+7)
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    // Tính ngày và giờ hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7)
    const nowVN = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(nowVN); // 'YYYY-MM-DD'

    const vnHours = nowVN.getHours();
    const vnMinutes = nowVN.getMinutes();
    const isPast2230 = vnHours > 22 || (vnHours === 22 && vnMinutes >= 30);

    // Nếu đã qua 22:30 cùng ngày thì mã ngày đã hết hạn
    const url = new URL(request.url);
    const includeExpired = url.searchParams.get('include_expired') === 'true';

    // Truy vấn tất cả mã có expires_at khớp ngày hôm nay
    const codesRes = await env.DB.prepare(`
      SELECT 
        c.code,
        c.game_slug,
        COALESCE(g.name, c.game_slug) as game_name,
        COALESCE(g.icon_url, '/game_icons/' || c.game_slug || '.webp') as game_icon,
        c.rewards,
        c.status,
        c.expires_at,
        c.source,
        c.added_at
      FROM codes c
      LEFT JOIN games g ON g.slug = c.game_slug
      WHERE c.status = 'active'
        AND (c.expires_at = ? OR c.expires_at LIKE ?)
      ORDER BY game_name ASC, c.code ASC
    `).bind(todayVN, `${todayVN}%`).all<any>();

    const rawList = codesRes.results || [];

    // Nếu sau 22:30 mà không yêu cầu include_expired thì trả về danh sách rỗng (hết hạn trong ngày)
    const activeList = isPast2230 && !includeExpired ? [] : rawList;

    // Gom nhóm theo từng game
    const groupedMap = new Map<string, {
      game_slug: string;
      game_name: string;
      game_icon: string;
      codes: Array<{
        code: string;
        rewards: string;
        expires_at: string;
        source: string;
        is_expired: boolean;
      }>;
    }>();

    for (const item of activeList) {
      if (!groupedMap.has(item.game_slug)) {
        groupedMap.set(item.game_slug, {
          game_slug: item.game_slug,
          game_name: item.game_name,
          game_icon: item.game_icon,
          codes: [],
        });
      }

      groupedMap.get(item.game_slug)!.codes.push({
        code: item.code,
        rewards: item.rewards || 'Quà tặng tân thủ & sự kiện',
        expires_at: item.expires_at || todayVN,
        source: item.source || 'NPH Chính Thức',
        is_expired: isPast2230,
      });
    }

    const groupedGames = Array.from(groupedMap.values());

    return new Response(
      JSON.stringify({
        success: true,
        date: todayVN,
        formatted_date: nowVN.toLocaleDateString('vi-VN', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        is_past_2230: isPast2230,
        total_codes: activeList.length,
        total_games: groupedGames.length,
        games: groupedGames,
        codes: activeList.map((item) => ({
          ...item,
          is_expired: isPast2230,
        })),
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy mã hôm nay: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
