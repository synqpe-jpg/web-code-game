import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Gift,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  Flame,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Globe,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { GameItem, GiftCode } from '../types/game';
import { dataService } from '../services/dataService';
import { marketingService } from '../services/marketingService';
import { useLanguage } from '../context/LanguageContext';
import { isG1Licensed } from '../utils/licenseUtils';

interface SearchAutocompleteProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectGame: (game: GameItem) => void;
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onExploreClick?: () => void;
  className?: string;
  autoFocus?: boolean;
}

// Deterministic gradient for game icon fallback
function getGradientForName(name: string): string {
  const gradients = [
    'from-indigo-600 via-purple-600 to-pink-600',
    'from-emerald-600 via-teal-600 to-cyan-700',
    'from-rose-600 via-pink-600 to-amber-600',
    'from-blue-600 via-indigo-600 to-cyan-600',
    'from-violet-600 via-purple-700 to-indigo-800',
    'from-amber-500 via-orange-600 to-red-600',
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  searchQuery,
  onSearchChange,
  onSelectGame,
  onShowToast,
  onExploreClick,
  className = '',
  autoFocus = false,
}) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search Results computed dynamically with instant local + server autocomplete
  const [searchResults, setSearchResults] = useState<{
    games: GameItem[];
    codes: Array<{ game: GameItem; code: GiftCode }>;
    totalMatches: number;
  }>({ games: [], codes: [], totalMatches: 0 });

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults({ games: [], codes: [], totalMatches: 0 });
      return;
    }

    // 1. Instant synchronous local results for 0ms typing response
    const local = dataService.searchAllGamesAndCodes(q, 6);
    setSearchResults(local);

    // 2. Debounced server fetch across entire 450+ games and 9000+ codes catalog
    const timer = setTimeout(async () => {
      try {
        const serverRes = await dataService.searchAllGamesAndCodesServer(q, 6);
        if (serverRes && serverRes.totalMatches > 0) {
          setSearchResults(serverRes);
        }
      } catch {}
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const hasResults = searchResults.totalMatches > 0;

  // Flattened items for keyboard navigation: games first, then codes
  const allNavItems = useMemo(() => {
    const items: Array<{ type: 'game'; data: GameItem } | { type: 'code'; data: { game: GameItem; code: GiftCode } }> = [];
    searchResults.games.forEach((g) => items.push({ type: 'game', data: g }));
    searchResults.codes.forEach((c) => items.push({ type: 'code', data: c }));
    return items;
  }, [searchResults]);

  // Global key listener to press '/' to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement !== inputRef.current &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Quick Copy from Autocomplete
  const handleCopyCode = (code: string, gameName: string, isExpired: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    dataService.recordCopyEvent(code, gameName);
    const activeUser = typeof window !== 'undefined' ? dataService.getCurrentUser() : null;
    marketingService.recordRealCopy(gameName, '', 1, activeUser);
    setCopiedCodeKey(`${gameName}_${code}`);

    if (onShowToast) {
      if (isExpired) {
        onShowToast(t.modal.copySuccess, `Mã "${code}" (${gameName}) có thể đã hết hạn.`, 'info');
      } else {
        onShowToast(t.modal.copySuccess, `Đã sao chép mã "${code}" cho ${gameName}!`, 'success');
      }
    }

    try {
      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.6 },
        colors: ['#10B981', '#8B5CF6', '#F59E0B'],
      });
    } catch {}

    setTimeout(() => {
      setCopiedCodeKey(null);
    }, 2000);
  };

  // Keyboard Navigation inside input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || allNavItems.length === 0) {
      if (e.key === 'ArrowDown' && searchQuery.trim()) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < allNavItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allNavItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < allNavItems.length) {
        const item = allNavItems[selectedIndex];
        if (item.type === 'game') {
          onSelectGame(item.data);
          setIsOpen(false);
        } else {
          onSelectGame(item.data.game);
          setIsOpen(false);
        }
      } else {
        // Trigger normal search submit
        setIsOpen(false);
        if (onExploreClick) onExploreClick();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelectGameItem = (game: GameItem) => {
    onSelectGame(game);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Bar Input */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-primary-light pointer-events-none transition-colors" />

        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (searchQuery.trim().length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          placeholder={t.hero.searchPlaceholder}
          className="w-full pl-10 sm:pl-12 pr-20 sm:pr-24 py-3 sm:py-3.5 rounded-2xl bg-card hover:bg-card-hover border border-border focus:border-primary focus:ring-2 focus:ring-primary/40 text-foreground text-base sm:text-sm placeholder-slate-400 shadow-xl transition-all outline-none"
        />

        {/* Right side controls: Clear / Shortcut Badge */}
        <div className="absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
              title="Xóa tìm kiếm"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-muted border border-border text-[10px] font-mono text-slate-400 shadow-sm">
              /
            </kbd>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              if (onExploreClick) onExploreClick();
            }}
            className="px-2.5 py-1 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 hidden sm:block"
          >
            {t.hero.searchBtn}
          </button>
        </div>
      </div>

      {/* Autocomplete Results Dropdown Overlay */}
      {isOpen && searchQuery.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-card/95 backdrop-blur-xl border border-border/90 rounded-2xl shadow-2xl z-50 overflow-hidden animate-scale-in text-left divide-y divide-border/60 max-h-[75vh] flex flex-col">
          {hasResults ? (
            <div className="overflow-y-auto flex-1 scrollbar-thin p-2 space-y-3">
              {/* 1. MATCHING GAMES */}
              {searchResults.games.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1.5 text-primary-light">
                      <Gift className="w-3.5 h-3.5 text-primary-light" />
                      {t.search.matchingGames} ({searchResults.games.length})
                    </span>
                    <span className="text-[10px] lowercase text-slate-500">nhấn để xem chi tiết</span>
                  </div>

                  <div className="space-y-1">
                    {searchResults.games.map((game, idx) => {
                      const isHighlighted = selectedIndex === idx;
                      const totalCodes = game.codes_count || (game.codes ? game.codes.length : 0);

                      return (
                        <div
                          key={game.id || game.slug}
                          onClick={() => handleSelectGameItem(game)}
                          className={`flex items-center justify-between gap-3 p-2 rounded-xl transition-all cursor-pointer ${
                            isHighlighted
                              ? 'bg-primary/20 border border-primary/40 text-foreground'
                              : 'hover:bg-muted/70 text-foreground border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Game Icon */}
                            <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden border border-border shrink-0 flex items-center justify-center shadow-sm">
                              <img
                                src={game.icon_url || `/game_icons/${game.slug}.webp`}
                                alt={game.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const parent = (e.target as HTMLElement).parentElement;
                                  if (parent) {
                                    parent.innerHTML = `<div class="w-full h-full bg-gradient-to-br ${getGradientForName(
                                      game.name
                                    )} flex items-center justify-center font-bold text-white text-xs">${game.name.substring(
                                      0,
                                      2
                                    )}</div>`;
                                  }
                                }}
                              />
                            </div>

                            {/* Game Details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                                  {game.name}
                                </span>
                                {game.is_hot && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                    <Flame className="w-2.5 h-2.5" /> HOT
                                  </span>
                                )}
                                {isG1Licensed(game) ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                    {t.gameCard.licensed}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                                    <Globe className="w-2.5 h-2.5 text-cyan-400" />
                                    {t.gameCard.international}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">
                                {game.publisher || 'Nhà phát hành chính thức'} • {game.category || 'Game'}
                              </p>
                            </div>
                          </div>

                          {/* Code Count Badge & Chevron */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              {totalCodes} code
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. MATCHING GIFTCODES WITH INSTANT COPY */}
              {searchResults.codes.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      {t.search.matchingCodes} ({searchResults.codes.length})
                    </span>
                    <span className="text-[10px] text-emerald-400/80 font-mono">1 chạm sao chép</span>
                  </div>

                  <div className="space-y-1.5">
                    {searchResults.codes.map((item, idx) => {
                      const globalIdx = searchResults.games.length + idx;
                      const isHighlighted = selectedIndex === globalIdx;
                      const isExpired = item.code.status === 'expired';
                      const codeKey = `${item.game.name}_${item.code.code}`;
                      const isCopied = copiedCodeKey === codeKey;

                      return (
                        <div
                          key={codeKey}
                          onClick={() => handleSelectGameItem(item.game)}
                          className={`flex items-center justify-between gap-2.5 p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isHighlighted
                              ? 'bg-emerald-500/15 border-emerald-500/50'
                              : 'bg-card/70 hover:bg-muted/80 border-border/80'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {/* Game Pill */}
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border truncate max-w-[140px]">
                                {item.game.name}
                              </span>

                              {/* Status Pill */}
                              {isExpired ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  {t.search.expired}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                  {t.search.active}
                                </span>
                              )}
                            </div>

                            {/* Code Value & Reward description */}
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-xs sm:text-sm text-emerald-300 tracking-wider">
                                {item.code.code}
                              </span>
                              {item.code.rewards && (
                                <span className="text-[11px] text-slate-400 truncate max-w-[180px] sm:max-w-[260px]">
                                  • {item.code.rewards}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Instant Fast Copy Button */}
                          <button
                            type="button"
                            onClick={(e) => handleCopyCode(item.code.code, item.game.name, isExpired, e)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-sm active:scale-95 ${
                              isCopied
                                ? 'bg-emerald-500 text-white shadow-glow-primary'
                                : 'bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/40'
                            }`}
                            title="Sao chép mã ngay"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>{t.search.copied}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>{t.search.copyCode}</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground space-y-1">
              <p className="text-xs sm:text-sm font-medium">{t.search.noResults}</p>
              <p className="text-[11px] text-slate-500">{t.search.hint}</p>
            </div>
          )}

          {/* Autocomplete Footer Bar */}
          <div className="p-2.5 bg-muted/50 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
            <span className="hidden sm:inline">
              Dùng <kbd className="px-1 py-0.5 bg-card border border-border rounded text-[10px] font-mono">↑</kbd>{' '}
              <kbd className="px-1 py-0.5 bg-card border border-border rounded text-[10px] font-mono">↓</kbd> để chọn,{' '}
              <kbd className="px-1 py-0.5 bg-card border border-border rounded text-[10px] font-mono">Enter</kbd> để mở
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onExploreClick) onExploreClick();
              }}
              className="ml-auto text-primary-light hover:text-primary font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>{t.search.viewAll}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
