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
    id: 'ug_delta_force_vn',
    name: 'Delta Force VN',
    slug: 'delta-force-vn',
    publisher: 'VNGGames / TiMi',
    releaseDate: '2026-11-20T10:00:00+07:00',
    category: 'Bắn Súng Quân Sự',
    platform: 'PC, Mobile',
    iconUrl: '/game_icons/delta-force-vn.webp',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    description: 'Huyền thoại bắn súng chiến thuật quân sự góc nhìn thứ nhất trở lại với chế độ Operations và Warfare đỉnh cao.',
    preRegUrl: 'https://df.vnggames.com',
    expectedCodes: ['DELTAFORCE2026', 'DFVNGGAMES', 'VIP777', 'OPERATIONS'],
    subscribersCount: 4210,
    source: 'Trợ lý Pine & Muse Bot',
    status: 'UPCOMING',
    displayOrder: 5,
    createdAt: '2026-10-22T08:00:00Z',
    updatedAt: '2026-10-22T18:00:00Z',
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
    displayOrder: 6,
    createdAt: '2026-10-19T14:00:00Z',
    updatedAt: '2026-10-22T18:00:00Z',
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

  // Ensure default displayOrder if missing
  upcomingGames.forEach((g, idx) => {
    if (typeof g.displayOrder !== 'number') {
      g.displayOrder = idx + 1;
    }
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

  let filtered = upcomingGames;
  if (statusFilter === 'UPCOMING' || statusFilter === 'APPROVED' || statusFilter === 'WEB') {
    // Only return games approved for display on web
    filtered = upcomingGames.filter((g) => g.status === 'UPCOMING' || g.status === 'APPROVED');
  } else if (statusFilter === 'PENDING') {
    // Only return games waiting in the moderation queue
    filtered = upcomingGames.filter((g) => g.status === 'PENDING');
  } else if (statusFilter !== 'ALL') {
    filtered = upcomingGames.filter((g) => g.status === statusFilter);
  }

  // Sort by displayOrder ascending, then by releaseDate
  filtered.sort((a, b) => {
    const orderA = typeof a.displayOrder === 'number' ? a.displayOrder : 999;
    const orderB = typeof b.displayOrder === 'number' ? b.displayOrder : 999;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
  });

  return new Response(
    JSON.stringify({
      success: true,
      total: filtered.length,
      games: filtered,
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

  // ACTION 1: APPROVE (Duyệt game từ hàng chờ đưa lên Web)
  if (action === 'approve') {
    const targetId = payload?.id || payload?.slug;
    const targetIds: string[] = Array.isArray(payload?.ids)
      ? payload.ids.map((x: any) => String(x).toLowerCase())
      : (targetId ? [String(targetId).toLowerCase()] : []);
    const pinToTop = Boolean(payload?.pinToTop);

    if (targetIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu trường "id" hoặc "ids" để duyệt game.' }),
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
      const idLower = (item.id || '').toLowerCase();
      const slugLower = (item.slug || '').toLowerCase();
      if (targetIds.includes(idLower) || targetIds.includes(slugLower)) {
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
      let orderIndex = 1;
      currentUpcomingGames.forEach((item) => {
        if (item.status === 'UPCOMING' || item.status === 'APPROVED') {
          item.displayOrder = orderIndex++;
        }
      });
    }

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
          games: [
            {
              name: 'Strinova VN',
              slug: 'strinova-vn',
              publisher: 'iDreamSky / VPlay',
              releaseDate: '2026-10-23T10:00:00+07:00',
              category: 'Bắn Súng Anime 3D',
              platform: 'PC, Android, iOS',
              iconUrl: '/game_icons/strinova-vn.webp',
              status: 'PENDING', // 'PENDING' để vào Hàng chờ duyệt, hoặc 'UPCOMING' để duyệt ngay
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

    const publisher = raw.publisher ? String(raw.publisher).trim() : 'Nhà phát hành';
    const releaseDate = raw.releaseDate || raw.release_date || raw.launchDate || raw.launch_date || nowIso;
    const category = raw.category ? String(raw.category).trim() : 'Game Mới';
    const platform = raw.platform ? String(raw.platform).trim() : 'Android, iOS, PC';
    const iconUrl = raw.iconUrl || raw.icon_url || raw.icon || `/game_icons/${slug}.webp`;
    const bannerUrl = raw.bannerUrl || raw.banner_url || raw.banner || undefined;
    const description = raw.description || `Thông tin ngày mở server và giftcode tân thủ tựa game ${name}.`;
    const preRegUrl = raw.preRegUrl || raw.pre_reg_url || raw.downloadUrl || undefined;

    // Status: default to PENDING if not specified or unless directPublish=true
    let status = 'PENDING';
    if (raw.status === 'UPCOMING' || raw.status === 'APPROVED' || payload?.directPublish === true) {
      status = 'UPCOMING';
    } else if (raw.status === 'LAUNCHED' || raw.status === 'CANCELLED') {
      status = raw.status;
    } else if (raw.status === 'PENDING') {
      status = 'PENDING';
    }

    // Parse expected giftcodes
    let expectedCodes: string[] = [];
    if (Array.isArray(raw.expectedCodes)) {
      expectedCodes = raw.expectedCodes.map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
    } else if (Array.isArray(raw.codes)) {
      expectedCodes = raw.codes.map((c: any) => String(c.code || c).trim().toUpperCase()).filter(Boolean);
    } else if (typeof raw.expectedCodes === 'string') {
      expectedCodes = raw.expectedCodes.split(/[,;\n]+/).map((s: string) => s.trim().toUpperCase()).filter(Boolean);
    }

    const existing = existingMap.get(slug.toLowerCase()) || (raw.id ? existingMap.get(String(raw.id).toLowerCase()) : null);

    if (existing) {
      existing.name = name;
      existing.publisher = publisher;
      existing.releaseDate = releaseDate;
      existing.category = category;
      existing.platform = platform;
      if (iconUrl) existing.iconUrl = iconUrl;
      if (bannerUrl) existing.bannerUrl = bannerUrl;
      if (description) existing.description = description;
      if (preRegUrl) existing.preRegUrl = preRegUrl;
      if (raw.status) existing.status = status;
      if (typeof raw.displayOrder === 'number') existing.displayOrder = raw.displayOrder;
      if (raw.subscribersCount) existing.subscribersCount = Number(raw.subscribersCount);
      existing.source = botName;
      existing.updatedAt = nowIso;

      const mergedCodes = new Set<string>((existing.expectedCodes || []).map((c: string) => c.toUpperCase()));
      expectedCodes.forEach((c) => mergedCodes.add(c));
      existing.expectedCodes = Array.from(mergedCodes);

      updatedCount++;
      processedDetails.push({ name, slug, action: 'UPDATED', status: existing.status, releaseDate });
    } else {
      const newRecord = {
        id: raw.id || `ug_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name,
        slug,
        publisher,
        releaseDate,
        category,
        platform,
        iconUrl,
        bannerUrl,
        description,
        preRegUrl,
        expectedCodes,
        subscribersCount: Number(raw.subscribersCount || 0),
        source: botName,
        status,
        displayOrder: typeof raw.displayOrder === 'number' ? raw.displayOrder : 999,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      currentUpcomingGames.unshift(newRecord);
      existingMap.set(slug.toLowerCase(), newRecord);
      addedCount++;
      processedDetails.push({ name, slug, action: 'ADDED', status: newRecord.status, releaseDate });
    }
  }

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
