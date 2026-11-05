/**
 * News Validation Service
 * Validates cover URLs, prevents title-derived fake icon paths, and blocks 404 broken covers.
 * Uses unified single-source-of-truth verification (D1 uploaded_game_icons + Edge Static Assets).
 */

import { inspectImageBytes } from './icon_verifier_service';

export const THEMATIC_NEWS_COVERS = [
  { path: '/news_covers/thi-truong-game-viet-nam.webp', label: 'Thị trường Game Việt Nam (Mặc định chuẩn)' },
  { path: '/news_covers/cktg-2026-esports.webp', label: 'Esports & CKTG 2026' },
  { path: '/news_covers/apple-arcade-games.webp', label: 'Apple Arcade & Mobile Games' },
  { path: '/news_covers/game-offline-hay.webp', label: 'Game Offline & Độc Lập' },
  { path: '/news_covers/qua-tang-giftcode-vip.webp', label: 'Sự Kiện & Giftcode VIP' },
  { path: '/news_covers/xac-thuc-tai-khoan-game.webp', label: 'Hướng Dẫn & Bảo Mật Tài Khoản' },
  { path: '/news_covers/nhan-luc-nganh-game.webp', label: 'Công Nghệ & Ngành Game' },
  { path: '/news_covers/blv-esports-viet-nam.webp', label: 'Cộng Đồng & Bình Luận Viên' },
  { path: '/news_covers/board-game-van-hoa-viet.webp', label: 'Board Game Văn Hóa Việt' },
  { path: '/news_covers/xbox-games-collection.webp', label: 'Xbox Games Collection' },
  { path: '/news_covers/volleyball-journey.webp', label: 'Volleyball Journey' },
  { path: '/news_covers/ride-storm.webp', label: 'Ride Storm' },
  { path: '/news_covers/only-sword.webp', label: 'Only Sword' },
  { path: '/news_covers/my-anime-mine.webp', label: 'My Anime Mine' },
  { path: '/news_covers/cameraman-tower-defense.webp', label: 'Cameraman Tower Defense' },
  { path: '/news_covers/build-a-golem.webp', label: 'Build A Golem' },
  { path: '/news_covers/24-hours-overnight.webp', label: '24 Hours Overnight' },
];

export const BANNED_COVER_PATTERNS = [
  /moi-va-huong-dan/i,
  /huong-dan-cach-nhap/i,
  /tong-hop-giftcode/i,
  /cam-nang/i,
  /tat-tan-tat/i,
  /bang-xep-hang/i,
  /danh-sach-code/i,
];

export const VALID_IMAGE_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png', '.svg', '.gif'];

/**
 * Kiểm tra sự tồn tại và tính hợp lệ thực tế của một ảnh nội bộ (Single Source of Truth)
 * Kiểm tra D1 uploaded_game_icons trước, sau đó tới Edge Static Assets.
 */
export async function verifyInternalImageExists(
  cleanPath: string,
  requestUrl?: string,
  assets?: { fetch: (req: Request) => Promise<Response> },
  db?: D1Database
): Promise<{ valid: boolean; error?: string }> {
  const pathOnly = cleanPath.split('?')[0];

  // 1. Nếu là đường dẫn icon game động (/game_icons/...)
  if (pathOnly.startsWith('/game_icons/')) {
    const filename = pathOnly.replace(/^\/game_icons\//, '').trim();
    const slug = filename.replace(/\.[a-z0-9]+$/i, '').toLowerCase().trim();

    // 1a. Tra cứu trực tiếp D1 bảng uploaded_game_icons
    if (db) {
      try {
        const row: any = await db.prepare(
          'SELECT slug, content_type, image_base64, size_bytes FROM uploaded_game_icons WHERE slug = ? LIMIT 1'
        ).bind(slug).first();

        if (row && row.image_base64) {
          // Kiểm tra magic bytes thực tế
          const cleanB64 = String(row.image_base64).replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
          const binaryStr = atob(cleanB64.slice(0, 128));
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const inspection = inspectImageBytes(bytes);
          if (!inspection.valid) {
            return {
              valid: false,
              error: `Tệp tại ${pathOnly} không phải là định dạng ảnh hợp lệ: ${inspection.error || 'Dữ liệu hỏng'}`,
            };
          }

          // Nếu đường dẫn yêu cầu .webp, kiểm tra đúng định dạng WebP
          if (pathOnly.toLowerCase().endsWith('.webp') && inspection.contentType !== 'image/webp') {
            return {
              valid: false,
              error: `Tệp tại ${pathOnly} không phải là định dạng WebP chuẩn (thực tế là ${inspection.contentType}).`,
            };
          }

          return { valid: true };
        }
      } catch (err: any) {
        console.warn('[NewsValidator] Lỗi tra cứu D1 uploaded_game_icons:', err?.message);
      }
    }
  }

  // 2. Tra cứu qua Edge Static Assets (public/)
  if (assets && typeof assets.fetch === 'function' && requestUrl) {
    try {
      const origin = new URL(requestUrl).origin;
      const checkReq = new Request(`${origin}${pathOnly}`, { method: 'HEAD' });
      const res = await assets.fetch(checkReq);
      if (res && res.status === 200) {
        return { valid: true };
      }
    } catch {
      // Bỏ qua lỗi kết nối nội bộ asset fetcher
    }
  }

  // Nếu cả D1 và Static Assets đều không có file
  return {
    valid: false,
    error: `Ảnh nội bộ không tồn tại trong kho ảnh hệ thống: ${pathOnly}`,
  };
}

export async function validateInternalCoverUrl(
  coverUrl: string | undefined | null,
  requestUrl?: string,
  assets?: { fetch: (req: Request) => Promise<Response> },
  db?: D1Database
): Promise<{ valid: boolean; error?: string }> {
  if (!coverUrl || !coverUrl.trim()) {
    // Empty cover_url is permitted; server will assign default
    return { valid: true };
  }

  const clean = coverUrl.trim();

  // 1. External URL validation
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      new URL(clean);
      return { valid: true };
    } catch {
      return { valid: false, error: 'Đường dẫn ảnh cover_url không phải URL hợp lệ' };
    }
  }

  // 2. Must start with '/'
  if (!clean.startsWith('/')) {
    return {
      valid: false,
      error: 'Đường dẫn ảnh nội bộ phải bắt đầu bằng dấu "/" (ví dụ /game_icons/... hoặc /news_covers/...)',
    };
  }

  // 3. Must have a valid image extension (Kiểm tra trên PATH_ONLY, bỏ qua query string ?v=...)
  const [pathOnly] = clean.split('?');
  const hasValidExt = VALID_IMAGE_EXTENSIONS.some((ext) => pathOnly.toLowerCase().endsWith(ext));
  if (!hasValidExt) {
    return {
      valid: false,
      error: 'Ảnh cover_url phải có phần mở rộng hợp lệ (.webp, .jpg, .jpeg, .png, .svg)',
    };
  }

  // 4. Ban cover_url derived from article title
  for (const pattern of BANNED_COVER_PATTERNS) {
    if (pattern.test(pathOnly)) {
      return {
        valid: false,
        error: `Đường dẫn ảnh bìa không hợp lệ (${pathOnly}): Nghi ngờ tự sinh từ tiêu đề bài viết. Chỉ được dùng icon game thật hoặc ảnh chuyên đề chuẩn trong /news_covers/.`,
      };
    }
  }

  // 5. Kiểm tra tệp ảnh tồn tại trong kho nội bộ (D1 + Edge Assets)
  return await verifyInternalImageExists(clean, requestUrl, assets, db);
}
