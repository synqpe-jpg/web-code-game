import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!article || typeof document === 'undefined') return null;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    onShowToast(`Đã sao chép mã code!`, code, 'success');
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2000);
  };

  const handleShare = async () => {
    const origin = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
      ? window.location.origin
      : 'https://codegame.shop';
    const url = `${origin}/news/${article.slug}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.excerpt || article.title,
          url: url,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      onShowToast('Đã sao chép liên kết bài viết!', url, 'success');
    }
  };

  const relatedArticles = allArticles
    .filter((a) => a.id !== article.id && (a.game_slug === article.game_slug || a.tags?.some((t) => article.tags?.includes(t))))
    .slice(0, 3);

  const formattedDate = new Date(article.published_at).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-hidden animate-fade-in select-none"
      onClick={onClose}
    >
      {/* Modal Container */}
      <div
        className="relative w-full max-w-4xl h-[92dvh] sm:h-auto sm:max-h-[90vh] flex flex-col bg-card border-t sm:border border-border/90 rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden animate-scale-in select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Sheet Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-600/60 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Sticky Header with Title, Share & Prominent Red/Rose Close Button */}
        <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 sm:px-6 sm:py-3.5 bg-card/95 backdrop-blur-md shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            {article.game_name && (
              <div className="flex items-center gap-1.5 min-w-0">
                {article.game_slug && (
                  <img
                    src={`/game_icons/${article.game_slug}.webp`}
                    alt={article.game_name}
                    className="w-5 h-5 rounded-md object-cover border border-border/80 shrink-0 hidden sm:block"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/20 text-primary-light border border-primary/30 truncate max-w-[170px] sm:max-w-xs shrink-0">
                  {article.game_name}
                </span>
              </div>
            )}
            <span className="text-xs text-muted-foreground truncate hidden md:inline">
              {article.author || 'CodeGame Editorial'} • {formattedDate}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleShare}
              className="p-2 sm:px-3 sm:py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0 active:scale-95 shadow-sm"
              title="Chia sẻ liên kết bài viết"
            >
              <Share2 className="w-4 h-4 text-primary-light" />
              <span className="hidden sm:inline">Chia sẻ</span>
            </button>

            {/* Dấu X Đóng Rõ Ràng Cho Mọi Thiết Bị */}
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 hover:border-rose-600 shadow-md transition-all active:scale-95 cursor-pointer font-bold text-xs shrink-0 group"
              title="Đóng bản tin (Phím Esc hoặc bấm ra ngoài màn hình)"
              aria-label="Đóng bản tin"
            >
              <X className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-rose-400 group-hover:text-white transition-colors stroke-[2.5]" />
              <span className="font-black tracking-tight">Đóng</span>
              <span className="hidden sm:inline-block px-1 py-0.2 rounded text-[10px] bg-black/40 text-rose-200 border border-rose-500/30 font-mono">
                Esc
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 sm:px-8 space-y-6">
          {/* Article Header & Cover */}
          <div className="space-y-4">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground pb-1">
              <span className="hover:text-primary transition-colors cursor-pointer" onClick={onClose}>
                Trang Chủ
              </span>
              <span>/</span>
              <span className="hover:text-primary transition-colors cursor-pointer" onClick={onClose}>
                Tin Tức Game
              </span>
              <span>/</span>
              <span className="text-foreground font-semibold truncate max-w-[200px] sm:max-w-md">
                {article.title}
              </span>
            </div>

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

            {/* Cover Image Banner */}
            {(() => {
              const rawCover = (article.cover_url || '').trim();
              const modalCover = (rawCover && rawCover !== '/og-image.jpg')
                ? rawCover
                : (article.game_slug ? `/game_icons/${article.game_slug}.webp` : (article.gallery_urls?.[0] || '/og-image.jpg'));
              const isGameIcon = Boolean(
                modalCover !== '/og-image.jpg' && (
                  modalCover.includes('/game_icons/') || 
                  (article.game_slug && modalCover.includes(article.game_slug))
                )
              );
              return (
                <div className="relative w-full aspect-video sm:aspect-[21/9] rounded-2xl overflow-hidden border border-border/80 shadow-md bg-slate-950 flex items-center justify-center">
                  {/* Ambient blur backdrop */}
                  <div
                    className="absolute inset-0 bg-cover bg-center blur-2xl opacity-40 scale-125 pointer-events-none"
                    style={{ backgroundImage: `url(${modalCover})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent pointer-events-none" />

                  {isGameIcon ? (
                    <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center p-6 gap-4 text-center sm:text-left">
                      <img
                        src={modalCover}
                        alt={article.title}
                        className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl object-cover shadow-2xl ring-4 ring-white/20 shrink-0"
                        loading="eager"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.onerror = null;
                          if (article.game_slug && !el.src.includes(`/game_icons/${article.game_slug}.webp`)) {
                            el.src = `/game_icons/${article.game_slug}.webp`;
                          } else if (article.gallery_urls && article.gallery_urls.length > 0 && !el.src.includes(article.gallery_urls[0])) {
                            el.src = article.gallery_urls[0];
                          } else {
                            el.src = '/og-image.jpg';
                          }
                        }}
                      />
                      {article.game_name && (
                        <div className="space-y-1">
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-primary text-white uppercase tracking-wider inline-block shadow-md">
                            {article.game_name}
                          </span>
                          <p className="text-white font-bold text-sm sm:text-lg drop-shadow">
                            Cẩm Nang & Trọn Bộ Giftcode Mới Nhất
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <img
                      src={optimizeImageUrl(modalCover, 1200)}
                      alt={article.title}
                      className="relative z-10 w-full h-full object-cover"
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.onerror = null;
                        if (article.game_slug && !el.src.includes(`/game_icons/${article.game_slug}.webp`)) {
                          el.src = `/game_icons/${article.game_slug}.webp`;
                        } else if (article.gallery_urls && article.gallery_urls.length > 0 && !el.src.includes(article.gallery_urls[0])) {
                          el.src = article.gallery_urls[0];
                        } else {
                          el.src = '/og-image.jpg';
                        }
                      }}
                    />
                  )}
                </div>
              );
            })()}

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
                      referrerPolicy="no-referrer"
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
                      {(() => {
                        const rawRel = (rel.cover_url || '').trim();
                        const relCover = (rawRel && rawRel !== '/og-image.jpg')
                          ? rawRel
                          : (rel.game_slug ? `/game_icons/${rel.game_slug}.webp` : (rel.gallery_urls?.[0] || '/og-image.jpg'));
                        const isRelGameIcon = Boolean(
                          relCover !== '/og-image.jpg' && (
                            relCover.includes('/game_icons/') || 
                            (rel.game_slug && relCover.includes(rel.game_slug))
                          )
                        );
                        return (
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-2 bg-slate-950 flex items-center justify-center">
                            <div
                              className="absolute inset-0 bg-cover bg-center blur-lg opacity-30 pointer-events-none"
                              style={{ backgroundImage: `url(${relCover})` }}
                            />
                            {isRelGameIcon ? (
                              <img
                                src={relCover}
                                alt={rel.title}
                                className="relative z-10 w-12 h-12 rounded-xl object-cover shadow-md ring-1 ring-white/20 group-hover:scale-105 transition-transform"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const el = e.currentTarget;
                                  el.onerror = null;
                                  if (rel.game_slug && !el.src.includes(`/game_icons/${rel.game_slug}.webp`)) {
                                    el.src = `/game_icons/${rel.game_slug}.webp`;
                                  } else {
                                    el.src = '/og-image.jpg';
                                  }
                                }}
                              />
                            ) : (
                              <img
                                src={relCover}
                                alt={rel.title}
                                className="relative z-10 w-full h-full object-cover group-hover:scale-105 transition-transform"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const el = e.currentTarget;
                                  el.onerror = null;
                                  if (rel.game_slug && !el.src.includes(`/game_icons/${rel.game_slug}.webp`)) {
                                    el.src = `/game_icons/${rel.game_slug}.webp`;
                                  } else {
                                    el.src = '/og-image.jpg';
                                  }
                                }}
                              />
                            )}
                          </div>
                        );
                      })()}
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

          {/* Bottom Close Bar & Actions */}
          <div className="pt-6 pb-2 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>Bản quyền nội dung: CodeGame.shop</span>
              <span>•</span>
              <span>Cập nhật: {formattedDate}</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <Share2 className="w-4 h-4 text-primary-light" />
                <span>Chia sẻ link</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/25 transition-all active:scale-95 cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
                <span>Đóng Bản Tin</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
