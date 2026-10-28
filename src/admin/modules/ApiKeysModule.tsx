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
} from 'lucide-react';

export type ApiKeyScope = 'NEWS_FULL' | 'MISSIONS_FULL' | 'MISSIONS_REVIEW' | 'ADMIN_FULL';

export interface ManagedApiKey {
  id: string;
  key_name: string;
  key_prefix: string;
  scope: ApiKeyScope | string;
  description?: string;
  is_active: number;
  last_used_at?: string;
  created_at: string;
  is_master?: boolean;
  raw_key?: string;
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

  // Show/Hide state for keys (id -> boolean)
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Modal Create state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScope, setNewKeyScope] = useState<ApiKeyScope>('NEWS_FULL');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Modal Newly Generated Key Reveal (Only once)
  const [generatedKeyResult, setGeneratedKeyResult] = useState<{
    key_name: string;
    raw_key: string;
    scope: ApiKeyScope;
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

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      showToast('Vui lòng nhập tên định danh cho khóa API', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          key_name: newKeyName.trim(),
          scope: newKeyScope,
          description: newKeyDescription.trim(),
        }),
      });

      const data = await res.json();
      if (data.success && data.key) {
        showToast('Khởi tạo khóa API thành công!', 'success');
        setGeneratedKeyResult({
          key_name: data.key.key_name,
          raw_key: data.key.raw_key,
          scope: data.key.scope,
        });
        setIsCreateModalOpen(false);
        setNewKeyName('');
        setNewKeyDescription('');
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
        showToast(nextState === 1 ? 'Đã kích hoạt khóa API' : 'Đã tạm vô hiệu hóa khóa API', 'info');
      } else {
        showToast(data.message || 'Lỗi cập nhật trạng thái khóa API', 'error');
      }
    } catch (e) {
      showToast('Không thể kết nối đến máy chủ', 'error');
    }
  };

  const handleDeleteKey = async (keyItem: ManagedApiKey) => {
    if (!window.confirm(`Bạn có chắc chắn muốn thu hồi và XÓA VĨNH VIỄN khóa API "${keyItem.key_name}"? Mọi ứng dụng đang dùng khóa này sẽ bị từ chối truy cập ngay lập tức!`)) {
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

  const filteredKeys = useMemo(() => {
    return keys.filter((k) => {
      const matchSearch =
        k.key_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (k.description && k.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        k.key_prefix.toLowerCase().includes(searchQuery.toLowerCase());

      const matchScope =
        scopeFilter === 'ALL' ||
        k.scope === scopeFilter ||
        (scopeFilter === 'MISSIONS_REVIEW' && (k.scope === 'REVIEW_ONLY' || k.scope === 'MISSIONS_REVIEW'));

      return matchSearch && matchScope;
    });
  }, [keys, searchQuery, scopeFilter]);

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
                Quản Lý Khóa API & Phân Quyền Hệ Thống
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-medium">
                  v2.0 PRO
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Cấp quyền chi tiết cho AI tự động (Pine AI), bot cào tin tức và đối tác tích hợp ngoài
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
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
                      BẢO MẬT TUYỆT ĐỐI
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
                      {visibleKeys['master']
                        ? masterKey.raw_key
                        : masterKey.key_prefix}
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
                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-emerald-500 transition-colors shrink-0"
                      title="Sao chép khóa đầy đủ"
                    >
                      {copiedKeyId === 'master' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo tên khóa, mô tả hoặc tiền tố..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Lọc quyền:</span>
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    scopeFilter === filter.id
                      ? 'bg-foreground text-background font-semibold'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Keys Table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">TÊN KHÓA & MÔ TẢ</th>
                    <th className="py-3 px-4">MỤC & CẤP QUYỀN</th>
                    <th className="py-3 px-4">KHÓA API (ẨN / HIỆN 1 PHẦN)</th>
                    <th className="py-3 px-4 text-center">TRẠNG THÁI</th>
                    <th className="py-3 px-4">LẦN DÙNG CUỐI</th>
                    <th className="py-3 px-4 text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredKeys.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">Chưa có khóa API nào phù hợp.</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Bấm nút <strong>"+ Tạo Khóa API Mới"</strong> để cấp quyền cho Tin tức, Nhiệm vụ hoặc AI.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredKeys.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3.5 px-4 font-medium">
                          <div className="text-foreground font-semibold">{item.key_name}</div>
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
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getScopeBadge(item.scope)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 bg-background border border-border/80 px-2.5 py-1.5 rounded-lg font-mono text-xs">
                            <span className="text-foreground select-all">
                              {item.key_prefix}
                            </span>
                            <button
                              onClick={() => handleCopy(item.key_prefix.replace('••••••••••••••••••••', ''), item.id)}
                              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-emerald-500 transition-colors ml-1"
                              title="Sao chép tiền tố khóa"
                            >
                              {copiedKeyId === item.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleToggleActive(item)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                              item.is_active === 1
                                ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
                            }`}
                            title="Bấm để bật / tắt hoạt động"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.is_active === 1 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                              }`}
                            />
                            {item.is_active === 1 ? 'Hoạt Động' : 'Đã Tắt'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap font-mono">
                          {item.last_used_at ? (
                            <span title={item.last_used_at}>
                              {new Date(item.last_used_at).toLocaleDateString('vi-VN')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic">Chưa dùng</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleActive(item)}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                item.is_active === 1
                                  ? 'border-amber-500/30 text-amber-500 hover:bg-amber-500/10'
                                  : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                              }`}
                              title={item.is_active === 1 ? 'Tạm vô hiệu hóa' : 'Kích hoạt'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
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
                    ))
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
                <span><strong>POST /api/missions/ai/review</strong>: Duyệt duyệt (APPROVED) hoặc Từ chối (REJECTED)</span>
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

      {/* Modal: Create API Key */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Tạo Khóa API Mới</h3>
                  <p className="text-xs text-muted-foreground">Cấp quyền hạn chế an toàn cho từng ứng dụng</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="p-5 space-y-4">
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
                <div className="grid grid-cols-1 gap-2.5">
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
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? `bg-primary/5 border-primary shadow-sm ${s.color}`
                            : 'bg-background/60 border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
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

      {/* Modal: Reveal Newly Generated Raw Key (One-time only!) */}
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

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-start gap-2.5 leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>CẢNH BÁO BẢO MẬT QUAN TRỌNG:</strong> Khóa đầy đủ bên dưới <strong>CHỈ HIỂN THỊ MỘT LẦN DUY NHẤT</strong>. Sau khi đóng cửa sổ này, bạn sẽ không thể xem lại mã bí mật này nữa!
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
                    className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0"
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
                  Tôi Đã Lưu Khóa Này
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
