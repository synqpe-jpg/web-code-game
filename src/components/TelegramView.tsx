import React, { useState, useEffect } from 'react';
import {
  Send,
  Users,
  Bell,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  Zap,
  Gift,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { telegramService, TelegramPublicConfig } from '../services/telegramService';
import { authService } from '../services/authService';

interface TelegramViewProps {
  onOpenAuth?: () => void;
  onOpenProfile?: () => void;
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

export const TelegramView: React.FC<TelegramViewProps> = ({
  onOpenAuth,
  onOpenProfile,
  onShowToast,
}) => {
  const [config, setConfig] = useState<TelegramPublicConfig>({
    enabled: false,
    bot_username: null,
    group_link: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    let mounted = true;
    telegramService.getConfig().then((cfg) => {
      if (mounted) {
        setConfig(cfg);
        setIsLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLinkBot = async () => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      if (onShowToast) {
        onShowToast('Cần Đăng Nhập', 'Vui lòng đăng nhập tài khoản trước khi liên kết Telegram.', 'info');
      }
      if (onOpenAuth) onOpenAuth();
      return;
    }

    const token = authService.getAuthToken();
    if (!token) {
      if (onOpenProfile) onOpenProfile();
      return;
    }

    setIsLinking(true);
    const res = await telegramService.generateLinkToken(token);
    setIsLinking(false);

    if (res.success && res.link_url) {
      window.open(res.link_url, '_blank', 'noopener,noreferrer');
    } else {
      if (config.bot_username) {
        window.open(`https://t.me/${config.bot_username}`, '_blank', 'noopener,noreferrer');
      } else if (onShowToast) {
        onShowToast('Lỗi Liên Kết', res.error || 'Chưa thể tạo liên kết lúc này.', 'error');
      }
    }
  };

  const groupUrl = config.group_link || 'https://t.me/codegameshop';
  const botUrl = config.bot_username ? `https://t.me/${config.bot_username}` : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-300">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Banner Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-sky-500/30 bg-gradient-to-b from-sky-950/40 via-slate-900/80 to-slate-950 p-6 sm:p-10 text-center shadow-2xl backdrop-blur-md">
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs sm:text-sm font-bold mb-4 shadow-sm">
            <Send className="w-4 h-4 text-sky-400 animate-pulse" />
            <span>KÊNH THÔNG BÁO & NHÓM THẢO LUẬN TELEGRAM</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Cộng Đồng Game Thủ <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400">CodeGame.Shop</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto mt-3 leading-relaxed font-normal">
            Nhận thông báo Giftcode mới nhất, theo dõi sự kiện hot kịp hạn và nhận mã riêng tư tự động gửi về tài khoản Telegram của bạn.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-8">
            <a
              href={groupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-black text-sm transition-all shadow-lg shadow-sky-500/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Users className="w-5 h-5 text-slate-950" />
              <span>Tham Gia Nhóm Telegram</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              onClick={handleLinkBot}
              disabled={isLinking}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-850 text-sky-400 hover:text-sky-300 border border-sky-500/30 hover:border-sky-500/50 font-bold text-sm transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <Bell className="w-5 h-5" />
              <span>{isLinking ? 'Đang Tạo Link...' : 'Liên Kết Bot Nhận Tin Riêng'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3 Trụ Cột Hoạt Động (Theo Mục 3.1) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cột 1: Nhóm Telegram */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-4 shadow-lg backdrop-blur-sm relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">1. Nhóm Thảo Luận & Thông Báo Chung</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Kênh sinh hoạt chung dành cho toàn bộ thành viên. Nơi bot tự động đăng tải bài viết tổng hợp Giftcode vừa ra mắt, sự kiện game hấp dẫn và các đợt phát mã số lượng lớn.
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Cập nhật mã quà tặng công khai đã kiểm chứng thực tế.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Bấm mã để sao chép nhanh trực tiếp trong ứng dụng Telegram.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Thảo luận kinh nghiệm chơi game cùng cộng đồng.</span>
              </li>
            </ul>
          </div>

          {/* Cột 2: Bot Nhắn Tin Riêng */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-4 shadow-lg backdrop-blur-sm relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">2. Bot Nhắn Tin Riêng (Direct Message)</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Trợ lý cá nhân hóa giúp bạn không bỏ lỡ quà tặng của đúng những tựa game bạn đang chơi, không bị làm phiền bởi các game không liên quan.
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>Nhận thông báo riêng khi tựa game bạn theo dõi có mã mới.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>Khung giờ văn minh (09:00 - 22:00), không quấy rầy ban đêm.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>Tùy chỉnh bật/tắt nhận mã, sự kiện hoặc dừng nhận bất kỳ lúc nào.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Cột 3: Bảng Hướng Dẫn Lệnh Bot */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-6 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">3. Bảng Lệnh Thao Tác Với Bot</h3>
              <p className="text-xs text-slate-400">Bạn có thể gửi các lệnh sau trực tiếp cho Bot trong khung chat Telegram</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1">
              <div className="font-mono text-sm font-bold text-sky-400">/theodoi &lt;slug-game&gt;</div>
              <div className="text-xs text-slate-300">Đăng ký nhận thông báo riêng cho 1 tựa game.</div>
              <div className="text-[11px] text-slate-500 font-mono">Ví dụ: /theodoi genshin-impact</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1">
              <div className="font-mono text-sm font-bold text-sky-400">/huytheodoi &lt;slug-game&gt;</div>
              <div className="text-xs text-slate-300">Bỏ theo dõi và ngừng nhận tin về tựa game đó.</div>
              <div className="text-[11px] text-slate-500 font-mono">Ví dụ: /huytheodoi genshin-impact</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1">
              <div className="font-mono text-sm font-bold text-sky-400">/danhsach</div>
              <div className="text-xs text-slate-300">Xem toàn bộ danh sách các tựa game bạn đang theo dõi.</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1">
              <div className="font-mono text-sm font-bold text-sky-400">/dung</div>
              <div className="text-xs text-slate-300">Dừng toàn bộ thông báo riêng từ bot ngay lập tức.</div>
            </div>
          </div>
        </div>

        {/* Chân Trang Cam Kết Bảo Mật */}
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>CodeGame.Shop cam kết bảo mật thông tin tài khoản và không gửi tin nhắn rác.</span>
          </div>
          <a
            href="/"
            className="text-sky-400 hover:text-sky-300 font-bold transition-colors shrink-0"
          >
            Quay Về Trang Chủ →
          </a>
        </div>
      </div>
    </div>
  );
};
