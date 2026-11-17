import React, { useState, useEffect, useMemo } from 'react';
import {
  Ticket,
  Search,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Truck,
  Sparkles,
  RefreshCw,
  Power,
  Layers,
  HelpCircle,
  ShoppingBag,
} from 'lucide-react';
import {
  voucherService,
  VoucherItem,
  VoucherType,
  DiscountType,
  VoucherScope,
  INITIAL_VOUCHERS,
} from '../../services/voucherService';
import { formatCurrency } from '../../utils/formatUtils';

interface VouchersModuleProps {
  onShowToast?: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export const VouchersModule: React.FC<VouchersModuleProps> = ({ onShowToast }) => {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Edit / Create Modal state
  const [editingVoucher, setEditingVoucher] = useState<VoucherItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<VoucherItem>>({
    code: '',
    title: '',
    description: '',
    voucherType: 'platform',
    discountType: 'fixed',
    discountValue: 20000,
    maxDiscount: undefined,
    minOrderValue: 50000,
    scopeType: 'all',
    totalUsage: 500,
    isActive: true,
    badgeText: 'Mã Giảm Giá',
  });

  const loadData = () => {
    setVouchers(voucherService.getAll());
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    return {
      total: vouchers.length,
      freeship: vouchers.filter((v) => v.voucherType === 'freeship').length,
      platformShop: vouchers.filter((v) => v.voucherType !== 'freeship').length,
      active: vouchers.filter((v) => v.isActive).length,
    };
  }, [vouchers]);

  const filteredList = useMemo(() => {
    return vouchers.filter((item) => {
      if (typeFilter !== 'all' && item.voucherType !== typeFilter) return false;
      if (scopeFilter !== 'all' && item.scopeType !== scopeFilter) return false;
      if (statusFilter === 'active' && !item.isActive) return false;
      if (statusFilter === 'inactive' && item.isActive) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = item.code.toLowerCase().includes(q);
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        return matchCode || matchTitle || matchDesc;
      }
      return true;
    });
  }, [vouchers, typeFilter, scopeFilter, statusFilter, searchQuery]);

  const handleOpenCreate = () => {
    setEditingVoucher(null);
    setFormData({
      code: `VOUCHER${Math.floor(1000 + Math.random() * 9000)}`,
      title: 'Mã Giảm Giá Mới',
      description: 'Giảm giá đơn hàng khi mua sắm tại sàn',
      voucherType: 'platform',
      discountType: 'fixed',
      discountValue: 20000,
      maxDiscount: undefined,
      minOrderValue: 99000,
      scopeType: 'all',
      totalUsage: 500,
      isActive: true,
      badgeText: 'Mã Giảm Giá',
      highlightColor: '#ee4d2d',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: VoucherItem) => {
    setEditingVoucher(v);
    setFormData({ ...v });
    setIsModalOpen(true);
  };

  const handleSaveVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code?.trim() || !formData.title?.trim()) {
      if (onShowToast) onShowToast('warning', 'Vui lòng nhập Mã voucher và Tiêu đề');
      return;
    }

    voucherService.saveVoucher({
      ...formData,
      id: editingVoucher?.id,
      code: formData.code.trim().toUpperCase(),
      title: formData.title.trim(),
    });

    loadData();
    setIsModalOpen(false);
    if (onShowToast) {
      onShowToast('success', editingVoucher ? 'Cập nhật voucher thành công' : 'Tạo voucher mới thành công');
    }
  };

  const handleToggleActive = (v: VoucherItem) => {
    const nextState = voucherService.toggleVoucher(v.id);
    loadData();
    if (onShowToast) {
      onShowToast('info', `${nextState ? 'Đã kích hoạt' : 'Đã tạm dừng'} voucher ${v.code}`);
    }
  };

  const handleDelete = (v: VoucherItem) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa voucher ${v.code}?`)) {
      voucherService.deleteVoucher(v.id);
      loadData();
      if (onShowToast) onShowToast('success', `Đã xóa voucher ${v.code}`);
    }
  };

  const handleRestorePresets = () => {
    INITIAL_VOUCHERS.forEach((v) => voucherService.saveVoucher(v));
    loadData();
    if (onShowToast) onShowToast('success', 'Đã nạp lại bộ preset Voucher Shopee mẫu chuẩn!');
  };

  const getTypeBadge = (type: VoucherType) => {
    switch (type) {
      case 'freeship':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <Truck className="w-3 h-3" /> Freeship Xtra
          </span>
        );
      case 'platform':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <Ticket className="w-3 h-3" /> Voucher Sàn
          </span>
        );
      case 'shop':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <ShoppingBag className="w-3 h-3" /> Voucher Shop
          </span>
        );
    }
  };

  const getScopeLabel = (scope: VoucherScope) => {
    switch (scope) {
      case 'all':
        return 'Toàn bộ đơn hàng';
      case 'physical_only':
        return 'Chỉ hàng vật lý 🚚';
      case 'digital_only':
        return 'Chỉ mã game / digital ⚡';
      case 'category':
        return 'Theo ngành hàng';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-neutral-900 border border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10 text-[#ee4d2d]">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Hệ Thống Voucher Đa Tầng (Shopee Voucher Stacking)
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Chuẩn Rule 9
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Quản lý mã Freeship Xtra, Voucher Sàn & Voucher Shop • Áp dụng đồng thời 2 tầng mã khi thanh toán
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRestorePresets}
            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition-colors flex items-center gap-1.5"
            title="Nạp lại bộ voucher Shopee mẫu chuẩn"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Nạp Mẫu Shopee
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-[#ee4d2d] hover:opacity-95 text-white text-xs font-bold transition-all shadow-md shadow-orange-500/20 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Thêm Voucher Mới
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Tổng Voucher</div>
            <div className="text-xl font-black text-white mt-0.5">{stats.total}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-neutral-800 text-neutral-300 flex items-center justify-center">
            <Ticket className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">Mã Freeship Xtra</div>
            <div className="text-xl font-black text-teal-400 mt-0.5">{stats.freeship}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">Voucher Sàn & Shop</div>
            <div className="text-xl font-black text-orange-400 mt-0.5">{stats.platformShop}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Đang Hoạt Động</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">{stats.active}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã voucher hoặc tiêu đề..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 outline-none focus:border-[#ee4d2d]"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 outline-none focus:border-[#ee4d2d]"
          >
            <option value="all">Tất cả loại voucher</option>
            <option value="freeship">🚚 Mã Freeship</option>
            <option value="platform">🎟️ Voucher Sàn</option>
            <option value="shop">🛍️ Voucher Shop</option>
          </select>

          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 outline-none focus:border-[#ee4d2d]"
          >
            <option value="all">Tất cả phạm vi</option>
            <option value="physical_only">Hàng vật lý 🚚</option>
            <option value="digital_only">Hàng số / Game ⚡</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 outline-none focus:border-[#ee4d2d]"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang bật (Active)</option>
            <option value="inactive">Đã tắt</option>
          </select>
        </div>

        <div className="text-[11px] text-neutral-400 italic">
          💡 Quy tắc Shopee: 1 Freeship + 1 Discount trên cùng 1 đơn hàng
        </div>
      </div>

      {/* Main Table - 100% SINGLE-SCREEN FIRST (Rule 9 Compliant) */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
        <table className="table-fixed w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-950/70 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              <th className="w-[28%] px-3 py-3">Mã Code & Tên Voucher</th>
              <th className="w-[20%] px-3 py-3">Mức Giảm Giá</th>
              <th className="w-[20%] px-3 py-3">Điều Kiện & Phạm Vi</th>
              <th className="w-[18%] px-3 py-3">Lượt Dùng & Thời Hạn</th>
              <th className="w-[14%] px-3 py-3 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 text-xs">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-neutral-500">
                  Không tìm thấy voucher nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredList.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-800/30 transition-colors">
                  {/* Column 1: Mã Code & Tên (28%) */}
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {getTypeBadge(item.voucherType)}
                    </div>
                    <div className="font-mono font-bold text-white text-xs tracking-wider flex items-center gap-1.5">
                      <span>{item.code}</span>
                    </div>
                    <div className="text-neutral-300 font-semibold truncate text-[11px] mt-0.5" title={item.title}>
                      {item.title}
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate" title={item.description}>
                      {item.description}
                    </div>
                  </td>

                  {/* Column 2: Mức Giảm (20%) */}
                  <td className="px-3 py-2.5 align-middle">
                    <div className="font-bold text-sm text-emerald-400">
                      {item.discountType === 'fixed'
                        ? formatCurrency(item.discountValue)
                        : `Giảm ${item.discountValue}%`}
                    </div>
                    {item.discountType === 'percent' && item.maxDiscount && (
                      <div className="text-[10px] text-neutral-400 truncate">
                        Tối đa: {formatCurrency(item.maxDiscount)}
                      </div>
                    )}
                  </td>

                  {/* Column 3: Điều Kiện & Phạm Vi (20%) */}
                  <td className="px-3 py-2.5 align-middle">
                    <div className="text-neutral-300 text-xs font-medium">
                      Đơn từ: <strong className="text-white">{formatCurrency(item.minOrderValue)}</strong>
                    </div>
                    <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                      {getScopeLabel(item.scopeType)}
                    </div>
                  </td>

                  {/* Column 4: Lượt Dùng & Hạn (18%) */}
                  <td className="px-3 py-2.5 align-middle">
                    <div className="text-xs text-neutral-300">
                      Đã dùng: <strong className="text-orange-400 font-mono">{item.usedCount}</strong>/{item.totalUsage}
                    </div>
                    <div className="w-full bg-neutral-800 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div
                        className="bg-orange-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.round((item.usedCount / item.totalUsage) * 100))}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono mt-1">
                      HSD: {new Date(item.endDate).toLocaleDateString('vi-VN')}
                    </div>
                  </td>

                  {/* Column 5: Thao Tác (14%) */}
                  <td className="px-3 py-2.5 align-middle text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggleActive(item)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          item.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-neutral-800 text-neutral-500 border-neutral-700 hover:bg-neutral-700'
                        }`}
                        title={item.isActive ? 'Đang bật (Bấm để tắt)' : 'Đã tắt (Bấm để bật)'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors"
                        title="Chỉnh sửa voucher"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-950 text-neutral-400 hover:text-rose-400 border border-neutral-700 transition-colors"
                        title="Xóa voucher"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Thêm / Chỉnh Sửa Voucher */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-500/10 text-[#ee4d2d]">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">
                    {editingVoucher ? `Chỉnh Sửa Voucher: ${editingVoucher.code}` : 'Tạo Voucher Đa Tầng Mới'}
                  </h3>
                  <p className="text-xs text-neutral-400">Cấu hình tham số giảm giá và điều kiện áp dụng</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveVoucher} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-300 block mb-1">Mã Voucher (Code) *</label>
                  <input
                    type="text"
                    required
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="VD: FREESHIP30K, SAN50K..."
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 font-mono font-bold text-white uppercase outline-none focus:border-[#ee4d2d]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-300 block mb-1">Loại Voucher *</label>
                  <select
                    value={formData.voucherType || 'platform'}
                    onChange={(e) => setFormData({ ...formData, voucherType: e.target.value as VoucherType })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-[#ee4d2d]"
                  >
                    <option value="freeship">🚚 Mã Vận Chuyển (Freeship Xtra)</option>
                    <option value="platform">🎟️ Mã Giảm Giá Sàn (Platform)</option>
                    <option value="shop">🛍️ Mã Giảm Giá Shop (Store)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-neutral-300 block mb-1">Tiêu Đề Voucher *</label>
                <input
                  type="text"
                  required
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="VD: Freeship Xtra 15.000đ cho đơn từ 50.000đ"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-[#ee4d2d]"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-300 block mb-1">Mô Tả Chi Tiết</label>
                <input
                  type="text"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="VD: Áp dụng cho các sản phẩm vận chuyển qua GHTK, GHN, Viettel Post"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 outline-none focus:border-[#ee4d2d]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-neutral-300 block mb-1">Kiểu Giảm Giá</label>
                  <select
                    value={formData.discountType || 'fixed'}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value as DiscountType })}
                    className="w-full px-2.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-[#ee4d2d]"
                  >
                    <option value="fixed">Số tiền VNĐ</option>
                    <option value="percent">Phần trăm %</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-neutral-300 block mb-1">
                    {formData.discountType === 'percent' ? 'Mức Giảm (%)' : 'Mức Giảm (VNĐ)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.discountValue || 0}
                    onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-white outline-none focus:border-[#ee4d2d]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-300 block mb-1">Giảm Tối Đa (VNĐ)</label>
                  <input
                    type="number"
                    value={formData.maxDiscount || ''}
                    disabled={formData.discountType !== 'percent'}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder={formData.discountType === 'percent' ? 'VD: 50000' : 'Không áp dụng'}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-white disabled:opacity-40 outline-none focus:border-[#ee4d2d]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-300 block mb-1">Đơn Tối Thiểu (VNĐ)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minOrderValue || 0}
                    onChange={(e) => setFormData({ ...formData, minOrderValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-white outline-none focus:border-[#ee4d2d]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-300 block mb-1">Phạm Vi Áp Dụng</label>
                  <select
                    value={formData.scopeType || 'all'}
                    onChange={(e) => setFormData({ ...formData, scopeType: e.target.value as VoucherScope })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-[#ee4d2d]"
                  >
                    <option value="all">Toàn bộ đơn hàng</option>
                    <option value="physical_only">Chỉ hàng vật lý 🚚</option>
                    <option value="digital_only">Chỉ hàng số / Game ⚡</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-neutral-300 block mb-1">Tổng Lượt Dùng Tối Đa</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.totalUsage || 100}
                    onChange={(e) => setFormData({ ...formData, totalUsage: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-white outline-none focus:border-[#ee4d2d]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-neutral-300 block mb-1">Tag Nhãn Hiển Thị</label>
                  <input
                    type="text"
                    value={formData.badgeText || ''}
                    onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                    placeholder="VD: Freeship Xtra, Shopee Mall"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-[#ee4d2d]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-neutral-700 text-[#ee4d2d] focus:ring-0"
                />
                <label htmlFor="isActiveToggle" className="text-neutral-300 font-semibold cursor-pointer">
                  Kích hoạt sử dụng ngay trên Web Khách
                </label>
              </div>

              <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-[#ee4d2d] hover:bg-[#d73211] text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all"
                >
                  {editingVoucher ? 'Lưu Thay Đổi' : 'Tạo Voucher Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
