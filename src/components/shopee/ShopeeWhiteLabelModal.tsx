import React, { useState } from 'react';
import { Sparkles, X, Check, Rocket, ShieldCheck, CreditCard, Send, ShoppingBag } from 'lucide-react';

interface ShopeeWhiteLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPreviewSettings?: (settings: { shopName: string; shopSlogan: string; hotline: string }) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const ShopeeWhiteLabelModal: React.FC<ShopeeWhiteLabelModalProps> = ({
  isOpen,
  onClose,
  onApplyPreviewSettings,
  onShowToast
}) => {
  const [shopName, setShopName] = useState('Shop Acc Nam Gaming');
  const [shopSlogan, setShopSlogan] = useState('Sàn Tiện Ích & Acc Game Uy Tín #1');
  const [bankAccount, setBankAccount] = useState('19036789999 - Techcombank (NGUYEN VAN NAM)');
  const [hotline, setHotline] = useState('0988.888.999');
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro'>('starter');

  if (!isOpen) return null;

  const handleApplyPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (onApplyPreviewSettings) {
      onApplyPreviewSettings({ shopName, shopSlogan, hotline });
    }
    onShowToast(`Đã áp dụng xem trước thương hiệu "${shopName}" trên sàn!`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Giải Pháp Bán Sàn Game Trọn Gói (White-Label)</h3>
              <p className="text-xs text-white/90">Sở hữu website sàn Shopee Game riêng • Bàn giao siêu tốc dưới 2 phút</p>
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
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto text-sm text-slate-700 dark:text-slate-300">
          
          {/* 1. Interactive Live Preview Customizer */}
          <div className="p-4 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#ee4d2d]">
              <Sparkles className="w-4 h-4" />
              <span>Trải Nghiệm Đổi Thương Hiệu Trực Tiếp (Live Demo Preview)</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Nhập tên shop và thông tin của bạn vào ô dưới, hệ thống sẽ tự động cập nhật thương hiệu của bạn lên toàn bộ giao diện sàn:
            </p>

            <form onSubmit={handleApplyPreview} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Tên Shop Của Bạn:</label>
                <input 
                  type="text" 
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#ee4d2d]"
                  placeholder="Ví dụ: Shop Acc Nam Gaming"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Khẩu Hiệu / Slogan:</label>
                <input 
                  type="text" 
                  value={shopSlogan}
                  onChange={(e) => setShopSlogan(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#ee4d2d]"
                  placeholder="Ví dụ: Sàn Tiện Ích Game Uy Tín #1"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">STK Ngân Hàng Nhận Tiền (SePay):</label>
                <input 
                  type="text" 
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#ee4d2d]"
                  placeholder="Số tài khoản - Ngân hàng - Chủ TK"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Hotline / Zalo Hỗ Trợ:</label>
                <input 
                  type="text" 
                  value={hotline}
                  onChange={(e) => setHotline(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#ee4d2d]"
                  placeholder="Ví dụ: 0988.888.999"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end pt-1">
                <button
                  type="submit"
                  className="bg-[#ee4d2d] hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Áp Dụng Thử Ngay Lên Giao Diện Web</span>
                </button>
              </div>
            </form>
          </div>

          {/* 2. Bảng Giá Đề Xuất Bàn Giao */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
              Bảng Giá Các Gói Bàn Giao Siêu Tốc (Dưới 2 Phút):
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              {/* Gói Khởi Nghiệp */}
              <div 
                onClick={() => setSelectedPlan('starter')}
                className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${selectedPlan === 'starter' ? 'border-[#ee4d2d] bg-orange-50/20 dark:bg-orange-950/20 shadow-md' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'}`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold uppercase">Phổ Biến Nhất</span>
                      <h5 className="font-bold text-base mt-1 text-slate-900 dark:text-white">Gói Khởi Nghiệp</h5>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-[#ee4d2d]">1.500.000 đ</div>
                      <div className="text-[10px] text-slate-400">Trọn gói bàn giao</div>
                    </div>
                  </div>

                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 mt-3">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>Web phong cách Shopee chuẩn Mobile & Desktop</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>Sở hữu sẵn kho <strong>623+ game</strong> tự động cập nhật code</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>Cổng nạp VietQR tự động (tiền chạy thẳng vào STK bạn)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>Bàn giao dưới 2 phút, vận hành 0đ trên Cloudflare</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                  Phí duy trì server: 500K/năm (bắt đầu từ năm 2)
                </div>
              </div>

              {/* Gói Chuyên Nghiệp */}
              <div 
                onClick={() => setSelectedPlan('pro')}
                className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between ${selectedPlan === 'pro' ? 'border-[#ee4d2d] bg-orange-50/20 dark:bg-orange-950/20 shadow-md' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40'}`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full font-bold uppercase">Đầy Đủ Tính Năng</span>
                      <h5 className="font-bold text-base mt-1 text-slate-900 dark:text-white">Gói Chuyên Nghiệp</h5>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-purple-600 dark:text-purple-400">2.500.000 đ</div>
                      <div className="text-[10px] text-slate-400">Full option</div>
                    </div>
                  </div>

                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 mt-3">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                      <span>Toàn bộ tính năng của Gói Khởi Nghiệp</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                      <span>Tích hợp <strong>Vòng Quay May Mắn</strong> nhận Xu</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                      <span>Hỗ trợ gắn tên miền riêng <code>.vn</code> hoặc <code>.com</code></span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                      <span>Tùy biến Banner & Logo độc quyền miễn phí</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                  Phí duy trì server: 800K/năm (bắt đầu từ năm 2)
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Footer Action */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Đang chọn: <strong>{selectedPlan === 'starter' ? 'Gói Khởi Nghiệp (1.500.000đ)' : 'Gói Chuyên Nghiệp (2.500.000đ)'}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Để Sau
            </button>
            <a
              href="https://t.me/codegame_hotro"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Liên Hệ Mua & Bàn Giao Ngay</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
