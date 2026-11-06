import React, { useState } from 'react';
import {
  LayoutDashboard,
  Gamepad2,
  Gift,
  CheckSquare,
  Users,
  Wallet,
  KeyRound,
  Package,
  ShoppingCart,
  Zap,
  Globe,
  ShieldAlert,
  UserCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Megaphone,
  BellRing,
  Rocket,
  X,
  Search,
  Bot,
  Newspaper,
  Clock,
  Mail,
  Send,
  Sparkles,
} from 'lucide-react';
import { AdminUser } from '../types/adminTypes';
import { normalizeVietnamese } from '../../utils/textUtils';

export type AdminModuleTab =
  | 'dashboard'
  | 'games'
  | 'news'
  | 'free-codes'
  | 'giftcodes'
  | 'crawler'
  | 'marketing'
  | 'floating-notification'
  | 'growth'
  | 'members'
  | 'wallet'
  | 'private-codes'
  | 'code-inventory'
  | 'utilities'
  | 'missions'
  | 'event-scheduler'
  | 'email-notifications'
  | 'telegram'
  | 'orders'
  | 'first-purchase'
  | 'sepay'
  | 'content'
  | 'api-keys'
  | 'security-logs'
  | 'profile';

interface AdminSidebarProps {
  currentTab: AdminModuleTab;
  onSelectTab: (tab: AdminModuleTab) => void;
  pendingGiftcodesCount?: number;
  pendingOrdersCount?: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentUser: AdminUser | null;
  onGoToClientSite?: () => void;
  onCloseMobile?: () => void;
}

interface NavSection {
  title: string;
  items: {
    id: AdminModuleTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }[];
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingGiftcodesCount = 0,
  pendingOrdersCount = 0,
  collapsed,
  onToggleCollapse,
  currentUser,
  onGoToClientSite,
  onCloseMobile,
}) => {
  const [navSearch, setNavSearch] = useState('');
  const sections: NavSection[] = [
    {
      title: 'TỔNG QUAN',
      items: [
        {
          id: 'dashboard',
          label: 'Tổng quan',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'NỘI DUNG & GAME',
      items: [
        {
          id: 'games',
          label: 'Quản lý Game',
          icon: Gamepad2,
        },
        {
          id: 'news',
          label: 'Tin Tức Game & Code',
          icon: Newspaper,
        },
        {
          id: 'free-codes',
          label: 'Code Miễn Phí',
          icon: Gift,
        },
        {
          id: 'giftcodes',
          label: 'Duyệt Giftcode Khách',
          icon: CheckSquare,
          badge: pendingGiftcodesCount,
          badgeColor: 'bg-amber-500 text-white',
        },
        {
          id: 'crawler',
          label: 'Crawler & Auto Sync',
          icon: Bot,
        },
        {
          id: 'content',
          label: 'Nội Dung Web',
          icon: Globe,
        },
        {
          id: 'floating-notification',
          label: 'Thông Báo Nổi',
          icon: BellRing,
        },
        {
          id: 'marketing',
          label: 'Thông Báo Marketing',
          icon: Megaphone,
        },
        {
          id: 'email-notifications',
          label: 'Thông Báo Email & Khách',
          icon: Mail,
          badge: 'MỚI',
          badgeColor: 'bg-emerald-500 text-neutral-950 font-bold',
        },
        {
          id: 'telegram',
          label: 'Tích Hợp Telegram',
          icon: Send,
          badge: 'BOT',
          badgeColor: 'bg-[#229ED9] text-white font-bold',
        },
      ],
    },
    {
      title: 'THƯƠNG MẠI & KHO',
      items: [
        {
          id: 'code-inventory',
          label: 'Kho Code & Gói Bán',
          icon: Package,
        },
        {
          id: 'utilities',
          label: 'Quản Lý Tiện Ích',
          icon: Wrench,
        },
        {
          id: 'private-codes',
          label: 'Phát Code & Giveaway',
          icon: KeyRound,
        },
        {
          id: 'event-scheduler',
          label: 'Lịch Đếm Ngược Sự Kiện',
          icon: Clock,
          badge: 'MỚI',
          badgeColor: 'bg-amber-500 text-neutral-950 font-bold',
        },
        {
          id: 'orders',
          label: 'Đơn Hàng Code',
          icon: ShoppingCart,
          badge: pendingOrdersCount,
          badgeColor: 'bg-sky-500 text-white',
        },
        {
          id: 'first-purchase',
          label: 'Ưu Đãi Mua Lần Đầu',
          icon: Sparkles,
          badge: 'HOT',
          badgeColor: 'bg-rose-500 text-white font-bold',
        },
      ],
    },
    {
      title: 'TÀI CHÍNH & NGƯỜI DÙNG',
      items: [
        {
          id: 'members',
          label: 'Thành viên',
          icon: Users,
        },
        {
          id: 'wallet',
          label: 'Quản lý Ví',
          icon: Wallet,
        },
        {
          id: 'sepay',
          label: 'Liên Kết SePay',
          icon: Zap,
        },
      ],
    },
    {
      title: 'TĂNG TRƯỞNG & NHIỆM VỤ',
      items: [
        {
          id: 'missions',
          label: 'Quản Lý Nhiệm Vụ',
          icon: CheckSquare,
        },
        {
          id: 'growth',
          label: 'Tăng Trưởng & Viral',
          icon: Rocket,
        },
      ],
    },
    {
      title: 'HỆ THỐNG & BẢO MẬT',
      items: [
        {
          id: 'api-keys',
          label: 'Quản Lý Khóa API',
          icon: KeyRound,
          badge: 'MỚI',
          badgeColor: 'bg-indigo-500 text-white font-bold',
        },
        {
          id: 'security-logs',
          label: 'Nhật Ký Bảo Mật',
          icon: ShieldAlert,
        },
        {
          id: 'profile',
          label: 'Tài Khoản Của Tôi',
          icon: UserCircle,
        },
      ],
    },
  ];

  const filteredSections = navSearch.trim()
    ? sections
        .map((sec) => ({
          ...sec,
          items: sec.items.filter((item) =>
            normalizeVietnamese(item.label).includes(normalizeVietnamese(navSearch))
          ),
        }))
        .filter((sec) => sec.items.length > 0)
    : sections;

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 overflow-hidden">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                CodeGame Admin
              </h1>
              <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                PRO PORTAL v2.5
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md overflow-hidden">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
        )}

        {onCloseMobile ? (
          <button
            onClick={onCloseMobile}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="Đóng menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}

        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title={collapsed ? 'Mở rộng menu' : 'Thu nhỏ menu'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin">
        {!collapsed && (
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              placeholder="Tìm nhanh module..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200"
            />
            {navSearch && (
              <button
                type="button"
                onClick={() => setNavSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {filteredSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {!collapsed && (
              <div className="px-3 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;

                return (
                  <React.Fragment key={item.id}>
                    <button
                      onClick={() => {
                        onSelectTab(item.id);
                        if (item.id === 'news' && currentTab !== 'news') {
                          window.location.hash = '#/news';
                          window.dispatchEvent(new CustomEvent('wcg_admin_news_subtab', { detail: 'news' }));
                        }
                      }}
                      title={collapsed ? item.label : undefined}
                      className={`group relative flex w-full items-center rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                      } ${collapsed ? 'justify-center' : 'justify-between'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`h-4 w-4 flex-shrink-0 transition-transform group-hover:scale-110 ${
                            isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500'
                          }`}
                        />
                        {!collapsed && <span>{item.label}</span>}
                      </div>

                      {item.badge && item.badge > 0 ? (
                        collapsed ? (
                          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                        ) : (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              item.badgeColor || 'bg-indigo-500 text-white'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )
                      ) : null}
                    </button>

                    {item.id === 'news' && !collapsed && (
                      <div className="ml-5 pl-2 border-l-2 border-indigo-200 dark:border-indigo-900/60 space-y-1 my-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTab('news');
                            window.location.hash = '#/news';
                            window.dispatchEvent(new CustomEvent('wcg_admin_news_subtab', { detail: 'news' }));
                          }}
                          className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                            currentTab === 'news' && (typeof window !== 'undefined' && !window.location.hash.includes('tab=events') && !window.location.hash.includes('tab=pending'))
                              ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          <Newspaper className="w-3 h-3 shrink-0" />
                          <span>Tin Tức Chuẩn SEO</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTab('news');
                            window.location.hash = '#/news?tab=events';
                            window.dispatchEvent(new CustomEvent('wcg_admin_news_subtab', { detail: 'events' }));
                          }}
                          className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                            currentTab === 'news' && (typeof window !== 'undefined' && window.location.hash.includes('tab=events'))
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 font-bold'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>Sự Kiện Game</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTab('news');
                            window.location.hash = '#/news?tab=pending';
                            window.dispatchEvent(new CustomEvent('wcg_admin_news_subtab', { detail: 'pending' }));
                          }}
                          className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                            currentTab === 'news' && (typeof window !== 'undefined' && window.location.hash.includes('tab=pending'))
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 font-bold'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          <Clock className="w-3 h-3 text-purple-500 shrink-0" />
                          <span>Hàng Chờ Duyệt</span>
                        </button>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info & Client Link */}
      <div className="border-t border-slate-100 p-3 dark:border-slate-800 space-y-2">
        {onGoToClientSite && (
          <button
            onClick={onGoToClientSite}
            className={`flex w-full items-center rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors ${
              collapsed ? 'justify-center' : 'justify-between'
            }`}
            title="Mở trang chủ khách hàng"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-indigo-500" />
              {!collapsed && <span>Trang Khách Hàng</span>}
            </div>
            {!collapsed && <span className="text-[10px] text-slate-400">↗</span>}
          </button>
        )}

        {/* User preview */}
        <div
          onClick={() => onSelectTab('profile')}
          className={`flex cursor-pointer items-center rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
            collapsed ? 'justify-center' : 'gap-3'
          }`}
        >
          <img
            src={currentUser?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin'}
            alt="Avatar"
            className="h-8 w-8 rounded-full ring-2 ring-indigo-500/30 object-cover"
          />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                {currentUser?.displayName || 'Admin Quản Trị'}
              </p>
              <p className="truncate text-[10px] text-slate-400 capitalize">
                {currentUser?.role || 'Super Admin'}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
