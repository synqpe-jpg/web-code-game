import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Search,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  ShieldCheck,
  Check,
  Layers,
  Sparkles,
  RefreshCw,
  Info,
} from 'lucide-react';
import { contentTranslationService, type ContentTranslationRecord } from '../../services/contentTranslationService';

interface TranslationsModuleProps {
  onShowToast?: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export const TranslationsModule: React.FC<TranslationsModuleProps> = ({ onShowToast }) => {
  const [translations, setTranslations] = useState<ContentTranslationRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Edit / Translate Modal state
  const [editingRecord, setEditingRecord] = useState<ContentTranslationRecord | null>(null);
  const [modalContent, setModalContent] = useState('');
  const [modalReviewer, setModalReviewer] = useState('Admin QA');
  const [modalStatus, setModalStatus] = useState<string>('approved');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = () => {
    setTranslations(contentTranslationService.getAllTranslations());
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('wcg_content_translations_updated', handleUpdate);
    return () => window.removeEventListener('wcg_content_translations_updated', handleUpdate);
  }, []);

  // Filtered translations
  const filteredList = useMemo(() => {
    return translations.filter((item) => {
      if (typeFilter !== 'all' && item.object_type !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = item.object_id?.toLowerCase().includes(q);
        const matchField = item.field?.toLowerCase().includes(q);
        const matchContent = item.content?.toLowerCase().includes(q);
        return matchId || matchField || matchContent;
      }
      return true;
    });
  }, [translations, searchQuery, typeFilter, statusFilter]);

  // KPIs
  const stats = useMemo(() => {
    const total = translations.length;
    const approved = translations.filter((t) => t.status === 'approved').length;
    const pending = translations.filter((t) => t.status === 'pending' || t.status === 'draft').length;
    const instructionCount = translations.filter((t) => t.object_type === 'instruction').length;
    return { total, approved, pending, instructionCount };
  }, [translations]);

  const handleOpenEdit = (item: ContentTranslationRecord) => {
    setEditingRecord(item);
    setModalContent(item.content || '');
    setModalReviewer(item.reviewer || 'Admin QA');
    setModalStatus(item.status || 'approved');
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    if (!modalContent.trim()) {
      onShowToast?.('warning', 'Không được để trống bản dịch tiếng Anh!');
      return;
    }

    setIsSaving(true);
    try {
      await contentTranslationService.saveTranslation({
        object_type: editingRecord.object_type,
        object_id: editingRecord.object_id,
        field: editingRecord.field,
        language: 'en',
        content: modalContent.trim(),
        reviewer: modalReviewer.trim(),
        status: modalStatus,
      });

      onShowToast?.('success', `Đã lưu bản dịch tiếng Anh cho [${editingRecord.object_id}]!`);
      setEditingRecord(null);
      loadData();
    } catch (err: any) {
      onShowToast?.('error', 'Lỗi lưu bản dịch: ' + err?.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (item: ContentTranslationRecord) => {
    if (window.confirm(`Bạn có chắc muốn xóa bản dịch tiếng Anh của [${item.object_id}]?`)) {
      contentTranslationService.deleteTranslation(item.object_type, item.object_id, item.field, item.language);
      onShowToast?.('info', 'Đã xóa bản dịch');
      loadData();
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'industry':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Ngành Hàng</span>;
      case 'product':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Sản Phẩm</span>;
      case 'instruction':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">HD Nhập Code</span>;
      case 'category':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Danh Mục</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-300">{type}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Tổng Bản Dịch D1</div>
            <div className="text-xl font-black text-white mt-0.5">{stats.total}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-neutral-800 text-neutral-300 flex items-center justify-center">
            <Globe className="w-4 h-4 text-cyan-400" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Đã Duyệt (Active)</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">{stats.approved}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Chờ Duyệt / Draft</div>
            <div className="text-xl font-black text-amber-400 mt-0.5">{stats.pending}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">HD Nhập Code Kiểm Tay</div>
            <div className="text-xl font-black text-purple-400 mt-0.5">{stats.instructionCount}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
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
              placeholder="Tìm theo ID, trường hoặc nội dung..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-white placeholder-neutral-500 outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 outline-none focus:border-amber-500"
          >
            <option value="all">Tất cả loại đối tượng</option>
            <option value="industry">Ngành hàng</option>
            <option value="product">Sản phẩm</option>
            <option value="instruction">Hướng dẫn nhập code</option>
            <option value="category">Danh mục</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 outline-none focus:border-amber-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="approved">Đã duyệt (Active)</option>
            <option value="pending">Chờ duyệt</option>
            <option value="draft">Bản nháp</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-400 italic">
            💡 Gốc Tiếng Việt (1 bản ghi) • Tiếng Anh gắn kèm
          </span>
        </div>
      </div>

      {/* Main Table - 100% SINGLE-SCREEN FIRST (Rule 9 Compliant) */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
        <table className="table-fixed w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-950/70 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              <th className="w-[22%] px-3 py-3">Đối Tượng & Trường</th>
              <th className="w-[28%] px-3 py-3">Bản Dịch Tiếng Anh (🇺🇸)</th>
              <th className="w-[28%] px-3 py-3">Ghi Chú & Người Duyệt</th>
              <th className="w-[10%] px-3 py-3">Trạng Thái</th>
              <th className="w-[12%] px-3 py-3 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 text-xs">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-neutral-500">
                  Không tìm thấy bản dịch nội dung nào phù hợp.
                </td>
              </tr>
            ) : (
              filteredList.map((item, idx) => (
                <tr key={`${item.object_type}_${item.object_id}_${item.field}_${idx}`} className="hover:bg-neutral-800/30 transition-colors">
                  {/* Column 1: Đối Tượng & Trường (22%) */}
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex items-center gap-1.5 mb-1">
                      {getTypeBadge(item.object_type)}
                    </div>
                    <div className="font-bold text-white truncate font-mono text-[11px]" title={item.object_id}>
                      {item.object_id}
                    </div>
                    <div className="text-[10px] text-amber-400 font-mono truncate" title={`Trường: ${item.field}`}>
                      Field: {item.field}
                    </div>
                  </td>

                  {/* Column 2: Bản Dịch Tiếng Anh (28%) */}
                  <td className="px-3 py-2.5 align-middle">
                    <div className="text-white text-xs truncate max-w-[280px]" title={item.content}>
                      {item.content}
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                      Lang: <span className="uppercase text-cyan-400 font-bold">{item.language}</span>
                    </div>
                  </td>

                  {/* Column 3: Người Duyệt & Thời Gian (28%) */}
                  <td className="px-3 py-2.5 align-middle">
                    <div className="text-xs text-neutral-300 truncate" title={item.reviewer || 'Chưa duyệt'}>
                      👤 {item.reviewer || 'Hệ thống'}
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate" title={item.updated_at}>
                      🕒 {new Date(item.updated_at).toLocaleDateString('vi-VN')}
                    </div>
                  </td>

                  {/* Column 4: Trạng Thái (10%) */}
                  <td className="px-3 py-2.5 align-middle">
                    {item.status === 'approved' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Đã Duyệt
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Chờ Duyệt
                      </span>
                    )}
                  </td>

                  {/* Column 5: Thao Tác (12%) */}
                  <td className="px-3 py-2.5 align-middle text-right">
                    <div className="inline-flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                        title="Sửa / Duyệt bản dịch"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                        title="Xóa bản dịch"
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

      {/* Edit / Review Translation Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl relative">
            <button
              onClick={() => setEditingRecord(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" />
              <span>Chỉnh Sửa & Phê Duyệt Bản Dịch Tiếng Anh</span>
            </h3>
            <p className="text-xs text-neutral-400 mb-4 font-mono">
              [{editingRecord.object_type}] • {editingRecord.object_id} • field: {editingRecord.field}
            </p>

            {editingRecord.object_type === 'instruction' && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs mb-3 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Lưu ý quan trọng:</strong> Hướng dẫn nhập code phải được kiểm duyệt tay chính xác tuyệt đối để người chơi nước ngoài có thể nhập giftcode thành công trong game!
                </span>
              </div>
            )}

            <form onSubmit={handleSaveModal} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Nội Dung Bản Dịch Tiếng Anh (English Content) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={modalContent}
                  onChange={(e) => setModalContent(e.target.value)}
                  placeholder="Enter verified English translation..."
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Người Kiểm Duyệt (Reviewer)
                  </label>
                  <input
                    type="text"
                    required
                    value={modalReviewer}
                    onChange={(e) => setModalReviewer(e.target.value)}
                    placeholder="Tên admin kiểm duyệt"
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                    Trạng Thái Phê Duyệt
                  </label>
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-white outline-none focus:border-amber-500"
                  >
                    <option value="approved">Đã Phê Duyệt (Hiển thị ngay)</option>
                    <option value="pending">Chờ Duyệt Thêm</option>
                    <option value="draft">Bản Nháp</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800/80">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Đang Lưu...' : 'Lưu & Phê Duyệt'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
