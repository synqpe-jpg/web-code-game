import React, { useState, useEffect } from 'react';
import type { NewsArticle } from '../types/game';

export const THEMATIC_NEWS_COVERS: Record<string, string> = {
  'board-game': '/news_covers/board-game-van-hoa-viet.webp',
  'nhan-luc': '/news_covers/nhan-luc-nganh-game.webp',
  'qua-tang': '/news_covers/qua-tang-giftcode-vip.webp',
  'thi-truong': '/news_covers/thi-truong-game-viet-nam.webp',
  'cktg': '/news_covers/cktg-2026-esports.webp',
  'apple-arcade': '/news_covers/apple-arcade-games.webp',
  'xbox': '/news_covers/xbox-games-collection.webp',
  'game-offline': '/news_covers/game-offline-hay.webp',
  'xac-thuc': '/news_covers/xac-thuc-tai-khoan-game.webp',
  'blv': '/news_covers/blv-esports-viet-nam.webp',
};

/**
 * Phân tích tiêu đề, slug và tên game để gán ảnh bìa chuyên đề chuẩn xác nhất
 */
export const resolveTopicCoverByKeywords = (title = '', slug = '', gameName = ''): string | null => {
  const text = `${title} ${slug} ${gameName}`.toLowerCase();

  // 1. Nhân lực / giáo dục / lịch sử / sinh viên
  if (text.includes('nhân lực') || text.includes('giáo dục') || text.includes('đào tạo') || (text.includes('sinh viên') && text.includes('nhân lực'))) {
    return THEMATIC_NEWS_COVERS['nhan-luc'];
  }

  // 2. Board game / văn hóa / du lịch
  if (text.includes('board game') || text.includes('du lịch') || text.includes('văn hóa việt')) {
    return THEMATIC_NEWS_COVERS['board-game'];
  }

  // 3. Quà tặng / Giftcode VIP / Tân thủ
  if (text.includes('quà tặng vip') || text.includes('quà tặng tân thủ') || text.includes('tổng hợp trọn bộ giftcode') || text.includes('quà tặng')) {
    return THEMATIC_NEWS_COVERS['qua-tang'];
  }

  // 4. Thị trường game / Doanh thu / Sức hút
  if (text.includes('thị trường') || text.includes('doanh thu') || text.includes('sức hút')) {
    return THEMATIC_NEWS_COVERS['thi-truong'];
  }

  // 5. Apple Arcade / iOS
  if (text.includes('apple arcade') || text.includes('ios arcade')) {
    return THEMATIC_NEWS_COVERS['apple-arcade'];
  }

  // 6. Xbox / Microsoft / Console
  if (text.includes('xbox') || text.includes('microsoft')) {
    return THEMATIC_NEWS_COVERS['xbox'];
  }

  // 7. Game Offline không mạng
  if (text.includes('offline') || text.includes('không mạng')) {
    return THEMATIC_NEWS_COVERS['game-offline'];
  }

  // 8. Xác thực tài khoản / Căn cước / Nghị định
  if (text.includes('xác thực') || text.includes('định danh') || text.includes('60 triệu') || text.includes('nghị định')) {
    return THEMATIC_NEWS_COVERS['xac-thuc'];
  }

  // 9. Bình luận viên / Caster Esports
  if (text.includes('bình luận viên') || text.includes('blv')) {
    return THEMATIC_NEWS_COVERS['blv'];
  }

  // 10. Esports / CKTG / Giải đấu / LMHT LoL
  if (text.includes('cktg') || text.includes('esports') || text.includes('karmine') || text.includes('furia') || text.includes('liquipedia') || text.includes('lol esports')) {
    return THEMATIC_NEWS_COVERS['cktg'];
  }

  return null;
};

/**
 * Trích xuất ảnh bìa tối ưu nhất cho bài viết từ dữ liệu
 * Tuân thủ nghiêm ngặt: Giữ nguyên cover_url từ dữ liệu, không tự ý đổi sang ảnh chung
 */
export const resolveArticleCover = (article: NewsArticle): string => {
  const raw = (article.cover_url || article.cover_image || '').trim();

  // 1. Đã là ảnh bìa chuyên đề nội bộ /news_covers/ -> Sử dụng ngay
  if (raw.startsWith('/news_covers/')) {
    return raw;
  }

  // 2. Giữ nguyên 100% cover_url từ dữ liệu (kể cả link CDN, link ngoài hay icon)
  if (raw && raw !== '/og-image.jpg') {
    return raw;
  }

  // 3. Nếu là tựa game cụ thể có slug chuẩn -> Sử dụng icon game
  if (article.game_slug && article.game_slug.length < 32 && !article.game_slug.includes('sinh-vien') && !article.game_slug.includes('chuan-bi') && !article.game_slug.includes('suc-hut')) {
    return `/game_icons/${article.game_slug}.webp`;
  }

  // 4. Phân tích chủ đề theo từ khóa bài viết khi bài viết hoàn toàn không có cover_url
  const topicCover = resolveTopicCoverByKeywords(article.title, article.slug, article.game_name);
  if (topicCover) {
    return topicCover;
  }

  // 5. Thư viện ảnh nếu có
  if (article.gallery_urls && article.gallery_urls.length > 0 && article.gallery_urls[0] && !article.gallery_urls[0].startsWith('http')) {
    return article.gallery_urls[0];
  }

  // 6. Tuyệt đối KHÔNG trả về ảnh neon /news_covers/thi-truong-game-viet-nam.webp làm fallback chung
  return '';
};

/**
 * Nhận diện xem ảnh bìa là Icon game vuông đơn lẻ hay Artwork phong cảnh chữ nhật
 */
export const isOnlyIconUrl = (url: string): boolean => {
  if (!url) return false;
  if (url.includes('/news_covers/')) return false;
  return url.includes('/game_icons/');
};

/**
 * Component hiển thị ảnh bìa tin tức chống nháy hình (Zero-Flicker Safe News Cover)
 * - Quản lý URL qua React state, bảo toàn 100% cover_url trong suốt phiên xem trang
 * - Tuân thủ: Khi ảnh lỗi, chuyển sang placeholder trung tính, TUYỆT ĐỐI KHÔNG đổi src sang ảnh chung
 */
export const SafeNewsCover: React.FC<{
  article: NewsArticle;
  className?: string;
  isHero?: boolean;
}> = ({ article, className = '', isHero = false }) => {
  const [src, setSrc] = useState<string>(() => resolveArticleCover(article));
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    setSrc(resolveArticleCover(article));
    setHasError(false);
  }, [article.id, article.cover_url, article.cover_image, article.game_slug, article.title]);

  const handleError = () => {
    // Đánh dấu ảnh lỗi. Tuyệt đối không thay đổi thuộc tính src sang ảnh neon hay ảnh bài khác!
    if (!hasError) {
      setHasError(true);
    }
  };

  const isIcon = isOnlyIconUrl(src);

  if (isIcon) {
    return (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-900">
        {hasError ? (
          <div className="relative z-10 flex flex-col items-center justify-center p-4 select-none">
            <img
              src={src}
              alt={article.title}
              className="hidden"
              referrerPolicy="no-referrer"
            />
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-400 shadow-inner">
              <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <span className="text-[11px] font-medium text-slate-400 mt-2 line-clamp-1 max-w-[120px] text-center">{article.game_name || article.title}</span>
          </div>
        ) : (
          <>
            {/* Ambient blurred backdrop phát sáng màu game */}
            <div
              className="absolute inset-0 bg-cover bg-center blur-2xl opacity-60 scale-150 pointer-events-none transition-transform duration-700"
              style={{ backgroundImage: `url(${src})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent pointer-events-none" />

            {/* Icon game sắc nét nổi bật ở trung tâm */}
            <div className="relative z-10 flex flex-col items-center justify-center p-4">
              <div className="relative group-hover:scale-110 transition-transform duration-300">
                <img
                  src={src}
                  alt={article.title}
                  className={`${
                    isHero ? 'w-24 h-24 sm:w-28 sm:h-28' : 'w-20 h-20 sm:w-24 sm:h-24'
                  } rounded-2xl object-cover shadow-2xl ring-2 ring-white/30 group-hover:ring-primary/80`}
                  loading={isHero ? 'eager' : 'lazy'}
                  referrerPolicy="no-referrer"
                  onError={handleError}
                />
                <div className="absolute -bottom-2 inset-x-0 mx-auto w-12 h-2 bg-black/60 rounded-full blur-sm" />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 flex items-center justify-center">
      {hasError || !src ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/90 text-slate-400 p-4 select-none">
          {/* Bảo toàn thẻ img với src gốc trong DOM theo đúng kiểm chứng */}
          {src && (
            <img
              src={src}
              alt={article.title}
              className="hidden"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center mb-2 text-slate-400 shadow-inner">
            <svg className="w-6 h-6 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <span className="text-xs font-medium text-slate-400 line-clamp-1 max-w-[85%] text-center">{article.title}</span>
        </div>
      ) : (
        <>
          <img
            src={src}
            alt={article.title}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${className}`}
            loading={isHero ? 'eager' : 'lazy'}
            referrerPolicy="no-referrer"
            onError={handleError}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent pointer-events-none" />
        </>
      )}
    </div>
  );
};
