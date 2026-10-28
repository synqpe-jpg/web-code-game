import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Gift,
  Wallet,
  Bot,
  Key,
  FileText,
  AlertTriangle,
  RefreshCw,
  Search,
  Check,
  Copy,
  Zap,
  Shield,
  Layers,
  HelpCircle,
} from 'lucide-react';
import type {
  Mission,
  MissionSubmission,
  MissionAiApiKey,
  MissionAuditLog,
  MissionRewardCode,
} from '../../types/mission';
import { missionService } from '../../services/missionService';

export const MissionsModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'missions' | 'submissions' | 'pools' | 'ai_keys'>('missions');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- Missions State ---
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<Partial<Mission> | null>(null);

  // --- Submissions State ---
  const [submissions, setSubmissions] = useState<MissionSubmission[]>([]);
  const [filterMissionId, setFilterMissionId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [rejectingSubId, setRejectingSubId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // --- Reward Pools State ---
  const [selectedPoolMissionId, setSelectedPoolMissionId] = useState<string>('');
  const [poolCodes, setPoolCodes] = useState<MissionRewardCode[]>([]);
  const [poolStats, setPoolStats] = useState<{ total: number; available: number; claimed: number } | null>(null);
  const [rawCodesInput, setRawCodesInput] = useState<string>('');

  // --- AI Keys & Logs State ---
  const [aiKeys, setAiKeys] = useState<MissionAiApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [generatedRawKey, setGeneratedRawKey] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<MissionAuditLog[]>([]);
  const [isCopiedKey, setIsCopiedKey] = useState(false);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // 1. Fetch Missions
  const loadMissions = async () => {
    setIsLoading(true);
    try {
      const res = await missionService.getMissions(true);
      if (res.success) {
        setMissions(res.missions);
        if (!selectedPoolMissionId && res.missions.length > 0) {
          const codeMission = res.missions.find((m) => m.reward_type === 'CODE');
          if (codeMission) setSelectedPoolMissionId(codeMission.id);
        }
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Lỗi tải danh sách nhiệm vụ.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch Submissions
  const loadSubmissions = async () => {
    setIsLoading(true);
    try {
      const res = await missionService.getAdminSubmissions(filterMissionId, filterStatus);
      if (res.success) {
        setSubmissions(res.submissions);
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Lỗi tải hàng chờ duyệt.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Fetch Pool Codes
  const loadPoolCodes = async (missionId: string) => {
    if (!missionId) return;
    setIsLoading(true);
    try {
      const res = await missionService.getRewardPool(missionId);
      if (res.success) {
        setPoolCodes(res.codes);
        setPoolStats(res.stats);
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Lỗi tải kho mã.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Fetch AI Keys & Audit Logs
  const loadAiKeysAndLogs = async () => {
    setIsLoading(true);
    try {
      const [keysRes, logsRes] = await Promise.all([
        missionService.getAiKeys(),
        missionService.getAuditLogs(),
      ]);
      if (keysRes.success) setAiKeys(keysRes.keys);
      if (logsRes.success) setAuditLogs(logsRes.logs);
    } catch (err: any) {
      showNotification('error', err?.message || 'Lỗi tải khóa AI và nhật ký.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'missions') loadMissions();
    else if (activeTab === 'submissions') loadSubmissions();
    else if (activeTab === 'pools') {
      if (missions.length === 0) loadMissions();
      else if (selectedPoolMissionId) loadPoolCodes(selectedPoolMissionId);
    } else if (activeTab === 'ai_keys') loadAiKeysAndLogs();
  }, [activeTab, filterMissionId, filterStatus]);

  useEffect(() => {
    if (activeTab === 'pools' && selectedPoolMissionId) {
      loadPoolCodes(selectedPoolMissionId);
    }
  }, [selectedPoolMissionId]);

  // --- Handlers: Missions CRUD ---
  const handleOpenCreateMission = () => {
    setEditingMission({
      title: '',
      description: '',
      task_type: 'POST_SHARE_GROUP_PAGE',
      target_channel_name: '',
      target_channel_url: '',
      guide_steps: [
        'Truy cập vào nhóm/trang theo liên kết được cung cấp.',
        'Đăng một bài viết giới thiệu sàn CodeGame.Shop kèm nội dung yêu cầu.',
        'Lấy đường link bài đăng đã công khai và dán vào ô bằng chứng bên dưới.',
      ],
      content_requirements: 'Bài viết có ít nhất 15 từ, kèm hashtag #codegameshop #choigame và ảnh minh họa sàn.',
      reward_type: 'CODE',
      reward_value: 10000,
      quota: 50,
      min_account_age_days: 0,
      max_resubmissions: 2,
      review_mode: 'AI_ASSISTED',
      ai_prompt_guidelines: 'Kiểm tra xem link có công khai không, nội dung có hashtag #codegameshop và ảnh game hay không.',
      allowed_domains: 'facebook.com,fb.com,fb.watch',
      recurrence_type: 'ONCE',
      status: 'ACTIVE',
      sort_order: 0,
    });
    setIsMissionModalOpen(true);
  };

  const handleSaveMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMission || !editingMission.title?.trim()) {
      showNotification('error', 'Vui lòng nhập tiêu đề nhiệm vụ.');
      return;
    }

    setIsLoading(true);
    try {
      if (editingMission.id) {
        const res = await missionService.updateMission(editingMission.id, editingMission);
        if (res.success) {
          showNotification('success', 'Cập nhật nhiệm vụ thành công!');
          setIsMissionModalOpen(false);
          loadMissions();
        } else {
          showNotification('error', res.message || 'Lỗi cập nhật.');
        }
      } else {
        const res = await missionService.createMission(editingMission);
        if (res.success) {
          showNotification('success', 'Tạo nhiệm vụ mới thành công!');
          setIsMissionModalOpen(false);
          loadMissions();
        } else {
          showNotification('error', res.message || 'Lỗi tạo nhiệm vụ.');
        }
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Lỗi lưu nhiệm vụ.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMission = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này? (Chỉ xóa được khi chưa có bài nộp)')) return;
    setIsLoading(true);
    try {
      const res = await missionService.deleteMission(id);
      if (res.success) {
        showNotification('success', 'Xóa nhiệm vụ thành công!');
        loadMissions();
      } else {
        showNotification('error', res.message || 'Không thể xóa.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Lỗi khi xóa.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers: Submissions Review ---
  const handleApprove = async (subId: string) => {
    setIsLoading(true);
    try {
      const res = await missionService.reviewSubmission(subId, 'APPROVE');
      if (res.success) {
        showNotification('success', `Duyệt thành công! Đã trao thưởng: ${res.rewardDelivered || ''}`);
        loadSubmissions();
      } else {
        showNotification('error', res.message || 'Lỗi duyệt hồ sơ.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Lỗi mạng.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingSubId) return;
    setIsLoading(true);
    try {
      const res = await missionService.reviewSubmission(rejectingSubId, 'REJECT', rejectionReason);
      if (res.success) {
        showNotification('success', 'Đã từ chối bài nộp.');
        setRejectingSubId(null);
        setRejectionReason('');
        loadSubmissions();
      } else {
        showNotification('error', res.message || 'Lỗi khi từ chối.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Lỗi mạng.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchApproveAi = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn duyệt nhanh TẤT CẢ các hồ sơ mà AI đã đề xuất "Nên Duyệt"?')) return;
    setIsLoading(true);
    try {
      const res = await missionService.batchApproveAi(filterMissionId);
      if (res.success) {
        showNotification('success', res.message || `Đã duyệt ${res.successCount} hồ sơ theo AI.`);
        loadSubmissions();
      } else {
        showNotification('error', res.message || 'Lỗi khi duyệt hàng loạt.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Lỗi mạng.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers: Reward Pool ---
  const handleImportCodes = async () => {
    if (!selectedPoolMissionId) {
      showNotification('error', 'Vui lòng chọn nhiệm vụ.');
      return;
    }
    if (!rawCodesInput.trim()) {
      showNotification('error', 'Vui lòng dán danh sách mã code.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await missionService.importRewardCodes(selectedPoolMissionId, rawCodesInput.trim());
      if (res.success) {
        showNotification('success', `Đã nạp thành công ${res.count} mã vào kho!`);
        setRawCodesInput('');
        loadPoolCodes(selectedPoolMissionId);
      } else {
        showNotification('error', res.message || 'Lỗi nạp mã.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Lỗi mạng.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers: AI Keys ---
  const handleCreateAiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      showNotification('error', 'Vui lòng nhập tên cho khóa AI.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await missionService.createAiKey(newKeyName.trim());
      if (res.success && res.rawKey) {
        setGeneratedRawKey(res.rawKey);
        setNewKeyName('');
        showNotification('success', 'Đã tạo khóa API thành công! Hãy lưu lại khóa ngay.');
        loadAiKeysAndLogs();
      } else {
        showNotification('error', res.message || 'Lỗi tạo khóa API.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Lỗi mạng.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAiKey = async (id: string, currentStatus: number) => {
    setIsLoading(true);
    try {
      const res = await missionService.toggleAiKey(id, currentStatus === 0);
      if (res.success) {
        showNotification('success', 'Đã thay đổi trạng thái khóa API.');
        loadAiKeysAndLogs();
      } else {
        showNotification('error', res.message || 'Lỗi cập nhật.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Lỗi mạng.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAiKey = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa khóa API này?')) return;
    setIsLoading(true);
    try {
      const res = await missionService.deleteAiKey(id);
      if (res.success) {
        showNotification('success', 'Đã xóa khóa API.');
        loadAiKeysAndLogs();
      } else {
        showNotification('error', res.message || 'Lỗi xóa khóa.');
      }
    } catch (err: any) {
      showNotification('error', err?.message || 'Lỗi mạng.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-500/90 text-white backdrop-blur border border-emerald-400/40'
              : 'bg-rose-500/90 text-white backdrop-blur border border-rose-400/40'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/20 text-primary-light">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground">
              Quản Lý Nhiệm Vụ & Duyệt Bài (Missions)
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Thiết lập nhiệm vụ làm bài nhận mã/tiền ví, hàng chờ duyệt quản trị và API cho AI tự duyệt.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-muted/60 p-1.5 rounded-2xl border border-border/80 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('missions')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'missions' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Nhiệm Vụ ({missions.length})
          </button>

          <button
            onClick={() => setActiveTab('submissions')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'submissions' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Hàng Chờ Duyệt
          </button>

          <button
            onClick={() => setActiveTab('pools')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'pools' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Kho Mã Thưởng
          </button>

          <button
            onClick={() => setActiveTab('ai_keys')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ai_keys' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Khóa AI & Nhật Ký
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: DANH SÁCH NHIỆM VỤ (CRUD)                          */}
      {/* ========================================================= */}
      {activeTab === 'missions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Tổng cộng: <strong className="text-foreground">{missions.length}</strong> nhiệm vụ
            </span>

            <button
              onClick={handleOpenCreateMission}
              className="cg-btn cg-btn--primary flex items-center gap-1.5 text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Nhiệm Vụ Mới</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3.5">Tiêu đề / Loại</th>
                  <th className="p-3.5">Kênh đích</th>
                  <th className="p-3.5">Phần thưởng</th>
                  <th className="p-3.5">Tiến độ Quota</th>
                  <th className="p-3.5">Chế độ duyệt</th>
                  <th className="p-3.5">Trạng thái</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {missions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Chưa có nhiệm vụ nào. Nhấn "Tạo Nhiệm Vụ Mới" để bắt đầu!
                    </td>
                  </tr>
                ) : (
                  missions.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5 min-w-[200px]">
                        <span className="font-bold text-foreground text-sm block">{m.title}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tight">
                          {m.task_type}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {m.target_channel_url ? (
                          <a
                            href={m.target_channel_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 max-w-[150px] truncate"
                          >
                            <span className="truncate">{m.target_channel_name || 'Liên kết'}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        {m.reward_type === 'CODE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold text-[11px]">
                            <Gift className="w-3 h-3" />
                            Mã Code (Còn {m.available_codes_count || 0})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-[11px]">
                            <Wallet className="w-3 h-3" />
                            +{(Number(m.reward_value) || 0).toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-foreground">
                          {m.completed_count} / {m.quota}
                        </span>
                        <div className="w-20 h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${Math.min(100, Math.round(((m.completed_count || 0) / (m.quota || 1)) * 100))}%`,
                            }}
                          />
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className="text-[11px] font-semibold text-slate-300">
                          {m.review_mode === 'AI_AUTO'
                            ? '⚡ AI Tự Duyệt'
                            : m.review_mode === 'AI_ASSISTED'
                            ? '🤖 AI Hỗ Trợ'
                            : '👤 Duyệt Tay'}
                        </span>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : m.status === 'PAUSED'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {m.status === 'ACTIVE' ? 'Đang Mở' : m.status === 'PAUSED' ? 'Tạm Dừng' : 'Đã Đóng'}
                        </span>
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap space-x-1">
                        <button
                          onClick={() => {
                            setEditingMission(m);
                            setIsMissionModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Sửa nhiệm vụ"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteMission(m.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-colors"
                          title="Xóa nhiệm vụ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: HÀNG CHỜ DUYỆT (SUBMISSIONS QUEUE)                 */}
      {/* ========================================================= */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          {/* Filters & Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterMissionId}
                onChange={(e) => setFilterMissionId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-card border border-border/80 text-xs text-foreground focus:outline-none"
              >
                <option value="all">Tất cả nhiệm vụ</option>
                {missions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-card border border-border/80 text-xs text-foreground focus:outline-none"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="PENDING">Đang chờ duyệt</option>
                <option value="NEEDS_HUMAN">Cần người kiểm tra</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="REJECTED">Đã từ chối</option>
              </select>

              <button
                onClick={loadSubmissions}
                className="p-2 rounded-xl bg-card border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Làm mới"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <button
              onClick={handleBatchApproveAi}
              className="cg-btn cg-btn--small bg-primary hover:bg-primary-hover text-white flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Duyệt nhanh theo AI (Nên Duyệt)</span>
            </button>
          </div>

          {/* Submissions Table */}
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3.5">Người nộp / Thời gian</th>
                  <th className="p-3.5">Nhiệm vụ</th>
                  <th className="p-3.5">Link bài đăng & Ghi chú</th>
                  <th className="p-3.5">Đề xuất của AI</th>
                  <th className="p-3.5">Trạng thái / Phần thưởng</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Không có hồ sơ nào trong hàng chờ.
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3.5 whitespace-nowrap">
                        <strong className="text-foreground block">{sub.user_name || 'Thành viên'}</strong>
                        <span className="text-[11px] text-muted-foreground block">{sub.user_email}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(sub.created_at).toLocaleString('vi-VN')}
                        </span>
                      </td>

                      <td className="p-3.5 min-w-[150px]">
                        <span className="font-semibold text-foreground block line-clamp-1">
                          {sub.mission_title || sub.mission_id}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          Nộp lại: {sub.resubmission_count} lần
                        </span>
                      </td>

                      <td className="p-3.5 min-w-[200px]">
                        <a
                          href={sub.proof_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-mono break-all inline-flex items-center gap-1"
                        >
                          <span className="line-clamp-1">{sub.proof_link}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        {sub.proof_note && (
                          <span className="text-[11px] text-muted-foreground block mt-0.5">
                            Ghi chú: {sub.proof_note}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 min-w-[160px]">
                        {sub.ai_recommendation ? (
                          <div className="space-y-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                                sub.ai_recommendation === 'APPROVE'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : sub.ai_recommendation === 'REJECT'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {sub.ai_recommendation === 'APPROVE'
                                ? '✓ AI: Nên Duyệt'
                                : sub.ai_recommendation === 'REJECT'
                                ? '✗ AI: Nên Từ Chối'
                                : '⚠ AI: Cần Người Xem'}
                            </span>
                            {sub.ai_reason && (
                              <p className="text-[11px] text-slate-300 line-clamp-2 leading-tight">
                                {sub.ai_reason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Chưa quét</span>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold block w-fit ${
                            sub.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : sub.status === 'REJECTED'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {sub.status === 'APPROVED'
                            ? 'Đã Duyệt'
                            : sub.status === 'REJECTED'
                            ? 'Bị Từ Chối'
                            : 'Chờ Duyệt'}
                        </span>
                        {sub.reward_delivered && (
                          <span className="text-[11px] text-emerald-400 font-mono font-bold block mt-1">
                            {sub.reward_delivered}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap space-x-1">
                        {sub.status === 'PENDING' ? (
                          <>
                            <button
                              onClick={() => handleApprove(sub.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold text-xs transition-colors"
                            >
                              Duyệt
                            </button>
                            <button
                              onClick={() => {
                                setRejectingSubId(sub.id);
                                setRejectionReason('Link bài đăng không đạt yêu cầu theo quy định của nhiệm vụ.');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-bold text-xs transition-colors"
                            >
                              Từ chối
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {sub.reviewed_by ? `Bởi ${sub.reviewed_by}` : 'Đã xử lý'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: KHO MÃ THƯỞNG (CODE POOLS)                         */}
      {/* ========================================================= */}
      {activeTab === 'pools' && (
        <div className="space-y-6">
          {/* Select Mission */}
          <div className="p-4 rounded-2xl bg-card border border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">Chọn Nhiệm Vụ Cần Quản Lý Kho Mã:</label>
              <select
                value={selectedPoolMissionId}
                onChange={(e) => setSelectedPoolMissionId(e.target.value)}
                className="w-full sm:w-80 px-3 py-2 rounded-xl bg-muted/60 border border-border/80 text-xs text-foreground focus:outline-none"
              >
                {missions
                  .filter((m) => m.reward_type === 'CODE')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
              </select>
            </div>

            {poolStats && (
              <div className="flex items-center gap-3">
                <div className="text-center px-4 py-2 rounded-xl bg-muted/40 border border-border/60">
                  <span className="text-[10px] text-muted-foreground block">Tổng mã</span>
                  <strong className="text-sm font-mono text-foreground">{poolStats.total}</strong>
                </div>
                <div className="text-center px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-400 block">Khả dụng</span>
                  <strong className="text-sm font-mono text-emerald-400">{poolStats.available}</strong>
                </div>
                <div className="text-center px-4 py-2 rounded-xl bg-muted/40 border border-border/60">
                  <span className="text-[10px] text-muted-foreground block">Đã trao</span>
                  <strong className="text-sm font-mono text-foreground">{poolStats.claimed}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Import Codes Form */}
          <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Nạp Mã Mới Vào Kho (Mỗi dòng 1 mã)
            </h3>
            <textarea
              rows={4}
              placeholder="CODE-AAA-111&#10;CODE-BBB-222&#10;CODE-CCC-333"
              value={rawCodesInput}
              onChange={(e) => setRawCodesInput(e.target.value)}
              className="w-full p-3 rounded-xl bg-muted/40 border border-border/80 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={handleImportCodes}
              disabled={isLoading || !rawCodesInput.trim()}
              className="cg-btn cg-btn--primary text-xs font-bold"
            >
              Nạp Vào Kho
            </button>
          </div>

          {/* List of Codes in Pool */}
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3.5">Mã Code</th>
                  <th className="p-3.5">Trạng thái</th>
                  <th className="p-3.5">Người nhận / Thời gian trao</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {poolCodes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      Kho chưa có mã nào. Hãy dán mã vào ô trên để nạp!
                    </td>
                  </tr>
                ) : (
                  poolCodes.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20">
                      <td className="p-3.5 font-mono font-bold text-foreground select-all">
                        {c.code_content}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'AVAILABLE'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {c.status === 'AVAILABLE' ? 'Khả dụng' : 'Đã trao'}
                        </span>
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        {c.claimed_by_user_id ? (
                          <div>
                            <span className="text-foreground block">{c.claimed_by_user_id}</span>
                            <span className="text-[10px]">{c.claimed_at}</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        {c.status === 'AVAILABLE' && (
                          <button
                            onClick={async () => {
                              if (window.confirm('Xóa mã này khỏi kho?')) {
                                await missionService.deleteRewardCode(c.id);
                                loadPoolCodes(selectedPoolMissionId);
                              }
                            }}
                            className="text-rose-400 hover:underline text-[11px]"
                          >
                            Xóa
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: KHÓA AI & NHẬT KÝ KIỂM TOÁN                        */}
      {/* ========================================================= */}
      {activeTab === 'ai_keys' && (
        <div className="space-y-6">
          {/* Generated Raw Key Popup Alert */}
          {generatedRawKey && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Key className="w-4 h-4" />
                <span>Khóa API AI đã được tạo thành công! (Chỉ hiển thị 1 lần duy nhất)</span>
              </div>
              <p className="text-xs text-amber-200/80">
                Hãy sao chép và lưu trữ mã khóa an toàn để tích hợp vào Pine AI hoặc bot bên ngoài. Hệ thống sẽ không hiển thị lại mã bí mật này.
              </p>
              <div className="flex items-center gap-2 max-w-xl">
                <input
                  type="text"
                  readOnly
                  value={generatedRawKey}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-amber-500/40 text-amber-200 font-mono text-xs select-all focus:outline-none"
                />
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(generatedRawKey);
                    setIsCopiedKey(true);
                    setTimeout(() => setIsCopiedKey(false), 2000);
                  }}
                  className="cg-btn cg-btn--small bg-amber-500 text-neutral-950 font-bold shrink-0 flex items-center gap-1"
                >
                  {isCopiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopiedKey ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Create AI Key Card */}
          <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              Tạo Khóa API Mới Cho AI Duyệt (Scope Hẹp)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Khóa API này chỉ có quyền đọc danh sách bài nộp chờ duyệt và gửi kết quả duyệt bài, không có quyền can thiệp vào các khu vực khác của hệ thống.
            </p>
            <form onSubmit={handleCreateAiKey} className="flex items-center gap-2 max-w-md">
              <input
                type="text"
                placeholder="Tên khóa (vd: Pine AI Agent)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl bg-muted/40 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="submit"
                disabled={isLoading || !newKeyName.trim()}
                className="cg-btn cg-btn--primary text-xs font-bold shrink-0"
              >
                Tạo Khóa
              </button>
            </form>
          </div>

          {/* AI Keys List */}
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3.5">Tên khóa</th>
                  <th className="p-3.5">Tiền tố nhận diện</th>
                  <th className="p-3.5">Trạng thái</th>
                  <th className="p-3.5">Lần gọi gần nhất</th>
                  <th className="p-3.5">Ngày tạo</th>
                  <th className="p-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {aiKeys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Chưa có khóa API nào. Hãy tạo khóa mới để cấp quyền cho AI!
                    </td>
                  </tr>
                ) : (
                  aiKeys.map((k) => (
                    <tr key={k.id} className="hover:bg-muted/20">
                      <td className="p-3.5 font-bold text-foreground">{k.key_name}</td>
                      <td className="p-3.5 font-mono text-primary-light">{k.key_prefix}</td>
                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleAiKey(k.id, k.is_active)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                            k.is_active === 1
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {k.is_active === 1 ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}
                        </button>
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        {k.last_used_at ? new Date(k.last_used_at).toLocaleString('vi-VN') : 'Chưa sử dụng'}
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        {new Date(k.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleDeleteAiKey(k.id)}
                          className="text-rose-400 hover:underline text-[11px]"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Audit Logs */}
          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Nhật Ký Kiểm Toán (Audit Logs)
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground font-semibold sticky top-0">
                  <tr>
                    <th className="p-3.5">Thời gian</th>
                    <th className="p-3.5">Nhiệm vụ</th>
                    <th className="p-3.5">Hành động</th>
                    <th className="p-3.5">Người thực hiện</th>
                    <th className="p-3.5">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        Chưa có lịch sử kiểm toán nào.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/20">
                        <td className="p-3.5 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                          {new Date(log.created_at).toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3.5 font-semibold text-foreground">{log.mission_title || log.mission_id}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-foreground">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-primary-light">{log.actor}</td>
                        <td className="p-3.5 text-muted-foreground">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: TẠO / SỬA NHIỆM VỤ                                 */}
      {/* ========================================================= */}
      {isMissionModalOpen && editingMission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-2xl bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border/80 flex items-center justify-between bg-muted/30">
              <h3 className="font-bold text-base text-foreground">
                {editingMission.id ? 'Chỉnh Sửa Nhiệm Vụ' : 'Tạo Nhiệm Vụ Mới'}
              </h3>
              <button
                onClick={() => setIsMissionModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMission} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  Tiêu đề nhiệm vụ <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đăng bài chia sẻ nhận Code VIP Tiên Nghịch Mobile"
                  value={editingMission.title || ''}
                  onChange={(e) => setEditingMission({ ...editingMission, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border/80 text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">Mô tả ngắn</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả tóm tắt nội dung nhiệm vụ cho người dùng..."
                  value={editingMission.description || ''}
                  onChange={(e) => setEditingMission({ ...editingMission, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border/80 text-foreground focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Tên nhóm / Trang đích</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Nhóm Tiên Nghịch Mobile VN"
                    value={editingMission.target_channel_name || ''}
                    onChange={(e) => setEditingMission({ ...editingMission, target_channel_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border/80 text-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Link nhóm / Trang đích</label>
                  <input
                    type="url"
                    placeholder="https://facebook.com/groups/..."
                    value={editingMission.target_channel_url || ''}
                    onChange={(e) => setEditingMission({ ...editingMission, target_channel_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border/80 text-foreground focus:outline-none"
                  />
                </div>
              </div>

              {/* Reward Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/60">
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Loại phần thưởng</label>
                  <select
                    value={editingMission.reward_type || 'CODE'}
                    onChange={(e) => setEditingMission({ ...editingMission, reward_type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border/80 text-foreground focus:outline-none font-semibold"
                  >
                    <option value="CODE">Mã Giftcode (Kho mã riêng)</option>
                    <option value="WALLET_BALANCE">Cộng số dư Ví thành viên</option>
                  </select>
                </div>

                {editingMission.reward_type === 'WALLET_BALANCE' ? (
                  <div>
                    <label className="block font-semibold text-muted-foreground mb-1">Số tiền ví cộng thưởng (VNĐ)</label>
                    <input
                      type="number"
                      min={1000}
                      step={1000}
                      value={editingMission.reward_value || 10000}
                      onChange={(e) => setEditingMission({ ...editingMission, reward_value: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border/80 text-foreground focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-muted-foreground mb-1">Kho mã riêng</label>
                    <span className="text-[11px] text-muted-foreground block pt-2">
                      Sau khi lưu nhiệm vụ, bạn có thể nạp mã vào tab "Kho Mã Thưởng".
                    </span>
                  </div>
                )}
              </div>

              {/* Quota & Review Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Tổng Quota (Lượt thưởng)</label>
                  <input
                    type="number"
                    min={1}
                    value={editingMission.quota || 10}
                    onChange={(e) => setEditingMission({ ...editingMission, quota: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border/80 text-foreground focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Chế độ duyệt</label>
                  <select
                    value={editingMission.review_mode || 'AI_ASSISTED'}
                    onChange={(e) => setEditingMission({ ...editingMission, review_mode: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border/80 text-foreground focus:outline-none font-semibold"
                  >
                    <option value="AI_ASSISTED">AI Hỗ Trợ (Khuyến nghị)</option>
                    <option value="AI_AUTO">AI Tự Duyệt Tự Động</option>
                    <option value="MANUAL">Quản Trị Duyệt Tay</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Trạng thái</label>
                  <select
                    value={editingMission.status || 'ACTIVE'}
                    onChange={(e) => setEditingMission({ ...editingMission, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border/80 text-foreground focus:outline-none font-semibold"
                  >
                    <option value="ACTIVE">Đang Mở (ACTIVE)</option>
                    <option value="PAUSED">Tạm Dừng (PAUSED)</option>
                    <option value="ENDED">Đã Kết Thúc (ENDED)</option>
                    <option value="DRAFT">Bản Nháp (DRAFT)</option>
                  </select>
                </div>
              </div>

              {/* Content Requirements & AI Prompt Guidelines */}
              <div>
                <label className="block font-semibold text-muted-foreground mb-1">Yêu cầu nội dung bài đăng</label>
                <textarea
                  rows={2}
                  placeholder="Hashtag, ảnh chụp màn hình, độ dài tối thiểu..."
                  value={editingMission.content_requirements || ''}
                  onChange={(e) => setEditingMission({ ...editingMission, content_requirements: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border/80 text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-muted-foreground mb-1">
                  Gợi ý cho AI kiểm tra (AI prompt guidelines)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ví dụ: Link bài đăng phải có hashtag #codegameshop và ảnh chụp trang chủ..."
                  value={editingMission.ai_prompt_guidelines || ''}
                  onChange={(e) => setEditingMission({ ...editingMission, ai_prompt_guidelines: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border/80 text-foreground focus:outline-none"
                />
              </div>

              {/* Anti Cheat & Restrictions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/60">
                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Miền link cho phép</label>
                  <input
                    type="text"
                    value={editingMission.allowed_domains || 'facebook.com,fb.com,fb.watch'}
                    onChange={(e) => setEditingMission({ ...editingMission, allowed_domains: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border/80 text-foreground focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Số lần cho nộp lại</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={editingMission.max_resubmissions ?? 2}
                    onChange={(e) => setEditingMission({ ...editingMission, max_resubmissions: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border/80 text-foreground focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-muted-foreground mb-1">Tuổi tài khoản (ngày)</label>
                  <input
                    type="number"
                    min={0}
                    value={editingMission.min_account_age_days ?? 0}
                    onChange={(e) => setEditingMission({ ...editingMission, min_account_age_days: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-card border border-border/80 text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMissionModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/80 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="cg-btn cg-btn--primary font-bold"
                >
                  {editingMission.id ? 'Lưu Thay Đổi' : 'Tạo Nhiệm Vụ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: TỪ CHỐI BÀI NỘP                                   */}
      {/* ========================================================= */}
      {rejectingSubId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-md bg-card border border-border/80 rounded-3xl p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400" />
              Lý Do Từ Chối Hồ Sơ
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Vui lòng chọn hoặc nhập lý do từ chối rõ ràng để người dùng có thể điều chỉnh và nộp lại:
            </p>

            <div className="space-y-1.5">
              {[
                'Link bài đăng không tồn tại hoặc đặt ở chế độ riêng tư.',
                'Bài viết chưa có hashtag #codegameshop theo quy định.',
                'Bài viết không đăng vào đúng nhóm/fanpage được yêu cầu.',
                'Bài viết đã bị quản trị viên nhóm xóa hoặc ẩn.',
              ].map((quickReason, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRejectionReason(quickReason)}
                  className="w-full text-left p-2 rounded-lg bg-muted/40 hover:bg-muted text-[11px] text-foreground border border-border/60 transition-colors"
                >
                  {quickReason}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Nhập lý do chi tiết..."
              className="w-full p-3 rounded-xl bg-muted/40 border border-border/80 text-xs text-foreground focus:outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingSubId(null)}
                className="px-4 py-2 rounded-xl bg-muted text-foreground font-bold text-xs"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-sm"
              >
                Xác Nhận Từ Chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
