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
  Eye,
  EyeOff,
  Save,
  KeyRound,
  Hash,
  Link,
  Bot,
  UserCheck,
  Dices,
} from 'lucide-react';

interface TelegramStats {
  total_linked_users: number;
  subscriptions_by_game: { game_slug: string; count: number }[];
}

interface TelegramRecentPost {
  id: string;
  kind?: string;
  type?: string;
  ref_key?: string;
  title?: string;
  target?: string;
  chat_id?: string;
  thread_id?: number | null;
  message_id?: number | null;
  status?: string;
  error_message?: string;
  posted_at?: string;
  created_at?: string;
  content_snippet?: string;
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
  has_token: boolean;
  has_group_id: boolean;
  has_admin_chat_id: boolean;
  has_webhook_secret: boolean;
  has_notify_key: boolean;
  bot_username: string | null;
  group_link: string | null;
  admin_chat_id_configured?: string;
}

export const TelegramModule: React.FC = () => {
  const [stats, setStats] = useState<TelegramStats>({ total_linked_users: 0, subscriptions_by_game: [] });
  const [recentPosts, setRecentPosts] = useState<TelegramRecentPost[]>([]);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfoResult | null>(null);
  const [configStatus, setConfigStatus] = useState<ConfigStatus>({
    has_token: false,
    has_group_id: false,
    has_admin_chat_id: false,
    has_webhook_secret: false,
    has_notify_key: false,
    bot_username: null,
    group_link: null,
    admin_chat_id_configured: 'Chưa cấu hình',
  });

  // Connection Configuration Inputs
  const [botToken, setBotToken] = useState('');
  const [showBotToken, setShowBotToken] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [groupLink, setGroupLink] = useState('');
  const [adminChatId, setAdminChatId] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [notifyKey, setNotifyKey] = useState('');
  const [hasExistingToken, setHasExistingToken] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
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
    const rawSyncKey =
      (sessionStorage.getItem('wcg_admin_sync_key') ||
      localStorage.getItem('wcg_admin_sync_key') ||
      '').trim();
    const syncKey = (rawSyncKey && rawSyncKey.length >= 16)
      ? rawSyncKey
      : 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Sync-Key': syncKey,
      'X-Admin-Key': syncKey,
      'X-Api-Key': syncKey,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const generateRandomHex = (length = 32): string => {
    const chars = '0123456789abcdef';
    let res = '';
    for (let i = 0; i < length; i++) {
      res += chars[Math.floor(Math.random() * chars.length)];
    }
    return res;
  };

  const loadTelegramData = async () => {
    setIsLoading(true);
    setActionNotice(null);
    try {
      const res = await fetch('/api/telegram/admin', {
        headers: getAuthHeaders(),
      });
      const data: any = await res.json().catch(() => null);
      if (res.ok && data && data.success) {
        // Robust handling for both nested data.data and root level data
        const statsData = data.stats || data.data?.stats;
        const recentPostsData = statsData?.recent_posts || data.recent_posts || data.data?.recent_posts || [];
        const webhookData = data.webhook_info?.result || data.webhook_info || data.data?.webhook_info?.result || null;
        const configData = data.config || data.data?.config;
        const rawConfig = data.raw_config || data.data?.raw_config;

        if (statsData) {
          setStats({
            total_linked_users: statsData.total_linked_users ?? 0,
            subscriptions_by_game: statsData.subscriptions_by_game ?? [],
          });
        }
        setRecentPosts(recentPostsData);
        setWebhookInfo(webhookData);
        if (configData) {
          setConfigStatus({
            has_token: Boolean(configData.has_token),
            has_group_id: Boolean(configData.has_group_id),
            has_admin_chat_id: Boolean(configData.has_admin_chat_id),
            has_webhook_secret: Boolean(configData.has_webhook_secret),
            has_notify_key: Boolean(configData.has_notify_key),
            bot_username: configData.bot_username || null,
            group_link: configData.group_link || null,
            admin_chat_id_configured: configData.admin_chat_id_configured || 'Chưa cấu hình',
          });
        }

        // Fill form fields from saved raw config
        if (rawConfig) {
          setBotToken(rawConfig.bot_token || '');
          setHasExistingToken(Boolean(rawConfig.has_bot_token));
          setGroupId(rawConfig.group_id || '');
          setBotUsername(rawConfig.bot_username || '');
          setGroupLink(rawConfig.group_link || '');
          setAdminChatId(rawConfig.admin_chat_id || '');
          setWebhookSecret(rawConfig.webhook_secret || '');
          setNotifyKey(rawConfig.notify_key || '');
        }
      } else {
        const errorMsg = data?.error || data?.message || (res.status === 401 ? 'Phiên đăng nhập quản trị viên hết hạn. Vui lòng đăng nhập lại.' : 'Không thể tải dữ liệu Telegram admin.');
        setActionNotice({ type: 'error', message: errorMsg });
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

  const handleSaveConfig = async (autoSetWebhook = false) => {
    if (!botToken.trim() && !hasExistingToken) {
      setActionNotice({ type: 'error', message: 'Vui lòng nhập Bot Token từ @BotFather.' });
      return;
    }
    if (!groupId.trim()) {
      setActionNotice({ type: 'error', message: 'Vui lòng nhập Group ID (ID nhóm chat Telegram).' });
      return;
    }

    setIsSavingConfig(true);
    setActionNotice(null);
    try {
      const res = await fetch('/api/telegram/admin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: 'save_config',
          config: {
            bot_token: botToken,
            group_id: groupId,
            bot_username: botUsername,
            group_link: groupLink,
            admin_chat_id: adminChatId,
            webhook_secret: webhookSecret,
            notify_key: notifyKey,
          },
          auto_set_webhook: autoSetWebhook,
        }),
      });
      const data: any = await res.json();
      if (data.success) {
        setActionNotice({
          type: 'success',
          message: autoSetWebhook
            ? 'Đã lưu cấu hình và kích hoạt Webhook Telegram thành công!'
            : 'Đã lưu cấu hình kết nối Telegram trực tiếp vào hệ thống thành công!',
        });
        await loadTelegramData();
      } else {
        setActionNotice({
          type: 'error',
          message: data.message || data.error || 'Lỗi khi lưu cấu hình.',
        });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Lỗi kết nối máy chủ.' });
    } finally {
      setIsSavingConfig(false);
    }
  };

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
          message: `Gửi tin thử nghiệm thành công! (Message ID: ${data.message_id || 'N/A'}) - Đã gửi tới Admin Chat ID: ${data.target_chat_id}.`,
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
              Cài đặt token kết nối bot, nhóm chat, giám sát Webhook và gửi thông báo giftcode tự động.
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
          <span className="font-medium">{actionNotice.message}</span>
        </div>
      )}

      {/* 1. KHỐI CÀI ĐẶT THÔNG TIN KẾT NỐI (ĐIỀN TOKEN BOT & NHÓM CHAT TRỰC TIẾP TẠI ĐÂY) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-card border-2 border-[#229ED9]/40 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/80 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#229ED9]/20 text-[#229ED9]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-foreground flex items-center gap-2">
                <span>Cấu Hình Kết Nối Bot &amp; Nhóm Telegram</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                  LƯU TRỰC TIẾP D1
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Điền trực tiếp thông tin bot và nhóm chat tại đây mà không cần truy cập Cloudflare Dashboard.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* 1. Bot Token */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#229ED9]" />
                <span>Telegram Bot Token (Từ @BotFather)</span>
                <span className="text-rose-400">*</span>
              </span>
              {hasExistingToken && (
                <span className="text-[10px] text-emerald-400 font-mono font-bold">
                  ✓ Hệ thống đã lưu token bí mật
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showBotToken ? 'text' : 'password'}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={hasExistingToken ? 'Đang lưu trữ token an toàn (Nhập mới nếu muốn thay đổi)...' : 'Ví dụ: 7891234567:AAHjK9qWXYZ_abc123...'}
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-muted/40 border border-border text-foreground font-mono text-xs focus:outline-none focus:border-[#229ED9]"
              />
              <button
                type="button"
                onClick={() => setShowBotToken(!showBotToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1"
                title={showBotToken ? 'Ẩn token' : 'Hiện token'}
              >
                {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Mở Telegram nhắn tin cho <strong>@BotFather</strong>, chọn lệnh <code>/newbot</code> để nhận mã Token API.
            </p>
          </div>

          {/* 2. Group ID */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-amber-400" />
              <span>Group ID (ID Nhóm Chat)</span>
              <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder="Ví dụ: -1002345678901"
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border text-foreground font-mono text-xs focus:outline-none focus:border-[#229ED9]"
            />
            <p className="text-[11px] text-muted-foreground">
              ID nhóm dạng số âm (thường bắt đầu bằng <code>-100...</code>). Nhớ thêm Bot làm <strong>Quản trị viên (Admin)</strong> của nhóm.
            </p>
          </div>

          {/* 3. Bot Username */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-primary-light" />
              <span>Bot Username (Tên người dùng của Bot)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">@</span>
              <input
                type="text"
                value={botUsername.replace(/^@/, '')}
                onChange={(e) => setBotUsername(e.target.value.replace(/^@/, ''))}
                placeholder="Ví dụ: CodeGameShopBot"
                className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-muted/40 border border-border text-foreground font-mono text-xs focus:outline-none focus:border-[#229ED9]"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tên username của bot dùng để sinh đường link liên kết tài khoản cho người dùng.
            </p>
          </div>

          {/* 4. Group Link */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground flex items-center gap-1.5">
              <Link className="w-4 h-4 text-sky-400" />
              <span>Link Mời Nhóm Chat (Group Link)</span>
            </label>
            <input
              type="text"
              value={groupLink}
              onChange={(e) => setGroupLink(e.target.value)}
              placeholder="Ví dụ: https://t.me/codegame_chat"
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border text-foreground text-xs focus:outline-none focus:border-[#229ED9]"
            />
            <p className="text-[11px] text-muted-foreground">
              Đường dẫn mời người dùng website bấm tham gia vào nhóm chat cộng đồng.
            </p>
          </div>

          {/* 5. Admin Chat ID */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Admin Chat ID (Chat ID Cá Nhân Của Bạn)</span>
            </label>
            <input
              type="text"
              value={adminChatId}
              onChange={(e) => setAdminChatId(e.target.value)}
              placeholder="Ví dụ: 7791142901"
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border text-foreground font-mono text-xs focus:outline-none focus:border-[#229ED9]"
            />
            <p className="text-[11px] text-muted-foreground">
              Chat ID của bạn (nhắn tin cho <strong>@userinfobot</strong> để lấy). Bot chỉ gửi tin thử nghiệm tới ID này.
            </p>
          </div>

          {/* 6. Webhook Secret Token */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Webhook Secret Token</span>
              </span>
              <button
                type="button"
                onClick={() => setWebhookSecret(generateRandomHex(32))}
                className="text-[10px] text-[#229ED9] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Dices className="w-3 h-3" />
                <span>Tạo ngẫu nhiên</span>
              </button>
            </label>
            <input
              type="text"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Khóa bí mật xác thực webhook từ Telegram..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border text-foreground font-mono text-xs focus:outline-none focus:border-[#229ED9]"
            />
            <p className="text-[11px] text-muted-foreground">
              Chuỗi bảo mật chống giả mạo Webhook. Có thể bấm &quot;Tạo ngẫu nhiên&quot;.
            </p>
          </div>

          {/* 7. Notify Key */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Khóa Đăng Bài Tự Động (Notify Key)</span>
              </span>
              <button
                type="button"
                onClick={() => setNotifyKey(`wcg_tg_${generateRandomHex(24)}`)}
                className="text-[10px] text-[#229ED9] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Dices className="w-3 h-3" />
                <span>Tạo ngẫu nhiên</span>
              </button>
            </label>
            <input
              type="text"
              value={notifyKey}
              onChange={(e) => setNotifyKey(e.target.value)}
              placeholder="Khóa cấp quyền cho Muse / bot tự động..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border text-foreground font-mono text-xs focus:outline-none focus:border-[#229ED9]"
            />
            <p className="text-[11px] text-muted-foreground">
              Khóa bí mật dùng cho Muse hoặc dịch vụ crawler gọi endpoint <code>/api/telegram/notify</code>.
            </p>
          </div>
        </div>

        {/* Action Buttons for Configuration Form */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border/80">
          <button
            type="button"
            onClick={() => handleSaveConfig(false)}
            disabled={isSavingConfig}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-border disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-primary-light" />
            <span>{isSavingConfig ? 'Đang Lưu...' : 'Lưu Cấu Hình'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveConfig(true)}
            disabled={isSavingConfig}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#229ED9] to-emerald-500 hover:from-[#1e8ec3] hover:to-emerald-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            <span>{isSavingConfig ? 'Đang Xử Lý...' : 'Lưu & Kích Hoạt Webhook Ngay'}</span>
          </button>
        </div>
      </div>

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
          <p className="text-[11px] text-muted-foreground truncate" title={webhookInfo?.url || 'Chưa thiết lập URL'}>
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
              Trạng Thái Thiết Lập Các Tham Số
            </h3>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Hợp nhất tự động giữa biến môi trường và cơ sở dữ liệu D1
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          {[
            { key: 'bot_token', active: configStatus.has_token, label: 'Bot Token' },
            { key: 'group_id', active: configStatus.has_group_id, label: 'Group ID' },
            { key: 'bot_username', active: Boolean(configStatus.bot_username), label: 'Bot Username' },
            { key: 'group_link', active: Boolean(configStatus.group_link), label: 'Group Link' },
            { key: 'webhook_secret', active: configStatus.has_webhook_secret, label: 'Webhook Secret' },
            { key: 'admin_chat_id', active: configStatus.has_admin_chat_id, label: 'Admin Chat ID' },
            { key: 'notify_key', active: configStatus.has_notify_key, label: 'Notify Key' },
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
                    <span className="text-[10px] font-bold">Đã Có</span>
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
            Hệ thống chỉ gửi tin nhắn thử nghiệm tới <strong>Chat ID cá nhân</strong> của quản trị viên ({configStatus.admin_chat_id_configured}).
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
                  <th className="py-2 px-3">Tiêu Đề / Nội Dung</th>
                  <th className="py-2 px-3">Đích Đến</th>
                  <th className="py-2 px-3">Ref Key</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {recentPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-muted/30">
                    <td className="py-2 px-3 text-muted-foreground font-mono whitespace-nowrap">
                      {post.posted_at || post.created_at ? new Date(post.posted_at || post.created_at!).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted border border-border text-foreground">
                        {post.kind || post.type || 'post'}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-foreground max-w-[250px] truncate" title={post.content_snippet || post.title}>
                      {post.content_snippet || post.title || `Tin nhắn ID #${post.message_id || post.id}`}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {post.target || post.chat_id || 'Group'}
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
