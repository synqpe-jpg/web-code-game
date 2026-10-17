// Remove Vietnamese accents for lightning-fast fuzzy & non-accent search
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

// Normalize Vietnamese string: removes accents, converts non-alphanumeric to spaces, trims duplicate spaces
export function normalizeVietnamese(str: string): string {
  if (!str) return '';
  return stripAccents(str)
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Common gaming acronyms & abbreviations dictionary (tiếng Việt & quốc tế)
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
  roblox: ['roblox', 'roblox viet nam', 'roblox vng'],
  bf: ['blox fruits', 'roblox blox fruits'],
  blox: ['blox fruits', 'roblox blox fruits', 'roblox'],
  dldl: ['dau la dai luc', 'dau la dai luc hon su doi quyet', 'dau la vng'],
  dla: ['dau la dai luc'],
  bb: ['blade ball'],
  kl: ['king legacy'],
  afk: ['afk journey', 'afk arena'],
  slg: ['chien thuat'],
  tcg: ['the bai'],
  vng: ['vnggames', 'vng'],
  gosu: ['truc tuyen gosu', 'gosu'],
  soha: ['sohagame', 'soha'],
  funtap: ['funtap'],
  gamota: ['gamota'],
  vtc: ['vtc game', 'vtc mobile'],
  garena: ['garena'],
  tg: ['tien gioi', 'tien gioi nhan kiem hop nhat'],
  tgnk: ['tien gioi nhan kiem hop nhat', 'tien gioi nhan kiem'],
  tgnkhn: ['tien gioi nhan kiem hop nhat'],
  nk: ['nhan kiem', 'tien gioi nhan kiem hop nhat'],
  tala: ['ta la hac ngo khong', 'ta la'],
  hnk: ['hac ngo khong', 'ta la hac ngo khong'],
  tlhnk: ['ta la hac ngo khong'],
  vplay: ['vplay'],
  vgp: ['vgp'],
};

export interface GameSearchScoreResult {
  score: number;
  matchType:
    | 'exact_name'
    | 'name_prefix'
    | 'name_word'
    | 'name_sub'
    | 'exact_slug'
    | 'slug_match'
    | 'acronym'
    | 'publisher'
    | 'category'
    | 'description'
    | 'none';
  matchDetail?: string;
}

/**
 * Intelligent game search scoring & relevance engine:
 * Ranks games so that direct name matches appear first, followed by prefixes,
 * acronyms, word-matches, publisher matches, and lastly category/description matches.
 */
export function calculateGameSearchScore(
  game: {
    name?: string;
    slug?: string;
    publisher?: string;
    category?: string;
    description?: string;
    is_hot?: boolean;
    is_featured?: boolean;
    codes_count?: number;
  },
  searchQuery: string
): GameSearchScoreResult {
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

  const publisherRaw = (game.publisher || '').trim().toLowerCase();
  const publisherNorm = normalizeVietnamese(game.publisher || '');

  const categoryRaw = (game.category || '').trim().toLowerCase();
  const categoryNorm = normalizeVietnamese(game.category || '');

  let score = 0;
  let matchType: GameSearchScoreResult['matchType'] = 'none';
  let matchDetail = '';

  // 1. Exact match with game name (Raw or Normalized)
  if (nameRaw === rawQuery || nameNorm === queryNorm || nameCompact === queryCompact) {
    score = 10000;
    matchType = 'exact_name';
  }
  // 2. Exact match with slug
  else if (slugRaw === rawQuery || slugNorm === queryNorm) {
    score = 9000;
    matchType = 'exact_slug';
  }
  // 3. Name starts with query (Prefix)
  else if (nameNorm.startsWith(queryNorm) || nameRaw.startsWith(rawQuery) || nameCompact.startsWith(queryCompact)) {
    score = 8000;
    matchType = 'name_prefix';
  }
  // 4. Gaming Acronym / Abbreviation Match (e.g. "lq", "vltk", "bf", "dldl", "ff", "hsr")
  else if (queryCompact.length >= 2 && queryCompact.length <= 6) {
    const mapped = GAME_ACRONYM_MAP[queryCompact];
    if (mapped) {
      for (const phrase of mapped) {
        const normPhrase = normalizeVietnamese(phrase);
        if (nameNorm.includes(normPhrase) || slugNorm.includes(normPhrase)) {
          score = 7500;
          matchType = 'acronym';
          break;
        }
      }
    }
  }

  // 5. Word boundary match in name (a distinct word in the title starts with or equals query)
  if (score === 0) {
    const words = nameNorm.split(/[\s\-:_]+/).filter(Boolean);
    const rawWords = nameRaw.split(/[\s\-:_]+/).filter(Boolean);
    if (words.some((w) => w === queryNorm) || rawWords.some((w) => w === rawQuery)) {
      score = 7000;
      matchType = 'name_word';
    } else if (words.some((w) => w.startsWith(queryNorm)) || rawWords.some((w) => w.startsWith(rawQuery))) {
      score = 6500;
      matchType = 'name_word';
    }
  }

  // 6. Name contains query substring
  if (score === 0) {
    if (queryNorm.length >= 3 && (nameNorm.includes(queryNorm) || nameRaw.includes(rawQuery) || nameCompact.includes(queryCompact))) {
      score = 5500;
      matchType = 'name_sub';
    } else if (queryNorm.length < 3 && (nameNorm.includes(` ${queryNorm}`) || nameRaw.includes(` ${rawQuery}`))) {
      // Short queries only match after a space to avoid false positives (e.g. "ff" in "Offline")
      score = 5000;
      matchType = 'name_sub';
    }
  }

  // 7. Slug starts with or contains query
  if (score === 0) {
    if (slugNorm.startsWith(queryNorm) || slugRaw.startsWith(rawQuery)) {
      score = 4800;
      matchType = 'slug_match';
    } else if (slugNorm.includes(queryNorm) || slugRaw.includes(rawQuery)) {
      score = 4200;
      matchType = 'slug_match';
    }
  }

  // 8. Initials of words in name match query (e.g. "vltkm", "dldl")
  if (score === 0 && queryCompact.length >= 2 && queryCompact.length <= 6) {
    const initials = nameNorm.split(' ').filter(Boolean).map((w) => w[0]).join('');
    if (initials === queryCompact) {
      score = 4000;
      matchType = 'acronym';
    } else if (initials.includes(queryCompact)) {
      score = 3500;
      matchType = 'acronym';
    }
  }

  // 9. Multi-token match: all typed words present in name/slug/publisher
  if (score === 0) {
    const tokens = queryNorm.split(' ').filter(Boolean);
    if (tokens.length > 1) {
      const allText = `${nameNorm} ${slugNorm} ${publisherNorm} ${categoryNorm}`;
      if (tokens.every((tok) => allText.includes(tok))) {
        score = 5200;
        matchType = 'name_sub';
      }
    }
  }

  // 10. Publisher match
  if (score === 0) {
    if (publisherRaw === rawQuery || publisherNorm === queryNorm) {
      score = 2500;
      matchType = 'publisher';
      matchDetail = `NPH: ${game.publisher}`;
    } else if (publisherNorm.startsWith(queryNorm) || publisherRaw.startsWith(rawQuery)) {
      score = 2000;
      matchType = 'publisher';
      matchDetail = `NPH: ${game.publisher}`;
    } else if (publisherNorm.includes(queryNorm) || publisherRaw.includes(rawQuery)) {
      score = 1500;
      matchType = 'publisher';
      matchDetail = `NPH: ${game.publisher}`;
    }
  }

  // 11. Category match (e.g. "Roblox / Mini Game")
  if (score === 0) {
    if (categoryRaw === rawQuery || categoryNorm === queryNorm) {
      score = 1000;
      matchType = 'category';
      matchDetail = `Thể loại: ${game.category}`;
    } else if (categoryNorm.includes(queryNorm) || categoryRaw.includes(rawQuery)) {
      score = 800;
      matchType = 'category';
      matchDetail = `Thể loại: ${game.category}`;
    }
  }

  // 12. Description match
  if (score === 0 && game.description) {
    const descNorm = normalizeVietnamese(game.description);
    if (descNorm.includes(queryNorm)) {
      score = 400;
      matchType = 'description';
      matchDetail = 'Khớp trong mô tả';
    }
  }

  // Quality bonuses
  if (score > 0) {
    if (game.is_hot) score += 30;
    if (game.is_featured) score += 20;
    if ((game.codes_count || 0) > 0) score += 50;
  }

  return { score, matchType, matchDetail };
}

/**
 * Split text into chunks highlighting matches for clean React rendering
 */
export function splitMatchHighlight(
  text: string,
  query: string
): Array<{ text: string; isMatch: boolean }> {
  if (!text || !query || !query.trim()) {
    return [{ text: text || '', isMatch: false }];
  }
  const cleanQ = query.trim();
  const qNorm = stripAccents(cleanQ);
  if (!qNorm) return [{ text, isMatch: false }];

  const textNorm = stripAccents(text);
  const idx = textNorm.indexOf(qNorm);
  if (idx === -1) {
    return [{ text, isMatch: false }];
  }

  const parts: Array<{ text: string; isMatch: boolean }> = [];
  let lastIdx = 0;
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const curIdx = textNorm.indexOf(qNorm, searchFrom);
    if (curIdx === -1) break;

    if (curIdx > lastIdx) {
      parts.push({ text: text.slice(lastIdx, curIdx), isMatch: false });
    }
    const matchLen = Math.min(cleanQ.length, text.length - curIdx);
    parts.push({ text: text.slice(curIdx, curIdx + matchLen), isMatch: true });
    lastIdx = curIdx + matchLen;
    searchFrom = lastIdx;
  }

  if (lastIdx < text.length) {
    parts.push({ text: text.slice(lastIdx), isMatch: false });
  }

  return parts;
}


/**
 * Smart Vietnamese search matcher that handles:
 * 1. Diacritic-insensitive matching (có dấu & không dấu, VD: "Hắc Tây Du" khớp "hac-tay-du-chuong-cam")
 * 2. Dash/separator matching (VD: "hac tay du" khớp "hac-tay-du", "genshin impact" khớp "genshin-impact")
 * 3. Multi-word search tokenization (tất cả các từ trong keyword đều có mặt trong tập target)
 * 4. Acronyms & gaming abbreviations (VD: "HSR" khớp "Honkai: Star Rail", "LQ" khớp "Liên Quân Mobile", "HTD" khớp "Hắc Tây Du")
 * 5. Initials matching (chữ cái đầu của các từ)
 */
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

  // 4. Multi-token / All words match check
  const queryTokens = queryNorm.split(' ').filter(Boolean);
  if (queryTokens.length > 1) {
    const allTokensMatch = queryTokens.every(
      (tok) => targetNorm.includes(tok) || targetCompact.includes(tok)
    );
    if (allTokensMatch) return true;
  }

  // 5. Gaming Acronym / Abbreviation Match check
  if (queryCompact.length >= 2 && queryCompact.length <= 6) {
    // Check known gaming acronym map
    const mappedPhrases = GAME_ACRONYM_MAP[queryCompact];
    if (mappedPhrases) {
      for (const phrase of mappedPhrases) {
        const normPhrase = normalizeVietnamese(phrase);
        const compPhrase = normPhrase.replace(/\s+/g, '');
        if (targetNorm.includes(normPhrase) || targetCompact.includes(compPhrase)) {
          return true;
        }
      }
    }

    // Check initials of target words
    const targetWords = targetNorm.split(' ').filter(Boolean);
    const targetInitials = targetWords.map((w) => w[0]).join('');
    if (targetInitials.includes(queryCompact)) return true;
  }

  return false;
}

// Format currency VND
export function formatCurrencyVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

// Format Core Currency (1 VND = 1 Core)
export function formatCore(amount: number): string {
  const formatted = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${formatted} Core`;
}

// Format Dual Display: e.g. "50.000 Core (~50.000đ)"
export function formatPriceDual(amount: number): string {
  const core = formatCore(amount);
  const vnd = formatCurrencyVND(amount);
  return `${core} (${vnd})`;
}

// Format relative date
export function formatRelativeDate(dateStr?: string | null): string {
  if (!dateStr) return 'Gần đây';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return String(dateStr || 'Gần đây');
  }
}

// Safe full datetime format: "14:30:25 - 30/09/2026"
export function formatFullDateTime(dateStr?: string | number | null): string {
  if (!dateStr) return '—';
  try {
    let cleanStr = String(dateStr).trim();
    if (/^\d{10,13}$/.test(cleanStr)) {
      const num = Number(cleanStr);
      const d = new Date(num < 10000000000 ? num * 1000 : num);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
      }
    }
    // If format is SQLite "YYYY-MM-DD HH:MM:SS" without timezone, treat as UTC
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(cleanStr)) {
      cleanStr = cleanStr.replace(' ', 'T') + 'Z';
    }
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    return `${hours}:${minutes}:${seconds} - ${day}/${month}/${year}`;
  } catch {
    return String(dateStr || '—');
  }
}

// Relative time formatting in Vietnamese: "Vừa xong", "5 phút trước", "Hôm qua lúc 14:30"
export function formatTimeAgo(dateStr?: string | number | null): string {
  if (!dateStr) return 'Vừa xong';
  try {
    let cleanStr = String(dateStr).trim();
    if (/^\d{10,13}$/.test(cleanStr)) {
      const num = Number(cleanStr);
      cleanStr = new Date(num < 10000000000 ? num * 1000 : num).toISOString();
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(cleanStr)) {
      cleanStr = cleanStr.replace(' ', 'T') + 'Z';
    }
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) return String(dateStr);

    const now = Date.now();
    const diffSec = Math.floor((now - d.getTime()) / 1000);

    if (diffSec < 30) return 'Vừa xong';
    if (diffSec < 60) return `${diffSec} giây trước`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return 'Hôm qua';
    if (diffDay < 7) return `${diffDay} ngày trước`;

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return 'Gần đây';
  }
}

