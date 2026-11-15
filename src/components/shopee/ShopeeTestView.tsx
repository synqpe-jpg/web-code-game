import React, { useState, useMemo, useEffect } from 'react';
import type { GameItem, UserProfile, StoreProduct, UtilityProduct, GiveawayCampaign, UpcomingGame } from '../../types/game';
import { 
  Search, ShoppingCart, Bell, HelpCircle, ArrowLeft, 
  Zap, Gift, ShieldCheck, CreditCard, Flame, Sparkles, 
  ChevronRight, Smartphone, Compass, Trophy, Copy, Check,
  ShoppingBag, Package, User, Tag, Plus, CheckCircle, ExternalLink,
  Layers, Clock, PhoneCall, Send, ShieldAlert, Sparkle, Rocket
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { cartService } from '../../services/cartService';
import { ShopeeGuaranteeModal } from './ShopeeGuaranteeModal';
import { ShopeeSupportModal } from './ShopeeSupportModal';
import { ShopeeWhiteLabelModal } from './ShopeeWhiteLabelModal';

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
  // Theme state within Shopee view (Supports Classic Orange/White or Dark Gamer)
  const [isShopeeDark, setIsShopeeDark] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedProductType, setSelectedProductType] = useState<'all' | 'giftcode' | 'utility' | 'account' | 'giveaway'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modals state
  const [isGuaranteeOpen, setIsGuaranteeOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isWhiteLabelOpen, setIsWhiteLabelOpen] = useState(false);

  // White-Label Customizable Shop Brand
  const [shopBrand, setShopBrand] = useState({
    name: 'CodeGame Mall',
    slogan: 'Sàn TMĐT Tiện Ích & Code Game #1 Việt Nam',
    hotline: '0987.654.321'
  });

  // Shopping cart badge count
  const [cartCount, setCartCount] = useState<number>(() => {
    try {
      return cartService.getCart().length;
    } catch {
      return 0;
    }
  });

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

  // Countdown timer for Flash Sale
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 15, seconds: 48 });
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 2, minutes: 59, seconds: 59 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulated Realtime Social Proof Ticker (Shopee Live Notifications)
  const [fomoNotice, setFomoNotice] = useState<{ text: string; time: string; icon: string } | null>({
    text: 'Khách hàng 098*** vừa mua Thẻ Garena 50K',
    time: 'Vừa xong',
    icon: '💳'
  });

  useEffect(() => {
    const fomoSamples = [
      { text: 'Khách hàng 097*** vừa mua Thẻ Garena 100K', icon: '💳' },
      { text: 'Khách hàng tuan*** vừa nhận mã Blox Fruits', icon: '🎁' },
      { text: 'Khách hàng minh*** vừa mua Acc Liên Quân Trắng TT', icon: '🎮' },
      { text: 'Khách hàng le*** vừa nạp 200.000 Xu qua VietQR', icon: '⚡' },
      { text: 'Khách hàng phuong*** vừa săn thành công Giftcode FC Online', icon: '🎁' },
      { text: 'Khách hàng hung*** vừa mua Gói Nạp Kim Cương Free Fire', icon: '💎' },
      { text: 'Khách hàng tran*** vừa nhận Code Genshin Impact 0đ', icon: '✨' },
    ];

    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % fomoSamples.length;
      setFomoNotice({
        text: fomoSamples[idx].text,
        time: 'Vừa xong',
        icon: fomoSamples[idx].icon
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Filter games based on search & category
  const filteredGames = useMemo(() => {
    let list = allGames || [];
    if (selectedCategory !== 'all') {
      list = list.filter((g) => {
        const cat = (g.category || '').toLowerCase();
        return cat.includes(selectedCategory.toLowerCase());
      });
    }
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      list = list.filter((g) => 
        (g.name || '').toLowerCase().includes(q) || 
        (g.publisher || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [allGames, selectedCategory, searchKeyword]);

  // Filter store products
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

  // Filter utility products
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

  // Filter giveaways
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

  // Top flash sale items (mix of games & products)
  const flashSaleGames = useMemo(() => {
    return (allGames || [])
      .filter((g) => (g.codes_count || g.active_codes_count || g.codes?.length || 0) > 0)
      .slice(0, 6);
  }, [allGames]);

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

  return (
    <div className={`min-h-screen transition-colors duration-200 font-sans pb-16 ${isShopeeDark ? 'bg-[#0a0f1d] text-slate-100' : 'bg-[#f5f5f5] text-slate-800'}`}>
      
      {/* 0. Top Bar Báo Hiệu Web Test 1 */}
      <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="bg-black text-amber-400 px-2 py-0.5 rounded uppercase text-[10px] tracking-wider font-mono">Bản Sàn Toàn Diện</span>
          <span>Đang chạy phiên bản sàn Shopee Game tại đường dẫn <code className="bg-amber-600/30 px-1.5 py-0.5 rounded font-mono">codegame.shop/test1</code> (Web chính không bị ảnh hưởng)</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsWhiteLabelOpen(true)}
            className="flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded text-xs transition active:scale-95 cursor-pointer font-bold shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Xem Báo Giá Bàn Giao Web</span>
          </button>
          <button 
            onClick={onBackToHome}
            className="flex items-center gap-1.5 bg-black hover:bg-slate-900 text-white px-3 py-1 rounded text-xs transition active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Về Web Gốc codegame.shop</span>
          </button>
        </div>
      </div>

      {/* 1. SHOPEE TOPBAR */}
      <div className="bg-[#ee4d2d] text-white text-[12px] py-1 px-4 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button 
              onClick={onOpenSellerCenter || (() => window.location.pathname = '/ban-hang')}
              className="hover:opacity-80 transition cursor-pointer font-medium"
            >
              Kênh Người Bán
            </button>
            <span className="opacity-40">|</span>
            <button 
              onClick={onOpenSellerCenter || (() => window.location.pathname = '/ban-hang')}
              className="hover:opacity-80 transition cursor-pointer font-medium"
            >
              Mở Gian Hàng Game
            </button>
            <span className="opacity-40">|</span>
            <button 
              onClick={onOpenDownloadApp}
              className="hover:opacity-80 transition cursor-pointer flex items-center gap-1 font-medium"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Tải Ứng Dụng (APK)
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Tủ Mã / Đơn Mua Shopee */}
            <button 
              onClick={() => onOpenReceivedCodes ? onOpenReceivedCodes('marketplace') : onShowToast('Vui lòng đăng nhập để xem Tủ Mã', 'info')}
              className="hover:opacity-80 transition cursor-pointer flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded font-medium"
              title="Xem các mã quà tặng, thẻ game & tài khoản đã mua"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Đơn Mua / Tủ Mã</span>
            </button>

            <button 
              onClick={onOpenEmailModal}
              className="hover:opacity-80 transition cursor-pointer flex items-center gap-1"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Thông Báo</span>
            </button>

            <button 
              onClick={() => setIsSupportOpen(true)}
              className="hover:opacity-80 transition cursor-pointer flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Hỗ Trợ 24/7</span>
            </button>

            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-white/20">
                <span className="font-semibold text-amber-200">{currentUser.name || currentUser.username}</span>
                <button onClick={onOpenWallet} className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-[11px] font-bold">
                  Ví: {(currentUser.balance || 0).toLocaleString('vi-VN')} Xu
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-white/20">
                <button onClick={onOpenAuth} className="hover:opacity-80 font-medium cursor-pointer">Đăng Ký</button>
                <span className="opacity-40">/</span>
                <button onClick={onOpenAuth} className="hover:opacity-80 font-medium cursor-pointer">Đăng Nhập</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER SHOPEE */}
      <div className="bg-gradient-to-b from-[#f53d2d] to-[#ee4d2d] text-white pt-2.5 pb-4 px-4 sticky top-[36px] z-40 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          
          {/* Logo Sàn Shopee Game (Dynamic White-Label Brand) */}
          <div onClick={onBackToHome} className="flex items-center gap-2.5 flex-shrink-0 cursor-pointer">
            <div className="w-11 h-11 bg-white rounded-xl shadow-lg flex items-center justify-center text-[#ee4d2d] font-black text-2xl tracking-tighter">
              🎮
            </div>
            <div className="leading-tight">
              <div className="text-2xl font-black tracking-tight flex items-center">
                <span>{shopBrand.name.split(' ')[0] || 'Code'}</span>
                <span className="text-amber-200">{shopBrand.name.split(' ').slice(1).join(' ') || 'Game'}</span>
              </div>
              <div className="text-[10px] font-semibold text-white/90 uppercase tracking-widest flex items-center gap-1">
                <span className="bg-white/20 px-1 py-0.2 rounded font-mono">Mall</span> {shopBrand.slogan}
              </div>
            </div>
          </div>

          {/* Thanh Tìm Kiếm Lớn */}
          <div className="flex-1 max-w-3xl">
            <div className="bg-white rounded p-1 flex items-center shadow-lg">
              <input 
                type="text" 
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm tựa game, thẻ nạp, acc game, tiện ích VIP..." 
                className="w-full px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <button className="bg-[#ee4d2d] hover:opacity-90 text-white px-6 py-2.5 rounded transition flex items-center justify-center flex-shrink-0 cursor-pointer">
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Từ khóa gợi ý */}
            <div className="flex items-center gap-3 text-[11px] text-white/80 mt-1.5 overflow-hidden whitespace-nowrap">
              <button onClick={() => { setSearchKeyword('Garena'); setSelectedProductType('utility'); }} className="hover:text-amber-200 transition">Thẻ Garena</button>
              <button onClick={() => { setSearchKeyword('Liên Quân'); setSelectedProductType('all'); }} className="hover:text-amber-200 transition">Liên Quân 0đ</button>
              <button onClick={() => { setSearchKeyword('Roblox'); setSelectedProductType('all'); }} className="hover:text-amber-200 transition">Roblox Robux</button>
              <button onClick={() => { setSearchKeyword('Genshin'); setSelectedProductType('all'); }} className="hover:text-amber-200 transition">Genshin Nguyên Thạch</button>
              <button onClick={() => { setSearchKeyword('Free Fire'); setSelectedProductType('all'); }} className="hover:text-amber-200 transition">Free Fire Kim Cương</button>
              <button onClick={() => { setSearchKeyword(''); setSelectedProductType('all'); }} className="hover:text-amber-200 transition font-bold text-amber-300">Tất Cả ({allGames?.length || 0} game)</button>
            </div>
          </div>

          {/* Giỏ Hàng Shopee (Realtime Live Counter) */}
          <div onClick={onOpenCart} className="relative cursor-pointer group flex-shrink-0 pr-2">
            <div className="relative p-2">
              <ShoppingCart className="w-8 h-8 text-white group-hover:scale-105 transition" />
              <span className="absolute top-0 right-0 bg-white text-[#ee4d2d] font-bold text-[11px] px-1.5 py-0.2 rounded-full border border-[#ee4d2d] shadow">
                {cartCount}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* 3. MAIN CONTENT BODY */}
      <div className="max-w-6xl mx-auto px-4 py-4 space-y-5">
        
        {/* 3.0. DẢI BANNER BÀN GIAO SIÊU TỐC (WHITE-LABEL CALLOUT) */}
        <div className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 rounded-xl p-3 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-lg">⚡</span>
            <div>
              <div className="font-bold text-sm">Bạn muốn sở hữu website sàn game phong cách Shopee này?</div>
              <div className="text-xs text-white/90">Bàn giao trọn gói dưới 2 phút • Tích hợp sẵn kho 623+ game & cổng VietQR tự động</div>
            </div>
          </div>
          <button
            onClick={() => setIsWhiteLabelOpen(true)}
            className="bg-white text-[#ee4d2d] hover:bg-amber-50 font-bold px-4 py-1.5 rounded-lg text-xs shadow transition active:scale-95 cursor-pointer whitespace-nowrap"
          >
            Xem Báo Giá & Tùy Biến Thử →
          </button>
        </div>

        {/* 3.1. HERO BANNER GRID (2/3 + 1/3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Banner Chính Lớn */}
          <div className="md:col-span-2 rounded bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px] shadow-sm">
            <div className="z-10">
              <div className="inline-flex items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                🔥 SIÊU HỘI SÀN GAME & GIFTCODE 0Đ
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight">SĂN CODE & MUA TIỆN ÍCH GAME 0S</h2>
              <p className="text-sm text-white/90 mt-1 max-w-md">Tổng hợp 623+ game ABEI • Thẻ game chiết khấu cao • Tài khoản trắng TT • Giữ tiền bảo chứng 168h</p>
            </div>
            <div className="z-10 flex items-center justify-between mt-4">
              <button 
                onClick={() => {
                  const el = document.getElementById('shopee-products-grid');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-white text-[#ee4d2d] font-bold px-5 py-2 rounded shadow-md hover:bg-amber-50 text-xs transition cursor-pointer"
              >
                Khám Phá Kệ Hàng Ngay →
              </button>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 bg-white rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-white/50 rounded-full"></span>
                <span className="w-1.5 h-1.5 bg-white/50 rounded-full"></span>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
          </div>

          {/* 2 Banner Phụ Xếp Chồng */}
          <div className="flex flex-col gap-2.5 justify-between">
            <div onClick={onOpenWallet} className="rounded bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3.5 flex items-center justify-between shadow-sm flex-1 cursor-pointer hover:opacity-95 transition">
              <div>
                <span className="text-[10px] bg-red-600 px-1.5 py-0.5 rounded font-bold uppercase">VIETQR AUTO</span>
                <div className="font-bold text-sm mt-1">NẠP TIỀN VÍ KHÔNG MẤT PHÍ</div>
                <div className="text-[11px] text-white/90">Quét mã VietQR cộng Xu sau 3 giây</div>
              </div>
              <div className="text-3xl">⚡</div>
            </div>
            <div onClick={() => setIsGuaranteeOpen(true)} className="rounded bg-gradient-to-r from-rose-600 to-pink-500 text-white p-3.5 flex items-center justify-between shadow-sm flex-1 cursor-pointer hover:opacity-95 transition">
              <div>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-bold uppercase">BẢO CHỨNG SÀN</span>
                <div className="font-bold text-sm mt-1">GIỮ TIỀN 168H AN TOÀN</div>
                <div className="text-[11px] text-white/90">Hoàn tiền 100% nếu mã lỗi hoặc sai acc</div>
              </div>
              <div className="text-3xl">🛡️</div>
            </div>
          </div>
        </div>

        {/* 3.2. DỊCH VỤ NHANH SHOPEE (8 Icon Dịch Vụ) */}
        <div className={`rounded p-4 shadow-sm border ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 text-center">
            
            <button 
              onClick={() => onOpenReceivedCodes ? onOpenReceivedCodes('orders') : onShowToast('Mở Tủ Mã Của Tôi để xem mã giao 0s', 'info')} 
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

            <button onClick={onOpenGrowth} className="group flex flex-col items-center cursor-pointer">
              <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-purple-500">
                🎡
              </div>
              <span className="text-[11px] font-medium mt-2 leading-tight">Vòng Quay Xu</span>
            </button>

            <button 
              onClick={onNavigateTodayCodes || (() => window.location.pathname = '/ma-hom-nay')} 
              className="group flex flex-col items-center cursor-pointer"
            >
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-emerald-500">
                🏷️
              </div>
              <span className="text-[11px] font-medium mt-2 leading-tight">Mã Hôm Nay</span>
            </button>

            <button 
              onClick={onOpenUpcoming || (() => onShowToast('Mở danh sách game sắp ra mắt', 'info'))} 
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

        {/* 3.3. DANH MỤC THỂ LOẠI (Shopee Categories) */}
        <div className={`rounded shadow-sm border ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="p-3 border-b border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#ee4d2d] flex items-center gap-2">
              <Compass className="w-4 h-4" />
              DANH MỤC GAME & THỂ LOẠI
            </h3>
            <span className="text-xs text-slate-500">Đang hiển thị {filteredGames.length} / {allGames.length} tựa game</span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 divide-x divide-y divide-slate-100 dark:divide-slate-800 text-center">
            {[
              { id: 'all', label: 'Tất Cả Game', icon: '🎮' },
              { id: 'nhập vai', label: 'Nhập Vai RPG', icon: '⚔️' },
              { id: 'chiến thuật', label: 'Chiến Thuật', icon: '🛡️' },
              { id: 'bắn súng', label: 'Bắn Súng FPS', icon: '🎯' },
              { id: 'thẻ bài', label: 'Thẻ Bài Card', icon: '🃏' },
              { id: 'anime', label: 'Gacha Anime', icon: '✨' },
              { id: 'moba', label: 'MOBA Esports', icon: '🏆' },
              { id: 'casual', label: 'Casual / Khác', icon: '🎲' }
            ].map((cat) => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`p-3 transition cursor-pointer flex flex-col items-center ${selectedCategory === cat.id ? 'bg-orange-500/10 text-[#ee4d2d] font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
              >
                <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl mb-1 shadow-inner">
                  {cat.icon}
                </div>
                <div className="text-[11px] leading-tight">{cat.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 3.4. FLASH SALE GIỜ VÀNG (Shopee Flash Sale Section) */}
        <div className={`rounded shadow-sm border p-4 space-y-3 ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="text-xl font-black text-[#ee4d2d] flex items-center tracking-tight">
                <Flame className="w-6 h-6 mr-1 fill-current" />
                <span>FLASH SALE GIỜ VÀNG</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-mono font-bold">
                <span className="bg-black text-white px-1.5 py-0.5 rounded">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span>:</span>
                <span className="bg-black text-white px-1.5 py-0.5 rounded">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span>:</span>
                <span className="bg-black text-white px-1.5 py-0.5 rounded">{String(timeLeft.seconds).padStart(2, '0')}</span>
              </div>
            </div>
            <span className="text-xs text-[#ee4d2d] font-semibold">Cập nhật liên tục 24/7</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {flashSaleGames.map((game, idx) => {
              const codeCount = game.codes_count || game.active_codes_count || game.codes?.length || 0;
              const percentSold = Math.min(95, 40 + (idx * 11));
              return (
                <div 
                  key={game.id || game.slug}
                  onClick={() => onSelectGame(game)}
                  className={`border rounded p-2.5 hover:shadow-lg transition cursor-pointer relative group flex flex-col justify-between ${isShopeeDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                  <div className="absolute top-1.5 right-1.5 bg-yellow-400 text-red-600 text-[10px] font-black px-1.5 py-0.5 rounded uppercase z-10">
                    -100%
                  </div>

                  <div>
                    <div className="w-full h-24 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center overflow-hidden mb-2 relative">
                      {game.icon_url ? (
                        <img src={game.icon_url} alt={game.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                      ) : (
                        <span className="text-3xl">🎮</span>
                      )}
                    </div>
                    <div className="text-xs font-bold line-clamp-1 group-hover:text-[#ee4d2d] transition" title={game.name}>
                      {game.name}
                    </div>
                    <div className="text-[#ee4d2d] font-black text-sm mt-0.5">
                      0 đ <span className="text-[10px] text-slate-400 line-through font-normal">VIP Code</span>
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="w-full bg-red-100 dark:bg-red-950 rounded-full h-3.5 overflow-hidden relative flex items-center justify-center">
                      <div className="bg-[#ee4d2d] h-full absolute left-0 top-0" style={{ width: `${percentSold}%` }}></div>
                      <span className="text-[9px] font-bold text-white relative z-10 uppercase drop-shadow">
                        CÒN {codeCount} MÃ
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3.5. KỆ HÀNG SHOPEE MALL (TABS PHÂN LOẠI & GỢI Ý HÔM NAY) */}
        <div id="shopee-products-grid" className="space-y-3">
          
          {/* Header Tabs Chọn Nhóm Sản Phẩm */}
          <div className={`rounded p-2 shadow-sm border flex items-center gap-2 overflow-x-auto ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            {[
              { id: 'all', label: '🔥 Tất Cả Hàng Hóa', count: (allGames?.length || 0) + (storeProducts?.length || 0) + (utilities?.length || 0) + (giveaways?.length || 0) },
              { id: 'giftcode', label: '🎁 Giftcode 0Đ', count: allGames?.length || 0 },
              { id: 'utility', label: '💳 Thẻ Game & Nạp', count: utilities?.length || 0 },
              { id: 'account', label: '🎮 Tài Khoản Acc', count: storeProducts?.length || 0 },
              { id: 'giveaway', label: '🎉 Săn Giveaway', count: giveaways?.length || 0 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedProductType(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${selectedProductType === tab.id ? 'bg-[#ee4d2d] text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedProductType === tab.id ? 'bg-white text-[#ee4d2d]' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Grid Hàng Hóa Đa Năng */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            
            {/* 1. RENDER TIỆN ÍCH / THẺ GAME (NẾU CHỌN ALL HOẶC UTILITY) */}
            {(selectedProductType === 'all' || selectedProductType === 'utility') && filteredUtilities.slice(0, selectedProductType === 'utility' ? 36 : 6).map((ut) => (
              <div
                key={ut.id}
                onClick={() => onSelectUtility ? onSelectUtility(ut.id) : onShowToast(`Chi tiết tiện ích: ${ut.title}`, 'info')}
                className={`rounded border hover:border-[#ee4d2d] hover:-translate-y-0.5 transition duration-150 shadow-sm cursor-pointer overflow-hidden flex flex-col justify-between group ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
              >
                <div>
                  <div className="w-full h-32 bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center overflow-hidden">
                    {ut.cover_image_url || ut.icon_url ? (
                      <img src={ut.cover_image_url || ut.icon_url} alt={ut.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                    ) : (
                      <span className="text-4xl">💳</span>
                    )}
                    <span className="absolute top-0 left-0 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br">
                      {ut.category_label || 'Tiện Ích'}
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
                      <span className="text-[9px] text-slate-400">Còn {ut.stock_quantity ?? 99}</span>
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

                  <button
                    onClick={(e) => handleAddUtilityToCart(ut, e)}
                    className="w-full py-1 rounded bg-[#ee4d2d] hover:bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center gap-1 transition shadow-sm cursor-pointer"
                  >
                    <ShoppingCart className="w-3 h-3" />
                    <span>Thêm Giỏ Hàng</span>
                  </button>
                </div>
              </div>
            ))}

            {/* 2. RENDER CỬA HÀNG ACC GAME (NẾU CHỌN ALL HOẶC ACCOUNT) */}
            {(selectedProductType === 'all' || selectedProductType === 'account') && filteredStoreProducts.slice(0, selectedProductType === 'account' ? 36 : 6).map((prod) => (
              <div
                key={prod.id}
                onClick={() => onSelectProduct ? onSelectProduct(prod) : onShowToast(`Chi tiết tài khoản: ${prod.title}`, 'info')}
                className={`rounded border hover:border-[#ee4d2d] hover:-translate-y-0.5 transition duration-150 shadow-sm cursor-pointer overflow-hidden flex flex-col justify-between group ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
              >
                <div>
                  <div className="w-full h-32 bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center overflow-hidden">
                    {prod.cover_image_url || prod.product_images?.[0] ? (
                      <img src={prod.cover_image_url || prod.product_images?.[0]} alt={prod.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                    ) : (
                      <span className="text-4xl">🎮</span>
                    )}
                    <span className="absolute top-0 left-0 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br">
                      Acc Trắng TT
                    </span>
                    {prod.discount_percent > 0 && (
                      <span className="absolute top-0 right-0 bg-yellow-400 text-red-600 text-[10px] font-bold px-1 py-0.2">
                        -{prod.discount_percent}%
                      </span>
                    )}
                  </div>

                  <div className="p-2 space-y-1">
                    <div className="text-[11px] font-semibold line-clamp-2 leading-snug group-hover:text-[#ee4d2d] transition" title={prod.title}>
                      {prod.title}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] border border-emerald-500 text-emerald-500 px-1 rounded">Giao 0s</span>
                      <span className="text-[9px] text-slate-400">{prod.game_name}</span>
                    </div>
                  </div>
                </div>

                <div className="p-2 pt-0 space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <div className="text-[#ee4d2d] font-bold text-xs">{(prod.current_price || 0).toLocaleString('vi-VN')} đ</div>
                    {prod.original_price > prod.current_price && (
                      <div className="text-[10px] text-slate-400 line-through">{(prod.original_price || 0).toLocaleString('vi-VN')}đ</div>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleAddProductToCart(prod, e)}
                    className="w-full py-1 rounded bg-[#ee4d2d] hover:bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center gap-1 transition shadow-sm cursor-pointer"
                  >
                    <ShoppingCart className="w-3 h-3" />
                    <span>Thêm Giỏ Hàng</span>
                  </button>
                </div>
              </div>
            ))}

            {/* 3. RENDER SỰ KIỆN GIVEAWAY (NẾU CHỌN ALL HOẶC GIVEAWAY) */}
            {(selectedProductType === 'all' || selectedProductType === 'giveaway') && filteredGiveaways.slice(0, selectedProductType === 'giveaway' ? 36 : 6).map((gw) => (
              <div
                key={gw.id}
                onClick={() => onSelectGiveaway ? onSelectGiveaway(gw.id) : onShowToast(`Sự kiện Giveaway: ${gw.title}`, 'info')}
                className={`rounded border hover:border-[#ee4d2d] hover:-translate-y-0.5 transition duration-150 shadow-sm cursor-pointer overflow-hidden flex flex-col justify-between group ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
              >
                <div>
                  <div className="w-full h-32 bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center overflow-hidden">
                    {gw.cover_image_url || gw.game_icon_url ? (
                      <img src={gw.cover_image_url || gw.game_icon_url} alt={gw.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                    ) : (
                      <span className="text-4xl">🎉</span>
                    )}
                    <span className="absolute top-0 left-0 bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br">
                      Giveaway 0Đ
                    </span>
                    <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-1 py-0.2">
                      HOT
                    </span>
                  </div>

                  <div className="p-2 space-y-1">
                    <div className="text-[11px] font-semibold line-clamp-2 leading-snug group-hover:text-[#ee4d2d] transition" title={gw.title}>
                      {gw.title}
                    </div>
                    <div className="text-[10px] text-slate-500 line-clamp-1">{gw.game_name}</div>
                  </div>
                </div>

                <div className="p-2 pt-0 space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <div className="text-[#ee4d2d] font-bold text-xs">0 đ (Miễn Phí)</div>
                    <div className="text-[10px] text-slate-400">Đã nhận: {gw.claimed_codes || 0}</div>
                  </div>

                  <button
                    onClick={() => onSelectGiveaway ? onSelectGiveaway(gw.id) : null}
                    className="w-full py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold flex items-center justify-center gap-1 transition shadow-sm cursor-pointer"
                  >
                    <Gift className="w-3 h-3" />
                    <span>Săn Quà 0Đ Ngay</span>
                  </button>
                </div>
              </div>
            ))}

            {/* 4. RENDER DANH MỤC GAME GIFTCODE (NẾU CHỌN ALL HOẶC GIFTCODE) */}
            {(selectedProductType === 'all' || selectedProductType === 'giftcode') && filteredGames.slice(0, selectedProductType === 'giftcode' ? 36 : 18).map((game) => {
              const codeCount = game.codes_count || game.active_codes_count || game.codes?.length || 0;
              const firstCode = game.codes && game.codes.length > 0 ? game.codes[0].code : null;

              return (
                <div 
                  key={game.id || game.slug}
                  onClick={() => onSelectGame(game)}
                  className={`rounded border hover:border-[#ee4d2d] hover:-translate-y-0.5 transition duration-150 shadow-sm cursor-pointer overflow-hidden flex flex-col justify-between group ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
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
                        {codeCount > 0 ? `${codeCount} Code` : 'Mới'}
                      </span>
                    </div>

                    <div className="p-2 space-y-1">
                      <div className="text-[11px] font-semibold line-clamp-2 leading-snug group-hover:text-[#ee4d2d] transition" title={game.name}>
                        {game.name}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[9px] border border-[#ee4d2d] text-[#ee4d2d] px-1 rounded">Giao 0s</span>
                        <span className="text-[9px] bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-1 rounded truncate max-w-[80px]">
                          {game.publisher || 'NPH Game'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 pt-0 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <div className="text-[#ee4d2d] font-bold text-xs">0 đ (Miễn Phí)</div>
                      <div className="text-[10px] text-slate-400">{codeCount} mã sẵn</div>
                    </div>

                    {firstCode && (
                      <button 
                        onClick={(e) => handleCopyCode(firstCode, e)}
                        className="w-full py-1 rounded bg-orange-500/10 hover:bg-orange-500/20 text-[#ee4d2d] font-mono text-[10px] font-bold flex items-center justify-center gap-1 transition"
                      >
                        {copiedCode === firstCode ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>Đã Copy!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{firstCode}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredGames.length > 24 && (
            <div className="text-center pt-3">
              <button 
                onClick={() => onShowToast('Đang hiển thị toàn bộ hàng hóa trên sàn!', 'info')}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs px-10 py-2.5 rounded shadow-sm font-medium transition cursor-pointer"
              >
                Xem Thêm Hàng Hóa Khác ({filteredGames.length} game có sẵn)
              </button>
            </div>
          )}
        </div>

        {/* 3.6. FOOTER SHOPEE */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-6 text-xs text-slate-500 dark:text-slate-400 space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button 
              onClick={() => setIsWhiteLabelOpen(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow transition cursor-pointer"
            >
              <Rocket className="w-4 h-4" />
              <span>Đặt Mua Website Sàn Này (Bàn Giao 2 Phút)</span>
            </button>
            <button 
              onClick={onBackToHome}
              className="inline-flex items-center gap-2 bg-black hover:bg-slate-900 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay Lại Trang Chủ Web Gốc codegame.shop</span>
            </button>
          </div>

          <div className="text-center text-[11px] pt-2">
            © 2026 {shopBrand.name} - Giao Diện Sàn Thương Mại Điện Tử Tiện Ích & Code Game (Bản Test 1 tại <code>/test1</code>)
          </div>
        </div>

      </div>

      {/* 4. REALTIME FOMO TICKER POPUP (GÓC TRÁI DƯỚI) */}
      {fomoNotice && (
        <div className="fixed bottom-4 left-4 z-40 max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-base flex-shrink-0">
            {fomoNotice.icon}
          </div>
          <div className="text-[11px] leading-tight">
            <div className="font-semibold text-slate-800 dark:text-slate-200">{fomoNotice.text}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{fomoNotice.time} • Bảo chứng 168h</div>
          </div>
        </div>
      )}

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

      {/* 6. MODALS TÍCH HỢP */}
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
        onApplyPreviewSettings={(st) => setShopBrand({
          name: st.shopName,
          slogan: st.shopSlogan,
          hotline: st.hotline
        })}
        onShowToast={onShowToast}
      />

    </div>
  );
};
