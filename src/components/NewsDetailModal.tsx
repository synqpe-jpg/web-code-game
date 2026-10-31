import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Tag,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  ListOrdered,
  Flame,
  ExternalLink,
} from 'lucide-react';
import type { NewsArticle, GameItem, UpcomingGame } from '../types/game';
import { newsService } from '../services/newsService';
import { marketingService } from '../services/marketingService';
import { dataService } from '../services/dataService';
import { optimizeImageUrl } from '../utils/imageCompressor';

export interface NewsDetailModalProps {
  article: NewsArticle | null;
  onClose: () => void;
  onSelectGameSlug?: (slug: string) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onSelectArticle?: (article: NewsArticle) => void;
  allArticles?: NewsArticle[];
}

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

interface ExtractedCode {
  code: string;
  reward?: string;
}

interface ParsedSection {
  id: string;
  title: string;
  number?: string;
  cleanTitle: string;
  content: string;
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
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [readingProgress, setReadingProgress] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // Copy code handler with real tracking & feedback
  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    marketingService.recordRealCopy(article?.title || 'Giftcode Tin Tức', article?.slug || '', 1);
    setCopiedCode(code);
    onShowToast(`Đã sao chép mã code!`, code, 'success');
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2000);
  };

  // Share article link handler
  const handleShare = async () => {
    if (!article) return;
    const origin =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
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

  // 1. Look up matched game and real release date from catalog and upcoming games
  const { matchedGame, realReleaseDate } = useMemo(() => {
    if (!article) return { matchedGame: null, realReleaseDate: null };

    const allGames = dataService.getGames() || [];
    const upcomingGames = dataService.getUpcomingGamesSync() || [];

    let mg: GameItem | UpcomingGame | null = null;
    let rDate: string | null = null;

    // Check by article.game_slug
    if (article.game_slug) {
      const slugLower = article.game_slug.toLowerCase().trim();
      mg = allGames.find((g) => g.slug?.toLowerCase() === slugLower || g.id?.toLowerCase() === slugLower) || null;
      if (!mg) {
        const up = upcomingGames.find((u) => u.slug?.toLowerCase() === slugLower || u.id?.toLowerCase() === slugLower);
        if (up) {
          mg = up as any;
          if (up.releaseDate) rDate = up.releaseDate;
        }
      }
    }

    // Check by article.game_name
    if (!mg && article.game_name) {
      const nameLower = article.game_name.trim().toLowerCase();
      mg = allGames.find((g) => g.name?.trim().toLowerCase() === nameLower) || null;
      if (!mg) {
        const up = upcomingGames.find((u) => u.name?.trim().toLowerCase() === nameLower);
        if (up) {
          mg = up as any;
          if (up.releaseDate) rDate = up.releaseDate;
        }
      }
    }

    // Check by article.tags
    if (!mg && Array.isArray(article.tags)) {
      for (const tag of article.tags) {
        const tLower = tag.trim().toLowerCase();
        const byCatalog = allGames.find((g) => g.name?.trim().toLowerCase() === tLower || g.slug?.toLowerCase() === tLower);
        if (byCatalog) {
          mg = byCatalog;
          break;
        }
        const byUpcoming = upcomingGames.find((u) => u.name?.trim().toLowerCase() === tLower || u.slug?.toLowerCase() === tLower);
        if (byUpcoming) {
          mg = byUpcoming as any;
          if (byUpcoming.releaseDate) rDate = byUpcoming.releaseDate;
          break;
        }
      }
    }

    // If game matched in catalog, check if upcoming has its release date or catalog has release_date
    if (mg && !rDate) {
      const up = upcomingGames.find(
        (u) => u.slug?.toLowerCase() === (mg as any).slug?.toLowerCase() || u.name?.trim().toLowerCase() === (mg as any).name?.trim().toLowerCase()
      );
      if (up?.releaseDate) {
        rDate = up.releaseDate;
      } else if ((mg as any).release_date) {
        rDate = (mg as any).release_date;
      }
    }

    // Check if article itself holds a release date
    if (!rDate && (article as any).release_date) {
      rDate = (article as any).release_date;
    }
    if (!rDate && (article as any).releaseDate) {
      rDate = (article as any).releaseDate;
    }

    return { matchedGame: mg, realReleaseDate: rDate };
  }, [article]);

  // 2. Parse sections and TOC from ## headings
  const { sections, introContent } = useMemo(() => {
    if (!article || !article.content) {
      return { sections: [], introContent: '' };
    }

    const raw = article.content;
    const parts = raw.split(/(?=^##\s+)/m);
    let intro = '';
    const parsed: ParsedSection[] = [];

    parts.forEach((part, idx) => {
      const trimmed = part.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('## ')) {
        const lines = trimmed.split('\n');
        const headingLine = lines[0].replace(/^##\s+/, '').trim();
        const body = lines.slice(1).join('\n').trim();

        // Extract section number if present (e.g. "1. Hai tên, một game" -> number: "01", cleanTitle: "Hai tên, một game")
        const numMatch = headingLine.match(/^(\d+)[\.\-\:]\s*(.+)$/);
        let numStr: string | undefined;
        let cleanTitle = headingLine;
        if (numMatch) {
          const n = parseInt(numMatch[1], 10);
          numStr = n < 10 ? `0${n}` : `${n}`;
          cleanTitle = numMatch[2].trim();
        }

        parsed.push({
          id: `section-${idx}`,
          title: headingLine,
          number: numStr,
          cleanTitle,
          content: body,
        });
      } else if (idx === 0) {
        intro = trimmed;
      }
    });

    return { sections: parsed, introContent: intro };
  }, [article?.content]);

  // 3. Extract giftcodes from article.codes AND from markdown tables in content
  const allExtractedCodes = useMemo<ExtractedCode[]>(() => {
    if (!article) return [];
    const codeMap = new Map<string, ExtractedCode>();

    // Source A: article.codes array
    if (Array.isArray(article.codes)) {
      article.codes.forEach((c) => {
        const clean = String(c).trim();
        if (clean && !codeMap.has(clean.toUpperCase())) {
          codeMap.set(clean.toUpperCase(), { code: clean });
        }
      });
    }

    // Source B: Parse markdown tables in content for rows with code columns
    if (article.content) {
      const lines = article.content.split('\n');
      for (let i = 0; i < lines.length - 2; i++) {
        const hLine = lines[i].trim();
        const sLine = lines[i + 1].trim();
        if (hLine.startsWith('|') && sLine.startsWith('|') && sLine.includes('---')) {
          const headers = hLine.split('|').map((h) => h.trim()).filter(Boolean);
          const codeColIdx = headers.findIndex((h) => /mã|giftcode|code/i.test(h));
          const rewardColIdx = headers.findIndex((h) => /thưởng|phần thưởng|quà|reward|vật phẩm/i.test(h));

          if (codeColIdx !== -1) {
            let j = i + 2;
            while (j < lines.length && lines[j].trim().startsWith('|')) {
              const cells = lines[j].split('|').map((c) => c.trim()).filter(Boolean);
              const rawCode = cells[codeColIdx];
              const rawReward = rewardColIdx !== -1 ? cells[rewardColIdx] : undefined;

              if (rawCode && rawCode.length >= 3 && rawCode.length <= 40 && !rawCode.includes(' ')) {
                const codeKey = rawCode.toUpperCase();
                if (!codeMap.has(codeKey)) {
                  codeMap.set(codeKey, { code: rawCode, reward: rawReward });
                }
              }
              j++;
            }
          }
        }
      }
    }

    return Array.from(codeMap.values());
  }, [article?.codes, article?.content]);

  // 4. Related articles (max 4, matching game or tags, excluding current)
  const relatedArticles = useMemo(() => {
    if (!article) return [];
    return allArticles
      .filter((a) => {
        if (a.id === article.id || a.slug === article.slug) return false;
        const sameGame =
          (article.game_slug && a.game_slug && a.game_slug === article.game_slug) ||
          (article.game_name && a.game_name && a.game_name.trim().toLowerCase() === article.game_name.trim().toLowerCase());
        const sameTag = Array.isArray(a.tags) && Array.isArray(article.tags) && a.tags.some((t) => article.tags?.includes(t));
        return sameGame || sameTag;
      })
      .slice(0, 4);
  }, [article, allArticles]);

  // 5. Scroll tracking for TOC highlight and Reading Progress Bar
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Reading progress percentage
    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;
    const pct = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
    setReadingProgress(Math.min(100, Math.max(0, pct)));

    // Find active section
    let currentId = '';
    for (const sec of sections) {
      const el = document.getElementById(sec.id);
      if (el) {
        const top = el.offsetTop - container.offsetTop;
        if (scrollTop >= top - 120) {
          currentId = sec.id;
        }
      }
    }
    if (currentId) setActiveHeadingId(currentId);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveHeadingId(id);
      setIsMobileTocOpen(false);
    }
  };

  // Determine effective cover URL (article cover -> game icon -> none)
  const effectiveCoverUrl = useMemo(() => {
    if (!article) return '';
    if (article.cover_url && article.cover_url.trim()) return article.cover_url.trim();
    if (matchedGame?.icon_url && matchedGame.icon_url.trim()) return matchedGame.icon_url.trim();
    if ((matchedGame as any)?.iconUrl && (matchedGame as any).iconUrl.trim()) return (matchedGame as any).iconUrl.trim();
    if (article.game_slug) return `/game_icons/${article.game_slug}.webp`;
    return '';
  }, [article, matchedGame]);

  if (!article || typeof document === 'undefined') return null;

  const formattedDate = new Date(article.published_at || (article as any).created_at || Date.now()).toLocaleDateString(
    'vi-VN',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-3 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-hidden animate-fade-in select-none"
      onClick={onClose}
    >
      {/* Modal Dialog Container */}
      <div
        className="relative w-full max-w-5xl xl:max-w-6xl h-[95dvh] sm:h-[92vh] max-h-[96vh] flex flex-col bg-card border-t sm:border border-border/90 rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden animate-scale-in select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Indicator */}
        <div className="w-12 h-1.5 bg-slate-600/60 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Top Sticky Header */}
        <div className="relative border-b border-border/80 px-4 py-3 sm:px-6 bg-card/95 backdrop-blur-md shrink-0 z-30">
          <div className="flex items-center justify-between gap-3">
            {/* Left Breadcrumb & Game Badge */}
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <nav className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                <span onClick={onClose} className="hover:text-primary transition-colors cursor-pointer hidden sm:inline">
                  Trang chủ
                </span>
                <span className="text-border hidden sm:inline">/</span>
                <span onClick={onClose} className="hover:text-primary transition-colors cursor-pointer">
                  Tin tức
                </span>
                <span className="text-border">/</span>
                <span className="text-foreground font-semibold truncate max-w-[140px] sm:max-w-xs md:max-w-md">
                  {article.title}
                </span>
              </nav>

              {article.is_hot && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0 animate-pulse">
                  <Flame className="w-3 h-3 text-rose-400" />
                  HOT
                </span>
              )}
            </div>

            {/* Right Action Controls: Share & Esc Close Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleShare}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-border/80 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0 active:scale-95"
                title="Chia sẻ liên kết bài viết"
              >
                <Share2 className="w-3.5 h-3.5 text-primary" />
                <span className="hidden md:inline">Chia sẻ</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-600 transition-all active:scale-95 cursor-pointer font-bold text-xs shrink-0 group shadow-xs"
                title="Đóng (Phím Esc)"
                aria-label="Đóng bản tin"
              >
                <X className="w-4 h-4 text-rose-400 group-hover:text-white transition-colors stroke-[2.5]" />
                <span>Đóng</span>
                <span className="hidden sm:inline-block px-1 py-0.2 rounded text-[10px] bg-black/30 text-rose-200 border border-rose-500/25 font-mono">
                  Esc
                </span>
              </button>
            </div>
          </div>

          {/* Reading Progress Bar (2px at bottom of header) */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border/40 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary via-indigo-400 to-emerald-400 transition-all duration-150 ease-out"
              style={{ width: `${readingProgress}%` }}
            />
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto touch-pan-y custom-scrollbar p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8"
        >
          {/* ========================================================= */}
          {/* 3.1. PHẦN ĐẦU BÀI (HERO HEADER & METADATA)                */}
          {/* ========================================================= */}
          <div className="space-y-4">
            {/* Cover Image Banner (Only shown if cover_url or game icon exists; hidden if both empty) */}
            {effectiveCoverUrl && (
              <div className="relative w-full aspect-video sm:aspect-[21/9] rounded-2xl overflow-hidden border border-border/80 shadow-md bg-slate-950 flex items-center justify-center">
                <img
                  src={optimizeImageUrl(effectiveCoverUrl, 1200)}
                  alt={article.title}
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                />
                {/* Official Attribution Watermark Pill */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-white/20 shadow-lg text-[11px] font-bold text-white select-none">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>CodeGame.Shop • Tổng Hợp Chuyên Sâu</span>
                </div>
              </div>
            )}

            {/* Article Big Title */}
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-display font-black text-foreground leading-tight tracking-tight">
              {article.title}
            </h1>

            {/* Meta Information Bar */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground pb-1">
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                {formattedDate}
              </span>

              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                {article.read_time_minutes || 3} phút đọc
              </span>

              {article.views !== undefined && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-teal-400" />
                    {article.views.toLocaleString()} lượt xem
                  </span>
                </>
              )}

              {article.game_name && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary-light border border-primary/30 font-bold text-[11px]">
                    {article.game_name}
                  </span>
                </>
              )}

              {article.is_hot && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  <Flame className="w-3 h-3 text-rose-400" />
                  Tin Hot
                </span>
              )}
            </div>

            {/* Tags Badges */}
            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <Tag className="w-3.5 h-3.5 text-muted-foreground mr-0.5" />
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-muted/50 text-muted-foreground border border-border/60 hover:text-foreground transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Lead Excerpt Paragraph */}
            {article.excerpt && (
              <div className="p-4 sm:p-5 rounded-2xl bg-primary/5 dark:bg-primary/10 border-l-4 border-primary text-sm sm:text-base font-medium text-foreground/90 italic leading-relaxed shadow-xs">
                {article.excerpt}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 3.5. KHỐI ĐẾM NGƯỢC (CHỈ HIỆN KHI CÓ NGÀY THẬT TRONG DATA) */}
          {/* ========================================================= */}
          {realReleaseDate && (
            <CountdownWidget
              releaseDate={realReleaseDate}
              gameName={matchedGame?.name || article.game_name}
            />
          )}

          {/* ========================================================= */}
          {/* 3.4. KHỐI MÃ QUÀ TẶNG & NÚT SAO CHÉP (GIFTCODES WIDGET)   */}
          {/* ========================================================= */}
          {allExtractedCodes.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-card to-amber-950/30 border border-primary/40 shadow-lg space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary-light flex items-center justify-center font-bold">
                    <Gift className="w-4 h-4 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                      Danh Sách Mã Giftcode Quà Tặng ({allExtractedCodes.length})
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-accent text-white font-bold">
                        HOT
                      </span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Bấm sao chép để nhận ngay quà tặng khởi đầu thuận lợi trong game
                    </p>
                  </div>
                </div>

                {matchedGame && onSelectGameSlug && (
                  <button
                    onClick={() => {
                      onClose();
                      onSelectGameSlug(matchedGame.slug);
                    }}
                    className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    Xem kho code {matchedGame.name} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Codes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {allExtractedCodes.map(({ code, reward }) => {
                  const isCopied = copiedCode === code;
                  return (
                    <div
                      key={code}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/80 hover:border-primary/60 transition-all group"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-mono font-black text-amber-300 text-sm tracking-wider select-all block truncate">
                          {code}
                        </span>
                        {reward ? (
                          <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5" title={reward}>
                            {reward}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-medium block mt-0.5">
                            ✓ Mã quà tặng khả dụng
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyCode(code)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 shadow-xs ${
                          isCopied
                            ? 'bg-emerald-500 text-white shadow-glow-emerald'
                            : 'bg-primary hover:bg-primary-hover text-white'
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
            </div>
          )}

          {/* ========================================================= */}
          {/* MOBILE COLLAPSIBLE TOC (THU GỌN Ở ĐẦU BÀI TRÊN ĐIỆN THOẠI) */}
          {/* ========================================================= */}
          {sections.length > 0 && (
            <div className="block lg:hidden rounded-2xl border border-border/80 bg-card/80 overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => setIsMobileTocOpen((prev) => !prev)}
                className="w-full flex items-center justify-between p-3.5 px-4 text-xs font-bold text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-primary" />
                  <span>Mục Lục Bài Viết ({sections.length} phần)</span>
                </div>
                {isMobileTocOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {isMobileTocOpen && (
                <div className="p-3 pt-0 border-t border-border/60 divide-y divide-border/40 max-h-72 overflow-y-auto">
                  {sections.map((sec) => {
                    const isActive = activeHeadingId === sec.id;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => scrollToSection(sec.id)}
                        className={`w-full text-left py-2 px-2.5 rounded-lg text-xs transition-colors flex items-center gap-2 cursor-pointer ${
                          isActive
                            ? 'bg-primary/15 text-primary font-bold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                        }`}
                      >
                        {sec.number && (
                          <span className="font-mono text-[10px] text-primary shrink-0">{sec.number}.</span>
                        )}
                        <span className="truncate">{sec.cleanTitle}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 3.2 & 3.3. HAI CỘT TRÊN MÁY TÍNH / MỘT CỘT TRÊN ĐIỆN THOẠI */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* CỘT NỘI DUNG CHÍNH (LEFT CONTENT COLUMN) */}
            <div className="lg:col-span-8 space-y-6 min-w-0">
              {/* Đoạn mở đầu (nếu có trước mục ## đầu tiên) */}
              {introContent && (
                <div className="p-4 sm:p-5 rounded-2xl bg-card/60 border border-border/80 text-foreground/90 leading-relaxed text-sm sm:text-base space-y-3">
                  <RenderMarkdownContent
                    rawText={introContent}
                    onCopyCode={handleCopyCode}
                    copiedCode={copiedCode}
                  />
                </div>
              )}

              {/* Các thẻ mục lớn (Section Cards) */}
              {sections.map((sec) => (
                <section
                  key={sec.id}
                  id={sec.id}
                  className="scroll-mt-24 p-5 sm:p-6 rounded-2xl bg-card/60 border border-border/80 shadow-xs space-y-4 hover:border-border transition-colors"
                >
                  {/* Section Title Header */}
                  <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                    {sec.number && (
                      <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary font-mono text-xs font-black shrink-0">
                        {sec.number}
                      </span>
                    )}
                    <h2 className="text-lg sm:text-xl font-display font-extrabold text-foreground leading-snug">
                      {sec.cleanTitle}
                    </h2>
                  </div>

                  {/* Section Body */}
                  <div className="text-foreground/90 text-sm sm:text-base leading-relaxed sm:leading-loose space-y-4">
                    <RenderMarkdownContent
                      rawText={sec.content}
                      onCopyCode={handleCopyCode}
                      copiedCode={copiedCode}
                    />
                  </div>
                </section>
              ))}

              {/* ========================================================= */}
              {/* 3.6. THẺ GAME LIÊN QUAN (NẾU KHỚP GAME TRONG DANH MỤC)    */}
              {/* ========================================================= */}
              {matchedGame && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-card via-card to-primary/10 border border-primary/30 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={
                        matchedGame.icon_url ||
                        (matchedGame as any).iconUrl ||
                        `/game_icons/${matchedGame.slug}.webp`
                      }
                      alt={matchedGame.name}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-primary/40 shadow-sm shrink-0"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-sm sm:text-base text-foreground truncate">
                          {matchedGame.name}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary-light border border-primary/30 shrink-0">
                          {matchedGame.category || (matchedGame as any).genre || 'Game Bản Quyền'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Nhà phát hành: <strong className="text-foreground">{matchedGame.publisher || 'Chính thức'}</strong>
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          ★ {matchedGame.rating || 5.0}
                        </span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">
                          {matchedGame.codes_count || (matchedGame as any).free_codes_count || 10}+ mã quà tặng
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onSelectGameSlug) {
                        onSelectGameSlug(matchedGame.slug);
                      } else if (typeof window !== 'undefined') {
                        window.location.href = `/game/${matchedGame.slug}`;
                      }
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <span>Xem Chi Tiết Game & Giftcode</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* ========================================================= */}
              {/* KHỐI BÀI VIẾT LIÊN QUAN (TỐI ĐA 4 BÀI)                   */}
              {/* ========================================================= */}
              {relatedArticles.length > 0 && (
                <div className="space-y-3.5 pt-2">
                  <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Bài Viết Liên Quan Cùng Chủ Đề ({relatedArticles.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {relatedArticles.map((rel) => {
                      const relCover = rel.cover_url || (rel.game_slug ? `/game_icons/${rel.game_slug}.webp` : '');
                      return (
                        <div
                          key={rel.id}
                          onClick={() => {
                            if (onSelectArticle) {
                              onSelectArticle(rel);
                            } else if (typeof window !== 'undefined') {
                              window.location.href = `/news/${rel.slug}`;
                            }
                          }}
                          className="group p-3 rounded-2xl bg-card/60 hover:bg-card border border-border/70 hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between shadow-xs hover:shadow-md"
                        >
                          <div className="space-y-2">
                            {relCover ? (
                              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-border/60">
                                <img
                                  src={optimizeImageUrl(relCover, 400)}
                                  alt={rel.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                              </div>
                            ) : null}
                            <h4 className="text-xs font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                              {rel.title}
                            </h4>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/40">
                            <span>
                              {new Date(rel.published_at || (rel as any).created_at || Date.now()).toLocaleDateString('vi-VN')}
                            </span>
                            <span className="text-primary font-bold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
                              Đọc tiếp →
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* DÒNG NGUỒN Ở CUỐI BÀI: Nguồn: CodeGame.Shop               */}
              {/* ========================================================= */}
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/80 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold text-foreground">Nguồn: CodeGame.Shop</span>
                </div>
                <span>Cập nhật: {formattedDate}</span>
              </div>
            </div>

            {/* ========================================================= */}
            {/* CỘT BÊN (STICKY SIDEBAR TRÊN MÁY TÍNH)                   */}
            {/* ========================================================= */}
            <div className="lg:col-span-4 sticky top-4 space-y-4 hidden lg:block self-start">
              {/* Sticky Table of Contents Card */}
              {sections.length > 0 && (
                <div className="p-4 rounded-2xl bg-card/90 border border-border/80 shadow-sm backdrop-blur-sm space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground border-b border-border/60 pb-2">
                    <ListOrdered className="w-4 h-4 text-primary" />
                    <span>Mục Lục Bài Viết</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary-light ml-auto">
                      {sections.length} phần
                    </span>
                  </div>

                  <div className="space-y-1 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                    {sections.map((sec) => {
                      const isActive = activeHeadingId === sec.id;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => scrollToSection(sec.id)}
                          className={`w-full text-left py-1.5 px-2.5 rounded-lg text-xs transition-all flex items-center gap-2 cursor-pointer ${
                            isActive
                              ? 'bg-primary/15 text-primary border-l-2 border-primary font-bold pl-2 shadow-xs'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                          }`}
                        >
                          {sec.number && (
                            <span className="font-mono text-[10px] text-primary/80 shrink-0">{sec.number}.</span>
                          )}
                          <span className="truncate">{sec.cleanTitle}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sidebar Mini Game Card (If Matched) */}
              {matchedGame && (
                <div className="p-4 rounded-2xl bg-card/90 border border-border/80 shadow-sm space-y-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                    Game Trong Bài Viết
                  </span>
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        matchedGame.icon_url ||
                        (matchedGame as any).iconUrl ||
                        `/game_icons/${matchedGame.slug}.webp`
                      }
                      alt={matchedGame.name}
                      className="w-12 h-12 rounded-xl object-cover border border-border/80 shrink-0"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-foreground truncate">{matchedGame.name}</h4>
                      <p className="text-[11px] text-muted-foreground truncate">{matchedGame.publisher || 'Chính thức'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onSelectGameSlug) onSelectGameSlug(matchedGame.slug);
                    }}
                    className="w-full py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-border/80"
                  >
                    <span>Xem trang game</span>
                    <ExternalLink className="w-3 h-3 text-primary" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Close Bar */}
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
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold border border-border/80 transition-all cursor-pointer active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5 text-primary" />
                <span>Chia sẻ</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/25 transition-all active:scale-95 cursor-pointer"
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

// =========================================================================
// SUB-COMPONENT: REAL COUNTDOWN TIMER (CHỈ HIỆN KHI CÓ NGÀY THẬT)
// =========================================================================
const CountdownWidget: React.FC<{ releaseDate: string; gameName?: string }> = ({ releaseDate, gameName }) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPassed: boolean;
  } | null>(null);

  useEffect(() => {
    const calculate = () => {
      const target = new Date(releaseDate).getTime();
      if (isNaN(target)) return null;
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: true };
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      return { days, hours, minutes, seconds, isPassed: false };
    };

    setTimeLeft(calculate());
    const interval = setInterval(() => {
      setTimeLeft(calculate());
    }, 1000);

    return () => clearInterval(interval);
  }, [releaseDate]);

  if (!timeLeft) return null;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/70 via-card to-primary/10 border border-primary/40 shadow-lg space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary-light flex items-center justify-center font-bold">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-foreground">
              Đếm Ngược Giờ G Ra Mắt {gameName ? `• ${gameName}` : ''}
            </h4>
            <p className="text-[11px] text-muted-foreground font-mono">
              Thời gian dự kiến:{' '}
              {new Date(releaseDate).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {timeLeft.isPassed ? (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            ✓ Đã Ra Mắt Chính Thức
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
            SẮP MỞ CỬA
          </span>
        )}
      </div>

      {!timeLeft.isPassed && (
        <div className="grid grid-cols-4 gap-2 text-center pt-1">
          <div className="p-2 sm:p-2.5 rounded-xl bg-background/80 border border-border/80">
            <span className="block font-mono font-black text-lg sm:text-2xl text-primary-light">
              {timeLeft.days}
            </span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Ngày</span>
          </div>
          <div className="p-2 sm:p-2.5 rounded-xl bg-background/80 border border-border/80">
            <span className="block font-mono font-black text-lg sm:text-2xl text-primary-light">
              {String(timeLeft.hours).padStart(2, '0')}
            </span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Giờ</span>
          </div>
          <div className="p-2 sm:p-2.5 rounded-xl bg-background/80 border border-border/80">
            <span className="block font-mono font-black text-lg sm:text-2xl text-primary-light">
              {String(timeLeft.minutes).padStart(2, '0')}
            </span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Phút</span>
          </div>
          <div className="p-2 sm:p-2.5 rounded-xl bg-background/80 border border-border/80">
            <span className="block font-mono font-black text-lg sm:text-2xl text-amber-400">
              {String(timeLeft.seconds).padStart(2, '0')}
            </span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Giây</span>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: RENDER MARKDOWN CONTENT (TABLES, CALLOUTS, LISTS, IMAGES)
// =========================================================================
interface RenderMarkdownContentProps {
  rawText: string;
  onCopyCode: (code: string) => void;
  copiedCode: string | null;
}

const RenderMarkdownContent: React.FC<RenderMarkdownContentProps> = ({ rawText, onCopyCode, copiedCode }) => {
  // Parse blocks: tables vs paragraphs/lists
  const blocks = useMemo(() => {
    if (!rawText) return [];
    const result: Array<{ type: 'table' | 'paragraph' | 'image' | 'callout' | 'list' | 'heading3'; data: any }> = [];

    // Split text by double newlines or table blocks
    const chunks = rawText.split(/\n\s*\n/);

    chunks.forEach((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return;

      // 1. Check Image ![alt](url)
      const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imgMatch) {
        result.push({
          type: 'image',
          data: { alt: imgMatch[1], src: imgMatch[2] },
        });
        return;
      }

      // 2. Check Markdown Table
      if (trimmed.startsWith('|') && trimmed.includes('\n|')) {
        const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length >= 3) {
          const headerLine = lines[0];
          const separatorLine = lines[1];
          const isSeparator = separatorLine.includes('---');
          if (isSeparator) {
            const headers = headerLine.split('|').map((h) => h.trim()).filter(Boolean);
            const rows = lines.slice(2).map((r) => r.split('|').map((c) => c.trim()).filter(Boolean));
            result.push({
              type: 'table',
              data: { headers, rows } as ParsedTable,
            });
            return;
          }
        }
      }

      // 3. Check Sub-heading ###
      if (trimmed.startsWith('### ')) {
        result.push({
          type: 'heading3',
          data: trimmed.replace(/^###\s+/, '').trim(),
        });
        return;
      }

      // 4. Check Callout Alert Box (starts with "Lưu ý:", "Chú ý:", "Cảnh báo:", "Quan trọng nhất:", "> ")
      const alertPrefixMatch = trimmed.match(/^(?:>\s*)?(Lưu ý quan trọng|Lưu ý|Chú ý|Cảnh báo|Quan trọng nhất|Rủi ro|Cảnh báo mã)[\:\-]?\s*(.*)$/is);
      if (alertPrefixMatch || trimmed.startsWith('> ')) {
        const prefix = alertPrefixMatch ? alertPrefixMatch[1] : 'Lưu ý';
        const body = alertPrefixMatch ? alertPrefixMatch[2] : trimmed.replace(/^>\s*/, '');
        result.push({
          type: 'callout',
          data: { prefix, body },
        });
        return;
      }

      // 5. Check List (- item or * item or 1. item)
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
        const items = trimmed.split('\n').filter(Boolean);
        const isOrdered = /^\d+\.\s/.test(trimmed);
        result.push({
          type: 'list',
          data: {
            isOrdered,
            items: items.map((i) => i.replace(/^[-*]\s+|\d+\.\s+/, '')),
          },
        });
        return;
      }

      // 6. Normal paragraph
      result.push({
        type: 'paragraph',
        data: trimmed,
      });
    });

    return result;
  }, [rawText]);

  return (
    <>
      {blocks.map((block, idx) => {
        // Table renderer
        if (block.type === 'table') {
          const table = block.data as ParsedTable;
          const isGiftcodeTable = table.headers.some((h) => /mã|giftcode|code/i.test(h));

          return (
            <div key={idx} className="my-4 space-y-3">
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-border/80 bg-muted/20">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead className="bg-muted/60 text-foreground font-bold border-b border-border/80">
                    <tr>
                      {table.headers.map((h, i) => (
                        <th key={i} className="py-3 px-4 font-bold text-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {table.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-muted/30 transition-colors">
                        {row.map((cell, cIdx) => {
                          const colHeader = table.headers[cIdx] || '';
                          const isCodeCol = /mã|giftcode|code/i.test(colHeader);
                          const isCopied = copiedCode === cell;

                          return (
                            <td key={cIdx} className="py-3 px-4 align-middle">
                              {isCodeCol && cell.length >= 3 && !cell.includes(' ') ? (
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono font-black text-amber-300 text-xs sm:text-sm select-all">
                                    {cell}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onCopyCode(cell)}
                                    className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                                      isCopied
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-primary hover:bg-primary-hover text-white'
                                    }`}
                                    title="Sao chép mã"
                                  >
                                    {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    <span>{isCopied ? 'Đã chép' : 'Chép'}</span>
                                  </button>
                                </div>
                              ) : (
                                <span>{cell}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards View (Zero horizontal scroll!) */}
              <div className="sm:hidden space-y-3">
                {table.rows.map((row, rIdx) => (
                  <div
                    key={rIdx}
                    className="p-3.5 rounded-xl bg-muted/40 border border-border/80 space-y-2 shadow-xs"
                  >
                    {row.map((cell, cIdx) => {
                      const colHeader = table.headers[cIdx] || `Cột ${cIdx + 1}`;
                      const isCodeCol = /mã|giftcode|code/i.test(colHeader);
                      const isCopied = copiedCode === cell;

                      return (
                        <div key={cIdx} className="space-y-0.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                            {colHeader}
                          </span>
                          {isCodeCol && cell.length >= 3 && !cell.includes(' ') ? (
                            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border/80 mt-1">
                              <span className="font-mono font-black text-amber-300 text-sm select-all">
                                {cell}
                              </span>
                              <button
                                type="button"
                                onClick={() => onCopyCode(cell)}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                                  isCopied
                                    ? 'bg-emerald-500 text-white shadow-glow-emerald'
                                    : 'bg-primary hover:bg-primary-hover text-white'
                                }`}
                              >
                                {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                <span>{isCopied ? 'Đã chép' : 'Sao chép'}</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-foreground leading-relaxed block">
                              {cell}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // Heading 3 renderer
        if (block.type === 'heading3') {
          return (
            <h3 key={idx} className="text-base sm:text-lg font-bold text-primary pt-2">
              {block.data}
            </h3>
          );
        }

        // Callout Alert Box
        if (block.type === 'callout') {
          return (
            <div
              key={idx}
              className="p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm leading-relaxed flex items-start gap-2.5 my-3 shadow-xs"
            >
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-0.5">
                <span className="font-bold text-amber-300 block">{block.data.prefix}</span>
                <p className="text-foreground/90 whitespace-pre-line">{block.data.body}</p>
              </div>
            </div>
          );
        }

        // List renderer
        if (block.type === 'list') {
          const list = block.data;
          if (list.isOrdered) {
            return (
              <ol key={idx} className="list-decimal pl-5 space-y-1.5 my-2">
                {list.items.map((item: string, i: number) => (
                  <li key={i} className="text-foreground/90 leading-relaxed pl-1">
                    {item}
                  </li>
                ))}
              </ol>
            );
          }
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1.5 my-2">
              {list.items.map((item: string, i: number) => (
                <li key={i} className="text-foreground/90 leading-relaxed pl-1">
                  {item}
                </li>
              ))}
            </ul>
          );
        }

        // Image renderer
        if (block.type === 'image') {
          return (
            <figure key={idx} className="my-5 text-center">
              <img
                src={optimizeImageUrl(block.data.src, 900)}
                alt={block.data.alt || 'Ảnh minh họa bài viết'}
                className="w-full max-h-[520px] object-cover rounded-2xl border border-border/80 shadow-lg mx-auto"
                loading="lazy"
                decoding="async"
              />
              {block.data.alt && (
                <figcaption className="text-xs text-muted-foreground italic mt-2">
                  {block.data.alt}
                </figcaption>
              )}
            </figure>
          );
        }

        // Paragraph
        return (
          <p key={idx} className="whitespace-pre-line">
            {block.data}
          </p>
        );
      })}
    </>
  );
};
