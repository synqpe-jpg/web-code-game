import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap,
  Calendar,
  Clock,
  ExternalLink,
  Gift,
  Search,
  Copy,
  Check,
  Globe,
  Users,
  Radio,
  Flame,
  ChevronRight,
  ShieldCheck,
  Share2,
} from 'lucide-react';
import { gameEventService } from '../services/gameEventService';
import type { GameEventItem, GameEventTimeStatus, GameEventSourceType } from '../types/gameEvent';
import { getGameEventTimeStatus, sortGameEvents } from '../types/gameEvent';

interface GameEventsListProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onSelectGameSlug?: (slug: string) => void;
}

export const GameEventsList: React.FC<GameEventsListProps> = ({
  onShowToast,
  onSelectGameSlug,
}) => {
  const [events, setEvents] = useState<GameEventItem[]>(() => {
    try {
      return gameEventService.getPublishedEvents();
    } catch {
      return [];
    }
  });

  const [timeFilter, setTimeFilter] = useState<GameEventTimeStatus | 'ALL'>('ALL');
  const [selectedGameSlug, setSelectedGameSlug] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Load and subscribe to game events updates
  useEffect(() => {
    const loadData = () => {
      setEvents(gameEventService.getPublishedEvents());
    };
    loadData();

    // Pull latest published events from Cloudflare D1 / server
    const syncFn = gameEventService.syncFromServer || gameEventService.fetchFreshEventsFromServer;
    if (typeof syncFn === 'function') {
      syncFn.call(gameEventService).then((updated) => {
        if (Array.isArray(updated) && updated.length > 0) {
          setEvents(gameEventService.getPublishedEvents());
        }
      }).catch(() => {});
    }

    window.addEventListener('wcg_game_events_updated', loadData);
    return () => window.removeEventListener('wcg_game_events_updated', loadData);
  }, []);

  // Format date time in Vietnam format (e.g., 23:59 02/11/2026)
  const formatDateTimeVN = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${hours}:${mins} ${day}/${month}/${year}`;
    } catch {
      return iso;
    }
  };

  // Distinct games for dropdown
  const gameOptions = useMemo(() => {
    const map = new Map<string, string>();
    events.forEach((ev) => {
      if (ev.game_slug && ev.game_name) {
        map.set(ev.game_slug, ev.game_name);
      }
    });
    return Array.from(map.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [events]);

  // Counts for filters
  const counts = useMemo(() => {
    const now = Date.now();
    let happening = 0;
    let upcoming = 0;
    let ended = 0;

    events.forEach((ev) => {
      const st = getGameEventTimeStatus(ev, now);
      if (st === 'HAPPENING') happening++;
      else if (st === 'UPCOMING') upcoming++;
      else if (st === 'ENDED') ended++;
    });

    return { all: events.length, happening, upcoming, ended };
  }, [events]);

  // Filtered & Sorted events
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    let list = events;

    // 1. Time status filter
    if (timeFilter !== 'ALL') {
      list = list.filter((ev) => getGameEventTimeStatus(ev, now) === timeFilter);
    }

    // 2. Game slug filter
    if (selectedGameSlug !== 'all') {
      list = list.filter((ev) => ev.game_slug === selectedGameSlug);
    }

    // 3. Search query (event title or game name)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (ev) =>
          ev.title.toLowerCase().includes(q) ||
          ev.game_name.toLowerCase().includes(q) ||
          (ev.related_code && ev.related_code.toLowerCase().includes(q))
      );
    }

    // 4. Default sorting: HAPPENING ending soonest first -> UPCOMING starting soonest -> ENDED
    return sortGameEvents(list, now);
  }, [events, timeFilter, selectedGameSlug, searchQuery]);

  // Handle Copy code
  const handleCopyCode = (code: string) => {
    if (!code) return;
    try {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      onShowToast('Đã sao chép mã!', `Giftcode "${code}" đã được lưu vào bộ nhớ tạm.`, 'success');
      setTimeout(() => setCopiedCode(null), 3000);
    } catch {
      onShowToast('Lỗi sao chép', 'Vui lòng sao chép thủ công.', 'error');
    }
  };

  // Render Source Badge
  const renderSourceBadge = (type: GameEventSourceType, name: string) => {
    switch (type) {
      case 'FANPAGE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-bold">
            <Radio className="w-3 h-3 text-blue-400" />
            <span>Fanpage: {name}</span>
          </span>
        );
      case 'GROUP':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[11px] font-bold">
            <Users className="w-3 h-3 text-purple-400" />
            <span>Group: {name}</span>
          </span>
        );
      case 'WEB':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
            <Globe className="w-3 h-3 text-emerald-400" />
            <span>Web: {name}</span>
          </span>
        );
    }
  };

  // Render Time Status Badge
  const renderTimeStatusBadge = (event: GameEventItem) => {
    const timeStatus = getGameEventTimeStatus(event);

    if (event.is_no_end_date) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black shadow-xs">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Chưa rõ hạn</span>
        </span>
      );
    }

    switch (timeStatus) {
      case 'HAPPENING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-black shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Đang diễn ra</span>
          </span>
        );
      case 'UPCOMING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-black shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span>Sắp tới</span>
          </span>
        );
      case 'ENDED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-700/50 border border-slate-600/50 text-slate-400 text-xs font-bold">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Đã kết thúc</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Context Distinction */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 border border-amber-500/20 p-5 sm:p-7 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>SỰ KIỆN GAME & KHUYẾN MÃI NGOÀI GAME</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Sự Kiện Game Mới Nhất 2026</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Tổng hợp sự kiện có thời hạn từ Fanpage, Group cộng đồng và Website chính thức của game. Tóm tắt nhanh cách tham gia, hạn nhận quà và link tham gia trực tiếp.
            </p>
          </div>

          {/* Quick Counter */}
          <div className="flex items-center gap-3 bg-slate-900/80 p-3 sm:p-4 rounded-2xl border border-white/10 shrink-0 self-start md:self-auto">
            <div className="text-center px-3">
              <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                {counts.all}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Sự Kiện</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center px-3">
              <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                {counts.happening}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Đang Diễn Ra</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-card/60 border border-border/80 p-3 sm:p-4 rounded-2xl backdrop-blur-md">
        {/* Status Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setTimeFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
              timeFilter === 'ALL'
                ? 'bg-primary text-white shadow-md'
                : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            Tất Cả ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter('HAPPENING')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
              timeFilter === 'HAPPENING'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-muted/50 hover:bg-muted text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Đang Diễn Ra ({counts.happening})
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter('UPCOMING')}
            className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
              timeFilter === 'UPCOMING'
                ? 'bg-sky-600 text-white shadow-md'
                : 'bg-muted/50 hover:bg-muted text-sky-400 hover:text-sky-300'
            }`}
          >
            <Calendar className="w-3 h-3" />
            Sắp Tới ({counts.upcoming})
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter('ENDED')}
            className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
              timeFilter === 'ENDED'
                ? 'bg-slate-700 text-white shadow-md'
                : 'bg-muted/50 hover:bg-muted text-slate-400 hover:text-slate-300'
            }`}
          >
            <Clock className="w-3 h-3" />
            Đã Kết Thúc ({counts.ended})
          </button>
        </div>

        {/* Search & Game Select */}
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          {/* Game Dropdown */}
          <select
            value={selectedGameSlug}
            onChange={(e) => setSelectedGameSlug(e.target.value)}
            className="w-40 sm:w-48 bg-background border border-border rounded-xl px-2.5 py-2 text-xs font-semibold text-foreground focus:outline-hidden focus:border-primary truncate"
          >
            <option value="all">🎮 Tất cả tựa game</option>
            {gameOptions.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo sự kiện, game..."
              className="w-full bg-background border border-border rounded-xl pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* 3. Event Cards Grid */}
      {filteredEvents.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-card/40 border border-border/60 rounded-3xl p-6">
          <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
            <Zap className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">Không tìm thấy sự kiện phù hợp</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Thử thay đổi bộ lọc trạng thái thời gian hoặc tìm kiếm bằng tên tựa game khác.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map((event) => {
            const timeStatus = getGameEventTimeStatus(event);
            const isEnded = timeStatus === 'ENDED';

            return (
              <div
                key={event.id}
                className={`flex flex-col justify-between rounded-3xl border bg-card/90 transition-all duration-200 overflow-hidden shadow-md hover:shadow-xl ${
                  isEnded
                    ? 'border-border/60 opacity-80'
                    : 'border-border/80 hover:border-amber-500/50'
                }`}
              >
                {/* Card Header: Game Logo + Name + Badges */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    {/* Game Logo & Info */}
                    <div
                      className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
                      onClick={() => onSelectGameSlug && onSelectGameSlug(event.game_slug)}
                      title={`Xem chi tiết & mã của game ${event.game_name}`}
                    >
                      <img
                        src={event.game_icon || `/game_icons/${event.game_slug}.webp`}
                        alt={event.game_name}
                        className="w-11 h-11 rounded-2xl object-cover ring-1 ring-border group-hover:ring-primary shadow-sm shrink-0 bg-slate-900"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.endsWith('.webp')) {
                            target.src = `/game_icons/${event.game_slug}.webp`;
                          }
                        }}
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-black text-foreground group-hover:text-primary transition-colors truncate block">
                          {event.game_name}
                        </span>
                        <div className="mt-0.5">{renderSourceBadge(event.source_type, event.source_name)}</div>
                      </div>
                    </div>

                    {/* Time Status Badge */}
                    <div className="shrink-0">{renderTimeStatusBadge(event)}</div>
                  </div>

                  {/* Event Title */}
                  <h3 className="text-sm sm:text-base font-black text-foreground line-clamp-2 leading-snug">
                    {event.title}
                  </h3>

                  {/* Time Range */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/40">
                    <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                    {event.is_no_end_date ? (
                      <span className="font-semibold text-amber-400">Thời gian: Chưa rõ hạn kết thúc</span>
                    ) : (
                      <span className="font-mono text-[11px] truncate">
                        {formatDateTimeVN(event.start_time)} ➔ {formatDateTimeVN(event.end_time)}
                      </span>
                    )}
                  </div>

                  {/* How to join (Participation instructions) */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-primary-light uppercase tracking-wide">
                      Cách tham gia:
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 bg-background/50 p-2.5 rounded-xl border border-border/40">
                      {event.how_to_join}
                    </p>
                  </div>

                  {/* Related Code (if official code exists) */}
                  {event.related_code ? (
                    <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-[11px] font-bold text-amber-300">Code:</span>
                        <code className="text-xs font-black font-mono text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded-md truncate">
                          {event.related_code}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(event.related_code!)}
                        className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                      >
                        {copiedCode === event.related_code ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Sao chép</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Card Footer: 2 Action Buttons */}
                <div className="p-4 sm:p-5 pt-0 grid grid-cols-2 gap-2 border-t border-border/40 mt-3 pt-3">
                  {/* Button 1: Xem code trên web */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectGameSlug) {
                        onSelectGameSlug(event.game_slug);
                      } else {
                        window.location.href = `/${event.game_slug}`;
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-bold transition-all active:scale-95 cursor-pointer truncate"
                    title={`Xem danh sách giftcode game ${event.game_name} trên CodeGame.shop`}
                  >
                    <Gift className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Xem code trên web</span>
                  </button>

                  {/* Button 2: Sự kiện chính thức (opens source_url) */}
                  <a
                    href={event.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-bold transition-all active:scale-95 cursor-pointer truncate"
                    title={`Mở bài đăng sự kiện chính thức tại ${event.source_name}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">Sự kiện chính thức</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
