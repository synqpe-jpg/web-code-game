import React from 'react';
import { Flame, Sparkles, Gift, Bookmark, Layers, ArrowUpDown, Filter } from 'lucide-react';
import type { FilterState } from '../types/game';
import { useLanguage } from '../context/LanguageContext';

interface CategoryFilterProps {
  filter: FilterState;
  onFilterChange: (newFilter: Partial<FilterState>) => void;
  categories: string[];
  totalResults: number;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  filter,
  onFilterChange,
  categories,
  totalResults,
}) => {
  const { t } = useLanguage();

  const mainTags: { id: FilterState['tag']; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: t.filter.all, icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'hot', label: t.filter.hot, icon: <Flame className="w-3.5 h-3.5 text-accent" /> },
    { id: 'new', label: t.filter.new, icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'has_codes', label: t.filter.hasCodes, icon: <Gift className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'bookmarked', label: t.filter.bookmarked, icon: <Bookmark className="w-3.5 h-3.5 text-primary-light" /> },
  ];

  return (
    <div className="space-y-2.5 mb-4 sm:mb-6">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Main Tag Pills with Right Fade Hint */}
        <div className="relative flex-1 min-w-0 overflow-hidden w-full max-w-full">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full max-w-full">
            {mainTags.map((tag) => {
              const isActive = filter.tag === tag.id;
              return (
                <button
                  key={tag.id}
                  onClick={() => onFilterChange({ tag: tag.id })}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer active:scale-95 ${
                    isActive
                      ? 'bg-primary text-white shadow-glow-primary'
                      : 'bg-card hover:bg-card-hover border border-border text-slate-300 hover:text-white'
                  }`}
                >
                  {tag.icon}
                  <span>{tag.label}</span>
                </button>
              );
            })}
          </div>
          {/* Subtle Fade on mobile right edge */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent sm:hidden z-10" />
        </div>

        {/* Controls Section: Category Dropdown + Sort + Count */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 text-xs shrink-0">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-card border border-border rounded-lg sm:rounded-xl px-2 sm:px-2.5 py-1.5 shadow-sm">
            <Filter className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-secondary shrink-0" />
            <select
              value={filter.category}
              onChange={(e) => onFilterChange({ category: e.target.value })}
              className="bg-transparent text-[11px] sm:text-xs text-foreground font-semibold focus:outline-none cursor-pointer max-w-[105px] sm:max-w-none truncate"
              aria-label={t.filter.allCategories}
            >
              <option value="all" className="bg-card text-foreground">
                {t.filter.allCategories}
              </option>
              {categories.map((cat) => (
                <option key={cat} value={cat} className="bg-card text-foreground">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-card border border-border rounded-lg sm:rounded-xl px-2 sm:px-2.5 py-1.5 shadow-sm">
            <ArrowUpDown className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-primary-light shrink-0" />
            <select
              value={`${filter.sortBy}-${filter.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-') as [
                  FilterState['sortBy'],
                  FilterState['sortOrder']
                ];
                onFilterChange({ sortBy, sortOrder });
              }}
              className="bg-transparent text-[11px] sm:text-xs text-foreground font-semibold focus:outline-none cursor-pointer max-w-[105px] sm:max-w-none truncate"
              aria-label="Sắp xếp danh sách game"
            >
              <option value="updated-desc" className="bg-card text-foreground">
                {t.filter.sortUpdated}
              </option>
              <option value="popular-desc" className="bg-card text-foreground">
                {t.filter.sortPopular}
              </option>
              <option value="codes_count-desc" className="bg-card text-foreground">
                {t.filter.sortCodes}
              </option>
              <option value="release_date-desc" className="bg-card text-foreground">
                {t.filter.sortRelease}
              </option>
              <option value="name-asc" className="bg-card text-foreground">
                {t.filter.sortName}
              </option>
              <option value="rating-desc" className="bg-card text-foreground">
                {t.filter.sortRating}
              </option>
              <option value="license_date-desc" className="bg-card text-foreground">
                {t.filter.sortLicense}
              </option>
            </select>
          </div>

          {/* Total Count Badge */}
          <span className="text-[11px] sm:text-xs text-slate-300 font-mono bg-muted/60 px-2 py-1.5 rounded-lg border border-border/60 shrink-0 whitespace-nowrap">
            <strong className="text-foreground">{totalResults}</strong> {t.filter.gamesFound}
          </span>
        </div>
      </div>
    </div>
  );
};
