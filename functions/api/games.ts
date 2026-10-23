import { getMultipleSettingsD1 } from '../services/d1_service';
import { isCodeExpired, parseExpirationDate } from '../../src/utils/codeUtils';
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

  // 4. Multi-token match: requires whole words or word prefixes to prevent false positive substrings
  const queryWords = queryNorm.split(/\s+/).filter(Boolean);
  if (queryWords.length > 1) {
    const targetWords = targetNorm.split(/\s+/).filter(Boolean);
    const targetWordSet = new Set(targetWords);
    const allWordsPresent = queryWords.every(
      (word) => targetWordSet.has(word) || targetWords.some((tw) => tw.startsWith(word))
    );
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

  // 6. Initials Matching (exact match or prefix match on whole initials)
  const targetWords = targetNorm.split(/\s+/).filter(Boolean);
  const initials = targetWords.map((w) => w[0]).join('');
  if (initials === queryCompact || initials.startsWith(queryCompact)) return true;

  return false;
}

export function calculateGameSearchScore(
  game: {
    name?: string;
    slug?: string;
    publisher?: string;
    category?: string;
    description?: string;
    is_hot?: boolean | number;
    is_featured?: boolean | number;
    codes_count?: number;
  },
  searchQuery: string
): { score: number; matchType: string } {
  if (!searchQuery || !searchQuery.trim()) {
    return { score: 0, matchType: 'none' };
  }

  const rawQuery = searchQuery.trim().toLowerCase();
  const queryNorm = normalizeVietnamese(rawQuery);
  const queryCompact = queryNorm.replace(/\s+/g, '');
  if (!queryNorm && !queryCompact) return { score: 0, matchType: 'none' };

  const nameRaw = (game.name || '').trim().toLowerCase();
  const nameNorm = normalizeVietnamese(game.name || '');
  const nameCompact = nameNorm.replace(/\s+/g, '');

  const slugRaw = (game.slug || '').trim().toLowerCase();
  const slugNorm = normalizeVietnamese(slugRaw);
  const slugCompact = slugNorm.replace(/\s+/g, '');

  const publisherRaw = (game.publisher || '').trim().toLowerCase();
  const publisherNorm = normalizeVietnamese(game.publisher || '');

  const categoryRaw = (game.category || '').trim().toLowerCase();
  const categoryNorm = normalizeVietnamese(game.category || '');

  let score = 0;
  let matchType = 'none';

  // 1. Exact match with game name
  if (nameRaw === rawQuery || nameNorm === queryNorm || nameCompact === queryCompact) {
    score = 10000;
    matchType = 'exact_name';
  }
  // 2. Exact match with slug
  else if (slugRaw === rawQuery || slugNorm === queryNorm || slugCompact === queryCompact) {
    score = 9500;
    matchType = 'exact_slug';
  }
  // 3. Name starts with query
  else if (nameNorm.startsWith(queryNorm) || nameRaw.startsWith(rawQuery) || nameCompact.startsWith(queryCompact)) {
    score = 8500;
    matchType = 'name_prefix';
  }
  // 4. Slug starts with query
  else if (slugNorm.startsWith(queryNorm) || slugRaw.startsWith(rawQuery) || slugCompact.startsWith(queryCompact)) {
    score = 8000;
    matchType = 'slug_match';
  }
  // 5. Gaming Acronym / Abbreviation Match
  else if (queryCompact.length >= 2 && queryCompact.length <= 6) {
    const mapped = GAME_ACRONYM_MAP[queryCompact];
    if (mapped) {
      for (const phrase of mapped) {
        const normPhrase = normalizeVietnamese(phrase);
        if (nameNorm.includes(normPhrase) || slugNorm.includes(normPhrase)) {
          score = 7800;
          matchType = 'acronym';
          break;
        }
      }
    }
    if (score === 0) {
      const initials = nameNorm.split(/[\s\-:_]+/).filter(Boolean).map((w) => w[0]).join('');
      if (initials === queryCompact) {
        score = 7500;
        matchType = 'acronym';
      } else if (initials.startsWith(queryCompact)) {
        score = 7000;
        matchType = 'acronym';
      }
    }
  }

  // 6. Name contains query phrase (require word boundary or length >= 3 to prevent short noise like "ff" in "Offline")
  if (score === 0) {
    const isWordBounded =
      nameNorm.startsWith(queryNorm + ' ') ||
      nameNorm.includes(' ' + queryNorm + ' ') ||
      nameNorm.endsWith(' ' + queryNorm) ||
      nameRaw.startsWith(rawQuery + ' ') ||
      nameRaw.includes(' ' + rawQuery + ' ') ||
      nameRaw.endsWith(' ' + rawQuery);

    if (queryNorm.length >= 3 && (nameNorm.includes(queryNorm) || nameRaw.includes(rawQuery) || nameCompact.includes(queryCompact))) {
      score = 6800;
      matchType = 'name_sub';
    } else if (queryNorm.length < 3 && isWordBounded) {
      score = 6800;
      matchType = 'name_sub';
    } else if (slugNorm.includes(queryNorm) || slugRaw.includes(rawQuery)) {
      if (queryNorm.length >= 3 || slugRaw.startsWith(rawQuery + '-') || slugRaw.includes('-' + rawQuery + '-') || slugRaw.endsWith('-' + rawQuery)) {
        score = 6500;
        matchType = 'slug_match';
      }
    }
  }

  // 7. Word boundary match in name
  if (score === 0) {
    const wordsInName = nameNorm.split(/[\s\-:_]+/).filter(Boolean);
    const nameWordSet = new Set(wordsInName);
    const qTokens = queryNorm.split(' ').filter(Boolean);
    if (qTokens.length > 1 && qTokens.every((tok) => nameWordSet.has(tok) || wordsInName.some((w) => w.startsWith(tok)))) {
      score = 6200;
      matchType = 'name_word';
    } else if (wordsInName.some((w) => w === queryNorm)) {
      score = 5500;
      matchType = 'name_word';
    } else if (wordsInName.some((w) => w.startsWith(queryNorm))) {
      score = 5000;
      matchType = 'name_word';
    }
  }

  // 8. Secondary initials
  if (score === 0 && queryCompact.length >= 2 && queryCompact.length <= 6) {
    const initials = nameNorm.split(/[\s\-:_]+/).filter(Boolean).map((w) => w[0]).join('');
    if (initials.includes(queryCompact)) {
      score = 4000;
      matchType = 'acronym';
    }
  }

  // 9. Publisher match
  if (score === 0) {
    if (publisherRaw === rawQuery || publisherNorm === queryNorm) {
      score = 2500;
      matchType = 'publisher';
    } else if (publisherNorm.startsWith(queryNorm) || publisherRaw.startsWith(rawQuery)) {
      score = 2000;
      matchType = 'publisher';
    } else if (publisherNorm.includes(queryNorm) || publisherRaw.includes(rawQuery)) {
      score = 1500;
      matchType = 'publisher';
    }
  }

  // 10. Category match
  if (score === 0) {
    if (categoryRaw === rawQuery || categoryNorm === queryNorm) {
      score = 1000;
      matchType = 'category';
    } else if (categoryNorm.includes(queryNorm) || categoryRaw.includes(rawQuery)) {
      score = 800;
      matchType = 'category';
    }
  }

  // 11. Description match
  if (score === 0 && game.description) {
    const descNorm = normalizeVietnamese(game.description);
    if (descNorm.includes(queryNorm)) {
      score = 1200;
      matchType = 'description';
    } else {
      const qTokens = queryNorm.split(' ').filter(Boolean);
      const descWords = descNorm.split(/[\s\-:_]+/).filter(Boolean);
      const descWordSet = new Set(descWords);
      if (qTokens.length > 1 && qTokens.every((tok) => descWordSet.has(tok) || descWords.some((w) => w.startsWith(tok)))) {
        score = 800;
        matchType = 'description';
      }
    }
  }

  // Quality bonuses & length penalty
  if (score > 0) {
    if (score >= 6000 && nameNorm) {
      const lengthDiff = Math.max(0, nameNorm.length - queryNorm.length);
      score -= Math.min(300, lengthDiff * 2);
    }
    if (game.is_hot) score += 30;
    if (game.is_featured) score += 20;
    if ((game.codes_count || 0) > 0) score += 50;
  }

  return { score, matchType };
}

// In-Memory Isolation Cache in Cloudflare Workers
interface CatalogCache {
  games: GameItem[];
  allRawGames: any[];
  codesMap: Map<string, GiftCode[]>;
  categories: string[];
  lastFetchedAt: number;
}

let catalogCache: CatalogCache | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds fast in-worker cache to protect Cloudflare D1 quota

export function invalidateGamesCatalogCache(): void {
  catalogCache = null;
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
  const cat = g.category ? String(g.category).trim() : 'Game Hot';

  let iconUrl = g.icon_url || g.iconUrl || g.cover_image_url || '';
  if (!iconUrl || iconUrl.includes('codemoi.net') || iconUrl.includes('googleusercontent.com') || iconUrl.startsWith('/game-icons') || iconUrl.startsWith('game-icons')) {
    iconUrl = `/game_icons/${slug}.webp`;
  }

  return {
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
    codes_count: allCodes.length,
    codes: allCodes,
  };
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
    'wcg_admin_upcoming_games_v1',
  ]);

  const baseGames = (Array.isArray(settings['wcg_admin_games_v5']) && settings['wcg_admin_games_v5'].length > 0)
    ? settings['wcg_admin_games_v5']
    : ((Array.isArray(settings['wcg_admin_games_v4']) && settings['wcg_admin_games_v4'].length > 0)
      ? settings['wcg_admin_games_v4']
      : (fallbackGamesData as any[]));

  // Tự động chuyển các game sắp ra mắt đã mở server quá 24h xuống sàn game chính thức
  const rawGames = Array.isArray(baseGames) ? [...baseGames] : [];
  const upcomingList = settings['wcg_admin_upcoming_games_v1'];
  if (Array.isArray(upcomingList)) {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const ug of upcomingList) {
      if (!ug || !ug.slug) continue;
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
  // This guarantees that no code can ever be lost regardless of D1 partial writes or admin CMS updates.
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

  // 1. Process custom codes FIRST (highest priority: newly created or edited by admin)
  if (Array.isArray(customCodes)) {
    for (const item of customCodes) {
      if (!item || (item.id && deletedCodesSet.has(item.id))) continue;
      const slug = item.gameSlug || item.game_slug || item.slug || item.gameId;
      const codeVal = item.codeValue || item.code_value || item.code || item.gift_code;
      if (!slug || !codeVal) continue;

      const normSlug = String(slug).trim().toLowerCase();
      const codeStr = String(codeVal).trim();
      const isExp = isCodeExpired(item);

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

  // 2. Process D1 catalog codes (from crawlers / admin pushes), skipping any deleted or already added
  if (Array.isArray(d1Codes)) {
    for (const item of d1Codes) {
      if (!item || (item.id && deletedCodesSet.has(item.id))) continue;
      const slug = item.gameSlug || item.game_slug || item.slug || item.gameId;
      const codeVal = item.codeValue || item.code_value || item.code || item.gift_code;
      if (!slug || !codeVal) continue;

      const normSlug = String(slug).trim().toLowerCase();
      const codeStr = String(codeVal).trim();
      const isExp = isCodeExpired(item);

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

  // 3. Process complete Master Bundled codes (11,762 codes), preserving full baseline archive
  if (Array.isArray(bundledCodes)) {
    for (const item of bundledCodes) {
      if (!item || (item.id && deletedCodesSet.has(item.id))) continue;
      const slug = item.gameSlug || item.game_slug || item.slug || item.gameId;
      const codeVal = item.codeValue || item.code_value || item.code || item.gift_code;
      if (!slug || !codeVal) continue;

      const normSlug = String(slug).trim().toLowerCase();
      const codeStr = String(codeVal).trim();
      const isExp = isCodeExpired(item);

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
    games: gamesList,
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
    const catalog = await getLoadedCatalog(env.DB, forceFresh);

    // 1. Single Game Details Query (?slug=... or ?id=...)
    const requestedSlug = url.searchParams.get('slug') || url.searchParams.get('id');
    if (requestedSlug) {
      const cleanSlug = requestedSlug.trim().toLowerCase();
      const cleanWithoutMobile = cleanSlug.replace(/-mobile$/i, '');

      // Search in published catalog games first
      let matchedGame: GameItem | null = findMatchingGameInList(catalog.games, cleanSlug, cleanWithoutMobile);

      // If not in published catalog (e.g. 0-code or unlisted games), look up in authoritative rawGames
      if (!matchedGame) {
        const rawFound = findMatchingGameInList(catalog.allRawGames, cleanSlug, cleanWithoutMobile);
        if (rawFound) {
          const codes = resolveCodesForGame(rawFound, catalog.codesMap);
          matchedGame = formatGameItem(rawFound, codes);
        }
      }

      if (!matchedGame) {
        return new Response(
          JSON.stringify({ success: false, error: 'Không tìm thấy trò chơi.' }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      // Mark that this object contains authoritative complete codes pool
      const authoritativeGame = {
        ...matchedGame,
        codes_pool_complete: true,
      };

      // Return full game with all its codes
      return new Response(
        JSON.stringify({
          success: true,
          game: authoritativeGame,
        }),
        {
          headers: {
            ...CORS_HEADERS,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
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
