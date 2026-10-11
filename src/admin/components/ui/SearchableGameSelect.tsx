import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Gamepad2 } from 'lucide-react';
import { GameAdminRecord } from '../../types/adminTypes';
import { smartVietnameseMatch } from '../../../utils/textUtils';

interface SearchableGameSelectProps {
  games: GameAdminRecord[];
  selectedGameSlug: string;
  onSelectGame: (game: GameAdminRecord) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected game
  const selectedGame = useMemo(() => {
    return games.find((g) => g.slug === selectedGameSlug) || null;
  }, [games, selectedGameSlug]);

  // Filter games with smart Vietnamese search
  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return games;
    return games.filter((g) =>
      smartVietnameseMatch([g.name, g.slug, g.publisher], searchQuery)
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
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Main trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full rounded-xl border p-2 text-xs flex items-center justify-between gap-2 transition-all cursor-pointer text-left ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-800'
            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedGame ? (
            <>
              <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-slate-600 shrink-0 flex items-center justify-center">
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
                <span className="font-bold text-slate-900 dark:text-white truncate block">
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
              <Gamepad2 className="w-4 h-4" />
              <span>{placeholder}</span>
            </div>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-indigo-500' : ''
          }`}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-72">
          {/* Search box input header */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Gõ tên game (VD: Liên Quân, Free Fire, ff, lq, hsr)..."
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="text-[10px] font-mono text-slate-400 font-semibold shrink-0 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {filteredGames.length}
            </span>
          </div>

          {/* List of games */}
          <div className="overflow-y-auto p-1.5 space-y-0.5 max-h-56 divide-y divide-slate-50 dark:divide-slate-800/40">
            {filteredGames.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-slate-400 space-y-1">
                <Gamepad2 className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                <p>Không tìm thấy game nào khớp với</p>
                <p className="font-semibold text-slate-600 dark:text-slate-300 font-mono">
                  "{searchQuery}"
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Mẹo: Thử gõ không dấu hoặc viết tắt (VD: ff, lq, vltk, hsr...)
                </p>
              </div>
            ) : (
              filteredGames.map((game) => {
                const isSelected = game.slug === selectedGameSlug;
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
                        ? 'bg-indigo-50 text-indigo-900 font-bold dark:bg-indigo-950/50 dark:text-indigo-200'
                        : 'hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                        <img
                          src={game.icon_url || `/game_icons/${game.slug}.webp`}
                          alt={game.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = '/vite.svg';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">
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
                      <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
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
