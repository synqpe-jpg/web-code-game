import React, { useState, useEffect } from 'react';
import {
  X,
  Ticket,
  Truck,
  Check,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  voucherService,
  VoucherItem,
  VoucherStackingResult,
} from '../../services/voucherService';
import { formatCurrency } from '../../utils/formatUtils';

interface ShopeeCouponModalProps {
  isOpen: boolean;
  onClose: () => void;
  productTotal: number;
  shippingFee: number;
  isPhysical: boolean;
  initialFreeship?: VoucherItem | null;
  initialDiscount?: VoucherItem | null;
  onApply: (freeship: VoucherItem | null, discount: VoucherItem | null) => void;
}

export const ShopeeCouponModal: React.FC<ShopeeCouponModalProps> = ({
  isOpen,
  onClose,
  productTotal,
  shippingFee,
  isPhysical,
  initialFreeship = null,
  initialDiscount = null,
  onApply,
}) => {
  const [activeTab, setActiveTab] = useState<'freeship' | 'discount'>('freeship');
  const [selectedFreeship, setSelectedFreeship] = useState<VoucherItem | null>(initialFreeship);
  const [selectedDiscount, setSelectedDiscount] = useState<VoucherItem | null>(initialDiscount);
  const [manualCode, setManualCode] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  // Sync initial
  useEffect(() => {
    if (isOpen) {
      setSelectedFreeship(initialFreeship || null);
      setSelectedDiscount(initialDiscount || null);
      setManualCode('');
      setInputError(null);
    }
  }, [isOpen, initialFreeship, initialDiscount]);

  if (!isOpen) return null;

  const { freeshipVouchers, discountVouchers } = voucherService.evaluateVouchers({
    productTotal,
    shippingFee,
    isPhysical,
  });

  const stackingPreview: VoucherStackingResult = voucherService.calculateStacking({
    productTotal,
    shippingFee,
    freeshipVoucher: selectedFreeship,
    discountVoucher: selectedDiscount,
  });

  const handleApplyManualCode = () => {
    setInputError(null);
    if (!manualCode.trim()) {
      setInputError('Vui lòng nhập mã giảm giá');
      return;
    }

    const found = voucherService.getByCode(manualCode);
    if (!found) {
      setInputError('Mã giảm giá không tồn tại hoặc đã hết hạn');
      return;
    }

    // Check scope
    if (found.scopeType === 'physical_only' && !isPhysical) {
      setInputError('Mã này chỉ áp dụng cho đơn hàng vật lý');
      return;
    }
    if (found.scopeType === 'digital_only' && isPhysical) {
      setInputError('Mã này chỉ áp dụng cho sản phẩm kỹ thuật số / game code');
      return;
    }

    // Check min order
    if (productTotal < found.minOrderValue) {
      setInputError(`Đơn hàng chưa đạt mức tối thiểu ${formatCurrency(found.minOrderValue)}`);
      return;
    }

    if (found.voucherType === 'freeship') {
      setSelectedFreeship(found);
      setActiveTab('freeship');
    } else {
      setSelectedDiscount(found);
      setActiveTab('discount');
    }
    setManualCode('');
  };

  const handleToggleFreeship = (v: VoucherItem) => {
    if (selectedFreeship?.id === v.id) {
      setSelectedFreeship(null);
    } else {
      setSelectedFreeship(v);
    }
  };

  const handleToggleDiscount = (v: VoucherItem) => {
    if (selectedDiscount?.id === v.id) {
      setSelectedDiscount(null);
    } else {
      setSelectedDiscount(v);
    }
  };

  const handleConfirm = () => {
    onApply(selectedFreeship, selectedDiscount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-orange-500 to-[#ee4d2d] text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">Shopee Voucher Đa Tầng</h3>
              <p className="text-xs text-white/80">Áp dụng đồng thời 1 Mã Vận Chuyển + 1 Mã Giảm Giá</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Mã Thủ Công */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Nhập mã giảm giá (ví dụ: FREESHIP30K, SAN20K...)"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value);
                  setInputError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyManualCode()}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm uppercase rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-[#ee4d2d]"
              />
            </div>
            <button
              onClick={handleApplyManualCode}
              disabled={!manualCode.trim()}
              className="px-4 py-2.5 rounded-xl bg-[#ee4d2d] hover:bg-[#d73211] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-all shrink-0"
            >
              Áp Dụng
            </button>
          </div>
          {inputError && (
            <div className="mt-2 text-xs text-rose-500 flex items-center gap-1.5 animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5" /> {inputError}
            </div>
          )}
        </div>

        {/* Tab Switcher: Freeship vs Discount */}
        <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('freeship')}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'freeship'
                ? 'border-[#00bfa5] text-[#00bfa5] bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Mã Vận Chuyển {selectedFreeship ? '✓' : ''}</span>
          </button>

          <button
            onClick={() => setActiveTab('discount')}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'discount'
                ? 'border-[#ee4d2d] text-[#ee4d2d] bg-orange-50/50 dark:bg-orange-950/20'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>Mã Giảm Giá {selectedDiscount ? '✓' : ''}</span>
          </button>
        </div>

        {/* Voucher List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100/60 dark:bg-slate-950">
          {activeTab === 'freeship' ? (
            !isPhysical ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
                <Truck className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Đơn hàng kỹ thuật số nhận mã tức thì
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Mã miễn phí vận chuyển chỉ áp dụng cho đơn hàng vật lý giao qua GHTK, GHN, Viettel Post.
                </p>
              </div>
            ) : freeshipVouchers.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Hiện không có mã vận chuyển khả dụng.</div>
            ) : (
              freeshipVouchers.map(({ voucher, eligible, diffNeeded }) => {
                const isSelected = selectedFreeship?.id === voucher.id;
                return (
                  <div
                    key={voucher.id}
                    onClick={() => eligible && handleToggleFreeship(voucher)}
                    className={`relative rounded-xl border transition-all overflow-hidden flex ${
                      !eligible
                        ? 'opacity-60 bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                        : isSelected
                        ? 'bg-emerald-50/30 dark:bg-emerald-950/30 border-emerald-500 shadow-md ring-1 ring-emerald-500 cursor-pointer'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 cursor-pointer'
                    }`}
                  >
                    {/* Left Coupon Notch */}
                    <div className="w-24 sm:w-28 p-3 bg-gradient-to-br from-[#00bfa5] to-teal-700 text-white flex flex-col items-center justify-center text-center shrink-0 border-r border-dashed border-white/40">
                      <Truck className="w-6 h-6 mb-1" />
                      <span className="text-[10px] uppercase font-bold tracking-wider leading-tight">
                        {voucher.badgeText || 'Freeship'}
                      </span>
                      <span className="text-xs font-extrabold mt-1">
                        {voucher.discountType === 'fixed'
                          ? formatCurrency(voucher.discountValue)
                          : `${voucher.discountValue}%`}
                      </span>
                    </div>

                    {/* Right Coupon Info */}
                    <div className="flex-1 p-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                            {voucher.title}
                          </h4>
                          {/* Selection indicator */}
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                              isSelected
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {voucher.description}
                        </p>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                        {!eligible ? (
                          <span className="text-rose-500 font-medium">
                            Mua thêm {formatCurrency(diffNeeded)} để dùng mã
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Đủ điều kiện áp dụng
                          </span>
                        )}
                        <span className="text-slate-400 font-mono">Mã: {voucher.code}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : discountVouchers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Hiện không có mã giảm giá khả dụng.</div>
          ) : (
            discountVouchers.map(({ voucher, eligible, diffNeeded }) => {
              const isSelected = selectedDiscount?.id === voucher.id;
              return (
                <div
                  key={voucher.id}
                  onClick={() => eligible && handleToggleDiscount(voucher)}
                  className={`relative rounded-xl border transition-all overflow-hidden flex ${
                    !eligible
                      ? 'opacity-60 bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                      : isSelected
                      ? 'bg-orange-50/30 dark:bg-orange-950/30 border-[#ee4d2d] shadow-md ring-1 ring-[#ee4d2d] cursor-pointer'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-300 cursor-pointer'
                  }`}
                >
                  {/* Left Coupon Notch */}
                  <div
                    className="w-24 sm:w-28 p-3 text-white flex flex-col items-center justify-center text-center shrink-0 border-r border-dashed border-white/40"
                    style={{ backgroundColor: voucher.highlightColor || '#ee4d2d' }}
                  >
                    <Ticket className="w-6 h-6 mb-1" />
                    <span className="text-[10px] uppercase font-bold tracking-wider leading-tight">
                      {voucher.badgeText || 'Voucher'}
                    </span>
                    <span className="text-xs font-extrabold mt-1">
                      {voucher.discountType === 'fixed'
                        ? formatCurrency(voucher.discountValue)
                        : `-${voucher.discountValue}%`}
                    </span>
                  </div>

                  {/* Right Coupon Info */}
                  <div className="flex-1 p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                          {voucher.title}
                        </h4>
                        {/* Selection indicator */}
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'bg-[#ee4d2d] border-[#ee4d2d] text-white'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {voucher.description}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                      {!eligible ? (
                        <span className="text-rose-500 font-medium">
                          Mua thêm {formatCurrency(diffNeeded)} để dùng mã
                        </span>
                      ) : (
                        <span className="text-orange-600 dark:text-orange-400 font-medium">
                          Đủ điều kiện áp dụng
                        </span>
                      )}
                      <span className="text-slate-400 font-mono">Mã: {voucher.code}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Stacking Summary & Action Button */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="space-y-0.5 w-full sm:w-auto text-center sm:text-left">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1">
              <span>Đã chọn:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {selectedFreeship ? '1 Mã Vận Chuyển' : '0 Vận Chuyển'}
              </span>
              <span>+</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {selectedDiscount ? '1 Mã Giảm Giá' : '0 Giảm Giá'}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-slate-600 dark:text-slate-400">Tiết kiệm: </span>
              <strong className="text-base text-[#ee4d2d]">
                {formatCurrency(stackingPreview.totalSavings)}
              </strong>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-[#ee4d2d] hover:bg-[#d73211] text-white text-xs sm:text-sm font-bold shadow-md shadow-orange-500/20 transition-all"
            >
              Đồng Ý Dùng Voucher
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
