import React, { useState, useEffect, useMemo } from 'react';
import {
  KeyRound,
  Key,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Trash2,
  Power,
  AlertTriangle,
  Code2,
  BookOpen,
  RefreshCw,
  Terminal,
  CheckCircle2,
  Clock,
  Newspaper,
  Zap,
  Search,
  Lock,
  Layers,
  Sparkles,
  X,
  Calendar,
  Hourglass,
  Timer,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export type ApiKeyScope = 'NEWS_FULL' | 'MISSIONS_FULL' | 'MISSIONS_REVIEW' | 'ADMIN_FULL';

export interface ManagedApiKey {
  id: string;
  key_name: string;
  key_prefix: string;
  raw_key?: string;
  scope: ApiKeyScope | string;
  description?: string;
  expires_at?: string;
  is_active: number;
  last_used_at?: string;
  created_at: string;
  is_master?: boolean;
}

interface ApiKeysModuleProps {
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ApiKeysModule: React.FC<ApiKeysModuleProps> = ({ onShowToast }) => {
  const [keys, setKeys] = useState<ManagedApiKey[]>([]);
  const [masterKey, setMasterKey] = useState<ManagedApiKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Show/Hide state for keys (id -> boolean)
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Modal Create state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScope, setNewKeyScope] = useState<ApiKeyScope>('NEWS_FULL');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [validityType, setValidityType] = useState<'30' | '90' | '365' | 'permanent' | 'custom'>('30');
  const [customExpiresAt, setCustomExpiresAt] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Modal Extend / Change Expiration
  const [extendingKey, setExtendingKey] = useState<ManagedApiKey | null>(null);
  const [extendDaysOption, setExtendDaysOption] = useState<number>(30);
  const [isExtending, setIsExtending] = useState(false);

  // Modal Newly Generated Key Reveal (Only once)
  const [generatedKeyResult, setGeneratedKeyResult] = useState<{
    key_name: string;
    raw_key: string;
    scope: ApiKeyScope;
    expires_at?: string;
  } | null>(null);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'keys' | 'permissions' | 'docs'>('keys');
  const [docCategory, setDocCategory] = useState<'news' | 'missions' | 'sync'>('news');

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (onShowToast) {
      onShowToast(msg, type);
    }
  };

  const getAuthHeaders = (): Record<string, string> => {
    const token =
      localStorage.getItem('wcg_auth_token') ||
      sessionStorage.getItem('wcg_auth_token') ||
      '';
    const syncKey =
      sessionStorage.getItem('wcg_admin_sync_key') ||
      localStorage.getItem('wcg_admin_sync_key') ||
      'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Sync-Key': syncKey,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const loadApiKeys = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/api-keys', {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setKeys(data.keys || []);
        if (data.master_key) {
          setMasterKey(data.master_key);
        }
      } else {
        showToast(data.message || 'Không thể tải danh sách khóa API', 'error');
      }
    } catch (e: any) {
      showToast('Lỗi kết nối khi tải danh sách khóa API', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
  }, []);

  const handleCopy = (text: string, id: string) => {
    if (!text) {
      showToast('Khóa không có giá trị để sao chép', 'error');
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    showToast('Đã sao chép khóa API vào clipboard!', 'success');
    setTimeout(() => {
      setCopiedKeyId(null);
    }, 2000);
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Helper to compute expiration ISO
  const computeExpirationIso = (): string => {
    if (validityType === 'permanent') return '';
    if (validityType === 'custom') return customExpiresAt;
    const days = parseInt(validityType, 10) || 30;
    return new Date(Date.now() + days * 86400000).toISOString();
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      showToast('Vui lòng nhập tên định danh cho khóa API', 'error');
      return;
    }

    const expiresIso = computeExpirationIso();

    setIsCreating(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          key_name: newKeyName.trim(),
          scope: newKeyScope,
          description: newKeyDescription.trim(),
          expires_at: expiresIso,
        }),
      });

      const data = await res.json();
      if (data.success && data.key) {
        showToast('Khởi tạo khóa API thành công!', 'success');
        setGeneratedKeyResult({
          key_name: data.key.key_name,
          raw_key: data.key.raw_key,
          scope: data.key.scope,
          expires_at: data.key.expires_at,
        });
        setIsCreateModalOpen(false);
        setNewKeyName('');
        setNewKeyDescription('');
        setValidityType('30');
        loadApiKeys();
      } else {
        showToast(data.message || 'Lỗi khi tạo khóa API mới', 'error');
      }
    } catch (e: any) {
      showToast('Lỗi máy chủ khi tạo khóa API', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // Quick Preset Creators
  const handleQuickCreate = (scope: ApiKeyScope, defaultName: string) => {
    setNewKeyScope(scope);
    setNewKeyName(defaultName);
    setValidityType('90');
    setIsCreateModalOpen(true);
  };

  // Toggle Active / Deactivate
  const handleToggleActive = async (keyItem: ManagedApiKey) => {
    const nextState = keyItem.is_active === 1 ? 0 : 1;
    try {
      const res = await fetch(`/api/api-keys/${keyItem.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: nextState }),
      });
      const data = await res.json();
      if (data.success) {
        setKeys((prev) =>
          prev.map((k) => (k.id === keyItem.id ? { ...k, is_active: nextState } : k))
        );
        showToast(
          nextState === 1
            ? `Đã kích hoạt khóa "${keyItem.key_name}"`
            : `Đã vô hiệu hóa khóa "${keyItem.key_name}"`,
          nextState === 1 ? 'success' : 'info'
        );
      } else {
        showToast(data.message || 'Lỗi cập nhật trạng thái khóa API', 'error');
      }
    } catch (e) {
      showToast('Không thể kết nối đến máy chủ', 'error');
    }
  };

  // Extend validity (phân quyền theo thời gian)
  const handleExtendKey = async () => {
    if (!extendingKey) return;
    setIsExtending(true);
    try {
      let nextExpiresAt = '';
      if (extendDaysOption > 0) {
        const base = extendingKey.expires_at
          ? Math.max(Date.now(), new Date(extendingKey.expires_at).getTime())
          : Date.now();
        nextExpiresAt = new Date(base + extendDaysOption * 86400000).toISOString();
      } else {
        nextExpiresAt = ''; // Permanent
      }

      const res = await fetch(`/api/api-keys/${extendingKey.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          expires_at: nextExpiresAt,
          is_active: 1, // Auto re-activate if extended
        }),
      });

      const data = await res.json();
      if (data.success) {
        setKeys((prev) =>
          prev.map((k) =>
            k.id === extendingKey.id ? { ...k, expires_at: nextExpiresAt, is_active: 1 } : k
          )
        );
        showToast(
          extendDaysOption > 0
            ? `Đã gia hạn thêm ${extendDaysOption} ngày cho khóa "${extendingKey.key_name}"!`
            : `Đã chuyển khóa "${extendingKey.key_name}" sang trạng thái Vĩnh viễn!`,
          'success'
        );
        setExtendingKey(null);
      } else {
        showToast(data.message || 'Lỗi gia hạn khóa', 'error');
      }
    } catch (e) {
      showToast('Lỗi kết nối khi gia hạn khóa', 'error');
    } finally {
      setIsExtending(false);
    }
  };

  const handleDeleteKey = async (keyItem: ManagedApiKey) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn thu hồi và XÓA VĨNH VIỄN khóa API "${keyItem.key_name}"? Mọi bot hoặc AI đang dùng khóa này sẽ bị từ chối truy cập ngay lập tức!`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/api-keys/${keyItem.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setKeys((prev) => prev.filter((k) => k.id !== keyItem.id));
        showToast('Đã thu hồi và xóa khóa API thành công!', 'success');
      } else {
        showToast(data.message || 'Lỗi khi xóa khóa API', 'error');
      }
    } catch (e) {
      showToast('Không thể kết nối đến máy chủ', 'error');
    }
  };

  const getScopeBadge = (scope: string) => {
    const s = (scope || '').toUpperCase();
    switch (s) {
      case 'NEWS_FULL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Newspaper className="w-3.5 h-3.5" />
            Toàn Quyền Tin Tức
          </span>
        );
      case 'MISSIONS_FULL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
            <Layers className="w-3.5 h-3.5" />
            Toàn Quyền Nhiệm Vụ
          </span>
        );
      case 'MISSIONS_REVIEW':
      case 'REVIEW_ONLY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Thẩm Định Nhiệm Vụ (AI Pine)
          </span>
        );
      case 'ADMIN_FULL':
      case 'FULL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <Shield className="w-3.5 h-3.5" />
            Toàn Quyền Quản Trị & Đồng Bộ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-500/10 text-slate-500">
            {scope}
          </span>
        );
    }
  };

  // Helper to format time-based permission status
  const formatExpirationInfo = (expiresAt?: string) => {
    if (!expiresAt) {
      return {
        badge: (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="w-3 h-3" />
            Vĩnh Viễn
          </span>
        ),
        text: 'Không giới hạn thời gian',
        isExpired: false,
      };
    }

    const expTime = new Date(expiresAt).getTime();
    if (isNaN(expTime)) {
      return {
        badge: <span className="text-muted-foreground text-xs font-mono">Không xác định</span>,
        text: '',
        isExpired: false,
      };
    }

    const diffMs = expTime - Date.now();
    const isExpired = diffMs <= 0;

    if (isExpired) {
      return {
        badge: (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" />
            ĐÃ HẾT HẠN
          </span>
        ),
        text: `Hết hạn: ${new Date(expTime).toLocaleDateString('vi-VN')}`,
        isExpired: true,
      };
    }

    const daysLeft = Math.ceil(diffMs / 86400000);
    const hoursLeft = Math.ceil(diffMs / 3600000);

    if (daysLeft <= 3) {
      return {
        badge: (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse">
            <Clock className="w-3 h-3" />
            Còn {hoursLeft} giờ
          </span>
        ),
        text: `Hết hạn: ${new Date(expTime).toLocaleDateString('vi-VN')}`,
        isExpired: false,
      };
    }

    return {
      badge: (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <Clock className="w-3 h-3" />
          Còn {daysLeft} ngày
        </span>
      ),
      text: `Hạn: ${new Date(expTime).toLocaleDateString('vi-VN')}`,
      isExpired: false,
    };
  };

  const filteredKeys = useMemo(() => {
    return keys.filter((k) => {
      const matchSearch =
        k.key_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (k.description && k.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        k.key_prefix.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (k.raw_key && k.raw_key.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchScope =
        scopeFilter === 'ALL' ||
        k.scope === scopeFilter ||
        (scopeFilter === 'MISSIONS_REVIEW' && (k.scope === 'REVIEW_ONLY' || k.scope === 'MISSIONS_REVIEW'));

      let matchStatus = true;
      if (statusFilter === 'ACTIVE') matchStatus = k.is_active === 1;
      else if (statusFilter === 'INACTIVE') matchStatus = k.is_active === 0;
      else if (statusFilter === 'EXPIRED') {
        matchStatus = Boolean(k.expires_at && new Date(k.expires_at).getTime() <= Date.now());
      } else if (statusFilter === 'PERMANENT') {
        matchStatus = !k.expires_at;
      }

      return matchSearch && matchScope && matchStatus;
    });
  }, [keys, searchQuery, scopeFilter, statusFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-card to-card/60 p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <KeyRound className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground flex items-center gap-2">
                Quản Lý Khóa API & Phân Quyền Theo Thời Gian
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-medium">
                  v2.5 TIME-SCOPED
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Sao chép nhanh, tạo mới, vô hiệu hóa và cài đặt thời hạn hiệu lực cho từng khóa API
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadApiKeys}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-xs sm:text-sm shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Tạo Khóa API Mới
          </button>
        </div>
      </div>

      {/* Quick Action Presets (Tạo Nhanh 1-Click) */}
      <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Tạo nhanh theo phân quyền:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleQuickCreate('NEWS_FULL', 'Bot Tin Tức 24/7')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all"
          >
            <Plus className="w-3 h-3" />
            + Khóa Tin Tức (90 ngày)
          </button>
          <button
            onClick={() => handleQuickCreate('MISSIONS_FULL', 'Admin Nhiệm Vụ')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all"
          >
            <Plus className="w-3 h-3" />
            + Khóa Nhiệm Vụ (90 ngày)
          </button>
          <button
            onClick={() => handleQuickCreate('MISSIONS_REVIEW', 'Pine AI Thẩm Định')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 transition-all"
          >
            <Plus className="w-3 h-3" />
            + Khóa AI Pine (30 ngày)
          </button>
        </div>
      </div>

      {/* Nav Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('keys')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
            activeTab === 'keys'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Key className="w-4 h-4" />
          Danh Sách Khóa API ({keys.length + (masterKey ? 1 : 0)})
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
            activeTab === 'permissions'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Bảng Chi Tiết Cấp Quyền & Mục Áp Dụng
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
            activeTab === 'docs'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Tài Liệu Tích Hợp & Code Mẫu (cURL / JS)
        </button>
      </div>

      {activeTab === 'keys' && (
        <>
          {/* Spotlight Master Key Card */}
          {masterKey && (
            <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-card to-card p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/30">
                      <Lock className="w-3.5 h-3.5" />
                      Khóa Quản Trị Hệ Thống (Master Key)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      BẢO MẬT TUYỆT ĐỐI • VĨNH VIỄN
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    ADMIN_SYNC_SECRET (Khóa Đồng Bộ Tối Cao)
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-2xl">
                    Cấp toàn quyền tối cao: Đồng bộ dữ liệu 2 chiều D1/KV, sao lưu Master State, toàn quyền tạo/sửa/xóa bài viết tin tức, nhiệm vụ và cấu hình toàn trang.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2 bg-background/80 border border-border px-3.5 py-2 rounded-xl font-mono text-xs max-w-full overflow-hidden shadow-inner">
                    <span className="text-muted-foreground select-none shrink-0">KEY:</span>
                    <span className="text-foreground select-all font-semibold truncate max-w-[200px] sm:max-w-xs">
                      {visibleKeys['master'] ? masterKey.raw_key : masterKey.key_prefix}
                    </span>
                    <button
                      onClick={() => toggleVisibility('master')}
                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title={visibleKeys['master'] ? 'Ẩn mã' : 'Hiện đầy đủ mã'}
                    >
                      {visibleKeys['master'] ? (
                        <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleCopy(masterKey.raw_key || '', 'master')}
                      className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 border border-amber-500/30"
                      title="Sao chép nhanh khóa này"
                    >
                      {copiedKeyId === 'master' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500">Đã Copy!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao Chép Nhanh</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters & Search */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo tên khóa, mô tả, phân quyền..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Quyền:</span>
                {[
                  { id: 'ALL', label: 'Tất Cả' },
                  { id: 'NEWS_FULL', label: 'Tin Tức' },
                  { id: 'MISSIONS_FULL', label: 'Nhiệm Vụ' },
                  { id: 'MISSIONS_REVIEW', label: 'AI Pine' },
                  { id: 'ADMIN_FULL', label: 'Toàn Quyền' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setScopeFilter(filter.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      scopeFilter === filter.id
                        ? 'bg-foreground text-background font-semibold'
                        : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none border-l border-border pl-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Thời hạn:</span>
                {[
                  { id: 'ALL', label: 'Tất Cả' },
                  { id: 'ACTIVE', label: 'Hoạt Động' },
                  { id: 'INACTIVE', label: 'Đã Tắt' },
                  { id: 'EXPIRED', label: 'Hết Hạn' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setStatusFilter(filter.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      statusFilter === filter.id
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Keys Table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">TÊN KHÓA & MÔ TẢ</th>
                    <th className="py-3 px-4">PHÂN QUYỀN</th>
                    <th className="py-3 px-4">KHÓA API (SAO CHÉP / HIỆN 1 PHẦN)</th>
                    <th className="py-3 px-4">HIỆU LỰC (THỜI HẠN)</th>
                    <th className="py-3 px-4 text-center">TRẠNG THÁI</th>
                    <th className="py-3 px-4">LẦN DÙNG</th>
                    <th className="py-3 px-4 text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredKeys.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">Chưa có khóa API nào phù hợp với bộ lọc.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredKeys.map((item) => {
                      const expInfo = formatExpirationInfo(item.expires_at);
                      const keyToCopy = item.raw_key || item.key_prefix.replace('••••••••••••••••••••', '');
                      const isRevealed = visibleKeys[item.id] && item.raw_key;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-muted/20 transition-colors ${
                            expInfo.isExpired || item.is_active === 0 ? 'opacity-70 bg-muted/5' : ''
                          }`}
                        >
                          {/* Name & Desc */}
                          <td className="py-3.5 px-4 font-medium max-w-[220px]">
                            <div className="text-foreground font-semibold flex items-center gap-1.5">
                              <span>{item.key_name}</span>
                              {expInfo.isExpired && (
                                <span className="text-[10px] text-rose-500 font-bold bg-rose-500/10 px-1.5 py-0.2 rounded">
                                  Hết hạn
                                </span>
                              )}
                            </div>
                            {item.description ? (
                              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                {item.description}
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">
                                ID: {item.id}
                              </div>
                            )}
                          </td>

                          {/* Scope */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {getScopeBadge(item.scope)}
                          </td>

                          {/* Key Display & Quick Copy */}
                          <td className="py-3.5 px-4">
                            <div className="inline-flex items-center gap-2 bg-background border border-border/80 px-2.5 py-1.5 rounded-xl font-mono text-xs shadow-inner">
                              <span className="text-foreground select-all font-semibold max-w-[150px] sm:max-w-[200px] truncate">
                                {isRevealed ? item.raw_key : item.key_prefix}
                              </span>

                              {item.raw_key && (
                                <button
                                  onClick={() => toggleVisibility(item.id)}
                                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                                  title={isRevealed ? 'Ẩn mã' : 'Hiện đầy đủ mã'}
                                >
                                  {isRevealed ? (
                                    <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}

                              <button
                                onClick={() => handleCopy(keyToCopy, item.id)}
                                className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs flex items-center gap-1 transition-all shrink-0 border border-primary/20"
                                title="Sao chép nhanh khóa này"
                              >
                                {copiedKeyId === item.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-500" />
                                    <span className="text-emerald-500">Đã Copy!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Expiration (Time-based Permission) */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <div>{expInfo.badge}</div>
                              {expInfo.text && (
                                <div className="text-[10px] text-muted-foreground/80 font-mono">
                                  {expInfo.text}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleToggleActive(item)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                                item.is_active === 1 && !expInfo.isExpired
                                  ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
                              }`}
                              title={item.is_active === 1 ? 'Bấm để vô hiệu hóa' : 'Bấm để kích hoạt lại'}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  item.is_active === 1 && !expInfo.isExpired
                                    ? 'bg-emerald-500 animate-pulse'
                                    : 'bg-rose-500'
                                }`}
                              />
                              {item.is_active === 1 && !expInfo.isExpired ? 'Hoạt Động' : 'Đã Tắt'}
                            </button>
                          </td>

                          {/* Last Used */}
                          <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap font-mono">
                            {item.last_used_at ? (
                              <span title={item.last_used_at}>
                                {new Date(item.last_used_at).toLocaleDateString('vi-VN')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60 italic">Chưa dùng</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Extend button (Phân quyền theo thời gian) */}
                              <button
                                onClick={() => setExtendingKey(item)}
                                className="px-2 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 text-xs font-medium flex items-center gap-1 transition-colors"
                                title="Gia hạn hoặc điều chỉnh thời hạn hiệu lực"
                              >
                                <Hourglass className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Gia Hạn</span>
                              </button>

                              {/* Toggle Active / Deactivate */}
                              <button
                                onClick={() => handleToggleActive(item)}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  item.is_active === 1
                                    ? 'border-amber-500/30 text-amber-500 hover:bg-amber-500/10'
                                    : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                                }`}
                                title={item.is_active === 1 ? 'Vô hiệu hóa khóa này' : 'Kích hoạt lại'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteKey(item)}
                                className="p-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-colors"
                                title="Thu hồi & Xóa vĩnh viễn"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Permissions Breakdown Tab */}
      {activeTab === 'permissions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: News Full */}
          <div className="p-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-500">
                <Newspaper className="w-3.5 h-3.5" />
                NEWS_FULL
              </span>
              <span className="text-xs text-muted-foreground font-mono">Mục: Tin Tức</span>
            </div>
            <h3 className="text-base font-bold text-foreground">Toàn Quyền Mục Tin Tức (News Full Access)</h3>
            <p className="text-xs text-muted-foreground">
              Dành riêng cho bot viết bài tự động, crawler tin game hoặc biên tập viên bên ngoài.
            </p>
            <div className="text-xs space-y-1.5 border-t border-border pt-3">
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span><strong>POST /api/news</strong>: Đăng bài mới hoặc đặt lịch hẹn giờ (SCHEDULED)</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span><strong>PUT /api/news/:id</strong>: Chỉnh sửa nội dung, tiêu đề, ảnh cover, thẻ tags</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span><strong>DELETE /api/news/:id</strong>: Xóa vĩnh viễn và lưu Tombstone chống hồi sinh</span>
              </div>
            </div>
            <div className="bg-background/80 p-2.5 rounded-xl border border-border text-[11px] font-mono text-muted-foreground">
              Header: <span className="text-emerald-500 font-bold">X-API-Key: wcg_news_...</span> hoặc <span className="text-emerald-500 font-bold">Authorization: Bearer ...</span>
            </div>
          </div>

          {/* Card 2: Missions Full */}
          <div className="p-5 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-500">
                <Layers className="w-3.5 h-3.5" />
                MISSIONS_FULL
              </span>
              <span className="text-xs text-muted-foreground font-mono">Mục: Nhiệm Vụ</span>
            </div>
            <h3 className="text-base font-bold text-foreground">Toàn Quyền Quản Lý Nhiệm Vụ (Missions Full)</h3>
            <p className="text-xs text-muted-foreground">
              Dành cho quản lý cấp cao hoặc hệ thống tự động thiết lập chiến dịch nhiệm vụ và phát thưởng.
            </p>
            <div className="text-xs space-y-1.5 border-t border-border pt-3">
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span><strong>POST/PUT/DELETE /api/missions</strong>: Tạo, sửa, đóng nhiệm vụ</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span><strong>POST /api/missions/pools</strong>: Nạp và quản lý kho giftcode trả thưởng</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span><strong>POST /api/missions/ai/review</strong>: Toàn quyền duyệt và từ chối bài nộp</span>
              </div>
            </div>
            <div className="bg-background/80 p-2.5 rounded-xl border border-border text-[11px] font-mono text-muted-foreground">
              Header: <span className="text-indigo-500 font-bold">X-API-Key: wcg_mis_...</span>
            </div>
          </div>

          {/* Card 3: Missions Review (Pine AI) */}
          <div className="p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-500">
                <CheckCircle2 className="w-3.5 h-3.5" />
                MISSIONS_REVIEW
              </span>
              <span className="text-xs text-muted-foreground font-mono">Mục: Thẩm Định AI</span>
            </div>
            <h3 className="text-base font-bold text-foreground">Thẩm Định Nhiệm Vụ Tự Động (AI Pine)</h3>
            <p className="text-xs text-muted-foreground">
              Phạm vi hẹp an toàn: Chỉ được tra cứu danh sách chờ duyệt và gửi kết quả duyệt. Tuyệt đối không can thiệp kho quà.
            </p>
            <div className="text-xs space-y-1.5 border-t border-border pt-3">
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span><strong>GET /api/missions/ai/pending</strong>: Lấy danh sách bài nộp chờ duyệt</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span><strong>POST /api/missions/ai/review</strong>: Duyệt (APPROVED) hoặc Từ chối (REJECTED)</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <X className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Không có quyền sửa cấu trúc nhiệm vụ hay rút kho code</span>
              </div>
            </div>
            <div className="bg-background/80 p-2.5 rounded-xl border border-border text-[11px] font-mono text-muted-foreground">
              Header: <span className="text-amber-500 font-bold">X-API-Key: wcg_ai_...</span>
            </div>
          </div>

          {/* Card 4: Master Full Admin */}
          <div className="p-5 rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/5 to-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-500">
                <Shield className="w-3.5 h-3.5" />
                ADMIN_FULL
              </span>
              <span className="text-xs text-muted-foreground font-mono">Mục: Toàn Sàn</span>
            </div>
            <h3 className="text-base font-bold text-foreground">Toàn Quyền Quản Trị & Đồng Bộ (Master Admin)</h3>
            <p className="text-xs text-muted-foreground">
              Quyền tối cao không giới hạn cho mọi phân hệ, đồng bộ cơ sở dữ liệu và sao lưu toàn hệ thống.
            </p>
            <div className="text-xs space-y-1.5 border-t border-border pt-3">
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span><strong>POST /api/sync</strong>: Đồng bộ hàng loạt mọi danh mục, game, code, sản phẩm</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Bao quát 100% quyền của Tin tức và Nhiệm vụ</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Check className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Toàn quyền thêm, sửa, xóa mọi bảng trong D1 & KV</span>
              </div>
            </div>
            <div className="bg-background/80 p-2.5 rounded-xl border border-border text-[11px] font-mono text-muted-foreground">
              Header: <span className="text-rose-500 font-bold">X-Sync-Key: ...</span> hoặc <span className="text-rose-500 font-bold">X-API-Key: wcg_adm_...</span>
            </div>
          </div>
        </div>
      )}

      {/* Docs & Code Examples Tab */}
      {activeTab === 'docs' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            {[
              { id: 'news', label: '1. API Tin Tức (Đăng, Sửa, Xóa, Lịch Đăng)' },
              { id: 'missions', label: '2. API Nhiệm Vụ (AI Pine Duyệt Bài)' },
              { id: 'sync', label: '3. API Đồng Bộ Toàn Hệ Thống (/api/sync)' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDocCategory(d.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  docCategory === d.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {docCategory === 'news' && (
            <div className="space-y-4 bg-card border border-border p-5 rounded-2xl">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  Mẫu 1: Đăng bài viết mới hoặc Đặt lịch hẹn giờ (cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/news \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY_HERE" \\
  -d '{
    "title": "Tổng Hợp Giftcode Game Mới Tháng 11/2026",
    "content": "Nội dung bài viết chi tiết ở đây...",
    "tags": ["Tin Mới", "Giftcode"],
    "status": "SCHEDULED",
    "scheduled_publish_at": "2026-11-01T08:00:00.000Z"
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-500" />
                  Mẫu 2: Cập nhật / Sửa nội dung bài viết (JavaScript)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`const res = await fetch('https://codegame.shop/api/news/news_123', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_API_KEY_HERE',
  },
  body: JSON.stringify({
    title: 'Tiêu đề bài viết sau khi cập nhật',
    content: 'Nội dung mới...',
    status: 'PUBLISHED'
  })
});
const data = await res.json();
console.log(data);`}
                </pre>
              </div>
            </div>
          )}

          {docCategory === 'missions' && (
            <div className="space-y-4 bg-card border border-border p-5 rounded-2xl">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-500" />
                  Mẫu 1: AI Lấy danh sách bài nộp chờ duyệt (GET /api/missions/ai/pending)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X GET "https://codegame.shop/api/missions/ai/pending?limit=20" \\
  -H "X-API-Key: YOUR_AI_KEY_HERE"`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-amber-500" />
                  Mẫu 2: AI Gửi kết quả duyệt bài (POST /api/missions/ai/review)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`const res = await fetch('https://codegame.shop/api/missions/ai/review', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_AI_KEY_HERE',
  },
  body: JSON.stringify({
    submission_id: 'sub_123456789',
    decision: 'APPROVED', // hoặc 'REJECTED'
    reason: 'Link bài đăng hợp lệ trên nhóm, đủ hashtag yêu cầu.',
    ai_confidence: 0.98
  })
});
const result = await res.json();
console.log(result);`}
                </pre>
              </div>
            </div>
          )}

          {docCategory === 'sync' && (
            <div className="space-y-4 bg-card border border-border p-5 rounded-2xl">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-rose-500" />
                  Mẫu: Đồng bộ toàn bộ dữ liệu qua Master API (POST /api/sync)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/sync \\
  -H "Content-Type: application/json" \\
  -H "X-Sync-Key: YOUR_MASTER_KEY_HERE" \\
  -d '{
    "newsArticles": [...],
    "missions": [...]
  }'`}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Create API Key with Time-based Expiration */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Tạo Khóa API & Phân Quyền Theo Thời Gian</h3>
                  <p className="text-xs text-muted-foreground">Cấp quyền hạn chế an toàn và thời hạn tự động thu hồi</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Tên Định Danh Khóa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Pine AI Agent, Bot Cào Tin Tức, Auto Publisher..."
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Cấp Quyền & Mục Áp Dụng <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    {
                      id: 'NEWS_FULL',
                      title: 'Toàn Quyền Tin Tức (NEWS_FULL)',
                      desc: 'Đăng bài, sửa nội dung, xóa bài, đặt lịch hẹn đăng bài viết.',
                      icon: Newspaper,
                      color: 'text-emerald-500 border-emerald-500/30',
                    },
                    {
                      id: 'MISSIONS_FULL',
                      title: 'Toàn Quyền Nhiệm Vụ (MISSIONS_FULL)',
                      desc: 'Quản lý nhiệm vụ, duyệt bài nộp, nạp kho mã code trả thưởng.',
                      icon: Layers,
                      color: 'text-indigo-500 border-indigo-500/30',
                    },
                    {
                      id: 'MISSIONS_REVIEW',
                      title: 'Thẩm Định Nhiệm Vụ (MISSIONS_REVIEW)',
                      desc: 'Chỉ tra cứu danh sách chờ duyệt & gửi kết quả thẩm định (AI Pine).',
                      icon: CheckCircle2,
                      color: 'text-amber-500 border-amber-500/30',
                    },
                    {
                      id: 'ADMIN_FULL',
                      title: 'Toàn Quyền Quản Trị & Đồng Bộ (ADMIN_FULL)',
                      desc: 'Toàn quyền tối cao, kiểm soát toàn diện mọi endpoint & sync.',
                      icon: Shield,
                      color: 'text-rose-500 border-rose-500/30',
                    },
                  ].map((s) => {
                    const Icon = s.icon;
                    const isSelected = newKeyScope === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setNewKeyScope(s.id as ApiKeyScope)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? `bg-primary/5 border-primary shadow-sm ${s.color}`
                            : 'bg-background/60 border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${isSelected ? '' : 'text-muted-foreground'}`} />
                          <div className="flex-1">
                            <div className="text-xs font-bold text-foreground flex items-center justify-between">
                              <span>{s.title}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Time-based Permission (Thời Hạn Hiệu Lực) */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                  <Hourglass className="w-3.5 h-3.5 text-indigo-400" />
                  Phân Quyền Theo Thời Gian (Thời Hạn Hiệu Lực)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-2">
                  {[
                    { id: '30', label: '30 Ngày' },
                    { id: '90', label: '90 Ngày' },
                    { id: '365', label: '1 Năm' },
                    { id: 'permanent', label: 'Vĩnh Viễn' },
                    { id: 'custom', label: 'Tự Chọn' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setValidityType(opt.id as any)}
                      className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all ${
                        validityType === opt.id
                          ? 'bg-foreground text-background font-bold border-foreground shadow-sm'
                          : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {validityType === 'custom' && (
                  <div className="mt-2">
                    <input
                      type="datetime-local"
                      value={customExpiresAt}
                      onChange={(e) => setCustomExpiresAt(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Khóa sẽ tự động ngắt quyền truy cập đúng vào thời điểm trên.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Mô Tả / Ghi Chú Sử Dụng (Không bắt buộc)
                </label>
                <textarea
                  placeholder="Ghi rõ ai đang sử dụng hoặc mục đích tích hợp của khóa này..."
                  value={newKeyDescription}
                  onChange={(e) => setNewKeyDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-xs sm:text-sm font-medium transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang Khởi Tạo...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Xác Nhận Tạo Khóa
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Extend / Modify Expiration (Gia Hạn Khóa) */}
      {extendingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Hourglass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Gia Hạn Hiệu Lực Khóa API</h3>
                  <p className="text-xs text-muted-foreground">Phân quyền theo thời gian cho "{extendingKey.key_name}"</p>
                </div>
              </div>
              <button
                onClick={() => setExtendingKey(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs space-y-1">
                <div className="text-muted-foreground">Thời hạn hiện tại:</div>
                <div className="font-semibold text-foreground">
                  {extendingKey.expires_at
                    ? new Date(extendingKey.expires_at).toLocaleString('vi-VN')
                    : 'Vĩnh viễn (Không thời hạn)'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  Chọn thời gian gia hạn thêm:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { days: 7, label: '+7 Ngày' },
                    { days: 30, label: '+30 Ngày (Khuyên dùng)' },
                    { days: 90, label: '+90 Ngày' },
                    { days: 0, label: 'Đặt Vĩnh Viễn' },
                  ].map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setExtendDaysOption(opt.days)}
                      className={`p-3 rounded-xl text-xs font-medium border text-center transition-all ${
                        extendDaysOption === opt.days
                          ? 'bg-primary text-primary-foreground font-bold border-primary shadow-sm'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setExtendingKey(null)}
                  className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-xs font-medium"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={handleExtendKey}
                  disabled={isExtending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium text-xs shadow-md transition-all flex items-center gap-2"
                >
                  {isExtending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang Xử Lý...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Lưu & Gia Hạn Ngay
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reveal Newly Generated Raw Key */}
      {generatedKeyResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-card rounded-2xl border-2 border-emerald-500/50 shadow-2xl overflow-hidden">
            <div className="p-6 bg-gradient-to-br from-emerald-500/10 via-card to-card space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-500">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Khởi Tạo Khóa API Thành Công!</h3>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>Khóa: <strong>{generatedKeyResult.key_name}</strong></span>
                    <span>•</span>
                    {getScopeBadge(generatedKeyResult.scope)}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2.5 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                <span>
                  Khóa API đã sẵn sàng! Bạn có thể <strong>Sao chép nhanh</strong> ngay bên dưới. Khóa này cũng được lưu trực tiếp vào danh sách Quản lý để bạn có thể xem lại hoặc sao chép bất cứ lúc nào.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Khóa API Hoàn Chỉnh:
                </label>
                <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-border">
                  <code className="text-emerald-400 font-mono text-xs sm:text-sm select-all break-all flex-1">
                    {generatedKeyResult.raw_key}
                  </code>
                  <button
                    onClick={() => handleCopy(generatedKeyResult.raw_key, 'newly_generated')}
                    className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 shadow-sm"
                  >
                    {copiedKeyId === 'newly_generated' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Đã Copy!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Sao Chép
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setGeneratedKeyResult(null)}
                  className="px-5 py-2.5 rounded-xl bg-foreground text-background font-semibold text-xs sm:text-sm hover:opacity-90 transition-opacity"
                >
                  Hoàn Tất & Xem Danh Sách
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
