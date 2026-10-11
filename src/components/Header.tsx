import React, { useState, useEffect, useRef } from 'react';
import {
  Bookmark,
  PlusCircle,
  Moon,
  Sun,
  Gift,
  ShoppingBag,
  Sparkles,
  ShieldAlert,
  Wallet,
  Package,
  User,
  LogOut,
  Wrench,
  Newspaper,
} from 'lucide-react';
import type { GameItem, UserProfile } from '../types/game';
import { formatCore } from '../utils/textUtils';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { growthService } from '../services/growthService';

interface HeaderProps {
  currentTab: 'catalog' | 'news' | 'giveaways' | 'store' | 'utilities';
  onSelectTab: (tab: 'catalog' | 'news' | 'giveaways' | 'store' | 'utilities') => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  bookmarkCount: number;
  onOpenBookmarks: () => void;
  onOpenSubmitCode: () => void;
  onOpenPlayground: () => void;
  onOpenAuth: () => void;
  onOpenWallet: () => void;
  onOpenReceivedCodes: () => void;
  onOpenProfile?: () => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
  onToggleTheme: () => void;
  allGames?: GameItem[];
  onSelectGame?: (game: GameItem) => void;
  branding?: {
    logoUrl?: string;
    avatarUrl?: string;
    backgroundUrl?: string;
    backgroundStyle?: string;
    backgroundOpacity?: number;
    siteTitle?: string;
  };
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  bookmarkCount,
  onOpenBookmarks,
  onOpenSubmitCode,
  onOpenPlayground,
  onOpenAuth,
  onOpenWallet,
  onOpenReceivedCodes,
  onOpenProfile,
  currentUser,
  onLogout,
  isDarkMode,
  onToggleTheme,
  branding,
}) => {
  const { t } = useLanguage();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [isGrowthEnabled, setIsGrowthEnabled] = useState(() => {
    try {
      return Boolean(growthService.getConfig().isEnabled);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleConfigUpdate = (e?: any) => {
      try {
        const cfg = e?.detail || growthService.getConfig();
        setIsGrowthEnabled(Boolean(cfg?.isEnabled));
      } catch {
        setIsGrowthEnabled(false);
      }
    };

    // Eagerly sync latest growth config from server KV/D1
    growthService.fetchFreshConfigFromServer()
      .then((cfg) => {
        setIsGrowthEnabled(Boolean(cfg?.isEnabled));
      })
      .catch(() => {});

    window.addEventListener('wcg_growth_config_updated', handleConfigUpdate);
    window.addEventListener('storage', handleConfigUpdate);
    return () => {
      window.removeEventListener('wcg_growth_config_updated', handleConfigUpdate);
      window.removeEventListener('storage', handleConfigUpdate);
    };
  }, []);

  // Click outside listener for User dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 w-full max-w-full box-border bg-background/95 backdrop-blur-md border-b border-border shadow-md shadow-black/10 transition-all"
      style={{ position: 'sticky', top: 0, zIndex: 50 }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-18 gap-2 sm:gap-4">
          {/* 1. Brand Logo */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelectTab('catalog')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectTab('catalog');
              }
            }}
            className="flex items-center gap-2.5 group shrink-0 cursor-pointer select-none"
            aria-label="Về trang chủ tra cứu code"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-primary via-primary-hover to-accent flex items-center justify-center shadow-glow-primary group-hover:scale-105 transition-transform overflow-hidden">
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="Logo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== window.location.origin + '/logo.png') {
                      target.src = '/logo.png';
                    }
                  }}
                />
              ) : (
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-sm sm:text-lg tracking-wider text-foreground group-hover:text-primary-light transition-colors">
                  {branding?.siteTitle && branding.siteTitle.toUpperCase() !== 'WEB CODE GAME' && branding.siteTitle.toUpperCase() !== 'WEB CODE'
                    ? branding.siteTitle
                    : 'CodeGame.Shop'}
                </span>
                {branding?.siteTitle === 'WEB CODE' && (
                  <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md bg-accent/20 text-accent font-mono font-bold tracking-tight border border-accent/30">
                    GAME
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-sans hidden sm:block">
                {t.header.portalSubtitle}
              </span>
            </div>
          </div>

          {/* 2. Desktop Navigation Tabs - Always visible on PC / Tablet (md+) and pinned on scroll */}
          <nav className="hidden md:flex items-center gap-1 bg-muted/60 p-1.5 rounded-2xl border border-border/80 flex-nowrap whitespace-nowrap shrink-0 shadow-sm">
            <button
              type="button"
              onClick={() => onSelectTab('catalog')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'catalog'
                  ? 'bg-primary text-white shadow-glow-primary'
                  : 'text-slate-300 hover:text-white hover:bg-card'
              }`}
            >
              <Gift className="w-4 h-4" />
              <span>{t.nav.catalog}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('news')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'news'
                  ? 'bg-primary text-white shadow-glow-primary'
                  : 'text-slate-300 hover:text-white hover:bg-card'
              }`}
            >
              <Newspaper className="w-4 h-4" />
              <span>{t.nav.news || 'Tin Tức'}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('giveaways')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'giveaways'
                  ? 'bg-accent text-white shadow-glow-accent'
                  : 'text-slate-300 hover:text-white hover:bg-card'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{t.nav.giveaways}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('store')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'store'
                  ? 'bg-secondary text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-card'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-secondary" />
              <span>{t.nav.store}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('utilities')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'utilities'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-card'
              }`}
            >
              <Wrench className="w-4 h-4 text-teal-400" />
              <span>{t.nav.utilities}</span>
            </button>
          </nav>

          {/* 3. Actions Toolbar: Săn Quà, Language, Bookmark, Account */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Săn Quà & Vòng Quay Button */}
            {isGrowthEnabled && (
              <button
                onClick={onOpenPlayground}
                className="relative flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-amber-500/15 hover:from-amber-500/25 hover:to-rose-500/25 border border-amber-500/40 text-amber-300 font-extrabold text-xs transition-all active:scale-95 shadow-sm cursor-pointer group"
                title="Săn Quà Tân Thủ, Vòng Quay May Mắn & Mời Bạn Nhận Hoa Hồng"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform animate-pulse" />
                <span className="hidden xs:inline">Săn Quà</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-sm">
                  FREE
                </span>
              </button>
            )}

            {/* Language Selector Dropdown (Vietnamese, English, Chinese) */}
            <LanguageSelector variant="header" />

            {/* Bookmark Button (Desktop & Mobile) */}
            <button
              onClick={onOpenBookmarks}
              className="relative p-2 sm:p-2.5 min-w-[38px] min-h-[38px] sm:min-w-[42px] sm:min-h-[42px] flex items-center justify-center rounded-xl bg-card hover:bg-card-hover border border-border text-slate-300 hover:text-foreground transition-all cursor-pointer active:scale-95 shadow-sm"
              title={t.header.bookmarksTitle}
              aria-label={t.header.bookmarksTitle}
            >
              <Bookmark className="w-4 h-4 text-amber-400" />
              {bookmarkCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                  {bookmarkCount}
                </span>
              )}
            </button>

            {/* User Account / Wallet Menu */}
            <div ref={userMenuRef} className="relative">
              {currentUser ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsUserMenuOpen((prev) => !prev);
                    }}
                    className="flex items-center gap-1.5 p-1 sm:p-1.5 rounded-xl bg-card hover:bg-card-hover border border-border text-xs transition-all cursor-pointer shadow-sm active:scale-95 group"
                    title={`${currentUser.displayName || currentUser.username} • ${formatCore(currentUser.wallet_balance)}`}
                    aria-label="Tài khoản"
                  >
                    <div className="relative w-8 h-8 rounded-xl bg-primary/20 text-primary-light flex items-center justify-center overflow-hidden border border-border shrink-0">
                      {currentUser.avatar_url ? (
                        <img
                          src={currentUser.avatar_url}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <User className="w-4 h-4 text-slate-300" />
                      )}
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-card" />
                    </div>
                  </button>

                  {isUserMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-64 bg-card border border-border/90 rounded-2xl shadow-2xl p-2 z-[100] animate-scale-in text-xs space-y-1"
                    >
                      {/* User Info Header - Clickable to open Profile */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsUserMenuOpen(false);
                          if (onOpenProfile) onOpenProfile();
                        }}
                        className="w-full p-2.5 border-b border-border/60 flex items-start gap-2.5 rounded-xl hover:bg-primary/10 transition-colors text-left cursor-pointer group"
                        title="Xem & Chỉnh sửa thông tin nhân vật"
                      >
                        <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden border border-border shrink-0 mt-0.5 group-hover:border-primary/50 transition-colors">
                          {currentUser.avatar_url ? (
                            <img src={currentUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 m-2.5 text-muted-foreground group-hover:text-primary-light" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground truncate block text-xs group-hover:text-primary-light transition-colors">
                              {currentUser.displayName || currentUser.username}
                            </span>
                            <span className="text-[10px] text-primary-light font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                              Sửa ↗
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 truncate block mb-1">
                            {currentUser.email}
                          </span>
                          {/* Số dư ngay dưới mail */}
                          <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
                            <span className="text-[10px] text-slate-400">Số dư:</span>
                            <span className="font-mono font-bold text-emerald-400 text-xs">
                              {formatCore(currentUser.wallet_balance)}
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* 0. Thông Tin Nhân Vật & Hồ Sơ */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsUserMenuOpen(false);
                          if (onOpenProfile) onOpenProfile();
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-muted text-foreground cursor-pointer text-left group"
                      >
                        <span className="flex items-center gap-2">
                          <User className="w-4 h-4 text-primary-light group-hover:scale-110 transition-transform" />
                          <span className="font-medium">Thông Tin Nhân Vật</span>
                        </span>
                        <span className="text-[10px] text-primary-light font-bold">
                          Hồ sơ ↗
                        </span>
                      </button>

                      {/* 1. Nạp Core và Lịch Sử */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsUserMenuOpen(false);
                          onOpenWallet();
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-muted text-foreground cursor-pointer text-left group"
                      >
                        <span className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-primary-light group-hover:scale-110 transition-transform" />
                          <span className="font-medium">{t.header.wallet}</span>
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Nạp ngay
                        </span>
                      </button>

                      {/* 2. Kho mã của tôi */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsUserMenuOpen(false);
                          onOpenReceivedCodes();
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-muted text-foreground cursor-pointer text-left"
                      >
                        <Package className="w-4 h-4 text-emerald-400" />
                        <span>{t.header.myCodes}</span>
                      </button>

                      {/* 3. Vòng Quay Quà */}
                      {isGrowthEnabled && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsUserMenuOpen(false);
                            onOpenPlayground();
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-muted text-foreground cursor-pointer text-left"
                        >
                          <span className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <span>{t.header.luckyWheel}</span>
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30">
                            HOT
                          </span>
                        </button>
                      )}

                      {/* 4. Đóng Góp Code */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsUserMenuOpen(false);
                          onOpenSubmitCode();
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-muted text-foreground cursor-pointer text-left"
                      >
                        <span className="flex items-center gap-2">
                          <PlusCircle className="w-4 h-4 text-primary-light" />
                          <span>{t.header.submitCode}</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/20 text-primary-light font-semibold border border-primary/30">
                          +Core
                        </span>
                      </button>

                      {/* 5. Trang Quản Trị Admin */}
                      {(currentUser.role === 'admin' || currentUser.role === 'SUPER_ADMIN') && (
                        <a
                          href="https://admin-code-game-shop.pages.dev"
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-primary/15 text-primary-light font-bold cursor-pointer text-left"
                        >
                          <span className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-amber-400" />
                            <span>{t.header.adminPortal}</span>
                          </span>
                          <span className="text-[10px] text-primary-light">↗</span>
                        </a>
                      )}

                      {/* 6. Đăng Xuất */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-rose-500/15 text-rose-400 cursor-pointer text-left pt-1 border-t border-border/40"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{t.header.logout}</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={onOpenAuth}
                  className="flex items-center gap-1.5 px-3 py-2 min-h-[38px] sm:min-h-[42px] rounded-xl text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border transition-all cursor-pointer active:scale-95"
                >
                  <User className="w-4 h-4 text-slate-300" />
                  <span>{t.header.account}</span>
                </button>
              )}
            </div>

            {/* Theme Toggle Button (Desktop & Mobile) */}
            <button
              onClick={onToggleTheme}
              className="p-2 sm:p-2.5 min-w-[38px] min-h-[38px] sm:min-w-[42px] sm:min-h-[42px] flex items-center justify-center rounded-xl bg-card hover:bg-card-hover border border-border text-slate-300 hover:text-foreground transition-all cursor-pointer active:scale-95 shadow-sm"
              title={t.header.themeToggle}
              aria-label={t.header.themeToggle}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
