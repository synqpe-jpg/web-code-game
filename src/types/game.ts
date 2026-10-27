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
  custom_banner_enabled?: boolean;
  custom_banner_text?: string;
  custom_banner_link?: string;
  show_claimed_count?: boolean;
  show_remaining_count?: boolean;
  virtual_claimed_offset?: number;
  fomo_anchor_time?: string;
  virtual_claimed_updated_at?: string;
  codes_pool?: string[];
  remaining_codes?: number;
  use_template?: boolean;
  is_custom_title?: boolean;
  is_custom_rewards?: boolean;
  is_custom_description?: boolean;
  enable_auto_simulation?: boolean;
  simulation_idle_threshold_minutes?: number;
  last_real_claim_at?: string;
  last_simulated_claim_at?: string;
  is_last_claim_simulated?: boolean;
  claim_history?: Array<{
    id: string;
    user?: string;
    userId?: string;
    userName?: string;
    email?: string;
    code: string;
    ip?: string;
    claimedAt: string;
    is_simulated?: boolean;
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
  use_template?: boolean;
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
  use_template?: boolean;
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
  releaseDate?: string | null; // ISO 8601 string or date string (e.g. '2026-10-23T10:00:00+07:00') or null if TBA
  category: string;
  platform?: string;
  iconUrl?: string;
  icon_url?: string;
  proxyIconUrl?: string;
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
  orderGrowthEnabled?: boolean;
  orderGrowthRate?: number;
  orderMinRange?: number;
  orderMaxRange?: number;
  subscribersGrowthEnabled?: boolean;
  subscribersGrowthRatePerHour?: number;
  subscribersMinRange?: number;
  subscribersMaxRange?: number;
  growthAnchorTime?: string;
  isPinned?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_UPCOMING_GAMES: UpcomingGame[] = [
  {
    "id": "ug_tien_gioi",
    "name": "Tiên Giới",
    "slug": "tien-gioi",
    "publisher": "VGP",
    "releaseDate": "2026-10-28T10:00:00+07:00",
    "category": "Nhập Vai Tiên Hiệp",
    "platform": "Android, iOS",
    "iconUrl": "/game_icons/tien-gioi.webp",
    "icon_url": "/game_icons/tien-gioi.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80",
    "description": "Tuyệt phẩm kiếm hiệp tu tiên chân thực với đồ họa Unreal Engine tiên tiến.",
    "preRegUrl": "https://tiengioi.vgp.vn",
    "expectedCodes": [
      "TIENGIOI2026",
      "TIENGIOIVGP",
      "VIP999",
      "TANTHU"
    ],
    "subscribersCount": 2840,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 1,
    "createdAt": "2026-10-20T08:00:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_monster_hunter_outlanders",
    "name": "Monster Hunter Outlanders",
    "slug": "monster-hunter-outlanders",
    "publisher": "Garena",
    "releaseDate": "2026-10-29T10:00:00+07:00",
    "category": "Săn Quái Thế Giới Mở",
    "platform": "Android, iOS",
    "iconUrl": "/game_icons/monster-hunter-outlanders.webp",
    "icon_url": "/game_icons/monster-hunter-outlanders.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
    "description": "Siêu phẩm săn quái vật co-op thế giới mở đỉnh cao giữa Capcom và TiMi Studio Group do Garena đồng phát hành trên di động.",
    "expectedCodes": [
      "MHO2026",
      "HUNTBEGINS",
      "VIP888"
    ],
    "subscribersCount": 3200,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 2,
    "createdAt": "2026-10-22T10:00:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_dau_nho_noi_gian",
    "name": "Đậu Nhỏ Nổi Giận",
    "slug": "dau-nho-noi-gian",
    "publisher": "CMN Online",
    "releaseDate": "2026-10-30T10:00:00+07:00",
    "category": "Chiến Thuật Tháp Thủ",
    "platform": "Android, iOS",
    "iconUrl": "/game_icons/dau-nho-noi-gian.webp",
    "icon_url": "/game_icons/dau-nho-noi-gian.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
    "description": "Game thủ thành chiến thuật hài hước phong cách Plants vs Zombies độc đáo đã được App Store xác nhận.",
    "expectedCodes": [
      "DAUNHO666",
      "NOIGIAN888"
    ],
    "subscribersCount": 1850,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 3,
    "createdAt": "2026-10-23T14:00:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_hiep_khach_hanh",
    "name": "Hiệp Khách Hành",
    "slug": "hiep-khach-hanh",
    "publisher": "Joy Game",
    "releaseDate": "2026-11-01T10:00:00+07:00",
    "category": "Võ Lâm MMORPG",
    "platform": "Android, iOS, PC",
    "iconUrl": "/game_icons/hiep-khach-hanh.webp",
    "icon_url": "/game_icons/hiep-khach-hanh.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    "description": "Game kiếm hiệp chuyển thể từ danh tác Kim Dung với hệ thống môn phái kinh điển do Joy Game phát hành.",
    "preRegUrl": "https://hiepkhachhanh.joygame.vn",
    "expectedCodes": [
      "HKHJOY",
      "TANTHU888",
      "GIFTCODE2026"
    ],
    "subscribersCount": 4120,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 4,
    "createdAt": "2026-10-21T09:00:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_sword_x_staff",
    "name": "Sword x Staff",
    "slug": "sword-x-staff",
    "publisher": "Funtap",
    "releaseDate": "2026-11-04T10:00:00+07:00",
    "category": "Hành Động Chặt Chém",
    "platform": "Android, iOS, PC",
    "iconUrl": "/game_icons/sword-x-staff.webp",
    "icon_url": "/game_icons/sword-x-staff.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80",
    "description": "Trò chơi ARPG kết hợp phép thuật và đao kiếm nhịp độ cao do Funtap phân phối.",
    "expectedCodes": [
      "SWORDSTAFF",
      "FUNTAP2026"
    ],
    "subscribersCount": 1420,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 5,
    "createdAt": "2026-10-23T15:00:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_azur_promilia",
    "name": "Azur Promilia",
    "slug": "azur-promilia",
    "publisher": "Manjuu Network Entertainment",
    "releaseDate": "2026-11-26T10:00:00+07:00",
    "category": "Thế Giới Mở Kỳ Ảo",
    "platform": "PC, Android, iOS, PS5",
    "iconUrl": "/game_icons/azur-promilia.webp",
    "icon_url": "/game_icons/azur-promilia.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    "description": "Siêu phẩm RPG sinh vật kỳ ảo thế giới mở từ nhà phát triển Azur Lane.",
    "expectedCodes": [
      "AZURPROMILIA",
      "MANJUU2026"
    ],
    "subscribersCount": 6500,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 6,
    "createdAt": "2026-10-23T16:00:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_elancia_mobile",
    "name": "Elancia Mobile",
    "slug": "elancia-mobile",
    "publisher": "GAMEDUO",
    "releaseDate": "2026-12-01T09:00:00+07:00",
    "category": "MMORPG Cổ Điển",
    "platform": "Android, iOS",
    "iconUrl": "/game_icons/elancia-mobile.webp",
    "icon_url": "/game_icons/elancia-mobile.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80",
    "description": "Huyền thoại MMORPG cổ điển tái xuất trên nền tảng di động.",
    "expectedCodes": [
      "ELANCIA2026",
      "GAMEDUO"
    ],
    "subscribersCount": 2100,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 7,
    "createdAt": "2026-10-23T16:30:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_ananta",
    "name": "ANANTA",
    "slug": "ananta",
    "publisher": "VNGGames",
    "releaseDate": "2027-01-15T10:00:00+07:00",
    "category": "Thế Giới Mở Anime",
    "platform": "PC, Android, iOS",
    "iconUrl": "/game_icons/ananta.webp",
    "icon_url": "/game_icons/ananta.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    "description": "Dự án thế giới mở tương lai với cơ chế parkour đô thị và combat tự do do VNGGames phát hành tại VN.",
    "expectedCodes": [
      "ANANTA2026",
      "FUTUREOPEN"
    ],
    "subscribersCount": 5200,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 8,
    "createdAt": "2026-10-23T17:00:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_mong_canh_tam_quoc",
    "name": "Mộng Cảnh Tam Quốc",
    "slug": "mong-canh-tam-quoc",
    "publisher": "SohaGame",
    "releaseDate": null,
    "category": "Chiến Thuật Thẻ Tướng",
    "platform": "Android, iOS",
    "iconUrl": "/game_icons/mong-canh-tam-quoc.webp",
    "icon_url": "/game_icons/mong-canh-tam-quoc.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80",
    "description": "Thế giới Tam Quốc huyễn tưởng kết hợp đồ họa anime tuyệt mỹ.",
    "expectedCodes": [
      "MONGCANH3Q",
      "TAMQUOCAFK"
    ],
    "subscribersCount": 2150,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 9,
    "createdAt": "2026-10-23T17:30:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_bleach",
    "name": "BLEACH",
    "slug": "bleach",
    "publisher": "Bandai Namco Entertainment",
    "releaseDate": null,
    "category": "Hành Động Anime",
    "platform": "Android, iOS, PC",
    "iconUrl": "/game_icons/bleach.webp",
    "icon_url": "/game_icons/bleach.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
    "description": "Tác phẩm nhập vai hành động chuẩn nguyên tác anime Bleach chính thức.",
    "expectedCodes": [
      "BLEACH2026",
      "BANKAI"
    ],
    "subscribersCount": 3800,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 10,
    "createdAt": "2026-10-23T18:00:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_petit_planet",
    "name": "Petit Planet",
    "slug": "petit-planet",
    "publisher": "HoYoverse",
    "releaseDate": null,
    "category": "Mô Phỏng Cuộc Sống",
    "platform": "PC, Mobile",
    "iconUrl": "/game_icons/petit-planet.webp",
    "icon_url": "/game_icons/petit-planet.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80",
    "description": "Dự án game mô phỏng cuộc sống ấm áp từ HoYoverse.",
    "expectedCodes": [
      "PETIT2026",
      "HOYOVERSE"
    ],
    "subscribersCount": 4200,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 11,
    "createdAt": "2026-10-23T18:30:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_palworld",
    "name": "Palworld",
    "slug": "palworld",
    "publisher": "Garena",
    "releaseDate": null,
    "category": "Sinh Tồn Thế Giới Mở",
    "platform": "PC, Android, iOS",
    "iconUrl": "/game_icons/palworld.webp",
    "icon_url": "/game_icons/palworld.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    "description": "Siêu phẩm sinh tồn thu phục sinh vật thế giới mở phiên bản di động.",
    "expectedCodes": [
      "PALWORLDVN",
      "GARENA2026"
    ],
    "subscribersCount": 9100,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 12,
    "createdAt": "2026-10-23T19:00:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_tougen_anki",
    "name": "Tougen Anki",
    "slug": "tougen-anki",
    "publisher": "Com2uS",
    "releaseDate": null,
    "category": "Nhập Vai Hành Động",
    "platform": "Android, iOS",
    "iconUrl": "/game_icons/tougen-anki.webp",
    "icon_url": "/game_icons/tougen-anki.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
    "description": "Game nhập vai chuyển thể từ manga đình đám Tougen Anki Dark Demon.",
    "expectedCodes": [
      "TOUGENANKI",
      "COM2US"
    ],
    "subscribersCount": 1600,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 13,
    "createdAt": "2026-10-23T19:30:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_temppal",
    "name": "TEMPPAL",
    "slug": "temppal",
    "publisher": "Nexon",
    "releaseDate": null,
    "category": "MMORPG Hành Động",
    "platform": "PC, Mobile",
    "iconUrl": "/game_icons/temppal.webp",
    "icon_url": "/game_icons/temppal.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80",
    "description": "MMORPG hành động đỉnh cao dựa trên bộ tiểu thuyết Overgeared đình đám.",
    "expectedCodes": [
      "TEMPPAL2026",
      "NEXON"
    ],
    "subscribersCount": 2400,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 14,
    "createdAt": "2026-10-23T20:00:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_crownstone",
    "name": "Crownstone",
    "slug": "crownstone",
    "publisher": "Level Infinite",
    "releaseDate": null,
    "category": "Chiến Thuật Giả Tưởng",
    "platform": "Android, iOS, PC",
    "iconUrl": "/game_icons/crownstone.webp",
    "icon_url": "/game_icons/crownstone.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80",
    "description": "Game chiến thuật giả tưởng hoành tráng đến từ Level Infinite.",
    "expectedCodes": [
      "CROWNSTONE",
      "LEVELINFINITE"
    ],
    "subscribersCount": 3100,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 15,
    "createdAt": "2026-10-23T20:30:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_overwatch_rush",
    "name": "Overwatch Rush",
    "slug": "overwatch-rush",
    "publisher": "Blizzard",
    "releaseDate": null,
    "category": "Bắn Súng Anh Hùng",
    "platform": "Android, iOS",
    "iconUrl": "/game_icons/overwatch-rush.webp",
    "icon_url": "/game_icons/overwatch-rush.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
    "description": "Trải nghiệm bắn súng góc nhìn thứ nhất nhịp độ cao vũ trụ Overwatch trên mobile.",
    "expectedCodes": [
      "OVERWATCHRUSH",
      "BLIZZARD"
    ],
    "subscribersCount": 4700,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 16,
    "createdAt": "2026-10-23T21:00:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_plants_vs_zombies_3",
    "name": "Plants vs Zombies 3",
    "slug": "plants-vs-zombies-3",
    "publisher": "EA",
    "releaseDate": null,
    "category": "Chiến Thuật Tháp Thủ",
    "platform": "Android, iOS",
    "iconUrl": "/game_icons/plants-vs-zombies-3.webp",
    "icon_url": "/game_icons/plants-vs-zombies-3.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
    "description": "Phần ba chính thức của loạt game thủ thành hoa quả đại chiến kinh điển từ Electronic Arts.",
    "expectedCodes": [
      "PVZ32026",
      "EAGAMES"
    ],
    "subscribersCount": 5300,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 17,
    "createdAt": "2026-10-23T21:30:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_garena_free_city",
    "name": "Garena Free City",
    "slug": "garena-free-city",
    "publisher": "Garena",
    "releaseDate": null,
    "category": "Thế Giới Mở Đô Thị",
    "platform": "Android, iOS, PC",
    "iconUrl": "/game_icons/garena-free-city.webp",
    "icon_url": "/game_icons/garena-free-city.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
    "description": "Thế giới mở mô phỏng đời sống đô thị tự do rộng lớn từ Garena.",
    "expectedCodes": [
      "FREECITY",
      "GARENA"
    ],
    "subscribersCount": 6800,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 18,
    "createdAt": "2026-10-23T22:00:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  },
  {
    "id": "ug_arad_idle_rpg",
    "name": "Arad Idle RPG",
    "slug": "arad-idle-rpg",
    "publisher": "Nexon",
    "releaseDate": null,
    "category": "Nhập Vai Rảnh Tay",
    "platform": "Android, iOS",
    "iconUrl": "/game_icons/arad-idle-rpg.webp",
    "icon_url": "/game_icons/arad-idle-rpg.webp",
    "bannerUrl": "https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80",
    "description": "Game nhập vai rảnh tay Dungeon & Fighter thế hệ mới từ Nexon.",
    "expectedCodes": [
      "ARADIDLE",
      "NEXON2026"
    ],
    "subscribersCount": 2900,
    "source": "Trợ lý Pine & Muse Bot",
    "status": "UPCOMING",
    "displayOrder": 19,
    "createdAt": "2026-10-23T22:30:00Z",
    "updatedAt": "2026-10-27T10:00:00Z"
  }
];

// 24-Hour Post-Launch Grace Period & Rollover Utilities
export const UPCOMING_ROLLOVER_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 Giờ

export function isUpcomingGameActiveOnBanner(game: UpcomingGame, now = Date.now()): boolean {
  if (game.status === 'CANCELLED' || game.status === 'PENDING' || game.status === 'LAUNCHED') return false;
  if (!game.releaseDate) return false;
  const target = new Date(game.releaseDate).getTime();
  if (isNaN(target)) return false;
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



