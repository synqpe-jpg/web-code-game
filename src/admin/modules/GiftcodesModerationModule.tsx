import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  X,
  Flag,
  MessageSquare,
  Gift,
  AlertTriangle,
  Star,
  RefreshCw,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { StatusBadge } from '../components/ui/StatusBadge';
import { FormModal } from '../components/ui/FormModal';
import { adminDataService } from '../services/adminDataService';
import { GiftcodeSubmission } from '../types/adminTypes';
import { formatFullDateTime } from '../../utils/textUtils';

interface GiftcodesModerationModuleProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
}

interface CodeReportItem {
  id: string;
  game_slug: string;
  game_name?: string;
  code: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  reason: string;
  reason_label: string;
  status: 'PENDING' | 'RESOLVED_CONFIRMED' | 'RESOLVED_INVALID' | 'DISMISSED';
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolution_note?: string | null;
  created_at: string;
  same_code_reporters?: number;
  needs_attention?: boolean;
}

interface GameCommentItem {
  id: string;
  game_slug: string;
  game_name?: string;
  user_id: string;
  user_name: string;
  user_email?: string;
  rating?: number | null;
  content?: string | null;
  confirmed_working?: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string | null;
  created_at: string;
}

export const GiftcodesModerationModule: React.FC<GiftcodesModerationModuleProps> = ({
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'submissions' | 'reports' | 'comments'>('reports');

  // --- TAB 1: SUBMISSIONS (ĐÓNG GÓP MÃ) ---
  const [submissions, setSubmissions] = useState<GiftcodeSubmission[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [rejectingSub, setRejectingSub] = useState<GiftcodeSubmission | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Mã code không chính xác hoặc đã hết hạn.');

  // --- TAB 2: CODE REPORTS (BÁO MÃ LỖI) ---
  const [reports, setReports] = useState<CodeReportItem[]>([]);
  const [reportStatusFilter, setReportStatusFilter] = useState('PENDING');
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [resolvingReport, setResolvingReport] = useState<CodeReportItem | null>(null);
  const [resolvingAction, setResolvingAction] = useState<'confirmed' | 'invalid' | 'dismiss'>('confirmed');
  const [resolutionNote, setResolutionNote] = useState('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);

  // --- TAB 3: GAME COMMENTS (BÌNH LUẬN GAME) ---
  const [comments, setComments] = useState<GameCommentItem[]>([]);
  const [commentStatusFilter, setCommentStatusFilter] = useState('PENDING');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [rejectingComment, setRejectingComment] = useState<GameCommentItem | null>(null);
  const [commentRejectReason, setCommentRejectReason] = useState('Nội dung vi phạm quy chuẩn cộng đồng hoặc spam.');
  const [isSubmittingCommentAction, setIsSubmittingCommentAction] = useState(false);

  // Token helper
  const getAdminToken = () => {
    return typeof window !== 'undefined'
      ? localStorage.getItem('wcg_admin_token') || localStorage.getItem('wcg_auth_token') || ''
      : '';
  };

  // --- LOADERS ---
  const loadSubmissions = () => {
    setIsLoadingSubmissions(true);
    const filterObj: any = {};
    if (statusFilter !== 'ALL') filterObj.status = statusFilter;
    const data = adminDataService.getSubmissions(filterObj);
    setSubmissions(data);
    setIsLoadingSubmissions(false);
  };

  const loadReports = async () => {
    setIsLoadingReports(true);
    const token = getAdminToken();
    try {
      const q = reportStatusFilter !== 'ALL' ? `?status=${reportStatusFilter}` : '';
      const res = await fetch(`/api/admin/code-reports${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setReports(data.reports || []);
      } else {
        setReports([]);
      }
    } catch {
      setReports([]);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const loadComments = async () => {
    setIsLoadingComments(true);
    const token = getAdminToken();
    try {
      const q = commentStatusFilter !== 'ALL' ? `?status=${commentStatusFilter}` : '';
      const res = await fetch(`/api/admin/comments${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setComments(data.comments || []);
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'submissions') loadSubmissions();
    else if (activeTab === 'reports') loadReports();
    else if (activeTab === 'comments') loadComments();
  }, [activeTab, statusFilter, reportStatusFilter, commentStatusFilter]);

  // Initial counts
  useEffect(() => {
    loadSubmissions();
    loadReports();
    loadComments();
  }, []);

  // --- ACTIONS: SUBMISSIONS ---
  const handleApproveSub = (id: string) => {
    const sub = submissions.find((s) => s.id === id);
    if (!sub) return;
    const updated = adminDataService.approveSubmission(id);
    if (updated) {
      onShowToast('Đã duyệt thành công', `Mã code ${sub.codeValue} đã được đưa vào kho công khai của ${sub.gameSlug}.`, 'success');
      loadSubmissions();
    }
  };

  const handleRejectSubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingSub) return;
    const updated = adminDataService.rejectSubmission(rejectingSub.id, rejectionReason);
    if (updated) {
      onShowToast('Đã từ chối', `Đã từ chối mã ${rejectingSub.codeValue}.`, 'info');
      setRejectingSub(null);
      setRejectionReason('Mã code không chính xác hoặc đã hết hạn.');
      loadSubmissions();
    }
  };

  // --- ACTIONS: REPORTS ---
  const handleOpenResolveModal = (report: CodeReportItem, action: 'confirmed' | 'invalid' | 'dismiss') => {
    setResolvingReport(report);
    setResolvingAction(action);
    setResolutionNote(
      action === 'confirmed'
        ? 'Xác nhận mã đã hết hạn / không còn hiệu lực.'
        : action === 'invalid'
        ? 'Đã kiểm tra mã vẫn hoạt động bình thường.'
        : 'Bỏ qua báo cáo.'
    );
  };

  const handleConfirmResolveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingReport) return;
    setIsSubmittingResolve(true);
    const token = getAdminToken();

    try {
      const res = await fetch(`/api/admin/code-reports/${resolvingReport.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: resolvingAction,
          note: resolutionNote.trim(),
        }),
      });

      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        onShowToast('Đã xử lý báo cáo', data.message || 'Cập nhật trạng thái báo cáo thành công.', 'success');
        setResolvingReport(null);
        loadReports();
      } else {
        onShowToast('Lỗi', data.error || 'Không thể cập nhật báo cáo.', 'error');
      }
    } catch (err: any) {
      onShowToast('Lỗi', err.message, 'error');
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  // --- ACTIONS: COMMENTS ---
  const handleApproveComment = async (id: string) => {
    setIsSubmittingCommentAction(true);
    const token = getAdminToken();
    try {
      const res = await fetch(`/api/admin/comments/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        onShowToast('Đã duyệt bình luận', 'Bình luận hiện đã xuất hiện công khai trên game.', 'success');
        loadComments();
      } else {
        onShowToast('Lỗi', data.error || 'Không thể duyệt bình luận.', 'error');
      }
    } catch (err: any) {
      onShowToast('Lỗi', err.message, 'error');
    } finally {
      setIsSubmittingCommentAction(false);
    }
  };

  const handleRejectCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingComment) return;
    setIsSubmittingCommentAction(true);
    const token = getAdminToken();
    try {
      const res = await fetch(`/api/admin/comments/${rejectingComment.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: commentRejectReason.trim() }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        onShowToast('Đã từ chối bình luận', 'Đã lưu lý do từ chối vào hệ thống.', 'info');
        setRejectingComment(null);
        loadComments();
      } else {
        onShowToast('Lỗi', data.error || 'Không thể từ chối bình luận.', 'error');
      }
    } catch (err: any) {
      onShowToast('Lỗi', err.message, 'error');
    } finally {
      setIsSubmittingCommentAction(false);
    }
  };

  const pendingSubCount = submissions.filter((s) => s.status === 'PENDING').length;
  const pendingReportCount = reports.filter((r) => r.status === 'PENDING').length;
  const pendingCommentCount = comments.filter((c) => c.status === 'PENDING').length;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Tab Navigation (Single Screen 100%) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-card text-muted-foreground hover:text-foreground border border-border/70'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Báo Mã Lỗi Một Chạm</span>
            {pendingReportCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white">
                {pendingReportCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'comments'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-card text-muted-foreground hover:text-foreground border border-border/70'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Bình Luận & Đánh Giá</span>
            {pendingCommentCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white">
                {pendingCommentCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'submissions'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-card text-muted-foreground hover:text-foreground border border-border/70'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Đóng Góp Mã Mới</span>
            {pendingSubCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white">
                {pendingSubCount}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (activeTab === 'submissions') loadSubmissions();
            else if (activeTab === 'reports') loadReports();
            else if (activeTab === 'comments') loadComments();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/80 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Làm Mới</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 2: BÁO MÃ LỖI MỘT CHẠM (Quy tắc 9: table-fixed w-full, zero overflow)
         ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">Lọc trạng thái:</span>
              {(['PENDING', 'RESOLVED_CONFIRMED', 'RESOLVED_INVALID', 'ALL'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setReportStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportStatusFilter === st
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-card text-muted-foreground hover:text-foreground border border-border/60'
                  }`}
                >
                  {st === 'PENDING'
                    ? 'Chờ duyệt'
                    : st === 'RESOLVED_CONFIRMED'
                    ? 'Đã xác nhận lỗi'
                    : st === 'RESOLVED_INVALID'
                    ? 'Không hợp lệ'
                    : 'Tất cả'}
                </button>
              ))}
            </div>
            <span className="text-muted-foreground">Tổng cộng {reports.length} bản ghi</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
            <table className="w-full table-fixed text-left text-xs">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-semibold">
                  <th className="w-[20%] p-3 truncate">MÃ & TỰA GAME</th>
                  <th className="w-[18%] p-3 truncate">NGƯỜI BÁO LỖI</th>
                  <th className="w-[22%] p-3 truncate">LÝ DO BÁO LỖI</th>
                  <th className="w-[16%] p-3 truncate">TRẠNG THÁI</th>
                  <th className="w-[12%] p-3 truncate">THỜI GIAN</th>
                  <th className="w-[12%] p-3 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoadingReports ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Đang tải danh sách báo lỗi...
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                      Không có báo lỗi nào ở bộ lọc này.
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      {/* Cột 1: Mã & Game */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-sm border border-amber-500/30 text-xs">
                            {r.code}
                          </span>
                          {(r.same_code_reporters || 0) >= 3 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black shrink-0"
                              title={`${r.same_code_reporters} người chơi cùng báo mã này bị lỗi!`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                              <span>{r.same_code_reporters} người báo</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate mt-1" title={r.game_slug}>
                          Game: <strong className="text-foreground">{r.game_name || r.game_slug}</strong>
                        </div>
                      </td>

                      {/* Cột 2: Người báo */}
                      <td className="p-3">
                        <div className="font-bold text-foreground truncate" title={r.user_name || r.user_id}>
                          {r.user_name || 'Người chơi'}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate" title={r.user_email || r.user_id}>
                          {r.user_email || r.user_id}
                        </div>
                      </td>

                      {/* Cột 3: Lý do */}
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            r.reason === 'expired'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {r.reason_label || (r.reason === 'expired' ? 'Hết hạn' : 'Nhập không được')}
                        </span>
                        {r.resolution_note && (
                          <div className="text-[10px] text-muted-foreground truncate mt-1 italic" title={r.resolution_note}>
                            Xử lý: {r.resolution_note}
                          </div>
                        )}
                      </td>

                      {/* Cột 4: Trạng thái */}
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            r.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : r.status === 'RESOLVED_CONFIRMED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : r.status === 'RESOLVED_INVALID'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                          }`}
                        >
                          {r.status === 'PENDING'
                            ? 'Chờ duyệt'
                            : r.status === 'RESOLVED_CONFIRMED'
                            ? 'Đã xác nhận lỗi'
                            : r.status === 'RESOLVED_INVALID'
                            ? 'Không hợp lệ'
                            : 'Đã bỏ qua'}
                        </span>
                      </td>

                      {/* Cột 5: Thời gian */}
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">
                        {r.created_at ? r.created_at.slice(0, 16).replace('T', ' ') : ''}
                      </td>

                      {/* Cột 6: Thao tác */}
                      <td className="p-3 text-right">
                        {r.status === 'PENDING' ? (
                          <div className="inline-flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => handleOpenResolveModal(r, 'confirmed')}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all cursor-pointer"
                              title="Xác nhận mã lỗi"
                            >
                              Xác nhận
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenResolveModal(r, 'invalid')}
                              className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition-all cursor-pointer"
                              title="Mã vẫn dùng được (Báo cáo sai)"
                            >
                              Sai
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenResolveModal(r, 'dismiss')}
                              className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-[11px] transition-all cursor-pointer"
                              title="Bỏ qua báo cáo này"
                            >
                              Bỏ qua
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">Đã xử lý</span>
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

      {/* =========================================================================
          TAB 3: BÌNH LUẬN & ĐÁNH GIÁ (Quy tắc 9: table-fixed w-full, zero overflow)
         ========================================================================= */}
      {activeTab === 'comments' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">Lọc trạng thái:</span>
              {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setCommentStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    commentStatusFilter === st
                      ? 'bg-indigo-600 text-white'
                      : 'bg-card text-muted-foreground hover:text-foreground border border-border/60'
                  }`}
                >
                  {st === 'PENDING'
                    ? 'Chờ duyệt'
                    : st === 'APPROVED'
                    ? 'Đã duyệt'
                    : st === 'REJECTED'
                    ? 'Đã từ chối'
                    : 'Tất cả'}
                </button>
              ))}
            </div>
            <span className="text-muted-foreground">Tổng cộng {comments.length} bình luận</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
            <table className="w-full table-fixed text-left text-xs">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-semibold">
                  <th className="w-[18%] p-3 truncate">TỰA GAME</th>
                  <th className="w-[18%] p-3 truncate">NGƯỜI DÙNG & SAO</th>
                  <th className="w-[32%] p-3 truncate">NỘI DUNG BÌNH LUẬN</th>
                  <th className="w-[12%] p-3 truncate">TRẠNG THÁI</th>
                  <th className="w-[10%] p-3 truncate">THỜI GIAN</th>
                  <th className="w-[10%] p-3 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoadingComments ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Đang tải bình luận...
                    </td>
                  </tr>
                ) : comments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                      Không có bình luận nào ở bộ lọc này.
                    </td>
                  </tr>
                ) : (
                  comments.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      {/* Game */}
                      <td className="p-3">
                        <div className="font-bold text-foreground truncate" title={c.game_slug}>
                          {c.game_name || c.game_slug}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">
                          {c.game_slug}
                        </div>
                      </td>

                      {/* Người dùng & Sao */}
                      <td className="p-3">
                        <div className="font-bold text-foreground truncate" title={c.user_name}>
                          {c.user_name}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {c.rating ? (
                            <div className="flex items-center gap-0.5 text-amber-400">
                              <Star className="w-3 h-3 fill-amber-400" />
                              <span className="font-bold text-xs">{c.rating}★</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Không chấm sao</span>
                          )}
                          {Boolean(c.confirmed_working) && (
                            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded-sm border border-emerald-500/20">
                              ✓ Đã nhập
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Nội dung */}
                      <td className="p-3">
                        <p className="text-foreground truncate leading-relaxed" title={c.content || ''}>
                          {c.content || <em className="text-muted-foreground">Chỉ đánh giá số sao</em>}
                        </p>
                        {c.status === 'REJECTED' && c.rejection_reason && (
                          <div className="text-[10px] text-rose-400 truncate mt-0.5" title={c.rejection_reason}>
                            Lý do từ chối: {c.rejection_reason}
                          </div>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            c.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : c.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {c.status === 'PENDING'
                            ? 'Chờ duyệt'
                            : c.status === 'APPROVED'
                            ? 'Đã duyệt'
                            : 'Đã từ chối'}
                        </span>
                      </td>

                      {/* Thời gian */}
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">
                        {c.created_at ? c.created_at.slice(0, 10) : ''}
                      </td>

                      {/* Thao tác */}
                      <td className="p-3 text-right">
                        {c.status === 'PENDING' ? (
                          <div className="inline-flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => handleApproveComment(c.id)}
                              disabled={isSubmittingCommentAction}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all cursor-pointer"
                              title="Duyệt bình luận"
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingComment(c)}
                              disabled={isSubmittingCommentAction}
                              className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition-all cursor-pointer"
                              title="Từ chối bình luận"
                            >
                              Từ chối
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">Đã xong</span>
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

      {/* =========================================================================
          TAB 1: ĐÓNG GÓP MÃ MỚI (Giữ nguyên 100% logic cũ, tuân thủ Quy tắc 9)
         ========================================================================= */}
      {activeTab === 'submissions' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">Lọc trạng thái:</span>
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-emerald-600 text-white'
                      : 'bg-card text-muted-foreground hover:text-foreground border border-border/60'
                  }`}
                >
                  {st === 'ALL'
                    ? 'Tất cả'
                    : st === 'PENDING'
                    ? 'Chờ duyệt'
                    : st === 'APPROVED'
                    ? 'Đã duyệt'
                    : 'Đã từ chối'}
                </button>
              ))}
            </div>
            <span className="text-muted-foreground">Tổng cộng {submissions.length} bản ghi</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
            <table className="w-full table-fixed text-left text-xs">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground font-semibold">
                  <th className="w-[20%] p-3 truncate">MÃ ĐÓNG GÓP</th>
                  <th className="w-[20%] p-3 truncate">NGƯỜI GỬI</th>
                  <th className="w-[28%] p-3 truncate">NỘI DUNG / PHẦN THƯỞNG</th>
                  <th className="w-[12%] p-3 truncate">TRẠNG THÁI</th>
                  <th className="w-[10%] p-3 truncate">THỜI GIAN</th>
                  <th className="w-[10%] p-3 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoadingSubmissions ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Đang tải danh sách đóng góp...
                    </td>
                  </tr>
                ) : submissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                      Không có đóng góp nào ở bộ lọc này.
                    </td>
                  </tr>
                ) : (
                  submissions.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-800">
                          {item.codeValue}
                        </span>
                        <div className="text-[11px] text-muted-foreground mt-1 truncate" title={item.gameSlug}>
                          Game: <strong className="text-foreground">{item.gameSlug}</strong>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-foreground truncate" title={item.submitterName}>
                          {item.submitterName}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate" title={item.submitterEmail}>
                          {item.submitterEmail}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="truncate text-foreground" title={item.rewards || ''}>
                          {item.rewards || 'Chưa ghi chú'}
                        </div>
                        {item.notes && (
                          <div className="text-[10px] text-muted-foreground italic truncate mt-0.5" title={item.notes}>
                            Note: {item.notes}
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        <StatusBadge status={item.status} size="sm" />
                      </td>

                      <td className="p-3 font-mono text-[11px] text-muted-foreground">
                        {item.submittedAt ? item.submittedAt.slice(0, 10) : ''}
                      </td>

                      <td className="p-3 text-right">
                        {item.status === 'PENDING' ? (
                          <div className="inline-flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => handleApproveSub(item.id)}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all cursor-pointer"
                              title="Duyệt mã và đưa vào kho"
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingSub(item)}
                              className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition-all cursor-pointer"
                              title="Từ chối mã"
                            >
                              Từ chối
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            {item.status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối'}
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

      {/* MODAL: Xử lý Báo Lỗi */}
      <FormModal
        isOpen={Boolean(resolvingReport)}
        onClose={() => setResolvingReport(null)}
        title={
          resolvingAction === 'confirmed'
            ? 'Xác Nhận Mã Bị Lỗi'
            : resolvingAction === 'invalid'
            ? 'Báo Cáo Không Hợp Lệ'
            : 'Bỏ Qua Báo Cáo'
        }
        subtitle={`Mã: ${resolvingReport?.code} (Game: ${resolvingReport?.game_slug})`}
        maxWidth="md"
      >
        <form onSubmit={handleConfirmResolveReport} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-foreground">Ghi chú xử lý</label>
            <textarea
              rows={3}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Nhập ghi chú xử lý..."
              className="mt-2 w-full rounded-xl border border-border bg-slate-950 p-2.5 text-xs text-foreground focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setResolvingReport(null)}
              className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmittingResolve}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer ${
                resolvingAction === 'confirmed'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : resolvingAction === 'invalid'
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {isSubmittingResolve ? 'Đang lưu...' : 'Xác Nhận'}
            </button>
          </div>
        </form>
      </FormModal>

      {/* MODAL: Từ Chối Bình Luận */}
      <FormModal
        isOpen={Boolean(rejectingComment)}
        onClose={() => setRejectingComment(null)}
        title="Từ Chối Bình Luận"
        subtitle={`Bình luận của ${rejectingComment?.user_name} cho game ${rejectingComment?.game_slug}`}
        maxWidth="md"
      >
        <form onSubmit={handleRejectCommentSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-foreground">Lý do từ chối *</label>
            <textarea
              rows={3}
              required
              value={commentRejectReason}
              onChange={(e) => setCommentRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              className="mt-2 w-full rounded-xl border border-border bg-slate-950 p-2.5 text-xs text-foreground focus:outline-hidden focus:border-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setRejectingComment(null)}
              className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmittingCommentAction}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-sm cursor-pointer"
            >
              {isSubmittingCommentAction ? 'Đang lưu...' : 'Từ Chối Bình Luận'}
            </button>
          </div>
        </form>
      </FormModal>

      {/* MODAL: Từ Chối Đóng Góp Mã */}
      <FormModal
        isOpen={Boolean(rejectingSub)}
        onClose={() => setRejectingSub(null)}
        title="Từ Chối Mã Giftcode"
        subtitle={`Lý do từ chối cho mã ${rejectingSub?.codeValue}.`}
        maxWidth="md"
      >
        <form onSubmit={handleRejectSubSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-foreground">Lý Do Từ Chối *</label>
            <textarea
              rows={3}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-slate-950 p-2.5 text-xs text-foreground focus:outline-hidden focus:border-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setRejectingSub(null)}
              className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-sm cursor-pointer"
            >
              Xác Nhận Từ Chối
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
};
