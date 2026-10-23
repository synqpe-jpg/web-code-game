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
  Bot,
  Radio,
  MessageSquare,
  Check,
  X,
  Sparkles,
  Rocket,
  Gamepad2,
  FileText,
  Download,
  AlertCircle,
  Upload,
} from 'lucide-react';
import type { CrawlerSource } from '../../types/game';
import { GooglePlaySvg, AppleSvg } from '../../components/game/GameDownloadSection';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { FormModal } from '../components/ui/FormModal';
import { ImageUploadInput } from '../components/ui/ImageUploadInput';
import { adminDataService } from '../services/adminDataService';
import { GameAdminRecord } from '../types/adminTypes';
import { UpcomingGamesSection } from './UpcomingGamesSection';

/**
 * Validates Google Play Store URL
 * Format: https://play.google.com/store/apps/details?id=<package_name>
 */
export function validateGooglePlayUrl(url: string): { valid: boolean; error?: string; packageName?: string } {
  if (!url || !url.trim()) return { valid: true };
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Link CH Play phải bắt đầu bằng https://' };
    }
    if (parsed.hostname !== 'play.google.com') {
      return { valid: false, error: 'Host phải là play.google.com' };
    }
    if (!parsed.pathname.includes('/store/apps/details')) {
      return { valid: false, error: 'Đường dẫn phải chứa /store/apps/details' };
    }
    const id = parsed.searchParams.get('id');
    if (!id || !/^[a-zA-Z0-9._]+$/.test(id)) {
      return { valid: false, error: 'Thiếu tham số id=<tên_gói> hoặc tên gói không hợp lệ' };
    }
    return { valid: true, packageName: id };
  } catch {
    return { valid: false, error: 'Định dạng URL Google Play không hợp lệ' };
  }
}

/**
 * Validates Apple App Store URL
 * Format: https://apps.apple.com/vn/app/<slug>/id<numeric_id>
 */
export function validateAppStoreUrl(url: string): { valid: boolean; normalizedUrl?: string; error?: string } {
  if (!url || !url.trim()) return { valid: true };
  let trimmed = url.trim();
  if (trimmed.includes('itunes.apple.com')) {
    trimmed = trimmed.replace('itunes.apple.com', 'apps.apple.com');
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Link App Store phải bắt đầu bằng https://' };
    }
    if (parsed.hostname !== 'apps.apple.com') {
      return { valid: false, error: 'Host phải là apps.apple.com' };
    }
    if (!/\/id\d+/i.test(parsed.pathname)) {
      return { valid: false, error: 'Đường dẫn App Store phải chứa id<chữ_số> (VD: /id1517783697)' };
    }
    return { valid: true, normalizedUrl: trimmed };
  } catch {
    return { valid: false, error: 'Định dạng URL App Store không hợp lệ' };
  }
}

interface GamesModuleProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
  onOpenGameCodes?: (gameSlug: string) => void;
}

export const GamesModule: React.FC<GamesModuleProps> = ({ onShowToast, onOpenGameCodes }) => {
  const [subTab, setSubTab] = useState<'catalog' | 'upcoming'>('catalog');
  const [upcomingCount, setUpcomingCount] = useState(() => adminDataService.getUpcomingGames().length);
  const [games, setGames] = useState<GameAdminRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingGamesCount, setPendingGamesCount] = useState(0);
  const [storeLinkFilter, setStoreLinkFilter] = useState<'ALL' | 'NO_LINKS' | 'MISSING_ANDROID' | 'MISSING_IOS' | 'BOTH_LINKS'>('ALL');
  const [downloadStats, setDownloadStats] = useState<Record<string, { google_play: number; app_store: number; total: number }>>({});

  // CSV Modal State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvLog, setCsvLog] = useState<string[]>([]);
  const [isImportingCsv, setIsImportingCsv] = useState(false);

  // Form link inline errors
  const [formPlayError, setFormPlayError] = useState<string | null>(null);
  const [formIosError, setFormIosError] = useState<string | null>(null);

  // Fetch download tracking stats on mount
  useEffect(() => {
    fetch('/api/track-download')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.success && data.byGame) {
          setDownloadStats(data.byGame);
        }
      })
      .catch(() => {});
  }, []);

  // Edit / Create Form Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Partial<GameAdminRecord> | null>(null);

  // Crawler Sources State for Game
  const [gameSources, setGameSources] = useState<CrawlerSource[]>([]);
  const [originalSlug, setOriginalSlug] = useState<string>('');
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceType, setNewSourceType] = useState<'official_fb' | 'official_site' | 'reputable_web' | 'community_discord'>('official_fb');
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceDesc, setNewSourceDesc] = useState('');

  // Delete Confirm Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingGame, setDeletingGame] = useState<GameAdminRecord | null>(null);

  // Bulk Delete Modal State
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  useEffect(() => {
    loadGames();
    setUpcomingCount(adminDataService.getUpcomingGames().length);

    const handleSync = () => {
      loadGames();
      setUpcomingCount(adminDataService.getUpcomingGames().length);
    };

    window.addEventListener('wcg_admin_data_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('wcg_admin_data_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [categoryFilter, statusFilter, storeLinkFilter]);

  const loadGames = () => {
    setIsLoading(true);
    const filterObj: any = {};
    if (categoryFilter !== 'ALL') filterObj.category = categoryFilter;
    if (statusFilter !== 'ALL') filterObj.status = statusFilter;

    let data = adminDataService.getGames(filterObj);

    // Apply store links filter
    if (storeLinkFilter === 'NO_LINKS') {
      data = data.filter((g) => !(g.google_play_url || g.download_android) && !(g.app_store_url || g.download_ios));
    } else if (storeLinkFilter === 'MISSING_ANDROID') {
      data = data.filter((g) => !(g.google_play_url || g.download_android));
    } else if (storeLinkFilter === 'MISSING_IOS') {
      data = data.filter((g) => !(g.app_store_url || g.download_ios));
    } else if (storeLinkFilter === 'BOTH_LINKS') {
      data = data.filter((g) => Boolean(g.google_play_url || g.download_android) && Boolean(g.app_store_url || g.download_ios));
    }

    setGames(data);
    setPendingGamesCount(adminDataService.getPendingGames().length);
    setIsLoading(false);
  };

  const resetNewSourceForm = () => {
    setNewSourceType('official_fb');
    setNewSourceName('');
    setNewSourceUrl('');
    setNewSourceDesc('');
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
      google_play_url: '',
      app_store_url: '',
      android_package_name: '',
      download_android: '',
      download_ios: '',
      download_pc: '',
    });
    setFormPlayError(null);
    setFormIosError(null);
    setOriginalSlug('');
    setGameSources([]);
    setIsAddingSource(false);
    resetNewSourceForm();
    setIsFormOpen(true);
  };

  const handleEdit = (game: GameAdminRecord) => {
    const playUrl = game.google_play_url || game.download_android || '';
    const iosUrl = game.app_store_url || game.download_ios || '';
    let pkg = game.android_package_name || '';
    if (!pkg && playUrl) {
      const match = playUrl.match(/[?&]id=([a-zA-Z0-9._]+)/);
      if (match) pkg = match[1];
    }

    setEditingGame({
      ...game,
      google_play_url: playUrl,
      download_android: playUrl,
      app_store_url: iosUrl,
      download_ios: iosUrl,
      android_package_name: pkg,
    });
    setFormPlayError(null);
    setFormIosError(null);
    setOriginalSlug(game.slug || '');
    const currentSources = adminDataService.getGameCrawlerSources(game.slug || '');
    setGameSources(currentSources);
    setIsAddingSource(false);
    resetNewSourceForm();
    setIsFormOpen(true);
  };

  const handleAddGameSource = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) {
      onShowToast('Thiếu thông tin', 'Vui lòng nhập tên nguồn và đường dẫn URL.', 'error');
      return;
    }

    const newSrc: CrawlerSource = {
      id: `src_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newSourceName.trim(),
      type: newSourceType,
      url: newSourceUrl.trim(),
      targetGameSlug: editingGame?.slug || '',
      description: newSourceDesc.trim() || undefined,
      isEnabled: true,
    };

    setGameSources((prev) => [...prev, newSrc]);
    resetNewSourceForm();
    setIsAddingSource(false);
    onShowToast('Đã thêm nguồn', `Đã thêm "${newSrc.name}" vào danh sách nguồn quét code. Nhấn "Lưu Thay Đổi" để hoàn tất.`, 'info');
  };

  const handleToggleGameSource = (sourceId: string) => {
    setGameSources((prev) =>
      prev.map((s) => (s.id === sourceId ? { ...s, isEnabled: !s.isEnabled } : s))
    );
  };

  const handleDeleteGameSource = (sourceId: string) => {
    setGameSources((prev) => prev.filter((s) => s.id !== sourceId));
    onShowToast('Đã gỡ nguồn', 'Đã gỡ nguồn quét code khỏi danh sách.', 'info');
  };

  const applyTemplate = (type: 'official_fb' | 'official_site' | 'reputable_web') => {
    const gameName = editingGame?.name?.trim() || 'Tựa Game';
    setNewSourceType(type);
    if (type === 'official_fb') {
      setNewSourceName(`Fanpage Facebook Chính Thức - ${gameName}`);
      setNewSourceDesc(`Trang Fanpage cộng đồng chính thức cập nhật giftcode và sự kiện ${gameName}`);
    } else if (type === 'official_site') {
      setNewSourceName(`Trang Chủ & Cổng Nhập Code - ${gameName}`);
      setNewSourceDesc(`Trang chủ sự kiện và cổng quy đổi mã quà tặng chính thức của NPH`);
    } else if (type === 'reputable_web') {
      setNewSourceName(`Cẩm Nang Code Game - ${gameName}`);
      setNewSourceDesc(`Trang tin tức và hướng dẫn nhận giftcode cập nhật thường xuyên`);
    }
  };

  const handleSaveGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame || !editingGame.name?.trim()) {
      onShowToast('Lỗi', 'Tên game không được để trống.', 'error');
      return;
    }

    // Auto-generate slug if missing
    let targetSlug = editingGame.slug?.trim();
    if (!targetSlug) {
      targetSlug = editingGame.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      editingGame.slug = targetSlug;
    }

    // Validate Google Play URL
    const rawPlay = (editingGame.google_play_url || '').trim();
    const playCheck = validateGooglePlayUrl(rawPlay);
    if (!playCheck.valid) {
      setFormPlayError(playCheck.error || 'Link CH Play không đúng định dạng');
      onShowToast('Link CH Play không hợp lệ', playCheck.error, 'error');
      return;
    }
    setFormPlayError(null);

    // Validate App Store URL
    const rawIos = (editingGame.app_store_url || '').trim();
    const iosCheck = validateAppStoreUrl(rawIos);
    if (!iosCheck.valid) {
      setFormIosError(iosCheck.error || 'Link App Store không đúng định dạng');
      onShowToast('Link App Store không hợp lệ', iosCheck.error, 'error');
      return;
    }
    setFormIosError(null);

    // Synchronize fields & auto-populate package name
    editingGame.google_play_url = rawPlay;
    editingGame.download_android = rawPlay;
    editingGame.android_package_name = playCheck.packageName || '';

    const finalIos = iosCheck.normalizedUrl || rawIos;
    editingGame.app_store_url = finalIos;
    editingGame.download_ios = finalIos;

    try {
      if (editingGame.id && games.some((g) => g.id === editingGame.id)) {
        // Update
        const updated = adminDataService.updateGame(editingGame.id, editingGame);
        if (updated) {
          // Sync crawler sources
          await adminDataService.syncGameCrawlerSources(targetSlug, gameSources, originalSlug);
          onShowToast(
            'Cập nhật thành công! 🎉',
            `Đã lưu game ${updated.name} và tự động đồng bộ ${gameSources.length} nguồn quét code vào mục Crawler & Tự Động Hóa.`,
            'success'
          );
        }
      } else {
        // Create
        const created = adminDataService.createGame(editingGame as any);
        // Sync crawler sources
        await adminDataService.syncGameCrawlerSources(targetSlug, gameSources);
        onShowToast(
          'Thêm game mới thành công! 🎉',
          `Đã tạo game ${created.name} và tự động kích hoạt ${gameSources.length} nguồn quét code trong Crawler.`,
          'success'
        );
      }

      setIsFormOpen(false);
      setEditingGame(null);
      setOriginalSlug('');
      setGameSources([]);
      loadGames();
    } catch (err: any) {
      onShowToast('Thao tác thất bại', err?.message || 'Có lỗi xảy ra', 'error');
    }
  };

  const handleCsvImport = () => {
    if (!csvText.trim()) {
      onShowToast('Chưa có dữ liệu', 'Vui lòng dán nội dung CSV hoặc chọn file.', 'error');
      return;
    }

    setIsImportingCsv(true);
    const logs: string[] = [];
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    let successCount = 0;
    let failCount = 0;

    const allGames = adminDataService.getGames();
    const gameMap = new Map<string, GameAdminRecord>();
    allGames.forEach((g) => {
      if (g.slug) gameMap.set(g.slug.toLowerCase(), g);
    });

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      // Skip header line if first line
      if (index === 0 && (line.toLowerCase().startsWith('slug') || line.toLowerCase().startsWith('tên'))) {
        return;
      }

      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 2) {
        logs.push(`❌ Dòng ${lineNum}: Thiếu cột dữ liệu (cần format: slug,google_play_url,app_store_url)`);
        failCount++;
        return;
      }

      const [rowSlug, rawPlay = '', rawIos = ''] = parts;
      const game = gameMap.get(rowSlug.toLowerCase());

      if (!game) {
        logs.push(`❌ Dòng ${lineNum}: Slug "${rowSlug}" không tồn tại trong hệ thống.`);
        failCount++;
        return;
      }

      // Validate Google Play URL if present
      let playPackage = '';
      if (rawPlay) {
        const playRes = validateGooglePlayUrl(rawPlay);
        if (!playRes.valid) {
          logs.push(`❌ Dòng ${lineNum} [${rowSlug}]: Link CH Play không hợp lệ (${playRes.error})`);
          failCount++;
          return;
        }
        playPackage = playRes.packageName || '';
      }

      // Validate App Store URL if present
      let finalIos = '';
      if (rawIos) {
        const iosRes = validateAppStoreUrl(rawIos);
        if (!iosRes.valid) {
          logs.push(`❌ Dòng ${lineNum} [${rowSlug}]: Link App Store không hợp lệ (${iosRes.error})`);
          failCount++;
          return;
        }
        finalIos = iosRes.normalizedUrl || rawIos;
      }

      // Apply update
      adminDataService.updateGame(game.id, {
        google_play_url: rawPlay,
        download_android: rawPlay,
        app_store_url: finalIos,
        download_ios: finalIos,
        android_package_name: playPackage,
      });

      logs.push(`✅ Dòng ${lineNum} [${rowSlug}]: Cập nhật thành công.`);
      successCount++;
    });

    setIsImportingCsv(false);
    setCsvLog(logs);
    loadGames();

    if (successCount > 0) {
      onShowToast(
        'Nhập CSV hoàn tất 🎉',
        `Đã cập nhật ${successCount} game thành công.${failCount > 0 ? ` Có ${failCount} dòng bị lỗi.` : ''}`,
        'success'
      );
    } else {
      onShowToast('Nhập CSV thất bại', `Không có game nào được cập nhật. Vui lòng kiểm tra nhật ký lỗi.`, 'error');
    }
  };

  const handleDeleteConfirm = () => {
    if (!deletingGame) return;
    const ok = adminDataService.deleteGame(deletingGame.id);
    if (ok) {
      if (deletingGame.slug) {
        adminDataService.deleteGameCrawlerSources(deletingGame.slug);
      }
      onShowToast('Đã xóa game', `Game ${deletingGame.name} và các nguồn quét code liên quan đã được xóa thành công.`, 'success');
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
          <div className="relative h-10 w-10 flex-shrink-0 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900/10">
            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 flex items-center justify-center text-white text-xs font-bold select-none">
              {(item.name || 'G').replace(/[^\p{L}\p{N}\s]/gu, '').trim().slice(0, 2).toUpperCase() || 'GM'}
            </div>
            <img
              src={item.icon_url || `/game_icons/${item.slug}.webp`}
              alt={item.name}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                const slug = item.slug || item.id;
                if (!target.dataset.triedLocal) {
                  target.dataset.triedLocal = '1';
                  target.src = `/game_icons/${slug}.webp`;
                } else if (!target.dataset.triedProxy) {
                  target.dataset.triedProxy = '1';
                  const raw = item.icon_url && item.icon_url.startsWith('http') ? item.icon_url : '';
                  target.src = `/api/game-icon?slug=${encodeURIComponent(slug)}${raw ? `&url=${encodeURIComponent(raw)}` : ''}`;
                } else {
                  target.style.opacity = '0';
                }
              }}
            />
          </div>
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
      header: 'Store / Lượt Tải',
      render: (item) => {
        const hasPlay = Boolean(item.google_play_url || item.download_android);
        const hasIos = Boolean(item.app_store_url || item.download_ios);
        const stats = item.slug ? downloadStats[item.slug] : undefined;

        return (
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {hasPlay ? (
                <span
                  title={item.google_play_url || item.download_android}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                >
                  <GooglePlaySvg className="w-2.5 h-2.5 shrink-0" />
                  <span>CH Play</span>
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  - CH Play
                </span>
              )}

              {hasIos ? (
                <span
                  title={item.app_store_url || item.download_ios}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                >
                  <AppleSvg className="w-2.5 h-2.5 text-slate-700 dark:text-slate-300 shrink-0" />
                  <span>App Store</span>
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  - iOS
                </span>
              )}
            </div>

            {stats && stats.total > 0 ? (
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                <Download className="w-3 h-3 shrink-0" />
                <span>{stats.total} lượt tải (GP: {stats.google_play} | iOS: {stats.app_store})</span>
              </p>
            ) : item.so_giay_phep ? (
              <p className="text-[10px] text-slate-400 font-mono">GP: {item.so_giay_phep}</p>
            ) : null}
          </div>
        );
      },
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
      {/* Module Top Navigation Subtabs */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-3">
        <button
          type="button"
          onClick={() => setSubTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            subTab === 'catalog'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-card text-slate-400 hover:text-white hover:bg-card-hover border border-border'
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          <span>🎮 Danh Mục Game Sàn ({games.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('upcoming')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer relative ${
            subTab === 'upcoming'
              ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white shadow-md shadow-indigo-600/25'
              : 'bg-card text-slate-400 hover:text-white hover:bg-card-hover border border-border'
          }`}
        >
          <Rocket className="w-4 h-4 text-amber-400" />
          <span>🚀 Game Chuẩn Bị Ra Mắt & API Muse ({upcomingCount})</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
            API Live
          </span>
        </button>
      </div>

      {subTab === 'upcoming' ? (
        <UpcomingGamesSection
          onShowToast={onShowToast}
          onGameLaunched={() => {
            loadGames();
            setUpcomingCount(adminDataService.getUpcomingGames().length);
          }}
        />
      ) : (
        <>
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
          {
            key: 'storeLinks',
            label: 'Link tải store',
            selectedValue: storeLinkFilter,
            options: [
              { label: 'Tất cả link tải', value: 'ALL' },
              { label: 'Chưa có link tải', value: 'NO_LINKS' },
              { label: 'Thiếu Android', value: 'MISSING_ANDROID' },
              { label: 'Thiếu iOS', value: 'MISSING_IOS' },
              { label: 'Đủ 2 link', value: 'BOTH_LINKS' },
            ],
            onChange: (val) => setStoreLinkFilter(val as any),
          },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCsvText('');
                setCsvLog([]);
                setIsCsvModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
              title="Nhập hàng loạt link store qua file CSV (slug, google_play_url, app_store_url)"
            >
              <FileText className="h-4 w-4 text-indigo-500" />
              <span>Nhập CSV Link Tải</span>
            </button>

            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm Game Mới</span>
            </button>
          </div>
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
        maxWidth="3xl"
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

          {/* LIÊN KẾT STORE CHÍNH THỨC (CH PLAY & APP STORE) */}
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20 space-y-3.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-sm">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Liên Kết Tải Game Chính Thức (CH Play & App Store)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Tự động chuyển tiếp khách vào Store chuẩn. Bấm &quot;Mở thử&quot; để kiểm tra đường dẫn trước khi lưu.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Google Play Store Link */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <GooglePlaySvg className="w-3.5 h-3.5" />
                    <span>Link CH Play (Android)</span>
                  </span>
                  {editingGame?.google_play_url && validateGooglePlayUrl(editingGame.google_play_url).valid && (
                    <button
                      type="button"
                      onClick={() => window.open(editingGame.google_play_url, '_blank')}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Mở thử</span>
                    </button>
                  )}
                </label>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="url"
                    value={editingGame?.google_play_url || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingGame((prev) => (prev ? { ...prev, google_play_url: val } : null));
                      if (formPlayError) setFormPlayError(null);
                    }}
                    placeholder="https://play.google.com/store/apps/details?id=..."
                    className={`w-full rounded-xl border bg-white p-2.5 text-xs text-slate-900 focus:outline-none dark:bg-slate-800 dark:text-white ${
                      formPlayError
                        ? 'border-rose-500 focus:border-rose-500'
                        : 'border-slate-200 focus:border-emerald-500 dark:border-slate-700'
                    }`}
                  />
                  {editingGame?.google_play_url && (
                    <button
                      type="button"
                      disabled={!validateGooglePlayUrl(editingGame.google_play_url).valid}
                      onClick={() => window.open(editingGame.google_play_url, '_blank')}
                      className="px-2.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-all cursor-pointer"
                      title="Mở thử link CH Play"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {formPlayError ? (
                  <p className="mt-1 text-[11px] font-semibold text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{formPlayError}</span>
                  </p>
                ) : editingGame?.google_play_url && validateGooglePlayUrl(editingGame.google_play_url).packageName ? (
                  <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                    Package ID: {validateGooglePlayUrl(editingGame.google_play_url).packageName}
                  </p>
                ) : null}
              </div>

              {/* Apple App Store Link */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <AppleSvg className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
                    <span>Link App Store (iOS)</span>
                  </span>
                  {editingGame?.app_store_url && validateAppStoreUrl(editingGame.app_store_url).valid && (
                    <button
                      type="button"
                      onClick={() => window.open(editingGame.app_store_url, '_blank')}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Mở thử</span>
                    </button>
                  )}
                </label>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="url"
                    value={editingGame?.app_store_url || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingGame((prev) => (prev ? { ...prev, app_store_url: val } : null));
                      if (formIosError) setFormIosError(null);
                    }}
                    placeholder="https://apps.apple.com/vn/app/slug/id..."
                    className={`w-full rounded-xl border bg-white p-2.5 text-xs text-slate-900 focus:outline-none dark:bg-slate-800 dark:text-white ${
                      formIosError
                        ? 'border-rose-500 focus:border-rose-500'
                        : 'border-slate-200 focus:border-cyan-500 dark:border-slate-700'
                    }`}
                  />
                  {editingGame?.app_store_url && (
                    <button
                      type="button"
                      disabled={!validateAppStoreUrl(editingGame.app_store_url).valid}
                      onClick={() => window.open(editingGame.app_store_url, '_blank')}
                      className="px-2.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-all cursor-pointer"
                      title="Mở thử link App Store"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {formIosError ? (
                  <p className="mt-1 text-[11px] font-semibold text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{formIosError}</span>
                  </p>
                ) : null}
              </div>
            </div>

            {/* Click statistics for this game if available */}
            {editingGame?.slug && downloadStats[editingGame.slug] && (
              <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-4 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Tổng lượt tải:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{downloadStats[editingGame.slug].total}</strong>
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  CH Play: <strong className="text-slate-800 dark:text-slate-200">{downloadStats[editingGame.slug].google_play}</strong>
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  App Store: <strong className="text-slate-800 dark:text-slate-200">{downloadStats[editingGame.slug].app_store}</strong>
                </span>
              </div>
            )}
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

          {/* NGUỒN QUÉT CODE TỰ ĐỘNG CHO GAME (TỰ ĐỘNG THÊM VÀO CRAWLER) */}
          <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Nguồn Quét Code Tự Động (Crawler Sources)
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {gameSources.length} nguồn
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Thêm các liên kết Website, Fanpage Facebook hoặc Discord để tự động cào giftcode định kỳ. Các nguồn này sẽ tự động được đồng bộ vào mục <strong>Crawler & Tự Động Hóa Giftcode</strong>.
                  </p>
                </div>
              </div>

              {!isAddingSource && (
                <button
                  type="button"
                  onClick={() => setIsAddingSource(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all self-start sm:self-auto shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Nguồn Quét Code</span>
                </button>
              )}
            </div>

            {/* Danh sách các nguồn đã gán cho game này */}
            {gameSources.length === 0 ? (
              <div className="text-center py-6 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60">
                <Radio className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-1.5 opacity-60" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Chưa có nguồn quét code nào riêng cho tựa game này
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-0.5">
                  Bấm nút <strong>"Thêm Nguồn Quét Code"</strong> ở trên để thêm link Facebook Fanpage hoặc Website chính thức của game.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {gameSources.map((source, idx) => {
                  const isFB = source.type === 'official_fb';
                  const isSite = source.type === 'official_site';
                  const isDiscord = source.type === 'community_discord';

                  const badgeClass = isFB
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    : isSite
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : isDiscord
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800';

                  const badgeLabel = isFB
                    ? '📘 Fanpage Facebook'
                    : isSite
                    ? '🏠 Trang Chủ / Cổng Code'
                    : isDiscord
                    ? '💬 Discord Cộng Đồng'
                    : '🌐 Báo Game / Web';

                  return (
                    <div
                      key={source.id || idx}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {source.name}
                          </span>
                          {!source.isEnabled && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Tạm dừng
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-mono truncate max-w-sm sm:max-w-md"
                          >
                            <span className="truncate">{source.url}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                          </a>
                        </div>
                        {source.description && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {source.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle Active Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggleGameSource(source.id)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            source.isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                          title={source.isEnabled ? 'Đang kích hoạt (Bấm để tạm dừng)' : 'Đang tạm dừng (Bấm để kích hoạt)'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                              source.isEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>

                        {/* Delete Source Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteGameSource(source.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          title="Xóa nguồn quét này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* FORM THÊM NGUỒN MỚI (INLINE) */}
            {isAddingSource && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 shadow-md space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Thêm Nguồn Quét Code Mới</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1 hidden sm:inline">Mẫu nhanh:</span>
                    <button
                      type="button"
                      onClick={() => applyTemplate('official_fb')}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                    >
                      📘 Fanpage FB
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTemplate('official_site')}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                    >
                      🏠 Trang Chủ
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTemplate('reputable_web')}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                    >
                      🌐 Báo Game
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Loại Nguồn Quét <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newSourceType}
                      onChange={(e) => setNewSourceType(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="official_fb">📘 Facebook Fanpage Chính Thức</option>
                      <option value="official_site">🏠 Trang Chủ / Cổng Nhập Code</option>
                      <option value="reputable_web">🌐 Báo Game / Trang Web Uy Tín</option>
                      <option value="community_discord">💬 Discord Cộng Đồng</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Tên Nguồn <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                      placeholder="VD: Fanpage Facebook Chính Thức - Genshin Impact"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Đường Dẫn URL (Link Fanpage / Website) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    placeholder="VD: https://facebook.com/genshinimpact.vi hoặc https://genshin.hoyoverse.com/vi/gift"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Ghi Chú / Mô Tả (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={newSourceDesc}
                    onChange={(e) => setNewSourceDesc(e.target.value)}
                    placeholder="VD: Quét bài viết phát mã quà tặng khi livestream máy chủ mới"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingSource(false);
                      resetNewSourceForm();
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddGameSource()}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Lưu Nguồn Vào Danh Sách</span>
                  </button>
                </div>
              </div>
            )}
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

      {/* CSV Batch Store Links Import Modal */}
      <FormModal
        isOpen={isCsvModalOpen}
        onClose={() => {
          setIsCsvModalOpen(false);
          setCsvLog([]);
        }}
        title="Nhập Hàng Loạt Link Store (CSV)"
        subtitle="Cập nhật nhanh link tải Google Play & App Store cho danh sách game bằng file CSV."
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
              <FileText className="w-4 h-4" />
              <span>Quy cách định dạng CSV (3 cột, phân tách bằng dấu phẩy):</span>
            </p>
            <p className="font-mono text-[11px] bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 select-all">
              slug,google_play_url,app_store_url
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Ví dụ: <code className="text-slate-800 dark:text-slate-200">genshin-impact,https://play.google.com/store/apps/details?id=com.miHoYo.GenshinImpact,https://apps.apple.com/vn/app/genshin-impact/id1517783697</code>
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
              * Khớp theo slug chính xác. Dòng nào slug không tồn tại hoặc link sai định dạng sẽ được ghi vào nhật ký lỗi và bỏ qua, không dừng cả file.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nội dung CSV
              </label>
              <label className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                <Upload className="w-3 h-3" />
                <span>Chọn file .csv</span>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = String(event.target?.result || '');
                        setCsvText(content);
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
            </div>
            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Dán nội dung CSV vào đây (mỗi game 1 dòng)&#10;genshin-impact,https://play.google.com/store/apps/details?id=com.miHoYo.GenshinImpact,https://apps.apple.com/vn/app/genshin-impact/id1517783697&#10;super-sus,https://play.google.com/store/apps/details?id=com.je.supersus,"
              className="w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Log kết quả */}
          {csvLog.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono max-h-48 overflow-y-auto space-y-1">
              <p className="font-bold text-white border-b border-slate-700 pb-1 mb-1">
                Nhật ký xử lý:
              </p>
              {csvLog.map((log, idx) => (
                <div key={idx} className={log.startsWith('❌') ? 'text-rose-400' : 'text-emerald-400'}>
                  {log}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsCsvModalOpen(false);
                setCsvLog([]);
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={isImportingCsv || !csvText.trim()}
              onClick={handleCsvImport}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="h-4 w-4" />
              <span>{isImportingCsv ? 'Đang xử lý...' : 'Thực Hiện Cập Nhật'}</span>
            </button>
          </div>
        </div>
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
        </>
      )}
    </div>
  );
};
