import React, { useState, useEffect, useMemo } from 'react';
import {
  Rocket,
  Search,
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  Phone,
  MessageCircle,
  CheckCircle2,
  Clock,
  Filter,
  UserCheck,
  Building2,
  DollarSign,
  AlertCircle,
  X,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
import { adminDataService } from '../services/adminDataService';
import type { TenantLeadRecord } from '../types/adminTypes';

interface PlatformLeadsModuleProps {
  onShowToast?: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export const PlatformLeadsModule: React.FC<PlatformLeadsModuleProps> = ({ onShowToast }) => {
  const [leads, setLeads] = useState<TenantLeadRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Selected lead for detail/edit modal
  const [editingLead, setEditingLead] = useState<TenantLeadRecord | null>(null);
  const [modalStatus, setModalStatus] = useState<string>('NEW');
  const [modalAdminNotes, setModalAdminNotes] = useState<string>('');

  // Add new lead modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newShopName, setNewShopName] = useState('');
  const [newIndustry, setNewIndustry] = useState('gaming');
  const [newPlanType, setNewPlanType] = useState('rental_business');
  const [newDomain, setNewDomain] = useState('');
  const [newNote, setNewNote] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadLeads = () => {
    const data = adminDataService.getTenantLeads();
    setLeads(data);
  };

  useEffect(() => {
    loadLeads();
    const handleUpdate = () => loadLeads();
    window.addEventListener('tenant_leads_updated', handleUpdate);
    return () => window.removeEventListener('tenant_leads_updated', handleUpdate);
  }, []);

  const handleCopyPhone = (phone: string, id: string) => {
    navigator.clipboard?.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
    onShowToast?.('info', `Đã sao chép SĐT: ${phone}`);
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (planFilter !== 'all' && item.plan_type !== planFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.full_name?.toLowerCase().includes(q);
        const matchPhone = item.phone?.toLowerCase().includes(q);
        const matchShop = item.shop_name?.toLowerCase().includes(q);
        const matchId = item.id?.toLowerCase().includes(q);
        return matchName || matchPhone || matchShop || matchId;
      }
      return true;
    });
  }, [leads, searchQuery, statusFilter, planFilter]);

  // KPIs
  const stats = useMemo(() => {
    const total = leads.length;
    const newCount = leads.filter((l) => l.status === 'NEW').length;
    const qualifiedCount = leads.filter((l) => l.status === 'QUALIFIED').length;
    const wonCount = leads.filter((l) => l.status === 'CLOSED_WON').length;
    return { total, newCount, qualifiedCount, wonCount };
  }, [leads]);

  const handleSaveModal = () => {
    if (!editingLead) return;
    const success = adminDataService.updateTenantLeadStatus(
      editingLead.id,
      modalStatus,
      modalAdminNotes
    );
    if (success) {
      onShowToast?.('success', `Đã cập nhật hồ sơ ${editingLead.id}`);
      setEditingLead(null);
      loadLeads();
    } else {
      onShowToast?.('error', 'Cập nhật thất bại');
    }
  };

  const handleDeleteLead = (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc muốn xóa hồ sơ của khách [${name}]?`)) {
      const success = adminDataService.deleteTenantLead(id);
      if (success) {
        onShowToast?.('info', 'Đã xóa hồ sơ khách hàng');
        loadLeads();
      }
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newPhone.trim() || !newShopName.trim()) {
      alert('Vui lòng điền đủ Họ tên, Số điện thoại và Tên shop.');
      return;
    }

    const res = await adminDataService.createTenantLead({
      full_name: newFullName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim() || undefined,
      shop_name: newShopName.trim(),
      industry: newIndustry,
      plan_type: newPlanType,
      expected_domain: newDomain.trim() || undefined,
      note: newNote.trim() || undefined,
    });

    if (res.success) {
      onShowToast?.('success', 'Đã thêm hồ sơ khách hàng mới!');
      setIsAddModalOpen(false);
      setNewFullName('');
      setNewPhone('');
      setNewEmail('');
      setNewShopName('');
      setNewDomain('');
      setNewNote('');
      loadLeads();
    } else {
      onShowToast?.('error', 'Lỗi thêm khách hàng: ' + res.message);
    }
  };

  const getIndustryBadge = (ind: string) => {
    switch (ind) {
      case 'gaming':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Gaming (0s)</span>;
      case 'fashion':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Thời Trang</span>;
      case 'beauty':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Mỹ Phẩm</span>;
      case 'tech':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Công Nghệ</span>;
      case 'services':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Dịch Vụ Số</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-300">Khác</span>;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'rental_starter':
        return <span className="text-[11px] font-semibold text-neutral-300">Khởi Nghiệp (390k)</span>;
      case 'rental_business':
        return <span className="text-[11px] font-bold text-amber-400">Chuyên Nghiệp (790k)</span>;
      case 'buyout_full':
        return <span className="text-[11px] font-black text-cyan-400">Mua Đứt (15tr)</span>;
      default:
        return <span className="text-[11px] text-neutral-400">{plan}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">Mới Đăng Ký</span>;
      case 'CONTACTED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">Đã Liên Hệ</span>;
      case 'QUALIFIED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">Tiềm Năng</span>;
      case 'CLOSED_WON':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Đã Chốt / Bàn Giao</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">Đã Hủy</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Tổng Hồ Sơ</div>
            <div className="text-xl font-black text-white mt-0.5">{stats.total}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-neutral-800 text-neutral-300 flex items-center justify-center">
            <Rocket className="w-4 h-4 text-amber-400" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">Chờ Tư Vấn</div>
            <div className="text-xl font-black text-sky-400 mt-0.5">{stats.newCount}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">Khách Tiềm Năng</div>
            <div className="text-xl font-black text-purple-400 mt-0.5">{stats.qualifiedCount}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Đã Chốt Hợp Đồng</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">{stats.wonCount}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter and Actions Bar */}
      <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên khách, SĐT, shop..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 outline-none focus:border-amber-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="NEW">Mới đăng ký</option>
            <option value="CONTACTED">Đã liên hệ</option>
            <option value="QUALIFIED">Tiềm năng</option>
            <option value="CLOSED_WON">Đã chốt / Bàn giao</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 outline-none focus:border-amber-500"
          >
            <option value="all">Tất cả gói</option>
            <option value="rental_starter">Khởi Nghiệp (390k)</option>
            <option value="rental_business">Chuyên Nghiệp (790k)</option>
            <option value="buyout_full">Mua Đứt (15tr)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Khách Hàng</span>
          </button>
        </div>
      </div>

      {/* Main Table - 100% SINGLE-SCREEN FIRST (Rule 9 Compliant) */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
        <table className="table-fixed w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-950/70 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              <th className="w-[25%] px-3 py-3">Khách Hàng & Shop</th>
              <th className="w-[23%] px-3 py-3">Ngành Hàng & Gói</th>
              <th className="w-[20%] px-3 py-3">Liên Hệ & Tên Miền</th>
              <th className="w-[17%] px-3 py-3">Trạng Thái & Thời Gian</th>
              <th className="w-[15%] px-3 py-3 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 text-xs">
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-neutral-500">
                  Không tìm thấy hồ sơ đăng ký thuê/mua web nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredLeads.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-800/30 transition-colors">
                  {/* Column 1: Khách & Shop (25%) */}
                  <td className="px-3 py-2.5 align-middle">
                    <div className="font-bold text-white truncate" title={item.full_name}>
                      {item.full_name}
                    </div>
                    <div className="text-[11px] text-amber-400 font-medium truncate" title={item.shop_name}>
                      Shop: {item.shop_name}
                    </div>
                    <div className="text-[10px] text-neutral-400 font-mono truncate" title={item.id}>
                      {item.id}
                    </div>
                  </td>

                  {/* Column 2: Ngành & Gói (23%) */}
                  <td className="px-3 py-2.5 align-middle">
                    <div className="mb-1">{getIndustryBadge(item.industry)}</div>
                    <div className="truncate" title={item.plan_type}>
                      {getPlanBadge(item.plan_type)}
                    </div>
                    {item.budget_range && (
                      <div className="text-[10px] text-neutral-400 truncate" title={`Ngân sách: ${item.budget_range}`}>
                        NS: {item.budget_range}
                      </div>
                    )}
                  </td>

                  {/* Column 3: Liên Hệ & Miền (20%) */}
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-white font-semibold truncate" title={item.phone}>
                        {item.phone}
                      </span>
                      <button
                        onClick={() => handleCopyPhone(item.phone, item.id)}
                        className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
                        title="Sao chép SĐT"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    {item.expectedDomain || item.expected_domain ? (
                      <div className="text-[11px] text-cyan-400 font-mono truncate" title={item.expectedDomain || item.expected_domain}>
                        🌐 {item.expectedDomain || item.expected_domain}
                      </div>
                    ) : (
                      <div className="text-[10px] text-neutral-400 italic">Chưa có tên miền</div>
                    )}
                    {item.email && (
                      <div className="text-[10px] text-neutral-400 truncate" title={item.email}>
                        ✉️ {item.email}
                      </div>
                    )}
                  </td>

                  {/* Column 4: Trạng Thái & Thời Gian (17%) */}
                  <td className="px-3 py-2.5 align-middle">
                    <div className="mb-1">{getStatusBadge(item.status)}</div>
                    <div className="text-[10px] text-neutral-400" title={item.created_at}>
                      {new Date(item.created_at).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    {item.admin_notes && (
                      <div className="text-[10px] text-amber-400/80 italic truncate max-w-[150px]" title={item.admin_notes}>
                        📝 {item.admin_notes}
                      </div>
                    )}
                  </td>

                  {/* Column 5: Thao Tác (15%) */}
                  <td className="px-3 py-2.5 align-middle text-right">
                    <div className="inline-flex items-center gap-1 justify-end">
                      {/* Zalo quick chat button */}
                      <a
                        href={`https://zalo.me/${item.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition-colors"
                        title="Mở Zalo nhắn tin ngay"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>

                      {/* Edit / Notes button */}
                      <button
                        onClick={() => {
                          setEditingLead(item);
                          setModalStatus(item.status);
                          setModalAdminNotes(item.admin_notes || '');
                        }}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                        title="Cập nhật trạng thái & ghi chú"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteLead(item.id, item.full_name)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                        title="Xóa hồ sơ"
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

      {/* Edit / Status Update Modal */}
      {editingLead && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl relative">
            <button
              onClick={() => setEditingLead(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Chi Tiết Hồ Sơ & Xử Lý Lead</span>
            </h3>
            <p className="text-xs text-neutral-400 mb-4 font-mono">{editingLead.id}</p>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-neutral-400 block text-[10px]">Khách hàng:</span>
                  <span className="font-bold text-white">{editingLead.full_name}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">Số điện thoại:</span>
                  <a
                    href={`tel:${editingLead.phone}`}
                    className="font-bold text-amber-400 hover:underline"
                  >
                    {editingLead.phone}
                  </a>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">Tên shop:</span>
                  <span className="font-semibold text-neutral-200">{editingLead.shop_name}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-[10px]">Gói quan tâm:</span>
                  <span className="font-semibold text-cyan-400">{editingLead.plan_type}</span>
                </div>
                {editingLead.note && (
                  <div className="col-span-2 pt-1 border-t border-neutral-800/80">
                    <span className="text-neutral-400 block text-[10px]">Yêu cầu của khách:</span>
                    <span className="text-neutral-300 italic">{editingLead.note}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Trạng Thái Xử Lý
                </label>
                <select
                  value={modalStatus}
                  onChange={(e) => setModalStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-amber-500"
                >
                  <option value="NEW">Mới Đăng Ký (Chưa gọi)</option>
                  <option value="CONTACTED">Đã Liên Hệ (Đang trao đổi qua Zalo)</option>
                  <option value="QUALIFIED">Tiềm Năng (Khách rất quan tâm, chờ chốt)</option>
                  <option value="CLOSED_WON">Đã Chốt / Bàn Giao Web Thành Công</option>
                  <option value="CANCELLED">Hủy (Khách không có nhu cầu nữa)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Ghi Chú Nội Bộ Của Quản Trị Viên
                </label>
                <textarea
                  rows={3}
                  value={modalAdminNotes}
                  onChange={(e) => setModalAdminNotes(e.target.value)}
                  placeholder="Nhập tiến độ đàm phán, thỏa thuận giá, link shop demo..."
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold"
                >
                  Lưu Cập Nhật
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Lead Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Thêm Hồ Sơ Khách Hàng Thuê / Mua Sàn</span>
            </h3>

            <form onSubmit={handleCreateLead} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Họ Tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    SĐT / Zalo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="0988xxxxxx"
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Tên Shop Dự Kiến <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newShopName}
                    onChange={(e) => setNewShopName(e.target.value)}
                    placeholder="Ví dụ: GenZ Store"
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Tên Miền (Nếu có)
                  </label>
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="shopabc.com"
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Ngành Hàng
                  </label>
                  <select
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-amber-500"
                  >
                    <option value="gaming">Gaming & Thẻ Code (0s)</option>
                    <option value="fashion">Thời Trang & Streetwear</option>
                    <option value="beauty">Mỹ Phẩm & Skincare</option>
                    <option value="tech">Công Nghệ & Phụ Kiện</option>
                    <option value="services">Dịch Vụ Số & Khóa Học</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Gói Quan Tâm
                  </label>
                  <select
                    value={newPlanType}
                    onChange={(e) => setNewPlanType(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-amber-500"
                  >
                    <option value="rental_starter">Thuê Khởi Nghiệp (390k)</option>
                    <option value="rental_business">Thuê Chuyên Nghiệp (790k)</option>
                    <option value="buyout_full">Mua Đứt Mã Nguồn (15tr)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                  Ghi Chú Nhu Cầu
                </label>
                <textarea
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Yêu cầu cụ thể của khách..."
                  className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold"
                >
                  Tạo Hồ Sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
