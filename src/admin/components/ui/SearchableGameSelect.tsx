import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Gamepad2, Sparkles } from 'lucide-react';
import { GameAdminRecord } from '../../types/adminTypes';
import { smartVietnameseMatch } from '../../../utils/textUtils';

export interface SearchableGameSelectProps {
  games: GameAdminRecord[];
  selectedGameSlug: string;
  onSelectGame: (game: GameAdminRecord | any) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  allowClear?: boolean;
  clearLabel?: string;
  dropdownAlign?: 'left' | 'right';
}

export const SearchableGameSelect: React.FC<SearchableGameSelectProps> = ({
  games,
  selectedGameSlug,
  onSelectGame,
  label = 'Chọn Tựa Game',
  required = false,
  disabled = false,
  className = '',
  placeholder = 'Chọn tựa game...',
  allowClear = false,
  clearLabel = 'Tự động nhận diện (Fuzzy match)',
  dropdownAlign = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected game by slug or id
  const selectedGame = useMemo(() => {
    if (!selectedGameSlug) return null;
    return games.find((g) => g.slug === selectedGameSlug || g.id === selectedGameSlug) || null;
  }, [games, selectedGameSlug]);

  // Filter games with smart Vietnamese search (supports diacritics, non-diacritics & acronyms)
  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return games;
    return games.filter((g) =>
      smartVietnameseMatch([g.name, g.slug, g.publisher, g.category], searchQuery)
    );
  }, [games, searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Autofocus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Keyboard navigation: Escape closes
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {label && (
        <label className="text-xs font-bold text-slate-300 block mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Main trigger button */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full rounded-xl border p-2 text-xs flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-slate-900 text-white'
            : 'border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-200'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedGame ? (
            <>
              <div className="w-6 h-6 rounded-lg bg-slate-800 overflow-hidden border border-slate-700 shrink-0 flex items-center justify-center">
                <img
                  src={selectedGame.icon_url || `/game_icons/${selectedGame.slug}.webp`}
                  alt={selectedGame.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = '/vite.svg';
                  }}
                />
              </div>
              <div className="min-w-0 flex-1 truncate">
                <span className="font-bold text-white truncate block">
                  {selectedGame.name}
                </span>
                {selectedGame.publisher && (
                  <span className="text-[10px] text-slate-400 truncate block">
                    {selectedGame.publisher}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <Gamepad2 className="w-4 h-4 text-slate-500" />
              <span className="truncate">{placeholder}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {allowClear && selectedGame && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectGame(null);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Bỏ chọn / Đặt về tự động nhận diện"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-400' : ''
            }`}
          />
        </div>
      </div>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 z-50 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-80 ${
            dropdownAlign === 'right'
              ? 'right-0 sm:left-auto sm:right-0 sm:w-[360px] min-w-full'
              : 'left-0 sm:right-auto sm:left-0 sm:w-[360px] min-w-full'
          }`}
        >
          {/* Search box input header */}
          <div className="p-2.5 border-b border-slate-800 bg-slate-950/90 flex items-center gap-2">
            <Search className="w-4 h-4 text-indigo-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Gõ tên game (VD: Đấu La, Liên Quân, Võ Lâm, dldl, lq...)..."
              className="w-full bg-transparent text-xs text-white focus:outline-none placeholder:text-slate-500 font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-md text-slate-400 hover:text-white cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="text-[10px] font-mono text-slate-400 font-semibold shrink-0 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              {filteredGames.length}
            </span>
          </div>

          {/* List of games */}
          <div className="overflow-y-auto p-1.5 space-y-0.5 max-h-60 divide-y divide-slate-800/40">
            {/* Clear / Auto-detect option at top */}
            {allowClear && (
              <button
                type="button"
                onClick={() => {
                  onSelectGame(null);
                  setIsOpen(false);
                }}
                className={`w-full p-2 rounded-xl text-left text-xs flex items-center justify-between gap-2.5 transition-colors cursor-pointer mb-1 border border-dashed ${
                  !selectedGame
                    ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200 font-bold'
                    : 'border-slate-800 hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0 flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold block truncate text-slate-200">
                      {clearLabel}
                    </span>
                    <span className="text-[10px] text-slate-400 block truncate">
                      Crawler tự động khớp tựa game theo nội dung bài viết
                    </span>
                  </div>
                </div>
                {!selectedGame && (
                  <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                )}
              </button>
            )}

            {filteredGames.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-slate-400 space-y-1">
                <Gamepad2 className="w-6 h-6 mx-auto text-slate-600 mb-1" />
                <p>Không tìm thấy game nào khớp với</p>
                <p className="font-semibold text-slate-200 font-mono">
                  "{searchQuery}"
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Hỗ trợ tìm tiếng Việt có dấu, không dấu hoặc viết tắt (VD: vltk, lq, ff...)
                </p>
              </div>
            ) : (
              filteredGames.map((game) => {
                const isSelected = game.slug === selectedGameSlug || game.id === selectedGameSlug;
                return (
                  <button
                    key={game.id || game.slug}
                    type="button"
                    onClick={() => {
                      onSelectGame(game);
                      setIsOpen(false);
                    }}
                    className={`w-full p-2 rounded-xl text-left text-xs flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/60 text-indigo-200 font-bold border border-indigo-500/40'
                        : 'hover:bg-slate-800/70 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 overflow-hidden border border-slate-700 shrink-0 flex items-center justify-center">
                        <img
                          src={game.icon_url || `/game_icons/${game.slug}.webp`}
                          alt={game.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = '/vite.svg';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-white block truncate">
                          {game.name}
                        </span>
                        {game.publisher && (
                          <span className="text-[10px] text-slate-400 block truncate">
                            {game.publisher}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
