import React, { useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useBranding } from '../../services/brandingService';

interface LanguageSeoHeadProps {
  title?: string;
  description?: string;
  path?: string;
}

export const LanguageSeoHead: React.FC<LanguageSeoHeadProps> = ({
  title,
  description,
  path = '',
}) => {
  const { language } = useLanguage();
  const branding = useBranding();
  const isEn = language === 'en';

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const brandDisplay = branding.brandDisplay || 'CodeGame.shop';
    // 1. Cập nhật document.title theo ngôn ngữ
    const defaultViTitle = branding.siteTitle || `${brandDisplay} - Kho Giftcode Game Mobile & Sàn TMĐT Đa Ngành #1 Việt Nam`;
    const defaultEnTitle = `${brandDisplay} - Latest Verified Game Giftcodes & Universal E-Commerce Platform`;
    const finalTitle = title || (isEn ? defaultEnTitle : defaultViTitle);
    document.title = finalTitle;

    // 2. Cập nhật meta description
    const defaultViDesc = branding.seoDescription || 'Tra cứu giftcode game mobile, webgame bản quyền chính hãng ABEI/G1 tại Việt Nam. Nền tảng thương mại điện tử đa ngành, thanh toán VietQR tự động 0s.';
    const defaultEnDesc = 'Discover and redeem 100% verified official game giftcodes in Vietnam. Multi-industry e-commerce store with instant 0s digital delivery.';
    const finalDesc = description || (isEn ? defaultEnDesc : defaultViDesc);

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', finalDesc);

    // 3. Quản lý thẻ hreflang và canonical
    const origin = window.location.origin;
    const cleanPath = path || window.location.pathname.replace(/^\/(?:vi|en)\//i, '/');

    const updateLinkTag = (rel: string, hreflang: string | null, href: string) => {
      const selector = hreflang
        ? `link[rel="${rel}"][hreflang="${hreflang}"]`
        : `link[rel="${rel}"]:not([hreflang])`;
      let el = document.querySelector(selector) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        if (hreflang) el.setAttribute('hreflang', hreflang);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    // Canonical
    const currentLangPath = isEn ? `/en${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}` : cleanPath;
    updateLinkTag('canonical', null, `${origin}${currentLangPath}`);

    // Hreflang alternates
    updateLinkTag('alternate', 'vi', `${origin}${cleanPath}`);
    updateLinkTag('alternate', 'en', `${origin}/en${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`);
    updateLinkTag('alternate', 'x-default', `${origin}${cleanPath}`);
  }, [language, isEn, title, description, path, branding]);

  return null;
};
