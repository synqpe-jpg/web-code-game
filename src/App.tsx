import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { Header } from './components/Header';
import { AnnouncementBar } from './components/AnnouncementBar';
import { HeroBanner } from './components/HeroBanner';
import { CategoryFilter } from './components/CategoryFilter';
import { GameGrid } from './components/GameGrid';
import { GameDetailModal } from './components/GameDetailModal';
import { SubmitCodeModal } from './components/SubmitCodeModal';
import { BookmarkDrawer } from './components/BookmarkDrawer';
import { CodePlaygroundModal } from './components/CodePlaygroundModal';
import { GrowthCenterModal } from './components/GrowthCenterModal';
import { ShareModal } from './components/ShareModal';
import { NewsView } from './components/NewsView';
import { GiveawaysView } from './components/GiveawaysView';
import { StoreView } from './components/StoreView';
import { UtilitiesView } from './components/UtilitiesView';
import { ProductDetailModal } from './components/ProductDetailModal';
import { ProductCheckoutModal } from './components/ProductCheckoutModal';
import { AuthModal } from './components/AuthModal';
import { UserWalletModal } from './components/UserWalletModal';
import { MyReceivedCodesModal } from './components/MyReceivedCodesModal';
import { UserProfileModal } from './components/UserProfileModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CyberLoader } from './components/CyberLoader';

const AdminApp = React.lazy(() => import('./admin/AdminApp'));
import { Footer } from './components/Footer';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { MarketingNotificationToast } from './components/MarketingNotificationToast';
import { FloatingAnnouncement } from './components/FloatingAnnouncement';
import { dataService } from './services/dataService';
import { marketingService } from './services/marketingService';
import { adminDataService } from './admin/services/adminDataService';
import { authService } from './services/authService';
import { growthService } from './services/growthService';
import type { GameItem, FilterState, StoreProduct, UserProfile, GiveawayCampaign, UtilityProduct } from './types/game';

export interface SharePayload {
  title: string;
  subtitle?: string;
  shareUrl: string;
  itemType: 'game' | 'giveaway' | 'product' | 'utility';
}

const ADMIN_HASH_PREFIXES = [
  '#/admin',
  '#/dashboard',
  '#/games',
  '#/free-codes',
  '#/giftcodes',
  '#/members',
  '#/wallet',
  '#/private-codes',
  '#/code-inventory',
  '#/utilities',
  '#/orders',
  '#/sepay',
  '#/content',
  '#/security-logs',
  '#/profile',
];

export const App: React.FC = () => {
  const [, startTransition] = useTransition();

  // Navigation Tab State (Decoupled Frontends Domain Detection & Hash Routing)
  const [currentTab, setCurrentTab] = useState<'catalog' | 'news' | 'giveaways' | 'store' | 'utilities' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();

      // 1. If on dedicated admin domain or admin hash/route -> Open AdminApp directly
      const isAdminHash = ADMIN_HASH_PREFIXES.some((p) => hash.startsWith(p));
      if (host.includes('admin-code-game-shop') || path.startsWith('/admin') || isAdminHash) {
        return 'admin';
      }

      if (hash.includes('news') || hash.includes('tintuc') || path === '/news' || path.startsWith('/news/')) return 'news';
      if (hash.includes('giveaways') || hash.includes('gw=') || path === '/giveaways' || path.startsWith('/giveaways/')) return 'giveaways';
      if (hash.includes('store') || hash.includes('product=') || hash.includes('prod=') || path === '/store' || path.startsWith('/store/')) return 'store';
      if (hash.includes('utilities') || hash.includes('utility=') || hash.includes('ut=') || path === '/utilities' || path.startsWith('/utilities/')) return 'utilities';
    }
    return 'catalog';
  });

  const [initialNewsSlug, setInitialNewsSlug] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterState>({
    search: '',
    category: 'all',
    tag: 'all',
    sortBy: 'release_date',
    sortOrder: 'desc',
  });

  // Data & Pagination State
  const [paginationConfig, setPaginationConfig] = useState(() => dataService.getPaginationConfig());
  const [games, setGames] = useState<GameItem[]>([]);
  const [allGamesList, setAllGamesList] = useState<GameItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Branding & Assets from CMS
  const [branding, setBranding] = useState(() => dataService.getWebsiteBranding());

  // User State & Bookmarks
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => dataService.getCurrentUser());
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [bookmarkedGamesList, setBookmarkedGamesList] = useState<GameItem[]>([]);

  // Modals & Drawers
  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [checkoutProduct, setCheckoutProduct] = useState<StoreProduct | null>(null);
  const [selectedUtilityId, setSelectedUtilityId] = useState<string | null>(null);

  const [isBookmarkDrawerOpen, setIsBookmarkDrawerOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isPlaygroundModalOpen, setIsPlaygroundModalOpen] = useState(false);
  const [isGrowthCenterOpen, setIsGrowthCenterOpen] = useState(false);
  const [growthInitialTab, setGrowthInitialTab] = useState<'wheel' | 'welcome' | 'referral' | 'checkin' | 'leaderboard'>('wheel');
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
        const enabled = Boolean(cfg?.isEnabled);
        setIsGrowthEnabled(enabled);
        if (!enabled) {
          setIsGrowthCenterOpen(false);
        }
      } catch {
        setIsGrowthEnabled(false);
        setIsGrowthCenterOpen(false);
      }
    };

    growthService.fetchFreshConfigFromServer()
      .then((cfg) => {
        const enabled = Boolean(cfg?.isEnabled);
        setIsGrowthEnabled(enabled);
        if (!enabled) {
          setIsGrowthCenterOpen(false);
        }
      })
      .catch(() => {});

    window.addEventListener('wcg_growth_config_updated', handleConfigUpdate);
    window.addEventListener('storage', handleConfigUpdate);
    return () => {
      window.removeEventListener('wcg_growth_config_updated', handleConfigUpdate);
      window.removeEventListener('storage', handleConfigUpdate);
    };
  }, []);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isReceivedCodesOpen, setIsReceivedCodesOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Capture referral tracking parameters (?ref=... or ?invite=...) on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref') || params.get('invite');
      if (ref) {
        localStorage.setItem('wcg_referrer_id', ref);
      }
    }
  }, []);

  // Theme & Toasts
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Initialize Theme
  useEffect(() => {
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
  }, []);

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

  // Toast Helper
  const showToast = useCallback(
    (title: string, message?: string, type: 'success' | 'error' | 'info' = 'success') => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, title, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    []
  );

  const handleUpdateUser = useCallback((usr: UserProfile) => {
    setCurrentUser((prev) => {
      if (!prev && !usr) return null;
      if (!prev && usr) return usr;
      if (prev && !usr) return null;
      if (prev && usr) {
        if (
          prev.wallet_balance !== usr.wallet_balance ||
          prev.id !== usr.id ||
          prev.role !== usr.role ||
          prev.displayName !== usr.displayName ||
          prev.avatar_url !== usr.avatar_url
        ) {
          return usr;
        }
        return prev;
      }
      return usr;
    });
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Global listener for floating toast events (from components/cards)
  useEffect(() => {
    const handleCustomToast = (e: any) => {
      const { title, message, type } = e.detail || {};
      if (title) {
        showToast(title, message, type || 'success');
      }
    };
    window.addEventListener('wcg_show_toast', handleCustomToast);
    return () => window.removeEventListener('wcg_show_toast', handleCustomToast);
  }, [showToast]);

  // Persistent Screen-Covering Splash Preloader Dismissal
  useEffect(() => {
    const dismissPreloader = () => {
      const preloader = document.getElementById('app-preloader');
      if (preloader) {
        preloader.style.opacity = '0';
        preloader.style.pointerEvents = 'none';
        setTimeout(() => {
          if (preloader.parentNode) {
            preloader.parentNode.removeChild(preloader);
          }
        }, 360);
      }
    };

    // Use double requestAnimationFrame to ensure the browser has painted the view
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(dismissPreloader, 120);
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [currentTab]);

  // Initial Load & Deep Link Router
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      const bmarks = dataService.getBookmarks();
      setBookmarks(bmarks);
      dataService.getBookmarkedGames(bmarks).then((bList) => setBookmarkedGamesList(bList));
      const pCfg = dataService.getPaginationConfig();
      setPaginationConfig(pCfg);

      // Lightweight CMS sync to reflect branding & CMS updates immediately (only 4 KB instead of full sync)
      dataService.syncBrandingAndContentOnly().then(() => {
        setBranding(dataService.getWebsiteBranding());
      });

      const res = await dataService.queryGames(
        { search: '', category: 'all', tag: 'all', sortBy: 'release_date', sortOrder: 'desc' },
        1,
        pCfg.pageSize,
        bmarks
      );
      setGames(res.items);
      setAllGamesList(res.items);
      setTotalPages(res.totalPages);
      setTotalResults(res.total);
      setHasMore(res.hasMore);
      if (res.categories && res.categories.length > 0) {
        setCategories(res.categories);
      } else {
        const cats = await dataService.getCategories();
        setCategories(cats);
      }
      setIsLoading(false);

      // Check Hash / Search Params for Deep Linking (/g/:slug, /giveaways, /store, /admin, /#product=id, /#gw=id)
      const parseHash = async () => {
        const hash = window.location.hash;
        const hashLower = hash.toLowerCase();
        const host = window.location.hostname;
        const urlParams = new URLSearchParams(window.location.search);

        // Check for cross-origin sync_data payload in URL hash (from Admin "Xem Web Khách")
        if (hash.includes('sync_data=')) {
          try {
            const encoded = hash.split('sync_data=')[1]?.split('&')[0];
            if (encoded && encoded.length < 50000) {
              const jsonStr = decodeURIComponent(atob(encoded));
              const parsed = JSON.parse(jsonStr);
              dataService.applyFullStateSnapshot(parsed);
              showToast('Đã đồng bộ toàn bộ dữ liệu từ Admin!', undefined, 'success');
            }
          } catch (e) {
            console.warn('Error parsing sync_data:', e);
          }
          try {
            window.history.replaceState(null, '', window.location.pathname + '#store');
          } catch {}
        }

        // 1. If on dedicated admin domain -> ALWAYS remain in admin app
        if (host.includes('admin-code-game-shop')) {
          setCurrentTab('admin');
          return;
        }

        // 2. Admin routes on client domain or localhost
        const isAdminHash = ADMIN_HASH_PREFIXES.some((p) => hashLower.startsWith(p));
        if (isAdminHash || window.location.pathname.toLowerCase().startsWith('/admin')) {
          setCurrentTab('admin');
          return;
        }

        // 3. Deep link hashes / query params have top priority over static pathname
        const prodId =
          urlParams.get('product') ||
          urlParams.get('prod') ||
          (hashLower.includes('product=') ? hash.split(/product=/i)[1]?.split('&')[0] : null) ||
          (hashLower.includes('prod=') ? hash.split(/prod=/i)[1]?.split('&')[0] : null);

        const gwId =
          urlParams.get('gw') ||
          urlParams.get('giveaway') ||
          (hashLower.includes('gw=') ? hash.split(/gw=/i)[1]?.split('&')[0] : null) ||
          (hashLower.includes('giveaway=') ? hash.split(/giveaway=/i)[1]?.split('&')[0] : null);

        const utilityId =
          urlParams.get('utility') ||
          urlParams.get('ut') ||
          (hashLower.includes('utility=') ? hash.split(/utility=/i)[1]?.split('&')[0] : null) ||
          (hashLower.includes('ut=') ? hash.split(/ut=/i)[1]?.split('&')[0] : null);

        if (prodId) {
          setCurrentTab('store');
          const storeProducts = dataService.getStoreProducts();
          const found = storeProducts.find(
            (p) => p.id === prodId || p.id.toLowerCase() === prodId.toLowerCase()
          );
          if (found) {
            setSelectedProduct(found);
          }
          return;
        } else if (utilityId) {
          setCurrentTab('utilities');
          setSelectedUtilityId(utilityId);
          return;
        } else if (gwId) {
          setCurrentTab('giveaways');
          return;
        } else if (hashLower === '#news' || hashLower.startsWith('#news')) {
          setCurrentTab('news');
          const nSlug = hash.includes('news/') ? hash.split(/news\//i)[1]?.split('&')[0] : null;
          if (nSlug) setInitialNewsSlug(nSlug);
          return;
        } else if (hashLower === '#giveaways' || hashLower.startsWith('#giveaways')) {
          setCurrentTab('giveaways');
          return;
        } else if (hashLower === '#store' || hashLower.startsWith('#store')) {
          setCurrentTab('store');
          return;
        } else if (hashLower === '#utilities' || hashLower.startsWith('#utilities')) {
          setCurrentTab('utilities');
          return;
        } else if (hashLower === '#catalog' || hashLower.startsWith('#catalog')) {
          setCurrentTab('catalog');
          return;
        } else if (hashLower.includes('g=') || urlParams.get('g') || urlParams.get('game')) {
          const slug = urlParams.get('g') || urlParams.get('game') || hash.split(/g=/i)[1]?.split('&')[0];
          if (slug) {
            const game = await dataService.getGameBySlug(slug);
            if (game) {
              setSelectedGame(game);
              setCurrentTab('catalog');
              return;
            }
          }
        }

        // 4. Pathname Routes (/game/:slug, /news, /giveaways, /store, /utilities) from Google or Shared Links
        const pathname = window.location.pathname.toLowerCase();
        if (pathname.startsWith('/game/')) {
          const pathSlug = window.location.pathname.replace(/^\/game\//i, '').replace(/\/$/, '').trim();
          if (pathSlug) {
            setCurrentTab('catalog');
            const game = await dataService.getGameBySlug(pathSlug);
            if (game) {
              setSelectedGame(game);
              return;
            }
          }
        } else if (pathname === '/news' || pathname.startsWith('/news/')) {
          setCurrentTab('news');
          const nSlug = window.location.pathname.replace(/^\/news\//i, '').replace(/\/$/, '').trim();
          if (nSlug) setInitialNewsSlug(nSlug);
          return;
        } else if (pathname === '/giveaways' || pathname.startsWith('/giveaways/')) {
          setCurrentTab('giveaways');
          return;
        } else if (pathname === '/store' || pathname.startsWith('/store/')) {
          setCurrentTab('store');
          return;
        } else if (pathname === '/utilities' || pathname.startsWith('/utilities/')) {
          setCurrentTab('utilities');
          return;
        } else if (!hash || hash === '#' || hash === '#catalog') {
          setCurrentTab('catalog');
        }
      };

      await parseHash();
    };

    loadInitialData();

    // Listen to cross-origin snapshot messages from admin panel
    const handleCrossMessage = (event: MessageEvent) => {
      if (event.data?.type === 'WCG_TRANSFER_FULL_STATE' && event.data.payload) {
        dataService.applyFullStateSnapshot(event.data.payload);
        showToast('Đã đồng bộ tức thì toàn bộ dữ liệu từ Admin!', undefined, 'success');
      }
    };
    window.addEventListener('message', handleCrossMessage);

    return () => {
      window.removeEventListener('message', handleCrossMessage);
    };
  }, []);

  // Unified Single-Click Tab Switcher (History pushState routing without hash conflicts)
  const handleSelectTab = useCallback((tab: 'catalog' | 'news' | 'giveaways' | 'store' | 'utilities') => {
    setSelectedGame(null);
    setSelectedProduct(null);
    setSelectedUtilityId(null);
    setCurrentTab(tab);

    const targetPath = tab === 'catalog' ? '/' : `/${tab}`;
    if (window.location.pathname !== targetPath || window.location.hash) {
      window.history.pushState(null, '', targetPath);
    }
  }, []);

  // Sync Dynamic Document Title & Clean URL bar
  useEffect(() => {
    if (currentTab === 'admin') return;

    if (selectedGame) {
      const codeCount = selectedGame.codes_count || selectedGame.codes?.length || 0;
      const countSuffix = codeCount > 0 ? `Nhận ${codeCount} Mã Code ` : '';
      document.title = `Giftcode ${selectedGame.name} Mới Nhất 2026 - ${countSuffix}| CodeGame.shop`;
      if (window.location.pathname !== `/game/${selectedGame.slug}`) {
        window.history.replaceState(null, '', `/game/${selectedGame.slug}`);
      }
    } else {
      if (window.location.pathname.startsWith('/game/')) {
        window.history.replaceState(null, '', '/');
      }

      if (currentTab === 'news') {
        document.title = 'Tin Tức Game & Sự Kiện Giftcode Mới Nhất 2026 | CodeGame.shop';
        if (window.location.pathname !== '/news' || window.location.hash) {
          window.history.replaceState(null, '', '/news');
        }
      } else if (currentTab === 'giveaways') {
        document.title = 'Sự Kiện Giveaway Game Miễn Phí 2026 | CodeGame.shop';
        if (window.location.pathname !== '/giveaways' || window.location.hash) {
          window.history.replaceState(null, '', '/giveaways');
        }
      } else if (currentTab === 'store') {
        document.title = 'Cửa Hàng Thẻ Game & Robux Giá Rẻ | CodeGame.shop';
        if (window.location.pathname !== '/store' || window.location.hash) {
          window.history.replaceState(null, '', '/store');
        }
      } else if (currentTab === 'utilities') {
        document.title = 'Tiện Ích Nạp Game & Key Bản Quyền | CodeGame.shop';
        if (window.location.pathname !== '/utilities' || window.location.hash) {
          window.history.replaceState(null, '', '/utilities');
        }
      } else {
        document.title = 'CodeGame.shop - Cổng Tra Cứu Giftcode & Game Bản Quyền Hàng Đầu';
        if (window.location.pathname !== '/' || window.location.hash) {
          window.history.replaceState(null, '', '/');
        }
      }
    }
  }, [selectedGame, currentTab]);

  // Handle browser popstate and hashchange navigation (Back / Forward buttons & anchors)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();

      // 1. Explicit hash deep links precedence
      if (hash === '#news' || hash.startsWith('#news')) {
        setSelectedGame(null);
        setCurrentTab('news');
        return;
      }
      if (hash === '#giveaways' || hash.startsWith('#giveaways') || hash.includes('gw=')) {
        setSelectedGame(null);
        setCurrentTab('giveaways');
        return;
      }
      if (hash === '#store' || hash.startsWith('#store') || hash.includes('product=')) {
        setSelectedGame(null);
        setCurrentTab('store');
        return;
      }
      if (hash === '#utilities' || hash.startsWith('#utilities') || hash.includes('utility=')) {
        setSelectedGame(null);
        setCurrentTab('utilities');
        return;
      }

      // 2. Pathname routes
      if (path.startsWith('/game/')) {
        const pathSlug = window.location.pathname.replace(/^\/game\//i, '').replace(/\/$/, '').trim();
        if (pathSlug) {
          dataService.getGameBySlug(pathSlug).then((g) => {
            if (g) {
              setSelectedGame(g);
              setCurrentTab('catalog');
            }
          });
        }
      } else if (path === '/news' || path.startsWith('/news/')) {
        setSelectedGame(null);
        setCurrentTab('news');
      } else if (path === '/giveaways' || path.startsWith('/giveaways/')) {
        setSelectedGame(null);
        setCurrentTab('giveaways');
      } else if (path === '/store' || path.startsWith('/store/')) {
        setSelectedGame(null);
        setCurrentTab('store');
      } else if (path === '/utilities' || path.startsWith('/utilities/')) {
        setSelectedGame(null);
        setCurrentTab('utilities');
      } else if (path === '/' || path === '') {
        setSelectedGame(null);
        setCurrentTab('catalog');
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // Sync Search Query with Filter
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (currentTab !== 'catalog') {
      handleSelectTab('catalog');
    }
    startTransition(() => {
      setFilter((prev) => ({ ...prev, search: q }));
      setCurrentPage(1);
    });
  };

  // Filter Updates
  const handleFilterChange = (newFilter: Partial<FilterState>) => {
    startTransition(() => {
      setFilter((prev) => ({ ...prev, ...newFilter }));
      setCurrentPage(1);
    });
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setFilter({
      search: '',
      category: 'all',
      tag: 'all',
      sortBy: 'release_date',
      sortOrder: 'desc',
    });
    setCurrentPage(1);
  };

  // Keep bookmarkedGamesList synced with bookmarks
  useEffect(() => {
    if (bookmarks.length === 0) {
      setBookmarkedGamesList([]);
      return;
    }
    dataService.getBookmarkedGames(bookmarks).then((list) => {
      setBookmarkedGamesList(list);
    });
  }, [bookmarks]);

  // Query Execution for Catalog Tab
  useEffect(() => {
    if (currentTab !== 'catalog') return;
    let isCancelled = false;

    const executeQuery = async () => {
      setIsLoading(true);
      setCurrentPage(1);
      const res = await dataService.queryGames(filter, 1, paginationConfig.pageSize, bookmarks);
      if (!isCancelled) {
        setGames(res.items);
        setCurrentPage(1);
        setTotalPages(res.totalPages);
        setTotalResults(res.total);
        setHasMore(res.hasMore);
        if (res.categories && res.categories.length > 0) {
          setCategories(res.categories);
        }
        setIsLoading(false);
      }
    };

    executeQuery();
    return () => {
      isCancelled = true;
    };
  }, [filter, currentTab, paginationConfig]);

  // Infinite Scroll: Load Next Page
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || paginationConfig.mode !== 'infinite') return;
    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    const res = await dataService.queryGames(filter, nextPage, paginationConfig.pageSize, bookmarks);
    if (res.items && res.items.length > 0) {
      setGames((prev) => {
        const seen = new Set(prev.map((g) => g.id || g.slug));
        const unique = res.items.filter((g) => !seen.has(g.id || g.slug));
        return [...prev, ...unique];
      });
      setCurrentPage(nextPage);
      setTotalPages(res.totalPages);
      setTotalResults(res.total);
      setHasMore(res.hasMore);
    } else {
      setHasMore(false);
    }
    setIsLoadingMore(false);
  }, [currentPage, filter, bookmarks, hasMore, isLoadingMore, paginationConfig]);

  // Manual Page Change (Classic numbered pagination / jump)
  const handlePageChange = useCallback(async (p: number) => {
    setIsLoading(true);
    setCurrentPage(p);
    const res = await dataService.queryGames(filter, p, paginationConfig.pageSize, bookmarks);
    setGames(res.items);
    setCurrentPage(p);
    setTotalPages(res.totalPages);
    setTotalResults(res.total);
    setHasMore(res.hasMore);
    setIsLoading(false);
    const section = document.getElementById('game-catalog-section');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo({ top: 400, behavior: 'smooth' });
  }, [filter, bookmarks, paginationConfig]);

  // Real-time Data Sync Subscription (Reflect Admin updates instantly without CPU loops)
  useEffect(() => {
    const unsubscribe = dataService.subscribe(async () => {
      const cats = await dataService.getCategories();
      setCategories(cats);
      setBranding(dataService.getWebsiteBranding());
      setPaginationConfig(dataService.getPaginationConfig());
      const u = dataService.getCurrentUser();
      setCurrentUser((prev) => {
        if (!prev && !u) return null;
        if (!prev && u) return u;
        if (prev && !u) return null;
        if (prev && u) {
          if (
            prev.wallet_balance !== u.wallet_balance ||
            prev.id !== u.id ||
            prev.role !== u.role ||
            prev.displayName !== u.displayName
          ) {
            return u;
          }
          return prev;
        }
        return prev;
      });

      if (currentTab === 'catalog') {
        const res = await dataService.queryGames(filter, 1, 24, bookmarks);
        setGames(res.items);
        setCurrentPage(1);
        setTotalPages(res.totalPages);
        setTotalResults(res.total);
        setHasMore(res.hasMore);
      }
    });
    return () => unsubscribe();
  }, [filter, bookmarks, currentTab]);

  // Gentle Event-Driven User Balance Refresh
  useEffect(() => {
    const syncUser = () => {
      if (document.visibilityState !== 'visible') return;
      dataService.refreshCurrentUserBalance().then(() => {
        const u = dataService.getCurrentUser();
        setCurrentUser((prev) => {
          if (!prev && !u) return null;
          if (!prev && u) return u;
          if (prev && !u) return null;
          if (prev && u) {
            if (prev.wallet_balance !== u.wallet_balance || prev.id !== u.id || prev.role !== u.role) {
              return u;
            }
            return prev;
          }
          return prev;
        });
      });
    };

    // 1. Initial refresh on mount
    syncUser();

    // 2. Gentle polling every 60 seconds ONLY when tab is visible
    const interval = setInterval(syncUser, 60000);

    // 3. Sync on tab focus / visibility
    window.addEventListener('focus', syncUser);
    document.addEventListener('visibilitychange', syncUser);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncUser);
      document.removeEventListener('visibilitychange', syncUser);
    };
  }, []);

  // Dynamically update favicon & browser tab title from branding
  useEffect(() => {
    if (branding.avatarUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = branding.avatarUrl;
    }
    const rawTitle = branding.siteTitle?.trim();
    const cleanTitle =
      rawTitle && rawTitle.toUpperCase() !== 'WEB CODE GAME' && rawTitle.toUpperCase() !== 'WEB CODE'
        ? rawTitle
        : 'CodeGame.Shop';
    document.title = `${cleanTitle} - Cổng Tra Cứu Giftcode & Tiện Ích Game`;
  }, [branding.avatarUrl, branding.siteTitle]);

  // Real-time listener for CMS content changes (Events, Storage & BroadcastChannel)
  useEffect(() => {
    const handleContentUpdate = () => {
      setBranding(dataService.getWebsiteBranding());
    };
    window.addEventListener('wcg_admin_content_updated', handleContentUpdate);
    window.addEventListener('wcg_admin_data_updated', handleContentUpdate);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('wcg_admin_content')) {
        handleContentUpdate();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('wcg_data_sync');
        bc.onmessage = (event) => {
          const type = event.data?.type || event.data?.key || '';
          if (!type || (typeof type === 'string' && (type.includes('content') || type.includes('branding')))) {
            handleContentUpdate();
          }
        };
      } catch {}
    }

    return () => {
      window.removeEventListener('wcg_admin_content_updated', handleContentUpdate);
      window.removeEventListener('wcg_admin_data_updated', handleContentUpdate);
      window.removeEventListener('storage', handleStorageChange);
      if (bc) bc.close();
    };
  }, []);

  // Bookmarking Handlers
  const handleToggleBookmark = (gameId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const res = dataService.toggleBookmark(gameId);
    setBookmarks(res.bookmarks);
    showToast(
      res.isBookmarked ? 'Đã lưu vào tủ game!' : 'Đã bỏ lưu game',
      undefined,
      res.isBookmarked ? 'success' : 'info'
    );
  };

  const handleClearAllBookmarks = () => {
    localStorage.removeItem('wcg_bookmarks');
    setBookmarks([]);
    showToast('Đã làm trống tủ game', undefined, 'info');
  };

  // Quick Copy Handler
  const handleQuickCopyCode = (code: string, gameName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    dataService.recordCopyEvent(code, gameName);
    marketingService.recordRealCopy(gameName, '', 1);
    showToast(`Đã sao chép mã code cho ${gameName}!`, code, 'success');
  };

  // Handle Game Selection
  const handleSelectGame = async (game: GameItem) => {
    const fullGame = await dataService.getGameBySlug(game.slug);
    setSelectedGame(fullGame || game);
  };

  const handleSelectGameSlug = async (slug: string) => {
    const fullGame = await dataService.getGameBySlug(slug);
    if (fullGame) setSelectedGame(fullGame);
  };

  const handleSelectProductById = (productId: string) => {
    const prods = dataService.getStoreProducts();
    const found = prods.find((p) => p.id === productId || p.id.toLowerCase() === productId.toLowerCase());
    if (found) {
      setSelectedProduct(found);
    }
  };

  // Share Handlers for Universal Share Modal
  const handleOpenShareGame = (game: GameItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const origin = window.location.origin;
    setSharePayload({
      title: `Giftcode ${game.name}`,
      subtitle: game.publisher || 'Nhà phát hành chính thức',
      shareUrl: `${origin}/#g=${game.slug}`,
      itemType: 'game',
    });
  };

  const handleOpenShareGiveaway = (campaign: GiveawayCampaign, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const origin = window.location.origin;
    setSharePayload({
      title: campaign.title,
      subtitle: `Sự kiện săn mã ${campaign.game_name}`,
      shareUrl: `${origin}/#gw=${campaign.id}`,
      itemType: 'giveaway',
    });
  };

  const handleOpenShareProduct = (product: StoreProduct, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const origin = window.location.origin;
    setSharePayload({
      title: product.title,
      subtitle: `${product.game_name} • Giảm ${product.discount_percent}%`,
      shareUrl: `${origin}/#product=${product.id}`,
      itemType: 'product',
    });
  };

  const handleOpenShareUtility = (utility: UtilityProduct, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const origin = window.location.origin;
    setSharePayload({
      title: utility.title,
      subtitle: `${utility.category_label || utility.category} • Giảm ${utility.discount_percent}%`,
      shareUrl: `${origin}/#utility=${utility.id}`,
      itemType: 'utility',
    });
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    showToast('Đã đăng xuất tài khoản an toàn', undefined, 'info');
  };

  if (currentTab === 'admin') {
    return (
      <React.Suspense
        fallback={
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-3 text-white">
            <div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            <p className="text-sm font-medium">Đang tải Admin Panel...</p>
          </div>
        }
      >
        <AdminApp
          onBackToClient={() => {
            const isDedicatedAdmin = typeof window !== 'undefined' && window.location.hostname.includes('admin-code-game-shop');
            if (isDedicatedAdmin) {
              const newWin = window.open('https://web-code-game.pages.dev', '_blank');
              if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
                window.location.href = 'https://web-code-game.pages.dev';
              }
            } else {
              if (window.location.pathname.toLowerCase().startsWith('/admin')) {
                window.location.href = '/store';
              } else {
                handleSelectTab('store');
              }
            }
          }}
        />
      </React.Suspense>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative text-foreground selection:bg-primary selection:text-white overflow-x-clip w-full max-w-full box-border">
      {/* Dynamic Background Wallpaper Container (Layered between base and content) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Base dark/light background */}
        <div className="absolute inset-0 bg-background" />

        {/* Dynamic Wallpaper Image Layer */}
        {branding.backgroundUrl && (
          <div
            className={`absolute inset-0 transition-opacity duration-700 ${
              branding.backgroundStyle === 'ambient'
                ? 'bg-cover bg-center blur-xl scale-105'
                : branding.backgroundStyle === 'cover'
                ? 'bg-cover bg-center'
                : branding.backgroundStyle === 'pattern'
                ? 'bg-repeat'
                : 'bg-cover bg-top'
            }`}
            style={{
              backgroundImage: `url(${branding.backgroundUrl})`,
              opacity: branding.backgroundOpacity ?? 0.35,
            }}
          />
        )}

        {/* Ambient Top Glow Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main App Content (relative z-10) */}
      <div className="relative z-10 flex-1 flex flex-col w-full max-w-full">
        {/* Dynamic Announcement Banner from Admin CMS */}
        <AnnouncementBar />

        {/* Top Navigation Bar */}
        <Header
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          allGames={allGamesList}
          onSelectGame={handleSelectGame}
          branding={branding}
          bookmarkCount={bookmarks.length}
          onOpenBookmarks={() => setIsBookmarkDrawerOpen(true)}
          onOpenSubmitCode={() => setIsSubmitModalOpen(true)}
          onOpenPlayground={() => {
            if (!isGrowthEnabled) return;
            setGrowthInitialTab('wheel');
            setIsGrowthCenterOpen(true);
          }}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenWallet={() => setIsWalletModalOpen(true)}
          onOpenReceivedCodes={() => setIsReceivedCodesOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
        />

        {/* Main Content Area */}
        <main className="flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {currentTab === 'catalog' && (
            <>
              <HeroBanner
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                onSelectGame={handleSelectGame}
                onShowToast={showToast}
                onSelectQuickTag={(tag) => handleSearchChange(tag)}
                onExploreClick={() => {
                  const gridElem = document.getElementById('game-catalog-section');
                  gridElem?.scrollIntoView({ behavior: 'smooth' });
                }}
              />

              <div id="game-catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
                <CategoryFilter
                  filter={filter}
                  onFilterChange={handleFilterChange}
                  categories={categories}
                  totalResults={totalResults}
                />

                {isLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center">
                    <CyberLoader
                      title="ĐANG TẢI DỮ LIỆU..."
                      subText="Đang kết nối hơn 340+ tựa game từ Cloudflare Edge Network..."
                    />
                  </div>
                ) : (
                  <GameGrid
                    games={games}
                    total={totalResults}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    bookmarks={bookmarks}
                    onToggleBookmark={handleToggleBookmark}
                    onSelectGame={handleSelectGame}
                    onQuickCopyCode={handleQuickCopyCode}
                    onResetFilters={handleResetFilters}
                    onShareGame={handleOpenShareGame}
                    onShowToast={showToast}
                    hasMore={hasMore}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={handleLoadMore}
                    useInfiniteScroll={paginationConfig.mode === 'infinite'}
                  />
                )}
              </div>
            </>
          )}

          {currentTab === 'news' && (
            <NewsView
              onShowToast={showToast}
              onSelectGameSlug={handleSelectGameSlug}
              initialArticleSlug={initialNewsSlug}
            />
          )}

          {currentTab === 'giveaways' && (
            <GiveawaysView
              onShowToast={showToast}
              onSelectGameSlug={handleSelectGameSlug}
              currentUser={currentUser}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onShareGiveaway={handleOpenShareGiveaway}
            />
          )}

          {currentTab === 'store' && (
            <StoreView
              onSelectProduct={(prod) => setSelectedProduct(prod)}
              onShowToast={showToast}
              currentUser={currentUser}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onOpenShare={handleOpenShareProduct}
            />
          )}

          {currentTab === 'utilities' && (
            <UtilitiesView
              onShowToast={showToast}
              currentUser={currentUser}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onOpenShare={handleOpenShareUtility}
              onOpenWallet={() => setIsWalletModalOpen(true)}
              selectedUtilityId={selectedUtilityId}
              onClearSelectedUtility={() => setSelectedUtilityId(null)}
            />
          )}
        </main>

        {/* Footer */}
        <Footer
          categories={categories}
          onSelectCategory={(cat) => {
            handleSelectTab('catalog');
            handleFilterChange({ category: cat });
            const gridElem = document.getElementById('game-catalog-section');
            gridElem?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* Mobile Sticky Bottom Navigation Dock */}
        <MobileBottomNav
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          onOpenReceivedCodes={() => setIsReceivedCodesOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenWallet={() => setIsWalletModalOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          currentUser={currentUser}
        />
      </div>

      {/* Modals & Drawers */}
      <GameDetailModal
        game={selectedGame}
        onClose={() => setSelectedGame(null)}
        isBookmarked={
          selectedGame
            ? bookmarks.includes(selectedGame.id) || bookmarks.includes(selectedGame.slug)
            : false
        }
        onToggleBookmark={(id) => handleToggleBookmark(id)}
        onOpenShare={(g) => handleOpenShareGame(g)}
        onShowToast={showToast}
        currentUser={currentUser}
      />

      <ShareModal
        isOpen={Boolean(sharePayload)}
        onClose={() => setSharePayload(null)}
        title={sharePayload?.title || ''}
        subtitle={sharePayload?.subtitle}
        shareUrl={sharePayload?.shareUrl || ''}
        itemType={sharePayload?.itemType || 'game'}
        onShowToast={showToast}
      />

      <ProductDetailModal
        product={selectedProduct}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenShare={handleOpenShareProduct}
        onClose={() => setSelectedProduct(null)}
        onShowToast={showToast}
        onBuyNow={(prod) => {
          setSelectedProduct(null);
          if (!currentUser) {
            setIsAuthModalOpen(true);
          } else {
            setCheckoutProduct(prod);
          }
        }}
      />

      <ProductCheckoutModal
        product={checkoutProduct}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenWallet={() => setIsWalletModalOpen(true)}
        onClose={() => setCheckoutProduct(null)}
        onShowToast={showToast}
      />

      <SubmitCodeModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        games={allGamesList}
        onSuccess={(_slug, code) => {
          showToast('Đóng góp mã code thành công!', `Mã ${code} đã được nạp vào hệ thống.`, 'success');
          handleFilterChange({});
        }}
      />

      <BookmarkDrawer
        isOpen={isBookmarkDrawerOpen}
        onClose={() => setIsBookmarkDrawerOpen(false)}
        bookmarkedGames={bookmarkedGamesList}
        onRemoveBookmark={(id) => handleToggleBookmark(id)}
        onSelectGame={handleSelectGame}
        onClearAll={handleClearAllBookmarks}
      />

      <CodePlaygroundModal
        isOpen={isPlaygroundModalOpen}
        onClose={() => setIsPlaygroundModalOpen(false)}
        games={allGamesList}
        onSelectGame={handleSelectGame}
        onShowToast={showToast}
      />

      {isGrowthEnabled && (
        <GrowthCenterModal
          isOpen={isGrowthCenterOpen}
          onClose={() => setIsGrowthCenterOpen(false)}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenWallet={() => setIsWalletModalOpen(true)}
          onShowToast={showToast}
          initialTab={growthInitialTab}
        />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleUpdateUser}
        onShowToast={showToast}
      />

      <UserWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        user={currentUser}
        onUpdateUser={handleUpdateUser}
        onShowToast={showToast}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      <MyReceivedCodesModal
        isOpen={isReceivedCodesOpen}
        onClose={() => setIsReceivedCodesOpen(false)}
        onShowToast={showToast}
      />

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onUpdateUser={handleUpdateUser}
        onOpenWallet={() => setIsWalletModalOpen(true)}
        onLogout={handleLogout}
        onShowToast={showToast}
      />

      {/* Social Proof Marketing Notifications Toast (Customer Web tabs) */}
      <MarketingNotificationToast
        onSelectGameSlug={handleSelectGameSlug}
        onSelectProduct={handleSelectProductById}
        onSelectUtility={(utilityId) => {
          handleSelectTab('utilities');
          setSelectedUtilityId(utilityId);
          window.location.hash = `#utility=${utilityId}`;
        }}
        onSelectGiveaway={(giveawayId) => {
          handleSelectTab('giveaways');
          window.location.hash = `#gw=${giveawayId}`;
        }}
        onOpenWallet={() => setIsWalletModalOpen(true)}
        onExploreClick={() => {
          handleSelectTab('catalog');
          const target = document.getElementById('game-catalog-section');
          if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }}
      />

      {/* Floating Announcement (Configured via Admin) */}
      {currentTab !== 'admin' && (
        <FloatingAnnouncement onNavigateTab={(tab) => handleSelectTab(tab as any)} />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
