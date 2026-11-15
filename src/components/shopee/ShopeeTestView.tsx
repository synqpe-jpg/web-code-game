import React, { useState, useMemo, useEffect } from 'react';
import type { GameItem, UserProfile } from '../../types/game';
import { 
  Search, ShoppingCart, Bell, HelpCircle, ArrowLeft, 
  Zap, Gift, ShieldCheck, CreditCard, Flame, Sparkles, 
  ChevronRight, Smartphone, Compass, Trophy, Copy, Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ShopeeTestViewProps {
  allGames: GameItem[];
  onSelectGame: (game: GameItem) => void;
  onSelectGameSlug?: (slug: string) => void;
  onOpenAuth: () => void;
  onOpenWallet: () => void;
  onOpenCart?: () => void;
  onOpenGrowth?: () => void;
  onBackToHome: () => void;
  currentUser: UserProfile | null;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const ShopeeTestView: React.FC<ShopeeTestViewProps> = ({
  allGames,
  onSelectGame,
  onSelectGameSlug,
  onOpenAuth,
  onOpenWallet,
  onOpenCart,
  onOpenGrowth,
  onBackToHome,
  currentUser,
  onShowToast,
}) => {
  // Theme state within Shopee view (Supports Classic Orange/White or Dark Gamer)
  const [isShopeeDark, setIsShopeeDark] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  // Top flash sale games (take top 6 games with active codes)
  const flashSaleGames = useMemo(() => {
    return (allGames || [])
      .filter((g) => (g.codes_count || g.active_codes_count || g.codes?.length || 0) > 0)
      .slice(0, 6);
  }, [allGames]);

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

  return (
    <div className={`min-h-screen transition-colors duration-200 font-sans ${isShopeeDark ? 'bg-[#0a0f1d] text-slate-100' : 'bg-[#f5f5f5] text-slate-800'}`}>
      
      {/* 0. Top Bar Báo Hiệu Web Test 1 */}
      <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="bg-black text-amber-400 px-2 py-0.5 rounded uppercase text-[10px] tracking-wider">Bản Thử Nghiệm Giao Diện</span>
          <span>Bạn đang xem giao diện phong cách Shopee tại đường dẫn <code className="bg-amber-600/30 px-1.5 py-0.5 rounded font-mono">codegame.shop/test1</code> (Web chính không bị ảnh hưởng)</span>
        </div>
        <button 
          onClick={onBackToHome}
          className="flex items-center gap-1.5 bg-black hover:bg-slate-900 text-white px-3 py-1 rounded text-xs transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về Web Gốc codegame.shop</span>
        </button>
      </div>

      {/* 1. SHOPEE TOPBAR */}
      <div className="bg-[#ee4d2d] text-white text-[12px] py-1 px-4 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <a href="/ban-hang" className="hover:opacity-80 transition cursor-pointer">Kênh Người Bán</a>
            <span className="opacity-40">|</span>
            <span className="hover:opacity-80 transition cursor-pointer">Mở Gian Hàng Game</span>
            <span className="opacity-40">|</span>
            <span className="hover:opacity-80 transition cursor-pointer flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" />
              Tải Ứng Dụng (APK)
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button className="hover:opacity-80 transition cursor-pointer flex items-center gap-1">
              <Bell className="w-3.5 h-3.5" />
              Thông Báo (3)
            </button>
            <button className="hover:opacity-80 transition cursor-pointer flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              Hỗ Trợ 24/7
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
          
          {/* Logo Sàn Shopee Game */}
          <div onClick={onBackToHome} className="flex items-center gap-2.5 flex-shrink-0 cursor-pointer">
            <div className="w-11 h-11 bg-white rounded-xl shadow-lg flex items-center justify-center text-[#ee4d2d] font-black text-2xl tracking-tighter">
              🎮
            </div>
            <div className="leading-tight">
              <div className="text-2xl font-black tracking-tight flex items-center">
                <span>Code</span><span className="text-amber-200">Game</span>
              </div>
              <div className="text-[10px] font-semibold text-white/90 uppercase tracking-widest flex items-center gap-1">
                <span className="bg-white/20 px-1 py-0.2 rounded font-mono">Mall</span> Giao Diện Shopee
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
                placeholder="Tìm tựa game, nhập code tân thủ, tìm tiện ích..." 
                className="w-full px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <button className="bg-[#ee4d2d] hover:opacity-90 text-white px-6 py-2.5 rounded transition flex items-center justify-center flex-shrink-0 cursor-pointer">
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Từ khóa gợi ý */}
            <div className="flex items-center gap-3 text-[11px] text-white/80 mt-1.5 overflow-hidden whitespace-nowrap">
              <button onClick={() => setSearchKeyword('Liên Quân')} className="hover:text-amber-200 transition">Liên Quân 0đ</button>
              <button onClick={() => setSearchKeyword('Genshin')} className="hover:text-amber-200 transition">Genshin Nguyên Thạch</button>
              <button onClick={() => setSearchKeyword('Roblox')} className="hover:text-amber-200 transition">Roblox Robux</button>
              <button onClick={() => setSearchKeyword('FC Online')} className="hover:text-amber-200 transition">FC Online Giảm 50%</button>
              <button onClick={() => setSearchKeyword('Free Fire')} className="hover:text-amber-200 transition">Free Fire Kim Cương</button>
              <button onClick={() => setSearchKeyword('')} className="hover:text-amber-200 transition font-bold text-amber-300">Tất Cả Game ({allGames?.length || 0})</button>
            </div>
          </div>

          {/* Giỏ Hàng Shopee */}
          <div onClick={onOpenCart} className="relative cursor-pointer group flex-shrink-0 pr-2">
            <div className="relative p-2">
              <ShoppingCart className="w-8 h-8 text-white" />
              <span className="absolute top-0 right-0 bg-white text-[#ee4d2d] font-bold text-[11px] px-1.5 py-0.2 rounded-full border border-[#ee4d2d] shadow">
                0
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* 3. MAIN CONTENT BODY */}
      <div className="max-w-6xl mx-auto px-4 py-4 space-y-5">
        
        {/* 3.1. HERO BANNER GRID (2/3 + 1/3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Banner Chính Lớn */}
          <div className="md:col-span-2 rounded bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white p-6 relative overflow-hidden flex flex-col justify-between min-h-[220px] shadow-sm">
            <div className="z-10">
              <div className="inline-flex items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                🔥 SIÊU HỘI GIFTCODE GIỮA THÁNG
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight">SĂN CODE GAME 0 ĐỒNG</h2>
              <p className="text-sm text-white/90 mt-1 max-w-md">Tổng hợp 623+ game có giấy phép ABEI • Giao mã 0 giây • Hoàn tiền 100% bảo chứng Shopee Game</p>
            </div>
            <div className="z-10 flex items-center justify-between mt-4">
              <button 
                onClick={() => {
                  const el = document.getElementById('shopee-products-grid');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-white text-[#ee4d2d] font-bold px-5 py-2 rounded shadow-md hover:bg-amber-50 text-xs transition cursor-pointer"
              >
                Nhận Mã Ngay →
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
                <div className="text-[11px] text-white/90">Tự động cộng Xu sau 3 giây</div>
              </div>
              <div className="text-3xl">⚡</div>
            </div>
            <div className="rounded bg-gradient-to-r from-rose-600 to-pink-500 text-white p-3.5 flex items-center justify-between shadow-sm flex-1">
              <div>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-bold uppercase">BẢO CHỨNG SÀN</span>
                <div className="font-bold text-sm mt-1">GIỮ TIỀN 168H AN TOÀN</div>
                <div className="text-[11px] text-white/90">Bảo vệ quyền lợi người mua tuyệt đối</div>
              </div>
              <div className="text-3xl">🛡️</div>
            </div>
          </div>
        </div>

        {/* 3.2. DỊCH VỤ NHANH SHOPEE (8 Icon Dịch Vụ) */}
        <div className={`rounded p-4 shadow-sm border ${isShopeeDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 text-center">
            
            <button onClick={() => onShowToast('Hệ thống giao mã tự động 0 giây tích hợp Web Crypto AES-GCM', 'info')} className="group flex flex-col items-center cursor-pointer">
              <div className="w-11 h-11 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-orange-500">
                ⚡
              </div>
              <span className="text-[11px] font-medium mt-2 leading-tight">Giao Mã 0s</span>
            </button>

            <button onClick={() => setSearchKeyword('')} className="group flex flex-col items-center cursor-pointer">
              <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-red-500">
                🎁
              </div>
              <span className="text-[11px] font-medium mt-2 leading-tight">Săn Code 0Đ</span>
            </button>

            <button onClick={() => onShowToast('Chính sách bảo chứng sàn: Tiền người bán bị giữ 168h chống mã lỗi', 'info')} className="group flex flex-col items-center cursor-pointer">
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

            <button onClick={() => window.location.pathname = '/ma-hom-nay'} className="group flex flex-col items-center cursor-pointer">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-emerald-500">
                🏷️
              </div>
              <span className="text-[11px] font-medium mt-2 leading-tight">Mã Hôm Nay</span>
            </button>

            <button onClick={() => onShowToast('Mục Game Sắp Ra Mắt đang được hệ thống đồng bộ theo thời gian thực', 'info')} className="group flex flex-col items-center cursor-pointer">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-indigo-500">
                🚀
              </div>
              <span className="text-[11px] font-medium mt-2 leading-tight">Sắp Ra Mắt</span>
            </button>

            <button onClick={() => window.location.pathname = '/telegram'} className="group flex flex-col items-center cursor-pointer">
              <div className="w-11 h-11 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-xl group-hover:-translate-y-1 transition duration-200 shadow-sm text-pink-500">
                💬
              </div>
              <span className="text-[11px] font-medium mt-2 leading-tight">Bot Telegram</span>
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

        {/* 3.5. GỢI Ý HÔM NAY (DAILY DISCOVER / SHOPEE MALL PRODUCTS) */}
        <div id="shopee-products-grid" className="space-y-3">
          <div className={`rounded p-3 text-center border-b-2 border-[#ee4d2d] shadow-sm ${isShopeeDark ? 'bg-slate-900' : 'bg-white'}`}>
            <h3 className="text-sm font-black uppercase text-[#ee4d2d] tracking-wider flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              GỢI Ý HÔM NAY - TOÀN BỘ KHO GAME & GIFTCODE
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {filteredGames.slice(0, 24).map((game) => {
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
                onClick={() => onShowToast('Đang tải thêm danh sách game...', 'info')}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs px-10 py-2.5 rounded shadow-sm font-medium transition cursor-pointer"
              >
                Xem Thêm Game Khác ({filteredGames.length - 24} game)
              </button>
            </div>
          )}
        </div>

        {/* 3.6. FOOTER SHOPEE */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-6 text-xs text-slate-500 dark:text-slate-400 space-y-4">
          <div className="text-center">
            <button 
              onClick={onBackToHome}
              className="inline-flex items-center gap-2 bg-[#ee4d2d] hover:bg-orange-600 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay Lại Trang Chủ Web Gốc codegame.shop</span>
            </button>
          </div>

          <div className="text-center text-[11px] pt-2">
            © 2026 Codegame Shop - Giao Diện Thử Nghiệm Phong Cách Shopee (Bản Test 1 tại <code>/test1</code>)
          </div>
        </div>

      </div>

      {/* Mode Switcher Nổi Góc Phải Dưới */}
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

    </div>
  );
};
