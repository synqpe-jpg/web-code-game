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
} from 'lucide-react';
import { dataService } from '../services/dataService';
import type { ClaimedCodeRecord, OrderRecord } from '../types/game';
import { formatCore, formatRelativeDate, formatFullDateTime } from '../utils/textUtils';
import { GuideLinksBanner } from './GuideLinksBanner';

interface MyReceivedCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

export const MyReceivedCodesModal: React.FC<MyReceivedCodesModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [tab, setTab] = useState<'giveaways' | 'orders' | 'privates'>('giveaways');
  const [copied, setCopied] = useState<string | null>(null);
  
  // Real-time state
  const [claimedList, setClaimedList] = useState<ClaimedCodeRecord[]>([]);
  const [ordersList, setOrdersList] = useState<OrderRecord[]>([]);
  const [privateCodesList, setPrivateCodesList] = useState<any[]>([]);
  const [lookupEmail, setLookupEmail] = useState<string>('');

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
      return () => unsub();
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
                  Mã sự kiện, đơn hàng và mã VIP riêng
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

        {/* Tab Switcher */}
        <div className="p-4 pb-0 flex flex-wrap gap-2">
          <button
            onClick={() => setTab('giveaways')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'giveaways'
                ? 'bg-accent text-white shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Sự Kiện ({displayClaimedList.length})</span>
          </button>

          <button
            onClick={() => setTab('orders')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              tab === 'orders'
                ? 'bg-secondary text-white shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Đã Mua ({displayOrdersList.length})</span>
          </button>

          <button
            onClick={() => setTab('privates')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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

          {tab === 'orders' && (
            displayOrdersList.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Bạn chưa có đơn hàng mua gói code nào.</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">Truy cập "Cửa Hàng Code" để mua gói nạp và giftcode chiết khấu.</p>
              </div>
            ) : (
              displayOrdersList.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-border-hover transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="font-heading font-bold text-sm text-foreground truncate">
                      {order.product_title}
                    </h4>
                    <p className="text-xs text-secondary font-medium mt-0.5">
                      {order.game_name} • {formatCore(order.amount)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground font-mono">
                      <span>Mã đơn: <strong className="text-foreground">{order.id}</strong></span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Thời gian nhận: <strong className="text-foreground">{formatFullDateTime(order.created_at)}</strong></span>
                      </span>
                    </div>

                    {(() => {
                      const linkedItem = (dataService.getStoreProducts ? dataService.getStoreProducts().find((p) => p.id === order.product_id) : null)
                        || (dataService.getUtilities ? dataService.getUtilities().find((u) => u.id === order.product_id) : null);
                      if (!linkedItem) return null;
                      return (
                        <div className="mt-1.5">
                          <GuideLinksBanner
                            guideLinks={linkedItem.guide_links}
                            guideUrl={linkedItem.guide_url}
                            guideText={linkedItem.guide_text}
                            showGuide={linkedItem.show_guide_link !== false}
                            size="sm"
                            theme={'category' in linkedItem ? 'teal' : 'indigo'}
                          />
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1.5 rounded-xl bg-card border border-border font-mono font-bold text-emerald-400 text-xs shadow-inner">
                      {order.code_content}
                    </span>
                    <button
                      onClick={() => handleCopy(order.code_content)}
                      className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/90 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      {copied === order.code_content ? (
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
      </div>
    </div>,
    document.body
  );
};
