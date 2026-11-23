/**
 * Branding and Domain Configuration Service
 * Provides centralized brand, domain, and display configuration stored in D1 (key: wcg_branding_v1)
 */

export interface BrandingFaqItem {
  q: string;
  a: string;
}

export interface BrandingConfig {
  brandName: string;          // e.g. "CodeGame"
  brandDisplay: string;       // e.g. "CodeGame.Shop"
  baseUrl: string;            // e.g. "https://codegame.shop"
  siteTitle: string;          // e.g. "CodeGame.shop - Săn Giftcode Miễn Phí & Giao Dịch Mã Game Uy Tín"
  tagline: string;            // e.g. "Kho Giftcode Game Mobile & Webgame Mới Nhất 2026"
  portalSubtitle: string;     // e.g. "Cổng Tra Cứu Giftcode"
  footerCopyright: string;    // e.g. "Toàn bộ bản quyền thuộc về {brand}."
  faqList: BrandingFaqItem[];
  emailFromName: string;      // e.g. "CodeGame.shop - Thông Báo Sự Kiện & Code Game"
  emailFromAddress: string;   // e.g. "notifications@codegame.shop"
  telegramBotName: string;    // e.g. "CodeGame.Shop Bot"
  seoTitle: string;           // e.g. "CodeGame.shop - Săn Giftcode Miễn Phí & Giao Dịch Mã Game Uy Tín"
  seoDescription: string;     // e.g. "Kho tổng hợp hơn 14.739+ giftcode game mobile và webgame mới nhất 2026 của 595 tựa game chuẩn. Cập nhật liên tục 24/7 từ các NPH VNG, Garena, VTC, SohaGame, Funtap."
  logoAlt: string;            // e.g. "CodeGame.Shop Logo"
  manifestName: string;       // e.g. "CodeGame - Cổng Tra Cứu Giftcode & Game Bản Quyền"
  manifestShortName: string;  // e.g. "CodeGame"
  updated_at?: string;
  updated_by?: string;
}

export const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  brandName: 'CodeGame',
  brandDisplay: 'CodeGame.Shop',
  baseUrl: 'https://codegame.shop',
  siteTitle: 'CodeGame.shop - Săn Giftcode Miễn Phí & Giao Dịch Mã Game Uy Tín',
  tagline: 'Kho Giftcode Game Mobile & Webgame Mới Nhất 2026',
  portalSubtitle: 'Cổng Tra Cứu Giftcode',
  footerCopyright: 'Toàn bộ bản quyền thuộc về {brand}.',
  faqList: [
    {
      q: 'Giftcode trên CodeGame.shop có miễn phí không?',
      a: 'Tất cả mã giftcode trong mục Mã Miễn Phí và Đợt Phát Code đều hoàn toàn miễn phí 100%, được tổng hợp và kiểm duyệt từ các Nhà phát hành game chính thức tại Việt Nam.',
    },
    {
      q: 'Làm thế nào để sao chép mã code nhanh chóng?',
      a: 'Bạn chỉ cần nhấp vào nút Sao Chép bên cạnh mỗi mã giftcode hoặc chọn Sao Chép Toàn Bộ Mã Còn Hạn để lưu tất cả giftcode vào bộ nhớ tạm trong 1 giây.',
    },
    {
      q: 'Các tựa game trên CodeGame.shop có hợp pháp không?',
      a: 'Hệ thống cập nhật và đối soát thông tin pháp lý, Giấy phép phê duyệt nội dung kịch bản G1 từ Cục PTTH&TTĐT đối với từng tựa game phát hành tại Việt Nam.',
    },
  ],
  emailFromName: 'CodeGame.shop - Thông Báo Sự Kiện & Code Game',
  emailFromAddress: 'notifications@codegame.shop',
  telegramBotName: 'CodeGame.Shop Bot',
  seoTitle: 'CodeGame.shop - Săn Giftcode Miễn Phí & Giao Dịch Mã Game Uy Tín',
  seoDescription: 'Kho tổng hợp hơn 14.739+ giftcode game mobile và webgame mới nhất 2026 của 595 tựa game chuẩn. Cập nhật liên tục 24/7 từ các NPH VNG, Garena, VTC, SohaGame, Funtap.',
  logoAlt: 'CodeGame.Shop Logo',
  manifestName: 'CodeGame - Cổng Tra Cứu Giftcode & Game Bản Quyền',
  manifestShortName: 'CodeGame',
};

export const BRANDING_SETTINGS_KEY = 'wcg_branding_v1';

// In-memory cache for Worker isolates
let _cachedBranding: { config: BrandingConfig; timestamp: number } | null = null;
const CACHE_TTL_MS = 30000; // 30s RAM cache

/**
 * Invalidate in-memory cache
 */
export function invalidateBrandingCache() {
  _cachedBranding = null;
}

/**
 * Validate partial or full branding config
 */
export function validateBrandingConfig(input: Partial<BrandingConfig>): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (input.brandName !== undefined) {
    if (!input.brandName || !input.brandName.trim()) {
      errors.brandName = 'Tên thương hiệu không được để trống.';
    }
  }

  if (input.brandDisplay !== undefined) {
    if (!input.brandDisplay || !input.brandDisplay.trim()) {
      errors.brandDisplay = 'Tên hiển thị đầy đủ không được để trống.';
    }
  }

  if (input.baseUrl !== undefined) {
    const rawUrl = (input.baseUrl || '').trim();
    if (!rawUrl) {
      errors.baseUrl = 'URL gốc không được để trống.';
    } else {
      try {
        const u = new URL(rawUrl);
        if (u.protocol !== 'https:' && !u.hostname.includes('localhost') && !u.hostname.includes('127.0.0.1')) {
          errors.baseUrl = 'URL gốc phải sử dụng giao thức bảo mật HTTPS (https://...).';
        }
      } catch {
        errors.baseUrl = 'URL gốc không đúng định dạng URL hợp lệ.';
      }
    }
  }

  if (input.emailFromAddress !== undefined) {
    const rawEmail = (input.emailFromAddress || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!rawEmail || !emailRegex.test(rawEmail)) {
      errors.emailFromAddress = 'Địa chỉ email người gửi không đúng định dạng email hợp lệ.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Retrieve branding configuration with fallback to default
 */
export async function getBrandingConfig(db?: any): Promise<BrandingConfig> {
  const now = Date.now();
  if (_cachedBranding && now - _cachedBranding.timestamp < CACHE_TTL_MS) {
    return _cachedBranding.config;
  }

  if (!db) {
    return DEFAULT_BRANDING_CONFIG;
  }

  try {
    const row = await db.prepare(
      'SELECT value FROM system_settings WHERE key = ? LIMIT 1'
    ).bind(BRANDING_SETTINGS_KEY).first<any>().catch(() => null);

    if (row && row.value) {
      const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      const merged: BrandingConfig = {
        ...DEFAULT_BRANDING_CONFIG,
        ...parsed,
        faqList: Array.isArray(parsed.faqList) && parsed.faqList.length > 0
          ? parsed.faqList
          : DEFAULT_BRANDING_CONFIG.faqList,
      };
      _cachedBranding = { config: merged, timestamp: now };
      return merged;
    }
  } catch (err) {
    console.warn('[BrandingService] Error loading branding config from D1:', err);
  }

  return DEFAULT_BRANDING_CONFIG;
}

/**
 * Save or update branding configuration
 */
export async function saveBrandingConfig(
  db: any,
  update: Partial<BrandingConfig>,
  actorName: string = 'admin'
): Promise<BrandingConfig> {
  const current = await getBrandingConfig(db);
  const nowIso = new Date().toISOString();

  // Clean baseUrl (remove trailing slash)
  let cleanBaseUrl = update.baseUrl !== undefined ? update.baseUrl.trim().replace(/\/+$/, '') : current.baseUrl;

  const merged: BrandingConfig = {
    ...current,
    ...update,
    baseUrl: cleanBaseUrl,
    updated_at: nowIso,
    updated_by: actorName,
  };

  const strVal = JSON.stringify(merged);

  if (db) {
    await db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).bind(BRANDING_SETTINGS_KEY, strVal, nowIso).run();

    // Đồng bộ ngược sang wcg_email_provider_config_v1 nếu có emailFromName/emailFromAddress
    try {
      const emailRow = await db.prepare(
        'SELECT value FROM system_settings WHERE key = ? LIMIT 1'
      ).bind('wcg_email_provider_config_v1').first<any>().catch(() => null);

      if (emailRow && emailRow.value) {
        const parsedEmail = JSON.parse(emailRow.value);
        parsedEmail.senderEmail = merged.emailFromAddress;
        parsedEmail.senderName = merged.emailFromName;
        await db.prepare(`
          INSERT INTO system_settings (key, value, updated_at)
          VALUES ('wcg_email_provider_config_v1', ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).bind(JSON.stringify(parsedEmail), nowIso).run();
      }
    } catch (e) {
      console.warn('[BrandingService] Failed to sync email provider config:', e);
    }
  }

  invalidateBrandingCache();
  _cachedBranding = { config: merged, timestamp: Date.now() };
  return merged;
}

/**
 * Bulk replacement helper for news articles, codes, and CMS content
 */
export async function bulkReplaceBrandAndDomain(
  db: any,
  params: {
    oldDomain: string;
    newDomain: string;
    oldBrand: string;
    newBrand: string;
  }
): Promise<{
  success: boolean;
  affected: {
    newsArticles: number;
    codesCustom: number;
    codesFreeV5: number;
    codesTable: number;
    contentItems: number;
  };
}> {
  const result = {
    newsArticles: 0,
    codesCustom: 0,
    codesFreeV5: 0,
    codesTable: 0,
    contentItems: 0,
  };

  if (!db) {
    return { success: false, affected: result };
  }

  const { oldDomain, newDomain, oldBrand, newBrand } = params;
  if (!oldDomain && !oldBrand) {
    return { success: false, affected: result };
  }

  const cleanOldDomain = oldDomain ? oldDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '') : '';
  const cleanNewDomain = newDomain ? newDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '') : '';

  const replaceStrings = (text: string): string => {
    if (!text || typeof text !== 'string') return text;
    let res = text;
    if (cleanOldDomain && cleanNewDomain && cleanOldDomain !== cleanNewDomain) {
      // Replace https://oldDomain with https://newDomain
      res = res.split(`https://${cleanOldDomain}`).join(`https://${cleanNewDomain}`);
      res = res.split(`http://${cleanOldDomain}`).join(`https://${cleanNewDomain}`);
      // Replace naked oldDomain with newDomain
      res = res.split(cleanOldDomain).join(cleanNewDomain);
    }
    if (oldBrand && newBrand && oldBrand !== newBrand) {
      res = res.split(oldBrand).join(newBrand);
    }
    return res;
  };

  // 1. Update news articles in wcg_news_articles_v1
  try {
    const newsRow = await db.prepare(
      "SELECT value FROM system_settings WHERE key = 'wcg_news_articles_v1' LIMIT 1"
    ).first<any>().catch(() => null);

    if (newsRow && newsRow.value) {
      const articles = JSON.parse(newsRow.value);
      let changed = 0;
      if (Array.isArray(articles)) {
        for (const item of articles) {
          const orig = JSON.stringify(item);
          if (item.author) item.author = replaceStrings(item.author);
          if (item.source_url) item.source_url = replaceStrings(item.source_url);
          if (item.title) item.title = replaceStrings(item.title);
          if (item.excerpt) item.excerpt = replaceStrings(item.excerpt);
          if (item.content) item.content = replaceStrings(item.content);
          if (JSON.stringify(item) !== orig) changed++;
        }
        if (changed > 0) {
          const nowIso = new Date().toISOString();
          await db.prepare(`
            UPDATE system_settings SET value = ?, updated_at = ? WHERE key = 'wcg_news_articles_v1'
          `).bind(JSON.stringify(articles), nowIso).run();
          result.newsArticles = changed;

          // Sync wcg_master_state_v1 if present
          try {
            const masterRow = await db.prepare(
              "SELECT value FROM system_settings WHERE key = 'wcg_master_state_v1' LIMIT 1"
            ).first<any>().catch(() => null);
            if (masterRow && masterRow.value) {
              const master = JSON.parse(masterRow.value);
              if (master.newsArticles) {
                master.newsArticles = articles;
                await db.prepare(`
                  UPDATE system_settings SET value = ?, updated_at = ? WHERE key = 'wcg_master_state_v1'
                `).bind(JSON.stringify(master), nowIso).run();
              }
            }
          } catch {}
        }
      }
    }
  } catch (e) {
    console.warn('[BrandingService] Error bulk replacing news articles:', e);
  }

  // 2. Update codes in wcg_admin_custom_free_codes_v1
  try {
    const customCodesRow = await db.prepare(
      "SELECT value FROM system_settings WHERE key = 'wcg_admin_custom_free_codes_v1' LIMIT 1"
    ).first<any>().catch(() => null);

    if (customCodesRow && customCodesRow.value) {
      const codes = JSON.parse(customCodesRow.value);
      let changed = 0;
      if (Array.isArray(codes)) {
        for (const c of codes) {
          const orig = JSON.stringify(c);
          if (c.source) c.source = replaceStrings(c.source);
          if (c.remarks) c.remarks = replaceStrings(c.remarks);
          if (JSON.stringify(c) !== orig) changed++;
        }
        if (changed > 0) {
          await db.prepare(`
            UPDATE system_settings SET value = ?, updated_at = ? WHERE key = 'wcg_admin_custom_free_codes_v1'
          `).bind(JSON.stringify(codes), new Date().toISOString()).run();
          result.codesCustom = changed;
        }
      }
    }
  } catch (e) {
    console.warn('[BrandingService] Error bulk replacing custom free codes:', e);
  }

  // 3. Update codes in wcg_admin_free_codes_v5
  try {
    const v5CodesRow = await db.prepare(
      "SELECT value FROM system_settings WHERE key = 'wcg_admin_free_codes_v5' LIMIT 1"
    ).first<any>().catch(() => null);

    if (v5CodesRow && v5CodesRow.value) {
      const codes = JSON.parse(v5CodesRow.value);
      let changed = 0;
      if (Array.isArray(codes)) {
        for (const c of codes) {
          const orig = JSON.stringify(c);
          if (c.source) c.source = replaceStrings(c.source);
          if (c.remarks) c.remarks = replaceStrings(c.remarks);
          if (JSON.stringify(c) !== orig) changed++;
        }
        if (changed > 0) {
          await db.prepare(`
            UPDATE system_settings SET value = ?, updated_at = ? WHERE key = 'wcg_admin_free_codes_v5'
          `).bind(JSON.stringify(codes), new Date().toISOString()).run();
          result.codesFreeV5 = changed;
        }
      }
    }
  } catch (e) {
    console.warn('[BrandingService] Error bulk replacing free codes v5:', e);
  }

  // 4. Update codes table (source column)
  try {
    if (cleanOldDomain && cleanNewDomain && cleanOldDomain !== cleanNewDomain) {
      const updateRes = await db.prepare(`
        UPDATE codes 
        SET source = REPLACE(source, ?, ?)
        WHERE source LIKE '%' || ? || '%'
      `).bind(cleanOldDomain, cleanNewDomain, cleanOldDomain).run();
      result.codesTable = updateRes?.meta?.changes || 0;
    }
  } catch (e) {
    console.warn('[BrandingService] Error bulk replacing codes table source:', e);
  }

  // 5. Update CMS content items in wcg_admin_content_v4
  try {
    const contentRow = await db.prepare(
      "SELECT value FROM system_settings WHERE key = 'wcg_admin_content_v4' LIMIT 1"
    ).first<any>().catch(() => null);

    if (contentRow && contentRow.value) {
      const contentList = JSON.parse(contentRow.value);
      let changed = 0;
      if (Array.isArray(contentList)) {
        for (const item of contentList) {
          const orig = JSON.stringify(item);
          if (item.key === 'website_branding' && oldBrand && newBrand) {
            item.title = replaceStrings(item.title);
          }
          if (item.key === 'footer_support') {
            if (item.extraData && item.extraData.brandTitle) {
              item.extraData.brandTitle = replaceStrings(item.extraData.brandTitle);
            }
          }
          if (item.key === 'announcement_banner') {
            item.title = replaceStrings(item.title);
          }
          if (item.key === 'floating_notification') {
            item.title = replaceStrings(item.title);
          }
          if (JSON.stringify(item) !== orig) changed++;
        }
        if (changed > 0) {
          await db.prepare(`
            UPDATE system_settings SET value = ?, updated_at = ? WHERE key = 'wcg_admin_content_v4'
          `).bind(JSON.stringify(contentList), new Date().toISOString()).run();
          result.contentItems = changed;
        }
      }
    }
  } catch (e) {
    console.warn('[BrandingService] Error bulk replacing content items:', e);
  }

  return { success: true, affected: result };
}
