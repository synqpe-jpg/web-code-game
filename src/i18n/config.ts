export type SupportedLanguage = 'vi' | 'en' | 'th' | 'zh' | 'ja' | 'ko' | 'id' | 'ms' | 'ph' | 'fr' | string;

export interface LanguageMeta {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isRtl?: boolean;
  status: 'active' | 'beta' | 'coming_soon';
}

export const DEFAULT_LANGUAGE: string = 'vi';

/**
 * Danh sách ngôn ngữ hệ thống.
 * Đợt 1 kích hoạt Tiếng Việt (vi) và Tiếng Anh (en).
 * Để kích hoạt thêm ngôn ngữ mới (ví dụ 'th'), chỉ cần thêm file locales/th.json
 * và đổi status thành 'active' tại đây mà không cần sửa bất kỳ component nào!
 */
export const AVAILABLE_LANGUAGES: LanguageMeta[] = [
  {
    code: 'vi',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    flag: '🇻🇳',
    status: 'active',
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    status: 'active',
  },
  // 8 Ngôn ngữ mở rộng đợt sau (sẵn sàng không sửa code)
  {
    code: 'th',
    name: 'Thai',
    nativeName: 'ไทย',
    flag: '🇹🇭',
    status: 'coming_soon',
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
    status: 'coming_soon',
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    status: 'coming_soon',
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    status: 'coming_soon',
  },
  {
    code: 'id',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    flag: '🇮🇩',
    status: 'coming_soon',
  },
  {
    code: 'ms',
    name: 'Malay',
    nativeName: 'Bahasa Melayu',
    flag: '🇲🇾',
    status: 'coming_soon',
  },
  {
    code: 'ph',
    name: 'Filipino',
    nativeName: 'Filipino',
    flag: '🇵🇭',
    status: 'coming_soon',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    status: 'coming_soon',
  },
];

export const ACTIVE_LANGUAGES = AVAILABLE_LANGUAGES.filter((l) => l.status === 'active');
