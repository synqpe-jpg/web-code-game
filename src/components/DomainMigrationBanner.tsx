import React, { useState, useEffect } from 'react';
import { Sparkles, X, CheckCircle2 } from 'lucide-react';

export const DomainMigrationBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('wcg_dismissed_store_migration_notice');
      if (!dismissed) {
        setIsVisible(true);
      }
    } catch {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem('wcg_dismissed_store_migration_notice', 'true');
    } catch {}
  };

  if (!isVisible) return null;

  return (
    <div className="relative z-50 bg-gradient-to-r from-amber-600/95 via-brand-600/95 to-amber-600/95 text-white px-3 sm:px-4 py-2 border-b border-amber-400/40 shadow-lg backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="p-1 rounded-full bg-white/20 shrink-0 text-amber-200">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin-slow" />
          </span>
          <p className="font-medium truncate sm:whitespace-normal">
            <strong className="font-extrabold text-amber-100 uppercase tracking-wide mr-1.5">
              Thông Báo Chuyển Đổi:
            </strong>
            <span className="text-white/95">
              Hệ thống <span className="font-bold underline decoration-amber-300">codegame.store</span> đã chính thức chuyển về tên miền duy nhất <span className="font-bold underline decoration-brand-300">codegame.shop</span>.
            </span>
            <span className="hidden md:inline ml-2 text-emerald-200 font-semibold items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 inline mr-0.5" />
              Tài khoản &amp; số dư ví của quý khách được bảo lưu nguyên vẹn 100%!
            </span>
          </p>
        </div>

        <button
          onClick={handleDismiss}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/20 hover:bg-black/30 border border-white/20 text-white font-bold text-xs transition-all active:scale-95"
          title="Đóng thông báo"
        >
          <span className="hidden sm:inline">Đã hiểu</span>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
