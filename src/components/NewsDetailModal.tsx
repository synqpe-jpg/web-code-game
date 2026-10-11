import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  Eye,
  Gift,
  Copy,
  Check,
  Share2,
  Gamepad2,
  Tag,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { NewsArticle, GameItem } from '../types/game';
import { newsService } from '../services/newsService';
import { optimizeImageUrl } from '../utils/imageCompressor';

interface NewsDetailModalProps {
  article: NewsArticle | null;
  onClose: () => void;
  onSelectGameSlug?: (slug: string) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onSelectArticle?: (article: NewsArticle) => void;
  allArticles?: NewsArticle[];
}

export const NewsDetailModal: React.FC<NewsDetailModalProps> = ({
  article,
  onClose,
  onSelectGameSlug,
  onShowToast,
  onSelectArticle,
  allArticles = [],
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!article) return null;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    onShowToast(`Đã sao chép mã code!`, code, 'success');
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2000);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/news/${article.slug}`;
    navigator.clipboard.writeText(url);
    onShowToast('Đã sao chép liên kết bài viết!', url, 'success');
  };

  const relatedArticles = allArticles
    .filter((a) => a.id !== article.id && (a.game_slug === article.game_slug || a.tags?.some((t) => article.tags?.includes(t))))
    .slice(0, 3);

  const formattedDate = new Date(article.published_at).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative my-2 sm:my-8 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-card shadow-2xl z-10 animate-scale-in">
        {/* Sticky Header with Title & Close */}
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 sm:px-6 sm:py-4 bg-card/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            {article.game_name && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/20 text-primary-light border border-primary/30 shrink-0">
                {article.game_name}
              </span>
            )}
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
              {article.author || 'CodeGame Editorial'} • {formattedDate}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-muted/60 transition-colors cursor-pointer"
              title="Chia sẻ bài viết"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-muted/60 transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 sm:px-8 space-y-6">
          {/* Article Header & Cover */}
          <div className="space-y-4">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-foreground leading-tight">
              {article.title}
            </h1>

            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary-light" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                {article.read_time_minutes || 3} phút đọc
              </span>
              {article.views !== undefined && (
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-teal-400" />
                  {article.views.toLocaleString()} lượt xem
                </span>
              )}
            </div>

            {/* Cover Image */}
            {article.cover_url && (
              <div className="relative w-full aspect-video sm:aspect-[21/9] rounded-2xl overflow-hidden border border-border/80 shadow-md">
                <img
                  src={optimizeImageUrl(article.cover_url, 1200)}
                  alt={article.title}
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
              </div>
            )}

            {/* Excerpt Lead */}
            {article.excerpt && (
              <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed italic border-l-4 border-primary pl-4 py-1 bg-primary/5 rounded-r-xl">
                {article.excerpt}
              </p>
            )}
          </div>

          {/* EMBEDDED GIFTCODE CARD WIDGET (Trọng tâm thu hút người chơi) */}
          {article.codes && article.codes.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-card to-amber-950/30 border border-primary/40 shadow-lg space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary-light flex items-center justify-center font-bold">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                      Giftcode Áp Dụng Cho Bản Cập Nhật Này
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-accent text-white font-bold animate-pulse">
                        HOT
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Bấm sao chép để nhận ngay quà tặng khởi đầu thuận lợi
                    </p>
                  </div>
                </div>

                {article.game_slug && onSelectGameSlug && (
                  <button
                    onClick={() => {
                      onClose();
                      onSelectGameSlug(article.game_slug!);
                    }}
                    className="hidden sm:flex items-center gap-1 text-xs font-bold text-primary-light hover:underline"
                  >
                    Xem tất cả code {article.game_name} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Codes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {article.codes.map((codeStr) => {
                  const isCopied = copiedCode === codeStr;
                  return (
                    <div
                      key={codeStr}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-primary/60 transition-all group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-mono font-black text-amber-300 text-sm tracking-wider select-all block truncate">
                          {codeStr}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-medium">
                          ✓ Đang hoạt động
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyCode(codeStr)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 ${
                          isCopied
                            ? 'bg-emerald-500 text-white shadow-glow-emerald'
                            : 'bg-primary hover:bg-primary-hover text-white shadow-sm'
                        }`}
                        title="Sao chép mã"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Sao chép</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {article.game_slug && onSelectGameSlug && (
                <div className="pt-1 text-center sm:hidden">
                  <button
                    onClick={() => {
                      onClose();
                      onSelectGameSlug(article.game_slug!);
                    }}
                    className="text-xs font-bold text-primary-light hover:underline"
                  >
                    Xem tất cả mã code {article.game_name} →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Formatted Content Body */}
          <div className="prose prose-invert max-w-none text-slate-300 text-sm sm:text-base leading-relaxed space-y-4">
            {article.content.split('\n\n').map((paragraph, index) => {
              const trimmed = paragraph.trim();
              if (trimmed.startsWith('## ')) {
                return (
                  <h2 key={index} className="text-lg sm:text-xl font-bold text-white pt-3 border-b border-border/40 pb-1.5">
                    {trimmed.replace('## ', '')}
                  </h2>
                );
              }
              if (trimmed.startsWith('### ')) {
                return (
                  <h3 key={index} className="text-base sm:text-lg font-bold text-primary-light pt-2">
                    {trimmed.replace('### ', '')}
                  </h3>
                );
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const listItems = trimmed.split('\n').filter(Boolean);
                return (
                  <ul key={index} className="list-disc pl-5 space-y-1">
                    {listItems.map((li, i) => (
                      <li key={i}>{li.replace(/^[-*]\s+/, '')}</li>
                    ))}
                  </ul>
                );
              }
              if (/^\d+\.\s/.test(trimmed)) {
                const listItems = trimmed.split('\n').filter(Boolean);
                return (
                  <ol key={index} className="list-decimal pl-5 space-y-1">
                    {listItems.map((li, i) => (
                      <li key={i}>{li.replace(/^\d+\.\s+/, '')}</li>
                    ))}
                  </ol>
                );
              }
              // Check image markdown syntax ![caption](url)
              const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
              if (imgMatch) {
                const alt = imgMatch[1];
                const src = imgMatch[2];
                return (
                  <figure key={index} className="my-5 text-center">
                    <img
                      src={optimizeImageUrl(src, 900)}
                      alt={alt}
                      className="w-full max-h-[520px] object-cover rounded-2xl border border-border/80 shadow-lg mx-auto"
                      loading="lazy"
                      decoding="async"
                    />
                    {alt && (
                      <figcaption className="text-xs text-muted-foreground italic mt-2">
                        {alt}
                      </figcaption>
                    )}
                  </figure>
                );
              }

              return <p key={index}>{trimmed}</p>;
            })}
          </div>

          {/* Gallery Images Collection */}
          {article.gallery_urls && article.gallery_urls.length > 0 && (
            <div className="pt-4 border-t border-border/60 space-y-3">
              <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Thư Viện Hình Ảnh Bản Cập Nhật ({article.gallery_urls.length})</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {article.gallery_urls.map((imgUrl, idx) => (
                  <a
                    key={idx}
                    href={imgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-video rounded-xl overflow-hidden border border-border/80 hover:border-primary/60 transition-all shadow-sm"
                  >
                    <img
                      src={optimizeImageUrl(imgUrl, 600)}
                      alt={`Ảnh ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                      Xem ảnh ↗
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Tags list */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-4 border-t border-border/60">
              <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
                <Tag className="w-3.5 h-3.5 text-primary-light" /> Từ khóa:
              </span>
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-muted/60 text-slate-300 border border-border/60 hover:text-white"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <div className="pt-6 border-t border-border/80 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Bài Viết Liên Quan Cùng Chủ Đề
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {relatedArticles.map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => {
                      if (onSelectArticle) onSelectArticle(rel);
                    }}
                    className="group p-3 rounded-xl bg-muted/40 hover:bg-muted/80 border border-border/60 hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {rel.cover_url && (
                        <div className="w-full aspect-video rounded-lg overflow-hidden mb-2 bg-slate-900">
                          <img
                            src={rel.cover_url}
                            alt={rel.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      )}
                      <h4 className="text-xs font-bold text-white line-clamp-2 group-hover:text-primary-light transition-colors">
                        {rel.title}
                      </h4>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-2 block">
                      {new Date(rel.published_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
