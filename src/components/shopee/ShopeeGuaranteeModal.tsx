import React from 'react';
import { ShieldCheck, X, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

interface ShopeeGuaranteeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShopeeGuaranteeModal: React.FC<ShopeeGuaranteeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Bảo Chứng Giao Dịch 168 Giờ</h3>
              <p className="text-xs text-white/90">Chính sách giữ tiền 168 giờ an toàn tuyệt đối</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/30 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-sm text-slate-700 dark:text-slate-300">
          
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-900 dark:text-amber-300">Giữ Tiền 168 Giờ (7 Ngày)</div>
              <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5">
                Khi bạn mua mã thẻ, gói nạp hoặc acc game, tiền của bạn sẽ được sàn tạm giữ an toàn trong 168 giờ. Người bán chưa thể rút tiền ngay.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
              Quyền Lợi Dành Cho Người Mua:
            </h4>
            
            <div className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Giao mã tự động 0 giây:</span>
                <span className="text-xs text-slate-600 dark:text-slate-400 ml-1">Mã thẻ và tài khoản hiển thị ngay sau khi thanh toán và lưu vĩnh viễn vào Tủ Mã.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <RefreshCw className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Báo lỗi 1-chạm & Đổi mới:</span>
                <span className="text-xs text-slate-600 dark:text-slate-400 ml-1">Nếu mã sai, đã sử dụng hoặc acc sai pass, bạn chỉ cần bấm "Báo lỗi" trong Tủ Mã để yêu cầu đổi mã ngay lập tức.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Hoàn tiền 100% khi có tranh chấp:</span>
                <span className="text-xs text-slate-600 dark:text-slate-400 ml-1">Quản trị viên đối soát trực tiếp, nếu người bán không thể cung cấp mã đúng, sàn tự động hoàn tiền về ví của bạn.</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400">
            💡 <strong>Cam kết bảo mật</strong>: Toàn bộ mã thẻ và thông tin tài khoản được mã hóa bằng tiêu chuẩn mã hóa quân đội <code>AES-GCM Web Crypto</code>. Chỉ duy nhất người mua mới có thể giải mã xem nội dung.
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#ee4d2d] hover:bg-orange-600 text-white font-bold px-6 py-2 rounded-xl text-xs shadow transition active:scale-95 cursor-pointer"
          >
            Đã Hiểu & Yên Tâm Mua Sắm
          </button>
        </div>

      </div>
    </div>
  );
};
