/**
 * Tiện ích tính toán Thứ Tự Hiển Thị (Display Order) và Số Người Canh (Subscribers)
 * Hỗ trợ sinh số ngẫu nhiên theo khoảng dao động cài đặt và tăng trưởng theo thời gian thực tế.
 */

export interface GrowthGameItem {
  displayOrder?: number;
  orderGrowthEnabled?: boolean;
  orderGrowthRate?: number; // Thay đổi thứ tự hiển thị mỗi ngày (+1, +2...)
  orderMinRange?: number;
  orderMaxRange?: number;

  subscribersCount?: number;
  subscribersGrowthEnabled?: boolean;
  subscribersGrowthRatePerHour?: number; // Số người canh tăng thêm mỗi giờ (+5, +10...)
  subscribersMinRange?: number;
  subscribersMaxRange?: number;

  growthAnchorTime?: string;
  createdAt?: string;
}

/**
 * Sinh số ngẫu nhiên nguyên trong khoảng [min, max] với bước nhảy step
 */
export function generateRandomInRange(min: number, max: number, step: number = 1): number {
  const validMin = Math.min(Number(min) || 1, Number(max) || 1);
  const validMax = Math.max(Number(min) || 1, Number(max) || 1);
  const raw = Math.floor(Math.random() * (validMax - validMin + 1)) + validMin;
  if (step > 1) {
    return Math.max(validMin, Math.min(validMax, Math.round(raw / step) * step));
  }
  return raw;
}

/**
 * Tính toán Thứ Tự Hiển Thị (Display Order) hiệu dụng theo thời gian thực
 */
export function calculateEffectiveOrder(game: GrowthGameItem, nowMs: number = Date.now()): number {
  const base = typeof game.displayOrder === 'number' ? game.displayOrder : 999;
  if (!game.orderGrowthEnabled || !game.orderGrowthRate) {
    return base;
  }
  const anchorStr = game.growthAnchorTime || game.createdAt;
  if (!anchorStr) return base;
  const anchorMs = new Date(anchorStr).getTime();
  if (isNaN(anchorMs) || nowMs <= anchorMs) return base;

  const elapsedDays = (nowMs - anchorMs) / (1000 * 60 * 60 * 24);
  const delta = Math.round(elapsedDays * game.orderGrowthRate);
  return Math.max(1, base + delta);
}

/**
 * Tính toán Số Người Canh / Quan Tâm (Subscribers Count) hiệu dụng theo thời gian thực
 */
export function calculateEffectiveSubscribers(game: GrowthGameItem, nowMs: number = Date.now()): number {
  const base = typeof game.subscribersCount === 'number' ? game.subscribersCount : 1200;
  if (!game.subscribersGrowthEnabled || !game.subscribersGrowthRatePerHour) {
    return base;
  }
  const anchorStr = game.growthAnchorTime || game.createdAt;
  if (!anchorStr) return base;
  const anchorMs = new Date(anchorStr).getTime();
  if (isNaN(anchorMs) || nowMs <= anchorMs) return base;

  const elapsedMinutes = (nowMs - anchorMs) / 60000;
  const ratePerMinute = game.subscribersGrowthRatePerHour / 60;
  const delta = Math.floor(elapsedMinutes * ratePerMinute);
  return Math.max(0, base + delta);
}
