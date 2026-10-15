import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Flame,
  Globe,
  Save,
  Sliders,
  Smartphone,
} from 'lucide-react';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { FormModal } from '../components/ui/FormModal';
import { ImageUploadInput } from '../components/ui/ImageUploadInput';
import { adminDataService } from '../services/adminDataService';
import { GameAdminRecord } from '../types/adminTypes';

interface GamesModuleProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
  onOpenGameCodes?: (gameSlug: string) => void;
}

export const GamesModule: React.FC<GamesModuleProps> = ({ onShowToast, onOpenGameCodes }) => {
  const [games, setGames] = useState<GameAdminRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingGamesCount, setPendingGamesCount] = useState(0);

  // Edit / Create Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Partial<GameAdminRecord> | null>(null);

  // Delete Confirm Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingGame, setDeletingGame] = useState<GameAdminRecord | null>(null);

  // Bulk Delete Modal State
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  useEffect(() => {
    loadGames();

    const handleSync = () => {
      loadGames();
    };

    window.addEventListener('wcg_admin_data_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('wcg_admin_data_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [categoryFilter, statusFilter]);

  const loadGames = () => {
    setIsLoading(true);
    const filterObj: any = {};
    if (categoryFilter !== 'ALL') filterObj.category = categoryFilter;
    if (statusFilter !== 'ALL') filterObj.status = statusFilter;

    const data = adminDataService.getGames(filterObj);
    setGames(data);
    setPendingGamesCount(adminDataService.getPendingGames().length);
    setIsLoading(false);
  };

  const handleCreateNew = () => {
    setEditingGame({
      id: '',
      name: '',
      slug: '',
      publisher: '',
      category: 'Nhập Vai',
      rating: 4.8,
      icon_url: '',
      banner_url: '',
      description: '',
      short_description: '',
      instructions: 'Mở game > Cài đặt > Nhập Giftcode > Nhận quà.',
      platform: 'Android, iOS, PC',
      status: 'ACTIVE',
      release_date: new Date().toISOString().split('T')[0],
      so_giay_phep: '',
      ngay_cap_phep: '',
    });
    setIsFormOpen(true);
  };

  const handleEdit = (game: GameAdminRecord) => {
    setEditingGame({ ...game });
    setIsFormOpen(true);
  };

  const handleSaveGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame || !editingGame.name?.trim()) {
      onShowToast('Lỗi', 'Tên game không được để trống.', 'error');
      return;
    }

    try {
      if (editingGame.id && games.some((g) => g.id === editingGame.id)) {
        // Update
        const updated = adminDataService.updateGame(editingGame.id, editingGame);
        if (updated) {
          onShowToast('Thành công', `Đã cập nhật thông tin game ${updated.name}.`, 'success');
        }
      } else {
        // Create
        const created = adminDataService.createGame(editingGame as any);
        onShowToast('Thành công', `Đã thêm game mới ${created.name}.`, 'success');
      }

      setIsFormOpen(false);
      setEditingGame(null);
      loadGames();
    } catch (err: any) {
      onShowToast('Thao tác thất bại', err?.message || 'Có lỗi xảy ra', 'error');
    }
  };

  const handleDeleteConfirm = () => {
    if (!deletingGame) return;
    const ok = adminDataService.deleteGame(deletingGame.id);
    if (ok) {
      onShowToast('Đã xóa game', `Game ${deletingGame.name} đã được xóa thành công.`, 'success');
      setIsDeleteOpen(false);
      setDeletingGame(null);
      loadGames();
    } else {
      onShowToast('Lỗi', 'Không tìm thấy game cần xóa.', 'error');
    }
  };

  const handleBulkDeleteConfirm = () => {
    if (selectedIds.length === 0) return;
    const count = adminDataService.deleteGamesBulk(selectedIds);
    onShowToast('Đã xóa thành công', `Đã xóa vĩnh viễn ${count} game và toàn bộ mã giftcode liên quan.`, 'success');
    setSelectedIds([]);
    setIsBulkDeleteOpen(false);
    loadGames();
  };

  const handleBulkStatus = (status: 'ACTIVE' | 'INACTIVE' | 'HOT') => {
    let count = 0;
    selectedIds.forEach((id) => {
      if (adminDataService.updateGame(id, { status })) count++;
    });
    onShowToast('Thành công', `Đã chuyển trạng thái ${count} game sang ${status}.`, 'success');
    setSelectedIds([]);
    loadGames();
  };

  const handleExportCsv = () => {
    const csvContent = adminDataService.exportGamesToCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `danh_sach_games_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Xuất file thành công', 'File CSV danh sách game đã được tải về máy.', 'success');
  };

  // Categories list
  const categories = Array.from(new Set(games.map((g) => g.category))).filter(Boolean);

  // Table Columns
  const columns: Column<GameAdminRecord>[] = [
    {
      key: 'name',
      header: 'Tên Game & Nhà Phát Hành',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <img
            src={item.icon_url}
            alt={item.name}
            className="h-10 w-10 flex-shrink-0 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-slate-100"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/icon-192.png';
            }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 dark:text-white truncate">
                {item.name}
              </span>
              {item.status === 'HOT' && (
                <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              )}
            </div>
            <p className="text-xs text-slate-400 truncate">
              {item.publisher || 'Chưa rõ NPH'} • <span className="font-mono text-[11px]">{item.slug}</span>
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Thể Loại',
      sortable: true,
      render: (item) => (
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {item.category}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      sortable: true,
      render: (item) => <StatusBadge status={item.status} size="sm" />,
    },
    {
      key: 'platform',
      header: 'Nền Tảng / CH Play',
      render: (item) => (
        <div className="text-xs">
          <p className="text-slate-700 dark:text-slate-300">{item.platform || 'Android, iOS'}</p>
          {item.so_giay_phep ? (
            <p className="text-[10px] text-slate-400 font-mono">GP: {item.so_giay_phep}</p>
          ) : (
            <p className="text-[10px] text-emerald-500 font-mono">CH Play Global</p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <a
            href={`https://codegame.shop/game/${item.slug}`}
            target="_blank"
            rel="noreferrer"
            title="Mở xem trên Web Khách (codegame.shop)"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
          >
            <Globe className="h-4 w-4" />
          </a>
          {onOpenGameCodes && (
            <button
              onClick={() => onOpenGameCodes(item.slug)}
              title="Xem danh sách code của game này"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => handleEdit(item)}
            title="Chỉnh sửa thông tin"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setDeletingGame(item);
              setIsDeleteOpen(true);
            }}
            title="Xóa game"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Banner Game Chờ Duyệt từ Google Play */}
      {pendingGamesCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-emerald-500/40 text-xs sm:text-sm shadow-lg shadow-emerald-950/20">
          <div className="flex items-center gap-2.5 text-emerald-300 font-medium">
            <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>
              Phát hiện <strong className="text-white font-bold">{pendingGamesCount}</strong> tựa game mới từ Google Play Store VN đang chờ duyệt!
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/crawler';
            }}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <span>Duyệt Ngay Trong Crawler</span>
            <span>&rarr;</span>
          </button>
        </div>
      )}

      {/* Quick Status Bar for Catalog Display & Pagination */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 text-xs">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>
            Cơ chế phân trang trang chủ hiện tại:{' '}
            <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
              {adminDataService.getPaginationConfig().mode === 'infinite'
                ? '⚡ Cuộn vô tận (Infinite Scroll)'
                : '📄 Đánh số trang truyền thống (Classic)'}
            </strong>{' '}
            ({adminDataService.getPaginationConfig().pageSize} game/trang)
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#/content';
          }}
          className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer shrink-0"
        >
          <span>Tùy chỉnh trong CMS</span>
          <span>&rarr;</span>
        </button>
      </div>

      {/* Table & Toolbar */}
      <DataTable
        data={games}
        columns={columns}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        searchPlaceholder="Tìm theo tên game, slug, nhà phát hành..."
        searchKeys={['name', 'slug', 'publisher', 'category']}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRefresh={loadGames}
        onExportCsv={handleExportCsv}
        filters={[
          {
            key: 'category',
            label: 'Thể loại',
            selectedValue: categoryFilter,
            options: [
              { label: 'Tất cả thể loại', value: 'ALL' },
              ...categories.map((c) => ({ label: c, value: c })),
            ],
            onChange: setCategoryFilter,
          },
          {
            key: 'status',
            label: 'Trạng thái',
            selectedValue: statusFilter,
            options: [
              { label: 'Tất cả trạng thái', value: 'ALL' },
              { label: 'Hoạt động (ACTIVE)', value: 'ACTIVE' },
              { label: 'Nổi bật (HOT)', value: 'HOT' },
              { label: 'Tắt / Ẩn (INACTIVE)', value: 'INACTIVE' },
            ],
            onChange: setStatusFilter,
          },
        ]}
        actions={
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm Game Mới</span>
          </button>
        }
        batchActions={[
          {
            label: 'Kích hoạt (ACTIVE)',
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
            onClick: () => handleBulkStatus('ACTIVE'),
          },
          {
            label: 'Đặt HOT',
            icon: <Flame className="h-3.5 w-3.5 text-amber-300" />,
            onClick: () => handleBulkStatus('HOT'),
          },
          {
            label: 'Tắt hiển thị (INACTIVE)',
            icon: <XCircle className="h-3.5 w-3.5" />,
            onClick: () => handleBulkStatus('INACTIVE'),
          },
          {
            label: 'Xóa các game đã chọn',
            icon: <Trash2 className="h-3.5 w-3.5" />,
            variant: 'danger',
            onClick: () => setIsBulkDeleteOpen(true),
          },
        ]}
      />

      {/* Create / Edit Modal */}
      <FormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingGame(null);
        }}
        title={editingGame?.id ? `Chỉnh Sửa Game: ${editingGame.name}` : 'Thêm Game Mới Vào Hệ Thống'}
        subtitle="Thông tin sẽ được cập nhật trực tiếp vào cơ sở dữ liệu và hiển thị ngay cho khách hàng."
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveGame} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tên Game <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editingGame?.name || ''}
                onChange={(e) =>
                  setEditingGame((prev) => (prev ? { ...prev, name: e.target.value } : null))
                }
                placeholder="VD: Genshin Impact"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Slug (URL định danh) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editingGame?.slug || ''}
                onChange={(e) =>
                  setEditingGame((prev) => (prev ? { ...prev, slug: e.target.value } : null))
                }
                placeholder="genshin-impact"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nhà Phát Hành
              </label>
              <input
                type="text"
                value={editingGame?.publisher || ''}
                onChange={(e) =>
                  setEditingGame((prev) => (prev ? { ...prev, publisher: e.target.value } : null))
                }
                placeholder="miHoYo / VNG / Garena"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Thể Loại
              </label>
              <input
                type="text"
                value={editingGame?.category || ''}
                onChange={(e) =>
                  setEditingGame((prev) => (prev ? { ...prev, category: e.target.value } : null))
                }
                placeholder="Nhập Vai / Chiến Thuật"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Trạng Thái
              </label>
              <select
                value={editingGame?.status || 'ACTIVE'}
                onChange={(e) =>
                  setEditingGame((prev) =>
                    prev ? { ...prev, status: e.target.value as any } : null
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                <option value="HOT">Nổi bật (HOT)</option>
                <option value="INACTIVE">Tắt / Ẩn (INACTIVE)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ImageUploadInput
              label="Icon Tựa Game"
              value={editingGame?.icon_url || ''}
              onChange={(val) =>
                setEditingGame((prev) => (prev ? { ...prev, icon_url: val } : null))
              }
              helperText="Tải từ máy (tự động nén) hoặc dán link /game_icons/..."
              maxWidth={300}
              maxHeight={300}
            />

            <ImageUploadInput
              label="Banner Game (Tùy chọn)"
              value={editingGame?.banner_url || ''}
              onChange={(val) =>
                setEditingGame((prev) => (prev ? { ...prev, banner_url: val } : null))
              }
              helperText="Tải ảnh bìa rộng (tự nén dung lượng cao)."
              maxWidth={1200}
              maxHeight={600}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Package ID / Mã Ứng Dụng CH Play
              </label>
              <input
                type="text"
                value={editingGame?.so_giay_phep || ''}
                onChange={(e) =>
                  setEditingGame((prev) => (prev ? { ...prev, so_giay_phep: e.target.value } : null))
                }
                placeholder="VD: com.miHoYo.GenshinImpact"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Ngày Cấp Phép
              </label>
              <input
                type="text"
                value={editingGame?.ngay_cap_phep || ''}
                onChange={(e) =>
                  setEditingGame((prev) => (prev ? { ...prev, ngay_cap_phep: e.target.value } : null))
                }
                placeholder="VD: 15/05/2024"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Hướng Dẫn Nhập Code
            </label>
            <textarea
              rows={2}
              value={editingGame?.instructions || ''}
              onChange={(e) =>
                setEditingGame((prev) => (prev ? { ...prev, instructions: e.target.value } : null))
              }
              placeholder="Vào Avatar > Cài Đặt > Đổi Giftcode..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Mô Tả Game
            </label>
            <textarea
              rows={3}
              value={editingGame?.description || ''}
              onChange={(e) =>
                setEditingGame((prev) => (prev ? { ...prev, description: e.target.value } : null))
              }
              placeholder="Giới thiệu nội dung game..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingGame(null);
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
            >
              <Save className="h-4 w-4" />
              <span>{editingGame?.id ? 'Lưu Thay Đổi' : 'Tạo Game Mới'}</span>
            </button>
          </div>
        </form>
      </FormModal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingGame(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Xác nhận xóa game"
        message={
          <span>
            Bạn có chắc chắn muốn xóa game{' '}
            <strong className="text-rose-600 dark:text-rose-400">{deletingGame?.name}</strong> khỏi hệ thống? Thao tác này sẽ đồng thời xóa toàn bộ giftcode liên quan và không thể khôi phục.
          </span>
        }
        confirmText="Xóa vĩnh viễn"
        variant="danger"
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title="Xác nhận xóa nhiều game"
        message={
          <span>
            Bạn có chắc chắn muốn xóa <strong className="text-rose-600 dark:text-rose-400">{selectedIds.length}</strong> game đã chọn? Toàn bộ dữ liệu game và giftcode liên quan sẽ bị xóa vĩnh viễn và không thể khôi phục.
          </span>
        }
        confirmText={`Xóa ${selectedIds.length} game`}
        variant="danger"
      />
    </div>
  );
};
