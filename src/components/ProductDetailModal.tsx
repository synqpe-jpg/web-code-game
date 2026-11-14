import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ShieldCheck,
  Zap,
  ZoomIn,
  LogIn,
  Share2,
  BookOpen,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Package,
  CheckCircle2,
  Star,
  Clock,
  Sparkles,
  Minus,
  Plus,
  Lock,
  TrendingUp,
} from 'lucide-react';
import type { StoreProduct, UtilityProduct, UserProfile, ProductPackageVariant } from '../types/game';
import { formatCore } from '../utils/textUtils';
import { marketingService } from '../services/marketingService';
import { dataService } from '../services/dataService';
import { offerService } from '../services/offerService';
import { getProductPackages } from '../utils/productPackageUtils';
import { GuideLinksBanner } from './GuideLinksBanner';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { PackageShareModal } from './PackageShareModal';

export interface ProductDetailModalProps {
  product: StoreProduct | UtilityProduct | null;
  initialPackageId?: string;
  onClose: () => void;
  onBuyNow: (product: any, selectedPackage?: ProductPackageVariant, quantity?: number) => void;
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
  onOpenShare?: (product: any) => void;
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  initialPackageId,
  onClose,
  onBuyNow,
  currentUser,
  onOpenAuth,
  onOpenShare,
  onShowToast,
}) => {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [packageToShare, setPackageToShare] = useState<ProductPackageVariant | null>(null);
  const [offerData, setOfferData] = useState<{
    campaign?: { enabled: boolean; offer_price: number };
    offers: Record<string, { eligible: boolean; offer_price: number; discount_amount: number; reason: string | null }>;
  }>(() => {
    const slug = (product as any)?.game_slug || '';
    const cached = offerService.getCached(slug);
    if (cached) {
      return {
        campaign: cached.campaign,
        offers: cached.offers || {},
      };
    }
    return { offers: {} };
  });
  useLockBodyScroll(Boolean(product));
  const [, setTick] = useState(0);

  // Danh sách các gói tùy chọn
  const packages: ProductPackageVariant[] = useMemo(() => {
    if (!product) return [];
    return getProductPackages(product);
  }, [product]);

  const [selectedPackageId, setSelectedPackageId] = useState<string>(() => {
    if (initialPackageId && packages.some((p) => p.id === initialPackageId)) {
      return initialPackageId;
    }
    return packages[0]?.id || product?.id || '';
  });

  useEffect(() => {
    setActiveImageIdx(0);
    setIsZoomed(false);
    setIsDescExpanded(false);
    setQuantity(1);
    if (initialPackageId && packages.some((p) => p.id === initialPackageId)) {
      setSelectedPackageId(initialPackageId);
    } else if (packages.length > 0) {
      setSelectedPackageId(packages[0].id);
    }
  }, [product?.id, initialPackageId]);

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    const unsub = dataService.subscribe(handleUpdate);
    const unsubStock = marketingService.subscribeStockChange(handleUpdate);
    const unsubSold = marketingService.subscribeSoldCountChange(handleUpdate);
    window.addEventListener('wcg_virtual_stock_updated', handleUpdate);
    window.addEventListener('wcg_sold_count_updated', handleUpdate);
    window.addEventListener('wcg_utilities_updated', handleUpdate);
    return () => {
      unsub();
      unsubStock();
      unsubSold();
      window.removeEventListener('wcg_virtual_stock_updated', handleUpdate);
      window.removeEventListener('wcg_sold_count_updated', handleUpdate);
      window.removeEventListener('wcg_utilities_updated', handleUpdate);
    };
  }, []);

  // Fetch thông tin ưu đãi mua lần đầu (First Purchase Offer) theo tài khoản và game
  useEffect(() => {
    let isMounted = true;
    const fetchOffers = async () => {
      if (!product) return;
      try {
        const slug = (product as any).game_slug || '';
        const token = (typeof localStorage !== 'undefined' && localStorage.getItem('wcg_auth_token')) ||
          (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('wcg_auth_token')) ||
          currentUser?.session_token || '';

        const data = await offerService.fetchOffers(slug, token);
        if (isMounted && data) {
          setOfferData({
            campaign: data.campaign,
            offers: data.offers || {},
          });
        }
      } catch (e) {
        console.warn('[ProductDetailModal] fetchOffers error:', e);
      }
    };

    fetchOffers();
    return () => {
      isMounted = false;
    };
  }, [product?.id, (product as any)?.game_slug, currentUser?.id]);

  // Lấy gói đang chọn (Hook bắt buộc chạy trước mọi early return)
  const selectedPackage: ProductPackageVariant | undefined = useMemo(() => {
    if (!product) return undefined;
    return (
      packages.find((p) => p.id === selectedPackageId) ||
      packages[0] || {
        id: product.id,
        name: product.title,
        price: product.current_price,
        original_price: product.original_price,
        stock_quantity: product.stock_quantity,
        note: 'Xử lý tiêu chuẩn',
        description: product.description,
      }
    );
  }, [packages, selectedPackageId, product]);

  // Lấy mô tả tương ứng theo gói đang chọn (ưu tiên gói con, fallback sản phẩm gốc)
  const currentDescription = useMemo(() => {
    if (selectedPackage?.description && selectedPackage.description.trim()) {
      return selectedPackage.description;
    }
    if (selectedPackage?.id) {
      const rawStore = dataService.getStoreProducts().find((p) => p.id === selectedPackage.id);
      if (rawStore?.description && rawStore.description.trim()) return rawStore.description;
      const rawUtil = dataService.getUtilityProducts().find((u) => u.id === selectedPackage.id);
      if (rawUtil?.description && rawUtil.description.trim()) return rawUtil.description;
    }
    return product?.description || '';
  }, [selectedPackage, product]);

  const realStock = typeof selectedPackage?.stock_quantity === 'number'
    ? selectedPackage.stock_quantity
    : (product?.stock_quantity ?? 0);

  useEffect(() => {
    if (realStock > 0 && quantity > realStock) {
      setQuantity(realStock);
    }
  }, [realStock, selectedPackage]);

  if (!product || !selectedPackage) return null;

  const isStoreProduct = 'game_slug' in product;
  const gameSlug = isStoreProduct ? (product as StoreProduct).game_slug : '';
  const gameName = isStoreProduct
    ? (product as StoreProduct).game_name
    : (product as UtilityProduct).category_label || (product as UtilityProduct).category || 'Tiện ích';

  const defaultImg =
    product.cover_image_url ||
    (isStoreProduct ? (product as StoreProduct).game_icon_url : (product as UtilityProduct).icon_url) ||
    (gameSlug ? `/game_icons/${gameSlug}.webp` : '/vite.svg');

  const images =
    product.product_images && product.product_images.length > 0
      ? product.product_images
      : [defaultImg].filter(Boolean) as string[];

  // Tồn kho & Đã bán của gói được chọn
  const displayStock = realStock <= 0 ? 0 : marketingService.getDisplayStock(selectedPackage.id || product.id, realStock);
  const displaySold = marketingService.getSoldDisplay({
    ...selectedPackage,
    created_at: product.created_at,
    fomo_anchor_time: (product as any).fomo_anchor_time,
  } as any);
  const isOutOfStock = realStock <= 0 || displayStock <= 0;

  // Quyết định hiển thị "Đã bán" dựa trên: Cấu hình toàn cục + Cấu hình sản phẩm riêng lẻ
  const isGlobalSoldEnabled = isStoreProduct
    ? (typeof window !== 'undefined' ? (localStorage.getItem('wcg_store_global_show_sold') !== 'false' && localStorage.getItem('wcg_admin_show_sold_store') !== 'false') : true)
    : (typeof window !== 'undefined' ? (localStorage.getItem('wcg_utilities_global_show_sold') !== 'false' && localStorage.getItem('wcg_admin_show_sold_util') !== 'false') : true);
  const isSoldVisible = isGlobalSoldEnabled && (product as any).show_sold_count !== false;

  const currentPrice = selectedPackage.price;
  const originalPrice = (typeof selectedPackage.original_price === 'number' && selectedPackage.original_price > 0)
    ? selectedPackage.original_price
    : currentPrice;

  // Kiểm tra ưu đãi mua lần đầu & hình thức Nâng Giá cho gói đang chọn
  const selectedOffer = offerData.offers[selectedPackage.id];
  const isSelectedEscalating = selectedPackage.sale_mode === 'escalating' || Boolean(selectedOffer?.escalating?.is_escalating);
  
  const rawEsc = selectedOffer?.escalating;
  const escBase = Number(rawEsc?.base_price ?? rawEsc?.escalating_base_price ?? selectedPackage.escalating_base_price ?? selectedPackage.price ?? currentPrice) || currentPrice;
  const escStep = Number(rawEsc?.step ?? rawEsc?.escalating_step ?? selectedPackage.escalating_step ?? 0) || 0;
  const escMax = (rawEsc?.max_price !== undefined && rawEsc?.max_price !== null)
    ? Number(rawEsc.max_price)
    : ((rawEsc?.escalating_max_price !== undefined && rawEsc?.escalating_max_price !== null)
      ? Number(rawEsc.escalating_max_price)
      : (selectedPackage.escalating_max_price !== undefined && selectedPackage.escalating_max_price !== null ? Number(selectedPackage.escalating_max_price) : null));
  const escCompleted = Number(rawEsc?.completed_count ?? selectedPackage.escalating_completed_count ?? 0) || 0;
  const rawCurrent = Number(rawEsc?.current_price ?? rawEsc?.current_calculated_price ?? selectedPackage.escalating_current_price);
  const escCurrent = (rawCurrent > 0)
    ? rawCurrent
    : (escMax !== null && escMax > 0 ? Math.min(escBase + (escCompleted * escStep), escMax) : (escBase + (escCompleted * escStep)));
  const rawNext = Number(rawEsc?.next_price ?? rawEsc?.next_step_price ?? selectedPackage.escalating_next_price);
  const escNext = (rawNext > 0)
    ? rawNext
    : (escMax !== null && escMax > 0 ? Math.min(escBase + ((escCompleted + 1) * escStep), escMax) : (escBase + ((escCompleted + 1) * escStep)));

  const selectedEscData = {
    is_escalating: isSelectedEscalating,
    base_price: escBase,
    step: escStep,
    max_price: escMax,
    completed_count: escCompleted,
    current_price: escCurrent,
    next_price: escNext,
  };

  // Kiểm tra cờ riêng mua lần đầu của gói đang chọn: BẮT BUỘC cờ riêng phải đang bật (true / 1)
  const isSelectedFpFlag = selectedPackage.first_purchase_enabled === true ||
    selectedPackage.first_purchase_enabled === 1 ||
    String(selectedPackage.first_purchase_enabled) === '1' ||
    String(selectedPackage.first_purchase_enabled) === 'true';

  const selectedMaxPrice = selectedPackage.first_purchase_max_price
    ? Number(selectedPackage.first_purchase_max_price)
    : (offerData?.campaign?.max_original_price ?? 30000);

  const defaultEligible = isSelectedFpFlag && !isSelectedEscalating && (currentPrice <= selectedMaxPrice);
  const isSelectedOfferEligible = !isSelectedEscalating && isSelectedFpFlag && (
    selectedOffer !== undefined ? Boolean(selectedOffer.eligible) : defaultEligible
  );

  const rawOfferPrice = selectedOffer?.offer_price ?? (
    selectedPackage.first_purchase_price ? Number(selectedPackage.first_purchase_price) : (offerData?.campaign?.offer_price ?? 2000)
  );

  const displayCurrentPrice = isSelectedEscalating
    ? selectedEscData.current_price
    : (isSelectedOfferEligible ? rawOfferPrice : currentPrice);

  // Thống nhất MỘT giá gốc chuẩn duy nhất (giá niêm yết currentPrice = 2.600 Core) so với giá gốc thị trường displayOriginalPrice (20.000 Core)
  // để tính tỷ lệ giảm giá chiết khấu, đảm bảo Thẻ Ngoài (-87%), Bảng Chọn Gói (-87%) và Hộp Thoại Thanh Toán hoàn toàn khớp nhau 100%
  const displayOriginalPrice = isSelectedEscalating
    ? displayCurrentPrice
    : (originalPrice > 0 ? originalPrice : currentPrice);

  const discountPercent =
    isSelectedEscalating
      ? 0
      : (displayOriginalPrice > currentPrice
          ? Math.round(((displayOriginalPrice - currentPrice) / displayOriginalPrice) * 100)
          : 0);

  // Tổng tiền: Gói Nâng Giá khóa ở 1 gói; gói ưu đãi tính theo quy tắc ưu đãi
  const effectiveSafeQty = isSelectedEscalating ? 1 : quantity;
  const totalPrice = isSelectedEscalating
    ? displayCurrentPrice
    : (isSelectedOfferEligible
        ? displayCurrentPrice + (currentPrice * (effectiveSafeQty - 1))
        : currentPrice * effectiveSafeQty);

  const handleShare = async () => {
    const origin =
      typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? window.location.origin
        : 'https://codegame.shop';
    const pathPrefix = isStoreProduct ? 'store#product' : 'utilities#utility';
    const shareUrl = `${origin}/${pathPrefix}=${product.id}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: `Mua ngay ${product.title} (${gameName}) uy tín, giá rẻ tại CodeGame.shop`,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    if (onOpenShare) {
      onOpenShare(product);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      if (onShowToast) {
        onShowToast('Đã sao chép link sản phẩm!', `Đường dẫn: ${shareUrl}`, 'success');
      }
    }
  };

  const handleDecreaseQty = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleIncreaseQty = () => {
    if (realStock > 0 && quantity >= realStock) return;
    setQuantity((prev) => prev + 1);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-fade-in"
    >
      <div
        className="relative w-full max-w-5xl bg-card border-t sm:border border-border/90 rounded-t-[28px] sm:rounded-3xl overflow-hidden shadow-2xl animate-scale-in flex flex-col h-[90dvh] sm:h-auto max-h-[90dvh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar Header */}
        <div className="p-3.5 sm:p-5 border-b border-border/70 bg-card/95 backdrop-blur-md shrink-0 sticky top-0 z-20">
          <div className="w-12 h-1.5 bg-slate-600/60 rounded-full mx-auto mb-2 sm:hidden shrink-0" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted overflow-hidden border border-border shrink-0">
                <img
                  src={defaultImg}
                  alt={product.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (gameSlug) {
                      const localFallback = `/game_icons/${gameSlug}.webp`;
                      if (target.src !== localFallback && !target.src.endsWith(localFallback)) {
                        target.src = localFallback;
                        return;
                      }
                    }
                    target.onerror = null;
                    target.src = '/vite.svg';
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading font-bold text-sm sm:text-base text-foreground truncate">
                  {product.title}
                </h3>
                <span className="text-[11px] sm:text-xs text-secondary font-semibold truncate block">
                  {gameName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (selectedPackage) {
                    setPackageToShare(selectedPackage);
                  } else {
                    handleShare();
                  }
                }}
                className="p-2 sm:p-2.5 rounded-xl bg-muted/60 hover:bg-muted text-slate-300 hover:text-foreground cursor-pointer transition-all active:scale-95"
                title="Chia sẻ gói đang chọn"
                aria-label="Chia sẻ gói đang chọn"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 shadow-md cursor-pointer transition-all active:scale-90 flex items-center justify-center shrink-0"
                aria-label="Đóng"
                title="Đóng"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body - 2 Columns Layout */}
        <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y p-4 sm:p-6 scrollbar-thin">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* CỘT TRÁI (Left Column): Ảnh đại diện lớn, Cam kết uy tín, Chi tiết thông tin */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-5">
              {/* Main Image Gallery */}
              <div className="space-y-2.5">
                <div className="relative h-52 sm:h-80 rounded-2xl bg-muted overflow-hidden border border-border group select-none shadow-inner">
                  <img
                    src={images[activeImageIdx]}
                    alt={product.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (gameSlug) {
                        const localFallback = `/game_icons/${gameSlug}.webp`;
                        if (target.src !== localFallback && !target.src.endsWith(localFallback)) {
                          target.src = localFallback;
                          return;
                        }
                      }
                      target.onerror = null;
                      target.src = '/vite.svg';
                    }}
                  />

                  {images.length > 1 && (
                    <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-sm text-white text-[11px] font-mono font-medium shadow-md border border-white/10 z-10">
                      {activeImageIdx + 1} / {images.length}
                    </div>
                  )}

                  {images.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                        }}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-all cursor-pointer opacity-90 sm:opacity-0 sm:group-hover:opacity-100 z-10 active:scale-95"
                        title="Ảnh trước"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveImageIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-all cursor-pointer opacity-90 sm:opacity-0 sm:group-hover:opacity-100 z-10 active:scale-95"
                        title="Ảnh sau"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setIsZoomed(true)}
                    className="absolute bottom-2.5 right-2.5 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-all cursor-pointer z-10"
                    title="Phóng to ảnh"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                {/* Thumbnails */}
                {images.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIdx(idx)}
                        className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                          activeImageIdx === idx
                            ? 'border-secondary ring-2 ring-secondary/30 scale-95 shadow-md opacity-100'
                            : 'border-border/80 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={img} alt={`thumb-${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3 Khối Cam Kết Uy Tín Chuẩn Mẫu (Trust & Security Badges) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center sm:flex-col sm:text-center sm:justify-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs text-emerald-300">GIAO DỊCH BẢO VỆ</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Thanh toán an toàn trong hệ thống</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center sm:flex-col sm:text-center sm:justify-center gap-2.5">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs text-amber-300">NHANH CHÓNG</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Xử lý tự động hoặc 0-5 phút</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center sm:flex-col sm:text-center sm:justify-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div>
                    <h5 className="font-bold text-xs text-indigo-300">CHÍNH HÃNG 100%</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Cam kết đúng bản quyền gói</p>
                  </div>
                </div>
              </div>

              {/* Description (Hiển thị ở cột trái trên Desktop) */}
              {currentDescription && (
                <div className="space-y-2 hidden lg:block">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-heading font-bold text-sm text-foreground flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span>Thông Tin Chi Tiết Sản Phẩm:</span>
                    </h4>
                    {currentDescription.length > 200 && (
                      <button
                        type="button"
                        onClick={() => setIsDescExpanded(!isDescExpanded)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary hover:opacity-90 py-1 px-2.5 rounded-lg bg-secondary/10 hover:bg-secondary/20 border border-secondary/20 cursor-pointer transition-all active:scale-95 shrink-0"
                      >
                        <span>{isDescExpanded ? 'Thu gọn' : 'Xem toàn bộ'}</span>
                        {isDescExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  <div
                    className={`relative bg-card p-3.5 sm:p-4 rounded-2xl border border-border transition-all duration-300 ${
                      !isDescExpanded && currentDescription.length > 200
                        ? 'max-h-[140px] overflow-hidden'
                        : 'sm:max-h-[500px] sm:overflow-y-auto scrollbar-thin'
                    }`}
                  >
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {currentDescription}
                    </p>
                    {!isDescExpanded && currentDescription.length > 200 && (
                      <div className="pointer-events-none absolute bottom-0 inset-x-0 h-14 bg-gradient-to-t from-card via-card/80 to-transparent flex items-end justify-center pb-1">
                        <span className="text-[10px] text-secondary font-semibold bg-card/90 px-2 py-0.5 rounded-full border border-secondary/20 shadow-sm">
                          Nhấn &quot;Xem toàn bộ&quot; để đọc hết mô tả...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Guide Links Banner */}
              <GuideLinksBanner
                guideLinks={(product as any).guide_links}
                guideUrl={(product as any).guide_url}
                guideText={(product as any).guide_text}
                showGuide={(product as any).show_guide_link !== false}
                theme="indigo"
              />

              {/* Warranty text */}
              {(product as any).show_warranty && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{(product as any).warranty_text || 'Bảo hành 1 đổi 1 suốt chu kỳ sử dụng'}</span>
                </div>
              )}
            </div>

            {/* CỘT PHẢI (Right Column): Khối Chọn Gói & Thanh Toán Mẫu Chuẩn (Packages Selection) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-border/80 bg-slate-900/60 p-4 sm:p-5 shadow-xl space-y-4 sticky top-4">
                {/* Header Gói Đã Chọn */}
                <div className="pb-3 border-b border-border/70">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Gói đã chọn:
                    </span>
                    <span className="text-xs font-bold text-secondary truncate max-w-[260px]">
                      {selectedPackage.name}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-display font-extrabold text-2xl sm:text-3xl text-emerald-400 tracking-tight">
                        {formatCore(displayCurrentPrice)}
                      </span>
                      {!isSelectedEscalating && displayOriginalPrice > displayCurrentPrice && (
                        <span className="text-xs sm:text-sm text-muted-foreground line-through font-mono">
                          {formatCore(displayOriginalPrice)}
                        </span>
                      )}
                      {!isSelectedEscalating && discountPercent > 0 && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          -{discountPercent}%
                        </span>
                      )}
                      {isSelectedEscalating && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" />
                          Nâng Giá (+{formatCore(selectedEscData.step)}/lượt)
                        </span>
                      )}
                    </div>

                    {/* Trạng thái kho: Ghi rõ còn hàng hay hết hàng (không ghi số lượng) */}
                    <div>
                      {isOutOfStock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold">
                          <span>Hết hàng</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Còn hàng</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelectedEscalating && (
                    <div className="mt-2.5 p-3 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold text-amber-300">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          Lượt mua thứ {Number(selectedEscData.completed_count) + 1}
                        </span>
                        <span className="text-[11px] font-mono text-amber-300 font-bold">
                          +{formatCore(selectedEscData.step)}/lượt
                        </span>
                      </div>

                      {/* Thang đo giá trực quan 3 lượt */}
                      <div className="grid grid-cols-3 gap-1.5 text-center pt-1 border-t border-slate-800">
                        <div className="p-1.5 rounded-xl bg-amber-500/20 border border-amber-500/50">
                          <span className="text-[9px] text-amber-300 font-bold uppercase block">Lượt {Number(selectedEscData.completed_count) + 1} (Hiện tại)</span>
                          <span className="font-mono font-black text-xs text-amber-400 block mt-0.5">{formatCore(displayCurrentPrice)}</span>
                          <span className="text-[8px] text-emerald-400 font-semibold block">Giá lượt này</span>
                        </div>
                        <div className="p-1.5 rounded-xl bg-muted/40 border border-border">
                          <span className="text-[9px] text-muted-foreground font-bold uppercase block">Lượt {Number(selectedEscData.completed_count) + 2}</span>
                          <span className="font-mono font-bold text-xs text-foreground block mt-0.5">
                            {formatCore(
                              selectedEscData.max_price && (displayCurrentPrice + selectedEscData.step) > selectedEscData.max_price
                                ? selectedEscData.max_price
                                : displayCurrentPrice + selectedEscData.step
                            )}
                          </span>
                          <span className="text-[8px] text-muted-foreground block">Lượt kế</span>
                        </div>
                        <div className="p-1.5 rounded-xl bg-muted/20 border border-border/60 opacity-80">
                          <span className="text-[9px] text-muted-foreground font-bold uppercase block">Lượt {Number(selectedEscData.completed_count) + 3}</span>
                          <span className="font-mono font-bold text-xs text-foreground block mt-0.5">
                            {formatCore(
                              selectedEscData.max_price && (displayCurrentPrice + (selectedEscData.step * 2)) > selectedEscData.max_price
                                ? selectedEscData.max_price
                                : displayCurrentPrice + (selectedEscData.step * 2)
                            )}
                          </span>
                          <span className="text-[8px] text-muted-foreground block">Sau nữa</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-slate-800/60">
                        <span>Đã mua thành công: <strong className="text-foreground font-mono">{selectedEscData.completed_count}</strong> lượt</span>
                        {selectedEscData.max_price ? (
                          <span>Trần giá: <strong className="text-slate-300 font-mono">{formatCore(selectedEscData.max_price)}</strong></span>
                        ) : (
                          <span>Không giới hạn trần</span>
                        )}
                      </div>
                    </div>
                  )}

                  {!isSelectedEscalating && isSelectedOfferEligible && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20 w-fit">
                      <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                      <span>Ưu đãi mua lần đầu (chỉ 1 lần duy nhất cho gói này)</span>
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>5.0 (Đánh giá uy tín)</span>
                    </span>
                    {isSoldVisible && (
                      <span className="text-slate-400">
                        Đã bán: <strong className="text-foreground font-mono">{displaySold}</strong> gói
                      </span>
                    )}
                  </div>
                </div>

                {/* Khối Thông Tin Chi Tiết Gói Đang Chọn & Nút Mua Ngay Duy Nhất (Sticky Ghim trên Mobile & Desktop khi cuộn) */}
                <div className="sticky top-0 z-20 bg-slate-900 -mx-4 px-4 py-3 sm:-mx-5 sm:px-5 border-y border-slate-700/80 shadow-2xl space-y-2.5 transition-all">
                  {/* Tiêu đề & Nút Xem thêm / Thu gọn */}
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-heading font-bold text-xs text-foreground flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-secondary" />
                      <span>Thông Tin Chi Tiết Gói:</span>
                    </h4>
                    {currentDescription && currentDescription.length > 80 && (
                      <button
                        type="button"
                        onClick={() => setIsDescExpanded(!isDescExpanded)}
                        className="min-h-[44px] px-3 py-1.5 rounded-lg bg-secondary/15 hover:bg-secondary/25 text-secondary border border-secondary/30 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
                        aria-label={isDescExpanded ? 'Thu gọn mô tả' : 'Xem thêm mô tả'}
                      >
                        <span>{isDescExpanded ? 'Thu gọn' : 'Xem thêm'}</span>
                        {isDescExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {/* Nội dung mô tả (Cuộn nội bộ khi mở rộng để không che hay đẩy nút mua) */}
                  {currentDescription && (
                    <div
                      className={`text-xs text-muted-foreground leading-relaxed whitespace-pre-line transition-all ${
                        isDescExpanded
                          ? 'max-h-[22vh] sm:max-h-[160px] overflow-y-auto pr-1 scrollbar-thin bg-slate-950 p-2.5 rounded-xl border border-slate-800'
                          : 'line-clamp-2'
                      }`}
                    >
                      {currentDescription}
                    </div>
                  )}

                  {/* NÚT MUA NGAY DUY NHẤT TRONG BẢNG (Cố định ở đáy khối ghim) */}
                  <div className="pt-0.5 space-y-1">
                    {!currentUser ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onOpenAuth) onOpenAuth();
                        }}
                        className="w-full min-h-[44px] h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-secondary to-primary hover:opacity-95 text-white font-display font-bold text-xs sm:text-sm shadow-glow-primary transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>
                          {offerData.campaign?.enabled
                            ? `Đăng Nhập Để Nhận Ưu Đãi (${formatCore(totalPrice)})`
                            : `Đăng Nhập Để Mua (${formatCore(totalPrice)})`}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => {
                          if (isOutOfStock) {
                            if (onShowToast) onShowToast('Hết hàng', 'Gói này tạm thời hết hàng trong kho.', 'error');
                            return;
                          }
                          const finalSafeQty = isSelectedEscalating ? 1 : (realStock > 0 ? Math.min(quantity, realStock) : quantity);
                          onBuyNow(
                            product,
                            {
                              ...selectedPackage,
                              price: displayCurrentPrice,
                              isFirstPurchaseOffer: isSelectedOfferEligible,
                              discountAmount: isSelectedEscalating ? 0 : (selectedOffer?.discount_amount || 0),
                              sale_mode: isSelectedEscalating ? 'escalating' : (selectedPackage.sale_mode || 'normal'),
                              escalating_base_price: selectedEscData.base_price,
                              escalating_step: selectedEscData.step,
                              escalating_max_price: selectedEscData.max_price,
                              escalating_current_price: selectedEscData.current_price,
                              escalating_completed_count: selectedEscData.completed_count,
                            },
                            finalSafeQty
                          );
                        }}
                        className={`w-full min-h-[44px] h-[48px] py-3 px-4 rounded-xl font-display font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer ${
                          !isOutOfStock
                            ? isSelectedEscalating
                              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black shadow-amber-500/25'
                              : isSelectedOfferEligible
                                ? 'bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 hover:from-rose-600 hover:to-orange-600 text-white shadow-rose-500/20'
                                : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/20'
                            : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                        }`}
                      >
                        <Zap className={`w-4 h-4 ${isSelectedEscalating ? 'fill-slate-950 text-slate-950' : ''}`} />
                        <span>
                          {!isOutOfStock
                            ? isSelectedEscalating
                              ? `Mua Ngay Gói Nâng Giá (${formatCore(totalPrice)})`
                              : isSelectedOfferEligible
                                ? `Mua Ngay Ưu Đãi Lần Đầu (${formatCore(totalPrice)})`
                                : `Mua Ngay Gói Này (${formatCore(totalPrice)})`
                            : 'Tạm Hết Hàng'}
                        </span>
                      </button>
                    )}
                    <p className="text-[10px] text-center text-muted-foreground pt-0.5">
                      ⚡ Giao mã tự động qua ví Core trong 0 giây
                    </p>
                  </div>
                </div>

                {/* Banner Gợi Ý Cho Khách Chưa Đăng Nhập */}
                {!currentUser && offerData.campaign?.enabled && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (onOpenAuth) onOpenAuth();
                    }}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-rose-500/15 via-orange-500/15 to-amber-500/15 border border-rose-500/30 hover:border-rose-500/50 transition-all cursor-pointer flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-pulse shrink-0" />
                      <span>Đăng nhập để nhận ưu đãi mua lần đầu chỉ {formatCore(offerData.campaign?.offer_price || 2000)}</span>
                    </div>
                    <span className="text-[10px] text-amber-400 font-bold underline shrink-0">Đăng nhập ngay &gt;</span>
                  </div>
                )}

                {/* Banner Hướng Dẫn Xác Minh Email Cho Tài Khoản Đã Đăng Nhập */}
                {currentUser && offerData.campaign?.enabled && offerData.campaign?.require_verified_email && !currentUser.email_verified && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.location.hash = '#/account';
                      }
                    }}
                    className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/35 hover:border-amber-500/50 transition-all cursor-pointer flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Cần xác minh email trong Hồ Sơ Tài Khoản để nhận giá ưu đãi {formatCore(offerData.campaign?.offer_price || 2000)}.</span>
                    </div>
                    <span className="text-[10px] text-amber-400 font-bold underline shrink-0">Xác minh ngay &gt;</span>
                  </div>
                )}

                {/* Danh Sách Chọn Gói (Chọn Gói) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-secondary" />
                      <span>Chọn gói sản phẩm:</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {packages.length} gói có sẵn
                    </span>
                  </div>

                  <div className="space-y-2 sm:max-h-[300px] sm:overflow-y-auto pr-1 scrollbar-thin">
                    {packages.map((pkg) => {
                      const isSelected = pkg.id === selectedPackage.id;
                      const pkgStock = typeof pkg.stock_quantity === 'number' ? pkg.stock_quantity : product.stock_quantity;
                      const isPkgOut = pkgStock <= 0;

                      const pkgOffer = offerData.offers[pkg.id];
                      const isPkgEscalating = pkg.sale_mode === 'escalating' || Boolean(pkgOffer?.escalating?.is_escalating);
                      const rawPkgEsc = pkgOffer?.escalating;
                      const pkgEscBase = Number(rawPkgEsc?.base_price ?? rawPkgEsc?.escalating_base_price ?? pkg.escalating_base_price ?? pkg.price) || pkg.price;
                      const pkgEscStep = Number(rawPkgEsc?.step ?? rawPkgEsc?.escalating_step ?? pkg.escalating_step ?? 0) || 0;
                      const pkgEscCompleted = Number(rawPkgEsc?.completed_count ?? pkg.escalating_completed_count ?? 0) || 0;
                      const pkgEscMax = (rawPkgEsc?.max_price !== undefined && rawPkgEsc?.max_price !== null)
                        ? Number(rawPkgEsc.max_price)
                        : (pkg.escalating_max_price !== undefined && pkg.escalating_max_price !== null ? Number(pkg.escalating_max_price) : null);
                      const rawPkgCurrent = Number(rawPkgEsc?.current_price ?? rawPkgEsc?.current_calculated_price ?? pkg.escalating_current_price);
                      const pkgEscCurrent = (rawPkgCurrent > 0)
                        ? rawPkgCurrent
                        : (pkgEscMax !== null && pkgEscMax > 0 ? Math.min(pkgEscBase + (pkgEscCompleted * pkgEscStep), pkgEscMax) : (pkgEscBase + (pkgEscCompleted * pkgEscStep)));

                      const pkgEscData = {
                        is_escalating: isPkgEscalating,
                        base_price: pkgEscBase,
                        step: pkgEscStep,
                        max_price: pkgEscMax,
                        completed_count: pkgEscCompleted,
                        current_price: pkgEscCurrent,
                      };

                      const isPkgFpFlag = pkg.first_purchase_enabled === true ||
                        pkg.first_purchase_enabled === 1 ||
                        String(pkg.first_purchase_enabled) === '1' ||
                        String(pkg.first_purchase_enabled) === 'true';

                      const pkgMaxPrice = pkg.first_purchase_max_price
                        ? Number(pkg.first_purchase_max_price)
                        : (offerData?.campaign?.max_original_price ?? 30000);

                      const defaultPkgEligible = isPkgFpFlag && !isPkgEscalating && (pkg.price <= pkgMaxPrice);
                      const isPkgOfferEligible = !isPkgEscalating && isPkgFpFlag && (
                        pkgOffer !== undefined ? Boolean(pkgOffer.eligible) : defaultPkgEligible
                      );
                      const isPkgOfferUnverified = !isPkgEscalating && isPkgFpFlag && !isPkgOfferEligible && pkgOffer?.reason === 'email_unverified';
                      const isPkgOfferLoginReq = !isPkgEscalating && isPkgFpFlag && !isPkgOfferEligible && pkgOffer?.reason === 'login_required';

                      const pkgRawOfferPrice = pkgOffer?.offer_price ?? (
                        pkg.first_purchase_price ? Number(pkg.first_purchase_price) : (offerData?.campaign?.offer_price ?? 2000)
                      );

                      const pkgDisplayPrice = isPkgEscalating
                        ? pkgEscData.current_price
                        : (isPkgOfferEligible ? pkgRawOfferPrice : pkg.price);
                      const pkgOriginalPrice = isPkgEscalating
                        ? pkgDisplayPrice
                        : (pkg.original_price || pkg.price);

                      return (
                        <div
                          key={pkg.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedPackageId(pkg.id);
                            setQuantity(1);
                            setIsDescExpanded(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedPackageId(pkg.id);
                              setQuantity(1);
                              setIsDescExpanded(false);
                            }
                          }}
                          className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 relative ${
                            isSelected
                              ? 'border-red-500 bg-red-500/10 shadow-md ring-1 ring-red-500/60'
                              : 'border-border/80 bg-card/60 hover:bg-card hover:border-slate-600'
                          } ${isPkgOut ? 'opacity-60' : ''}`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-foreground'}`}>
                                {pkg.name}
                              </span>
                              {isPkgEscalating && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 flex items-center gap-1">
                                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                                  Nâng Giá (+{formatCore(pkgEscData.step)}/lượt)
                                </span>
                              )}
                              {!isPkgEscalating && isPkgOfferEligible && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0 flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5 text-rose-400" />
                                  Mua lần đầu chỉ {formatCore(pkgRawOfferPrice)}
                                </span>
                              )}
                              {!isPkgEscalating && isPkgOfferUnverified && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 flex items-center gap-1" title="Cần xác minh email để áp dụng giá ưu đãi">
                                  <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                  Mua lần đầu chỉ {formatCore(pkgRawOfferPrice)} (Cần xác minh email)
                                </span>
                              )}
                              {!isPkgEscalating && isPkgOfferLoginReq && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0 flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5 text-rose-400" />
                                  Mua lần đầu chỉ {formatCore(pkgRawOfferPrice)}
                                </span>
                              )}
                              {pkg.badge && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                  {pkg.badge}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground truncate">
                                {isPkgEscalating
                                  ? `Lượt mua thứ ${Number(pkgEscData.completed_count) + 1}`
                                  : (pkg.note || 'Xử lý tiêu chuẩn')}
                              </span>
                              {isSoldVisible && (pkg as any).show_sold_count !== false && (
                                <span className="text-[11px] text-slate-400 font-mono shrink-0">
                                  • Đã bán: <strong className="text-foreground">{isPkgEscalating ? pkgEscData.completed_count : marketingService.getSoldDisplay({ ...pkg, created_at: product.created_at } as any)}</strong>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 w-full sm:w-auto">
                            <div className="flex items-baseline gap-2 sm:block sm:text-right">
                              <span className={`font-mono font-bold text-xs sm:text-sm block ${isSelected ? (isPkgEscalating ? 'text-amber-400' : 'text-red-400') : (isPkgEscalating ? 'text-amber-300' : 'text-emerald-400')}`}>
                                {formatCore(pkgDisplayPrice)}
                              </span>
                              {!isPkgEscalating && isPkgOfferEligible && pkgOriginalPrice > pkgDisplayPrice ? (
                                <span className="text-[10px] text-muted-foreground line-through font-mono block">
                                  {formatCore(pkgOriginalPrice)}
                                </span>
                              ) : isPkgOut ? (
                                <span className="text-[10px] text-rose-400 font-semibold block">Hết hàng</span>
                              ) : (
                                <span className="text-[10px] text-emerald-400 font-semibold block">Còn hàng</span>
                              )}
                            </div>

                            {/* Nút chia sẻ riêng từng gói (icon dễ nhận, đặt cạnh giá) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPackageToShare(pkg);
                              }}
                              className="p-1.5 sm:p-2 rounded-lg bg-slate-800/80 hover:bg-secondary/20 text-slate-400 hover:text-secondary border border-slate-700/60 hover:border-secondary/40 transition-all cursor-pointer active:scale-90 shrink-0 ml-auto sm:ml-0"
                              title={`Chia sẻ gói ${pkg.name}`}
                              aria-label={`Chia sẻ gói ${pkg.name}`}
                            >
                              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Số lượng mua */}
                {!isOutOfStock && (
                  isSelectedEscalating ? (
                    <div className="pt-2 border-t border-border/70 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-foreground block">Số lượng mua:</span>
                        <span className="text-[10px] text-amber-300">⚡ Cố định 1 gói/đơn để bảo đảm giá theo lượt mua</span>
                      </div>
                      <span className="font-mono font-bold text-xs text-foreground px-3 py-1 bg-muted rounded-lg border border-border">
                        1 Gói
                      </span>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-border/70 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-foreground block">Số lượng mua:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleDecreaseQty}
                          disabled={quantity <= 1}
                          className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center disabled:opacity-40 cursor-pointer active:scale-95 transition-all"
                          aria-label="Giảm"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-10 text-center font-mono font-bold text-sm text-foreground">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={handleIncreaseQty}
                          disabled={realStock > 0 && quantity >= realStock}
                          className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center disabled:opacity-40 cursor-pointer active:scale-95 transition-all"
                          aria-label="Tăng"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                )}

                {/* Nút Mua Ngay đã được chuyển hoàn toàn lên khối mô tả ghim cố định */}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Image Zoom Lightbox */}
        {isZoomed && (
          <div
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setIsZoomed(false)}
          >
            <button
              onClick={() => setIsZoomed(false)}
              className="absolute top-4 right-4 p-3 rounded-full bg-slate-800 text-white border border-slate-700 hover:bg-slate-700 cursor-pointer"
              aria-label="Đóng phóng to"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={images[activeImageIdx]}
              alt={product.title}
              className="max-w-full max-h-[90vh] object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Modal Chia Sẻ Từng Gói Riêng Biệt */}
        {packageToShare && (
          <PackageShareModal
            isOpen={Boolean(packageToShare)}
            onClose={() => setPackageToShare(null)}
            product={product}
            packageItem={packageToShare}
            onBuyNow={(pkg) => {
              setPackageToShare(null);
              setSelectedPackageId(pkg.id);
              onBuyNow(product, pkg, 1);
            }}
            onShowToast={onShowToast || (() => {})}
          />
        )}
      </div>
    </div>,
    document.body
  );
};
