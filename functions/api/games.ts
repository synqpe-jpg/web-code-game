import { getMultipleSettingsD1 } from '../services/d1_service';
import { isCodeExpired, parseExpirationDate, decodeHtmlEntities } from '../../src/utils/codeUtils';
import fallbackGamesData from '../../src/data/games188.json';
import fallbackCodesData from '../../src/data/crawled_codes_188.json';

export interface Env {
  DB?: D1Database;
  ADMIN_SYNC_SECRET?: string;
  JWT_SECRET?: string;
}

export interface GiftCode {
  code: string;
  rewards: string;
  status: 'active' | 'expired' | 'verified';
  expiry?: string;
  source?: string;
  added_at?: string;
}

export interface GameItem {
  id: string;
  name: string;
  slug: string;
  publisher?: string;
  category?: string;
  rating?: number;
  icon_url?: string;
  banner_url?: string;
  description?: string;
  instructions?: string;
  platform?: string;
  so_giay_phep?: string;
  ngay_cap_phep?: string;
  release_date?: string;
  download_android?: string;
  download_ios?: string;
  download_pc?: string;
  google_play_url?: string;
  app_store_url?: string;
  android_package_name?: string;
  redeem_url?: string;
  is_featured?: boolean | number;
  is_hot?: boolean | number;
  is_new?: boolean | number;
  is_active?: boolean | number;
  codes_count?: number;
  codes?: GiftCode[];
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Requested-With',
};

// Shared Vietnamese text normalization & search matching engine
import {
  stripAccents,
  normalizeVietnamese,
  normalizeSearchText,
  hasVietnameseDiacritics,
  matchGameSearch,
  calculateGameSearchScore,
  smartVietnameseMatch,
  GAME_ACRONYM_MAP,
} from '../../src/utils/textUtils';

export {
  stripAccents,
  normalizeVietnamese,
  normalizeSearchText,
  hasVietnameseDiacritics,
  matchGameSearch,
  calculateGameSearchScore,
  smartVietnameseMatch,
  GAME_ACRONYM_MAP,
};

// In-Memory Isolation Cache in Cloudflare Workers
interface CatalogCache {
  games: GameItem[];
  allRawGames: any[];
  codesMap: Map<string, GiftCode[]>;
  categories: string[];
  lastFetchedAt: number;
}

let catalogCache: CatalogCache | null = null;
const CACHE_TTL_MS = 120 * 1000; // 120 seconds fast in-worker cache to protect Cloudflare D1 quota

// Single-game in-memory cache to eliminate repeated D1 queries on game detail pages
const singleGameCache = new Map<string, { game: GameItem; expiresAt: number }>();

export function invalidateGamesCatalogCache(): void {
  catalogCache = null;
  singleGameCache.clear();
}

/**
 * Trích xuất và hợp nhất toàn bộ mã giftcode khớp với game dựa trên mọi biến thể slug, id và tên game
 */
export function resolveCodesForGame(g: any, codesMap: Map<string, GiftCode[]>): GiftCode[] {
  if (!g) return [];
  const slug = String(g.slug || g.id || '').trim();
  const rawId = String(g.id || slug).trim();
  const normSlug = slug.toLowerCase();

  const possibleKeys = [
    normSlug,
    rawId.toLowerCase(),
    normSlug.replace(/-mobile$/i, ''),
    `${normSlug}-mobile`,
    normSlug.replace(/_/g, '-'),
  ];

  if (
    normSlug === 'pirate-legends' ||
    normSlug === 'huyen-thoai-hai-tac' ||
    rawId.toLowerCase() === 'pirate-legends' ||
    rawId.toLowerCase() === 'huyen-thoai-hai-tac'
  ) {
    possibleKeys.push('pirate-legends', 'huyen-thoai-hai-tac');
  }

  if (g.name) {
    const nameSlug = stripAccents(g.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    possibleKeys.push(nameSlug);
    const nameParts = g.name.split(/[:\-–]/).map((p: string) => stripAccents(p).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).filter(Boolean);
    possibleKeys.push(...nameParts);
  }

  const mergedCodesMap = new Map<string, GiftCode>();
  for (const k of possibleKeys) {
    const found = codesMap.get(k);
    if (found) {
      for (const c of found) {
        const cleanCode = String(c.code || '').trim().toUpperCase();
        if (cleanCode && !mergedCodesMap.has(cleanCode)) {
          mergedCodesMap.set(cleanCode, c);
        }
      }
    }
  }

  // If game object itself already carries codes
  if (Array.isArray(g.codes)) {
    for (const c of g.codes) {
      if (c && c.code) {
        const cleanCode = String(c.code).trim().toUpperCase();
        if (cleanCode && !mergedCodesMap.has(cleanCode)) {
          mergedCodesMap.set(cleanCode, c);
        }
      }
    }
  }

  const allCodes = Array.from(mergedCodesMap.values());
  allCodes.sort((a, b) => {
    const aActive = !isCodeExpired(a) ? 1 : 0;
    const bActive = !isCodeExpired(b) ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;

    const timeA = a.added_at ? new Date(a.added_at).getTime() : 0;
    const timeB = b.added_at ? new Date(b.added_at).getTime() : 0;
    return timeB - timeA;
  });

  return allCodes;
}

/**
 * Chuẩn hóa đối tượng GameItem với đầy đủ thông tin pháp lý, link store và danh sách mã
 */
export function formatGameItem(g: any, allCodes: GiftCode[]): GameItem {
  const slug = String(g.slug || g.id || '').trim();
  const rawId = String(g.id || slug).trim();
  const cat = g.category ? String(g.category).trim() : '';

  let iconUrl = g.icon_url || g.iconUrl || g.cover_image_url || '';
  if (iconUrl.includes('codemoi.net') || iconUrl.includes('googleusercontent.com') || iconUrl.startsWith('/game-icons') || iconUrl.startsWith('game-icons')) {
    iconUrl = '';
  }

  return {
    id: String(rawId),
    name: String(g.name || 'Game chưa đặt tên'),
    slug: String(slug),
    publisher: g.publisher || '',
    category: cat,
    rating: typeof g.rating === 'number' ? g.rating : 4.8,
    icon_url: iconUrl,
    banner_url: g.banner_url || g.bannerUrl || '',
    description: g.description || '',
    instructions: g.instructions || '',
    platform: g.platform || '',
    so_giay_phep: g.so_giay_phep || g.license_number || '',
    ngay_cap_phep: g.ngay_cap_phep || g.license_date || '',
    release_date: g.release_date || g.gp_release_date || '',
    download_android: g.download_android || g.google_play_url || g.downloadLinks?.android || '',
    download_ios: g.download_ios || g.app_store_url || g.downloadLinks?.ios || '',
    download_pc: g.download_pc || g.downloadLinks?.pc || '',
    google_play_url: g.google_play_url || g.download_android || g.downloadLinks?.android || '',
    app_store_url: g.app_store_url || g.download_ios || g.downloadLinks?.ios || '',
    android_package_name: g.android_package_name || (
      (g.google_play_url || g.download_android || '').match(/[?&]id=([a-zA-Z0-9._]+)/)?.[1] || ''
    ),
    redeem_url: g.redeem_url || g.redeemUrl || '',
    is_featured: Boolean(g.is_featured || g.isFeatured),
    is_hot: Boolean(g.is_hot || g.isHot),
    is_new: Boolean(g.is_new || g.isNew),
    is_active: g.is_active !== undefined ? Boolean(g.is_active) : true,
    codes_count: allCodes.filter((c) => !isCodeExpired(c)).length,
    active_codes_count: allCodes.filter((c) => !isCodeExpired(c)).length,
    expired_codes_count: allCodes.filter((c) => isCodeExpired(c)).length,
    total_codes_count: allCodes.length,
    codes: allCodes.map((c) => ({
      ...c,
      rewards: decodeHtmlEntities(c.rewards),
    })),
  };
}

/**
 * Loads authoritative games and free giftcodes from Cloudflare D1.
 * Indexes codes by game slug and computes codes_count.
 */
export async function getLoadedCatalog(
  db: D1Database,
  forceFresh: boolean = false,
  skipGamesList: boolean = false
): Promise<CatalogCache> {
  const now = Date.now();
  if (!forceFresh && catalogCache && now - catalogCache.lastFetchedAt < CACHE_TTL_MS) {
    if (!skipGamesList && (!catalogCache.games || catalogCache.games.length === 0)) {
      // Cần games list đầy đủ nhưng cache chỉ có rawGames
    } else {
      return catalogCache;
    }
  }

  const settings = await getMultipleSettingsD1(db, [
    'wcg_admin_games_v5',
    'wcg_admin_games_v4',
    'wcg_admin_free_codes_v5',
    'wcg_admin_free_codes_v4',
    'wcg_admin_custom_free_codes_v1',
    'wcg_deleted_free_codes',
    'wcg_admin_upcoming_games_v1',
  ]);

  const baseGames = (Array.isArray(settings['wcg_admin_games_v5']) && settings['wcg_admin_games_v5'].length > 0)
    ? settings['wcg_admin_games_v5']
    : ((Array.isArray(settings['wcg_admin_games_v4']) && settings['wcg_admin_games_v4'].length > 0)
      ? settings['wcg_admin_games_v4']
      : (fallbackGamesData as any[]));

  // Tự động chuyển các game sắp ra mắt đã mở server quá 24h xuống sàn game chính thức
  const rawGames = Array.isArray(baseGames) ? [...baseGames] : [];

  // Đồng bộ hóa liên kết tải ứng dụng chính thức (Google Play, App Store, PC) từ fallbackGamesData
  const fallbackMap = new Map<string, any>();
  if (Array.isArray(fallbackGamesData)) {
    for (const fg of fallbackGamesData as any[]) {
      if (fg && fg.slug) fallbackMap.set(String(fg.slug).toLowerCase(), fg);
    }
  }
  rawGames.forEach((g: any) => {
    if (!g || !g.slug) return;
    const fg = fallbackMap.get(String(g.slug).toLowerCase());
    if (fg) {
      if (!g.google_play_url && fg.google_play_url) g.google_play_url = fg.google_play_url;
      if (!g.download_android && fg.download_android) g.download_android = fg.download_android;
      if (!g.app_store_url && fg.app_store_url) g.app_store_url = fg.app_store_url;
      if (!g.download_ios && fg.download_ios) g.download_ios = fg.download_ios;
      if (!g.download_pc && fg.download_pc) g.download_pc = fg.download_pc;
      if (!g.android_package_name && fg.android_package_name) g.android_package_name = fg.android_package_name;
    }
  });
  const upcomingList = settings['wcg_admin_upcoming_games_v1'];
  if (Array.isArray(upcomingList)) {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const ug of upcomingList) {
      if (!ug || !ug.slug) continue;
      // Bỏ qua các game lịch sử đã LAUNCHED để bảo toàn danh mục chuẩn 560 game
      if (ug.status === 'LAUNCHED') continue;
      const target = new Date(ug.releaseDate).getTime();
      if (!isNaN(target) && (now - target) > ONE_DAY_MS) {
        const slugLower = ug.slug.toLowerCase();
        if (!rawGames.some((g: any) => (g.slug || '').toLowerCase() === slugLower || (g.id || '').toLowerCase() === slugLower)) {
          rawGames.unshift({
            id: ug.slug,
            slug: ug.slug,
            name: ug.name,
            publisher: ug.publisher || 'Nhà phát hành',
            category: ug.category || 'Game Mới',
            platform: ug.platform || 'Android, iOS, PC',
            icon_url: ug.iconUrl || `/game_icons/${ug.slug}.webp`,
            banner_url: ug.bannerUrl,
            description: ug.description || `Tổng hợp giftcode ${ug.name} mới nhất mừng mở server.`,
            instructions: 'Bước 1: Mở game > Nhấn Avatar nhân vật\nBước 2: Chọn Cài đặt > Nhập Giftcode\nBước 3: Dán mã và nhấn Xác nhận.',
            is_new: true,
            is_hot: true,
            release_date: ug.releaseDate ? ug.releaseDate.split('T')[0] : new Date().toISOString().split('T')[0],
          });
        }
      }
    }
  }

  // Combine all available sources: Custom codes, D1 catalog codes, and complete Master Bundled codes (fallbackCodesData)
  const d1Codes = (Array.isArray(settings['wcg_admin_free_codes_v5']) && settings['wcg_admin_free_codes_v5'].length > 0)
    ? settings['wcg_admin_free_codes_v5']
    : ((Array.isArray(settings['wcg_admin_free_codes_v4']) && settings['wcg_admin_free_codes_v4'].length > 0)
      ? settings['wcg_admin_free_codes_v4']
      : []);
  const bundledCodes = Array.isArray(fallbackCodesData) ? (fallbackCodesData as any[]) : [];
  const customCodes = settings['wcg_admin_custom_free_codes_v1'] || [];
  const deletedCodesSet = new Set<string>(
    Array.isArray(settings['wcg_deleted_free_codes']) ? settings['wcg_deleted_free_codes'] : []
  );

  const codesMap = new Map<string, GiftCode[]>();
  const seenCodesBySlug = new Map<string, Set<string>>();

  const addCode = (item: any, source: 'custom' | 'd1' | 'bundled') => {
    if (!item || (item.id && deletedCodesSet.has(item.id))) return;
    const slug = item.gameSlug || item.game_slug || item.slug || item.gameId;
    const codeVal = item.codeValue || item.code_value || item.code || item.gift_code;
    if (!slug || !codeVal) return;

    const normSlug = String(slug).trim().toLowerCase();
    const codeStr = String(codeVal).trim();
    const upperCode = codeStr.toUpperCase();

    let seenSet = seenCodesBySlug.get(normSlug);
    if (!seenSet) {
      seenSet = new Set<string>();
      seenCodesBySlug.set(normSlug, seenSet);
    }
    if (seenSet.has(upperCode)) return;
    seenSet.add(upperCode);

    const isExp = isCodeExpired(item);
    const list = codesMap.get(normSlug) || [];
    let expVal = item.expiresAt || item.expires_at || item.expiry || '';
    if (expVal === '2026-12-31' || expVal === '2026-12-31T23:59:59Z' || expVal === '31/12/2026') {
      expVal = '';
    }
    list.push({
      code: codeStr,
      rewards: decodeHtmlEntities(item.rewards || item.description || 'Quà tân thủ & vật phẩm ingame'),
      status: isExp ? 'expired' : 'active',
      expiry: expVal,
      added_at: item.updatedAt || item.updated_at || item.createdAt || item.created_at || (source === 'custom' ? new Date().toISOString() : '2026-10-09T00:00:00Z'),
    });
    codesMap.set(normSlug, list);
  };

  // 1. Process custom codes FIRST (highest priority: newly created or edited by admin)
  if (Array.isArray(customCodes)) {
    for (const item of customCodes) addCode(item, 'custom');
  }

  // 2. Process D1 catalog codes (from crawlers / admin pushes), skipping any deleted or already added
  if (Array.isArray(d1Codes)) {
    for (const item of d1Codes) addCode(item, 'd1');
  }

  // 3. Process complete Master Bundled codes (11,762 codes), preserving full baseline archive
  if (Array.isArray(bundledCodes)) {
    for (const item of bundledCodes) addCode(item, 'bundled');
  }

  const categorySet = new Set<string>();
  categorySet.add('Tất cả');

  const gamesList: GameItem[] = [];

  // Chỉ duyệt và định dạng 564 game khi thực sự cần hiển thị danh mục Catalog (không phải truy vấn chi tiết 1 game)
  if (!skipGamesList && Array.isArray(rawGames)) {
    for (let index = 0; index < rawGames.length; index++) {
      const g = rawGames[index];
      if (!g || g.status === 'INACTIVE' || g.is_active === false) continue;

      const allCodes = resolveCodesForGame(g, codesMap);

      // Strict Business Rule: CHỈ xuất bản game CÓ MÃ GIFTCODE HOẠT ĐỘNG lên Web Khách
      // Các game không có mã code (0 code) được giữ trong Hàng Chờ Duyệt (wcg_crawler_pending_games_v1)
      if (allCodes.length === 0) {
        continue;
      }

      const formatted = formatGameItem(g, allCodes);
      if (formatted.category) categorySet.add(formatted.category);
      gamesList.push(formatted);
    }
  }

  catalogCache = {
    games: gamesList.length > 0 ? gamesList : (catalogCache?.games || []),
    allRawGames: rawGames,
    codesMap,
    categories: Array.from(categorySet),
    lastFetchedAt: Date.now(),
  };

  return catalogCache;
}

/**
 * Tìm kiếm game khớp theo phân tầng 5 Tiers trong bất kỳ danh sách nào
 */
export function findMatchingGameInList(list: any[], cleanSlug: string, cleanWithoutMobile: string): any | null {
  if (!Array.isArray(list) || !cleanSlug) return null;

  // Tier 1: Exact Match on slug or id (Highest Priority)
  let found = list.find((g) => {
    if (!g) return false;
    const gSlug = (g.slug || '').toLowerCase();
    const gId = (g.id || '').toLowerCase();
    return gSlug === cleanSlug || gId === cleanSlug;
  });
  if (found) return found;

  // Tier 2: Exact Match on generated nameSlug
  found = list.find((g) => {
    if (!g || !g.name) return false;
    const nameSlug = stripAccents(g.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return nameSlug === cleanSlug;
  });
  if (found) return found;

  // Tier 3: Known Specific Aliases
  if (cleanSlug === 'huyen-thoai-hai-tac' || cleanSlug === 'pirate-legends') {
    found = list.find((g) => {
      if (!g) return false;
      const gSlug = (g.slug || '').toLowerCase();
      const gId = (g.id || '').toLowerCase();
      return gSlug === 'pirate-legends' || gSlug === 'huyen-thoai-hai-tac' || gId === 'pirate-legends' || gId === 'huyen-thoai-hai-tac';
    });
    if (found) return found;
  }

  // Tier 4: Exact Match without -mobile suffix (Only if no exact match found above)
  found = list.find((g) => {
    if (!g) return false;
    const gSlug = (g.slug || '').toLowerCase();
    const gId = (g.id || '').toLowerCase();
    return (
      gSlug.replace(/-mobile$/i, '') === cleanWithoutMobile ||
      gId.replace(/-mobile$/i, '') === cleanWithoutMobile
    );
  });
  if (found) return found;

  // Tier 5: Sub-parts of game title (Last resort fallback)
  found = list.find((g) => {
    if (!g || !g.name) return false;
    const parts = g.name.split(/[:\-–]/).map((p: string) => stripAccents(p).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).filter(Boolean);
    return parts.includes(cleanSlug) || parts.includes(cleanWithoutMobile);
  });

  return found || null;
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  if (!env.DB) {
    return new Response(
      JSON.stringify({ success: false, error: 'Database D1 chưa được cấu hình.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  try {
    const url = new URL(request.url);
    const forceFresh = url.searchParams.has('nocache') || url.searchParams.has('fresh');
    const requestedSlug = url.searchParams.get('slug') || url.searchParams.get('id');

    // 1. Single Game Details Query (?slug=... or ?id=...)
    // Tối ưu hóa D1 Direct SQL trước, fallback in-memory nếu chưa nạp vào table games
    if (requestedSlug) {
      let cleanSlug = requestedSlug.trim().toLowerCase();
      if (cleanSlug === 'doors') cleanSlug = 'doors-roblox';
      const cleanWithoutMobile = cleanSlug.replace(/-mobile$/i, '');

      if (!forceFresh) {
        const cached = singleGameCache.get(cleanSlug) || singleGameCache.get(cleanWithoutMobile);
        if (cached && Date.now() < cached.expiresAt) {
          return new Response(
            JSON.stringify({
              success: true,
              game: cached.game,
            }),
            {
              headers: {
                ...CORS_HEADERS,
                'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
                'X-Cache-Source': 'edge-memory',
              },
            }
          );
        }
      }

      // Tra cứu trực tiếp trong bảng games trên D1
      const gameRow = await env.DB.prepare(
        'SELECT * FROM games WHERE slug = ? OR id = ? OR slug = ? LIMIT 1'
      ).bind(cleanSlug, cleanSlug, cleanWithoutMobile).first<any>().catch(() => null);

      if (gameRow) {
        // Lấy toàn bộ mã giftcode từ bảng codes trên D1
        const codesRes = await env.DB.prepare(
          `SELECT code, rewards, status, expires_at, source, added_at 
           FROM codes 
           WHERE game_slug = ? 
           ORDER BY 
             CASE WHEN status = 'active' OR status = 'verified' THEN 0 ELSE 1 END,
             added_at DESC`
        ).bind(gameRow.slug).all<any>().catch(() => ({ results: [] as any[] }));

        let codesList: GiftCode[] = (codesRes?.results || []).map((c: any) => {
          const rawExp = c.expires_at || '';
          const isFakeExp = rawExp === '2026-12-31' || rawExp === '2026-12-31T23:59:59Z' || rawExp === '31/12/2026';
          return {
            code: c.code,
            rewards: c.rewards || 'Quà tân thủ & vật phẩm ingame',
            status: isCodeExpired(c) ? 'expired' : (c.status || 'active'),
            expiry: isFakeExp ? '' : rawExp,
            source: c.source || '',
            added_at: c.added_at || '2026-10-09T00:00:00Z',
          };
        });

        // Tự động đối chiếu với fallbackCodesData nếu bảng codes D1 chưa có mã (tránh scan D1 system_settings chậm)
        if (codesList.length === 0) {
          const fallbackList = (fallbackCodesData as any)?.[gameRow.slug] || 
                               (fallbackCodesData as any)?.[cleanSlug] || 
                               (fallbackCodesData as any)?.[cleanWithoutMobile];
          if (Array.isArray(fallbackList) && fallbackList.length > 0) {
            codesList = fallbackList.map((c: any) => {
              const rawExp = c.expiry || c.expires_at || '';
              const isFakeExp = rawExp === '2026-12-31' || rawExp === '2026-12-31T23:59:59Z' || rawExp === '31/12/2026';
              return {
                code: String(c.code || '').trim().toUpperCase(),
                rewards: c.rewards || 'Quà tân thủ & vật phẩm ingame',
                status: isCodeExpired(c) ? 'expired' : 'active',
                expiry: isFakeExp ? '' : rawExp,
                source: c.source || 'Fallback Catalog',
                added_at: c.added_at || '2026-10-09T00:00:00Z',
              };
            }).filter((c: any) => Boolean(c.code));

            // Tự động chữa lành (auto-heal) nạp vào bảng codes D1 trong nền không chặn request
            if (context.waitUntil) {
              const healTask = async () => {
                for (const mc of codesList) {
                  const cId = `code_${gameRow.slug}_${mc.code}`;
                  await env.DB.prepare(`
                    INSERT OR REPLACE INTO codes (id, game_slug, code, rewards, status, expires_at, source, added_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                  `).bind(cId, gameRow.slug, mc.code, mc.rewards, mc.status, mc.expiry || null, mc.source).run().catch(() => {});
                }
              };
              context.waitUntil(healTask());
            }
          }
        }

        let iconUrl = gameRow.icon_url || '';
        if (iconUrl.includes('codemoi.net') || iconUrl.startsWith('/game-icons')) {
          iconUrl = '';
        }

        let currentInstructions = gameRow.instructions !== undefined && gameRow.instructions !== null ? String(gameRow.instructions) : '';
        let currentRedeemUrl = gameRow.redeem_url !== undefined && gameRow.redeem_url !== null ? String(gameRow.redeem_url) : '';

        const fbGame = (fallbackGamesData as any[]).find((x: any) => x && (x.slug === gameRow.slug || x.id === gameRow.id || (gameRow.slug === 'doors-roblox' && x.slug === 'doors-roblox')));

        // Tự động lấy hướng dẫn chuẩn từ fallbackGamesData nếu bảng games D1 còn giữ văn mẫu Avatar cũ
        if (currentInstructions.includes('Avatar nhân vật')) {
          if (fbGame?.instructions && !fbGame.instructions.includes('Avatar nhân vật')) {
            currentInstructions = fbGame.instructions;
            if (fbGame.redeem_url) {
              currentRedeemUrl = fbGame.redeem_url;
            }
            // Đồng bộ ngược lại vào bảng games trên D1 trong nền không chặn request
            if (context.waitUntil) {
              const updateTask = env.DB.prepare('UPDATE games SET instructions = ?, redeem_url = ?, updated_at = datetime(\'now\') WHERE slug = ?')
                .bind(currentInstructions, currentRedeemUrl, gameRow.slug).run().catch(() => {});
              context.waitUntil(updateTask);
            }
          }
        }
        const finalPublisher = (gameRow.publisher && String(gameRow.publisher).trim()) ? gameRow.publisher : (fbGame?.publisher || '');
        const finalCategory = (gameRow.category && String(gameRow.category).trim()) ? gameRow.category : (fbGame?.category || '');
        const finalPlatform = (gameRow.platform && String(gameRow.platform).trim()) ? gameRow.platform : (fbGame?.platform || 'Android, iOS, PC');
        const finalIconUrl = iconUrl || fbGame?.icon_url || `/game_icons/${gameRow.slug}.webp`;
        const finalName = gameRow.name === 'Thực Thần Ký' ? 'Thức Thần Ký' : (gameRow.name || fbGame?.name || '');

        const finalPlay = (gameRow.google_play_url && String(gameRow.google_play_url).trim())
          ? gameRow.google_play_url
          : (gameRow.download_android && String(gameRow.download_android).trim())
          ? gameRow.download_android
          : (fbGame?.google_play_url || fbGame?.download_android || '');

        const finalIos = (gameRow.app_store_url && String(gameRow.app_store_url).trim())
          ? gameRow.app_store_url
          : (gameRow.download_ios && String(gameRow.download_ios).trim())
          ? gameRow.download_ios
          : (fbGame?.app_store_url || fbGame?.download_ios || '');

        const finalPc = (gameRow.download_pc && String(gameRow.download_pc).trim())
          ? gameRow.download_pc
          : (fbGame?.download_pc || '');

        const finalPkg = gameRow.android_package_name || fbGame?.android_package_name || (finalPlay.match(/[?&]id=([a-zA-Z0-9._]+)/)?.[1] || '');

        const authoritativeGame: GameItem = {
          id: String(gameRow.id || gameRow.slug),
          name: String(finalName),
          slug: String(gameRow.slug),
          publisher: finalPublisher,
          category: finalCategory,
          rating: typeof gameRow.rating === 'number' ? gameRow.rating : (fbGame?.rating || 4.8),
          icon_url: finalIconUrl,
          banner_url: gameRow.banner_url || fbGame?.banner_url || '',
          description: gameRow.description || fbGame?.description || '',
          instructions: currentInstructions || fbGame?.instructions || '',
          platform: finalPlatform,
          so_giay_phep: gameRow.so_giay_phep || '',
          ngay_cap_phep: gameRow.ngay_cap_phep || '',
          release_date: gameRow.release_date || '',
          download_android: finalPlay,
          download_ios: finalIos,
          download_pc: finalPc,
          google_play_url: finalPlay,
          app_store_url: finalIos,
          android_package_name: finalPkg,
          redeem_url: currentRedeemUrl,
          is_featured: Boolean(gameRow.is_featured),
          is_hot: Boolean(gameRow.is_hot),
          is_new: Boolean(gameRow.is_new),
          is_active: gameRow.is_active !== undefined ? Boolean(gameRow.is_active) : true,
          codes_count: codesList.filter((c) => !isCodeExpired(c)).length,
          active_codes_count: codesList.filter((c) => !isCodeExpired(c)).length,
          expired_codes_count: codesList.filter((c) => isCodeExpired(c)).length,
          total_codes_count: codesList.length,
          codes: codesList,
          codes_pool_complete: true,
        };

        singleGameCache.set(cleanSlug, { game: authoritativeGame, expiresAt: Date.now() + 120000 });
        singleGameCache.set(cleanWithoutMobile, { game: authoritativeGame, expiresAt: Date.now() + 120000 });

        return new Response(
          JSON.stringify({
            success: true,
            game: authoritativeGame,
          }),
          {
            headers: {
              ...CORS_HEADERS,
              'Cache-Control': forceFresh ? 'no-cache, no-store, must-revalidate' : 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
            },
          }
        );
      }

      // Fallback siêu tốc từ Canonical Datasets nếu game chưa có trong bảng games D1 (0 D1 reads)
      const staticGame = (fallbackGamesData as any[]).find((g: any) =>
        (g.slug || '').toLowerCase() === cleanSlug ||
        (g.id || '').toLowerCase() === cleanSlug ||
        (g.slug || '').toLowerCase() === cleanWithoutMobile
      );
      if (staticGame) {
        const matchedCodesRaw = (fallbackCodesData as any)?.[staticGame.slug] || 
                                (fallbackCodesData as any)?.[cleanSlug] || 
                                (fallbackCodesData as any)?.[cleanWithoutMobile] || 
                                staticGame.codes || [];
        const matchedGame = formatGameItem(staticGame, matchedCodesRaw);
        const finalGame = { ...matchedGame, codes_pool_complete: true };
        singleGameCache.set(cleanSlug, { game: finalGame, expiresAt: Date.now() + 120000 });
        singleGameCache.set(cleanWithoutMobile, { game: finalGame, expiresAt: Date.now() + 120000 });
        return new Response(
          JSON.stringify({
            success: true,
            game: finalGame,
            note: 'Dữ liệu được bảo toàn từ bản sao lưu hợp lệ (In-Memory Fast Delivery)',
          }),
          {
            headers: {
              ...CORS_HEADERS,
              'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
              'X-Cache-Source': 'edge-in-memory',
            },
          }
        );
      }

      // Fallback cuối cùng nếu không có trong static datasets
      const catalog = await getLoadedCatalog(env.DB, forceFresh, true);
      const rawFound = findMatchingGameInList(catalog.allRawGames, cleanSlug, cleanWithoutMobile);
      if (!rawFound) {
        return new Response(
          JSON.stringify({ success: false, error: 'Không tìm thấy trò chơi.' }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      const codes = resolveCodesForGame(rawFound, catalog.codesMap);
      const matchedGame = formatGameItem(rawFound, codes);

      return new Response(
        JSON.stringify({
          success: true,
          game: { ...matchedGame, codes_pool_complete: true },
        }),
        {
          headers: {
            ...CORS_HEADERS,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // Kiểm tra số lượng game trong bảng D1 games để phân nhánh SQL hoặc Fallback
    const d1GamesCountCheck = await env.DB.prepare('SELECT COUNT(*) as cnt FROM games WHERE is_active = 1 AND total_codes_count > 0').first<any>().catch(() => null);
    const d1GamesCount = Number(d1GamesCountCheck?.cnt || 0);

    // 2. Autocomplete Search Query (?autocomplete=1&search=...)
    if (url.searchParams.get('autocomplete') === '1' || url.searchParams.has('autocomplete')) {
      const q = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();
      const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '8', 10)));

      if (!q) {
        return new Response(
          JSON.stringify({ success: true, games: [], codes: [], totalMatches: 0 }),
          { headers: CORS_HEADERS }
        );
      }

      if (d1GamesCount >= 10) {
        const pattern = `%${q}%`;

        const [gamesRes, codesRes] = await Promise.all([
          env.DB.prepare(`
            SELECT id, name, slug, publisher, category, icon_url, active_codes_count, total_codes_count, is_hot, is_featured, is_new
            FROM games
            WHERE is_active = 1 AND (status IS NULL OR UPPER(status) IN ('ACTIVE', 'PUBLISHED'))
          `).all<any>().catch(() => ({ results: [] as any[] })),

          env.DB.prepare(`
            SELECT codes.code, codes.rewards, codes.status, codes.expires_at, games.slug as game_slug, games.name as game_name, games.icon_url as game_icon_url
            FROM codes
            JOIN games ON games.slug = codes.game_slug
            WHERE (codes.code LIKE ? OR codes.rewards LIKE ?) AND games.is_active = 1
            LIMIT ?
          `).bind(pattern, pattern, limit).all<any>().catch(() => ({ results: [] as any[] })),
        ]);

        const rawList = gamesRes?.results || [];
        const topGames = rawList
          .map((g: any) => {
            const scoreRes = calculateGameSearchScore(g, q);
            const isMatch = scoreRes.score > 0 || matchGameSearch(g, q);
            return {
              game: g,
              score: isMatch ? (scoreRes.score > 0 ? scoreRes.score : 5000) : 0,
            };
          })
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((item) => ({
            ...item.game,
            codes_count: Number(item.game.active_codes_count !== undefined && item.game.active_codes_count !== null ? item.game.active_codes_count : (item.game.codes_count || item.game.total_codes_count || 0)),
            icon_url: item.game.icon_url || `/game_icons/${item.game.slug}.webp`,
            codes: [],
          }));

        const topCodes = (codesRes?.results || []).map((c: any) => ({
          game: {
            slug: c.game_slug,
            name: c.game_name,
            icon_url: c.game_icon_url || `/game_icons/${c.game_slug}.webp`,
          },
          code: {
            code: c.code,
            rewards: c.rewards,
            status: c.status,
            expiry: (c.expires_at === '2026-12-31' || c.expires_at === '2026-12-31T23:59:59Z' || c.expires_at === '31/12/2026') ? '' : (c.expires_at || ''),
          },
        }));

        return new Response(
          JSON.stringify({
            success: true,
            games: topGames,
            codes: topCodes,
            totalMatches: topGames.length + topCodes.length,
          }),
          {
            headers: {
              ...CORS_HEADERS,
              'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=60',
            },
          }
        );
      }

      // Fallback in-memory
      const catalog = await getLoadedCatalog(env.DB, forceFresh, false);

      const scoredGames: Array<{ game: GameItem; score: number }> = [];
      const matchedCodes: Array<{ game: GameItem; code: GiftCode; score: number }> = [];
      const seenCodeKeys = new Set<string>();

      for (const game of catalog.games) {
        const scoreRes = calculateGameSearchScore(game, q);
        if (scoreRes.score > 0) {
          scoredGames.push({
            game: {
              ...game,
              codes: (game.codes || []).slice(0, 2),
            },
            score: scoreRes.score,
          });
        }

        const codes = game.codes || [];
        for (const code of codes) {
          const codeKey = `${game.id}_${code.code}`;
          if (!seenCodeKeys.has(codeKey)) {
            const codeVal = (code.code || '').trim().toLowerCase();
            const cleanQ = q.toLowerCase();
            let codeScore = 0;
            if (codeVal === cleanQ) {
              codeScore = 10000;
            } else if (codeVal.startsWith(cleanQ)) {
              codeScore = 8000;
            } else if (codeVal.includes(cleanQ)) {
              codeScore = 6000;
            } else if (smartVietnameseMatch([code.code, code.rewards], q)) {
              codeScore = 4000;
            } else if (scoreRes.score >= 6000) {
              codeScore = scoreRes.score - 2000;
            }

            if (codeScore > 0) {
              seenCodeKeys.add(codeKey);
              matchedCodes.push({ game, code, score: codeScore });
            }
          }
        }
      }

      scoredGames.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const cntA = a.game.codes_count || 0;
        const cntB = b.game.codes_count || 0;
        if (cntB !== cntA) return cntB - cntA;
        return a.game.name.localeCompare(b.game.name);
      });

      matchedCodes.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aActive = a.code.status === 'active' || a.code.status === 'verified' ? 1 : 0;
        const bActive = b.code.status === 'active' || b.code.status === 'verified' ? 1 : 0;
        return bActive - aActive;
      });

      const topGames = scoredGames.slice(0, limit).map((item) => item.game);
      const topCodes = matchedCodes.slice(0, limit).map((item) => ({ game: item.game, code: item.code }));

      return new Response(
        JSON.stringify({
          success: true,
          games: topGames,
          codes: topCodes,
          totalMatches: scoredGames.length + matchedCodes.length,
        }),
        {
          headers: {
            ...CORS_HEADERS,
            'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=60',
          },
        }
      );
    }

    // 3. User Bookmarks Query by list of slugs (?slugs=slug1,slug2,...)
    const slugsParam = url.searchParams.get('slugs');
    if (slugsParam) {
      const slugList = slugsParam
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const slugSet = new Set(slugList);

      if (d1GamesCount >= 10 && slugList.length > 0) {
        const placeholders = slugList.map(() => '?').join(',');
        const bookmarkedRowsRes = await env.DB.prepare(`
          SELECT id, name, slug, publisher, category, platform, rating, icon_url,
                 active_codes_count, total_codes_count, last_code_at, is_hot, is_new, is_featured
          FROM games
          WHERE slug IN (${placeholders}) OR id IN (${placeholders})
        `).bind(...slugList, ...slugList).all<any>().catch(() => ({ results: [] as any[] }));

        const bookmarkedGames = (bookmarkedRowsRes?.results || []).map((r: any) => ({
          id: String(r.id || r.slug),
          name: String(r.name),
          slug: String(r.slug),
          publisher: r.publisher || '',
          category: r.category || '',
          platform: r.platform || '',
          rating: typeof r.rating === 'number' ? r.rating : 4.8,
          icon_url: r.icon_url || '',
          codes_count: Number(r.active_codes_count !== undefined && r.active_codes_count !== null ? r.active_codes_count : (r.codes_count || r.total_codes_count || 0)),
          codes: [],
          is_hot: Boolean(r.is_hot),
          is_new: Boolean(r.is_new),
        }));

        return new Response(
          JSON.stringify({
            success: true,
            games: bookmarkedGames,
            total: bookmarkedGames.length,
          }),
          {
            headers: {
              ...CORS_HEADERS,
              'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
            },
          }
        );
      }

      const catalog = await getLoadedCatalog(env.DB, forceFresh, false);
      const bookmarkedGames = catalog.games
        .filter((g) => slugSet.has(g.slug.toLowerCase()) || slugSet.has(g.id.toLowerCase()))
        .map((g) => ({
          ...g,
          codes: (g.codes || []).slice(0, 3),
        }));

      return new Response(
        JSON.stringify({
          success: true,
          games: bookmarkedGames,
          total: bookmarkedGames.length,
        }),
        {
          headers: {
            ...CORS_HEADERS,
            'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
          },
        }
      );
    }

    // 4. Server-Side Paginated Catalog Query (P0, P1, P2: 100% SQL on D1, No heavy fields, Precomputed codes_count)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    // Limit: mặc định 24, tối đa 48 theo đúng yêu cầu P0
    const rawLimit = parseInt(url.searchParams.get('limit') || '24', 10);
    const limit = Math.min(48, Math.max(1, isNaN(rawLimit) ? 24 : rawLimit));
    const searchQuery = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();
    const category = (url.searchParams.get('category') || 'all').trim();
    const tag = (url.searchParams.get('tag') || 'all').trim();
    // Hỗ trợ cả 2 chuẩn tham số sort: mới (sort=newest|name_asc|name_desc|most_codes|rating) và cũ (sortBy & sortOrder)
    const sortParam = (url.searchParams.get('sort') || url.searchParams.get('sortBy') || '').trim().toLowerCase();
    const sortOrderParam = (url.searchParams.get('sortOrder') || '').trim().toLowerCase();

    if (d1GamesCount >= 10) {
      // When searchQuery is present: execute unified matchGameSearch & calculateGameSearchScore
      if (searchQuery) {
        const whereConditions: string[] = ["is_active = 1 AND (status IS NULL OR UPPER(status) IN ('ACTIVE', 'PUBLISHED')) AND total_codes_count > 0"];
        const bindParams: any[] = [];

        if (category && category !== 'all' && category !== 'Tất cả') {
          whereConditions.push('category = ?');
          bindParams.push(category);
        }
        if (tag === 'hot') {
          whereConditions.push('is_hot = 1');
        } else if (tag === 'new') {
          whereConditions.push('is_new = 1');
        } else if (tag === 'has_codes') {
          whereConditions.push('active_codes_count > 0');
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
        const candidatesRes = await env.DB.prepare(`
          SELECT
            id, name, slug, publisher, category, platform, rating, icon_url,
            active_codes_count, total_codes_count, last_code_at,
            is_hot, is_new, is_featured, release_date
          FROM games
          ${whereClause}
        `).bind(...bindParams).all<any>().catch(() => ({ results: [] as any[] }));

        const candidates = candidatesRes?.results || [];

        // Score and filter using unified shared search logic
        const scored = candidates
          .map((g: any) => {
            const scoreRes = calculateGameSearchScore(g, searchQuery);
            const isMatch = scoreRes.score > 0 || matchGameSearch(g, searchQuery);
            const score = isMatch ? (scoreRes.score > 0 ? scoreRes.score : 5000) : 0;
            return { game: g, score };
          })
          .filter((item) => item.score > 0);

        // Sorting
        if (sortParam === 'newest' || sortParam === 'release_date') {
          scored.sort((a, b) => (b.game.release_date || '').localeCompare(a.game.release_date || ''));
        } else if (sortParam === 'name_asc' || (sortParam === 'name' && sortOrderParam === 'asc')) {
          scored.sort((a, b) => (a.game.name || '').localeCompare(b.game.name || ''));
        } else if (sortParam === 'name_desc' || (sortParam === 'name' && sortOrderParam === 'desc')) {
          scored.sort((a, b) => (b.game.name || '').localeCompare(a.game.name || ''));
        } else if (sortParam === 'most_codes' || sortParam === 'codes_count') {
          scored.sort((a, b) => Number(b.game.active_codes_count || 0) - Number(a.game.active_codes_count || 0));
        } else if (sortParam === 'rating') {
          scored.sort((a, b) => Number(b.game.rating || 0) - Number(a.game.rating || 0));
        } else {
          scored.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return Number(b.game.active_codes_count || 0) - Number(a.game.active_codes_count || 0);
          });
        }

        const total = scored.length;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const safePage = Math.min(Math.max(1, page), totalPages);
        const offset = (safePage - 1) * limit;

        const rows = scored.slice(offset, offset + limit).map((item) => {
          const r = item.game;
          return {
            id: String(r.id || r.slug),
            name: String(r.name),
            slug: String(r.slug),
            publisher: r.publisher || '',
            category: r.category || '',
            platform: r.platform || '',
            rating: typeof r.rating === 'number' ? r.rating : 4.8,
            icon_url: r.icon_url || '',
            active_codes_count: Number(r.active_codes_count !== undefined && r.active_codes_count !== null ? r.active_codes_count : 0),
            total_codes_count: Number(r.total_codes_count || 0),
            codes_count: Number(r.active_codes_count !== undefined && r.active_codes_count !== null ? r.active_codes_count : (r.codes_count || r.total_codes_count || 0)),
            last_code_at: r.last_code_at || null,
            is_hot: Boolean(r.is_hot),
            is_new: Boolean(r.is_new),
            is_featured: Boolean(r.is_featured),
          };
        });

        const catRes = await env.DB.prepare(
          "SELECT DISTINCT category FROM games WHERE is_active = 1 AND (status IS NULL OR UPPER(status) IN ('ACTIVE', 'PUBLISHED')) AND total_codes_count > 0 AND category IS NOT NULL AND category != '' ORDER BY category ASC"
        ).all<any>().catch(() => ({ results: [] as any[] }));
        const categories = ['Tất cả', ...(catRes?.results || []).map((c: any) => c.category).filter(Boolean)];

        return new Response(
          JSON.stringify({
            success: true,
            page: safePage,
            limit,
            total,
            totalPages,
            hasMore: safePage < totalPages,
            games: rows,
            categories,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: {
              ...CORS_HEADERS,
              'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=600',
            },
          }
        );
      }

      // 100% PURE SQL ON D1 (when no search query)
      const whereConditions: string[] = ["is_active = 1 AND (status IS NULL OR UPPER(status) IN ('ACTIVE', 'PUBLISHED')) AND total_codes_count > 0"];
      const bindParams: any[] = [];

      // Category filter
      if (category && category !== 'all' && category !== 'Tất cả') {
        whereConditions.push('category = ?');
        bindParams.push(category);
      }

      // Tag filter
      if (tag === 'hot') {
        whereConditions.push('is_hot = 1');
      } else if (tag === 'new') {
        whereConditions.push('is_new = 1');
      } else if (tag === 'has_codes') {
        whereConditions.push('active_codes_count > 0');
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      // Order By
      let orderByClause = 'ORDER BY last_code_at DESC, release_date DESC';
      if (sortParam === 'newest' || sortParam === 'release_date') {
        orderByClause = 'ORDER BY release_date DESC, last_code_at DESC';
      } else if (sortParam === 'name_asc' || (sortParam === 'name' && sortOrderParam === 'asc')) {
        orderByClause = 'ORDER BY name COLLATE NOCASE ASC';
      } else if (sortParam === 'name_desc' || (sortParam === 'name' && sortOrderParam === 'desc')) {
        orderByClause = 'ORDER BY name COLLATE NOCASE DESC';
      } else if (sortParam === 'most_codes' || sortParam === 'codes_count') {
        orderByClause = 'ORDER BY active_codes_count DESC, total_codes_count DESC';
      } else if (sortParam === 'rating') {
        orderByClause = 'ORDER BY rating DESC, active_codes_count DESC';
      } else if (sortParam === 'updated') {
        orderByClause = 'ORDER BY last_code_at DESC';
      }

      // Truy vấn đếm tổng số bản ghi khớp điều kiện
      const countRes = await env.DB.prepare(
        `SELECT COUNT(*) as total FROM games ${whereClause}`
      ).bind(...bindParams).first<any>();
      const total = Number(countRes?.total || 0);
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(Math.max(1, page), totalPages);
      const offset = (safePage - 1) * limit;

      // P2: List API CHỈ trả các trường nhẹ phục vụ lưới game, KHÔNG trả description/instructions/codes array
      const listQuery = `
        SELECT
          id, name, slug, publisher, category, platform, rating, icon_url,
          active_codes_count, total_codes_count, last_code_at,
          is_hot, is_new, is_featured
        FROM games
        ${whereClause}
        ${orderByClause}
        LIMIT ? OFFSET ?
      `;
      const rowsRes = await env.DB.prepare(listQuery).bind(...bindParams, limit, offset).all<any>();
      const rows = (rowsRes?.results || []).map((r: any) => ({
        id: String(r.id || r.slug),
        name: String(r.name),
        slug: String(r.slug),
        publisher: r.publisher || '',
        category: r.category || '',
        platform: r.platform || '',
        rating: typeof r.rating === 'number' ? r.rating : 4.8,
        icon_url: r.icon_url || '',
        active_codes_count: Number(r.active_codes_count !== undefined && r.active_codes_count !== null ? r.active_codes_count : 0),
        total_codes_count: Number(r.total_codes_count || 0),
        codes_count: Number(r.active_codes_count !== undefined && r.active_codes_count !== null ? r.active_codes_count : (r.codes_count || r.total_codes_count || 0)),
        last_code_at: r.last_code_at || null,
        is_hot: Boolean(r.is_hot),
        is_new: Boolean(r.is_new),
        is_featured: Boolean(r.is_featured),
      }));

      // Lấy danh mục distinct cho filter bar
      const catRes = await env.DB.prepare(
        "SELECT DISTINCT category FROM games WHERE is_active = 1 AND (status IS NULL OR UPPER(status) IN ('ACTIVE', 'PUBLISHED')) AND total_codes_count > 0 AND category IS NOT NULL AND category != '' ORDER BY category ASC"
      ).all<any>().catch(() => ({ results: [] as any[] }));
      const categories = ['Tất cả', ...(catRes?.results || []).map((c: any) => c.category).filter(Boolean)];

      return new Response(
        JSON.stringify({
          success: true,
          page: safePage,
          limit,
          total,
          totalPages,
          hasMore: safePage < totalPages,
          games: rows,
          categories,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            ...CORS_HEADERS,
            'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=600',
          },
        }
      );
    }

    // Fallback in-memory catalog
    const catalog = await getLoadedCatalog(env.DB, forceFresh, false);
    const sortBy = (url.searchParams.get('sortBy') || 'release_date').trim();
    const sortOrder = (url.searchParams.get('sortOrder') || 'desc').trim().toLowerCase();

    let filtered = catalog.games;

    // Filter A: Search with relevance scoring
    const searchScoreMap = new Map<string, number>();
    if (searchQuery) {
      filtered = filtered
        .map((g) => {
          const res = calculateGameSearchScore(g, searchQuery);
          if (res.score > 0) {
            searchScoreMap.set(g.slug, res.score);
          }
          return { game: g, score: res.score };
        })
        .filter((item) => item.score > 0)
        .map((item) => item.game);
    }

    // Filter B: Category
    if (category && category !== 'all' && category !== 'Tất cả') {
      const catLower = category.toLowerCase();
      filtered = filtered.filter((g) => g.category && g.category.toLowerCase() === catLower);
    }

    // Filter C: Tag
    if (tag === 'hot') {
      filtered = filtered.filter((g) => Boolean(g.is_hot));
    } else if (tag === 'new') {
      filtered = filtered.filter((g) => Boolean(g.is_new));
    } else if (tag === 'has_codes') {
      filtered = filtered.filter((g) => (g.codes_count || 0) > 0);
    }

    // Sorting (When searching, prioritize relevance score unless explicit sort by name or rating)
    if (searchQuery && searchScoreMap.size > 0 && sortBy !== 'name' && sortBy !== 'rating') {
      filtered = [...filtered].sort((a, b) => {
        const sA = searchScoreMap.get(a.slug) || 0;
        const sB = searchScoreMap.get(b.slug) || 0;
        if (sB !== sA) return sB - sA;
        const cntA = a.codes_count || 0;
        const cntB = b.codes_count || 0;
        if (cntB !== cntA) return cntB - cntA;
        return a.name.localeCompare(b.name);
      });
    } else {
      filtered = [...filtered].sort((a, b) => {
        let valA: number | string = 0;
        let valB: number | string = 0;

        if (sortBy === 'updated') {
          valA = a.codes?.[0]?.added_at || a.release_date || '1970-01-01';
          valB = b.codes?.[0]?.added_at || b.release_date || '1970-01-01';
        } else if (sortBy === 'popular') {
          valA =
            (a.is_hot ? 1000 : 0) +
            (a.is_featured ? 500 : 0) +
            (a.rating || 0) * 50 +
            (a.codes_count || 0) * 10;
          valB =
            (b.is_hot ? 1000 : 0) +
            (b.is_featured ? 500 : 0) +
            (b.rating || 0) * 50 +
            (b.codes_count || 0) * 10;
        } else if (sortBy === 'release_date') {
          valA = a.release_date || '1970-01-01';
          valB = b.release_date || '1970-01-01';
        } else if (sortBy === 'license_date') {
          valA = a.ngay_cap_phep || '1970-01-01';
          valB = b.ngay_cap_phep || '1970-01-01';
        } else if (sortBy === 'name') {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          return sortOrder === 'asc'
            ? (valA as string).localeCompare(valB as string)
            : (valB as string).localeCompare(valA as string);
        } else if (sortBy === 'codes_count') {
          valA = a.codes_count || 0;
          valB = b.codes_count || 0;
        } else if (sortBy === 'rating') {
          valA = a.rating || 0;
          valB = b.rating || 0;
        }

        if (sortOrder === 'desc') {
          return valA < valB ? 1 : valA > valB ? -1 : 0;
        }
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      });
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * limit;

    // Slice only the games for the requested page
    // Attach top 3 codes for card preview (1-click copy) without transferring huge arrays
    const pageItems = filtered.slice(startIdx, startIdx + limit).map((g) => ({
      ...g,
      codes: (g.codes || []).slice(0, 3),
    }));

    const hasMore = safePage < totalPages;

    const isFiltered = Boolean(searchQuery || (category && category !== 'all' && category !== 'Tất cả') || tag !== 'all');

    return new Response(
      JSON.stringify({
        success: true,
        page: safePage,
        limit,
        total,
        totalPages,
        hasMore,
        games: pageItems,
        categories: catalog.categories,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': isFiltered
            ? 'public, max-age=5, s-maxage=10, stale-while-revalidate=20'
            : 'public, max-age=10, s-maxage=15, stale-while-revalidate=30',
        },
      }
    );
  } catch (err: any) {
    console.error('API /api/games Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi xử lý danh mục trò chơi.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
