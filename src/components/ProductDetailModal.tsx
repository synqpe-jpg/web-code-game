import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import type { StoreProduct, UserProfile } from '../types/game';
import { formatCore } from '../utils/textUtils';
import { marketingService } from '../services/marketingService';
import { dataService } from '../services/dataService';
import { GuideLinksBanner } from './GuideLinksBanner';

interface ProductDetailModalProps {
  product: StoreProduct | null;
  onClose: () => void;
  onBuyNow: (product: StoreProduct) => void;
  currentUser?: UserProfile | null;
  onOpenAuth?: () => void;
  onOpenShare?: (product: StoreProduct) => void;
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
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
  const [, setTick] = useState(0);

  useEffect(() => {
    setActiveImageIdx(0);
    setIsZoomed(false);
    setIsDescExpanded(false);
  }, [product?.id]);

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    const unsub = dataService.subscribe(handleUpdate);
    const unsubStock = marketingService.subscribeStockChange(handleUpdate);
    const unsubSold = marketingService.subscribeSoldCountChange(handleUpdate);
    window.addEventListener('wcg_virtual_stock_updated', handleUpdate);
    window.addEventListener('wcg_sold_count_updated', handleUpdate);
    return () => {
      unsub();
      unsubStock();
      unsubSold();
      window.removeEventListener('wcg_virtual_stock_updated', handleUpdate);
      window.removeEventListener('wcg_sold_count_updated', handleUpdate);
    };
  }, []);

  if (!product) return null;
  const liveProduct = dataService.getStoreProducts().find((p) => p.id === product.id) || product;

  const handleShare = () => {
    if (onOpenShare) {
      onOpenShare(product);
    } else {
      const shareUrl = `${window.location.origin}/#product=${product.id}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl);
        if (onShowToast) {
          onShowToast('Đã sao chép link sản phẩm!', `Đường dẫn: ${shareUrl}`, 'success');
        }
      }
    }
  };

  const images = (product.product_images && product.product_images.length > 0)
    ? product.product_images
    : [product.cover_image_url || product.game_icon_url || `/game_icons/${product.game_slug}.webp`].filter(Boolean) as string[];

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-card border-t sm:border border-border/90 rounded-t-[28px] sm:rounded-3xl overflow-hidden shadow-2xl animate-scale-in flex flex-col h-[88dvh] sm:h-auto sm:max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed at top */}
        <div className="p-3.5 sm:p-5 border-b border-border/70 bg-card/95 backdrop-blur-md shrink-0 sticky top-0 z-20">
          {/* Mobile Sheet Indicator */}
          <div className="w-12 h-1.5 bg-slate-600/60 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

          <div className="flex items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted overflow-hidden border border-border shrink-0">
                <img
                  src={product.cover_image_url || product.game_icon_url || `/game_icons/${product.game_slug}.webp`}
                  alt={product.game_name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const localFallback = `/game_icons/${product.game_slug}.webp`;
                    if (target.src !== localFallback && !target.src.endsWith(localFallback)) {
                      target.src = localFallback;
                    } else {
                      target.onerror = null;
                      target.src = '/vite.svg';
                    }
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading font-bold text-sm sm:text-base text-foreground truncate">
                  {product.title}
                </h3>
                <span className="text-[11px] sm:text-xs text-secondary font-semibold truncate block">{product.game_name}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleShare}
                className="p-2 sm:p-2.5 rounded-xl bg-muted/60 hover:bg-muted text-slate-300 hover:text-foreground cursor-pointer transition-all active:scale-95"
                title="Chia sẻ link gói code này"
                aria-label="Chia sẻ link sản phẩm"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {/* High-visibility Close Button */}
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Main Image Gallery */}
          <div className="space-y-2.5">
            <div className="relative h-48 sm:h-72 rounded-2xl bg-muted overflow-hidden border border-border group select-none">
              <img
                src={images[activeImageIdx]}
                alt={product.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const localFallback = `/game_icons/${product.game_slug}.webp`;
                  if (target.src !== localFallback && !target.src.endsWith(localFallback)) {
                    target.src = localFallback;
                  } else {
                    target.onerror = null;
                    target.src = '/vite.svg';
                  }
                }}
              />

              {/* Image Counter Badge */}
              {images.length > 1 && (
                <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-sm text-white text-[11px] font-mono font-medium shadow-md border border-white/10 z-10">
                  {activeImageIdx + 1} / {images.length}
                </div>
              )}

              {/* Prev / Next Buttons */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-all cursor-pointer opacity-90 sm:opacity-0 sm:group-hover:opacity-100 z-10 active:scale-95"
                    title="Ảnh trước"
                    aria-label="Ảnh trước"
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
                    aria-label="Ảnh sau"
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
                    {idx === 0 && (
                      <span className="absolute bottom-0 inset-x-0 bg-secondary/90 text-white text-[9px] font-bold text-center py-0.5 leading-none">
                        Bìa
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pricing & Stock Banner */}
          <div className="p-4 rounded-2xl bg-muted/50 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Giá bán ưu đãi:</span>
              <div className="flex items-baseline gap-2.5">
                <span className="font-display font-extrabold text-2xl text-emerald-400">
                  {formatCore(product.current_price)}
                </span>
                {product.original_price > product.current_price && (
                  <span className="text-sm text-muted-foreground line-through font-mono">
                    {formatCore(product.original_price)}
                  </span>
                )}
                {product.discount_percent > 0 && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-accent text-white">
                    -{product.discount_percent}%
                  </span>
                )}
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-border/60 sm:pl-4">
              <span className="text-xs text-muted-foreground block">Tình trạng kho:</span>
              <div className="text-sm font-bold text-foreground font-mono">
                {(() => {
                  const displayStock = liveProduct.stock_quantity <= 0 ? 0 : marketingService.getDisplayStock(liveProduct.id, liveProduct.stock_quantity);
                  const displaySold = marketingService.getSoldDisplay(liveProduct);
                  return (
                    <div>
                      {liveProduct.stock_quantity > 0 && displayStock > 0 ? (
                        <span className="text-emerald-400">Còn {displayStock} mã (Giao tự động)</span>
                      ) : (
                        <span className="text-accent">Tạm hết hàng</span>
                      )}
                      {liveProduct.show_sold_count !== false && (
                        <div className="text-xs font-normal text-amber-400/90 mt-0.5">
                          Đã bán: <strong className="font-bold">{displaySold}</strong> gói
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-heading font-bold text-sm text-foreground">
                  Chi Tiết Vật Phẩm Trong Gói:
                </h4>
                {product.description.length > 200 && (
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
                  !isDescExpanded && product.description.length > 200
                    ? 'max-h-[140px] overflow-hidden'
                    : 'max-h-[500px] overflow-y-auto scrollbar-thin'
                }`}
              >
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
                {!isDescExpanded && product.description.length > 200 && (
                  <div className="pointer-events-none absolute bottom-0 inset-x-0 h-14 bg-gradient-to-t from-card via-card/80 to-transparent flex items-end justify-center pb-1">
                    <span className="text-[10px] text-secondary font-semibold bg-card/90 px-2 py-0.5 rounded-full border border-secondary/20 shadow-sm">
                      Nhấn &quot;Xem thêm&quot; để đọc hết mô tả...
                    </span>
                  </div>
                )}
              </div>
              {!isDescExpanded && product.description.length > 200 && (
                <button
                  type="button"
                  onClick={() => setIsDescExpanded(true)}
                  className="w-full py-2 rounded-xl border border-dashed border-secondary/30 bg-secondary/5 hover:bg-secondary/10 text-secondary text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.99]"
                >
                  <span>Xem thêm toàn bộ mô tả chi tiết</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
              {isDescExpanded && product.description.length > 200 && (
                <button
                  type="button"
                  onClick={() => setIsDescExpanded(false)}
                  className="w-full py-1.5 rounded-xl border border-dashed border-border bg-muted/30 hover:bg-muted/50 text-slate-400 hover:text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.99]"
                >
                  <span>Thu gọn mô tả lại</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Guide Link Banner */}
          <GuideLinksBanner
            guideLinks={liveProduct.guide_links}
            guideUrl={liveProduct.guide_url}
            guideText={liveProduct.guide_text}
            showGuide={liveProduct.show_guide_link !== false}
            theme="indigo"
          />

          {/* Guarantee Badges */}
          <div className={`grid ${liveProduct.show_warranty ? 'grid-cols-2' : 'grid-cols-1'} gap-3 text-xs text-muted-foreground`}>
            {liveProduct.show_warranty && (
              <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{liveProduct.warranty_text || 'Bảo hành hoàn tiền 100%'}</span>
              </div>
            )}
            <div className="p-3 rounded-xl bg-muted/30 border border-border flex items-center gap-2">
              <Zap className="w-4 h-4 text-secondary shrink-0" />
              <span>Giao mã tự động trong 5 giây</span>
            </div>
          </div>
        </div>

        {/* Footer CTA - Sticky at bottom */}
        <div className="p-3.5 sm:p-5 border-t border-border flex items-center justify-between gap-3 bg-card/95 backdrop-blur-md shrink-0 sticky bottom-0 z-20 pb-[max(env(safe-area-inset-bottom,0px),0.875rem)]">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold cursor-pointer"
          >
            Đóng
          </button>
          {!currentUser ? (
            <button
              onClick={() => {
                onClose();
                if (onOpenAuth) onOpenAuth();
              }}
              className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-gradient-to-r from-secondary to-primary hover:opacity-95 text-white font-display font-bold text-xs shadow-glow-primary transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng Nhập Để Mua Ngay ({formatCore(product.current_price)})</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                onBuyNow(product);
              }}
              disabled={product.stock_quantity <= 0}
              className={`flex-1 sm:flex-initial px-6 py-3 rounded-xl font-display font-bold text-xs shadow-glow-accent transition-all ${
                product.stock_quantity <= 0
                  ? 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                  : 'bg-secondary hover:bg-secondary/90 text-white cursor-pointer'
              }`}
            >
              {product.stock_quantity <= 0 ? 'Tạm Hết Hàng' : `Mua Ngay Gói Này (${formatCore(product.current_price)})`}
            </button>
          )}
        </div>
      </div>

      {/* Lightbox / Zoomed image view */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsZoomed(false)}
        >
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700 shadow-xl cursor-pointer transition-all z-30"
            title="Đóng xem ảnh lớn"
          >
            <X className="w-6 h-6" />
          </button>

          {images.length > 1 && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-white text-xs font-mono font-medium shadow-md z-30">
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
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700 shadow-xl cursor-pointer transition-all z-30 active:scale-95"
                title="Ảnh trước"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                }}
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700 shadow-xl cursor-pointer transition-all z-30 active:scale-95"
                title="Ảnh sau"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <div
            className="relative max-w-4xl max-h-[85vh] flex items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[activeImageIdx]}
              alt={product.title}
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-slate-800"
            />
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
