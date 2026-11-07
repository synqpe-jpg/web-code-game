import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  User,
  Shield,
  KeyRound,
  Wallet,
  Copy,
  Check,
  Sparkles,
  Calendar,
  Mail,
  Phone,
  Image as ImageIcon,
  Save,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Coins,
  Package,
  Target,
  Globe,
  Sun,
  Moon,
  Send,
  Bell,
  ExternalLink,
  Unlink,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { UserProfile } from '../types/game';
import { authService } from '../services/authService';
import { dataService } from '../services/dataService';
import { telegramService, type TelegramUserStatus } from '../services/telegramService';
import { formatCore, formatFullDateTime } from '../utils/textUtils';
import { LanguageSelector } from './LanguageSelector';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUpdateUser: (user: UserProfile) => void;
  onOpenWallet: () => void;
  onOpenReceivedCodes?: (initialTab?: 'giveaways' | 'orders' | 'privates' | 'missions') => void;
  onLogout: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

// 12 Curated Gaming/Cyber Chibi Avatar Presets
const AVATAR_PRESETS = [
  { id: 'av_1', name: 'Chiến Binh Rồng', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DragonWarrior&backgroundColor=f59e0b,ef4444' },
  { id: 'av_2', name: 'Sát Thủ Bóng Đêm', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ShadowNinja&backgroundColor=0f172a,312e81' },
  { id: 'av_3', name: 'Pháp Sư Băng', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=FrostMage&backgroundColor=0284c7,06b6d4' },
  { id: 'av_4', name: 'Xạ Thủ Cyber', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CyberGunner&backgroundColor=10b981,047857' },
  { id: 'av_5', name: 'Kiếm Vương', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=SwordMaster&backgroundColor=8b5cf6,6d28d9' },
  { id: 'av_6', name: 'Nữ Thần Ánh Sáng', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=LightGoddess&backgroundColor=ec4899,f43f5e' },
  { id: 'av_7', name: 'Mecha Robot', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=MechaTitan&backgroundColor=3b82f6,1d4ed8' },
  { id: 'av_8', name: 'Vua Hải Tặc', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=PirateLegend&backgroundColor=d97706,b45309' },
  { id: 'av_9', name: 'Hồ Ly Chibi', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=KitsuneSpirit&backgroundColor=f97316,ea580c' },
  { id: 'av_10', name: 'Cyber Valkyrie', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CyberValkyrie&backgroundColor=6366f1,4f46e5' },
  { id: 'av_11', name: 'Hiệp Sĩ Khiên', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=AegisKnight&backgroundColor=14b8a6,0f766e' },
  { id: 'av_12', name: 'Gamer Pro VIP', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ProChampion&backgroundColor=e11d48,be123c' },
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  onOpenWallet,
  onOpenReceivedCodes,
  onLogout,
  onShowToast,
  isDarkMode,
  onToggleTheme,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'telegram'>('profile');

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [phone, setPhone] = useState('');

  // Password states
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Status & UI
  const [isSaving, setIsSaving] = useState(false);
  const [isCopiedUid, setIsCopiedUid] = useState(false);
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);

  const handleVerifyEmail = async () => {
    if (!currentUser) return;
    setIsVerifyingEmail(true);
    try {
      const res = await dataService.verifyEmail();
      if (res.success) {
        onShowToast('Thành công!', res.message, 'success');
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#10B981', '#3B82F6', '#F59E0B'],
        });
        const updated = dataService.getCurrentUser();
        if (updated) {
          onUpdateUser(updated);
        }
      } else {
        onShowToast('Xác minh thất bại', res.message, 'error');
      }
    } catch (e: any) {
      onShowToast('Lỗi', e?.message || 'Không thể xác minh email lúc này.', 'error');
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  // Telegram states
  const [telegramStatus, setTelegramStatus] = useState<TelegramUserStatus | null>(null);
  const [isLoadingTelegram, setIsLoadingTelegram] = useState(false);
  const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);
  const [isUnlinkingTelegram, setIsUnlinkingTelegram] = useState(false);
  const [linkTokenData, setLinkTokenData] = useState<{ token: string; bot_username: string; expires_in: number; deep_link: string } | null>(null);
  const [prefNewCode, setPrefNewCode] = useState(true);
  const [prefExpiring, setPrefExpiring] = useState(true);
  const [prefEvent, setPrefEvent] = useState(true);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const loadTelegramStatus = async () => {
    const token = authService.getToken();
    if (!token) return;
    setIsLoadingTelegram(true);
    try {
      const res = await telegramService.getUserStatus(token);
      if (res.success && res.data) {
        setTelegramStatus(res.data);
        const types = res.data.subscriptions?.[0]?.notify_types?.split(',') || ['new_code', 'expiring', 'event'];
        setPrefNewCode(types.includes('new_code'));
        setPrefExpiring(types.includes('expiring'));
        setPrefEvent(types.includes('event'));
      }
    } catch (err) {
      console.error('Failed to load telegram status', err);
    } finally {
      setIsLoadingTelegram(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'telegram' && isOpen) {
      loadTelegramStatus();
    }
  }, [activeTab, isOpen]);

  const handleGenerateTelegramLink = async () => {
    const token = authService.getToken();
    if (!token) {
      onShowToast('Chưa đăng nhập', 'Vui lòng đăng nhập lại để liên kết Telegram.', 'error');
      return;
    }
    setIsLinkingTelegram(true);
    try {
      const res = await telegramService.generateLinkToken(token);
      if (res.success && res.data) {
        setLinkTokenData(res.data);
        onShowToast('Đã tạo liên kết', 'Hãy mở Telegram và ấn BẮT ĐẦU (START) để hoàn tất.', 'success');
        window.open(res.data.deep_link, '_blank');
      } else {
        onShowToast('Lỗi tạo liên kết', res.error || 'Không thể tạo mã liên kết.', 'error');
      }
    } catch (err: any) {
      onShowToast('Lỗi kết nối', err.message || 'Không thể kết nối đến máy chủ.', 'error');
    } finally {
      setIsLinkingTelegram(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy liên kết Telegram với tài khoản này không?')) return;
    const token = authService.getToken();
    if (!token) return;
    setIsUnlinkingTelegram(true);
    try {
      const res = await telegramService.unlink(token);
      if (res.success) {
        onShowToast('Đã hủy liên kết', 'Tài khoản của bạn đã được gỡ khỏi Telegram Bot.', 'info');
        setLinkTokenData(null);
        await loadTelegramStatus();
      } else {
        onShowToast('Lỗi hủy liên kết', res.error || 'Thao tác không thành công.', 'error');
      }
    } catch (err: any) {
      onShowToast('Lỗi kết nối', err.message, 'error');
    } finally {
      setIsUnlinkingTelegram(false);
    }
  };

  const handleSaveTelegramPrefs = async () => {
    const token = authService.getToken();
    if (!token) return;
    setIsSavingPrefs(true);
    try {
      const types: string[] = [];
      if (prefNewCode) types.push('new_code');
      if (prefExpiring) types.push('expiring');
      if (prefEvent) types.push('event');
      const res = await telegramService.updatePreferences(token, types);
      if (res.success) {
        onShowToast('Thành công', 'Đã lưu tùy chọn thông báo Telegram!', 'success');
        await loadTelegramStatus();
      } else {
        onShowToast('Lỗi', res.error || 'Không thể lưu tùy chọn.', 'error');
      }
    } catch (err: any) {
      onShowToast('Lỗi kết nối', err.message, 'error');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleUnfollowTelegramGame = async (slug: string) => {
    const token = authService.getToken();
    if (!token) return;
    try {
      const res = await telegramService.toggleFollowGame(token, slug, 'unfollow');
      if (res.success) {
        onShowToast('Đã hủy theo dõi', 'Bạn sẽ không nhận thông báo mã riêng của game này nữa.', 'info');
        await loadTelegramStatus();
      } else {
        onShowToast('Lỗi', res.error || 'Không thể hủy theo dõi.', 'error');
      }
    } catch (err: any) {
      onShowToast('Lỗi kết nối', err.message, 'error');
    }
  };

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || currentUser.username || '');
      setAvatarUrl(currentUser.avatar_url || '');
      setPhone(currentUser.phone || '');
      setCustomAvatarInput(currentUser.avatar_url || '');
    }
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, [currentUser, isOpen]);

  // Đồng bộ số dư Core thực tế từ Cloudflare D1 khi mở trang tài khoản
  useEffect(() => {
    if (isOpen && currentUser?.id) {
      dataService.refreshCurrentUserBalance().then(() => {
        const freshUser = dataService.getCurrentUser();
        if (freshUser) {
          onUpdateUser(freshUser);
        }
      }).catch(() => {});
    }
  }, [isOpen, currentUser?.id, onUpdateUser]);

  if (!isOpen || !currentUser) return null;

  const userUid = currentUser.id ? `WCG-${currentUser.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}` : 'WCG-MEMBER';

  const handleCopyUid = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(userUid);
      setIsCopiedUid(true);
      onShowToast('Đã sao chép UID!', `Mã nhân vật: ${userUid}`, 'success');
      setTimeout(() => setIsCopiedUid(false), 2000);
    }
  };

  const handleSelectPreset = (url: string) => {
    setAvatarUrl(url);
    setCustomAvatarInput(url);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      onShowToast('Lỗi', 'Tên nhân vật / Tên hiển thị không được để trống.', 'error');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        onShowToast('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        onShowToast('Lỗi', 'Xác nhận mật khẩu mới không khớp.', 'error');
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await authService.updateProfile({
        displayName: displayName.trim(),
        avatar_url: avatarUrl.trim(),
        phone: phone.trim(),
        oldPassword: oldPassword ? oldPassword.trim() : undefined,
        newPassword: newPassword ? newPassword.trim() : undefined,
      });

      if (res.success && res.user) {
        onUpdateUser(res.user);
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#10B981', '#6366F1', '#F59E0B'],
        });
        onShowToast('Thành công', res.message || 'Đã lưu thông tin nhân vật và tài khoản!', 'success');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      } else {
        onShowToast('Lỗi cập nhật', res.message || 'Không thể lưu thay đổi.', 'error');
      }
    } catch {
      onShowToast('Lỗi hệ thống', 'Đã xảy ra sự cố khi kết nối máy chủ.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabel =
    currentUser.role === 'admin' || currentUser.role === 'SUPER_ADMIN'
      ? 'Quản Trị Viên (Admin)'
      : currentUser.role === 'VIP'
      ? 'VIP Gamer'
      : 'Thành Viên Chính Thức';

  const roleColor =
    currentUser.role === 'admin' || currentUser.role === 'SUPER_ADMIN'
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      : currentUser.role === 'VIP'
      ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div
        className="relative w-full max-w-xl bg-card border border-border/90 rounded-3xl overflow-hidden shadow-2xl animate-scale-in my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-16 bg-primary/20 blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border/80 flex items-center justify-between shrink-0 bg-card/95 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 text-primary-light border border-primary/30 flex items-center justify-center shadow-sm shrink-0">
              <User className="w-5 h-5 text-primary-light" />
            </div>
            <div>
              <h3 className="font-heading font-black text-base sm:text-lg text-foreground flex items-center gap-2">
                <span>Hồ Sơ & Thông Tin Nhân Vật</span>
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              </h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Quản lý danh tính game thủ, đổi avatar và bảo mật tài khoản
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-border/60 px-4 sm:px-6 bg-muted/30 shrink-0">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-primary text-primary-light bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Thông Tin Nhân Vật</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'security'
                ? 'border-primary text-primary-light bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Bảo Mật & Mật Khẩu</span>
          </button>
          <button
            onClick={() => setActiveTab('telegram')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'telegram'
                ? 'border-[#229ED9] text-[#229ED9] bg-[#229ED9]/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Send className="w-4 h-4 text-[#229ED9]" />
            <span>Liên Kết Telegram</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1 text-xs sm:text-sm">
          {activeTab === 'profile' ? (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* 1. Identity & Card Overview */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-accent/5 to-muted/40 border border-border/80 flex flex-col sm:flex-row items-center gap-4">
                {/* Avatar Preview with Glowing Frame */}
                <div className="relative group shrink-0">
                  <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-muted overflow-hidden border-2 border-primary/50 shadow-md flex items-center justify-center p-1 bg-gradient-to-b from-card to-muted">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar nhân vật"
                        className="w-full h-full object-cover rounded-xl"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName || 'User')}`;
                        }}
                      />
                    ) : (
                      <User className="w-10 h-10 text-muted-foreground" />
                    )}
                  </div>
                  <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-card shadow-sm" />
                </div>

                {/* Info Text & Badges */}
                <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h4 className="text-base sm:text-lg font-black text-foreground truncate">
                      {displayName || currentUser.username}
                    </h4>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleColor}`}>
                      {roleLabel}
                    </span>
                  </div>

                  {/* UID Box with One-Click Copy */}
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-[11px] text-muted-foreground">Mã Nhân Vật:</span>
                    <button
                      type="button"
                      onClick={handleCopyUid}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-foreground font-mono font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-sm"
                      title="Sao chép UID"
                    >
                      <span>{userUid}</span>
                      {isCopiedUid ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  {/* Core Balance Box */}
                  <div className="flex items-center justify-center sm:justify-start gap-3 pt-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span>Số dư:</span>
                      <span className="font-mono font-extrabold text-emerald-400">
                        {formatCore(currentUser.wallet_balance)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenWallet();
                      }}
                      className="text-[11px] text-primary-light hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Wallet className="w-3 h-3" />
                      <span>Nạp Core ↗</span>
                    </button>
                  </div>

                  {/* Quick Action: Kho mã & Nhiệm vụ */}
                  {onOpenReceivedCodes && (
                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-2 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenReceivedCodes('missions');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-emerald-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 text-foreground border border-amber-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <Package className="w-3.5 h-3.5 text-amber-400" />
                        <span>Kho Mã Của Tôi</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                          <Target className="w-2.5 h-2.5" />
                          Nhiệm Vụ ↗
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Choose Avatar Presets (12 Game Chibi/Cyber Characters) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground text-xs sm:text-sm flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-primary-light" />
                    <span>Bộ Sưu Tập Avatar Nhân Vật Game:</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">Nhấp để chọn ngay</span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-2.5 p-3 rounded-2xl bg-muted/30 border border-border/60">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = avatarUrl === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset.url)}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all cursor-pointer group ${
                          isSelected
                            ? 'bg-primary/20 border-primary shadow-sm scale-105 ring-2 ring-primary/40'
                            : 'bg-card hover:bg-muted border-border/80 hover:border-primary/40'
                        }`}
                        title={preset.name}
                      >
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg overflow-hidden bg-card border border-border/60">
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                        </div>
                        <span className="text-[9px] font-bold text-slate-300 truncate w-full text-center">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Avatar Link Input */}
                <div className="pt-1">
                  <input
                    type="url"
                    value={customAvatarInput}
                    onChange={(e) => {
                      setCustomAvatarInput(e.target.value);
                      setAvatarUrl(e.target.value);
                    }}
                    placeholder="Hoặc dán đường dẫn link ảnh Avatar tùy chỉnh (URL)..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-muted/60 border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* 3. Character & Account Details Form */}
              <div className="space-y-4">
                {/* Tên Nhân Vật / Tên Hiển Thị */}
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground text-xs sm:text-sm flex items-center gap-1.5">
                    <User className="w-4 h-4 text-primary-light" />
                    <span>Tên Nhân Vật / Tên Hiển Thị:</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                    placeholder="Nhập tên nhân vật hiển thị (VD: VuaHảiTặc_99)..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-medium"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Tên này sẽ hiển thị ở thanh công cụ, bảng xếp hạng và các bình luận giftcode của bạn.
                  </p>
                </div>

                {/* Read-Only: Tên Đăng Nhập & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-muted-foreground text-xs flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Tên Đăng Nhập (Cố định):</span>
                    </label>
                    <input
                      type="text"
                      disabled
                      value={currentUser.username || 'user'}
                      className="w-full px-3.5 py-2 rounded-xl bg-muted/50 border border-border text-muted-foreground font-mono text-xs cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-muted-foreground text-xs flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Email Đăng Ký:</span>
                      </label>
                      {currentUser.email_verified ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Đã xác minh</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Chưa xác minh</span>
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      disabled
                      value={currentUser.email || 'Chưa cập nhật'}
                      className="w-full px-3.5 py-2 rounded-xl bg-muted/50 border border-border text-muted-foreground font-mono text-xs cursor-not-allowed"
                    />
                    {!currentUser.email_verified && (
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 mt-1.5">
                        <div className="text-[11px] text-amber-300 leading-tight">
                          Xác minh email để hưởng <strong>Ưu Đãi Mua Lần Đầu 2.000 Core</strong>
                        </div>
                        <button
                          type="button"
                          disabled={isVerifyingEmail || !currentUser.email}
                          onClick={handleVerifyEmail}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isVerifyingEmail ? 'Đang gửi...' : 'Xác minh ngay'}
                        </button>
                      </div>
                    )}
                    {currentUser.email_verified && (
                      <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                        <Check className="w-3 h-3 shrink-0" />
                        <span>Email hợp lệ • Đã kích hoạt quyền nhận Ưu Đãi Mua Lần Đầu.</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Số Điện Thoại Liên Hệ */}
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground text-xs sm:text-sm flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-emerald-400" />
                    <span>Số Điện Thoại Nhận Quà / Zalo (Tùy chọn):</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0987.xxx.xxx (để NPH gửi quà sự kiện hoặc CSKH)..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-medium"
                  />
                </div>
              </div>

              {/* 4. Cài Đặt Giao Diện & Ngôn Ngữ Hiển Thị */}
              <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border/80">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary-light" />
                    <h4 className="font-bold text-foreground text-xs sm:text-sm">
                      Giao Diện & Ngôn Ngữ Hiển Thị
                    </h4>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Tùy biến trải nghiệm cá nhân</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Chế độ Sáng / Tối */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-primary-light shrink-0">
                        {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div>
                        <div className="font-bold text-foreground text-xs">
                          {isDarkMode ? 'Chế Độ Sáng' : 'Chế Độ Tối'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {isDarkMode ? 'Giao diện nền sáng' : 'Giao diện nền tối Cyber'}
                        </div>
                      </div>
                    </div>
                    {onToggleTheme && (
                      <button
                        type="button"
                        onClick={onToggleTheme}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/20 hover:bg-primary/30 text-primary-light border border-primary/40 transition-all cursor-pointer active:scale-95"
                      >
                        {isDarkMode ? 'Chuyển Tối' : 'Chuyển Sáng'}
                      </button>
                    )}
                  </div>

                  {/* Ngôn Ngữ Hệ Thống */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-secondary shrink-0">
                        <Globe className="w-4 h-4 text-secondary" />
                      </div>
                      <div>
                        <div className="font-bold text-foreground text-xs">Ngôn Ngữ</div>
                        <div className="text-[10px] text-muted-foreground">Tiếng Việt / English</div>
                      </div>
                    </div>
                    <LanguageSelector variant="pill" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 text-xs sm:text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng Xuất</span>
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold border border-border transition-all cursor-pointer text-xs sm:text-sm"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-extrabold shadow-glow-primary flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 text-xs sm:text-sm disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Đang Lưu...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Lưu Thay Đổi</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          ) : activeTab === 'security' ? (
            /* SECURITY TAB: Password Change */
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Bảo Mật Tài Khoản Cấp Cao</p>
                  <p className="text-amber-200/80 mt-0.5 leading-relaxed">
                    Mật khẩu được mã hóa an toàn bằng công nghệ SHA-256 kèm mã muối Salt trên hệ thống Cloudflare Edge. Không chia sẻ mật khẩu của bạn cho bất kỳ ai.
                  </p>
                </div>
              </div>

              {/* Mật khẩu cũ */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground text-xs sm:text-sm flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <span>Mật Khẩu Hiện Tại:</span>
                </label>
                <div className="relative">
                  <input
                    type={showOldPass ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại của bạn..."
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1"
                  >
                    {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground text-xs sm:text-sm flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-primary-light" />
                  <span>Mật Khẩu Mới:</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)..."
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Xác nhận mật khẩu mới */}
              <div className="space-y-1.5">
                <label className="font-bold text-foreground text-xs sm:text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Xác Nhận Mật Khẩu Mới:</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold border border-border transition-all cursor-pointer text-xs sm:text-sm"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !newPassword}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-extrabold shadow-glow-primary flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 text-xs sm:text-sm disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang Đổi Mật Khẩu...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Cập Nhật Mật Khẩu</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* TELEGRAM TAB: Link Account & Notification Preferences */
            <div className="space-y-5">
              {isLoadingTelegram ? (
                <div className="p-8 text-center space-y-3">
                  <div className="w-8 h-8 mx-auto border-3 border-[#229ED9]/30 border-t-[#229ED9] rounded-full animate-spin" />
                  <p className="text-xs text-muted-foreground">Đang tải trạng thái liên kết Telegram...</p>
                </div>
              ) : telegramStatus?.is_linked ? (
                <>
                  {/* Status Banner */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#229ED9]/10 border border-[#229ED9]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#229ED9]/20 text-[#229ED9] flex items-center justify-center border border-[#229ED9]/40 shadow-sm shrink-0">
                        <Send className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-foreground text-sm">
                            {telegramStatus.telegram_username ? `@${telegramStatus.telegram_username}` : 'Đã liên kết Telegram'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Đang Hoạt Động
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Liên kết từ: {telegramStatus.telegram_linked_at ? formatFullDateTime(telegramStatus.telegram_linked_at) : 'Gần đây'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleUnlinkTelegram}
                      disabled={isUnlinkingTelegram}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>{isUnlinkingTelegram ? 'Đang hủy...' : 'Hủy liên kết'}</span>
                    </button>
                  </div>

                  {/* Notification Preferences */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-[#229ED9]" />
                        <h4 className="font-bold text-foreground text-xs sm:text-sm">Tùy Chọn Thông Báo Riêng (DM Bot)</h4>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Khung giờ 09:00 - 22:00</span>
                    </div>

                    <div className="space-y-2.5">
                      <label className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={prefNewCode}
                          onChange={(e) => setPrefNewCode(e.target.checked)}
                          className="w-4 h-4 rounded text-[#229ED9] focus:ring-[#229ED9]"
                        />
                        <div className="flex-1 text-xs">
                          <p className="font-bold text-foreground">Mã Giftcode Mới</p>
                          <p className="text-[11px] text-muted-foreground">Nhận thông báo khi có mã code mới cho game bạn theo dõi</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={prefExpiring}
                          onChange={(e) => setPrefExpiring(e.target.checked)}
                          className="w-4 h-4 rounded text-[#229ED9] focus:ring-[#229ED9]"
                        />
                        <div className="flex-1 text-xs">
                          <p className="font-bold text-foreground">Mã Sắp Hết Hạn</p>
                          <p className="text-[11px] text-muted-foreground">Cảnh báo trước 24 giờ để không bỏ lỡ mã quà tặng quý</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={prefEvent}
                          onChange={(e) => setPrefEvent(e.target.checked)}
                          className="w-4 h-4 rounded text-[#229ED9] focus:ring-[#229ED9]"
                        />
                        <div className="flex-1 text-xs">
                          <p className="font-bold text-foreground">Sự Kiện & Giveaway Đặc Biệt</p>
                          <p className="text-[11px] text-muted-foreground">Nhận tin sự kiện lớn, phát mã giới hạn từ NPH</p>
                        </div>
                      </label>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-border/60">
                      <button
                        type="button"
                        onClick={handleSaveTelegramPrefs}
                        disabled={isSavingPrefs}
                        className="px-4 py-2 rounded-xl bg-[#229ED9] hover:bg-[#1f8ec4] text-white text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {isSavingPrefs ? 'Đang lưu...' : 'Lưu Tùy Chọn'}
                      </button>
                    </div>
                  </div>

                  {/* Subscriptions List */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border space-y-3">
                    <h4 className="font-bold text-foreground text-xs sm:text-sm flex items-center justify-between">
                      <span>Game Bạn Đang Theo Dõi</span>
                      <span className="text-[11px] font-mono font-bold text-muted-foreground">
                        {telegramStatus.subscriptions?.length || 0} game
                      </span>
                    </h4>

                    {telegramStatus.subscriptions && telegramStatus.subscriptions.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {telegramStatus.subscriptions.map((sub) => (
                          <div
                            key={sub.game_slug}
                            className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/60 text-xs"
                          >
                            <span className="font-mono font-bold text-foreground truncate max-w-[150px]">
                              {sub.game_slug}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUnfollowTelegramGame(sub.game_slug)}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                              title="Hủy theo dõi game này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground py-2 text-center">
                        Bạn chưa theo dõi game nào. Hãy mở chi tiết game trên website và ấn &quot;Theo dõi qua Telegram&quot; hoặc gõ <code>/theodoi &lt;slug&gt;</code> với Bot.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                /* Not Linked State */
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-[#229ED9]/15 via-accent/5 to-muted/40 border border-[#229ED9]/30 text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-[#229ED9]/20 text-[#229ED9] flex items-center justify-center border border-[#229ED9]/30 shadow-sm">
                      <Send className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-foreground text-sm sm:text-base">
                        Liên Kết Telegram Nhận Mã Tức Thì
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
                        Kết nối tài khoản của bạn với Bot Telegram CodeGame để nhận mã giftcode riêng tự động, cảnh báo mã sắp hết hạn và quản lý game yêu thích 24/7.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left pt-2">
                      <div className="p-2.5 rounded-xl bg-card border border-border text-[11px] space-y-1">
                        <p className="font-bold text-foreground">⚡ Nhận Mã Tức Thì</p>
                        <p className="text-muted-foreground">Bot gửi trực tiếp vào Telegram ngay khi có mã mới.</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-card border border-border text-[11px] space-y-1">
                        <p className="font-bold text-foreground">⏰ Báo Hạn Chính Xác</p>
                        <p className="text-muted-foreground">Nhắc nhở trước khi giftcode hết hạn 24 giờ.</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-card border border-border text-[11px] space-y-1">
                        <p className="font-bold text-foreground">🎯 Tùy Chọn Linh Hoạt</p>
                        <p className="text-muted-foreground">Chỉ nhận mã của game bạn quan tâm, không spam.</p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleGenerateTelegramLink}
                        disabled={isLinkingTelegram}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#229ED9] hover:bg-[#1f8ec4] text-white font-extrabold text-xs sm:text-sm shadow-md transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        <span>{isLinkingTelegram ? 'Đang tạo liên kết...' : 'Liên Kết Với Telegram Ngay'}</span>
                      </button>
                    </div>
                  </div>

                  {linkTokenData && (
                    <div className="p-4 rounded-2xl bg-card border border-[#229ED9]/50 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-xs">Mã liên kết 1 lần (15 phút)</span>
                        <span className="text-[10px] font-mono text-amber-400">Hết hạn sau 15 phút</span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <a
                          href={linkTokenData.deep_link}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-[#229ED9] hover:bg-[#1f8ec4] text-white font-extrabold text-xs text-center flex items-center justify-center gap-2 shadow-sm transition-all"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Mở Bot Telegram & Ấn START</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => loadTelegramStatus()}
                          className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs border border-border cursor-pointer transition-all"
                        >
                          Tôi Đã Bấm START Xong
                        </button>
                      </div>

                      <p className="text-[11px] text-muted-foreground text-center">
                        Hoặc gửi tin nhắn sau cho Bot <strong className="text-foreground">@{linkTokenData.bot_username}</strong>:
                        <code className="block mt-1 font-mono text-xs bg-muted p-1.5 rounded-lg text-[#229ED9] select-all">
                          /start link_{linkTokenData.token}
                        </code>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
