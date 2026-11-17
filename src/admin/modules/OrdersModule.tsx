import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  CheckCircle2,
  RefreshCw,
  Eye,
  Copy,
  Check,
  DollarSign,
  Truck,
  Package,
  MapPin,
  Phone,
  User,
  FileText,
  Clock,
  Layers,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { StatCard } from '../components/ui/StatCard';
import { FormModal } from '../components/ui/FormModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { adminDataService } from '../services/adminDataService';
import { AdminOrderRecord } from '../types/adminTypes';
import { formatFullDateTime } from '../../utils/textUtils';
import {
  shippingService,
  CarrierApiConfig,
  CARRIERS,
  CarrierCode,
  ShippingOrderRecord,
} from '../../services/shippingService';
import { ShippingTrackingModal } from '../../components/shipping/ShippingTrackingModal';

interface OrdersModuleProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
}

const CARRIER_PRESETS = [
  'Giao Hàng Tiết Kiệm (GHTK)',
  'Giao Hàng Nhanh (GHN)',
  'Viettel Post',
  'Shopee Xpress (SPX)',
  'J&T Express',
  'VNPost / Bưu Điện VN',
  'Hỏa Tốc Grab / Ahamove',
  'Tự Giao Hàng',
];

export const OrdersModule: React.FC<OrdersModuleProps> = ({ onShowToast }) => {
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PHYSICAL' | 'DIGITAL'>('ALL');
  const [viewingOrder, setViewingOrder] = useState<AdminOrderRecord | null>(null);
  const [shippingOrder, setShippingOrder] = useState<AdminOrderRecord | null>(null);
  const [carrierInput, setCarrierInput] = useState('Giao Hàng Tiết Kiệm (GHTK)');
  const [trackingCodeInput, setTrackingCodeInput] = useState('');
  const [shippingStatusInput, setShippingStatusInput] = useState('SHIPPING');
  const [shippingNoteInput, setShippingNoteInput] = useState('');
  const [refundingOrder, setRefundingOrder] = useState<AdminOrderRecord | null>(null);
  const [refundReason] = useState('Mã thẻ không nạp được / Lỗi từ phía nhà phát hành');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Carrier API & Tracking States
  const [isCarrierConfigOpen, setIsCarrierConfigOpen] = useState(false);
  const [carrierConfig, setCarrierConfig] = useState<CarrierApiConfig>(() => shippingService.getConfig());
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingModalOrder, setTrackingModalOrder] = useState<ShippingOrderRecord | null>(null);
  const [selectedTrackingCode, setSelectedTrackingCode] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    const syncAndLoad = async () => {
      setIsLoading(true);
      try {
        await adminDataService.fetchFromCloudflareKV();
      } catch {}
      if (isMounted) {
        loadOrders();
      }
    };

    syncAndLoad();

    // Instant cross-tab sync
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('wcg_data_sync');
      channel.onmessage = (e) => {
        if (!isMounted) return;
        if (
          e.data?.type === 'ORDERS_UPDATED' ||
          e.data?.type === 'KV_DATA_PULLED' ||
          e.data?.type === 'TRANSACTIONS_UPDATED'
        ) {
          loadOrders();
        }
      };
    }

    const onDataUpdated = () => {
      if (!isMounted) return;
      loadOrders();
    };

    window.addEventListener('wcg_admin_data_updated', onDataUpdated);

    return () => {
      isMounted = false;
      channel?.close();
      window.removeEventListener('wcg_admin_data_updated', onDataUpdated);
    };
  }, [statusFilter, methodFilter, typeFilter]);

  const loadOrders = () => {
    setIsLoading(true);
    const filterObj: any = {};
    if (statusFilter !== 'ALL') filterObj.status = statusFilter;

    let data = adminDataService.getOrders(filterObj);
    if (statusFilter === 'PENDING') {
      data = data.filter((o) => o.status === 'PENDING' || (o as any).payment_status === 'PENDING_PAYMENT');
    }
    if (methodFilter !== 'ALL') {
      data = data.filter((o) => {
        const isQr = o.paymentMethod === 'VIETQR' || (o as any).payment_method === 'vietqr' || o.id?.startsWith('ORD-QR');
        return methodFilter === 'VIETQR' ? isQr : !isQr;
      });
    }
    if (typeFilter !== 'ALL') {
      data = data.filter((o) => {
        const isPhys = o.orderType === 'PHYSICAL' || (o as any).order_type === 'physical' || Boolean(o.shippingAddress);
        return typeFilter === 'PHYSICAL' ? isPhys : !isPhys;
      });
    }
    setOrders(data);
    setIsLoading(false);
  };

  const handleManualRefresh = async () => {
    setIsLoading(true);
    try {
      await adminDataService.fetchFromCloudflareKV();
      loadOrders();
      onShowToast('Đã làm mới dữ liệu', 'Danh sách đơn hàng đã được đồng bộ mới nhất từ Cloudflare D1.', 'success');
    } catch {
      onShowToast('Lỗi đồng bộ', 'Không thể kết nối đến máy chủ.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatVnd = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(code);
    setTimeout(() => setCopiedKey(null), 1500);
    onShowToast('Đã copy', `Mã ${code} đã được copy.`, 'info');
  };

  const handleRefundConfirm = () => {
    if (!refundingOrder) return;
    const ok = adminDataService.refundOrder(refundingOrder.id, refundReason);
    if (ok) {
      onShowToast(
        'Hoàn tiền thành công',
        `Đã hoàn ${formatVnd(refundingOrder.amount)} vào ví cho ${refundingOrder.buyerEmail}.`,
        'success'
      );
      setRefundingOrder(null);
      loadOrders();
    }
  };

  const handleOpenShippingModal = (order: AdminOrderRecord) => {
    setShippingOrder(order);
    setCarrierInput(order.carrier || 'Giao Hàng Tiết Kiệm (GHTK)');
    setTrackingCodeInput(order.trackingCode || '');
    setShippingStatusInput(order.status === 'PROCESSING' ? 'SHIPPING' : (order.status || 'SHIPPING'));
    setShippingNoteInput(order.shippingNote || '');
  };

  const handleSaveShipping = () => {
    if (!shippingOrder) return;
    if (!trackingCodeInput.trim() && shippingStatusInput === 'SHIPPING') {
      onShowToast('Thiếu mã vận đơn', 'Vui lòng nhập Mã Vận Đơn từ hãng vận chuyển khi chuyển trạng thái Đang Giao Hàng.', 'warning');
      return;
    }

    const ok = adminDataService.updateOrderShipping(shippingOrder.id, {
      carrier: carrierInput,
      trackingCode: trackingCodeInput.trim(),
      status: shippingStatusInput,
      shippingNote: shippingNoteInput.trim(),
    });

    if (ok) {
      onShowToast(
        'Cập nhật vận đơn thành công',
        `Đơn hàng #${shippingOrder.orderCode} đã được cập nhật: ${carrierInput} • ${trackingCodeInput.trim() || 'Chưa có mã'}`,
        'success'
      );
      setShippingOrder(null);
      loadOrders();
    } else {
      onShowToast('Lỗi cập nhật', 'Không tìm thấy đơn hàng cần cập nhật.', 'error');
    }
  };

  const handleExportCsv = () => {
    const header = 'ID,OrderCode,OrderType,BuyerName,BuyerEmail,BuyerPhone,ShippingAddress,ProductTitle,Amount,PaymentMethod,Status,TrackingCode,Carrier,CreatedAt\n';
    const rows = orders
      .map(
        (o) =>
          `"${o.id}","${o.orderCode}","${o.orderType || 'DIGITAL'}","${o.shippingName || o.buyerName}","${o.buyerEmail}","${o.shippingPhone || o.buyerPhone || ''}","${(o.shippingAddress || '').replace(/"/g, '""')}","${o.productTitle}",${o.amount},"${o.paymentMethod}","${o.status}","${o.trackingCode || ''}","${o.carrier || ''}","${o.createdAt}"`
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `danh_sach_don_hang_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Xuất file thành công', 'Danh sách đơn hàng đã tải về.', 'success');
  };

  // KPIs
  const totalRevenue = orders
    .filter((o) => o.status === 'COMPLETED' || o.status === 'DELIVERED')
    .reduce((sum, o) => sum + o.amount, 0);
  const physicalOrdersCount = orders.filter((o) => o.orderType === 'PHYSICAL' || (o as any).order_type === 'physical' || Boolean(o.shippingAddress)).length;
  const shippingOrdersCount = orders.filter((o) => o.status === 'SHIPPING').length;

  const columns: Column<AdminOrderRecord>[] = [
    {
      key: 'orderCode',
      header: 'Mã Đơn & Loại',
      sortable: true,
      render: (item) => {
        const isPhys = item.orderType === 'PHYSICAL' || (item as any).order_type === 'physical' || Boolean(item.shippingAddress);
        return (
          <div className="font-mono text-xs space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.orderCode}</span>
              {isPhys ? (
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  <Truck className="w-2.5 h-2.5" /> Vật Lý
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  <Package className="w-2.5 h-2.5" /> Kỹ Thuật Số
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 truncate" title={item.id}>
              {formatFullDateTime(item.createdAt)}
            </p>
          </div>
        );
      },
    },
    {
      key: 'buyerName',
      header: 'Khách Hàng & Nơi Nhận',
      render: (item) => {
        const isPhys = item.orderType === 'PHYSICAL' || (item as any).order_type === 'physical' || Boolean(item.shippingAddress);
        const displayName = item.shippingName || item.buyerName || item.buyerEmail || 'Khách hàng';
        const displayPhone = item.shippingPhone || item.buyerPhone;
        return (
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-slate-800 dark:text-slate-200 truncate" title={displayName}>
              {displayName} {displayPhone && <span className="font-normal font-mono text-[11px] text-slate-500">({displayPhone})</span>}
            </p>
            {isPhys && item.shippingAddress ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1" title={item.shippingAddress}>
                <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                <span className="truncate">{item.shippingAddress}</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 truncate">{item.buyerEmail || '—'}</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'productTitle',
      header: 'Sản Phẩm & Biến Thể',
      render: (item) => {
        const isPhys = item.orderType === 'PHYSICAL' || (item as any).order_type === 'physical' || Boolean(item.shippingAddress);
        return (
          <div className="text-xs space-y-0.5">
            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={item.productTitle}>
              {item.productTitle}
            </p>
            {item.variantName && (
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium truncate" title={item.variantName}>
                Phân loại: {item.variantName}
              </p>
            )}
            {isPhys ? (
              item.trackingCode ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTrackingCode(item.trackingCode || '');
                      setTrackingModalOrder(null);
                      setIsTrackingModalOpen(true);
                    }}
                    className="text-[10px] text-emerald-400 font-mono font-bold hover:underline flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20"
                    title="Bấm để xem hành trình bưu chính thời gian thực"
                  >
                    <Truck className="w-3 h-3 shrink-0" />
                    <span className="font-bold">{item.carrier || 'GHTK'}:</span>
                    <span>{item.trackingCode}</span>
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-amber-500 italic">Chưa xuất mã vận đơn</p>
              )
            ) : (
              <p className="text-[10px] text-slate-400 font-mono">
                {item.deliveredCodes?.length || 1} mã giao tự động
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: 'Tổng Tiền',
      sortable: true,
      align: 'right',
      render: (item) => {
        const isQr = item.paymentMethod === 'VIETQR' || (item as any).payment_method === 'vietqr' || item.id?.startsWith('ORD-QR');
        return (
          <div className="text-right space-y-0.5">
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white block">
              {formatVnd(item.amount)}
            </span>
            <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold ${
              isQr 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              {isQr ? '⚡ VietQR' : 'Ví Thành Viên'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Trạng Thái & Thao Tác',
      align: 'right',
      render: (item) => {
        const pStatus = (item as any).payment_status || (item as any).paymentStatus;
        const isPendingQr = pStatus === 'PENDING_PAYMENT' || item.status === 'PENDING';
        const isExpiredQr = pStatus === 'EXPIRED' || item.status === 'CANCELLED';
        const isPhys = item.orderType === 'PHYSICAL' || (item as any).order_type === 'physical' || Boolean(item.shippingAddress);

        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            {isPendingQr ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 animate-pulse">
                Chờ QR
              </span>
            ) : isExpiredQr ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                Đã hủy
              </span>
            ) : item.status === 'SHIPPING' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800 animate-pulse">
                <Truck className="w-2.5 h-2.5" /> Đang giao
              </span>
            ) : item.status === 'DELIVERED' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-2.5 h-2.5" /> Đã giao
              </span>
            ) : (
              <StatusBadge status={item.status} size="sm" />
            )}

            <button
              onClick={() => setViewingOrder(item)}
              title="Xem chi tiết đơn"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
            >
              <Eye className="h-4 w-4" />
            </button>

            {isPhys && (
              <button
                onClick={() => handleOpenShippingModal(item)}
                title="Cập nhật vận đơn & giao hàng"
                className="rounded-lg p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
              >
                <Truck className="h-4 w-4" />
              </button>
            )}

            {(item.status === 'COMPLETED' || item.status === 'DELIVERED') && (
              <button
                onClick={() => setRefundingOrder(item)}
                title="Hoàn tiền đơn hàng"
                className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-3">
        <StatCard
          title="Tổng Doanh Thu Bán Hàng"
          value={formatVnd(totalRevenue)}
          icon={DollarSign}
          color="emerald"
          subtext="Các đơn hoàn thành & đã giao"
        />
        <StatCard
          title="Đơn Hàng Vật Lý"
          value={physicalOrdersCount}
          icon={Truck}
          color="indigo"
          subtext="Giao vận toàn quốc"
        />
        <div className="col-span-2 sm:col-span-1">
          <StatCard
            title="Đơn Đang Vận Chuyển"
            value={shippingOrdersCount}
            icon={ShoppingCart}
            color="amber"
            subtext="Đang trên đường giao"
          />
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        data={orders}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        searchPlaceholder="Tìm mã đơn, tên, SĐT, địa chỉ giao hàng, sản phẩm..."
        searchKeys={['orderCode', 'buyerName', 'buyerEmail', 'shippingName', 'shippingPhone', 'shippingAddress', 'productTitle', 'trackingCode']}
        onRefresh={handleManualRefresh}
        onExportCsv={handleExportCsv}
        actions={
          <button
            type="button"
            onClick={() => setIsCarrierConfigOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1.5 shrink-0"
            title="Cấu hình Token API GHTK, GHN, Viettel Post"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cấu Hình API Vận Chuyển</span>
          </button>
        }
        filters={[
          {
            key: 'type',
            label: 'Phân loại hàng',
            selectedValue: typeFilter,
            options: [
              { label: 'Tất cả loại hàng', value: 'ALL' },
              { label: '📦 Hàng Vật Lý (Giao vận)', value: 'PHYSICAL' },
              { label: '⚡ Hàng Kỹ Thuật Số (Mã code)', value: 'DIGITAL' },
            ],
            onChange: (val) => setTypeFilter(val as any),
          },
          {
            key: 'status',
            label: 'Trạng thái',
            selectedValue: statusFilter,
            options: [
              { label: 'Tất cả trạng thái', value: 'ALL' },
              { label: 'Hoàn thành / Đã giao', value: 'COMPLETED' },
              { label: 'Đang giao hàng (SHIPPING)', value: 'SHIPPING' },
              { label: 'Đang xử lý (PROCESSING)', value: 'PROCESSING' },
              { label: 'Chờ thanh toán QR (PENDING)', value: 'PENDING' },
              { label: 'Hết hạn / Đã hủy (CANCELLED)', value: 'CANCELLED' },
              { label: 'Đã hoàn tiền (REFUNDED)', value: 'REFUNDED' },
            ],
            onChange: setStatusFilter,
          },
          {
            key: 'paymentMethod',
            label: 'Phương thức',
            selectedValue: methodFilter,
            options: [
              { label: 'Tất cả phương thức', value: 'ALL' },
              { label: 'Ví Thành Viên', value: 'WALLET' },
              { label: 'VietQR Trực Tiếp', value: 'VIETQR' },
            ],
            onChange: setMethodFilter,
          },
        ]}
      />

      {/* Modal Cập Nhật Vận Đơn & Trạng Thái Giao Hàng */}
      <FormModal
        isOpen={Boolean(shippingOrder)}
        onClose={() => setShippingOrder(null)}
        title={`Cập Nhật Vận Đơn #${shippingOrder?.orderCode}`}
        subtitle="Thiết lập đơn vị vận chuyển, mã vận đơn và cập nhật trạng thái đơn hàng."
        maxWidth="md"
      >
        {shippingOrder && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {shippingOrder.shippingName || shippingOrder.buyerName} • {shippingOrder.shippingPhone || shippingOrder.buyerPhone || 'Không có SĐT'}
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                📍 {shippingOrder.shippingAddress || 'Chưa cung cấp địa chỉ'}
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Đơn Vị Vận Chuyển <span className="text-rose-500">*</span>
              </label>
              <select
                value={carrierInput}
                onChange={(e) => setCarrierInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {CARRIER_PRESETS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Mã Vận Đơn (Tracking Code) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={trackingCodeInput}
                onChange={(e) => setTrackingCodeInput(e.target.value)}
                placeholder="Ví dụ: GHTK-89234120, GHN-293810, VP123456VN..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Trạng Thái Đơn Hàng
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'PROCESSING', label: 'Đang Chuẩn Bị Hàng' },
                  { value: 'SHIPPING', label: '🚚 Đang Giao Hàng' },
                  { value: 'DELIVERED', label: '✅ Đã Giao Thành Công' },
                  { value: 'CANCELLED', label: '❌ Đã Hủy Đơn' },
                ].map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setShippingStatusInput(st.value)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-left border ${
                      shippingStatusInput === st.value
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-700'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Ghi Chú Vận Đơn (Tùy chọn)
              </label>
              <input
                type="text"
                value={shippingNoteInput}
                onChange={(e) => setShippingNoteInput(e.target.value)}
                placeholder="Ví dụ: Khách hẹn giao sau 18h, kiện hàng dễ vỡ..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShippingOrder(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveShipping}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 flex items-center gap-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Lưu Cập Nhật Vận Đơn</span>
              </button>
            </div>
          </div>
        )}
      </FormModal>

      {/* Order Detail Modal */}
      <FormModal
        isOpen={Boolean(viewingOrder)}
        onClose={() => setViewingOrder(null)}
        title={`Chi Tiết Đơn Hàng #${viewingOrder?.orderCode}`}
        subtitle="Thông tin khách hàng, địa chỉ giao vận và mã sản phẩm."
        maxWidth="lg"
      >
        {viewingOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-xs dark:bg-slate-800/60">
              <div>
                <p className="text-slate-400">Khách Hàng & Nơi Nhận</p>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                  {viewingOrder.shippingName || viewingOrder.buyerName}
                </p>
                <p className="text-slate-500">{viewingOrder.buyerEmail}</p>
                <p className="text-slate-500 font-mono">{viewingOrder.shippingPhone || viewingOrder.buyerPhone || 'Không có SĐT'}</p>
                {viewingOrder.shippingAddress && (
                  <p className="text-slate-600 dark:text-slate-300 mt-1 font-medium">
                    📍 {viewingOrder.shippingAddress}
                  </p>
                )}
                {viewingOrder.shippingNote && (
                  <p className="text-amber-500 text-[11px] mt-0.5 italic">
                    Ghi chú: {viewingOrder.shippingNote}
                  </p>
                )}
              </div>

              <div>
                <p className="text-slate-400">Thanh Toán & Trạng Thái</p>
                <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatVnd(viewingOrder.amount)}
                </p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <StatusBadge status={viewingOrder.status} size="sm" />
                  <span className="text-[11px] text-slate-500">({viewingOrder.paymentMethod})</span>
                </div>
                {viewingOrder.trackingCode && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono text-[11px]">
                    <span className="font-bold">🚚 {viewingOrder.carrier || 'Vận chuyển'}:</span> {viewingOrder.trackingCode}
                  </div>
                )}
              </div>
            </div>

            {/* Delivered Codes (Nếu là hàng số) */}
            {viewingOrder.orderType !== 'PHYSICAL' && (!viewingOrder.shippingAddress || (viewingOrder.deliveredCodes && viewingOrder.deliveredCodes.length > 0)) && (
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Mã Sản Phẩm Đã Bàn Giao ({viewingOrder.deliveredCodes?.length || 0})
                </h4>
                <div className="space-y-2">
                  {viewingOrder.deliveredCodes && viewingOrder.deliveredCodes.length > 0 ? (
                    viewingOrder.deliveredCodes.map((code, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                      >
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{code}</span>
                        <button
                          onClick={() => handleCopy(code)}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600"
                        >
                          {copiedKey === code ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          <span className="text-[11px]">Sao chép</span>
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">Không có mã bàn giao.</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              {(viewingOrder.orderType === 'PHYSICAL' || viewingOrder.shippingAddress) && (
                <button
                  type="button"
                  onClick={() => {
                    const o = viewingOrder;
                    setViewingOrder(null);
                    handleOpenShippingModal(o);
                  }}
                  className="rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 flex items-center gap-1"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Cập Nhật Vận Đơn</span>
                </button>
              )}
              {(viewingOrder.status === 'COMPLETED' || viewingOrder.status === 'DELIVERED') && (
                <button
                  type="button"
                  onClick={() => {
                    const o = viewingOrder;
                    setViewingOrder(null);
                    setRefundingOrder(o);
                  }}
                  className="rounded-xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  Hoàn Tiền Cho Khách
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </FormModal>

      {/* Refund Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(refundingOrder)}
        onClose={() => setRefundingOrder(null)}
        onConfirm={handleRefundConfirm}
        title="Xác Nhận Hoàn Tiền Đơn Hàng"
        message={
          <span>
            Bạn có chắc chắn muốn hoàn lại{' '}
            <strong className="text-rose-600 font-mono">
              {formatVnd(refundingOrder?.amount || 0)}
            </strong>{' '}
            vào ví của khách hàng <strong>{refundingOrder?.buyerEmail}</strong>? Đơn hàng sẽ đổi trạng thái sang REFUNDED.
          </span>
        }
        confirmText="Hoàn tiền ngay"
        variant="warning"
      />

      {/* Carrier API Configuration Modal */}
      {isCarrierConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    Cấu Hình API Vận Chuyển Tự Động
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      GHTK • GHN • Viettel Post
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-400">Tự động kết nối, tính cước và sinh mã vận đơn khi khách đặt hàng</p>
                </div>
              </div>
              <button
                onClick={() => setIsCarrierConfigOpen(false)}
                className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                shippingService.saveConfig(carrierConfig);
                setIsCarrierConfigOpen(false);
                onShowToast('Lưu cấu hình thành công', 'Thông tin API 3 đơn vị vận chuyển đã được áp dụng ngay.', 'success');
              }}
              className="p-5 space-y-4 overflow-y-auto flex-1 text-xs"
            >
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">Môi Trường Vận Hành (API Mode)</span>
                  <span className="text-[11px] text-neutral-400">Chọn chế độ kết nối bưu chính</span>
                </div>
                <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setCarrierConfig({ ...carrierConfig, mode: 'sandbox' })}
                    className={`px-3 py-1 rounded-md font-semibold text-[11px] transition-colors ${
                      carrierConfig.mode === 'sandbox'
                        ? 'bg-amber-500 text-neutral-950'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Sandbox (Thử nghiệm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCarrierConfig({ ...carrierConfig, mode: 'production' })}
                    className={`px-3 py-1 rounded-md font-semibold text-[11px] transition-colors ${
                      carrierConfig.mode === 'production'
                        ? 'bg-emerald-500 text-neutral-950'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Production (Thật)
                  </button>
                </div>
              </div>

              {/* Hãng mặc định */}
              <div>
                <label className="font-semibold text-neutral-300 block mb-1">Đơn Vị Vận Chuyển Mặc Định</label>
                <select
                  value={carrierConfig.defaultCarrier}
                  onChange={(e) => setCarrierConfig({ ...carrierConfig, defaultCarrier: e.target.value as CarrierCode })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-emerald-500"
                >
                  <option value="GHTK">⚡ Giao Hàng Tiết Kiệm (GHTK Express)</option>
                  <option value="GHN">🚚 Giao Hàng Nhanh (GHN Express)</option>
                  <option value="VTP">🛡️ Viettel Post (Bưu Chính Viettel)</option>
                </select>
              </div>

              {/* GHTK Config */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-emerald-900/40 space-y-2">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                  <span>⚡ Giao Hàng Tiết Kiệm (GHTK)</span>
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">API Token GHTK</label>
                  <input
                    type="password"
                    value={carrierConfig.ghtkToken || ''}
                    onChange={(e) => setCarrierConfig({ ...carrierConfig, ghtkToken: e.target.value })}
                    placeholder="Nhập mã API Token cấp bởi GHTK..."
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 font-mono text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* GHN Config */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-orange-900/40 space-y-2">
                <div className="font-bold text-orange-400 flex items-center gap-1.5 text-xs">
                  <span>🚚 Giao Hàng Nhanh (GHN Express)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">API Token GHN</label>
                    <input
                      type="password"
                      value={carrierConfig.ghnToken || ''}
                      onChange={(e) => setCarrierConfig({ ...carrierConfig, ghnToken: e.target.value })}
                      placeholder="API Token GHN..."
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 font-mono text-white outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Shop ID</label>
                    <input
                      type="text"
                      value={carrierConfig.ghnShopId || ''}
                      onChange={(e) => setCarrierConfig({ ...carrierConfig, ghnShopId: e.target.value })}
                      placeholder="Mã cửa hàng (Shop ID)..."
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 font-mono text-white outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Viettel Post Config */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-red-900/40 space-y-2">
                <div className="font-bold text-red-400 flex items-center gap-1.5 text-xs">
                  <span>🛡️ Viettel Post (Bưu Chính Viettel)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Tài Khoản VTP</label>
                    <input
                      type="text"
                      value={carrierConfig.vtpUsername || ''}
                      onChange={(e) => setCarrierConfig({ ...carrierConfig, vtpUsername: e.target.value })}
                      placeholder="Tên đăng nhập Viettel Post..."
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Mật Khẩu</label>
                    <input
                      type="password"
                      value={carrierConfig.vtpPassword || ''}
                      onChange={(e) => setCarrierConfig({ ...carrierConfig, vtpPassword: e.target.value })}
                      placeholder="Mật khẩu VTP..."
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCarrierConfigOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
                >
                  Lưu Cấu Hình Vận Chuyển
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shipping Live Tracking Modal */}
      {isTrackingModalOpen && (
        <ShippingTrackingModal
          isOpen={isTrackingModalOpen}
          onClose={() => setIsTrackingModalOpen(false)}
          initialShippingOrder={trackingModalOrder}
          trackingCode={selectedTrackingCode || viewingOrder?.trackingCode}
          orderId={viewingOrder?.id}
        />
      )}
    </div>
  );
};
