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
} from 'lucide-react';

interface SellerModerationModuleProps {
  onShowToast?: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
}

export const SellerModerationModule: React.FC<SellerModerationModuleProps> = ({ onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'sellers' | 'products' | 'config'>('sellers');
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

  // Config State
  const [trialProductLimit, setTrialProductLimit] = useState<number>(5);
  const [trialOrderMax, setTrialOrderMax] = useState<number>(200);
  const [batchFreezeErrorRate, setBatchFreezeErrorRate] = useState<number>(0.25);
  const [minBatchSize, setMinBatchSize] = useState<number>(5);
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
      }
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'sellers') fetchSellers();
    if (activeTab === 'products') fetchProducts();
    if (activeTab === 'config') fetchConfig();
  }, [activeTab, sellerStatusFilter, productStatusFilter]);

  // Approve Seller -> TRIAL (§3.2)
  const handleApproveSeller = async (sellerId: string) => {
    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}/approve`, {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thành công', data.message, 'success');
        fetchSellers();
      } else {
        showToast('Lỗi', data.error || 'Duyệt gian hàng thất bại', 'error');
      }
    } catch {
      showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
    }
  };

  // Reject Seller
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

  // Request Info Seller
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

  // Suspend / Unsuspend Seller
  const handleToggleSuspendSeller = async (seller: any) => {
    const isSuspended = seller.status === 'SUSPENDED';
    const endpoint = isSuspended ? `/api/admin/sellers/${seller.id}/unsuspend` : `/api/admin/sellers/${seller.id}/suspend`;
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: getAdminHeaders() });
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

  // Approve Product (§5.3)
  const handleApproveProduct = async (productId: string) => {
    try {
      const res = await fetch(`/api/admin/seller-products/${productId}/approve`, {
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

  // Reject Product
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
            <Store className="w-5 h-5 text-primary" /> Quản Lý Sàn TMĐT & Thẩm Định Gian Hàng
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Duyệt hồ sơ gian hàng, xét duyệt sản phẩm mở bán và thiết lập hạn mức thử việc tự động.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border text-xs">
          <button
            onClick={() => setActiveTab('sellers')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'sellers' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Gian Hàng ({sellers.length})
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'products' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sản Phẩm ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'config' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Cấu Hình Hạn Mức
          </button>
        </div>
      </div>

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
              className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3 w-[30%]">Gian Hàng & Chủ Shop</th>
                  <th className="p-3 w-[20%]">Ngân Hàng & Liên Hệ</th>
                  <th className="p-3 w-[15%] text-center">Sản Phẩm / Đơn</th>
                  <th className="p-3 w-[15%] text-center">Trạng Thái</th>
                  <th className="p-3 w-[20%] text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sellers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Không có gian hàng nào trong danh sách.
                    </td>
                  </tr>
                ) : (
                  sellers.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="p-3 truncate">
                        <div className="font-bold text-foreground truncate" title={s.name}>
                          {s.name}
                        </div>
                        <div className="text-[11px] text-primary truncate">
                          /gian-hang/{s.slug}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          Chủ: {s.owner_username || s.owner_email || s.owner_member_id}
                        </div>
                      </td>
                      <td className="p-3 truncate text-[11px]">
                        <div>SĐT: {s.contact_phone || '—'}</div>
                        <div className="text-muted-foreground truncate" title={`${s.bank_name || ''} - ${s.bank_account || ''}`}>
                          {s.bank_name ? `${s.bank_name}: ${s.bank_account}` : 'Chưa nhập NH'}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="font-bold">{s.total_products || 0} SP</div>
                        <div className="text-[10px] text-muted-foreground">{s.total_orders || 0} đơn</div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : s.status === 'TRIAL'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : s.status === 'PENDING'
                            ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                            : s.status === 'SUSPENDED'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}>
                          {s.status}
                        </span>
                        {s.is_vacation === 1 && (
                          <div className="text-[9px] text-amber-500 font-semibold mt-0.5">Nghỉ bán</div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {s.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApproveSeller(s.id)}
                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow-sm"
                                title="Duyệt vào giai đoạn Thử Việc (TRIAL)"
                              >
                                Duyệt TRIAL
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingSeller(s);
                                  setRejectReason('');
                                }}
                                className="px-2 py-1 rounded bg-destructive text-white text-[10px] font-bold shadow-sm"
                                title="Từ chối kèm lý do"
                              >
                                Từ Chối
                              </button>
                              <button
                                onClick={() => {
                                  setRequestingInfoSeller(s);
                                  setRequestInfoNote('');
                                }}
                                className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-[10px] font-bold"
                                title="Yêu cầu bổ sung thông tin"
                              >
                                Bổ Sung
                              </button>
                            </>
                          )}
                          {s.status !== 'PENDING' && (
                            <button
                              onClick={() => handleToggleSuspendSeller(s)}
                              className={`px-2 py-1 rounded text-[10px] font-bold border ${
                                s.status === 'SUSPENDED'
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                  : 'bg-destructive/10 border-destructive/30 text-destructive'
                              }`}
                            >
                              {s.status === 'SUSPENDED' ? 'Mở Khóa' : 'Khóa Shop'}
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

      {/* Tab 2: Sản Phẩm Chờ Duyệt (Quy tắc 9: 100% table-fixed w-full) */}
      {activeTab === 'products' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 text-xs">
              <label className="font-semibold text-muted-foreground">Trạng Thái Sản Phẩm:</label>
              <select
                value={productStatusFilter}
                onChange={(e) => setProductStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold focus:outline-none focus:border-primary"
              >
                <option value="PENDING_REVIEW">Chờ Duyệt (PENDING_REVIEW)</option>
                <option value="APPROVED">Đã Duyệt (APPROVED)</option>
                <option value="REJECTED">Từ Chối (REJECTED)</option>
                <option value="">Tất cả</option>
              </select>
            </div>
            <button
              onClick={fetchProducts}
              className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs"
              title="Làm mới"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="table-fixed w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-3 w-[30%]">Sản Phẩm & Game</th>
                  <th className="p-3 w-[20%]">Gian Hàng</th>
                  <th className="p-3 w-[15%] text-right">Giá Bán Core</th>
                  <th className="p-3 w-[15%] text-center">Tồn Kho</th>
                  <th className="p-3 w-[20%] text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Không có sản phẩm nào trong hàng chờ duyệt.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="p-3 truncate">
                        <div className="flex items-center gap-2">
                          <img src={p.cover_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 border" />
                          <div className="truncate">
                            <div className="font-bold truncate" title={p.name}>{p.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{p.game_name || p.game_slug} • {p.delivery_type}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 truncate">
                        <div className="font-semibold truncate">{p.seller_name}</div>
                        <div className="text-[10px] text-muted-foreground">Shop status: {p.seller_status}</div>
                      </td>
                      <td className="p-3 text-right font-bold text-foreground">
                        {p.price_core.toLocaleString()} Core
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-mono font-bold text-emerald-500">
                          {p.in_stock_count || 0} mã
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {p.status === 'PENDING_REVIEW' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleApproveProduct(p.id)}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm"
                            >
                              Duyệt
                            </button>
                            <button
                              onClick={() => {
                                setRejectingProduct(p);
                                setProdRejectReason('');
                              }}
                              className="px-2.5 py-1 rounded bg-destructive text-white text-[11px] font-bold shadow-sm"
                            >
                              Từ Chối
                            </button>
                          </div>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
                          }`}>
                            {p.status}
                          </span>
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

      {/* Tab 3: Cấu Hình Hạn Mức Sàn (§3.2, §5.2) */}
      {activeTab === 'config' && (
        <div className="max-w-2xl bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-primary" /> Thiết Lập Hạn Mức Giai Đoạn Thử Việc & Kiểm Soát Rủi Ro
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Các thiết lập này áp dụng cho toàn bộ gian hàng mới được duyệt vào trạng thái TRIAL và cơ chế tự động bảo vệ người mua.
            </p>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Giới Hạn Sản Phẩm TRIAL</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={trialProductLimit}
                  onChange={(e) => setTrialProductLimit(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background font-bold focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Số sản phẩm tối đa gian hàng thử việc được phép đăng (mặc định: 5).
                </span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Giá Trần Mỗi Đơn TRIAL (Core)</label>
                <input
                  type="number"
                  min={10}
                  max={10000}
                  value={trialOrderMax}
                  onChange={(e) => setTrialOrderMax(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background font-bold focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Giá Core tối đa cho 1 sản phẩm của shop thử việc (mặc định: 200 Core).
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
              <div>
                <label className="block font-semibold mb-1">Tỷ Lệ Báo Lỗi Để Đóng Băng Lô Mã</label>
                <input
                  type="number"
                  step="0.05"
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

      {/* Modal: Từ Chối Gian Hàng (§3.2) */}
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

      {/* Modal: Yêu Cầu Bổ Sung Thông Tin (§3.2) */}
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
    </div>
  );
};
