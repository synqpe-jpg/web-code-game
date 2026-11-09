import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CreditCard,
  Wallet,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  LogIn,
  Lock,
  PlusCircle,
  Minus,
  Plus,
  Zap,
  TrendingUp,
  BookOpen,
  ExternalLink,
  QrCode,
  Clock,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CyberLoader } from './CyberLoader';
import type { StoreProduct, OrderRecord, UserProfile } from '../types/game';
import { dataService } from '../services/dataService';
import { offerService } from '../services/offerService';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { marketingService } from '../services/marketingService';
import { formatCore } from '../utils/textUtils';
import { GuideLinksBanner } from './GuideLinksBanner';

interface ProductCheckoutModalProps {
  product: StoreProduct | any | null;
  selectedPackage?: any | null;
  initialQuantity?: number;
  onClose: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  currentUser?: UserProfile | null;
  onUpdateUser?: (user: UserProfile) => void;
  onOpenAuth?: () => void;
  onOpenWallet?: () => void;
}

export const ProductCheckoutModal: React.FC<ProductCheckoutModalProps> = ({
  product,
  selectedPackage,
  initialQuantity = 1,
  onClose,
  onShowToast,
  currentUser,
  onUpdateUser,
  onOpenAuth,
  onOpenWallet,
}) => {
  const liveProduct = product ? (dataService.getStoreProducts().find((p) => p.id === product.id) || product) : null;
  const [quantity, setQuantity] = useState<number>(initialQuantity || 1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<OrderRecord | null>(null);
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [checkoutOffer, setCheckoutOffer] = useState<{
    eligible: boolean;
    offer_price: number;
    discount_amount: number;
    escalating?: any;
  } | null>(() => {
    const targetId = selectedPackage?.id || liveProduct?.id;
    if (targetId && liveProduct?.game_slug) {
      const cached = offerService.getCached(liveProduct.game_slug);
      const targetOffer = cached?.offers?.[targetId];
      if (targetOffer) {
        return {
          eligible: Boolean(targetOffer.eligible),
          offer_price: Number(targetOffer.offer_price) || 2000,
          discount_amount: Number(targetOffer.discount_amount) || 0,
          escalating: targetOffer.escalating || null,
        };
      }
    }
    if (selectedPackage?.isFirstPurchaseOffer) {
      return {
        eligible: true,
        offer_price: Number(selectedPackage.price) || 2000,
        discount_amount: Number(selectedPackage.discountAmount) || 0,
      };
    }
    return null;
  });

  const [sepayConfig] = useState(() => dataService.getSePayConfig());
  const minQrAmount = Number(sepayConfig?.minQrAmount || 2000);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'vietqr'>('wallet');

  const [qrOrder, setQrOrder] = useState<any | null>(null);
  const [qrStatus, setQrStatus] = useState<'idle' | 'creating' | 'waiting' | 'paid' | 'expired' | 'error'>('idle');
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(900);
  const [qrCopiedField, setQrCopiedField] = useState<string | null>(null);
  const [currentQrImageSrc, setCurrentQrImageSrc] = useState<string>('');
  const [qrImageLoadFailed, setQrImageLoadFailed] = useState<boolean>(false);
  const [isQrImageLoading, setIsQrImageLoading] = useState<boolean>(true);
  const [qrAttemptStep, setQrAttemptStep] = useState<number>(0);
  const qrStepRef = React.useRef<number>(0);
  const [qrLastErrorMsg, setQrLastErrorMsg] = useState<string>('');
  const [showQrDiagnostics, setShowQrDiagnostics] = useState<boolean>(false);
  const pollTimerRef = React.useRef<any>(null);
  const countdownTimerRef = React.useRef<any>(null);

  const QR_TIER_CONFIG = [
    { id: 0, label: 'SePay VietQR (Chính)', short: 'SePay' },
    { id: 1, label: 'VietQR.io Chuẩn (SVG)', short: 'VietQR Chuẩn' },
    { id: 2, label: 'VietQR.io Rút Gọn (Compact2)', short: 'VietQR Rút Gọn' },
  ];

  const getClientQrFallbackUrl = (order: any, template = 'compact2') => {
    if (!order?.bankInfo) return '';
    const cleanBank = String(order.bankInfo.bankName || 'TPBank').replace(/\s+/g, '');
    const cleanAcc = String(order.bankInfo.accountNumber || '').replace(/\s+/g, '');
    const amount = Number(order.bankInfo.amount) || 0;
    const memo = encodeURIComponent(order.bankInfo.content || '');
    const accName = encodeURIComponent(order.bankInfo.bankAccount || '');
    return `https://img.vietqr.io/image/${cleanBank}-${cleanAcc}-${template}.svg?amount=${amount}&addInfo=${memo}&accountName=${accName}`;
  };

  const getQrTierUrl = (order: any, step: number, cacheBust = false) => {
    if (!order) return '';
    let url = '';
    if (step === 0) {
      url = order.qrUrls?.primary || `https://qr.sepay.vn/img?acc=${encodeURIComponent((order.bankInfo?.accountNumber || '').replace(/\s+/g, ''))}&bank=${encodeURIComponent((order.bankInfo?.bankName || 'TPBank').replace(/\s+/g, ''))}&amount=${order.bankInfo?.amount || 0}&des=${encodeURIComponent(order.bankInfo?.content || '')}&template=qr_only`;
    } else if (step === 1) {
      url = order.qrUrls?.fallback || getClientQrFallbackUrl(order, 'qr_only');
    } else {
      url = getClientQrFallbackUrl(order, 'compact2');
    }
    if (cacheBust && url) {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}_t=${Date.now()}`;
    }
    return url;
  };

  useEffect(() => {
    if (qrOrder) {
      qrStepRef.current = 0;
      setQrAttemptStep(0);
      setQrImageLoadFailed(false);
      setIsQrImageLoading(true);
      setQrLastErrorMsg('');
      const initialUrl = getQrTierUrl(qrOrder, 0);
      setCurrentQrImageSrc(initialUrl);
      console.log('[ProductCheckoutModal] Khởi tạo đơn QR thành công:', {
        orderId: qrOrder.id,
        qrUrls: qrOrder.qrUrls,
        bankInfo: qrOrder.bankInfo,
        initialUrl,
      });
    } else {
      setCurrentQrImageSrc('');
      setQrImageLoadFailed(false);
      setIsQrImageLoading(false);
      setQrAttemptStep(0);
      qrStepRef.current = 0;
      setQrLastErrorMsg('');
    }
  }, [qrOrder]);

  const handleQrImageError = (e?: any) => {
    if (!qrOrder) {
      setQrImageLoadFailed(true);
      setIsQrImageLoading(false);
      return;
    }

    const currentStep = qrStepRef.current;
    const errMsg = `Lỗi tải ảnh tầng ${currentStep + 1} (${QR_TIER_CONFIG[currentStep]?.short}): ${currentQrImageSrc}`;
    console.warn('[VietQR Diagnostic]:', errMsg, e);
    setQrLastErrorMsg(errMsg);

    if (currentStep === 0) {
      // Tầng 0 (SePay) thất bại -> tự động thử tầng 1 (VietQR Chuẩn SVG)
      qrStepRef.current = 1;
      setQrAttemptStep(1);
      setIsQrImageLoading(true);
      const nextUrl = getQrTierUrl(qrOrder, 1);
      setCurrentQrImageSrc(nextUrl);
      return;
    }

    if (currentStep === 1) {
      // Tầng 1 (VietQR SVG) thất bại -> tự động thử tầng 2 (VietQR Compact2)
      qrStepRef.current = 2;
      setQrAttemptStep(2);
      setIsQrImageLoading(true);
      const nextUrl = getQrTierUrl(qrOrder, 2);
      setCurrentQrImageSrc(nextUrl);
      return;
    }

    // Tất cả 3 tầng đều thất bại (adblocker hoặc trình duyệt chặn ảnh thứ 3)
    setQrImageLoadFailed(true);
    setIsQrImageLoading(false);
  };

  const handleReloadQrImage = () => {
    if (!qrOrder) return;
    setQrImageLoadFailed(false);
    setIsQrImageLoading(true);
    setQrLastErrorMsg('');
    // Bắt đầu lại từ tầng 0 (primary SePay) với cache-busting timestamp
    qrStepRef.current = 0;
    setQrAttemptStep(0);
    const freshUrl = getQrTierUrl(qrOrder, 0, true);
    setCurrentQrImageSrc(freshUrl);
  };

  const handleCycleQrTier = () => {
    if (!qrOrder) return;
    const nextStep = (qrStepRef.current + 1) % 3;
    qrStepRef.current = nextStep;
    setQrAttemptStep(nextStep);
    setIsQrImageLoading(true);
    setQrImageLoadFailed(false);
    setQrLastErrorMsg('');
    const nextUrl = getQrTierUrl(qrOrder, nextStep, true);
    setCurrentQrImageSrc(nextUrl);
  };

  const [priceEscalatedDialog, setPriceEscalatedDialog] = useState<{
    isOpen: boolean;
    oldPrice: number;
    newPrice: number;
    message: string;
  } | null>(null);

  // Fetch first purchase offer for this game & package
  useEffect(() => {
    let isMounted = true;
    const activeUser = currentUser || dataService.getCurrentUser();
    const token =
      (typeof localStorage !== 'undefined' ? localStorage.getItem('wcg_auth_token') : null) ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('wcg_auth_token') : null) ||
      activeUser?.session_token ||
      '';

    if (!liveProduct?.game_slug) return;

    offerService
      .fetchOffers(liveProduct.game_slug, token)
      .then((data) => {
        if (!isMounted || !data) return;
        const targetId = selectedPackage?.id || liveProduct.id;
        const targetOffer = data.offers?.[targetId];
        if (targetOffer) {
          setCheckoutOffer({
            eligible: Boolean(targetOffer.eligible),
            offer_price: Number(targetOffer.offer_price) || 2000,
            discount_amount: Number(targetOffer.discount_amount) || 0,
            escalating: targetOffer.escalating || null,
          });
        } else {
          setCheckoutOffer(null);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [liveProduct?.game_slug, selectedPackage?.id, currentUser?.id]);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (initialQuantity && initialQuantity > 0) {
      setQuantity(initialQuantity);
    }
  }, [initialQuantity]);

  useEffect(() => {
    const handleUpdate = () => setTick((t) => t + 1);
    const unsub = dataService.subscribe(handleUpdate);
    const unsubStock = marketingService.subscribeStockChange(handleUpdate);
    const unsubSold = marketingService.subscribeSoldCountChange(handleUpdate);
    window.addEventListener('wcg_virtual_stock_updated', handleUpdate);
    window.addEventListener('wcg_sold_count_updated', handleUpdate);
    return () => {
      unsub();
      unsubStock();
      unsubSold();
      window.removeEventListener('wcg_virtual_stock_updated', handleUpdate);
      window.removeEventListener('wcg_sold_count_updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (product) {
      setQuantity(1);
      setCompletedOrder(null);
      setCopiedCodeIdx(null);
      setCopiedAll(false);
      const newKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'key_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      setIdempotencyKey(newKey);
    }
  }, [product?.id]);

  useLockBodyScroll(Boolean(product));

  const rawStock = typeof selectedPackage?.stock_quantity === 'number'
    ? selectedPackage.stock_quantity
    : liveProduct?.stock_quantity;
  const realStock = Math.max(0, Number(rawStock ?? 0));

  useEffect(() => {
    if (realStock > 0 && quantity > realStock) {
      setQuantity(realStock);
    }
  }, [realStock, selectedPackage, product]);

  if (!product || !liveProduct) return null;

  const effectiveRegularPrice = selectedPackage?.raw_price ?? (
    selectedPackage?.isFirstPurchaseOffer
      ? (Number(selectedPackage.price) + Number(selectedPackage.discountAmount || 0))
      : (selectedPackage?.price ?? liveProduct.current_price)
  );
  const effectiveOriginalPrice = (typeof selectedPackage?.original_price === 'number' && selectedPackage.original_price > 0)
    ? selectedPackage.original_price
    : (selectedPackage?.price ?? liveProduct.original_price);
  const effectiveTitle = selectedPackage && selectedPackage.name && selectedPackage.name !== liveProduct.title
    ? `${liveProduct.title} - ${selectedPackage.name}`
    : liveProduct.title;
  const effectiveTargetId = selectedPackage?.id || liveProduct.id;

  const isEscalating = selectedPackage?.sale_mode === 'escalating'
    || Boolean(checkoutOffer?.escalating?.is_escalating)
    || liveProduct?.sale_mode === 'escalating';

  const rawEsc = checkoutOffer?.escalating;
  const escBase = Number(
    rawEsc?.base_price ?? rawEsc?.escalating_base_price ??
    selectedPackage?.escalating_base_price ?? liveProduct?.escalating_base_price ??
    selectedPackage?.price ?? liveProduct?.current_price ?? effectiveRegularPrice
  ) || effectiveRegularPrice;

  const escStep = Number(
    rawEsc?.step ?? rawEsc?.escalating_step ??
    selectedPackage?.escalating_step ?? liveProduct?.escalating_step ?? 0
  ) || 0;

  const escMax = (rawEsc?.max_price !== undefined && rawEsc?.max_price !== null)
    ? Number(rawEsc.max_price)
    : ((rawEsc?.escalating_max_price !== undefined && rawEsc?.escalating_max_price !== null)
      ? Number(rawEsc.escalating_max_price)
      : (selectedPackage?.escalating_max_price !== undefined && selectedPackage?.escalating_max_price !== null
        ? Number(selectedPackage.escalating_max_price)
        : (liveProduct?.escalating_max_price !== undefined && liveProduct?.escalating_max_price !== null
          ? Number(liveProduct.escalating_max_price)
          : null)));

  const escCompleted = Number(
    rawEsc?.completed_count ??
    selectedPackage?.escalating_completed_count ?? liveProduct?.escalating_completed_count ?? 0
  ) || 0;

  const rawCurrent = Number(
    rawEsc?.current_price ?? rawEsc?.current_calculated_price ??
    selectedPackage?.escalating_current_price ?? liveProduct?.escalating_current_price ??
    selectedPackage?.price
  );

  const escCurrent = (rawCurrent > 0)
    ? rawCurrent
    : (escMax !== null && escMax > 0 ? Math.min(escBase + (escCompleted * escStep), escMax) : (escBase + (escCompleted * escStep)));

  const rawNext = Number(
    rawEsc?.next_price ?? rawEsc?.next_step_price ??
    selectedPackage?.escalating_next_price ?? liveProduct?.escalating_next_price
  );

  const escNext = (rawNext > 0)
    ? rawNext
    : (escMax !== null && escMax > 0 ? Math.min(escBase + ((escCompleted + 1) * escStep), escMax) : (escBase + ((escCompleted + 1) * escStep)));

  const escalatingData = {
    is_escalating: isEscalating,
    base_price: escBase,
    step: escStep,
    max_price: escMax,
    completed_count: escCompleted,
    current_price: escCurrent,
    next_price: escNext,
  };

  const isPkgFlagEnabled = selectedPackage?.first_purchase_enabled === true ||
    selectedPackage?.first_purchase_enabled === 1 ||
    String(selectedPackage?.first_purchase_enabled) === '1' ||
    String(selectedPackage?.first_purchase_enabled) === 'true';

  const pkgMaxPrice = selectedPackage?.first_purchase_max_price
    ? Number(selectedPackage.first_purchase_max_price)
    : (checkoutOffer?.max_original_price ?? 30000);

  const defaultPkgEligible = isPkgFlagEnabled && !isEscalating && (effectiveRegularPrice <= pkgMaxPrice);
  const isFirstPurchaseEligible = !isEscalating && isPkgFlagEnabled && Boolean(
    checkoutOffer !== null && checkoutOffer !== undefined
      ? checkoutOffer.eligible
      : (selectedPackage?.isFirstPurchaseOffer ? true : defaultPkgEligible)
  );

  const customPkgPrice = selectedPackage?.first_purchase_price
    ? Number(selectedPackage.first_purchase_price)
    : null;

  const firstItemOfferPrice = isFirstPurchaseEligible
    ? (checkoutOffer?.offer_price ?? customPkgPrice ?? 2000)
    : effectiveRegularPrice;
  const firstItemActualPrice = Math.min(effectiveRegularPrice, firstItemOfferPrice);

  const user = currentUser || dataService.getCurrentUser();
  const userBalance = user?.wallet_balance || 0;
  const maxStock = realStock;
  const safeQty = isEscalating ? 1 : (realStock > 0 ? Math.min(Math.max(1, quantity), maxStock) : 0);
  const totalPrice = isEscalating
    ? Number(escalatingData.current_price)
    : (safeQty > 0
        ? (firstItemActualPrice + Math.max(0, safeQty - 1) * effectiveRegularPrice)
        : 0);
  const totalDiscountAmount = isFirstPurchaseEligible
    ? Math.max(0, (effectiveRegularPrice * safeQty) - totalPrice)
    : 0;
  const isPriceValid = !isNaN(totalPrice) && totalPrice > 0;
  const isBalanceEnough = isPriceValid && (userBalance >= totalPrice);
  const checkoutDisplayStock = realStock <= 0 ? 0 : marketingService.getDisplayStock(effectiveTargetId, realStock);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const isQrAvailable = isPriceValid && (totalPrice >= minQrAmount);

  useEffect(() => {
    if (!isQrAvailable && paymentMethod === 'vietqr') {
      setPaymentMethod('wallet');
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setQrStatus('idle');
    } else if (paymentMethod === 'vietqr' && qrStatus === 'error') {
      setQrStatus('idle');
    }
  }, [isQrAvailable, paymentMethod]);

  const handleCopyQrField = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setQrCopiedField(fieldName);
    setTimeout(() => setQrCopiedField(null), 1500);
    onShowToast('Đã sao chép!', text, 'info');
  };

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const startQrPolling = (orderId: string, expiresAtMs: number) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    countdownTimerRef.current = setInterval(() => {
      const left = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      setQrSecondsLeft(left);
      if (left <= 0) {
        clearInterval(countdownTimerRef.current);
        clearInterval(pollTimerRef.current);
        setQrStatus('expired');
      }
    }, 1000);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/status?order_id=${encodeURIComponent(orderId)}&t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (data.status === 'COMPLETED') {
          clearInterval(pollTimerRef.current);
          clearInterval(countdownTimerRef.current);
          setQrStatus('paid');

          confetti({
            particleCount: 90,
            spread: 70,
            origin: { y: 0.6 },
          });

          onShowToast('Thanh Toán Thành Công!', 'Đơn hàng QR đã hoàn tất, mã quà đã được giao vào kho của bạn.', 'success');

          const codeList = data.order?.deliveredCodes || [];
          setCompletedOrder({
            id: data.order.id,
            orderCode: data.order.id,
            productId: effectiveTargetId,
            product_id: effectiveTargetId,
            productTitle: liveProduct?.title,
            product_title: liveProduct?.title,
            game_name: liveProduct?.game_name || 'Game',
            amount: data.order.totalAmount,
            quantity: safeQty,
            unit_price: Math.round(data.order.totalAmount / safeQty),
            code_content: codeList.join('\n'),
            code_items: codeList,
            deliveredCodes: codeList,
            status: 'completed',
            created_at: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            payment_method: 'vietqr',
          } as any);
        } else if (data.status === 'EXPIRED') {
          clearInterval(pollTimerRef.current);
          clearInterval(countdownTimerRef.current);
          setQrStatus('expired');
        }
      } catch {}
    }, 2500);
  };

  const handleCreateQrOrder = async () => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      onShowToast('Cần đăng nhập', 'Vui lòng đăng nhập tài khoản để thanh toán.', 'info');
      return;
    }
    if (maxStock <= 0) {
      onShowToast('Hết hàng', 'Sản phẩm tạm thời hết hàng trong kho.', 'error');
      return;
    }
    setQrStatus('creating');
    try {
      const token = user.session_token || localStorage.getItem('wcg_auth_token') || '';
      const res = await fetch('/api/orders/create-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          productId: effectiveTargetId,
          productTitle: liveProduct?.title,
          quantity: safeQty,
          expected_price: totalPrice,
          idempotencyKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setQrStatus('idle');
        onShowToast('Lỗi tạo mã QR', data.message || 'Không thể khởi tạo mã QR thanh toán.', 'error');
        return;
      }
      const orderData = data.order || {};
      orderData.qrUrls = {
        ...(data.qrUrls || {}),
        ...(orderData.qrUrls || {}),
      };
      console.log('[ProductCheckoutModal] API create-qr trả về thành công:', {
        topLevelQrUrls: data.qrUrls,
        orderQrUrls: orderData.qrUrls,
        bankInfo: orderData.bankInfo,
      });
      setQrOrder(orderData);
      setQrStatus('waiting');
      const expiresAtMs = data.order?.expiresAt ? new Date(data.order.expiresAt).getTime() : Date.now() + 15 * 60 * 1000;
      setQrSecondsLeft(Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)));

      startQrPolling(data.order.id, expiresAtMs);
    } catch (err: any) {
      setQrStatus('idle');
      onShowToast('Lỗi kết nối', err?.message || 'Không thể kết nối đến máy chủ.', 'error');
    }
  };

  const handleDecreaseQty = () => {
    if (isEscalating || maxStock <= 0) return;
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleIncreaseQty = () => {
    if (isEscalating || maxStock <= 0) return;
    setQuantity((prev) => Math.min(maxStock, prev + 1));
  };

  const handleQtyInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isEscalating) return;
    if (maxStock <= 0) {
      setQuantity(0);
      return;
    }
    const val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) {
      setQuantity(1);
    } else {
      setQuantity(Math.min(maxStock, val));
    }
  };

  const handlePayWithWallet = async () => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      onShowToast('Cần đăng nhập', 'Vui lòng đăng nhập tài khoản để thanh toán.', 'info');
      return;
    }

    if (user.session_token && typeof localStorage !== 'undefined' && !localStorage.getItem('wcg_auth_token')) {
      localStorage.setItem('wcg_auth_token', user.session_token);
    }

    if (!isPriceValid) {
      onShowToast(
        'Đang Cập Nhật Giá',
        'Dữ liệu giá đang được đồng bộ, vui lòng thử lại sau giây lát hoặc tải lại trang.',
        'warning'
      );
      return;
    }

    if (!isBalanceEnough) {
      onShowToast(
        'Số Dư Core Không Đủ',
        `Bạn cần ${formatCore(totalPrice)} nhưng ví hiện chỉ có ${formatCore(userBalance)}. Vui lòng nạp thêm Core để thanh toán.`,
        'error'
      );
      return;
    }

    if (realStock <= 0) {
      onShowToast('Hết hàng', 'Sản phẩm tạm thời hết hàng trong kho.', 'error');
      return;
    }

    const activeKey = idempotencyKey || (
      (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'key_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10)
    );
    if (!idempotencyKey) setIdempotencyKey(activeKey);

    setIsProcessing(true);

    try {
      const orderPromise = dataService.createOrder(effectiveTargetId, safeQty, activeKey, { expectedPrice: totalPrice });
      const timeoutPromise = new Promise<{ success: boolean; message: string }>((_, reject) =>
        setTimeout(() => reject(new Error('Thời gian phản hồi máy chủ vượt quá 15 giây. Vui lòng kiểm tra lại danh sách mã đã nhận hoặc thử lại.')), 15000)
      );

      const res: any = await Promise.race([orderPromise, timeoutPromise]);
      setIsProcessing(false);

      if (res.code === 'PRICE_ESCALATED') {
        setPriceEscalatedDialog({
          isOpen: true,
          oldPrice: res.old_price || totalPrice,
          newPrice: res.new_price,
          message: res.message || `Giá gói vừa tăng lên ${formatCore(res.new_price)} (đã có khách hàng mua trước bạn). Bạn có muốn mua với giá mới không?`,
        });
        return;
      }

      if (res.success && res.order) {
        const activeUser = currentUser || (typeof window !== 'undefined' ? dataService.getCurrentUser() : null);
        marketingService.recordRealOrder(effectiveTitle, effectiveTargetId, totalPrice, 'store', activeUser, safeQty);

        // Instantly notify React app state of new balance
        if (activeUser) {
          const newBal = res?.newBalance !== undefined
            ? Number(res.newBalance)
            : (res.order as any)?.balance_after !== undefined
              ? Number((res.order as any).balance_after)
              : res?.remainingBalance !== undefined
                ? Number(res.remainingBalance)
                : Math.max(0, (activeUser.wallet_balance || 0) - totalPrice);
          const updatedUser: UserProfile = {
            ...activeUser,
            wallet_balance: newBal,
          };
          dataService.saveCurrentUser(updatedUser);
          if (onUpdateUser) {
            onUpdateUser(updatedUser);
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('wcg_user_updated', { detail: updatedUser }));
            window.dispatchEvent(new CustomEvent('wcg_wallet_updated', { detail: { newBalance: newBal } }));
          }
        }

        setCompletedOrder(res.order);
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#6366F1', '#10B981', '#F59E0B'],
        });
        onShowToast('Thanh toán thành công!', `Đã giao ${safeQty} mã quà tặng tức thì.`, 'success');
      } else {
        if (res.message && res.message.includes('Phiên đăng nhập') && onOpenAuth) {
          onOpenAuth();
        }
        onShowToast('Thất bại', res.message || 'Không thể hoàn tất đơn hàng.', 'error');
      }
    } catch (err: any) {
      setIsProcessing(false);
      onShowToast('Lỗi', err?.message || 'Không thể hoàn tất đơn hàng.', 'error');
    }
  };

  const handleAcceptNewEscalatedPrice = async (newPrice: number) => {
    setPriceEscalatedDialog(null);
    if (selectedPackage) {
      selectedPackage.escalating_current_price = newPrice;
      selectedPackage.price = newPrice;
    }
    const newKey = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'key_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    setIdempotencyKey(newKey);
    setIsProcessing(true);

    try {
      const res: any = await dataService.createOrder(effectiveTargetId, 1, newKey, { expectedPrice: newPrice });
      setIsProcessing(false);
      if (res.success && res.order) {
        const activeUser = currentUser || (typeof window !== 'undefined' ? dataService.getCurrentUser() : null);
        marketingService.recordRealOrder(effectiveTitle, effectiveTargetId, newPrice, 'store', activeUser, 1);
        if (activeUser) {
          const newBal = res?.newBalance !== undefined
            ? Number(res.newBalance)
            : Math.max(0, (activeUser.wallet_balance || 0) - newPrice);
          const updatedUser: UserProfile = { ...activeUser, wallet_balance: newBal };
          dataService.saveCurrentUser(updatedUser);
          if (onUpdateUser) onUpdateUser(updatedUser);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('wcg_user_updated', { detail: updatedUser }));
            window.dispatchEvent(new CustomEvent('wcg_wallet_updated', { detail: { newBalance: newBal } }));
          }
        }
        setCompletedOrder(res.order);
        confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 }, colors: ['#6366F1', '#10B981', '#F59E0B'] });
        onShowToast('Thanh toán thành công!', 'Đã giao 1 mã quà tặng tức thì.', 'success');
      } else if (res.code === 'PRICE_ESCALATED') {
        setPriceEscalatedDialog({
          isOpen: true,
          oldPrice: res.old_price || newPrice,
          newPrice: res.new_price,
          message: res.message,
        });
      } else {
        onShowToast('Thất bại', res.message || 'Không thể hoàn tất đơn hàng.', 'error');
      }
    } catch (err: any) {
      setIsProcessing(false);
      onShowToast('Lỗi', err?.message || 'Không thể hoàn tất đơn hàng.', 'error');
    }
  };

  const handleCopySingleCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    marketingService.recordRealCopy(effectiveTitle || 'Mã sản phẩm', '', 1, activeUser);
    setCopiedCodeIdx(idx);
    onShowToast('Đã sao chép mã!', code, 'success');
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  const handleCopyAllCodes = () => {
    if (!completedOrder) return;
    navigator.clipboard.writeText(completedOrder.code_content);
    marketingService.recordRealCopy(effectiveTitle || 'Mã sản phẩm', '', safeQty, activeUser);
    setCopiedAll(true);
    onShowToast('Đã sao chép tất cả mã!', completedOrder.code_content, 'success');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleOpenTopup = () => {
    onClose();
    if (onOpenWallet) {
      onOpenWallet();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wcg_open_wallet_modal'));
    }
  };

  const deliveredLines = completedOrder
    ? (completedOrder.code_items && completedOrder.code_items.length > 0)
      ? completedOrder.code_items
      : completedOrder.code_content.split('\n').filter((l) => l.trim())
    : [];

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {isProcessing && (
        <CyberLoader
          isOverlay={true}
          title="ĐANG XỬ LÝ ĐƠN..."
          subText="Hệ thống đang kiểm tra số dư ví & xuất mã quà tặng từ kho bảo mật Cloudflare D1..."
        />
      )}
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-fade-in">
      <div
        className="relative w-full max-w-lg bg-card border-t sm:border border-border/90 rounded-t-[28px] sm:rounded-3xl overflow-hidden shadow-2xl animate-scale-in flex flex-col h-[88dvh] sm:h-auto max-h-[88dvh] sm:max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-border/70 bg-card/95 backdrop-blur-md shrink-0 sticky top-0 z-20">
          <div className="w-12 h-1.5 bg-slate-600/60 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="p-2 sm:p-2.5 rounded-xl bg-secondary/20 text-secondary shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading font-bold text-sm sm:text-base text-foreground truncate">
                  Thanh Toán Đơn Hàng
                </h3>
                <p className="text-xs text-muted-foreground truncate">{effectiveTitle}</p>
              </div>
            </div>
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

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y p-4 sm:p-6 space-y-5">
          {!user ? (
            /* Auth Required */
            <div className="py-6 text-center space-y-5 animate-scale-in">
              <div className="w-16 h-16 rounded-2xl bg-secondary/15 text-secondary flex items-center justify-center mx-auto border border-secondary/30 shadow-sm">
                <Lock className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 max-w-sm mx-auto">
                  <Sparkles className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                  <span>Đăng nhập để nhận ưu đãi mua lần đầu chỉ 2.000 Core</span>
                </div>

                <h3 className="font-heading font-extrabold text-xl text-foreground">
                  Yêu Cầu Đăng Nhập
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Bạn cần đăng nhập tài khoản để nhận mã quà tặng tự động và kích hoạt bảo hành cho đơn hàng.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border flex items-center justify-between text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden border border-border shrink-0">
                    <img
                      src={product.cover_image_url || product.game_icon_url || `/game_icons/${product.game_slug}.webp`}
                      alt={product.game_name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const localFallback = `/game_icons/${product.game_slug}.webp`;
                        if (target.src !== localFallback && !target.src.endsWith(localFallback)) {
                          target.src = localFallback;
                        } else {
                          target.onerror = null;
                          target.src = '/vite.svg';
                        }
                      }}
                    />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-xs text-foreground truncate max-w-[180px]">
                      {effectiveTitle}
                    </h4>
                    <span className="text-[11px] text-muted-foreground">{product.game_name || (product as any).category_label || ''}</span>
                  </div>
                </div>
                <span className="font-display font-black text-sm text-emerald-400">
                  {formatCore(effectivePrice)}
                </span>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenAuth) onOpenAuth();
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-secondary to-primary hover:opacity-95 text-white font-bold text-xs shadow-glow-primary cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Đăng Nhập / Đăng Ký Ngay</span>
                </button>
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold cursor-pointer"
                >
                  Để sau
                </button>
              </div>
            </div>
          ) : completedOrder ? (
            /* Order Success View */
            <div className="text-center py-3 space-y-4 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-glow-emerald">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="font-heading font-extrabold text-xl text-foreground">
                  Giao Hàng Thành Công!
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Mã đơn: <strong className="text-foreground font-mono">{completedOrder.id}</strong> • Số lượng: <strong className="text-emerald-400">{deliveredLines.length} mã</strong>
                </p>
              </div>

              {/* Code List Box */}
              <div className="p-3 sm:p-4 rounded-2xl bg-muted/70 border border-border space-y-2.5 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-semibold">
                    Danh Sách Mã Code Ingame:
                  </span>
                  {deliveredLines.length > 1 && (
                    <button
                      onClick={handleCopyAllCodes}
                      className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/90 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      {copiedAll ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedAll ? 'Đã sao chép tất cả' : 'Sao chép tất cả'}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2 sm:max-h-48 sm:overflow-y-auto pr-1">
                  {deliveredLines.map((codeItem: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 bg-card p-2.5 sm:p-3 rounded-xl border border-border"
                    >
                      <div className="min-w-0 flex-1">
                        {deliveredLines.length > 1 && (
                          <span className="text-[10px] text-muted-foreground font-mono block">#{idx + 1}</span>
                        )}
                        <span className="font-mono font-bold text-xs sm:text-sm text-primary-light break-all block">
                          {codeItem}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopySingleCode(codeItem, idx)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all cursor-pointer shrink-0"
                      >
                        {copiedCodeIdx === idx ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span className="hidden xs:inline">Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="hidden xs:inline">Sao chép</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guide link if configured */}
              <GuideLinksBanner
                guideLinks={liveProduct.guide_links}
                guideUrl={liveProduct.guide_url}
                guideText={liveProduct.guide_text}
                showGuide={liveProduct.show_guide_link !== false}
                theme="indigo"
              />

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Đơn hàng đã được lưu vào lịch sử & kích hoạt bảo hành 100%.</span>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                Hoàn Tất & Đóng
              </button>
            </div>
          ) : (
            /* Checkout Form */
            <div className="space-y-4">
              {/* Product Summary */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden border border-border shrink-0">
                    <img
                      src={product.cover_image_url || product.game_icon_url || `/game_icons/${product.game_slug}.webp`}
                      alt={product.game_name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const localFallback = `/game_icons/${product.game_slug}.webp`;
                        if (target.src !== localFallback && !target.src.endsWith(localFallback)) {
                          target.src = localFallback;
                        } else {
                          target.onerror = null;
                          target.src = '/vite.svg';
                        }
                      }}
                    />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-sm text-foreground truncate max-w-[190px]">
                      {effectiveTitle}
                    </h4>
                    <span className="text-xs text-muted-foreground">{product.game_name || (product as any).category_label || ''}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    {!isEscalating && isFirstPurchaseEligible && totalDiscountAmount > 0 && (
                      <span className="text-xs text-muted-foreground line-through font-mono">
                        {formatCore(effectiveRegularPrice)}
                      </span>
                    )}
                    <span className="font-display font-black text-base text-emerald-400">
                      {formatCore(isEscalating ? totalPrice : (isFirstPurchaseEligible ? firstItemActualPrice : effectiveRegularPrice))}
                    </span>
                  </div>
                  {isEscalating ? (
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                      ⚡ Nâng Giá (+{formatCore(escalatingData.step)}/lượt)
                    </span>
                  ) : isFirstPurchaseEligible ? (
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 uppercase tracking-wider animate-pulse">
                      Ưu đãi lần đầu
                    </span>
                  ) : null}
                  <span className={`text-[10px] font-semibold flex items-center gap-1 justify-end font-sans mt-0.5 ${checkoutDisplayStock > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {checkoutDisplayStock > 0 ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Sẵn sàng • Giao tức thì</span>
                      </>
                    ) : (
                      'Tạm hết hàng'
                    )}
                  </span>
                </div>
              </div>

              {/* Quantity Selector */}
              {isEscalating ? (
                <div className="space-y-2">
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Hình thức Mua Nâng Giá</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Cố định 1 gói/đơn để bảo đảm giá theo lượt mua.
                      </p>
                    </div>
                    <span className="font-mono font-bold text-xs text-foreground px-3 py-1 bg-muted rounded-xl border border-border">
                      1 Gói
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-border/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Lượt mua của bạn:</span>
                      <span className="font-mono font-bold text-amber-300">
                        Thứ {Number(escalatingData.completed_count) + 1}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Đã mua thành công:</span>
                      <span className="font-mono font-bold text-foreground">
                        {escalatingData.completed_count} lượt
                      </span>
                    </div>

                    {/* Thang đo giá trực quan 3 lượt */}
                    <div className="pt-2 border-t border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          Thang đo giá (Lượt mua càng sớm càng rẻ):
                        </span>
                        <span className="text-rose-400 font-mono font-bold text-[10px]">
                          +{formatCore(escalatingData.step)}/lượt
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="p-1.5 rounded-xl bg-amber-500/20 border border-amber-500/50">
                          <span className="text-[9px] text-amber-300 font-bold uppercase block">
                            Lượt {Number(escalatingData.completed_count) + 1} (Hiện tại)
                          </span>
                          <span className="font-mono font-black text-xs text-amber-400 block mt-0.5">
                            {formatCore(totalPrice)}
                          </span>
                          <span className="text-[8px] text-emerald-400 font-semibold block">Đơn giá này</span>
                        </div>
                        <div className="p-1.5 rounded-xl bg-muted/40 border border-border">
                          <span className="text-[9px] text-muted-foreground font-bold uppercase block">
                            Lượt {Number(escalatingData.completed_count) + 2}
                          </span>
                          <span className="font-mono font-bold text-xs text-foreground block mt-0.5">
                            {formatCore(
                              escalatingData.max_price && (totalPrice + escalatingData.step) > escalatingData.max_price
                                ? escalatingData.max_price
                                : totalPrice + escalatingData.step
                            )}
                          </span>
                          <span className="text-[8px] text-muted-foreground block">Lượt tiếp</span>
                        </div>
                        <div className="p-1.5 rounded-xl bg-muted/20 border border-border/60 opacity-80">
                          <span className="text-[9px] text-muted-foreground font-bold uppercase block">
                            Lượt {Number(escalatingData.completed_count) + 3}
                          </span>
                          <span className="font-mono font-bold text-xs text-foreground block mt-0.5">
                            {formatCore(
                              escalatingData.max_price && (totalPrice + (escalatingData.step * 2)) > escalatingData.max_price
                                ? escalatingData.max_price
                                : totalPrice + (escalatingData.step * 2)
                            )}
                          </span>
                          <span className="text-[8px] text-muted-foreground block">Sau nữa</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                      <span className="text-muted-foreground">Sau đơn này, giá sẽ tăng:</span>
                      <span className="font-mono font-bold text-rose-400">
                        +{formatCore(escalatingData.step)}
                      </span>
                    </div>
                    {escalatingData.max_price ? (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px] text-muted-foreground">
                        <span>Trần giá tối đa:</span>
                        <span className="font-mono text-slate-300">{formatCore(escalatingData.max_price)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-foreground block">Số Lượng Mua:</span>
                    {maxStock <= 0 && (
                      <span className="text-[10px] font-medium block text-rose-400 font-bold">
                        Sản phẩm hiện đang tạm hết hàng
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDecreaseQty}
                      disabled={safeQty <= 1 || maxStock <= 0}
                      className="w-8 h-8 rounded-xl bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center font-bold text-sm disabled:opacity-40 transition-all cursor-pointer"
                      aria-label="Giảm số lượng"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={maxStock <= 0 ? 0 : 1}
                      max={maxStock}
                      value={safeQty}
                      disabled={maxStock <= 0}
                      onChange={handleQtyInputChange}
                      className="w-14 h-9 text-center font-black font-mono text-sm bg-white text-slate-950 border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary shadow-sm selection:bg-indigo-100 disabled:opacity-50"
                    />
                    <button
                      onClick={handleIncreaseQty}
                      disabled={safeQty >= maxStock || maxStock <= 0}
                      className="w-8 h-8 rounded-xl bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center font-bold text-sm disabled:opacity-40 transition-all cursor-pointer"
                      aria-label="Tăng số lượng"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

                            {/* Payment Method Selector (Chỉ hiện khi đơn hàng >= ngưỡng minQrAmount, mặc định 2.000) */}
              {isQrAvailable && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Phương Thức Thanh Toán
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 border border-border/80 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('wallet')}
                      className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                        paymentMethod === 'wallet'
                          ? 'bg-card text-foreground shadow-sm border border-border font-black'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Wallet className="w-4 h-4 text-amber-400" />
                      <span className="truncate">Số Dư Core ({formatCore(userBalance)})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('vietqr')}
                      className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                        paymentMethod === 'vietqr'
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm font-black'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <QrCode className="w-4 h-4 text-emerald-300" />
                      <span className="truncate">Mã VietQR ({totalPrice.toLocaleString('vi-VN')}đ)</span>
                    </button>
                  </div>
                </div>
              )}

              {paymentMethod === 'vietqr' ? (
                <div className="space-y-3.5">
                  {/* Summary Box */}
                  <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                          <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-foreground block">Thanh Toán Bằng VietQR</span>
                          <span className="text-[11px] text-muted-foreground">Tự động nhận qua SePay</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Tỷ giá quy đổi</span>
                        <span className="text-xs font-bold font-mono text-emerald-400">1 VND = 1 Core</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Số lượng mua:</span>
                        <span className="font-mono font-bold text-foreground">{safeQty} gói</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">Số tiền thanh toán:</span>
                        <span className="font-display font-black text-base text-emerald-400">
                          {totalPrice.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* QR States Container */}
                  {(qrStatus === 'idle' || qrStatus === 'error') && (
                    <div className="p-4 rounded-2xl bg-card border border-emerald-500/30 space-y-3 text-xs">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                          <QrCode className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground text-sm">Thanh Toán Trực Tiếp Không Cần Nạp Core</p>
                          <p className="text-muted-foreground leading-relaxed">
                            Quét mã bằng ứng dụng ngân hàng bất kỳ để thanh toán đúng <strong>{totalPrice.toLocaleString('vi-VN')} đ</strong>. Hệ thống tự động giao mã ngay trong 3 giây khi tiền vào tài khoản shop.
                          </p>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between font-mono text-[11px]">
                        <span className="text-muted-foreground">Thời hạn giữ chỗ mã kho:</span>
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> 15 phút
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleCreateQrOrder}
                        disabled={maxStock <= 0 || !isPriceValid}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:opacity-95 text-slate-950 font-black text-sm transition-all cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Tạo Mã VietQR Thanh Toán • {totalPrice.toLocaleString('vi-VN')} đ</span>
                      </button>
                    </div>
                  )}

                  {qrStatus === 'creating' && (
                    <div className="p-6 rounded-2xl bg-card border border-emerald-500/30 text-center space-y-3">
                      <CyberLoader isOverlay={false} title="ĐANG TẠO MÃ QR..." subText="Hệ thống đang tạm giữ mã quà tặng trong kho bảo mật cho bạn..." />
                    </div>
                  )}

                  {qrStatus === 'waiting' && qrOrder && (
                    <div className="p-4 rounded-2xl bg-card border border-emerald-500/40 space-y-4 text-xs animate-scale-in">
                      {/* Countdown Header */}
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                          <Clock className="w-4 h-4 animate-pulse" />
                          <span>Hết hạn sau:</span>
                        </div>
                        <span className="font-mono font-black text-base text-amber-300">
                          {formatCountdown(qrSecondsLeft)}
                        </span>
                      </div>

                      {/* VietQR Image with Automatic Multi-tier Fallback & no-referrer */}
                      <div className="text-center space-y-2.5">
                        <div className="inline-block p-2 rounded-2xl bg-white border-2 border-emerald-500/50 shadow-xl shadow-emerald-500/10 min-w-[200px] min-h-[200px]">
                          {qrImageLoadFailed ? (
                            <div className="w-52 sm:w-60 mx-auto flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-900 border border-amber-500/30 text-center space-y-2.5">
                              <AlertCircle className="w-8 h-8 text-amber-400 shrink-0" />
                              <p className="text-[11px] text-amber-200 font-medium leading-tight">
                                Không thể tải ảnh mã QR (có thể do trình duyệt hoặc trình chặn quảng cáo chặn ảnh thứ 3).
                              </p>
                              <div className="flex flex-col sm:flex-row items-center gap-2 w-full pt-1">
                                <button
                                  type="button"
                                  onClick={handleReloadQrImage}
                                  className="w-full sm:w-1/2 px-2.5 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                                  title="Thử lại từ nguồn chính SePay"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>Tải lại QR</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCycleQrTier}
                                  className="w-full sm:w-1/2 px-2.5 py-2 rounded-lg bg-secondary/20 hover:bg-secondary/30 text-secondary border border-secondary/40 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                                  title="Chuyển sang nguồn VietQR dự phòng"
                                >
                                  <span>Đổi nguồn QR</span>
                                </button>
                              </div>

                              {currentQrImageSrc && (
                                <a
                                  href={currentQrImageSrc}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline pt-1"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Mở ảnh QR ở tab mới</span>
                                </a>
                              )}

                              {/* Toggle Chi tiết chẩn đoán dành cho kỹ thuật / debug */}
                              <div className="w-full pt-1.5 border-t border-slate-800 text-left">
                                <button
                                  type="button"
                                  onClick={() => setShowQrDiagnostics(!showQrDiagnostics)}
                                  className="text-[10px] text-slate-400 hover:text-slate-300 underline cursor-pointer"
                                >
                                  {showQrDiagnostics ? '▲ Đóng chẩn đoán' : '▼ Xem chi tiết chẩn đoán (Debug)'}
                                </button>
                                {showQrDiagnostics && (
                                  <div className="mt-1.5 p-2 rounded-lg bg-black/60 border border-slate-800 text-[10px] font-mono space-y-1 text-slate-300 overflow-x-auto">
                                    <div className="text-amber-400 font-bold">Tầng lỗi: {qrAttemptStep + 1}/3 ({QR_TIER_CONFIG[qrAttemptStep]?.short})</div>
                                    <div className="break-all"><strong>URL đang gọi:</strong> {currentQrImageSrc}</div>
                                    <div><strong>qrUrls.primary:</strong> {qrOrder.qrUrls?.primary ? '✅ Có giá trị' : '❌ Rỗng'}</div>
                                    <div><strong>qrUrls.fallback:</strong> {qrOrder.qrUrls?.fallback ? '✅ Có giá trị' : '❌ Rỗng'}</div>
                                    <div><strong>bankInfo:</strong> {qrOrder.bankInfo?.accountNumber ? `✅ STK ${qrOrder.bankInfo.accountNumber} (${qrOrder.bankInfo.bankName})` : '❌ Rỗng'}</div>
                                    {qrLastErrorMsg && <div className="text-rose-300"><strong>Chi tiết lỗi:</strong> {qrLastErrorMsg}</div>}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto flex items-center justify-center">
                              {isQrImageLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-xl z-10">
                                  <div className="flex flex-col items-center gap-1.5 text-slate-700">
                                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                                    <span className="text-[10px] font-semibold text-muted-foreground">Đang tải QR...</span>
                                  </div>
                                </div>
                              )}
                              {currentQrImageSrc && (
                                <img
                                  src={currentQrImageSrc}
                                  alt="VietQR Payment"
                                  referrerPolicy="no-referrer"
                                  onLoad={() => {
                                    setIsQrImageLoading(false);
                                    setQrImageLoadFailed(false);
                                  }}
                                  onError={handleQrImageError}
                                  className="w-full h-full object-contain rounded-xl"
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Thanh công cụ dưới ảnh QR: Hướng dẫn, Đổi nguồn QR & Mở tab mới */}
                        <div className="space-y-1 text-center">
                          <p className="text-[11px] text-muted-foreground italic">
                            {qrImageLoadFailed
                              ? 'Quý khách vẫn có thể thanh toán bằng thông tin STK và nội dung bên dưới'
                              : 'Mở App Ngân Hàng hoặc Ví Điện Tử quét mã QR ở trên'}
                          </p>

                          <div className="flex items-center justify-center gap-3 pt-0.5 flex-wrap">
                            <button
                              type="button"
                              onClick={handleCycleQrTier}
                              className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 underline cursor-pointer inline-flex items-center gap-1"
                              title="Bấm để chuyển qua lại giữa SePay và VietQR"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Nguồn QR: {QR_TIER_CONFIG[qrAttemptStep]?.short} ({qrAttemptStep + 1}/3)</span>
                            </button>

                            {currentQrImageSrc && (
                              <a
                                href={currentQrImageSrc}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-medium text-slate-400 hover:text-foreground underline inline-flex items-center gap-1"
                                title="Mở ảnh QR trực tiếp ở tab mới trình duyệt"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Mở tab mới</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bank Details Table with Fast Copy */}
                      <div className="p-3 rounded-xl bg-muted/60 border border-border/80 space-y-2 text-xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Ngân hàng:</span>
                          <span className="font-bold text-foreground">{qrOrder.bankInfo?.bankName}</span>
                        </div>

                        <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Số tài khoản:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-primary-light">{qrOrder.bankInfo?.accountNumber}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyQrField(qrOrder.bankInfo?.accountNumber, 'acc')}
                              className="p-1 rounded bg-muted hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                              title="Sao chép STK"
                            >
                              {qrCopiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Chủ tài khoản:</span>
                          <span className="font-bold text-foreground">{qrOrder.bankInfo?.bankAccount}</span>
                        </div>

                        <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                          <span className="text-muted-foreground">Số tiền:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-emerald-400 text-sm">
                              {Number(qrOrder.bankInfo?.amount).toLocaleString('vi-VN')} đ
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyQrField(String(qrOrder.bankInfo?.amount), 'amt')}
                              className="p-1 rounded bg-muted hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                              title="Sao chép số tiền"
                            >
                              {qrCopiedField === 'amt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-muted-foreground">Nội dung CK:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {qrOrder.bankInfo?.content}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyQrField(qrOrder.bankInfo?.content, 'memo')}
                              className="p-1 rounded bg-muted hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                              title="Sao chép nội dung chuyển khoản"
                            >
                              {qrCopiedField === 'memo' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Listening Indicator */}
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center gap-2 text-emerald-400 font-semibold text-xs animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Hệ thống đang chờ nhận tiền để tự động giao mã (2-5 giây)...</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <span>Mã đơn: <strong className="font-mono text-foreground">{qrOrder.id}</strong></span>
                        <button
                          type="button"
                          onClick={handleCreateQrOrder}
                          className="text-secondary hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                        >
                          <RefreshCw className="w-3 h-3" /> Tạo lại mã khác
                        </button>
                      </div>
                    </div>
                  )}

                  {qrStatus === 'expired' && (
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3 text-xs animate-scale-in">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-foreground text-sm">Mã QR Đã Hết Hạn</p>
                        <p className="text-muted-foreground leading-relaxed">
                          Đơn hàng đã hết hạn sau 15 phút. Mã quà tặng đã được hoàn trả lại vào kho. Nếu bạn đã chuyển khoản muộn, vui lòng liên hệ admin kèm biên lai để được hỗ trợ.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateQrOrder}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-secondary to-primary hover:opacity-95 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Tạo Mã VietQR Mới</span>
                      </button>
                    </div>
                  )}

                  {/* Guarantees */}
                  <div className="grid grid-cols-2 gap-2.5 text-[11px] text-muted-foreground">
                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Bảo hành hoàn tiền 100%</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-muted/30 border border-border flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-secondary shrink-0" />
                      <span>Giao mã tự động ngay</span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
{/* Wallet Method & Balance Box */}
              <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-primary/15 text-primary">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground block">Ví Số Dư Core</span>
                      <span className="text-[11px] text-muted-foreground">Thanh toán tự động</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Số dư hiện tại</span>
                    <span className="text-sm font-black font-display text-primary-light">{formatCore(userBalance)}</span>
                  </div>
                </div>

                {/* Total Calculation Row */}
                <div className="space-y-2">
                  {isEscalating ? (
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Giá theo lượt mua thứ {Number(escalatingData.completed_count) + 1}:
                      </span>
                      <span className="font-mono font-bold text-amber-300">
                        {formatCore(totalPrice)}
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Đơn giá niêm yết ({safeQty} gói x {formatCore(effectiveRegularPrice)}):
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {formatCore(effectiveRegularPrice * safeQty)}
                      </span>
                    </div>
                  )}

                  {!isEscalating && isFirstPurchaseEligible && totalDiscountAmount > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex flex-col gap-1 text-xs">
                      <div className="flex items-center justify-between text-rose-400 font-bold">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                          <span>Ưu đãi lần đầu:</span>
                        </div>
                        <span>−{formatCore(totalDiscountAmount)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">
                        Chỉ áp dụng 1 lần cho lần mua đầu tiên của gói này
                      </p>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground">Tổng thanh toán:</span>
                    <span className="font-display font-black text-base text-emerald-400">
                      {formatCore(totalPrice)}
                    </span>
                  </div>
                </div>

                {!isPriceValid ? (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-500 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Đang cập nhật giá sản phẩm</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          Vui lòng đợi giây lát hoặc tải lại trang để kiểm tra giá mới nhất.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : !isBalanceEnough ? (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-500 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Số Dư Core Không Đủ</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          Cần <strong className="text-foreground font-bold">{formatCore(totalPrice)}</strong>, ví hiện có <strong className="text-foreground font-bold">{formatCore(userBalance)}</strong>. Còn thiếu <strong className="text-amber-400 font-bold">{formatCore(totalPrice - userBalance)}</strong>.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleOpenTopup}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-95 text-slate-950 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Nạp Thêm Core Ngay</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Số dư ví đủ để thanh toán</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Sau mua còn: {formatCore(userBalance - totalPrice)}
                    </span>
                  </div>
                )}
              </div>

              {/* Guarantees */}
              <div className="grid grid-cols-2 gap-2.5 text-[11px] text-muted-foreground">
                <div className="p-2.5 rounded-xl bg-muted/30 border border-border flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Bảo hành hoàn tiền 100%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/30 border border-border flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-secondary shrink-0" />
                  <span>Giao mã tự động ngay</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={!isBalanceEnough ? handleOpenTopup : handlePayWithWallet}
                disabled={isProcessing || maxStock <= 0 || !isPriceValid}
                className={`w-full py-3.5 rounded-2xl font-display font-bold text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 ${
                  !isBalanceEnough
                    ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:opacity-95 text-slate-950 font-black shadow-amber-500/20'
                    : isEscalating
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black shadow-amber-500/30'
                    : 'bg-gradient-to-r from-secondary to-primary hover:opacity-95 text-white shadow-glow-primary'
                }`}
              >
                {!isBalanceEnough ? (
                  <PlusCircle className="w-4 h-4 text-slate-950" />
                ) : isEscalating ? (
                  <Zap className="w-4 h-4 fill-slate-950 text-slate-950" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-300" />
                )}
                <span>
                  {isProcessing
                    ? 'Đang xử lý thanh toán...'
                    : maxStock <= 0
                    ? 'Sản phẩm tạm hết hàng'
                    : !isPriceValid
                    ? 'Đang cập nhật giá...'
                    : !isBalanceEnough
                    ? `Thiếu ${formatCore(totalPrice - userBalance)} • Nạp Core Ngay`
                    : isEscalating
                    ? `Xác Nhận Mua Gói Nâng Giá • ${formatCore(totalPrice)}`
                    : `Xác Nhận Mua ${safeQty > 1 ? `(${safeQty} Gói)` : ''} • ${formatCore(totalPrice)}`}
                </span>
              </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Slippage Protection Dialog (Chống tăng giá bất ngờ khi có người mua trước) */}
    {priceEscalatedDialog && (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
        <div className="relative w-full max-w-md bg-card border border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl animate-scale-in space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/40">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
          <div className="text-center space-y-1">
            <h4 className="font-heading font-extrabold text-base sm:text-lg text-foreground">
              Giá Gói Vừa Tăng Theo Lượt!
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Đã có khách hàng hoàn tất thanh toán trước bạn một tích tắc. Theo quy tắc Nâng Giá, giá lượt hiện tại đã tăng từ <strong className="text-foreground font-mono">{formatCore(priceEscalatedDialog.oldPrice)}</strong> lên <strong className="text-amber-400 font-mono font-bold">{formatCore(priceEscalatedDialog.newPrice)}</strong>.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-muted/50 border border-border text-center space-y-1">
            <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Giá lượt mua mới của bạn</span>
            <p className="font-display font-black text-2xl text-emerald-400">
              {formatCore(priceEscalatedDialog.newPrice)}
            </p>
          </div>
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setPriceEscalatedDialog(null)}
              className="flex-1 py-3 px-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold cursor-pointer transition-all"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={() => handleAcceptNewEscalatedPrice(priceEscalatedDialog.newPrice)}
              className="flex-1 py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-95 text-slate-950 font-bold text-xs shadow-md cursor-pointer transition-all"
            >
              Đồng ý mua giá mới
            </button>
          </div>
        </div>
      </div>
    )}
  </>,
  document.body
);
};
