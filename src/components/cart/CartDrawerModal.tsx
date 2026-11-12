import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingCart,
  X,
  Trash2,
  Store,
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronRight,
  RefreshCw,
  Clock,
  ExternalLink,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { cartService, type CartItem, type StoreCartGroup } from '../../services/cartService';
import { dataService } from '../../services/dataService';
import type { UserProfile } from '../../types/game';
import { formatCore } from '../../utils/textUtils';
import QRCode from 'qrcode';

interface CartDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onOpenLogin: () => void;
  onOpenWallet: () => void;
  onOpenReceivedCodes: (initialTab?: 'giveaways' | 'orders' | 'privates' | 'missions') => void;
  onNavigateStore?: (slug: string) => void;
}

export const CartDrawerModal: React.FC<CartDrawerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenLogin,
  onOpenWallet,
  onOpenReceivedCodes,
  onNavigateStore,
}) => {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => cartService.getCart());
  const [groupedStores, setGroupedStores] = useState<StoreCartGroup[]>(() => cartService.getGroupedBySeller());
  const [totalCore, setTotalCore] = useState<number>(() => cartService.getCartTotal());

  // Checkout states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string>('');
  const [activeParentOrder, setActiveParentOrder] = useState<any | null>(null);
  const [activeChildOrders, setActiveChildOrders] = useState<any[]>([]);
  const [paymentMode, setPaymentMode] = useState<'CORE' | 'QR'>('CORE');
  const [isPayingCore, setIsPayingCore] = useState(false);
  const [corePayError, setCorePayError] = useState<string>('');
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(900);

  const pollingTimerRef = useRef<any>(null);

  // Sync cart from service & events
  const syncCartState = () => {
    const items = cartService.getCart();
    setCartItems(items);
    setGroupedStores(cartService.getGroupedBySeller());
    setTotalCore(cartService.getCartTotal());
  };

  useEffect(() => {
    syncCartState();
    const handleCartUpdated = () => syncCartState();
    window.addEventListener('wcg_cart_updated', handleCartUpdated);
    return () => window.removeEventListener('wcg_cart_updated', handleCartUpdated);
  }, [isOpen]);

  // Generate QR code data URLs for child orders
  useEffect(() => {
    if (!activeChildOrders || activeChildOrders.length === 0) return;

    activeChildOrders.forEach(async (co) => {
      if (co.qr_payload && !qrImages[co.id]) {
        try {
          const url = await QRCode.toDataURL(co.qr_payload, {
            errorCorrectionLevel: 'M',
            margin: 1.5,
            width: 220,
            color: { dark: '#0b0d19', light: '#ffffff' },
          });
          setQrImages((prev) => ({ ...prev, [co.id]: url }));
        } catch (err) {
          console.error('[QR generation error]', err);
        }
      }
    });
  }, [activeChildOrders]);

  // Polling for Parent Order status updates
  useEffect(() => {
    if (!isOpen || !activeParentOrder || activeParentOrder.status === 'COMPLETED' || activeParentOrder.status === 'PAID') {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      return;
    }

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/seller-orders/multi/${activeParentOrder.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.parent_order) {
          setActiveParentOrder(data.parent_order);
          setActiveChildOrders(data.child_orders || []);
          if (typeof data.parent_order.seconds_left === 'number') {
            setSecondsLeft(data.parent_order.seconds_left);
          }
          if (data.parent_order.status === 'PAID' || data.parent_order.status === 'COMPLETED') {
            dataService.refreshCurrentUserBalance().catch(() => {});
          }
        }
      } catch {}
    };

    pollingTimerRef.current = setInterval(pollStatus, 3500);
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [isOpen, activeParentOrder]);

  // Countdown timer
  useEffect(() => {
    if (!activeParentOrder || secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [activeParentOrder, secondsLeft]);

  if (!isOpen) return null;

  const handleRemoveItem = (prodId: string) => {
    cartService.removeFromCart(prodId);
  };

  const handleClearCart = () => {
    if (window.confirm('Bạn có chắc muốn xóa tất cả sản phẩm khỏi giỏ hàng?')) {
      cartService.clearCart();
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helper auth headers
  const getHeaders = () => {
    const token =
      (typeof localStorage !== 'undefined' ? localStorage.getItem('wcg_auth_token') : null) ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('wcg_auth_token') : null) ||
      currentUser?.session_token ||
      '';
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      h['Authorization'] = `Bearer ${token}`;
    }
    return h;
  };

  // 1. Submit Multi-Order to create parent + child orders
  const handleCreateOrder = async () => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }

    if (cartItems.length === 0) return;

    setIsSubmitting(true);
    setCheckoutError('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const itemsPayload = cartItems.map((i) => ({ product_id: i.productId }));
      const res = await fetch('/api/seller-orders/multi', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ items: itemsPayload }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error('Máy chủ phản hồi không đúng định dạng. Vui lòng thử lại sau.');
      }

      if (!res.ok || !data.success) {
        setCheckoutError(data.error || 'Tạo đơn hàng đa gian hàng thất bại.');
        return;
      }

      // Success: active parent order created!
      setActiveParentOrder(data.parent_order);
      setActiveChildOrders(data.child_orders || []);
      setSecondsLeft(data.parent_order.seconds_left || 900);
      // Clear cart once order is confirmed
      cartService.clearCart();
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setCheckoutError('Thời gian phản hồi từ máy chủ quá lâu (hơn 15 giây). Đơn hàng chưa được tạo, vui lòng bấm thử lại.');
      } else {
        setCheckoutError(err?.message || 'Lỗi kết nối máy chủ khi tạo đơn hàng. Vui lòng thử lại.');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  };

  // 2. Pay Multi-Order with Core Wallet
  const handlePayWithCore = async () => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    if (!activeParentOrder) return;

    setIsPayingCore(true);
    setCorePayError('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`/api/seller-orders/multi/${activeParentOrder.id}/pay-core`, {
        method: 'POST',
        headers: getHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error('Máy chủ phản hồi không đúng định dạng khi trừ ví.');
      }

      if (!res.ok || !data.success) {
        setCorePayError(data.error || 'Thanh toán bằng ví Core thất bại.');
        return;
      }

      // Successful payment!
      setActiveParentOrder((prev: any) => ({ ...prev, status: 'PAID' }));
      if (Array.isArray(data.child_orders)) {
        setActiveChildOrders(data.child_orders);
      }

      // Update local wallet balance immediately
      if (typeof data.new_balance === 'number') {
        const u = dataService.getCurrentUser();
        if (u) {
          u.wallet_balance = data.new_balance;
          dataService.saveCurrentUser(u);
        }
      }
      dataService.refreshCurrentUserBalance().catch(() => {});
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setCorePayError('Hết thời gian chờ phản hồi thanh toán (hơn 15 giây). Vui lòng thử lại hoặc kiểm tra lịch sử đơn hàng.');
      } else {
        setCorePayError(err?.message || 'Lỗi kết nối khi thanh toán bằng ví Core.');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsPayingCore(false);
    }
  };

  const userBalance = Number(currentUser?.wallet_balance || 0);
  const isPaid = activeParentOrder?.status === 'PAID' || activeParentOrder?.status === 'COMPLETED';
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Giỏ hàng đa gian hàng"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">Giỏ Hàng Đa Gian Hàng</h3>
                {cartItems.length > 0 && !activeParentOrder && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/20 text-primary">
                    {cartItems.length} món
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {!activeParentOrder
                  ? 'Gom đơn từ nhiều gian hàng, thanh toán tự động 1 chạm'
                  : `Mã đơn tổng: ${activeParentOrder.parent_order_code || activeParentOrder.id}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!activeParentOrder && cartItems.length > 0 && (
              <button
                onClick={handleClearCart}
                className="text-[11px] font-semibold text-muted-foreground hover:text-destructive px-2 py-1 rounded-lg hover:bg-destructive/10 transition-colors"
                title="Xóa toàn bộ giỏ hàng"
              >
                Xóa tất cả
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* SCENARIO A: Viewing Active Order (Payment or Delivery Screen) */}
          {activeParentOrder ? (
            <div className="space-y-4">
              {/* Status Header Banner */}
              {isPaid ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      Thanh Toán Thành Công! Đã Giao Mã 0 Giây
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Tất cả các mã giftcode của bạn đã được giải mã và bàn giao bên dưới.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 animate-spin" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground">Chờ Thanh Toán Đơn Hàng</div>
                      <div className="text-xs text-muted-foreground">
                        Mã đơn tổng: <span className="font-mono font-semibold text-foreground">{activeParentOrder.parent_order_code}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase">Hết hạn sau</div>
                    <div className="font-mono text-base font-black text-amber-500">
                      {formatTime(secondsLeft)}
                    </div>
                  </div>
                </div>
              )}

              {/* PAYMENT SECTION (If Not Paid) */}
              {!isPaid && (
                <div className="space-y-3">
                  {/* Mode Selector Tabs */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-muted/60 rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('CORE')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        paymentMode === 'CORE'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Wallet className="w-4 h-4 text-amber-500" />
                      Ví Core Nội Bộ ({userBalance.toLocaleString()} Core)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('QR')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        paymentMode === 'QR'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <QrCode className="w-4 h-4 text-emerald-500" />
                      Chuyển Khoản VietQR (SePay)
                    </button>
                  </div>

                  {corePayError && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{corePayError}</span>
                    </div>
                  )}

                  {/* Mode 1: Core Wallet Payment */}
                  {paymentMode === 'CORE' && (
                    <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tổng tiền đơn hàng:</span>
                        <span className="font-bold text-foreground text-sm">
                          {Number(activeParentOrder.total_amount).toLocaleString()} Core
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Số dư ví Core của bạn:</span>
                        <span
                          className={`font-bold text-sm ${
                            userBalance >= Number(activeParentOrder.total_amount)
                              ? 'text-emerald-500'
                              : 'text-destructive'
                          }`}
                        >
                          {userBalance.toLocaleString()} Core
                        </span>
                      </div>

                      {userBalance >= Number(activeParentOrder.total_amount) ? (
                        <button
                          disabled={isPayingCore}
                          onClick={handlePayWithCore}
                          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-95 shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isPayingCore ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" /> Đang trừ ví Core...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" /> Xác Nhận Thanh Toán (
                              {Number(activeParentOrder.total_amount).toLocaleString()} Core)
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[11px] text-destructive text-center">
                            Số dư ví không đủ để thanh toán. Bạn còn thiếu{' '}
                            {(Number(activeParentOrder.total_amount) - userBalance).toLocaleString()} Core.
                          </p>
                          <button
                            onClick={onOpenWallet}
                            className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:opacity-95 shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                          >
                            <Wallet className="w-4 h-4" /> Nạp Thêm Core Vào Ví
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode 2: VietQR Banking Payment for Child Orders */}
                  {paymentMode === 'QR' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-muted/60 border border-border text-[11px] text-muted-foreground leading-relaxed">
                        💡 Chuyển khoản chính xác <strong>Số Tiền</strong> và <strong>Nội Dung</strong> cho từng đơn con dưới đây. Hệ thống sẽ tự động quét biến động và giao mã ngay khi tiền vào tài khoản.
                      </div>

                      <div className="space-y-3">
                        {activeChildOrders.map((co) => (
                          <div
                            key={co.id}
                            className="p-4 rounded-xl bg-card border border-border space-y-3"
                          >
                            <div className="flex items-center justify-between border-b border-border/60 pb-2">
                              <div>
                                <div className="text-xs font-bold text-foreground">{co.product_name}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  Gian hàng: <span className="font-semibold text-foreground">{co.seller_name}</span> • Mã đơn con:{' '}
                                  <span className="font-mono text-primary font-bold">{co.order_code}</span>
                                </div>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  co.status === 'PAID' || co.status === 'COMPLETED'
                                    ? 'bg-emerald-500/20 text-emerald-500'
                                    : 'bg-amber-500/20 text-amber-500'
                                }`}
                              >
                                {co.status === 'PAID' || co.status === 'COMPLETED' ? 'Đã Thanh Toán' : 'Chờ Chuyển Khoản'}
                              </span>
                            </div>

                            {co.status !== 'PAID' && co.status !== 'COMPLETED' ? (
                              co.qr_allowed === false || (!co.qr_payload && !co.qr_content) ? (
                                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
                                  <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    Chỉ hỗ trợ thanh toán bằng Ví Core
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Gian hàng <strong>{co.seller_name}</strong> hiện chưa mở cổng chuyển khoản QR SePay tiền thật. Vui lòng chuyển sang tab <strong>Ví Core Nội Bộ</strong> phía trên để hoàn tất thanh toán cho đơn này.
                                  </p>
                                </div>
                              ) : (
                              <div className="flex flex-col sm:flex-row items-center gap-4">
                                <div className="p-2 rounded-xl bg-white shadow-sm border border-border shrink-0">
                                  {qrImages[co.id] ? (
                                    <img
                                      src={qrImages[co.id]}
                                      alt="VietQR Code"
                                      className="w-36 h-36 object-contain"
                                    />
                                  ) : (
                                    <div className="w-36 h-36 flex items-center justify-center text-slate-400">
                                      <RefreshCw className="w-6 h-6 animate-spin" />
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 space-y-2 text-xs w-full">
                                  <div>
                                    <div className="text-[10px] text-muted-foreground">Ngân hàng & Số tài khoản</div>
                                    <div className="font-bold text-foreground">
                                      {co.bank_name || 'TPBank'} •{' '}
                                      <span className="font-mono">{co.account_number || '10004681879'}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground uppercase">{co.bank_account || 'CODE GAME SHOP'}</div>
                                  </div>

                                  <div>
                                    <div className="text-[10px] text-muted-foreground">Số tiền chuyển khoản</div>
                                    <div className="font-mono text-sm font-black text-emerald-500">
                                      {Number(co.price_core).toLocaleString()} VNĐ
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[10px] text-muted-foreground">Nội dung chuyển khoản (bắt buộc)</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 select-all">
                                        {co.qr_content || `WCG ${co.order_code}`}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(co.qr_content || `WCG ${co.order_code}`, `qr_${co.id}`)}
                                        className="p-1 rounded text-muted-foreground hover:text-foreground"
                                        title="Sao chép nội dung"
                                      >
                                        {copiedKey === `qr_${co.id}` ? (
                                          <Check className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                          <Copy className="w-4 h-4" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          ) : (
                              /* Đơn con đã hoàn tất -> hiển thị code */
                              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                                <div className="text-[10px] font-semibold text-emerald-500 uppercase">Mã code đã nhận:</div>
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-sm text-foreground select-all">
                                    {co.delivered_code || '(Mã đang sẵn sàng)'}
                                  </span>
                                  {co.delivered_code && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(co.delivered_code, `code_${co.id}`)}
                                      className="px-2 py-1 rounded bg-card text-[11px] font-semibold border border-border flex items-center gap-1"
                                    >
                                      {copiedKey === `code_${co.id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                      {copiedKey === `code_${co.id}` ? 'Đã chép' : 'Sao chép'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DELIVERED CODES LIST (When Paid or Partially Paid) */}
              {isPaid && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Danh Sách Giftcode Đã Giao ({activeChildOrders.length} món)
                  </h4>
                  <div className="space-y-2.5">
                    {activeChildOrders.map((co) => (
                      <div
                        key={co.id}
                        className="p-3.5 rounded-xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-foreground">{co.product_name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Gian hàng: <span className="font-semibold text-foreground">{co.seller_name}</span> • Mã đơn con:{' '}
                            <span className="font-mono text-primary font-bold">{co.order_code}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1.5 rounded-lg bg-muted border border-border font-mono text-xs font-black text-primary select-all">
                            {co.delivered_code || '(Mã đang mở khóa)'}
                          </div>
                          {co.delivered_code && (
                            <button
                              type="button"
                              onClick={() => handleCopy(co.delivered_code, `code_del_${co.id}`)}
                              className="p-1.5 rounded-lg bg-card hover:bg-card-hover border border-border text-xs flex items-center gap-1 shadow-sm"
                              title="Sao chép mã"
                            >
                              {copiedKey === `code_del_${co.id}` ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                    <button
                      onClick={() => {
                        onClose();
                        onOpenReceivedCodes('orders');
                      }}
                      className="w-full sm:flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-95 shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-4 h-4" /> Mở Tủ Mã Của Tôi
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-card border border-border text-xs font-bold hover:bg-card-hover transition-all"
                    >
                      Xong
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* SCENARIO B: Shopping Cart Overview (Viewing items before order creation) */
            <>
              {cartItems.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-muted/60 text-muted-foreground/40 flex items-center justify-center mx-auto">
                    <ShoppingCart className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Giỏ hàng của bạn đang trống</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Hãy ghé thăm các gian hàng của người bán uy tín để chọn gói giftcode và tiện ích game bạn yêu thích.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="mt-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-95 shadow-sm transition-all"
                  >
                    Khám Phá Gian Hàng
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {checkoutError && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  {/* Grouped by Seller */}
                  {groupedStores.map((store) => (
                    <div
                      key={store.sellerId}
                      className="rounded-2xl bg-card border border-border overflow-hidden"
                    >
                      {/* Store Header */}
                      <div className="px-4 py-2.5 bg-muted/40 border-b border-border/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-bold text-xs text-foreground">{store.sellerName}</span>
                          {store.sellerSlug && onNavigateStore && (
                            <button
                              onClick={() => {
                                onClose();
                                onNavigateStore(store.sellerSlug!);
                              }}
                              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                            >
                              Ghé shop <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <span className="text-xs font-semibold text-muted-foreground">
                          {store.subtotal.toLocaleString()} Core
                        </span>
                      </div>

                      {/* Items List */}
                      <div className="divide-y divide-border/60">
                        {store.items.map((item) => (
                          <div
                            key={item.productId}
                            className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {item.coverUrl ? (
                                <img
                                  src={item.coverUrl}
                                  alt=""
                                  className="w-11 h-11 rounded-xl object-cover shrink-0 border border-border"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border">
                                  <ShoppingCart className="w-5 h-5 opacity-40" />
                                </div>
                              )}

                              <div className="min-w-0 truncate">
                                {item.gameName && (
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                    {item.gameName}
                                  </span>
                                )}
                                <h4 className="text-xs font-bold text-foreground truncate" title={item.productName}>
                                  {item.productName}
                                </h4>
                                <div className="text-xs font-black text-primary mt-0.5">
                                  {item.priceCore.toLocaleString()} Core
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleRemoveItem(item.productId)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                              title="Xóa sản phẩm này"
                              aria-label="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer (When in Cart Overview) */}
        {!activeParentOrder && cartItems.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-border/80 bg-muted/20 space-y-3 shrink-0">
            {checkoutError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{checkoutError}</div>
                  <div className="text-[11px] text-destructive/80 mt-0.5">
                    Đơn hàng chưa được tạo và kho mã được bảo toàn. Bạn có thể kiểm tra lại hoặc bấm đặt hàng lại.
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tổng ({cartItems.length} sản phẩm):</span>
              <div className="text-right">
                <span className="font-mono text-base font-black text-primary">
                  {totalCore.toLocaleString()} Core
                </span>
                <span className="text-[11px] text-muted-foreground ml-1">(1 Core = 1 VNĐ)</span>
              </div>
            </div>

            {currentUser && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Số dư ví của bạn:</span>
                <span className="font-semibold text-foreground">{userBalance.toLocaleString()} Core</span>
              </div>
            )}

            <button
              disabled={isSubmitting}
              onClick={handleCreateOrder}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-95 shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Đang tạo đơn hàng...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" /> Tiến Hành Đặt Hàng ({totalCore.toLocaleString()} Core)
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
