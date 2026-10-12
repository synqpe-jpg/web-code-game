import { getMultipleSettingsD1 } from '../services/d1_service';

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

// Vietnamese text normalization utilities
export function stripAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function normalizeVietnamese(str: string): string {
  if (!str) return '';
  return stripAccents(str)
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const GAME_ACRONYM_MAP: Record<string, string[]> = {
  lq: ['lien quan', 'lien quan mobile', 'arena of valor', 'aov'],
  lqmb: ['lien quan mobile', 'lien quan'],
  lqm: ['lien quan mobile', 'lien quan'],
  hsr: ['honkai star rail', 'star rail'],
  hi3: ['honkai impact 3', 'honkai impact 3rd'],
  gi: ['genshin impact', 'genshin'],
  ff: ['free fire', 'garena free fire'],
  ffmax: ['free fire max'],
  vltk: ['vo lam truyen ky'],
  vltkm: ['vo lam truyen ky mobile'],
  vltk1: ['vo lam truyen ky 1'],
  lmht: ['lien minh huyen thoai', 'league of legends', 'lol'],
  lol: ['lien minh huyen thoai', 'league of legends'],
  tft: ['dau truong chan ly', 'teamfight tactics', 'dtcl'],
  dtcl: ['dau truong chan ly', 'teamfight tactics', 'tft'],
  fo4: ['fifa online 4', 'ea sports fc online', 'fc online'],
  fc: ['ea sports fc online', 'fc online', 'fifa online 4'],
  pubg: ['pubg mobile', 'pubg'],
  pubgm: ['pubg mobile'],
  nr: ['ngoc rong online', 'chu be rong', 'ngoc rong'],
  nro: ['ngoc rong online', 'ngoc rong'],
  htd: ['hac tay du chuong cam', 'hac tay du'],
  tlbb: ['thien long bat bo'],
  kt: ['kiem the'],
  ktm: ['kiem the mobile'],
  td: ['tay du'],
  tq: ['tam quoc'],
  op: ['outerplane', 'one piece'],
  bns: ['blade and soul'],
  dnf: ['dungeon and fighter', 'dungeon fighter'],
  zzz: ['zenless zone zero'],
  ww: ['wuthering waves'],
  mc: ['minecraft'],
  roblox: ['roblox'],
};

export function smartVietnameseMatch(
  targets: (string | number | null | undefined) | (string | number | null | undefined)[],
  searchQuery: string
): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;

  const rawQuery = searchQuery.trim();
  const queryNorm = normalizeVietnamese(rawQuery);
  if (!queryNorm) return true;

  const targetArr = Array.isArray(targets) ? targets : [targets];
  const validStrings = targetArr
    .filter((t) => t !== null && t !== undefined && t !== '')
    .map((t) => String(t));

  if (validStrings.length === 0) return false;

  // 1. Direct raw check
  const rawQueryLower = rawQuery.toLowerCase();
  for (const raw of validStrings) {
    if (raw.toLowerCase().includes(rawQueryLower)) return true;
  }

  // 2. Normalized full text check
  const targetNorm = validStrings.map((s) => normalizeVietnamese(s)).join(' ');
  if (targetNorm.includes(queryNorm)) return true;

  // 3. Compact text check (no spaces, dashes, or symbols)
  const targetCompact = targetNorm.replace(/\s+/g, '');
  const queryCompact = queryNorm.replace(/\s+/g, '');
  if (targetCompact.includes(queryCompact)) return true;

  // 4. Multi-token match: all search words exist
  const queryWords = queryNorm.split(/\s+/).filter(Boolean);
  if (queryWords.length > 1) {
    const allWordsPresent = queryWords.every((word) => targetNorm.includes(word));
    if (allWordsPresent) return true;
  }

  // 5. Gaming Acronym / Nickname expansion
  const queryKey = queryCompact.toLowerCase();
  const expansions = GAME_ACRONYM_MAP[queryKey];
  if (expansions && expansions.length > 0) {
    for (const exp of expansions) {
      const expNorm = normalizeVietnamese(exp);
      if (targetNorm.includes(expNorm)) return true;
      const expCompact = expNorm.replace(/\s+/g, '');
      if (targetCompact.includes(expCompact)) return true;
    }
  }

  // 6. Initials Matching
  const targetWords = targetNorm.split(/\s+/).filter(Boolean);
  const initials = targetWords.map((w) => w[0]).join('');
  if (initials && initials.includes(queryCompact)) return true;

  return false;
}

// In-Memory Isolation Cache in Cloudflare Workers
interface CatalogCache {
  games: GameItem[];
  codesMap: Map<string, GiftCode[]>;
  categories: string[];
  lastFetchedAt: number;
}

let catalogCache: CatalogCache | null = null;
const CACHE_TTL_MS = 5 * 1000; // 5 seconds fast cache

export function invalidateGamesCatalogCache(): void {
  catalogCache = null;
}

/**
 * Loads authoritative games and free giftcodes from Cloudflare D1.
 * Indexes codes by game slug and computes codes_count.
 */
export async function getLoadedCatalog(db: D1Database, forceFresh: boolean = false): Promise<CatalogCache> {
  const now = Date.now();
  if (!forceFresh && catalogCache && now - catalogCache.lastFetchedAt < CACHE_TTL_MS) {
    return catalogCache;
  }

  const settings = await getMultipleSettingsD1(db, [
    'wcg_admin_games_v5',
    'wcg_admin_games_v4',
    'wcg_admin_free_codes_v5',
    'wcg_admin_free_codes_v4',
    'wcg_admin_custom_free_codes_v1',
    'wcg_deleted_free_codes',
  ]);

  const rawGames = settings['wcg_admin_games_v5'] || settings['wcg_admin_games_v4'] || [];
  const rawCodes = settings['wcg_admin_free_codes_v5'] || settings['wcg_admin_free_codes_v4'] || [];
  const customCodes = settings['wcg_admin_custom_free_codes_v1'] || [];
  const deletedCodesSet = new Set<string>(
    Array.isArray(settings['wcg_deleted_free_codes']) ? settings['wcg_deleted_free_codes'] : []
  );

  const codesMap = new Map<string, GiftCode[]>();

  // 1. Process custom codes FIRST (highest priority: newly created or edited by admin)
  if (Array.isArray(customCodes)) {
    for (const item of customCodes) {
      if (!item || (item.id && deletedCodesSet.has(item.id))) continue;
      const slug = item.gameSlug || item.game_slug || item.slug || item.gameId;
      const codeVal = item.codeValue || item.code_value || item.code || item.gift_code;
      if (!slug || !codeVal) continue;

      const normSlug = String(slug).trim().toLowerCase();
      const codeStr = String(codeVal).trim();
      const isExp = item.status === 'EXPIRED' || item.status === 'expired';

      const list = codesMap.get(normSlug) || [];
      list.push({
        code: codeStr,
        rewards: item.rewards || item.description || 'Quà tân thủ & vật phẩm ingame',
        status: isExp ? 'expired' : 'active',
        expiry: item.expiresAt || item.expires_at || item.expiry || '',
        added_at: item.updatedAt || item.updated_at || item.createdAt || item.created_at || new Date().toISOString(),
      });
      codesMap.set(normSlug, list);
    }
  }

  // 2. Process crawled/catalog codes, skipping any deleted or already added
  if (Array.isArray(rawCodes)) {
    for (const item of rawCodes) {
      if (!item || (item.id && deletedCodesSet.has(item.id))) continue;
      const slug = item.gameSlug || item.game_slug || item.slug || item.gameId;
      const codeVal = item.codeValue || item.code_value || item.code || item.gift_code;
      if (!slug || !codeVal) continue;

      const normSlug = String(slug).trim().toLowerCase();
      const codeStr = String(codeVal).trim();
      const isExp =
        item.status === 'EXPIRED' ||
        item.status === 'expired';

      const list = codesMap.get(normSlug) || [];
      if (list.some((existing) => existing.code.toUpperCase() === codeStr.toUpperCase())) {
        continue;
      }

      list.push({
        code: codeStr,
        rewards: item.rewards || item.description || 'Quà tân thủ & vật phẩm ingame',
        status: isExp ? 'expired' : 'active',
        expiry: item.expiresAt || item.expires_at || item.expiry || '',
        added_at: item.createdAt || item.created_at || item.added_at || '2026-10-09T00:00:00Z',
      });
      codesMap.set(normSlug, list);
    }
  }

  const categorySet = new Set<string>();
  categorySet.add('Tất cả');

  const gamesList: GameItem[] = [];

  if (Array.isArray(rawGames)) {
    for (let index = 0; index < rawGames.length; index++) {
      const g = rawGames[index];
      if (!g || g.status === 'INACTIVE' || g.is_active === false) continue;

      const slug = g.slug || g.id || `game-${index + 1}`;
      const rawId = g.id || slug;
      const normSlug = slug.toLowerCase();

      // Look up codes matching slug variations
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
            if (!mergedCodesMap.has(c.code)) {
              mergedCodesMap.set(c.code, c);
            }
          }
        }
      }

      // If game object itself already carries codes
      if (Array.isArray(g.codes)) {
        for (const c of g.codes) {
          if (c && c.code && !mergedCodesMap.has(c.code)) {
            mergedCodesMap.set(c.code, c);
          }
        }
      }

      const allCodes = Array.from(mergedCodesMap.values());
      allCodes.sort((a, b) => {
        const aActive = a.status !== 'expired' ? 1 : 0;
        const bActive = b.status !== 'expired' ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;

        const timeA = a.added_at ? new Date(a.added_at).getTime() : 0;
        const timeB = b.added_at ? new Date(b.added_at).getTime() : 0;
        return timeB - timeA;
      });
      const cat = g.category ? String(g.category).trim() : 'Game Hot';
      if (cat) categorySet.add(cat);

      let iconUrl = g.icon_url || g.iconUrl || g.cover_image_url || '';
      if (!iconUrl || iconUrl.startsWith('/game-icons') || iconUrl.startsWith('game-icons')) {
        iconUrl = `/game_icons/${slug}.webp`;
      }

      gamesList.push({
        id: String(rawId),
        name: String(g.name || 'Game chưa đặt tên'),
        slug: String(slug),
        publisher: g.publisher || 'NPH Chính Thức',
        category: cat,
        rating: typeof g.rating === 'number' ? g.rating : 4.8,
        icon_url: iconUrl,
        banner_url: g.banner_url || g.bannerUrl || '',
        description: g.description || '',
        instructions: g.instructions || '',
        platform: g.platform || 'Mobile / PC',
        so_giay_phep: g.so_giay_phep || g.license_number || '',
        ngay_cap_phep: g.ngay_cap_phep || g.license_date || '',
        release_date: g.release_date || g.gp_release_date || '',
        download_android: g.download_android || g.downloadLinks?.android || '',
        download_ios: g.download_ios || g.downloadLinks?.ios || '',
        download_pc: g.download_pc || g.downloadLinks?.pc || '',
        redeem_url: g.redeem_url || g.redeemUrl || '',
        is_featured: Boolean(g.is_featured || g.isFeatured),
        is_hot: Boolean(g.is_hot || g.isHot),
        is_new: Boolean(g.is_new || g.isNew),
        is_active: g.is_active !== undefined ? Boolean(g.is_active) : true,
        codes_count: allCodes.length,
        codes: allCodes,
      });
    }
  }

  catalogCache = {
    games: gamesList,
    codesMap,
    categories: Array.from(categorySet),
    lastFetchedAt: Date.now(),
  };

  return catalogCache;
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
    const catalog = await getLoadedCatalog(env.DB, forceFresh);

    // 1. Single Game Details Query (?slug=... or ?id=...)
    const requestedSlug = url.searchParams.get('slug') || url.searchParams.get('id');
    if (requestedSlug) {
      const cleanSlug = requestedSlug.trim().toLowerCase();
      const cleanWithoutMobile = cleanSlug.replace(/-mobile$/i, '');

      // Tier 1: Exact Match on slug or id (Highest Priority)
      let foundGame = catalog.games.find((g) => {
        const gSlug = (g.slug || '').toLowerCase();
        const gId = (g.id || '').toLowerCase();
        return gSlug === cleanSlug || gId === cleanSlug;
      });

      // Tier 2: Exact Match on generated nameSlug
      if (!foundGame) {
        foundGame = catalog.games.find((g) => {
          const nameSlug = stripAccents(g.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          return nameSlug === cleanSlug;
        });
      }

      // Tier 3: Known Specific Aliases
      if (!foundGame) {
        if (cleanSlug === 'huyen-thoai-hai-tac' || cleanSlug === 'pirate-legends') {
          foundGame = catalog.games.find((g) => {
            const gSlug = (g.slug || '').toLowerCase();
            const gId = (g.id || '').toLowerCase();
            return gSlug === 'pirate-legends' || gSlug === 'huyen-thoai-hai-tac' || gId === 'pirate-legends' || gId === 'huyen-thoai-hai-tac';
          });
        }
      }

      // Tier 4: Exact Match without -mobile suffix (Only if no exact match found above)
      if (!foundGame) {
        foundGame = catalog.games.find((g) => {
          const gSlug = (g.slug || '').toLowerCase();
          const gId = (g.id || '').toLowerCase();
          return (
            gSlug.replace(/-mobile$/i, '') === cleanWithoutMobile ||
            gId.replace(/-mobile$/i, '') === cleanWithoutMobile
          );
        });
      }

      // Tier 5: Sub-parts of game title (Last resort fallback)
      if (!foundGame) {
        foundGame = catalog.games.find((g) => {
          const parts = (g.name || '').split(/[:\-–]/).map((p: string) => stripAccents(p).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).filter(Boolean);
          return parts.includes(cleanSlug) || parts.includes(cleanWithoutMobile);
        });
      }

      if (!foundGame) {
        return new Response(
          JSON.stringify({ success: false, error: 'Không tìm thấy trò chơi.' }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      // Return full game with all its codes
      return new Response(
        JSON.stringify({
          success: true,
          game: foundGame,
        }),
        {
          headers: {
            ...CORS_HEADERS,
            'Cache-Control': 'public, max-age=3, s-maxage=5, stale-while-revalidate=10',
          },
        }
      );
    }

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

      const matchedGames: GameItem[] = [];
      const matchedCodes: Array<{ game: GameItem; code: GiftCode }> = [];
      const seenCodeKeys = new Set<string>();

      for (const game of catalog.games) {
        if (
          smartVietnameseMatch(
            [game.name, game.slug, game.publisher, game.category, game.description, game.so_giay_phep],
            q
          )
        ) {
          if (matchedGames.length < limit) {
            // Include top 2 active codes preview
            matchedGames.push({
              ...game,
              codes: (game.codes || []).slice(0, 2),
            });
          }
        }

        const codes = game.codes || [];
        for (const code of codes) {
          const codeKey = `${game.id}_${code.code}`;
          if (
            !seenCodeKeys.has(codeKey) &&
            smartVietnameseMatch([code.code, code.rewards, game.name, game.slug], q)
          ) {
            seenCodeKeys.add(codeKey);
            if (matchedCodes.length < limit) {
              matchedCodes.push({ game, code });
            }
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          games: matchedGames,
          codes: matchedCodes,
          totalMatches: matchedGames.length + matchedCodes.length,
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

    // 4. Server-Side Paginated Catalog Query
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(60, Math.max(1, parseInt(url.searchParams.get('limit') || '24', 10)));
    const searchQuery = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();
    const category = (url.searchParams.get('category') || 'all').trim();
    const tag = (url.searchParams.get('tag') || 'all').trim();
    const sortBy = (url.searchParams.get('sortBy') || 'release_date').trim();
    const sortOrder = (url.searchParams.get('sortOrder') || 'desc').trim().toLowerCase();

    let filtered = catalog.games;

    // Filter A: Search
    if (searchQuery) {
      filtered = filtered.filter((g) =>
        smartVietnameseMatch(
          [g.name, g.publisher, g.slug, g.category, g.description, g.so_giay_phep],
          searchQuery
        )
      );
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

    // Sorting
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
            ? 'public, max-age=3, s-maxage=5, stale-while-revalidate=10'
            : 'public, max-age=5, s-maxage=10, stale-while-revalidate=20',
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
