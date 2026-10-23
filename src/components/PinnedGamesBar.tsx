import React from 'react';
import { Bookmark, Sparkles, X, Gift, ChevronRight, Clock, Trash2, Bell, ExternalLink, Gamepad2 } from 'lucide-react';
import type { GameItem, UpcomingGame } from '../types/game';

interface PinnedGamesBarProps {
  bookmarks: string[];
  bookmarkedGames: GameItem[];
  upcomingGames?: UpcomingGame[];
  onToggleBookmark: (gameId: string, e?: React.MouseEvent) => void;
  onSelectGame: (game: GameItem) => void;
  onSelectUpcomingGame?: (game: UpcomingGame) => void;
  onClearAll: () => void;
  onOpenBookmarksDrawer?: () => void;
  onScrollToUpcoming?: () => void;
}

export const PinnedGamesBar: React.FC<PinnedGamesBarProps> = ({
  bookmarks,
  bookmarkedGames,
  upcomingGames = [],
  onToggleBookmark,
  onSelectGame,
  onSelectUpcomingGame,
  onClearAll,
  onOpenBookmarksDrawer,
  onScrollToUpcoming,
}) => {
  // Combine official catalog games and subscribed upcoming games
  const bookmarkedSlugsSet = new Set(bookmarks.map((s) => s.toLowerCase()));

  // 1. Matched catalog games
  const catalogList = bookmarkedGames.filter(
    (g) => bookmarkedSlugsSet.has((g.id || '').toLowerCase()) || bookmarkedSlugsSet.has((g.slug || '').toLowerCase())
  );
  const catalogSlugs = new Set(catalogList.map((g) => (g.slug || g.id).toLowerCase()));

  // 2. Subscribed upcoming games not yet in catalogList
  const subscribedUpcoming = upcomingGames.filter((ug) => {
    const slugLower = (ug.slug || ug.id).toLowerCase();
    return bookmarkedSlugsSet.has(slugLower) && !catalogSlugs.has(slugLower);
  });

  const totalFollowed = catalogList.length + subscribedUpcoming.length;

  // If user hasn't followed any game yet, show a sleek invitation hint bar
  if (totalFollowed === 0) {
    return (
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-primary/5 to-cyan-500/10 border border-amber-500/20 p-3.5 sm:p-4 backdrop-blur-sm shadow-sm transition-all">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Bookmark className="w-5 h-5 fill-amber-400/50" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-sm sm:text-base text-foreground flex items-center gap-1.5">
                  Game Bạn Đang Theo Dõi
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Tự Động Ghim
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nhấn biểu tượng <span className="text-amber-400 font-semibold">🔖 Lưu</span> trên thẻ game hoặc nút <span className="text-cyan-400 font-semibold">🔔 Báo Code</span> bên dưới để ghim game yêu thích lên đầu và nhận giftcode mới nhất!
              </p>
            </div>
          </div>

          {onScrollToUpcoming && (
            <button
              onClick={onScrollToUpcoming}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap self-end sm:self-auto shrink-0 shadow-sm hover:scale-[1.02] active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
              <span>Xem Game Sắp Ra Mắt</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Active Pinned Games Bar
  return (
    <div className="mb-6 sm:mb-8 rounded-2xl bg-card/85 border border-amber-500/30 p-3.5 sm:p-5 backdrop-blur-md shadow-lg shadow-amber-500/5 transition-all relative overflow-hidden">
      {/* Background ambient neon glow */}
      <div className="absolute top-0 right-0 w-64 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-10" />

      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 mb-3.5 pb-2.5 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 shrink-0">
            <Bookmark className="w-4 h-4 sm:w-5 sm:h-5 fill-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-bold text-sm sm:text-base md:text-lg text-foreground tracking-tight flex items-center gap-2">
                Game Bạn Đang Theo Dõi
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                {totalFollowed} game
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1">
              Được ghim ưu tiên lên đầu • Tự động hiển thị cập nhật mã mới tức thì
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenBookmarksDrawer && (
            <button
              onClick={onOpenBookmarksDrawer}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border/60 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
              title="Mở toàn bộ danh sách tủ game"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-primary-light" />
              <span>Tủ Game</span>
            </button>
          )}

          <button
            onClick={onClearAll}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-all cursor-pointer border border-transparent hover:border-rose-500/20 active:scale-95"
            title="Xóa toàn bộ game đang theo dõi"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Bỏ tất cả</span>
          </button>
        </div>
      </div>

      {/* Cards Scrollable Row / Responsive Grid */}
      <div className="flex gap-3 overflow-x-auto pb-1.5 sm:pb-2 pt-1 scrollbar-none snap-x snap-mandatory">
        {/* 1. Official Catalog Games */}
        {catalogList.map((game) => {
          const activeCodes = (game.codes || []).filter((c) => c.status !== 'expired');
          const codesCount = activeCodes.length || game.codes_count || 0;
          const iconSrc = game.icon_url || `/game_icons/${game.slug}.webp`;

          return (
            <div
              key={`pinned_catalog_${game.id || game.slug}`}
              onClick={() => onSelectGame(game)}
              className="min-w-[210px] max-w-[230px] sm:min-w-[230px] sm:max-w-[250px] shrink-0 bg-background/80 hover:bg-background/95 border border-amber-500/20 hover:border-amber-400/60 rounded-xl p-3 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-amber-500/10 group cursor-pointer snap-start relative"
            >
              {/* Top: Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark(game.id || game.slug, e);
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-card/80 hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 border border-border/50 hover:border-rose-500/40 flex items-center justify-center transition-all cursor-pointer opacity-80 group-hover:opacity-100 z-10"
                title="Bỏ theo dõi game này"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div>
                <div className="flex items-center gap-2.5 mb-2.5 pr-6">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-border/80 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <img
                      src={iconSrc}
                      alt={game.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/logo.png';
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading font-bold text-xs sm:text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {game.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {game.publisher || 'Nhà phát hành'}
                    </p>
                  </div>
                </div>

                {/* Badge code mới cập nhật */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <Gift className="w-3 h-3" />
                    <span>{codesCount} Giftcode</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-medium bg-secondary text-muted-foreground">
                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                    <span>Mới cập nhật</span>
                  </span>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-xs text-primary-light group-hover:text-primary font-semibold">
                <span>Xem & Sao Chép Code</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          );
        })}

        {/* 2. Subscribed Upcoming Games */}
        {subscribedUpcoming.map((ug) => {
          const iconSrc = ug.iconUrl || `/game_icons/${ug.slug}.webp`;
          const expectedCount = ug.expectedCodes?.length || 4;

          return (
            <div
              key={`pinned_upcoming_${ug.id || ug.slug}`}
              onClick={() => onSelectUpcomingGame ? onSelectUpcomingGame(ug) : null}
              className="min-w-[210px] max-w-[230px] sm:min-w-[230px] sm:max-w-[250px] shrink-0 bg-background/80 hover:bg-background/95 border border-cyan-500/30 hover:border-cyan-400/70 rounded-xl p-3 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-cyan-500/10 group cursor-pointer snap-start relative"
            >
              {/* Top: Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark(ug.slug, e);
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-card/80 hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 border border-border/50 hover:border-rose-500/40 flex items-center justify-center transition-all cursor-pointer opacity-80 group-hover:opacity-100 z-10"
                title="Hủy báo code game này"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div>
                <div className="flex items-center gap-2.5 mb-2.5 pr-6">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-cyan-500/40 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <img
                      src={iconSrc}
                      alt={ug.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/logo.png';
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading font-bold text-xs sm:text-sm text-foreground line-clamp-1 group-hover:text-cyan-400 transition-colors">
                      {ug.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {ug.publisher}
                    </p>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>Sắp Mở Server</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <Bell className="w-2.5 h-2.5 text-amber-400" />
                    <span>{expectedCount} Code Giờ G</span>
                  </span>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-xs text-cyan-400 group-hover:text-cyan-300 font-semibold">
                <span>Đã Bật Báo Code</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
