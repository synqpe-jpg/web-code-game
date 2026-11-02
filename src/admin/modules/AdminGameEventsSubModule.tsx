import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap,
  Plus,
  Search,
  Trash2,
  Edit,
  Clock,
  Gift,
  CheckCircle2,
  Globe,
  RefreshCw,
  ExternalLink,
  Calendar,
  Save,
  X,
  Check,
  AlertCircle,
  Eye,
  Radio,
  Users,
  ShieldCheck,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { GameAdminRecord } from '../types/adminTypes';
import type { GameEventItem, GameEventTimeStatus, GameEventSourceType, GameEventStatus } from '../../types/gameEvent';
import { getGameEventTimeStatus, sortGameEvents } from '../../types/gameEvent';
import { gameEventService } from '../../services/gameEventService';
import { adminDataService } from '../services/adminDataService';
import { SearchableGameSelect } from '../components/ui/SearchableGameSelect';

interface AdminGameEventsSubModuleProps {
  games: GameAdminRecord[];
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  subTab: 'events' | 'pending';
  onSwitchSubTab: (tab: 'events' | 'pending') => void;
}

export const AdminGameEventsSubModule: React.FC<AdminGameEventsSubModuleProps> = ({
  games,
  onShowToast,
  subTab,
  onSwitchSubTab,
}) => {
  const [events, setEvents] = useState<GameEventItem[]>(() => gameEventService.getAllEvents());
  const [timeFilter, setTimeFilter] = useState<GameEventTimeStatus | 'ALL'>('ALL');
  const [gameFilter, setGameFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<GameEventItem>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);

  // Sync data & listen to events
  const loadLocalData = () => {
    setEvents(gameEventService.getAllEvents());
  };

  useEffect(() => {
    loadLocalData();
    window.addEventListener('wcg_game_events_updated', loadLocalData);
    return () => window.removeEventListener('wcg_game_events_updated', loadLocalData);
  }, []);

  // Server sync
  const handleSyncWithServer = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/events?status=ALL&limit=all', {
        headers: {
          ...adminDataService.getAdminHeaders(),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && Array.isArray(data.events)) {
        gameEventService.syncFromCloudflare(data.events, data.deletedIds || []);
        loadLocalData();
        onShowToast('Đồng bộ thành công!', `Đã kéo ${data.events.length} sự kiện từ máy chủ Cloudflare D1.`, 'success');
      } else {
        onShowToast('Đồng bộ thất bại', data.message || res.statusText, 'error');
      }
    } catch (err: any) {
      onShowToast('Lỗi kết nối', err?.message || 'Không thể kết nối đến máy chủ Cloudflare', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Published vs Pending
  const publishedEvents = useMemo(() => events.filter((e) => e.status === 'PUBLISHED'), [events]);
  const pendingEvents = useMemo(() => events.filter((e) => e.status === 'PENDING'), [events]);

  // Counts
  const counts = useMemo(() => {
    const now = Date.now();
    let happening = 0;
    let upcoming = 0;
    let ended = 0;

    publishedEvents.forEach((ev) => {
      const st = getGameEventTimeStatus(ev, now);
      if (st === 'HAPPENING') happening++;
      else if (st === 'UPCOMING') upcoming++;
      else if (st === 'ENDED') ended++;
    });

    return {
      published: publishedEvents.length,
      pending: pendingEvents.length,
      happening,
      upcoming,
      ended,
    };
  }, [publishedEvents, pendingEvents]);

  // Filtered displayed list
  const currentList = useMemo(() => {
    const now = Date.now();
    let list = subTab === 'pending' ? pendingEvents : publishedEvents;

    if (subTab === 'events' && timeFilter !== 'ALL') {
      list = list.filter((e) => getGameEventTimeStatus(e, now) === timeFilter);
    }

    if (gameFilter !== 'ALL') {
      list = list.filter((e) => e.game_slug === gameFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.game_name.toLowerCase().includes(q) ||
          (e.related_code && e.related_code.toLowerCase().includes(q))
      );
    }

    return sortGameEvents(list, now);
  }, [subTab, publishedEvents, pendingEvents, timeFilter, gameFilter, searchQuery]);

  // Format Date Time
  const formatDateTimeVN = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${hours}:${mins} ${day}/${month}/${year}`;
    } catch {
      return iso;
    }
  };

  // Convert ISO string to input datetime-local value
  const toDateTimeLocal = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    setEditingEvent({
      id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: '',
      game_name: '',
      game_slug: '',
      game_icon: '',
      source_type: 'FANPAGE',
      source_name: 'Fanpage chính thức',
      source_url: '',
      start_time: now.toISOString(),
      end_time: nextWeek.toISOString(),
      is_no_end_date: false,
      how_to_join: '',
      related_code: '',
      status: 'PUBLISHED',
      created_by: 'MANUAL',
      created_at: now.toISOString(),
    });
    setPreviewActive(false);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: GameEventItem) => {
    setEditingEvent({ ...item });
    setPreviewActive(false);
    setIsModalOpen(true);
  };

  // Save Event (Create or Update)
  const handleSaveEvent = async () => {
    const ev = editingEvent;

    // Validation
    if (!ev.game_slug || !ev.game_name) {
      onShowToast('Thiếu thông tin game', 'Vui lòng chọn tựa game liên kết!', 'error');
      return;
    }
    if (!ev.title || !ev.title.trim()) {
      onShowToast('Thiếu tên sự kiện', 'Vui lòng nhập tiêu đề sự kiện!', 'error');
      return;
    }
    if (!ev.source_url || !ev.source_url.trim()) {
      onShowToast('Thiếu link nguồn', 'Vui lòng nhập đường link bài viết gốc!', 'error');
      return;
    }
    if (!ev.start_time) {
      onShowToast('Thiếu thời gian bắt đầu', 'Vui lòng chọn thời gian bắt đầu sự kiện!', 'error');
      return;
    }
    if (!ev.is_no_end_date && !ev.end_time) {
      onShowToast('Thiếu thời gian kết thúc', 'Vui lòng chọn hạn kết thúc hoặc tích "Chưa rõ hạn"!', 'error');
      return;
    }
    if (!ev.how_to_join || !ev.how_to_join.trim()) {
      onShowToast('Thiếu cách tham gia', 'Vui lòng tóm tắt cách tham gia bằng 1-2 dòng!', 'error');
      return;
    }

    // Ensure official icon
    const gameIcon = ev.game_icon || `/game_icons/${ev.game_slug}.webp`;

    const fullItem: GameEventItem = {
      id: ev.id || `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: ev.title.trim(),
      game_name: ev.game_name.trim(),
      game_slug: ev.game_slug.trim(),
      game_icon: gameIcon,
      source_type: ev.source_type || 'FANPAGE',
      source_name: ev.source_name?.trim() || 'Nguồn chính thức',
      source_url: ev.source_url.trim(),
      start_time: ev.start_time,
      end_time: ev.is_no_end_date ? undefined : ev.end_time,
      is_no_end_date: !!ev.is_no_end_date,
      how_to_join: ev.how_to_join.trim(),
      related_code: ev.related_code?.trim() || undefined,
      status: ev.status || 'PUBLISHED',
      created_by: ev.created_by || 'MANUAL',
      created_at: ev.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      // 1. Post to Cloudflare API
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...adminDataService.getAdminHeaders(),
        },
        body: JSON.stringify(fullItem),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        onShowToast('Lỗi máy chủ', data.message || res.statusText, 'error');
        return;
      }

      // 2. Save locally
      gameEventService.saveEvent(fullItem);
      loadLocalData();
      setIsModalOpen(false);
      onShowToast('Đã lưu sự kiện!', `Sự kiện "${fullItem.title}" đã được lưu và đồng bộ lên Cloudflare D1.`, 'success');
    } catch (err: any) {
      onShowToast('Lỗi mạng', err?.message || 'Không thể lưu sự kiện lên máy chủ', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Approve Pending Event
  const handleApprovePending = async (item: GameEventItem) => {
    try {
      const res = await fetch(`/api/events/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...adminDataService.getAdminHeaders(),
        },
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        gameEventService.approvePendingEvent(item.id);
        loadLocalData();
        onShowToast('Đã duyệt sự kiện!', `Sự kiện "${item.title}" đã xuất bản ra Web Khách.`, 'success');
      } else {
        onShowToast('Lỗi duyệt sự kiện', data.message || res.statusText, 'error');
      }
    } catch (err: any) {
      onShowToast('Lỗi kết nối', err?.message || 'Không thể duyệt sự kiện', 'error');
    }
  };

  // Reject Pending Event
  const handleRejectPending = async (item: GameEventItem) => {
    if (!window.confirm(`Bạn có chắc muốn từ chối sự kiện "${item.title}" không?`)) return;

    try {
      const res = await fetch(`/api/events/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...adminDataService.getAdminHeaders(),
        },
        body: JSON.stringify({ action: 'REJECT' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        gameEventService.rejectPendingEvent(item.id);
        loadLocalData();
        onShowToast('Đã từ chối', `Đã loại bỏ sự kiện "${item.title}".`, 'info');
      } else {
        onShowToast('Lỗi từ chối sự kiện', data.message || res.statusText, 'error');
      }
    } catch (err: any) {
      onShowToast('Lỗi kết nối', err?.message || 'Không thể từ chối sự kiện', 'error');
    }
  };

  // Delete Event
  const handleDeleteEvent = async (item: GameEventItem) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn sự kiện "${item.title}" không?`)) return;

    try {
      const res = await fetch(`/api/events/${item.id}`, {
        method: 'DELETE',
        headers: {
          ...adminDataService.getAdminHeaders(),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        gameEventService.deleteEvent(item.id);
        loadLocalData();
        onShowToast('Đã xóa sự kiện', `Đã xóa sự kiện "${item.title}".`, 'info');
      } else {
        onShowToast('Lỗi xóa sự kiện', data.message || res.statusText, 'error');
      }
    } catch (err: any) {
      onShowToast('Lỗi kết nối', err?.message || 'Không thể xóa sự kiện', 'error');
    }
  };

  // Render Source Badge
  const renderSourceBadge = (type: GameEventSourceType, name: string) => {
    switch (type) {
      case 'FANPAGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-bold">
            <Radio className="w-3 h-3 text-blue-400" />
            <span>Fanpage: {name}</span>
          </span>
        );
      case 'GROUP':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[11px] font-bold">
            <Users className="w-3 h-3 text-purple-400" />
            <span>Group: {name}</span>
          </span>
        );
      case 'WEB':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
            <Globe className="w-3 h-3 text-emerald-400" />
            <span>Web: {name}</span>
          </span>
        );
    }
  };

  // Render Time Status Badge
  const renderTimeStatusBadge = (event: GameEventItem) => {
    const timeStatus = getGameEventTimeStatus(event);

    if (event.is_no_end_date) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-black">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>Chưa rõ hạn</span>
        </span>
      );
    }

    switch (timeStatus) {
      case 'HAPPENING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-black">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Đang diễn ra</span>
          </span>
        );
      case 'UPCOMING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[11px] font-black">
            <Calendar className="w-3 h-3 text-sky-400" />
            <span>Sắp tới</span>
          </span>
        );
      case 'ENDED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/50 border border-slate-600/50 text-slate-400 text-[11px] font-bold">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Đã kết thúc</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 1. Sub-tab header info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/40 border border-border/80 p-4 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-foreground">
              {subTab === 'pending'
                ? '⏳ Hàng Chờ Duyệt Sự Kiện'
                : '⚡ Danh Sách Sự Kiện Game Đã Đăng'}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-primary/20 text-primary-light text-xs font-mono font-bold">
              {currentList.length} mục
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {subTab === 'pending'
              ? 'Sự kiện do vòng quét tự động (Fanpage/Web) hoặc API gửi về đang chờ quản trị viên duyệt trước khi hiển thị ngoài Web.'
              : 'Sự kiện có thời hạn đang hiển thị ngoài Web Khách. Hạn kết thúc tự động chuyển sang Đã kết thúc mà không bị xóa.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Create Button (only on events tab) */}
          {subTab === 'events' && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all active:scale-95 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Đăng Sự Kiện Mới</span>
            </button>
          )}

          {/* Sync Button */}
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleSyncWithServer}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold border border-border transition-all active:scale-95 cursor-pointer"
            title="Đồng bộ sự kiện với Cloudflare D1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
            <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ D1'}</span>
          </button>
        </div>
      </div>

      {/* 2. Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-card/60 border border-border/80 p-3.5 rounded-2xl">
        {/* Time Status Filter (on events tab) */}
        {subTab === 'events' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setTimeFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeFilter === 'ALL'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Tất Cả ({counts.published})
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('HAPPENING')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeFilter === 'HAPPENING'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-muted/50 hover:bg-muted text-emerald-400 hover:text-emerald-300'
              }`}
            >
              Đang Diễn Ra ({counts.happening})
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('UPCOMING')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeFilter === 'UPCOMING'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-muted/50 hover:bg-muted text-sky-400 hover:text-sky-300'
              }`}
            >
              Sắp Tới ({counts.upcoming})
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('ENDED')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeFilter === 'ENDED'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-muted/50 hover:bg-muted text-slate-400 hover:text-slate-300'
              }`}
            >
              Đã Kết Thúc ({counts.ended})
            </button>
          </div>
        )}

        {/* Search & Game Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value)}
            className="w-40 sm:w-48 bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-semibold text-foreground truncate"
          >
            <option value="ALL">🎮 Tất cả game</option>
            {games.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>

          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo sự kiện, game, mã..."
              className="w-full bg-background border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* 3. Table of Events */}
      {currentList.length === 0 ? (
        <div className="py-12 text-center bg-card/30 border border-border/60 rounded-2xl p-6">
          <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
          <h3 className="text-sm font-bold text-foreground">
            {subTab === 'pending' ? 'Không có sự kiện nào trong hàng chờ duyệt' : 'Không có sự kiện nào phù hợp'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {subTab === 'pending'
              ? 'Khi cào tự động từ Fanpage hoặc API gửi bài mới, sự kiện sẽ xuất hiện tại đây để Quản trị viên duyệt.'
              : 'Hãy nhấn "Đăng Sự Kiện Mới" để tạo sự kiện thủ công.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card/60 shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground font-black uppercase text-[10px] tracking-wider border-b border-border/80">
              <tr>
                <th className="px-4 py-3">Tựa Game</th>
                <th className="px-4 py-3">Tên Sự Kiện</th>
                <th className="px-4 py-3">Nguồn Gốc</th>
                <th className="px-4 py-3">Thời Gian & Trạng Thái</th>
                <th className="px-4 py-3">Cách Tham Gia & Mã</th>
                <th className="px-4 py-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {currentList.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  {/* Game & Icon */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={item.game_icon || `/game_icons/${item.game_slug}.webp`}
                        alt={item.game_name}
                        className="w-9 h-9 rounded-xl object-cover ring-1 ring-border shadow-2xs shrink-0 bg-slate-900"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.endsWith('.webp')) {
                            target.src = `/game_icons/${item.game_slug}.webp`;
                          }
                        }}
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate max-w-[140px]">
                          {item.game_name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                          {item.game_slug}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Title */}
                  <td className="px-4 py-3">
                    <div className="font-bold text-foreground line-clamp-2 max-w-[220px]">
                      {item.title}
                    </div>
                    {item.created_by && (
                      <span className="text-[9.5px] font-mono text-muted-foreground">
                        [{item.created_by}]
                      </span>
                    )}
                  </td>

                  {/* Source */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="space-y-1">
                      <div>{renderSourceBadge(item.source_type, item.source_name)}</div>
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        title={item.source_url}
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">Xem link gốc</span>
                      </a>
                    </div>
                  </td>

                  {/* Time & Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="space-y-1">
                      <div>{renderTimeStatusBadge(item)}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {item.is_no_end_date ? (
                          <span className="text-amber-400">Từ {formatDateTimeVN(item.start_time)} (Chưa rõ hạn)</span>
                        ) : (
                          <span>
                            {formatDateTimeVN(item.start_time)} ➔ {formatDateTimeVN(item.end_time)}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Instructions & Code */}
                  <td className="px-4 py-3">
                    <div className="space-y-1 max-w-[240px]">
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {item.how_to_join}
                      </p>
                      {item.related_code ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold text-[11px]">
                          <Gift className="w-3 h-3 text-amber-400" />
                          <span>{item.related_code}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">Không có mã</span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {subTab === 'pending' ? (
                        <>
                          {/* Approve Button */}
                          <button
                            type="button"
                            onClick={() => handleApprovePending(item)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
                            title="Duyệt đăng sự kiện ra Web Khách"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>

                          {/* Edit before approve */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border transition-all cursor-pointer"
                            title="Chỉnh sửa nội dung"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Reject Button */}
                          <button
                            type="button"
                            onClick={() => handleRejectPending(item)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
                            title="Từ chối sự kiện"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border transition-all cursor-pointer"
                            title="Chỉnh sửa sự kiện"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(item)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
                            title="Xóa sự kiện"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Create / Edit Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card border border-border/80 p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-black text-foreground">
                    {editingEvent.id ? 'Biên Tập Sự Kiện Game' : 'Tạo Mới Sự Kiện Game'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Nhập đầy đủ thông tin sự kiện. Sau khi lưu sẽ hiển thị trên mục Sự Kiện Game.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Form Inputs */}
            <div className="space-y-4 text-xs">
              {/* Field 1: Game Selector */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground flex items-center gap-1.5">
                  <span>1. Chọn Tựa Game</span>
                  <span className="text-rose-500">*</span>
                </label>
                <SearchableGameSelect
                  games={games}
                  selectedGameSlug={editingEvent.game_slug || ''}
                  onSelectGame={(g) => {
                    if (g) {
                      setEditingEvent({
                        ...editingEvent,
                        game_name: g.name,
                        game_slug: g.slug,
                        game_icon: `/game_icons/${g.slug}.webp`,
                      });
                    }
                  }}
                  placeholder="Tìm kiếm tựa game..."
                />
                {editingEvent.game_slug && (
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                    <img
                      src={editingEvent.game_icon || `/game_icons/${editingEvent.game_slug}.webp`}
                      alt=""
                      className="w-5 h-5 rounded-md object-cover ring-1 ring-border"
                    />
                    <span>Game đã chọn: <strong>{editingEvent.game_name}</strong> (Slug: {editingEvent.game_slug})</span>
                  </div>
                )}
              </div>

              {/* Field 2: Event Title */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground flex items-center gap-1.5">
                  <span>2. Tên Sự Kiện</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingEvent.title || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  placeholder="Ví dụ: Cuối Tuần Vui Vẻ – Mừng Thiên Bồng Nguyên Soái Giáng Thế"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground font-semibold focus:outline-hidden focus:border-primary"
                />
              </div>

              {/* Field 3: Source (Type, Name, URL) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">Loại Nguồn</label>
                  <select
                    value={editingEvent.source_type || 'FANPAGE'}
                    onChange={(e) =>
                      setEditingEvent({
                        ...editingEvent,
                        source_type: e.target.value as GameEventSourceType,
                      })
                    }
                    className="w-full bg-background border border-border rounded-xl px-2.5 py-2 text-foreground font-medium focus:outline-hidden focus:border-primary"
                  >
                    <option value="FANPAGE">Fanpage chính thức</option>
                    <option value="GROUP">Group công khai</option>
                    <option value="WEB">Web / Trang chủ</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">Tên Nguồn Hiển Thị</label>
                  <input
                    type="text"
                    value={editingEvent.source_name || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, source_name: e.target.value })}
                    placeholder="Ví dụ: Fanpage chính thức"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-hidden focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground flex items-center justify-between">
                    <span>Link Nguồn Gốc</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="url"
                      value={editingEvent.source_url || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, source_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-hidden focus:border-primary"
                    />
                    {editingEvent.source_url && (
                      <a
                        href={editingEvent.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border shrink-0"
                        title="Mở link kiểm tra"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Field 4: Time (Start, End, No End Date) */}
              <div className="space-y-2 p-3 rounded-2xl bg-muted/30 border border-border/60">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">3. Thời Gian Diễn Ra (Giờ Việt Nam)</span>
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editingEvent.is_no_end_date}
                      onChange={(e) =>
                        setEditingEvent({
                          ...editingEvent,
                          is_no_end_date: e.target.checked,
                        })
                      }
                      className="rounded border-border text-amber-500 focus:ring-0"
                    />
                    <span>Chưa rõ hạn kết thúc</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Bắt đầu:</label>
                    <input
                      type="datetime-local"
                      value={toDateTimeLocal(editingEvent.start_time)}
                      onChange={(e) =>
                        setEditingEvent({
                          ...editingEvent,
                          start_time: e.target.value ? new Date(e.target.value).toISOString() : '',
                        })
                      }
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-foreground focus:outline-hidden focus:border-primary font-mono text-[11px]"
                    />
                  </div>

                  {!editingEvent.is_no_end_date && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Kết thúc:</label>
                      <input
                        type="datetime-local"
                        value={toDateTimeLocal(editingEvent.end_time)}
                        onChange={(e) =>
                          setEditingEvent({
                            ...editingEvent,
                            end_time: e.target.value ? new Date(e.target.value).toISOString() : '',
                          })
                        }
                        className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-foreground focus:outline-hidden focus:border-primary font-mono text-[11px]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Field 5: How to join */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span>4. Cách Tham Gia (1 - 2 dòng)</span>
                    <span className="text-rose-500">*</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground italic">
                    Diễn đạt lại bằng lời của mình, không chép nguyên văn bài gốc
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={editingEvent.how_to_join || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, how_to_join: e.target.value })}
                  placeholder="Ví dụ: Đăng nhập game trong dịp cuối tuần và nhập mã quà tặng để nhận thưởng mừng Thiên Bồng Nguyên Soái."
                  className="w-full bg-background border border-border rounded-xl p-3 text-foreground leading-relaxed focus:outline-hidden focus:border-primary resize-none"
                />
              </div>

              {/* Field 6: Related Code */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground flex items-center justify-between">
                  <span>5. Mã Giftcode Liên Quan (Tùy chọn)</span>
                  <span className="text-[11px] text-amber-400 font-normal">
                    ⚠️ Chỉ ghi mã công khai chính thức. Mã quà livestream/inbox vui lòng để trống.
                  </span>
                </label>
                <input
                  type="text"
                  value={editingEvent.related_code || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, related_code: e.target.value })}
                  placeholder="Ví dụ: CUOITUANVUIVE (hoặc để trống nếu không có)"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground font-mono focus:outline-hidden focus:border-primary"
                />
              </div>

              {/* Status Select */}
              <div className="flex items-center gap-3 pt-1">
                <label className="font-bold text-foreground">Trạng Thái Đăng:</label>
                <select
                  value={editingEvent.status || 'PUBLISHED'}
                  onChange={(e) =>
                    setEditingEvent({
                      ...editingEvent,
                      status: e.target.value as GameEventStatus,
                    })
                  }
                  className="bg-background border border-border rounded-xl px-3 py-1.5 text-foreground font-bold focus:outline-hidden focus:border-primary"
                >
                  <option value="PUBLISHED">🟢 Đăng Trực Tiếp Ra Web (PUBLISHED)</option>
                  <option value="PENDING">⏳ Giữ Trong Hàng Chờ (PENDING)</option>
                </select>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/80">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveEvent}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu Sự Kiện'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
