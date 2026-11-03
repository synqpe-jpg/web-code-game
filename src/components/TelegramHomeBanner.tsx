import React, { useState, useEffect } from 'react';
import { Send, Users, Bell, ExternalLink, ArrowRight } from 'lucide-react';
import { telegramService, TelegramPublicConfig } from '../services/telegramService';
import { authService } from '../services/authService';

interface TelegramHomeBannerProps {
  onOpenAuth?: () => void;
  onOpenProfile?: () => void;
}

export const TelegramHomeBanner: React.FC<TelegramHomeBannerProps> = ({
  onOpenAuth,
  onOpenProfile,
}) => {
  const [config, setConfig] = useState<TelegramPublicConfig>({
    enabled: false,
    bot_username: null,
    group_link: null,
  });

  useEffect(() => {
    let mounted = true;
    telegramService.getConfig().then((cfg) => {
      if (mounted) setConfig(cfg);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLinkBot = async () => {
    const user = authService.getCurrentUser();
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    const token = authService.getAuthToken();
    if (!token) {
      if (onOpenProfile) onOpenProfile();
      return;
    }
    const res = await telegramService.generateLinkToken(token);
    if (res.success && res.link_url) {
      window.open(res.link_url, '_blank', 'noopener,noreferrer');
    } else if (config.bot_username) {
      window.open(`https://t.me/${config.bot_username}`, '_blank', 'noopener,noreferrer');
    }
  };

  const groupLink = config.group_link || 'https://t.me/codegameshop';

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-4">
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/25 bg-gradient-to-r from-sky-950/40 via-slate-900/90 to-blue-950/40 p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md backdrop-blur-sm">
        {/* Glow effect */}
        <div className="absolute top-0 right-1/4 w-60 h-20 bg-sky-500/10 blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3.5 text-center sm:text-left">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 shadow-inner">
            <Send className="w-5 h-5 text-sky-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h4 className="text-sm sm:text-base font-black text-white tracking-tight">
                Nhóm Telegram CodeGame.Shop
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                Official
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Nhận mã mới, sự kiện hot và nhắc hết hạn quà tặng tự động cùng cộng đồng game thủ.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-center sm:justify-end">
          <a
            href={groupLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98]"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Tham Gia Nhóm</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={handleLinkBot}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-sky-300 border border-sky-500/30 font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Liên Kết Bot</span>
          </button>
        </div>
      </div>
    </div>
  );
};
