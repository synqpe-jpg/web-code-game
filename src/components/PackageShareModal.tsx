import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Copy,
  Check,
  Share2,
  Globe,
  Send,
  MessageCircle,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Zap,
} from 'lucide-react';
import type { StoreProduct, ProductPackageVariant } from '../types/game';
import { formatCore } from '../utils/textUtils';

export interface PackageShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: StoreProduct | any;
  packageItem: ProductPackageVariant;
  onBuyNow?: (pkg: ProductPackageVariant) => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

const slugifyGameName = (name: string): string => {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const PackageShareModal: React.FC<PackageShareModalProps> = ({
  isOpen,
  onClose,
  product,
  packageItem,
  onBuyNow,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !packageItem || typeof document === 'undefined') return null;

  const origin =
    typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? window.location.origin
      : 'https://codegame.shop';

  const gameSlug =
    product?.game_slug ||
    (product?.game_name ? slugifyGameName(product.game_name) : 'store');

  const shareUrl = `${origin}/store?game=${encodeURIComponent(gameSlug)}&pkg=${encodeURIComponent(packageItem.id)}`;

  const gameName = product?.game_name || product?.title || 'Game';
  const gameAvatar =
    product?.game_icon_url ||
    product?.cover_image_url ||
    (product?.game_slug ? `/game_icons/${product.game_slug}.webp` : '') ||
    '/og-image.jpg';

  const currentPrice = packageItem.price;
  const originalPrice =
    typeof packageItem.original_price === 'number' && packageItem.original_price > currentPrice
      ? packageItem.original_price
      : 0;

  const discountPercent =
    originalPrice > currentPrice
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
      : 0;

  const pkgStock =
    typeof packageItem.stock_quantity === 'number'
      ? packageItem.stock_quantity
      : (typeof product?.stock_quantity === 'number' ? product.stock_quantity : 1);

  const isOutOfStock = pkgStock <= 0;

  const shareTitle = `${packageItem.name} — ${formatCore(currentPrice)} | ${gameName}`;
  const shareText = `Mua ngay ${packageItem.name} (${gameName}) giá chỉ ${formatCore(currentPrice)} tại CodeGame.shop`;

  const fallbackCopyText = (text: string): boolean => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch {
      return false;
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        // clipboard write succeeded
      }).catch(() => {
        fallbackCopyText(shareUrl);
      });
    } else {
      fallbackCopyText(shareUrl);
    }
    setCopied(true);
    onShowToast('Đã chép link gói!', `Đã sao chép liên kết gói "${packageItem.name}".`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const shareMessenger = () => {
    window.open(`fb-messenger://share/?link=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const shareZalo = () => {
    window.open(`https://zalo.me/share?url=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const shareTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
      '_blank'
    );
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-fade-in"
    >
      <div
        className="w-full max-w-sm sm:max-w-md bg-card border border-border/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl animate-scale-in space-y-3.5 max-h-[92vh] flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-2.5 border-b border-border/70">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
            <div className="p-2 rounded-xl bg-secondary/15 text-secondary border border-secondary/30 shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading font-bold text-sm sm:text-base text-foreground truncate">
                Chia Sẻ Gói Sản Phẩm
              </h3>
              <p className="text-[11px] text-muted-foreground truncate font-medium">
                {gameName}
              </p>
            </div>
          </div>
          {/* Nút Đóng góc trên */}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 shadow-sm cursor-pointer transition-all active:scale-90 flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]"
            aria-label="Đóng"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Khối Tóm Tắt Gói Đang Chia Sẻ (Game, Tên gói, Giá to rõ, % giảm, Tồn kho) */}
        <div className="p-3 rounded-2xl bg-muted/40 border border-border/80 flex items-center gap-3">
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 bg-background border border-primary/30 shadow-md">
            <img
              src={gameAvatar}
              alt={gameName}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/og-image.jpg';
              }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-secondary bg-secondary/10 px-1.5 py-0.5 rounded border border-secondary/20">
                Gói Code
              </span>
              {packageItem.badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {packageItem.badge}
                </span>
              )}
            </div>

            <h4 className="font-heading font-bold text-xs sm:text-sm text-foreground truncate">
              {packageItem.name}
            </h4>

            {/* Giá to rõ + % giảm + Trạng thái kho */}
            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="font-mono font-extrabold text-base sm:text-lg text-emerald-400">
                {formatCore(currentPrice)}
              </span>
              {originalPrice > currentPrice && (
                <span className="text-xs text-muted-foreground line-through font-mono">
                  {formatCore(originalPrice)}
                </span>
              )}
              {discountPercent > 0 && (
                <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  -{discountPercent}%
                </span>
              )}
              {isOutOfStock ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 inline-flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Hết hàng
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Còn hàng
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Ô Hiển Thị Deep Link & Nút Chép Link */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-secondary" />
              <span>Liên Kết Gói (Deep Link)</span>
            </label>
            {copied && (
              <span className="text-[11px] font-bold text-emerald-400 animate-fade-in flex items-center gap-1">
                <Check className="w-3 h-3" /> Đã lưu vào bộ nhớ tạm!
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 bg-muted/60 border border-border focus-within:border-secondary/60 rounded-xl p-1 pl-2.5 transition-colors">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="bg-transparent text-xs text-foreground font-mono flex-1 outline-none truncate cursor-pointer"
            />
            {/* Nút Chép Link: 1 chạm chép link, min-h-[44px] */}
            <button
              type="button"
              onClick={handleCopyLink}
              className={`min-h-[44px] px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 flex items-center gap-1.5 ${
                copied
                  ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-secondary to-primary hover:opacity-90 text-white shadow-sm'
              }`}
              title="Chép link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã chép link ✓</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Chép link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hàng Nút Hành Động Bố Cục 1 Màn Hình: Chia sẻ hệ thống, Mua ngay, Đóng (Tất cả cao tối thiểu 44px) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {hasNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer active:scale-95"
            >
              <Share2 className="w-4 h-4 text-cyan-400" />
              <span>Chia Sẻ Ứng Dụng...</span>
            </button>
          )}

          {onBuyNow && (
            <button
              type="button"
              disabled={isOutOfStock}
              onClick={() => {
                onClose();
                onBuyNow(packageItem);
              }}
              className={`min-h-[44px] py-2.5 px-3 rounded-xl font-display font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer shadow-md ${
                !hasNativeShare ? 'sm:col-span-2' : ''
              } ${
                !isOutOfStock
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:opacity-95 text-white shadow-emerald-500/20'
                  : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{isOutOfStock ? 'Gói Đã Hết Hàng' : `Mua Ngay (${formatCore(currentPrice)})`}</span>
            </button>
          )}
        </div>

        {/* Nút Đóng Toàn Diện Ở Chân Modal (Nếu không có nút chia sẻ hệ thống hoặc trên màn hình nhỏ) */}
        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground border border-border/60 text-xs font-semibold transition-all cursor-pointer active:scale-95 flex items-center justify-center"
        >
          Đóng Cửa Sổ
        </button>

        {/* Nút Chia Sẻ Mạng Xã Hội Nhanh (Zalo, Messenger, Facebook, Telegram) */}
        <div className="pt-2 border-t border-border/60">
          <div className="grid grid-cols-4 gap-2 text-center">
            {/* Zalo */}
            <button
              type="button"
              onClick={shareZalo}
              className="flex flex-col items-center gap-1 group cursor-pointer min-h-[44px] justify-center"
              title="Chia sẻ lên Zalo"
            >
              <div className="w-8 h-8 rounded-xl bg-[#0068FF]/15 border border-[#0068FF]/30 text-[#0068FF] flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="font-bold text-[10px]">Zalo</span>
              </div>
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground">Zalo</span>
            </button>

            {/* Messenger */}
            <button
              type="button"
              onClick={shareMessenger}
              className="flex flex-col items-center gap-1 group cursor-pointer min-h-[44px] justify-center"
              title="Chia sẻ qua Messenger"
            >
              <div className="w-8 h-8 rounded-xl bg-[#00B2FF]/15 border border-[#00B2FF]/30 text-[#00B2FF] flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageCircle className="w-4 h-4" />
              </div>
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground">Messenger</span>
            </button>

            {/* Facebook */}
            <button
              type="button"
              onClick={shareFacebook}
              className="flex flex-col items-center gap-1 group cursor-pointer min-h-[44px] justify-center"
              title="Chia sẻ lên Facebook"
            >
              <div className="w-8 h-8 rounded-xl bg-[#1877F2]/15 border border-[#1877F2]/30 text-[#1877F2] flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="font-bold text-xs">f</span>
              </div>
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground">Facebook</span>
            </button>

            {/* Telegram */}
            <button
              type="button"
              onClick={shareTelegram}
              className="flex flex-col items-center gap-1 group cursor-pointer min-h-[44px] justify-center"
              title="Chia sẻ lên Telegram"
            >
              <div className="w-8 h-8 rounded-xl bg-[#229ED9]/15 border border-[#229ED9]/30 text-[#229ED9] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Send className="w-4 h-4" />
              </div>
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground">Telegram</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
