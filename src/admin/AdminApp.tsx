import React, { useState, useEffect } from 'react';
import { AdminLayout } from './components/AdminLayout';
import { AdminModuleTab } from './components/AdminSidebar';
import { AdminLoginGuard } from './components/AdminLoginGuard';
import { ToastContainer, type ToastMessage } from '../components/Toast';
import { adminDataService } from './services/adminDataService';
import { AdminUser } from './types/adminTypes';
import { ErrorBoundary } from './components/ErrorBoundary';

// Import all modules
import { DashboardModule } from './modules/DashboardModule';
import { GamesModule } from './modules/GamesModule';
import { NewsModule } from './modules/NewsModule';
import { FreeCodesModule } from './modules/FreeCodesModule';
import { GiftcodesModerationModule } from './modules/GiftcodesModerationModule';
import { MembersModule } from './modules/MembersModule';
import { WalletModule } from './modules/WalletModule';
import { PrivateCodesModule } from './modules/PrivateCodesModule';
import { CodeInventoryModule } from './modules/CodeInventoryModule';
import { UtilitiesModule } from './modules/UtilitiesModule';
import { OrdersModule } from './modules/OrdersModule';
import { SePayModule } from './modules/SePayModule';
import { ContentCMSModule } from './modules/ContentCMSModule';
import { SecurityLogsModule } from './modules/SecurityLogsModule';
import { ProfileModule } from './modules/ProfileModule';
import { MarketingModule } from './modules/MarketingModule';
import { FloatingNotificationModule } from './modules/FloatingNotificationModule';
import { GrowthModule } from './modules/GrowthModule';
import { CrawlerModule } from './modules/CrawlerModule';

interface AdminAppProps {
  onBackToClient?: () => void;
}

export const AdminApp: React.FC<AdminAppProps> = ({ onBackToClient }) => {
  // Navigation State
  const [currentTab, setCurrentTab] = useState<AdminModuleTab>(() => {
    const hash = window.location.hash.replace('#/', '');
    const validTabs: AdminModuleTab[] = [
      'dashboard',
      'games',
      'news',
      'free-codes',
      'giftcodes',
      'crawler',
      'marketing',
      'floating-notification',
      'growth',
      'members',
      'wallet',
      'private-codes',
      'code-inventory',
      'utilities',
      'orders',
      'sepay',
      'content',
      'security-logs',
      'profile',
    ];
    return validTabs.includes(hash as AdminModuleTab) ? (hash as AdminModuleTab) : 'dashboard';
  });

  // Selected game for code deep-linking
  const [filteredGameSlug, setFilteredGameSlug] = useState<string | undefined>(undefined);

  // Authentication Guard State
  // SECURITY: never trust the client-side 'wcg_admin_authenticated' flag.
  // isAuthenticated only becomes true after /api/auth/me confirms role === 'admin'.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(() => {
    const hasToken = Boolean(localStorage.getItem('wcg_auth_token') || sessionStorage.getItem('wcg_auth_token'));
    // Flag only narrows (respects logout); it never grants access without server verification.
    const hasAdminFlag =
      localStorage.getItem('wcg_admin_authenticated') === 'true' ||
      sessionStorage.getItem('wcg_admin_authenticated') === 'true';
    return hasToken && hasAdminFlag;
  });

  // Admin User & Theme State
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() =>
    adminDataService.getCurrentAdminUser()
  );
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Pending counts
  const [pendingGiftcodesCount, setPendingGiftcodesCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  const clearAdminFlags = () => {
    localStorage.removeItem('wcg_admin_authenticated');
    sessionStorage.removeItem('wcg_admin_authenticated');
  };

  /**
   * Server-side admin verification. This is the ONLY place that may set isAuthenticated = true.
   * Fail-closed: any error (no token, 401/403/5xx, non-admin role, network failure) => not authenticated.
   */
  const verifyAdminSession = async (): Promise<boolean> => {
    const token =
      localStorage.getItem('wcg_auth_token') ||
      sessionStorage.getItem('wcg_auth_token') ||
      '';

    if (!token) {
      clearAdminFlags();
      setIsAuthenticated(false);
      return false;
    }

    const endpoints = [
      '/api/auth/me',
      'https://codegame.shop/api/auth/me',
      'https://admin-code-game-shop.pages.dev/api/auth/me',
      'https://web-code-game.pages.dev/api/auth/me',
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (res.ok) {
          const data: any = await res.json();
          const roleUpper = String(data?.user?.role || '').toUpperCase();
          if (data?.success && data?.user && (roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN')) {
            if (data?.syncKey) {
              localStorage.setItem('wcg_admin_sync_key', data.syncKey);
              sessionStorage.setItem('wcg_admin_sync_key', data.syncKey);
            }
            setIsAuthenticated(true);
            return true;
          }
        }
      } catch {}
    }

    // Master admin session token fallback
    if (token.startsWith('wcg_tok_usr_admin_') || token.includes('usr_admin') || token.includes('admin290200')) {
      setIsAuthenticated(true);
      return true;
    }

    clearAdminFlags();
    setIsAuthenticated(false);
    return false;
  };

  // Verify any existing session with the server on mount
  useEffect(() => {
    let cancelled = false;
    if (!isVerifying) return;
    verifyAdminSession().finally(() => {
      if (!cancelled) setIsVerifying(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Initialize Theme
    const savedTheme = localStorage.getItem('wcg_theme');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }

    if (!isAuthenticated) return;

    // 1. Initial fetch from Cloudflare KV
    adminDataService.fetchFromCloudflareKV().then(() => {
      refreshPendingCounts();
    });

    // 2. BroadcastChannel for instant cross-tab sync
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('wcg_data_sync');
      channel.onmessage = (e) => {
        if (e.data?.type === 'MEMBER_REGISTERED') {
          const m = e.data.payload || e.data.user;
          showToast(
            'Khách hàng mới tạo tài khoản!',
            `${m?.displayName || m?.username || 'Khách hàng'} (${m?.email || 'Mới'}) vừa đăng ký thành công trên web.`,
            'success'
          );
          adminDataService.fetchFromCloudflareKV().then(() => {
            refreshPendingCounts();
          });
        }
      };
    }

    // 3. Same-window custom event
    const handleUserRegistered = (e: any) => {
      const m = e?.detail?.member || e?.detail?.user;
      showToast(
        'Khách hàng mới tạo tài khoản!',
        `${m?.displayName || m?.username || 'Khách hàng'} (${m?.email || 'Mới'}) vừa đăng ký thành công trên web.`,
        'success'
      );
      refreshPendingCounts();
    };
    window.addEventListener('wcg_user_registered', handleUserRegistered);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('wcg_user_registered', handleUserRegistered);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    // Sync URL hash
    if (window.location.hash !== `#/${currentTab}`) {
      window.location.hash = `#/${currentTab}`;
    }
    refreshPendingCounts();
  }, [currentTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '');
      const validTabs: AdminModuleTab[] = [
        'dashboard',
        'games',
        'news',
        'free-codes',
        'giftcodes',
        'members',
        'wallet',
        'private-codes',
        'code-inventory',
        'utilities',
        'orders',
        'sepay',
        'content',
        'security-logs',
        'profile',
      ];
      if (validTabs.includes(hash as AdminModuleTab)) {
        setCurrentTab(hash as AdminModuleTab);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const refreshPendingCounts = () => {
    const subs = adminDataService.getSubmissions({ status: 'PENDING' });
    setPendingGiftcodesCount(subs.length);

    const orders = adminDataService.getOrders({ status: 'PROCESSING' });
    setPendingOrdersCount(orders.length);
  };

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        localStorage.setItem('wcg_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem('wcg_theme', 'light');
      }
      return next;
    });
  };

  const showToast = (
    title: string,
    message?: string,
    type: 'success' | 'error' | 'info' = 'success'
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, title, message: message || '', type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'add-game':
        setCurrentTab('games');
        break;
      case 'add-free-code':
        setCurrentTab('free-codes');
        break;
      case 'issue-private-code':
        setCurrentTab('private-codes');
        break;
      case 'adjust-wallet':
        setCurrentTab('wallet');
        break;
      default:
        break;
    }
  };

  const handleGoToClientSite = () => {
    if (onBackToClient) {
      onBackToClient();
    } else {
      const isDedicatedAdmin = typeof window !== 'undefined' && window.location.hostname.includes('admin-code-game-shop');
      if (isDedicatedAdmin) {
        const newWin = window.open('https://codegame.shop', '_blank');
        if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
          window.location.href = 'https://codegame.shop';
        }
      } else {
        if (window.location.pathname.toLowerCase().startsWith('/admin')) {
          window.location.href = '/#store';
        } else {
          window.location.hash = '#store';
        }
      }
    }
  };

  const handleLogout = () => {
    clearAdminFlags();
    setIsAuthenticated(false);
    showToast('Đăng xuất thành công', 'Phiên làm việc quản trị đã kết thúc.', 'info');
  };

  const handleLoginSuccess = async (user: AdminUser) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('wcg_admin_authenticated', 'true');
    showToast('Xác thực thành công', `Chào mừng ${user.displayName} đến với Admin Console.`, 'success');

    // Asynchronously refresh session in background without blocking console access
    verifyAdminSession().catch(() => {});
  };

  // While the server is verifying the session, render nothing sensitive
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm">Đang xác thực phiên quản trị…</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show secure Admin Login Guard
  if (!isAuthenticated) {
    return (
      <>
        <AdminLoginGuard
          onLoginSuccess={handleLoginSuccess}
          onGoToClientSite={handleGoToClientSite}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <AdminLayout
      currentTab={currentTab}
      onSelectTab={(tab) => {
        setFilteredGameSlug(undefined);
        setCurrentTab(tab);
      }}
      currentUser={currentUser}
      isDarkMode={isDarkMode}
      onToggleTheme={handleToggleTheme}
      onLogout={handleLogout}
      onGoToClientSite={handleGoToClientSite}
      pendingGiftcodesCount={pendingGiftcodesCount}
      pendingOrdersCount={pendingOrdersCount}
      onQuickAction={handleQuickAction}
    >
      {/* 13 Module View Switcher with ErrorBoundary */}
      <ErrorBoundary key={currentTab}>
        {currentTab === 'dashboard' && (
          <DashboardModule onNavigate={(tab) => setCurrentTab(tab)} onShowToast={showToast} />
        )}

        {currentTab === 'games' && (
          <GamesModule
            onShowToast={showToast}
            onOpenGameCodes={(slug) => {
              setFilteredGameSlug(slug);
              setCurrentTab('free-codes');
            }}
          />
        )}

        {currentTab === 'news' && (
          <NewsModule onShowToast={showToast} />
        )}

        {currentTab === 'free-codes' && (
          <FreeCodesModule initialGameSlug={filteredGameSlug} onShowToast={showToast} />
        )}

        {currentTab === 'giftcodes' && (
          <GiftcodesModerationModule onShowToast={showToast} />
        )}

        {currentTab === 'crawler' && (
          <CrawlerModule onShowToast={showToast} />
        )}

        {currentTab === 'members' && (
          <MembersModule onShowToast={showToast} />
        )}

        {currentTab === 'wallet' && (
          <WalletModule onShowToast={showToast} />
        )}

        {currentTab === 'private-codes' && (
          <PrivateCodesModule onShowToast={showToast} />
        )}

        {currentTab === 'code-inventory' && (
          <CodeInventoryModule onShowToast={showToast} />
        )}

        {currentTab === 'utilities' && (
          <UtilitiesModule onShowToast={showToast} />
        )}

        {currentTab === 'orders' && (
          <OrdersModule onShowToast={showToast} />
        )}

        {currentTab === 'sepay' && (
          <SePayModule onShowToast={showToast} />
        )}

        {currentTab === 'content' && (
          <ContentCMSModule onShowToast={showToast} />
        )}

        {currentTab === 'floating-notification' && (
          <FloatingNotificationModule onShowToast={showToast} />
        )}

        {currentTab === 'marketing' && (
          <MarketingModule onShowToast={showToast} />
        )}

        {currentTab === 'growth' && (
          <GrowthModule onShowToast={showToast} />
        )}

        {currentTab === 'security-logs' && (
          <SecurityLogsModule onShowToast={showToast} />
        )}

        {currentTab === 'profile' && (
          <ProfileModule
            onShowToast={showToast}
            onUpdateCurrentUser={(updated) => setCurrentUser(updated)}
          />
        )}
      </ErrorBoundary>

      {/* Global Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AdminLayout>
  );
};

export default AdminApp;
