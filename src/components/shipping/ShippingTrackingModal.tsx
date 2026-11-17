import React, { useEffect, useState } from 'react';
import {
  X,
  Truck,
  Package,
  Copy,
  Check,
  PhoneCall,
  Clock,
  MapPin,
  CheckCircle2,
  Printer,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  shippingService,
  ShippingOrderRecord,
  CARRIERS,
  CarrierCode,
} from '../../services/shippingService';
import { formatCurrency } from '../../utils/formatUtils';
import { useLanguage } from '../../context/LanguageContext';

interface ShippingTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: string;
  trackingCode?: string;
  initialShippingOrder?: ShippingOrderRecord | null;
}

export const ShippingTrackingModal: React.FC<ShippingTrackingModalProps> = ({
  isOpen,
  onClose,
  orderId,
  trackingCode,
  initialShippingOrder,
}) => {
  const { currentLanguage } = useLanguage();
  const [shippingOrder, setShippingOrder] = useState<ShippingOrderRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (initialShippingOrder) {
      setShippingOrder(initialShippingOrder);
      return;
    }

    setLoading(true);
    let order: ShippingOrderRecord | undefined;

    if (trackingCode) {
      order = shippingService.getOrderByTracking(trackingCode);
    } else if (orderId) {
      order = shippingService.getOrderByOrderId(orderId);
    }

    if (!order && (orderId || trackingCode)) {
      // Mock generate if looking up an order that hasn't created shipping yet
      order = {
        id: `ship_${Date.now()}`,
        orderId: orderId || 'ORD-UNKNOWN',
        carrier: 'GHTK',
        carrierName: CARRIERS.GHTK.name,
        trackingCode: trackingCode || shippingService.generateTrackingCode('GHTK'),
        status: 'IN_TRANSIT',
        statusText: 'Đang vận chuyển liên tỉnh',
        shippingFee: 22000,
        estimatedDelivery: '1 - 2 ngày tới',
        recipientName: 'Khách Hàng',
        recipientPhone: '0987654321',
        recipientAddress: 'Hà Nội, Việt Nam',
        senderName: 'CodeGame Logistics Center',
        senderAddress: 'Tổng kho TMĐT Số 1, Cầu Giấy, Hà Nội',
        timeline: [
          {
            title: 'Tạo đơn vận chuyển thành công',
            description: 'Đơn hàng đã được tiếp nhận trên hệ thống bưu chính tự động',
            timestamp: new Date(Date.now() - 3600000 * 5).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' hôm nay',
            completed: true,
          },
          {
            title: 'Bưu tá đã lấy hàng',
            description: 'Kiện hàng đã rời khỏi kho tổng và nhập kho điều phối',
            timestamp: new Date(Date.now() - 3600000 * 3).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' hôm nay',
            completed: true,
          },
          {
            title: 'Đang trung chuyển',
            description: 'Kiện hàng đang trên xe chuyên dụng di chuyển tới bưu cục phát',
            timestamp: new Date(Date.now() - 3600000 * 1).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' hôm nay',
            completed: true,
            current: true,
          },
          {
            title: 'Đang giao hàng',
            description: 'Shipper đang liên hệ và phát hàng tới địa chỉ của bạn',
            timestamp: 'Dự kiến hôm nay',
            completed: false,
          },
          {
            title: 'Giao hàng thành công',
            description: 'Khách hàng ký nhận kiện hàng nguyên vẹn',
            timestamp: 'Chờ giao',
            completed: false,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    setShippingOrder(order || null);
    setLoading(false);
  }, [isOpen, orderId, trackingCode, initialShippingOrder]);

  if (!isOpen) return null;

  const carrierInfo = shippingOrder ? CARRIERS[shippingOrder.carrier] || CARRIERS.GHTK : CARRIERS.GHTK;

  const handleCopyCode = () => {
    if (!shippingOrder?.trackingCode) return;
    navigator.clipboard.writeText(shippingOrder.trackingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintLabel = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          className="relative px-5 py-4 flex items-center justify-between text-white overflow-hidden"
          style={{ backgroundColor: carrierInfo.color }}
        >
          {/* Subtle carrier pattern */}
          <div className="absolute -right-6 -bottom-6 opacity-15 pointer-events-none text-7xl select-none">
            {carrierInfo.logoIcon}
          </div>

          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
              {carrierInfo.logoIcon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/25">
                  {carrierInfo.shortName}
                </span>
                <span className="text-xs text-white/80 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" /> API Kết Nối Tự Động
                </span>
              </div>
              <h3 className="font-bold text-base sm:text-lg leading-tight mt-0.5">
                Theo Dõi Hành Trình Đơn Vận Chuyển
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors relative z-10"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 space-y-5 text-slate-700 dark:text-slate-200 flex-1">
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <div className="animate-spin w-8 h-8 border-4 border-[#ee4d2d] border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm">Đang kết nối API bưu chính...</p>
            </div>
          ) : !shippingOrder ? (
            <div className="py-12 text-center text-slate-500">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">Không tìm thấy thông tin vận đơn</p>
              <p className="text-xs text-slate-500 mt-1">Vui lòng kiểm tra lại mã vận đơn hoặc liên hệ hỗ trợ.</p>
            </div>
          ) : (
            <>
              {/* Card Tracking Code & Barcode */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 w-full sm:w-auto text-center sm:text-left">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Mã Vận Đơn Chính Thức:
                  </div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="font-mono font-bold text-lg text-slate-900 dark:text-white tracking-wide">
                      {shippingOrder.trackingCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                      title="Sao chép mã"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1">
                    <span>Mã đơn: <strong className="text-slate-700 dark:text-slate-300">{shippingOrder.orderId}</strong></span>
                  </div>
                </div>

                {/* Simulated Barcode */}
                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col items-center">
                  <div className="h-8 flex items-center gap-[2px] px-2">
                    {[3, 1, 4, 1, 2, 5, 2, 1, 3, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 3, 4, 1, 2].map((w, i) => (
                      <div
                        key={i}
                        className="h-full bg-slate-900 dark:bg-slate-100"
                        style={{ width: `${w}px` }}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-mono tracking-widest text-slate-500 mt-1">
                    *{shippingOrder.trackingCode}*
                  </span>
                </div>
              </div>

              {/* Status Banner */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Trạng thái hiện tại
                    </div>
                    <div className="font-bold text-sm sm:text-base">
                      {shippingOrder.statusText || 'Đang vận chuyển giao hàng'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Dự kiến giao:</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                    <Clock className="w-3.5 h-3.5" />
                    {shippingOrder.estimatedDelivery || carrierInfo.estimatedDelivery}
                  </div>
                </div>
              </div>

              {/* Interactive Timeline */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900/50">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#ee4d2d]" /> Hành Trình Kiện Hàng (Thời Gian Thực)
                </h4>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {shippingOrder.timeline.map((step, idx) => {
                    const isLast = idx === shippingOrder.timeline.length - 1;
                    return (
                      <div key={idx} className="relative group">
                        {/* Step Marker */}
                        <div
                          className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                            step.completed
                              ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20'
                              : step.current
                              ? 'bg-blue-500 border-blue-500 ring-4 ring-blue-500/20'
                              : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {step.completed && <Check className="w-2.5 h-2.5" />}
                        </div>

                        {/* Step Content */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                          <div>
                            <div
                              className={`text-sm font-semibold ${
                                step.completed || step.current
                                  ? 'text-slate-900 dark:text-white'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {step.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {step.description}
                            </div>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap">
                            {step.timestamp}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delivery Details: Người gửi & Người nhận */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" /> Nơi Gửi Hàng
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 font-medium">{shippingOrder.senderName}</div>
                  <div className="text-slate-500 dark:text-slate-400 line-clamp-2">{shippingOrder.senderAddress}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Người Nhận Kiện Hàng
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 font-medium">
                    {shippingOrder.recipientName} ({shippingOrder.recipientPhone})
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 line-clamp-2">{shippingOrder.recipientAddress}</div>
                  {shippingOrder.shippingNote && (
                    <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                      Ghi chú: {shippingOrder.shippingNote}
                    </div>
                  )}
                </div>
              </div>

              {/* Hotline support */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <PhoneCall className="w-4 h-4 text-emerald-500" />
                  <span>Tổng đài hỗ trợ {carrierInfo.shortName}: <strong>{carrierInfo.hotline}</strong> (Miễn phí)</span>
                </div>
                <a
                  href={`tel:${carrierInfo.hotline.replace(/\s+/g, '')}`}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-colors"
                >
                  Gọi Ngay
                </a>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <button
            onClick={handlePrintLabel}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Printer className="w-4 h-4" /> In Phiếu Gửi Hàng
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold text-xs transition-colors"
          >
            Đóng Lại
          </button>
        </div>
      </div>
    </div>
  );
};
