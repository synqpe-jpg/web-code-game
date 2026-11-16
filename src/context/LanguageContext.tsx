import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import viLocale from '../locales/vi.json';
import enLocale from '../locales/en.json';
import thLocale from '../locales/th.json';
import {
  AVAILABLE_LANGUAGES,
  ACTIVE_LANGUAGES,
  DEFAULT_LANGUAGE,
  type LanguageMeta,
  type SupportedLanguage,
} from '../i18n/config';
import { formatCurrency, formatDateTime, formatNumber } from '../utils/formatUtils';

export type TranslationDict = typeof viLocale;

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  /**
   * Hàm dịch hỗ trợ cả 2 cách gọi:
   * 1. t('nav.catalog')
   * 2. t.nav.catalog
   */
  t: ((key: string, params?: Record<string, any>) => string) & TranslationDict;
  formatCurrency: (amount: number | null | undefined) => string;
  formatDateTime: (date: string | number | Date | null | undefined, options?: { showTimezone?: boolean; includeTime?: boolean }) => string;
  formatNumber: (num: number | null | undefined) => string;
  availableLanguages: LanguageMeta[];
  activeLanguages: LanguageMeta[];
  currentLanguageMeta: LanguageMeta;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const LANGUAGE_STORAGE_KEY = 'wcg_language';

// Từ điển ngôn ngữ nội bộ
const dictionaries: Record<string, any> = {
  vi: viLocale,
  en: enLocale,
  th: thLocale,
};

/**
 * Hàm tra cứu giá trị theo dot notation: "checkout.shippingSectionTitle"
 */
function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Thay thế biến: {name}, {count}
 */
function interpolate(template: string, params?: Record<string, any>): string {
  if (!params || !template) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match;
  });
}

/**
 * Phát hiện ngôn ngữ ban đầu theo thứ tự ưu tiên:
 * 1. Lựa chọn tay đã lưu trong localStorage (luôn thắng)
 * 2. Tiền tố URL (/en/ hoặc /vi/)
 * 3. Gợi ý từ trình duyệt (navigator.language)
 * 4. Mặc định là Tiếng Việt (vi)
 */
function detectInitialLanguage(): string {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  // 1. LocalStorage thắng mọi gợi ý
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && (saved === 'vi' || saved === 'en' || saved === 'th')) {
      return saved;
    }
  } catch {}

  // 2. URL Prefix
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/en/') || path === '/en') return 'en';
  if (path.startsWith('/th/') || path === '/th') return 'th';
  if (path.startsWith('/vi/') || path === '/vi') return 'vi';

  // 3. Browser language
  if (typeof navigator !== 'undefined' && navigator.language) {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('en')) return 'en';
  }

  return DEFAULT_LANGUAGE;
}

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<string>(detectInitialLanguage);

  const setLanguage = useCallback((newLang: string) => {
    const targetLang = newLang === 'en' ? 'en' : 'vi';
    setLanguageState(targetLang);

    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, targetLang);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = targetLang;
      }
      window.dispatchEvent(new CustomEvent('wcg_language_changed', { detail: targetLang }));
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY && e.newValue) {
        const nextLang = e.newValue === 'en' ? 'en' : 'vi';
        setLanguageState(nextLang);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [language]);

  // Lấy meta của ngôn ngữ hiện tại
  const currentLanguageMeta = useMemo(() => {
    return AVAILABLE_LANGUAGES.find((l) => l.code === language) || AVAILABLE_LANGUAGES[0];
  }, [language]);

  // Tạo hàm dịch đa năng t()
  const translateFn = useCallback(
    (key: string, params?: Record<string, any>): string => {
      const activeDict = dictionaries[language] || dictionaries.vi;
      // 1. Thử tìm trong ngôn ngữ hiện tại
      let val = getNestedValue(activeDict, key);

      // 2. Nếu thiếu, fallback về tiếng Việt
      if (!val && language !== 'vi') {
        val = getNestedValue(dictionaries.vi, key);
      }

      // 3. Nếu vẫn thiếu, format lại key sạch
      if (!val) {
        val = key.split('.').pop() || key;
      }

      return interpolate(val, params);
    },
    [language]
  );

  // Tạo Proxy để hỗ trợ cả t('path') và t.section.key
  const t = useMemo(() => {
    const currentDict = dictionaries[language] || dictionaries.vi;
    const fallbackDict = dictionaries.vi;

    const handler: ProxyHandler<any> = {
      get(target, prop, receiver) {
        if (typeof prop === 'string') {
          // Nếu truy cập thuộc tính như t.nav, t.header...
          const currentVal = currentDict[prop] !== undefined ? currentDict[prop] : fallbackDict[prop];
          if (currentVal !== undefined) {
            if (typeof currentVal === 'object' && currentVal !== null) {
              // Trả về proxy đệ quy cho object con
              return new Proxy(currentVal, {
                get(childTarget, childProp) {
                  if (typeof childProp === 'string') {
                    const childVal =
                      childTarget[childProp] !== undefined
                        ? childTarget[childProp]
                        : fallbackDict[prop]?.[childProp];
                    return childVal !== undefined ? childVal : childProp;
                  }
                  return Reflect.get(childTarget, childProp);
                },
              });
            }
            return currentVal;
          }
        }
        return Reflect.get(target, prop, receiver);
      },
      apply(target, thisArg, argArray) {
        const [key, params] = argArray;
        return translateFn(key, params);
      },
    };

    return new Proxy(translateFn, handler) as any;
  }, [language, translateFn]);

  // Helpers định dạng tiền tệ và ngày giờ gắn liền ngôn ngữ
  const handleFormatCurrency = useCallback(
    (amount: number | null | undefined) => formatCurrency(amount, language),
    [language]
  );

  const handleFormatDateTime = useCallback(
    (date: string | number | Date | null | undefined, options?: { showTimezone?: boolean; includeTime?: boolean }) =>
      formatDateTime(date, language, options),
    [language]
  );

  const handleFormatNumber = useCallback(
    (num: number | null | undefined) => formatNumber(num, language),
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      formatCurrency: handleFormatCurrency,
      formatDateTime: handleFormatDateTime,
      formatNumber: handleFormatNumber,
      availableLanguages: AVAILABLE_LANGUAGES,
      activeLanguages: ACTIVE_LANGUAGES,
      currentLanguageMeta,
    }),
    [
      language,
      setLanguage,
      t,
      handleFormatCurrency,
      handleFormatDateTime,
      handleFormatNumber,
      currentLanguageMeta,
    ]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback an toàn nếu render ngoài provider
    const fallbackTranslate = (key: string) => {
      const parts = key.split('.');
      let cur: any = viLocale;
      for (const p of parts) {
        if (cur && typeof cur === 'object') cur = cur[p];
      }
      return typeof cur === 'string' ? cur : key;
    };
    return {
      language: 'vi',
      setLanguage: () => {},
      t: fallbackTranslate as any,
      formatCurrency: (amount) => formatCurrency(amount, 'vi'),
      formatDateTime: (date, opt) => formatDateTime(date, 'vi', opt),
      formatNumber: (num) => formatNumber(num, 'vi'),
      availableLanguages: AVAILABLE_LANGUAGES,
      activeLanguages: ACTIVE_LANGUAGES,
      currentLanguageMeta: AVAILABLE_LANGUAGES[0],
    };
  }
  return context;
};
