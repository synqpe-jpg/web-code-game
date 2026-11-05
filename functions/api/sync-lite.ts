import { getMultipleSettingsD1, loadAllStoreProductsD1 } from '../services/d1_service';
import fallbackGamesData from '../../src/data/games188.json';
import fallbackGiveawaysData from '../../src/data/giveaways.json';
import { DEFAULT_NEWS_ARTICLES as fallbackNewsArticles } from '../../src/data/seedNews';
import { SEED_GAME_EVENTS } from '../../src/data/seedGameEvents';
import { DEFAULT_UPCOMING_GAMES as fallbackUpcomingGames } from '../../src/types/game';
import { DEFAULT_MARKETING_CONFIG } from '../../src/services/marketingService';
import canonicalBackupState from '../data/canonical_backup_state.json';
import { getActiveTombstonesMap, filterOutTombstones } from '../services/soft_delete_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  JWT_SECRET?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Requested-With, Cache-Control, cache-control, Pragma, pragma, Apikey, apikey, x-api-key, X-Api-Key',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: CORS_HEADERS });
};

/**
 * GET /api/sync-lite (Lightweight Homepage Data Sync)
 * Cung cấp gói dữ liệu tinh gọn cho trang chủ (dung lượng nén ~49KB, TTFB < 100ms)
 * Chỉ chứa các trường thiết yếu để vẽ màn hình đầu tiên, banner, autocomplete và tin mới nhất.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);

  const isNoCache = request.headers.get('Cache-Control')?.includes('no-cache') ||
                    request.headers.get('Pragma')?.includes('no-cache') ||
                    url.searchParams.has('nocache') ||
                    url.searchParams.has('fresh');

  const globalScope = globalThis as any;
  const nowMs = Date.now();
  const cfCache = typeof caches !== 'undefined' ? (caches as any).default : null;
  const cacheKey = new Request(url.toString(), { method: 'GET' });

  // 1. In-Memory Isolate Cache (< 5ms)
  if (!isNoCache && globalScope.__wcg_sync_lite_cache) {
    if (nowMs - globalScope.__wcg_sync_lite_cache.cachedAt < 60000) {
      return new Response(globalScope.__wcg_sync_lite_cache.bodyStr, {
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
          'X-Server-Time': new Date().toISOString(),
          'X-Cache-Status': 'HIT-ISOLATE',
          'cf-cache-status': 'HIT',
        },
      });
    }
  }

  // 2. Cloudflare Edge Cache API (< 50ms)
  if (!isNoCache && cfCache) {
    try {
      const cached = await cfCache.match(cacheKey);
      if (cached) {
        return cached;
      }
    } catch {}
  }

  try {
    let d1Settings: Record<string, any> = {};
    let tombstonesMap = new Map();
    let spList: any[] = [];

    if (env.DB) {
      const [tombstonesRes, settingsRes, storeProdsRes] = await Promise.all([
        getActiveTombstonesMap(env.DB),
        getMultipleSettingsD1(
          env.DB,
          [
            'wcg_admin_games_v5',
            'wcg_admin_games_v4',
            'wcg_admin_upcoming_games_v1',
            'wcg_game_events_v1',
            'wcg_deleted_game_events_v1',
            'wcg_admin_giveaways_v4',
            'wcg_deleted_giveaways',
            'wcg_news_articles_v1',
            'wcg_deleted_news_articles_v1',
            'wcg_admin_content_v4',
            'wcg_marketing_config_v1',
            'wcg_growth_config_v1',
            'wcg_admin_store_products_v4',
            'wcg_admin_store_categories_v4',
            'wcg_admin_store_categories_v1',
            'wcg_deleted_store_products',
          ],
          new Set(['wcg_news_articles_v1', 'wcg_admin_upcoming_games_v1', 'wcg_marketing_config_v1', 'wcg_game_events_v1'])
        ),
        loadAllStoreProductsD1(env.DB),
      ]);
      tombstonesMap = tombstonesRes || new Map();
      d1Settings = settingsRes || {};
      spList = storeProdsRes || [];
    }

    // 1. Games (Essential fields only: slug, name, icon, publisher, category, codes_count, rating, flags)
    const rawGames = (Array.isArray(d1Settings['wcg_admin_games_v5']) && d1Settings['wcg_admin_games_v5'].length > 0)
      ? d1Settings['wcg_admin_games_v5']
      : (Array.isArray(d1Settings['wcg_admin_games_v4']) && d1Settings['wcg_admin_games_v4'].length > 0)
        ? d1Settings['wcg_admin_games_v4']
        : (fallbackGamesData as any[]);

    const filteredGames = filterOutTombstones(rawGames, 'game', tombstonesMap, (g: any) => ({ id: g?.id, slug: g?.slug }));
    const liteGames = filteredGames.map((g: any) => {
      const slug = String(g.slug || g.id || '').trim().toLowerCase();
      let icon = g.icon_url || g.iconUrl || '';
      if (!icon || icon.includes('codemoi.net') || icon.includes('googleusercontent.com') || icon.startsWith('/game-icons')) {
        icon = `/game_icons/${slug}.webp`;
      }
      return {
        id: g.id || slug,
        name: g.name || slug,
        slug: slug,
        publisher: g.publisher || g.developer || '',
        category: g.category || '',
        rating: typeof g.rating === 'number' ? g.rating : 5,
        icon_url: icon,
        codes_count: typeof g.codes_count === 'number' ? g.codes_count : (typeof g.active_codes_count === 'number' ? g.active_codes_count : 0),
        active_codes_count: typeof g.active_codes_count === 'number' ? g.active_codes_count : (typeof g.codes_count === 'number' ? g.codes_count : 0),
        is_hot: Boolean(g.is_hot),
        is_new: Boolean(g.is_new),
        is_featured: Boolean(g.is_featured),
        platform: g.platform || 'Android, iOS, PC',
      };
    });

    // 2. Upcoming Games
    const rawUpcoming = d1Settings['wcg_admin_upcoming_games_v1'];
    const upcomingList = (Array.isArray(rawUpcoming) && rawUpcoming.length > 0) ? rawUpcoming : fallbackUpcomingGames;
    const upcomingGames = filterOutTombstones(upcomingList, 'upcoming_game', tombstonesMap, (g: any) => ({ id: g?.id, slug: g?.slug }));

    // 3. Active Game Events
    const rawEvents = d1Settings['wcg_game_events_v1'];
    const eventsList = (Array.isArray(rawEvents) && rawEvents.length > 0) ? rawEvents : SEED_GAME_EVENTS;
    const delEventsSet = new Set(Array.isArray(d1Settings['wcg_deleted_game_events_v1']) ? d1Settings['wcg_deleted_game_events_v1'] : []);
    const gameEvents = eventsList.filter((e: any) => e && e.id && !delEventsSet.has(e.id));

    // 4. Giveaways (Sanitized, Active, In-Stock First)
    const rawGws = d1Settings['wcg_admin_giveaways_v4'];
    const delGwSet = new Set(Array.isArray(d1Settings['wcg_deleted_giveaways']) ? d1Settings['wcg_deleted_giveaways'] : []);
    const gwCandidates = (Array.isArray(rawGws) && rawGws.length > 0) ? rawGws : (fallbackGiveawaysData as any[]);
    const giveaways = gwCandidates
      .filter((g: any) => g && g.id && !delGwSet.has(g.id) && g.id !== 'gw_alienware_vaultbreakers' && g.id !== 'gw_garena_delta_force')
      .map((gw: any) => {
        const { codes_pool, claim_history, ...rest } = gw;
        const isClosed = gw.is_active === false || gw.is_active === 0 || gw.status === 'PAUSED' || gw.status === 'CLOSED';
        const rem = gw.remaining_codes !== undefined && gw.remaining_codes !== null ? Number(gw.remaining_codes) : (Array.isArray(codes_pool) ? codes_pool.length : 0);
        return {
          ...rest,
          is_active: !isClosed,
          status: gw.status === 'ENDED' ? 'ENDED' : (isClosed ? 'PAUSED' : 'ACTIVE'),
          remaining_codes: isClosed ? 0 : rem,
        };
      })
      .sort((a: any, b: any) => (Number(b.remaining_codes) || 0) - (Number(a.remaining_codes) || 0));

    // 5. News Articles (Only latest 6 articles, summary fields without heavy markdown body)
    const rawNews = d1Settings['wcg_news_articles_v1'];
    const newsCandidates = (Array.isArray(rawNews) && rawNews.length > 0) ? rawNews : fallbackNewsArticles;
    const delNewsSet = new Set(Array.isArray(d1Settings['wcg_deleted_news_articles_v1']) ? d1Settings['wcg_deleted_news_articles_v1'] : []);
    const newsArticles = newsCandidates
      .filter((a: any) => a && a.id && !delNewsSet.has(a.id) && a.status !== 'DRAFT')
      .slice(0, 6)
      .map((a: any) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        cover_url: a.cover_url || a.cover_image || a.cover_image_url || '',
        cover_image: a.cover_image || a.cover_image_url || a.cover_url || '',
        game_slug: a.game_slug || '',
        game_name: a.game_name || '',
        excerpt: a.excerpt || (a.content ? String(a.content).slice(0, 150) + '...' : ''),
        category: a.category || 'Tin tức',
        tag: a.tag || 'Hot',
        published_at: a.published_at || a.created_at || new Date().toISOString(),
        status: a.status || 'PUBLISHED',
      }));

    // 6. Content (Branding, announcements)
    const content = Array.isArray(d1Settings['wcg_admin_content_v4']) && d1Settings['wcg_admin_content_v4'].length > 0
      ? d1Settings['wcg_admin_content_v4']
      : ((canonicalBackupState as any).content || []);

    // 7. Configs & Stats
    const marketingConfig = (d1Settings['wcg_marketing_config_v1'] && typeof d1Settings['wcg_marketing_config_v1'] === 'object')
      ? d1Settings['wcg_marketing_config_v1']
      : DEFAULT_MARKETING_CONFIG;

    const growthConfig = (d1Settings['wcg_growth_config_v1'] && typeof d1Settings['wcg_growth_config_v1'] === 'object')
      ? d1Settings['wcg_growth_config_v1']
      : ((canonicalBackupState as any).growthConfig || null);

    const elapsedMs = Math.max(0, Date.now() - 1793181600000);
    const masterCopyClicks = 93910 + Math.floor((elapsedMs / 60000) * 0.5);

    // 8. Store Products & Categories
    const delStoreSet = new Set(Array.isArray(d1Settings['wcg_deleted_store_products']) ? d1Settings['wcg_deleted_store_products'] : []);
    const savedStoreProductsRaw = d1Settings['wcg_admin_store_products_v4'];
    const savedStoreMap = new Map<string, any>();
    if (Array.isArray(savedStoreProductsRaw)) {
      savedStoreProductsRaw.forEach((sp: any) => {
        if (sp && sp.id) savedStoreMap.set(sp.id, sp);
      });
    }

    const storeProducts = (spList || [])
      .filter((p: any) => p && p.id && p.is_active !== 0 && p.is_active !== false && (p as any).is_active !== '0' && !delStoreSet.has(p.id))
      .map((p: any) => {
        const meta = savedStoreMap.get(p.id) || {};
        const finalStock = p.stock_quantity !== undefined
          ? Math.max(0, Number(p.stock_quantity) || 0)
          : Math.max(0, Number(meta.stock_quantity) || 0);
        return {
          id: p.id,
          sku: p.sku || meta.sku || undefined,
          title: p.title || meta.title || '',
          game_slug: p.game_slug || meta.game_slug || '',
          game_name: p.game_name || meta.game_name || '',
          original_price: Number(p.original_price ?? meta.original_price ?? 0),
          discount_percent: Number(p.discount_percent ?? meta.discount_percent ?? 0),
          current_price: Number(p.current_price ?? meta.current_price ?? 0),
          stock_quantity: finalStock,
          sold_count: Number(p.sold_count ?? meta.sold_count ?? 0),
          is_active: 1,
          package_type: (p.package_type && p.package_type !== 'pack') ? p.package_type : (meta.package_type || p.package_type || 'pack'),
          category: (p.category && p.category !== 'pack') ? p.category : (meta.category || p.category || meta.package_type || 'pack'),
          category_label: p.category_label || meta.category_label || '',
          cover_image_url: p.cover_image_url || meta.cover_image_url || meta.game_icon_url || '',
          game_icon_url: p.game_icon_url || meta.game_icon_url || meta.cover_image_url || '',
          description: p.description || meta.description || '',
          badge: p.badge || meta.badge || '',
          virtual_sold_count: p.virtual_sold_count !== undefined ? Number(p.virtual_sold_count) : Number(meta.virtual_sold_count ?? 0),
          show_sold_count: p.show_sold_count !== undefined ? Boolean(p.show_sold_count) : (meta.show_sold_count !== false),
          show_stock_count: p.show_stock_count !== undefined ? Boolean(p.show_stock_count) : (meta.show_stock_count !== false),
          product_images: (Array.isArray(p.product_images) && p.product_images.length > 0)
            ? p.product_images
            : (Array.isArray(meta.product_images) && meta.product_images.length > 0 ? meta.product_images : undefined),
          fomo_anchor_time: meta.fomo_anchor_time || (p as any).fomo_anchor_time || null,
          created_at: p.created_at || meta.created_at || undefined,
          show_warranty: p.show_warranty !== undefined ? Boolean(p.show_warranty) : Boolean(meta.show_warranty),
          warranty_text: p.warranty_text || meta.warranty_text || '',
        };
      });

    const rawStoreCats = d1Settings['wcg_admin_store_categories_v4'] || d1Settings['wcg_admin_store_categories_v1'];
    const storeCategories = Array.isArray(rawStoreCats) && rawStoreCats.length > 0
      ? rawStoreCats
      : [
          { id: 'pack', label: 'Gói nạp', icon: '📦', isSystem: true },
          { id: 'monthly', label: 'Thẻ tháng / Pass', icon: '🎫', isSystem: true },
          { id: 'gift', label: 'Code VIP', icon: '🎁', isSystem: true },
          { id: 'account', label: 'Tài khoản', icon: '🎮', isSystem: true },
        ];
    const deletedStoreProducts = Array.from(delStoreSet);

    const payload = {
      success: true,
      timestamp: new Date().toISOString(),
      serverTime: new Date().toISOString(),
      games: liteGames,
      totalGames: liteGames.length,
      upcomingGames,
      gameEvents,
      giveaways,
      newsArticles,
      content,
      marketingConfig,
      growthConfig,
      masterCopyClicks,
      storeProducts,
      storeCategories,
      deletedStoreProducts,
    };

    const bodyStr = JSON.stringify(payload);

    if (!isNoCache) {
      globalScope.__wcg_sync_lite_cache = {
        bodyStr,
        cachedAt: nowMs,
      };
    }

    const response = new Response(bodyStr, {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': isNoCache
          ? 'no-cache, no-store, must-revalidate'
          : 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
        'X-Server-Time': new Date().toISOString(),
        'X-Cache-Status': isNoCache ? 'BYPASS' : 'MISS',
      },
    });

    if (!isNoCache && cfCache && context.waitUntil) {
      try {
        context.waitUntil(cfCache.put(cacheKey, response.clone()));
      } catch {}
    }

    return response;
  } catch (err: any) {
    console.error('[API /api/sync-lite] Error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Sync-lite error',
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
