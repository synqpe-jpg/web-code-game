import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Edit2,
  Boxes,
  History,
  Search,
  Upload,
  X,
  Power,
  PowerOff,
  Play,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  Zap,
  Eye,
  EyeOff,
  Clock,
  Users,
  Bell,
  MessageSquare,
  ExternalLink,
  Dices,
  Link2,
  Sliders,
  RefreshCw,
} from 'lucide-react';
import { LuckyWheelAdminManager } from '../components/LuckyWheelAdminManager';
import { FormModal } from '../components/ui/FormModal';
import { UniversalTemplateModal } from '../components/UniversalTemplateModal';
import { templateService } from '../../services/templateService';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ImageUploadInput } from '../components/ui/ImageUploadInput';
import { SearchableGameSelect } from '../components/ui/SearchableGameSelect';
import { QuickFomoAdjustModal } from '../components/ui/QuickFomoAdjustModal';
import { adminDataService } from '../services/adminDataService';
import { marketingService } from '../../services/marketingService';
import { GameAdminRecord } from '../types/adminTypes';
import { formatFullDateTime, smartVietnameseMatch } from '../../utils/textUtils';
import type { GiveawayCampaign } from '../../types/game';

interface PrivateCodesModuleProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'error' | 'info') => void;
}

export const PrivateCodesModule: React.FC<PrivateCodesModuleProps> = ({ onShowToast }) => {
  const [giveaways, setGiveaways] = useState<GiveawayCampaign[]>([]);
  const [games, setGames] = useState<GameAdminRecord[]>([]);
  const [selectedGameFilter, setSelectedGameFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'campaigns' | 'wheel'>('campaigns');

  // --- SHOW / HIDE VIRTUAL METRICS TOGGLE ---
  const [showVirtualStats, setShowVirtualStats] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('wcg_admin_show_virtual_stats') !== 'false';
  });

  const [showAdminClaimed, setShowAdminClaimed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('wcg_admin_show_claimed_gw') !== 'false';
  });

  const [showAdminStock, setShowAdminStock] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('wcg_admin_show_stock_gw') !== 'false';
  });

  // --- QUICK FOMO ADJUST MODAL STATE ---
  const [fomoAdjustCampaign, setFomoAdjustCampaign] = useState<GiveawayCampaign | null>(null);
  const [isResettingAllFomo, setIsResettingAllFomo] = useState(false);

  // --- CREATE / EDIT GIVEAWAY MODAL STATE ---
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GiveawayCampaign | null>(null);
  const [formData, setFormData] = useState({
    title: 'Code riêng Genshin Impact',
    game_slug: 'genshin-impact',
    game_name: 'Genshin Impact',
    description: 'Code dùng cho 1 tài khoản, 1 loại dùng 1 lần.',
    rewards: 'Code ngẫu nhiên',
    use_template: true,
    total_codes: 0,
    claimed_codes: 0,
    min_account_age_days: 0,
    max_per_user: 1,
    max_per_ip: 1,
    cooldown_hours: 1,
    global_cooldown_seconds: 0,
    last_global_claim_at: '',
    custom_success_msg: '',
    custom_cooldown_msg: '',
    custom_out_of_stock_msg: '',
    enable_waiting_room: true,
    waiting_users_min: 25,
    waiting_users_max: 85,
    custom_banner_enabled: false,
    custom_banner_text: 'Tham gia nhóm zalo của web tại đây',
    custom_banner_link: '',
    show_claimed_count: true,
    virtual_claimed_offset: 0,
    start_time: '2026-09-01',
    end_time: '2026-12-31',
    is_active: true,
    cover_image_url: '/game_icons/genshin-impact.webp',
    packages: [] as any[],
  });

  // --- BATCH CODE POOL MODAL STATE (KHO MÃ) ---
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [currentCampaignForPool, setCurrentCampaignForPool] = useState<GiveawayCampaign | null>(null);
  const [batchPoolLines, setBatchPoolLines] = useState('');
  const [selectedPoolCodes, setSelectedPoolCodes] = useState<string[]>([]);
  const [poolTab, setPoolTab] = useState<'ADD' | 'LIST'>('ADD');

  // --- CLAIM HISTORY MODAL STATE (LỊCH SỬ) ---
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [currentCampaignForHistory, setCurrentCampaignForHistory] = useState<GiveawayCampaign | null>(null);

  // Delete Confirm Modal
  const [deletingCampaign, setDeletingCampaign] = useState<GiveawayCampaign | null>(null);

  // Persistence loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPool, setIsSavingPool] = useState(false);

  // Warn user before leaving if saving is currently in flight
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSaving || isSavingPool) {
        e.preventDefault();
        e.returnValue = 'Hệ thống đang lưu dữ liệu lên máy chủ, vui lòng đợi trong giây lát!';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSaving, isSavingPool]);

  useEffect(() => {
    setGames(adminDataService.getGames());
    loadData();

    const handleSync = () => {
      setGames(adminDataService.getGames());
      loadData();
    };

    window.addEventListener('wcg_admin_data_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('wcg_admin_data_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const loadData = () => {
    const gList = adminDataService.getGiveaways();
    setGiveaways(gList);
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
    onShowToast('Đã sao chép mã', code, 'info');
  };

  // --- OPEN MODAL HANDLERS ---
  const handleOpenCreate = () => {
    setEditingItem(null);
    const defaultGame = games[0];
    const initialGameName = defaultGame?.name || 'Genshin Impact';
    setFormData({
      title: `Code riêng ${initialGameName}`,
      game_slug: defaultGame?.slug || 'genshin-impact',
      game_name: initialGameName,
      description: 'Code dùng cho 1 tài khoản, 1 loại dùng 1 lần.',
      rewards: 'Code ngẫu nhiên',
      use_template: true,
      total_codes: 0,
      claimed_codes: 0,
      min_account_age_days: 0,
      max_per_user: 1,
      max_per_ip: 1,
      cooldown_hours: 1,
      global_cooldown_seconds: 0,
      last_global_claim_at: '',
      custom_success_msg: '',
      custom_cooldown_msg: 'Đợt phát trước đạo hữu {last_user} đã nhanh tay đi trước, đạo hữu vui lòng đợi {time_left} rồi thử sức lại.',
      custom_out_of_stock_msg: '',
      enable_waiting_room: true,
      waiting_users_min: 25,
      waiting_users_max: 85,
      custom_banner_enabled: false,
      custom_banner_text: 'Tham gia nhóm zalo của web tại đây',
      custom_banner_link: '',
      show_claimed_count: true,
      virtual_claimed_offset: 0,
      start_time: new Date().toISOString().split('T')[0],
      end_time: '2026-12-31',
      is_active: true,
      cover_image_url: defaultGame?.icon_url || '/game_icons/genshin-impact.webp',
      packages: [],
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (gw: GiveawayCampaign) => {
    setEditingItem(gw);
    const poolCount = gw.codes_pool?.length || 0;
    const currentTotal = poolCount > 0 ? poolCount + (gw.claimed_codes || 0) : (gw.total_codes || 0);
    setFormData({
      title: gw.title,
      game_slug: gw.game_slug,
      game_name: gw.game_name,
      description: gw.description || '',
      rewards: gw.rewards || '',
      use_template: gw.use_template !== false,
      total_codes: currentTotal,
      claimed_codes: gw.claimed_codes || 0,
      min_account_age_days: gw.min_account_age_days !== undefined ? Number(gw.min_account_age_days) : 0,
      max_per_user: gw.max_per_user !== undefined ? Number(gw.max_per_user) : 1,
      max_per_ip: gw.max_per_ip !== undefined ? Number(gw.max_per_ip) : 1,
      cooldown_hours: gw.cooldown_hours !== undefined ? Number(gw.cooldown_hours) : 0,
      global_cooldown_seconds: Number(gw.global_cooldown_seconds || 0),
      last_global_claim_at: gw.last_global_claim_at || '',
      custom_success_msg: gw.custom_success_msg || '',
      custom_cooldown_msg: gw.custom_cooldown_msg || '',
      custom_out_of_stock_msg: gw.custom_out_of_stock_msg || '',
      enable_waiting_room: gw.enable_waiting_room !== false,
      waiting_users_min: gw.waiting_users_min !== undefined ? Number(gw.waiting_users_min) : 25,
      waiting_users_max: gw.waiting_users_max !== undefined ? Number(gw.waiting_users_max) : 85,
      custom_banner_enabled: Boolean(gw.custom_banner_enabled),
      custom_banner_text: gw.custom_banner_text || 'Tham gia nhóm zalo của web tại đây',
      custom_banner_link: gw.custom_banner_link || '',
      show_claimed_count: gw.show_claimed_count !== false,
      virtual_claimed_offset: gw.virtual_claimed_offset || 0,
      start_time: gw.start_time ? gw.start_time.split('T')[0] : '2026-09-01',
      end_time: gw.end_time ? gw.end_time.split('T')[0] : '2026-12-31',
      is_active: gw.is_active,
      cover_image_url: gw.cover_image_url || gw.game_icon_url || '',
      packages: gw.packages || [],
    });
    setIsFormOpen(true);
  };

  const handleResetGlobalCooldown = async (gw: GiveawayCampaign) => {
    gw.last_global_claim_at = '';
    adminDataService.saveGiveawayItem(gw);
    await adminDataService.saveGiveawaysToServer();
    loadData();
    onShowToast('Đã mở đợt phát ngay', `Đã xóa thời gian chờ toàn sàn cho "${gw.title}". Khách có thể giật mã tiếp theo ngay lập tức.`, 'success');
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.game_name.trim()) {
      onShowToast('Lỗi', 'Vui lòng nhập tên đợt phát và chọn game.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const existingPool = editingItem?.codes_pool || [];
      const poolLength = Array.isArray(existingPool) && existingPool.length > 0
        ? existingPool.length
        : Math.max(0, Number(editingItem?.remaining_codes || 0));
      const safeClaimed = editingItem ? Number(editingItem.claimed_codes || 0) : 0;
      const calculatedTotal = poolLength + safeClaimed;

      adminDataService.saveGiveawayItem({
        id: editingItem?.id,
        title: formData.title.trim(),
        game_slug: formData.game_slug.trim().toLowerCase(),
        game_name: formData.game_name.trim(),
        description: formData.description.trim(),
        rewards: formData.rewards.trim(),
        use_template: formData.use_template !== false,
        total_codes: calculatedTotal,
        remaining_codes: poolLength,
        claimed_codes: safeClaimed,
        min_account_age_days: Number(formData.min_account_age_days),
        max_per_user: Number(formData.max_per_user),
        max_per_ip: Number(formData.max_per_ip),
        cooldown_hours: Number(formData.cooldown_hours),
        global_cooldown_seconds: Number(formData.global_cooldown_seconds) || 0,
        last_global_claim_at: formData.last_global_claim_at,
        last_claimer_name: editingItem?.last_claimer_name || '',
        custom_success_msg: formData.custom_success_msg.trim(),
        custom_cooldown_msg: formData.custom_cooldown_msg.trim(),
        custom_out_of_stock_msg: formData.custom_out_of_stock_msg.trim(),
        enable_waiting_room: formData.enable_waiting_room,
        waiting_users_min: Number(formData.waiting_users_min) || 0,
        waiting_users_max: Number(formData.waiting_users_max) || 0,
        custom_banner_enabled: Boolean(formData.custom_banner_enabled),
        custom_banner_text: formData.custom_banner_text ? formData.custom_banner_text.trim() : 'Tham gia nhóm zalo của web tại đây',
        custom_banner_link: formData.custom_banner_link ? formData.custom_banner_link.trim() : '',
        show_claimed_count: formData.show_claimed_count,
        virtual_claimed_offset: Number(formData.virtual_claimed_offset) || 0,
        start_time: formData.start_time,
        end_time: formData.end_time,
        created_at: editingItem?.created_at || (editingItem as any)?.createdAt || new Date().toISOString(),
        is_active: formData.is_active,
        packages: formData.packages || editingItem?.packages || [],
        game_icon_url: formData.cover_image_url || `/game_icons/${formData.game_slug}.webp`,
        cover_image_url: formData.cover_image_url,
        codes_pool: existingPool,
        claim_history: editingItem?.claim_history || [],
      });

      // Await direct fast D1 persistence
      await adminDataService.saveGiveawaysToServer();

      onShowToast(
        'Thành công',
        editingItem
          ? `Đã cập nhật đợt phát "${formData.title}".`
          : `Đã tạo đợt phát code riêng "${formData.title}" mới.`,
        'success'
      );
      setIsFormOpen(false);
      loadData();
    } catch (err: any) {
      onShowToast('Lỗi lưu đợt phát', err?.message || 'Có lỗi khi lưu lên máy chủ D1', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // --- KHO MÃ (CODE POOL) HANDLERS ---
  const handleOpenPoolModal = (gw: GiveawayCampaign) => {
    setCurrentCampaignForPool(gw);
    setBatchPoolLines('');
    setSelectedPoolCodes([]);
    setPoolTab('ADD');
    setIsPoolModalOpen(true);
  };

  const handleSavePoolCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCampaignForPool) return;

    const newCodes = batchPoolLines
      .split('\n')
      .map((l) => l.trim().toUpperCase())
      .filter(Boolean);

    if (newCodes.length === 0) {
      onShowToast('Lỗi', 'Vui lòng nhập ít nhất một mã code.', 'error');
      return;
    }

    setIsSavingPool(true);
    try {
      const currentPool = currentCampaignForPool.codes_pool || [];
      const updatedPool = [...new Set([...currentPool, ...newCodes])];

      currentCampaignForPool.codes_pool = updatedPool;
      currentCampaignForPool.remaining_codes = updatedPool.length;
      currentCampaignForPool.total_codes = updatedPool.length + (currentCampaignForPool.claimed_codes || 0);
      currentCampaignForPool.updated_at = new Date().toISOString();

      adminDataService.saveGiveawayItem(currentCampaignForPool);
      await adminDataService.saveGiveawaysToServer();

      onShowToast(
        'Đã nạp kho mã!',
        `Đã thêm ${newCodes.length} mã vào kho phát riêng của "${currentCampaignForPool.title}". Dữ liệu đã lưu vĩnh viễn trên Cloudflare D1.`,
        'success'
      );
      setIsPoolModalOpen(false);
      loadData();
    } catch (err: any) {
      onShowToast('Lỗi lưu kho mã', err?.message || 'Có lỗi khi lưu kho mã lên máy chủ D1', 'error');
    } finally {
      setIsSavingPool(false);
    }
  };

  const handleDeletePoolCode = async (code: string) => {
    if (!currentCampaignForPool) return;
    const ok = adminDataService.deleteGiveawayPoolCode(currentCampaignForPool.id, code);
    if (ok) {
      await adminDataService.saveGiveawaysToServer();
      onShowToast('Đã xóa mã', `Đã xóa mã ${code} khỏi kho phát riêng.`, 'info');
      const updatedPool = (currentCampaignForPool.codes_pool || []).filter((c) => c !== code);
      setCurrentCampaignForPool({
        ...currentCampaignForPool,
        codes_pool: updatedPool,
        remaining_codes: updatedPool.length,
        total_codes: updatedPool.length + (currentCampaignForPool.claimed_codes || 0),
      });
      loadData();
    }
  };

  const handleBulkDeletePoolCodes = async () => {
    if (!currentCampaignForPool || selectedPoolCodes.length === 0) return;
    const count = adminDataService.deleteGiveawayPoolCodesBulk(currentCampaignForPool.id, selectedPoolCodes);
    await adminDataService.saveGiveawaysToServer();
    onShowToast('Đã xóa', `Đã xóa ${count} mã khỏi kho phát riêng.`, 'success');
    const codeSet = new Set(selectedPoolCodes);
    const updatedPool = (currentCampaignForPool.codes_pool || []).filter((c) => !codeSet.has(c));
    setCurrentCampaignForPool({
      ...currentCampaignForPool,
      codes_pool: updatedPool,
      remaining_codes: updatedPool.length,
      total_codes: updatedPool.length + (currentCampaignForPool.claimed_codes || 0),
    });
    setSelectedPoolCodes([]);
    loadData();
  };

  // --- CLAIM HISTORY HANDLER ---
  const handleOpenHistoryModal = (gw: GiveawayCampaign) => {
    setCurrentCampaignForHistory(gw);
    setIsHistoryModalOpen(true);
  };

  // --- TOGGLE STATUS (ĐÓNG / MỞ) ---
  const handleToggleActive = async (gw: GiveawayCampaign) => {
    const newStatus = gw.is_active === false;
    const updatedGw: GiveawayCampaign = {
      ...gw,
      is_active: newStatus,
    };
    adminDataService.saveGiveawayItem(updatedGw);
    await adminDataService.saveGiveawaysToServer();
    loadData();
    onShowToast(
      newStatus ? 'Đã mở đợt phát!' : 'Đã đóng đợt phát!',
      `Đợt phát "${gw.title}" hiện ${newStatus ? 'đang mở (khách có thể nhận quà)' : 'đã tạm đóng (khách không thể nhận)'}.`,
      newStatus ? 'success' : 'info'
    );
  };

  const handleBatchToggleAll = async (enable: boolean) => {
    const actionText = enable ? 'mở tất cả' : 'đóng tất cả';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} các đợt phát Giveaway không?`)) {
      return;
    }
    const currentList = adminDataService.getGiveaways();
    currentList.forEach((gw) => {
      gw.is_active = enable;
      adminDataService.saveGiveawayItem(gw);
    });
    await adminDataService.saveGiveawaysToServer();
    loadData();
    onShowToast(
      enable ? 'Đã mở tất cả đợt phát!' : 'Đã đóng tất cả đợt phát!',
      `Đã cập nhật trạng thái cho ${currentList.length} đợt phát giveaway.`,
      enable ? 'success' : 'info'
    );
  };

  // --- DELETE CAMPAIGN ---
  const handleDeleteConfirm = async () => {
    if (!deletingCampaign) return;
    adminDataService.deleteGiveaway(deletingCampaign.id);
    await adminDataService.saveGiveawaysToServer();
    onShowToast('Đã xóa', `Đã xóa đợt phát "${deletingCampaign.title}".`, 'info');
    setDeletingCampaign(null);
    loadData();
  };

  const handleResetAllFomoToReal = async () => {
    if (!window.confirm('Bạn có chắc muốn Reset toàn bộ số ảo của tất cả các đợt phát Giveaway về đúng dữ liệu thật 100% (0 ảo)? Web khách sẽ hiển thị chuẩn xác số lượng thật.')) {
      return;
    }
    setIsResettingAllFomo(true);
    try {
      const giveawayItems = giveaways.map((gw) => {
        const poolCount = Array.isArray(gw.codes_pool) && gw.codes_pool.length > 0 ? gw.codes_pool.length : Math.max(0, Number(gw.remaining_codes || 0));
        return {
          id: gw.id,
          claimed_codes: gw.claimed_codes || 0,
          remaining_codes: poolCount,
        };
      });
      await marketingService.resetAllGiveawaysToReal(giveawayItems);
      loadData();
      onShowToast(
        'Đã reset toàn bộ số ảo Giveaway!',
        'Tất cả các đợt phát Giveaway đã được đưa về đúng số lượng thật 100% ngoài web.',
        'success'
      );
    } catch (err: any) {
      onShowToast('Lỗi reset số ảo', err?.message || 'Có lỗi xảy ra', 'error');
    } finally {
      setIsResettingAllFomo(false);
    }
  };

  const handleRandomizeVirtualClaimed = () => {
    const currentList = adminDataService.getGiveaways();
    let updatedCount = 0;
    currentList.forEach((gw) => {
      // Bổ sung số ảo đã giật ngẫu nhiên từ 52 đến 112
      const randomOffset = Math.floor(Math.random() * (112 - 52 + 1)) + 52;
      const updatedGw: GiveawayCampaign = {
        ...gw,
        virtual_claimed_offset: randomOffset,
        show_claimed_count: true,
        virtual_claimed_updated_at: new Date().toISOString(),
      };
      adminDataService.saveGiveawayItem(updatedGw);
      const targetDisp = randomOffset + (Number(updatedGw.claimed_codes) || 0);
      marketingService.syncGiveawayVirtualClaimed(
        updatedGw.id,
        randomOffset,
        true,
        targetDisp,
        updatedGw.virtual_claimed_updated_at
      );
      updatedCount++;
    });
    loadData();
    onShowToast?.(
      'Bổ sung số ảo thành công',
      `Đã cập nhật số ảo đã giật ngẫu nhiên (52–112) cho toàn bộ ${updatedCount} đợt phát code!`,
      'success'
    );
  };

  const activeCount = giveaways.filter((g) => g.is_active !== false).length;
  const inactiveCount = giveaways.filter((g) => g.is_active === false).length;

  // Filter & Search
  const filteredGiveaways = giveaways.filter((g) => {
    if (selectedGameFilter !== 'ALL' && g.game_slug !== selectedGameFilter) return false;
    if (statusFilter === 'ACTIVE' && g.is_active === false) return false;
    if (statusFilter === 'INACTIVE' && g.is_active !== false) return false;
    if (searchQuery.trim()) {
      return smartVietnameseMatch(
        [g.title, g.game_name, g.game_slug, g.description, g.rewards],
        searchQuery
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Subtab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setSubTab('campaigns')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'campaigns'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>🎁 Đợt Phát Code (Giveaway)</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 text-white font-mono">
            {giveaways.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('wheel')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'wheel'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
          }`}
        >
          <Dices className="w-3.5 h-3.5 text-amber-400" />
          <span>🎡 Quản Lý Vòng Quay May Mắn</span>
        </button>
      </div>

      {subTab === 'wheel' ? (
        <LuckyWheelAdminManager onShowToast={onShowToast} contextTitle="Phát Code & Giveaway" />
      ) : (
        <>
          {/* Top Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>🎁 Quản Lý Các Đợt Phát Code Riêng (Giveaway Có Điều Kiện)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Phát giftcode miễn phí do Admin tạo, quản lý kho mã, đóng/mở sự kiện và theo dõi lịch sử nhận.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* BỘ LỌC HIỂN THỊ CỘT TRỰC QUAN (ĐÃ GIẬT, HÀNG CÒN, SỐ ẢO) */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1 uppercase tracking-wider">Hiển thị:</span>
              {/* Nút 1: Đã giật */}
              <button
                type="button"
                onClick={() => {
                  const next = !showAdminClaimed;
                  setShowAdminClaimed(next);
                  localStorage.setItem('wcg_admin_show_claimed_gw', String(next));
                }}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  showAdminClaimed
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white line-through opacity-70'
                }`}
                title={showAdminClaimed ? 'Đang hiện số Đã Giật (Nhấn để ẩn)' : 'Đang ẩn số Đã Giật (Nhấn để hiện)'}
              >
                {showAdminClaimed ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                <span>Đã giật</span>
              </button>

              {/* Nút 2: Hàng còn */}
              <button
                type="button"
                onClick={() => {
                  const next = !showAdminStock;
                  setShowAdminStock(next);
                  localStorage.setItem('wcg_admin_show_stock_gw', String(next));
                }}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  showAdminStock
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white line-through opacity-70'
                }`}
                title={showAdminStock ? 'Đang hiện Hàng Còn (Nhấn để ẩn)' : 'Đang ẩn Hàng Còn (Nhấn để hiện)'}
              >
                {showAdminStock ? <Boxes className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                <span>Hàng còn</span>
              </button>

              {/* Nút 3: Số ảo Web */}
              <button
                type="button"
                onClick={() => {
                  const next = !showVirtualStats;
                  setShowVirtualStats(next);
                  localStorage.setItem('wcg_admin_show_virtual_stats', String(next));
                }}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  showVirtualStats
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white line-through opacity-70'
                }`}
                title={showVirtualStats ? 'Đang hiện Số Ảo Web (Nhấn để ẩn)' : 'Đang ẩn Số Ảo Web (Nhấn để hiện)'}
              >
                {showVirtualStats ? <Sparkles className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                <span>Số ảo Web</span>
              </button>
            </div>

            {/* Nút Reset Toàn Bộ Số Ảo Về Thật */}
            <button
              type="button"
              disabled={isResettingAllFomo}
              onClick={handleResetAllFomoToReal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              title="Xóa sạch toàn bộ số ảo của các giveaway, đưa số đã giật và tồn kho ngoài web về chuẩn 100% thực tế"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isResettingAllFomo ? 'animate-spin' : ''}`} />
              <span>Reset Tất Cả Về Số Thật</span>
            </button>

            {/* Nút Bổ Sung Số Ảo Ngẫu Nhiên (52-112) */}
            <button
              type="button"
              onClick={handleRandomizeVirtualClaimed}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Bổ sung số ảo đã giật ngẫu nhiên từ 52 đến 112 cho toàn bộ các mục code giveaway"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Bổ Sung Số Ảo (52–112)</span>
            </button>

            {/* Nút Mở tất cả */}
            <button
              type="button"
              onClick={() => handleBatchToggleAll(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Mở tất cả các đợt phát giveaway"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Mở tất cả ({activeCount}/{giveaways.length})</span>
            </button>

            {/* Nút Đóng tất cả */}
            <button
              type="button"
              onClick={() => handleBatchToggleAll(false)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Tạm đóng tất cả các đợt phát giveaway"
            >
              <PowerOff className="h-3.5 w-3.5" />
              <span>Đóng tất cả</span>
            </button>

            {/* Nút Mẫu Chung Toàn Sàn */}
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Quản lý Mẫu Chung toàn sàn (Giveaway, Tra cứu code, Tiện ích, Cửa hàng code)"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>🎨 Mẫu Chung Toàn Sàn</span>
            </button>

            {/* Nút Tạo đợt phát mới */}
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:opacity-95 cursor-pointer active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>+ Tạo Đợt Phát Mới</span>
            </button>
          </div>
        </div>

        {/* Filter Bar with Status Tabs & Game Search */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Tất cả ({giveaways.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Đang mở ({activeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'INACTIVE'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Đã đóng ({inactiveCount})</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 sm:max-w-md">
            {/* Game Dropdown Filter */}
            <div className="sm:w-44">
              <select
                value={selectedGameFilter}
                onChange={(e) => setSelectedGameFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="ALL">🎮 Tất cả game</option>
                {games.map((g) => (
                  <option key={g.id} value={g.slug}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên đợt phát, game..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Giveaways Table (Matching Screenshot 5) */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:bg-slate-800/60 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">ĐỢT PHÁT & TỰA GAME</th>
                <th className="px-3.5 py-3">KHO MÃ (CÒN / TỔNG)</th>
                <th className="px-3 py-3">3 ĐIỀU KIỆN NHẬN</th>
                <th className="px-3 py-3">TRẠNG THÁI</th>
                <th className="px-4 py-3 text-right sticky right-0 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs shadow-[-6px_0_12px_rgba(0,0,0,0.06)] z-10">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredGiveaways.map((gw) => {
                const poolCount = Array.isArray(gw.codes_pool) && gw.codes_pool.length > 0 ? gw.codes_pool.length : Math.max(0, Number(gw.remaining_codes || 0));
                const claimedCount = Number(gw.claimed_codes) || 0;
                const remaining = poolCount;
                const totalCount = poolCount + claimedCount;

                return (
                  <tr key={gw.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Col 1: ĐỢT PHÁT & TỰA GAME */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                          <img
                            src={gw.game_icon_url || gw.cover_image_url || `/game_icons/${gw.game_slug}.webp`}
                            alt={gw.title}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = '/vite.svg';
                            }}
                          />
                        </div>
                        <div className="min-w-0 max-w-[190px] sm:max-w-[220px]">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block truncate">
                            {gw.game_name}
                          </span>
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate" title={gw.title}>
                            {gw.title}
                          </h4>
                          <div className="flex items-center gap-1 mt-0.5">
                            {gw.use_template !== false ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20" title="Đang đồng bộ tự động theo Mẫu Chung">
                                <Link2 className="w-2.5 h-2.5" /> Mẫu chung
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title="Đang dùng thiết lập tùy chỉnh riêng cho đợt này">
                                <Sparkles className="w-2.5 h-2.5" /> Tùy chỉnh riêng
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={gw.description}>
                            {gw.description}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Col 2: KHO MÃ & SỐ LIỆU WEB */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      {(() => {
                        const webStock = marketingService.getDisplayStock(gw.id, remaining);
                        const webClaimed = marketingService.getClaimedDisplay(gw);
                        const isStockFomoDiff = webStock !== remaining;
                        const isClaimedFomoDiff = webClaimed !== claimedCount;

                        return (
                          <div className="space-y-1">
                            {/* Tầng 1: Kho thật trong DB */}
                            <div className="flex items-center gap-1 font-mono text-[11px]">
                              {showAdminStock && (
                                <>
                                  <span className="text-slate-400 font-sans text-[10px] font-semibold">Kho:</span>
                                  <span className={`font-bold ${remaining > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                    {remaining}
                                  </span>
                                  <span className="text-slate-400">/{totalCount}</span>
                                </>
                              )}
                              {showAdminStock && showAdminClaimed && <span className="text-slate-300 dark:text-slate-600 mx-0.5">•</span>}
                              {showAdminClaimed && (
                                <>
                                  <span className="text-slate-400 font-sans text-[10px]">Đã giật:</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-300">{claimedCount}</span>
                                </>
                              )}
                              {!showAdminStock && !showAdminClaimed && (
                                <span className="text-[10px] text-slate-400 italic">Đã ẩn kho & đã giật</span>
                              )}
                              {remaining === 0 && showAdminStock && (
                                <span className="ml-1 inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                  Hết mã
                                </span>
                              )}
                            </div>

                            {/* Tầng 2: Web FOMO (Chỉ hiện khi bật công tắc Hiện Số Ảo) */}
                            {showVirtualStats ? (
                              <div className="flex items-center gap-1.5 font-mono text-[10px] bg-slate-50 dark:bg-slate-800/60 px-1.5 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-amber-500 dark:text-amber-400 font-sans text-[9px] font-bold flex items-center gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Web:
                                </span>
                                {showAdminStock && (
                                  <span className={`font-bold ${webStock > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`}>
                                    Còn {webStock}
                                  </span>
                                )}
                                {showAdminStock && showAdminClaimed && <span className="text-slate-300 dark:text-slate-600">|</span>}
                                {showAdminClaimed && (
                                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                                    Giật {webClaimed}
                                  </span>
                                )}
                                {!showAdminStock && !showAdminClaimed && (
                                  <span className="text-[10px] text-slate-400 italic">Ẩn chi tiết</span>
                                )}
                                {(isStockFomoDiff || isClaimedFomoDiff) && (
                                  <span className="ml-auto inline-flex items-center px-1 rounded text-[8px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" title="Đang có cấu hình số ảo FOMO">
                                    Ảo
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Col 3: 3 ĐIỀU KIỆN NHẬN */}
                    <td className="px-3 py-3 text-[10.5px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div>
                          Nick: <strong className="text-slate-800 dark:text-slate-200">{gw.min_account_age_days ? `${gw.min_account_age_days}d` : '0d'}</strong>
                          <span className="text-slate-300 dark:text-slate-600 mx-1">•</span>
                          User: <strong className="text-slate-800 dark:text-slate-200">{gw.max_per_user || 1} mã</strong>
                        </div>
                        <div>
                          IP: <strong className="text-slate-800 dark:text-slate-200">{gw.max_per_ip || 1} mã</strong>
                          <span className="text-slate-300 dark:text-slate-600 mx-1">•</span>
                          CD: <strong className="text-slate-800 dark:text-slate-200">{gw.cooldown_hours ? `${gw.cooldown_hours}h` : '0h'}</strong>
                        </div>
                        {Boolean(gw.global_cooldown_seconds && gw.global_cooldown_seconds > 0) && (
                          <div className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 font-semibold pt-0.5">
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            <span>Giãn cách: {gw.global_cooldown_seconds >= 60 ? `${Math.round(gw.global_cooldown_seconds / 60)}p` : `${gw.global_cooldown_seconds}s`}</span>
                            {(() => {
                              const isCooling = gw.last_global_claim_at &&
                                (new Date(gw.last_global_claim_at).getTime() + (gw.global_cooldown_seconds || 0) * 1000) > Date.now();
                              return isCooling ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetGlobalCooldown(gw);
                                  }}
                                  className="ml-1 text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer font-bold transition-all"
                                  title="Đang khóa chờ đợt mã tiếp theo. Nhấn để mở ngay lập tức!"
                                >
                                  ⏳ Đang chờ (Mở ngay)
                                </button>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Col 4: TRẠNG THÁI (Nút Đóng / Mở trực quan) */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(gw);
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer select-none active:scale-95 shadow-2xs ${
                          gw.is_active !== false
                            ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                        }`}
                        title={gw.is_active !== false ? 'Nhấn để TẠM ĐÓNG đợt phát này' : 'Nhấn để MỞ LẠI đợt phát này'}
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            gw.is_active !== false ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                          }`}
                        />
                        <span>{gw.is_active !== false ? 'Đang mở' : 'Đã đóng'}</span>
                        <span
                          className={`w-5 h-3 rounded-full flex items-center p-0.5 transition-colors ${
                            gw.is_active !== false
                              ? 'bg-emerald-500 justify-end'
                              : 'bg-slate-300 dark:bg-slate-600 justify-start'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-white shadow-xs" />
                        </span>
                      </button>
                    </td>

                    {/* Col 5: THAO TÁC (Sticky Right để luôn hiển thị trọn vẹn trong tầm mắt) */}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap sticky right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs shadow-[-6px_0_12px_rgba(0,0,0,0.06)] z-10">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {/* NÚT CHỈNH SỐ ẢO */}
                        <button
                          type="button"
                          onClick={() => setFomoAdjustCampaign(gw)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-bold transition-colors cursor-pointer border border-amber-500/25 shadow-2xs"
                          title="Điều chỉnh số ảo & FOMO hiển thị ngoài web cho đợt phát này"
                        >
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          <span>Số ảo</span>
                        </button>

                        {/* KHO MÃ */}
                        <button
                          onClick={() => handleOpenPoolModal(gw)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                          title="Quản lý kho mã code phát riêng"
                        >
                          <Boxes className="h-3 w-3 text-indigo-500" />
                          <span>Kho mã</span>
                        </button>

                        {/* LỊCH SỬ */}
                        <button
                          onClick={() => handleOpenHistoryModal(gw)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                          title="Lịch sử người chơi đã nhận mã"
                        >
                          <History className="h-3 w-3 text-teal-500" />
                          <span>Lịch sử</span>
                        </button>

                        {/* NÚT SỬA */}
                        <button
                          onClick={() => handleOpenEdit(gw)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                          title="Sửa đợt phát giveaway"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Sửa</span>
                        </button>

                        {/* NÚT XÓA */}
                        <button
                          onClick={() => setDeletingCampaign(gw)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:hover:bg-rose-900/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                          title="Xóa đợt phát giveaway"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* CREATE / EDIT GIVEAWAY MODAL */}
      <FormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingItem ? 'Chỉnh Sửa Đợt Phát Code Riêng' : 'Tạo Đợt Phát Code Riêng Mới'}
        subtitle="Thiết lập đợt phát code miễn phí, cấu hình 3 điều kiện nhận và tải ảnh nén từ máy tính."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {/* TEMPLATE MODE SELECTOR CARD */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  Chế Độ Cấu Hình:
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const tpl = templateService.getTemplates().giveaway;
                    setFormData((p) => ({
                      ...p,
                      use_template: true,
                      title: tpl.title_pattern.replace(/\{game_name\}/gi, p.game_name || 'Game'),
                      rewards: tpl.rewards,
                      description: tpl.description,
                      min_account_age_days: tpl.min_account_age_days,
                      max_per_user: tpl.max_per_user,
                      max_per_ip: tpl.max_per_ip,
                      cooldown_hours: tpl.cooldown_hours,
                      custom_banner_enabled: tpl.custom_banner_enabled,
                      custom_banner_text: tpl.custom_banner_text,
                      custom_banner_link: tpl.custom_banner_link,
                      enable_waiting_room: tpl.enable_waiting_room,
                      waiting_users_min: tpl.waiting_users_min,
                      waiting_users_max: tpl.waiting_users_max,
                      custom_success_msg: tpl.custom_success_msg,
                      custom_cooldown_msg: tpl.custom_cooldown_msg,
                      custom_out_of_stock_msg: tpl.custom_out_of_stock_msg,
                    }));
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    formData.use_template
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Link2 className="w-3 h-3" />
                  <span>🟢 Dùng Mẫu Chung</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, use_template: false }))}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    !formData.use_template
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>🟡 Tùy Chỉnh Riêng</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {formData.use_template ? (
                <span>
                  Đợt này đang <strong>kế thừa tự động</strong> từ Mẫu Chung. Khi bạn sửa Mẫu Chung toàn sàn, đợt này sẽ tự động đổi theo.{' '}
                  <button
                    type="button"
                    onClick={() => setIsTemplateModalOpen(true)}
                    className="text-indigo-600 dark:text-indigo-400 underline font-semibold hover:opacity-80 cursor-pointer inline-flex items-center gap-0.5"
                  >
                    Sửa Mẫu Chung tại đây <ExternalLink className="w-2.5 h-2.5 inline" />
                  </button>
                </span>
              ) : (
                <span>
                  Đợt này đang sử dụng <strong>cấu hình riêng biệt</strong>. Các thay đổi trong Mẫu Chung toàn sàn sẽ không ghi đè lên đợt này.
                </span>
              )}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SearchableGameSelect
                games={games}
                selectedGameSlug={formData.game_slug}
                onSelectGame={(g) => {
                  setFormData((p) => {
                    const isNewCreation = !editingItem;
                    const shouldAutoTitle = isNewCreation || !p.title || p.title.startsWith('Code riêng');
                    const shouldAutoRewards = isNewCreation && (!p.rewards || p.rewards === 'Code ngẫu nhiên');
                    return {
                      ...p,
                      game_slug: g.slug,
                      game_name: g.name,
                      title: shouldAutoTitle ? `Code riêng ${g.name}` : p.title,
                      rewards: shouldAutoRewards ? 'Code ngẫu nhiên' : (p.rewards || 'Code ngẫu nhiên'),
                      cover_image_url: g.icon_url || p.cover_image_url,
                    };
                  });
                }}
                label="Chọn Tựa Game"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tiêu Đề Đợt Phát <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="VD: Code riêng Genshin Impact"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Mẫu chuẩn: <span className="font-semibold text-indigo-600 dark:text-indigo-400">Code riêng + Tên game</span> (Có thể tự do chỉnh sửa)
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Phần Thưởng Chi Tiết <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.rewards}
              onChange={(e) => setFormData((p) => ({ ...p, rewards: e.target.value }))}
              placeholder="VD: Code ngẫu nhiên"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Mẫu chuẩn: <span className="font-semibold text-emerald-600 dark:text-emerald-400">Code ngẫu nhiên</span> (Có thể tự do chỉnh sửa)
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Mô Tả Quy Định Nhận
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="VD: Code dùng cho 1 tài khoản, 1 loại dùng 1 lần."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* 3 CONDITIONS CONFIGURATION GRID */}
          <div className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 space-y-3">
            <span className="text-xs font-bold text-purple-900 dark:text-purple-300 block">
              ⚙️ Cấu Hình 3 Điều Kiện Nhận Giftcode:
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-600 dark:text-slate-400 block text-[11px] font-semibold">
                  Tuổi nick tối thiểu (ngày):
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.min_account_age_days}
                  onChange={(e) => setFormData((p) => ({ ...p, min_account_age_days: Number(e.target.value) }))}
                  className="mt-1 w-full font-mono rounded-xl border border-slate-200 bg-white p-2 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-slate-600 dark:text-slate-400 block text-[11px] font-semibold">
                    Max code / User:
                  </label>
                  <span className="text-[10px] text-indigo-500 font-semibold">{formData.max_per_user === 0 ? 'Vô hạn' : `${formData.max_per_user} mã`}</span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={formData.max_per_user}
                  onChange={(e) => setFormData((p) => ({ ...p, max_per_user: Math.max(0, Number(e.target.value)) }))}
                  placeholder="0 = Không giới hạn"
                  className="mt-1 w-full font-mono rounded-xl border border-slate-200 bg-white p-2 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <div className="flex items-center gap-1 mt-1">
                  {[1, 3, 5, 0].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, max_per_user: val }))}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors ${
                        formData.max_per_user === val
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {val === 0 ? '∞ Vô hạn' : `${val}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-slate-600 dark:text-slate-400 block text-[11px] font-semibold">
                    Max code / IP:
                  </label>
                  <span className="text-[10px] text-teal-500 font-semibold">{formData.max_per_ip === 0 ? 'Vô hạn' : `${formData.max_per_ip} mã`}</span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={formData.max_per_ip}
                  onChange={(e) => setFormData((p) => ({ ...p, max_per_ip: Math.max(0, Number(e.target.value)) }))}
                  placeholder="0 = Không giới hạn"
                  className="mt-1 w-full font-mono rounded-xl border border-slate-200 bg-white p-2 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <div className="flex items-center gap-1 mt-1">
                  {[1, 3, 0].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, max_per_ip: val }))}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors ${
                        formData.max_per_ip === val
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {val === 0 ? '∞ Vô hạn' : `${val}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-400 block text-[11px] font-semibold">
                  Cooldown (giờ):
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.cooldown_hours}
                  onChange={(e) => setFormData((p) => ({ ...p, cooldown_hours: Number(e.target.value) }))}
                  className="mt-1 w-full font-mono rounded-xl border border-slate-200 bg-white p-2 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Compressed Image Upload Component */}
          <ImageUploadInput
            label="Ảnh Banner / Icon Sự Kiện"
            value={formData.cover_image_url}
            onChange={(val) => setFormData((p) => ({ ...p, cover_image_url: val }))}
            helperText="Chọn ảnh từ máy tính — Tự động nén siêu nhẹ để hiển thị tức thì trên Web Khách."
          />

          {/* Claimed Count & Virtual Display Configuration */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Hiển thị số lượt đã giật (Trang khách)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Bật/tắt huy hiệu "Đã giật: Y" trên thẻ sự kiện giveaway.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.show_claimed_count}
                  onChange={(e) => setFormData((p) => ({ ...p, show_claimed_count: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {formData.show_claimed_count && (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Số Lượt Đã Giật Ảo Bổ Sung</span>
                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-normal">
                    Khách thấy: <strong className="font-bold">{(editingItem?.claimed_codes || 0) + (Number(formData.virtual_claimed_offset) || 0)}</strong> (Thật: {editingItem?.claimed_codes || 0} + Ảo: {Number(formData.virtual_claimed_offset) || 0})
                  </span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.virtual_claimed_offset}
                  onChange={(e) => setFormData((p) => ({ ...p, virtual_claimed_offset: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                  placeholder="0"
                  className="mt-1 w-full font-mono rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* SECTION 1: GLOBAL RELEASE INTERVAL (HỒI CHIÊU TOÀN SÀN CHO TOÀN WEB CHỜ) */}
          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                ⏱️ Phát Code Giãn Cách Toàn Sàn (Toàn Web Chờ Giữa 2 Lượt Giật):
              </span>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 font-mono">
                {formData.global_cooldown_seconds === 0
                  ? 'Tắt (Phát liên tục)'
                  : formData.global_cooldown_seconds >= 60
                  ? `${Math.floor(formData.global_cooldown_seconds / 60)} phút ${formData.global_cooldown_seconds % 60 > 0 ? `${formData.global_cooldown_seconds % 60}s` : ''}`
                  : `${formData.global_cooldown_seconds} giây`}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Khi người A giật code thành công, toàn bộ website (người B, C, D...) bị khóa đếm ngược và phải chờ hết khoảng thời gian này mới giật được mã kế tiếp.
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={formData.global_cooldown_seconds}
                  onChange={(e) => setFormData((p) => ({ ...p, global_cooldown_seconds: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                  placeholder="0 = Tắt, cho phép giật tự do"
                  className="w-full font-mono rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap font-medium">giây</span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-400 font-medium mr-1">Chọn nhanh:</span>
                {[
                  { label: 'Tắt (0s)', val: 0 },
                  { label: '30s', val: 30 },
                  { label: '1 phút', val: 60 },
                  { label: '2 phút', val: 120 },
                  { label: '3 phút', val: 180 },
                  { label: '5 phút', val: 300 },
                  { label: '10 phút', val: 600 },
                  { label: '15 phút', val: 900 },
                  { label: '30 phút', val: 1800 },
                  { label: '45 phút', val: 2700 },
                  { label: '1 giờ', val: 3600 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, global_cooldown_seconds: item.val }))}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                      formData.global_cooldown_seconds === item.val
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Status & Reset Current Cooldown if editing */}
              {editingItem && editingItem.last_global_claim_at && (
                <div className="p-2.5 rounded-xl bg-amber-100/60 dark:bg-amber-900/30 border border-amber-300/50 dark:border-amber-700/50 flex items-center justify-between text-xs mt-2">
                  <div className="text-[11px] text-amber-900 dark:text-amber-200">
                    <span>Lượt giật gần nhất: </span>
                    <strong className="font-mono">{formatFullDateTime(editingItem.last_global_claim_at)}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((p) => ({ ...p, last_global_claim_at: '' }));
                      if (editingItem) handleResetGlobalCooldown(editingItem);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer transition-colors shadow-2xs"
                  >
                    🔄 Mở đợt phát ngay (Reset chờ)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: CUSTOM NOTIFICATION MESSAGES */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 space-y-3">
            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              💬 Cài Đặt Thông Báo Tùy Chỉnh Khi Giật Mã:
            </span>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-between text-[11px]">
                  <span>1. Thông báo khi giật mã thành công:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Hỗ trợ: {'{code}'}, {'{game_name}'}</span>
                </label>
                <input
                  type="text"
                  value={formData.custom_success_msg}
                  onChange={(e) => setFormData((p) => ({ ...p, custom_success_msg: e.target.value }))}
                  placeholder="Mặc định: Chúc mừng bạn đã giật thành công giftcode: {code}! Hãy kích hoạt ngay nhé."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-between text-[11px]">
                  <span>2. Thông báo khi đang chờ đợt mã tiếp theo (Hồi chiêu):</span>
                  <span className="text-[10px] text-slate-400 font-normal">Hỗ trợ: {'{last_user}'}, {'{time_left}'}</span>
                </label>
                <input
                  type="text"
                  value={formData.custom_cooldown_msg}
                  onChange={(e) => setFormData((p) => ({ ...p, custom_cooldown_msg: e.target.value }))}
                  placeholder="Mặc định: Đợt phát trước đạo hữu {last_user} đã nhanh tay đi trước, đạo hữu vui lòng đợi {time_left} rồi thử sức lại."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                  <span>Mẫu chèn nhanh:</span>
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, custom_cooldown_msg: 'Đợt phát trước đạo hữu {last_user} đã nhanh tay đi trước, đạo hữu vui lòng đợi {time_left} rồi thử sức lại.' }))}
                    className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer font-medium"
                  >
                    Dùng mẫu mặc định
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, custom_cooldown_msg: (p.custom_cooldown_msg ? p.custom_cooldown_msg + ' ' : '') + '{last_user}' }))}
                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:underline cursor-pointer font-mono"
                  >
                    +{'{last_user}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, custom_cooldown_msg: (p.custom_cooldown_msg ? p.custom_cooldown_msg + ' ' : '') + '{time_left}' }))}
                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:underline cursor-pointer font-mono"
                  >
                    +{'{time_left}'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold text-[11px] block">
                  3. Thông báo khi sự kiện hết sạch mã trong kho:
                </label>
                <input
                  type="text"
                  value={formData.custom_out_of_stock_msg}
                  onChange={(e) => setFormData((p) => ({ ...p, custom_out_of_stock_msg: e.target.value }))}
                  placeholder="Mặc định: Rất tiếc! Toàn bộ giftcode của sự kiện này đã được trao tặng hết."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: LIVE WAITING ROOM & QUEUE COUNTER */}
          <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  👥 Phòng Chờ & Bộ Đếm Người Đang Chờ (Waiting Room):
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hiển thị số lượng người đang cùng canh giật mã tiếp theo ngoài Web Khách.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enable_waiting_room}
                  onChange={(e) => setFormData((p) => ({ ...p, enable_waiting_room: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>

            {formData.enable_waiting_room && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-[11px] block">
                      Số người tối thiểu (Min):
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.waiting_users_min}
                      onChange={(e) => setFormData((p) => ({ ...p, waiting_users_min: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                      placeholder="VD: 25"
                      className="mt-1 w-full font-mono rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-semibold text-[11px] block">
                      Số người tối đa (Max):
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.waiting_users_max}
                      onChange={(e) => setFormData((p) => ({ ...p, waiting_users_max: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                      placeholder="VD: 85"
                      className="mt-1 w-full font-mono rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Live Preview Box */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500">Xem trước ngoài Web Khách:</span>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                    <span>🟢 Có {Math.floor((Number(formData.waiting_users_min) + Number(formData.waiting_users_max)) / 2 || 48)} người đang cùng chờ mã kế tiếp</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: TÙY CHỈNH Ô THÔNG BÁO / LINK CỘNG ĐỒNG (ZALO) */}
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  🔗 Ô Thông Báo / Link Tùy Chỉnh (Zalo / Cộng Đồng):
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hiển thị ô nút bấm dẫn link (Zalo, fanpage, telegram...) trong modal chi tiết sự kiện ngoài Web Khách (Mặc định: TẮT).
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.custom_banner_enabled}
                  onChange={(e) => setFormData((p) => ({ ...p, custom_banner_enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {formData.custom_banner_enabled && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold text-[11px] block">
                    1. Nội dung hiển thị:
                  </label>
                  <input
                    type="text"
                    value={formData.custom_banner_text}
                    onChange={(e) => setFormData((p) => ({ ...p, custom_banner_text: e.target.value }))}
                    placeholder="Mặc định: Tham gia nhóm zalo của web tại đây"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-semibold text-[11px] block">
                    2. Đường dẫn link (URL khi người dùng bấm vào dòng chữ):
                  </label>
                  <input
                    type="url"
                    value={formData.custom_banner_link}
                    onChange={(e) => setFormData((p) => ({ ...p, custom_banner_link: e.target.value }))}
                    placeholder="VD: https://zalo.me/g/xyz123 hoặc https://facebook.com/groups/..."
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>

                {/* Preview Box */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span className="font-semibold text-blue-900 dark:text-blue-200 truncate">
                      {formData.custom_banner_text || 'Tham gia nhóm zalo của web tại đây'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-blue-500 font-bold shrink-0 ml-2">
                    <span>{formData.custom_banner_link ? 'Mở link' : 'Chưa nhập link'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="gw_is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <label htmlFor="gw_is_active" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
              Đang mở (Cho phép người chơi nhận mã trên Web Khách)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 cursor-pointer ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Đang Lưu Lên Máy Chủ...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>{editingItem ? 'Cập Nhật Đợt Phát' : 'Tạo Đợt Phát'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </FormModal>

      {/* KHO MÃ (BATCH POOL MODAL) */}
      <FormModal
        isOpen={isPoolModalOpen}
        onClose={() => {
          setIsPoolModalOpen(false);
          setSelectedPoolCodes([]);
        }}
        title={`Quản Lý Kho Mã: ${currentCampaignForPool?.title}`}
        subtitle="Quản lý mã code phát riêng, nhập thêm mã hoặc xóa các mã không còn sử dụng."
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px]">Đợt phát:</span>
              <strong className="text-slate-900 dark:text-white font-bold">{currentCampaignForPool?.title}</strong>
            </div>
            <div className="text-right font-mono">
              <span className="text-slate-400 block text-[11px]">Số mã hiện có trong kho:</span>
              <strong className="text-emerald-600 font-bold">{currentCampaignForPool?.codes_pool?.length || 0} mã</strong>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPoolTab('ADD')}
              className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                poolTab === 'ADD'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              📥 Nhập thêm mã mới
            </button>
            <button
              type="button"
              onClick={() => setPoolTab('LIST')}
              className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                poolTab === 'LIST'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              📦 Danh sách mã trong kho ({currentCampaignForPool?.codes_pool?.length || 0})
            </button>
          </div>

          {poolTab === 'ADD' ? (
            <form onSubmit={handleSavePoolCodes} className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Dán Danh Sách Mã Code Mới (Mỗi dòng 1 mã) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-purple-600 font-bold">
                    {batchPoolLines.split('\n').filter((l) => l.trim()).length} mã phát hiện
                  </span>
                </div>
                <textarea
                  required
                  rows={8}
                  value={batchPoolLines}
                  onChange={(e) => setBatchPoolLines(e.target.value)}
                  placeholder="VD:&#10;GIFT-3Q-998811&#10;GIFT-3Q-998812&#10;GIFT-3Q-998813"
                  className="mt-1 w-full font-mono text-xs rounded-xl border border-slate-200 bg-white p-3 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPoolModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingPool}
                  className={`inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 cursor-pointer ${isSavingPool ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSavingPool ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Đang Nạp Lên Máy Chủ...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Nạp Vào Kho Phát</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {currentCampaignForPool && (() => {
                const pool = currentCampaignForPool.codes_pool || [];
                const isAllSelected = pool.length > 0 && pool.every((c) => selectedPoolCodes.includes(c));

                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={() => {
                            if (isAllSelected) {
                              setSelectedPoolCodes([]);
                            } else {
                              setSelectedPoolCodes([...pool]);
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800"
                        />
                        <span>Chọn tất cả ({pool.length} mã)</span>
                      </label>

                      {selectedPoolCodes.length > 0 && (
                        <button
                          type="button"
                          onClick={handleBulkDeletePoolCodes}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Xóa {selectedPoolCodes.length} mã đã chọn</span>
                        </button>
                      )}
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
                      {pool.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          Kho mã hiện đang trống. Vui lòng chuyển sang tab "Nhập thêm mã mới".
                        </div>
                      ) : (
                        pool.map((c, idx) => {
                          const isSel = selectedPoolCodes.includes(c);
                          return (
                            <div
                              key={`${c}_${idx}`}
                              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                                isSel
                                  ? 'border-purple-500/50 bg-purple-50/40 dark:bg-purple-950/30'
                                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={() => {
                                    if (isSel) {
                                      setSelectedPoolCodes(selectedPoolCodes.filter((x) => x !== c));
                                    } else {
                                      setSelectedPoolCodes([...selectedPoolCodes, c]);
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800"
                                />
                                <span className="font-mono font-bold text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                  {c}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(c, `${c}_${idx}`)}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                  title="Sao chép"
                                >
                                  {copiedId === `${c}_${idx}` ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePoolCode(c)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                                  title="Xóa mã này khỏi kho"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                );
              })()}

              <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPoolModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </FormModal>

      {/* LỊCH SỬ NHẬN MÃ (CLAIM HISTORY MODAL) */}
      <FormModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Lịch Sử Nhận Mã: ${currentCampaignForHistory?.title}`}
        subtitle="Danh sách người chơi và địa chỉ IP đã nhận giftcode từ chiến dịch này."
        maxWidth="xl"
      >
        <div className="space-y-4">
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {currentCampaignForHistory?.claim_history && currentCampaignForHistory.claim_history.length > 0 ? (
              currentCampaignForHistory.claim_history.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 dark:text-white font-bold">{item.user}</strong>
                      <span className="text-slate-400 text-[11px]">({item.email || 'Khách'})</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      IP: {item.ip || '—'} • Thời gian: {formatFullDateTime(item?.claimedAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-900 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
                      {item.code}
                    </span>
                    <button
                      onClick={() => handleCopy(item.code, item.id)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      title="Sao chép"
                    >
                      {copiedId === item.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                Chưa có lượt nhận nào được ghi nhận cho chiến dịch này.
              </div>
            )}
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setIsHistoryModalOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </FormModal>

      {/* Delete Campaign Confirm Modal */}
      <ConfirmModal
        isOpen={!!deletingCampaign}
        onClose={() => setDeletingCampaign(null)}
        onConfirm={handleDeleteConfirm}
        title="Xác Nhận Xóa Đợt Phát Code"
        message={`Bạn có chắc muốn xóa đợt phát "${deletingCampaign?.title}"?`}
        confirmText="Xóa Đợt Phát"
        variant="danger"
      />

      {/* Quick FOMO Adjust Modal */}
      {fomoAdjustCampaign && (
        <QuickFomoAdjustModal
          isOpen={!!fomoAdjustCampaign}
          onClose={() => setFomoAdjustCampaign(null)}
          itemType="giveaway"
          itemId={fomoAdjustCampaign.id}
          itemTitle={fomoAdjustCampaign.title}
          gameName={fomoAdjustCampaign.game_name}
          realStock={Array.isArray(fomoAdjustCampaign.codes_pool) && fomoAdjustCampaign.codes_pool.length > 0 ? fomoAdjustCampaign.codes_pool.length : Math.max(0, Number(fomoAdjustCampaign.remaining_codes || 0))}
          realSoldOrClaimed={fomoAdjustCampaign.claimed_codes || 0}
          onSuccess={() => loadData()}
          onShowToast={onShowToast}
        />
      )}

      {/* Universal Template Modal */}
      <UniversalTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => {
          setIsTemplateModalOpen(false);
          loadData();
        }}
        onShowToast={onShowToast}
        giveaways={giveaways}
        utilities={adminDataService.getUtilities()}
        storeProducts={adminDataService.getStoreProducts()}
        games={games}
      />
    </div>
  );
};
