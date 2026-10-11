import React, { useState, useEffect, useMemo } from 'react';
import {
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
  Plus,
  Trash2,
  Edit,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Copy,
  Globe,
  MessageSquare,
  Sliders,
  CheckCheck,
  Layers,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
} from 'lucide-react';
import { FormModal } from '../components/ui/FormModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { SearchableGameSelect } from '../components/ui/SearchableGameSelect';
import { adminDataService } from '../services/adminDataService';
import { GameAdminRecord } from '../types/adminTypes';
import defaultSources from '../../data/crawler_sources.json';

interface PendingCrawlerCode {
  id: string;
  gameId: string;
  gameSlug: string;
  gameName: string;
  code: string;
  rewards: string;
  sourceUrl?: string;
  sourceType: string;
  sourceName?: string;
  score: number;
  tier: number;
  tierLabel: string;
  reasons: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  expiresAt?: string;
  createdAt: string;
}

interface CrawlerSource {
  id: string;
  name: string;
  type: 'reputable_web' | 'official_fb' | 'community_discord' | 'official_site';
  url: string;
  targetGameSlug?: string;
  isEnabled: boolean;
  description?: string;
}

interface CrawlerLog {
  id: string;
  timestamp: string;
  sourcesCount: number;
  codesScanned: number;
  duplicatesCount: number;
  autoApprovedCount: number;
  pendingAddedCount: number;
  summary: string;
  autoCodes?: string[];
}

interface CrawlerModuleProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
}

export const CrawlerModule: React.FC<CrawlerModuleProps> = ({ onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'sources' | 'logs' | 'scoring'>('pending');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingCodes, setPendingCodes] = useState<PendingCrawlerCode[]>([]);
  const [sources, setSources] = useState<CrawlerSource[]>([]);
  const [logs, setLogs] = useState<CrawlerLog[]>([]);
  const [games, setGames] = useState<GameAdminRecord[]>([]);

  // Search & Filters (Pending Codes)
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'TIER_2' | 'TIER_3' | 'TIER_4'>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Source Search, Filter & Pagination (Scale up to 1,000+ sources)
  const [sourceSearch, setSourceSearch] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'ALL' | 'reputable_web' | 'official_fb' | 'community_discord' | 'official_site'>('ALL');
  const [sourceStatusFilter, setSourceStatusFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
  const [sourcePage, setSourcePage] = useState(1);
  const sourcesPerPage = 18;

  // Modal States
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<PendingCrawlerCode | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);

  // Form State for New Source
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceType, setNewSourceType] = useState<'reputable_web' | 'official_fb' | 'community_discord' | 'official_site'>('reputable_web');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceGameSlug, setNewSourceGameSlug] = useState('');
  const [newSourceDesc, setNewSourceDesc] = useState('');

  // Form State for Edit & Approve Code
  const [editCodeValue, setEditCodeValue] = useState('');
  const [editGameSlug, setEditGameSlug] = useState('');
  const [editRewards, setEditRewards] = useState('');
  const [editExpiresAt, setEditExpiresAt] = useState('2026-12-31');

  const getSyncHeaders = () => {
    const token = localStorage.getItem('wcg_admin_token') || sessionStorage.getItem('wcg_admin_token') || '';
    const syncKey = localStorage.getItem('wcg_admin_sync_key') || sessionStorage.getItem('wcg_admin_sync_key') || 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Sync-Key': syncKey,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Load games from admin data service
      const localGames = adminDataService.getGames();
      setGames(localGames);

      // 2. Fetch authoritative crawler data from D1 server
      const res = await fetch('/api/sync?fresh=true', {
        headers: getSyncHeaders(),
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          if (Array.isArray(data.crawlerPendingCodes)) {
            setPendingCodes(data.crawlerPendingCodes);
          }
          if (Array.isArray(data.crawlerSources) && data.crawlerSources.length >= (defaultSources as CrawlerSource[]).length) {
            setSources(data.crawlerSources);
          } else {
            const d1Map = new Map(((data.crawlerSources || []) as CrawlerSource[]).map((s) => [s.id, s]));
            const merged = (defaultSources as CrawlerSource[]).map((ds) => (d1Map.has(ds.id) ? { ...ds, ...d1Map.get(ds.id) } : ds));
            setSources(merged);
          }
          if (Array.isArray(data.crawlerLogs)) {
            setLogs(data.crawlerLogs);
          }
        }
      } else {
        // Fallback to local default sources
        setSources(defaultSources as CrawlerSource[]);
      }
    } catch (e: any) {
      console.warn('[CrawlerModule] Tải dữ liệu thất bại, sử dụng fallback', e);
      setSources(defaultSources as CrawlerSource[]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Pending Codes
  const filteredCodes = useMemo(() => {
    return pendingCodes.filter((item) => {
      // Tier filter
      if (tierFilter === 'TIER_2' && item.tier !== 2) return false;
      if (tierFilter === 'TIER_3' && item.tier !== 3) return false;
      if (tierFilter === 'TIER_4' && item.tier !== 4) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = item.code.toLowerCase().includes(q);
        const matchGame = item.gameName.toLowerCase().includes(q);
        const matchRewards = (item.rewards || '').toLowerCase().includes(q);
        return matchCode || matchGame || matchRewards;
      }
      return true;
    });
  }, [pendingCodes, tierFilter, searchQuery]);

  // Filtered & Paginated Sources (Scale gracefully to 1,000+ sources)
  const filteredSources = useMemo(() => {
    return sources.filter((s) => {
      if (sourceTypeFilter !== 'ALL' && s.type !== sourceTypeFilter) return false;
      if (sourceStatusFilter === 'ENABLED' && !s.isEnabled) return false;
      if (sourceStatusFilter === 'DISABLED' && s.isEnabled) return false;
      if (sourceSearch.trim()) {
        const q = sourceSearch.toLowerCase();
        const matchedGame = games.find((g) => g.slug === s.targetGameSlug);
        const matchName = s.name.toLowerCase().includes(q);
        const matchUrl = s.url.toLowerCase().includes(q);
        const matchGame = matchedGame ? matchedGame.name.toLowerCase().includes(q) : false;
        return matchName || matchUrl || matchGame;
      }
      return true;
    });
  }, [sources, sourceTypeFilter, sourceStatusFilter, sourceSearch, games]);

  useEffect(() => {
    setSourcePage(1);
  }, [sourceSearch, sourceTypeFilter, sourceStatusFilter]);

  const totalSourcePages = Math.max(1, Math.ceil(filteredSources.length / sourcesPerPage));
  const paginatedSources = useMemo(() => {
    const start = (sourcePage - 1) * sourcesPerPage;
    return filteredSources.slice(start, start + sourcesPerPage);
  }, [filteredSources, sourcePage, sourcesPerPage]);

  const handleToggleAllFilteredSources = async (enable: boolean) => {
    const targetIds = new Set(filteredSources.map((s) => s.id));
    const updated = sources.map((s) => (targetIds.has(s.id) ? { ...s, isEnabled: enable } : s));
    setSources(updated);
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: getSyncHeaders(),
        body: JSON.stringify({ crawlerSources: updated }),
      });
      onShowToast('Cập nhật hàng loạt', `Đã ${enable ? 'bật' : 'tắt'} ${targetIds.size} nguồn thành công.`, 'success');
    } catch {
      onShowToast('Lỗi lưu', 'Không thể lưu thay đổi.', 'error');
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const totalPending = pendingCodes.length;
    const tier2Count = pendingCodes.filter((c) => c.tier === 2).length;
    const tier3Count = pendingCodes.filter((c) => c.tier === 3).length;
    const tier4Count = pendingCodes.filter((c) => c.tier === 4).length;
    const activeSources = sources.filter((s) => s.isEnabled).length;
    return {
      totalPending,
      tier2Count,
      tier3Count,
      tier4Count,
      activeSources,
      totalSources: sources.length,
    };
  }, [pendingCodes, sources]);

  // 1-Click Approve
  const handleApprove = async (id: string) => {
    const codeItem = pendingCodes.find((p) => p.id === id);
    if (!codeItem) return;

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: getSyncHeaders(),
        body: JSON.stringify({
          action: 'approve_crawler_code',
          pendingId: id,
        }),
      });

      const result = await res.json();
      if (result && result.success) {
        onShowToast(
          'Đã duyệt thành công! 🚀',
          `Mã "${codeItem.code}" đã được kích hoạt ngay lập tức cho game ${codeItem.gameName}.`,
          'success'
        );
        setPendingCodes((prev) => prev.filter((p) => p.id !== id));
        setSelectedIds((prev) => prev.filter((i) => i !== id));
      } else {
        onShowToast('Lỗi duyệt mã', result?.error || 'Không thể duyệt mã.', 'error');
      }
    } catch (e: any) {
      onShowToast('Lỗi kết nối', e?.message || 'Không thể kết nối đến máy chủ.', 'error');
    }
  };

  // Reject / Delete
  const handleReject = async (id: string) => {
    const codeItem = pendingCodes.find((p) => p.id === id);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: getSyncHeaders(),
        body: JSON.stringify({
          action: 'reject_crawler_code',
          pendingId: id,
        }),
      });

      const result = await res.json();
      if (result && result.success) {
        onShowToast('Đã loại bỏ', `Đã xóa mã "${codeItem?.code}" khỏi hàng chờ duyệt.`, 'info');
        setPendingCodes((prev) => prev.filter((p) => p.id !== id));
        setSelectedIds((prev) => prev.filter((i) => i !== id));
      } else {
        onShowToast('Lỗi từ chối', result?.error || 'Thao tác thất bại.', 'error');
      }
    } catch (e: any) {
      onShowToast('Lỗi kết nối', e?.message || 'Không thể kết nối đến máy chủ.', 'error');
    }
  };

  // Bulk Approve
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: getSyncHeaders(),
        body: JSON.stringify({
          action: 'batch_approve_crawler_codes',
          pendingIds: selectedIds,
        }),
      });

      const result = await res.json();
      if (result && result.success) {
        onShowToast(
          'Duyệt hàng loạt thành công! 🎉',
          `Đã kích hoạt ${result.approvedCount} mã quà tặng lên hệ thống.`,
          'success'
        );
        setPendingCodes((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
        setSelectedIds([]);
      } else {
        onShowToast('Lỗi', result?.error || 'Thao tác hàng loạt thất bại.', 'error');
      }
    } catch (e: any) {
      onShowToast('Lỗi kết nối', e?.message || 'Không thể kết nối đến máy chủ.', 'error');
    }
  };

  // Bulk Reject
  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: getSyncHeaders(),
        body: JSON.stringify({
          action: 'batch_reject_crawler_codes',
          pendingIds: selectedIds,
        }),
      });

      const result = await res.json();
      if (result && result.success) {
        onShowToast('Đã loại bỏ', `Đã xóa ${selectedIds.length} mã khỏi hàng chờ.`, 'info');
        setPendingCodes((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
        setSelectedIds([]);
      } else {
        onShowToast('Lỗi', result?.error || 'Thao tác thất bại.', 'error');
      }
    } catch (e: any) {
      onShowToast('Lỗi kết nối', e?.message || 'Không thể kết nối đến máy chủ.', 'error');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (item: PendingCrawlerCode) => {
    setEditingCode(item);
    setEditCodeValue(item.code);
    setEditGameSlug(item.gameSlug);
    setEditRewards(item.rewards);
    setEditExpiresAt(item.expiresAt || '2026-12-31');
  };

  // Submit Edit & Approve
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCode) return;

    const matchedGame = games.find((g) => g.slug === editGameSlug);

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: getSyncHeaders(),
        body: JSON.stringify({
          action: 'approve_crawler_code',
          pendingId: editingCode.id,
          editedCode: {
            code: editCodeValue.trim().toUpperCase(),
            gameSlug: editGameSlug,
            gameId: matchedGame?.id || editGameSlug,
            gameName: matchedGame?.name || editingCode.gameName,
            rewards: editRewards,
            expiresAt: editExpiresAt,
          },
        }),
      });

      const result = await res.json();
      if (result && result.success) {
        onShowToast('Đã lưu & duyệt thành công! ✨', `Mã "${editCodeValue}" đã được kích hoạt.`, 'success');
        setPendingCodes((prev) => prev.filter((p) => p.id !== editingCode.id));
        setEditingCode(null);
      } else {
        onShowToast('Lỗi cập nhật', result?.error || 'Không thể lưu mã.', 'error');
      }
    } catch (e: any) {
      onShowToast('Lỗi kết nối', e?.message, 'error');
    }
  };

  // Toggle Source On/Off
  const handleToggleSource = async (sourceId: string) => {
    const updated = sources.map((s) => (s.id === sourceId ? { ...s, isEnabled: !s.isEnabled } : s));
    setSources(updated);
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: getSyncHeaders(),
        body: JSON.stringify({ crawlerSources: updated }),
      });
      onShowToast('Cập nhật trạng thái nguồn', 'Đã lưu cấu hình nguồn cào.', 'success');
    } catch {
      onShowToast('Lỗi lưu', 'Không thể lưu trạng thái nguồn.', 'error');
    }
  };

  // Add New Source
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;

    const newSource: CrawlerSource = {
      id: `src_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newSourceName.trim(),
      type: newSourceType,
      url: newSourceUrl.trim(),
      targetGameSlug: newSourceGameSlug || undefined,
      description: newSourceDesc.trim() || undefined,
      isEnabled: true,
    };

    const updated = [newSource, ...sources];
    setSources(updated);

    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: getSyncHeaders(),
        body: JSON.stringify({ crawlerSources: updated }),
      });
      onShowToast('Thêm nguồn thành công! 📡', `Nguồn "${newSource.name}" đã sẵn sàng cho đợt quét tới.`, 'success');
      setIsAddSourceOpen(false);
      setNewSourceName('');
      setNewSourceUrl('');
      setNewSourceGameSlug('');
      setNewSourceDesc('');
    } catch {
      onShowToast('Lỗi lưu nguồn', 'Không thể lưu nguồn vào hệ thống.', 'error');
    }
  };

  // Delete Source
  const handleDeleteSource = async (sourceId: string) => {
    const updated = sources.filter((s) => s.id !== sourceId);
    setSources(updated);
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: getSyncHeaders(),
        body: JSON.stringify({ crawlerSources: updated }),
      });
      onShowToast('Đã xóa nguồn', 'Đã gỡ bỏ nguồn cào thành công.', 'info');
      setDeletingSourceId(null);
    } catch {
      onShowToast('Lỗi xóa nguồn', 'Không thể xóa nguồn.', 'error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    onShowToast('Đã sao chép mã', text, 'info');
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'official_fb':
        return (
          <svg className="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        );
      case 'community_discord':
        return <MessageSquare className="w-4 h-4 text-indigo-400" />;
      case 'official_site':
        return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
      case 'reputable_web':
      default:
        return <Globe className="w-4 h-4 text-amber-500" />;
    }
  };

  const getTierBadge = (tier: number, score: number) => {
    if (tier === 1 || score >= 90) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          Bậc 1: {score}đ (Tự động đăng)
        </span>
      );
    }
    if (tier === 2 || score >= 70) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
          <CheckCircle2 className="w-3 h-3 text-sky-400" />
          Bậc 2: {score}đ (Tiềm năng cao)
        </span>
      );
    }
    if (tier === 3 || score >= 50) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          Bậc 3: {score}đ (Cần kiểm tra)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
        <XCircle className="w-3 h-3 text-rose-400" />
        Bậc 4: {score}đ (Rủi ro thấp)
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/20 to-slate-900/60 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-lg shadow-indigo-500/10">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white">Quản Lý Crawler & Tự Động Hóa Giftcode</h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  GitHub Actions 24/7 Free
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                Tự động cào đa kênh (Web, Discord, Facebook) đối chiếu 486 game, chấm điểm 4 cấp bậc.
                Mã <span className="text-emerald-400 font-semibold">90-100đ</span> tự động lên web; mã dưới 90đ lưu vào hàng chờ để Admin duyệt 1-chạm.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 font-medium text-sm flex items-center gap-2 transition-all shadow-sm active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
              Làm mới dữ liệu
            </button>
            <button
              onClick={() => setIsAddSourceOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Thêm Nguồn Cào
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="text-xs text-slate-400">Hàng Chờ Duyệt</div>
            <div className="text-xl font-bold text-amber-400 mt-1 flex items-center gap-1.5">
              {stats.totalPending} mã
              {stats.totalPending > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  Cần xử lý
                </span>
              )}
            </div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="text-xs text-slate-400">Bậc 2 (70-89đ)</div>
            <div className="text-xl font-bold text-sky-400 mt-1">{stats.tier2Count} mã</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="text-xs text-slate-400">Nguồn Đang Bật</div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {stats.activeSources} / {stats.totalSources}
            </div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="text-xs text-slate-400">Lịch Quét Tự Động</div>
            <div className="text-xl font-bold text-purple-400 mt-1">Mỗi 2 tiếng</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${
            activeTab === 'pending'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          Hàng Chờ Duyệt
          {stats.totalPending > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950">
              {stats.totalPending}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('sources')}
          className={`px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${
            activeTab === 'sources'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Nguồn Thu Thập ({sources.length})
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${
            activeTab === 'logs'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          Nhật Ký Quét ({logs.length})
        </button>

        <button
          onClick={() => setActiveTab('scoring')}
          className={`px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all ${
            activeTab === 'scoring'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          Quy Chuẩn 4 Cấp Bậc
        </button>
      </div>

      {/* TAB 1: PENDING CODES MODERATION */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {/* Action & Filter Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo mã code, tên game, phần thưởng..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                />
              </div>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Tất cả cấp bậc</option>
                <option value="TIER_2">Bậc 2 (70-89đ) - Tiềm năng</option>
                <option value="TIER_3">Bậc 3 (50-69đ) - Cần check</option>
                <option value="TIER_4">Bậc 4 (&lt;50đ) - Thấp</option>
              </select>
            </div>

            {/* Bulk Action Controls */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-indigo-950/40 border border-indigo-500/30 px-3 py-1.5 rounded-xl">
                <span className="text-xs text-indigo-300 font-medium">Đã chọn {selectedIds.length} mã:</span>
                <button
                  onClick={handleBulkApprove}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Duyệt hàng loạt
                </button>
                <button
                  onClick={handleBulkReject}
                  className="px-3 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa hàng loạt
                </button>
              </div>
            )}
          </div>

          {/* Table of Pending Codes */}
          {filteredCodes.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-white">Hàng Chờ Đang Trống</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto mt-1">
                Toàn bộ giftcode có độ tin cậy cao (90-100đ) đã được bot tự động phê duyệt và đăng lên website.
                Các mã cào mới sẽ xuất hiện ở đây khi đợt quét định kỳ tiếp theo diễn ra.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.length > 0 && selectedIds.length === filteredCodes.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(filteredCodes.map((c) => c.id));
                            else setSelectedIds([]);
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="p-4">Đánh Giá & Điểm</th>
                      <th className="p-4">Mã Giftcode</th>
                      <th className="p-4">Tựa Game</th>
                      <th className="p-4">Phần Thưởng & HSD</th>
                      <th className="p-4">Nguồn Cào</th>
                      <th className="p-4 text-right">Thao Tác Duyệt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredCodes.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds((prev) => [...prev, item.id]);
                              else setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                            }}
                            className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            {getTierBadge(item.tier, item.score)}
                            <div className="text-[11px] text-slate-400 line-clamp-1" title={item.reasons?.join(', ')}>
                              {item.reasons?.[0]}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-300 text-base bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/20">
                              {item.code}
                            </span>
                            <button
                              onClick={() => copyToClipboard(item.code)}
                              className="text-slate-500 hover:text-slate-300 transition-colors"
                              title="Sao chép mã"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="p-4 font-medium text-white">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-xs text-indigo-300 border border-slate-700">
                              {item.gameName}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-slate-300 max-w-xs truncate">{item.rewards}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            HSD: {item.expiresAt || 'Không giới hạn'}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            {getSourceIcon(item.sourceType)}
                            <span className="truncate max-w-[120px]">{item.sourceName || item.sourceType}</span>
                            {item.sourceUrl && (
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-500 hover:text-indigo-400"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApprove(item.id)}
                              className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-all shadow-sm active:scale-95"
                              title="Duyệt & Đăng ngay (1-Chạm)"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-all shadow-sm active:scale-95"
                              title="Chỉnh sửa & Duyệt"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(item.id)}
                              className="p-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white transition-all shadow-sm active:scale-95"
                              title="Từ chối / Loại bỏ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CRAWLER SOURCES MANAGER */}
      {activeTab === 'sources' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">Danh Mục Nguồn Cào Giftcode Tự Động</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Quản lý thư viện nguồn thu thập giftcode ({sources.length} nguồn). Bot GitHub Actions sẽ tự động nạp và cào dữ liệu định kỳ.
              </p>
            </div>
            <button
              onClick={() => setIsAddSourceOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center gap-2 transition-all self-start md:self-auto shadow-lg shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              Thêm Nguồn Mới
            </button>
          </div>

          {/* Search, Filter & Bulk Actions Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm nguồn theo tên, URL hoặc tựa game..."
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                {sourceSearch && (
                  <button
                    onClick={() => setSourceSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={sourceTypeFilter}
                  onChange={(e) => setSourceTypeFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="ALL">Tất cả loại nguồn</option>
                  <option value="reputable_web">🌐 Báo & Web Game</option>
                  <option value="official_site">🏢 Trang Chủ NPH</option>
                  <option value="official_fb">📘 Fanpage / Group FB</option>
                  <option value="community_discord">💬 Discord Server</option>
                </select>

                <select
                  value={sourceStatusFilter}
                  onChange={(e) => setSourceStatusFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ENABLED">🟢 Đang quét ({sources.filter((s) => s.isEnabled).length})</option>
                  <option value="DISABLED">⚪ Tạm ngưng ({sources.filter((s) => !s.isEnabled).length})</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
              <span className="text-xs text-slate-400 font-medium">
                Khớp: <strong className="text-white">{filteredSources.length}</strong> / {sources.length} nguồn
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleToggleAllFilteredSources(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium border border-emerald-500/20 transition-colors"
                  title="Bật tất cả nguồn trong danh sách lọc"
                >
                  Bật tất cả
                </button>
                <button
                  onClick={() => handleToggleAllFilteredSources(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
                  title="Tắt tất cả nguồn trong danh sách lọc"
                >
                  Tắt tất cả
                </button>
              </div>
            </div>
          </div>

          {/* Sources Grid or Empty State */}
          {paginatedSources.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
              <Globe className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">Không tìm thấy nguồn phù hợp</h3>
              <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
                Không có nguồn nào khớp với điều kiện lọc hiện tại. Thử xóa từ khóa tìm kiếm hoặc đổi bộ lọc.
              </p>
              {(sourceSearch || sourceTypeFilter !== 'ALL' || sourceStatusFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSourceSearch('');
                    setSourceTypeFilter('ALL');
                    setSourceStatusFilter('ALL');
                  }}
                  className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedSources.map((src) => {
                const matchedGame = games.find((g) => g.slug === src.targetGameSlug);
                return (
                  <div
                    key={src.id}
                    className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                      src.isEnabled ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/40 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
                            {getSourceIcon(src.type)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-white text-sm truncate" title={src.name}>
                              {src.name}
                            </h3>
                            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-mono">
                              {src.type}
                            </span>
                          </div>
                        </div>

                        {/* On/Off Switch */}
                        <button
                          onClick={() => handleToggleSource(src.id)}
                          className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                            src.isEnabled ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
                          }`}
                          title={src.isEnabled ? 'Nguồn đang bật' : 'Nguồn đang tắt'}
                        >
                          <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                        </button>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="text-xs text-slate-300">
                          <span className="text-slate-500">Mục tiêu: </span>
                          {matchedGame ? (
                            <span className="font-semibold text-indigo-400">{matchedGame.name}</span>
                          ) : (
                            <span className="text-slate-400 italic">Tự động nhận diện tựa game</span>
                          )}
                        </div>

                        {src.description && (
                          <p className="text-xs text-slate-400 line-clamp-1 italic" title={src.description}>
                            {src.description}
                          </p>
                        )}

                        <div className="text-xs text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono truncate">
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-indigo-400 flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{src.url}</span>
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                      <span>Trạng thái: {src.isEnabled ? '🟢 Đang quét' : '⚪ Tạm ngưng'}</span>
                      <button
                        onClick={() => setDeletingSourceId(src.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 transition-colors"
                        title="Xóa nguồn này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalSourcePages > 1 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Hiển thị trang <strong className="text-white">{sourcePage}</strong> / {totalSourcePages} (
                {(sourcePage - 1) * sourcesPerPage + 1} -{' '}
                {Math.min(sourcePage * sourcesPerPage, filteredSources.length)} trên {filteredSources.length} nguồn)
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSourcePage(1)}
                  disabled={sourcePage === 1}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  Đầu
                </button>
                <button
                  onClick={() => setSourcePage((p) => Math.max(1, p - 1))}
                  disabled={sourcePage === 1}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalSourcePages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalSourcePages || Math.abs(p - sourcePage) <= 2)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span className="text-slate-600 px-1 text-xs">...</span>}
                        <button
                          onClick={() => setSourcePage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                            sourcePage === p
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  onClick={() => setSourcePage((p) => Math.min(totalSourcePages, p + 1))}
                  disabled={sourcePage === totalSourcePages}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title="Trang sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSourcePage(totalSourcePages)}
                  disabled={sourcePage === totalSourcePages}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  Cuối
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LOGS & HISTORY */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Nhật Ký Quét & Đồng Bộ Định Kỳ</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Ghi nhận chi tiết kết quả từng phiên chạy của crawler (nguồn cào, số lượng mã, kết quả phân loại).
              </p>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tải lại log
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
              Chưa có bản ghi nhật ký nào. Nhật ký sẽ tự động xuất hiện sau phiên quét đầu tiên của GitHub Actions hoặc lệnh node cục bộ.
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span className="font-semibold text-white text-sm">
                        Phiên quét: {new Date(log.timestamp).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {log.sourcesCount} nguồn đã quét
                    </span>
                  </div>

                  <p className="text-sm text-slate-300">{log.summary}</p>

                  <div className="flex flex-wrap gap-2 text-xs pt-1">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      🚀 {log.autoApprovedCount} mã tự động đăng (Bậc 1: 90-100đ)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                      ⏳ {log.pendingAddedCount} mã vào hàng chờ duyệt
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                      🛡️ {log.duplicatesCount} mã trùng lặp bỏ qua
                    </span>
                  </div>

                  {Array.isArray(log.autoCodes) && log.autoCodes.length > 0 && (
                    <div className="mt-2 text-xs text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono space-y-1">
                      <div className="text-slate-500 font-sans font-medium text-[11px]">Danh sách mã Bậc 1 vừa đăng tự động:</div>
                      {log.autoCodes.map((c, i) => (
                        <div key={i} className="text-emerald-400 truncate">✔ {c}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SCORING EXPLANATION */}
      {activeTab === 'scoring' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tier 1 */}
            <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Bậc 1: Tuyệt Đối Tin Cậy (90 - 100 Điểm)</h3>
                  <span className="text-xs text-emerald-400 font-semibold">Tự Động Đăng Ngay Lên Web (Không Cần Duyệt)</span>
                </div>
              </div>
              <p className="text-slate-300 text-xs mt-3 leading-relaxed">
                Áp dụng cho các mã từ nguồn NPH chính thức (Fanpage tích xanh, trang chủ) hoặc chuyên trang lớn uy tín.
                Khớp chính xác tên tựa game trong kho 486 game, định dạng mã chuẩn in hoa (5-24 ký tự) và có thông tin phần thưởng/hạn dùng rõ ràng.
              </p>
            </div>

            {/* Tier 2 */}
            <div className="bg-gradient-to-br from-sky-950/40 to-slate-900 border border-sky-500/30 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Bậc 2: Tiềm Năng Cao (70 - 89 Điểm)</h3>
                  <span className="text-xs text-sky-400 font-semibold">Lưu Vào Hàng Chờ & Đề Xuất Duyệt 1-Chạm</span>
                </div>
              </div>
              <p className="text-slate-300 text-xs mt-3 leading-relaxed">
                Mã khớp từ khóa game theo alias hoặc trích xuất từ diễn đàn game/Discord cộng đồng.
                Định dạng mã hợp lệ nhưng thiếu một phần mô tả chi tiết phần thưởng hoặc hạn dùng.
                Admin chỉ cần ấn 1 nút là mã lập tức lên sóng.
              </p>
            </div>

            {/* Tier 3 */}
            <div className="bg-gradient-to-br from-amber-950/40 to-slate-900 border border-amber-500/30 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Bậc 3: Cần Kiểm Tra (50 - 69 Điểm)</h3>
                  <span className="text-xs text-amber-400 font-semibold">Cần Xem Lại Trước Khi Duyệt</span>
                </div>
              </div>
              <p className="text-slate-300 text-xs mt-3 leading-relaxed">
                Mã trích xuất từ các bài tổng hợp chung, độ khớp tên game ở mức trung bình hoặc định dạng ký tự có lẫn chữ thường.
                Khuyến nghị Admin kiểm tra kỹ tên game và phần thưởng trước khi phê duyệt.
              </p>
            </div>

            {/* Tier 4 */}
            <div className="bg-gradient-to-br from-rose-950/40 to-slate-900 border border-rose-500/30 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Bậc 4: Rủi Ro / Điểm Thấp (Dưới 50 Điểm)</h3>
                  <span className="text-xs text-rose-400 font-semibold">Tự Động Bỏ Qua / Gắn Cờ Spam</span>
                </div>
              </div>
              <p className="text-slate-300 text-xs mt-3 leading-relaxed">
                Mã chứa từ khóa rác, link liên kết, mã trùng lặp hoàn toàn với kho hiện tại, hoặc độ dài bất thường (&lt;4 hoặc &gt;32 ký tự).
                Hệ thống tự động loại bỏ để không làm đầy hàng chờ của Admin.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Thêm Nguồn Cào Mới */}
      <FormModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        title="Thêm Nguồn Cào Giftcode Mới"
      >
        <form onSubmit={handleAddSource} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Tên Nguồn <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              placeholder="VD: CodeMoi - Genshin Impact, Sforum - Free Fire"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Loại Nguồn</label>
              <select
                value={newSourceType}
                onChange={(e) => setNewSourceType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="reputable_web">Chuyên trang game (Web)</option>
                <option value="official_fb">Fanpage Facebook NPH</option>
                <option value="community_discord">Máy chủ Discord</option>
                <option value="official_site">Trang chủ NPH Game</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Game Mục Tiêu (Tùy chọn)</label>
              <select
                value={newSourceGameSlug}
                onChange={(e) => setNewSourceGameSlug(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Tự động nhận diện (Fuzzy match)</option>
                {games.slice(0, 150).map((g) => (
                  <option key={g.slug || g.id} value={g.slug || g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Đường Dẫn URL / Link <span className="text-rose-400">*</span>
            </label>
            <input
              type="url"
              required
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Mô Tả / Ghi Chú</label>
            <textarea
              rows={2}
              value={newSourceDesc}
              onChange={(e) => setNewSourceDesc(e.target.value)}
              placeholder="Ghi chú thêm về tần suất cập nhật hoặc kênh thông báo..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddSourceOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-600/20"
            >
              Lưu & Bắt Đầu Quét
            </button>
          </div>
        </form>
      </FormModal>

      {/* MODAL: Sửa & Duyệt Mã Code */}
      <FormModal
        isOpen={Boolean(editingCode)}
        onClose={() => setEditingCode(null)}
        title="Chỉnh Sửa & Phê Duyệt Giftcode"
      >
        <form onSubmit={handleSubmitEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Mã Giftcode</label>
            <input
              type="text"
              required
              value={editCodeValue}
              onChange={(e) => setEditCodeValue(e.target.value.toUpperCase())}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-amber-300 font-mono font-bold focus:outline-none focus:border-indigo-500 uppercase"
            />
          </div>

          <div>
            <SearchableGameSelect
              games={games}
              selectedGameSlug={editGameSlug}
              onSelectGame={(g) => setEditGameSlug(g.slug || g.id)}
              label="Tựa Game Áp Dụng"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Phần Thưởng</label>
            <input
              type="text"
              required
              value={editRewards}
              onChange={(e) => setEditRewards(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Hạn Sử Dụng</label>
            <input
              type="date"
              value={editExpiresAt}
              onChange={(e) => setEditExpiresAt(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditingCode(null)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-600/20"
            >
              Lưu & Duyệt Ngay Lập Tức
            </button>
          </div>
        </form>
      </FormModal>

      {/* CONFIRM MODAL: Xóa Nguồn */}
      <ConfirmModal
        isOpen={Boolean(deletingSourceId)}
        onClose={() => setDeletingSourceId(null)}
        onConfirm={() => deletingSourceId && handleDeleteSource(deletingSourceId)}
        title="Xóa Nguồn Cào Này?"
        message="Hệ thống sẽ không quét dữ liệu từ đường dẫn này trong các chu kỳ tự động tới nữa."
        confirmText="Xác nhận xóa"
      />
    </div>
  );
};
