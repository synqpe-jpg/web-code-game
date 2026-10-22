import React, { useState, useEffect } from 'react';
import {
  Rocket,
  Clock,
  Calendar,
  Gift,
  Key,
  Copy,
  Check,
  RefreshCw,
  Send,
  Terminal,
  Play,
  AlertCircle,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Code2,
  ShieldCheck,
  ChevronRight,
  Eye,
  Bot,
  Globe,
  Sliders,
  CheckCircle2,
  X,
  Search,
  Filter,
} from 'lucide-react';
import { adminDataService } from '../services/adminDataService';
import { UpcomingGameAdminRecord, UpcomingGameApiLogEntry } from '../types/adminTypes';
import { FormModal } from '../components/ui/FormModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ImageUploadInput } from '../components/ui/ImageUploadInput';

interface UpcomingGamesSectionProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
  onGameLaunched?: () => void;
}

function getCountdownDetails(releaseDateStr?: string): { text: string; isPast: boolean; color: string; badgeBg: string } {
  if (!releaseDateStr) {
    return { text: 'Chưa công bố giờ', isPast: false, color: 'text-slate-400', badgeBg: 'bg-slate-800/80 border-slate-700' };
  }
  const target = new Date(releaseDateStr).getTime();
  if (isNaN(target)) {
    return { text: releaseDateStr, isPast: false, color: 'text-slate-400', badgeBg: 'bg-slate-800/80 border-slate-700' };
  }
  const diff = target - Date.now();
  if (diff <= 0) {
    return {
      text: '🟢 Đã đến giờ mở server!',
      isPast: true,
      color: 'text-emerald-400 font-bold',
      badgeBg: 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300',
    };
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return {
      text: `⏳ Còn ${days} ngày ${hours} giờ`,
      isPast: false,
      color: 'text-amber-400 font-semibold',
      badgeBg: 'bg-amber-950/40 border-amber-500/40 text-amber-300',
    };
  }
  return {
    text: `⏳ Còn ${hours} giờ ${minutes} phút`,
    isPast: false,
    color: 'text-rose-400 font-bold animate-pulse',
    badgeBg: 'bg-rose-950/50 border-rose-500/50 text-rose-300',
  };
}

export const UpcomingGamesSection: React.FC<UpcomingGamesSectionProps> = ({ onShowToast, onGameLaunched }) => {
  const [upcomingGames, setUpcomingGames] = useState<UpcomingGameAdminRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UPCOMING' | 'LAUNCHED'>('ALL');
  const [isLoading, setIsLoading] = useState(false);

  // API Config & Test Console State
  const [isApiSectionOpen, setIsApiSectionOpen] = useState(false);
  const [apiSnippetLang, setApiSnippetLang] = useState<'python' | 'curl' | 'js'>('python');
  const [testPayloadJson, setTestPayloadJson] = useState('');
  const [isExecutingApiTest, setIsExecutingApiTest] = useState(false);
  const [apiTestResponse, setApiTestResponse] = useState<any>(null);
  const [apiLogs, setApiLogs] = useState<UpcomingGameApiLogEntry[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form Modal State (Add / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Partial<UpcomingGameAdminRecord> | null>(null);
  const [expectedCodesInput, setExpectedCodesInput] = useState('');

  // Delete Confirm Modal State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingGame, setDeletingGame] = useState<UpcomingGameAdminRecord | null>(null);

  // Live timer tick every 30 seconds for accurate countdowns
  const [, setTick] = useState(0);

  const crawlerConfig = adminDataService.getCrawlerApiConfig();
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://codegame.shop';
  const apiEndpointUrl = `${currentOrigin}/api/crawler/ingest-upcoming-games`;

  const loadData = () => {
    setIsLoading(true);
    const list = adminDataService.getUpcomingGames();
    setUpcomingGames(list);
    setApiLogs(adminDataService.getUpcomingGamesLogs());
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);

    const handleSync = () => {
      loadData();
    };

    window.addEventListener('wcg_admin_data_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      clearInterval(timer);
      window.removeEventListener('wcg_admin_data_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Initialize sample test payload
  useEffect(() => {
    const sample = {
      apiKey: crawlerConfig.apiKey || 'YOUR_API_KEY',
      botName: 'Muse Upcoming Games Bot',
      games: [
        {
          name: 'Strinova VN',
          slug: 'strinova-vn',
          publisher: 'iDreamSky / VPlay',
          releaseDate: '2026-10-23T10:00:00+07:00',
          category: 'Bắn Súng Anime 3D',
          platform: 'PC, Android, iOS',
          iconUrl: '/game_icons/strinova-vn.webp',
          bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
          description: 'Game bắn súng chiến thuật biến hình Anime 3D góc nhìn thứ ba đỉnh cao 2026.',
          preRegUrl: 'https://strinova.vplay.vn',
          expectedCodes: ['STRINOVAOB', 'STRINOVAVN', 'VIP999'],
          status: 'UPCOMING',
        },
      ],
    };
    setTestPayloadJson(JSON.stringify(sample, null, 2));
  }, [crawlerConfig.apiKey]);

  const handleCopyText = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    onShowToast('Đã sao chép!', text, 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenCreateModal = () => {
    const now = new Date();
    // Default 3 days in future at 10:00 AM
    now.setDate(now.getDate() + 3);
    const dateStr = now.toISOString().slice(0, 10);
    const defaultDatetime = `${dateStr}T10:00`;

    setEditingGame({
      name: '',
      slug: '',
      publisher: '',
      category: 'Nhập Vai',
      platform: 'Android, iOS',
      releaseDate: defaultDatetime,
      iconUrl: '',
      bannerUrl: '',
      description: '',
      preRegUrl: '',
      status: 'UPCOMING',
      expectedCodes: [],
    });
    setExpectedCodesInput('');
    setIsFormOpen(true);
  };

  const handleOpenEditModal = (game: UpcomingGameAdminRecord) => {
    setEditingGame({ ...game });
    setExpectedCodesInput(Array.isArray(game.expectedCodes) ? game.expectedCodes.join(', ') : '');
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame?.name) {
      onShowToast('Lỗi', 'Vui lòng nhập tên game.', 'error');
      return;
    }

    const name = editingGame.name.trim();
    const slug = editingGame.slug?.trim()
      ? editingGame.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

    const codes = expectedCodesInput
      .split(/[,;\n]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    const record: UpcomingGameAdminRecord = {
      id: editingGame.id || `ug_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      slug,
      publisher: editingGame.publisher?.trim() || 'Nhà phát hành chính thức',
      category: editingGame.category?.trim() || 'Game Mới',
      platform: editingGame.platform?.trim() || 'Android, iOS, PC',
      releaseDate: editingGame.releaseDate || new Date().toISOString(),
      iconUrl: editingGame.iconUrl?.trim() || `/game_icons/${slug}.webp`,
      bannerUrl: editingGame.bannerUrl?.trim() || undefined,
      description: editingGame.description?.trim() || `Game sắp ra mắt ${name}.`,
      preRegUrl: editingGame.preRegUrl?.trim() || undefined,
      expectedCodes: codes,
      status: editingGame.status || 'UPCOMING',
      source: editingGame.source || 'Admin Console',
      createdAt: editingGame.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await adminDataService.saveUpcomingGame(record);
    onShowToast('Thành công', `Đã lưu thông tin game sắp ra mắt ${record.name}!`, 'success');
    setIsFormOpen(false);
    setEditingGame(null);
    loadData();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingGame) return;
    await adminDataService.deleteUpcomingGame(deletingGame.id);
    onShowToast('Đã xóa', `Đã xóa game ${deletingGame.name} khỏi danh sách sắp ra mắt.`, 'info');
    setIsDeleteOpen(false);
    setDeletingGame(null);
    loadData();
  };

  const handleLaunchGame = async (game: UpcomingGameAdminRecord) => {
    const res = await adminDataService.launchUpcomingGame(game.id);
    if (res.success) {
      onShowToast(
        'Phát Hành Thành Công!',
        `Đã chuyển ${res.gameName} lên sàn chính thức và kích hoạt ${res.codesAdded} mã giftcode tân thủ vào kho!`,
        'success'
      );
      loadData();
      if (onGameLaunched) onGameLaunched();
    } else {
      onShowToast('Thất bại', 'Không thể phát hành game.', 'error');
    }
  };

  const handleExecuteApiTest = async () => {
    setIsExecutingApiTest(true);
    setApiTestResponse(null);
    try {
      let parsedPayload: any;
      try {
        parsedPayload = JSON.parse(testPayloadJson);
      } catch {
        throw new Error('Dữ liệu JSON trong khung thử nghiệm không đúng định dạng cú pháp.');
      }

      if (!parsedPayload.apiKey && crawlerConfig.apiKey) {
        parsedPayload.apiKey = crawlerConfig.apiKey;
      }

      const res = await fetch('/api/crawler/ingest-upcoming-games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${crawlerConfig.apiKey || ''}`,
        },
        body: JSON.stringify(parsedPayload),
      });

      const json = await res.json();
      setApiTestResponse({
        httpStatus: res.status,
        statusText: res.statusText,
        ok: res.ok,
        data: json,
      });

      if (res.ok && json.success) {
        onShowToast('API Phản Hồi Thành Công!', `Đã nạp thành công từ ${json.botName || 'Muse Bot'}!`, 'success');
        // Add log
        const logEntry: UpcomingGameApiLogEntry = {
          id: `log_${Date.now()}`,
          botName: json.botName || 'Muse Upcoming Games Bot',
          sourceIp: json.sourceIp || '127.0.0.1',
          totalGamesProcessed: json.totalReceived || 1,
          totalGamesAdded: json.totalAdded || 0,
          totalGamesUpdated: json.totalUpdated || 0,
          status: 'SUCCESS',
          details: json.details,
          timestamp: new Date().toISOString(),
        };
        adminDataService.addUpcomingGameLog(logEntry);
        loadData();
      } else {
        onShowToast('API Báo Lỗi', json.error || 'Yêu cầu không được chấp thuận.', 'error');
      }
    } catch (err: any) {
      setApiTestResponse({
        httpStatus: 0,
        statusText: 'Client Network Error',
        ok: false,
        data: { error: err.message || 'Lỗi kết nối tới endpoint' },
      });
      onShowToast('Lỗi Thực Thi', err.message, 'error');
    } finally {
      setIsExecutingApiTest(false);
    }
  };

  // Filtered upcoming games
  const filteredGames = upcomingGames.filter((g) => {
    if (statusFilter !== 'ALL' && g.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      g.name.toLowerCase().includes(q) ||
      g.slug.toLowerCase().includes(q) ||
      g.publisher.toLowerCase().includes(q) ||
      g.category.toLowerCase().includes(q) ||
      (g.expectedCodes && g.expectedCodes.some((c) => c.toLowerCase().includes(q)))
    );
  });

  // Calculate statistics
  const nowMs = Date.now();
  const next7DaysMs = nowMs + 7 * 24 * 60 * 60 * 1000;
  const inNext7DaysCount = upcomingGames.filter((g) => {
    if (g.status === 'LAUNCHED') return false;
    const t = new Date(g.releaseDate).getTime();
    return !isNaN(t) && t > nowMs && t <= next7DaysMs;
  }).length;
  const totalExpectedCodes = upcomingGames.reduce((acc, g) => acc + (g.expectedCodes?.length || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Overview */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-indigo-500/30 shadow-lg shadow-indigo-950/20">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                <Rocket className="w-5 h-5 text-amber-400 animate-bounce" style={{ animationDuration: '3s' }} />
              </span>
              <h2 className="text-lg sm:text-xl font-display font-extrabold text-white tracking-tight">
                Quản Lý Game Chuẩn Bị Ra Mắt & Cổng API Muse
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Lên lịch mở server, đồng hồ đếm ngược sống, tập hợp giftcode tân thủ dự kiến & cung cấp Cổng API chuẩn RESTful cho Muse Bot tự động quản lý 24/7.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Game Mới</span>
            </button>

            <button
              type="button"
              onClick={() => setIsApiSectionOpen(!isApiSectionOpen)}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isApiSectionOpen
                  ? 'bg-purple-600/30 border-purple-400 text-purple-200 shadow-sm'
                  : 'bg-card hover:bg-card-hover border-border text-slate-200'
              }`}
            >
              <Bot className="w-4 h-4 text-purple-400" />
              <span>{isApiSectionOpen ? 'Đóng Cổng API Muse' : '📡 Cổng API & Webhook (Muse Bot)'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                loadData();
                onShowToast('Đã làm mới', 'Dữ liệu game sắp ra mắt đã được đồng bộ.', 'info');
              }}
              className="p-2 rounded-xl bg-card hover:bg-card-hover border border-border text-slate-300 transition-all cursor-pointer"
              title="Làm mới danh sách"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Tổng Game Sắp Ra Mắt</span>
            <Rocket className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-display text-white">{upcomingGames.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Đang theo dõi lịch phát hành</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Ra Mắt Trong 7 Ngày Tới</span>
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="text-2xl font-bold font-display text-amber-400">{inNext7DaysCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Có đồng hồ đếm ngược sống</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Giftcode Tân Thủ Dự Kiến</span>
            <Gift className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-display text-emerald-400">{totalExpectedCodes}</div>
          <div className="text-[11px] text-slate-400 mt-1">Sẵn sàng mở khóa giờ G</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Cổng API Muse Bot</span>
            <Bot className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-base font-bold font-display text-emerald-400">Đang Hoạt Động</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono truncate">POST /api/crawler/ingest-upcoming-games</div>
        </div>
      </div>

      {/* CỔNG API & WEBHOOK CHO MUSE BOT (GIỐNG BÊN QUÉT CODE) */}
      {isApiSectionOpen && (
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/30 to-purple-950/30 border border-purple-500/30 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Bot className="w-5 h-5 text-purple-400" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>Cổng API Tự Động Hóa Cho Muse Bot (Upcoming Games Ingest API)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300 font-mono border border-purple-500/40">
                    REST API v1
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Dành riêng cho Muse Bot hoặc Script Python để tự động cập nhật game sắp ra mắt và giftcode tân thủ lên sàn 24/7.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsApiSectionOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Endpoint URL & API Key */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Endpoint */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Endpoint Tiếp Nhận (URL)</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  POST & GET
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={apiEndpointUrl}
                  className="flex-1 bg-slate-950 border border-border rounded-xl px-3 py-2 text-xs font-mono text-purple-300 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopyText(apiEndpointUrl, 'api-url')}
                  className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                >
                  {copiedKey === 'api-url' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey === 'api-url' ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Khóa Xác Thực (API Key của Muse)</span>
                <span className="text-[10px] text-slate-400">Dùng chung với bộ Crawler</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  readOnly
                  value={crawlerConfig.apiKey || 'wcg_sec_muse_crawler_key'}
                  className="flex-1 bg-slate-950 border border-border rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopyText(crawlerConfig.apiKey || '', 'api-key')}
                  className="px-3 py-2 rounded-xl bg-card hover:bg-card-hover border border-border text-slate-200 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                >
                  {copiedKey === 'api-key' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey === 'api-key' ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quy Chuẩn Payload JSON */}
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-indigo-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Quy Chuẩn JSON Muse Bot Gửi Lên Hệ Thống:</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 list-disc list-inside text-slate-300">
              <li><code className="text-purple-300 font-bold">name</code> (Bắt buộc): Tên game (ví dụ: "Strinova VN")</li>
              <li><code className="text-purple-300 font-bold">slug</code> (Tùy chọn): Tự động sinh nếu để trống</li>
              <li><code className="text-purple-300 font-bold">releaseDate</code> (Bắt buộc): ISO format <code className="text-amber-300">YYYY-MM-DDTHH:mm:ss+07:00</code></li>
              <li><code className="text-purple-300 font-bold">publisher</code>: Nhà phát hành (VNG, VPlay, SohaGame...)</li>
              <li><code className="text-purple-300 font-bold">expectedCodes</code>: Mảng code tân thủ <code className="text-emerald-300">["VIP666", "STRINOVA"]</code></li>
              <li><code className="text-purple-300 font-bold">preRegUrl</code>: Link đăng ký trước / Tải trước</li>
            </ul>
          </div>

          {/* Code Snippets & Test Console */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Snippets Tab */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-purple-400" />
                  <span>Mẫu Mã Lệnh Cho Muse & Python:</span>
                </span>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-border text-[11px]">
                  <button
                    type="button"
                    onClick={() => setApiSnippetLang('python')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      apiSnippetLang === 'python' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    Python (Muse)
                  </button>
                  <button
                    type="button"
                    onClick={() => setApiSnippetLang('curl')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      apiSnippetLang === 'curl' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    cURL
                  </button>
                  <button
                    type="button"
                    onClick={() => setApiSnippetLang('js')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      apiSnippetLang === 'js' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    JavaScript
                  </button>
                </div>
              </div>

              <div className="relative">
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-border text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 leading-relaxed">
                  {apiSnippetLang === 'python' && `# 🐍 Python Script cho Muse AI Agent
import requests

API_URL = "${apiEndpointUrl}"
API_KEY = "${crawlerConfig.apiKey || 'YOUR_API_KEY'}"

payload = {
    "apiKey": API_KEY,
    "botName": "Muse Upcoming Games Bot",
    "games": [
        {
            "name": "Strinova VN",
            "slug": "strinova-vn",
            "publisher": "iDreamSky / VPlay",
            "releaseDate": "2026-10-23T10:00:00+07:00",
            "category": "Bắn Súng Anime 3D",
            "platform": "PC, Android, iOS",
            "preRegUrl": "https://strinova.vplay.vn",
            "expectedCodes": ["STRINOVAOB", "VIP999"],
            "status": "UPCOMING"
        }
    ]
}

res = requests.post(API_URL, json=payload, headers={"Authorization": f"Bearer {API_KEY}"})
print(res.status_code, res.json())`}

                  {apiSnippetLang === 'curl' && `curl -X POST "${apiEndpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${crawlerConfig.apiKey || 'YOUR_API_KEY'}" \\
  -d '{
    "botName": "Muse Bot",
    "games": [
      {
        "name": "Strinova VN",
        "releaseDate": "2026-10-23T10:00:00+07:00",
        "publisher": "VPlay",
        "expectedCodes": ["STRINOVAOB", "VIP666"]
      }
    ]
  }'`}

                  {apiSnippetLang === 'js' && `const res = await fetch('${apiEndpointUrl}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${crawlerConfig.apiKey || 'YOUR_API_KEY'}'
  },
  body: JSON.stringify({
    botName: 'Muse Upcoming Games Bot',
    games: [
      {
        name: 'Strinova VN',
        releaseDate: '2026-10-23T10:00:00+07:00',
        publisher: 'VPlay',
        expectedCodes: ['STRINOVAOB', 'VIP999']
      }
    ]
  })
});
const data = await res.json();
console.log(data);`}
                </pre>

                <button
                  type="button"
                  onClick={() => {
                    const code =
                      apiSnippetLang === 'python'
                        ? `# 🐍 Python Script cho Muse AI Agent\nimport requests\n\nAPI_URL = "${apiEndpointUrl}"\nAPI_KEY = "${crawlerConfig.apiKey || 'YOUR_API_KEY'}"\n\npayload = {\n    "apiKey": API_KEY,\n    "botName": "Muse Upcoming Games Bot",\n    "games": [\n        {\n            "name": "Strinova VN",\n            "slug": "strinova-vn",\n            "publisher": "iDreamSky / VPlay",\n            "releaseDate": "2026-10-23T10:00:00+07:00",\n            "category": "Bắn Súng Anime 3D",\n            "platform": "PC, Android, iOS",\n            "preRegUrl": "https://strinova.vplay.vn",\n            "expectedCodes": ["STRINOVAOB", "VIP999"],\n            "status": "UPCOMING"\n        }\n    ]\n}\n\nres = requests.post(API_URL, json=payload, headers={"Authorization": f"Bearer {API_KEY}"})\nprint(res.status_code, res.json())`
                        : apiSnippetLang === 'curl'
                        ? `curl -X POST "${apiEndpointUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer ${crawlerConfig.apiKey || 'YOUR_API_KEY'}" -d '{"botName":"Muse Bot","games":[{"name":"Strinova VN","releaseDate":"2026-10-23T10:00:00+07:00","publisher":"VPlay","expectedCodes":["STRINOVAOB","VIP666"]}]}'`
                        : `const res = await fetch('${apiEndpointUrl}', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ${crawlerConfig.apiKey || 'YOUR_API_KEY'}' }, body: JSON.stringify({ botName: 'Muse Upcoming Games Bot', games: [{ name: 'Strinova VN', releaseDate: '2026-10-23T10:00:00+07:00', publisher: 'VPlay', expectedCodes: ['STRINOVAOB', 'VIP999'] }] }) });`;
                    handleCopyText(code, 'snippet');
                  }}
                  className="absolute top-2.5 right-2.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 cursor-pointer transition-all border border-border"
                >
                  {copiedKey === 'snippet' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'snippet' ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
            </div>

            {/* Test Console */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Khung Gửi Thử Nghiệm API Trực Tiếp:</span>
                </span>
                <span className="text-[10px] text-slate-400">Tự động chèn API Key khi gửi</span>
              </div>

              <textarea
                value={testPayloadJson}
                onChange={(e) => setTestPayloadJson(e.target.value)}
                rows={8}
                className="w-full p-3 bg-slate-950 border border-border rounded-xl text-[11px] font-mono text-emerald-300 focus:outline-none focus:border-purple-500 transition-all resize-none"
                placeholder="Nhập JSON payload..."
              />

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleExecuteApiTest}
                  disabled={isExecutingApiTest}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isExecutingApiTest ? 'Đang gửi tới API...' : '⚡ Gửi Thử Tới API (POST)'}</span>
                </button>

                {apiTestResponse && (
                  <span
                    className={`text-xs font-bold font-mono px-2.5 py-1 rounded-lg border ${
                      apiTestResponse.ok
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                    }`}
                  >
                    HTTP {apiTestResponse.httpStatus} {apiTestResponse.statusText}
                  </span>
                )}
              </div>

              {apiTestResponse && (
                <div className="p-3 rounded-xl bg-slate-950 border border-border text-[11px] font-mono text-slate-300 overflow-x-auto max-h-36">
                  <pre>{JSON.stringify(apiTestResponse.data, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên game, slug, nhà phát hành, mã code..."
            className="w-full bg-slate-900 border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-border text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tất Cả ({upcomingGames.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('UPCOMING')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'UPCOMING' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sắp Ra Mắt ({upcomingGames.filter((g) => g.status === 'UPCOMING').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('LAUNCHED')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === 'LAUNCHED' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Đã Mở Server ({upcomingGames.filter((g) => g.status === 'LAUNCHED').length})
            </button>
          </div>
        </div>
      </div>

      {/* Danh Sách Game Chuẩn Bị Ra Mắt (Cards / Table) */}
      {filteredGames.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-card border border-border border-dashed space-y-3">
          <Rocket className="w-10 h-10 text-slate-500 mx-auto" />
          <div className="text-sm font-bold text-white">Chưa có tựa game sắp ra mắt nào phù hợp</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Bấm vào nút "Thêm Game Mới" hoặc kích hoạt Muse Bot qua API để tự động nạp lịch mở server.
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Game Đầu Tiên</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredGames.map((game) => {
            const countdown = getCountdownDetails(game.releaseDate);
            const dateObj = new Date(game.releaseDate);
            const formattedDate = !isNaN(dateObj.getTime())
              ? dateObj.toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : game.releaseDate;

            return (
              <div
                key={game.id}
                className="group relative rounded-2xl bg-card border border-border hover:border-indigo-500/50 transition-all duration-200 overflow-hidden shadow-sm flex flex-col justify-between"
              >
                {/* Header with Icon and Countdown */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-border shrink-0 flex items-center justify-center shadow-inner">
                        {game.iconUrl ? (
                          <img
                            src={game.iconUrl}
                            alt={game.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Rocket className="w-6 h-6 text-indigo-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-white group-hover:text-indigo-400 transition-colors truncate">
                            {game.name}
                          </h4>
                          {game.status === 'LAUNCHED' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                              Đã Mở Server
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                              Sắp Ra Mắt
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="truncate">{game.publisher}</span>
                          <span>•</span>
                          <span className="truncate text-indigo-300">{game.category}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Countdown Badge */}
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${countdown.badgeBg}`}>
                    <div className="flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{formattedDate}</span>
                    </div>
                    <div className={`text-xs font-bold ${countdown.color}`}>{countdown.text}</div>
                  </div>

                  {/* Description */}
                  {game.description && (
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {game.description}
                    </p>
                  )}

                  {/* Expected Giftcodes */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-medium flex items-center gap-1 text-slate-300">
                        <Gift className="w-3.5 h-3.5 text-accent" />
                        <span>Code Tân Thủ Dự Kiến ({game.expectedCodes?.length || 0}):</span>
                      </span>
                      {game.source && (
                        <span className="text-[10px] text-purple-300 font-mono bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-500/20">
                          {game.source}
                        </span>
                      )}
                    </div>

                    {game.expectedCodes && game.expectedCodes.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {game.expectedCodes.map((codeStr, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() => handleCopyText(codeStr, `code-${game.id}-${cIdx}`)}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-border text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                            title="Bấm để chép code"
                          >
                            <span>{codeStr}</span>
                            {copiedKey === `code-${game.id}-${cIdx}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-500 hover:text-slate-300" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic">Chưa có mã code dự kiến nào</div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 bg-slate-950/60 border-t border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {game.preRegUrl && (
                      <a
                        href={game.preRegUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] text-indigo-400 hover:text-indigo-300 border border-border flex items-center gap-1 transition-colors"
                      >
                        <Globe className="w-3 h-3" />
                        <span>Đăng Ký Trước</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {game.status !== 'LAUNCHED' && (
                      <button
                        type="button"
                        onClick={() => handleLaunchGame(game)}
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all cursor-pointer active:scale-95"
                        title="Đẩy thành Game Chính Thức trên sàn khi mở server"
                      >
                        <Rocket className="w-3 h-3" />
                        <span>Phát Hành Lên Sàn</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(game)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Sửa thông tin"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDeletingGame(game);
                        setIsDeleteOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                      title="Xóa game sắp ra mắt"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Thêm / Chỉnh Sửa Game Sắp Ra Mắt */}
      <FormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingGame(null);
        }}
        title={editingGame?.id ? 'Chỉnh Sửa Game Sắp Ra Mắt' : 'Thêm Game Chuẩn Bị Ra Mắt Mới'}
        subtitle="Cập nhật lịch mở server, NPH và gom giftcode tân thủ dự kiến."
        maxWidth="2xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tên game */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Tên Game <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={editingGame?.name || ''}
                onChange={(e) => setEditingGame((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ví dụ: Strinova VN"
                className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Slug */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Slug (Đường dẫn tĩnh)</label>
              <input
                type="text"
                value={editingGame?.slug || ''}
                onChange={(e) => setEditingGame((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="Tự động sinh nếu để trống"
                className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Nhà phát hành */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Nhà Phát Hành (NPH)</label>
              <input
                type="text"
                value={editingGame?.publisher || ''}
                onChange={(e) => setEditingGame((prev) => ({ ...prev, publisher: e.target.value }))}
                placeholder="Ví dụ: VNG, VPlay, SohaGame, Funtap..."
                className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Thời gian mở server */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Ngày Giờ Mở Server <span className="text-rose-400">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={editingGame?.releaseDate ? editingGame.releaseDate.slice(0, 16) : ''}
                onChange={(e) => setEditingGame((prev) => ({ ...prev, releaseDate: e.target.value }))}
                className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Thể loại */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Thể Loại Game</label>
              <input
                type="text"
                value={editingGame?.category || ''}
                onChange={(e) => setEditingGame((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="Nhập Vai, Bắn Súng, Tiên Hiệp, Chiến Thuật..."
                className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Nền tảng */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Nền Tảng Hỗ Trợ</label>
              <input
                type="text"
                value={editingGame?.platform || ''}
                onChange={(e) => setEditingGame((prev) => ({ ...prev, platform: e.target.value }))}
                placeholder="Android, iOS, PC"
                className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Icon & Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Logo / Icon Game</label>
              <ImageUploadInput
                value={editingGame?.iconUrl || ''}
                onChange={(url) => setEditingGame((prev) => ({ ...prev, iconUrl: url }))}
                placeholder="Đường dẫn ảnh hoặc tải lên..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Link Đăng Ký Trước / Tải Trước</label>
              <input
                type="url"
                value={editingGame?.preRegUrl || ''}
                onChange={(e) => setEditingGame((prev) => ({ ...prev, preRegUrl: e.target.value }))}
                placeholder="https://game.vn hoặc link TapTap, Google Play..."
                className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Expected Codes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Danh Sách Giftcode Tân Thủ Dự Kiến</span>
              <span className="text-[10px] text-slate-400">Cách nhau bằng dấu phẩy hoặc xuống dòng</span>
            </label>
            <textarea
              rows={2}
              value={expectedCodesInput}
              onChange={(e) => setExpectedCodesInput(e.target.value)}
              placeholder="Ví dụ: STRINOVAOB, VIP666, TANTHU2026"
              className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Mô Tả & Điểm Nổi Bật</label>
            <textarea
              rows={3}
              value={editingGame?.description || ''}
              onChange={(e) => setEditingGame((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Giới thiệu tóm tắt tính năng, cốt truyện, điểm nhấn của tựa game..."
              className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Trạng thái */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Trạng Thái</label>
            <select
              value={editingGame?.status || 'UPCOMING'}
              onChange={(e) => setEditingGame((prev) => ({ ...prev, status: e.target.value as any }))}
              className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="UPCOMING">🚀 Sắp Ra Mắt (Hiển thị đồng hồ đếm ngược)</option>
              <option value="LAUNCHED">🟢 Đã Mở Server (Đã phát hành)</option>
              <option value="CANCELLED">⚪ Tạm Hoãn / Hủy Lịch</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingGame(null);
              }}
              className="px-4 py-2 rounded-xl bg-card hover:bg-card-hover border border-border text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              {editingGame?.id ? 'Lưu Thay Đổi' : 'Thêm Game Sắp Ra Mắt'}
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
        title="Xác nhận xóa game sắp ra mắt"
        message={
          <span>
            Bạn có chắc chắn muốn xóa game <strong className="text-rose-400">{deletingGame?.name}</strong> khỏi danh sách chuẩn bị ra mắt?
          </span>
        }
        confirmText="Xác nhận xóa"
        variant="danger"
      />
    </div>
  );
};
