export interface GiftCode {
  code: string;
  rewards: string;
  status: 'active' | 'expired' | 'verified';
  expiry?: string;
  expiresAt?: string;
  expires_at?: string;
  source?: string;
  added_at?: string;
  votes_up?: number;
  votes_down?: number;
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
  license_number?: string;
  license_date?: string;
  trang_thai_gp?: string;
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

export interface FilterState {
  search: string;
  category: string;
  tag: 'all' | 'hot' | 'new' | 'has_codes' | 'bookmarked';
  sortBy: 'updated' | 'popular' | 'codes_count' | 'release_date' | 'name' | 'rating' | 'license_date';
  sortOrder: 'asc' | 'desc';
}

export interface StatsOverview {
  totalGames: number;
  totalCodes: number;
  totalCategories: number;
  totalPublishers: number;
}

// Giveaway Reward Package / Tier Model
export interface GiveawayRewardPackage {
  id: string;
  name: string;
  rewards: string;
  total_codes?: number;
  claimed_codes?: number;
  remaining_codes?: number;
  codes_pool?: string[];
  badge?: string;
  is_active?: boolean;
  note?: string;
}

// Giveaway Campaign Model
export interface GiveawayCampaign {
  id: string;
  game_id?: string;
  game_slug: string;
  game_name: string;
  game_icon_url?: string;
  title: string;
  description: string;
  rewards: string;
  total_codes: number;
  claimed_codes: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  cover_image_url?: string;
  packages?: GiveawayRewardPackage[];
  requires_auth?: boolean;
  min_account_age_days?: number;
  max_per_user?: number;
  max_per_ip?: number;
  cooldown_hours?: number;
  global_cooldown_seconds?: number;
  last_global_claim_at?: string;
  last_claimer_name?: string;
  custom_success_msg?: string;
  custom_cooldown_msg?: string;
  custom_out_of_stock_msg?: string;
  enable_waiting_room?: boolean;
  waiting_users_min?: number;
  waiting_users_max?: number;
  show_claimed_count?: boolean;
  show_remaining_count?: boolean;
  virtual_claimed_offset?: number;
  fomo_anchor_time?: string;
  virtual_claimed_updated_at?: string;
  codes_pool?: string[];
  remaining_codes?: number;
  claim_history?: Array<{
    id: string;
    user?: string;
    userId?: string;
    userName?: string;
    email?: string;
    code: string;
    ip: string;
    claimedAt: string;
  }>;
}

export interface GuideLinkItem {
  id?: string;
  text: string;
  url: string;
}

// Product Package / Variant Model (Gói Sản Phẩm / Tùy Chọn)
export interface ProductPackageVariant {
  id: string;
  name: string;
  price: number;
  original_price?: number;
  stock_quantity?: number;
  sold_count?: number;
  virtual_sold_count?: number;
  badge?: string;
  note?: string; // e.g. "Xử lý tiêu chuẩn", "Bảo hành 30 ngày"
  description?: string;
  is_active?: boolean;
}

// Store Product / Paid Code Model
export interface StoreProduct {
  id: string;
  sku?: string;
  title: string;
  game_slug: string;
  game_name: string;
  game_icon_url?: string;
  cover_image_url?: string;
  product_images?: string[];
  description: string;
  original_price: number;
  discount_percent: number;
  current_price: number;
  stock_quantity: number;
  sold_count?: number;
  show_sold_count?: boolean;
  show_stock_count?: boolean;
  virtual_sold_count?: number;
  fomo_anchor_time?: string;
  virtual_sold_updated_at?: string;
  is_active: boolean;
  package_type: 'pack' | 'monthly' | 'gift' | 'account' | string;
  category?: string;
  category_label?: string;
  badge?: string;
  guide_url?: string;
  guide_text?: string;
  guide_links?: GuideLinkItem[];
  show_guide_link?: boolean;
  show_warranty?: boolean;
  warranty_text?: string;
  packages?: ProductPackageVariant[];
}

// Store Category Model (Danh Mục Gói Code / Cửa Hàng)
export interface StoreCategory {
  id: string;
  label: string;
  icon?: string;
  isSystem?: boolean;
}

// Order & Received Code
export interface OrderRecord {
  id: string;
  product_id: string;
  product_title: string;
  game_name: string;
  amount: number;
  quantity?: number;
  unit_price?: number;
  code_content: string;
  code_items?: string[];
  status: 'completed' | 'pending' | 'failed';
  created_at: string;
  payment_method: 'wallet' | 'vietqr';
}

export interface ClaimedCodeRecord {
  id: string;
  campaign_id: string;
  game_name: string;
  game_slug: string;
  game_icon_url?: string;
  code_value: string;
  rewards: string;
  claimed_at: string;
}

// Utility Product Model (Tiện Ích & Dịch Vụ Ngoài Lề)
export interface UtilityProduct {
  id: string;
  sku?: string;
  title: string;
  category: 'account' | 'tool' | 'service' | 'key' | 'other' | string;
  category_label?: string;
  icon_url?: string;
  cover_image_url?: string;
  product_images?: string[];
  description: string;
  original_price: number;
  discount_percent: number;
  current_price: number;
  stock_quantity: number;
  sold_count?: number;
  show_sold_count?: boolean;
  show_stock_count?: boolean;
  virtual_sold_count?: number;
  fomo_anchor_time?: string;
  virtual_sold_updated_at?: string;
  is_active: boolean;
  badge?: string;
  instructions?: string;
  guide_url?: string;
  guide_text?: string;
  guide_links?: GuideLinkItem[];
  show_guide_link?: boolean;
  show_warranty?: boolean;
  warranty_text?: string;
  packages?: ProductPackageVariant[];
}

// Utility Category Model (Danh Mục Tiện Ích)
export interface UtilityCategory {
  id: string;
  label: string;
  icon?: string;
  isSystem?: boolean;
}

// User Profile
export interface UserProfile {
  id: string;
  username: string;
  displayName?: string;
  full_name?: string;
  email: string;
  phone?: string;
  role: 'user' | 'admin' | 'VIP' | 'SUPER_ADMIN' | 'MEMBER' | 'guest';
  wallet_balance: number;
  avatar_url?: string;
  session_token?: string;
  registered_ip?: string;
  created_at?: string;
  last_login?: string;
}

// News Article Model (Tin Tức Cập Nhật Game)
export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string; // Markdown or rich formatted text
  cover_url?: string;
  gallery_urls?: string[]; // Multiple images for article gallery / inline insertion
  game_id?: string;
  game_slug?: string;
  game_name?: string;
  game_icon?: string;
  tags?: string[];
  codes?: string[]; // Embedded gift codes for this article
  author?: string;
  source_name?: string;
  source_url?: string;
  views?: number;
  virtual_views?: number; // Base views (Lượt xem ban đầu)
  views_growth_rate?: number; // Growth rate multiplier (1.0x, 1.5x, 2.0x...)
  read_time_minutes?: number;
  is_featured?: boolean;
  is_hot?: boolean;
  status: 'PUBLISHED' | 'DRAFT';
  published_at: string;
  updated_at?: string;
}

// Google Play Crawler Models
export interface PendingCrawlerGame {
  id: string;
  name: string;
  slug: string;
  packageId?: string;
  developer: string;
  category: string;
  rating: number;
  installs: string;
  iconUrl: string;
  localIconPath?: string;
  playStoreUrl?: string;
  sourceType?: 'google_play' | 'codemoi' | string;
  sourceUrl?: string;
  releaseInfo?: string;
  activeCodesCount?: number;
  description: string;
  releaseDate?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  autoPublishEligible?: boolean;
  crawledAt: string;
}

export interface CrawlerAutoPublishConfig {
  enabled: boolean;
  autoPublishWhenHasCodes?: boolean;
  whitelistPublishers: string[];
  minInstalls: number;
  minRating: number;
  autoDownloadIcons?: boolean;
  autoAddCrawlerSource?: boolean;
}

// Crawler Source Model (Nguồn cào tự động)
export interface CrawlerSource {
  id: string;
  name: string;
  type: 'reputable_web' | 'official_fb' | 'community_discord' | 'official_site' | string;
  url: string;
  targetGameSlug?: string;
  isEnabled: boolean;
  description?: string;
}

// Upcoming Game Model (Game Chuẩn Bị Ra Mắt & Đếm Ngược Giờ G)
export interface UpcomingGame {
  id: string;
  name: string;
  slug: string;
  publisher: string;
  releaseDate: string; // ISO 8601 string or date string (e.g. '2026-10-23T10:00:00+07:00')
  category: string;
  platform?: string;
  iconUrl?: string;
  bannerUrl?: string;
  description?: string;
  instructions?: string;
  redeemUrl?: string;
  preRegUrl?: string;
  expectedCodes?: string[];
  subscribersCount?: number;
  source?: string;
  status: 'UPCOMING' | 'APPROVED' | 'PENDING' | 'LAUNCHED' | 'CANCELLED';
  displayOrder?: number; // 1..6: Top 6 hiển thị ngay trên banner web khách; 7+: Hiển thị khi bấm Xem Thêm
  isPinned?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_UPCOMING_GAMES: UpcomingGame[] = [
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
];

// 24-Hour Post-Launch Grace Period & Rollover Utilities
export const UPCOMING_ROLLOVER_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 Giờ

export function isUpcomingGameActiveOnBanner(game: UpcomingGame, now = Date.now()): boolean {
  if (game.status === 'CANCELLED' || game.status === 'PENDING') return false;
  if (!game.releaseDate) return true;
  const target = new Date(game.releaseDate).getTime();
  if (isNaN(target)) return true;
  const elapsed = now - target;
  // If target is in future: elapsed < 0 -> Active
  // If target passed <= 24h: 0 <= elapsed <= 24h -> Active (Released today)
  // If target passed > 24h: elapsed > 24h -> Inactive on banner (moves down to catalog)
  return elapsed <= UPCOMING_ROLLOVER_WINDOW_MS;
}

export function isUpcomingGameRolledOver(game: UpcomingGame, now = Date.now()): boolean {
  if (!game.releaseDate) return false;
  const target = new Date(game.releaseDate).getTime();
  if (isNaN(target)) return false;
  return (now - target) > UPCOMING_ROLLOVER_WINDOW_MS;
}

export function getUpcomingGameHoursRemaining(
  game: UpcomingGame,
  now = Date.now()
): { isReleased: boolean; isRolledOver: boolean; hours: number; minutes: number } {
  if (!game.releaseDate) {
    return { isReleased: false, isRolledOver: false, hours: 0, minutes: 0 };
  }
  const target = new Date(game.releaseDate).getTime();
  if (isNaN(target)) {
    return { isReleased: false, isRolledOver: false, hours: 0, minutes: 0 };
  }
  const diff = target - now;
  if (diff > 0) {
    return { isReleased: false, isRolledOver: false, hours: 0, minutes: 0 };
  }
  const elapsed = now - target;
  if (elapsed > UPCOMING_ROLLOVER_WINDOW_MS) {
    return { isReleased: true, isRolledOver: true, hours: 0, minutes: 0 };
  }
  const remainingMs = UPCOMING_ROLLOVER_WINDOW_MS - elapsed;
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  return { isReleased: true, isRolledOver: false, hours, minutes };
}



