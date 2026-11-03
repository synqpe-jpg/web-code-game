import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Users,
  Bell,
  MessageSquare,
  ShieldCheck,
  Zap,
  ExternalLink,
  Clock,
  Radio,
  FileText,
  Sliders,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface TelegramStats {
  total_linked_users: number;
  subscriptions_by_game: { game_slug: string; count: number }[];
}

interface TelegramRecentPost {
  id: string;
  type: string;
  ref_key?: string;
  title: string;
  chat_id: string;
  thread_id?: number | null;
  message_id?: number | null;
  status: string;
  error_message?: string;
  created_at: string;
}

interface WebhookInfoResult {
  url?: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  ip_address?: string;
}

interface ConfigStatus {
  has_bot_token: boolean;
  has_group_id: boolean;
  has_bot_username: boolean;
  has_group_link: boolean;
  has_webhook_secret: boolean;
  has_admin_chat_id: boolean;
  has_notify_key: boolean;
}

export const TelegramModule: React.FC = () => {
  const [stats, setStats] = useState<TelegramStats>({ total_linked_users: 0, subscriptions_by_game: [] });
  const [recentPosts, setRecentPosts] = useState<TelegramRecentPost[]>([]);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfoResult | null>(null);
  const [configStatus, setConfigStatus] = useState<ConfigStatus>({
    has_bot_token: false,
    has_group_id: false,
    has_bot_username: false,
    has_group_link: false,
    has_webhook_secret: false,
    has_admin_chat_id: false,
    has_notify_key: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isUpdatingWebhook, setIsUpdatingWebhook] = useState(false);
  const [testMessage, setTestMessage] = useState('🔔 [CodeGame Admin Test] Bot Telegram hoạt động hoàn hảo!');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const loadTelegramData = async () => {
    setIsLoading(true);
    setActionNotice(null);
    try {
      const res = await fetch('/api/telegram/admin', {
        headers: getAuthHeaders(),
      });
      const data: any = await res.json();
      if (data.success && data.data) {
        setStats(data.data.stats || { total_linked_users: 0, subscriptions_by_game: [] });
        setRecentPosts(data.data.recent_posts || []);
        setWebhookInfo(data.data.webhook_info?.result || null);
        setConfigStatus(data.data.config_status || {});
      } else {
        setActionNotice({ type: 'error', message: data.error || 'Không thể tải dữ liệu Telegram admin.' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Lỗi kết nối máy chủ.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTelegramData();
  }, []);

  const handleSendTest = async () => {
    if (!testMessage.trim()) return;
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/telegram/admin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'send_test',
          message: testMessage.trim(),
        }),
      });
      const data: any = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: `Gửi tin thử nghiệm thành công! (Message ID: ${data.data?.message_id || 'N/A'}) - Chỉ gửi tới Admin Chat ID: ${data.data?.target_chat_id}.`,
        });
        loadTelegramData();
      } else {
        setTestResult({
          success: false,
          message: data.message || data.error || 'Gửi tin thất bại.',
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Lỗi mạng.' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleUpdateWebhook = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn đăng ký / cập nhật Webhook Telegram lên Cloudflare Pages không?')) return;
    setIsUpdatingWebhook(true);
    try {
      const res = await fetch('/api/telegram/admin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'set_webhook' }),
      });
      const data: any = await res.json();
      if (data.success) {
        setActionNotice({
          type: 'success',
          message: 'Đã kích hoạt Webhook thành công! Telegram đã xác nhận nhận sự kiện tại /api/telegram/webhook.',
        });
        await loadTelegramData();
      } else {
        setActionNotice({
          type: 'error',
          message: data.message || data.error || 'Cập nhật Webhook thất bại.',
        });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Lỗi kết nối khi cập nhật Webhook.' });
    } finally {
      setIsUpdatingWebhook(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#229ED9]/15 text-[#229ED9] flex items-center justify-center border border-[#229ED9]/30 shadow-sm shrink-0">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
              <span>Quản Trị Tích Hợp Telegram</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#229ED9]/20 text-[#229ED9] border border-[#229ED9]/40">
                BOT & GROUP
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Giám sát Webhook, trạng thái kết nối Cloudflare Pages &amp; Telegram Bot API, phát thông báo tự động.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadTelegramData}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-border disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
            actionNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{actionNotice.message}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Linked Users */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Người Dùng Đã Liên Kết</span>
            <Users className="w-4 h-4 text-primary-light" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {stats.total_linked_users}
          </div>
          <p className="text-[11px] text-muted-foreground">Tài khoản website đã kết nối Telegram DM</p>
        </div>

        {/* Subscribed Games */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Game Được Theo Dõi</span>
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {stats.subscriptions_by_game.length}
          </div>
          <p className="text-[11px] text-muted-foreground">Số tựa game có người đăng ký nhận mã</p>
        </div>

        {/* Webhook Status */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Trạng Thái Webhook</span>
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                webhookInfo?.url ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-sm font-bold text-foreground">
              {webhookInfo?.url ? 'Đang Lắng Nghe' : 'Chưa Kích Hoạt'}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {webhookInfo?.url || 'Chưa thiết lập URL'}
          </p>
        </div>

        {/* Pending Updates */}
        <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Hàng Đợi Webhook</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-foreground font-mono">
            {webhookInfo?.pending_update_count ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">Số update đang chờ xử lý từ Telegram</p>
        </div>
      </div>

      {/* Configuration & Environment Variables Audit Card */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="font-heading font-bold text-sm text-foreground">
              Kiểm Tra Biến Môi Trường (Cloudflare Pages Secrets)
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Bảo mật tuyệt đối: Không bao giờ hiển thị chuỗi secret
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          {[
            { key: 'TELEGRAM_BOT_TOKEN', active: configStatus.has_bot_token, label: 'Bot Token' },
            { key: 'TELEGRAM_GROUP_ID', active: configStatus.has_group_id, label: 'Group ID' },
            { key: 'TELEGRAM_BOT_USERNAME', active: configStatus.has_bot_username, label: 'Bot Username' },
            { key: 'TELEGRAM_GROUP_LINK', active: configStatus.has_group_link, label: 'Group Link' },
            { key: 'TELEGRAM_WEBHOOK_SECRET', active: configStatus.has_webhook_secret, label: 'Webhook Secret' },
            { key: 'TELEGRAM_ADMIN_CHAT_ID', active: configStatus.has_admin_chat_id, label: 'Admin Chat ID' },
            { key: 'TELEGRAM_NOTIFY_KEY', active: configStatus.has_notify_key, label: 'Notify Key' },
          ].map((item) => (
            <div
              key={item.key}
              className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1.5 ${
                item.active
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-muted/40 border-border text-muted-foreground'
              }`}
            >
              <span className="text-[10px] font-mono font-bold truncate" title={item.key}>
                {item.label}
              </span>
              <div className="flex items-center gap-1">
                {item.active ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] font-bold">Đã Cấu Hình</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px]">Chưa Có</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook & Test Send Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Test Action */}
        <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#229ED9]" />
              <h3 className="font-heading font-bold text-sm text-foreground">
                Gửi Tin Thử Nghiệm (Admin Test)
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
              ADMIN CHAT ONLY
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Hệ thống chỉ gửi tin nhắn thử nghiệm tới <strong>TELEGRAM_ADMIN_CHAT_ID</strong> cá nhân của quản trị viên.
            Tuyệt đối <strong>KHÔNG</strong> gửi vào nhóm chat chung để đảm bảo không làm phiền thành viên.
          </p>

          <div className="space-y-2">
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={3}
              placeholder="Nội dung tin nhắn thử nghiệm..."
              className="w-full p-3 rounded-xl bg-muted/40 border border-border text-foreground text-xs focus:outline-none focus:border-[#229ED9] resize-none"
            />

            <button
              type="button"
              onClick={handleSendTest}
              disabled={isSendingTest || !testMessage.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-[#229ED9] hover:bg-[#1f8ec4] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSendingTest ? 'Đang gửi tới Admin...' : 'Gửi Thử Tới Chat Admin'}</span>
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Webhook Management */}
        <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <h3 className="font-heading font-bold text-sm text-foreground">
                Quản Lý Webhook Telegram
              </h3>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              /api/telegram/webhook
            </span>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">URL Webhook:</span>
              <span className="font-mono text-foreground font-bold truncate max-w-[250px]">
                {webhookInfo?.url || 'Chưa kích hoạt'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pending Updates:</span>
              <span className="font-mono text-foreground">
                {webhookInfo?.pending_update_count ?? 0}
              </span>
            </div>
            {webhookInfo?.last_error_message && (
              <div className="pt-2 border-t border-border/60 text-rose-400">
                <span className="font-bold">Lỗi gần nhất: </span>
                <span>{webhookInfo.last_error_message}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleUpdateWebhook}
              disabled={isUpdatingWebhook}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span>{isUpdatingWebhook ? 'Đang cấu hình...' : 'Kích Hoạt / Cập Nhật Webhook'}</span>
            </button>
            <button
              type="button"
              onClick={loadTelegramData}
              className="py-2.5 px-4 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs border border-border transition-all cursor-pointer"
            >
              Kiểm Tra Lại
            </button>
          </div>
        </div>
      </div>

      {/* Top Subscribed Games Table */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <h3 className="font-heading font-bold text-sm text-foreground flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Top Game Được Đăng Ký Theo Dõi Nhiều Nhất</span>
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            Top {stats.subscriptions_by_game.length} game
          </span>
        </h3>

        {stats.subscriptions_by_game.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/80 text-muted-foreground">
                  <th className="py-2 px-3">Thứ Hạng</th>
                  <th className="py-2 px-3">Tên Game (Slug)</th>
                  <th className="py-2 px-3 text-right">Số Người Đăng Ký</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {stats.subscriptions_by_game.map((item, idx) => (
                  <tr key={item.game_slug} className="hover:bg-muted/30">
                    <td className="py-2 px-3 font-mono font-bold text-muted-foreground">
                      #{idx + 1}
                    </td>
                    <td className="py-2 px-3 font-bold text-foreground">
                      {item.game_slug}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-primary-light">
                      {item.count} thành viên
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Chưa có người dùng nào đăng ký theo dõi game cụ thể.
          </p>
        )}
      </div>

      {/* 20 Recent Posts Log */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <h3 className="font-heading font-bold text-sm text-foreground flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-light" />
            <span>Lịch Sử Đăng Bài Telegram Gần Nhất (20 bài)</span>
          </span>
          <span className="text-xs font-mono text-muted-foreground">Anti-Duplication 7 Ngày</span>
        </h3>

        {recentPosts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/80 text-muted-foreground">
                  <th className="py-2 px-3">Thời Gian</th>
                  <th className="py-2 px-3">Loại Bài</th>
                  <th className="py-2 px-3">Tiêu Đề</th>
                  <th className="py-2 px-3">Đích Đến</th>
                  <th className="py-2 px-3">Trạng Thái</th>
                  <th className="py-2 px-3">Ref Key</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {recentPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-muted/30">
                    <td className="py-2 px-3 text-muted-foreground font-mono whitespace-nowrap">
                      {new Date(post.created_at).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted border border-border text-foreground">
                        {post.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-foreground max-w-[250px] truncate" title={post.title}>
                      {post.title}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {post.chat_id}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {post.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Thành công
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-bold" title={post.error_message}>
                          <AlertCircle className="w-3.5 h-3.5" /> Thất bại
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-[10px] text-muted-foreground truncate max-w-[120px]" title={post.ref_key}>
                      {post.ref_key || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Chưa có bài đăng nào được ghi nhận vào nhật ký.
          </p>
        )}
      </div>
    </div>
  );
};
