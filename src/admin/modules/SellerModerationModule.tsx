import React, { useState, useEffect } from 'react';
import {
  Store,
  Package,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Lock,
  Unlock,
  Sliders,
  Check,
  X,
  Eye,
  SlidersHorizontal,
  Coins,
  Scale,
  DollarSign,
  ArrowUpRight,
  Receipt,
  FileSpreadsheet,
  AlertTriangle,
  Send,
} from 'lucide-react';

interface SellerModerationModuleProps {
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

export const SellerModerationModule: React.FC<SellerModerationModuleProps> = ({ onShowToast }) => {
  const [activeTab, setActiveTab] = useState<
    'sellers' | 'products' | 'ledger' | 'reconciliation' | 'withdrawals' | 'webhook_exceptions' | 'config'
  >('sellers');
  const [loading, setLoading] = useState<boolean>(false);

  // Sellers State
  const [sellers, setSellers] = useState<any[]>([]);
  const [sellerStatusFilter, setSellerStatusFilter] = useState<string>('');
  const [rejectingSeller, setRejectingSeller] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [requestingInfoSeller, setRequestingInfoSeller] = useState<any>(null);
  const [requestInfoNote, setRequestInfoNote] = useState<string>('');

  // Products State
  const [products, setProducts] = useState<any[]>([]);
  const [productStatusFilter, setProductStatusFilter] = useState<string>('PENDING_REVIEW');
  const [rejectingProduct, setRejectingProduct] = useState<any>(null);
  const [prodRejectReason, setProdRejectReason] = useState<string>('');

  // Finance & Ledger State
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [ledgerSellerFilter, setLedgerSellerFilter] = useState<string>('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<string>('');
  const [ledgerDateFilter, setLedgerDateFilter] = useState<string>('');
  const [sepayAlert, setSepayAlert] = useState<any>(null);
  const [releasingHeld, setReleasingHeld] = useState<boolean>(false);

  // Reconciliation State
  const [recRuns, setRecRuns] = useState<any[]>([]);
  const [recExceptions, setRecExceptions] = useState<any[]>([]);
  const [recExceptionFilter, setRecExceptionFilter] = useState<string>('OPEN');
  const [runningRec, setRunningRec] = useState<boolean>(false);
  const [resolvingEx, setResolvingEx] = useState<any>(null);
  const [resolveNote, setResolveNote] = useState<string>('');

  // Withdrawals State
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalFilter, setWithdrawalFilter] = useState<string>('');
  const [withdrawStats, setWithdrawStats] = useState<any>(null);
  const [rejectingWithdrawal, setRejectingWithdrawal] = useState<any>(null);
  const [withdrawRejectReason, setWithdrawRejectReason] = useState<string>('');
  const [payingWithdrawal, setPayingWithdrawal] = useState<any>(null);
  const [payNote, setPayNote] = useState<string>('');

  // Config State
  const [trialProductLimit, setTrialProductLimit] = useState<number>(5);
  const [trialOrderMax, setTrialOrderMax] = useState<number>(200);
  const [batchFreezeErrorRate, setBatchFreezeErrorRate] = useState<number>(0.25);
  const [minBatchSize, setMinBatchSize] = useState<number>(5);
  const [holdHours, setHoldHours] = useState<number>(168);
  const [feeRate, setFeeRate] = useState<number>(0.05);
  const [withdrawThreshold, setWithdrawThreshold] = useState<number>(500);
  const [testSellerIds, setTestSellerIds] = useState<string>('sel_1794399949383_052f1');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  const getAdminHeaders = () => {
    const token = localStorage.getItem('wcg_auth_token') || sessionStorage.getItem('wcg_auth_token') || '';
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const showToast = (title: string, message?: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onShowToast) onShowToast(title, message, type);
    else alert(`${title}: ${message || ''}`);
  };

  // Fetch Sellers
  const fetchSellers = async () => {
    setLoading(true);
    try {
      const url = sellerStatusFilter ? `/api/admin/sellers?status=${sellerStatusFilter}` : '/api/admin/sellers';
      const res = await fetch(url, { headers: getAdminHeaders() });
      const data = await res.json();
      if (data.success) {
        setSellers(data.sellers || []);
      } else {
        showToast('Lỗi', data.error || 'Không thể tải danh sách gian hàng', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Products
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const url = productStatusFilter ? `/api/admin/seller-products?status=${productStatusFilter}` : '/api/admin/seller-products';
      const res = await fetch(url, { headers: getAdminHeaders() });
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
      } else {
        showToast('Lỗi', data.error || 'Không thể tải danh sách sản phẩm', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Finance & Sổ Cái
  const fetchFinance = async () => {
    setLoading(true);
    try {
      let url = '/api/admin/seller-finance?limit=100';
      if (ledgerSellerFilter) url += `&seller_id=${ledgerSellerFilter}`;
      if (ledgerTypeFilter) url += `&type=${ledgerTypeFilter}`;
      if (ledgerDateFilter) url += `&date=${ledgerDateFilter}`;
      const res = await fetch(url, { headers: getAdminHeaders() });
      const data = await res.json();
      if (data.success) {
        setFinanceSummary(data.summary);
        setLedgerEntries(data.ledger || []);
        setSepayAlert(data.sepay_alert || null);
      } else {
        showToast('Lỗi', data.error || 'Không thể tải dữ liệu sổ cái', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Đối Soát
  const fetchReconciliation = async () => {
    setLoading(true);
    try {
      let url = '/api/admin/seller-finance/reconciliation';
      if (recExceptionFilter) url += `?status=${recExceptionFilter}`;
      const res = await fetch(url, { headers: getAdminHeaders() });
      const data = await res.json();
      if (data.success) {
        setRecRuns(data.runs || []);
        setRecExceptions(data.exceptions || []);
      } else {
        showToast('Lỗi', data.error || 'Không thể tải lịch sử đối soát', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Rút Tiền
  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      let url = '/api/admin/withdrawals';
      if (withdrawalFilter) url += `?status=${withdrawalFilter}`;
      const res = await fetch(url, { headers: getAdminHeaders() });
      const data = await res.json();
      if (data.success) {
        setWithdrawals(data.withdrawals || []);
        setWithdrawStats(data.stats || null);
      } else {
        showToast('Lỗi', data.error || 'Không thể tải danh sách rút tiền', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Config
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/seller-config', { headers: getAdminHeaders() });
      const data = await res.json();
      if (data.success && data.config) {
        setTrialProductLimit(data.config.default_trial_product_limit || 5);
        setTrialOrderMax(data.config.default_trial_order_max || 200);
        setBatchFreezeErrorRate(data.config.batch_freeze_error_rate || 0.25);
        setMinBatchSize(data.config.min_batch_size_for_freeze || 5);
        setHoldHours(typeof data.config.hold_hours !== 'undefined' ? data.config.hold_hours : 168);
        setFeeRate(typeof data.config.fee_rate !== 'undefined' ? data.config.fee_rate : 0.05);
        setWithdrawThreshold(typeof data.config.withdraw_approval_threshold_core !== 'undefined' ? data.config.withdraw_approval_threshold_core : 500);
        const testList = Array.isArray(data.config.test_seller_ids)
          ? data.config.test_seller_ids.join(', ')
          : (data.config.test_seller_ids || 'sel_1794399949383_052f1');
        setTestSellerIds(testList);
      }
    } catch (err) {
      console.warn('Fetch config error:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'sellers') fetchSellers();
    else if (activeTab === 'products') fetchProducts();
    else if (activeTab === 'ledger') fetchFinance();
    else if (activeTab === 'reconciliation' || activeTab === 'webhook_exceptions') fetchReconciliation();
    else if (activeTab === 'withdrawals') fetchWithdrawals();
    else if (activeTab === 'config') fetchConfig();
  }, [activeTab, sellerStatusFilter, productStatusFilter, ledgerSellerFilter, ledgerTypeFilter, ledgerDateFilter, recExceptionFilter, withdrawalFilter]);

  // Actions Sellers
  const handleApproveSeller = async (id: string, mode: 'TRIAL' | 'ACTIVE') => {
    try {
      const res = await fetch(`/api/admin/sellers/${id}/approve`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
        fetchSellers();
      } else {
        showToast('Lỗi', data.error || 'Duyệt thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
    }
  };

  const handleRejectSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingSeller || !rejectReason.trim()) return;
    try {
      const res = await fetch(`/api/admin/sellers/${rejectingSeller.id}/reject`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
        setRejectingSeller(null);
        setRejectReason('');
        fetchSellers();
      } else {
        showToast('Lỗi', data.error || 'Từ chối thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
    }
  };

  const handleRequestInfoSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestingInfoSeller || !requestInfoNote.trim()) return;
    try {
      const res = await fetch(`/api/admin/sellers/${requestingInfoSeller.id}/request-info`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ note: requestInfoNote }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
        setRequestingInfoSeller(null);
        setRequestInfoNote('');
        fetchSellers();
      } else {
        showToast('Lỗi', data.error || 'Gửi yêu cầu thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
    }
  };

  const handleToggleSuspendSeller = async (id: string, currentStatus: string) => {
    const isSuspending = currentStatus !== 'SUSPENDED';
    const action = isSuspending ? 'Tạm khóa' : 'Mở khóa';
    if (!confirm(`Bạn có chắc chắn muốn ${action} gian hàng này không?`)) return;
    try {
      const res = await fetch(`/api/admin/sellers/${id}/suspend`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ suspend: isSuspending }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
        fetchSellers();
      } else {
        showToast('Lỗi', data.error || 'Thao tác thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
    }
  };

  // Actions Products
  const handleApproveProduct = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/seller-products/${id}/approve`, {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
        fetchProducts();
      } else {
        showToast('Lỗi', data.error || 'Duyệt sản phẩm thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
    }
  };

  const handleRejectProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingProduct || !prodRejectReason.trim()) return;
    try {
      const res = await fetch(`/api/admin/seller-products/${rejectingProduct.id}/reject`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ reason: prodRejectReason }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
        setRejectingProduct(null);
        setProdRejectReason('');
        fetchProducts();
      } else {
        showToast('Lỗi', data.error || 'Từ chối sản phẩm thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
    }
  };

  // Actions Finance: Giải ngân thủ công
  const handleReleaseHeldOrders = async () => {
    setReleasingHeld(true);
    try {
      const res = await fetch('/api/admin/seller-finance/release-held', {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
        fetchFinance();
      } else {
        showToast('Lỗi', data.error || 'Giải ngân thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối máy chủ', 'error');
    } finally {
      setReleasingHeld(false);
    }
  };

  // Actions Finance: Chạy đối soát thủ công
  const handleRunReconciliation = async () => {
    setRunningRec(true);
    try {
      const res = await fetch('/api/admin/seller-finance/reconciliation/run', {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
        fetchReconciliation();
      } else {
        showToast('Lỗi', data.error || 'Đối soát thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối máy chủ', 'error');
    } finally {
      setRunningRec(false);
    }
  };

  // Actions Finance: Giải quyết ngoại lệ đối soát
  const handleResolveException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingEx) return;
    try {
      const res = await fetch('/api/admin/seller-finance/reconciliation', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          exception_id: resolvingEx.id,
          note: resolveNote,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
        setResolvingEx(null);
        setResolveNote('');
        fetchReconciliation();
      } else {
        showToast('Lỗi', data.error || 'Xử lý ngoại lệ thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối máy chủ', 'error');
    }
  };

  // Actions Withdrawals: Duyệt
  const handleApproveWithdrawal = async (id: string) => {
    if (!confirm('Xác nhận duyệt yêu cầu rút tiền này?')) return;
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/approve`, {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
        fetchWithdrawals();
      } else {
        showToast('Lỗi', data.error || 'Duyệt thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối máy chủ', 'error');
    }
  };

  // Actions Withdrawals: Từ chối
  const handleRejectWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingWithdrawal || !withdrawRejectReason.trim()) return;
    try {
      const res = await fetch(`/api/admin/withdrawals/${rejectingWithdrawal.id}/reject`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ reason: withdrawRejectReason }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
        setRejectingWithdrawal(null);
        setWithdrawRejectReason('');
        fetchWithdrawals();
      } else {
        showToast('Lỗi', data.error || 'Từ chối thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối máy chủ', 'error');
    }
  };

  // Actions Withdrawals: Xác nhận đã chuyển tiền (mark-paid)
  const handleMarkPaidWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingWithdrawal) return;
    try {
      const res = await fetch(`/api/admin/withdrawals/${payingWithdrawal.id}/mark-paid`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ note: payNote }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
        setPayingWithdrawal(null);
        setPayNote('');
        fetchWithdrawals();
      } else {
        showToast('Lỗi', data.error || 'Xác nhận thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối máy chủ', 'error');
    }
  };

  // Save Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch('/api/admin/seller-config', {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          default_trial_product_limit: trialProductLimit,
          default_trial_order_max: trialOrderMax,
          batch_freeze_error_rate: batchFreezeErrorRate,
          min_batch_size_for_freeze: minBatchSize,
          hold_hours: holdHours,
          fee_rate: feeRate,
          withdraw_approval_threshold_core: withdrawThreshold,
          test_seller_ids: testSellerIds.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
      } else {
        showToast('Lỗi', data.error || 'Lưu cấu hình thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-card border border-border rounded-2xl shadow-sm">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" /> Quản Lý Sàn TMĐT & Tài Chính Giai Đoạn 2
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Duyệt gian hàng, xét duyệt sản phẩm, sổ cái 3 ngăn, đối soát 3 nguồn và quản lý rút tiền.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center flex-wrap gap-1 p-1 bg-muted/60 rounded-xl border border-border text-xs">
          <button
            onClick={() => setActiveTab('sellers')}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'sellers' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Gian Hàng ({sellers.length})
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'products' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sản Phẩm ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeTab === 'ledger' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" /> Sổ Cái 3 Ngăn
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeTab === 'reconciliation' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Scale className="w-3.5 h-3.5" /> Đối Soát 3 Nguồn
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeTab === 'withdrawals' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Coins className="w-3.5 h-3.5" /> Rút Tiền ({withdrawStats?.pending_count || 0})
          </button>
          <button
            onClick={() => setActiveTab('webhook_exceptions')}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeTab === 'webhook_exceptions' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Ngoại Lệ
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              activeTab === 'config' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Cấu Hình
          </button>
        </div>
      </div>

      {/* Cảnh báo khóa SePay (§5 Trường hợp 7) */}
      {sepayAlert?.active && (
        <div className="p-3.5 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center justify-between gap-3 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-bold">{sepayAlert.message}</span>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">{new Date(sepayAlert.last_alert_at).toLocaleString('vi-VN')}</span>
        </div>
      )}

      {/* Tab 1: Gian Hàng (Quy tắc 9: 100% table-fixed w-full) */}
      {activeTab === 'sellers' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 text-xs">
              <label className="font-semibold text-muted-foreground">Lọc Trạng Thái:</label>
              <select
                value={sellerStatusFilter}
                onChange={(e) => setSellerStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:border-primary"
              >
                <option value="">Tất cả ({sellers.length})</option>
                <option value="PENDING">Chờ Duyệt (PENDING)</option>
                <option value="TRIAL">Thử Việc (TRIAL)</option>
                <option value="ACTIVE">Hoạt Động (ACTIVE)</option>
                <option value="SUSPENDED">Tạm Khóa (SUSPENDED)</option>
                <option value="REJECTED">Từ Chối (REJECTED)</option>
              </select>
            </div>
            <button
              onClick={fetchSellers}
              className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted/50 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                <tr>
                  <th style={{ width: '28%' }} className="p-3">Gian Hàng & Liên Hệ</th>
                  <th style={{ width: '18%' }} className="p-3">Ngân Hàng Rút</th>
                  <th style={{ width: '14%' }} className="p-3">Hạn Mức & Uy Tín</th>
                  <th style={{ width: '14%' }} className="p-3">Trạng Thái</th>
                  <th style={{ width: '26%' }} className="p-3 text-right">Thao Tác Thẩm Định</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sellers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Không có gian hàng nào trong danh sách.
                    </td>
                  </tr>
                ) : (
                  sellers.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={s.avatar_url || '/logo.webp'}
                            alt={s.name}
                            className="w-8 h-8 rounded-lg object-cover border border-border shrink-0"
                            onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-foreground truncate" title={s.name}>{s.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate" title={s.slug}>/{s.slug} • {s.contact_phone || 'Không số'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="truncate font-semibold text-foreground" title={s.bank_name || 'Chưa cài'}>
                          {s.bank_name || 'Chưa cài'}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate" title={s.bank_account}>
                          {s.bank_account || '—'} {s.bank_account_name ? `(${s.bank_account_name})` : ''}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-foreground">{s.reputation_score || 100} ⭐</div>
                        <div className="text-[10px] text-muted-foreground">{s.trial_product_limit || 5} sp / {s.trial_order_max || 200} Core</div>
                      </td>
                      <td className="p-3">
                        {s.status === 'PENDING' && <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold text-[10px] border border-amber-500/20">Chờ duyệt</span>}
                        {s.status === 'TRIAL' && <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold text-[10px] border border-blue-500/20">Thử việc</span>}
                        {s.status === 'ACTIVE' && <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold text-[10px] border border-emerald-500/20">Hoạt động</span>}
                        {s.status === 'SUSPENDED' && <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold text-[10px] border border-destructive/20">Tạm khóa</span>}
                        {s.status === 'REJECTED' && <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-bold text-[10px] border border-border">Từ chối</span>}
                        {s.is_vacation === 1 && <div className="text-[10px] text-amber-500 font-semibold mt-0.5">🏖️ Nghỉ bán</div>}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {s.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApproveSeller(s.id, 'TRIAL')}
                                className="px-2 py-1 rounded-lg bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors"
                                title="Duyệt vào chế độ Thử Việc (TRIAL)"
                              >
                                Duyệt TRIAL
                              </button>
                              <button
                                onClick={() => setRequestingInfoSeller(s)}
                                className="px-2 py-1 rounded-lg border border-amber-500/30 text-amber-500 font-bold hover:bg-amber-500/10"
                                title="Yêu cầu bổ sung thông tin"
                              >
                                Yêu cầu thêm
                              </button>
                              <button
                                onClick={() => setRejectingSeller(s)}
                                className="px-2 py-1 rounded-lg border border-destructive/30 text-destructive font-bold hover:bg-destructive/10"
                                title="Từ chối mở gian hàng"
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {s.status === 'TRIAL' && (
                            <>
                              <button
                                onClick={() => handleApproveSeller(s.id, 'ACTIVE')}
                                className="px-2 py-1 rounded-lg bg-emerald-500 text-white font-bold hover:bg-emerald-600"
                                title="Nâng hạng lên ACTIVE chính thức"
                              >
                                Lên ACTIVE
                              </button>
                              <button
                                onClick={() => handleToggleSuspendSeller(s.id, s.status)}
                                className="px-2 py-1 rounded-lg border border-destructive/30 text-destructive font-bold hover:bg-destructive/10"
                              >
                                Tạm khóa
                              </button>
                            </>
                          )}
                          {s.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleToggleSuspendSeller(s.id, s.status)}
                              className="px-2 py-1 rounded-lg border border-destructive/30 text-destructive font-bold hover:bg-destructive/10"
                            >
                              Tạm khóa
                            </button>
                          )}
                          {s.status === 'SUSPENDED' && (
                            <button
                              onClick={() => handleToggleSuspendSeller(s.id, s.status)}
                              className="px-2 py-1 rounded-lg border border-emerald-500/30 text-emerald-500 font-bold hover:bg-emerald-500/10"
                            >
                              Mở khóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Sản Phẩm (Quy tắc 9: 100% table-fixed w-full) */}
      {activeTab === 'products' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 text-xs">
              <label className="font-semibold text-muted-foreground">Lọc Trạng Thái:</label>
              <select
                value={productStatusFilter}
                onChange={(e) => setProductStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:border-primary"
              >
                <option value="">Tất cả ({products.length})</option>
                <option value="PENDING_REVIEW">Chờ Duyệt (PENDING_REVIEW)</option>
                <option value="APPROVED">Đã Duyệt (APPROVED)</option>
                <option value="REJECTED">Bị Từ Chối (REJECTED)</option>
              </select>
            </div>
            <button
              onClick={fetchProducts}
              className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted/50 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                <tr>
                  <th style={{ width: '32%' }} className="p-3">Sản Phẩm & Game</th>
                  <th style={{ width: '20%' }} className="p-3">Gian Hàng</th>
                  <th style={{ width: '16%' }} className="p-3">Giá Bán & Tồn Kho</th>
                  <th style={{ width: '14%' }} className="p-3">Trạng Thái</th>
                  <th style={{ width: '18%' }} className="p-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Không có sản phẩm nào.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={p.cover_url || '/logo.webp'}
                            alt={p.name}
                            className="w-9 h-9 rounded-lg object-cover border border-border shrink-0"
                            onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-foreground truncate" title={p.name}>{p.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate" title={p.game_slug}>Game: {p.game_name || p.game_slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-foreground truncate" title={p.seller_name}>{p.seller_name}</div>
                        <div className="text-[10px] text-muted-foreground">BH: {p.warranty_type || '24H'}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-primary">{p.price_core?.toLocaleString('vi-VN')} Core</div>
                        <div className="text-[10px] text-muted-foreground">Kho: <span className="text-emerald-500 font-bold">{p.in_stock_count || 0}</span> | Đã bán: {p.sold_count || 0}</div>
                      </td>
                      <td className="p-3">
                        {p.status === 'PENDING_REVIEW' && <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold text-[10px] border border-amber-500/20">Chờ duyệt</span>}
                        {p.status === 'APPROVED' && <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold text-[10px] border border-emerald-500/20">Đã duyệt</span>}
                        {p.status === 'REJECTED' && <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold text-[10px] border border-destructive/20">Bị từ chối</span>}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.status === 'PENDING_REVIEW' && (
                            <>
                              <button
                                onClick={() => handleApproveProduct(p.id)}
                                className="px-2 py-1 rounded-lg bg-emerald-500 text-white font-bold hover:bg-emerald-600"
                              >
                                Duyệt
                              </button>
                              <button
                                onClick={() => setRejectingProduct(p)}
                                className="px-2 py-1 rounded-lg border border-destructive/30 text-destructive font-bold hover:bg-destructive/10"
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {p.status === 'APPROVED' && (
                            <button
                              onClick={() => setRejectingProduct(p)}
                              className="px-2 py-1 rounded-lg border border-destructive/30 text-destructive font-bold hover:bg-destructive/10"
                            >
                              Gỡ bán
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Sổ Cái 3 Ngăn (Ledger) */}
      {activeTab === 'ledger' && (
        <div className="space-y-3">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-card border border-border rounded-xl">
              <span className="text-[11px] text-muted-foreground font-semibold">Đang Giữ (Hold)</span>
              <div className="text-base font-bold text-amber-500 mt-0.5">
                {financeSummary?.total_held_core?.toLocaleString('vi-VN') || 0} Core
              </div>
            </div>
            <div className="p-3.5 bg-card border border-border rounded-xl">
              <span className="text-[11px] text-muted-foreground font-semibold">Khả Dụng (Available)</span>
              <div className="text-base font-bold text-emerald-500 mt-0.5">
                {financeSummary?.total_available_core?.toLocaleString('vi-VN') || 0} Core
              </div>
            </div>
            <div className="p-3.5 bg-card border border-border rounded-xl">
              <span className="text-[11px] text-muted-foreground font-semibold">Đã Chi Trả (Withdrawn)</span>
              <div className="text-base font-bold text-blue-500 mt-0.5">
                {financeSummary?.total_withdrawn_core?.toLocaleString('vi-VN') || 0} Core
              </div>
            </div>
            <div className="p-3.5 bg-card border border-border rounded-xl">
              <span className="text-[11px] text-muted-foreground font-semibold">Tổng Doanh Thu Sàn</span>
              <div className="text-base font-bold text-primary mt-0.5">
                {financeSummary?.total_revenue_core?.toLocaleString('vi-VN') || 0} Core
              </div>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="flex items-center flex-wrap gap-2 text-xs">
              <select
                value={ledgerSellerFilter}
                onChange={(e) => setLedgerSellerFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:border-primary"
              >
                <option value="">Tất cả gian hàng</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <select
                value={ledgerTypeFilter}
                onChange={(e) => setLedgerTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:border-primary"
              >
                <option value="">Tất cả nghiệp vụ</option>
                <option value="HOLD">HOLD (Giữ tiền)</option>
                <option value="RELEASE">RELEASE (Giải ngân)</option>
                <option value="FEE">FEE (Phí sàn)</option>
                <option value="WITHDRAW">WITHDRAW (Rút tiền)</option>
                <option value="REFUND">REFUND (Hoàn tiền)</option>
                <option value="ADJUST">ADJUST (Điều chỉnh)</option>
              </select>

              <input
                type="date"
                value={ledgerDateFilter}
                onChange={(e) => setLedgerDateFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleReleaseHeldOrders}
                disabled={releasingHeld}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                title="Quét và giải ngân ngay các đơn đã qua 168h giữ tiền"
              >
                <Clock className="w-3.5 h-3.5" /> {releasingHeld ? 'Đang giải ngân...' : 'Giải Ngân Đơn Hết Giữ'}
              </button>
              <button
                onClick={fetchFinance}
                className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted/50 text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
              </button>
            </div>
          </div>

          {/* Table Sổ Cái (Rule 9: table-fixed w-full) */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                <tr>
                  <th style={{ width: '22%' }} className="p-3">Thời Gian & Tác Nhân</th>
                  <th style={{ width: '18%' }} className="p-3">Gian Hàng</th>
                  <th style={{ width: '16%' }} className="p-3">Nghiệp Vụ & Mã Đơn</th>
                  <th style={{ width: '16%' }} className="p-3">Biến Động (Core)</th>
                  <th style={{ width: '28%' }} className="p-3 text-right">3 Ngăn Số Dư Sau Giao Dịch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Chưa có dòng sổ cái nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-foreground">
                          {new Date(l.created_at).toLocaleString('vi-VN')}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate" title={l.reason}>
                          {l.actor}: {l.reason}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-foreground truncate" title={l.seller_name || l.seller_id}>
                          {l.seller_name || l.seller_id}
                        </div>
                      </td>
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
                        {l.order_code && (
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate" title={l.order_code}>
                            {l.order_code}
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-bold font-mono">
                        <span className={l.amount_core >= 0 ? 'text-emerald-500' : 'text-destructive'}>
                          {l.amount_core >= 0 ? `+${l.amount_core.toLocaleString('vi-VN')}` : l.amount_core.toLocaleString('vi-VN')} Core
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-[11px]">
                        <div>Giữ: <span className="text-amber-500 font-bold">{Number(l.balance_held_after).toLocaleString('vi-VN')}</span></div>
                        <div className="text-muted-foreground text-[10px]">
                          Khả dụng: <span className="text-emerald-500 font-bold">{Number(l.balance_available_after).toLocaleString('vi-VN')}</span> | Đã rút: {Number(l.balance_withdrawn_after).toLocaleString('vi-VN')}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Đối Soát 3 Nguồn (Reconciliation) */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <div>
              <h3 className="text-xs font-bold text-foreground">Đối Soát 3 Nguồn: Sổ Đơn — Giao Dịch SePay — Sổ Cái</h3>
              <p className="text-[11px] text-muted-foreground">Kiểm tra tính nhất quán tuyệt đối giữa tiền nhận từ ngân hàng và số dư ghi sổ.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRunReconciliation}
                disabled={runningRec}
                className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${runningRec ? 'animate-spin' : ''}`} />
                {runningRec ? 'Đang đối soát...' : 'Chạy Đối Soát Tay Ngay'}
              </button>
            </div>
          </div>

          {/* Lịch sử phiên đối soát */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-border bg-muted/20 font-bold text-xs flex items-center justify-between">
              <span>Lịch Sử Các Phiên Đối Soát Gần Nhất</span>
              <span className="text-[11px] text-muted-foreground">Tự động mỗi ngày lúc 00:30 VN</span>
            </div>
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                <tr>
                  <th style={{ width: '22%' }} className="p-3">Ngày Đối Soát</th>
                  <th style={{ width: '20%' }} className="p-3">Số Đơn / SePay / Dòng Sổ</th>
                  <th style={{ width: '18%' }} className="p-3">Khớp Dữ Liệu</th>
                  <th style={{ width: '18%' }} className="p-3">Số Ngoại Lệ</th>
                  <th style={{ width: '22%' }} className="p-3 text-right">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recRuns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">Chưa có phiên đối soát nào được chạy.</td>
                  </tr>
                ) : (
                  recRuns.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="p-3 font-bold text-foreground">{r.run_date}</td>
                      <td className="p-3">{r.total_orders} đơn / {r.total_sepay_transactions} SePay / {r.total_ledger_lines} sổ</td>
                      <td className="p-3 font-semibold text-emerald-500">{r.matched_count} khớp</td>
                      <td className="p-3">
                        <span className={`font-bold ${r.exception_count > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {r.exception_count} ngoại lệ
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {r.status === 'COMPLETED' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold text-[10px] border border-emerald-500/20">
                            100% Khớp Chuẩn
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold text-[10px] border border-amber-500/20">
                            Có Ngoại Lệ
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Danh sách ngoại lệ */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-border bg-muted/20 font-bold text-xs flex items-center justify-between">
              <span>Danh Sách Ngoại Lệ Cần Xử Lý ({recExceptions.filter((e) => e.status === 'OPEN').length} mở)</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setRecExceptionFilter('OPEN')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${recExceptionFilter === 'OPEN' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  Chưa xử lý
                </button>
                <button
                  onClick={() => setRecExceptionFilter('')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${recExceptionFilter === '' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                >
                  Tất cả
                </button>
              </div>
            </div>
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                <tr>
                  <th style={{ width: '18%' }} className="p-3">Nguồn & Thời Gian</th>
                  <th style={{ width: '22%' }} className="p-3">Mã Tham Chiếu / Đơn</th>
                  <th style={{ width: '18%' }} className="p-3">Kỳ Vọng / Thực Tế</th>
                  <th style={{ width: '28%' }} className="p-3">Nguyên Nhân Gợi Ý</th>
                  <th style={{ width: '14%' }} className="p-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recExceptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">Không có ngoại lệ nào.</td>
                  </tr>
                ) : (
                  recExceptions.map((ex) => (
                    <tr key={ex.id} className="hover:bg-muted/20">
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-bold border border-border">{ex.source}</span>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(ex.created_at).toLocaleDateString('vi-VN')}</div>
                      </td>
                      <td className="p-3 font-mono truncate" title={ex.reference_id}>{ex.reference_id}</td>
                      <td className="p-3 font-mono">
                        <div>KV: {ex.expected_amount?.toLocaleString('vi-VN')}</div>
                        <div className="text-muted-foreground text-[10px]">TT: {ex.actual_amount?.toLocaleString('vi-VN')}</div>
                      </td>
                      <td className="p-3">
                        <div className="truncate text-foreground font-semibold" title={ex.suggested_cause}>{ex.suggested_cause}</div>
                        {ex.resolved_note && <div className="text-[10px] text-emerald-500 truncate" title={ex.resolved_note}>✓ {ex.resolved_by}: {ex.resolved_note}</div>}
                      </td>
                      <td className="p-3 text-right">
                        {ex.status === 'OPEN' ? (
                          <button
                            onClick={() => setResolvingEx(ex)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white font-bold hover:bg-emerald-600 text-[11px]"
                          >
                            Xử lý
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-muted-foreground">Đã xử lý</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Duyệt Rút Tiền (Withdrawals) */}
      {activeTab === 'withdrawals' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 text-xs">
              <label className="font-semibold text-muted-foreground">Lọc Trạng Thái:</label>
              <select
                value={withdrawalFilter}
                onChange={(e) => setWithdrawalFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:border-primary"
              >
                <option value="">Tất cả ({withdrawals.length})</option>
                <option value="PENDING">Chờ Duyệt (PENDING)</option>
                <option value="APPROVED">Đã Duyệt (APPROVED)</option>
                <option value="PAID">Đã Chi Trả (PAID)</option>
                <option value="REJECTED">Từ Chối (REJECTED)</option>
              </select>
            </div>
            <button
              onClick={fetchWithdrawals}
              className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted/50 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                <tr>
                  <th style={{ width: '20%' }} className="p-3">Thời Gian & Người Yêu Cầu</th>
                  <th style={{ width: '20%' }} className="p-3">Gian Hàng</th>
                  <th style={{ width: '24%' }} className="p-3">Tài Khoản Nhận</th>
                  <th style={{ width: '16%' }} className="p-3">Số Tiền & Trạng Thái</th>
                  <th style={{ width: '20%' }} className="p-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Không có yêu cầu rút tiền nào.
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-foreground">{new Date(w.created_at).toLocaleString('vi-VN')}</div>
                        <div className="text-[10px] text-muted-foreground truncate" title={w.requested_by}>Bởi: {w.requested_by}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-foreground truncate" title={w.seller_name}>{w.seller_name}</div>
                        <div className="text-[10px] text-muted-foreground">Khả dụng: {Number(w.available_balance_core || 0).toLocaleString('vi-VN')} Core</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-foreground truncate" title={w.bank_name}>{w.bank_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate" title={`${w.bank_account} - ${w.bank_account_name}`}>
                          {w.bank_account} ({w.bank_account_name})
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold font-mono text-primary text-sm">{Number(w.amount_core).toLocaleString('vi-VN')} Core</div>
                        <div>
                          {w.status === 'PENDING' && <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold text-[10px] border border-amber-500/20">Chờ duyệt</span>}
                          {w.status === 'APPROVED' && <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold text-[10px] border border-blue-500/20">Chờ chuyển</span>}
                          {w.status === 'PAID' && <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold text-[10px] border border-emerald-500/20">Đã chi trả</span>}
                          {w.status === 'REJECTED' && <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold text-[10px] border border-destructive/20">Đã từ chối</span>}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {w.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApproveWithdrawal(w.id)}
                                className="px-2 py-1 rounded-lg bg-emerald-500 text-white font-bold hover:bg-emerald-600 text-[11px]"
                              >
                                Duyệt
                              </button>
                              <button
                                onClick={() => setRejectingWithdrawal(w)}
                                className="px-2 py-1 rounded-lg border border-destructive/30 text-destructive font-bold hover:bg-destructive/10 text-[11px]"
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {w.status === 'APPROVED' && (
                            <>
                              <button
                                onClick={() => setPayingWithdrawal(w)}
                                className="px-2 py-1 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 text-[11px]"
                                title="Xác nhận đã chuyển khoản thành công"
                              >
                                Đã Chuyển
                              </button>
                              <button
                                onClick={() => setRejectingWithdrawal(w)}
                                className="px-2 py-1 rounded-lg border border-destructive/30 text-destructive font-bold hover:bg-destructive/10 text-[11px]"
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {w.status === 'PAID' && (
                            <span className="text-[10px] text-emerald-500 font-bold">✓ Đã chuyển</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Ngoại Lệ Webhook */}
      {activeTab === 'webhook_exceptions' && (
        <div className="space-y-3">
          <div className="p-3 bg-muted/20 border border-border rounded-xl text-xs">
            <h4 className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Giám Sát & Xử Lý Ngoại Lệ SePay Webhook (§5 & §7)
            </h4>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              Các giao dịch chuyển thiếu tiền (UNDERPAID), thừa tiền, thanh toán trùng hoặc giao dịch sau khi đơn đã hết hạn.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                <tr>
                  <th style={{ width: '20%' }} className="p-3">Thời Gian & Mã Giao Dịch</th>
                  <th style={{ width: '22%' }} className="p-3">Mã Tham Chiếu / Đơn</th>
                  <th style={{ width: '18%' }} className="p-3">Số Tiền (KV / Nhận)</th>
                  <th style={{ width: '28%' }} className="p-3">Chi Tiết Ngoại Lệ</th>
                  <th style={{ width: '12%' }} className="p-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recExceptions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Không có ngoại lệ webhook nào. Toàn bộ giao dịch đều khớp chuẩn xác 100%!
                    </td>
                  </tr>
                ) : (
                  recExceptions.map((ex) => (
                    <tr key={ex.id} className="hover:bg-muted/20">
                      <td className="p-3">
                        <div className="font-bold font-mono">{new Date(ex.created_at).toLocaleDateString('vi-VN')}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{ex.run_id}</div>
                      </td>
                      <td className="p-3 font-mono truncate" title={ex.reference_id}>{ex.reference_id}</td>
                      <td className="p-3 font-mono">
                        <div>Nhận: <span className="font-bold text-primary">{ex.actual_amount?.toLocaleString('vi-VN')}đ</span></div>
                        <div className="text-[10px] text-muted-foreground">Cần: {ex.expected_amount?.toLocaleString('vi-VN')}đ</div>
                      </td>
                      <td className="p-3">
                        <div className="truncate font-semibold text-foreground" title={ex.suggested_cause}>{ex.suggested_cause}</div>
                        {ex.resolved_note && <div className="text-[10px] text-emerald-500 truncate" title={ex.resolved_note}>✓ {ex.resolved_note}</div>}
                      </td>
                      <td className="p-3 text-right">
                        {ex.status === 'OPEN' ? (
                          <button
                            onClick={() => setResolvingEx(ex)}
                            className="px-2 py-1 rounded-lg bg-emerald-500 text-white font-bold hover:bg-emerald-600 text-[11px]"
                          >
                            Xử lý
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-bold">Đã xong</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: Cấu Hình Hạn Mức & Giai Đoạn 2 */}
      {activeTab === 'config' && (
        <div className="p-5 bg-card border border-border rounded-2xl shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" /> Thiết Lập Hạn Mức & Tài Chính Sàn TMĐT
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cấu hình hạn mức thử việc, tỷ lệ phí sàn, thời gian giữ tiền và ngưỡng rút duyệt tay.
            </p>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Giới Hạn Sản Phẩm Thử Việc (TRIAL)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={trialProductLimit}
                  onChange={(e) => setTrialProductLimit(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background font-bold focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Gian hàng thử việc chỉ được đăng tối đa {trialProductLimit} sản phẩm.
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Giá Trị Tối Đa Mỗi Sản Phẩm TRIAL (Core)</label>
                <input
                  type="number"
                  min={10}
                  max={5000}
                  value={trialOrderMax}
                  onChange={(e) => setTrialOrderMax(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background font-bold focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Sản phẩm gian hàng TRIAL không được đặt giá vượt quá {trialOrderMax.toLocaleString('vi-VN')} Core.
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Tỷ Lệ Lỗi Tối Đa Của Lô Mã Code</label>
                <input
                  type="number"
                  step="0.01"
                  min={0.05}
                  max={1}
                  value={batchFreezeErrorRate}
                  onChange={(e) => setBatchFreezeErrorRate(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background font-bold focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Nếu tỷ lệ lỗi đạt {Math.round(batchFreezeErrorRate * 100)}%, tự động đóng băng các mã còn lại trong lô.
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Quy Mô Lô Tối Thiểu Để Xét Đóng Băng</label>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={minBatchSize}
                  onChange={(e) => setMinBatchSize(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background font-bold focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Lô nạp phải có từ {minBatchSize} mã trở lên mới áp dụng công thức đóng băng.
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Thời Gian Giữ Tiền Chung (Giờ) (§6.1)</label>
                <input
                  type="number"
                  min={0}
                  max={720}
                  value={holdHours}
                  onChange={(e) => setHoldHours(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background font-bold focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Mặc định kế hoạch: 168 giờ (7 ngày). Tiền sẽ tự giải ngân sang số dư khả dụng khi hết hạn.
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Tỷ Lệ Phí Sàn Chế Độ A (§6.3)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={0.5}
                  value={feeRate}
                  onChange={(e) => setFeeRate(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background font-bold focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Mặc định kế hoạch: 0.05 ({Math.round(feeRate * 100)}%). Khấu trừ lúc giải ngân vào sổ cái.
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Ngưỡng Rút Tiền Cần Duyệt Tay (Core) (§8)</label>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={withdrawThreshold}
                  onChange={(e) => setWithdrawThreshold(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background font-bold focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Yêu cầu rút vượt mức {withdrawThreshold.toLocaleString('vi-VN')} Core sẽ yêu cầu Quản trị viên duyệt thủ công.
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Nhóm Gian Hàng Thử Nghiệm Tiền Thật (§1.11)</label>
                <input
                  type="text"
                  value={testSellerIds}
                  onChange={(e) => setTestSellerIds(e.target.value)}
                  placeholder="sel_xxx, sel_yyy"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background font-mono focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Chỉ các gian hàng này mới mở bán bằng tiền thật QR. Các gian hàng khác chỉ bán bằng ví Core.
                </span>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={savingConfig}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold shadow-sm disabled:opacity-50"
              >
                {savingConfig ? 'Đang lưu...' : 'Lưu Thiết Lập Sàn TMĐT'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Từ Chối Gian Hàng */}
      {rejectingSeller && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-destructive">Từ Chối Gian Hàng: {rejectingSeller.name}</h4>
              <button onClick={() => setRejectingSeller(null)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleRejectSeller} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Lý do từ chối (Bắt buộc) *</label>
                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Nêu rõ lý do không đạt yêu cầu..."
                  className="w-full p-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingSeller(null)}
                  className="px-3 py-1.5 rounded-lg border border-border"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-destructive text-white font-bold"
                >
                  Xác Nhận Từ Chối
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Yêu Cầu Bổ Sung Thông Tin */}
      {requestingInfoSeller && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold">Yêu Cầu Bổ Sung: {requestingInfoSeller.name}</h4>
              <button onClick={() => setRequestingInfoSeller(null)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleRequestInfoSeller} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nội dung yêu cầu người bán bổ sung *</label>
                <textarea
                  rows={3}
                  required
                  value={requestInfoNote}
                  onChange={(e) => setRequestInfoNote(e.target.value)}
                  placeholder="Ví dụ: Vui lòng bổ sung số tài khoản ngân hàng chính xác..."
                  className="w-full p-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRequestingInfoSeller(null)}
                  className="px-3 py-1.5 rounded-lg border border-border"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold"
                >
                  Gửi Yêu Cầu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Từ Chối Sản Phẩm */}
      {rejectingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-destructive">Từ Chối Sản Phẩm: {rejectingProduct.name}</h4>
              <button onClick={() => setRejectingProduct(null)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleRejectProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Lý do từ chối *</label>
                <textarea
                  rows={3}
                  required
                  value={prodRejectReason}
                  onChange={(e) => setProdRejectReason(e.target.value)}
                  placeholder="Giá bán quá cao / Mô tả không rõ ràng..."
                  className="w-full p-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingProduct(null)}
                  className="px-3 py-1.5 rounded-lg border border-border"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-destructive text-white font-bold"
                >
                  Xác Nhận Từ Chối
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Giải Quyết Ngoại Lệ Đối Soát */}
      {resolvingEx && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold">Xử Lý Ngoại Lệ: {resolvingEx.reference_id}</h4>
              <button onClick={() => setResolvingEx(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="text-xs text-muted-foreground p-2.5 bg-muted/40 rounded-xl">
              {resolvingEx.suggested_cause}
            </div>
            <form onSubmit={handleResolveException} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Ghi chú xử lý / Biên bản *</label>
                <textarea
                  rows={3}
                  required
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Ví dụ: Đã hoàn lại 50.000đ tiền thừa cho khách qua ví Core..."
                  className="w-full p-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResolvingEx(null)}
                  className="px-3 py-1.5 rounded-lg border border-border"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white font-bold"
                >
                  Đánh Dấu Đã Xong
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Từ Chối Rút Tiền */}
      {rejectingWithdrawal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-destructive">Từ Chối Rút Tiền ({rejectingWithdrawal.amount_core} Core)</h4>
              <button onClick={() => setRejectingWithdrawal(null)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleRejectWithdrawal} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Lý do từ chối (Bắt buộc) *</label>
                <textarea
                  rows={3}
                  required
                  value={withdrawRejectReason}
                  onChange={(e) => setWithdrawRejectReason(e.target.value)}
                  placeholder="Thông tin tài khoản ngân hàng không chính xác / Gian hàng đang có tranh chấp..."
                  className="w-full p-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingWithdrawal(null)}
                  className="px-3 py-1.5 rounded-lg border border-border"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-destructive text-white font-bold"
                >
                  Xác Nhận Từ Chối & Hoàn Tiền
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xác Nhận Đã Chuyển Khoản Rút Tiền */}
      {payingWithdrawal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold">Xác Nhận Đã Chuyển Khoản</h4>
              <button onClick={() => setPayingWithdrawal(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="text-xs p-3 bg-muted/40 rounded-xl space-y-1">
              <div>Số tiền: <span className="font-bold text-primary">{payingWithdrawal.amount_core?.toLocaleString('vi-VN')} Core</span></div>
              <div>Ngân hàng: <span className="font-bold">{payingWithdrawal.bank_name}</span></div>
              <div>STK: <span className="font-mono font-bold">{payingWithdrawal.bank_account}</span></div>
              <div>Tên người nhận: <span className="font-bold">{payingWithdrawal.bank_account_name}</span></div>
            </div>
            <form onSubmit={handleMarkPaidWithdrawal} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Mã tham chiếu ngân hàng / Ghi chú</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Mã giao dịch FT... / Đã chuyển qua Internet Banking"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:border-primary font-mono"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayingWithdrawal(null)}
                  className="px-3 py-1.5 rounded-lg border border-border"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold"
                >
                  Xác Nhận Đã Chi Trả
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
