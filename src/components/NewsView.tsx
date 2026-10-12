import React, { useState, useEffect, useMemo } from 'react';
import {
  Newspaper,
  Search,
  Sparkles,
  Clock,
  Eye,
  Gift,
  Flame,
  ArrowRight,
  Tag,
  X,
  Share2,
  Calendar,
  Gamepad2,
} from 'lucide-react';
import { NewsArticle } from '../types/game';
import { newsService } from '../services/newsService';
import { NewsDetailModal } from './NewsDetailModal';
import { useLanguage } from '../context/LanguageContext';

interface NewsViewProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onSelectGameSlug?: (slug: string) => void;
  initialArticleSlug?: string | null;
}

export const NewsView: React.FC<NewsViewProps> = ({
  onShowToast,
  onSelectGameSlug,
  initialArticleSlug,
}) => {
  const { t } = useLanguage();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedGameSlug, setSelectedGameSlug] = useState<string>('all');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load articles
  const loadArticles = () => {
    setIsLoading(true);
    try {
      const data = newsService.getPublishedArticles();
      setArticles(data);

      // Handle deep-linked article if provided
      if (initialArticleSlug) {
        const found = newsService.getArticleBySlug(initialArticleSlug);
        if (found) {
          setSelectedArticle(found);
          newsService.recordView(found.id);
        }
      }
    } catch (err) {
      console.error('Failed to load news articles', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();

    // Listen to news updates (from admin sync)
    const handleNewsUpdate = () => loadArticles();
    window.addEventListener('wcg_news_updated', handleNewsUpdate);
    return () => window.removeEventListener('wcg_news_updated', handleNewsUpdate);
  }, [initialArticleSlug]);

  // Distinct game options for category filtering
  const gameFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    articles.forEach((a) => {
      if (a.game_slug && a.game_name) {
        map.set(a.game_slug, a.game_name);
      }
    });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [articles]);

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return newsService.getPublishedArticles({
      search: searchQuery,
      gameSlug: selectedGameSlug !== 'all' ? selectedGameSlug : undefined,
      tag: selectedTag !== 'all' ? selectedTag : undefined,
    });
  }, [articles, searchQuery, selectedGameSlug, selectedTag]);

  // Featured article (first featured article or first hot article)
  const featuredArticle = useMemo(() => {
    return articles.find((a) => a.is_featured) || articles[0] || null;
  }, [articles]);

  // Other articles excluding the hero banner if not searching
  const gridArticles = useMemo(() => {
    if (searchQuery || selectedGameSlug !== 'all' || selectedTag !== 'all') {
      return filteredArticles;
    }
    if (featuredArticle) {
      return filteredArticles.filter((a) => a.id !== featuredArticle.id);
    }
    return filteredArticles;
  }, [filteredArticles, featuredArticle, searchQuery, selectedGameSlug, selectedTag]);

  const handleOpenArticle = (art: NewsArticle) => {
    setSelectedArticle(art);
    newsService.recordView(art.id);
    // Update view count in state
    setArticles((prev) =>
      prev.map((a) => (a.id === art.id ? { ...a, views: (a.views || 0) + 1 } : a))
    );
  };

  const handleCloseArticle = () => {
    setSelectedArticle(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 animate-fade-in">
      {/* 1. Header Banner Title */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-card via-card/90 to-primary/10 border border-border/80 p-5 sm:p-7 shadow-lg backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary-light text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>CẬP NHẬT 24/7 • BÀI VIẾT & GIFTCODE MỚI</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2.5">
              <Newspaper className="w-7 h-7 sm:w-9 h-9 text-primary shrink-0" />
              <span>Tin Tức Game & Sự Kiện Giftcode</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Điểm tin làng game Việt, bản cập nhật mới nhất, sự kiện quà tặng và danh sách Giftcode độc quyền được cập nhật liên tục mỗi ngày.
            </p>
          </div>

          {/* Quick stats counter */}
          <div className="flex items-center gap-4 bg-muted/40 p-4 rounded-2xl border border-border/60 shrink-0">
            <div className="text-center px-2">
              <div className="text-xl sm:text-2xl font-black text-primary font-mono">
                {articles.length}
              </div>
              <div className="text-[11px] text-muted-foreground font-medium">Bài Viết</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center px-2">
              <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                {articles.reduce((acc, a) => acc + (a.codes?.length || 0), 0)}
              </div>
              <div className="text-[11px] text-muted-foreground font-medium">Code Kèm Theo</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Hero Featured Article (Shown when no search/tag filter is active) */}
      {!searchQuery && selectedGameSlug === 'all' && selectedTag === 'all' && featuredArticle && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-amber-500 fill-amber-500 animate-pulse" />
            <h2 className="text-base sm:text-lg font-bold text-foreground uppercase tracking-wide">
              Tin Nổi Bật Nhất
            </h2>
          </div>

          <div
            onClick={() => handleOpenArticle(featuredArticle)}
            className="group relative cursor-pointer overflow-hidden rounded-3xl bg-card border border-border/80 hover:border-primary/50 shadow-lg hover:shadow-xl transition-all duration-300 grid grid-cols-1 md:grid-cols-12 gap-0 md:max-h-[290px]"
          >
            {/* Cover image (5 cols on md, 4 cols on lg/xl) */}
            <div className="md:col-span-5 lg:col-span-4 xl:col-span-4 relative overflow-hidden bg-slate-950 flex items-center justify-center min-h-[190px] max-h-[240px] md:max-h-none md:h-full">
              {/* Ambient blur backdrop */}
              <div
                className="absolute inset-0 bg-cover bg-center blur-2xl opacity-40 scale-125 pointer-events-none"
                style={{ backgroundImage: `url(${featuredArticle.cover_url})` }}
              />
              <img
                src={featuredArticle.cover_url}
                alt={featuredArticle.title}
                className="relative z-10 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent md:hidden z-10" />

              {/* Badges on image */}
              <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-black text-[11px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                  <Flame className="w-3 h-3 fill-black" />
                  Tiêu Điểm
                </span>
                {featuredArticle.game_name && (
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/90 text-white text-[11px] font-bold shadow-md backdrop-blur-sm">
                    {featuredArticle.game_name}
                  </span>
                )}
              </div>
            </div>

            {/* Info panel (7 cols on md, 8 cols on lg/xl) */}
            <div className="md:col-span-7 lg:col-span-8 xl:col-span-8 p-4 sm:p-5 lg:p-6 flex flex-col justify-between space-y-2 sm:space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(featuredArticle.published_at).toLocaleDateString('vi-VN')}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {featuredArticle.read_time_minutes || 3} phút đọc
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    {featuredArticle.views || 0} lượt xem
                  </span>
                </div>

                <h3 className="text-base sm:text-lg lg:text-xl font-black text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                  {featuredArticle.title}
                </h3>

                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {featuredArticle.excerpt}
                </p>

                {/* Embedded codes sneak-peek badge */}
                {featuredArticle.codes && featuredArticle.codes.length > 0 && (
                  <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                      <Gift className="w-3.5 h-3.5 shrink-0" />
                      <span>Kèm {featuredArticle.codes.length} Giftcode độc quyền</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[11px] text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-lg">
                      {featuredArticle.codes[0]}
                      {featuredArticle.codes.length > 1 && ` +${featuredArticle.codes.length - 1}`}
                    </div>
                  </div>
                )}
              </div>

              {/* Action row */}
              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {featuredArticle.tags?.slice(0, 2).map((t, i) => (
                    <span
                      key={i}
                      className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-lg bg-muted text-muted-foreground font-medium"
                    >
                      #{t}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-bold group-hover:bg-primary-dark transition-all shadow-sm group-hover:translate-x-0.5 cursor-pointer"
                >
                  <span>Đọc ngay</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. Search Bar & Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm tin tức, sự kiện, giftcode game..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-card border border-border/80 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-muted-foreground text-foreground transition-all outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Game filter dropdown/chips */}
          {gameFilterOptions.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedGameSlug('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedGameSlug === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                Tất cả Game
              </button>
              {gameFilterOptions.map((g) => (
                <button
                  key={g.slug}
                  type="button"
                  onClick={() => setSelectedGameSlug(g.slug)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedGameSlug === g.slug
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Gamepad2 className="w-3.5 h-3.5 opacity-70" />
                  <span>{g.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Articles Grid */}
      {gridArticles.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-card/60 border border-border/60">
          <Newspaper className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-bold text-foreground">Không tìm thấy bài viết nào</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Hãy thử tìm bằng từ khóa khác hoặc xóa bộ lọc để xem toàn bộ tin tức game mới nhất.
          </p>
          {(searchQuery || selectedGameSlug !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedGameSlug('all');
                setSelectedTag('all');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-dark transition-all"
            >
              Xem tất cả bài viết
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {gridArticles.map((article) => {
            const hasCodes = article.codes && article.codes.length > 0;
            return (
              <article
                key={article.id}
                onClick={() => handleOpenArticle(article)}
                className="group relative cursor-pointer flex flex-col overflow-hidden rounded-2xl bg-card border border-border/80 hover:border-primary/50 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Thumbnail */}
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  <img
                    src={article.cover_url}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                  {/* Badges on image */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    {article.game_name && (
                      <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-bold border border-white/10">
                        {article.game_name}
                      </span>
                    )}
                    {article.is_hot && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-black text-[10px] font-black uppercase flex items-center gap-1 shadow-sm">
                        <Flame className="w-3 h-3 fill-black" />
                        HOT
                      </span>
                    )}
                  </div>

                  {/* Codes badge on image bottom */}
                  {hasCodes && (
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-amber-500/90 backdrop-blur-md text-slate-950 text-[11px] font-black flex items-center gap-1 shadow-md">
                      <Gift className="w-3.5 h-3.5" />
                      <span>+{article.codes!.length} Code</span>
                    </div>
                  )}
                </div>

                {/* Article Info */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    {/* Meta stats */}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{new Date(article.published_at).toLocaleDateString('vi-VN')}</span>
                      <span>•</span>
                      <span>{article.read_time_minutes || 3} phút đọc</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {article.views || 0}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {article.title}
                    </h3>

                    {/* Excerpt */}
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {article.excerpt}
                    </p>
                  </div>

                  {/* Footer tags & CTA */}
                  <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-primary font-semibold group-hover:underline flex items-center gap-1">
                      Đọc chi tiết
                      <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                    </span>

                    {article.tags && article.tags.length > 0 && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        #{article.tags[0]}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 5. Article Detail Modal */}
      {selectedArticle && (
        <NewsDetailModal
          article={selectedArticle}
          onClose={handleCloseArticle}
          onShowToast={onShowToast}
          onSelectGameSlug={onSelectGameSlug}
          onSelectArticle={(art) => handleOpenArticle(art)}
          allArticles={articles}
        />
      )}
    </div>
  );
};
