export type FloatingNotificationPosition =
  | 'center_modal'
  | 'bottom_right'
  | 'bottom_left'
  | 'top_bar'
  | 'bottom_bar';

export type FloatingNotificationFrequency =
  | 'always'
  | 'once_session'
  | 'once_day';

export type FloatingNotificationTheme =
  | 'cyber'
  | 'gold'
  | 'emerald'
  | 'crimson';

export type FloatingNotificationIconType =
  | 'gift'
  | 'bell'
  | 'flame'
  | 'sparkles'
  | 'star'
  | 'shield'
  | 'custom';

export interface FloatingNotificationConfig {
  id?: string;
  enabled: boolean;
  title: string;
  message: string;
  iconType: FloatingNotificationIconType;
  customIconUrl?: string;
  position: FloatingNotificationPosition;

  // Khung giờ hiển thị trong ngày
  scheduleMode: 'all_day' | 'time_range';
  startTime: string; // VD: "08:00"
  endTime: string;   // VD: "23:00"

  // Nút hành động chính (CTA)
  showCta: boolean;
  ctaText: string;
  ctaLink: string;
  ctaTargetBlank: boolean;

  // Nút phụ / Đóng
  showSecondaryButton: boolean;
  secondaryButtonText: string;

  // Trải nghiệm & Tần suất
  frequency: FloatingNotificationFrequency;
  delaySeconds: number;        // Số giây trễ sau khi vào trang (0 - 30s)
  autoDismissSeconds: number;  // Tự động đóng sau X giây (0 = không tự đóng)
  theme: FloatingNotificationTheme;
  targetPages: 'all' | 'home_only';

  // Tùy chọn người dùng
  showDoNotShowAgain: boolean;

  updatedAt?: string;
}

export const DEFAULT_FLOATING_NOTIFICATION: FloatingNotificationConfig = {
  enabled: true,
  title: '🎁 Chào Mừng Đến Với CodeGame.Shop',
  message: 'Cập nhật hàng ngàn Giftcode VIP và mã bản quyền chính hãng mỗi ngày. Chia sẻ trang để mọi người cùng biết nhé.',
  iconType: 'gift',
  position: 'center_modal',
  scheduleMode: 'all_day',
  startTime: '08:00',
  endTime: '23:00',
  showCta: true,
  ctaText: 'Khám Phá Giftcode',
  ctaLink: '#game-catalog-section',
  ctaTargetBlank: false,
  showSecondaryButton: true,
  secondaryButtonText: 'Để sau',
  frequency: 'once_session',
  delaySeconds: 2,
  autoDismissSeconds: 0,
  theme: 'cyber',
  targetPages: 'all',
  showDoNotShowAgain: true,
  updatedAt: new Date().toISOString(),
};
