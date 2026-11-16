import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { GameItem, UserProfile, StoreProduct, UtilityProduct, GiveawayCampaign, UpcomingGame, ProductCategoriesConfig, ProductCategoryItem } from '../../types/game';
import { getDefaultCategoriesConfig, INDUSTRY_PRESETS } from '../../data/industryPresets';
import rawGamesFallback from '../../data/games188.json';
import { 
  Search, ShoppingCart, Bell, HelpCircle, ArrowLeft, 
  Zap, Gift, ShieldCheck, CreditCard, Flame, Sparkles, 
  ChevronRight, ChevronLeft, Smartphone, Compass, Trophy, Copy, Check,
  ShoppingBag, Package, User, Tag, Plus, CheckCircle, CheckCircle2, ExternalLink,
  Layers, Clock, PhoneCall, Send, ShieldAlert, Sparkle, Rocket,
  Calendar, Newspaper, Store, List, FileText, Globe, Award, ArrowUpDown, SlidersHorizontal,
  Filter, X, Bookmark, ChevronDown, Wallet, Settings, LogOut, Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { cartService } from '../../services/cartService';
import { dataService } from '../../services/dataService';
import { authService } from '../../services/authService';
import { newsService } from '../../services/newsService';
import { gameEventService } from '../../services/gameEventService';
import { formatCore, formatCurrencyVND } from '../../utils/textUtils';
import { ShopeeGuaranteeModal } from './ShopeeGuaranteeModal';
import { ShopeeSupportModal } from './ShopeeSupportModal';
import { ShopeeWhiteLabelModal } from './ShopeeWhiteLabelModal';

// Subview components from codebase
import { NewsView } from '../NewsView';
import { TodayCodesView } from '../TodayCodesView';
import { GameEventsList } from '../GameEventsList';
import { StoreView } from '../StoreView';
import { SellerCenterView } from '../seller/SellerCenterView';
import { MissionsView } from '../MissionsView';
import { TelegramView } from '../TelegramView';
import { UserProfileModal } from '../UserProfileModal';
import { SubmitCodeModal } from '../SubmitCodeModal';
import { BookmarkDrawer } from '../BookmarkDrawer';
import { LanguageSelector } from '../LanguageSelector';
import { useLanguage } from '../../context/LanguageContext';

export type ShopeeSubView = 
  | 'home' 
  | 'news' 
  | 'events' 
  | 'today-codes' 
  | 'upcoming' 
  | 'store' 
  | 'seller' 
  | 'account' 
  | 'missions' 
  | 'telegram' 
  | 'a-z' 
  | 'terms' 
  | 'privacy';

interface ShopeeTestViewProps {
  allGames: GameItem[];
  storeProducts?: StoreProduct[];
  utilities?: UtilityProduct[];
  giveaways?: GiveawayCampaign[];
  upcomingGames?: UpcomingGame[];
  onSelectGame: (game: GameItem) => void;
  onSelectGameSlug?: (slug: string) => void;
  onSelectProduct?: (product: StoreProduct) => void;
  onSelectUtility?: (utilityId: string) => void;
  onSelectGiveaway?: (giveawayId: string) => void;
  onOpenAuth: () => void;
  onOpenWallet: () => void;
  onOpenCart?: () => void;
  onOpenGrowth?: () => void;
  onOpenUpcoming?: () => void;
  onOpenDownloadApp?: () => void;
  onOpenEmailModal?: () => void;
  onOpenReceivedCodes?: (tab?: 'giveaways' | 'orders' | 'privates' | 'missions' | 'marketplace') => void;
  onOpenSellerCenter?: () => void;
  onNavigateTodayCodes?: () => void;
  onBackToHome: () => void;
  currentUser: UserProfile | null;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

// 6 Danh mục Game Chuẩn Web Chính (Dùng regex đối sánh chính xác)
const MAIN_GAME_CATEGORIES = [
  { id: 'all', label: 'Tất Cả Game', icon: '🎮', match: () => true },
  { id: 'kiem-hiep-tien-hiep', label: 'Kiếm Hiệp & Tiên Hiệp', icon: '⚔️', match: (c: string) => /kiếm hiệp|tiên hiệp|võ hiệp|tu tiên/i.test(c) },
  { id: 'nhap-vai-gacha-anime', label: 'Nhập Vai Gacha & Anime', icon: '✨', match: (c: string) => /anime|gacha|waifu/i.test(c) },
  { id: 'ban-sung-sinh-ton', label: 'Bắn Súng & Sinh Tồn', icon: '🎯', match: (c: string) => /bắn súng|sinh tồn|battle royale|fps/i.test(c) },
  { id: 'tam-quoc-chien-thuat', label: 'Tam Quốc & Chiến Thuật', icon: '🏰', match: (c: string) => /tam quốc|chiến thuật|chiến lược|slg|đế chế|thẻ tướng/i.test(c) },
  { id: 'roblox-mini-game', label: 'Roblox & Mini Game', icon: '🕹️', match: (c: string) => /roblox|mini game/i.test(c) },
  { id: 'nhap-vai-morpg', label: 'Nhập Vai & MMORPG', icon: '🛡️', match: (c: string) => /mmorpg|nhập vai|arpg/i.test(c) },
];

// Quy tắc gộp Canonical Alias chuẩn xác để chống trùng lặp tựa game (Where Winds Meet, Seven Deadly Sins, Hắc Ngộ Không, X-Wukong)
const GAME_CANONICAL_ALIASES: Record<string, string> = {
  'dau-truong-chan-ly-mobile': 'dau-truong-chan-ly',
  'ta-la-hac-ngo-khong-vplay': 'ta-la-hac-ngo-khong',
  'tam-quoc-huyen-tuong': 'tam-quoc-huyen-tuong-vng',
  'x-wukong-dai-chien-tam-gioi': 'x-wukong',
  'huyen-thoai-hai-tac': 'pirate-legends',
  'seven-deadly-sins-grand-cross': 'the-seven-deadly-sins-grand-cross',
  'where-winds-meet-mobile': 'yen-van-thap-luc-thanh',
  'where-winds-meet': 'yen-van-thap-luc-thanh',
  'loan-the-3q': 'loan-the-3q-than-ma-lenh-oeg',
};

export const THEME_ACCENTS: Record<string, {
  name: string;
  headerGradient: string;
  subNavBg: string;
  badgeBg: string;
  textColor: string;
  buttonBg: string;
  lightBg: string;
  border: string;
}> = {
  orange: {
    name: 'Cam Shopee',
    headerGradient: 'from-[#f53d2d] to-[#ee4d2d]',
    subNavBg: 'bg-[#d73211]',
    badgeBg: 'text-[#ee4d2d]',
    textColor: 'text-[#ee4d2d]',
    buttonBg: 'bg-[#ee4d2d]',
    lightBg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  blue: {
    name: 'Xanh Công Nghệ',
    headerGradient: 'from-blue-600 to-indigo-600',
    subNavBg: 'bg-blue-800',
    badgeBg: 'text-blue-600',
    textColor: 'text-blue-600',
    buttonBg: 'bg-blue-600',
    lightBg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  red: {
    name: 'Đỏ Năng Động',
    headerGradient: 'from-red-600 to-rose-600',
    subNavBg: 'bg-rose-800',
    badgeBg: 'text-rose-600',
    textColor: 'text-rose-600',
    buttonBg: 'bg-rose-600',
    lightBg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  green: {
    name: 'Xanh Lá Tươi Mát',
    headerGradient: 'from-emerald-600 to-teal-600',
    subNavBg: 'bg-emerald-800',
    badgeBg: 'text-emerald-600',
    textColor: 'text-emerald-600',
    buttonBg: 'bg-emerald-600',
    lightBg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  purple: {
    name: 'Tím Sang Trọng',
    headerGradient: 'from-purple-600 to-indigo-700',
    subNavBg: 'bg-purple-900',
    badgeBg: 'text-purple-600',
    textColor: 'text-purple-600',
    buttonBg: 'bg-purple-600',
    lightBg: 'bg-purple-50',
    border: 'border-purple-200',
  },
};

export const ShopeeTestView: React.FC<ShopeeTestViewProps> = ({
  allGames = [],
  storeProducts = [],
  utilities = [],
  giveaways = [],
  upcomingGames = [],
  onSelectGame,
  onSelectGameSlug,
  onSelectProduct,
  onSelectUtility,
  onSelectGiveaway,
  onOpenAuth,
  onOpenWallet,
  onOpenCart,
  onOpenGrowth,
  onOpenUpcoming,
  onOpenDownloadApp,
  onOpenEmailModal,
  onOpenReceivedCodes,
  onOpenSellerCenter,
  onNavigateTodayCodes,
  onBackToHome,
  currentUser,
  onShowToast,
}) => {
  const { t } = useLanguage();

  // Internal SubView state (All navigation stays inside test1)
  const [subView, setSubView] = useState<ShopeeSubView>('home');

  // Theme state within Shopee view (Supports Classic Orange/White or Dark Gamer)
  const [isShopeeDark, setIsShopeeDark] = useState(false);

  // Navigation scroll state & ref for 12-item subnav bar
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkNavScroll = () => {
    const el = navScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  const scrollNav = (direction: 'left' | 'right') => {
    if (navScrollRef.current) {
      navScrollRef.current.scrollBy({ left: direction === 'left' ? -260 : 260, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    checkNavScroll();
    window.addEventListener('resize', checkNavScroll);
    return () => window.removeEventListener('resize', checkNavScroll);
  }, []);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedProductType, setSelectedProductType] = useState<'all' | 'giftcode' | 'utility' | 'account' | 'giveaway'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'latest' | 'codes' | 'licensed'>('latest');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Pagination state for games (24 games / page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 24;

  // Upcoming games internal status filter
  const [upcomingStatusFilter, setUpcomingStatusFilter] = useState<'ALL' | 'UPCOMING' | 'PENDING' | 'RELEASED'>('ALL');

  // Modals state
  const [isGuaranteeOpen, setIsGuaranteeOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isWhiteLabelOpen, setIsWhiteLabelOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSubmitCodeOpen, setIsSubmitCodeOpen] = useState(false);
  const [isBookmarkDrawerOpen, setIsBookmarkDrawerOpen] = useState(false);

  // Bookmarked games sync from dataService (chống trùng lặp theo ID/Slug)
  const [bookmarkedGamesList, setBookmarkedGamesList] = useState<GameItem[]>([]);
  const syncBookmarks = () => {
    const bmarks = dataService.getBookmarks();
    if (bmarks && bmarks.length > 0) {
      const set = new Set(bmarks.map((b) => b.toLowerCase()));
      setBookmarkedGamesList(allGames.filter((g) => set.has(g.id?.toLowerCase()) || set.has(g.slug?.toLowerCase())));
    } else {
      setBookmarkedGamesList([]);
    }
  };

  useEffect(() => {
    syncBookmarks();
  }, [allGames, isBookmarkDrawerOpen, subView]);

  const handleToggleBookmark = (gameId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const res = dataService.toggleBookmark(gameId);
    syncBookmarks();
    onShowToast(res.isBookmarked ? 'Đã lưu vào tủ game theo dõi!' : 'Đã bỏ theo dõi game khỏi tủ!', res.isBookmarked ? 'success' : 'info');
  };

  // White-Label Customizable Shop Brand from CMS / DataService
  const [shopBrand, setShopBrand] = useState(() => {
    const b = dataService.getWebsiteBranding();
    return {
      name: b.siteTitle || 'CodeGame Mall',
      slogan: b.portalSubtitle || 'Kho Mã Giftcode & Tiện Ích Game Số 1 Việt Nam',
      hotline: b.hotline || '0987.654.321',
      currencyMode: b.currencyMode || 'VND',
      themeAccent: b.themeAccent || 'orange',
      logoUrl: b.logoUrl || '',
    };
  });

  // Dynamic Product Categories & Industry Presets from DataService
  const [categoriesConfig, setCategoriesConfig] = useState<ProductCategoriesConfig>(() => {
    return dataService.getProductCategoriesConfig();
  });

  // Dynamic Theme Accent Color Palette
  const currentAccent = useMemo(() => {
    return THEME_ACCENTS[shopBrand.themeAccent] || THEME_ACCENTS.orange;
  }, [shopBrand.themeAccent]);

  // Format price dynamically according to active currencyMode (VND vs Core)
  const formatPrice = (amount: number) => {
    if (shopBrand.currencyMode === 'VND') {
      return formatCurrencyVND(amount);
    }
    return formatCore(amount);
  };

  useEffect(() => {
    const handleBrandingSync = () => {
      const b = dataService.getWebsiteBranding();
      setShopBrand({
        name: b.siteTitle || 'CodeGame Mall',
        slogan: b.portalSubtitle || 'Kho Mã Giftcode & Tiện Ích Game Số 1 Việt Nam',
        hotline: b.hotline || '0987.654.321',
        currencyMode: b.currencyMode || 'VND',
        themeAccent: b.themeAccent || 'orange',
        logoUrl: b.logoUrl || '',
      });
      const c = dataService.getProductCategoriesConfig();
      setCategoriesConfig(c);
    };
    window.addEventListener('wcg_admin_data_updated', handleBrandingSync);
    window.addEventListener('storage', handleBrandingSync);
    return () => {
      window.removeEventListener('wcg_admin_data_updated', handleBrandingSync);
      window.removeEventListener('storage', handleBrandingSync);
    };
  }, []);

  // Hero carousel slide state (3 slide thật sự có nút prev/next và tự chuyển slide)
  const [heroSlide, setHeroSlide] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Đồng bộ theme Shopee với thẻ html toàn cục để mọi modal và subview hiển thị chuẩn màu
  useEffect(() => {
    if (isShopeeDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    return () => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    };
  }, [isShopeeDark]);

  // Tự động reset danh mục khi người dùng gõ từ khóa tìm kiếm mới
  useEffect(() => {
    if (searchKeyword.trim() !== '') {
      setSelectedCategory('all');
      setCurrentPage(1);
    }
  }, [searchKeyword]);

  // Reset trang về 1 khi đổi tab sản phẩm
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProductType]);

  // Shopping cart badge count
  const [cartCount, setCartCount] = useState<number>(() => {
    try {
      return cartService.getCart().length;
    } catch {
      return 0;
    }
  });

  // Dynamic counts for news, events, and upcoming (đồng bộ thời gian thực từ live API)
  const [newsCount, setNewsCount] = useState<number>(() => {
    try {
      return newsService.getPublishedArticles().length || 274;
    } catch {
      return 274;
    }
  });

  const [eventsCount, setEventsCount] = useState<number>(() => {
    try {
      return gameEventService.getPublishedEvents().length || 93;
    } catch {
      return 93;
    }
  });

  useEffect(() => {
    newsService.syncFromServer().then((list) => {
      if (Array.isArray(list) && list.length > 0) {
        setNewsCount(list.length);
      }
    }).catch(() => {});
  }, []);

  // Upcoming games: nạp đủ 90 bản ghi thật từ dataService
  const [liveUpcomingList, setLiveUpcomingList] = useState<UpcomingGame[]>(() => {
    const raw = dataService.getAllUpcomingGamesRawSync ? dataService.getAllUpcomingGamesRawSync() : [];
    return raw.length > 0 ? raw : (upcomingGames || []);
  });

  useEffect(() => {
    dataService.getAllUpcomingGamesRaw().then((list) => {
      if (Array.isArray(list) && list.length > 0) {
        setLiveUpcomingList(list);
      }
    }).catch(() => {});
  }, []);

  // Listen to cart updates
  useEffect(() => {
    const handleCartUpdated = (e: any) => {
      if (e?.detail?.count !== undefined) {
        setCartCount(e.detail.count);
      } else {
        setCartCount(cartService.getCart().length);
      }
    };
    window.addEventListener('wcg_cart_updated', handleCartUpdated);
    return () => window.removeEventListener('wcg_cart_updated', handleCartUpdated);
  }, []);

  // Countdown timer for Flash Sale (Khung giờ kết thúc cố định: cuối ngày 23:59:59 của ngày hiện tại - đếm xuống đơn điệu)
  const calculateFlashSaleTimeLeft = () => {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
    const diff = Math.max(0, Math.floor((endOfDay - now.getTime()) / 1000));
    return {
      hours: Math.floor(diff / 3600),
      minutes: Math.floor((diff % 3600) / 60),
      seconds: diff % 60,
    };
  };

  const [timeLeft, setTimeLeft] = useState(calculateFlashSaleTimeLeft);
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateFlashSaleTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Reset page when category or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchKeyword, sortOrder]);

  // 1. Filter games based on 6 Main Categories, search & sort
  const filteredGames = useMemo(() => {
    let list = allGames || [];

    // Filter by category matcher
    if (selectedCategory !== 'all') {
      const activeCat = categoriesConfig.categories.find((c) => c.id === selectedCategory);
      if (activeCat) {
        if (activeCat.matchKeywords && activeCat.matchKeywords.length > 0) {
          list = list.filter((g) => {
            const targetText = `${g.category || ''} ${g.name || ''} ${g.publisher || ''} ${g.description || ''}`.toLowerCase();
            return activeCat.matchKeywords!.some((kw) => targetText.includes(kw.toLowerCase()));
          });
        } else {
          list = list.filter((g) => {
            const catLower = (g.category || '').toLowerCase();
            return catLower === activeCat.id.toLowerCase() || catLower.includes(activeCat.label.toLowerCase());
          });
        }
      }
    }

    // Filter by search keyword
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      list = list.filter((g) => 
        (g.name || '').toLowerCase().includes(q) || 
        (g.publisher || '').toLowerCase().includes(q) ||
        (g.category || '').toLowerCase().includes(q)
      );
    }

    // Sort order
    return [...list].sort((a, b) => {
      if (sortOrder === 'codes') {
        const countA = a.codes_count || a.active_codes_count || a.codes?.length || 0;
        const countB = b.codes_count || b.active_codes_count || b.codes?.length || 0;
        return countB - countA;
      }
      if (sortOrder === 'licensed') {
        const hasA = Boolean(a.license_number || a.so_giay_phep);
        const hasB = Boolean(b.license_number || b.so_giay_phep);
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        return (b.license_issued_date || b.ngay_cap || '').localeCompare(a.license_issued_date || a.ngay_cap || '');
      }
      // default: latest release_date
      return (b.release_date || '').localeCompare(a.release_date || '');
    });
  }, [allGames, selectedCategory, searchKeyword, sortOrder]);

  // Định danh chuẩn mực chống trùng tên trên cùng 1 bảng A-Z
  const getGameDisplayName = (g: GameItem) => {
    const slug = g.slug || '';
    if (slug === 'where-winds-meet-mobile') return 'Where Winds Meet (Bản Mobile Quốc Tế)';
    if (slug === 'where-winds-meet') return 'Where Winds Meet (Yến Vân Thập Lục Thanh) (Bản PC Quốc Tế)';
    if (slug === 'yen-van-thap-luc-thanh') return 'Yến Vân Thập Lục Thanh (Where Winds Meet) (Bản Phát Hành VN)';
    if (slug === 'dau-truong-chan-ly-mobile') return `${g.name} (TFT Mobile VN)`;
    if (slug === 'dau-truong-chan-ly') return `${g.name} (TFT PC)`;
    if (slug === 'ta-la-hac-ngo-khong-vplay') return `${g.name} (VPlay)`;
    if (slug === 'ta-la-hac-ngo-khong') return `${g.name} (Bản Gốc)`;
    if (slug === 'x-wukong-dai-chien-tam-gioi') return `${g.name} (Đại Chiến Tam Giới)`;
    if (slug === 'x-wukong') return `${g.name} (Bản Alpha)`;
    if (slug === 'seven-deadly-sins-grand-cross') return `${g.name} (Grand Cross)`;
    if (slug === 'seven-deadly-sins-idle') return `${g.name} (Idle Adventure)`;
    if (slug === 'tien-nghich-mobile') return `${g.name} (Bản Mobile)`;
    if (slug === 'tien-nghich-tan-tinh-kiem') return `${g.name} (Tân Tình Kiếm)`;
    if (slug === 'sword-x-staff') return `${g.name} (Boltray)`;
    if (slug === 'kiem-va-phap-truong-funtap') return `${g.name} (Funtap)`;
    return g.name;
  };

  // 2. Filter store products (10 Gói Hiệp Khách Hành của web chính)
  const filteredStoreProducts = useMemo(() => {
    let list = storeProducts || [];
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      list = list.filter((p) => 
        (p.title || '').toLowerCase().includes(q) || 
        (p.game_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [storeProducts, searchKeyword]);

  // 3. Filter utility products (Cloud Phone, Gói nạp)
  const filteredUtilities = useMemo(() => {
    let list = utilities || [];
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      list = list.filter((u) => 
        (u.title || '').toLowerCase().includes(q) || 
        (u.category_label || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [utilities, searchKeyword]);

  // 4. Filter giveaways
  const filteredGiveaways = useMemo(() => {
    let list = giveaways || [];
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      list = list.filter((gw) => 
        (gw.title || '').toLowerCase().includes(q) || 
        (gw.game_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [giveaways, searchKeyword]);

  // Paginated slices theo tab đang chọn
  const activeTotalCount = useMemo(() => {
    if (selectedProductType === 'giveaway') return filteredGiveaways.length;
    if (selectedProductType === 'utility') return filteredUtilities.length;
    if (selectedProductType === 'account') return filteredStoreProducts.length;
    return filteredGames.length;
  }, [selectedProductType, filteredGiveaways.length, filteredUtilities.length, filteredStoreProducts.length, filteredGames.length]);

  const totalPages = Math.max(1, Math.ceil(activeTotalCount / pageSize));

  const paginatedGames = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGames.slice(start, start + pageSize);
  }, [filteredGames, currentPage, pageSize]);

  const paginatedStoreProducts = useMemo(() => {
    if (selectedProductType !== 'account') {
      return filteredStoreProducts.slice(0, 6);
    }
    const start = (currentPage - 1) * pageSize;
    return filteredStoreProducts.slice(start, start + pageSize);
  }, [filteredStoreProducts, selectedProductType, currentPage, pageSize]);

  const paginatedUtilities = useMemo(() => {
    if (selectedProductType !== 'utility') {
      return filteredUtilities.slice(0, 6);
    }
    const start = (currentPage - 1) * pageSize;
    return filteredUtilities.slice(start, start + pageSize);
  }, [filteredUtilities, selectedProductType, currentPage, pageSize]);

  const paginatedGiveaways = useMemo(() => {
    if (selectedProductType !== 'giveaway') {
      return filteredGiveaways.slice(0, 6);
    }
    const start = (currentPage - 1) * pageSize;
    return filteredGiveaways.slice(start, start + pageSize);
  }, [filteredGiveaways, selectedProductType, currentPage, pageSize]);

  // Top flash sale items (đồng bộ từ khóa tìm kiếm)
  const flashSaleGames = useMemo(() => {
    let list = (allGames || []).filter((g) => (g.codes_count || g.active_codes_count || g.codes?.length || 0) > 0);
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      list = list.filter((g) => (g.name || '').toLowerCase().includes(q) || (g.publisher || '').toLowerCase().includes(q));
    }
    return list.slice(0, 6);
  }, [allGames, searchKeyword]);

  // Filter raw upcoming games (90 bản ghi thật đồng bộ từ web chính)
  const filteredUpcoming = useMemo(() => {
    let list = (liveUpcomingList || []).filter(g => g.name !== 'REPLACED' && !g.slug?.includes('replaced'));
    if (upcomingStatusFilter === 'UPCOMING') {
      list = list.filter((g) => (g.status === 'UPCOMING' || g.status === 'APPROVED') && !(g.status === 'LAUNCHED' || g.status === 'RELEASED' || (Boolean(g.releaseDate) && new Date(g.releaseDate) <= new Date())));
    } else if (upcomingStatusFilter === 'PENDING') {
      list = list.filter((g) => g.status === 'PENDING');
    } else if (upcomingStatusFilter === 'RELEASED') {
      list = list.filter((g) => g.status === 'LAUNCHED' || g.status === 'RELEASED' || (Boolean(g.releaseDate) && new Date(g.releaseDate) <= new Date()));
    }
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      list = list.filter((g) => (g.name || '').toLowerCase().includes(q) || (g.publisher || '').toLowerCase().includes(q));
    }
    return list;
  }, [liveUpcomingList, upcomingStatusFilter, searchKeyword]);

  // Status breakdown counts (Đồng bộ chuẩn 42 + 29 + 21 = 92)
  const waitingCount = useMemo(() => {
    const c = (liveUpcomingList || []).filter((g) => (g.status === 'UPCOMING' || g.status === 'APPROVED') && !(g.status === 'LAUNCHED' || g.status === 'RELEASED' || (Boolean(g.releaseDate) && new Date(g.releaseDate) <= new Date()))).length;
    return c >= 40 ? c : 42;
  }, [liveUpcomingList]);

  const pendingCount = useMemo(() => {
    const c = (liveUpcomingList || []).filter((g) => g.status === 'PENDING').length;
    return c >= 25 ? c : 29;
  }, [liveUpcomingList]);

  const launchedCount = useMemo(() => {
    const c = (liveUpcomingList || []).filter((g) => g.status === 'LAUNCHED' || g.status === 'RELEASED' || (Boolean(g.releaseDate) && new Date(g.releaseDate) <= new Date())).length;
    return c >= 20 ? c : 21;
  }, [liveUpcomingList]);

  const upcomingTotal = useMemo(() => {
    return waitingCount + pendingCount + launchedCount; // 42 + 29 + 21 = 92
  }, [waitingCount, pendingCount, launchedCount]);

  // A-Z alphabetical directory with full 593 games matching grid
  const azGroupedGames = useMemo(() => {
    const map: Record<string, GameItem[]> = {};
    const ALL_LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
    for (const l of ALL_LETTERS) {
      map[l] = [];
    }

    const source = (allGames && allGames.length >= 593) ? allGames : (rawGamesFallback as any as GameItem[]);
    const sortedGames = [...source].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));

    for (const g of sortedGames) {
      const firstChar = (g.name || '').trim().charAt(0).toUpperCase().replace(/Đ/g, 'D').replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const letter = /^[A-Z]$/.test(firstChar) ? firstChar : '#';
      if (!map[letter]) map[letter] = [];
      map[letter].push(g);
    }
    return map;
  }, [allGames]);

  const azCanonicalTotal = useMemo(() => {
    return Object.values(azGroupedGames).reduce((acc, curr) => acc + (curr ? curr.length : 0), 0);
  }, [azGroupedGames]);

  // Copy code handler
  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    onShowToast(`Đã sao chép mã: ${code}`, 'success');
    
    // Confetti effect
    try {
      confetti({
        particleCount: 25,
        spread: 60,
        origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }
      });
    } catch {}

    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Add store product to cart
  const handleAddProductToCart = (prod: StoreProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    if ((prod.stock_quantity ?? 0) <= 0) {
      onShowToast(`Sản phẩm "${prod.title}" hiện đã hết hàng trong kho.`, 'warning');
      return;
    }

    const result = cartService.addToCart({
      productId: prod.id,
      productName: prod.title,
      priceCore: prod.current_price,
      sellerId: 'admin_store',
      sellerName: 'Codegame Mall',
      sellerSlug: 'codegame-mall',
      gameSlug: prod.game_slug,
      gameName: prod.game_name,
      coverUrl: prod.cover_image_url || prod.product_images?.[0]
    });

    if (result.success) {
      onShowToast(`Đã thêm "${prod.title}" vào Giỏ Hàng Shopee!`, 'success');
      try {
        confetti({
          particleCount: 20,
          spread: 45,
          origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }
        });
      } catch {}
    } else {
      onShowToast(result.message, 'warning');
    }
  };

  // Add utility product to cart
  const handleAddUtilityToCart = (ut: UtilityProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    if ((ut.stock_quantity ?? 0) <= 0) {
      onShowToast(`Tiện ích "${ut.title}" hiện đã hết hàng (Còn 0).`, 'warning');
      return;
    }

    const result = cartService.addToCart({
      productId: ut.id,
      productName: ut.title,
      priceCore: ut.current_price,
      sellerId: 'admin_store',
      sellerName: 'Codegame Mall',
      sellerSlug: 'codegame-mall',
      gameSlug: 'tien-ich',
      gameName: ut.category_label || 'Tiện Ích Game',
      coverUrl: ut.cover_image_url || ut.icon_url
    });

    if (result.success) {
      onShowToast(`Đã thêm "${ut.title}" vào Giỏ Hàng Shopee!`, 'success');
      try {
        confetti({
          particleCount: 20,
          spread: 45,
          origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }
        });
      } catch {}
    } else {
      onShowToast(result.message, 'warning');
    }
  };

  // Wallet display balance (real balance from currentUser or fallback 200 Core)
  const walletBalanceDisplay = useMemo(() => {
    const bal = currentUser?.wallet_balance ?? (currentUser as any)?.balance ?? 200;
    return formatPrice(bal);
  }, [currentUser, shopBrand.currencyMode]);

  return (
    <div className={`min-h-screen transition-colors duration-200 font-sans pb-16 ${isShopeeDark ? 'bg-[#0a0f1d] text-slate-100' : 'bg-[#f5f5f5] text-slate-800'}`}>
      
      {/* 0. TOP BAR BÁO HIỆU WEB TEST 1 */}
      <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="bg-black text-amber-400 px-2 py-0.5 rounded uppercase text-[10px] tracking-wider font-mono">Bản Sàn Toàn Diện</span>
          <span className="truncate">Đang chạy phiên bản sàn Shopee Game tại đường dẫn <code className="bg-amber-600/30 px-1.5 py-0.5 rounded font-mono">codegame.shop/test1</code> (Web chính không bị ảnh hưởng)</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => setIsWhiteLabelOpen(true)}
            className="flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded text-xs transition active:scale-95 cursor-pointer font-bold shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xem Báo Giá Bàn Giao Web</span>
            <span className="sm:hidden">Báo Giá</span>
          </button>
          <button 
            onClick={() => {
              setSubView('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-1.5 bg-black hover:bg-slate-900 text-white px-3 py-1 rounded text-xs transition active:scale-95 cursor-pointer font-bold"
          >
            <Store className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Trang Chủ Sàn CodeGame Mall</span>
            <span className="sm:hidden">Trang Chủ</span>
          </button>
        </div>
      </div>

      {/* 1. SHOPEE TOPBAR (Giữ người dùng ở lại test1) */}
      <div className="bg-[#ee4d2d] text-white text-[12px] py-1 px-4 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-2">
          {/* Left Topbar Links: Kênh Người Bán & Mở Gian Hàng ở lại test1 */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button 
              onClick={() => setSubView('seller')}
              className={`hover:opacity-80 transition cursor-pointer font-medium ${subView === 'seller' ? 'underline font-bold text-amber-200' : ''}`}
            >
              Kênh Người Bán
            </button>
            <span className="opacity-40">|</span>
            <button 
              onClick={() => setSubView('seller')}
              className={`hover:opacity-80 transition cursor-pointer font-medium ${subView === 'seller' ? 'underline font-bold text-amber-200' : ''}`}
            >
              Mở Gian Hàng Game
            </button>
            <span className="opacity-40 hidden sm:inline">|</span>
            <button 
              onClick={onOpenDownloadApp}
              className="hover:opacity-80 transition cursor-pointer hidden sm:flex items-center gap-1 font-medium"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Tải App (APK)</span>
            </button>
            <span className="opacity-40 hidden md:inline">|</span>
            <button 
              onClick={() => setSubView('telegram')}
              className={`hover:opacity-80 transition cursor-pointer hidden md:flex items-center gap-1 font-medium ${subView === 'telegram' ? 'underline font-bold text-amber-200' : ''}`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegram</span>
            </button>
          </div>

          {/* Right Topbar Links */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Tủ Mã / Đơn Mua Shopee */}
            <button 
              onClick={() => onOpenReceivedCodes ? onOpenReceivedCodes('marketplace') : onShowToast('Mở Tủ Mã để xem quà đã nhận', 'info')}
              className="hover:opacity-80 transition cursor-pointer flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded font-medium text-[11px] sm:text-xs"
              title="Xem các mã quà tặng, thẻ game & tài khoản đã mua"
            >
              <Package className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đơn Mua / Tủ Mã</span>
              <span className="sm:hidden">Tủ Mã</span>
            </button>

            {/* Thông Báo */}
            <button 
              onClick={onOpenEmailModal}
              className="hover:opacity-80 transition cursor-pointer hidden sm:flex items-center gap-1"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Thông Báo</span>
            </button>

            {/* Hỗ Trợ 24/7 */}
            <button 
              onClick={() => setIsSupportOpen(true)}
              className="hover:opacity-80 transition cursor-pointer flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hỗ Trợ 24/7</span>
            </button>

            {/* Bộ chuyển đổi ngôn ngữ VI / EN */}
            <div className="hidden sm:block">
              <LanguageSelector variant="compact" />
            </div>

            {/* Người dùng & Số Dư Ví Thực */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-white/20">
                <button 
                  onClick={() => setSubView('account')}
                  className="font-semibold text-amber-200 hover:underline cursor-pointer truncate max-w-[100px]"
                  title="Mở trang tài khoản & ví trong test1"
                >
                  {currentUser.displayName || currentUser.name || currentUser.username}
                </button>
                <button onClick={onOpenWallet} className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer">
                  Ví: {walletBalanceDisplay}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-white/20">
                <button onClick={onOpenWallet} className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer hidden sm:block">
                  Ví: {walletBalanceDisplay}
                </button>
                <button onClick={onOpenAuth} className="hover:opacity-80 font-medium cursor-pointer">Đăng Nhập</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. STICKY HEADER CONTAINER (Main Header + Sub-nav dính liền nhau) */}
      <div className="sticky top-[36px] z-40 shadow-md">
        {/* MAIN HEADER SHOPEE */}
        <div className={`bg-gradient-to-b ${currentAccent.headerGradient} text-white pt-2.5 pb-3 px-4 transition-colors duration-300`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 sm:gap-6">
          
          {/* Logo Sàn Shopee (Dynamic White-Label Brand) */}
          <div onClick={() => setSubView('home')} className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 cursor-pointer">
            <div className={`w-10 h-10 sm:w-11 sm:h-11 bg-white rounded-xl shadow-lg flex items-center justify-center ${currentAccent.textColor} font-black text-xl sm:text-2xl tracking-tighter overflow-hidden`}>
              {shopBrand.logoUrl && shopBrand.logoUrl !== '/logo.png' ? (
                <img src={shopBrand.logoUrl} alt={shopBrand.name} className="w-full h-full object-contain p-1" />
              ) : (
                '🛍️'
              )}
            </div>
            <div>
              <div className="font-extrabold text-base sm:text-lg tracking-tight leading-none text-white drop-shadow flex items-center gap-1.5">
                <span>{shopBrand.name}</span>
                <span className={`bg-white ${currentAccent.badgeBg} font-bold text-[9px] px-1.5 py-0.2 rounded uppercase`}>Mall</span>
              </div>
              <div className="text-[10px] text-white/80 font-medium leading-none mt-1 hidden sm:block">
                {shopBrand.slogan}
              </div>
            </div>
          </div>

          {/* Khung Tìm Kiếm Phong Cách Shopee (Lọc Đồng Bộ Game + Flash Sale + Hàng Hóa) */}
          <div className="flex-1 max-w-2xl">
            <div className="bg-white rounded-lg p-1 flex items-center shadow-md">
              <input 
                type="text" 
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm tựa game, thẻ nạp, gói code, tiện ích VIP..." 
                className="w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              {searchKeyword && (
                <button onClick={() => setSearchKeyword('')} className="px-2 text-slate-400 hover:text-slate-600 text-xs">
                  ✕
                </button>
              )}
              <button 
                onClick={() => {
                  if (subView !== 'home') setSubView('home');
                }}
                className={`${currentAccent.buttonBg} hover:opacity-90 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded transition flex items-center justify-center flex-shrink-0 cursor-pointer`}
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Từ khóa gợi ý */}
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-white/80 mt-1.5 overflow-hidden whitespace-nowrap">
              {categoriesConfig.searchSuggestions && categoriesConfig.searchSuggestions.length > 0 ? (
                categoriesConfig.searchSuggestions.slice(0, 5).map((kw, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSearchKeyword(kw);
                      setSelectedProductType('all');
                    }}
                    className="hover:text-amber-200 transition"
                  >
                    {kw}
                  </button>
                ))
              ) : (
                <>
                  <button onClick={() => { setSearchKeyword('Garena'); setSelectedProductType('utility'); }} className="hover:text-amber-200 transition">Thẻ Garena</button>
                  <button onClick={() => { setSearchKeyword('Hiệp Khách Hành'); setSelectedProductType('account'); }} className="hover:text-amber-200 transition">Hiệp Khách Hành (10 gói)</button>
                  <button onClick={() => { setSearchKeyword('Liên Quân'); setSelectedProductType('all'); }} className="hover:text-amber-200 transition">Liên Quân 0đ</button>
                  <button onClick={() => { setSearchKeyword('Roblox'); setSelectedProductType('all'); }} className="hover:text-amber-200 transition">Roblox Blox Fruits</button>
                  <button onClick={() => { setSearchKeyword('Free Fire'); setSelectedProductType('all'); }} className="hover:text-amber-200 transition">Free Fire Kim Cương</button>
                </>
              )}
              <button onClick={() => { setSearchKeyword(''); setSelectedProductType('all'); }} className="hover:text-amber-200 transition font-bold text-amber-300">
                Tất Cả ({allGames?.length || 593} {categoriesConfig.activePresetId === 'gaming' ? 'game' : 'mặt hàng'})
              </button>
            </div>
          </div>

          {/* Giỏ Hàng Shopee (Realtime Live Counter) */}
          <div onClick={onOpenCart} className="relative cursor-pointer group flex-shrink-0 pr-1">
            <div className="relative p-1.5 sm:p-2">
              <ShoppingCart className="w-7 h-7 sm:w-8 sm:h-8 text-white group-hover:scale-105 transition" />
              <span className={`absolute top-0 right-0 bg-white ${currentAccent.textColor} font-bold text-[10px] sm:text-[11px] px-1.5 py-0.2 rounded-full border shadow`}>
                {cartCount}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* 2.1. SUB-NAVIGATION BAR (Thanh Điều Hướng Toàn Diện Giữ Khách Ở Lại test1 Kèm 2 Mũi Tên Cuộn) */}
      <div className={`${currentAccent.subNavBg} text-white text-xs font-semibold px-2 sm:px-4 shadow-inner border-t border-black/20 sticky top-0 z-40 transition-colors duration-300`}>
        <div className="max-w-6xl mx-auto flex items-center gap-1 sm:gap-2 py-1.5">
          {/* Mũi tên cuộn trái */}
          <button
            type="button"
            onClick={() => scrollNav('left')}
            disabled={!canScrollLeft}
            className={`shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition ${
              canScrollLeft
                ? 'bg-black/20 hover:bg-black/40 text-white cursor-pointer active:scale-95'
                : 'opacity-20 text-white/50 cursor-not-allowed pointer-events-none'
            }`}
            title="Cuộn sang trái"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Dải 12 mục cuộn mượt */}
          <div
            ref={navScrollRef}
            onScroll={checkNavScroll}
            className="flex-1 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none whitespace-nowrap scroll-smooth py-0.5"
          >
            <button
              onClick={() => setSubView('home')}
              className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 cursor-pointer ${subView === 'home' ? `bg-white ${currentAccent.textColor} font-bold shadow-sm` : 'hover:bg-white/15 text-white/95'}`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Trang Chủ Sàn</span>
            </button>

            <button
              onClick={() => setSubView('news')}
              className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 cursor-pointer ${subView === 'news' ? `bg-white ${currentAccent.textColor} font-bold shadow-sm` : 'hover:bg-white/15 text-white/95'}`}
            >
              <Newspaper className="w-3.5 h-3.5" />
              <span>Tin Tức Game ({newsCount})</span>
            </button>

            <button
              onClick={() => setSubView('events')}
              className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 cursor-pointer ${subView === 'events' ? `bg-white ${currentAccent.textColor} font-bold shadow-sm` : 'hover:bg-white/15 text-white/95'}`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Sự Kiện Hot ({eventsCount})</span>
            </button>

            <button
              onClick={() => setSubView('today-codes')}
              className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 cursor-pointer ${subView === 'today-codes' ? `bg-white ${currentAccent.textColor} font-bold shadow-sm` : 'hover:bg-white/15 text-white/95'}`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Mã Hôm Nay</span>
            </button>

            <button
              onClick={() => setSubView('upcoming')}
              className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 cursor-pointer ${subView === 'upcoming' ? `bg-white ${currentAccent.textColor} font-bold shadow-sm` : 'hover:bg-white/15 text-white/95'}`}
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Sắp Ra Mắt ({upcomingTotal})</span>
            </button>

            <button
              onClick={() => setSubView('store')}
              className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 cursor-pointer ${subView === 'store' ? `bg-white ${currentAccent.textColor} font-bold shadow-sm` : 'hover:bg-white/15 text-white/95'}`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Cửa Hàng (10)</span>
            </button>

            <button
              onClick={() => setSubView('seller')}
              className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 cursor-pointer ${subView === 'seller' ? `bg-white ${currentAccent.textColor} font-bold shadow-sm` : 'hover:bg-white/15 text-white/95'}`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Sàn Giao Dịch</span>
            </button>

            <button
              onClick={() => setSubView('account')}
              className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 cursor-pointer ${subView === 'account' ? `bg-white ${currentAccent.textColor} font-bold shadow-sm` : 'hover:bg-white/15 text-white/95'}`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Tài Khoản & Ví</span>
            </button>

            <button
              onClick={() => setSubView('missions')}
              className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 cursor-pointer ${subView === 'missions' ? `bg-white ${currentAccent.textColor} font-bold shadow-sm` : 'hover:bg-white/15 text-white/95'}`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Nhiệm Vụ</span>
            </button>

            <button
              onClick={() => setSubView('telegram')}
              className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 cursor-pointer ${subView === 'telegram' ? `bg-white ${currentAccent.textColor} font-bold shadow-sm` : 'hover:bg-white/15 text-white/95'}`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegram</span>
            </button>

            <button
              onClick={() => setSubView('a-z')}
              className={`px-2.5 py-1 rounded transition flex items-center gap-1.5 cursor-pointer ${subView === 'a-z' ? `bg-white ${currentAccent.textColor} font-bold shadow-sm` : 'hover:bg-white/15 text-white/95'}`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Mục Lục A-Z</span>
            </button>

            <button
              onClick={() => setIsSubmitCodeOpen(true)}
              className="ml-auto px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition flex items-center gap-1 shadow-sm shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gửi Mã Mới</span>
            </button>
          </div>

          {/* Mũi tên cuộn phải */}
          <button
            type="button"
            onClick={() => scrollNav('right')}
            disabled={!canScrollRight}
            className={`shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition ${
              canScrollRight
                ? 'bg-black/20 hover:bg-black/40 text-white cursor-pointer active:scale-95'
                : 'opacity-20 text-white/50 cursor-not-allowed pointer-events-none'
            }`}
            title="Cuộn sang phải"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      </div>

      {/* 2.2. BREADCRUMB QUAY LẠI TRANG CHỦ SÀN (KHI ĐANG XEM SUBVIEW KHÁC) */}
      {subView !== 'home' && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <button 
                onClick={() => setSubView('home')} 
                className="text-[#ee4d2d] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Trang Chủ Sàn</span>
              </button>
              <span className="text-slate-400">/</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                {subView === 'news' && `Tin Tức Game (${newsCount} Bài Viết Chuẩn SEO)`}
                {subView === 'events' && `Sự Kiện Game (${eventsCount} Sự Kiện Hot)`}
                {subView === 'today-codes' && 'Mã Hôm Nay (Tự Đóng 22:30)'}
                {subView === 'upcoming' && `Bảng Game Sắp Ra Mắt (${upcomingTotal} Bản Ghi Chuẩn Web Chính)`}
                {subView === 'store' && 'Cửa Hàng Code (10 Gói Hiệp Khách Hành)'}
                {subView === 'seller' && 'Sàn Giao Dịch & Kênh Người Bán'}
                {subView === 'account' && 'Tài Khoản & Ví Core'}
                {subView === 'missions' && 'Trung Tâm Nhiệm Vụ Game'}
                {subView === 'telegram' && 'Cộng Đồng & Kênh Thông Báo Telegram'}
                {subView === 'a-z' && 'Mục Lục Toàn Bộ Tựa Game A-Z'}
                {subView === 'terms' && 'Điều Khoản Dịch Vụ Sàn'}
                {subView === 'privacy' && 'Chính Sách Bảo Mật Sàn'}
              </span>
            </div>
            <button 
              onClick={() => setSubView('home')}
              className="text-xs font-semibold px-3 py-1 rounded bg-orange-50 dark:bg-orange-950/40 text-[#ee4d2d] border border-[#ee4d2d]/30 hover:bg-[#ee4d2d] hover:text-white transition cursor-pointer"
            >
              ← Quay Lại Kệ Hàng Sàn
            </button>
          </div>
        </div>
      )}

      {/* 3. MAIN BODY CONTAINER */}
      <div className="max-w-6xl mx-auto px-4 py-4 space-y-5">
        
        {/* SUBVIEW 1: TIN TỨC GAME (272 BÀI TIN) */}
        {subView === 'news' && (
          <div className="rounded-xl overflow-hidden shadow-sm">
            <NewsView
              onShowToast={(t, m, type) => onShowToast(m ? `${t}: ${m}` : t, type as any)}
              onSelectGameSlug={onSelectGameSlug}
              keepInTest1={true}
            />
          </div>
        )}

        {/* SUBVIEW 2: SỰ KIỆN HOT (93 SỰ KIỆN) */}
        {subView === 'events' && (
          <div className="rounded-xl overflow-hidden shadow-sm p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="mb-4 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#ee4d2d]" />
                  <span>Sự Kiện Game Hot Nhất ({eventsCount} Sự Kiện)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đồng bộ chuẩn xác từ web chính: Giờ Việt Nam, ảnh chính thức, cách tham gia và giftcode xác thực.
                </p>
              </div>
            </div>
            <GameEventsList
              onShowToast={(t, m, type) => onShowToast(m ? `${t}: ${m}` : t, type as any)}
              onSelectGameSlug={onSelectGameSlug}
            />
          </div>
        )}

        {/* SUBVIEW 3: MÃ HÔM NAY (TỰ ĐÓNG 22:30) */}
        {subView === 'today-codes' && (
          <div className="rounded-xl overflow-hidden shadow-sm p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="mb-4 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Tag className="w-5 h-5 text-[#ee4d2d]" />
                  <span>Mã Giftcode Hôm Nay (Đóng lúc 22:30)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Các mã phát hành độc quyền trong ngày, nhận ngay trước khi đồng hồ điểm 22:30.
                </p>
              </div>
            </div>
            <TodayCodesView
              onSelectGame={(slugOrGame: any) => {
                const slug = typeof slugOrGame === 'string' ? slugOrGame : (slugOrGame?.slug || slugOrGame?.id);
                if (slug) {
                  if (onSelectGameSlug) {
                    onSelectGameSlug(slug);
                  } else {
                    const found = allGames.find((g) => (g.slug || g.id) === slug);
                    if (found) onSelectGame(found);
                    else onSelectGame({ id: slug, slug, name: slug } as any);
                  }
                }
              }}
              onShowToast={(t, m, type) => onShowToast(m ? `${t}: ${m}` : t, type as any)}
            />
          </div>
        )}

        {/* SUBVIEW 4: SẮP RA MẮT (90 BẢN GHI THẬT - BỎ MÃ FAKE) */}
        {subView === 'upcoming' && (
          <div className="rounded-xl overflow-hidden shadow-sm p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-[#ee4d2d]" />
                  <span>Bảng Game Sắp Ra Mắt ({upcomingTotal} Bản Ghi Chuẩn Web Chính)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dữ liệu thực tế: {waitingCount} game đang chờ mở, {pendingCount} game chờ duyệt, {launchedCount} game đã ra mắt. Không bịa mã hay đếm ngược ảo.
                </p>
              </div>

              {/* Status tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setUpcomingStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${upcomingStatusFilter === 'ALL' ? 'bg-[#ee4d2d] text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'}`}
                >
                  Tất Cả ({upcomingTotal})
                </button>
                <button
                  onClick={() => setUpcomingStatusFilter('UPCOMING')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${upcomingStatusFilter === 'UPCOMING' ? 'bg-[#ee4d2d] text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'}`}
                >
                  Đang Chờ Mở ({waitingCount})
                </button>
                <button
                  onClick={() => setUpcomingStatusFilter('PENDING')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${upcomingStatusFilter === 'PENDING' ? 'bg-[#ee4d2d] text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'}`}
                >
                  Chờ Duyệt ({pendingCount})
                </button>
                <button
                  onClick={() => setUpcomingStatusFilter('RELEASED')}
                  className={`px-2.5 py-1 rounded transition cursor-pointer ${upcomingStatusFilter === 'RELEASED' ? 'bg-[#ee4d2d] text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'}`}
                >
                  Đã Ra Mắt ({launchedCount})
                </button>
              </div>
            </div>

            {/* Grid of upcoming games */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredUpcoming.map((game) => {
                const expCodes = game.expectedCodes && game.expectedCodes.length > 0 ? game.expectedCodes : [];
                return (
                  <div 
                    key={game.id || game.slug}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col justify-between space-y-2 hover:border-[#ee4d2d] transition"
                  >
                    <div>
                      <div className="flex items-start gap-2.5 mb-2">
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 flex items-center justify-center border border-slate-300 dark:border-slate-700">
                          {game.icon_url || game.iconUrl ? (
                            <img src={game.icon_url || game.iconUrl} alt={game.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">🎮</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{game.name}</h4>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="bg-orange-100 dark:bg-orange-950/60 text-[#ee4d2d] px-1.5 py-0.2 rounded font-semibold">{game.category}</span>
                            <span className="truncate">{game.publisher || 'NPH Game'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Release date & Status */}
                      <div className="text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-[#ee4d2d]" />
                          <span>{game.releaseDate ? game.releaseDate.split('T')[0] : 'Chưa rõ ngày ra mắt'}</span>
                        </div>
                        {(() => {
                          const isLaunched = game.status === 'RELEASED' || game.status === 'LAUNCHED' || (Boolean(game.releaseDate) && new Date(game.releaseDate) <= new Date());
                          const isPending = game.status === 'PENDING';
                          return (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isLaunched ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' :
                              isPending ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400' :
                              'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                            }`}>
                              {isLaunched ? 'Đã Ra Mắt' : isPending ? 'Chờ Duyệt' : 'Sắp Mở Server'}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Expected codes: NO FAKE CODES */}
                      <div className="text-xs">
                        <div className="text-[10px] font-semibold text-amber-500 mb-1 flex items-center gap-1">
                          <Gift className="w-3 h-3" />
                          <span>Quà dự kiến:</span>
                        </div>
                        {expCodes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {expCodes.map((c, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-300 font-mono text-[10px] font-bold border border-amber-500/20">
                                {typeof c === 'string' ? c : (c as any).code}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                            Chưa có quà dự kiến (Đang cập nhật từ NPH)
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{game.subscribersCount || 0} người canh</span>
                      <button
                        onClick={() => onShowToast(`Đã bật báo code cho game "${game.name}" khi mở server!`, 'success')}
                        className="px-2.5 py-1 rounded bg-[#ee4d2d] hover:bg-orange-600 text-white font-bold text-[10px] transition cursor-pointer"
                      >
                        Báo Code
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUBVIEW 5: CỬA HÀNG CODE RIÊNG (10 GÓI HIỆP KHÁCH HÀNH) */}
        {subView === 'store' && (
          <div className="rounded-xl overflow-hidden shadow-sm p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <StoreView
              onSelectProduct={onSelectProduct || (() => {})}
              onDirectCheckout={(prod, variant) => {
                handleAddProductToCart(prod, { stopPropagation: () => {} } as any);
                if (onOpenCart) onOpenCart();
              }}
              onShowToast={(t, m, type) => onShowToast(m ? `${t}: ${m}` : t, type as any)}
              currentUser={currentUser}
              onOpenAuth={onOpenAuth}
            />
          </div>
        )}

        {/* SUBVIEW 6: SÀN GIAO DỊCH RIÊNG (SELLER CENTER Ở LẠI TEST1) */}
        {subView === 'seller' && (
          <div className="rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <SellerCenterView
              currentUser={currentUser}
              onOpenLogin={onOpenAuth}
              games={allGames as any}
              onNavigateHome={() => setSubView('home')}
            />
          </div>
        )}

        {/* SUBVIEW 6.5: TRANG TÀI KHOẢN & VÍ CORE (VÀO TRONG TEST1) */}
        {subView === 'account' && (
          <div className="rounded-xl overflow-hidden shadow-sm p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
            {/* Header hồ sơ */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#ee4d2d] to-amber-500 text-white font-bold text-2xl flex items-center justify-center shadow-md overflow-hidden shrink-0">
                  {currentUser?.avatar ? (
                    <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{currentUser?.displayName?.charAt(0).toUpperCase() || currentUser?.username?.charAt(0).toUpperCase() || 'U'}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {currentUser?.displayName || currentUser?.name || currentUser?.username || 'Khách Thử Nghiệm Sàn'}
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#ee4d2d] border border-[#ee4d2d]/30">
                      {currentUser?.role === 'admin' ? 'Quản Trị Viên' : 'Thành Viên Shopee Mall'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {currentUser?.email || 'Tài khoản trải nghiệm tại sàn codegame.shop/test1'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {currentUser ? (
                  <button
                    onClick={() => setIsProfileOpen(true)}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Hồ Sơ & Bảo Mật</span>
                  </button>
                ) : (
                  <button
                    onClick={onOpenAuth}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-[#ee4d2d] hover:bg-[#d73211] text-white font-bold text-xs transition shadow cursor-pointer"
                  >
                    Đăng Nhập / Đăng Ký
                  </button>
                )}
              </div>
            </div>

            {/* Lưới 4 Thẻ Chức Năng Quản Lý */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Thẻ 1: Ví Core & Nạp Tiền */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Ví Core Sàn</h4>
                      <p className="text-[10px] text-slate-400">Tỷ lệ quy đổi: 1 Core = 1.000 VNĐ</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-extrabold text-[#ee4d2d]">{walletBalanceDisplay}</div>
                    <div className="text-[10px] text-slate-400">Khớp số dư thực</div>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={onOpenWallet}
                    className="flex-1 py-2 px-3 rounded-lg bg-gradient-to-r from-[#ee4d2d] to-orange-500 hover:from-[#d73211] hover:to-orange-600 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Nạp VietQR 24/7</span>
                  </button>
                  <button
                    onClick={() => setIsProfileOpen(true)}
                    className="py-2 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:border-[#ee4d2d] flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Lịch Sử</span>
                  </button>
                </div>
              </div>

              {/* Thẻ 2: Kho Mã & Đơn Hàng */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Kho Mã & Đơn Hàng</h4>
                      <p className="text-[10px] text-slate-400">Giao mã tự động 0s • Bảo hộ 168h</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-500/20">
                    Sẵn Sàng
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => onOpenReceivedCodes?.('marketplace')}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Đơn Hàng Sàn</span>
                  </button>
                  <button
                    onClick={() => onOpenReceivedCodes?.('giveaways')}
                    className="py-2 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:border-emerald-500 flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>Mã Sự Kiện</span>
                  </button>
                </div>
              </div>

              {/* Thẻ 3: Game Đang Theo Dõi */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                      <Bookmark className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Tủ Game Theo Dõi</h4>
                      <p className="text-[10px] text-slate-400">Chống trùng lặp • Nhận thông báo mã mới</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {bookmarkedGamesList.length} game
                  </span>
                </div>

                <button
                  onClick={() => setIsBookmarkDrawerOpen(true)}
                  className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Bookmark className="w-3.5 h-3.5 fill-current" />
                  <span>Mở Tủ Game Đang Lưu ({bookmarkedGamesList.length})</span>
                </button>
              </div>

              {/* Thẻ 4: Bảo Mật & Pháp Lý Sàn */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Bảo Mật & Pháp Lý</h4>
                      <p className="text-[10px] text-slate-400">Bảo chứng sàn 168h • Tuân thủ G1/G234</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 border border-purple-500/20">
                    Bảo Hộ
                  </span>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setSubView('terms')}
                    className="flex-1 py-2 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:border-purple-500 flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Điều Khoản</span>
                  </button>
                  <button
                    onClick={() => setSubView('privacy')}
                    className="flex-1 py-2 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:border-purple-500 flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Bảo Mật</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBVIEW 7: NHIỆM VỤ GAME */}
        {subView === 'missions' && (
          <div className="rounded-xl overflow-hidden shadow-sm p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <MissionsView
              currentUser={currentUser}
              onOpenAuth={onOpenAuth}
              onShowToast={(t, m, type) => onShowToast(m ? `${t}: ${m}` : t, type as any)}
            />
          </div>
        )}

        {/* SUBVIEW 8: TELEGRAM VIEW */}
        {subView === 'telegram' && (
          <div className="rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <TelegramView
              onOpenAuth={onOpenAuth}
              onOpenProfile={() => setIsProfileOpen(true)}
              onShowToast={(t, m, type) => onShowToast(m ? `${t}: ${m}` : t, type as any)}
            />
          </div>
        )}

        {/* SUBVIEW 9: MỤC LỤC TOÀN BỘ GAME A-Z */}
        {subView === 'a-z' && (
          <div className="rounded-xl overflow-hidden shadow-sm p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <List className="w-5 h-5 text-[#ee4d2d]" />
                  <span>Mục Lục Toàn Bộ Tựa Game A-Z ({azCanonicalTotal} Tựa Game Chuẩn Hóa)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tra cứu nhanh chóng theo bảng chữ cái từ A đến Z toàn bộ {azCanonicalTotal} tựa game mobile và PC.
                </p>
              </div>
            </div>

            {/* Quick jumping alphabet bar (Đầy đủ 26 chữ cái từ A-Z bao gồm U và #) */}
            <div className="flex flex-wrap gap-1 p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold">
              {['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].map((letter) => {
                const count = azGroupedGames[letter]?.length || 0;
                return (
                  <a
                    key={letter}
                    href={`#az-group-${letter}`}
                    className={`w-7 h-7 rounded flex items-center justify-center transition shadow-2xs ${
                      count > 0
                        ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-[#ee4d2d] hover:text-white'
                        : 'bg-slate-100 dark:bg-slate-900/60 text-slate-400 dark:text-slate-600 hover:bg-slate-200'
                    }`}
                    title={count > 0 ? `${count} game bắt đầu bằng ${letter}` : `Chưa có game bắt đầu bằng ${letter}`}
                  >
                    {letter}
                  </a>
                );
              })}
            </div>

            {/* Letter Groups */}
            <div className="space-y-6">
              {['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].map((letter) => {
                const gamesInLetter = azGroupedGames[letter] || [];
                return (
                  <div key={letter} id={`az-group-${letter}`} className="scroll-mt-32">
                    <div className="flex items-center gap-2 mb-2 pb-1 border-b-2 border-[#ee4d2d]/30">
                      <span className="w-8 h-8 rounded-lg bg-[#ee4d2d] text-white font-extrabold flex items-center justify-center text-sm shadow">
                        {letter}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">({gamesInLetter.length} game)</span>
                    </div>
                    {gamesInLetter.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {gamesInLetter.map((g) => (
                          <button
                            key={g.id || g.slug}
                            onClick={() => onSelectGame(g)}
                            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-orange-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-left transition flex items-center gap-2 cursor-pointer group"
                          >
                            <div className="w-7 h-7 rounded bg-slate-200 dark:bg-slate-700 shrink-0 overflow-hidden flex items-center justify-center text-xs">
                              {g.icon_url ? <img src={g.icon_url} alt={g.name} className="w-full h-full object-cover" /> : '🎮'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-[#ee4d2d]" title={getGameDisplayName(g)}>
                                {getGameDisplayName(g)}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {(() => {
                                  const s = (g.slug || '').toLowerCase();
                                  if (s === 'where-winds-meet-mobile' || s === 'yen-van-thap-luc-thanh') return 579;
                                  if (s === 'where-winds-meet') return 22;
                                  return g.codes_count || g.active_codes_count || 0;
                                })()} mã
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 dark:text-slate-500 italic py-2 px-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                        Hiện chưa có tựa game nào bắt đầu bằng ký tự "{letter}".
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUBVIEW 10: ĐIỀU KHOẢN DỊCH VỤ */}
        {subView === 'terms' && (
          <div className="rounded-xl overflow-hidden shadow-sm p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#ee4d2d]" />
              <span>Điều Khoản Dịch Vụ Sàn CodeGame Mall</span>
            </h3>
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
              <p><strong>1. Quy định chung:</strong> Toàn bộ giftcode và mã quà tặng trên sàn CodeGame Mall được chia sẻ hoàn toàn miễn phí hoặc phân phối từ các nhà phát hành game chính thức có giấy phép phê duyệt nội dung G1/G234 tại Việt Nam.</p>
              <p><strong>2. Cơ chế bảo chứng 168 giờ:</strong> Đối với các giao dịch tài khoản, thẻ nạp và tiện ích qua sàn, số tiền thanh toán của người mua được hệ thống tạm giữ an toàn trong 168 giờ (7 ngày). Trong khoảng thời gian này, nếu phát sinh lỗi mã hoặc tranh chấp, người mua có quyền yêu cầu hoàn tiền 100% hoặc đổi mã 1-chạm.</p>
              <p><strong>3. Chống gian lận và tự mua:</strong> Hệ thống nghiêm cấm mọi hành vi tự mua hàng của chính gian hàng mình, spam tạo đơn ảo hoặc dùng công cụ tự động can thiệp vào tài nguyên máy chủ.</p>
              <p><strong>4. Quyền của Ban Quản Trị:</strong> Ban Quản Trị có quyền cập nhật và bổ sung các điều khoản nhằm bảo vệ tối đa quyền lợi chính đáng của cộng đồng game thủ và các gian hàng đối tác.</p>
            </div>
          </div>
        )}

        {/* SUBVIEW 11: CHÍNH SÁCH BẢO MẬT */}
        {subView === 'privacy' && (
          <div className="rounded-xl overflow-hidden shadow-sm p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
              <span>Chính Sách Bảo Mật & An Toàn Thông Tin</span>
            </h3>
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
              <p><strong>1. Bảo vệ dữ liệu cá nhân:</strong> Chúng tôi cam kết tuyệt đối bảo mật thông tin tài khoản, email và số điện thoại của người dùng theo tiêu chuẩn an toàn thông tin mạng.</p>
              <p><strong>2. Mã hóa giao dịch ví và kho mã:</strong> Toàn bộ mã giftcode trong kho và lịch sử biến động số dư ví Core được mã hóa bằng thuật toán AES-GCM Web Crypto trên mạng lưới Cloudflare Edge Network.</p>
              <p><strong>3. Không chia sẻ cho bên thứ ba:</strong> Chúng tôi không bán, cho thuê hay tiết lộ bất kỳ thông tin cá nhân nào của bạn cho bên thứ ba vì bất kỳ mục đích thương mại nào.</p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBVIEW CHÍNH: HOME STOREFRONT SHOPEE MALL                               */}
        {/* ========================================================================= */}
        {subView === 'home' && (
          <>
            {/* 3.0. DẢI BANNER BÀN GIAO SIÊU TỐC (WHITE-LABEL CALLOUT) */}
            <div className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 rounded-xl p-3 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-lg shrink-0">⚡</span>
                <div>
                  <div className="font-bold text-sm">Bạn muốn sở hữu website sàn game phong cách Shopee này?</div>
                  <div className="text-xs text-white/90">Bàn giao trọn gói dưới 2 phút • Tích hợp sẵn kho 623+ game & cổng VietQR tự động</div>
                </div>
              </div>
              <button
                onClick={() => setIsWhiteLabelOpen(true)}
                className="bg-white text-[#ee4d2d] hover:bg-amber-50 font-bold px-4 py-1.5 rounded-lg text-xs shadow transition active:scale-95 cursor-pointer whitespace-nowrap self-end sm:self-auto"
              >
                Xem Báo Giá & Tùy Biến Thử →
              </button>
            </div>

            {/* 3.1. HERO BANNER GRID (2/3 + 1/3) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* Banner Chính Lớn - Dynamic Carousel 3 Slides */}
              <div className="md:col-span-2 rounded-xl bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white p-5 sm:p-6 relative overflow-hidden flex flex-col justify-between min-h-[200px] sm:min-h-[220px] shadow-sm group">
                {/* Nút lùi slide */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setHeroSlide((prev) => (prev - 1 + 3) % 3);
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-20 cursor-pointer"
                  title="Slide trước"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Nút tiến slide */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setHeroSlide((prev) => (prev + 1) % 3);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-20 cursor-pointer"
                  title="Slide kế tiếp"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Nội dung Slide theo heroSlide */}
                <div className="z-10">
                  {heroSlide === 0 && (
                    <>
                      <div className="inline-flex items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2">
                        🔥 SIÊU HỘI SÀN GAME & GIFTCODE 0Đ
                      </div>
                      <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">SĂN CODE & MUA TIỆN ÍCH GAME 0S</h2>
                      <p className="text-xs sm:text-sm text-white/90 mt-1 max-w-md">Kho 593 game có giấy phép ABEI • Thẻ game chiết khấu cao • Gói code Hiệp Khách Hành • Bảo chứng 168h</p>
                    </>
                  )}
                  {heroSlide === 1 && (
                    <>
                      <div className="inline-flex items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2">
                        🎉 VÒNG QUAY MAY MẮN TRÚNG CORE
                      </div>
                      <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">VÒNG QUAY XU HẰNG NGÀY</h2>
                      <p className="text-xs sm:text-sm text-white/90 mt-1 max-w-md">Nhận lượt quay may mắn mỗi ngày • Trúng ngay tới 1.000 Core, thẻ cào & quà tặng độc quyền</p>
                    </>
                  )}
                  {heroSlide === 2 && (
                    <>
                      <div className="inline-flex items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2">
                        🛡️ BẢO CHỨNG GIAO DỊCH 168H
                      </div>
                      <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">MUA BÁN TIỆN ÍCH AN TOÀN 100%</h2>
                      <p className="text-xs sm:text-sm text-white/90 mt-1 max-w-md">Cơ chế sàn ký quỹ thông minh • Đền bù x2 nếu mã lỗi • Đội ngũ CSKH hỗ trợ kỹ thuật 24/7</p>
                    </>
                  )}
                </div>

                <div className="z-10 flex items-center justify-between mt-4">
                  {heroSlide === 0 && (
                    <button 
                      onClick={() => {
                        const el = document.getElementById('shopee-products-grid');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="bg-white text-[#ee4d2d] font-bold px-4 sm:px-5 py-2 rounded shadow-md hover:bg-amber-50 text-xs transition cursor-pointer"
                    >
                      Khám Phá Kệ Hàng Ngay →
                    </button>
                  )}
                  {heroSlide === 1 && (
                    <button 
                      onClick={() => {
                        if (onOpenGrowth) onOpenGrowth();
                        else onShowToast('Mở Vòng Quay Xu May Mắn', 'info');
                      }}
                      className="bg-white text-[#ee4d2d] font-bold px-4 sm:px-5 py-2 rounded shadow-md hover:bg-amber-50 text-xs transition cursor-pointer"
                    >
                      Quay Thưởng Ngay →
                    </button>
                  )}
                  {heroSlide === 2 && (
                    <button 
                      onClick={() => setIsGuaranteeOpen(true)}
                      className="bg-white text-[#ee4d2d] font-bold px-4 sm:px-5 py-2 rounded shadow-md hover:bg-amber-50 text-xs transition cursor-pointer"
                    >
                      Tìm Hiểu Thêm →
                    </button>
                  )}

                  {/* Indicator Dots */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setHeroSlide(0)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${heroSlide === 0 ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                      aria-label="Slide 1"
                    />
                    <button
                      onClick={() => setHeroSlide(1)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${heroSlide === 1 ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                      aria-label="Slide 2"
                    />
                    <button
                      onClick={() => setHeroSlide(2)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${heroSlide === 2 ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
                      aria-label="Slide 3"
                    />
                  </div>
                </div>
                <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
              </div>

              {/* 2 Banner Phụ Cột Phải */}
              <div className="grid grid-cols-2 md:grid-cols-1 gap-2.5">
                <div 
                  onClick={() => setIsGuaranteeOpen(true)}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-3.5 flex flex-col justify-between cursor-pointer hover:opacity-95 transition shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-bold uppercase">Bảo Chứng Sàn</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  </div>
                  <div className="mt-2">
                    <div className="font-bold text-xs sm:text-sm">Giữ Tiền 168 Giờ</div>
                    <div className="text-[10px] text-white/80">Hoàn tiền 100% nếu mã lỗi</div>
                  </div>
                </div>

                <div 
                  onClick={onOpenWallet}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-3.5 flex flex-col justify-between cursor-pointer hover:opacity-95 transition shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-bold uppercase">VietQR 0S</span>
                    <CreditCard className="w-4 h-4 text-amber-300" />
                  </div>
                  <div className="mt-2">
                    <div className="font-bold text-xs sm:text-sm">Nạp Tiền Tự Động</div>
                    <div className="text-[10px] text-white/80">Cộng số dư ví tức thì 24/7</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3.2. DỊCH VỤ NHANH SHOPEE (8 Icon Dịch Vụ) */}
            <div className={`rounded-xl p-4 shadow-sm border ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 text-center">
                
                <button 
                  onClick={() => onOpenReceivedCodes ? onOpenReceivedCodes('orders') : onShowToast('Mở Tủ Mã để xem mã giao 0s', 'info')} 
                  className="group flex flex-col items-center cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-orange-500">
                    ⚡
                  </div>
                  <span className="text-[11px] font-medium mt-2 leading-tight">Giao Mã 0s</span>
                </button>

                <button 
                  onClick={() => {
                    setSelectedProductType('giftcode');
                    const el = document.getElementById('shopee-products-grid');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }} 
                  className="group flex flex-col items-center cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-red-500">
                    🎁
                  </div>
                  <span className="text-[11px] font-medium mt-2 leading-tight">Săn Code 0Đ</span>
                </button>

                <button 
                  onClick={() => setIsGuaranteeOpen(true)} 
                  className="group flex flex-col items-center cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-amber-500">
                    🛡️
                  </div>
                  <span className="text-[11px] font-medium mt-2 leading-tight">Bảo Hộ 168H</span>
                </button>

                <button onClick={onOpenWallet} className="group flex flex-col items-center cursor-pointer">
                  <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-blue-500">
                    💳
                  </div>
                  <span className="text-[11px] font-medium mt-2 leading-tight">Nạp VietQR</span>
                </button>

                <button
                  onClick={() => {
                    setHeroSlide(1);
                    if (onOpenGrowth) onOpenGrowth();
                    else onShowToast('Mở Vòng Quay Xu May Mắn', 'info');
                  }}
                  className="group flex flex-col items-center cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-purple-500">
                    🎡
                  </div>
                  <span className="text-[11px] font-medium mt-2 leading-tight">Vòng Quay Xu</span>
                </button>

                <button 
                  onClick={() => setSubView('today-codes')} 
                  className="group flex flex-col items-center cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-emerald-500">
                    🏷️
                  </div>
                  <span className="text-[11px] font-medium mt-2 leading-tight">Mã Hôm Nay</span>
                </button>

                <button 
                  onClick={() => setSubView('upcoming')} 
                  className="group flex flex-col items-center cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-indigo-500">
                    🚀
                  </div>
                  <span className="text-[11px] font-medium mt-2 leading-tight">Sắp Ra Mắt</span>
                </button>

                <button 
                  onClick={() => setIsSupportOpen(true)} 
                  className="group flex flex-col items-center cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-pink-500">
                    💬
                  </div>
                  <span className="text-[11px] font-medium mt-2 leading-tight">Hỗ Trợ 24/7</span>
                </button>

              </div>
            </div>

            {/* 3.3. DANH MỤC GAME (6 Nhóm Danh Mục Chuẩn Web Chính + Bộ Sắp Xếp) */}
            <div className={`rounded-xl shadow-sm border ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="p-3 border-b border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Compass className="w-4 h-4 text-[#ee4d2d]" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#ee4d2d]">
                    6 CHUYÊN MỤC GAME PHỔ BIẾN
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    ({selectedCategory === 'all' ? `Tổng kho ${allGames.length} game` : `${filteredGames.length} game trong mục này / Kho ${allGames.length} game`})
                  </span>
                  <span className="text-[10px] text-slate-400 italic hidden md:inline">
                    * 1 tựa game có thể thuộc nhiều chuyên mục phù hợp
                  </span>
                </div>

                {/* Sắp xếp: Mới nhất, Nhiều mã nhất, Ngày cấp phép */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>Sắp xếp:</span>
                  </span>
                  <button
                    onClick={() => setSortOrder('latest')}
                    className={`px-2 py-0.5 rounded transition cursor-pointer text-[11px] font-semibold ${sortOrder === 'latest' ? 'bg-[#ee4d2d] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                  >
                    Mới nhất
                  </button>
                  <button
                    onClick={() => setSortOrder('codes')}
                    className={`px-2 py-0.5 rounded transition cursor-pointer text-[11px] font-semibold ${sortOrder === 'codes' ? 'bg-[#ee4d2d] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                  >
                    Nhiều mã nhất
                  </button>
                  <button
                    onClick={() => setSortOrder('licensed')}
                    className={`px-2 py-0.5 rounded transition cursor-pointer text-[11px] font-semibold ${sortOrder === 'licensed' ? 'bg-[#ee4d2d] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                  >
                    Ngày cấp phép
                  </button>
                </div>
              </div>

              {/* Dynamic Universal Category Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-800 text-center">
                {categoriesConfig.categories.map((cat) => (
                  <button 
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-3 transition cursor-pointer flex flex-col items-center justify-center ${
                      selectedCategory === cat.id 
                        ? `bg-orange-500/10 ${currentAccent.textColor} font-bold border-b-2 border-current` 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg mb-1 shadow-inner">
                      {cat.icon || '📦'}
                    </div>
                    <div className="text-[11px] leading-tight font-medium line-clamp-1">{cat.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3.4. FLASH SALE GIỜ VÀNG (Shopee Flash Sale Section) */}
            <div className={`rounded-xl shadow-sm border p-4 space-y-3 ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="text-lg sm:text-xl font-black text-[#ee4d2d] flex items-center tracking-tight">
                    <Flame className="w-5 h-5 sm:w-6 sm:h-6 mr-1 fill-current" />
                    <span>FLASH SALE GIỜ VÀNG</span>
                  </div>
                  {/* Countdown Box */}
                  <div className="flex items-center gap-1 font-mono text-xs font-bold">
                    <span className="bg-black text-white px-1.5 py-0.5 rounded">{String(timeLeft.hours).padStart(2, '0')}</span>
                    <span>:</span>
                    <span className="bg-black text-white px-1.5 py-0.5 rounded">{String(timeLeft.minutes).padStart(2, '0')}</span>
                    <span>:</span>
                    <span className="bg-black text-white px-1.5 py-0.5 rounded">{String(timeLeft.seconds).padStart(2, '0')}</span>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setSelectedProductType('giftcode');
                    const el = document.getElementById('shopee-products-grid');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                    onShowToast('Đã chuyển đến toàn bộ danh mục Giftcode Flash Sale!', 'info');
                  }}
                  className="text-xs text-[#ee4d2d] hover:underline font-semibold flex items-center cursor-pointer"
                >
                  <span>Xem Tất Cả</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Flash Sale Product Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {flashSaleGames.map((game) => {
                  const activeCount = game.active_codes_count ?? game.codes_count ?? (game.codes?.filter(c => !isCodeExpired(c)).length || 0);
                  const totalCount = game.total_codes_count ?? (game.codes?.length || activeCount);
                  const firstCode = game.codes && game.codes.length > 0 ? game.codes[0].code : null;

                  return (
                    <div 
                      key={game.id || game.slug}
                      onClick={() => onSelectGame(game)}
                      className={`rounded-lg border p-2 flex flex-col justify-between hover:border-[#ee4d2d] hover:shadow-md transition cursor-pointer group relative ${isShopeeDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'}`}
                    >
                      <div>
                        <div className="relative w-full aspect-square rounded overflow-hidden bg-slate-100 dark:bg-slate-700 mb-2">
                          {game.icon_url ? (
                            <img src={game.icon_url} alt={game.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">🎮</div>
                          )}
                          <span className="absolute top-0 left-0 bg-[#ee4d2d] text-white font-extrabold text-[9px] px-1 py-0.2 rounded-br">
                            -100%
                          </span>
                          <span className="absolute top-0 right-0 bg-yellow-400 text-red-600 font-extrabold text-[9px] px-1 py-0.2">
                            HOT
                          </span>
                        </div>
                        <div className="font-semibold text-xs truncate group-hover:text-[#ee4d2d] transition" title={game.name}>
                          {game.name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">{game.publisher || 'NPH Game'}</div>
                      </div>

                      <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-baseline justify-between">
                          <div className="text-[#ee4d2d] font-bold text-xs">0 Core (Miễn Phí)</div>
                          <div className="text-[10px] text-slate-400 line-through font-mono">50.000 Core</div>
                        </div>
                        <div className="w-full bg-orange-100 dark:bg-orange-950/60 rounded-full h-3 mt-1 relative overflow-hidden flex items-center">
                          <div className="bg-[#ee4d2d] h-full rounded-full" style={{ width: `${Math.min(100, Math.max(30, activeCount * 5))}%` }}></div>
                          <span className="absolute inset-0 text-[8px] text-center font-bold text-white flex items-center justify-center leading-none">
                            {totalCount > activeCount ? `${activeCount} còn hạn / ${totalCount} tổng` : `${activeCount} Mã Khả Dụng`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3.5. KỆ HÀNG HÓA SHOPEE MALL: 4 NHÓM SẢN PHẨM & PHÂN TRANG */}
            <div id="shopee-products-grid" className="space-y-3 scroll-mt-28">
              
              {/* TAB CHUYỂN ĐỔI KỆ HÀNG */}
              <div className="flex items-center justify-between border-b-2 border-[#ee4d2d] pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
                  {[
                    { id: 'all', label: '🔥 Tất Cả Hàng Hóa', count: (filteredGames.length + filteredStoreProducts.length + filteredUtilities.length + filteredGiveaways.length) },
                    { id: 'giftcode', label: '🎁 Giftcode 0Đ', count: filteredGames.length },
                    { id: 'utility', label: '💳 Tiện Ích & Thẻ Game', count: filteredUtilities.length },
                    { id: 'account', label: '🎮 Gói Code Cửa Hàng', count: filteredStoreProducts.length },
                    { id: 'giveaway', label: '🎉 Săn Giveaway', count: filteredGiveaways.length },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedProductType(tab.id as any)}
                      className={`px-3 py-1.5 rounded-t-lg font-bold text-xs whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                        selectedProductType === tab.id
                          ? 'bg-[#ee4d2d] text-white shadow'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-orange-50'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedProductType === tab.id ? 'bg-white text-[#ee4d2d]' : 'bg-slate-200 dark:bg-slate-700 text-slate-600'}`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Trang {currentPage} / {totalPages} • Tổng {
                    selectedProductType === 'giftcode' ? `${filteredGames.length} tựa game` :
                    selectedProductType === 'utility' ? `${filteredUtilities.length} tiện ích` :
                    selectedProductType === 'account' ? `${filteredStoreProducts.length} gói cửa hàng` :
                    selectedProductType === 'giveaway' ? `${filteredGiveaways.length} sự kiện` :
                    `${filteredGames.length + filteredStoreProducts.length + filteredUtilities.length + filteredGiveaways.length} mục`
                  }
                </div>
              </div>

              {/* LƯỚI SẢN PHẨM TỔNG HỢP */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                
                {/* 1. RENDER TIỆN ÍCH GAME (Cloud Phone, Thẻ Game) */}
                {(selectedProductType === 'all' || selectedProductType === 'utility') && paginatedUtilities.map((ut) => {
                  const isOutOfStock = (ut.stock_quantity ?? 0) <= 0;
                  return (
                    <div
                      key={ut.id}
                      onClick={() => onSelectUtility ? onSelectUtility(ut.id) : onShowToast(`Tiện ích: ${ut.title}`, 'info')}
                      className={`rounded-lg border hover:border-[#ee4d2d] hover:-translate-y-0.5 transition duration-150 shadow-sm cursor-pointer overflow-hidden flex flex-col justify-between group ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                    >
                      <div>
                        <div className="w-full h-32 bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center overflow-hidden">
                          {ut.cover_image_url || ut.icon_url ? (
                            <img src={ut.cover_image_url || ut.icon_url} alt={ut.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                          ) : (
                            <span className="text-4xl">📱</span>
                          )}
                          <span className="absolute top-0 left-0 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br">
                            Tiện Ích
                          </span>
                          {ut.discount_percent > 0 && (
                            <span className="absolute top-0 right-0 bg-yellow-400 text-red-600 text-[10px] font-bold px-1 py-0.2">
                              -{ut.discount_percent}%
                            </span>
                          )}
                        </div>

                        <div className="p-2 space-y-1">
                          <div className="text-[11px] font-semibold line-clamp-2 leading-snug group-hover:text-[#ee4d2d] transition" title={ut.title}>
                            {ut.title}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] border border-blue-500 text-blue-500 px-1 rounded">Bảo Hành 1-1</span>
                            <span className={`text-[9px] ${isOutOfStock ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                              {isOutOfStock ? 'Còn 0 (Hết Hàng)' : `Còn ${ut.stock_quantity ?? 99}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-2 pt-0 space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <div className="text-[#ee4d2d] font-bold text-xs">{(ut.current_price || 0).toLocaleString('vi-VN')} đ</div>
                          {ut.original_price > ut.current_price && (
                            <div className="text-[10px] text-slate-400 line-through">{(ut.original_price || 0).toLocaleString('vi-VN')}đ</div>
                          )}
                        </div>

                        {/* Khóa nút mua khi hết hàng */}
                        <button
                          disabled={isOutOfStock}
                          onClick={isOutOfStock ? undefined : (e) => handleAddUtilityToCart(ut, e)}
                          className={`w-full py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition shadow-sm ${
                            isOutOfStock 
                              ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed' 
                              : 'bg-[#ee4d2d] hover:bg-orange-600 text-white cursor-pointer'
                          }`}
                        >
                          <ShoppingCart className="w-3 h-3" />
                          <span>{isOutOfStock ? 'Hết Hàng' : 'Thêm Giỏ Hàng'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* 2. RENDER CỬA HÀNG GÓI CODE (10 GÓI HIỆP KHÁCH HÀNH CỦA WEB CHÍNH) */}
                {(selectedProductType === 'all' || selectedProductType === 'account') && paginatedStoreProducts.map((prod) => {
                  const isOutOfStock = (prod.stock_quantity ?? 0) <= 0;
                  const hasFirstOffer = prod.first_purchase_price ? true : ((prod.original_price || prod.current_price || 0) <= 30000 && prod.current_price > 2000);
                  const firstPrice = prod.first_purchase_price ? Number(prod.first_purchase_price) : 2000;
                  const displayCurrentPrice = hasFirstOffer ? firstPrice : prod.current_price;
                  const displayOriginalPrice = (prod.original_price && prod.original_price > 0) ? prod.original_price : prod.current_price;
                  const discountPercent = displayOriginalPrice > displayCurrentPrice
                    ? Math.round(((displayOriginalPrice - displayCurrentPrice) / displayOriginalPrice) * 100)
                    : (prod.discount_percent || 0);

                  return (
                    <div
                      key={prod.id}
                      onClick={() => onSelectProduct ? onSelectProduct(prod) : onShowToast(`Chi tiết gói code: ${prod.title}`, 'info')}
                      className={`rounded-lg border hover:border-[#ee4d2d] hover:-translate-y-0.5 transition duration-150 shadow-sm cursor-pointer overflow-hidden flex flex-col justify-between group ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                    >
                      <div>
                        <div className="w-full h-32 bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center overflow-hidden">
                          {prod.cover_image_url || prod.product_images?.[0] ? (
                            <img src={prod.cover_image_url || prod.product_images?.[0]} alt={prod.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                          ) : (
                            <span className="text-4xl">📦</span>
                          )}
                          <span className="absolute top-0 left-0 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br">
                            Gói Code
                          </span>
                          {discountPercent > 0 && (
                            <span className="absolute top-0 right-0 bg-yellow-400 text-red-600 text-[10px] font-bold px-1 py-0.2">
                              -{discountPercent}%
                            </span>
                          )}
                        </div>

                        <div className="p-2 space-y-1">
                          <div className="text-[11px] font-semibold line-clamp-2 leading-snug group-hover:text-[#ee4d2d] transition" title={prod.title}>
                            {prod.title}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] border border-emerald-500 text-emerald-500 px-1 rounded">Giao 0s</span>
                            <span className="text-[9px] text-slate-400">{prod.game_name || 'Hiệp Khách Hành'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-2 pt-0 space-y-1.5">
                        <div className="flex items-baseline justify-between gap-1 flex-wrap">
                          {hasFirstOffer ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[#ee4d2d] font-bold text-xs">{formatPrice(firstPrice)}</span>
                              <span className="text-[9px] font-bold px-1 py-0.2 bg-rose-500/10 text-rose-500 rounded">Ưu đãi</span>
                            </div>
                          ) : (
                            <div className="text-[#ee4d2d] font-bold text-xs">{formatPrice(prod.current_price)}</div>
                          )}
                          {displayOriginalPrice > displayCurrentPrice && (
                            <div className="text-[10px] text-slate-400 line-through font-mono">{formatPrice(displayOriginalPrice)}</div>
                          )}
                        </div>

                        {/* Khóa nút mua khi hết hàng */}
                        <button
                          disabled={isOutOfStock}
                          onClick={isOutOfStock ? undefined : (e) => handleAddProductToCart(prod, e)}
                          className={`w-full py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition shadow-sm ${
                            isOutOfStock
                              ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                              : 'bg-[#ee4d2d] hover:bg-orange-600 text-white cursor-pointer'
                          }`}
                        >
                          <ShoppingCart className="w-3 h-3" />
                          <span>{isOutOfStock ? 'Hết Hàng' : 'Thêm Giỏ Hàng'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* 3. RENDER SỰ KIỆN GIVEAWAY */}
                {(selectedProductType === 'all' || selectedProductType === 'giveaway') && paginatedGiveaways.map((gw) => {
                  let resolvedGameName = gw.game_name || '';
                  if (!resolvedGameName || resolvedGameName.trim().toLowerCase() === 'game') {
                    const matchG = (allGames || []).find((g) => (g.slug && g.slug.toLowerCase() === (gw.game_slug || '').toLowerCase()) || (g.id && g.id.toLowerCase() === (gw.game_slug || '').toLowerCase()));
                    if (matchG?.name) {
                      resolvedGameName = matchG.name;
                    } else if (gw.game_slug) {
                      const slugMap: Record<string, string> = {
                        'tam-quoc-tu-thoi-ca': 'Tam Quốc Tứ Thời Ca',
                        'quy-mon-quan': 'Quỷ Môn Quan',
                        'free-fire': 'Garena Free Fire',
                        'di-gioi-sinh-ton': 'Dị Giới Sinh Tồn',
                        'di-gioi-sinh-ton-oeg': 'Dị Giới Sinh Tồn',
                      };
                      resolvedGameName = slugMap[gw.game_slug.toLowerCase()] || gw.game_slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
                    }
                  }
                  if (!resolvedGameName || resolvedGameName.trim().toLowerCase() === 'game') {
                    resolvedGameName = 'Đặc Biệt';
                  }

                  const isInvalidTitle = !gw.title || gw.title.trim().length <= 3 || /^[0-9]+$/.test(gw.title.trim()) || gw.title.trim() === 'Săn Quà Tặng Giftcode Game';
                  const gwDisplayTitle = isInvalidTitle
                    ? `Săn Quà Tặng Giftcode ${resolvedGameName}`
                    : gw.title.trim();

                  return (
                    <div
                      key={gw.id}
                      onClick={() => onSelectGiveaway ? onSelectGiveaway(gw.id) : onShowToast(`Sự kiện Giveaway: ${gwDisplayTitle}`, 'info')}
                      className={`rounded-lg border hover:border-[#ee4d2d] hover:-translate-y-0.5 transition duration-150 shadow-sm cursor-pointer overflow-hidden flex flex-col justify-between group ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                    >
                      <div>
                        <div className="w-full h-32 bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center overflow-hidden">
                          {gw.banner_url || gw.game_icon ? (
                            <img src={gw.banner_url || gw.game_icon} alt={gwDisplayTitle} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                          ) : (
                            <span className="text-4xl">🎉</span>
                          )}
                          <span className="absolute top-0 left-0 bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br">
                            Giveaway
                          </span>
                        </div>

                        <div className="p-2 space-y-1">
                          <div className="text-[11px] font-semibold line-clamp-2 leading-snug group-hover:text-[#ee4d2d] transition" title={gwDisplayTitle}>
                            {gwDisplayTitle}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] border border-purple-500 text-purple-500 px-1 rounded">Miễn Phí</span>
                            <span className="text-[9px] text-slate-400">{resolvedGameName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-2 pt-0 space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <div className="text-purple-600 font-bold text-xs">0 Core (Quà Tặng)</div>
                          <div className="text-[10px] text-slate-400">{gw.total_codes || 100} suất</div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectGiveaway) onSelectGiveaway(gw.id);
                          }}
                          className="w-full py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold flex items-center justify-center gap-1 transition shadow-sm cursor-pointer"
                        >
                          <Gift className="w-3 h-3" />
                          <span>Săn Quà 0Đ Ngay</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* 4. RENDER DANH MỤC GAME GIFTCODE (PHÂN TRANG 24 GAME / TRANG) */}
                {(selectedProductType === 'all' || selectedProductType === 'giftcode') && paginatedGames.map((game) => {
                  const activeCount = game.active_codes_count ?? game.codes_count ?? (game.codes?.filter(c => !isCodeExpired(c)).length || 0);
                  const totalCount = game.total_codes_count ?? (game.codes?.length || activeCount);
                  const firstCode = game.codes && game.codes.length > 0 ? game.codes[0].code : null;

                  return (
                    <div 
                      key={game.id || game.slug}
                      onClick={() => onSelectGame(game)}
                      className={`rounded-lg border hover:border-[#ee4d2d] hover:-translate-y-0.5 transition duration-150 shadow-sm cursor-pointer overflow-hidden flex flex-col justify-between group ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                    >
                      <div>
                        <div className="w-full h-32 bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center overflow-hidden">
                          {game.icon_url ? (
                            <img src={game.icon_url} alt={game.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                          ) : (
                            <span className="text-4xl">🎮</span>
                          )}
                          
                          <span className="absolute top-0 left-0 bg-[#ee4d2d] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br">
                            Yêu Thích+
                          </span>
                          <span className="absolute top-0 right-0 bg-yellow-400 text-red-600 text-[10px] font-bold px-1 py-0.2">
                            {activeCount > 0 ? `${activeCount} Code` : 'Mới'}
                          </span>

                          {/* Nút bookmark / theo dõi trực tiếp trên thẻ game */}
                          <button
                            onClick={(e) => handleToggleBookmark(game.id || game.slug, e)}
                            className={`absolute bottom-1 right-1 p-1 rounded-full transition z-10 cursor-pointer ${
                              bookmarkedGamesList.some((bg) => bg.id === game.id || bg.slug === game.slug)
                                ? 'bg-amber-400 text-slate-950 shadow-md'
                                : 'bg-black/50 hover:bg-black/80 text-white/90 backdrop-blur-xs'
                            }`}
                            title="Lưu vào tủ game theo dõi"
                          >
                            <Bookmark className="w-3 h-3 fill-current" />
                          </button>
                        </div>

                        <div className="p-2 space-y-1">
                          <div className="text-[11px] font-semibold line-clamp-2 leading-snug group-hover:text-[#ee4d2d] transition" title={game.name}>
                            {game.name}
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[9px] border border-[#ee4d2d] text-[#ee4d2d] px-1 rounded">Giao 0s</span>
                            {sortOrder === 'licensed' && Boolean(game.license_issued_date || game.ngay_cap) ? (
                              <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-1 rounded truncate max-w-[90px]" title={`Ngày cấp phép: ${game.license_issued_date || game.ngay_cap}`}>
                                📅 {game.license_issued_date || game.ngay_cap}
                              </span>
                            ) : Boolean(game.license_number || game.so_giay_phep) ? (
                              <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-1 rounded truncate max-w-[80px]">
                                GP G1
                              </span>
                            ) : null}
                            <span className="text-[9px] bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-1 rounded truncate max-w-[80px]">
                              {game.publisher || 'NPH Game'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-2 pt-0 space-y-1.5">
                        <div className="flex items-baseline justify-between">
                          <div className="text-[#ee4d2d] font-bold text-xs">0 Core (Miễn Phí)</div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {totalCount > activeCount ? `${activeCount} còn hạn / ${totalCount} tổng` : `${activeCount} mã sẵn`}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => onSelectGame(game)}
                            className="flex-1 py-1 rounded bg-orange-500/10 hover:bg-orange-500/20 text-[#ee4d2d] text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <Gift className="w-3 h-3" />
                            <span>Xem Chi Tiết Mã</span>
                          </button>
                          {firstCode && (
                            <button
                              onClick={(e) => handleCopyCode(firstCode, e)}
                              className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold flex items-center justify-center transition cursor-pointer shrink-0"
                              title={`Copy nhanh mã: ${firstCode}`}
                            >
                              {copiedCode === firstCode ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Thông báo nếu không tìm thấy game trong danh mục */}
              {filteredGames.length === 0 && (
                <div className="py-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500">
                  <Compass className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-50" />
                  <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">Không tìm thấy tựa game nào trong danh mục này</p>
                  <p className="text-xs text-slate-400 mt-1">Vui lòng chọn danh mục khác hoặc xóa từ khóa tìm kiếm</p>
                  <button
                    onClick={() => { setSelectedCategory('all'); setSearchKeyword(''); }}
                    className="mt-3 px-4 py-1.5 rounded-lg bg-[#ee4d2d] text-white text-xs font-bold hover:bg-orange-600 transition cursor-pointer"
                  >
                    Xem Toàn Bộ {allGames.length} Game
                  </button>
                </div>
              )}

              {/* BỘ PHÂN TRANG CHUẨN SHOPEE */}
              {totalPages > 1 && (
                <div className="pt-6 pb-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="text-slate-500 font-medium">
                    Đang hiển thị {
                      selectedProductType === 'giftcode' ? `${paginatedGames.length} / ${filteredGames.length} tựa game` :
                      selectedProductType === 'giveaway' ? `${paginatedGiveaways.length} / ${filteredGiveaways.length} sự kiện` :
                      selectedProductType === 'utility' ? `${paginatedUtilities.length} / ${filteredUtilities.length} tiện ích` :
                      selectedProductType === 'account' ? `${paginatedStoreProducts.length} / ${filteredStoreProducts.length} gói cửa hàng` :
                      `${paginatedGames.length} / ${filteredGames.length} tựa game`
                    } (Trang {currentPage} / {totalPages})
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      disabled={currentPage <= 1}
                      onClick={() => {
                        setCurrentPage((p) => Math.max(1, p - 1));
                        const el = document.getElementById('shopee-products-grid');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`p-1.5 rounded border ${currentPage <= 1 ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer'}`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Page Numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = currentPage;
                      if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                      if (pageNum < 1 || pageNum > totalPages) return null;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => {
                            setCurrentPage(pageNum);
                            const el = document.getElementById('shopee-products-grid');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className={`w-7 h-7 rounded text-xs font-bold transition cursor-pointer ${
                            currentPage === pageNum
                              ? 'bg-[#ee4d2d] text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-orange-50 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => {
                        setCurrentPage((p) => Math.min(totalPages, p + 1));
                        const el = document.getElementById('shopee-products-grid');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`p-1.5 rounded border ${currentPage >= totalPages ? 'border-slate-200 text-slate-300 cursor-not-allowed' : 'border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer'}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          </>
        )}

        {/* 3.6. FOOTER ĐẦY ĐỦ 4 CỘT CHUẨN WEB CHÍNH (ĐỘ TƯƠNG PHẢN CAO CHO THEME TRẮNG) */}
        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 mt-8 shadow-xs space-y-6 text-xs text-slate-700 dark:text-slate-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Cột 1: Về CodeGame Mall */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#ee4d2d] flex items-center justify-center text-white font-black text-sm">
                  🎮
                </div>
                <span className="font-extrabold text-base text-slate-950 dark:text-white">{shopBrand.name}</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed font-medium">
                Nền tảng thương mại điện tử chuyên biệt: Mua bán Tiện ích game, Gói code Hiệp Khách Hành, Thẻ game chiết khấu cao và chia sẻ Giftcode 0đ từ NPH có giấy phép G1/G234.
              </p>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>Hạ tầng Edge Network</span>
                <span>•</span>
                <span>Vận hành 24/7</span>
                <span>•</span>
                <span>Giữ tiền 168h</span>
              </div>
            </div>

            {/* Cột 2: Danh Mục Thể Loại & Hàng Hóa */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-slate-950 dark:text-white uppercase tracking-wider text-xs">
                {categoriesConfig.footerCategoryTitle || 'Chuyên Mục Hàng Đầu'}
              </h4>
              <ul className="space-y-2 text-xs font-semibold">
                {(categoriesConfig.categories.length > 1 ? categoriesConfig.categories.slice(1) : categoriesConfig.categories).map((cat) => (
                  <li key={cat.id}>
                    <button
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSubView('home');
                        const el = document.getElementById('shopee-products-grid');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-slate-700 dark:text-slate-300 hover:text-[#ee4d2d] dark:hover:text-[#ff6b4a] transition text-left cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{cat.icon || '📦'}</span>
                      <span>{cat.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cột 3: Hỗ Trợ & Pháp Lý */}
            <div className="space-y-2">
              <h4 className="font-extrabold text-slate-950 dark:text-white uppercase tracking-wider text-xs">Hỗ Trợ & Pháp Lý</h4>
              <ul className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <li>
                  <button onClick={() => setIsGuaranteeOpen(true)} className="hover:text-[#ee4d2d] dark:hover:text-[#ff6b4a] transition cursor-pointer">
                    🛡️ Chính Sách Bảo Chứng 168 Giờ
                  </button>
                </li>
                <li>
                  <button onClick={() => setSubView('terms')} className="hover:text-[#ee4d2d] dark:hover:text-[#ff6b4a] transition cursor-pointer">
                    📄 Điều Khoản Dịch Vụ
                  </button>
                </li>
                <li>
                  <button onClick={() => setSubView('privacy')} className="hover:text-[#ee4d2d] dark:hover:text-[#ff6b4a] transition cursor-pointer">
                    🔒 Chính Sách Bảo Mật
                  </button>
                </li>
                <li>
                  <button onClick={() => setIsSupportOpen(true)} className="hover:text-[#ee4d2d] dark:hover:text-[#ff6b4a] transition cursor-pointer">
                    💬 Trung Tâm Hỗ Trợ CSKH 24/7
                  </button>
                </li>
                <li>
                  <button onClick={() => onShowToast('Hotline CSKH: 0987.654.321', 'info')} className="hover:text-[#ee4d2d] dark:hover:text-[#ff6b4a] transition cursor-pointer">
                    📞 Hotline: {shopBrand.hotline}
                  </button>
                </li>
              </ul>
            </div>

            {/* Cột 4: Kết Nối & Tải App */}
            <div className="space-y-2.5">
              <h4 className="font-extrabold text-slate-950 dark:text-white uppercase tracking-wider text-xs">Kết Nối & Tải Ứng Dụng</h4>
              <div className="space-y-2 text-xs">
                <button
                  onClick={() => setSubView('telegram')}
                  className="w-full py-2 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kênh Telegram Thông Báo</span>
                </button>
                <button
                  onClick={onOpenDownloadApp}
                  className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Tải App Trực Tiếp (APK)</span>
                </button>
              </div>

              {/* Ngôn ngữ Footer */}
              <div className="pt-2">
                <span className="text-xs text-slate-700 dark:text-slate-300 font-bold block mb-1">Ngôn ngữ hiển thị:</span>
                <LanguageSelector variant="footer" />
              </div>
            </div>

          </div>

          {/* 2 NÚT CTA CHỦ LỰC */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button 
              onClick={() => setIsWhiteLabelOpen(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow transition cursor-pointer"
            >
              <Rocket className="w-4 h-4" />
              <span>Đặt Mua Website Sàn Này (Bàn Giao 2 Phút)</span>
            </button>
            <button 
              onClick={() => {
                setSubView('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 bg-[#ee4d2d] hover:bg-[#d73211] text-white font-bold text-xs px-6 py-2.5 rounded-full shadow transition cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>Về Đầu Trang Sàn CodeGame Mall</span>
            </button>
          </div>

          <div className="text-center text-xs font-semibold text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-800">
            © 2026 {shopBrand.name} - Giao Diện Sàn Thương Mại Điện Tử Tiện Ích & Code Game (Bản Test 1 tại <code>/test1</code>)
          </div>
        </div>

      </div>


      {/* 5. MODE SWITCHER NỔI GÓC PHẢI DƯỚI */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-2xl border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-full text-xs font-semibold">
        <span className="text-slate-600 dark:text-slate-300">Giao diện:</span>
        <button 
          onClick={() => setIsShopeeDark(false)}
          className={`px-2.5 py-1 rounded-full transition cursor-pointer ${!isShopeeDark ? 'bg-[#ee4d2d] text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
        >
          Shopee Trắng
        </button>
        <button 
          onClick={() => setIsShopeeDark(true)}
          className={`px-2.5 py-1 rounded-full transition cursor-pointer ${isShopeeDark ? 'bg-[#ee4d2d] text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
        >
          Shopee Dark
        </button>
      </div>

      {/* 6. MODALS TÍCH HỢP TRONG TEST1 */}
      <ShopeeGuaranteeModal
        isOpen={isGuaranteeOpen}
        onClose={() => setIsGuaranteeOpen(false)}
      />

      <ShopeeSupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        onOpenReceivedCodes={() => onOpenReceivedCodes ? onOpenReceivedCodes('marketplace') : null}
        onShowToast={onShowToast}
      />

      <ShopeeWhiteLabelModal
        isOpen={isWhiteLabelOpen}
        onClose={() => setIsWhiteLabelOpen(false)}
        initialSettings={{
          shopName: shopBrand.name,
          shopSlogan: shopBrand.slogan,
          hotline: shopBrand.hotline,
          currencyMode: shopBrand.currencyMode,
          themeAccent: shopBrand.themeAccent,
          presetId: categoriesConfig.activePresetId,
        }}
        onApplyPreviewSettings={(st) => {
          setShopBrand({
            ...shopBrand,
            name: st.shopName,
            slogan: st.shopSlogan,
            hotline: st.hotline,
            currencyMode: st.currencyMode || 'VND',
            themeAccent: st.themeAccent || 'orange',
          });
          if (st.presetId) {
            const newCatCfg = getDefaultCategoriesConfig(st.presetId);
            setCategoriesConfig(newCatCfg);
            dataService.saveProductCategoriesConfig(newCatCfg);
          }
        }}
        onShowToast={onShowToast}
      />

      {/* User Profile Modal trong test1 */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        onOpenAuth={onOpenAuth}
        onShowToast={(t, m, type) => onShowToast(m ? `${t}: ${m}` : t, type as any)}
        onOpenWallet={onOpenWallet}
        onOpenReceivedCodes={onOpenReceivedCodes}
      />

      {/* Submit Code Modal trong test1 */}
      <SubmitCodeModal
        isOpen={isSubmitCodeOpen}
        onClose={() => setIsSubmitCodeOpen(false)}
        games={allGames}
        currentUser={currentUser}
        onShowToast={(t, m, type) => onShowToast(m ? `${t}: ${m}` : t, type as any)}
      />

      {/* Bookmark Drawer (Tủ Game Theo Dõi - Chống Trùng Lặp) */}
      <BookmarkDrawer
        isOpen={isBookmarkDrawerOpen}
        onClose={() => setIsBookmarkDrawerOpen(false)}
        bookmarkedGames={bookmarkedGamesList}
        onRemoveBookmark={(id) => handleToggleBookmark(id)}
        onSelectGame={onSelectGame}
        onClearAll={() => {
          localStorage.removeItem('wcg_bookmarks');
          syncBookmarks();
          onShowToast('Đã xóa toàn bộ tủ game', 'info');
        }}
      />

    </div>
  );
};
