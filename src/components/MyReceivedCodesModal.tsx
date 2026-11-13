import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Gift,
  ShoppingBag,
  Package,
  Sparkles,
  Search,
  Mail,
  Clock,
  Copy,
  Check,
  BookOpen,
  ExternalLink,
  Target,
  Award,
  CheckCircle2,
  ArrowRight,
  Store,
  ShieldAlert,
  AlertCircle,
  Star,
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { missionService } from '../services/missionService';
import { marketingService } from '../services/marketingService';
import type { ClaimedCodeRecord, OrderRecord } from '../types/game';
import { formatCore, formatRelativeDate, formatFullDateTime } from '../utils/textUtils';
import { GuideLinksBanner } from './GuideLinksBanner';

interface MyReceivedCodesModalProps {
  isOpen: boolean;
  initialTab?: 'giveaways' | 'orders' | 'privates' | 'missions' | 'marketplace';
  onClose: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToMissions?: () => void;
  onOpenAuth?: () => void;
}

export const MyReceivedCodesModal: React.FC<MyReceivedCodesModalProps> = ({
  isOpen,
  initialTab = 'giveaways',
  onClose,
  onShowToast,
  onNavigateToMissions,
  onOpenAuth,
}) => {
  const [tab, setTab] = useState<'giveaways' | 'orders' | 'privates' | 'missions' | 'marketplace'>(initialTab);
  const [copied, setCopied] = useState<string | null>(null);
  
  // Real-time state
  const [claimedList, setClaimedList] = useState<ClaimedCodeRecord[]>([]);
  const [ordersList, setOrdersList] = useState<OrderRecord[]>([]);
  const [privateCodesList, setPrivateCodesList] = useState<any[]>([]);
  const [missionRewardsList, setMissionRewardsList] = useState<any[]>(() => dataService.getMissionRewards());
  const [isLoadingMissions, setIsLoadingMissions] = useState<boolean>(false);
  const [lookupEmail, setLookupEmail] = useState<string>('');

  // Marketplace Orders State (§6.3)
  const [marketplaceOrders, setMarketplaceOrders] = useState<any[]>([]);
  const [isLoadingMarketplace, setIsLoadingMarketplace] = useState<boolean>(false);
  const [reportingOrder, setReportingOrder] = useState<any>(null);
  const [reportReason, setReportReason] = useState<'not_working' | 'expired'>('not_working');
  const [reportNote, setReportNote] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);

  // Marketplace Ratings State (§A)
  const [ratingOrder, setRatingOrder] = useState<any>(null);
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  // Marketplace Disputes State (§B)
  const [disputeOrder, setDisputeOrder] = useState<any>(null);
  const [disputeReason, setDisputeReason] = useState<string>('WRONG_CODE');
  const [disputeDetail, setDisputeDetail] = useState<string>('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const currentUser = dataService.getCurrentUser();

  const displayClaimedList = useMemo(() => {
    const seen = new Set<string>();
    return claimedList.filter((c) => {
      if (!c || !c.code_value) return false;
      const cleanCode = String(c.code_value).trim().toUpperCase();
      const campId = String(c.campaign_id || '').trim();
      const key = `${campId}_${cleanCode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [claimedList]);

  const displayOrdersList = useMemo(() => {
    const seen = new Set<string>();
    return ordersList.filter((o) => {
      if (!o) return false;
      const key = String(o.id || o.orderCode || '').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [ordersList]);

  const loadAll = () => {
    setClaimedList(dataService.getClaimedCodes());
    setOrdersList(dataService.getOrders());
    const effectiveEmail = lookupEmail.trim() || currentUser?.email || '';
    if (effectiveEmail) {
      setPrivateCodesList(dataService.getPrivateCodesForEmail(effectiveEmail));
    } else {
      setPrivateCodesList([]);
    }

    // 1. Tải tức thì danh sách mã nhiệm vụ đã lưu từ bộ nhớ cache
    setMissionRewardsList(dataService.getMissionRewards());

    // 2. Nếu đã đăng nhập, tự động đồng bộ hồ sơ nhiệm vụ mới nhất từ máy chủ
    const u = dataService.getCurrentUser();
    if (u) {
      setIsLoadingMissions(true);
      missionService.getMySubmissions()
        .then((res) => {
          if (res.success && Array.isArray(res.submissions)) {
            const approved = res.submissions.filter((s: any) => s && s.status === 'APPROVED');
            setMissionRewardsList(approved);
            dataService.saveMissionRewards(approved);
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsLoadingMissions(false);
        });

      // Tải đơn hàng Sàn TMĐT
      loadMarketplaceOrders();
    }
  };

  const loadMarketplaceOrders = async () => {
    const token = localStorage.getItem('wcg_auth_token') || sessionStorage.getItem('wcg_auth_token') || '';
    if (!token) return;
    setIsLoadingMarketplace(true);
    try {
      const res = await fetch('/api/my-seller-orders', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setMarketplaceOrders(data.orders);
      }
    } catch {}
    setIsLoadingMarketplace(false);
  };

  const handleReportMarketplaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingOrder) return;
    setIsSubmittingReport(true);
    const token = localStorage.getItem('wcg_auth_token') || sessionStorage.getItem('wcg_auth_token') || '';
    try {
      const res = await fetch(`/api/seller-orders/${reportingOrder.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reportReason, note: reportNote }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast('Báo lỗi thành công!', data.message, 'success');
        setReportingOrder(null);
        setReportNote('');
        loadMarketplaceOrders();
      } else {
        onShowToast('Lỗi', data.error || 'Báo lỗi thất bại.', 'error');
      }
    } catch {
      onShowToast('Lỗi', 'Không thể kết nối đến máy chủ.', 'error');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleRateMarketplaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingOrder) return;
    setIsSubmittingRating(true);
    const token = localStorage.getItem('wcg_auth_token') || sessionStorage.getItem('wcg_auth_token') || '';
    try {
      const res = await fetch(`/api/seller-orders/${ratingOrder.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stars: ratingStars, comment: ratingComment }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast('Đánh giá thành công!', data.message, 'success');
        setRatingOrder(null);
        setRatingComment('');
        loadMarketplaceOrders();
      } else {
        onShowToast('Lỗi', data.error || 'Đánh giá thất bại.', 'error');
      }
    } catch {
      onShowToast('Lỗi', 'Không thể kết nối đến máy chủ.', 'error');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleDisputeMarketplaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeOrder) return;
    setIsSubmittingDispute(true);
    const token = localStorage.getItem('wcg_auth_token') || sessionStorage.getItem('wcg_auth_token') || '';
    try {
      const res = await fetch(`/api/seller-orders/${disputeOrder.id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: disputeReason, detail: disputeDetail }),
      });
      const data = await res.json();
      if (data.success) {
        onShowToast('Gửi khiếu nại thành công!', data.message, 'success');
        setDisputeOrder(null);
        setDisputeDetail('');
        loadMarketplaceOrders();
      } else {
        onShowToast('Lỗi', data.error || 'Gửi khiếu nại thất bại.', 'error');
      }
    } catch {
      onShowToast('Lỗi', 'Không thể kết nối đến máy chủ.', 'error');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const u = dataService.getCurrentUser();
      if (u?.email && !lookupEmail) {
        setLookupEmail(u.email);
      }
      dataService.refreshCurrentUserBalance().then(() => loadAll());
      loadAll();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const unsub = dataService.subscribe(() => {
        loadAll();
      });
      const handleMissionRewardsUpdated = () => {
        setMissionRewardsList(dataService.getMissionRewards());
      };
      window.addEventListener('wcg_mission_rewards_updated', handleMissionRewardsUpdated);

      return () => {
        unsub();
        window.removeEventListener('wcg_mission_rewards_updated', handleMissionRewardsUpdated);
      };
    }
  }, [isOpen, lookupEmail]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupEmail.trim()) {
      onShowToast('Thông báo', 'Vui lòng nhập email để tra cứu mã VIP riêng.', 'info');
      return;
    }
    const found = dataService.getPrivateCodesForEmail(lookupEmail.trim());
    setPrivateCodesList(found);
    if (found.length > 0) {
      onShowToast('Tìm thấy mã VIP!', `Có ${found.length} mã code dành riêng cho ${lookupEmail}.`, 'success');
    } else {
      onShowToast('Chưa có mã', `Chưa tìm thấy mã VIP riêng nào cho email ${lookupEmail}.`, 'info');
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    marketingService.recordRealCopy('Mã đã nhận', '', 1);
    setCopied(code);
    onShowToast('Đã sao chép mã code!', code, 'success');
    setTimeout(() => setCopied(null), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-card border-t sm:border border-border/90 rounded-t-[28px] sm:rounded-3xl overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[88dvh] sm:max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed at top */}
        <div className="p-3.5 sm:p-5 border-b border-border/70 bg-card/95 backdrop-blur-md shrink-0 sticky top-0 z-20">
          {/* Mobile Sheet Indicator */}
          <div className="w-12 h-1.5 bg-slate-600/60 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 text-primary-light border border-primary/30 shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading font-bold text-base sm:text-lg text-foreground truncate">
                  Kho Mã Code Của Tôi
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  Mã sự kiện, đơn hàng, nhiệm vụ và mã VIP riêng
                </p>
              </div>
            </div>
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

        {/* Tab Switcher - 1 hàng duy nhất cho cả Desktop và Mobile 390px (§2.1) */}
        <div className="p-3 sm:p-4 pb-0 flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none shrink-0">
          <button
            onClick={() => setTab('giveaways')}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              tab === 'giveaways'
                ? 'bg-accent text-white shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Sự Kiện ({displayClaimedList.length})</span>
          </button>

          <button
            onClick={() => {
              setTab('orders');
              dataService.refreshCurrentUserBalance().then(() => loadAll());
            }}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              tab === 'orders'
                ? 'bg-secondary text-white shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Đã Mua ({displayOrdersList.length})</span>
          </button>

          <button
            onClick={() => {
              setTab('marketplace');
              loadMarketplaceOrders();
            }}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              tab === 'marketplace'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-purple-200" />
            <span>Sàn TMĐT ({marketplaceOrders.length})</span>
          </button>

          <button
            onClick={() => setTab('missions')}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              tab === 'missions'
                ? 'bg-gradient-to-r from-amber-500 to-emerald-600 text-white shadow-md'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-amber-300" />
            <span>Nhiệm Vụ ({missionRewardsList.length})</span>
          </button>

          <button
            onClick={() => setTab('privates')}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              tab === 'privates'
                ? 'bg-primary text-white shadow-glow-primary'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>VIP Phát Riêng ({privateCodesList.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {tab === 'giveaways' && (
            displayClaimedList.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Gift className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Bạn chưa nhận mã quà tặng nào từ sự kiện giveaway.</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">Hãy vào mục "Săn Giveaway" để giật giftcode miễn phí!</p>
              </div>
            ) : (
              displayClaimedList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-border-hover transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="font-heading font-bold text-sm text-foreground truncate">
                      {item.game_name}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      🎁 {item.rewards}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-primary-light font-mono">
                      <Clock className="w-3.5 h-3.5 shrink-0 text-accent" />
                      <span>Thời gian nhận: <strong className="text-foreground">{formatFullDateTime(item.claimed_at)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1.5 rounded-xl bg-card border border-border font-mono font-bold text-primary-light text-xs shadow-inner">
                      {item.code_value}
                    </span>
                    <button
                      onClick={() => handleCopy(item.code_value)}
                      className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      {copied === item.code_value ? (
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
              ))
            )
          )}

          {/* Tab Sàn TMĐT (§6.3: Tủ mã của khách & Báo lỗi 1 chạm) */}
          {tab === 'marketplace' && (
            marketplaceOrders.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Store className="w-10 h-10 mx-auto mb-2 opacity-30 text-purple-400" />
                <p className="text-xs">Bạn chưa mua mã nào từ các Gian Hàng trên Sàn TMĐT.</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">Truy cập gian hàng người bán để săn mã code giá tốt.</p>
              </div>
            ) : (
              marketplaceOrders.map((mOrder) => (
                <div
                  key={mOrder.id}
                  className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-purple-500/40 transition-colors shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {mOrder.seller_name || 'GIAN HÀNG'}
                      </span>
                      <h4 className="font-heading font-bold text-sm text-foreground truncate">
                        {mOrder.product_name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span>Giá: <strong className="text-amber-500">{mOrder.price_core} Core</strong></span>
                      <span>•</span>
                      <span>Mã đơn: <strong className="font-mono text-foreground">{mOrder.order_code}</strong></span>
                      <span>•</span>
                      <span>{formatRelativeDate(mOrder.created_at)}</span>
                    </div>

                    {/* Hiển thị đánh giá gian hàng đã gửi (§A) */}
                    {mOrder.rating_stars ? (
                      <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                        <span className="flex items-center text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-1" />
                          {mOrder.rating_stars} sao
                        </span>
                        {mOrder.rating_status === 'PENDING' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                            Đang chờ duyệt
                          </span>
                        )}
                        {mOrder.rating_status === 'APPROVED' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            Đã duyệt công khai
                          </span>
                        )}
                        {mOrder.rating_status === 'REJECTED' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20 font-medium" title={mOrder.rating_reject_reason}>
                            Bị từ chối {mOrder.rating_reject_reason ? `(${mOrder.rating_reject_reason})` : ''}
                          </span>
                        )}
                        {mOrder.rating_comment && (
                          <span className="text-[11px] text-muted-foreground italic truncate max-w-xs">
                            "{mOrder.rating_comment}"
                          </span>
                        )}
                      </div>
                    ) : null}

                    {/* Hiển thị mã thay thế nếu đã được shop đổi */}
                    {mOrder.replacement_code && (
                      <div className="mt-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">
                          ✓ Shop đã đổi mã mới cho bạn:
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-emerald-400 select-all">
                            {mOrder.replacement_code}
                          </span>
                          <button
                            onClick={() => handleCopy(mOrder.replacement_code)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 text-black text-[11px] font-bold hover:bg-emerald-400 transition-colors"
                          >
                            Chép mã mới
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Trạng thái xử lý tranh chấp / khiếu nại (§B) */}
                    {mOrder.status === 'DISPUTED' && (
                      <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                        <div className="text-amber-400 font-bold flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span>Đang trong diện khiếu nại (DISPUTED)</span>
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          Lý do: <strong className="text-foreground">{
                            mOrder.dispute_reason === 'WRONG_CODE' ? 'Mã sai định dạng / không tồn tại' :
                            mOrder.dispute_reason === 'USED_CODE' ? 'Mã đã qua sử dụng' :
                            mOrder.dispute_reason === 'EXPIRED_CODE' ? 'Mã đã hết hạn' :
                            mOrder.dispute_reason === 'NOT_AS_DESCRIBED' ? 'Mã không đúng mô tả' :
                            (mOrder.dispute_reason || mOrder.report_reason || 'Khiếu nại mã')
                          }</strong>
                          {mOrder.dispute_detail && ` — "${mOrder.dispute_detail}"`}
                        </div>
                        {mOrder.dispute_seller_response && (
                          <div className="text-[11px] bg-card p-2 rounded-lg border border-border mt-1">
                            <span className="text-primary-light font-semibold block">Phản hồi từ người bán:</span>
                            <span className="text-foreground">{mOrder.dispute_seller_response}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5 italic">
                          Tiền đơn đang được tạm giữ an toàn, chờ Ban Quản Trị xem xét giải quyết.
                        </div>
                      </div>
                    )}

                    {mOrder.status === 'REPORTED' && (
                      <div className="mt-2 text-[11px] text-destructive font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Đã gửi báo lỗi ({mOrder.report_reason === 'expired' ? 'Hết hạn' : 'Không dùng được'}). Đang chờ shop đổi mã hoặc hoàn Core.</span>
                      </div>
                    )}

                    {mOrder.status === 'REFUNDED' && (
                      <div className="mt-2 p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-300 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                        <span>Người bán / Sàn đã hoàn lại {mOrder.price_core} Core vào ví của bạn. {mOrder.resolution_note || mOrder.dispute_resolution_note || ''}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                    <span className="px-3 py-1.5 rounded-xl bg-muted/80 border border-border font-mono font-bold text-primary-light text-xs shadow-inner select-all">
                      {mOrder.delivered_code}
                    </span>
                    <button
                      onClick={() => handleCopy(mOrder.delivered_code)}
                      className="px-2.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      title="Sao chép mã"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copied === mOrder.delivered_code ? 'Đã chép' : 'Chép'}</span>
                    </button>

                    {/* Nút Đánh Giá Gian Hàng (§A) */}
                    {(mOrder.status === 'PAID' || mOrder.status === 'COMPLETED' || mOrder.status === 'DELIVERED') && !mOrder.rating_stars && (
                      <button
                        onClick={() => {
                          setRatingOrder(mOrder);
                          setRatingStars(5);
                          setRatingComment('');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Đánh giá gian hàng người bán"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>Đánh Giá</span>
                      </button>
                    )}

                    {/* Nút Khiếu Nại Tự Động Trong Thời Gian Giữ Tiền (§B) */}
                    {mOrder.status === 'PAID' && !mOrder.dispute_id && (
                      <button
                        onClick={() => {
                          setDisputeOrder(mOrder);
                          setDisputeReason('WRONG_CODE');
                          setDisputeDetail('');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Gửi khiếu nại mã lỗi trong 168h giữ tiền"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Khiếu Nại</span>
                      </button>
                    )}

                    {/* Nút Báo Lỗi Một Chạm Cũ (§6.3) */}
                    {mOrder.status === 'DELIVERED' && (
                      <button
                        onClick={() => {
                          setReportingOrder(mOrder);
                          setReportReason('not_working');
                          setReportNote('');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Báo mã lỗi 1 chạm để shop đổi mã mới hoặc hoàn tiền"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Báo Lỗi</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )
          )}

          {tab === 'missions' && (
            <div className="space-y-3">
              {!currentUser ? (
                <div className="py-12 text-center text-muted-foreground p-6 rounded-2xl bg-muted/20 border border-border/80">
                  <Target className="w-10 h-10 mx-auto mb-2 opacity-40 text-amber-400" />
                  <p className="text-sm font-bold text-foreground">Bạn chưa đăng nhập tài khoản</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Vui lòng đăng nhập để xem danh sách giftcode và phần thưởng nhận được khi hoàn thành các nhiệm vụ.
                  </p>
                  {onOpenAuth && (
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="mt-4 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-glow-primary cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <span>Đăng Nhập Ngay</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : missionRewardsList.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground p-6 rounded-2xl bg-muted/20 border border-border/80">
                  <Award className="w-10 h-10 mx-auto mb-2 opacity-40 text-amber-400" />
                  <p className="text-sm font-bold text-foreground">Bạn chưa có mã quà tặng nào từ nhiệm vụ</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    Khi bạn hoàn thành các nhiệm vụ cộng đồng và được hệ thống (hoặc AI) xét duyệt thành công, mã giftcode độc quyền sẽ được tự động chuyển thẳng vào mục này!
                  </p>
                  {onNavigateToMissions && (
                    <button
                      type="button"
                      onClick={onNavigateToMissions}
                      className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:opacity-95 text-white text-xs font-bold transition-all shadow-md cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>Khám Phá & Làm Nhiệm Vụ Ngay</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                missionRewardsList.map((item: any) => {
                  const isCode = item.reward_type === 'CODE' || (item.reward_delivered && !String(item.reward_delivered).startsWith('+'));
                  const displayReward = item.reward_delivered || (item.reward_value ? `${item.reward_value}đ` : 'Phần thưởng nhiệm vụ');
                  const approvalTime = item.reviewed_at || item.updated_at || item.created_at;
                  const reviewerLabel = item.reviewed_by === 'AI' || item.reviewed_by === 'AI_ASSISTANT'
                    ? 'AI Hệ Thống (Duyệt Tự Động)'
                    : (item.reviewed_by || 'Ban Quản Trị');

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-card to-emerald-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md hover:border-amber-500/50 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/20 to-emerald-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            HOÀN THÀNH NHIỆM VỤ
                          </span>
                          <h4 className="font-heading font-bold text-sm text-foreground truncate">
                            {item.mission_title || 'Nhiệm vụ cộng đồng'}
                          </h4>
                        </div>

                        <p className="text-xs text-primary-light font-medium mt-1">
                          🎁 {isCode ? 'Mã Giftcode Nhận Được' : 'Thưởng Số Dư Ví'}: <strong className="text-emerald-400 font-bold">{displayReward}</strong>
                        </p>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground font-mono">
                          {approvalTime && (
                            <span className="flex items-center gap-1 text-emerald-400">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>Thời gian duyệt: <strong className="text-foreground">{formatFullDateTime(approvalTime)}</strong></span>
                            </span>
                          )}
                          <span>Duyệt bởi: <strong className="text-foreground">{reviewerLabel}</strong></span>
                        </div>
                      </div>

                      {isCode && item.reward_delivered && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-3.5 py-1.5 rounded-xl bg-card border border-amber-500/50 font-mono font-bold text-amber-300 text-xs shadow-inner select-all">
                            {item.reward_delivered}
                          </span>
                          <button
                            onClick={() => handleCopy(item.reward_delivered)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:opacity-95 text-white text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-1"
                          >
                            {copied === item.reward_delivered ? (
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
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'privates' && (
            <div className="space-y-4">
              {/* Email Lookup Box */}
              <form onSubmit={handleLookup} className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary-light" />
                  <span>Tra cứu mã VIP phát riêng theo Email của bạn</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={lookupEmail}
                    onChange={(e) => setLookupEmail(e.target.value)}
                    placeholder="Nhập email của bạn (VD: an.nguyen@gmail.com)..."
                    className="flex-1 px-3 py-2 rounded-xl bg-card border border-border text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-glow-primary shrink-0"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Kiểm Tra</span>
                  </button>
                </div>
              </form>

              {privateCodesList.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30 text-amber-400" />
                  <p className="text-xs">
                    {lookupEmail ? `Chưa có mã VIP nào được gửi tới ${lookupEmail}.` : 'Vui lòng nhập email hoặc đăng nhập để xem mã VIP riêng.'}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    Mã VIP sẽ được Ban Quản Trị cấp riêng qua email thành viên thân thiết.
                  </p>
                </div>
              ) : (
                privateCodesList.map((priv: any) => {
                  const receiveTime = priv.createdAt || priv.created_at || priv.issuedAt || priv.issued_at;
                  return (
                    <div
                      key={priv.id}
                      className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-card to-accent/10 border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                            MÃ VIP RIÊNG
                          </span>
                          <h4 className="font-heading font-bold text-sm text-foreground truncate">
                            {priv.title || 'Mã Quà Tặng Độc Quyền VIP'}
                          </h4>
                        </div>
                        <p className="text-xs text-primary-light font-medium mt-1">
                          🎁 {priv.rewards}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground font-mono">
                          {receiveTime && (
                            <span className="flex items-center gap-1 text-amber-300">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>Thời gian cấp: <strong className="text-foreground">{formatFullDateTime(receiveTime)}</strong></span>
                            </span>
                          )}
                          <span>Dành cho: {priv.memberEmail}</span>
                          <span>Hạn dùng: {priv.expiresAt || 'Không giới hạn'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-3.5 py-1.5 rounded-xl bg-card border border-primary/50 font-mono font-bold text-amber-300 text-xs shadow-inner">
                          {priv.codeValue}
                        </span>
                        <button
                          onClick={() => handleCopy(priv.codeValue)}
                          className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all cursor-pointer shadow-glow-primary flex items-center gap-1"
                        >
                          {copied === priv.codeValue ? (
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
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Modal Báo Mã Lỗi 1 Chạm (§6.3) */}
        {reportingOrder && (
          <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 animate-scale-in">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-destructive flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> Báo Lỗi Mã Đã Mua
                </h4>
                <button onClick={() => setReportingOrder(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs bg-muted/60 p-3 rounded-xl space-y-1">
                <div>Gói: <strong>{reportingOrder.product_name}</strong></div>
                <div>Shop: <strong>{reportingOrder.seller_name}</strong></div>
                <div className="font-mono text-muted-foreground text-[11px]">Mã: {reportingOrder.delivered_code}</div>
              </div>

              <form onSubmit={handleReportMarketplaceOrder} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Lý do báo lỗi *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReportReason('not_working')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                        reportReason === 'not_working'
                          ? 'bg-destructive/10 border-destructive text-destructive'
                          : 'border-border bg-background text-muted-foreground'
                      }`}
                    >
                      Nhập Không Được
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportReason('expired')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all ${
                        reportReason === 'expired'
                          ? 'bg-destructive/10 border-destructive text-destructive'
                          : 'border-border bg-background text-muted-foreground'
                      }`}
                    >
                      Mã Đã Hết Hạn
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Ghi chú thêm (Tùy chọn)</label>
                  <input
                    type="text"
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                    placeholder="Mô tả lỗi gặp phải..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportingOrder(null)}
                    className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="px-4 py-1.5 rounded-xl bg-destructive text-white font-bold shadow-sm disabled:opacity-50"
                  >
                    {isSubmittingReport ? 'Đang gửi...' : 'Gửi Báo Lỗi Cho Shop'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Đánh Giá Gian Hàng (§A) */}
        {ratingOrder && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 animate-scale-in">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> Đánh Giá Gian Hàng
                </h4>
                <button onClick={() => setRatingOrder(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs bg-muted/60 p-3 rounded-xl space-y-1">
                <div>Shop: <strong>{ratingOrder.seller_name}</strong></div>
                <div>Gói: <strong>{ratingOrder.product_name}</strong></div>
                <div className="font-mono text-muted-foreground text-[11px]">Đơn: {ratingOrder.order_code}</div>
              </div>

              <form onSubmit={handleRateMarketplaceOrder} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold mb-1.5">Mức độ hài lòng *</label>
                  <div className="flex items-center justify-center gap-2 p-3 bg-muted/30 rounded-xl border border-border/80">
                    {[1, 2, 3, 4, 5].map((starVal) => (
                      <button
                        type="button"
                        key={starVal}
                        onClick={() => setRatingStars(starVal)}
                        className="p-1 hover:scale-125 transition-transform"
                      >
                        <Star
                          className={`w-7 h-7 ${
                            starVal <= ratingStars
                              ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                              : 'text-muted-foreground/30 hover:text-amber-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="text-center font-bold text-amber-400 text-xs mt-1">
                    {ratingStars === 5 ? '5 sao — Rất hài lòng' :
                     ratingStars === 4 ? '4 sao — Hài lòng' :
                     ratingStars === 3 ? '3 sao — Bình thường' :
                     ratingStars === 2 ? '2 sao — Chưa hài lòng' :
                     '1 sao — Rất thất vọng'}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Nhận xét chi tiết (Tùy chọn, tối đa 500 ký tự)</label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Mã dùng tốt, giao nhanh, shop hỗ trợ nhiệt tình..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:border-amber-400 text-xs resize-none"
                  />
                  <div className="text-[10px] text-muted-foreground text-right mt-0.5">
                    {ratingComment.length}/500 ký tự
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground bg-muted/30 p-2 rounded-lg">
                  ℹ️ Đánh giá sẽ được Ban Quản Trị duyệt trước khi hiển thị công khai trên trang gian hàng.
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setRatingOrder(null)}
                    className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRating}
                    className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-sm disabled:opacity-50 transition-colors"
                  >
                    {isSubmittingRating ? 'Đang gửi...' : 'Gửi Đánh Giá'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Gửi Khiếu Nại Tự Động (§B) */}
        {disputeOrder && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-destructive/30 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 animate-scale-in">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-destructive flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> Khiếu Nại Đơn Hàng Sàn
                </h4>
                <button onClick={() => setDisputeOrder(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs bg-muted/60 p-3 rounded-xl space-y-1">
                <div>Shop: <strong>{disputeOrder.seller_name}</strong></div>
                <div>Gói: <strong>{disputeOrder.product_name}</strong></div>
                <div className="font-mono text-muted-foreground text-[11px]">Đơn: {disputeOrder.order_code}</div>
              </div>

              <div className="text-[11px] bg-destructive/10 border border-destructive/20 text-destructive p-2.5 rounded-xl leading-relaxed">
                ⚠️ Khiếu nại sẽ lập tức chuyển đơn sang trạng thái tranh chấp (DISPUTED) và tạm khóa giải ngân tiền cho shop. Người bán sẽ có cơ hội phản hồi hoặc cấp mã mới.
              </div>

              <form onSubmit={handleDisputeMarketplaceOrder} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Lý do khiếu nại *</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'WRONG_CODE', label: 'Mã Sai Định Dạng' },
                      { id: 'USED_CODE', label: 'Mã Đã Qua Sử Dụng' },
                      { id: 'EXPIRED_CODE', label: 'Mã Đã Hết Hạn' },
                      { id: 'NOT_AS_DESCRIBED', label: 'Không Đúng Mô Tả' },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => setDisputeReason(opt.id)}
                        className={`p-2 rounded-xl border text-center font-bold text-[11px] transition-all ${
                          disputeReason === opt.id
                            ? 'bg-destructive/15 border-destructive text-destructive shadow-sm'
                            : 'border-border bg-background text-muted-foreground hover:border-border/80'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Mô tả chi tiết lỗi gặp phải *</label>
                  <textarea
                    rows={3}
                    maxLength={500}
                    required
                    value={disputeDetail}
                    onChange={(e) => setDisputeDetail(e.target.value)}
                    placeholder="Mô tả cụ thể thông báo lỗi khi bạn nhập mã vào game/ứng dụng..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:border-destructive text-xs resize-none"
                  />
                  <div className="text-[10px] text-muted-foreground text-right mt-0.5">
                    {disputeDetail.length}/500 ký tự
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDisputeOrder(null)}
                    className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted font-semibold"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDispute}
                    className="px-4 py-1.5 rounded-xl bg-destructive hover:opacity-95 text-white font-bold shadow-sm disabled:opacity-50 transition-opacity"
                  >
                    {isSubmittingDispute ? 'Đang gửi...' : 'Gửi Khiếu Nại Cho Sàn'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
