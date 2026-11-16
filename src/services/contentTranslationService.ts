/**
 * Content Translation Service
 * Quản lý các bản dịch nội dung động trong D1 (Sản phẩm, Danh mục, Ngành hàng, Hướng dẫn nhập code, Tin tức)
 * Nguyên tắc: 1 bản ghi gốc (Tiếng Việt), các ngôn ngữ khác chỉ là bản dịch gắn vào.
 * Thiếu bản dịch -> Tự động fallback về Tiếng Việt gốc.
 */

export interface ContentTranslationRecord {
  id?: number | string;
  object_type: 'category' | 'industry' | 'brand' | 'product' | 'instruction' | 'news' | 'event' | string;
  object_id: string;
  field: 'name' | 'description' | 'instructions' | 'title' | 'content' | string;
  language: string;
  content: string;
  reviewer?: string;
  status: 'draft' | 'pending' | 'approved' | string;
  updated_at: string;
}

const STORAGE_KEY = 'wcg_content_translations_v1';

// Bộ bản dịch mẫu Tiếng Anh ban đầu cho 5 ngành hàng, sản phẩm tiêu biểu và hướng dẫn nhập code
const INITIAL_CONTENT_TRANSLATIONS: ContentTranslationRecord[] = [
  // 1. Ngành hàng (Industries)
  {
    object_type: 'industry',
    object_id: 'gaming',
    field: 'name',
    language: 'en',
    content: 'Gaming & Software Keys',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },
  {
    object_type: 'industry',
    object_id: 'gaming',
    field: 'description',
    language: 'en',
    content: 'Giftcodes, game cards, premium accounts, and software license keys with instant 0s delivery.',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },
  {
    object_type: 'industry',
    object_id: 'fashion',
    field: 'name',
    language: 'en',
    content: 'Fashion & Streetwear',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },
  {
    object_type: 'industry',
    object_id: 'fashion',
    field: 'description',
    language: 'en',
    content: 'High-quality apparel, streetwear, sneakers, and accessories with full size and color options.',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },
  {
    object_type: 'industry',
    object_id: 'beauty',
    field: 'name',
    language: 'en',
    content: 'Cosmetics & Skincare',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },
  {
    object_type: 'industry',
    object_id: 'beauty',
    field: 'description',
    language: 'en',
    content: 'Authentic serums, lotions, lipsticks, and beauty essentials certified by dermatologists.',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },
  {
    object_type: 'industry',
    object_id: 'tech',
    field: 'name',
    language: 'en',
    content: 'Technology & Gadgets',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },
  {
    object_type: 'industry',
    object_id: 'tech',
    field: 'description',
    language: 'en',
    content: 'Gaming gear, wireless earbuds, smart accessories, and computer peripherals with official warranty.',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },
  {
    object_type: 'industry',
    object_id: 'services',
    field: 'name',
    language: 'en',
    content: 'Digital Services & Courses',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },
  {
    object_type: 'industry',
    object_id: 'services',
    field: 'description',
    language: 'en',
    content: 'Online masterclasses, productivity subscriptions, cloud hosting, and professional services.',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },

  // 2. Hướng dẫn nhập code chuẩn tiếng Anh (Human-reviewed by admin)
  {
    object_type: 'instruction',
    object_id: 'general_redemption',
    field: 'instructions',
    language: 'en',
    content: '1. Launch the game and complete the tutorial.\n2. Tap your Avatar or Settings icon in the top corner.\n3. Select "Redeem Giftcode" or "CDKey".\n4. Paste the copied code and confirm to receive rewards immediately via in-game mailbox.',
    reviewer: 'Senior QA Specialist',
    status: 'approved',
    updated_at: '2026-11-16T14:00:00Z',
  },

  // 3. Sản phẩm tiêu biểu (Preset Products)
  {
    object_type: 'product',
    object_id: 'prod_fash_01',
    field: 'name',
    language: 'en',
    content: 'Heavyweight Unisex Cyberpunk Oversized Hoodie',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },
  {
    object_type: 'product',
    object_id: 'prod_fash_01',
    field: 'description',
    language: 'en',
    content: 'Premium 100% French Terry cotton (380gsm), thermal insulating, durable screen-printed cyberpunk graphic. Includes free exchange within 7 days.',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },
  {
    object_type: 'product',
    object_id: 'prod_tech_01',
    field: 'name',
    language: 'en',
    content: 'RGB Pro Wireless Gaming Mouse 26,000 DPI Ultra-Light',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },
  {
    object_type: 'product',
    object_id: 'prod_tech_01',
    field: 'description',
    language: 'en',
    content: 'Next-gen optical sensor 26K DPI, sub-1ms wireless latency, 80-hour battery life, 59g ultra-lightweight chassis. 12-month 1-to-1 warranty.',
    reviewer: 'Admin Verified',
    status: 'approved',
    updated_at: '2026-11-16T12:00:00Z',
  },
];

class ContentTranslationService {
  private translations: ContentTranslationRecord[] = [];
  private isLoaded: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.translations = parsed;
            this.isLoaded = true;
            return;
          }
        }
      }
    } catch {}

    // Khởi tạo từ bộ bản dịch mẫu
    this.translations = [...INITIAL_CONTENT_TRANSLATIONS];
    this.saveLocal();
    this.isLoaded = true;
  }

  private saveLocal() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.translations));
        window.dispatchEvent(new CustomEvent('wcg_content_translations_updated'));
      }
    } catch {}
  }

  /**
   * Lấy toàn bộ bản dịch (dành cho Admin)
   */
  public getAllTranslations(): ContentTranslationRecord[] {
    return [...this.translations];
  }

  /**
   * Hàm dịch nội dung động quan trọng nhất:
   * Nếu language === 'vi' -> trả về bản gốc tiếng Việt.
   * Nếu language !== 'vi' -> tìm bản dịch đã duyệt (approved). Nếu thiếu -> fallback về bản gốc tiếng Việt.
   */
  public translateField(
    objectType: string,
    objectId: string,
    field: string,
    originalVietnamese: string,
    language: string = 'vi'
  ): string {
    if (language === 'vi' || !language) {
      return originalVietnamese;
    }

    const found = this.translations.find(
      (t) =>
        t.object_type === objectType &&
        t.object_id === objectId &&
        t.field === field &&
        t.language === language &&
        t.status === 'approved'
    );

    if (found && found.content && found.content.trim()) {
      return found.content;
    }

    // Fallback an toàn về bản gốc tiếng Việt (không rỗng, không crash)
    return originalVietnamese;
  }

  /**
   * Kiểm tra xem một đối tượng đã có bản dịch tiếng Anh được duyệt chưa
   */
  public isFieldTranslated(
    objectType: string,
    objectId: string,
    field: string,
    language: string = 'en'
  ): boolean {
    return this.translations.some(
      (t) =>
        t.object_type === objectType &&
        t.object_id === objectId &&
        t.field === field &&
        t.language === language &&
        t.status === 'approved' &&
        t.content.trim().length > 0
    );
  }

  /**
   * Cập nhật hoặc lưu bản dịch mới (Admin)
   */
  public async saveTranslation(record: Omit<ContentTranslationRecord, 'updated_at'>): Promise<boolean> {
    const updatedRecord: ContentTranslationRecord = {
      ...record,
      updated_at: new Date().toISOString(),
    };

    const idx = this.translations.findIndex(
      (t) =>
        t.object_type === record.object_type &&
        t.object_id === record.object_id &&
        t.field === record.field &&
        t.language === record.language
    );

    if (idx >= 0) {
      this.translations[idx] = updatedRecord;
    } else {
      this.translations.unshift(updatedRecord);
    }

    this.saveLocal();

    // Đồng bộ lên Cloudflare D1
    try {
      await fetch('/api/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRecord),
      }).catch(() => {});
    } catch {}

    return true;
  }

  /**
   * Xóa bản dịch (Admin)
   */
  public deleteTranslation(objectType: string, objectId: string, field: string, language: string): boolean {
    this.translations = this.translations.filter(
      (t) =>
        !(
          t.object_type === objectType &&
          t.object_id === objectId &&
          t.field === field &&
          t.language === language
        )
    );
    this.saveLocal();
    return true;
  }
}

export const contentTranslationService = new ContentTranslationService();
