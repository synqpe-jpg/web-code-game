/**
 * Cloudflare Pages Functions - Direct Game Icon Serving Endpoint
 * Route: /game_icons/[file]
 * 
 * Đảm bảo 100% hình ảnh icon game được phân phối trơn tru:
 * 1. Kiểm tra Edge Cache
 * 2. Thử Static Assets trước (560+ game sẵn có)
 * 3. Nếu 404, nạp từ D1 bảng uploaded_game_icons
 */

interface Env {
  DB?: D1Database;
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
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

export const onRequestGet = async (context: {
  request: Request;
  env: Env;
  params: { file?: string };
  waitUntil: (p: Promise<any>) => void;
}) => {
  const { request, env, params, waitUntil } = context;
  const filename = (params.file || '').trim();

  // Chống path traversal
  if (
    !filename ||
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('%2e') ||
    filename.includes('%2f') ||
    filename.includes('%5c')
  ) {
    return new Response('Not Found', { status: 404 });
  }

  const dotIndex = filename.lastIndexOf('.');
  const slug = (dotIndex >= 0 ? filename.slice(0, dotIndex) : filename).toLowerCase().trim();
  const isThumb = slug.includes('-thumb');
  const baseSlug = slug.replace(/-thumb(?:-256)?$/i, '');

  // 1. Kiểm tra Cloudflare Edge Cache (bỏ qua nếu client yêu cầu làm mới ?nocache/?fresh hoặc Cache-Control: no-cache)
  const urlObj = new URL(request.url);
  const bypassCache = urlObj.searchParams.has('nocache') ||
                      urlObj.searchParams.has('fresh') ||
                      request.headers.get('Cache-Control')?.includes('no-cache');
  const cache = typeof caches !== 'undefined' ? (caches as any).default : null;
  const cacheKey = cache ? new Request(request.url, { method: 'GET' }) : null;
  if (cache && cacheKey && !bypassCache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        return cached;
      }
    } catch {}
  }

  // 2. Tra cứu D1 bảng uploaded_game_icons trước (Ưu tiên cập nhật mới nhất từ D1 override file tĩnh cũ)
  // Ngoại lệ phòng thủ: idle-cat-gunner đã có bản nén tĩnh tối ưu 24.4 KiB trong Edge Assets, bỏ qua bản D1 cũ nặng 275 KiB
  if (env.DB && baseSlug !== 'idle-cat-gunner') {
    try {
      // Nếu là thumb, CHỈ tìm chính xác slug thumbnail trong D1, KHÔNG fallback sang file gốc baseSlug
      const row: any = isThumb
        ? await env.DB.prepare('SELECT content_type, image_base64, size_bytes FROM uploaded_game_icons WHERE slug = ? LIMIT 1').bind(slug).first()
        : await env.DB.prepare('SELECT content_type, image_base64, size_bytes FROM uploaded_game_icons WHERE slug = ? OR slug = ? LIMIT 1').bind(slug, baseSlug).first();

      if (row && row.image_base64) {
        const cleanB64 = String(row.image_base64).replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
        const binaryStr = atob(cleanB64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const cacheControl = 'public, max-age=31536000, immutable';

        const contentType = filename.toLowerCase().endsWith('.webp') ? 'image/webp' : (row.content_type || 'image/webp');
        const headers = new Headers({
          ...CORS_HEADERS,
          'Content-Type': contentType,
          'Content-Length': len.toString(),
          'Cache-Control': cacheControl,
          'X-Icon-Source': 'd1-uploaded',
        });

        const iconResponse = new Response(bytes, { status: 200, headers });

        if (cache && cacheKey) {
          waitUntil(cache.put(cacheKey, iconResponse.clone()));
        }

        return iconResponse;
      }
    } catch (err) {
      console.warn('[GameIconFunction] Lỗi đọc D1:', err);
    }
  }

  // 3. Nếu chưa có trong D1, thử nạp từ static assets
  if (env.ASSETS) {
    try {
      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes && assetRes.status === 200) {
        return assetRes;
      }
    } catch {}
  }

  return new Response('Icon not found', { status: 404, headers: CORS_HEADERS });
};
