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
  roblox: ['roblox'],
};

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

