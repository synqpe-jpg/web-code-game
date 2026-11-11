import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Sparkles,
  Copy,
  Check,
  ArrowLeft,
  Flame,
  Gamepad2,
  ExternalLink,
  Gift,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { GameItem } from '../types/game';

interface TodayCodeItem {
  code: string;
  rewards?: string | null;
  expiry?: string | null;
  expires_at?: string | null;
}

interface TodayGameGroup {
  game_slug: string;
  game_name: string;
  game_icon?: string | null;
  publisher?: string | null;
  codes: TodayCodeItem[];
}

interface TodayCodesResponse {
  success: boolean;
  date?: string;
  formatted_date?: string;
  is_past_2230?: boolean;
  today?: string;
  expires_at_tonight?: string;
  total_codes?: number;
  total_games?: number;
  count?: number;
  games_count?: number;
  games: TodayGameGroup[];
  codes?: any[];
}

interface TodayCodesViewProps {
  onBackToHome: () => void;
  onSelectGame: (gameSlug: string) => void;
  onShowToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

export const TodayCodesView: React.FC<TodayCodesViewProps> = ({
  onBackToHome,
  onSelectGame,
  onShowToast,
}) => {
  const [data, setData] = useState<TodayCodesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCodes, setCopiedCodes] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isExpired: boolean }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  const fetchTodayCodes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/codes/today');
      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setData(json);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayCodes();
  }, []);

  // Countdown timer to 22:30 VN today
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      // Target: 22:30:00 today (local browser time, aligned with VN if user in VN)
      const target = new Date();
      target.setHours(22, 30, 0, 0);

      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setTimeLeft({ hours, minutes, seconds, isExpired: false });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (codeStr: string) => {
    navigator.clipboard.writeText(codeStr);
    setCopiedCodes((prev) => ({ ...prev, [codeStr]: true }));
    onShowToast('Đã sao chép', `Đã sao chép mã ${codeStr} vào bộ nhớ tạm!`, 'success');
    setTimeout(() => {
      setCopiedCodes((prev) => ({ ...prev, [codeStr]: false }));
    }, 2500);
  };

  const totalCodes =
    data?.total_codes ??
    data?.count ??
    data?.codes?.length ??
    data?.games?.reduce((acc, g) => acc + (g.codes?.length || 0), 0) ??
    0;

  const totalGames =
    data?.total_games ??
    data?.games_count ??
    data?.games?.length ??
    0;

  return (
    <div className="min-h-screen bg-slate-950 text-foreground pb-20 pt-4 sm:pt-8 animate-fade-in">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/40 text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về Trang Chủ</span>
          </button>

          <button
            type="button"
            onClick={fetchTodayCodes}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/80 text-muted-foreground hover:text-foreground text-xs font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Cập nhật</span>
          </button>
        </div>

        {/* Hero Banner Mã Hôm Nay */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-amber-500/15 via-rose-500/10 to-indigo-950/40 border border-amber-500/30 p-6 sm:p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2.5 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>MÃ HẠN NGÀY • CHỈ DÙNG HÔM NAY</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Giftcode Hôm Nay
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Tổng hợp toàn bộ mã quà tặng chỉ có hiệu lực trong ngày hôm nay. Mã sẽ hết hạn vào <strong className="text-amber-300">22:30 tối nay</strong>. Hãy tranh thủ nhập ngay vào game kẻo lỡ!
              </p>
            </div>

            {/* Countdown Box */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-amber-500/40 backdrop-blur-md flex flex-col items-center justify-center text-center shrink-0 min-w-[220px]">
              <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                {timeLeft.isExpired ? 'ĐÃ HẾT HẠN HÔM NAY' : 'HẾT HẠN SAU'}
              </span>

              {timeLeft.isExpired ? (
                <div className="text-sm font-bold text-rose-400 py-1">
                  Mã hôm nay đã đóng lúc 22:30
                </div>
              ) : (
                <div className="flex items-center gap-2 font-mono font-black text-2xl sm:text-3xl text-white">
                  <div className="flex flex-col items-center">
                    <span className="px-2 py-1 rounded-lg bg-card border border-border">
                      {String(timeLeft.hours).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] font-sans text-muted-foreground mt-0.5">Giờ</span>
                  </div>
                  <span className="text-amber-400 mb-3">:</span>
                  <div className="flex flex-col items-center">
                    <span className="px-2 py-1 rounded-lg bg-card border border-border">
                      {String(timeLeft.minutes).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] font-sans text-muted-foreground mt-0.5">Phút</span>
                  </div>
                  <span className="text-amber-400 mb-3">:</span>
                  <div className="flex flex-col items-center">
                    <span className="px-2 py-1 rounded-lg bg-card border border-border">
                      {String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] font-sans text-muted-foreground mt-0.5">Giây</span>
                  </div>
                </div>
              )}

              <span className="text-[10px] text-muted-foreground mt-2">
                {data ? `${totalCodes} mã từ ${totalGames} tựa game` : 'Đang đồng bộ...'}
              </span>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Đang tìm các mã có hạn dùng hôm nay...</p>
          </div>
        ) : !data || data.games.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-card border border-border/80 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <Gift className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-lg font-bold text-white">Hôm Nay Chưa Có Mã Ngày Mới</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Hiện tại chưa có mã nào gắn hạn chót trong ngày hôm nay. Hãy quay lại vào các khung giờ phát code sự kiện hoặc tra cứu kho mã vĩnh viễn/dài hạn tại Trang Chủ!
              </p>
            </div>
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition-all cursor-pointer active:scale-95 shadow-lg shadow-amber-500/20"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Xem Tất Cả Game & Giftcode</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Đang hiển thị {totalGames} tựa game có mã hôm nay</span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Mã công khai đã xác minh
              </span>
            </div>

            {/* List of Game Groups */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.games.map((grp) => (
                <div
                  key={grp.game_slug}
                  className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-4 shadow-sm"
                >
                  {/* Game Header */}
                  <div className="flex items-center gap-3">
                    <img
                      src={grp.game_icon || '/favicon.ico'}
                      alt={grp.game_name}
                      className="w-12 h-12 rounded-xl object-cover bg-slate-900 border border-border shrink-0"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/favicon.ico';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3
                        onClick={() => onSelectGame(grp.game_slug)}
                        className="font-heading font-bold text-sm sm:text-base text-foreground truncate cursor-pointer hover:text-amber-400 transition-colors"
                        title={grp.game_name}
                      >
                        {grp.game_name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {grp.publisher || 'Nhà phát hành chính thức'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectGame(grp.game_slug)}
                      className="p-2 rounded-xl bg-slate-900/60 hover:bg-amber-500/20 text-muted-foreground hover:text-amber-400 border border-border/60 transition-all cursor-pointer active:scale-90"
                      title="Xem toàn bộ mã của game"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* List of codes for this game */}
                  <div className="space-y-2">
                    {grp.codes.map((c) => {
                      const isCopied = Boolean(copiedCodes[c.code]);
                      return (
                        <div
                          key={c.code}
                          className="p-2.5 rounded-xl bg-slate-950/60 border border-border/60 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-amber-300 tracking-wider">
                                {c.code}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-sm bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0">
                                Hôm nay
                              </span>
                            </div>
                            {c.rewards && (
                              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                                🎁 {c.rewards}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopy(c.code)}
                            className={`h-7 px-3 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0 ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40'
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                <span>Đã chép</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Chép</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
