import React, { useState, useEffect, useMemo } from 'react';
import {
  Store,
  Package,
  KeyRound,
  ShoppingBag,
  Settings,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Shield,
  ShieldAlert,
  ArrowRight,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Edit2,
  Users,
  Coins,
  Send,
  Sliders,
  Sparkles,
  X,
  FileText,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  Layers,
} from 'lucide-react';
import { Game } from '../../types/game';

interface SellerCenterViewProps {
  currentUser: any;
  onOpenLogin: () => void;
  games: Game[];
  onNavigateHome: () => void;
}

export const SellerCenterView: React.FC<SellerCenterViewProps> = ({
  currentUser,
  onOpenLogin,
  games,
  onNavigateHome,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [sellerData, setSellerData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'codes' | 'orders' | 'disputes' | 'finance' | 'settings'>('dashboard');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Disputes State (§B)
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loadingDisputes, setLoadingDisputes] = useState<boolean>(false);
  const [disputeFilter, setDisputeFilter] = useState<string>('');
  const [unresolvedDisputeCount, setUnresolvedDisputeCount] = useState<number>(0);
  const [respondingDispute, setRespondingDispute] = useState<any>(null);
  const [disputeResponseMsg, setDisputeResponseMsg] = useState<string>('');
  const [disputeReplacementCode, setDisputeReplacementCode] = useState<string>('');
  const [isSubmittingDisputeResp, setIsSubmittingDisputeResp] = useState<boolean>(false);

  // Finance & Withdraw State (Giai đoạn 2)
  const [financeData, setFinanceData] = useState<any>(null);
  const [loadingFinance, setLoadingFinance] = useState<boolean>(false);
  const [sellerWithdrawals, setSellerWithdrawals] = useState<any[]>([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState<boolean>(false);

  // Products State
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Codes State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [codes, setCodes] = useState<any[]>([]);
  const [loadingCodes, setLoadingCodes] = useState<boolean>(false);
  const [showAddCodesModal, setShowAddCodesModal] = useState<boolean>(false);
  const [revealedCode, setRevealedCode] = useState<{ id: string; code: string } | null>(null);

  // Orders State
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [orderFilter, setOrderFilter] = useState<string>('');
  const [resolvingOrder, setResolvingOrder] = useState<any>(null);
  const [resolveType, setResolveType] = useState<'REPLACE_CODE' | 'REFUND_CORE'>('REPLACE_CODE');
  const [resolveNote, setResolveNote] = useState<string>('');

  // Subaccounts State
  const [subaccounts, setSubaccounts] = useState<any[]>([]);
  const [newSubEmail, setNewSubEmail] = useState<string>('');
  const [newSubRole, setNewSubRole] = useState<'VIEW_ORDERS' | 'MANAGE_STOCK'>('VIEW_ORDERS');

  // Registration Form State
  const [regName, setRegName] = useState<string>('');
  const [regSlug, setRegSlug] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regBankName, setRegBankName] = useState<string>('');
  const [regBankAccount, setRegBankAccount] = useState<string>('');
  const [regBankAccountName, setRegBankAccountName] = useState<string>('');
  const [regDescription, setRegDescription] = useState<string>('');
  const [regSupportHours, setRegSupportHours] = useState<string>('08:00 - 22:00');
  const [regWarranty, setRegWarranty] = useState<string>('Bảo hành 24H 1 đổi 1 hoặc hoàn tiền nếu mã lỗi');
  const [regRefund, setRegRefund] = useState<string>('Hoàn 100% Core nếu mã lỗi và shop hết mã đổi');
  const [isSubmittingReg, setIsSubmittingReg] = useState<boolean>(false);

  // New Product Form State
  const [prodGameSlug, setProdGameSlug] = useState<string>('');
  const [prodName, setProdName] = useState<string>('');
  const [prodPriceCore, setProdPriceCore] = useState<string>('');
  const [prodOriginalPriceCore, setProdOriginalPriceCore] = useState<string>('');
  const [prodWarrantyType, setProdWarrantyType] = useState<string>('24H');
  const [prodWarrantyHours, setProdWarrantyHours] = useState<number>(24);
  const [prodDeliveryType, setProdDeliveryType] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [prodDescription, setProdDescription] = useState<string>('');
  const [prodLowStock, setProdLowStock] = useState<number>(2);

  // Add Codes Input
  const [rawCodesText, setRawCodesText] = useState<string>('');

  const getAuthToken = () => {
    return localStorage.getItem('wcg_auth_token') || sessionStorage.getItem('wcg_auth_token') || '';
  };

  const getHeaders = () => {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  // Fetch Seller Info
  const fetchSellerInfo = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/seller', { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        if (data.has_seller) {
          setSellerData(data.seller);
          setStats(data.stats);
          fetchDisputes();
        } else {
          setSellerData(null);
        }
      } else {
        setErrorMsg(data.error || 'Không thể tải thông tin gian hàng.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchSellerInfo();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  // Fetch Products
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch('/api/seller/products', { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        if (!selectedProductId && data.products && data.products.length > 0) {
          setSelectedProductId(data.products[0].id);
        }
      }
    } catch {}
    setLoadingProducts(false);
  };

  // Fetch Codes
  const fetchCodes = async (productId: string) => {
    if (!productId) return;
    setLoadingCodes(true);
    try {
      const res = await fetch(`/api/seller/products/${productId}/codes?limit=100`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setCodes(data.codes || []);
      }
    } catch {}
    setLoadingCodes(false);
  };

  // Fetch Orders
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const url = orderFilter ? `/api/seller/orders?status=${orderFilter}` : '/api/seller/orders';
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch {}
    setLoadingOrders(false);
  };

  // Fetch Subaccounts
  const fetchSubaccounts = async () => {
    try {
      const res = await fetch('/api/seller/subaccounts', { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setSubaccounts(data.subaccounts || []);
      }
    } catch {}
  };

  // Fetch Finance & Sổ Cái & Lịch Sử Rút Tiền (Giai đoạn 2)
  const fetchSellerFinance = async () => {
    setLoadingFinance(true);
    try {
      const [resFin, resWdr] = await Promise.all([
        fetch('/api/seller/finance', { headers: getHeaders() }),
        fetch('/api/seller/finance/withdrawals', { headers: getHeaders() }),
      ]);
      const dataFin = await resFin.json();
      const dataWdr = await resWdr.json();
      if (dataFin.success) setFinanceData(dataFin);
      if (dataWdr.success) setSellerWithdrawals(dataWdr.withdrawals || []);
    } catch (err) {
      console.warn('Fetch seller finance error:', err);
    } finally {
      setLoadingFinance(false);
    }
  };

  // Gửi Yêu Cầu Rút Tiền (§8)
  const handleRequestWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(withdrawAmount, 10);
    if (isNaN(amt) || amt < 1) {
      setErrorMsg('Số tiền rút tối thiểu là 1 Core.');
      return;
    }
    setIsSubmittingWithdraw(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/seller/finance/withdraw', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ amount_core: amt }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || 'Gửi yêu cầu rút tiền thành công!');
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        fetchSellerFinance();
        fetchSellerInfo();
      } else {
        setErrorMsg(data.error || 'Rút tiền thất bại.');
      }
    } catch {
      setErrorMsg('Không thể kết nối đến máy chủ.');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  useEffect(() => {
    if (sellerData && (sellerData.status === 'TRIAL' || sellerData.status === 'ACTIVE')) {
      if (activeTab === 'products') fetchProducts();
      if (activeTab === 'codes') {
        fetchProducts();
        if (selectedProductId) fetchCodes(selectedProductId);
      }
      if (activeTab === 'orders') fetchOrders();
      if (activeTab === 'disputes') fetchDisputes();
      if (activeTab === 'finance') fetchSellerFinance();
      if (activeTab === 'settings') fetchSubaccounts();
    }
  }, [sellerData, activeTab, selectedProductId, orderFilter, disputeFilter]);

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReg(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/seller', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: regName,
          slug: regSlug,
          contact_phone: regPhone,
          bank_name: regBankName,
          bank_account: regBankAccount,
          bank_account_name: regBankAccountName,
          description: regDescription,
          support_hours: regSupportHours,
          warranty_policy: regWarranty,
          refund_policy: regRefund,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Đăng ký mở gian hàng thành công! Hồ sơ đang chờ Quản trị viên duyệt.');
        fetchSellerInfo();
      } else {
        setErrorMsg(data.error || 'Đăng ký thất bại.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  // Handle Toggle Vacation Mode (§6.4)
  const handleToggleVacation = async () => {
    if (!sellerData) return;
    const nextVacation = sellerData.is_vacation ? 0 : 1;
    try {
      const res = await fetch('/api/seller', {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ is_vacation: nextVacation }),
      });
      const data = await res.json();
      if (data.success) {
        setSellerData({ ...sellerData, is_vacation: nextVacation });
        setSuccessMsg(data.message);
      } else {
        setErrorMsg(data.error || 'Thao tác thất bại.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ.');
    }
  };

  // Handle Create Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch('/api/seller/products', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          game_slug: prodGameSlug,
          name: prodName,
          description: prodDescription,
          price_core: parseInt(prodPriceCore, 10),
          original_price_core: prodOriginalPriceCore ? parseInt(prodOriginalPriceCore, 10) : undefined,
          warranty_type: prodWarrantyType,
          warranty_hours: prodWarrantyHours,
          delivery_type: prodDeliveryType,
          low_stock_threshold: prodLowStock,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddProductModal(false);
        setSuccessMsg(data.message);
        fetchProducts();
        // Reset form
        setProdName('');
        setProdPriceCore('');
        setProdOriginalPriceCore('');
        setProdDescription('');
      } else {
        setErrorMsg(data.error || 'Tạo sản phẩm thất bại.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ.');
    }
  };

  // Handle Add Codes
  const handleAddCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !rawCodesText.trim()) return;
    setErrorMsg('');
    try {
      const res = await fetch(`/api/seller/products/${selectedProductId}/codes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ codes: rawCodesText }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddCodesModal(false);
        setRawCodesText('');
        setSuccessMsg(data.message);
        fetchCodes(selectedProductId);
        fetchProducts();
      } else {
        setErrorMsg(data.error || 'Nạp mã thất bại.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ.');
    }
  };

  // Handle Reveal Code
  const handleRevealCode = async (codeId: string) => {
    try {
      const res = await fetch(`/api/seller/codes/${codeId}/reveal`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setRevealedCode({ id: codeId, code: data.code });
      } else {
        setErrorMsg(data.error || 'Không thể xem mã.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ.');
    }
  };

  // Handle Delete Code
  const handleDeleteCode = async (codeId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa mã này khỏi kho?')) return;
    try {
      const res = await fetch(`/api/seller/codes/${codeId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        if (selectedProductId) fetchCodes(selectedProductId);
        fetchProducts();
      } else {
        setErrorMsg(data.error || 'Xóa mã thất bại.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ.');
    }
  };

  // Handle Resolve Order Dispute
  const handleResolveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingOrder) return;
    try {
      const res = await fetch(`/api/seller/orders/${resolvingOrder.id}/resolve-report`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          resolution_type: resolveType,
          note: resolveNote,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResolvingOrder(null);
        setResolveNote('');
        setSuccessMsg(data.message);
        fetchOrders();
        fetchSellerInfo();
      } else {
        setErrorMsg(data.error || 'Xử lý thất bại.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ.');
    }
  };

  // Fetch Disputes (§B)
  const fetchDisputes = async () => {
    setLoadingDisputes(true);
    try {
      const url = disputeFilter ? `/api/seller/disputes?status=${disputeFilter}` : '/api/seller/disputes';
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        setDisputes(data.disputes || []);
        setUnresolvedDisputeCount(data.unresolved_count || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDisputes(false);
    }
  };

  // Handle Respond Dispute (§B)
  const handleRespondDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondingDispute || !disputeResponseMsg.trim()) return;
    setIsSubmittingDisputeResp(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/seller/disputes/${respondingDispute.id}/respond`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          message: disputeResponseMsg.trim(),
          replacement_code: disputeReplacementCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRespondingDispute(null);
        setDisputeResponseMsg('');
        setDisputeReplacementCode('');
        setSuccessMsg(data.message || 'Đã gửi phản hồi khiếu nại thành công!');
        fetchDisputes();
      } else {
        setErrorMsg(data.error || 'Phản hồi thất bại.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ.');
    } finally {
      setIsSubmittingDisputeResp(false);
    }
  };

  // Handle Add Subaccount
  const handleAddSubaccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubEmail.trim()) return;
    try {
      const res = await fetch('/api/seller/subaccounts', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          email: newSubEmail,
          role: newSubRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewSubEmail('');
        setSuccessMsg(data.message);
        fetchSubaccounts();
      } else {
        setErrorMsg(data.error || 'Thêm tài khoản phụ thất bại.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ.');
    }
  };

  // 1. Chưa đăng nhập
  if (!currentUser) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-500">
          <Store className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Trung Tâm Người Bán CodeGame.shop</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          Vui lòng đăng nhập tài khoản thành viên để đăng ký mở gian hàng và quản lý kinh doanh.
        </p>
        <button
          onClick={onOpenLogin}
          className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
        >
          Đăng Nhập Ngay
        </button>
      </div>
    );
  }

  // 2. Đang tải
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // 3. Chưa có gian hàng -> Form Đăng Ký (§3.1)
  if (!sellerData) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-500 text-xs font-semibold mb-3 border border-amber-500/20">
            <Sparkles className="w-4 h-4" /> Giai Đoạn 1: Nền Gian Hàng Số (MVP)
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Đăng Ký Mở Gian Hàng Kinh Doanh</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-xl mx-auto">
            Bán mã quà tặng, giftcode và dịch vụ game tự động. Nhận thanh toán ngay bằng ví Core nội bộ, giao mã tức thì 24/7.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Tên Gian Hàng *</label>
              <input
                type="text"
                required
                value={regName}
                onChange={(e) => {
                  setRegName(e.target.value);
                  if (!regSlug) {
                    setRegSlug(
                      e.target.value
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '')
                    );
                  }
                }}
                placeholder="Ví dụ: Shop Code Uy Tín VN"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Đường Dẫn Gian Hàng (Slug) *</label>
              <div className="flex items-center">
                <span className="px-3 py-2.5 bg-muted text-muted-foreground text-xs rounded-l-xl border border-r-0 border-border select-none whitespace-nowrap shrink-0">
                  /gian-hang/
                </span>
                <input
                  type="text"
                  required
                  value={regSlug}
                  onChange={(e) => setRegSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="shop-code-uy-tin"
                  className="w-full px-3.5 py-2.5 rounded-r-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Số Điện Thoại / Zalo</label>
              <input
                type="text"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="0912345678"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Ngân Hàng (Dùng đối soát)</label>
              <input
                type="text"
                value={regBankName}
                onChange={(e) => setRegBankName(e.target.value)}
                placeholder="MBBank / Vietcombank"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Số Tài Khoản</label>
              <input
                type="text"
                value={regBankAccount}
                onChange={(e) => setRegBankAccount(e.target.value)}
                placeholder="0123456789"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">Giờ Hỗ Trợ Khách Hàng</label>
            <input
              type="text"
              value={regSupportHours}
              onChange={(e) => setRegSupportHours(e.target.value)}
              placeholder="08:00 - 22:00 hàng ngày"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">Mô Tả Giới Thiệu Gian Hàng</label>
            <textarea
              rows={3}
              value={regDescription}
              onChange={(e) => setRegDescription(e.target.value)}
              placeholder="Chuyên cung cấp mã giftcode chính hãng, kích hoạt nhanh..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Chính Sách Bảo Hành</label>
              <textarea
                rows={3}
                value={regWarranty}
                onChange={(e) => setRegWarranty(e.target.value)}
                placeholder="Ví dụ: Đổi mã mới trong 15 phút nếu mã lỗi, hoàn tiền nếu hết mã..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Chính Sách Hoàn Tiền</label>
              <textarea
                rows={3}
                value={regRefund}
                onChange={(e) => setRegRefund(e.target.value)}
                placeholder="Ví dụ: Hoàn 100% Core nếu mã không đúng mô tả hoặc không sử dụng được..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmittingReg}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-95 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
          >
            {isSubmittingReg ? 'Đang gửi hồ sơ...' : 'Gửi Hồ Sơ Đăng Ký Mở Gian Hàng'}
          </button>
        </form>
      </div>
    );
  }

  // 4. Gian hàng đang chờ duyệt hoặc bị từ chối
  if (sellerData.status === 'PENDING') {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Hồ Sơ Đang Chờ Xét Duyệt</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Gian hàng <strong>{sellerData.name}</strong> (/gian-hang/{sellerData.slug}) đã được tiếp nhận và đang trong hàng chờ thẩm định của Quản trị viên CodeGame.shop.
        </p>
        {sellerData.request_info_note && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs text-left mb-6">
            <strong>Yêu cầu bổ sung từ Quản trị viên:</strong> {sellerData.request_info_note}
          </div>
        )}
        <button onClick={fetchSellerInfo} className="px-5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-sm font-semibold">
          Làm Mới Trạng Thái
        </button>
      </div>
    );
  }

  if (sellerData.status === 'REJECTED') {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Hồ Sơ Bị Từ Chối</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Gian hàng <strong>{sellerData.name}</strong> chưa đủ điều kiện phê duyệt.
        </p>
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs text-left mb-6">
          <strong>Lý do từ chối:</strong> {sellerData.reject_reason || 'Không đáp ứng tiêu chuẩn sàn.'}
        </div>
        <button
          onClick={() => setSellerData(null)}
          className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-md"
        >
          Nộp Lại Hồ Sơ Mới
        </button>
      </div>
    );
  }

  // 5. Bảng điều khiển người bán chính (TRIAL / ACTIVE)
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header Profile Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xl shrink-0">
              {sellerData.avatar_url ? (
                <img src={sellerData.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                sellerData.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight">{sellerData.name}</h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    sellerData.status === 'ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  }`}
                >
                  {sellerData.status === 'ACTIVE' ? 'CHÍNH THỨC (ACTIVE)' : 'THỬ VIỆC (TRIAL)'}
                </span>
                {sellerData.is_vacation === 1 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                    <PauseCircle className="w-3 h-3" /> Đang Nghỉ Bán
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                <span>
                  Đường dẫn: <a href={`/gian-hang/${sellerData.slug}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">/gian-hang/{sellerData.slug}</a>
                </span>
                <span>•</span>
                <span>Uy tín: <strong className="text-foreground">{sellerData.reputation_score || 100} điểm</strong></span>
                <span>•</span>
                <span>Giờ hỗ trợ: {sellerData.support_hours}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleVacation}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                sellerData.is_vacation
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-muted hover:bg-muted/80 text-foreground border-border'
              }`}
            >
              {sellerData.is_vacation ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
              {sellerData.is_vacation ? 'Mở Bán Lại' : 'Nghỉ Bán 1 Chạm'}
            </button>
            <a
              href={`/gian-hang/${sellerData.slug}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Store className="w-4 h-4" /> Xem Gian Hàng
            </a>
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="mb-4 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')}><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 border-b border-border/80 text-xs">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'dashboard' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          <Sliders className="w-4 h-4" /> Tổng Quan
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'products' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          <Package className="w-4 h-4" /> Sản Phẩm ({stats?.total_products || products.length})
        </button>
        <button
          onClick={() => setActiveTab('codes')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'codes' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          <KeyRound className="w-4 h-4" /> Kho Mã & Nạp Kho
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'orders' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          <ShoppingBag className="w-4 h-4" /> Đơn Hàng Bán
          {(stats?.reported_orders_count || 0) > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-destructive text-white text-[10px]">
              {stats.reported_orders_count}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('disputes');
            fetchDisputes();
          }}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'disputes' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Khiếu Nại Sàn
          {unresolvedDisputeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-destructive text-white text-[10px] font-bold">
              {unresolvedDisputeCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('finance')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'finance' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          <Coins className="w-4 h-4" /> Tài Chính & Rút Tiền
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'settings' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60'
          }`}
        >
          <Settings className="w-4 h-4" /> Cài Đặt & Tài Khoản Phụ
        </button>
      </div>

      {/* Tab 1: Dashboard (§4) */}
      {activeTab === 'dashboard' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-card border border-border">
              <div className="text-xs text-muted-foreground font-medium mb-1">Doanh Thu Hôm Nay</div>
              <div className="text-2xl font-black text-foreground flex items-center gap-1.5">
                {stats.today_revenue_core.toLocaleString()} <span className="text-xs font-semibold text-amber-500">Core</span>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border">
              <div className="text-xs text-muted-foreground font-medium mb-1">Doanh Thu 30 Ngày</div>
              <div className="text-2xl font-black text-foreground flex items-center gap-1.5">
                {stats.month_revenue_core.toLocaleString()} <span className="text-xs font-semibold text-amber-500">Core</span>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border">
              <div className="text-xs text-muted-foreground font-medium mb-1">Số Dư Chờ Rút</div>
              <div className="text-2xl font-black text-emerald-500 flex items-center gap-1.5">
                {stats.pending_balance_core.toLocaleString()} <span className="text-xs font-semibold">Core</span>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-card border border-border">
              <div className="text-xs text-muted-foreground font-medium mb-1">Điểm Uy Tín Gian Hàng</div>
              <div className="text-2xl font-black text-primary">
                {stats.reputation_score} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
              </div>
            </div>
          </div>

          {/* Warnings & Alerts */}
          {(stats.reported_orders_count > 0 || stats.low_stock_products_count > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.reported_orders_count > 0 && (
                <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Có {stats.reported_orders_count} đơn hàng báo lỗi cần xử lý!</div>
                      <div className="text-[11px] opacity-80">Vui lòng kiểm tra và đổi mã mới hoặc hoàn Core cho khách.</div>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('orders')} className="px-3 py-1.5 rounded-lg bg-destructive text-white text-xs font-semibold shrink-0">
                    Xử Lý Ngay
                  </button>
                </div>
              )}
              {stats.low_stock_products_count > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Có {stats.low_stock_products_count} sản phẩm sắp hết kho!</div>
                      <div className="text-[11px] opacity-80">Nạp thêm mã để tránh bị tự động ẩn ngoài web khách.</div>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('codes')} className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-semibold shrink-0">
                    Nạp Kho
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Trial Notice */}
          {sellerData.status === 'TRIAL' && (
            <div className="p-4 rounded-2xl bg-muted/60 border border-border text-xs leading-relaxed space-y-1">
              <div className="font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> Quy định giai đoạn thử việc (TRIAL):
              </div>
              <p className="text-muted-foreground">
                • Gian hàng đang trong giai đoạn thử việc được đăng tối đa <strong>{sellerData.trial_product_limit || 5} sản phẩm</strong>.
              </p>
              <p className="text-muted-foreground">
                • Giá bán tối đa mỗi sản phẩm không vượt quá <strong>{sellerData.trial_order_max || 200} Core</strong>.
              </p>
              <p className="text-muted-foreground">
                • Mọi sản phẩm mới hoặc khi đổi giá cần qua Quản trị viên duyệt (PENDING_REVIEW) trước khi mở bán công khai.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Products (§5.1, §5.3) */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Danh Sách Sản Phẩm Của Gian Hàng</h2>
            <button
              onClick={() => setShowAddProductModal(true)}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Thêm Sản Phẩm Mới
            </button>
          </div>

          {loadingProducts ? (
            <div className="py-12 text-center text-muted-foreground">Đang tải sản phẩm...</div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center bg-card border border-border rounded-2xl">
              <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
              <div className="text-sm font-semibold">Chưa có sản phẩm nào</div>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Nhấn nút bên dưới để tạo sản phẩm đầu tiên.</p>
              <button
                onClick={() => setShowAddProductModal(true)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
              >
                Tạo Sản Phẩm
              </button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <table className="table-fixed w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3 w-[40%]">Sản Phẩm & Game</th>
                    <th className="p-3 w-[15%] text-right">Giá Bán</th>
                    <th className="p-3 w-[15%] text-center">Tồn Kho</th>
                    <th className="p-3 w-[15%] text-center">Trạng Thái</th>
                    <th className="p-3 w-[15%] text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <img src={p.cover_url} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0 border border-border" />
                          <div className="truncate">
                            <div className="font-bold truncate" title={p.name}>{p.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{p.game_name || p.game_slug} • BH: {p.warranty_type}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right font-bold text-foreground">
                        {p.price_core.toLocaleString()} Core
                        {p.original_price_core && (
                          <div className="text-[10px] text-muted-foreground line-through">
                            {p.original_price_core.toLocaleString()} Core
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          p.in_stock_count > (p.low_stock_threshold || 2)
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : p.in_stock_count > 0
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          Còn {p.in_stock_count}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : p.status === 'PENDING_REVIEW'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}>
                          {p.status === 'APPROVED' ? 'Đã Duyệt' : p.status === 'PENDING_REVIEW' ? 'Chờ Duyệt' : 'Từ Chối'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setActiveTab('codes');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[11px] font-semibold mr-1"
                        >
                          Kho Mã
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Codes & Restock (§5.2) */}
      {activeTab === 'codes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold whitespace-nowrap">Chọn Sản Phẩm:</label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  fetchCodes(e.target.value);
                }}
                className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-medium focus:outline-none focus:border-primary max-w-xs"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Còn {p.in_stock_count})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowAddCodesModal(true)}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" /> Nạp Thêm Mã Vào Kho
            </button>
          </div>

          {loadingCodes ? (
            <div className="py-12 text-center text-muted-foreground">Đang tải danh sách mã...</div>
          ) : codes.length === 0 ? (
            <div className="py-12 text-center bg-card border border-border rounded-2xl">
              <KeyRound className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
              <div className="text-sm font-semibold">Kho sản phẩm này đang trống</div>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Nạp danh sách mã giftcode để bắt đầu bán tự động.</p>
              <button
                onClick={() => setShowAddCodesModal(true)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
              >
                Nạp Mã Ngay
              </button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <table className="table-fixed w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3 w-[45%]">Mã Kho (Mã Hóa / Che)</th>
                    <th className="p-3 w-[20%] text-center">Trạng Thái</th>
                    <th className="p-3 w-[20%] text-center">Lô Nạp</th>
                    <th className="p-3 w-[15%] text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {codes.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono">
                        {revealedCode && revealedCode.id === c.id ? (
                          <span className="font-bold text-primary select-all">{revealedCode.code}</span>
                        ) : (
                          <span className="text-muted-foreground tracking-widest">{c.masked_code}</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'IN_STOCK'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : c.status === 'SOLD'
                            ? 'bg-blue-500/10 text-blue-500'
                            : c.status === 'REPORTED'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3 text-center text-muted-foreground font-mono text-[10px]">
                        {c.batch_id}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleRevealCode(c.id)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground mr-1"
                          title="Xem mã nguyên vẹn (Ghi log kiểm toán)"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {c.status === 'IN_STOCK' && (
                          <button
                            onClick={() => handleDeleteCode(c.id)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Xóa mã chưa bán"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Orders & Dispute Resolution (§6.2, §6.3) */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Danh Sách Đơn Hàng Bán Ra</h2>
            <div className="flex items-center gap-2">
              <select
                value={orderFilter}
                onChange={(e) => setOrderFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-medium focus:outline-none focus:border-primary"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="DELIVERED">Đã Giao (DELIVERED)</option>
                <option value="REPORTED">Báo Lỗi / Khiếu Nại (REPORTED)</option>
                <option value="REFUNDED">Đã Hoàn Tiền (REFUNDED)</option>
              </select>
            </div>
          </div>

          {loadingOrders ? (
            <div className="py-12 text-center text-muted-foreground">Đang tải đơn hàng...</div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center bg-card border border-border rounded-2xl">
              <ShoppingBag className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
              <div className="text-sm font-semibold">Chưa có đơn hàng nào</div>
              <p className="text-xs text-muted-foreground mt-1">Các đơn hàng phát sinh từ web khách sẽ hiển thị tại đây.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <table className="table-fixed w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3 w-[25%]">Mã Đơn & Ngày Mua</th>
                    <th className="p-3 w-[30%]">Sản Phẩm & Khách</th>
                    <th className="p-3 w-[15%] text-right">Giá Core</th>
                    <th className="p-3 w-[15%] text-center">Trạng Thái</th>
                    <th className="p-3 w-[15%] text-center">Xử Lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-mono font-bold">{o.order_code}</div>
                        <div className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleString('vi-VN')}</div>
                      </td>
                      <td className="p-3 truncate">
                        <div className="font-bold truncate">{o.product_name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">Khách: {o.buyer_name || o.buyer_member_id}</div>
                      </td>
                      <td className="p-3 text-right font-bold text-foreground">
                        {o.price_core.toLocaleString()} Core
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          o.status === 'DELIVERED'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : o.status === 'REPORTED'
                            ? 'bg-destructive/10 text-destructive animate-pulse'
                            : o.status === 'REFUNDED'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {o.status === 'DELIVERED' ? 'Đã Giao' : o.status === 'REPORTED' ? 'Báo Lỗi' : o.status === 'REFUNDED' ? 'Đã Hoàn Tiền' : o.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {o.status === 'REPORTED' ? (
                          <button
                            onClick={() => {
                              setResolvingOrder(o);
                              setResolveType('REPLACE_CODE');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-destructive text-white text-[11px] font-bold shadow-sm"
                          >
                            Xử Lý
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4b: Quản Lý Khiếu Nại Sàn TMĐT (§B) */}
      {activeTab === 'disputes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-destructive" /> Khiếu Nại & Tranh Chấp Sàn TMĐT
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Các đơn hàng đang trong thời hạn 168h giữ tiền bị người mua báo lỗi cần phản hồi hoặc cấp mã thay thế.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={disputeFilter}
                onChange={(e) => setDisputeFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-border bg-card text-foreground text-xs font-semibold focus:outline-none"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="OPEN">Chờ Shop phản hồi (OPEN)</option>
                <option value="WAITING_SELLER">Đã phản hồi (WAITING)</option>
                <option value="RESOLVED_REPLACED">Đã đổi mã (REPLACED)</option>
                <option value="RESOLVED_REFUNDED">Đã hoàn tiền (REFUNDED)</option>
                <option value="REJECTED">Từ chối khiếu nại (REJECTED)</option>
              </select>

              <button
                onClick={fetchDisputes}
                disabled={loadingDisputes}
                className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground transition-all"
                title="Làm mới danh sách"
              >
                <RefreshCw className={`w-4 h-4 ${loadingDisputes ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loadingDisputes ? (
            <div className="py-16 text-center text-muted-foreground">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
              <p className="text-xs">Đang tải danh sách khiếu nại...</p>
            </div>
          ) : disputes.length === 0 ? (
            <div className="py-16 text-center bg-card border border-border rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/30 mx-auto mb-2" />
              <div className="text-sm font-semibold">Không có khiếu nại nào</div>
              <p className="text-xs text-muted-foreground mt-1">Gian hàng của bạn hiện không có đơn hàng nào bị khiếu nại.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
              <table className="table-fixed w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="w-[22%] p-3 text-left">Đơn Hàng & Gói</th>
                    <th className="w-[20%] p-3 text-left">Khách & Lý Do</th>
                    <th className="w-[28%] p-3 text-left">Nội Dung Chi Tiết</th>
                    <th className="w-[15%] p-3 text-center">Trạng Thái</th>
                    <th className="w-[15%] p-3 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {disputes.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="font-mono font-bold text-foreground text-xs">{d.order_code}</div>
                        <div className="text-[10px] font-mono text-primary/80 truncate mt-0.5" title={`Mã khiếu nại: ${d.id}`}>
                          ID: {d.id}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate" title={d.product_name}>
                          {d.product_name}
                        </div>
                        <div className="text-[10px] text-amber-500 font-semibold mt-0.5">
                          {Number(d.price_core).toLocaleString()} Core
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-foreground truncate" title={d.buyer_username}>
                          {d.buyer_username || 'Khách hàng'}
                        </div>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.reason === 'WRONG_CODE'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : d.reason === 'USED_CODE'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : d.reason === 'EXPIRED_CODE'
                            ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {d.reason === 'WRONG_CODE' ? 'Mã Sai' :
                           d.reason === 'USED_CODE' ? 'Mã Đã Dùng' :
                           d.reason === 'EXPIRED_CODE' ? 'Hết Hạn' : 'Sai Mô Tả'}
                        </span>
                      </td>

                      <td className="p-3">
                        {d.detail && (
                          <div className="text-foreground text-[11px] line-clamp-2" title={d.detail}>
                            "{d.detail}"
                          </div>
                        )}
                        {d.seller_response && (
                          <div className="mt-1 text-[10px] text-primary-light bg-muted/40 p-1.5 rounded-lg border border-border/60">
                            <strong>Shop:</strong> {d.seller_response}
                          </div>
                        )}
                        {d.seller_replacement_code && (
                          <div className="mt-0.5 text-[10px] font-mono text-emerald-400">
                            Mã đổi: {d.seller_replacement_code}
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.status === 'OPEN'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                            : d.status === 'WAITING_SELLER'
                            ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                            : d.status === 'RESOLVED_REPLACED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : d.status === 'RESOLVED_REFUNDED'
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                            : 'bg-destructive/15 text-destructive border border-destructive/30'
                        }`}>
                          {d.status === 'OPEN' ? 'Chờ Phản Hồi' :
                           d.status === 'WAITING_SELLER' ? 'Đã Phản Hồi' :
                           d.status === 'RESOLVED_REPLACED' ? 'Đã Đổi Mã' :
                           d.status === 'RESOLVED_REFUNDED' ? 'Đã Hoàn Core' :
                           'Đã Từ Chối'}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        {(d.status === 'OPEN' || d.status === 'WAITING_SELLER') ? (
                          <button
                            onClick={() => {
                              setRespondingDispute(d);
                              setDisputeResponseMsg(d.seller_response || '');
                              setDisputeReplacementCode(d.seller_replacement_code || '');
                            }}
                            className="px-2.5 py-1 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-[11px] font-bold shadow-sm transition-opacity"
                          >
                            Phản Hồi
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground font-mono">Đã xong</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Tài Chính & Rút Tiền (Giai đoạn 2) */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          {/* 3 Ngăn số dư */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-card border border-border">
              <div className="text-xs text-muted-foreground font-medium mb-1">Đang Giữ (Hold)</div>
              <div className="text-2xl font-black text-amber-500 flex items-center gap-1.5">
                {Number(financeData?.balances?.held_core ?? sellerData?.pending_balance_core ?? 0).toLocaleString('vi-VN')}
                <span className="text-xs font-semibold">Core</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Tạm giữ {financeData?.config?.hold_hours || 168}h sau khi giao mã thành công để bảo vệ người mua.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border">
              <div className="text-xs text-muted-foreground font-medium mb-1">Khả Dụng (Available)</div>
              <div className="text-2xl font-black text-emerald-500 flex items-center gap-1.5">
                {Number(financeData?.balances?.available_core ?? sellerData?.available_balance_core ?? 0).toLocaleString('vi-VN')}
                <span className="text-xs font-semibold">Core</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Số dư đã hoàn tất thời gian giữ, có thể yêu cầu rút về tài khoản ngân hàng.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border">
              <div className="text-xs text-muted-foreground font-medium mb-1">Đã Chi Trả (Withdrawn)</div>
              <div className="text-2xl font-black text-blue-500 flex items-center gap-1.5">
                {Number(financeData?.balances?.withdrawn_core ?? sellerData?.withdrawn_balance_core ?? 0).toLocaleString('vi-VN')}
                <span className="text-xs font-semibold">Core</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Tổng số Core đã chuyển khoản ra ngoài tài khoản ngân hàng của bạn.
              </p>
            </div>
          </div>

          {/* Hộp hành động rút tiền & Tài khoản ngân hàng */}
          <div className="p-5 rounded-2xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Coins className="w-4 h-4 text-primary" /> Rút Tiền Về Tài Khoản Ngân Hàng
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ngân hàng nhận: <span className="font-bold text-foreground">{sellerData?.bank_name || 'Chưa cài đặt'}</span> • STK: <span className="font-mono font-bold text-foreground">{sellerData?.bank_account || '—'}</span> ({sellerData?.bank_account_name || '—'})
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {sellerData?.sub_role ? (
                <span className="text-xs text-muted-foreground italic bg-muted px-3 py-1.5 rounded-xl border border-border">
                  Tài khoản phụ không có quyền rút tiền
                </span>
              ) : (
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  disabled={Number(financeData?.balances?.available_core ?? sellerData?.available_balance_core ?? 0) < 1}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all hover:bg-primary/90"
                >
                  <ArrowRight className="w-4 h-4" /> Yêu Cầu Rút Tiền
                </button>
              )}
            </div>
          </div>

          {/* Lịch sử yêu cầu rút tiền */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-muted/20 font-bold text-xs flex items-center justify-between">
              <span>Lịch Sử Yêu Cầu Rút Tiền</span>
              <button onClick={fetchSellerFinance} className="text-muted-foreground hover:text-foreground text-[11px] flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${loadingFinance ? 'animate-spin' : ''}`} /> Làm mới
              </button>
            </div>
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                <tr>
                  <th style={{ width: '22%' }} className="p-3">Thời Gian</th>
                  <th style={{ width: '22%' }} className="p-3">Số Core Yêu Cầu</th>
                  <th style={{ width: '28%' }} className="p-3">Tài Khoản Nhận</th>
                  <th style={{ width: '28%' }} className="p-3 text-right">Trạng Thái & Ghi Chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sellerWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      Bạn chưa có yêu cầu rút tiền nào.
                    </td>
                  </tr>
                ) : (
                  sellerWithdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-muted/20">
                      <td className="p-3 font-semibold">{new Date(w.created_at).toLocaleString('vi-VN')}</td>
                      <td className="p-3 font-bold font-mono text-primary text-sm">
                        {Number(w.amount_core).toLocaleString('vi-VN')} Core
                      </td>
                      <td className="p-3">
                        <div className="font-semibold truncate">{w.bank_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">{w.bank_account} ({w.bank_account_name})</div>
                      </td>
                      <td className="p-3 text-right">
                        <div>
                          {w.status === 'PENDING' && <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold text-[10px] border border-amber-500/20">Chờ duyệt</span>}
                          {w.status === 'APPROVED' && <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold text-[10px] border border-blue-500/20">Đã duyệt (Chờ chuyển)</span>}
                          {w.status === 'PAID' && <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold text-[10px] border border-emerald-500/20">Đã chi trả</span>}
                          {w.status === 'REJECTED' && <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold text-[10px] border border-destructive/20">Đã từ chối</span>}
                        </div>
                        {w.review_note && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 truncate" title={w.review_note}>
                            {w.review_note}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Sổ cái gian hàng */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-muted/20 font-bold text-xs flex items-center justify-between">
              <span>Sổ Cái Biến Động Số Dư (Ledger)</span>
              <span className="text-[11px] text-muted-foreground">Minh bạch 100% từng dòng giao dịch</span>
            </div>
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                <tr>
                  <th style={{ width: '20%' }} className="p-3">Thời Gian</th>
                  <th style={{ width: '16%' }} className="p-3">Nghiệp Vụ</th>
                  <th style={{ width: '18%' }} className="p-3">Biến Động (Core)</th>
                  <th style={{ width: '26%' }} className="p-3">3 Ngăn Số Dư Sau Giao Dịch</th>
                  <th style={{ width: '20%' }} className="p-3 text-right">Diễn Giải</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(!financeData?.ledger || financeData.ledger.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      Chưa có phát sinh biến động sổ cái.
                    </td>
                  </tr>
                ) : (
                  financeData.ledger.map((l: any) => (
                    <tr key={l.id} className="hover:bg-muted/20">
                      <td className="p-3 font-semibold">{new Date(l.created_at).toLocaleString('vi-VN')}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          l.type === 'HOLD' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          l.type === 'RELEASE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          l.type === 'FEE' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                          l.type === 'WITHDRAW' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                          l.type === 'REFUND' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                          'bg-muted text-muted-foreground border-border'
                        }`}>
                          {l.type}
                        </span>
                      </td>
                      <td className="p-3 font-bold font-mono">
                        <span className={l.amount_core >= 0 ? 'text-emerald-500' : 'text-destructive'}>
                          {l.amount_core >= 0 ? `+${Number(l.amount_core).toLocaleString('vi-VN')}` : Number(l.amount_core).toLocaleString('vi-VN')} Core
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        <div>Giữ: <span className="text-amber-500 font-bold">{Number(l.balance_held_after).toLocaleString('vi-VN')}</span></div>
                        <div className="text-[10px] text-muted-foreground">Khả dụng: <span className="text-emerald-500 font-bold">{Number(l.balance_available_after).toLocaleString('vi-VN')}</span> | Đã rút: {Number(l.balance_withdrawn_after).toLocaleString('vi-VN')}</div>
                      </td>
                      <td className="p-3 text-right">
                        <span className="truncate block text-muted-foreground" title={l.reason}>
                          {l.reason}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Yêu Cầu Rút Tiền (§8) */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" /> Rút Tiền Về Ngân Hàng
              </h4>
              <button onClick={() => setShowWithdrawModal(false)}><X className="w-4 h-4" /></button>
            </div>

            <div className="p-3.5 bg-muted/40 rounded-xl space-y-1.5 text-xs">
              <div className="text-muted-foreground">Số dư khả dụng hiện tại:</div>
              <div className="text-xl font-black text-emerald-500">
                {Number(financeData?.balances?.available_core ?? sellerData?.available_balance_core ?? 0).toLocaleString('vi-VN')} Core
              </div>
              <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                Tài khoản nhận: <span className="font-bold text-foreground">{sellerData?.bank_name}</span> - <span className="font-mono font-bold text-foreground">{sellerData?.bank_account}</span> ({sellerData?.bank_account_name})
              </div>
            </div>

            <form onSubmit={handleRequestWithdraw} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Số Core muốn rút *</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={Number(financeData?.balances?.available_core ?? sellerData?.available_balance_core ?? 0)}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Nhập số Core (tối thiểu 1)..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background font-mono font-bold text-base focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Tỷ lệ quy đổi: 1 Core = 1 VND. Số tiền chuyển khoản: {parseInt(withdrawAmount || '0', 10).toLocaleString('vi-VN')} VNĐ.
                </span>
              </div>

              <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-[11px] text-primary">
                ℹ️ Lưu ý: Yêu cầu rút ≤ {financeData?.config?.withdraw_approval_threshold_core || 500} Core sẽ được duyệt tự động. Yêu cầu lớn hơn sẽ được Chủ Sàn duyệt thủ công.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2 rounded-xl border border-border font-semibold hover:bg-muted"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWithdraw}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold shadow-sm disabled:opacity-50"
                >
                  {isSubmittingWithdraw ? 'Đang gửi...' : 'Xác Nhận Rút Tiền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 6: Settings & Subaccounts (§6.5) */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-3xl">
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Quản Lý Tài Khoản Phụ (Nhân Viên / Hỗ Trợ)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mời thành viên khác hỗ trợ quản lý kho hoặc xem đơn hàng. Tài khoản phụ tuyệt đối <strong>không thể xem hoặc sửa thông tin thanh toán ngân hàng và không thể rút tiền</strong>.
            </p>

            <form onSubmit={handleAddSubaccount} className="flex flex-col sm:flex-row gap-3 pt-2">
              <input
                type="email"
                required
                value={newSubEmail}
                onChange={(e) => setNewSubEmail(e.target.value)}
                placeholder="Nhập email thành viên cần gán quyền..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:border-primary"
              />
              <select
                value={newSubRole}
                onChange={(e: any) => setNewSubRole(e.target.value)}
                className="px-3 py-2 rounded-xl border border-border bg-background text-xs font-medium focus:outline-none focus:border-primary"
              >
                <option value="VIEW_ORDERS">Chỉ Xem Đơn (VIEW_ORDERS)</option>
                <option value="MANAGE_STOCK">Quản Lý Kho Mã (MANAGE_STOCK)</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm shrink-0"
              >
                Thêm Quyền
              </button>
            </form>

            <div className="pt-2 divide-y divide-border/60">
              {subaccounts.length === 0 ? (
                <div className="py-4 text-xs text-muted-foreground text-center">Chưa có tài khoản phụ nào.</div>
              ) : (
                subaccounts.map((sa) => (
                  <div key={sa.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-foreground">{sa.member_email}</div>
                      <div className="text-[11px] text-muted-foreground">Vai trò: {sa.role}</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (confirm(`Xóa quyền của ${sa.member_email}?`)) {
                          await fetch(`/api/seller/subaccounts/${sa.id}`, { method: 'DELETE', headers: getHeaders() });
                          fetchSubaccounts();
                        }
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Thêm Sản Phẩm Mới */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Thêm Sản Phẩm Bán Mới</h3>
              <button onClick={() => setShowAddProductModal(false)}><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Chọn Tựa Game *</label>
                <select
                  required
                  value={prodGameSlug}
                  onChange={(e) => {
                    setProdGameSlug(e.target.value);
                    const selectedGame = games.find((g) => g.slug === e.target.value);
                    if (selectedGame && !prodName) {
                      setProdName(`Bộ Giftcode ${selectedGame.name} VIP`);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                >
                  <option value="">-- Chọn game trong catalog --</option>
                  {games.map((g) => (
                    <option key={g.slug} value={g.slug}>{g.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Ảnh bìa gói sản phẩm sẽ tự động lấy từ Logo chính thức của tựa game này (§5.1).
                </p>
              </div>

              <div>
                <label className="block font-semibold mb-1">Tên Gói Sản Phẩm *</label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="Ví dụ: Gói 5 Mã Giftcode Khởi Đầu"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Giá Bán Core *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={sellerData.status === 'TRIAL' ? sellerData.trial_order_max || 200 : 100000}
                    value={prodPriceCore}
                    onChange={(e) => setProdPriceCore(e.target.value)}
                    placeholder="Ví dụ: 50"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                  />
                  {sellerData.status === 'TRIAL' && (
                    <span className="text-[10px] text-amber-500">Tối đa {sellerData.trial_order_max || 200} Core (TRIAL)</span>
                  )}
                </div>
                <div>
                  <label className="block font-semibold mb-1">Giá Gốc Gạch Ngang (Tùy chọn)</label>
                  <input
                    type="number"
                    min={1}
                    value={prodOriginalPriceCore}
                    onChange={(e) => setProdOriginalPriceCore(e.target.value)}
                    placeholder="Ví dụ: 100"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Chính Sách Bảo Hành</label>
                  <select
                    value={prodWarrantyType}
                    onChange={(e) => setProdWarrantyType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                  >
                    <option value="24H">Bảo hành 24 Giờ</option>
                    <option value="7D">Bảo hành 7 Ngày</option>
                    <option value="30D">Bảo hành 30 Ngày</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Hình Thức Giao Mã</label>
                  <select
                    value={prodDeliveryType}
                    onChange={(e: any) => setProdDeliveryType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                  >
                    <option value="AUTO">Tự Động 24/7 (Từ Kho)</option>
                    <option value="MANUAL">Thủ Công</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Mô Tả Sản Phẩm</label>
                <textarea
                  rows={2}
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  placeholder="Gói quà tặng gồm các vật phẩm..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold shadow-sm"
                >
                  Xác Nhận Tạo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nạp Mã Vào Kho */}
      {showAddCodesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Nạp Mã Vào Kho Sản Phẩm</h3>
              <button onClick={() => setShowAddCodesModal(false)}><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddCodes} className="space-y-4 text-xs">
              <p className="text-muted-foreground">
                Dán danh sách mã code vào ô bên dưới (mỗi dòng 1 mã code). Hệ thống sẽ tự động lọc trùng và mã hóa an toàn.
              </p>

              <textarea
                rows={8}
                required
                value={rawCodesText}
                onChange={(e) => setRawCodesText(e.target.value)}
                placeholder="CODE123&#10;GIFTCODE456&#10;VIP999"
                className="w-full font-mono px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCodesModal(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold shadow-sm"
                >
                  Nạp Kho Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Giải Quyết Báo Lỗi Đơn Hàng (§6.3) */}
      {resolvingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-destructive flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" /> Xử Lý Báo Lỗi Đơn Hàng
              </h3>
              <button onClick={() => setResolvingOrder(null)}><X className="w-5 h-5" /></button>
            </div>

            <div className="text-xs bg-muted/60 p-3 rounded-xl space-y-1">
              <div>Đơn hàng: <strong>{resolvingOrder.order_code}</strong></div>
              <div>Sản phẩm: <strong>{resolvingOrder.product_name}</strong></div>
              <div>Giá: <strong>{resolvingOrder.price_core} Core</strong></div>
              <div>Lý do khách báo: <span className="text-destructive font-semibold">{resolvingOrder.report_reason === 'expired' ? 'Mã hết hạn' : 'Nhập không được'}</span></div>
              {resolvingOrder.report_note && <div>Ghi chú: {resolvingOrder.report_note}</div>}
            </div>

            <form onSubmit={handleResolveOrder} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1.5">Chọn Phương Án Xử Lý:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolveType('REPLACE_CODE')}
                    className={`p-3 rounded-xl border text-center font-bold ${
                      resolveType === 'REPLACE_CODE'
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'border-border bg-background'
                    }`}
                  >
                    Đổi Mã Mới Tự Động
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveType('REFUND_CORE')}
                    className={`p-3 rounded-xl border text-center font-bold ${
                      resolveType === 'REFUND_CORE'
                        ? 'bg-destructive/10 border-destructive text-destructive'
                        : 'border-border bg-background'
                    }`}
                  >
                    Hoàn Trả Core ({resolvingOrder.price_core} Core)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Ghi Chú Phản Hồi Cho Khách</label>
                <input
                  type="text"
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Đã đổi mã mới / Đã hoàn Core..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingOrder(null)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-semibold"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-destructive text-white font-bold shadow-sm"
                >
                  Xác Nhận Giải Quyết
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Phản Hồi Khiếu Nại Sàn TMĐT (§B) */}
      {respondingDispute && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                <ShieldAlert className="w-5 h-5 text-primary" /> Phản Hồi Khiếu Nại Đơn Hàng
              </h3>
              <button onClick={() => setRespondingDispute(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs bg-muted/60 p-3 rounded-xl space-y-1">
              <div>Mã khiếu nại: <strong className="font-mono text-primary-light">{respondingDispute.id}</strong></div>
              <div>Đơn hàng: <strong className="font-mono">{respondingDispute.order_code}</strong> ({Number(respondingDispute.price_core).toLocaleString()} Core)</div>
              <div>Gói: <strong>{respondingDispute.product_name}</strong></div>
              <div>Khách: <strong>{respondingDispute.buyer_username || 'Khách hàng'}</strong></div>
              <div>Lý do khiếu nại: <span className="text-destructive font-semibold">
                {respondingDispute.reason === 'WRONG_CODE' ? 'Mã sai định dạng' :
                 respondingDispute.reason === 'USED_CODE' ? 'Mã đã dùng' :
                 respondingDispute.reason === 'EXPIRED_CODE' ? 'Mã hết hạn' : 'Sai mô tả'}
              </span></div>
              {respondingDispute.detail && (
                <div className="text-muted-foreground italic">Khách viết: "{respondingDispute.detail}"</div>
              )}
            </div>

            <form onSubmit={handleRespondDispute} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nội dung phản hồi / Giải trình *</label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  required
                  value={disputeResponseMsg}
                  onChange={(e) => setDisputeResponseMsg(e.target.value)}
                  placeholder="Giải thích nguyên nhân hoặc hướng dẫn khách hàng nhập mã..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:border-primary text-xs resize-none"
                />
                <div className="text-[10px] text-muted-foreground text-right mt-0.5">
                  {disputeResponseMsg.length}/1000 ký tự
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Đính kèm mã thay thế mới (Tùy chọn)</label>
                <input
                  type="text"
                  value={disputeReplacementCode}
                  onChange={(e) => setDisputeReplacementCode(e.target.value)}
                  placeholder="Nhập mã giftcode thay thế nếu có..."
                  className="w-full font-mono px-3.5 py-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Nếu bạn nạp mã thay thế tại đây, Quản trị viên có thể bàn giao ngay mã này cho khách hàng khi duyệt đổi mã.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRespondingDispute(null)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-semibold"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDisputeResp}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold shadow-sm disabled:opacity-50 transition-opacity"
                >
                  {isSubmittingDisputeResp ? 'Đang gửi...' : 'Gửi Phản Hồi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
