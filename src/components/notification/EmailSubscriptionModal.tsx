import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Bell,
  CheckCircle2,
  Gift,
  Flame,
  Gamepad2,
  Trash2,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { dataService } from '../../services/dataService';
import type { UserProfile, GameItem } from '../../types/game';

interface EmailSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  targetGameSlug?: string; // Nếu mở từ nút chuông của game cụ thể
  targetGameName?: string;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

export const EmailSubscriptionModal: React.FC<EmailSubscriptionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  targetGameSlug,
  targetGameName,
  onShowToast,
}) => {
  const [email, setEmail] = useState('');
  const [notifyFollowedCodes, setNotifyFollowedCodes] = useState(true);
  const [notifyGiveaways, setNotifyGiveaways] = useState(true);
  const [notifySales, setNotifySales] = useState(true);
  const [subscribedGames, setSubscribedGames] = useState<string[]>([]);
  const [allGames, setAllGames] = useState<GameItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [hasExistingSub, setHasExistingSub] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Tải danh sách tất cả game để hiển thị tên game từ slug
    const games = dataService.getGames();
    setAllGames(games);

    // Tải subscription hiện tại
    const current = notificationService.getSubscription();
    if (current && current.email) {
      setEmail(current.email);
      setNotifyFollowedCodes(current.notifyFollowedCodes);
      setNotifyGiveaways(current.notifyGiveaways);
      setNotifySales(current.notifySales);
      let list = current.subscribedGames || [];
      if (targetGameSlug && !list.includes(targetGameSlug)) {
        list = [...list, targetGameSlug];
      }
      setSubscribedGames(list);
      setHasExistingSub(Boolean(current.isActive));
    } else {
      if (currentUser?.email) {
        setEmail(currentUser.email);
      }
      if (targetGameSlug) {
        setSubscribedGames([targetGameSlug]);
      }
      setHasExistingSub(false);
    }
  }, [isOpen, currentUser, targetGameSlug]);

  if (!isOpen) return null;

  const handleRemoveGame = (slugToRemove: string) => {
    setSubscribedGames((prev) => prev.filter((s) => s !== slugToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      onShowToast('Email không hợp lệ', 'Vui lòng nhập địa chỉ email hợp lệ để nhận thông báo.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const res = await notificationService.saveSubscription({
        email: cleanEmail,
        userId: currentUser?.id || null,
        notifyFollowedCodes,
        notifyGiveaways,
        notifySales,
        subscribedGames,
        isActive: true,
      });

      if (res.success) {
        onShowToast('Thành công', res.message || 'Đã lưu cài đặt nhận thông báo email!', 'success');
        onClose();
      } else {
        onShowToast('Không thành công', res.message || 'Lỗi lưu thông tin', 'error');
      }
    } catch {
      onShowToast('Lỗi', 'Không thể kết nối đến máy chủ, vui lòng thử lại sau.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy nhận toàn bộ thông báo email từ CodeGame.shop?')) {
      return;
    }
    setIsUnsubscribing(true);
    try {
      await notificationService.unsubscribeAll();
      onShowToast('Đã hủy', 'Đã hủy đăng ký nhận thông báo email.', 'info');
      onClose();
    } catch {
      onShowToast('Lỗi', 'Có lỗi xảy ra, vui lòng thử lại.', 'error');
    } finally {
      setIsUnsubscribing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-lg bg-card border border-border/80 rounded-2xl sm:rounded-3xl shadow-cyber-card overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary shadow-sm">
              <Bell className="w-5 h-5 animate-bounce-subtle" />
            </div>
            <div>
              <h3 className="font-heading font-black text-sm sm:text-base text-foreground flex items-center gap-1.5">
                <span>Nhận Thông Báo Code & Sự Kiện</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  MIỄN PHÍ
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nhận tin tức tức thì qua Email, không lo bỏ lỡ mã quà tặng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Target Game Banner nếu mở từ game cụ thể */}
          {targetGameSlug && (
            <div className="p-3 rounded-xl bg-secondary/10 border border-secondary/30 flex items-center gap-3">
              <Gamepad2 className="w-5 h-5 text-secondary shrink-0" />
              <div className="text-xs">
                <span className="text-muted-foreground">Bạn đang đăng ký theo dõi game: </span>
                <strong className="text-secondary font-bold">{targetGameName || targetGameSlug}</strong>
              </div>
            </div>
          )}

          {/* Email Input */}
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              Địa Chỉ Email Nhận Thông Báo <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vidu: hotro@gmail.com"
                className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-secondary transition-all"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Cam kết bảo mật 100%, không spam, có link hủy đăng ký 1 chạm.
            </p>
          </div>

          {/* Granular Checkboxes */}
          <div className="space-y-2.5 pt-1">
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider text-slate-300">
              Chọn Loại Thông Báo Bạn Muốn Nhận:
            </label>

            {/* Option 1: Code mới theo game */}
            <div
              onClick={() => setNotifyFollowedCodes(!notifyFollowedCodes)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                notifyFollowedCodes
                  ? 'bg-secondary/10 border-secondary/40 shadow-sm'
                  : 'bg-muted/20 border-border/60 hover:bg-muted/40'
              }`}
            >
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  checked={notifyFollowedCodes}
                  onChange={(e) => setNotifyFollowedCodes(e.target.checked)}
                  className="rounded border-border text-secondary focus:ring-0 cursor-pointer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-foreground">
                  <Gamepad2 className="w-4 h-4 text-emerald-400" />
                  <span>Mã Giftcode Mới Của Game Đang Theo Dõi</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Tự động gửi email ngay khi hệ thống vừa thu thập mã giftcode mới của các tựa game bạn quan tâm.
                </p>
              </div>
            </div>

            {/* Subscribed Games Tags (nếu bật option 1) */}
            {notifyFollowedCodes && (
              <div className="pl-4 pr-1 py-1">
                <div className="text-[11px] font-bold text-slate-400 mb-1.5">
                  Các game đang theo dõi ({subscribedGames.length}):
                </div>
                {subscribedGames.length === 0 ? (
                  <p className="text-[11px] text-amber-400/90 italic">
                    Chưa chọn game nào. Bạn hãy bấm vào nút quả chuông tại trang chi tiết bất kỳ game nào để theo dõi.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {subscribedGames.map((slug) => {
                      const g = allGames.find((item) => item.slug === slug || item.id === slug);
                      const name = g?.name || slug;
                      return (
                        <span
                          key={slug}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-secondary/15 text-secondary border border-secondary/30"
                        >
                          <span className="truncate max-w-[150px]">{name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveGame(slug);
                            }}
                            className="text-secondary/70 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Bỏ theo dõi game này"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Option 2: Giveaway Alerts */}
            <div
              onClick={() => setNotifyGiveaways(!notifyGiveaways)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                notifyGiveaways
                  ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                  : 'bg-muted/20 border-border/60 hover:bg-muted/40'
              }`}
            >
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  checked={notifyGiveaways}
                  onChange={(e) => setNotifyGiveaways(e.target.checked)}
                  className="rounded border-border text-amber-500 focus:ring-0 cursor-pointer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-foreground">
                  <Gift className="w-4 h-4 text-amber-400" />
                  <span>Sự Kiện Phát Code Miễn Phí (Giờ G)</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Nhận email nhắc hẹn trước 1 tiếng và khi cổng phát mã VIP mở để không bỏ lỡ đợt quà tặng giới hạn.
                </p>
              </div>
            </div>

            {/* Option 3: Sales & Flash Sales */}
            <div
              onClick={() => setNotifySales(!notifySales)}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                notifySales
                  ? 'bg-rose-500/10 border-rose-500/40 shadow-sm'
                  : 'bg-muted/20 border-border/60 hover:bg-muted/40'
              }`}
            >
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  checked={notifySales}
                  onChange={(e) => setNotifySales(e.target.checked)}
                  className="rounded border-border text-rose-500 focus:ring-0 cursor-pointer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-foreground">
                  <Flame className="w-4 h-4 text-rose-400" />
                  <span>Khuyến Mãi & Flash Sale Giảm Giá Giờ Vàng</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Thông báo khi các gói nạp hoặc tiện ích được hạ giá sâu hoặc có mã voucher giảm giá toàn sàn.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
            {hasExistingSub ? (
              <button
                type="button"
                disabled={isUnsubscribing}
                onClick={handleUnsubscribe}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hủy Đăng Ký</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-secondary to-blue-600 hover:from-secondary/90 hover:to-blue-500 shadow-neon-teal transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Đang Lưu...' : 'Lưu Cài Đặt'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
