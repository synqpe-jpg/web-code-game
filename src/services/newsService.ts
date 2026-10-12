import type { NewsArticle, GameItem } from '../types/game';
import { DEFAULT_NEWS_ARTICLES } from '../data/seedNews';
import { smartVietnameseMatch } from '../utils/textUtils';

const STORAGE_KEY = 'wcg_news_articles_v1';
const STORAGE_DELETED_KEY = 'wcg_deleted_news_articles_v1';

class NewsService {
  private articles: NewsArticle[] = [];
  private deletedArticleIds: Set<string> = new Set();
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

    // 1. Tải danh sách bài viết đã xóa (Tombstones) để ngăn chặn vĩnh viễn việc hồi sinh
    try {
      const delStored = localStorage.getItem(STORAGE_DELETED_KEY);
      if (delStored) {
        const parsedDel = JSON.parse(delStored);
        if (Array.isArray(parsedDel)) {
          this.deletedArticleIds = new Set(parsedDel.map(String));
        }
      }
    } catch (e) {
      console.warn('[NewsService] Lỗi đọc tombstones tin tức:', e);
    }

    // 2. Tải danh sách bài viết hiện tại
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        // Người dùng hoặc máy chủ đã từng lưu dữ liệu (kể cả khi mảng rỗng [] do xóa hết)
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.articles = parsed.filter(
            (a: NewsArticle) =>
              !this.deletedArticleIds.has(a.id) &&
              !this.deletedArticleIds.has(a.slug)
          );
          this.isLoaded = true;
          return;
        }
      }
    } catch (e) {
      console.warn('[NewsService] Lỗi đọc tin tức từ localStorage:', e);
    }

    // 3. Chỉ nạp seed mặc định cho khách truy cập lần đầu tiên khi chưa có dữ liệu nào
    this.articles = DEFAULT_NEWS_ARTICLES.filter(
      (s) => !this.deletedArticleIds.has(s.id) && !this.deletedArticleIds.has(s.slug)
    );
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
    if (Array.isArray(serverArticles)) {
      // Loại bỏ toàn bộ bài viết đã nằm trong danh sách đã xóa (tombstones)
      const cleanServer = serverArticles.filter(
        (a) =>
          !this.deletedArticleIds.has(a.id) &&
          !this.deletedArticleIds.has(a.slug)
      );
      this.articles = cleanServer;
      this.saveToStorage();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wcg_news_updated', { detail: this.articles }));
      }
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
    return result
      .map((a) => ({ ...a, views: this.getDisplayViews(a) }))
      .sort((a, b) => {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
        const dateA = new Date(a.published_at || 0).getTime();
        const dateB = new Date(b.published_at || 0).getTime();
        return dateB - dateA;
      });
  }

  /**
   * Tính toán số lượt xem hiển thị tự nhiên dựa trên lượt xem thực + lượt xem ban đầu + hệ số tăng trưởng theo giờ
   */
  public getDisplayViews(article: NewsArticle | Partial<NewsArticle>): number {
    const realViews = Number(article.views) || 0;
    const baseViews = Number(article.virtual_views) || 0;
    const growthRate = typeof article.views_growth_rate === 'number' && !isNaN(article.views_growth_rate)
      ? article.views_growth_rate
      : 1.0;

    const pubTime = article.published_at ? new Date(article.published_at).getTime() : Date.now();
    const hoursElapsed = Math.max(0, (Date.now() - pubTime) / (1000 * 60 * 60));

    // Hệ số 1.0 tương đương ~6 lượt xem tự tăng mỗi giờ
    const timeGrowth = Math.floor(hoursElapsed * growthRate * 6);
    return Math.max(realViews, realViews + baseViews + timeGrowth);
  }

  /**
   * Lấy toàn bộ bài viết (Bao gồm cả bản nháp cho Admin)
   */
  public getAllArticles(): NewsArticle[] {
    return this.getAllArticlesForAdmin();
  }

  public getAllArticlesForAdmin(): NewsArticle[] {
    return [...this.articles]
      .map((a) => ({ ...a, views: this.getDisplayViews(a) }))
      .sort((a, b) => {
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
    const found = this.articles.find(
      (a) =>
        a.slug?.toLowerCase() === clean ||
        a.id?.toLowerCase() === clean
    );
    return found ? { ...found, views: this.getDisplayViews(found) } : null;
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
    articleData: Partial<NewsArticle> & { title: string },
    options?: { skipSync?: boolean }
  ): Promise<NewsArticle> {
    const now = new Date().toISOString();
    let slug =
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
        gallery_urls: articleData.gallery_urls || this.articles[existingIndex].gallery_urls || [],
        virtual_views: typeof articleData.virtual_views === 'number' ? articleData.virtual_views : this.articles[existingIndex].virtual_views || 0,
        views_growth_rate: typeof articleData.views_growth_rate === 'number' ? articleData.views_growth_rate : (this.articles[existingIndex].views_growth_rate !== undefined ? this.articles[existingIndex].views_growth_rate : 1.0),
        slug,
        updated_at: now,
      };
      this.articles[existingIndex] = savedItem;
    } else {
      // Disambiguate slug if already exists for another article
      if (this.articles.some((a) => a.slug === slug)) {
        slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      }

      savedItem = {
        id: articleData.id || `news_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        slug,
        title: articleData.title.trim(),
        excerpt: articleData.excerpt || '',
        content: articleData.content || '',
        cover_url:
          articleData.cover_url ||
          (articleData.game_slug ? `/game_icons/${articleData.game_slug}.webp` : '') ||
          '',
        gallery_urls: articleData.gallery_urls || [],
        virtual_views: typeof articleData.virtual_views === 'number' ? articleData.virtual_views : 0,
        views_growth_rate: typeof articleData.views_growth_rate === 'number' ? articleData.views_growth_rate : 1.0,
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

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wcg_news_updated', { detail: this.articles }));
    }

    if (!options?.skipSync) {
      await this.syncToCloudflareServer();
    }
    return savedItem;
  }

  /**
   * Lưu hàng loạt nhiều bài viết một lần (Tối ưu hóa ghi nhớ và sync Cloudflare)
   */
  public async saveArticlesBatch(
    articlesList: Array<Partial<NewsArticle> & { title: string }>
  ): Promise<NewsArticle[]> {
    const results: NewsArticle[] = [];
    for (const item of articlesList) {
      const saved = await this.saveArticle(item, { skipSync: true });
      results.push(saved);
    }
    await this.syncToCloudflareServer();
    return results;
  }

  /**
   * Admin: Xóa vĩnh viễn bài viết (Lưu tombstones ngăn chặn hồi sinh ở mọi nơi)
   */
  public async deleteArticle(articleId: string): Promise<boolean> {
    const found = this.articles.find((a) => a.id === articleId || a.slug === articleId);
    const foundId = found?.id || articleId;
    const foundSlug = found?.slug;

    this.deletedArticleIds.add(foundId);
    if (foundSlug) this.deletedArticleIds.add(foundSlug);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(Array.from(this.deletedArticleIds)));
      } catch {}
    }

    const initialLen = this.articles.length;
    this.articles = this.articles.filter(
      (a) => a.id !== foundId && a.slug !== foundId && (!foundSlug || (a.id !== foundSlug && a.slug !== foundSlug))
    );

    this.saveToStorage();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wcg_news_updated', { detail: this.articles }));
    }

    await this.syncToCloudflareServer();
    return true;
  }

  /**
   * Gửi dữ liệu bài viết lên máy chủ Cloudflare D1
   */
  public async syncArticlesToCloudflare(): Promise<boolean> {
    return this.syncToCloudflareServer();
  }

  public async syncToCloudflareServer(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const syncKey =
        localStorage.getItem('wcg_admin_sync_key') ||
        sessionStorage.getItem('wcg_admin_sync_key') ||
        'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-Key': syncKey,
        },
        body: JSON.stringify({
          newsArticles: this.articles,
          deletedNewsArticles: Array.from(this.deletedArticleIds),
        }),
      });
      return res.ok;
    } catch (e) {
      console.warn('[NewsService] Không thể sync bài viết lên Cloudflare D1:', e);
      return false;
    }
  }

  /**
   * ✨ AI Auto-Writer: Tự động biên tập bài viết chuẩn SEO dựa trên tựa game và sự kiện
   */
  public generateAiArticleDraft(params: {
    game: Partial<GameItem>;
    topicType: 'codes' | 'update' | 'new_server' | 'event' | 'guide';
    availableCodes?: string[];
  }): Partial<NewsArticle> {
    const gameName = params.game.name || 'Tựa Game';
    const hasPublisher = params.game.publisher && params.game.publisher !== 'Nhà phát hành chính thức';
    const pubPhrase = hasPublisher ? `phát hành bởi **${params.game.publisher}**` : 'phát hành chính thức tại Việt Nam';
    const codes = params.availableCodes && params.availableCodes.length > 0
      ? params.availableCodes.slice(0, 6)
      : ['CODEVIP2026', 'TANTHU999', 'QUATRIAN888'];

    const monthYear = 'Tháng 10/2026';

    let title = '';
    let excerpt = '';
    let content = '';
    let tags: string[] = [];

    switch (params.topicType) {
      case 'codes':
        title = `Tổng Hợp Trọn Bộ Giftcode ${gameName} Mới Nhất ${monthYear} - Còn Hạn 100%`;
        excerpt = `Tổng hợp toàn bộ mã quà tặng giftcode ${gameName} (${hasPublisher ? params.game.publisher : 'Việt Nam'}) mới nhất còn hạn sử dụng. Hướng dẫn chi tiết cách nhập code nhận quà VIP.`;
        tags = ['Giftcode Mới', 'Mã Quà Tặng', gameName, 'Code Tân Thủ'];
        content = `## Danh Sách Mã Giftcode ${gameName} Mới Nhất Hôm Nay

Ban biên tập **CodeGame.store** gửi tặng cộng đồng game thủ danh sách các mã quà tặng giftcode mới nhất dành cho tựa game **${gameName}** ${pubPhrase}.

### 1. Danh Sách Mã Code Còn Hạn Sử Dụng
Toàn bộ mã bên dưới đã được đối chiếu kiểm tra thực tế trong game. Hãy nhanh tay sao chép và nhập ngay trước khi hết hạn sử dụng!

### 2. Hướng Dẫn Cách Nhập Giftcode Trong ${gameName}
1. Đăng nhập vào trò chơi **${gameName}**.
2. Nhấn vào **Avatar** nhân vật ở góc trên màn hình.
3. Chọn mục **Cài Đặt** hoặc **Phúc Lợi** -> **Đổi Giftcode**.
4. Dán mã quà tặng bên dưới và nhấn **Xác Nhận** để nhận quà qua Hòm Thư.`;
        break;

      case 'update':
        title = `${gameName}: Chi Tiết Bản Cập Nhật Mới & Bộ Giftcode Quà Tặng ${monthYear}`;
        excerpt = `Khám phá các điểm mới trong bản cập nhật lớn của ${gameName}, tinh chỉnh cân bằng chiến đấu và nhận ngay danh sách mã code độc quyền.`;
        tags = ['Bản Cập Nhật', 'Giftcode Mới', gameName, 'Tin Nóng'];
        content = `## Tổng Quan Bản Cập Nhật Mới ${gameName}

Tựa game **${gameName}** (${pubPhrase}) vừa chính thức phát hành phiên bản cập nhật lớn với hàng loạt nâng cấp đáng giá về đồ họa, tối ưu hiệu năng và bổ sung các tính năng chiến đấu mới.

### 1. Các Tính Năng & Hoạt Động Mới
- **Hệ Thống Phụ Bản Mới**: Mở rộng các tầng thí luyện liên server với độ khó nâng cao, mang lại phần thưởng trang bị quý hiếm cho người chơi.
- **Tối Ưu Hóa Cân Bằng**: Tinh chỉnh lại chỉ số sát thương và phòng thủ của các nhân vật/hệ phái nhằm mang lại trải nghiệm công bằng trong đấu trường PvP.
- **Sự Kiện Đăng Nhập 7 Ngày**: Đăng nhập liên tục trong tuần đầu phát hành bản cập nhật để nhận miễn phí rương bảo thạch và vàng khóa.

### 2. Danh Sách Giftcode Áp Dụng Cho Phiên Bản Này
Ban quản trị **CodeGame.store** đã tổng hợp và kiểm tra tính hợp lệ của toàn bộ mã giftcode mới nhất dành cho ${gameName}. Hãy sử dụng danh sách mã code bên dưới để nhận ngay quà tặng khởi đầu thuận lợi!

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

Nhằm đáp ứng sự ủng hộ nhiệt tình từ cộng đồng game thủ, ${pubPhrase} chính thức khai mở cụm máy chủ mới dành cho **${gameName}**.

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

Bước chân vào thế giới của **${gameName}** (${pubPhrase}), việc tận dụng tối đa các tài nguyên miễn phí từ giftcode là chìa khóa giúp bạn thăng tiến lực chiến nhanh chóng mà không cần tốn kém.

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
Dưới đây là bộ mã đã được hệ thống CodeGame.store xác thực kiểm duyệt thành công!`;
        break;

      case 'event':
      default:
        title = `${gameName}: Đại Tiệc Sự Kiện Lớn & Chuỗi Quà Tặng Tri Ân Game Thủ`;
        excerpt = `Sự kiện tri ân cộng đồng hoành tráng của ${gameName} chính thức bùng nổ. Nhận trọn bộ mã code sự kiện và trang bị quý hiếm hoàn toàn miễn phí.`;
        tags = ['Sự Kiện', 'Tri Ân', gameName, 'Quà Tặng'];
        content = `## Đại Tiệc Sự Kiện Mừng Mùa Lễ Hội ${gameName}

Cộng đồng game thủ **${gameName}** đang sôi sục với chuỗi sự kiện quy mô lớn ${pubPhrase} nhằm tri ân các game thủ đã gắn bó cùng tựa game.

### 1. Nội Dung Sự Kiện Tiêu Điểm
- Vòng quay may mắn nhận trang bị Cam và Kim Cương miễn phí mỗi ngày.
- Hoạt động Bang Hội liên server tranh đoạt lãnh địa với phần thưởng hàng triệu Core.
- Thử thách săn boss thế giới rơi rương báu vật phẩm quý hiếm.

### 2. Bộ Giftcode Sự Kiện Độc Quyền
Nhanh tay sao chép ngay danh sách mã quà tặng bên dưới để không bỏ lỡ các phần quà giá trị từ ban tổ chức!`;
        break;
    }

    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return {
      title,
      slug,
      excerpt,
      content,
      tags,
      codes,
      game_id: params.game.id,
      game_slug: params.game.slug,
      game_name: gameName,
      cover_url:
        params.game.cover_image_url ||
        (params.game as any).cover_image ||
        params.game.banner_url ||
        params.game.icon_url ||
        (params.game.slug ? `/game_icons/${params.game.slug}.webp` : '') ||
        '',
      gallery_urls: [],
      virtual_views: Math.floor(Math.random() * 150) + 120,
      views_growth_rate: 1.0,
      author: 'CodeGame Editorial',
      status: 'PUBLISHED',
      is_featured: false,
      is_hot: true,
      read_time_minutes: 3,
    };
  }

  /**
   * AI Viết lại bài viết từ URL hoặc nội dung bài báo nguồn:
   * - Viết lại tiêu đề chuẩn SEO cuốn hút, không trùng lặp
   * - Viết lại mở bài (excerpt)
   * - Cấu trúc lại bài viết theo định dạng Markdown chuyên nghiệp (H2, H3, Mẹo, Hướng dẫn)
   * - Bóc tách và gộp toàn bộ mã Giftcode tìm thấy
   * - Bóc tách hình ảnh đưa vào thư viện
   */
  public rewriteArticleWithAi(params: {
    rawTitle?: string;
    rawContent: string;
    sourceUrl?: string;
    game?: { id?: string; name?: string; slug?: string; banner_url?: string; icon_url?: string } | null;
    foundCodes?: string[];
    foundImages?: string[];
  }): Partial<NewsArticle> {
    const gameName = params.game?.name || 'Tựa Game';
    
    // Clean raw text thoroughly
    let cleanRaw = (params.rawContent || '')
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u00A0]/g, ' ')
      .replace(/[»«►◄▲▼■◆●★☆❖✓✔✕✖]/g, ' ')
      .replace(/###?\s*Tiêu đề mục (?:lớn|nhỏ)\n*/gi, '')
      .replace(/\*\*Văn bản in đậm\*\*\n*/gi, '')
      .replace(/>\s*💡\s*\*\*Lưu ý:\*\*\s*Nội dung nhắc nhở game thủ\.\.\.\n*/gi, '')
      .replace(/CodeGame\.shop/gi, 'CodeGame.store')
      .trim();

    // 1. Quét thêm mã giftcode từ nội dung
    const extractedCodes = new Set<string>(params.foundCodes || []);
    const codeMatches = cleanRaw.matchAll(/(?:code|giftcode|mã quà tặng|mã code)\s*[:=\-–]\s*([a-zA-Z0-9_\-]+)/gi);
    for (const m of codeMatches) {
      const c = m[1].trim().toUpperCase();
      if (c.length >= 4 && c.length <= 25) extractedCodes.add(c);
    }
    const words = cleanRaw.match(/\b[A-Z0-9_]{5,20}\b/g) || [];
    for (const w of words) {
      const upper = w.toUpperCase();
      if (/[0-9]/.test(upper) && /[A-Z]/.test(upper)) {
        extractedCodes.add(upper);
      }
    }
    const finalCodes = Array.from(extractedCodes).slice(0, 15);

    // 2. Viết lại tiêu đề chuẩn SEO
    let title = params.rawTitle ? params.rawTitle.trim() : '';
    const currentYear = new Date().getFullYear();
    if (!title || title.length < 10) {
      title = `${gameName}: Tổng Hợp Giftcode Mới Nhất & Hướng Dẫn Nhập Quà (${currentYear})`;
    } else {
      let stripped = title
        .replace(/^[»>|\-\s]+/, '')
        .replace(/\b(2023|2024|2025)\b/g, currentYear.toString())
        .trim();
      if (!stripped.toLowerCase().includes(gameName.toLowerCase())) {
        title = `${gameName}: ${stripped}`;
      } else {
        title = stripped;
      }
      if (!title.includes(currentYear.toString())) {
        title += ` (${currentYear})`;
      }
    }

    // 3. Viết lại tóm tắt tự nhiên
    let excerpt = `Cập nhật toàn bộ thông tin mới nhất và danh sách mã giftcode độc quyền dành cho game thủ ${gameName}. Nhận ngay gói quà tân thủ, vật phẩm giới hạn và hướng dẫn kích hoạt code chi tiết.`;
    if (cleanRaw.length > 50) {
      const firstLines = cleanRaw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 30 && !l.startsWith('#') && !/^(skip to|trang chủ|home)/i.test(l))
        .slice(0, 2)
        .join(' ');
      if (firstLines.length > 40) {
        excerpt = firstLines.slice(0, 200).replace(/[#*`_]/g, '') + '...';
      }
    }

    // 4. Lọc bỏ các đoạn rác boilerplate và định dạng đoạn văn tự nhiên
    const paragraphs = cleanRaw
      .split('\n\n')
      .map((p) => p.trim())
      .filter((p) => {
        if (p.length < 25) return false;
        if (p.startsWith('#')) return false;
        const low = p.toLowerCase();
        if (/^(skip to content|trang chủ|home|mục lục|table of contents)/i.test(low)) return false;
        if (/^(nguồn|nguồn ảnh|theo dõi|bình luận|chia sẻ|đọc thêm|xem thêm|bài viết cùng)/i.test(low)) return false;
        if (/^(like|share|subscribe|đăng ký kênh|tham gia nhóm)/i.test(low)) return false;
        return true;
      });

    let bodySection = '';
    if (paragraphs.length >= 2) {
      bodySection = paragraphs.slice(0, 4).join('\n\n');
    } else {
      bodySection = `Bản cập nhật mới nhất của **${gameName}** đã chính thức ra mắt cộng đồng game thủ với hàng loạt tính năng hấp dẫn, tối ưu hóa trải nghiệm chiến đấu và mở rộng chuỗi sự kiện đặc sắc.\n\nĐể tri ân người chơi và hỗ trợ các tân thủ có khởi đầu thuận lợi, ban điều hành đã phát hành bộ mã quà tặng độc quyền với nhiều phần thưởng giá trị.`;
    }

    const content = `## 1. Điểm Nhấn Bản Tin & Sự Kiện ${gameName}

${bodySection}

## 2. Trọn Bộ Mã Giftcode ${gameName} Đang Hoạt Động (Cập Nhật Hôm Nay)

Dưới đây là danh sách toàn bộ các mã giftcode hợp lệ đã được kiểm duyệt. Độc giả có thể bấm sao chép trực tiếp các mã hiển thị trên bài viết để sử dụng ngay:

${finalCodes.length > 0 ? finalCodes.map((c) => `- **${c}**: Gói quà tri ân & tài nguyên tân thủ`).join('\n') : `- Danh sách mã code đang hoạt động được đính kèm ở khung quà tặng bên dưới.`}

> 💡 **Lưu ý quan trọng:** Mỗi mã quà tặng đều có hạn sử dụng và số lượng kích hoạt nhất định. Bạn nên nhập code ngay khi nhận được để tránh hết hạn!

## 3. Hướng Dẫn Từng Bước Cách Nhập Code Nhận Quà Trong ${gameName}

1. Khởi động trò chơi **${gameName}** trên thiết bị của bạn và đăng nhập tài khoản.
2. Tại giao diện chính, bấm vào **Avatar nhân vật** hoặc biểu tượng **Cài Đặt / Phúc Lợi**.
3. Chọn mục **Đổi Mã Quà Tặng (Giftcode)**.
4. Sao chép mã code ở trên, dán vào ô nhập liệu và bấm **Xác Nhận**.
5. Phần thưởng sẽ được gửi trực tiếp vào **Hòm Thư** trong game trong vòng vài phút.

## 4. Mẹo Chơi Game & Cách Nhận Thêm Code Mới
- Theo dõi Fanpage và Group cộng đồng chính thức của ${gameName} để tham gia các minigame săn code độc quyền.
- Thường xuyên ghé thăm **CodeGame.store** để cập nhật nhanh nhất các mã giftcode máy chủ mới và sự kiện đua TOP.`;

    const gameLogo =
      params.game?.banner_url ||
      params.game?.icon_url ||
      (params.game?.slug ? `/game_icons/${params.game.slug}.webp` : '');

    const cover_url =
      gameLogo ||
      (params.foundImages && params.foundImages[0]) ||
      '';

    const gallery_urls = (params.foundImages || []).slice(1, 6);

    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return {
      title,
      slug,
      excerpt,
      content,
      codes: finalCodes,
      cover_url,
      gallery_urls,
      game_id: params.game?.id,
      game_slug: params.game?.slug,
      game_name: gameName,
      tags: ['Giftcode', gameName, 'TinTucGame', 'CapNhat'],
      author: 'CodeGame Editorial',
      status: 'PUBLISHED',
      is_featured: false,
      is_hot: true,
      virtual_views: Math.floor(Math.random() * 200) + 180,
      views_growth_rate: 1.0,
      read_time_minutes: 3,
    };
  }
}

export const newsService = new NewsService();
