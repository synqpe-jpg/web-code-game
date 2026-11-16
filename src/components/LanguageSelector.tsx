import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface LanguageSelectorProps {
  variant?: 'header' | 'footer' | 'compact' | 'pill' | 'admin';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { language, setLanguage, availableLanguages, activeLanguages, currentLanguageMeta, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (code: string) => {
    setLanguage(code);
    setIsOpen(false);
  };

  // Hiển thị danh sách ngôn ngữ: ưu tiên active (Việt, Anh), và hỗ trợ các ngôn ngữ đã kích hoạt
  const displayLanguages = activeLanguages.length > 0 ? activeLanguages : availableLanguages.slice(0, 2);

  if (variant === 'footer' || variant === 'pill') {
    return (
      <div className={`flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-full ${className}`}>
        {displayLanguages.map((lang) => {
          const isSelected = language === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-[#ee4d2d] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-[#ee4d2d] hover:bg-white dark:hover:bg-slate-700'
              }`}
              title={lang.nativeName}
            >
              <span className="text-sm leading-none">{lang.flag}</span>
              <span>{lang.nativeName}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Variant Admin (cho thanh top bar của Admin Dashboard)
  if (variant === 'admin') {
    return (
      <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          title={t?.header?.language || 'Ngôn ngữ'}
        >
          <span className="text-sm leading-none">{currentLanguageMeta.flag}</span>
          <span className="uppercase font-mono text-[11px] text-amber-400">{currentLanguageMeta.code}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${isOpen ? 'rotate-180 text-white' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-44 rounded-xl bg-neutral-900 border border-neutral-800 shadow-2xl p-1 z-50 text-xs space-y-0.5">
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-amber-400" />
              <span>{t?.header?.language || 'Ngôn ngữ'}</span>
            </div>
            {displayLanguages.map((item) => {
              const isSelected = language === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleSelect(item.code)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 text-amber-300 font-bold'
                      : 'hover:bg-neutral-800 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{item.flag}</span>
                    <span>{item.nativeName}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Variant Header & Compact
  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 sm:px-2.5 sm:py-1.5 flex items-center justify-center gap-1.5 rounded-xl bg-card hover:bg-card-hover border border-border text-slate-300 hover:text-foreground transition-all cursor-pointer active:scale-95 shadow-sm"
        title={t?.header?.language || 'Ngôn ngữ'}
        aria-label={t?.header?.language || 'Ngôn ngữ'}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="text-base leading-none sm:text-sm">{currentLanguageMeta.flag}</span>
        <span className="text-xs font-bold font-mono uppercase hidden sm:inline-block">
          {currentLanguageMeta.code}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 hidden sm:block ${
            isOpen ? 'rotate-180 text-foreground' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-44 rounded-2xl bg-card border border-border shadow-2xl p-1.5 z-50 animate-scale-in text-xs space-y-1 focus:outline-none backdrop-blur-xl"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span>{t?.header?.language || 'Ngôn ngữ'}</span>
          </div>

          <div className="py-1">
            {displayLanguages.map((item) => {
              const isSelected = language === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleSelect(item.code)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-primary/15 text-primary-light font-bold border border-primary/20'
                      : 'hover:bg-muted/80 text-foreground'
                  }`}
                  role="menuitem"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg leading-none">{item.flag}</span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold leading-tight">{item.nativeName}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{item.name}</span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
