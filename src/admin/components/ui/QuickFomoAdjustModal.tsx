import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Check,
  RotateCcw,
  Flame,
  ShieldCheck,
  AlertCircle,
  Eye,
  Boxes,
  Zap,
} from 'lucide-react';
import { FormModal } from './FormModal';
import { marketingService } from '../../../services/marketingService';
import { ProductPriority } from '../../../types/marketing';

export interface QuickFomoAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'giveaway' | 'utility' | 'store_product';
  itemId: string;
  itemTitle: string;
  gameName?: string;
  realStock: number;
  realSoldOrClaimed: number;
  onSuccess?: () => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
}

export const QuickFomoAdjustModal: React.FC<QuickFomoAdjustModalProps> = ({
  isOpen,
  onClose,
  itemType,
  itemId,
  itemTitle,
  gameName,
  realStock,
  realSoldOrClaimed,
  onSuccess,
  onShowToast,
}) => {
  const isGiveaway = itemType === 'giveaway';
  const labelSoldOrClaimed = isGiveaway ? 'Đã giật' : 'Đã bán';
  const labelStock = isGiveaway ? 'Mã còn lại' : 'Tồn kho';

  // Live web current stats
  const [currentWebStock, setCurrentWebStock] = useState(0);
  const [currentWebSold, setCurrentWebSold] = useState(0);

  // Form inputs
  const [targetSoldOrClaimed, setTargetSoldOrClaimed] = useState(0);
  const [bonusStock, setBonusStock] = useState(0);
  const [priority, setPriority] = useState<ProductPriority>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !itemId) return;

    const pw = marketingService.getProductConfig(itemId);
    const webStock = marketingService.getDisplayStock(itemId, realStock);
    const webSold = isGiveaway
      ? marketingService.getClaimedDisplay({ id: itemId, claimed_codes: realSoldOrClaimed })
      : marketingService.getSoldDisplay({ id: itemId, sold_count: realSoldOrClaimed });

    setCurrentWebStock(webStock);
    setCurrentWebSold(webSold);

    setTargetSoldOrClaimed(webSold);
    setBonusStock(Number(pw.virtualStockBonus) || 0);
    setPriority(pw.priority || 'normal');
  }, [isOpen, itemId, itemType, realStock, realSoldOrClaimed, isGiveaway]);

  const handleApply = async () => {
    if (!itemId) return;
    setIsSubmitting(true);
    try {
      const sanitizedTargetSold = Math.max(0, Number(targetSoldOrClaimed) || 0);
      const sanitizedBonusStock = Math.max(0, Number(bonusStock) || 0);

      await marketingService.updateItemVirtualSettings(itemId, {
        targetDisplaySoldOrClaimed: sanitizedTargetSold,
        virtualStockBonus: sanitizedBonusStock,
        priority,
        forceReset: true,
      });

      onShowToast(
        'Đã cập nhật số ảo thành công!',
        `Đã đồng bộ số hiển thị ngoài Web: ${labelSoldOrClaimed}: ${sanitizedTargetSold} | ${labelStock}: ${realStock <= 0 ? 0 : realStock + sanitizedBonusStock}.`,
        'success'
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      onShowToast('Lỗi cập nhật số ảo', err?.message || 'Không thể lưu cấu hình số ảo.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToReal = () => {
    setTargetSoldOrClaimed(realSoldOrClaimed);
    setBonusStock(0);
    setPriority('off');
  };

  const handlePresetGentle = () => {
    setTargetSoldOrClaimed(Math.max(25, realSoldOrClaimed + 25));
    setBonusStock(realStock > 0 ? 10 : 0);
    setPriority('normal');
  };

  const handlePresetVibrant = () => {
    setTargetSoldOrClaimed(Math.max(60, realSoldOrClaimed + 60));
    setBonusStock(realStock > 0 ? 20 : 0);
    setPriority('high');
  };

  if (!isOpen) return null;

  const estimatedDisplayStock = realStock <= 0 ? 0 : realStock + bonusStock;
  const stockDiff = estimatedDisplayStock - realStock;
  const soldDiff = targetSoldOrClaimed - realSoldOrClaimed;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="⚡ Điều Chỉnh Số Ảo Hiển Thị Ngoài Web"
      subtitle={`${isGiveaway ? 'Sự Kiện Giveaway' : 'Sản Phẩm'} • ${itemTitle}${gameName ? ` (${gameName})` : ''}`}
      maxWidth="xl"
    >
      <div className="p-4 sm:p-6 space-y-5">
        {/* SIDE-BY-SIDE STATS COMPARISON */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Real Warehouse Data */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              <Boxes className="w-4 h-4 text-emerald-500" />
              <span>DỮ LIỆU THẬT (DATABASE)</span>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Kho thật còn:</span>
                <strong className={`font-bold ${realStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {realStock} mã
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Thực tế {labelSoldOrClaimed.toLowerCase()}:</span>
                <strong className="text-slate-800 dark:text-slate-200 font-bold">
                  {realSoldOrClaimed} lượt
                </strong>
              </div>
            </div>
          </div>

          {/* Current Live Web Display */}
          <div className="p-3.5 rounded-2xl bg-purple-500/10 dark:bg-purple-950/30 border border-purple-500/30">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 mb-2">
              <Eye className="w-4 h-4 text-purple-500" />
              <span>ĐANG HIỂN THỊ NGOÀI WEB</span>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Web hiện còn:</span>
                <strong className="text-purple-600 dark:text-purple-400 font-bold">
                  {currentWebStock} mã
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Web hiện {labelSoldOrClaimed.toLowerCase()}:</span>
                <strong className="text-amber-500 font-bold">
                  {currentWebSold} lượt
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* 1-CLICK QUICK PRESET BUTTONS */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Mẫu chọn nhanh:</span>
          <button
            type="button"
            onClick={handleResetToReal}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border border-slate-300 dark:border-slate-700 active:scale-95"
            title="Đưa toàn bộ số liệu về đúng 100% kho thật"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
            <span>Chuẩn Thực Tế 100% (Xóa Ảo)</span>
          </button>
          <button
            type="button"
            onClick={handlePresetGentle}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border border-amber-500/30 active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>FOMO Nhẹ Nhàng (+25)</span>
          </button>
          <button
            type="button"
            onClick={handlePresetVibrant}
            className="px-2.5 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all border border-purple-500/30 active:scale-95"
          >
            <Flame className="w-3.5 h-3.5 text-purple-500" />
            <span>FOMO Sôi Động (+60)</span>
          </button>
        </div>

        {/* INPUT CONTROLS */}
        <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
          {/* Target Sold / Claimed Count */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Số {labelSoldOrClaimed} hiển thị ngoài Web:</span>
              </label>
              <span className="text-[11px] font-mono text-slate-500">
                Thật: {realSoldOrClaimed} {soldDiff !== 0 && `(Ảo: ${soldDiff > 0 ? `+${soldDiff}` : soldDiff})`}
              </span>
            </div>
            <input
              type="number"
              min="0"
              max="999999"
              value={targetSoldOrClaimed}
              onChange={(e) => setTargetSoldOrClaimed(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-foreground font-mono text-sm focus:border-purple-500 focus:outline-none"
              placeholder={`Nhập số ${labelSoldOrClaimed.toLowerCase()} mong muốn`}
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              <span className="text-slate-400">Gợi ý mốc:</span>
              <button
                type="button"
                onClick={() => setTargetSoldOrClaimed(realSoldOrClaimed)}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono cursor-pointer"
              >
                {realSoldOrClaimed} (Bằng thật)
              </button>
              <button
                type="button"
                onClick={() => setTargetSoldOrClaimed((prev) => prev + 10)}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono cursor-pointer"
              >
                +10
              </button>
              <button
                type="button"
                onClick={() => setTargetSoldOrClaimed((prev) => prev + 50)}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono cursor-pointer"
              >
                +50
              </button>
              <button
                type="button"
                onClick={() => setTargetSoldOrClaimed((prev) => prev + 100)}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono cursor-pointer"
              >
                +100
              </button>
            </div>
          </div>

          {/* Virtual Stock Bonus */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-teal-500" />
                <span>Số lượng cộng thêm vào tồn kho hiển thị (+ Bonus ảo):</span>
              </label>
              <span className="text-[11px] font-mono text-slate-500">
                Web sẽ hiện: {estimatedDisplayStock} mã {stockDiff > 0 && `(+${stockDiff} ảo)`}
              </span>
            </div>
            <input
              type="number"
              min="0"
              max="500"
              value={bonusStock}
              onChange={(e) => setBonusStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-foreground font-mono text-sm focus:border-purple-500 focus:outline-none"
              placeholder="0 (đúng kho thật) hoặc số lượng muốn cộng thêm"
            />
            {realStock <= 0 ? (
              <p className="text-[11px] text-amber-500 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Kho thật đang = 0. Theo Quy Tắc Vàng, ngoài Web sẽ luôn hiển thị HẾT HÀNG (0) để tránh giao dịch lỗi.</span>
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                <span className="text-slate-400">Chọn nhanh:</span>
                <button
                  type="button"
                  onClick={() => setBonusStock(0)}
                  className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono cursor-pointer font-bold"
                >
                  +0 (Bằng kho thật 100%)
                </button>
                <button
                  type="button"
                  onClick={() => setBonusStock(10)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono cursor-pointer"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => setBonusStock(20)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono cursor-pointer"
                >
                  +20
                </button>
                <button
                  type="button"
                  onClick={() => setBonusStock(50)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono cursor-pointer"
                >
                  +50
                </button>
              </div>
            )}
          </div>

          {/* Priority / Auto Increment Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>Chế độ tăng trưởng ảo theo giờ:</span>
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ProductPriority)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-foreground text-xs font-bold focus:border-purple-500 focus:outline-none cursor-pointer"
            >
              <option value="normal">⚡ Bình thường (Tự tăng nhẹ theo giờ)</option>
              <option value="high">🔥 Ưu tiên cao (Sôi động, xuất hiện thông báo toast nhiều)</option>
              <option value="low">💤 Thấp (Tăng rất chậm)</option>
              <option value="off">⛔ Tắt tự tăng (Cố định chính xác số lượng đã nhập)</option>
            </select>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Đang đồng bộ...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Áp Dụng & Đồng Bộ Tức Thì</span>
              </>
            )}
          </button>
        </div>
      </div>
    </FormModal>
  );
};
