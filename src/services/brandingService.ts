import { useState, useEffect } from 'react';

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

const STORAGE_KEY = 'wcg_branding_client_cache_v1';

// Initial state hydrated from localStorage if available
function getInitialBranding(): BrandingConfig {
  if (typeof window === 'undefined') return DEFAULT_BRANDING_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_BRANDING_CONFIG,
        ...parsed,
        faqList: Array.isArray(parsed.faqList) && parsed.faqList.length > 0 ? parsed.faqList : DEFAULT_BRANDING_CONFIG.faqList,
      };
    }
  } catch {}
  return DEFAULT_BRANDING_CONFIG;
}

let _currentBranding: BrandingConfig = getInitialBranding();
const _listeners = new Set<(config: BrandingConfig) => void>();

function notifyListeners() {
  _listeners.forEach((listener) => {
    try {
      listener(_currentBranding);
    } catch {}
  });
}

/**
 * Fetch latest branding config from API
 */
export async function fetchBrandingConfig(): Promise<BrandingConfig> {
  try {
    const res = await fetch('/api/branding');
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.success && data.branding) {
        _currentBranding = {
          ...DEFAULT_BRANDING_CONFIG,
          ...data.branding,
          faqList: Array.isArray(data.branding.faqList) && data.branding.faqList.length > 0
            ? data.branding.faqList
            : DEFAULT_BRANDING_CONFIG.faqList,
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(_currentBranding));
        } catch {}
        notifyListeners();
        return _currentBranding;
      }
    }
  } catch (e) {
    console.warn('[BrandingService] Error fetching branding:', e);
  }
  return _currentBranding;
}

/**
 * Get current cached branding config synchronously
 */
export function getBranding(): BrandingConfig {
  return _currentBranding;
}

/**
 * Update locally cached branding (e.g. after admin save)
 */
export function setLocalBranding(newConfig: Partial<BrandingConfig>): BrandingConfig {
  _currentBranding = {
    ..._currentBranding,
    ...newConfig,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_currentBranding));
  } catch {}
  notifyListeners();
  return _currentBranding;
}

/**
 * React hook for consuming branding config with real-time updates
 */
export function useBranding(): BrandingConfig {
  const [branding, setBranding] = useState<BrandingConfig>(_currentBranding);

  useEffect(() => {
    setBranding(_currentBranding);
    const listener = (updated: BrandingConfig) => setBranding(updated);
    _listeners.add(listener);

    // Initial background fetch if not already loaded or on mount
    fetchBrandingConfig();

    return () => {
      _listeners.delete(listener);
    };
  }, []);

  return branding;
}

/**
 * Format copyright template
 */
export function formatCopyright(template: string | undefined, brandDisplay: string): string {
  const tpl = template || DEFAULT_BRANDING_CONFIG.footerCopyright;
  return tpl.replace(/\{brand\}/g, brandDisplay);
}
