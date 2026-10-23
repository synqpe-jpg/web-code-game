import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Rocket, Clock, Bell, Check, ExternalLink, Gift, Search, Calendar, Sparkles } from 'lucide-react';
import type { UpcomingGame } from '../types/game';

interface AllUpcomingGamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  upcomingGames: UpcomingGame[];
  bookmarkedSlugs: string[];
  onToggleBookmark: (slug: string, e?: React.MouseEvent) => void;
  onShowToast?: (msg: string, desc?: string, type?: 'success' | 'info' | 'error' | 'warning') => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isReleased: boolean;
}

function calculateTimeRemaining(targetDateStr: string): TimeRemaining {
  try {
    const target = new Date(targetDateStr).getTime();
    const now = Date.now();
    const diff = target - now;

    if (isNaN(target) || diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isReleased: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, isReleased: false };
  } catch {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isReleased: true };
  }
}

function formatReleaseDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${mins} • ${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

export const AllUpcomingGamesModal: React.FC<AllUpcomingGamesModalProps> = ({
  isOpen,
  onClose,
  upcomingGames,
  bookmarkedSlugs,
  onToggleBookmark,
  onShowToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'WEEK' | 'MONTH' | 'BOOKMARKED'>('ALL');
  const [, setTick] = useState(0);

  // Live timer tick every second
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const bookmarkedSet = new Set(bookmarkedSlugs.map((s) => s.toLowerCase()));
  const now = Date.now();

  const filteredGames = upcomingGames.filter((game) => {
    // 1. Search term match
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = game.name.toLowerCase().includes(q);
      const matchPublisher = (game.publisher || '').toLowerCase().includes(q);
      const matchCategory = (game.category || '').toLowerCase().includes(q);
      if (!matchName && !matchPublisher && !matchCategory) return false;
    }

    // 2. Filter tabs
    const targetTime = new Date(game.releaseDate).getTime();
    const diffMs = targetTime - now;

    if (activeFilter === 'BOOKMARKED') {
      return bookmarkedSet.has((game.slug || game.id).toLowerCase());
    }
    if (activeFilter === 'WEEK') {
      return diffMs > 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
    }
    if (activeFilter === 'MONTH') {
      return diffMs > 0 && diffMs <= 30 * 24 * 60 * 60 * 1000;
    }

    return true;
  });

  const handleNotifyClick = (game: UpcomingGame, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCurrentlySaved = bookmarkedSet.has((game.slug || game.id).toLowerCase());
    onToggleBookmark(game.slug || game.id, e);

    if (onShowToast) {
      if (!isCurrentlySaved) {
        onShowToast(
          `Đã bật Báo Code cho "${game.name}"!`,
          `Game đã được ghim lên đầu danh sách theo dõi của bạn.`,
          'success'
        );
      } else {
        onShowToast(`Đã tắt Báo Code cho "${game.name}".`, undefined, 'info');
      }
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-card border border-cyan-500/30 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden my-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-border/70 flex items-center justify-between gap-3 bg-gradient-to-r from-cyan-950/40 via-card to-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20 shrink-0">
              <Rocket className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base sm:text-xl text-foreground">
                  Lịch Ra Mắt Game & Quà Tân Thủ Dự Kiến 2026
                </h3>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {upcomingGames.length} Game
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cập nhật liên tục lịch mở server chính thức, giờ G và danh sách mã quà tặng độc quyền
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 shadow-md cursor-pointer transition-all active:scale-95 flex items-center justify-center shrink-0"
            aria-label="Đóng"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="p-4 border-b border-border/50 bg-background/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên game, nhà phát hành, thể loại..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-secondary/80 border border-border/80 focus:border-cyan-400 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
              }`}
            >
              Tất cả ({upcomingGames.length})
            </button>
            <button
              onClick={() => setActiveFilter('WEEK')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === 'WEEK'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
              }`}
            >
              Trong 7 ngày
            </button>
            <button
              onClick={() => setActiveFilter('MONTH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === 'MONTH'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
              }`}
            >
              Tháng này
            </button>
            <button
              onClick={() => setActiveFilter('BOOKMARKED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                activeFilter === 'BOOKMARKED'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
              }`}
            >
              <Bell className="w-3 h-3" />
              <span>Đã Báo Code</span>
            </button>
          </div>
        </div>

        {/* Modal Body: Games Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {filteredGames.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30 text-cyan-400" />
              <p className="text-base font-medium text-foreground">Không tìm thấy tựa game nào</p>
              <p className="text-xs text-muted-foreground mt-1">
                Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc mốc thời gian khác.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGames.map((game) => {
                const isSaved = bookmarkedSet.has((game.slug || game.id).toLowerCase());
                const time = calculateTimeRemaining(game.releaseDate);
                const iconSrc = game.iconUrl || `/game_icons/${game.slug}.webp`;
                const expectedCodes = game.expectedCodes || ['TANTHU2026', 'VIP999', 'OPENBETA'];

                return (
                  <div
                    key={game.id || game.slug}
                    className="bg-card/90 border border-border/80 hover:border-cyan-500/50 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-cyan-500/10 group relative"
                  >
                    <div>
                      {/* Top tags */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                          {game.category}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {game.platform || 'Mobile, PC'}
                        </span>
                      </div>

                      {/* Icon + Title + Publisher */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800 border border-cyan-500/30 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
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
                          <h4 className="font-heading font-bold text-sm sm:text-base text-foreground line-clamp-1 group-hover:text-cyan-400 transition-colors">
                            {game.name}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {game.publisher}
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      {game.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                          {game.description}
                        </p>
                      )}

                      {/* Release date & Live Countdown box */}
                      <div className="mb-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 p-2.5 shadow-inner">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5 pb-1 border-b border-border/30">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-cyan-400" />
                            <span>Giờ G mở server:</span>
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatReleaseDate(game.releaseDate)}
                          </span>
                        </div>

                        {time.isReleased ? (
                          <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold text-xs py-1 animate-pulse">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <span>ĐÃ CHÍNH THỨC MỞ SERVER!</span>
                          </div>
                        ) : (
                          <div className="font-mono font-bold text-xs sm:text-sm text-cyan-300 tracking-wider flex items-center justify-center gap-1.5 py-0.5">
                            <span className="px-1.5 py-0.5 bg-cyan-950/70 rounded text-cyan-200">
                              {String(time.days).padStart(2, '0')} ngày
                            </span>
                            <span className="text-cyan-500">:</span>
                            <span className="px-1.5 py-0.5 bg-cyan-950/70 rounded text-cyan-200">
                              {String(time.hours).padStart(2, '0')} giờ
                            </span>
                            <span className="text-cyan-500">:</span>
                            <span className="px-1.5 py-0.5 bg-cyan-950/70 rounded text-cyan-200">
                              {String(time.minutes).padStart(2, '0')} phút
                            </span>
                            <span className="text-cyan-500">:</span>
                            <span className="px-1.5 py-0.5 bg-cyan-950/70 rounded text-amber-300">
                              {String(time.seconds).padStart(2, '0')}s
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Expected giftcodes chips */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="font-semibold text-amber-400 flex items-center gap-1">
                            <Gift className="w-3 h-3" />
                            <span>Quà tân thủ dự kiến ({expectedCodes.length}):</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {(game.subscribersCount || 1200).toLocaleString('vi-VN')} người canh code
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {expectedCodes.map((c, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/25"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Buttons */}
                    <div className="pt-3 border-t border-border/50 flex items-center gap-2">
                      <button
                        onClick={(e) => handleNotifyClick(game, e)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 ${
                          isSaved
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 shadow-cyan-500/25 hover:shadow-cyan-500/40'
                        }`}
                        title={isSaved ? 'Đã bật báo code khi mở server' : 'Nhận thông báo & ghim lên theo dõi'}
                      >
                        {isSaved ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>Đã Đăng Ký Báo Code</span>
                          </>
                        ) : (
                          <>
                            <Bell className="w-4 h-4 text-slate-950" />
                            <span>Báo Code Khi Mở Server</span>
                          </>
                        )}
                      </button>

                      {game.preRegUrl && (
                        <a
                          href={game.preRegUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border/60 transition-colors flex items-center gap-1.5"
                          title="Đăng ký trước tại trang chủ NPH"
                        >
                          <span>Trang Chủ</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
