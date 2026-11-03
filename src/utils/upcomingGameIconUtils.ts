import React from 'react';

/**
 * Trả về URL icon tối ưu cho Game Sắp Ra Mắt:
 * 1. Nếu là đường dẫn nội bộ (/game_icons/...) hoặc Data URL: Trả về trực tiếp.
 * 2. Nếu là URL ngoài (http:// hoặc https://): Tự động định tuyến qua Edge Proxy
 *    `/api/game-icon?slug=...&url=...` để đảm bảo Cloudflare Edge phân phối 100%,
 *    chống chặn Referrer/Adblock/CORS và tối ưu tốc độ tải.
 * 3. Nếu chưa có icon: Fallback về file nội bộ `/game_icons/${slug}.webp`.
 */
export function getUpcomingGameIconUrl(
  game: { slug?: string; id?: string; iconUrl?: string; icon_url?: string } | null | undefined
): string {
  if (!game) return '';
  const raw = (game.iconUrl || game.icon_url || '').trim();
  const slug = (game.slug || game.id || '').trim();

  if (!raw) {
    return '';
  }

  // Nếu là URL ngoài (Apple mzstatic, Google Play, CDN...), định tuyến qua Edge Proxy để an toàn 100%
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    // Tránh encode lặp lại nếu URL đã là /api/game-icon
    if (raw.includes('/api/game-icon?')) {
      return raw;
    }
    return `/api/game-icon?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(raw)}`;
  }

  // Đường dẫn nội bộ tuyệt đối hoặc data:image
  if (raw.startsWith('/') || raw.startsWith('data:image/')) {
    return raw;
  }

  // Tên file ảnh (vd: strinova.webp)
  return `/game_icons/${raw}`;
}

/**
 * Bộ xử lý lỗi ảnh phân tầng (Multi-Stage Image Error Fallback Handler):
 * Tuyệt đối không tự gán logo chung /og-image.jpg hay logo giả lập làm đại diện game.
 * Nếu ảnh không tải được, chuyển sang ẩn ảnh để lộ khung placeholder chuẩn mực.
 */
export function handleUpcomingImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  game: { slug?: string; id?: string; iconUrl?: string; icon_url?: string } | null | undefined
): void {
  const target = e.target as HTMLImageElement;
  const stage = parseInt(target.getAttribute('data-error-stage') || '0', 10);
  const raw = (game?.iconUrl || game?.icon_url || '').trim();
  const slug = (game?.slug || game?.id || '').trim();

  if (stage === 0) {
    target.setAttribute('data-error-stage', '1');
    // Nếu vừa thử qua Edge Proxy mà lỗi, thử tải trực tiếp link gốc không qua proxy
    if (raw.startsWith('http') && target.src.includes('/api/game-icon')) {
      target.src = raw;
      return;
    }
    // Nếu vừa thử link gốc trực tiếp mà lỗi, thử qua Edge Proxy
    if (raw.startsWith('http') && !target.src.includes('/api/game-icon')) {
      target.src = `/api/game-icon?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(raw)}`;
      return;
    }
    // Nếu là file local mà lỗi (404), ẩn ảnh
    target.style.display = 'none';
  } else {
    target.style.display = 'none';
  }
}
