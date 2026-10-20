import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Gift,
  Sparkles,
  Flame,
  CheckCircle2,
  Copy,
  Check,
  Layers,
  History,
  X,
  LogIn,
  Share2,
  User,
  Globe,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Info,
  Calendar,
  ChevronRight,
  Search,
  Zap,
  Download,
  HelpCircle,
  Crown,
  ChevronDown,
  ChevronUp,
  PackageCheck,
  Box,
  Users,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CyberLoader } from './CyberLoader';
import { dataService } from '../services/dataService';
import { marketingService } from '../services/marketingService';
import type { GiveawayCampaign, ClaimedCodeRecord, UserProfile, GiveawayRewardPackage } from '../types/game';
import { groupGiveawaysByGame, getGiveawayPackages } from '../utils/productPackageUtils';
import { formatRelativeDate, formatFullDateTime } from '../utils/textUtils';
import { EventCountdownBadge } from './countdown/EventCountdownBadge';
import { useEventCountdown } from '../hooks/useEventCountdown';
import { eventSchedulerService } from '../services/eventSchedulerService';

interface GiveawaysViewProps {
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onSelectGameSlug: (slug: string) => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onShareGiveaway?: (campaign: GiveawayCampaign, e: React.MouseEvent) => void;
  initialGiveawayId?: string | null;
  onClearInitialGiveawayId?: () => void;
}

/**
 * Component hiển thị Phòng chờ & Bộ đếm người đang chờ trực tiếp
 */
const LiveWaitingRoomBadge: React.FC<{
  minUsers?: number;
  maxUsers?: number;
  className?: string;
  variant?: 'card' | 'modal';
}> = ({ minUsers = 25, maxUsers = 85, className = '', variant = 'card' }) => {
  const min = Math.max(1, minUsers || 25);
  const max = Math.max(min + 1, maxUsers || 85);
  const mid = Math.floor((min + max) / 2);

  const [count, setCount] = useState<number>(() => {
    return mid + Math.floor((Math.sin(Date.now() / 10000) * (max - min)) / 4);
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCount((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        const next = prev + delta;
        return Math.min(max, Math.max(min, next));
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [min, max]);

  if (variant === 'modal') {
    return (
      <div className={`p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-between text-xs ${className}`}>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
          </span>
          <span className="font-semibold text-teal-300">Phòng chờ trực tuyến:</span>
        </div>
        <span className="font-mono font-bold text-teal-400 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          <span>{count} người đang chờ</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30 ${className}`}>
      <span className="relative flex h-1.5 w-1.5 mr-0.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-500"></span>
      </span>
      <Users className="w-3 h-3 text-teal-400" />
      <span>{count} người đang chờ</span>
    </div>
  );
};

/**
 * Component hiển thị đếm ngược mở mã tiếp theo trên Card
 */
const GlobalReleaseBadge: React.FC<{
  campaign: GiveawayCampaign;
  onExpire?: () => void;
  className?: string;
}> = ({ campaign, onExpire, className = '' }) => {
  const globalSec = Number(campaign.global_cooldown_seconds || 0);
  const lastClaimAt = campaign.last_global_claim_at;
  const targetDate = React.useMemo(() => {
    if (globalSec <= 0 || !lastClaimAt) return null;
    const lastMs = new Date(lastClaimAt).getTime();
    if (isNaN(lastMs)) return null;
    return new Date(lastMs + globalSec * 1000).toISOString();
  }, [globalSec, lastClaimAt]);

  const { minutes, seconds, isExpired } = useEventCountdown(targetDate, onExpire);

  if (globalSec <= 0 || !targetDate || isExpired) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border backdrop-blur-md bg-gradient-to-r from-amber-950/80 via-orange-950/80 to-yellow-950/80 border-amber-500/40 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)] ${className}`}>
      <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
      <span className="text-[11px] opacity-80">Mã tiếp theo:</span>
      <span className="font-mono font-bold tracking-wider text-amber-300">
        {pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
};

/**
 * Component hiển thị đếm ngược mở mã tiếp theo trong Modal
 */
const ModalGlobalCooldownSection: React.FC<{
  campaign: GiveawayCampaign;
  onExpire: () => void;
}> = ({ campaign, onExpire }) => {
  const globalSec = Number(campaign.global_cooldown_seconds || 0);
  const lastClaimAt = campaign.last_global_claim_at;
  const targetDate = React.useMemo(() => {
    if (globalSec <= 0 || !lastClaimAt) return null;
    const lastMs = new Date(lastClaimAt).getTime();
    if (isNaN(lastMs)) return null;
    return new Date(lastMs + globalSec * 1000).toISOString();
  }, [globalSec, lastClaimAt]);

  const { minutes, seconds, isExpired } = useEventCountdown(targetDate, onExpire);

  if (globalSec <= 0 || !targetDate || isExpired) return null;

  const pad = (n: number) => String(n).padStart(2, '0');
  const waitText = `${pad(minutes)}:${pad(seconds)}`;

  return (
    <div className="space-y-3">
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/70 via-orange-950/70 to-red-950/70 border border-amber-500/40 text-center space-y-2.5 shadow-lg">
        <div className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1.5">
          <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>Mã Kế Tiếp Mở Cho Toàn Web Sau:</span>
        </div>
        <div className="text-3xl font-mono font-black text-amber-300 tracking-widest drop-shadow-md">
          {waitText}
        </div>
        {campaign.enable_waiting_room !== false && (
          <div className="pt-1 flex justify-center">
            <LiveWaitingRoomBadge
              minUsers={campaign.waiting_users_min}
              maxUsers={campaign.waiting_users_max}
              variant="card"
            />
          </div>
        )}
        <p className="text-[11px] text-amber-200/80 leading-relaxed max-w-sm mx-auto">
          {(() => {
            const lastUser = campaign.last_claimer_name || 'người chơi trước';
            const template =
              campaign.custom_cooldown_msg ||
              'Đợt phát trước đạo hữu {last_user} đã nhanh tay đi trước, đạo hữu vui lòng đợi {time_left} rồi thử sức lại.';
            return template
              .replace(/\{last_user\}|\{claimer\}|\{last_claimer\}|\{last_claimer_name\}|\{user\}/gi, lastUser)
              .replace(/\{time_left\}|\{seconds\}|\{sec\}/gi, waitText);
          })()}
        </p>
      </div>

      <button
        disabled
        className="w-full py-3.5 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed"
      >
        <Clock className="w-4 h-4 text-amber-400" />
        <span>Đang Chờ Đợt Mã Tiếp Theo ({waitText})</span>
      </button>
    </div>
  );
};



/**
 * Web Audio API synthesizer for instant arcade victory chime
 */
const playClaimVictorySound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.08 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.36);
    });
  } catch {}
};

export const GiveawaysView: React.FC<GiveawaysViewProps> = ({
  onShowToast,
  onSelectGameSlug,
  currentUser,
  onOpenAuth,
  onShareGiveaway,
  initialGiveawayId,
  onClearInitialGiveawayId,
}) => {
  const [giveaways, setGiveaways] = useState<GiveawayCampaign[]>([]);
  const [claimedList, setClaimedList] = useState<ClaimedCodeRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'my_codes'>('campaigns');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [cmsIntro, setCmsIntro] = useState(() => dataService.getContentByKey('giveaway_section'));
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [detailModalCampaign, setDetailModalCampaign] = useState<GiveawayCampaign | null>(null);
  const [claimedRewardModal, setClaimedRewardModal] = useState<{
    campaign: GiveawayCampaign;
    code: string;
    isNew?: boolean;
    isAdminBypass?: boolean;
  } | null>(null);
  const [limitNoticeModal, setLimitNoticeModal] = useState<{
    campaign: GiveawayCampaign;
    message: string;
    existingCodes: ClaimedCodeRecord[];
  } | null>(null);

  // New interactive states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'available' | 'hot' | 'mine'>('all');
  const [isRedeemGuideOpen, setIsRedeemGuideOpen] = useState(false);

  const [isUnboxing, setIsUnboxing] = useState(false);

  const loadData = () => {
    const list = dataService.getGiveaways();
    setGiveaways(list);
    const myCodes = dataService.getClaimedCodes();
    setClaimedList(myCodes);
    setCmsIntro(dataService.getContentByKey('giveaway_section'));
  };

  useEffect(() => {
    loadData();
    dataService.syncWithCloudflareKV();
    const unsub = dataService.subscribe(() => {
      loadData();
    });
    const handleUpdate = () => {
      loadData();
    };
    const unsubStock = marketingService.subscribeStockChange(handleUpdate);
    const unsubSold = marketingService.subscribeSoldCountChange(handleUpdate);
    window.addEventListener('wcg_admin_data_updated', handleUpdate);
    window.addEventListener('wcg_virtual_stock_updated', handleUpdate);
    window.addEventListener('wcg_sold_count_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      unsub();
      unsubStock();
      unsubSold();
      window.removeEventListener('wcg_admin_data_updated', handleUpdate);
      window.removeEventListener('wcg_virtual_stock_updated', handleUpdate);
      window.removeEventListener('wcg_sold_count_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleCloseDetailModal = () => {
    setDetailModalCampaign(null);
    onClearInitialGiveawayId?.();
    try {
      if (window.location.hash.includes('gw=') || window.location.hash.includes('giveaway=')) {
        window.history.replaceState(null, '', window.location.pathname + '#giveaways');
      }
    } catch {}
  };

  // Deep link auto-open campaign modal
  useEffect(() => {
    const checkTargetGiveaway = () => {
      const hash = window.location.hash;
      const search = window.location.search;
      const path = window.location.pathname;
      const urlParams = new URLSearchParams(search);

      const targetId =
        initialGiveawayId ||
        urlParams.get('gw') ||
        urlParams.get('giveaway') ||
        (hash.includes('gw=') ? hash.split(/gw=/i)[1]?.split('&')[0] : null) ||
        (hash.includes('giveaway=') ? hash.split(/giveaway=/i)[1]?.split('&')[0] : null) ||
        (path.startsWith('/giveaways/') ? path.replace(/^\/giveaways\//i, '').split('/')[0] : null) ||
        (path.startsWith('/giveaway/') ? path.replace(/^\/giveaway\//i, '').split('/')[0] : null);

      if (targetId && giveaways.length > 0) {
        const cleanId = decodeURIComponent(targetId).trim().toLowerCase();
        const found = giveaways.find(
          (g) => g.id.toLowerCase() === cleanId || (g.game_slug && g.game_slug.toLowerCase() === cleanId)
        );
        if (found) {
          setDetailModalCampaign(found);
          setActiveTab('campaigns');
        }
      }
    };

    checkTargetGiveaway();
    window.addEventListener('hashchange', checkTargetGiveaway);
    window.addEventListener('popstate', checkTargetGiveaway);
    return () => {
      window.removeEventListener('hashchange', checkTargetGiveaway);
      window.removeEventListener('popstate', checkTargetGiveaway);
    };
  }, [giveaways, initialGiveawayId]);



  const isAdmin = Boolean(
    currentUser &&
      (currentUser.role === 'admin' ||
        currentUser.role === 'SUPER_ADMIN' ||
        (currentUser as any).role === 'ADMIN' ||
        currentUser.username === 'admin' ||
        currentUser.username === 'admin290200' ||
        currentUser.id === 'usr_admin')
  );

  const handleClaim = async (campaign: GiveawayCampaign) => {
    if (!currentUser) {
      onOpenAuth();
      onShowToast('Cần đăng nhập', 'Vui lòng đăng nhập hoặc đăng ký tài khoản để giật mã quà tặng miễn phí.', 'info');
      return;
    }
    if (claimingId) return;
    setClaimingId(campaign.id);

    try {
      const res = await dataService.claimGiveaway(campaign.id);
      setClaimingId(null);
      setDetailModalCampaign(null);

      // Refresh list to pick up any stored code
      const freshClaimedList = dataService.getClaimedCodes();
      setClaimedList(freshClaimedList);

      if (!res.success) {
        if ((res as any).errorCode === 'GLOBAL_COOLDOWN_ACTIVE') {
          onShowToast('Đang chờ đợt mã tiếp theo', res.message || 'Mã vừa được giật bởi người chơi khác! Vui lòng chờ đợt mở kế tiếp.', 'info');
          loadData();
          return;
        }

        const myPrevClaims = freshClaimedList.filter((c) => c.campaign_id === campaign.id);
        const myPrevCode = res.code || (myPrevClaims.length > 0 ? myPrevClaims[0].code_value : null);
        if ((res.alreadyClaimed || myPrevClaims.length > 0) && myPrevCode) {
          setClaimedRewardModal({
            campaign,
            code: myPrevCode,
            isNew: false,
            isAdminBypass: res.isAdminBypass || isAdmin,
          });
          onShowToast('Mã quà tặng của bạn', `Bạn đã nhận mã này trước đó: ${myPrevCode}`, 'info');
        } else {
          onShowToast('Không thể nhận mã', res.message || 'Kho mã sự kiện hiện đã hết.', 'error');
        }
        loadData();
        return;
      }

      if (res.code) {
        if (res.isNewCode && !res.alreadyClaimed) {
          try {
            playClaimVictorySound();
            confetti({
              particleCount: 90,
              spread: 85,
              origin: { y: 0.6 },
              colors: ['#F43F5E', '#8B5CF6', '#10B981', '#F59E0B', '#38BDF8'],
            });
          } catch {}

          setIsUnboxing(true);
          setTimeout(() => setIsUnboxing(false), 900);

          setClaimedRewardModal({
            campaign,
            code: res.code,
            isNew: true,
            isAdminBypass: res.isAdminBypass || isAdmin,
          });

          onShowToast(
            res.isAdminBypass || isAdmin
              ? '👑 [Admin Mode] Giật mã mới thành công!'
              : '🎉 Giật code thành công!',
            res.message || `Mã mới của bạn: ${res.code}`,
            'success'
          );
        } else {
          // Already claimed code: No victory chime, no confetti, no unboxing
          setClaimedRewardModal({
            campaign,
            code: res.code,
            isNew: false,
            isAdminBypass: res.isAdminBypass || isAdmin,
          });

          onShowToast(
            'Mã quà tặng của bạn',
            `Đây là mã bạn đã nhận trước đó: ${res.code}`,
            'info'
          );
        }
        loadData();
      }
    } catch (err: any) {
      setClaimingId(null);
      onShowToast('Lỗi nhận mã', err?.message || 'Có lỗi xảy ra, vui lòng thử lại sau.', 'error');
    } finally {
      setClaimingId(null);
    }
  };

  const handleOpenLimitNotice = (campaign: GiveawayCampaign, customMsg?: string) => {
    const existing = claimedList.filter((c) => c.campaign_id === campaign.id);
    const maxUser = campaign.max_per_user || 1;
    let msg = customMsg;
    if (!msg) {
      if (existing.length >= maxUser) {
        msg = `Bạn đã nhận tối đa ${existing.length}/${maxUser} lượt giftcode cho sự kiện này. Mỗi tài khoản chỉ được nhận theo đúng hạn ngạch quy định.`;
      } else {
        msg = `Chưa đủ điều kiện tham gia sự kiện này. Vui lòng kiểm tra các điều kiện yêu cầu bên dưới.`;
      }
    }
    setLimitNoticeModal({
      campaign,
      message: msg,
      existingCodes: existing,
    });
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    onShowToast('Đã sao chép mã!', code, 'success');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyAllCodes = () => {
    if (claimedList.length === 0) return;
    const text =
      claimedList
        .map(
          (c, idx) =>
            `${idx + 1}. [${c.game_name}] Mã: ${c.code_value} | Thưởng: ${c.rewards} (Nhận: ${formatFullDateTime(c.claimed_at)})`
        )
        .join('\n') + '\n\n📌 Nguồn: CodeGame.shop - Săn Giftcode VIP Miễn Phí tại https://codegame.shop';
    navigator.clipboard.writeText(text);
    onShowToast('Đã sao chép tất cả mã!', `Đã chép toàn bộ ${claimedList.length} giftcode vào clipboard.`, 'success');
  };

  const handleExportTxtFile = () => {
    if (claimedList.length === 0) return;
    const header = `=== DANH SÁCH GIFTCODE ĐÃ SĂN - CODEGAME.SHOP ===\nThời gian xuất: ${new Date().toLocaleString('vi-VN')}\nTổng số mã: ${claimedList.length}\nTra cứu thêm mã mới: https://codegame.shop\n\n`;
    const body = claimedList
      .map(
        (c, idx) =>
          `[MÃ #${idx + 1}]\nGame: ${c.game_name}\nMã Code: ${c.code_value}\nPhần Thưởng: ${c.rewards}\nThời Gian Nhận: ${formatFullDateTime(c.claimed_at)}\n----------------------------------------`
      )
      .join('\n\n');
    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `giftcodes_da_san_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('Đã tải file .txt', 'Danh sách giftcode đã được lưu vào máy của bạn.', 'success');
  };

  // Filter & sort campaigns (Mặc định ưu tiên hàng còn lên trên đầu)
  const activeGiveaways = giveaways
    .filter((c) => {
      if (c.is_active === false) return false;
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (c.game_name || '').toLowerCase().includes(q);
        const matchTitle = (c.title || '').toLowerCase().includes(q);
        const matchReward = (c.rewards || '').toLowerCase().includes(q);
        if (!matchName && !matchTitle && !matchReward) return false;
      }
      // Category filter
      if (filterCategory === 'available') {
        const poolCount =
          Array.isArray(c.codes_pool) && c.codes_pool.length > 0
            ? c.codes_pool.length
            : (typeof c.remaining_codes === 'number' ? c.remaining_codes : 0);
        return poolCount > 0;
      }
      if (filterCategory === 'hot') {
        return (c.claimed_codes || 0) >= 5 || (c.show_claimed_count !== false);
      }
      if (filterCategory === 'mine') {
        return claimedList.some((my) => my.campaign_id === c.id);
      }
      return true;
    })
    .sort((a, b) => {
      const poolCountA =
        Array.isArray(a.codes_pool) && a.codes_pool.length > 0
          ? a.codes_pool.length
          : (typeof a.remaining_codes === 'number' ? a.remaining_codes : 0);
      const poolCountB =
        Array.isArray(b.codes_pool) && b.codes_pool.length > 0
          ? b.codes_pool.length
          : (typeof b.remaining_codes === 'number' ? b.remaining_codes : 0);

      const inStockA = poolCountA > 0 ? 1 : 0;
      const inStockB = poolCountB > 0 ? 1 : 0;

      // 1. Mặc định ưu tiên hàng còn lên trên đầu
      if (inStockA !== inStockB) {
        return inStockB - inStockA;
      }

      // 2. Nếu cùng còn hàng, ưu tiên số lượng còn nhiều hơn
      if (inStockA > 0 && poolCountA !== poolCountB) {
        return poolCountB - poolCountA;
      }

      // 3. Giữ thứ tự tạo mới nhất
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });

  return (
    <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-4 sm:py-10 space-y-4 sm:space-y-7 animate-fade-in">
      {/* Header Banner */}
      <div className="relative p-3.5 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-card via-card-hover to-card border border-border shadow-2xl overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1 sm:space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-accent/15 text-accent text-[11px] sm:text-xs font-semibold border border-accent/30">
              <Flame className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
              <span>{cmsIntro?.extraData?.badge || 'Sự Kiện Giật Code Giới Hạn'}</span>
            </div>
            <h1 className="font-display font-extrabold text-lg sm:text-4xl text-foreground">
              {cmsIntro?.title || 'Săn Giftcode Độc Quyền Miễn Phí'}
            </h1>
            <p className="text-[11px] sm:text-sm text-muted-foreground leading-relaxed line-clamp-2 sm:line-clamp-none">
              {cmsIntro?.content ||
                'Các chiến dịch phát code độc quyền số lượng có hạn tài trợ từ NPH và sự kiện cộng đồng CH Play. Kích hoạt trực tiếp ngay trong game.'}
            </p>

            {isAdmin && (
              <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-purple-500/15 border border-purple-500/40 text-purple-300 text-[11px] sm:text-xs font-bold mt-1">
                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Chế độ Admin: Bạn có thể giật thử nghiệm liên tục mã mới từ kho.</span>
              </div>
            )}
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-muted/70 border border-border shrink-0 self-stretch sm:self-auto">
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'campaigns'
                  ? 'bg-primary text-white shadow-glow-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Đang Mở ({giveaways.filter((c) => c.is_active !== false).length})</span>
            </button>
            <button
              onClick={() => setActiveTab('my_codes')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'my_codes'
                  ? 'bg-primary text-white shadow-glow-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Mã Đã Giật ({claimedList.length})</span>
            </button>
          </div>
        </div>
      </div>



      {/* Tab: Campaigns List */}
      {activeTab === 'campaigns' ? (
        <div className="space-y-4 sm:space-y-6">
          {/* Search and Category Filter Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
            {/* Quick Filter Chips */}
            <div className="relative flex-1 min-w-0 overflow-hidden w-full max-w-full">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full max-w-full">
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    filterCategory === 'all'
                      ? 'bg-primary text-white shadow-glow-primary'
                      : 'bg-muted/70 text-muted-foreground hover:text-foreground border border-border'
                  }`}
                >
                  Tất Cả ({giveaways.filter((c) => c.is_active !== false).length})
                </button>
                <button
                  onClick={() => setFilterCategory('available')}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    filterCategory === 'available'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-muted/70 text-muted-foreground hover:text-foreground border border-border'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Còn Mã Trong Kho</span>
                </button>
                <button
                  onClick={() => setFilterCategory('hot')}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    filterCategory === 'hot'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-muted/70 text-muted-foreground hover:text-foreground border border-border'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-amber-300" />
                  <span>Sự Kiện Hot</span>
                </button>
                <button
                  onClick={() => setFilterCategory('mine')}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    filterCategory === 'mine'
                      ? 'bg-accent text-white shadow-glow-accent'
                      : 'bg-muted/70 text-muted-foreground hover:text-foreground border border-border'
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Đã Nhận ({claimedList.length})</span>
                </button>
              </div>
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent sm:hidden z-10" />
            </div>

            {/* Search input */}
            <div className="relative min-w-[240px] md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo game, quà tặng..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-border text-base sm:text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Cards Grid */}
          {activeGiveaways.length === 0 ? (
            <div className="py-20 text-center rounded-3xl bg-card/60 border border-border p-8 space-y-4">
              <Gift className="w-14 h-14 mx-auto text-muted-foreground/30 animate-pulse" />
              <h3 className="font-heading font-bold text-lg text-foreground">
                {searchQuery ? 'Không tìm thấy đợt phát phù hợp' : 'Hiện tại chưa có đợt phát giftcode nào'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {searchQuery
                  ? 'Vui lòng thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc để xem toàn bộ sự kiện.'
                  : 'Các sự kiện và đợt phát mã quà tặng độc quyền sẽ được Ban Quản Trị cập nhật tại đây. Vui lòng quay lại sau!'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-glow-primary cursor-pointer"
                >
                  Xóa tìm kiếm
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
              {activeGiveaways.map((campaign) => {
                const poolCount =
                  Array.isArray(campaign.codes_pool) && campaign.codes_pool.length > 0
                    ? campaign.codes_pool.length
                    : (typeof campaign.remaining_codes === 'number' ? campaign.remaining_codes : 0);

                const displayRemaining = marketingService.getDisplayStock(campaign.id, poolCount);
                const displayClaimed =
                  campaign.show_claimed_count !== false
                    ? marketingService.getClaimedDisplay(campaign)
                    : campaign.claimed_codes || 0;
                const remaining = displayRemaining;

                const displayTotal = displayRemaining + displayClaimed;
                const percentClaimed =
                  displayTotal > 0
                    ? Math.min(100, Math.max(0, Math.round((displayClaimed / displayTotal) * 100)))
                    : displayRemaining <= 0
                    ? 100
                    : 0;

                const rawMaxPerUser = Number(campaign.max_per_user);
                const isUnlimitedUser = rawMaxPerUser === 0 || rawMaxPerUser >= 999999;
                const effectiveMaxPerUser = isUnlimitedUser ? 999999 : (rawMaxPerUser > 0 ? rawMaxPerUser : 1);

                const userCampaignClaims = claimedList.filter((c) => c.campaign_id === campaign.id);
                const userClaimCount = userCampaignClaims.length;

                // Multi-claim & Admin permission evaluation
                const canClaimMore = (isAdmin || isUnlimitedUser || userClaimCount < effectiveMaxPerUser) && remaining > 0;
                const isMaxReached = !canClaimMore && remaining > 0;

                // Cooldown calculation (bypassed for Admin)
                let cooldownRemainingMs = 0;
                const cooldownHours = isAdmin ? 0 : (Number(campaign.cooldown_hours) || 0);
                if (cooldownHours > 0 && userCampaignClaims.length > 0) {
                  const latestClaim = userCampaignClaims[0];
                  if (latestClaim && latestClaim.claimed_at) {
                    const lastClaimTime = new Date(latestClaim.claimed_at).getTime();
                    const cooldownMs = cooldownHours * 3600 * 1000;
                    cooldownRemainingMs = Math.max(0, lastClaimTime + cooldownMs - Date.now());
                  }
                }
                const isCooldownActive = cooldownRemainingMs > 0;
                const remH = Math.floor(cooldownRemainingMs / (1000 * 3600));
                const remM = Math.ceil((cooldownRemainingMs % (1000 * 3600)) / (1000 * 60));
                const cooldownWaitText = remH > 0 ? `${remH}h ${remM}m` : `${remM} phút`;

                // Account age calculation (bypassed for Admin)
                const minAccountAgeDays = isAdmin ? 0 : (Number(campaign.min_account_age_days) || 0);
                let userAgeDays = 0;
                let isAgeEligible = true;
                if (currentUser && minAccountAgeDays > 0) {
                  const userCreatedAt = currentUser.created_at || (currentUser as any).createdAt;
                  if (userCreatedAt) {
                    const userCreatedMs = new Date(userCreatedAt).getTime();
                    if (!isNaN(userCreatedMs)) {
                      userAgeDays = Math.floor((Date.now() - userCreatedMs) / (1000 * 60 * 60 * 24));
                      isAgeEligible = userAgeDays >= minAccountAgeDays;
                    }
                  }
                }

                // Time window calculation
                const nowMs = Date.now();
                const isNotStarted = campaign.start_time
                  ? !isNaN(new Date(campaign.start_time).getTime()) && nowMs < new Date(campaign.start_time).getTime()
                  : false;
                const isEnded =
                  (campaign.end_time
                    ? !isNaN(new Date(campaign.end_time).getTime()) && nowMs > new Date(campaign.end_time).getTime()
                    : false) ||
                  campaign.status === 'ENDED' ||
                  campaign.is_active === false;

                const isCardGlobalCooling = Boolean(
                  campaign.global_cooldown_seconds &&
                  campaign.global_cooldown_seconds > 0 &&
                  campaign.last_global_claim_at &&
                  (new Date(campaign.last_global_claim_at).getTime() + campaign.global_cooldown_seconds * 1000) > Date.now()
                );

                return (
                  <div
                    key={campaign.id}
                    onClick={() => setDetailModalCampaign(campaign)}
                    className="bg-card rounded-2xl border border-border/80 hover:border-accent/40 shadow-cyber-card p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 group cursor-pointer"
                  >
                    <div>
                      {/* Top Bar: Game info & Direct Share */}
                      <div className="flex items-center justify-between gap-2.5 mb-2.5">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectGameSlug(campaign.game_slug);
                          }}
                          className="flex items-center gap-2.5 cursor-pointer group-hover:opacity-90 min-w-0 flex-1"
                        >
                          <div className="w-11 h-11 rounded-xl bg-muted overflow-hidden shrink-0 border border-border shadow-sm">
                            <img
                              src={campaign.game_icon_url || `/game_icons/${campaign.game_slug}.webp`}
                              alt={campaign.game_name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = '/vite.svg';
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-heading font-bold text-sm text-foreground hover:text-primary-light transition-colors line-clamp-1">
                              {campaign.game_name}
                            </h4>
                            <span className="text-[11px] font-mono text-muted-foreground block truncate">
                              Hạn đến: {formatRelativeDate(campaign.end_time)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {onShareGiveaway && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onShareGiveaway(campaign, e);
                              }}
                              className="p-1.5 rounded-lg bg-muted/50 hover:bg-muted text-slate-400 hover:text-foreground border border-border/70 transition-all cursor-pointer active:scale-90"
                              title="Chia sẻ sự kiện săn mã này"
                              aria-label="Chia sẻ sự kiện giveaway"
                            >
                              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          )}
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/30 shrink-0">
                            Chính thức
                          </span>
                        </div>
                      </div>

                      {/* Campaign Title */}
                      <h3 className="font-heading font-bold text-base text-foreground mb-2 leading-snug">
                        {campaign.title}
                      </h3>

                      {/* Live Waiting Room Badge */}
                      {campaign.enable_waiting_room !== false && remaining > 0 && !isEnded && (
                        <div className="mb-2">
                          <LiveWaitingRoomBadge
                            minUsers={campaign.waiting_users_min}
                            maxUsers={campaign.waiting_users_max}
                            variant="card"
                          />
                        </div>
                      )}

                      {/* Global Release Countdown Badge if Active */}
                      {isCardGlobalCooling && !isNotStarted && (
                        <div className="mb-2.5">
                          <GlobalReleaseBadge
                            campaign={campaign}
                            onExpire={() => setGiveaways([...dataService.getGiveaways()])}
                          />
                        </div>
                      )}

                      {/* Event Countdown Badge if Upcoming */}
                      {isNotStarted && campaign.start_time && (
                        <div className="mb-2.5">
                          <EventCountdownBadge
                            targetDate={campaign.start_time}
                            label="Mở sau:"
                            theme="fire"
                            variant="compact"
                            onExpire={() => {
                              playClaimVictorySound();
                              setGiveaways([...dataService.getGiveaways()]);
                            }}
                          />
                        </div>
                      )}

                      {/* Package Selector if multiple */}
                  {packages.length > 1 && (
                    <div className="space-y-2 p-3.5 rounded-2xl bg-slate-900/60 border border-border/80">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-accent" />
                          <span>Chọn gói quà tặng muốn săn:</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {packages.length} gói có sẵn
                        </span>
                      </div>
                      <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                        {packages.map((pkg) => {
                          const isSelected = pkg.id === activePackage.id;
                          const pool = pkg.remaining_codes ?? 0;
                          return (
                            <button
                              key={pkg.id}
                              type="button"
                              onClick={() => setSelectedRewardPackageId(pkg.id)}
                              className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'border-red-500 bg-red-500/10 shadow-md ring-1 ring-red-500/60'
                                  : 'border-border/80 bg-card hover:bg-card-hover'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <span className={`text-xs font-bold block truncate ${isSelected ? 'text-white' : 'text-foreground'}`}>
                                  {pkg.name}
                                </span>
                                <span className="text-[11px] text-muted-foreground block truncate mt-0.5">
                                  {pkg.rewards}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  Còn {pool} mã
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Rewards Box */}
                      <div className="p-3 rounded-2xl bg-muted/50 border border-border/70 mb-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-light mb-1">
                          <Gift className="w-3.5 h-3.5" />
                          <span>Phần Thưởng:</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug font-sans">
                          {campaign.rewards}
                        </p>
                      </div>

                      {/* Campaign Requirement Badges */}
                      <div className="p-2.5 rounded-xl bg-card-hover/80 border border-border/60 mb-3 space-y-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                          Điều kiện giật code:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary-light border border-primary/20 font-medium">
                            <User className="w-3 h-3" />
                            <span>
                              {isUnlimitedUser ? 'Không giới hạn mã/tài khoản' : `Tối đa ${rawMaxPerUser || 1} mã/tài khoản`}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium">
                            <Globe className="w-3 h-3" />
                            <span>Tối đa {campaign.max_per_ip || 1} lượt/IP</span>
                          </span>
                          {Boolean(campaign.cooldown_hours && campaign.cooldown_hours > 0) && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-medium ${
                                isCooldownActive
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>
                                Hồi chiêu {campaign.cooldown_hours}h{' '}
                                {isCooldownActive ? `(còn ${cooldownWaitText})` : ''}
                              </span>
                            </span>
                          )}
                          {Boolean(campaign.min_account_age_days && campaign.min_account_age_days > 0) && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-medium ${
                                currentUser && !isAgeEligible
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>
                                Tuổi nick ≥ {campaign.min_account_age_days} ngày{' '}
                                {currentUser
                                  ? isAgeEligible
                                    ? '(Đạt)'
                                    : `(${userAgeDays}/${campaign.min_account_age_days}d)`
                                  : ''}
                              </span>
                            </span>
                          )}
                          {Boolean(campaign.global_cooldown_seconds && campaign.global_cooldown_seconds > 0) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                              <Clock className="w-3 h-3 text-purple-400" />
                              <span>Giãn cách {campaign.global_cooldown_seconds >= 60 ? `${Math.round(campaign.global_cooldown_seconds / 60)}p` : `${campaign.global_cooldown_seconds}s`}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress & Claim CTA */}
                    <div className="space-y-3 pt-2 border-t border-border/50">
                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5 font-mono">
                          {campaign.show_claimed_count !== false ? (
                            <span>
                              Đã giật:{' '}
                              <strong className="text-amber-400 font-bold">
                                {displayClaimed} mã
                              </strong>
                            </span>
                          ) : (
                            <span></span>
                          )}
                          {(campaign as any).show_remaining_count !== false && (
                            <span>
                              Còn lại: <strong className="text-accent">{displayRemaining}</strong> mã
                            </span>
                          )}
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
                            style={{ width: `${percentClaimed}%` }}
                          />
                        </div>
                      </div>

                      {/* Action Buttons on Card */}
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailModalCampaign(campaign);
                            }}
                            className="py-2.5 px-3 rounded-xl bg-muted/80 hover:bg-muted text-foreground border border-border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:border-primary/40"
                          >
                            <Info className="w-3.5 h-3.5 text-primary-light" />
                            <span>Chi Tiết</span>
                          </button>

                          {!currentUser ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenAuth();
                                onShowToast('Cần đăng nhập', 'Vui lòng đăng nhập để tham gia giật mã quà tặng.', 'info');
                              }}
                              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold text-xs shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                              <span>Đăng Nhập</span>
                            </button>
                          ) : isNotStarted ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailModalCampaign(campaign);
                              }}
                              className="py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>Chờ Mở</span>
                            </button>
                          ) : isEnded ? (
                            <button
                              disabled
                              className="py-2.5 px-3 rounded-xl bg-muted/60 text-muted-foreground border border-border text-xs font-semibold flex items-center justify-center gap-1 cursor-not-allowed"
                            >
                              <span>Đã Hết Hạn</span>
                            </button>
                          ) : remaining <= 0 ? (
                            <button
                              disabled
                              className="py-2.5 px-3 rounded-xl bg-muted/60 text-muted-foreground border border-border text-xs font-semibold flex items-center justify-center gap-1 cursor-not-allowed"
                            >
                              <span>Hết Code</span>
                            </button>
                          ) : isMaxReached ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const existing = claimedList.find((c) => c.campaign_id === campaign.id);
                                if (existing?.code_value) {
                                  setClaimedRewardModal({
                                    campaign,
                                    code: existing.code_value,
                                    isNew: false,
                                    isAdminBypass: isAdmin,
                                  });
                                } else {
                                  handleOpenLimitNotice(campaign);
                                }
                              }}
                              className="py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Xem Mã</span>
                            </button>
                          ) : isCooldownActive ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenLimitNotice(
                                  campaign,
                                  `Bạn đang trong thời gian hồi chiêu (${cooldownHours}h). Vui lòng quay lại sau ${remH > 0 ? `${remH} giờ ${remM} phút` : `${remM} phút`} để giật mã tiếp theo.`
                                );
                              }}
                              className="py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                            >
                              <Clock className="w-3.5 h-3.5 animate-spin text-amber-400" />
                              <span>Hồi Chiêu</span>
                            </button>
                          ) : !isAgeEligible ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenLimitNotice(
                                  campaign,
                                  `Tài khoản của bạn mới được tạo ${Math.max(0, userAgeDays)} ngày. Sự kiện này yêu cầu tài khoản tối thiểu ${minAccountAgeDays} ngày tuổi mới đủ điều kiện giật code.`
                                );
                              }}
                              className="py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                              <span>Tuổi Nick</span>
                            </button>
                          ) : isCardGlobalCooling ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailModalCampaign(campaign);
                              }}
                              className="py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>Chờ Đợt Mã</span>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClaim(campaign);
                              }}
                              disabled={claimingId === campaign.id}
                              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-accent to-accent-hover text-white font-display font-bold text-xs shadow-glow-accent hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-75"
                            >
                              {claimingId === campaign.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {userClaimCount > 0
                                  ? isAdmin
                                    ? `Giật Mã (${userClaimCount})`
                                    : `Giật Thêm (${userClaimCount})`
                                  : 'Giật Mã'}
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Secondary View Existing Code Link if already claimed but can still claim more */}
                        {userClaimCount > 0 && canClaimMore && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const existing = claimedList.find((c) => c.campaign_id === campaign.id);
                              if (existing?.code_value) {
                                setClaimedRewardModal({
                                  campaign,
                                  code: existing.code_value,
                                  isNew: false,
                                  isAdminBypass: isAdmin,
                                });
                              }
                            }}
                            className="w-full py-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center justify-center gap-1 transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Bạn đã có {userClaimCount} mã - Nhấn để xem lại</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Collapsible In-game Redemption Guide Accordion */}
          <div className="rounded-3xl bg-card border border-border/80 overflow-hidden shadow-sm">
            <button
              onClick={() => setIsRedeemGuideOpen(!isRedeemGuideOpen)}
              className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left hover:bg-muted/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm sm:text-base text-foreground">
                    Hướng Dẫn 3 Bước Kích Hoạt Mã Quà Tặng Ingame
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Cách nhập giftcode chuẩn và nhận quà trực tiếp về hòm thư trò chơi
                  </p>
                </div>
              </div>
              {isRedeemGuideOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
              )}
            </button>

            {isRedeemGuideOpen && (
              <div className="p-4 sm:p-6 pt-0 border-t border-border/60 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in text-xs">
                <div className="p-4 rounded-2xl bg-muted/50 border border-border/70 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/20 text-primary-light font-bold flex items-center justify-center">
                    1
                  </div>
                  <h4 className="font-bold text-foreground text-sm">Giật & Sao Chép Mã</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Chọn sự kiện bạn muốn tham gia, nhấn <strong>"Giật Mã"</strong>. Hệ thống sẽ cấp ngay một mã giftcode độc quyền, nhấn <strong>"Sao chép"</strong> để lưu vào bộ nhớ tạm.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/50 border border-border/70 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-accent/20 text-accent font-bold flex items-center justify-center">
                    2
                  </div>
                  <h4 className="font-bold text-foreground text-sm">Vào Game & Trung Tâm Đổi Quà</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Mở game của bạn, nhấn vào <strong>Avatar nhân vật</strong> hoặc mục <strong>Cài đặt (Settings)</strong>, tìm phần <strong>"Đổi Quà / Giftcode"</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/50 border border-border/70 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">
                    3
                  </div>
                  <h4 className="font-bold text-foreground text-sm">Nhận Quà Hòm Thư Ingame</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Dán mã vừa chép và nhấn <strong>Xác nhận</strong>. Quà tặng ingame sẽ được hệ thống gửi tự động về <strong>Hòm Thư</strong> tài khoản của bạn ngay lập tức!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Tab: My Claimed Codes */
        <div className="space-y-4">
          {!currentUser ? (
            <div className="py-16 text-center rounded-3xl bg-card border border-border p-8 space-y-4">
              <Gift className="w-12 h-12 mx-auto text-muted-foreground/40" />
              <h3 className="font-heading font-bold text-lg text-foreground">
                Vui lòng đăng nhập để xem kho mã đã giật
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Đăng nhập hoặc đăng ký tài khoản để lưu trữ và quản lý tất cả giftcode bạn đã săn được.
              </p>
              <button
                onClick={onOpenAuth}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-glow-primary cursor-pointer inline-flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng Nhập / Đăng Ký Ngay</span>
              </button>
            </div>
          ) : claimedList.length === 0 ? (
            <div className="py-16 text-center rounded-3xl bg-card border border-border p-8">
              <Gift className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <h3 className="font-heading font-bold text-lg text-foreground mb-1">
                Bạn chưa giật mã code nào
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
                Chuyển qua tab "Đang Mở" để tham gia các sự kiện phát giftcode độc quyền miễn phí ngay!
              </p>
              <button
                onClick={() => setActiveTab('campaigns')}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-glow-primary cursor-pointer"
              >
                Khám phá sự kiện ngay
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Batch Actions Toolbar */}
              <div className="p-4 rounded-2xl bg-card border border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <PackageCheck className="w-4 h-4 text-emerald-400" />
                  <span>
                    Tổng cộng: <strong className="text-primary-light font-bold">{claimedList.length}</strong> giftcode đã lưu trong ví của bạn
                  </span>
                </div>
                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                  <button
                    onClick={handleCopyAllCodes}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-muted hover:bg-card text-foreground border border-border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Sao chép toàn bộ mã"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao Chép Tất Cả</span>
                  </button>
                  <button
                    onClick={handleExportTxtFile}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    title="Tải về file text"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải File .TXT</span>
                  </button>
                </div>
              </div>

              {/* Codes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {claimedList.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0 border border-border">
                        <img
                          src={item.game_icon_url || `/game_icons/${item.game_slug}.webp`}
                          alt={item.game_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = '/vite.svg';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-heading font-bold text-sm text-foreground truncate">
                          {item.game_name}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          🎁 {item.rewards}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-primary-light font-mono">
                          <Clock className="w-3.5 h-3.5 shrink-0 text-accent" />
                          <span>
                            Nhận lúc: <strong className="text-foreground">{formatFullDateTime(item.claimed_at)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
                      <div className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-muted font-mono font-bold text-primary-light text-sm border border-border text-center select-all">
                        {item.code_value}
                      </div>
                      <button
                        onClick={() => handleCopy(item.code_value)}
                        className="px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        {copiedCode === item.code_value ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Chép</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CYBER LOADER OVERLAY KHI GIẬT CODE */}
      {claimingId && typeof document !== 'undefined' && createPortal(
        <CyberLoader
          isOverlay={true}
          title="ĐANG GIẬT CODE..."
          subText="Hệ thống đang kết nối kho giftcode Cloudflare D1 để phân phối mã quà tặng..."
        />,
        document.body
      )}

      {/* CLAIM REWARD MODAL POPUP (CYBER MYSTERY BOX REVEAL) */}
      {claimedRewardModal && typeof document !== 'undefined' && createPortal(
        (() => {
          const targetCampaign = claimedRewardModal.campaign;
          const allMyCampaignCodes = claimedList.filter((c) => c.campaign_id === targetCampaign.id);
          const poolCount =
            Array.isArray(targetCampaign.codes_pool) && targetCampaign.codes_pool.length > 0
              ? targetCampaign.codes_pool.length
              : (typeof targetCampaign.remaining_codes === 'number' ? targetCampaign.remaining_codes : 0);
          const remaining = marketingService.getDisplayStock(targetCampaign.id, poolCount);
          const rawMaxPerUser = Number(targetCampaign.max_per_user);
          const isUnlimitedUser = rawMaxPerUser === 0 || rawMaxPerUser >= 999999;
          const effectiveMaxPerUser = isUnlimitedUser ? 999999 : (rawMaxPerUser > 0 ? rawMaxPerUser : 1);
          const canClaimAnother = (isAdmin || isUnlimitedUser || allMyCampaignCodes.length < effectiveMaxPerUser) && remaining > 0;

          return (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden animate-fade-in">
              <div
                className="relative w-full max-w-md bg-card border border-border/90 rounded-3xl overflow-hidden shadow-2xl p-5 sm:p-6 space-y-4 animate-scale-in max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => setClaimedRewardModal(null)}
                  className="absolute top-4 right-4 p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 shadow-md cursor-pointer transition-all active:scale-90 flex items-center justify-center shrink-0 z-10"
                  aria-label="Đóng"
                  title="Đóng"
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                {/* Unboxing Mystery Box Animation / Reveal */}
                {isUnboxing ? (
                  <div className="py-10 text-center space-y-4 animate-pulse">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-accent to-purple-500 border border-accent/60 flex items-center justify-center mx-auto shadow-glow-accent animate-bounce">
                      <Box className="w-12 h-12 text-white" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-heading font-black text-xl text-foreground">
                        Đang Mở Rương Quà Tặng...
                      </h3>
                      <p className="text-xs text-accent font-mono animate-pulse">
                        ✦ Bóc tách giftcode từ máy chủ ✦
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-center space-y-2 pt-2">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                        claimedRewardModal.isNew !== false
                          ? 'bg-accent/20 text-accent border border-accent/40 shadow-glow-accent'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      }`}>
                        {claimedRewardModal.isNew !== false ? (
                          <Sparkles className="w-8 h-8 text-accent animate-spin-slow" />
                        ) : (
                          <History className="w-8 h-8 text-amber-400" />
                        )}
                      </div>

                      <div>
                        <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold mb-1 border ${
                          claimedRewardModal.isNew !== false
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}>
                          {claimedRewardModal.isNew !== false ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Giật Code Mới Thành Công</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-amber-400" />
                              <span>Mã Quà Tặng Đã Nhận Trước Đó</span>
                            </>
                          )}
                        </div>
                        <h3 className="font-heading font-extrabold text-xl text-foreground">
                          {claimedRewardModal.campaign.game_name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {claimedRewardModal.campaign.title}
                        </p>
                      </div>

                      {/* Prominent Warning if code is NOT new */}
                      {claimedRewardModal.isNew === false && (
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5 text-left mx-1">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <strong className="text-amber-300 font-bold block text-[12px]">
                              ⚠️ BẠN ĐÃ NHẬN MÃ NÀY TRƯỚC ĐÓ (MÃ CŨ ĐÃ LƯU)
                            </strong>
                            <p className="text-amber-200/90 leading-relaxed text-[11px]">
                              Đây là giftcode đã được lưu trong lịch sử tài khoản của bạn. Mỗi mã chỉ dùng được 1 lần trong game. Nếu bạn đã kích hoạt trước đó, mã sẽ không thể nhập lại.
                            </p>
                          </div>
                        </div>
                      )}

                      {isAdmin && (
                        <div className="text-[11px] text-purple-400 font-semibold bg-purple-500/10 border border-purple-500/30 rounded-xl px-2.5 py-1 inline-flex items-center gap-1 mx-auto">
                          <Crown className="w-3 h-3 text-amber-400" />
                          <span>[Admin Test Mode] Mã được trích xuất trực tiếp từ kho</span>
                        </div>
                      )}
                    </div>

                    {/* Reward Info */}
                    <div className="p-3.5 rounded-2xl bg-muted/60 border border-border/70 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden border border-border shrink-0">
                        <img
                          src={
                            claimedRewardModal.campaign.game_icon_url ||
                            `/game_icons/${claimedRewardModal.campaign.game_slug}.webp`
                          }
                          alt={claimedRewardModal.campaign.game_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">
                          Phần thưởng nhận được:
                        </span>
                        <p className="text-xs text-accent font-semibold truncate mt-0.5">
                          🎁 {claimedRewardModal.campaign.rewards}
                        </p>
                      </div>
                    </div>

                    {/* Primary Code Box */}
                    <div className="p-4 rounded-2xl bg-muted/70 border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-bold">Mã Giftcode Ingame:</span>
                        {claimedRewardModal.isNew !== false ? (
                          <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            Mã Mới ✦ Sẵn Sàng Kích Hoạt
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            Mã Cũ ✦ Đã Lưu Trong Lịch Sử
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 bg-card p-3 rounded-xl border border-border shadow-inner">
                        <span className="font-mono font-black text-lg text-primary-light truncate select-all">
                          {claimedRewardModal.code}
                        </span>
                        <button
                          onClick={() => handleCopy(claimedRewardModal.code)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all cursor-pointer shrink-0"
                        >
                          {copiedCode === claimedRewardModal.code ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Đã chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Sao chép</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* All Previous Codes for this Campaign (if > 1) */}
                    {allMyCampaignCodes.length > 1 && (
                      <div className="p-3 rounded-2xl bg-card-hover/90 border border-border/80 space-y-2 max-h-36 overflow-y-auto">
                        <span className="text-[11px] font-bold text-foreground block">
                          Tất cả các mã bạn đã giật tại sự kiện này ({allMyCampaignCodes.length} mã):
                        </span>
                        <div className="space-y-1.5">
                          {allMyCampaignCodes.map((c) => (
                            <div
                              key={c.id}
                              className="p-2 rounded-xl bg-card border border-border/60 flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="font-mono font-bold text-primary-light truncate">{c.code_value}</span>
                              <button
                                onClick={() => handleCopy(c.code_value)}
                                className="px-2 py-1 rounded bg-muted hover:bg-card text-muted-foreground hover:text-foreground text-[10px] font-bold cursor-pointer"
                              >
                                {copiedCode === c.code_value ? 'Đã chép' : 'Chép'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Modal Action Buttons */}
                    <div className="space-y-2 pt-1">
                      {/* 1. Primary Action: Copy code & close */}
                      <button
                        onClick={() => {
                          handleCopy(claimedRewardModal.code);
                          setClaimedRewardModal(null);
                        }}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-bold text-xs shadow-glow-primary transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao Chép Mã & Đóng</span>
                      </button>

                      {/* 2. Secondary: Claim another code if quota permits */}
                      {canClaimAnother && (
                        <button
                          onClick={() => {
                            const camp = claimedRewardModal.campaign;
                            setClaimedRewardModal(null);
                            handleClaim(camp);
                          }}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-accent via-rose-500 to-amber-500 hover:opacity-95 text-white font-display font-bold text-xs tracking-wide shadow-glow-accent transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {isAdmin ? '👑 [Admin] Giật Thêm 1 Mã Tiếp' : '⚡ Giật Thêm 1 Mã Nữa'}
                          </span>
                        </button>
                      )}

                      {/* 3. Bottom Row: Share & My Codes in 2-column compact grid */}
                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        {onShareGiveaway ? (
                          <button
                            onClick={(e) => {
                              const camp = claimedRewardModal.campaign;
                              setClaimedRewardModal(null);
                              onShareGiveaway(camp, e);
                            }}
                            className="py-2 px-2.5 rounded-xl bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 truncate"
                          >
                            <Share2 className="w-3 h-3 shrink-0" />
                            <span className="truncate">Chia Sẻ</span>
                          </button>
                        ) : (
                          <div />
                        )}

                        <button
                          onClick={() => {
                            setClaimedRewardModal(null);
                            setActiveTab('my_codes');
                          }}
                          className="py-2 px-2.5 rounded-xl bg-muted hover:bg-card text-muted-foreground hover:text-foreground border border-border text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1 truncate text-center"
                        >
                          <History className="w-3 h-3 shrink-0" />
                          <span className="truncate">Kho Mã ({claimedList.length})</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* LIMIT NOTICE MODAL (CẢNH BÁO ĐẠT GIỚI HẠN / ĐIỀU KIỆN) */}
      {limitNoticeModal && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setLimitNoticeModal(null)}
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-card border border-border/90 rounded-3xl p-5 sm:p-6 shadow-2xl animate-scale-in space-y-4"
          >
            {/* Header with Alert icon */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-foreground leading-snug">
                    Thông Báo Giới Hạn Quà Tặng
                  </h3>
                  <span className="text-xs text-amber-400 font-medium block">
                    Đã đạt giới hạn hoặc chưa đủ điều kiện nhận
                  </span>
                </div>
              </div>
              <button
                onClick={() => setLimitNoticeModal(null)}
                className="p-1.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Event Name */}
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden shrink-0 border border-border">
                <img
                  src={
                    limitNoticeModal.campaign.game_icon_url ||
                    `/game_icons/${limitNoticeModal.campaign.game_slug}.webp`
                  }
                  alt={limitNoticeModal.campaign.game_name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = '/vite.svg';
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-primary-light block">
                  {limitNoticeModal.campaign.game_name}
                </span>
                <h4 className="font-heading font-bold text-xs sm:text-sm text-foreground truncate">
                  {limitNoticeModal.campaign.title}
                </h4>
              </div>
            </div>

            {/* Explanation Message */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed font-sans">
              {limitNoticeModal.message}
            </div>

            {/* Previously Claimed Code for this campaign (if exists) */}
            {limitNoticeModal.existingCodes.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <span className="text-[11px] font-bold text-emerald-400 block">
                  Mã quà tặng bạn đã nhận trước đó ({limitNoticeModal.existingCodes.length} mã):
                </span>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {limitNoticeModal.existingCodes.map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-xl bg-card border border-emerald-500/20 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-xs text-foreground truncate block select-all">
                          {c.code_value}
                        </span>
                        {c.claimed_at && (
                          <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>Nhận lúc: {formatFullDateTime(c.claimed_at)}</span>
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleCopy(c.code_value)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                      >
                        {copiedCode === c.code_value ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>Sao chép</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => {
                  setLimitNoticeModal(null);
                  setActiveTab('my_codes');
                }}
                className="py-3 px-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold text-xs shadow-glow-primary hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <History className="w-4 h-4" />
                <span>Xem Kho Mã Đã Giật</span>
              </button>
              <button
                onClick={() => setLimitNoticeModal(null)}
                className="py-3 px-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs border border-border transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CAMPAIGN DETAIL & CLAIM MODAL */}
      {detailModalCampaign && typeof document !== 'undefined' && createPortal(
        (() => {
          const currentCampaign = giveaways.find((g) => g.id === detailModalCampaign.id) || detailModalCampaign;
          const packages = getGiveawayPackages(currentCampaign);
          const activePackage = packages.find((p) => p.id === selectedRewardPackageId) || packages[0];
          const poolCount =
            Array.isArray(activePackage?.codes_pool || currentCampaign.codes_pool) && (activePackage?.codes_pool || currentCampaign.codes_pool)!.length > 0
              ? (activePackage?.codes_pool || currentCampaign.codes_pool)!.length
              : (typeof activePackage?.remaining_codes === 'number' ? activePackage.remaining_codes : (typeof currentCampaign.remaining_codes === 'number' ? currentCampaign.remaining_codes : 0));
          const displayRemaining = marketingService.getDisplayStock(currentCampaign.id, poolCount);
          const displayClaimed =
            currentCampaign.show_claimed_count !== false
              ? marketingService.getClaimedDisplay(currentCampaign)
              : currentCampaign.claimed_codes || 0;
          const remaining = displayRemaining;
          const displayTotal = displayRemaining + displayClaimed;
          const percentClaimed =
            displayTotal > 0
              ? Math.min(100, Math.max(0, Math.round((displayClaimed / displayTotal) * 100)))
              : displayRemaining <= 0
              ? 100
              : 0;

          const rawMaxPerUser = Number(currentCampaign.max_per_user);
          const isUnlimitedUser = rawMaxPerUser === 0 || rawMaxPerUser >= 999999;
          const effectiveMaxPerUser = isUnlimitedUser ? 999999 : (rawMaxPerUser > 0 ? rawMaxPerUser : 1);

          const userCampaignClaims = claimedList.filter((c) => c.campaign_id === currentCampaign.id);
          const userClaimCount = userCampaignClaims.length;
          const canClaimMore = (isAdmin || isUnlimitedUser || userClaimCount < effectiveMaxPerUser) && remaining > 0;
          const isMaxReached = !canClaimMore && remaining > 0;

          // Cooldown calculation
          let cooldownRemainingMs = 0;
          const cooldownHours = isAdmin ? 0 : (Number(currentCampaign.cooldown_hours) || 0);
          if (cooldownHours > 0 && userCampaignClaims.length > 0) {
            const latestClaim = userCampaignClaims[0];
            if (latestClaim && latestClaim.claimed_at) {
              const lastClaimTime = new Date(latestClaim.claimed_at).getTime();
              const cooldownMs = cooldownHours * 3600 * 1000;
              cooldownRemainingMs = Math.max(0, lastClaimTime + cooldownMs - Date.now());
            }
          }
          const isCooldownActive = cooldownRemainingMs > 0;
          const remH = Math.floor(cooldownRemainingMs / (1000 * 3600));
          const remM = Math.ceil((cooldownRemainingMs % (1000 * 3600)) / (1000 * 60));
          const cooldownWaitText = remH > 0 ? `${remH} giờ ${remM} phút` : `${remM} phút`;

          // Account age calculation
          const minAccountAgeDays = isAdmin ? 0 : (Number(currentCampaign.min_account_age_days) || 0);
          let userAgeDays = 0;
          let isAgeEligible = true;
          if (currentUser && minAccountAgeDays > 0) {
            const userCreatedAt = currentUser.created_at || (currentUser as any).createdAt;
            if (userCreatedAt) {
              const userCreatedMs = new Date(userCreatedAt).getTime();
              if (!isNaN(userCreatedMs)) {
                userAgeDays = Math.floor((Date.now() - userCreatedMs) / (1000 * 60 * 60 * 24));
                isAgeEligible = userAgeDays >= minAccountAgeDays;
              }
            }
          }

          // Time window calculation
          const nowMs = Date.now();
          const isNotStarted = currentCampaign.start_time
            ? !isNaN(new Date(currentCampaign.start_time).getTime()) && nowMs < new Date(currentCampaign.start_time).getTime()
            : false;
          const isEnded =
            (currentCampaign.end_time
              ? !isNaN(new Date(currentCampaign.end_time).getTime()) && nowMs > new Date(currentCampaign.end_time).getTime()
              : false) ||
            currentCampaign.status === 'ENDED' ||
            currentCampaign.is_active === false;

          const isModalGlobalCooling = Boolean(
            currentCampaign.global_cooldown_seconds &&
            currentCampaign.global_cooldown_seconds > 0 &&
            currentCampaign.last_global_claim_at &&
            (new Date(currentCampaign.last_global_claim_at).getTime() + currentCampaign.global_cooldown_seconds * 1000) > Date.now()
          );

          return (
            <div
              onClick={handleCloseDetailModal}
              className="fixed inset-0 z-[105] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-lg bg-card border border-border/90 rounded-3xl overflow-hidden shadow-2xl p-5 sm:p-6 space-y-4 my-auto animate-scale-in max-h-[92vh] flex flex-col"
              >
                {/* Close button */}
                <button
                  onClick={handleCloseDetailModal}
                  className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 shadow-md cursor-pointer transition-all active:scale-90 flex items-center justify-center shrink-0 z-10"
                  aria-label="Đóng"
                  title="Đóng"
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                {/* Modal Header: Game info */}
                <div className="flex items-center gap-3.5 pr-10">
                  <div
                    onClick={() => {
                      setDetailModalCampaign(null);
                      onSelectGameSlug(currentCampaign.game_slug);
                    }}
                    className="w-14 h-14 rounded-2xl bg-muted overflow-hidden shrink-0 border border-border shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={currentCampaign.game_icon_url || `/game_icons/${currentCampaign.game_slug}.webp`}
                      alt={currentCampaign.game_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = '/vite.svg';
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/30">
                        Chính thức NPH
                      </span>
                      {isEnded ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          Đã kết thúc
                        </span>
                      ) : isNotStarted ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Sắp mở
                        </span>
                      ) : remaining <= 0 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-500/15 text-slate-400 border border-slate-500/30">
                          Hết code
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Đang phát mã
                        </span>
                      )}
                    </div>
                    <h3 className="font-heading font-black text-base sm:text-lg text-foreground line-clamp-1">
                      {currentCampaign.game_name}
                    </h3>
                    <p className="text-xs text-primary-light font-bold truncate">
                      {currentCampaign.title}
                    </p>
                  </div>
                </div>

                {/* Modal Scrollable Body */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 custom-scrollbar text-xs">
                  {/* Rewards Box */}
                  <div className="p-3.5 rounded-2xl bg-muted/60 border border-border/80 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-accent">
                      <Gift className="w-4 h-4" />
                      <span>Chi Tiết Phần Thưởng Code:</span>
                    </div>
                    <p className="text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
                      {currentCampaign.rewards}
                    </p>
                    {currentCampaign.description && (
                      <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                        {currentCampaign.description}
                      </p>
                    )}
                  </div>

                  {/* Time Window */}
                  <div className="p-3 rounded-2xl bg-card-hover/80 border border-border/70 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary-light shrink-0" />
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                          Thời gian sự kiện:
                        </span>
                        <span className="text-xs font-mono text-foreground font-semibold">
                          {currentCampaign.start_time ? formatRelativeDate(currentCampaign.start_time) : 'Đang mở'} →{' '}
                          {currentCampaign.end_time ? formatFullDateTime(currentCampaign.end_time) : 'Đến khi hết mã'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Conditions & Eligibility Checklist */}
                  <div className="p-3.5 rounded-2xl bg-card-hover/90 border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Điều kiện tham gia sự kiện:</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {currentUser ? 'Đã kiểm tra tài khoản' : 'Cần đăng nhập'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      {/* Rule 1: Max per user */}
                      <div
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                          isMaxReached
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-muted/50 border-border/70 text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-3.5 h-3.5 text-primary-light shrink-0" />
                          <span className="truncate">
                            {isUnlimitedUser ? 'Không giới hạn mã/tài khoản' : `Tối đa ${rawMaxPerUser || 1} mã / TK`}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold shrink-0">
                          ({userClaimCount}/{isUnlimitedUser ? '∞' : rawMaxPerUser || 1})
                        </span>
                      </div>

                      {/* Rule 2: Max per IP */}
                      <div className="p-2.5 rounded-xl bg-muted/50 border border-border/70 flex items-center justify-between gap-2 text-foreground">
                        <div className="flex items-center gap-2 min-w-0">
                          <Globe className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          <span className="truncate">Tối đa {currentCampaign.max_per_ip || 1} mã / IP</span>
                        </div>
                        <span className="text-[10px] font-bold text-teal-400 shrink-0">Áp dụng</span>
                      </div>

                      {/* Rule 3: Cooldown */}
                      {Boolean(currentCampaign.cooldown_hours && currentCampaign.cooldown_hours > 0) && (
                        <div
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 sm:col-span-2 ${
                            isCooldownActive
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              : 'bg-muted/50 border-border/70 text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">Hồi chiêu: {currentCampaign.cooldown_hours}h giữa 2 lần nhận</span>
                          </div>
                          <span className="text-[10px] font-bold shrink-0">
                            {isCooldownActive ? `Còn ${cooldownWaitText}` : 'Sẵn sàng'}
                          </span>
                        </div>
                      )}

                      {/* Rule 4: Min account age */}
                      {Boolean(currentCampaign.min_account_age_days && currentCampaign.min_account_age_days > 0) && (
                        <div
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 sm:col-span-2 ${
                            currentUser && !isAgeEligible
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                              : 'bg-muted/50 border-border/70 text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">
                              Tuổi nick yêu cầu: ≥ {currentCampaign.min_account_age_days} ngày
                            </span>
                          </div>
                          <span className="text-[10px] font-bold shrink-0">
                            {currentUser
                              ? isAgeEligible
                                ? `Đạt (${userAgeDays} ngày)`
                                : `Chưa đạt (${userAgeDays}/${currentCampaign.min_account_age_days} ngày)`
                              : `≥ ${currentCampaign.min_account_age_days} ngày`}
                          </span>
                        </div>
                      )}

                      {/* Rule 5: Global release interval */}
                      {Boolean(currentCampaign.global_cooldown_seconds && currentCampaign.global_cooldown_seconds > 0) && (
                        <div
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 sm:col-span-2 ${
                            isModalGlobalCooling
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              : 'bg-muted/50 border-border/70 text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">
                              Giãn cách phát mã toàn sàn: {currentCampaign.global_cooldown_seconds >= 60 ? `${Math.floor(currentCampaign.global_cooldown_seconds / 60)} phút` : `${currentCampaign.global_cooldown_seconds}s`} / 1 mã
                            </span>
                          </div>
                          <span className="text-[10px] font-bold shrink-0">
                            {isModalGlobalCooling ? '⏳ Đang chờ đợt tiếp' : '🟢 Sẵn sàng'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Real-time Stock Progress */}
                  <div className="p-3.5 rounded-2xl bg-muted/50 border border-border/70 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      {currentCampaign.show_claimed_count !== false ? (
                        <span>
                          Đã trao: <strong className="text-amber-400">{displayClaimed} mã</strong>
                        </span>
                      ) : (
                        <span></span>
                      )}
                      {(currentCampaign as any).show_remaining_count !== false && (
                        <span>
                          Còn lại: <strong className="text-accent">{displayRemaining} mã</strong>
                        </span>
                      )}
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden border border-border/40">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
                        style={{ width: `${percentClaimed}%` }}
                      />
                    </div>
                  </div>

                  {/* Previously Claimed Codes for this campaign */}
                  {userCampaignClaims.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-400 block">
                          Mã bạn đã giật tại sự kiện này ({userCampaignClaims.length} mã):
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                        {userCampaignClaims.map((c) => (
                          <div
                            key={c.id}
                            className="p-2.5 rounded-xl bg-card border border-emerald-500/20 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <span className="font-mono font-bold text-xs text-foreground truncate block select-all">
                                {c.code_value}
                              </span>
                              {c.claimed_at && (
                                <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span>Nhận lúc: {formatFullDateTime(c.claimed_at)}</span>
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleCopy(c.code_value)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                            >
                              {copiedCode === c.code_value ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              <span>Sao chép</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Sticky Footer CTA */}
                <div className="pt-2 border-t border-border/60 space-y-2">
                  {!currentUser ? (
                    <button
                      onClick={() => {
                        setDetailModalCampaign(null);
                        onOpenAuth();
                        onShowToast('Cần đăng nhập', 'Vui lòng đăng nhập hoặc đăng ký tài khoản để giật mã quà tặng.', 'info');
                      }}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-display font-bold text-xs sm:text-sm shadow-glow-primary hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Đăng Nhập Ngay Để Giật Code</span>
                    </button>
                  ) : isNotStarted ? (
                    <div className="space-y-3">
                      <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-red-950/60 via-orange-950/60 to-amber-950/60 border border-orange-500/30 text-center space-y-2">
                        <div className="text-xs font-bold text-orange-300 uppercase tracking-wider flex items-center justify-center gap-1.5">
                          <Flame className="w-4 h-4 text-orange-400 fill-orange-400 animate-pulse" />
                          <span>Sự Kiện Sắp Diễn Ra — Đếm Ngược Đến Giờ G:</span>
                        </div>
                        <div className="flex justify-center">
                          <EventCountdownBadge
                            targetDate={currentCampaign.start_time}
                            label="Mở sau:"
                            theme="fire"
                            variant="detailed"
                            onExpire={() => {
                              playClaimVictorySound();
                              confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
                              setGiveaways([...dataService.getGiveaways()]);
                            }}
                          />
                        </div>
                      </div>
                      <button
                        disabled
                        className="w-full py-3.5 rounded-2xl bg-muted/60 text-muted-foreground border border-border text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <Clock className="w-4 h-4" />
                        <span>Chờ Đến Giờ Mở Sự Kiện ({formatRelativeDate(currentCampaign.start_time)})</span>
                      </button>
                    </div>
                  ) : isEnded ? (
                    <button
                      disabled
                      className="w-full py-3.5 rounded-2xl bg-muted/60 text-muted-foreground border border-border text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <span>Sự Kiện Đã Kết Thúc</span>
                    </button>
                  ) : remaining <= 0 ? (
                    <div className="space-y-2">
                      <button
                        disabled
                        className="w-full py-3.5 rounded-2xl bg-muted/60 text-muted-foreground border border-border text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                      >
                        <span>Toàn Bộ Mã Quà Tặng Đã Trao Hết</span>
                      </button>
                      {userClaimCount > 0 && (
                        <button
                          onClick={() => {
                            setDetailModalCampaign(null);
                            const existing = claimedList.find((c) => c.campaign_id === currentCampaign.id);
                            if (existing?.code_value) {
                              setClaimedRewardModal({
                                campaign: currentCampaign,
                                code: existing.code_value,
                                isNew: false,
                                isAdminBypass: isAdmin,
                              });
                            }
                          }}
                          className="w-full py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Xem lại mã bạn đã nhận ({userClaimCount})</span>
                        </button>
                      )}
                    </div>
                  ) : isMaxReached ? (
                    <div className="space-y-1.5">
                      <button
                        onClick={() => {
                          setDetailModalCampaign(null);
                          const existing = claimedList.find((c) => c.campaign_id === currentCampaign.id);
                          if (existing?.code_value) {
                            setClaimedRewardModal({
                              campaign: currentCampaign,
                              code: existing.code_value,
                              isNew: false,
                              isAdminBypass: isAdmin,
                            });
                          } else {
                            handleOpenLimitNotice(currentCampaign);
                          }
                        }}
                        className="w-full py-3.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Xem {userClaimCount} Mã Đã Nhận & Sao Chép</span>
                      </button>
                    </div>
                  ) : isModalGlobalCooling ? (
                    <div className="space-y-2">
                      <ModalGlobalCooldownSection
                        campaign={currentCampaign}
                        onExpire={() => setGiveaways([...dataService.getGiveaways()])}
                      />
                      {isAdmin && (
                        <button
                          onClick={() => handleClaim(currentCampaign)}
                          disabled={claimingId === currentCampaign.id}
                          className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>👑 [Admin] Bỏ qua chờ đợt — Giật thử nghiệm ngay</span>
                        </button>
                      )}
                    </div>
                  ) : isCooldownActive ? (
                    <button
                      onClick={() => {
                        setDetailModalCampaign(null);
                        handleOpenLimitNotice(
                          currentCampaign,
                          `Bạn đang trong thời gian hồi chiêu (${cooldownHours}h). Vui lòng quay lại sau ${cooldownWaitText} để giật mã tiếp theo.`
                        );
                      }}
                      className="w-full py-3.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <Clock className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Đang Hồi Chiêu (Còn {cooldownWaitText})</span>
                    </button>
                  ) : !isAgeEligible ? (
                    <button
                      onClick={() => {
                        setDetailModalCampaign(null);
                        handleOpenLimitNotice(
                          currentCampaign,
                          `Tài khoản của bạn mới được tạo ${Math.max(0, userAgeDays)} ngày. Sự kiện này yêu cầu tài khoản tối thiểu ${minAccountAgeDays} ngày tuổi mới đủ điều kiện giật code.`
                        );
                      }}
                      className="w-full py-3.5 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <ShieldCheck className="w-4 h-4 text-rose-400" />
                      <span>Chưa Đủ Điều Kiện Tuổi Nick ({userAgeDays}/${minAccountAgeDays} ngày)</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {currentCampaign.enable_waiting_room !== false && (
                        <LiveWaitingRoomBadge
                          minUsers={currentCampaign.waiting_users_min}
                          maxUsers={currentCampaign.waiting_users_max}
                          variant="modal"
                          className="mb-1"
                        />
                      )}
                      <button
                        onClick={() => handleClaim(currentCampaign)}
                        disabled={claimingId === currentCampaign.id}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-accent via-rose-500 to-amber-500 hover:opacity-95 text-white font-display font-black text-xs sm:text-sm tracking-wide shadow-glow-accent hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
                      >
                        {claimingId === currentCampaign.id ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin text-white" />
                            <span>Đang Kết Nối Nhận Mã...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 animate-bounce" />
                            <span>
                              {userClaimCount > 0
                                ? isAdmin
                                  ? `👑 [Admin] Giật Thêm Mã (Đã có ${userClaimCount} mã)`
                                  : `⚡ Giật Thêm Mã Mới (${userClaimCount}/${isUnlimitedUser ? '∞' : rawMaxPerUser || 1})`
                                : '⚡ GIẬT MÃ CODE NGAY (MIỄN PHÍ)'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleCloseDetailModal}
                    className="w-full py-2.5 rounded-xl bg-muted hover:bg-card text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors cursor-pointer text-center"
                  >
                    Đóng cửa sổ
                  </button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
};
