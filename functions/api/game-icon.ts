/**
 * Cloudflare Pages Functions - Edge Game Icon Proxy & Caching Endpoint
 * Route: /api/game-icon
 * 
 * Đảm bảo 100% hình ảnh logo game được phân phối trơn tru, chống chặn bởi Adblock,
 * chống lỗi cross-origin (CORS) và tối ưu hóa thời gian tải bằng Cloudflare Edge Cache.
 */

interface Env {
  DB?: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const urlObj = new URL(context.request.url);
  const targetUrl = urlObj.searchParams.get('url') || '';
  const slug = urlObj.searchParams.get('slug') || '';

  if (!targetUrl && !slug) {
    return new Response('Thiếu tham số url hoặc slug', { status: 400, headers: CORS_HEADERS });
  }

  // 1. Kiểm tra Cloudflare Edge Cache
  const cache = (caches as any).default;
  const cacheKey = new Request(context.request.url, context.request);
  try {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }
  } catch {}

  let fetchUrl = targetUrl;

  // Nếu không có URL hoặc URL là đường dẫn tương đối, trỏ tới icon nội bộ
  if (!fetchUrl && slug) {
    fetchUrl = `${urlObj.origin}/game_icons/${slug}.webp`;
  }

  try {
    // 2. Fetch ảnh từ nguồn với User-Agent chuẩn
    let referer = 'https://play.google.com/';
    if (fetchUrl.includes('codemoi.net')) {
      referer = 'https://codemoi.net/';
    } else if (fetchUrl.includes('apple.com') || fetchUrl.includes('mzstatic.com')) {
      referer = 'https://apps.apple.com/';
    }

    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': referer,
      },
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type') || 'image/webp';
      const imageHeaders = new Headers({
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400',
        'X-Image-Proxy-By': 'CodeGame-Edge-CDN',
      });

      const proxyResponse = new Response(response.body, {
        status: 200,
        headers: imageHeaders,
      });

      // Lưu vào Cloudflare Edge Cache
      try {
        context.request.signal ? null : null;
        // Cache không đồng bộ
        cache.put(cacheKey, proxyResponse.clone());
      } catch {}

      return proxyResponse;
    }

    // Nếu fetchUrl ban đầu thất bại và có slug, thử fallback sang file tĩnh của trang web
    if (slug && !fetchUrl.includes(slug)) {
      const fallbackLocalUrl = `${urlObj.origin}/game_icons/${slug}.webp`;
      const fallbackRes = await fetch(fallbackLocalUrl);
      if (fallbackRes.ok) {
        return new Response(fallbackRes.body, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': fallbackRes.headers.get('content-type') || 'image/webp',
            'Cache-Control': 'public, max-age=604800',
          },
        });
      }
    }

    // Fallback trả về placeholder SVG tinh tế (thay vì lỗi hay DiceBear identicon)
    return generateFallbackSvgResponse(slug);
  } catch (err: any) {
    return generateFallbackSvgResponse(slug);
  }
};

function generateFallbackSvgResponse(seed: string) {
  const label = (seed || 'GAME').slice(0, 3).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#022c22"/>
      </linearGradient>
      <linearGradient id="t" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#34d399"/>
        <stop offset="100%" stop-color="#38bdf8"/>
      </linearGradient>
    </defs>
    <rect width="256" height="256" rx="56" fill="url(#g)"/>
    <rect x="8" y="8" width="240" height="240" rx="48" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
    <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="900" fill="url(#t)" text-anchor="middle" dominant-baseline="middle" letter-spacing="2">${label}</text>
  </svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'image/svg+xml;charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
