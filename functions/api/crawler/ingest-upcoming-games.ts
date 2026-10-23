/**
 * Cloudflare Pages Function: Trợ Lý Pine & Muse Bot Upcoming Games Ingestion & Management API
 * Route: /api/crawler/ingest-upcoming-games
 * 
 * Cho phép Trợ lý Pine và Muse Bot quản lý và vận hành danh mục Game Chuẩn Bị Ra Mắt:
 * 1. Xác thực bằng API Key (Bearer Token, X-API-Key, hoặc query param ?api_key=...).
 * 2. Phân chia 2 danh sách rõ ràng:
 *    - Danh sách Hiển thị trên Web (status: 'UPCOMING' | 'APPROVED'): Top 6 game đầu tiên hiển thị ngay trên web khách, các game còn lại hiển thị khi bấm Xem Thêm.
 *    - Danh sách Hàng chờ duyệt (status: 'PENDING'): Các game do Pine/Muse bot hoặc admin đưa vào, duyệt xong mới xuất bản lên web.
 * 3. Hỗ trợ đầy đủ các Action:
 *    - Ingest / Add / Update: Nạp thông tin game mới.
 *    - Approve: Duyệt game từ hàng chờ đưa lên web (có tùy chọn ghim Top 6).
 *    - Approve_All: Duyệt toàn bộ hàng chờ.
 *    - Reject / Delete: Xóa hoặc từ chối game.
 *    - Reorder: Tùy chỉnh thứ tự sắp xếp game hiển thị trên Web.
 *    - Move_To_Pending: Chuyển game từ web về lại hàng chờ.
 */

import { getSettingD1, setSettingD1 } from '../../services/d1_service';

export interface Env {
  DB?: D1Database;
  ADMIN_SYNC_SECRET?: string;
  JWT_SECRET?: string;
  MUSE_API_KEY?: string;
  PINE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Sync-Key, X-Requested-With',
};

const DEFAULT_UPCOMING_GAMES_FALLBACK = [
  {
    id: 'ug_strinova_vn',
    name: 'Strinova VN',
    slug: 'strinova-vn',
    publisher: 'iDreamSky / VPlay',
    releaseDate: '2026-10-23T10:00:00+07:00',
    category: 'Bắn Súng Anime 3D',
    platform: 'PC, Android, iOS',
    iconUrl: '/game_icons/strinova-vn.webp',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    description: 'Game bắn súng chiến thuật biến hình Anime 3D góc nhìn thứ ba đỉnh cao 2026 từ iDreamSky.',
    preRegUrl: 'https://strinova.vplay.vn',
    expectedCodes: ['STRINOVAOB', 'STRINOVAVN', 'VIP999', 'OPENBETA2026'],
    subscribersCount: 2840,
    source: 'Trợ lý Pine & Muse Bot',
    status: 'UPCOMING',
    displayOrder: 1,
    createdAt: '2026-10-20T08:00:00Z',
    updatedAt: '2026-10-22T14:00:00Z',
  },
  {
    id: 'ug_tien_gioi',
    name: 'Tiên Giới',
    slug: 'tien-gioi',
    publisher: 'SohaGame',
    releaseDate: '2026-10-28T10:00:00+07:00',
    category: 'Nhập Vai Tiên Hiệp',
    platform: 'Android, iOS',
    iconUrl: '/game_icons/tien-gioi.webp',
    bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    description: 'Siêu phẩm MMORPG tiên hiệp thế giới mở đồ họa 4K với hệ thống phi kiếm và không chiến độc nhất.',
    preRegUrl: 'https://tiengioi.sohagame.vn',
    expectedCodes: ['TIENGIOI2026', 'TIENGIOISOHA', 'VIP666', 'TANTHU2026'],
    subscribersCount: 1950,
    source: 'Trợ lý Pine & Muse Bot',
    status: 'UPCOMING',
    displayOrder: 2,
    createdAt: '2026-10-21T09:30:00Z',
    updatedAt: '2026-10-22T16:00:00Z',
  },
  {
    id: 'ug_hiep_khach_hanh',
    name: 'Hiệp Khách Hành',
    slug: 'hiep-khach-hanh',
    publisher: 'VTC Mobile',
    releaseDate: '2026-11-01T10:00:00+07:00',
    category: 'Kiếm Hiệp Kim Dung',
    platform: 'Android, iOS',
    iconUrl: '/game_icons/hiep-khach-hanh.webp',
    bannerUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
    description: 'Tuyệt phẩm kiếm hiệp Kim Dung chính tông do VTC Mobile phát hành độc quyền tại Việt Nam.',
    preRegUrl: 'https://hiepkhachhanh.vtc.vn',
    expectedCodes: ['HIEPKHACHHANH', 'HKHVTC', 'TANTHU', 'TRIAN2026'],
    subscribersCount: 1420,
    source: 'Trợ lý Pine & Muse Bot',
    status: 'UPCOMING',
    displayOrder: 3,
    createdAt: '2026-10-21T11:00:00Z',
    updatedAt: '2026-10-22T17:00:00Z',
  },
  {
    id: 'ug_where_winds_meet',
    name: 'Where Winds Meet VN',
    slug: 'where-winds-meet',
    publisher: 'NetEase Games',
    releaseDate: '2026-11-15T09:00:00+07:00',
    category: 'Hành Động Thế Giới Mở',
    platform: 'PC, Mobile',
    iconUrl: '/game_icons/where-winds-meet.webp',
    bannerUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
    description: 'Bom tấn võ hiệp thế giới mở thời Ngũ Đại Thập Quốc với đồ họa ray-tracing đỉnh cao.',
    expectedCodes: ['WHEREWINDSMEET', 'WWMOPENBETA', 'VIP888'],
    subscribersCount: 5630,
    source: 'Trợ lý Pine & Muse Bot',
    status: 'UPCOMING',
    displayOrder: 4,
    createdAt: '2026-10-18T10:00:00Z',
    updatedAt: '2026-10-22T12:00:00Z',
  },
  {
    id: 'ug_hsr_ver30',
    name: 'Honkai: Star Rail 3.0',
    slug: 'honkai-star-rail',
    publisher: 'HoYoverse',
    releaseDate: '2026-12-10T10:00:00+07:00',
    category: 'Chiến Thuật Theo Lượt',
    platform: 'PC, Android, iOS',
    iconUrl: '/game_icons/honkai-star-rail.webp',
    bannerUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80',
    description: 'Phiên bản đại cập nhật 3.0 mở ra hành tinh mới Amphoreus và dàn nhân vật 5 sao giới hạn mới.',
    expectedCodes: ['HSRVER30', 'STARRAIL30', 'AMPHOREUS'],
    subscribersCount: 8900,
    source: 'Trợ lý Pine & Muse Bot',
    status: 'UPCOMING',
    displayOrder: 5,
    createdAt: '2026-10-19T14:00:00Z',
    updatedAt: '2026-10-22T18:00:00Z',
  },
  {
    id: 'ug_monster_hunter_outlanders',
    name: 'Monster Hunter Outlanders',
    slug: 'monster-hunter-outlanders',
    publisher: 'TiMi Studio / Capcom',
    releaseDate: '2026-10-29T00:00:00+07:00',
    category: 'Săn Quái Thế Giới Mở',
    platform: 'Android, iOS',
    iconUrl: '/game_icons/monster-hunter-outlanders.webp',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    description: 'Siêu phẩm săn quái vật co-op thế giới mở đỉnh cao giữa Capcom và TiMi Studio Group trên di động.',
    expectedCodes: [],
    subscribersCount: 3200,
    source: 'Trợ lý Pine & Muse Bot',
    status: 'UPCOMING',
    displayOrder: 6,
    createdAt: '2026-10-22T10:00:00Z',
    updatedAt: '2026-10-23T10:00:00Z',
  },
];

async function authenticateRequest(request: Request, env: Env, bodyApiKey?: string): Promise<{ authorized: boolean; botName: string; error?: string }> {
  const urlObj = new URL(request.url);
  const authHeader = request.headers.get('Authorization') || '';
  const apiKeyHeader = request.headers.get('X-API-Key') || request.headers.get('X-Sync-Key') || '';
  const queryKey = urlObj.searchParams.get('api_key') || urlObj.searchParams.get('key') || '';

  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || apiKeyHeader.trim() || queryKey.trim() || (bodyApiKey ? String(bodyApiKey).trim() : '');

  if (!token) {
    return { authorized: false, botName: '', error: 'Thiếu API Key xác thực (Bearer Token, header X-API-Key hoặc trường apiKey trong JSON payload)' };
  }

  // 1. Kiểm tra với ADMIN_SYNC_SECRET hoặc MUSE_API_KEY hoặc PINE_API_KEY
  if (env.ADMIN_SYNC_SECRET && token === env.ADMIN_SYNC_SECRET) {
    return { authorized: true, botName: 'Admin Sync Secret' };
  }
  if (env.MUSE_API_KEY && token === env.MUSE_API_KEY) {
    return { authorized: true, botName: 'Muse Master Bot' };
  }
  if (env.PINE_API_KEY && token === env.PINE_API_KEY) {
    return { authorized: true, botName: 'Trợ lý Pine' };
  }

  // 2. Xác thực với khóa cấu hình đang lưu trong cơ sở dữ liệu D1
  if (env.DB) {
    try {
      const apiConfig = await getSettingD1(env.DB, 'wcg_crawler_api_config_v1');
      const configuredKey = apiConfig?.apiKey ? String(apiConfig.apiKey).trim() : '';
      if (configuredKey && token === configuredKey) {
        return { authorized: true, botName: apiConfig?.botName || 'Trợ lý Pine & Muse Bot' };
      }
    } catch (err) {
      console.error('[IngestUpcomingGames] Lỗi đọc cấu hình API từ D1:', err);
    }
  }

  return { authorized: false, botName: '', error: 'API Key không chính xác hoặc đã bị vô hiệu hóa.' };
}

function slugify(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Trích xuất và chuẩn hóa URL icon từ mọi biến thể tên trường mà bot / crawler có thể gửi
 */
function extractIconUrl(item: any, fallbackSlug?: string): string {
  if (!item || typeof item !== 'object') {
    return fallbackSlug ? `/game_icons/${fallbackSlug}.webp` : '';
  }

  const candidate =
    item.iconUrl ||
    item.icon_url ||
    item.icon ||
    item.gameIcon ||
    item.game_icon ||
    item.avatar ||
    item.avatarUrl ||
    item.avatar_url ||
    item.imageUrl ||
    item.image_url ||
    item.image ||
    item.logo ||
    item.logoUrl ||
    item.logo_url ||
    item.thumbnail ||
    item.thumb ||
    item.cover ||
    item.cover_image ||
    item.cover_image_url ||
    item.localIconPath ||
    item.iconPath;

  if (candidate && typeof candidate === 'string') {
    let trimmed = candidate.trim();
    if (trimmed) {
      // Chuẩn hóa giao thức không an toàn nếu có
      if (trimmed.startsWith('//')) {
        trimmed = 'https:' + trimmed;
      }
      // Giữ nguyên các URL hợp lệ (https, http, absolute path, data URL)
      if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('/') ||
        trimmed.startsWith('data:image/')
      ) {
        return trimmed;
      }
      // Nếu là tên file như "strinova.webp" hoặc "strinova.png"
      return `/game_icons/${trimmed}`;
    }
  }

  return fallbackSlug ? `/game_icons/${fallbackSlug}.webp` : '';
}

/**
 * Tự động bảo vệ & phục hồi dữ liệu gốc chuẩn xác (Self-Healing Safeguard)
 * Ngăn chặn tuyệt đối việc bot hoặc API gửi thiếu trường làm đè mất ngày giờ mở server hoặc thể loại chuẩn của game.
 */
function sanitizeAndSafeguardUpcomingGames(list: any[]): { list: any[]; changed: boolean } {
  let changed = false;
  for (const g of list) {
    if (!g || typeof g !== 'object') continue;
    const slugLower = String(g.slug || '').toLowerCase();
    const nameLower = String(g.name || '').toLowerCase();

    // 1. Strinova VN: Phục hồi ngày 23/10 10:00, category Bắn Súng Anime 3D, platform PC, Android, iOS
    if (slugLower.includes('strinova') || nameLower.includes('strinova')) {
      if (!g.releaseDate || !g.releaseDate.includes('10:00') || g.category === 'Game Mới' || g.publisher === 'Nhà phát hành') {
        g.name = 'Strinova VN';
        g.publisher = 'iDreamSky / VPlay';
        g.releaseDate = '2026-10-23T10:00:00+07:00';
        g.category = 'Bắn Súng Anime 3D';
        g.platform = 'PC, Android, iOS';
        if (!g.preRegUrl) g.preRegUrl = 'https://strinova.vplay.vn';
        changed = true;
      }
    }

    // 2. Hiệp Khách Hành: Phục hồi ngày 01/11 10:00, category Kiếm Hiệp Kim Dung, platform Android, iOS
    if (slugLower.includes('hiep-khach-hanh') || nameLower.includes('hiep khach hanh') || nameLower.includes('hiệp khách hành')) {
      if (!g.releaseDate || g.releaseDate.startsWith('2026-10-23') || g.category === 'Game Mới' || g.publisher === 'Nhà phát hành') {
        g.name = 'Hiệp Khách Hành';
        g.publisher = 'VTC Mobile';
        g.releaseDate = '2026-11-01T10:00:00+07:00';
        g.category = 'Kiếm Hiệp Kim Dung';
        g.platform = 'Android, iOS';
        if (!g.preRegUrl) g.preRegUrl = 'https://hiepkhachhanh.vtc.vn';
        changed = true;
      }
    }

    // 3. Tiên Giới: Ngày 28/10 10:00, category Nhập Vai Tiên Hiệp
    if (slugLower.includes('tien-gioi') || nameLower.includes('tien gioi') || nameLower.includes('tiên giới')) {
      if (!g.releaseDate || g.category === 'Game Mới' || g.publisher === 'Nhà phát hành') {
        g.name = 'Tiên Giới';
        g.publisher = 'SohaGame';
        g.releaseDate = '2026-10-28T10:00:00+07:00';
        g.category = 'Nhập Vai Tiên Hiệp';
        g.platform = 'Android, iOS';
        changed = true;
      }
    }

    // 4. Monster Hunter Outlanders: Giờ mở server 00:00 ngày 29/10/2026
    if (slugLower.includes('monster-hunter') || nameLower.includes('monster hunter')) {
      if (!g.releaseDate || g.releaseDate.startsWith('2026-10-23') || g.category === 'Game Mới') {
        g.name = 'Monster Hunter Outlanders';
        g.publisher = (g.publisher && g.publisher !== 'Nhà phát hành') ? g.publisher : 'TiMi Studio / Capcom';
        g.releaseDate = '2026-10-29T00:00:00+07:00';
        g.category = (g.category && g.category !== 'Game Mới') ? g.category : 'Săn Quái Thế Giới Mở';
        g.platform = g.platform || 'Android, iOS';
        changed = true;
      }
    }
  }
  return { list, changed };
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const statusFilter = (url.searchParams.get('status') || 'UPCOMING').toUpperCase();
  const targetSlug = url.searchParams.get('slug');

  let upcomingGames: any[] = [];
  if (env.DB) {
    try {
      const saved = await getSettingD1(env.DB, 'wcg_admin_upcoming_games_v1');
      if (Array.isArray(saved)) {
        upcomingGames = saved;
      }
    } catch (err) {
      console.error('[IngestUpcomingGames] Lỗi đọc upcoming_games từ D1:', err);
    }
  }

  if (upcomingGames.length === 0) {
    upcomingGames = DEFAULT_UPCOMING_GAMES_FALLBACK;
  }

  // Tự động kiểm tra và chữa lành tính toàn vẹn dữ liệu
  const { changed: getChanged } = sanitizeAndSafeguardUpcomingGames(upcomingGames);
  if (getChanged && env.DB) {
    setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', upcomingGames).catch(() => {});
  }

  // Ensure default displayOrder & valid icons if missing
  upcomingGames.forEach((g, idx) => {
    if (typeof g.displayOrder !== 'number') {
      g.displayOrder = idx + 1;
    }
    const ic = extractIconUrl(g, g.slug);
    if (!g.iconUrl) g.iconUrl = ic;
    if (!g.icon_url) g.icon_url = ic;
  });

  if (targetSlug) {
    const single = upcomingGames.find((g) => g.slug === targetSlug || g.id === targetSlug);
    if (!single) {
      return new Response(JSON.stringify({ success: false, error: 'Không tìm thấy game sắp ra mắt' }), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }
    return new Response(JSON.stringify({ success: true, game: single }), {
      headers: CORS_HEADERS,
    });
  }

  const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 Giờ Grace Period trên Banner
  const now = Date.now();

  let filtered = upcomingGames;
  if (statusFilter === 'UPCOMING' || statusFilter === 'APPROVED' || statusFilter === 'WEB') {
    // Chỉ trả về các game đã duyệt và chưa quá hạn 24h sau khi mở server (Game ra mắt trong ngày hoặc đang đếm ngược)
    filtered = upcomingGames.filter((g) => {
      const isApproved = g.status === 'UPCOMING' || g.status === 'APPROVED';
      if (!isApproved) return false;
      if (!g.releaseDate) return true;
      const target = new Date(g.releaseDate).getTime();
      if (isNaN(target)) return true;
      const elapsed = now - target;
      return elapsed <= ONE_DAY_MS;
    });
  } else if (statusFilter === 'PENDING') {
    // Chỉ trả về hàng chờ duyệt
    filtered = upcomingGames.filter((g) => g.status === 'PENDING');
  } else if (statusFilter === 'LAUNCHED' || statusFilter === 'ROLLED_OVER') {
    // Trả về các game đã mở server quá 24h hoặc đã chuyển xuống sàn
    filtered = upcomingGames.filter((g) => {
      if (g.status === 'LAUNCHED') return true;
      if (!g.releaseDate) return false;
      const target = new Date(g.releaseDate).getTime();
      return !isNaN(target) && (now - target) > ONE_DAY_MS;
    });
  } else if (statusFilter !== 'ALL') {
    filtered = upcomingGames.filter((g) => g.status === statusFilter);
  }

  // Làm giàu dữ liệu với các chỉ số trạng thái 24h và thời gian còn lại trên banner
  const enriched = filtered.map((g) => {
    let rolloverStatus = 'COUNTDOWN';
    let hoursRemainingOnBanner = 0;
    let minutesRemainingOnBanner = 0;
    if (g.releaseDate) {
      const target = new Date(g.releaseDate).getTime();
      if (!isNaN(target)) {
        const elapsed = now - target;
        if (elapsed < 0) {
          rolloverStatus = 'COUNTDOWN';
        } else if (elapsed <= ONE_DAY_MS) {
          rolloverStatus = 'TODAY_LAUNCH';
          const remainingMs = ONE_DAY_MS - elapsed;
          hoursRemainingOnBanner = Math.floor(remainingMs / (1000 * 60 * 60));
          minutesRemainingOnBanner = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        } else {
          rolloverStatus = 'ROLLED_OVER';
        }
      }
    }
    return {
      ...g,
      rolloverStatus,
      hoursRemainingOnBanner,
      minutesRemainingOnBanner,
      isLaunched: rolloverStatus !== 'COUNTDOWN',
      isRolledOver: rolloverStatus === 'ROLLED_OVER',
    };
  });

  // Sort by displayOrder ascending, then by releaseDate
  enriched.sort((a, b) => {
    const orderA = typeof a.displayOrder === 'number' ? a.displayOrder : 999;
    const orderB = typeof b.displayOrder === 'number' ? b.displayOrder : 999;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
  });

  const liveCount = upcomingGames.filter((g) => {
    const isApproved = g.status === 'UPCOMING' || g.status === 'APPROVED';
    if (!isApproved) return false;
    if (!g.releaseDate) return true;
    const target = new Date(g.releaseDate).getTime();
    return isNaN(target) || (now - target) <= ONE_DAY_MS;
  }).length;
  const pendingCount = upcomingGames.filter((g) => g.status === 'PENDING').length;
  const launchedCount = upcomingGames.filter((g) => {
    if (g.status === 'LAUNCHED') return true;
    if (!g.releaseDate) return false;
    const target = new Date(g.releaseDate).getTime();
    return !isNaN(target) && (now - target) > ONE_DAY_MS;
  }).length;

  return new Response(
    JSON.stringify({
      success: true,
      total: enriched.length,
      liveCount,
      top6Count: Math.min(6, liveCount),
      pendingCount,
      launchedCount,
      games: enriched,
      timestamp: new Date().toISOString(),
    }),
    { headers: CORS_HEADERS }
  );
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const startTime = Date.now();
  const sourceIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';

  let payload: any = null;
  try {
    payload = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Dữ liệu JSON gửi lên không hợp lệ.' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 1. Xác thực API Key
  const auth = await authenticateRequest(request, env, payload?.apiKey);
  if (!auth.authorized) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error || 'Truy cập bị từ chối.' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const botName = payload?.botName || payload?.source || auth.botName || 'Trợ lý Pine & Muse Bot';
  const action = String(payload?.action || 'ingest').toLowerCase();
  const nowIso = new Date().toISOString();

  // 2. Tải danh sách hiện tại từ D1
  let currentUpcomingGames: any[] = [];
  if (env.DB) {
    try {
      const saved = await getSettingD1(env.DB, 'wcg_admin_upcoming_games_v1');
      if (Array.isArray(saved) && saved.length > 0) {
        currentUpcomingGames = saved;
      } else {
        currentUpcomingGames = [...DEFAULT_UPCOMING_GAMES_FALLBACK];
      }
    } catch (e) {
      console.warn('[IngestUpcomingGames] Warning reading existing upcoming games:', e);
      currentUpcomingGames = [...DEFAULT_UPCOMING_GAMES_FALLBACK];
    }
  } else {
    currentUpcomingGames = [...DEFAULT_UPCOMING_GAMES_FALLBACK];
  }

  // Tự động bảo vệ & phục hồi dữ liệu gốc trước mọi thao tác
  sanitizeAndSafeguardUpcomingGames(currentUpcomingGames);

  // ACTION 0A: SET_DISPLAY_LIST / SAVE_ALL (Admin & Pine Bot Toàn Quyền Đồng Bộ / Phân Phối Trực Tiếp Danh Sách)
  if (action === 'set_display_list' || action === 'save_all' || action === 'sync_all') {
    const incomingGames = payload?.games;
    if (!Array.isArray(incomingGames)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mảng "games" hợp lệ.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Chuẩn hóa icon cho từng game trong mảng
    incomingGames.forEach((g: any) => {
      const ic = extractIconUrl(g, g.slug);
      if (ic) {
        g.iconUrl = ic;
        g.icon_url = ic;
      }
    });

    currentUpcomingGames = incomingGames;
    if (env.DB) {
      await setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', currentUpcomingGames);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã đồng bộ toàn bộ ${currentUpcomingGames.length} tựa game lên cơ sở dữ liệu D1 thành công.`,
        total: currentUpcomingGames.length,
        games: currentUpcomingGames,
      }),
      { headers: CORS_HEADERS }
    );
  }

  // ACTION 0B: ROLLOVER (Kiểm tra và tự động chuyển các game đã mở quá 24h xuống sàn)
  if (action === 'rollover' || action === 'check_rollover') {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    let rolledOverCount = 0;
    const rolledOverItems: any[] = [];

    for (const item of currentUpcomingGames) {
      if ((item.status === 'UPCOMING' || item.status === 'APPROVED') && item.releaseDate) {
        const target = new Date(item.releaseDate).getTime();
        if (!isNaN(target) && (now - target) > ONE_DAY_MS) {
          item.status = 'LAUNCHED';
          item.rolledOverAt = nowIso;
          item.updatedAt = nowIso;
          rolledOverCount++;
          rolledOverItems.push({ id: item.id, name: item.name, slug: item.slug, releaseDate: item.releaseDate });
        }
      }
    }

    if (rolledOverCount > 0 && env.DB) {
      await setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', currentUpcomingGames);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã kiểm tra và chuyển ${rolledOverCount} game đã mở quá 24h xuống sàn.`,
        rolledOverCount,
        rolledOverItems,
        games: currentUpcomingGames,
      }),
      { headers: CORS_HEADERS }
    );
  }

  // ACTION 1: APPROVE (Duyệt game từ hàng chờ đưa lên Web)
  if (action === 'approve') {
    const rawTarget = payload?.id || payload?.slug || payload?.name;
    const targetIds: string[] = Array.isArray(payload?.ids)
      ? payload.ids.map((x: any) => String(x).toLowerCase().trim())
      : (Array.isArray(payload?.names)
          ? payload.names.map((x: any) => String(x).toLowerCase().trim())
          : (rawTarget ? [String(rawTarget).toLowerCase().trim()] : []));
    const pinToTop = Boolean(payload?.pinToTop);

    if (targetIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu trường "id", "slug" hoặc "name" để duyệt game.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let approvedCount = 0;
    // Calculate max current display order
    let maxOrder = 0;
    currentUpcomingGames.forEach((g) => {
      if (typeof g.displayOrder === 'number' && g.displayOrder > maxOrder) {
        maxOrder = g.displayOrder;
      }
    });

    for (const item of currentUpcomingGames) {
      const idLower = String(item.id || '').toLowerCase();
      const slugLower = String(item.slug || '').toLowerCase();
      const nameLower = String(item.name || '').toLowerCase();
      const itemSlug = slugify(nameLower);

      const isMatched = targetIds.some(
        (t) => idLower === t || slugLower === t || itemSlug === t || nameLower === t || nameLower.includes(t)
      );

      if (isMatched) {
        item.status = 'UPCOMING';
        item.approvedAt = nowIso;
        item.approvedBy = botName;
        item.updatedAt = nowIso;
        if (pinToTop) {
          item.displayOrder = 1;
        } else if (!item.displayOrder || item.displayOrder <= 0) {
          item.displayOrder = ++maxOrder;
        }
        approvedCount++;
      }
    }

    if (pinToTop) {
      // Re-index all approved games so the newly pinned game sits at order 1
      let orderIndex = 2;
      currentUpcomingGames.forEach((item) => {
        if (item.displayOrder !== 1 && (item.status === 'UPCOMING' || item.status === 'APPROVED')) {
          item.displayOrder = orderIndex++;
        }
      });
    }

    sanitizeAndSafeguardUpcomingGames(currentUpcomingGames);
    if (env.DB) await setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', currentUpcomingGames);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã duyệt thành công ${approvedCount} game đưa lên Web Khách.`,
        approvedCount,
        games: currentUpcomingGames,
      }),
      { headers: CORS_HEADERS }
    );
  }

  // ACTION 1B: SET_STATUS / UPDATE_STATUS (Đổi trạng thái game theo id, slug hoặc name)
  if (action === 'set_status' || action === 'update_status' || action === 'change_status') {
    const rawTarget = payload?.id || payload?.slug || payload?.name;
    const targetStatus = String(payload?.status || 'UPCOMING').toUpperCase();
    const pinToTop = Boolean(payload?.pinToTop);

    if (!rawTarget) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Thiếu trường "id", "slug" hoặc "name" để cập nhật trạng thái.',
          validStatuses: ['UPCOMING', 'APPROVED', 'PENDING', 'LAUNCHED', 'ROLLED_OVER', 'CANCELLED'],
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const targetKey = String(rawTarget).trim().toLowerCase();
    const targetSlug = slugify(targetKey);

    let updatedGame: any = null;
    let maxOrder = 0;
    currentUpcomingGames.forEach((g) => {
      if (typeof g.displayOrder === 'number' && g.displayOrder > maxOrder) {
        maxOrder = g.displayOrder;
      }
    });

    for (const item of currentUpcomingGames) {
      const idLower = String(item.id || '').toLowerCase();
      const slugLower = String(item.slug || '').toLowerCase();
      const nameLower = String(item.name || '').toLowerCase();
      const itemSlug = slugify(nameLower);

      if (
        idLower === targetKey ||
        slugLower === targetKey ||
        slugLower === targetSlug ||
        nameLower === targetKey ||
        itemSlug === targetSlug ||
        nameLower.includes(targetKey)
      ) {
        item.status = targetStatus;
        item.updatedAt = nowIso;
        if (targetStatus === 'UPCOMING' || targetStatus === 'APPROVED') {
          item.approvedAt = nowIso;
          item.approvedBy = botName;
          if (pinToTop) {
            item.displayOrder = 1;
          } else if (!item.displayOrder || item.displayOrder <= 0) {
            item.displayOrder = ++maxOrder;
          }
        }
        updatedGame = item;
        break;
      }
    }

    if (!updatedGame) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy tựa game khớp với "${rawTarget}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (pinToTop && (targetStatus === 'UPCOMING' || targetStatus === 'APPROVED')) {
      let orderIndex = 2;
      currentUpcomingGames.forEach((item) => {
        if (item.id !== updatedGame.id && (item.status === 'UPCOMING' || item.status === 'APPROVED')) {
          item.displayOrder = orderIndex++;
        }
      });
      updatedGame.displayOrder = 1;
    }

    sanitizeAndSafeguardUpcomingGames(currentUpcomingGames);
    if (env.DB) await setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', currentUpcomingGames);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã đổi trạng thái game "${updatedGame.name}" sang "${targetStatus}" thành công.`,
        game: updatedGame,
        games: currentUpcomingGames,
      }),
      { headers: CORS_HEADERS }
    );
  }

  // ACTION 1C: CLEAR_EXPECTED_CODES / CLEAR_CODES (Xóa sạch cột mã code dự kiến)
  if (action === 'clear_expected_codes' || action === 'clear_codes' || action === 'reset_codes') {
    const rawTarget = payload?.id || payload?.slug || payload?.name;
    const targetIds: string[] = Array.isArray(payload?.ids)
      ? payload.ids.map((x: any) => String(x).toLowerCase().trim())
      : (Array.isArray(payload?.names)
          ? payload.names.map((x: any) => String(x).toLowerCase().trim())
          : (rawTarget ? [String(rawTarget).toLowerCase().trim()] : []));

    if (targetIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu trường "id", "slug" hoặc "name" để xóa code dự kiến.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let clearedCount = 0;
    const affectedNames: string[] = [];

    for (const item of currentUpcomingGames) {
      const idLower = String(item.id || '').toLowerCase();
      const slugLower = String(item.slug || '').toLowerCase();
      const nameLower = String(item.name || '').toLowerCase();
      const itemSlug = slugify(nameLower);

      const matched = targetIds.some(
        (t) => idLower === t || slugLower === t || itemSlug === t || nameLower === t || nameLower.includes(t) || slugLower.includes(t)
      );

      if (matched) {
        item.expectedCodes = [];
        item.updatedAt = nowIso;
        clearedCount++;
        affectedNames.push(item.name);
      }
    }

    if (clearedCount > 0 && env.DB) {
      await setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', currentUpcomingGames);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã xóa sạch mã code dự kiến của ${clearedCount} game: ${affectedNames.join(', ')}.`,
        clearedCount,
        affectedGames: affectedNames,
        games: currentUpcomingGames,
      }),
      { headers: CORS_HEADERS }
    );
  }

  // ACTION 1D: UPDATE_ICON / SET_ICON (Pine Bot & Muse Bot cập nhật icon chính xác cho game)
  if (action === 'update_icon' || action === 'set_icon' || action === 'change_icon') {
    const rawTarget = payload?.id || payload?.slug || payload?.name;
    const incomingIcon = extractIconUrl(payload);

    if (!rawTarget) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Thiếu trường "id", "slug" hoặc "name" để xác định tựa game cần cập nhật icon.',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!incomingIcon) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Thiếu URL icon hợp lệ. Vui lòng gửi trường "iconUrl", "icon_url", "icon", "gameIcon" hoặc "imageUrl".',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const targetKey = String(rawTarget).trim().toLowerCase();
    const targetSlug = slugify(targetKey);

    let updatedGame: any = null;
    for (const item of currentUpcomingGames) {
      const idLower = String(item.id || '').toLowerCase();
      const slugLower = String(item.slug || '').toLowerCase();
      const nameLower = String(item.name || '').toLowerCase();
      const itemSlug = slugify(nameLower);

      if (
        idLower === targetKey ||
        slugLower === targetKey ||
        slugLower === targetSlug ||
        nameLower === targetKey ||
        itemSlug === targetSlug ||
        nameLower.includes(targetKey) ||
        slugLower.includes(targetKey)
      ) {
        item.iconUrl = incomingIcon;
        item.icon_url = incomingIcon;
        item.updatedAt = nowIso;
        item.source = botName;
        updatedGame = item;
        break;
      }
    }

    if (!updatedGame) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy tựa game sắp ra mắt khớp với "${rawTarget}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Lưu vào cơ sở dữ liệu D1
    if (env.DB) {
      await setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', currentUpcomingGames);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã cập nhật icon chuẩn xác cho tựa game "${updatedGame.name}".`,
        game: {
          id: updatedGame.id,
          name: updatedGame.name,
          slug: updatedGame.slug,
          iconUrl: updatedGame.iconUrl,
          icon_url: updatedGame.icon_url,
          status: updatedGame.status,
        },
      }),
      { headers: CORS_HEADERS }
    );
  }

  // ACTION 2: APPROVE_ALL (Duyệt toàn bộ hàng chờ)
  if (action === 'approve_all') {
    let approvedCount = 0;
    let maxOrder = 0;
    currentUpcomingGames.forEach((g) => {
      if (typeof g.displayOrder === 'number' && g.displayOrder > maxOrder) {
        maxOrder = g.displayOrder;
      }
    });

    for (const item of currentUpcomingGames) {
      if (item.status === 'PENDING') {
        item.status = 'UPCOMING';
        item.approvedAt = nowIso;
        item.approvedBy = botName;
        item.updatedAt = nowIso;
        item.displayOrder = ++maxOrder;
        approvedCount++;
      }
    }

    if (env.DB) await setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', currentUpcomingGames);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã duyệt toàn bộ ${approvedCount} tựa game trong hàng chờ lên Web Khách.`,
        approvedCount,
        games: currentUpcomingGames,
      }),
      { headers: CORS_HEADERS }
    );
  }

  // ACTION 3: REJECT / DELETE (Từ chối hoặc xóa game)
  if (action === 'reject' || action === 'delete') {
    const targetId = payload?.id || payload?.slug;
    const targetIds: string[] = Array.isArray(payload?.ids)
      ? payload.ids.map((x: any) => String(x).toLowerCase())
      : (targetId ? [String(targetId).toLowerCase()] : []);

    if (targetIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu trường "id" hoặc "ids" để xóa/từ chối.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const beforeLen = currentUpcomingGames.length;
    currentUpcomingGames = currentUpcomingGames.filter((g) => {
      const idLower = (g.id || '').toLowerCase();
      const slugLower = (g.slug || '').toLowerCase();
      return !targetIds.includes(idLower) && !targetIds.includes(slugLower);
    });
    const deletedCount = beforeLen - currentUpcomingGames.length;

    if (env.DB) await setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', currentUpcomingGames);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã xóa/từ chối ${deletedCount} game.`,
        deletedCount,
        games: currentUpcomingGames,
      }),
      { headers: CORS_HEADERS }
    );
  }

  // ACTION 4: REORDER (Sắp xếp thứ tự các game hiển thị trên Web)
  if (action === 'reorder') {
    const orderedIds = payload?.orderedIds || payload?.ids;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mảng "orderedIds" chứa danh sách ID/slug theo thứ tự mong muốn.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const orderMap = new Map<string, number>();
    orderedIds.forEach((id: string, idx: number) => {
      orderMap.set(String(id).toLowerCase(), idx + 1);
    });

    for (const item of currentUpcomingGames) {
      const idLower = (item.id || '').toLowerCase();
      const slugLower = (item.slug || '').toLowerCase();
      if (orderMap.has(idLower)) {
        item.displayOrder = orderMap.get(idLower);
      } else if (orderMap.has(slugLower)) {
        item.displayOrder = orderMap.get(slugLower);
      }
    }

    // Sort by displayOrder
    currentUpcomingGames.sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));

    if (env.DB) await setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', currentUpcomingGames);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã cập nhật thứ tự hiển thị game thành công. Top 6 game đầu tiên sẽ hiển thị ngay trên web khách.',
        games: currentUpcomingGames,
      }),
      { headers: CORS_HEADERS }
    );
  }

  // ACTION 5: MOVE_TO_PENDING (Chuyển game về lại hàng chờ duyệt)
  if (action === 'move_to_pending') {
    const targetId = payload?.id || payload?.slug;
    for (const item of currentUpcomingGames) {
      if (item.id === targetId || item.slug === targetId) {
        item.status = 'PENDING';
        item.updatedAt = nowIso;
      }
    }
    if (env.DB) await setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', currentUpcomingGames);

    return new Response(
      JSON.stringify({ success: true, message: 'Đã chuyển game về hàng chờ duyệt.', games: currentUpcomingGames }),
      { headers: CORS_HEADERS }
    );
  }

  // ACTION 6: DEFAULT INGEST / ADD / UPDATE
  const incomingList: any[] = Array.isArray(payload)
    ? payload
    : (Array.isArray(payload?.games) ? payload.games : (payload?.name ? [payload] : []));

  if (incomingList.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Payload cần chứa mảng "games" hoặc tối thiểu 1 game có trường "name".',
        sampleFormat: {
          apiKey: 'YOUR_API_KEY',
          botName: 'Trợ lý Pine',
          action: 'ingest',
          directPublish: true, // Đặt true để xuất bản thẳng ra Web Khách (status: UPCOMING) mà không cần chờ duyệt
          games: [
            {
              name: 'Strinova VN',
              slug: 'strinova-vn',
              publisher: 'iDreamSky / VPlay',
              releaseDate: '2026-10-23T10:00:00+07:00',
              category: 'Bắn Súng Anime 3D',
              platform: 'PC, Android, iOS',
              iconUrl: '/game_icons/strinova-vn.webp',
              status: 'UPCOMING', // 'PENDING' để vào Hàng chờ duyệt, hoặc 'UPCOMING' để duyệt ngay
              expectedCodes: ['STRINOVAOB', 'VIP999'],
            },
          ],
        },
      }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const existingMap = new Map<string, any>();
  for (const item of currentUpcomingGames) {
    if (item.slug) existingMap.set(item.slug.toLowerCase(), item);
    if (item.id) existingMap.set(item.id.toLowerCase(), item);
  }

  let addedCount = 0;
  let updatedCount = 0;
  const processedDetails: any[] = [];

  for (const raw of incomingList) {
    if (!raw || typeof raw !== 'object' || !raw.name) continue;

    const name = String(raw.name).trim();
    const slug = raw.slug ? slugify(String(raw.slug).trim()) : slugify(name);
    if (!slug) continue;

    // Kiểm tra chính xác xem các trường có được cung cấp trong payload không
    const hasRelDate = Boolean(raw.releaseDate || raw.release_date || raw.launchDate || raw.launch_date);
    const rawRelDate = String(raw.releaseDate || raw.release_date || raw.launchDate || raw.launch_date || '').trim();

    const hasPublisher = Boolean(raw.publisher && String(raw.publisher).trim());
    const rawPublisher = hasPublisher ? String(raw.publisher).trim() : '';

    const hasCategory = Boolean(raw.category && String(raw.category).trim());
    const rawCategory = hasCategory ? String(raw.category).trim() : '';

    const hasPlatform = Boolean(raw.platform && String(raw.platform).trim());
    const rawPlatform = hasPlatform ? String(raw.platform).trim() : '';

    const rawIcon = extractIconUrl(raw, slug) || extractIconUrl(payload, slug);
    const hasExplicitIcon = Boolean(
      raw.iconUrl ||
      raw.icon_url ||
      raw.icon ||
      raw.gameIcon ||
      raw.game_icon ||
      raw.avatar ||
      raw.avatarUrl ||
      raw.avatar_url ||
      raw.imageUrl ||
      raw.image_url ||
      raw.image ||
      raw.logo ||
      raw.logoUrl ||
      raw.logo_url ||
      raw.thumbnail ||
      raw.thumb ||
      raw.cover ||
      raw.cover_image ||
      raw.cover_image_url ||
      raw.localIconPath ||
      raw.iconPath ||
      payload?.iconUrl ||
      payload?.icon_url ||
      payload?.icon ||
      payload?.gameIcon ||
      payload?.imageUrl
    );

    const hasBanner = Boolean(raw.bannerUrl || raw.banner_url || raw.banner);
    const rawBanner = hasBanner ? String(raw.bannerUrl || raw.banner_url || raw.banner).trim() : '';

    const hasPreReg = Boolean(raw.preRegUrl || raw.pre_reg_url || raw.downloadUrl);
    const rawPreReg = hasPreReg ? String(raw.preRegUrl || raw.pre_reg_url || raw.downloadUrl).trim() : '';

    const hasDescription = Boolean(raw.description && String(raw.description).trim());
    const rawDescription = hasDescription ? String(raw.description).trim() : '';

    const rawInstructions =
      raw.instructions ||
      raw.instructionsText ||
      raw.instructions_text ||
      raw.guide ||
      raw.guideText ||
      raw.huongDan ||
      raw.huong_dan ||
      raw.cachNhapCode ||
      raw.cach_nhap_code;
    const hasInstructions = rawInstructions !== undefined && rawInstructions !== null;

    const rawRedeemUrl = raw.redeemUrl || raw.redeem_url || raw.link_nhap_code || raw.linkNhapCode;
    const hasRedeemUrl = rawRedeemUrl !== undefined && rawRedeemUrl !== null;

    // Nhận biết rõ ràng khi bot/admin muốn xóa hoặc cập nhật mã code dự kiến
    const hasExplicitCodesField = ('expectedCodes' in raw) || ('codes' in raw) || (raw.clearCodes === true);
    let expectedCodes: string[] = [];
    if (Array.isArray(raw.expectedCodes)) {
      expectedCodes = raw.expectedCodes.map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
    } else if (Array.isArray(raw.codes)) {
      expectedCodes = raw.codes.map((c: any) => String(c.code || c).trim().toUpperCase()).filter(Boolean);
    } else if (typeof raw.expectedCodes === 'string') {
      expectedCodes = raw.expectedCodes.split(/[,;\n]+/).map((s: string) => s.trim().toUpperCase()).filter(Boolean);
    }

    // Status: default to PENDING if not specified, unless directPublish=true hoặc autoApprove=true
    let initialStatus = 'PENDING';
    if (
      raw.status === 'UPCOMING' ||
      raw.status === 'APPROVED' ||
      payload?.directPublish === true ||
      payload?.autoApprove === true ||
      raw.directPublish === true ||
      raw.autoApprove === true
    ) {
      initialStatus = 'UPCOMING';
    } else if (raw.status === 'LAUNCHED' || raw.status === 'CANCELLED') {
      initialStatus = String(raw.status).toUpperCase();
    } else if (raw.status === 'PENDING') {
      initialStatus = 'PENDING';
    }

    // Tìm record đã có qua slug, id hoặc tên game tương đồng
    const existing =
      existingMap.get(slug.toLowerCase()) ||
      (raw.id ? existingMap.get(String(raw.id).toLowerCase()) : null) ||
      currentUpcomingGames.find((g) => {
        const gSlug = String(g.slug || '').toLowerCase();
        const gName = String(g.name || '').toLowerCase();
        return gSlug === slug || gName === name.toLowerCase() || slugify(gName) === slug;
      });

    if (existing) {
      // 1. Cập nhật tên game
      existing.name = name;

      // 2. CHỈ CẬP NHẬT các trường ngày giờ / thể loại / NPH khi payload CÓ GIÁ TRỊ HỢP LỆ
      // Tuyệt đối không bao giờ tự ý gán đè fallback mặc định (nowIso, 'Game Mới', 'Nhà phát hành') lên dữ liệu chuẩn cũ!
      if (hasRelDate && rawRelDate) {
        existing.releaseDate = rawRelDate;
      }
      if (hasPublisher && rawPublisher && rawPublisher !== 'Nhà phát hành') {
        existing.publisher = rawPublisher;
      }
      if (hasCategory && rawCategory && rawCategory !== 'Game Mới') {
        existing.category = rawCategory;
      }
      if (hasPlatform && rawPlatform) {
        existing.platform = rawPlatform;
      }
      if (hasExplicitIcon && rawIcon) {
        existing.iconUrl = rawIcon;
        existing.icon_url = rawIcon;
      } else {
        if (!existing.iconUrl && existing.icon_url) existing.iconUrl = existing.icon_url;
        if (!existing.icon_url && existing.iconUrl) existing.icon_url = existing.iconUrl;
        if (!existing.iconUrl && !existing.icon_url) {
          existing.iconUrl = `/game_icons/${slug}.webp`;
          existing.icon_url = `/game_icons/${slug}.webp`;
        }
      }
      if (hasBanner && rawBanner) {
        existing.bannerUrl = rawBanner;
      }
      if (hasDescription && rawDescription) {
        existing.description = rawDescription;
      }
      if (hasPreReg && rawPreReg) {
        existing.preRegUrl = rawPreReg;
      }
      if (hasInstructions) {
        existing.instructions = rawInstructions ? String(rawInstructions).trim() : undefined;
      }
      if (hasRedeemUrl) {
        existing.redeemUrl = rawRedeemUrl ? String(rawRedeemUrl).trim() : undefined;
      }

      // 3. Xử lý trạng thái (status): nếu có chỉ định trạng thái mới hoặc yêu cầu xuất bản thẳng
      if (raw.status) {
        const st = String(raw.status).toUpperCase();
        existing.status = st;
        if (st === 'UPCOMING' || st === 'APPROVED') {
          existing.approvedAt = nowIso;
          existing.approvedBy = botName;
        }
      } else if (
        payload?.directPublish === true ||
        payload?.autoApprove === true ||
        raw.directPublish === true ||
        raw.autoApprove === true
      ) {
        existing.status = 'UPCOMING';
        existing.approvedAt = nowIso;
        existing.approvedBy = botName;
      }

      if (typeof raw.displayOrder === 'number') existing.displayOrder = raw.displayOrder;
      if (raw.subscribersCount) existing.subscribersCount = Number(raw.subscribersCount);
      existing.source = botName;
      existing.updatedAt = nowIso;

      // 4. Xử lý cột mã code dự kiến (expectedCodes)
      // Cho phép bot/admin xóa sạch mã đoán cũ bằng danh sách rỗng hoặc clearCodes: true
      if (raw.clearCodes === true || (hasExplicitCodesField && expectedCodes.length === 0)) {
        existing.expectedCodes = [];
      } else if (hasExplicitCodesField && expectedCodes.length > 0) {
        if (raw.mergeCodes === true || payload?.mergeCodes === true) {
          const mergedCodes = new Set<string>((existing.expectedCodes || []).map((c: string) => c.toUpperCase()));
          expectedCodes.forEach((c) => mergedCodes.add(c));
          existing.expectedCodes = Array.from(mergedCodes);
        } else {
          // Mặc định ghi đè danh sách code mới nếu bot chỉ định rõ danh sách
          existing.expectedCodes = expectedCodes;
        }
      }

      updatedCount++;
      processedDetails.push({ name, slug, action: 'UPDATED', status: existing.status, releaseDate: existing.releaseDate });
    } else {
      // Record hoàn toàn mới: áp dụng fallback hợp lệ
      const newRecord = {
        id: raw.id || `ug_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name,
        slug,
        publisher: hasPublisher && rawPublisher ? rawPublisher : 'Nhà phát hành',
        releaseDate: hasRelDate && rawRelDate ? rawRelDate : nowIso,
        category: hasCategory && rawCategory ? rawCategory : 'Game Mới',
        platform: hasPlatform && rawPlatform ? rawPlatform : 'Android, iOS, PC',
        iconUrl: rawIcon || `/game_icons/${slug}.webp`,
        icon_url: rawIcon || `/game_icons/${slug}.webp`,
        bannerUrl: hasBanner && rawBanner ? rawBanner : undefined,
        description: hasDescription && rawDescription ? rawDescription : `Thông tin ngày mở server và giftcode tân thủ tựa game ${name}.`,
        instructions: hasInstructions && rawInstructions ? String(rawInstructions).trim() : undefined,
        redeemUrl: hasRedeemUrl && rawRedeemUrl ? String(rawRedeemUrl).trim() : undefined,
        preRegUrl: hasPreReg && rawPreReg ? rawPreReg : undefined,
        expectedCodes,
        subscribersCount: Number(raw.subscribersCount || 0),
        source: botName,
        status: initialStatus,
        approvedAt: (initialStatus === 'UPCOMING' || initialStatus === 'APPROVED') ? nowIso : undefined,
        approvedBy: (initialStatus === 'UPCOMING' || initialStatus === 'APPROVED') ? botName : undefined,
        displayOrder: typeof raw.displayOrder === 'number' ? raw.displayOrder : 999,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      currentUpcomingGames.unshift(newRecord);
      existingMap.set(slug.toLowerCase(), newRecord);
      addedCount++;
      processedDetails.push({ name, slug, action: 'ADDED', status: newRecord.status, releaseDate: newRecord.releaseDate });
    }
  }

  // Tự động kiểm tra và bảo toàn dữ liệu gốc trước khi lưu D1
  sanitizeAndSafeguardUpcomingGames(currentUpcomingGames);

  // 4. Lưu lại vào D1
  if (env.DB) {
    try {
      await setSettingD1(env.DB, 'wcg_admin_upcoming_games_v1', currentUpcomingGames);
    } catch (err) {
      console.error('[IngestUpcomingGames] Lỗi ghi D1:', err);
      return new Response(
        JSON.stringify({ success: false, error: 'Không thể lưu dữ liệu vào cơ sở dữ liệu D1.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  const durationMs = Date.now() - startTime;

  return new Response(
    JSON.stringify({
      success: true,
      message: `Đã xử lý thành công: Thêm mới ${addedCount} game, Cập nhật ${updatedCount} game.`,
      botName,
      totalGames: currentUpcomingGames.length,
      addedCount,
      updatedCount,
      durationMs,
      processedDetails,
      timestamp: nowIso,
    }),
    { headers: CORS_HEADERS }
  );
}
