import * as syncApi from './api/sync';
import * as statsApi from './api/stats';
import * as voteApi from './api/vote';
import * as loginApi from './api/auth/login';
import * as registerApi from './api/auth/register';
import * as meApi from './api/auth/me';
import * as resetPasswordApi from './api/auth/reset-password';
import * as ordersCreateApi from './api/orders/create';
import * as sepayWebhookApi from './api/webhooks/sepay';
import * as giveawaysClaimApi from './api/giveaways/claim';
import * as adminMigrateApi from './api/admin/migrate';
import * as adminAuditCountersApi from './api/admin/audit-counters';
import * as adminSepayCreditApi from './api/admin/sepay-credit';
import * as realtimeEventsApi from './api/realtime-events';
import * as metricsSyncedApi from './api/metrics/synced';
import * as gamesApi from './api/games';
import * as crawlArticleApi from './api/crawl-article';
import * as gameIconApi from './api/game-icon';
import { invalidateCatalogEdgeCache } from './services/cache_service';
import fallbackGiveawaysData from '../src/data/giveaways.json';

interface Env {
  DB?: D1Database;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  ADMIN_SYNC_SECRET?: string;
  JWT_SECRET?: string;
  PASSWORD_PEPPER?: string;
  ENVIRONMENT?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/$/, '') || '/';
    const method = request.method.toUpperCase();

    // Block sensitive dotfiles and configuration probe attacks (.env, .git, .aws, etc.)
    const lowerPath = pathname.toLowerCase();
    if (
      lowerPath.startsWith('/.env') ||
      lowerPath.startsWith('/.git') ||
      lowerPath.startsWith('/.svn') ||
      lowerPath.startsWith('/.hg') ||
      lowerPath.startsWith('/.bzr') ||
      lowerPath.startsWith('/.aws') ||
      lowerPath.startsWith('/.ssh') ||
      lowerPath.startsWith('/.wrangler') ||
      lowerPath === '/.ds_store' ||
      lowerPath === '/thumbs.db'
    ) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // Route handler for mobile APK download: redirect to official GitHub Release
    if (
      pathname === '/download/codegame.apk' ||
      pathname === '/download/CodeGame-v1.0.apk' ||
      lowerPath === '/download/codegame.apk' ||
      lowerPath === '/download/codegame-v1.0.apk'
    ) {
      return Response.redirect(
        'https://github.com/synqpe-jpg/web-code-game/releases/download/v1.0.0/CodeGame-v1.0.apk',
        302
      );
    }

    // Canonical primary domain redirect: web-code-game.pages.dev & www.codegame.shop -> codegame.shop (for browser page navigation)
    if (
      (url.hostname === 'web-code-game.pages.dev' || url.hostname === 'www.codegame.shop') &&
      method === 'GET' &&
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/sync-bridge') &&
      !pathname.match(/\.(js|css|json|webp|png|jpg|jpeg|svg|ico|txt|xml|woff2?|map|apk)$/i)
    ) {
      const redirectUrl = new URL(request.url);
      redirectUrl.hostname = 'codegame.shop';
      redirectUrl.protocol = 'https:';
      return Response.redirect(redirectUrl.toString(), 301);
    }

    // Dedicated Admin Domain & Route: redirect root to /admin, and serve /admin/index.html
    const isAdminHost = url.hostname.includes('admin-code-game-shop') || url.hostname.startsWith('admin.');
    if (isAdminHost && (pathname === '/' || pathname === '')) {
      const adminRedirect = new URL('/admin', request.url);
      return Response.redirect(adminRedirect.toString(), 302);
    }

    if (
      (isAdminHost || pathname === '/admin' || pathname.startsWith('/admin/')) &&
      method === 'GET' &&
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/sync-bridge') &&
      !pathname.match(/\.(js|css|json|webp|png|jpg|jpeg|svg|ico|txt|xml|woff2?|map|apk)$/i)
    ) {
      const adminUrl = new URL('/admin/index.html', request.url);
      const res = await env.ASSETS.fetch(new Request(adminUrl.toString()));
      if (res.status === 200) {
        return res;
      }
    }

    // CORS Preflight for all API endpoints
    if (method === 'OPTIONS' && pathname.startsWith('/api')) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Requested-With, X-Forwarded-Sync, Idempotency-Key, idempotency-key, Apikey, apikey, x-api-key, X-Api-Key, Cache-Control, cache-control, Pragma, pragma',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const context: any = {
      request,
      env,
      params: {},
      waitUntil: ctx.waitUntil.bind(ctx),
      next: () => env.ASSETS.fetch(request),
      data: {},
    };

    try {
      // 1. /api/sync with Cloudflare Edge Cache API (caches.default)
      if (pathname === '/api/sync') {
        if (method === 'GET') {
          const authHeader = request.headers.get('Authorization') || '';
          const syncKeyHeader = request.headers.get('X-Sync-Key') || '';
          const isNoCache = request.headers.get('Cache-Control')?.includes('no-cache') ||
                            request.headers.get('Pragma')?.includes('no-cache') ||
                            url.searchParams.has('nocache') ||
                            url.searchParams.has('fresh');
          const isPublic = !authHeader && !syncKeyHeader && !isNoCache && !url.searchParams.has('key');

          // Edge Cache API: caches.default cho khách truy cập công khai (TTL 60s, stale-while-revalidate 30s)
          if (isPublic && typeof caches !== 'undefined' && (caches as any).default) {
            const cache = (caches as any).default;
            const cacheUrl = new URL(request.url);
            cacheUrl.search = ''; // Chuẩn hóa URL cache cho catalog công khai
            const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

            const cached = await cache.match(cacheKey);
            if (cached) {
              const res = new Response(cached.body, cached);
              res.headers.set('CF-Edge-Cache-Status', 'HIT');
              return res;
            }

            const response = await syncApi.onRequestGet(context);
            if (response.status === 200) {
              const responseText = await response.text();
              const headers = new Headers(response.headers);
              headers.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=30');

              const cacheToPut = new Response(responseText, {
                status: response.status,
                headers,
              });
              ctx.waitUntil(cache.put(cacheKey, cacheToPut));

              const resOut = new Response(responseText, {
                status: response.status,
                headers,
              });
              resOut.headers.set('CF-Edge-Cache-Status', 'MISS');
              return resOut;
            }
            return response;
          }

          return await syncApi.onRequestGet(context);
        }

        if (method === 'POST') {
          const postRes = await syncApi.onRequestPost(context);
          // Purge Edge Cache toàn cầu (Global REST API + PoP cục bộ)
          await invalidateCatalogEdgeCache(ctx, request, env);
          return postRes;
        }
      }

      // 1b. /api/realtime-events (CDN edge cached real events & stats endpoint with 15s Edge Cache)
      if (pathname === '/api/realtime-events') {
        if (method === 'GET') {
          if (typeof caches !== 'undefined' && (caches as any).default) {
            const cache = (caches as any).default;
            const cacheUrl = new URL(request.url);
            cacheUrl.search = '';
            const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

            const cached = await cache.match(cacheKey);
            if (cached) {
              const res = new Response(cached.body, cached);
              res.headers.set('CF-Edge-Cache-Status', 'HIT');
              return res;
            }

            const response = await realtimeEventsApi.onRequestGet(context);
            if (response.status === 200) {
              const responseText = await response.text();
              const headers = new Headers(response.headers);
              headers.set('Cache-Control', 'public, max-age=0, s-maxage=15, stale-while-revalidate=15');

              const cacheToPut = new Response(responseText, {
                status: response.status,
                headers,
              });
              ctx.waitUntil(cache.put(cacheKey, cacheToPut));

              const resOut = new Response(responseText, {
                status: response.status,
                headers,
              });
              resOut.headers.set('CF-Edge-Cache-Status', 'MISS');
              return resOut;
            }
            return response;
          }

          if (realtimeEventsApi.onRequestGet) return await realtimeEventsApi.onRequestGet(context);
        }
        if (method === 'OPTIONS' && realtimeEventsApi.onRequestOptions) return await realtimeEventsApi.onRequestOptions(context);
      }

      // 1c. /api/metrics/synced (Global deterministic snapshot with 30s Edge Cache)
      if (pathname === '/api/metrics/synced') {
        if (method === 'GET') {
          if (typeof caches !== 'undefined' && (caches as any).default) {
            const cache = (caches as any).default;
            const cacheUrl = new URL(request.url);
            cacheUrl.search = '';
            const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

            const cached = await cache.match(cacheKey);
            if (cached) {
              const res = new Response(cached.body, cached);
              res.headers.set('CF-Edge-Cache-Status', 'HIT');
              return res;
            }

            const response = await metricsSyncedApi.onRequestGet(context);
            if (response.status === 200) {
              const responseText = await response.text();
              const headers = new Headers(response.headers);
              headers.set('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=30');

              const cacheToPut = new Response(responseText, {
                status: response.status,
                headers,
              });
              ctx.waitUntil(cache.put(cacheKey, cacheToPut));

              const resOut = new Response(responseText, {
                status: response.status,
                headers,
              });
              resOut.headers.set('CF-Edge-Cache-Status', 'MISS');
              return resOut;
            }
            return response;
          }

          return await metricsSyncedApi.onRequestGet(context);
        }
      }

      // 1d. /api/games (Server-Side Pagination, Infinite Scroll & Single Game Lookup)
      if (pathname === '/api/games') {
        if (method === 'GET' && gamesApi.onRequestGet) return await gamesApi.onRequestGet(context);
        if (method === 'OPTIONS' && gamesApi.onRequestOptions) return await gamesApi.onRequestOptions(context);
      }

      // 2. /api/stats
      if (pathname === '/api/stats') {
        if (method === 'GET' && statsApi.onRequestGet) return await statsApi.onRequestGet(context);
      }

      // 3. /api/vote
      if (pathname === '/api/vote') {
        if (method === 'POST' && voteApi.onRequestPost) return await voteApi.onRequestPost(context);
      }

      // 4. /api/auth/*
      if (pathname === '/api/auth/login') {
        if (method === 'POST') return await loginApi.onRequestPost(context);
      }
      if (pathname === '/api/auth/register') {
        if (method === 'POST') return await registerApi.onRequestPost(context);
      }
      if (pathname === '/api/auth/me') {
        if (method === 'GET') return await meApi.onRequestGet(context);
      }
      if (pathname === '/api/auth/reset-password') {
        if (method === 'POST') return await resetPasswordApi.onRequestPost(context);
      }

      // 5. /api/orders/*
      if (pathname === '/api/orders/create' || pathname === '/api/orders') {
        if (method === 'POST') {
          const res = await ordersCreateApi.onRequestPost(context);
          if (res.status === 200) {
            await invalidateCatalogEdgeCache(ctx, request, env);
          }
          return res;
        }
      }

      // 6. /api/webhooks/sepay
      if (pathname === '/api/webhooks/sepay' || pathname === '/api/webhooks') {
        if (method === 'POST') return await sepayWebhookApi.onRequestPost(context);
        if (method === 'GET' && sepayWebhookApi.onRequestGet) return await sepayWebhookApi.onRequestGet(context);
      }

      // 7. /api/giveaways/claim
      if (pathname === '/api/giveaways/claim') {
        if (method === 'POST') {
          const res = await giveawaysClaimApi.onRequestPost(context);
          if (res.status === 200) {
            try {
              ctx.waitUntil(invalidateCatalogEdgeCache(ctx, request, env));
            } catch (cErr: any) {
              console.warn('[GiveawaysClaim] Edge cache purge non-fatal error:', cErr?.message);
            }
          }
          return res;
        }
      }

      // 8. /api/admin/migrate (PERMANENTLY LOCKED & DISABLED)
      if (pathname === '/api/admin/migrate') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'ENDPOINT_PERMANENTLY_LOCKED',
            message: 'Tuyến đường /api/admin/migrate đã được khóa vĩnh viễn sau khi hoàn tất di chuyển dữ liệu sang D1.',
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      // 8b. /api/admin/audit-counters (Counter Cache Audit & Drift Recovery)
      if (pathname === '/api/admin/audit-counters') {
        if (method === 'GET') return await adminAuditCountersApi.onRequestGet(context);
        if (method === 'POST') return await adminAuditCountersApi.onRequestPost(context);
        if (method === 'OPTIONS') return await adminAuditCountersApi.onRequestOptions(context);
      }

      // 8c. /api/admin/sepay-credit (Manual SePay Credit & Compensation)
      if (pathname === '/api/admin/sepay-credit') {
        if (method === 'POST') return await adminSepayCreditApi.onRequestPost(context);
        if (method === 'OPTIONS') return await adminSepayCreditApi.onRequestOptions(context);
      }

      // 8d. /api/crawl-article (AI Article Crawler & Extractor)
      if (pathname === '/api/crawl-article') {
        return await crawlArticleApi.onRequest(context);
      }

      // 8e. /api/game-icon (Edge Game Icon Proxy & Caching)
      if (pathname === '/api/game-icon') {
        if (method === 'OPTIONS') return await gameIconApi.onRequestOptions();
        return await gameIconApi.onRequestGet(context);
      }

      // Fallback for any unknown /api route
      if (pathname.startsWith('/api')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Endpoint not found', path: pathname }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      // Static assets fallback (SPA routing with Edge SEO & Social Meta Injection)
      const userAgent = request.headers.get('User-Agent') || '';
      const isCrawler = /facebookexternalhit|ZaloBot|TelegramBot|Twitterbot|LinkedInBot|Slackbot|WhatsApp|Viber/i.test(userAgent);
      const isGiveawayShareQuery = (url.searchParams.has('gw') || url.searchParams.has('giveaway')) && (pathname === '/giveaways' || pathname === '/giveaway');

      if (request.method === 'GET' && isCrawler && isGiveawayShareQuery) {
        return await renderSeoHtml(request, env, pathname);
      }

      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status === 404 && request.method === 'GET' && !pathname.match(/\.[a-zA-Z0-9]+$/)) {
        return await renderSeoHtml(request, env, pathname);
      }
      return assetResponse;
    } catch (err: any) {
      console.error('Worker API error:', err);
      return new Response(
        JSON.stringify({ success: false, error: err?.message || 'Server Internal Error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};

/**
 * Cloudflare Edge SEO Engine: Injects dynamic Open Graph, Twitter Cards,
 * Page Titles, Canonical URLs, and Schema.org JSON-LD for individual game pages
 * and major sections before returning HTML to crawlers & users.
 */
async function renderSeoHtml(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response> {
  const indexUrl = new URL('/', request.url);
  const baseRes = await env.ASSETS.fetch(new Request(indexUrl, request));
  if (baseRes.status !== 200) {
    return baseRes;
  }

  let html = await baseRes.text();
  const origin = 'https://codegame.shop';

  const replaceTitleAndMeta = (
    title: string,
    description: string,
    canonicalPath: string,
    ogImage: string,
    extraLdJson?: any
  ) => {
    const fullCanonical = `${origin}${canonicalPath}`;
    const fullOgImage = ogImage.startsWith('http') ? ogImage : `${origin}${ogImage}`;

    // 1. Title
    html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);

    // 2. Meta description
    html = html.replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${description}" />`);

    // 3. Canonical
    html = html.replace(/<link rel="canonical" href=".*?" \/>/i, `<link rel="canonical" href="${fullCanonical}" />`);

    // 4. Open Graph tags
    html = html.replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${title}" />`);
    html = html.replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${description}" />`);
    html = html.replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${fullCanonical}" />`);
    html = html.replace(/<meta property="og:image" content=".*?" \/>/i, `<meta property="og:image" content="${fullOgImage}" />\n    <meta property="og:image:type" content="image/jpeg" />\n    <meta property="og:image:width" content="512" />\n    <meta property="og:image:height" content="512" />`);

    // 5. Twitter tags
    html = html.replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${title}" />`);
    html = html.replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${description}" />`);
    html = html.replace(/<meta name="twitter:url" content=".*?" \/>/i, `<meta name="twitter:url" content="${fullCanonical}" />`);
    html = html.replace(/<meta name="twitter:image" content=".*?" \/>/i, `<meta name="twitter:image" content="${fullOgImage}" />`);

    // 6. Inject Schema.org JSON-LD
    if (extraLdJson) {
      const ldStr = `\n    <!-- Page-Specific Schema.org JSON-LD -->\n    <script type="application/ld+json">\n${JSON.stringify(extraLdJson, null, 2)}\n    </script>\n  </head>`;
      html = html.replace('</head>', ldStr);
    }
  };

  if (pathname.startsWith('/game/') || pathname.startsWith('/g/')) {
    const slug = pathname.replace(/^\/(?:game|g)\//i, '').replace(/\/$/, '').trim().toLowerCase();
    let game: any = null;
    if (env.DB) {
      try {
        const catalog = await gamesApi.getLoadedCatalog(env.DB);
        // Prioritize exact match on slug or id first
        game = catalog.games.find((g) => g.slug.toLowerCase() === slug || g.id.toLowerCase() === slug) ||
               catalog.games.find((g) => g.slug.toLowerCase().replace(/-mobile$/i, '') === slug.replace(/-mobile$/i, ''));
      } catch {}
    }

    if (game) {
      const codeCount = game.codes_count || game.codes?.length || 0;
      const countSuffix = codeCount > 0 ? `Nhận ${codeCount} Mã Code ` : '';
      const title = `Giftcode ${game.name} Mới Nhất 2026 - ${countSuffix}| CodeGame.shop`;
      const description = `Tổng hợp ${codeCount > 0 ? codeCount + ' ' : ''}mã giftcode ${game.name} còn hạn mới nhất 2026. Hướng dẫn nhập code chi tiết và phần thưởng tân thủ bản quyền G1.`;
      const rawIcon = game.icon_url || `/game_icons/${game.slug}.jpg`;
      const jpgIcon = rawIcon.replace(/\.webp$/i, '.jpg');
      const iconUrl = jpgIcon.startsWith('http') ? jpgIcon : `${origin}${jpgIcon.startsWith('/') ? jpgIcon : `/${jpgIcon}`}`;

      const gameSchema = {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        "name": game.name,
        "url": `${origin}/game/${game.slug}`,
        "image": iconUrl,
        "description": game.description || description,
        "gamePlatform": game.platform || "Mobile / PC",
        "applicationCategory": "Game",
        "publisher": {
          "@type": "Organization",
          "name": game.publisher || "NPH Chính Thức"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": String(game.rating || 4.8),
          "bestRating": "5",
          "ratingCount": "128"
        },
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "VND",
          "availability": "https://schema.org/InStock"
        }
      };

      replaceTitleAndMeta(title, description, `/game/${game.slug}`, iconUrl, gameSchema);
    }
  } else if (pathname === '/news' || pathname.startsWith('/news/')) {
    const newsSlug = pathname.replace(/^\/news\//i, '').replace(/\/$/, '').trim().toLowerCase();
    let article: any = null;
    if (newsSlug && env.DB) {
      try {
        const stmt = env.DB.prepare("SELECT value FROM settings WHERE key = 'wcg_news_articles_v1' LIMIT 1");
        const row: any = await stmt.first();
        const delStmt = env.DB.prepare("SELECT value FROM settings WHERE key = 'wcg_deleted_news_articles_v1' LIMIT 1");
        const delRow: any = await delStmt.first();
        const delSet = new Set(delRow?.value ? JSON.parse(delRow.value) : []);

        if (row?.value) {
          const list = JSON.parse(row.value);
          const found = list.find((a: any) => a.slug?.toLowerCase() === newsSlug || a.id?.toLowerCase() === newsSlug);
          if (found && !delSet.has(found.id) && !delSet.has(found.slug)) {
            article = found;
          }
        }
      } catch {}
    }

    if (article) {
      const title = `${article.title} | CodeGame.shop`;
      const description = article.summary || article.content?.slice(0, 160) || 'Tin tức game và sự kiện giftcode mới nhất.';
      const thumb = (article.cover_url && article.cover_url.trim()) || article.thumbnail_url || (article.game_slug ? `/game_icons/${article.game_slug}.webp` : '/og-image.jpg');
      replaceTitleAndMeta(title, description, `/news/${article.slug}`, thumb);
    } else {
      const title = 'Tin Tức Game & Sự Kiện Giftcode Mới Nhất 2026 | CodeGame.shop';
      const description = 'Cập nhật tin tức game mobile, giftcode tân thủ và sự kiện nhận quà hot nhất 2026 tại CodeGame.shop.';
      replaceTitleAndMeta(title, description, '/news', '/og-image.jpg');
    }
  } else if (
    pathname === '/giveaways' ||
    pathname.startsWith('/giveaways/') ||
    pathname === '/giveaway' ||
    pathname.startsWith('/giveaway/')
  ) {
    const urlObj = new URL(request.url);
    const rawGwId =
      pathname.replace(/^\/(?:giveaways|giveaway)\/?/i, '').split('/')[0].trim() ||
      urlObj.searchParams.get('gw') ||
      urlObj.searchParams.get('giveaway');

    let campaign: any = null;
    if (rawGwId) {
      const cleanGwId = decodeURIComponent(rawGwId).trim().toLowerCase();
      // 1. Thử lấy từ Cloudflare D1
      if (env.DB) {
        try {
          const stmt = env.DB.prepare("SELECT value FROM settings WHERE key = 'wcg_admin_giveaways_v4' LIMIT 1");
          const row: any = await stmt.first();
          if (row?.value) {
            const list = JSON.parse(row.value);
            if (Array.isArray(list)) {
              campaign = list.find((g: any) => g && (g.id?.toLowerCase() === cleanGwId || g.game_slug?.toLowerCase() === cleanGwId));
            }
          }
        } catch {}
      }

      // 2. Fallback sang danh sách tĩnh fallbackGiveawaysData
      if (!campaign && Array.isArray(fallbackGiveawaysData)) {
        campaign = (fallbackGiveawaysData as any[]).find(
          (g) => g && (g.id?.toLowerCase() === cleanGwId || g.game_slug?.toLowerCase() === cleanGwId)
        );
      }
    }

    if (campaign) {
      const gameName = campaign.game_name || 'Game Mobile';
      const gameSlug = campaign.game_slug || '';
      const title = `🎁 Nhận Code: ${campaign.title} - ${gameName} | CodeGame.shop`;
      const description = campaign.description
        ? `${campaign.description} Nhận mã quà tặng độc quyền ${gameName} miễn phí tại CodeGame.shop.`
        : `Nhận ngay ${campaign.title} cho tựa game ${gameName}. Số lượng có hạn, kiểm tra điều kiện tài khoản và nhận mã tức thì!`;

      // Ưu tiên JPG cho Zalo/Facebook preview
      const iconUrl = gameSlug ? `${origin}/game_icons/${gameSlug}.jpg` : `${origin}/og-image.jpg`;

      const giveawaySchema = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": `Săn Mã: ${campaign.title} - ${gameName}`,
        "description": description,
        "image": iconUrl,
        "startDate": campaign.start_time || "2026-01-01",
        "endDate": campaign.end_time || "2026-12-31",
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
        "location": { "@type": "VirtualLocation", "url": `${origin}/giveaways/${campaign.id}` },
        "organizer": { "@type": "Organization", "name": "CodeGame.shop", "url": origin },
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "VND", "availability": "https://schema.org/InStock" }
      };

      replaceTitleAndMeta(title, description, `/giveaways/${campaign.id}`, iconUrl, giveawaySchema);
    } else {
      const title = 'Sự Kiện Giveaway Nhận Giftcode Game Miễn Phí 2026 | CodeGame.shop';
      const description = 'Tham gia sự kiện giveaway nhận quà tân thủ, giftcode VIP độc quyền và thẻ game miễn phí mỗi ngày tại CodeGame.shop.';
      replaceTitleAndMeta(title, description, '/giveaways', '/og-image.jpg');
    }
  } else if (pathname === '/store' || pathname.startsWith('/store/')) {
    const title = 'Cửa Hàng Thẻ Game & Robux Giá Rẻ Uy Tín | CodeGame.shop';
    const description = 'Mua thẻ game, Robux giá rẻ, key bản quyền và nạp game chiết khấu cao tự động 24/7 tại CodeGame.shop.';
    replaceTitleAndMeta(title, description, '/store', '/og-image.jpg');
  } else if (pathname === '/utilities' || pathname.startsWith('/utilities/')) {
    const title = 'Tiện Ích Nạp Game, Tool Game & Key Bản Quyền | CodeGame.shop';
    const description = 'Dịch vụ tiện ích game, hỗ trợ game thủ nạp game an toàn, tốc độ và bảo mật cao tại CodeGame.shop.';
    replaceTitleAndMeta(title, description, '/utilities', '/og-image.jpg');
  }

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=600',
    },
  });
}
