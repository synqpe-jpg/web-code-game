import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Tag,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  DollarSign,
  Users,
  Search,
  Save,
  RefreshCw,
  Clock,
  Mail,
  Sliders,
  History,
  ShieldAlert,
} from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { formatFullDateTime } from '../../utils/textUtils';

interface FirstPurchaseConfig {
  enabled: boolean;
  offer_price: number;
  max_original_price: number | null;
  excluded_products: string[];
  require_verified_email: boolean;
  updated_at?: string;
}

interface UsedOrderRecord {
  order_id: string;
  member_id: string;
  buyer_email: string;
  product_id: string;
  product_title: string;
  quantity: number;
  unit_price: number;
  original_price: number;
  price_paid: number;
  discount_amount: number;
  created_at: string;
  display_name?: string;
  username?: string;
}

interface ResetLogRecord {
  id: string;
  member_id: string;
  product_id: string;
  admin_id: string;
  admin_username: string;
  reason: string;
  reset_at: string;
  member_email?: string;
  product_title?: string;
}

interface IpAlertRecord {
  ip_address: string;
  account_count: number;
  order_count: number;
  sample_emails?: string;
}

interface FirstPurchaseModuleProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
}

export const FirstPurchaseModule: React.FC<FirstPurchaseModuleProps> = ({ onShowToast }) => {
  const [config, setConfig] = useState<FirstPurchaseConfig>({
    enabled: false,
    offer_price: 2000,
    max_original_price: null,
    excluded_products: ['sp_1793943215070_fxm', 'BỘ CODE'],
    require_verified_email: true,
  });

  const [metrics, setMetrics] = useState({
    total_used_count: 0,
    total_discount_core: 0,
    today_used_count: 0,
    new_members_ratio_percent: 0,
  });

  const [usedOrders, setUsedOrders] = useState<UsedOrderRecord[]>([]);
  const [resetLogs, setResetLogs] = useState<ResetLogRecord[]>([]);
  const [ipAlerts, setIpAlerts] = useState<IpAlertRecord[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form Reset Offer Modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetTargetEmail, setResetTargetEmail] = useState('');
  const [resetTargetProductId, setResetTargetProductId] = useState('');
  const [resetReason, setResetReason] = useState('Hỗ trợ khách hàng / giải quyết khiếu nại');
  const [isResetting, setIsResetting] = useState(false);

  // Stringified excluded products for textarea input
  const [excludedText, setExcludedText] = useState('');

  const getAuthHeaders = (): Record<string, string> => {
    const token =
      (typeof localStorage !== 'undefined' && localStorage.getItem('wcg_auth_token')) ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('wcg_auth_token')) ||
      '';
    const syncKey =
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('wcg_admin_sync_key')) ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('wcg_admin_sync_key')) ||
      'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Sync-Key': syncKey,
      'X-Admin-Key': syncKey,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const getAdminEndpoints = () => {
    return ['/api/admin/first-purchase', 'https://codegame.shop/api/admin/first-purchase'];
  };

  const loadData = async () => {
    setIsLoading(true);
    let success = false;
    let lastError = '';

    for (const endpoint of getAdminEndpoints()) {
      try {
        const res = await fetch(endpoint, {
          headers: getAuthHeaders(),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          if (data.config) {
            setConfig(data.config);
            setExcludedText((data.config.excluded_products || []).join('\n'));
          }
          if (data.metrics) setMetrics(data.metrics);
          if (data.used_orders) setUsedOrders(data.used_orders);
          if (data.reset_logs) setResetLogs(data.reset_logs);
          if (data.ip_alerts) setIpAlerts(data.ip_alerts);
          success = true;
          break;
        } else {
          lastError = data?.message || data?.error || (res.status !== 200 ? `Mã lỗi HTTP ${res.status}` : '');
        }
      } catch (e: any) {
        lastError = e?.message || 'Không thể kết nối đến máy chủ.';
      }
    }

    if (!success && lastError) {
      onShowToast('Lỗi tải dữ liệu', lastError || 'Không thể nạp thông tin ưu đãi.', 'error');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const parsedExcluded = excludedText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        action: 'update_config',
        config: {
          ...config,
          excluded_products: parsedExcluded,
        },
      };

      let saved = false;
      let lastErrMsg = '';

      for (const endpoint of getAdminEndpoints()) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          });

          const data = await res.json().catch(() => null);
          if (res.ok && data?.success) {
            if (data.config) setConfig(data.config);
            onShowToast('Thành công', 'Đã lưu cấu hình chiến dịch ưu đãi mua lần đầu.', 'success');
            saved = true;
            break;
          } else {
            lastErrMsg = data?.message || data?.error || (res.status !== 200 ? `Mã lỗi HTTP ${res.status}` : '');
          }
        } catch (e: any) {
          lastErrMsg = e?.message || 'Không thể gửi yêu cầu lưu.';
        }
      }

      if (!saved) {
        onShowToast('Thất bại', lastErrMsg || 'Không thể lưu cấu hình.', 'error');
      }
    } catch (e: any) {
      onShowToast('Lỗi', e?.message || 'Lỗi khi lưu cấu hình.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenResetModalForOrder = (order: UsedOrderRecord) => {
    setResetTargetEmail(order.buyer_email || order.member_id);
    setResetTargetProductId(order.product_id);
    setResetReason(`Hỗ trợ đơn hàng ${order.order_id} (${order.product_title})`);
    setIsResetModalOpen(true);
  };

  const handleSubmitResetOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetEmail.trim() || !resetTargetProductId.trim()) {
      onShowToast('Thiếu thông tin', 'Vui lòng nhập email tài khoản và mã gói.', 'error');
      return;
    }

    setIsResetting(true);
    try {
      const payload = {
        action: 'reset_offer',
        memberEmail: resetTargetEmail.trim(),
        productId: resetTargetProductId.trim(),
        reason: resetReason.trim() || 'Quản trị viên đặt lại ưu đãi',
      };

      const res = await fetch('/api/admin/first-purchase', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        onShowToast('Thành công', data.message || 'Đã đặt lại ưu đãi mua lần đầu cho tài khoản.', 'success');
        setIsResetModalOpen(false);
        setResetTargetEmail('');
        setResetTargetProductId('');
        loadData();
      } else {
        onShowToast('Thất bại', data.message || 'Không thể đặt lại ưu đãi.', 'error');
      }
    } catch (e: any) {
      onShowToast('Lỗi', e?.message || 'Lỗi khi đặt lại ưu đãi.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const filteredOrders = usedOrders.filter((ord) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (ord.order_id || '').toLowerCase().includes(q) ||
      (ord.buyer_email || '').toLowerCase().includes(q) ||
      (ord.product_title || '').toLowerCase().includes(q) ||
      (ord.product_id || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30 text-rose-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">
                Chiến Dịch Ưu Đãi Mua Lần Đầu (First Purchase Offer)
              </h1>
              <p className="text-xs text-muted-foreground">
                Cấu hình mua 1 gói giá ưu đãi lần đầu theo cặp (tài khoản, gói). Loại trừ BỘ CODE và quản lý đặt lại quyền ưu đãi.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-muted/60 hover:bg-muted border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white text-xs font-bold shadow-lg shadow-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình'}</span>
          </button>
        </div>
      </div>

      {/* Thống kê Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Lượt Dùng Ưu Đãi"
          value={metrics.total_used_count.toLocaleString('vi-VN')}
          subValue="Đơn thành công áp dụng lần đầu"
          icon={Tag}
          color="rose"
        />
        <StatCard
          title="Tổng Core Đã Giảm"
          value={metrics.total_discount_core.toLocaleString('vi-VN') + ' Core'}
          subValue="Tiết kiệm thực tế cho khách"
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          title="Lượt Dùng Hôm Nay"
          value={metrics.today_used_count.toLocaleString('vi-VN')}
          subValue="Phát sinh từ 00:00 hôm nay"
          icon={Clock}
          color="blue"
        />
        <StatCard
          title="Tỉ Lệ Khách Mới"
          value={`${metrics.new_members_ratio_percent}%`}
          subValue="Tài khoản mới tạo trong 7 ngày"
          icon={Users}
          color="amber"
        />
      </div>

      {/* Grid: Khối Cấu Hình & Cảnh Báo IP */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CỘT TRÁI (8 cols): Form Cài Đặt Chiến Dịch */}
        <div className="lg:col-span-8 rounded-2xl border border-border bg-card p-5 space-y-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-bold text-foreground">Cài Đặt Cấu Hình Chiến Dịch</h2>
            </div>
            {config.updated_at && (
              <span className="text-[11px] text-muted-foreground font-mono">
                Cập nhật: {formatFullDateTime(config.updated_at)}
              </span>
            )}
          </div>

          {/* Công tắc Bật/Tắt */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/80 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">Trạng Thái Chiến Dịch:</span>
                {config.enabled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> ĐANG BẬT
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
                    <XCircle className="w-3 h-3" /> ĐANG TẮT (Mặc định)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Khi tắt: Hệ thống lập tức dừng áp dụng giá ưu đãi, toàn bộ đơn hàng tính theo giá bán hiện tại của gói.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Giá Ưu Đãi Mặc Định */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-secondary" />
                <span>Giá Ưu Đãi Lần Đầu (Core):</span>
              </label>
              <input
                type="number"
                min={1}
                value={config.offer_price}
                onChange={(e) => setConfig({ ...config, offer_price: Math.max(1, parseInt(e.target.value) || 2000) })}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground text-xs font-mono font-bold focus:outline-none focus:border-rose-500"
                placeholder="2000"
              />
              <p className="text-[10px] text-muted-foreground">
                Giá khách thực trả = min(giá bán hiện tại của gói, giá ưu đãi này). Mặc định 2.000 Core.
              </p>
            </div>

            {/* Trần Giá Gốc */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span>Trần Giá Gốc Tối Đa (Core):</span>
              </label>
              <input
                type="number"
                min={1}
                value={config.max_original_price ?? ''}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  setConfig({ ...config, max_original_price: val ? parseInt(val) || null : null });
                }}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground text-xs font-mono focus:outline-none focus:border-rose-500"
                placeholder="Để trống = Không giới hạn trần"
              />
              <p className="text-[10px] text-muted-foreground">
                Nếu đặt: Các gói có giá bán &gt; trần này sẽ không được hưởng ưu đãi. Để trống nếu áp dụng cho mọi giá.
              </p>
            </div>
          </div>

          {/* Công tắc Xác minh Email */}
          <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span>Yêu Cầu Xác Minh Email:</span>
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Bật: Chỉ tài khoản có email đã xác minh hoặc tài khoản Admin mới được áp dụng giá ưu đãi.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.require_verified_email}
                onChange={(e) => setConfig({ ...config, require_verified_email: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          {/* Danh Sách Gói Loại Trừ */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                <span>Danh Sách Gói Loại Trừ (Không Áp Dụng Ưu Đãi):</span>
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                1 dòng = 1 ID gói hoặc từ khóa tiêu đề
              </span>
            </div>
            <textarea
              rows={3}
              value={excludedText}
              onChange={(e) => setExcludedText(e.target.value)}
              className="w-full p-3 rounded-xl bg-background border border-border text-foreground text-xs font-mono leading-relaxed focus:outline-none focus:border-rose-500"
              placeholder={"sp_1793943215070_fxm\nBỘ CODE"}
            />
            <p className="text-[10px] text-muted-foreground">
              Mặc định chứa <strong>BỘ CODE</strong> (sp_1793943215070_fxm) — gói này luôn giữ nguyên giá 72.000 Core.
            </p>
          </div>
        </div>

        {/* CỘT PHẢI (4 cols): Đặt Lại Thủ Công & Cảnh Báo IP */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card Đặt lại ưu đãi nhanh */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <RotateCcw className="w-4 h-4 text-secondary" />
              <h2 className="text-xs font-bold text-foreground">Đặt Lại Ưu Đãi Cho Thành Viên</h2>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cho phép 1 tài khoản được mua lại gói với giá ưu đãi thêm 1 lần nữa (ghi log kiểm toán đầy đủ).
            </p>
            <button
              type="button"
              onClick={() => {
                setResetTargetEmail('');
                setResetTargetProductId('');
                setResetReason('Hỗ trợ khách hàng');
                setIsResetModalOpen(true);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-muted/60 hover:bg-secondary/20 hover:text-secondary border border-border hover:border-secondary/30 text-xs font-bold text-foreground flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mở Form Đặt Lại Ưu Đãi</span>
            </button>
          </div>

          {/* Card Cảnh Báo IP */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-bold text-foreground">Cảnh Báo Nghi Vấn Lạm Dụng IP</h2>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Phát hiện các IP có từ 2 tài khoản khác nhau cùng dùng ưu đãi (chỉ cảnh báo theo dõi, không khóa tài khoản).
            </p>

            {ipAlerts.length === 0 ? (
              <div className="p-3 rounded-xl bg-muted/20 text-center text-xs text-muted-foreground">
                Chưa phát hiện dấu hiệu lạm dụng IP.
              </div>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {ipAlerts.map((alert, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-amber-300">{alert.ip_address}</span>
                      <span className="text-[10px] text-amber-400 font-bold">
                        {alert.account_count} tài khoản • {alert.order_count} đơn
                      </span>
                    </div>
                    {alert.sample_emails && (
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">
                        {alert.sample_emails}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bảng Danh Sách Đơn Hàng Đã Hưởng Ưu Đãi Lần Đầu */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-foreground">
              Lịch Sử Lượt Mua Đã Hưởng Ưu Đãi ({filteredOrders.length})
            </h2>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã đơn, email, gói..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-background border border-border text-foreground text-xs focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            Chưa có đơn hàng nào áp dụng ưu đãi mua lần đầu.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Mã Đơn</th>
                  <th className="py-2.5 px-3">Thời Gian</th>
                  <th className="py-2.5 px-3">Tài Khoản</th>
                  <th className="py-2.5 px-3">Gói Sản Phẩm</th>
                  <th className="py-2.5 px-3 text-right">Giá Gốc</th>
                  <th className="py-2.5 px-3 text-right">Đã Giảm</th>
                  <th className="py-2.5 px-3 text-right">Thực Trả</th>
                  <th className="py-2.5 px-3 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredOrders.map((ord) => (
                  <tr key={ord.order_id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                      {ord.order_id}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                      {formatFullDateTime(ord.created_at)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-foreground">{ord.buyer_email || '—'}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{ord.member_id}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-foreground">{ord.product_title}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{ord.product_id}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground line-through">
                      {(ord.original_price || ord.unit_price).toLocaleString('vi-VN')} Core
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-400">
                      -{(ord.discount_amount || 0).toLocaleString('vi-VN')} Core
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-400">
                      {(ord.price_paid || ord.unit_price).toLocaleString('vi-VN')} Core
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenResetModalForOrder(ord)}
                        className="p-1.5 rounded-lg bg-muted/60 hover:bg-secondary/20 hover:text-secondary text-muted-foreground border border-border/80 transition-all cursor-pointer active:scale-90"
                        title="Đặt lại ưu đãi cho tài khoản này với gói này"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bảng Nhật Ký Đặt Lại Ưu Đãi (Audit Logs) */}
      {resetLogs.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-foreground">
              Nhật Ký Đặt Lại Quyền Ưu Đãi ({resetLogs.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="py-2 px-3">Thời Gian</th>
                  <th className="py-2 px-3">Người Thực Hiện</th>
                  <th className="py-2 px-3">Tài Khoản Được Đặt Lại</th>
                  <th className="py-2 px-3">Gói Sản Phẩm</th>
                  <th className="py-2 px-3">Lý Do Đặt Lại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {resetLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-3 text-muted-foreground font-mono whitespace-nowrap">
                      {formatFullDateTime(log.reset_at)}
                    </td>
                    <td className="py-2 px-3 font-semibold text-foreground">
                      {log.admin_username}
                    </td>
                    <td className="py-2 px-3 font-mono text-secondary">
                      {log.member_email || log.member_id}
                    </td>
                    <td className="py-2 px-3 text-foreground font-medium">
                      {log.product_title || log.product_id}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {log.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Đặt Lại Ưu Đãi */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-foreground">Đặt Lại Quyền Ưu Đãi Lần Đầu</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xs p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitResetOffer} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Email hoặc ID Tài Khoản:</label>
                <input
                  type="text"
                  required
                  value={resetTargetEmail}
                  onChange={(e) => setResetTargetEmail(e.target.value)}
                  placeholder="ví dụ: muse@synq.com"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground text-xs font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Mã Gói Sản Phẩm (ID gói):</label>
                <input
                  type="text"
                  required
                  value={resetTargetProductId}
                  onChange={(e) => setResetTargetProductId(e.target.value)}
                  placeholder="ví dụ: sp_1793938653914_0qj"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground text-xs font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Lý Do Đặt Lại (Bắt buộc để lưu audit):</label>
                <textarea
                  rows={2}
                  required
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  placeholder="Ghi rõ lý do hỗ trợ khách hàng..."
                  className="w-full p-2.5 rounded-xl bg-background border border-border text-foreground text-xs focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={isResetting}
                  className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isResetting ? 'Đang thực hiện...' : 'Xác Nhận Đặt Lại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
