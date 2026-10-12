/**
 * Cấu trúc dữ liệu cho Hệ thống Tự Động Hóa Tin Tức & Lên Lịch Đăng Bài (News Automation & Scheduling)
 */

export interface NewsAutoSource {
  id: string;
  name: string;
  type: 'website' | 'rss' | 'facebook';
  url: string;
  crawlFrequencyMinutes: number; // 60, 120, 360, 1440
  filterKeywords: string[];      // Từ khóa bắt buộc có trong link/tiêu đề (ví dụ: code, giftcode, tân thủ...)
  autoDetectGame: boolean;       // Tự động nhận diện tựa game trong kho 486+ game
  useGameLogoAsCover: boolean;   // Ưu tiên dùng logo chuẩn của game làm ảnh bìa
  targetGameSlug?: string;       // Gán cố định cho 1 game nếu là fanpage/web riêng của game đó
  status: 'ACTIVE' | 'PAUSED';   // Trạng thái hoạt động
  lastCrawledAt?: string;        // Thời gian quét gần nhất
  articlesFoundCount: number;    // Tổng số bài viết đã bóc tách thành công
  lastError?: string;            // Lỗi gần nhất nếu có
}

export interface NewsScheduleConfig {
  enabled: boolean;                      // Bật/tắt tự động hóa toàn hệ thống
  intervalHours: number;                 // Chu kỳ chạy tự động (mỗi 1h, 2h, 4h, 6h...)
  defaultPublishStatus: 'PUBLISHED' | 'DRAFT'; // Xuất bản ngay hay lưu bản nháp
  autoUpdateExistingArticle: boolean;    // Cập nhật bài viết hiện có nếu game đã có bài (Smart Update)
  enableTelegramAlerts: boolean;         // Gửi thông báo về Telegram
  telegramBotToken?: string;             // Token bot Telegram
  telegramChatId?: string;               // Chat ID người nhận
  lastRunAt?: string;                    // Lần chạy gần nhất
  nextRunAt?: string;                    // Lần chạy dự kiến tiếp theo
  totalArticlesCreated: number;          // Tổng số bài viết đã tạo tự động
}

export interface NewsCrawlLogItem {
  id: string;
  timestamp: string;
  sourceName: string;
  sourceUrl: string;
  articleTitle?: string;
  gameName?: string;
  codesCount: number;
  status: 'SUCCESS' | 'SKIPPED_EXISTING' | 'ERROR';
  message: string;
}

export const DEFAULT_NEWS_AUTO_SOURCES: NewsAutoSource[] = [
  {
    id: 'src_gamek_mobile',
    name: 'GameK - Giftcode & Game Mobile',
    type: 'website',
    url: 'https://gamek.vn/mobile-social.chn',
    crawlFrequencyMinutes: 60,
    filterKeywords: ['code', 'giftcode', 'quà tặng', 'tân thủ', 'máy chủ', 'update'],
    autoDetectGame: true,
    useGameLogoAsCover: true,
    status: 'ACTIVE',
    articlesFoundCount: 0,
  },
  {
    id: 'src_sforum_games',
    name: 'Sforum CellphoneS - Game App & Giftcode',
    type: 'website',
    url: 'https://cellphones.com.vn/sforum/game-app',
    crawlFrequencyMinutes: 60,
    filterKeywords: ['code', 'giftcode', 'nhập code', 'blox fruit', 'wiki', 'tân thủ'],
    autoDetectGame: true,
    useGameLogoAsCover: true,
    status: 'ACTIVE',
    articlesFoundCount: 0,
  },
  {
    id: 'src_download_giftcode',
    name: 'Download.vn - Chuyên Mục Giftcode Game',
    type: 'website',
    url: 'https://download.com.vn/s/giftcode',
    crawlFrequencyMinutes: 120,
    filterKeywords: ['code', 'giftcode', 'huyền thoại', 'tân thủ', 'quà tặng'],
    autoDetectGame: true,
    useGameLogoAsCover: true,
    status: 'ACTIVE',
    articlesFoundCount: 0,
  },
  {
    id: 'src_tgdd_gameapp',
    name: 'Thế Giới Di Động - Game App & Code',
    type: 'website',
    url: 'https://www.thegioididong.com/game-app',
    crawlFrequencyMinutes: 120,
    filterKeywords: ['code', 'giftcode', 'nhận quà', 'sự kiện', 'tân thủ'],
    autoDetectGame: true,
    useGameLogoAsCover: true,
    status: 'ACTIVE',
    articlesFoundCount: 0,
  },
];

export const DEFAULT_NEWS_SCHEDULE_CONFIG: NewsScheduleConfig = {
  enabled: true,
  intervalHours: 2,
  defaultPublishStatus: 'PUBLISHED',
  autoUpdateExistingArticle: true,
  enableTelegramAlerts: true,
  telegramBotToken: '',
  telegramChatId: '',
  totalArticlesCreated: 0,
};
