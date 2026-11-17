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
  license_issued_date?: string;
  license_status?: 'Đang hoạt động' | 'Ngừng hoạt động' | 'Bị thay thế' | string;
  license_source_url?: string;
  trang_thai_gp?: string;
  release_date?: string;
  download_android?: string;
  download_ios?: string;
  download_pc?: string;
  google_play_url?: string;
  app_store_url?: string;
  android_package_name?: string;
  redeem_url?: string;
  status?: string;
  is_featured?: boolean | number;
  is_hot?: boolean | number;
  is_new?: boolean | number;
  is_active?: boolean | number;
  codes_count?: number;
  active_codes_count?: number;
  expired_codes_count?: number;
  total_codes_count?: number;
  free_codes_count?: number;
  codes?: GiftCode[];
}

export interface GameAuditLog {
  id: string;
  game_id: string;
  game_slug: string;
  game_name: string;
  action: 'CREATE' | 'UPDATE' | 'UNPUBLISH' | 'PUBLISH' | 'DELETE' | 'RESTORE' | 'PERMANENT_DELETE';
  actor: string;
  changes?: Array<{ field: string; from: any; to: any }>;
  created_at: string;
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
  cooldown_minutes?: number;
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
  virtual_remaining_addition?: number;
  virtual_remaining_current?: number;
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
  sale_mode?: 'normal' | 'escalating';
  escalating_base_price?: number;
  escalating_step?: number;
  escalating_max_price?: number | null;
  escalating_completed_count?: number;
  escalating_current_price?: number;
  escalating_next_price?: number;
  first_purchase_enabled?: boolean;
  first_purchase_price?: number | null;
  first_purchase_max_price?: number | null;
}

// Thuộc tính đa ngành (Attributes: Màu sắc, Kích cỡ, Dung tích, Dung lượng, Gói cước...)
export interface ProductAttribute {
  id: string; // e.g. 'attr_color', 'attr_size', 'attr_capacity', 'attr_plan'
  name: string; // e.g. 'Màu Sắc', 'Kích Cỡ', 'Dung Tích', 'Dung Lượng', 'Thời Hạn'
  values: string[]; // e.g. ['Trắng', 'Đen', 'Be'] hoặc ['S', 'M', 'L', 'XL']
}

// Biến thể / Phân loại hàng đa ngành (SKU Variant)
export interface ProductVariantItem {
  id: string; // e.g. 'var_1', 'var_2'
  sku?: string;
  name: string; // e.g. 'Đen / L', 'Trắng / M', '128GB / Titan Tự Nhiên'
  attributes: Record<string, string>; // e.g. { 'Màu Sắc': 'Đen', 'Kích Cỡ': 'L' }
  price: number;
  original_price?: number;
  stock_quantity: number;
  sold_count?: number;
  image_url?: string;
  is_active?: boolean;
}

// Store Product / Universal E-Commerce Product Model
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
  sale_mode?: 'normal' | 'escalating';
  escalating_base_price?: number;
  escalating_step?: number;
  escalating_max_price?: number | null;
  escalating_completed_count?: number;
  escalating_current_price?: number;
  escalating_next_price?: number;
  first_purchase_enabled?: boolean;
  first_purchase_price?: number | null;
  first_purchase_max_price?: number | null;

  // --- TRƯỜNG ĐA NGÀNH (UNIVERSAL E-COMMERCE EXTENSIONS) ---
  product_type?: 'physical' | 'digital'; // 'physical': hàng vật lý (giao hàng), 'digital': hàng số (giao mã/tài khoản)
  industry?: string; // 'gaming' | 'fashion' | 'beauty' | 'tech' | 'services' | 'other'
  brand?: string; // Thương hiệu (Apple, Nike, Innisfree, Maybelline, Steam...)
  warranty_period?: string; // '12 tháng chính hãng', 'Đổi mới trong 7 ngày'
  shipping_fee?: number; // Phí vận chuyển (0đ = Miễn phí ship toàn quốc)
  origin?: string; // Xuất xứ (Việt Nam, Hàn Quốc, Nhật Bản, Mỹ...)
  attributes?: ProductAttribute[]; // Danh sách nhóm phân loại (Size, Màu sắc...)
  variants?: ProductVariantItem[]; // Danh sách các SKU biến thể thực tế
}

// Store Category Model (Danh Mục Gói Code / Cửa Hàng)
export interface StoreCategory {
  id: string;
  label: string;
  icon?: string;
  isSystem?: boolean;
}

// Universal Product Category Model (Danh Mục Hàng Hóa Đa Ngành)
export interface ProductCategoryItem {
  id: string;
  label: string;
  icon: string;
  description?: string;
  searchTags?: string[];
  matchKeywords?: string[];
  isSystem?: boolean;
}

export interface ProductCategoriesConfig {
  activePresetId: string; // 'gaming' | 'fashion' | 'beauty' | 'tech' | 'services' | 'custom'
  categories: ProductCategoryItem[];
  searchSuggestions: string[];
  footerCategoryTitle?: string;
  headerCategoryTitle?: string;
}

export interface IndustryPreset {
  id: string;
  name: string;
  icon: string;
  badge: string;
  defaultShopName: string;
  defaultSlogan: string;
  defaultHotline: string;
  defaultCurrency: 'VND' | 'CORE';
  defaultAccent: 'orange' | 'blue' | 'red' | 'green' | 'purple';
  footerCategoryTitle: string;
  headerCategoryTitle: string;
  searchSuggestions: string[];
  categories: ProductCategoryItem[];
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
  status: 'completed' | 'pending' | 'failed' | 'shipping' | 'delivered' | 'cancelled' | string;
  price_rule?: 'escalating' | 'first_purchase' | 'normal' | string;
  created_at: string;
  payment_method: 'wallet' | 'vietqr';

  // --- TRƯỜNG ĐA NGÀNH: GIAO NHẬN VẬN TẢI & THUỘC TÍNH SẢN PHẨM ---
  order_type?: 'physical' | 'digital'; // 'physical': hàng vật lý cần giao, 'digital': hàng số trả mã tức thì
  shipping_name?: string; // Họ tên người nhận hàng
  shipping_phone?: string; // Số điện thoại nhận hàng
  shipping_address?: string; // Địa chỉ chi tiết nhận hàng (Số nhà, đường, phường, quận, tỉnh)
  shipping_note?: string; // Ghi chú giao hàng từ khách
  tracking_code?: string; // Mã vận đơn từ hãng vận chuyển (GHTK, GHN, Viettel Post...)
  carrier?: string; // Mã đơn vị vận chuyển ('GHTK' | 'GHN' | 'VTP')
  carrier_name?: string; // Tên đầy đủ hãng vận chuyển
  estimated_delivery?: string; // Thời gian giao hàng dự kiến
  voucher_code?: string; // Mã voucher giảm giá đã áp dụng
  voucher_discount?: number; // Số tiền giảm giá từ voucher sàn/shop
  freeship_discount?: number; // Số tiền giảm phí vận chuyển
  variant_id?: string; // Mã SKU biến thể
  variant_name?: string; // Tên biến thể (ví dụ: "Size L - Trắng")
  variant_attributes?: Record<string, string>; // Chi tiết thuộc tính đã chọn {"Màu sắc": "Trắng", "Size": "L"}
  shipping_fee?: number; // Cước phí vận chuyển
}

// Tenant Lead Record (Khách Hàng Đăng Ký Thuê / Mua Sàn E-commerce)
export interface TenantLeadRecord {
  id: string; // 'LEAD-1731...-XXXX'
  full_name: string; // Tên khách hàng / người liên hệ
  phone: string; // Số điện thoại / Zalo
  email?: string; // Email liên hệ
  shop_name: string; // Tên shop / thương hiệu mong muốn
  industry: 'gaming' | 'fashion' | 'beauty' | 'tech' | 'services' | 'other' | string; // Ngành hàng kinh doanh
  plan_type: 'rental_starter' | 'rental_business' | 'buyout_full' | 'enterprise_custom' | string; // Gói quan tâm
  expected_domain?: string; // Tên miền dự kiến
  budget_range?: string; // Ngân sách dự kiến
  note?: string; // Ghi chú yêu cầu riêng
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CLOSED_WON' | 'CANCELLED' | string; // Trạng thái tư vấn
  admin_notes?: string; // Ghi chú nội bộ của Quản trị viên
  created_at: string;
  ip_address?: string;
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
  sale_mode?: 'normal' | 'escalating';
  escalating_base_price?: number;
  escalating_step?: number;
  escalating_max_price?: number | null;
  escalating_completed_count?: number;
  escalating_current_price?: number;
  escalating_next_price?: number;
  first_purchase_enabled?: boolean;
  first_purchase_price?: number | null;
  first_purchase_max_price?: number | null;
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
  email_verified?: boolean;
  email_verified_at?: string;
}

// News Article Model (Tin Tức Cập Nhật Game)
export * from './gameEvent';
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
  status: 'PUBLISHED' | 'DRAFT' | 'SCHEDULED';
  published_at: string;
  scheduled_publish_at?: string;
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
  icon_verified?: boolean;
  icon_source?: string;
  icon_verified_at?: string | null;
  icon_version?: string | number;
  icon_updated_by?: string;
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

export { DEFAULT_UPCOMING_GAMES } from '../data/defaultUpcomingGames';

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



