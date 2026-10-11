import type { NewsArticle, GameItem } from '../types/game';
import { DEFAULT_NEWS_ARTICLES } from '../data/seedNews';
import { smartVietnameseMatch } from '../utils/textUtils';

const STORAGE_KEY = 'wcg_news_articles_v1';

class NewsService {
  private articles: NewsArticle[] = [];
  private listeners: Set<() => void> = new Set();
  private isLoaded = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') {
      this.articles = [...DEFAULT_NEWS_ARTICLES];
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with default seed articles to ensure rich content
          const existingIds = new Set(parsed.map((a: NewsArticle) => a.id || a.slug));
          const missingSeeds = DEFAULT_NEWS_ARTICLES.filter((s) => !existingIds.has(s.id) && !existingIds.has(s.slug));
          this.articles = [...parsed, ...missingSeeds];
          this.isLoaded = true;
          return;
        }
      }
    } catch (e) {
      console.warn('[NewsService] Lỗi đọc tin tức từ localStorage:', e);
    }

    this.articles = [...DEFAULT_NEWS_ARTICLES];
    this.saveToStorage();
    this.isLoaded = true;
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.articles));
      this.notifyListeners();
    } catch (e) {
      console.warn('[NewsService] Lỗi lưu tin tức vào localStorage:', e);
    }
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  }

  /**
   * Đồng bộ dữ liệu tin tức từ máy chủ Cloudflare D1
   */
  public applyServerSnapshot(serverArticles: NewsArticle[]) {
    if (Array.isArray(serverArticles) && serverArticles.length > 0) {
      const serverMap = new Map(serverArticles.map((a) => [a.id || a.slug, a]));
      const localArticles = this.articles.filter((a) => !serverMap.has(a.id) && !serverMap.has(a.slug));
      this.articles = [...serverArticles, ...localArticles];
      this.saveToStorage();
    }
  }

  /**
   * Lấy danh sách tin tức đã xuất bản (cho Web Khách)
   */
  public getPublishedArticles(filter?: {
    search?: string;
    gameSlug?: string;
    tag?: string;
  }): NewsArticle[] {
    let result = this.articles.filter((a) => a.status === 'PUBLISHED');

    if (filter?.gameSlug && filter.gameSlug !== 'all') {
      result = result.filter(
        (a) => a.game_slug === filter.gameSlug || a.game_id === filter.gameSlug
      );
    }

    if (filter?.tag && filter.tag !== 'all') {
      result = result.filter(
        (a) => a.tags && a.tags.some((t) => t.toLowerCase() === filter.tag?.toLowerCase())
      );
    }

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.trim();
      result = result.filter((a) =>
        smartVietnameseMatch(
          [a.title, a.excerpt, a.game_name, a.game_slug, ...(a.tags || [])],
          q
        )
      );
    }

    // Sắp xếp: Tin tiêu điểm lên đầu, sau đó theo ngày phát hành mới nhất
    return result.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      const dateA = new Date(a.published_at || 0).getTime();
      const dateB = new Date(b.published_at || 0).getTime();
      return dateB - dateA;
    });
  }

  /**
   * Lấy toàn bộ bài viết (Bao gồm cả bản nháp cho Admin)
   */
  public getAllArticlesForAdmin(): NewsArticle[] {
    return [...this.articles].sort((a, b) => {
      const dateA = new Date(a.published_at || a.updated_at || 0).getTime();
      const dateB = new Date(b.published_at || b.updated_at || 0).getTime();
      return dateB - dateA;
    });
  }

  /**
   * Lấy bài viết theo slug hoặc id
   */
  public getArticleBySlug(slugOrId: string): NewsArticle | null {
    if (!slugOrId) return null;
    const clean = slugOrId.toLowerCase().trim();
    return (
      this.articles.find(
        (a) =>
          a.slug?.toLowerCase() === clean ||
          a.id?.toLowerCase() === clean
      ) || null
    );
  }

  /**
   * Tăng lượt xem bài viết
   */
  public recordView(articleId: string) {
    const found = this.articles.find((a) => a.id === articleId || a.slug === articleId);
    if (found) {
      found.views = (found.views || 0) + 1;
      this.saveToStorage();
    }
  }

  /**
   * Admin: Thêm hoặc Cập nhật bài viết
   */
  public async saveArticle(
    articleData: Partial<NewsArticle> & { title: string }
  ): Promise<NewsArticle> {
    const now = new Date().toISOString();
    const slug =
      articleData.slug ||
      articleData.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const existingIndex = this.articles.findIndex(
      (a) => (articleData.id && a.id === articleData.id) || a.slug === slug
    );

    let savedItem: NewsArticle;

    if (existingIndex >= 0) {
      savedItem = {
        ...this.articles[existingIndex],
        ...articleData,
        slug,
        updated_at: now,
      };
      this.articles[existingIndex] = savedItem;
    } else {
      savedItem = {
        id: articleData.id || `news_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        slug,
        title: articleData.title.trim(),
        excerpt: articleData.excerpt || '',
        content: articleData.content || '',
        cover_url: articleData.cover_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
        game_id: articleData.game_id,
        game_slug: articleData.game_slug,
        game_name: articleData.game_name,
        tags: articleData.tags || ['Tin Mới', 'Giftcode'],
        codes: articleData.codes || [],
        author: articleData.author || 'CodeGame Editorial',
        views: articleData.views || 0,
        read_time_minutes: articleData.read_time_minutes || Math.max(2, Math.ceil((articleData.content || '').length / 500)),
        is_featured: Boolean(articleData.is_featured),
        is_hot: Boolean(articleData.is_hot),
        status: articleData.status || 'PUBLISHED',
        published_at: articleData.published_at || now,
        updated_at: now,
      };
      this.articles.unshift(savedItem);
    }

    this.saveToStorage();
    await this.syncToCloudflareServer();
    return savedItem;
  }

  /**
   * Admin: Xóa bài viết
   */
  public async deleteArticle(articleId: string): Promise<boolean> {
    const initialLen = this.articles.length;
    this.articles = this.articles.filter((a) => a.id !== articleId && a.slug !== articleId);
    if (this.articles.length !== initialLen) {
      this.saveToStorage();
      await this.syncToCloudflareServer();
      return true;
    }
    return false;
  }

  /**
   * Gửi dữ liệu bài viết lên máy chủ Cloudflare D1
   */
  private async syncToCloudflareServer() {
    if (typeof window === 'undefined') return;
    try {
      const syncKey =
        localStorage.getItem('wcg_admin_sync_key') ||
        sessionStorage.getItem('wcg_admin_sync_key') ||
        'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';

      await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-Key': syncKey,
        },
        body: JSON.stringify({
          newsArticles: this.articles,
        }),
      });
    } catch (e) {
      console.warn('[NewsService] Không thể sync bài viết lên Cloudflare D1:', e);
    }
  }

  /**
   * ✨ AI Auto-Writer: Tự động biên tập bài viết chuẩn SEO dựa trên tựa game và sự kiện
   */
  public generateAiArticleDraft(params: {
    game: Partial<GameItem>;
    topicType: 'update' | 'new_server' | 'event' | 'guide';
    availableCodes?: string[];
  }): Partial<NewsArticle> {
    const gameName = params.game.name || 'Tựa Game';
    const publisher = params.game.publisher || 'Nhà phát hành chính thức';
    const codes = params.availableCodes && params.availableCodes.length > 0
      ? params.availableCodes.slice(0, 6)
      : ['CODEVIP2026', 'TANTHU999', 'QUATRIAN888'];

    const monthYear = 'Tháng 10/2026';

    let title = '';
    let excerpt = '';
    let content = '';
    let tags: string[] = [];

    switch (params.topicType) {
      case 'update':
        title = `${gameName}: Chi Tiết Bản Cập Nhật Mới & Bộ Giftcode Quà Tặng ${monthYear}`;
        excerpt = `Khám phá các điểm mới trong bản cập nhật lớn của ${gameName} (${publisher}), tinh chỉnh cân bằng môn phái/tướng và nhận ngay danh sách mã code độc quyền.`;
        tags = ['Bản Cập Nhật', 'Giftcode Mới', gameName, 'Tin Nóng'];
        content = `## Tổng Quan Bản Cập Nhật Mới ${gameName}

Tựa game **${gameName}** đến từ nhà phát hành **${publisher}** vừa chính thức phát hành phiên bản cập nhật lớn với hàng loạt nâng cấp đáng giá về đồ họa, tối ưu hiệu năng và bổ sung các tính năng chiến đấu mới.

### 1. Các Tính Năng & Hoạt Động Mới
- **Hệ Thống Phụ Bản Mới**: Mở rộng các tầng thí luyện liên server với độ khó nâng cao, mang lại phần thưởng trang bị quý hiếm cho người chơi.
- **Tối Ưu Hóa Cân Bằng**: Tinh chỉnh lại chỉ số sát thương và phòng thủ của các nhân vật/hệ phái nhằm mang lại trải nghiệm công bằng trong đấu trường PvP.
- **Sự Kiện Đăng Nhập 7 Ngày**: Đăng nhập liên tục trong tuần đầu phát hành bản cập nhật để nhận miễn phí rương bảo thạch và vàng khóa.

### 2. Danh Sách Giftcode Áp Dụng Cho Phiên Bản Này
Ban quản trị **CodeGame.shop** đã tổng hợp và kiểm tra tính hợp lệ của toàn bộ mã giftcode mới nhất dành cho ${gameName}. Hãy sử dụng danh sách mã code bên dưới để nhận ngay quà tặng khởi đầu thuận lợi!

### 3. Hướng Dẫn Cách Nhập Code Nhận Quà
1. Mở trò chơi **${gameName}** trên thiết bị của bạn.
2. Tìm đến mục **Cài Đặt** hoặc **Phúc Lợi / Sự Kiện**.
3. Chọn tab **Đổi Mã Quà Tặng (Giftcode)**.
4. Sao chép các mã code bên dưới và dán vào ô nhập liệu, sau đó bấm **Xác Nhận**. Quà sẽ được gửi vào Hòm Thư nhân vật.`;
        break;

      case 'new_server':
        title = `${gameName}: Khai Mở Máy Chủ Mới & Phát Tặng Gói Quà Tân Thủ Độc Quyền`;
        excerpt = `Chào đón các tân thủ tham gia máy chủ mới của ${gameName}. Chuỗi sự kiện đua top lực chiến 7 ngày cùng trọn bộ mã code khởi đầu hành trình.`;
        tags = ['Máy Chủ Mới', 'Tân Thủ', gameName, 'Đua Top'];
        content = `## Khai Mở Máy Chủ Mới Cùng ${gameName}

Nhằm đáp ứng sự ủng hộ nhiệt tình từ cộng đồng game thủ, nhà phát hành **${publisher}** chính thức khai mở cụm máy chủ mới dành cho **${gameName}**.

### 1. Chuỗi Sự Kiện Khởi Động Máy Chủ
- **Đua Top Lực Chiến 7 Ngày**: Nhận ngay danh hiệu độc quyền, thời trang giới hạn và thú cưỡi Thần Thoại.
- **Nhân Đôi Kinh Nghiệm**: Tăng 100% kinh nghiệm nhận được từ các nhiệm vụ cốt truyện và phụ bản trong 72 giờ đầu tiên.
- **Quà Nạp Lần Đầu**: Tặng kèm vũ khí Hoàng Kim và gói nguyên liệu nâng cấp cấp tốc.

### 2. Bộ Giftcode Tân Thủ Đặc Biệt
Dưới đây là các mã quà tặng được kích hoạt riêng cho người chơi máy chủ mới. Sao chép ngay để tạo lợi thế dẫn đầu bảng xếp hạng!`;
        break;

      case 'guide':
        title = `Hướng Dẫn Nhập Code & Mẹo Tân Thủ Tối Ưu Lực Chiến Trong ${gameName}`;
        excerpt = `Cẩm nang toàn tập hướng dẫn tân thủ cách nhập giftcode nhận quà, mẹo xây dựng đội hình và quản lý tài nguyên hiệu quả trong ${gameName}.`;
        tags = ['Hướng Dẫn', 'Mẹo Chơi', gameName, 'Tân Thủ'];
        content = `## Cẩm Nang Toàn Tập Dành Cho Tân Thủ ${gameName}

Bước chân vào thế giới của **${gameName}** (${publisher}), việc tận dụng tối đa các tài nguyên miễn phí từ giftcode là chìa khóa giúp bạn thăng tiến lực chiến nhanh chóng mà không cần tốn kém.

### 1. Hướng Dẫn Từng Bước Nhập Mã Quà Tặng
Nhiều người chơi mới thường bối rối không tìm thấy nơi nhập code. Hãy làm theo hướng dẫn chuẩn xác sau:
- Bước 1: Hoàn thành màn tân thủ (thường đạt cấp độ 10).
- Bước 2: Bấm vào **Avatar nhân vật** ở góc trên bên trái màn hình.
- Bước 3: Chọn **Cài Đặt Hệ Thống** -> **Đổi Code**.
- Bước 4: Nhập mã và kiểm tra Hòm Thư.

### 2. Các Lưu Ý Tránh Lỗi Khi Đổi Code
- Kiểm tra chính xác chữ hoa, chữ thường và không để khoảng trắng thừa ở đầu/cuối mã.
- Mỗi mã code chỉ có thể sử dụng 1 lần cho 1 nhân vật.

### 3. Danh Sách Mã Đang Hoạt Động 100%
Dưới đây là bộ mã đã được hệ thống CodeGame.shop xác thực kiểm duyệt thành công!`;
        break;

      case 'event':
      default:
        title = `${gameName}: Đại Tiệc Sự Kiện Lớn & Chuỗi Quà Tặng Tri Ân Game Thủ`;
        excerpt = `Sự kiện tri ân cộng đồng hoành tráng của ${gameName} chính thức bùng nổ. Nhận trọn bộ mã code sự kiện và trang bị quý hiếm hoàn toàn miễn phí.`;
        tags = ['Sự Kiện', 'Tri Ân', gameName, 'Quà Tặng'];
        content = `## Đại Tiệc Sự Kiện Mừng Mùa Lễ Hội ${gameName}

Cộng đồng game thủ **${gameName}** đang sôi sục với chuỗi sự kiện quy mô lớn được **${publisher}** tổ chức nhằm tri ân các game thủ đã gắn bó cùng tựa game.

### 1. Nội Dung Sự Kiện Tiêu Điểm
- Vòng quay may mắn nhận trang bị Cam và Kim Cương miễn phí mỗi ngày.
- Hoạt động Bang Hội liên server tranh đoạt lãnh địa với phần thưởng hàng triệu Core.
- Thử thách săn boss thế giới rơi rương báu vật phẩm quý hiếm.

### 2. Bộ Giftcode Sự Kiện Độc Quyền
Nhanh tay sao chép ngay danh sách mã quà tặng bên dưới để không bỏ lỡ các phần quà giá trị từ ban tổ chức!`;
        break;
    }

    return {
      title,
      excerpt,
      content,
      tags,
      codes,
      game_id: params.game.id,
      game_slug: params.game.slug,
      game_name: gameName,
      cover_url: params.game.banner_url || params.game.icon_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
      author: 'CodeGame Editorial',
      status: 'PUBLISHED',
      is_featured: false,
      is_hot: true,
      read_time_minutes: 3,
    };
  }
}

export const newsService = new NewsService();
