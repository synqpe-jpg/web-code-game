import type {
  MarketingConfig,
  ProductMarketingConfig,
  ProductPriority,
  MarketingNotification,
  NotificationType,
  NotificationTypeToggles,
  NotificationTypeWeights,
  OfflineCatchUpConfig,
  ToastPosition,
} from '../types/marketing';
import type { GameItem, StoreProduct, UtilityProduct, GiveawayCampaign, UserProfile } from '../types/game';
import type { GlobalMetricsSnapshot } from '../shared/deterministicEngine';
import {
  calculateDeterministicCopyCount,
  calculateDeterministicStock,
  calculateDeterministicSold,
} from '../shared/deterministicEngine';

const MARKETING_CONFIG_KEY = 'wcg_marketing_config_v1';
const MARKETING_REAL_CLICKS_KEY = 'wcg_marketing_real_clicks_v1';
const MARKETING_VIRTUAL_STOCK_KEY = 'wcg_virtual_stock_levels_v2';
const MARKETING_VIRTUAL_STOCK_TIMESTAMPS_KEY = 'wcg_virtual_stock_timestamps_v2';
const MARKETING_FOMO_SOLD_KEY = 'wcg_fomo_live_sold_counts_v2';
const MARKETING_FOMO_CLAIMED_KEY = 'wcg_fomo_live_claimed_counts_v2';
const MARKETING_HOURLY_SERVER_STATS_KEY = 'wcg_hourly_server_stats_v2';
const MARKETING_LAST_HOURLY_SYNC_KEY = 'wcg_last_hourly_sync_timestamp';
const MARKETING_PROCESSED_IDS_KEY = 'wcg_marketing_processed_ids_v2';
const MARKETING_HIGH_WATER_SOLD_KEY = 'wcg_high_water_sold_counts_v1';
const MARKETING_HIGH_WATER_CLAIMED_KEY = 'wcg_high_water_claimed_counts_v1';
const MARKETING_FOMO_SESSION_ANCHOR_KEY = 'wcg_fomo_session_anchor_v2';
const MARKETING_SNAPSHOT_KEY = 'wcg_metrics_snapshot_cache_v2';
const MARKETING_ADMIN_OVERRIDE_CLAIMED_KEY = 'wcg_admin_override_claimed_v2';
const MARKETING_ADMIN_OVERRIDE_SOLD_KEY = 'wcg_admin_override_sold_v2';

export const PRESET_VIRTUAL_ACCOUNTS: string[] = [
  // 1. Vietnamese Full Names (30 names)
  'Nguyễn Minh Tuấn', 'Trần Hoàng Long', 'Lê Hải Đăng', 'Phạm Quỳnh Nga', 'Hoàng Bảo Trâm',
  'Đỗ Gia Huy', 'Vũ Quốc Anh', 'Bùi Đức Thắng', 'Đặng Thảo Vy', 'Ngô Quang Khải',
  'Dương Anh Khoa', 'Lý Tấn Phát', 'Phan Thanh Tùng', 'Võ Hoài Nam', 'Mai Anh Tuấn',
  'Trịnh Khánh Linh', 'Lưu Hồng Sơn', 'Đoàn Nhật Minh', 'Hà Minh Trí', 'Tạ Thanh Hằng',
  'Nguyễn Hữu Đạt', 'Trần Văn Kiên', 'Lê Đình Trọng', 'Phạm Ngọc Ánh', 'Hoàng Thùy Dung',
  'Đinh Văn Mạnh', 'Lâm Quốc Bảo', 'Vương Đình Nam', 'Tạ Quốc Cường', 'Châu Thanh Tuyền',

  // 2. Masked Vietnamese Phone Numbers (15 numbers)
  '0984562189', '0912389472', '0978912345', '0905671234', '0934129876',
  '0868123987', '0898765432', '0967894561', '0943216789', '0923456781',
  '0778912340', '0701234568', '0834567890', '0856789123', '0812345679',

  // 3. Gamer Usernames (15 names)
  'shadow_hunter', 'pro_sniper_99', 'nobita_gaming', 'phong_ba_game', 'than_kiem_9x',
  'trum_solo_ff', 'yasuo_gank_tem', 'naruto_vietnam', 'dragon_slayer', 'kien_lua_vip',
  'sat_thu_vo_danh', 'ninja_rua_99', 'phuong_hoang_lua', 'bach_ho_kiem', 'thien_ha_de_nhat',

  // 4. Custom Gamer & Food Usernames (30 names)
  'shadowwalker', 'mem_chua_chin', 'phantom_echo', 'khoai_tay_lac', 'pixeldrift',
  'banh_bao_chay', 'frostbyte', 'meo_luoi_tam', 'voidrunner', 'ca_rot_biet_bay',
  'neonpulse', 'cu_lac_rang', 'nightraven', 'to_ong_vo_ve', 'silentstorm',
  'kem_dua_chua', 'emberflare', 'tra_sua_khong_duong', 'lunarhaze', 'vit_troi_boi_ngua',
  'ironclaw', 'gau_khong_ngu', 'quantumfall', 'chuoi_chin_cay', 'abysswhisper',
  'com_nguoi_chien', 'astralbound', 'banh_mi_pate', 'cyberphantom', 'ca_phe_den_da'
];

/**
 * Mẫu mặc định áp dụng cho mọi sản phẩm / tiện ích / giveaway chưa có cấu hình riêng
 * (ví dụ sản phẩm mới đăng): kho ảo 20, bù thêm 20 khi kho ảo còn <= 1,
 * ưu tiên bình thường (x2), chỉ chạy FOMO khi kho thật >= 1.
 */
export const DEFAULT_PRODUCT_MARKETING_CONFIG: ProductMarketingConfig = {
  priority: 'off',
  virtualStockBonus: 0,
  autoRestockThreshold: 1,
  autoRestockAmount: 20,
  minRealStock: 1,
};

export const DEFAULT_OFFLINE_CATCHUP_CONFIG: OfflineCatchUpConfig = {
  enabled: true,
  scope: 'all',
  mode: 'auto',
  intervalMinutes: 60,
  incrementStep: 1,
  maxCatchUpUnits: 30,
  outOfStockEnabled: false,
  outOfStockMaxUnits: 10,
  outOfStockIncrementStep: 1,
};

export const DEFAULT_TYPE_TOGGLES: NotificationTypeToggles = {
  copyCode: true,
  buyStore: true,
  buyUtility: true,
  claimGiveaway: true,
  depositWallet: true,
  statsCopy: true,
  restockProduct: true,
};

export const DEFAULT_TYPE_WEIGHTS: NotificationTypeWeights = {
  copyCode: 30,
  buyStore: 25,
  buyUtility: 10,
  claimGiveaway: 25,
  depositWallet: 7,
  statsCopy: 3,
  restockProduct: 12,
};

export const DEFAULT_DEPOSIT_PRESETS: number[] = [20000, 50000, 100000, 200000, 300000, 500000, 1000000];

export const DEFAULT_MARKETING_CONFIG: MarketingConfig = {
  isEnabled: true,
  typeToggles: DEFAULT_TYPE_TOGGLES,
  typeWeights: DEFAULT_TYPE_WEIGHTS,
  toastPosition: 'bottom-left',
  depositNotificationPresets: DEFAULT_DEPOSIT_PRESETS,
  displayDuration: 5,
  intervalMin: 12,
  intervalMax: 24,
  initialDelay: 3,
  isNameMasked: true,
  realUserCooldownSec: 20,
  peakHours: {
    enabled: true,
    startTime: '19:00',
    endTime: '23:30',
    multiplier: 2.0,
  },
  virtualAccounts: PRESET_VIRTUAL_ACCOUNTS,
  productWeights: {},
  voteConfig: {
    enabled: true,
    activeRate: 96,
    expiredRate: 4,
    variance: 2,
    baseVotesMin: 45,
    baseVotesMax: 180,
  },
  timeAgoConfig: {
    enabled: true,
    maxDelaySeconds: 30,
  },
  offlineCatchUp: DEFAULT_OFFLINE_CATCHUP_CONFIG,
  syncIntervalSeconds: 60,
  enableGlobalSnapToGrid: true,
  lastUpdated: '2026-01-01T00:00:00.000Z',
};

// Fast deterministic 32-bit PRNG (Mulberry32)
function createPRNG(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable string hash (DJB2)
function stringHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

class MarketingService {
  private config: MarketingConfig;
  private serverTimeOffset: number = 0;
  private realClicksOffset: number = 0;
  private masterCopyClicks: number = 0;
  private currentClickDate: string = '';
  private realProductSoldCountsMap: Map<string, number> = new Map();
  private realGiveawayClaimedCountsMap: Map<string, number> = new Map();
  private counterListeners: Set<(count: number) => void> = new Set();
  private notificationListeners: Set<(notif: MarketingNotification | null) => void> = new Set();
  private stockListeners: Set<(productId: string, newStock: number) => void> = new Set();
  private soldCountListeners: Set<(id: string, count: number) => void> = new Set();
  private recentRealEvents: MarketingNotification[] = [];
  private lastBroadcastCount: number = 0;
  private liveVirtualStockMap: Map<string, number> = new Map();
  private liveVirtualStockTimestampsMap: Map<string, number> = new Map();
  private recentRestockTimestampsMap: Map<string, number> = new Map();
  private productRealStockMap: Map<string, number> = new Map();
  private liveFomoSoldCountMap: Map<string, number> = new Map();
  private liveFomoClaimedCountMap: Map<string, number> = new Map();
  private highWaterSoldCountMap: Map<string, number> = new Map();
  private highWaterClaimedCountMap: Map<string, number> = new Map();
  private adminOverrideClaimedMap: Map<string, number> = new Map();
  private adminOverrideSoldMap: Map<string, number> = new Map();
  private saveHighWaterTimer: any = null;
  private sessionAnchorMap: Map<string, { lastCount: number; lastTimestamp: number }> = new Map();
  private saveSessionAnchorTimer: any = null;
  private recentAccountsRingBuffer: string[] = [];
  private readonly RING_BUFFER_SIZE = 35;
  private cachedRound: number = -1;
  private cachedRoundCount: number = -1;
  private cachedRoundIndices: number[] = [];
  private processedNotifIds: Set<string> = new Set();
  private processedStockNotifIds: Set<string> = new Set();
  private sessionStartTime: number = Date.now();
  private broadcastChannel: BroadcastChannel | null = null;
  private pendingCopyIncrement: number = 0;
  private pendingCopyEvent: MarketingNotification | null = null;
  private copyPushTimer: any = null;
  private lastCopyPushTime: number = 0;
  private initialSyncCompleted: boolean = false;
  private readonly COPY_PUSH_COOLDOWN_MS = 5000; // 5s debounce for copy clicks to batch & protect KV write quota
  private lastRealCopyToastTime: number = 0;
  private readonly REAL_COPY_TOAST_COOLDOWN_MS = 20000; // 20s cooldown for real user copy notification toasts
  private realtimePollerTimer: any = null;
  private isPollerRunning: boolean = false;
  private hourlyServerStatsMap: Map<string, any> = new Map();
  private hourlySyncTimer: any = null;
  private readonly ONE_HOUR_MS: number = 3600000;
  private activeSnapshot: GlobalMetricsSnapshot | null = null;
  private recentOrderDeltas: Map<string, { qty: number; expiresAt: number }> = new Map();
  private recentGiveawayDeltas: Map<string, { expiresAt: number }> = new Map();
  private snapshotPollerTimer: any = null;
  private peakReportTimer: any = null;
  private visibilityListenerAttached: boolean = false;
  private lastReportedPeaks: {
    sold: Record<string, number>;
    claimed: Record<string, number>;
    copy: number;
    stock: Record<string, number>;
    remaining: Record<string, number>;
  } = { sold: {}, claimed: {}, copy: 0, stock: {}, remaining: {} };
  private dailyMaxCopyCount: number = 0;
  private dailyMaxCopyDate: string = '';
  private masterCopyAnchorTime: number = 0;
  private masterCopyAnchorCount: number = 0;
  private localSessionCopyClicks: number = 0;
  private lastToastFiredTime: number = 0;

  constructor() {
    this.config = this.loadConfig();
    this.initProcessedNotifIds();
    this.initMasterCopyClicks();
    this.initDailyMaxCopyCount();
    this.initRealClicks();
    this.initLiveVirtualStock();
    this.initLiveFomoCounts();
    this.initHighWaterCounts();
    this.initAdminOverrides();
    this.initSessionAnchor();
    this.applyOfflineCatchUp();
    this.initHourlyServerStats();
    this.initSnapshotCache();
    this.initBroadcastChannel();
    this.setupStorageListener();
    this.startGlobalCounterTicker();
    this.startHourlySyncEngine();
    this.startRealtimeEventsPoller();
    this.startSnapshotPoller();
  }

  private initSnapshotCache(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(MARKETING_SNAPSHOT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.activeSnapshot = parsed;
          if (parsed.master_copy && typeof parsed.master_copy.anchor_count === 'number') {
            this.masterCopyAnchorCount = parsed.master_copy.anchor_count;
            this.masterCopyAnchorTime = parsed.master_copy.anchor_time || Date.now();
            this.dailyMaxCopyCount = Math.max(this.dailyMaxCopyCount, parsed.master_copy.anchor_count);
          }
          if (parsed.products && typeof parsed.products === 'object') {
            Object.entries(parsed.products).forEach(([pId, info]: [string, any]) => {
              if (info) {
                if (typeof info.sold === 'number') {
                  const curSold = this.highWaterSoldCountMap.get(pId) || 0;
                  this.highWaterSoldCountMap.set(pId, Math.max(curSold, info.sold));
                }
                if (typeof info.real_stock === 'number') {
                  this.productRealStockMap.set(pId, info.real_stock);
                }
                if (typeof info.stock === 'number' && !this.liveVirtualStockMap.has(pId)) {
                  this.liveVirtualStockMap.set(pId, info.stock);
                }
              }
            });
          }
          if (parsed.giveaways && typeof parsed.giveaways === 'object') {
            Object.entries(parsed.giveaways).forEach(([gId, info]: [string, any]) => {
              if (info) {
                if (typeof info.claimed === 'number') {
                  const curClaimed = this.highWaterClaimedCountMap.get(gId) || 0;
                  this.highWaterClaimedCountMap.set(gId, Math.max(curClaimed, info.claimed));
                }
                if (typeof info.real_remaining === 'number') {
                  this.productRealStockMap.set(gId, info.real_remaining);
                }
                if (typeof info.remaining === 'number' && !this.liveVirtualStockMap.has(gId)) {
                  this.liveVirtualStockMap.set(gId, info.remaining);
                }
              }
            });
          }
        }
      }
    } catch {}
  }

  private saveSnapshotCache(): void {
    if (typeof window === 'undefined' || !this.activeSnapshot) return;
    try {
      localStorage.setItem(MARKETING_SNAPSHOT_KEY, JSON.stringify(this.activeSnapshot));
    } catch {}
  }

  public recordRecentOrderDelta(productId: string, qty: number): void {
    if (!productId) return;
    const current = this.recentOrderDeltas.get(productId)?.qty || 0;
    this.recentOrderDeltas.set(productId, {
      qty: current + Math.max(1, qty),
      expiresAt: Date.now() + 65000,
    });
  }

  public recordRecentGiveawayDelta(campaignId: string): void {
    if (!campaignId) return;
    this.recentGiveawayDeltas.set(campaignId, {
      expiresAt: Date.now() + 65000,
    });
  }

  public getRecentOrderDelta(productId: string): number {
    const item = this.recentOrderDeltas.get(productId);
    if (!item) return 0;
    if (Date.now() > item.expiresAt) {
      this.recentOrderDeltas.delete(productId);
      return 0;
    }
    return item.qty;
  }

  public getRecentGiveawayDelta(campaignId: string): boolean {
    const item = this.recentGiveawayDeltas.get(campaignId);
    if (!item) return false;
    if (Date.now() > item.expiresAt) {
      this.recentGiveawayDeltas.delete(campaignId);
      return false;
    }
    return true;
  }

  public async fetchMetricsSnapshot(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/metrics/synced', { cache: 'no-store' });
      if (!res.ok) return;
      const data: any = await res.json().catch(() => null);
      if (data && data.success && data.snapshot) {
        this.activeSnapshot = data.snapshot;
        this.saveSnapshotCache();
        // LƯU Ý KỸ THUẬT QUAN TRỌNG:
        // Không dùng data.snapshot.server_time để calibrateServerTime ở đây,
        // vì endpoint /api/metrics/synced được Edge Cache (s-maxage=30s).
        // Thời gian snapshot là thời gian quá khứ, nếu dùng để hiệu chuẩn sẽ làm đồng hồ
        // client giật lùi 30s, khiến bộ đếm lượt copy bị tụt xuống.
        // Chỉ hiệu chuẩn đồng hồ từ endpoint động thời gian thực (/api/realtime-events hoặc /api/stats).
        if (data.snapshot.master_copy && typeof data.snapshot.master_copy.real_clicks === 'number') {
          if (data.snapshot.master_copy.real_clicks > this.masterCopyClicks) {
            this.masterCopyClicks = data.snapshot.master_copy.real_clicks;
            this.saveMasterCopyClicks();
          }
        }
        const now = Date.now();
        this.recentOrderDeltas.forEach((val, key) => {
          if (now > val.expiresAt) this.recentOrderDeltas.delete(key);
        });
        this.recentGiveawayDeltas.forEach((val, key) => {
          if (now > val.expiresAt) this.recentGiveawayDeltas.delete(key);
        });

        const snapToGrid = this.config.enableGlobalSnapToGrid !== false;

        if (snapToGrid) {
          // 1. Force Snap copy clicks and daily max copy count to authoritative server snapshot
          if (data.snapshot.master_copy && typeof data.snapshot.master_copy.anchor_count === 'number') {
            this.masterCopyAnchorCount = data.snapshot.master_copy.anchor_count;
            this.masterCopyAnchorTime = data.snapshot.master_copy.anchor_time || Date.now();
            this.dailyMaxCopyCount = Math.max(this.dailyMaxCopyCount, data.snapshot.master_copy.anchor_count);
            this.localSessionCopyClicks = 0; // reset local session clicks delta because server snapshot absorbed it
            if (typeof data.snapshot.master_copy.real_clicks === 'number') {
              this.masterCopyClicks = data.snapshot.master_copy.real_clicks;
              this.realClicksOffset = this.masterCopyClicks;
              this.saveMasterCopyClicks();
            }
            this.saveDailyMaxCopyCount();
          }

          // 2. Force Snap product sold counts & virtual stock
          if (data.snapshot.products && typeof data.snapshot.products === 'object') {
            Object.entries(data.snapshot.products).forEach(([pId, info]: [string, any]) => {
              if (info) {
                if (typeof info.real_stock === 'number') {
                  this.productRealStockMap.set(pId, info.real_stock);
                }
                if (typeof info.sold === 'number') {
                  const isOverriddenSold = this.adminOverrideSoldMap.has(pId);
                  const realSold = typeof info.real_sold === 'number' ? info.real_sold : 0;
                  const localOrderDelta = this.getRecentOrderDelta(pId);

                  // Server snapshot is authoritative canonical baseline
                  const canonicalSold = isOverriddenSold
                    ? Math.max(realSold, this.adminOverrideSoldMap.get(pId)!)
                    : Math.max(realSold, info.sold);
                  const effectiveSold = canonicalSold + localOrderDelta;

                  // RÀNG BUỘC ĐƠN ĐIỆU TUYỆT ĐỐI (Monotonically Non-Decreasing):
                  // Tuyệt đối không giật lùi số đã bán nếu client đã tích lũy số bán cao hơn; ưu tiên mốc lớn nhất
                  const curHigh = this.highWaterSoldCountMap.get(pId) || 0;
                  const finalSold = isOverriddenSold
                    ? effectiveSold
                    : Math.max(curHigh, effectiveSold);

                  this.highWaterSoldCountMap.set(pId, finalSold);
                  this.liveFomoSoldCountMap.set(pId, Math.max(0, finalSold - realSold));
                  this.notifySoldCountChanged(pId, finalSold);

                  // Nếu số cục bộ cao hơn server hoặc có đơn hàng thật: đồng bộ peak lên server để chia sẻ cho các máy khác
                  if (curHigh > effectiveSold || localOrderDelta > 0) {
                    this.schedulePeakReport();
                  }
                }
                if (typeof info.stock === 'number') {
                  const realStock = typeof info.real_stock === 'number'
                    ? info.real_stock
                    : (this.productRealStockMap.get(pId) || 0);

                  // Hết hàng thật trong D1 thì lập tức hiển thị 0 (không giữ số ảo)
                  if (realStock <= 0) {
                    this.liveVirtualStockMap.set(pId, 0);
                    this.liveVirtualStockTimestampsMap.set(pId, now);
                  } else {
                    const pw = this.getProductConfig(pId);
                    const currentLive = this.liveVirtualStockMap.get(pId);
                    const hasAutoRestock = pw.priority !== 'off' && Boolean(pw.virtualStockBonus) && Number(pw.virtualStockBonus) > 0;
                    const rawThreshold = Math.max(1, Number(pw.autoRestockThreshold) || 1);
                    const effectiveThreshold = (realStock > 0 && rawThreshold < realStock)
                      ? realStock
                      : rawThreshold;
                    const restockAmount = Math.max(1, Number(pw.autoRestockAmount) || 20);
                    const maxAllowedStock = (pw.priority === 'off' || !pw.virtualStockBonus || pw.virtualStockBonus <= 0)
                      ? realStock
                      : Math.max(realStock + Number(pw.virtualStockBonus || 0), effectiveThreshold + restockAmount);

                    if (typeof currentLive === 'number' && currentLive > maxAllowedStock) {
                      const healed = Math.min(info.stock > 0 ? info.stock : maxAllowedStock, maxAllowedStock);
                      this.liveVirtualStockMap.set(pId, healed);
                      this.liveVirtualStockTimestampsMap.set(pId, now);
                    } else if (typeof currentLive !== 'number' || isNaN(currentLive) || currentLive <= 0) {
                      const initStock = (info.stock > 0 && info.stock <= maxAllowedStock)
                        ? info.stock
                        : (pw.virtualStockBonus > 0 ? this.getVirtualBonusStock(pId, now, realStock) : realStock);
                      this.liveVirtualStockMap.set(pId, initStock);
                      this.liveVirtualStockTimestampsMap.set(pId, now);
                    } else if (info.stock > 0 && info.stock < currentLive && info.stock <= maxAllowedStock) {
                      // Server snapshot đã ghi nhận đơn bán từ thiết bị khác hoặc tiến trình chung
                      this.liveVirtualStockMap.set(pId, info.stock);
                      this.liveVirtualStockTimestampsMap.set(pId, now);
                      this.notifyStockChanged(pId, info.stock);
                    } else if (info.stock > currentLive && info.stock <= maxAllowedStock) {
                      // 2. Server stock lớn hơn client stock:
                      // Chỉ chấp nhận ghi đè tăng số nếu server thực sự vừa BÙ KHO (nhảy lên mốc bù kho sau đáy):
                      const isServerFreshRestock = hasAutoRestock && info.stock >= (effectiveThreshold + restockAmount - 2) && currentLive <= (effectiveThreshold + 2);
                      if (isServerFreshRestock) {
                        this.recentRestockTimestampsMap.set(pId, now);
                        this.liveVirtualStockMap.set(pId, info.stock);
                        this.liveVirtualStockTimestampsMap.set(pId, now);
                        this.notifyStockChanged(pId, info.stock);
                      }
                    }
                  }
                }
              }
            });
            this.saveHighWaterCounts();
            this.saveLiveVirtualStock();
          }

          // 3. Force Snap giveaway claimed counts & remaining stock
          if (data.snapshot.giveaways && typeof data.snapshot.giveaways === 'object') {
            Object.entries(data.snapshot.giveaways).forEach(([gId, info]: [string, any]) => {
              if (info) {
                if (typeof info.real_remaining === 'number') {
                  this.productRealStockMap.set(gId, info.real_remaining);
                }
                if (typeof info.claimed === 'number') {
                  const isOverriddenClaimed = this.adminOverrideClaimedMap.has(gId);
                  const realClaimed = typeof info.real_claimed === 'number' ? info.real_claimed : 0;
                  const localGwDelta = this.getRecentGiveawayDelta(gId) ? 1 : 0;

                  // Server snapshot is authoritative canonical baseline
                  const canonicalClaimed = isOverriddenClaimed
                    ? Math.max(realClaimed, this.adminOverrideClaimedMap.get(gId)!)
                    : Math.max(realClaimed, info.claimed);
                  const effectiveClaimed = canonicalClaimed + localGwDelta;

                  // RÀNG BUỘC ĐƠN ĐIỆU TUYỆT ĐỐI (Monotonically Non-Decreasing):
                  // Tuyệt đối không giật lùi số đã nhận nếu client đã tích lũy số đã nhận cao hơn; ưu tiên mốc lớn nhất
                  const curHigh = this.highWaterClaimedCountMap.get(gId) || 0;
                  const finalClaimed = isOverriddenClaimed
                    ? effectiveClaimed
                    : Math.max(curHigh, effectiveClaimed);

                  this.highWaterClaimedCountMap.set(gId, finalClaimed);
                  this.liveFomoClaimedCountMap.set(gId, Math.max(0, finalClaimed - realClaimed));
                  this.notifySoldCountChanged(gId, finalClaimed);

                  // Nếu số cục bộ cao hơn server hoặc có quà tặng nhận thật: đồng bộ peak lên server để chia sẻ cho các máy khác
                  if (curHigh > effectiveClaimed || localGwDelta > 0) {
                    this.schedulePeakReport();
                  }
                }
                if (typeof info.remaining === 'number') {
                  const realRemaining = typeof info.real_remaining === 'number'
                    ? info.real_remaining
                    : (this.productRealStockMap.get(gId) || 0);

                  if (realRemaining <= 0) {
                    this.liveVirtualStockMap.set(gId, 0);
                    this.liveVirtualStockTimestampsMap.set(gId, now);
                  } else {
                    const pw = this.getProductConfig(gId);
                    const rawThreshold = Math.max(1, Number(pw.autoRestockThreshold) || 1);
                    const effectiveThreshold = (realRemaining > 0 && rawThreshold < realRemaining)
                      ? realRemaining
                      : rawThreshold;
                    const restockAmount = Math.max(1, Number(pw.autoRestockAmount) || 20);
                    const currentLive = this.liveVirtualStockMap.get(gId);
                    const hasAutoRestock = Boolean(pw.virtualStockBonus && pw.virtualStockBonus > 0 && pw.autoRestockAmount && pw.autoRestockAmount > 0);

                    const maxAllowedGwStock = (pw.priority === 'off' || !pw.virtualStockBonus || pw.virtualStockBonus <= 0)
                      ? realRemaining
                      : Math.max(realRemaining + Number(pw.virtualStockBonus || 0), effectiveThreshold + restockAmount);

                    if (typeof currentLive === 'number' && currentLive > maxAllowedGwStock) {
                      const healed = Math.min(info.remaining > 0 ? info.remaining : maxAllowedGwStock, maxAllowedGwStock);
                      this.liveVirtualStockMap.set(gId, healed);
                      this.liveVirtualStockTimestampsMap.set(gId, now);
                    } else if (typeof currentLive !== 'number' || isNaN(currentLive) || currentLive <= 0) {
                      const initRemaining = (info.remaining > 0 && info.remaining <= maxAllowedGwStock)
                        ? info.remaining
                        : (pw.virtualStockBonus > 0 ? this.getVirtualBonusStock(gId, now, realRemaining) : realRemaining);
                      this.liveVirtualStockMap.set(gId, initRemaining);
                      this.liveVirtualStockTimestampsMap.set(gId, now);
                    } else if (info.remaining > 0 && info.remaining < currentLive && info.remaining <= maxAllowedGwStock) {
                      // Server snapshot đã ghi nhận lượt giật mã từ thiết bị khác hoặc tiến trình chung
                      this.liveVirtualStockMap.set(gId, info.remaining);
                      this.liveVirtualStockTimestampsMap.set(gId, now);
                      this.notifyStockChanged(gId, info.remaining);
                    } else if (info.remaining > currentLive && info.remaining <= maxAllowedGwStock) {
                      const isServerFreshRestock = hasAutoRestock && info.remaining >= (effectiveThreshold + restockAmount - 2) && currentLive <= (effectiveThreshold + 2);
                      if (isServerFreshRestock) {
                        this.recentRestockTimestampsMap.set(gId, now);
                        this.liveVirtualStockMap.set(gId, info.remaining);
                        this.liveVirtualStockTimestampsMap.set(gId, now);
                        this.notifyStockChanged(gId, info.remaining);
                      }
                    }
                  }
                }
              }
            });
            this.saveHighWaterCounts();
            this.saveLiveFomoCounts();
            this.saveLiveVirtualStock();
          }
        }

        this.notifyStockChanged('*', 0);
        this.notifySoldCountChanged('*', 0);
        this.broadcastCurrentCount();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('wcg_virtual_stock_updated', { detail: {} }));
        }
      }
    } catch {}
  }

  public startSnapshotPoller(): void {
    if (typeof window === 'undefined') return;
    if (this.snapshotPollerTimer) {
      clearInterval(this.snapshotPollerTimer);
      this.snapshotPollerTimer = null;
    }

    setTimeout(() => {
      this.fetchMetricsSnapshot();
      this.schedulePeakReport();
    }, 800);

    const intervalSec = Math.max(10, Math.min(30, Number(this.config.syncIntervalSeconds) || 12));
    this.snapshotPollerTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      this.fetchMetricsSnapshot();
      this.applyOfflineCatchUp();
    }, intervalSec * 1000);

    if (typeof document !== 'undefined' && !this.visibilityListenerAttached) {
      this.visibilityListenerAttached = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.fetchMetricsSnapshot();
          this.applyOfflineCatchUp();
        }
      });
    }
  }

  public schedulePeakReport(immediate: boolean = false): void {
    if (typeof window === 'undefined') return;
    if (immediate) {
      if (this.peakReportTimer) {
        clearTimeout(this.peakReportTimer);
        this.peakReportTimer = null;
      }
      this.reportPeakMetrics();
      return;
    }
    if (this.peakReportTimer) return;

    this.peakReportTimer = setTimeout(async () => {
      this.peakReportTimer = null;
      await this.reportPeakMetrics();
    }, 400); // 400ms debounce for rapid cross-device sync
  }

  public async reportPeakMetrics(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const peakSold: Record<string, number> = {};
      const peakClaimed: Record<string, number> = {};
      const lowestStock: Record<string, number> = {};
      const lowestRemaining: Record<string, number> = {};
      let hasNewPeak = false;

      // 1. Check local sold peaks from highWaterSoldCountMap (Bảo toàn tuyệt đối số lượng đã bán lũy kế)
      this.highWaterSoldCountMap.forEach((val, id) => {
        const last = this.lastReportedPeaks.sold[id] || 0;
        const details = this.findItemDetails(id);
        const virtualBase = Number(details?.virtual_sold_count || 0);
        const realSold = Number(details?.sold_count || 0);
        const maxAllowed = Math.max(50000, realSold + virtualBase + 5000);
        if (val > last && val <= maxAllowed) {
          peakSold[id] = val;
          hasNewPeak = true;
        }
      });

      // 2. Check local claimed peaks from highWaterClaimedCountMap (Bảo toàn tuyệt đối quà đã nhận lũy kế)
      this.highWaterClaimedCountMap.forEach((val, id) => {
        const last = this.lastReportedPeaks.claimed[id] || 0;
        const details = this.findGiveawayDetails(id);
        const virtualBase = Number(details?.virtual_claimed_offset || 0);
        const realClaimed = Number(details?.claimed_codes || 0);
        const maxAllowed = Math.max(50000, realClaimed + virtualBase + 5000);
        if (val > last && val <= maxAllowed) {
          peakClaimed[id] = val;
          hasNewPeak = true;
        }
      });

      // 3. Check copy count peak
      const currentCopy = this.getLiveCopyCount();
      let peakCopy: number | undefined = undefined;
      if (currentCopy > this.lastReportedPeaks.copy) {
        peakCopy = currentCopy;
        hasNewPeak = true;
      }

      let peakMasterClicks: number | undefined = undefined;
      if (this.masterCopyClicks > ((this.lastReportedPeaks as any).masterClicks || 0)) {
        peakMasterClicks = this.masterCopyClicks;
        hasNewPeak = true;
      }

      // 4. Check lowest stock across all live products and giveaways
      this.liveVirtualStockMap.forEach((val, id) => {
        if (typeof val === 'number' && !isNaN(val) && val > 0) {
          const last = this.lastReportedPeaks.stock[id];
          const isRestockJump = last !== undefined && val > last;
          if (last === undefined || val < last || isRestockJump) {
            lowestStock[id] = val;
            lowestRemaining[id] = val;
            hasNewPeak = true;
          }
        }
      });

      if (!hasNewPeak) return;

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'report_peak_metrics',
          peakSold: Object.keys(peakSold).length > 0 ? peakSold : undefined,
          peakClaimed: Object.keys(peakClaimed).length > 0 ? peakClaimed : undefined,
          peakCopy,
          peakMasterClicks,
          lowestStock: Object.keys(lowestStock).length > 0 ? lowestStock : undefined,
          lowestRemaining: Object.keys(lowestRemaining).length > 0 ? lowestRemaining : undefined,
        }),
      }).catch(() => null);

      if (res && res.ok) {
        // Record successfully reported peaks
        Object.entries(peakSold).forEach(([id, val]) => {
          this.lastReportedPeaks.sold[id] = Math.max(this.lastReportedPeaks.sold[id] || 0, val);
        });
        Object.entries(peakClaimed).forEach(([id, val]) => {
          this.lastReportedPeaks.claimed[id] = Math.max(this.lastReportedPeaks.claimed[id] || 0, val);
        });
        Object.entries(lowestStock).forEach(([id, val]) => {
          this.lastReportedPeaks.stock[id] = val;
        });
        Object.entries(lowestRemaining).forEach(([id, val]) => {
          this.lastReportedPeaks.remaining[id] = val;
        });
        if (peakCopy !== undefined) {
          this.lastReportedPeaks.copy = Math.max(this.lastReportedPeaks.copy, peakCopy);
        }
        if (peakMasterClicks !== undefined) {
          (this.lastReportedPeaks as any).masterClicks = Math.max((this.lastReportedPeaks as any).masterClicks || 0, peakMasterClicks);
        }
      }
    } catch {}
  }

  public getTodayDateKey(timestampMs: number = this.getCalibratedNow()): string {
    const vnDate = new Date(timestampMs + 7 * 3600 * 1000);
    return vnDate.toISOString().slice(0, 10);
  }

  private initMasterCopyClicks(): void {
    if (typeof window === 'undefined') return;
    try {
      const today = this.getTodayDateKey();
      this.currentClickDate = today;
      const saved = localStorage.getItem(MARKETING_REAL_CLICKS_KEY);
      if (saved) {
        if (saved.startsWith('{')) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.date === today && typeof parsed.clicks === 'number') {
            this.masterCopyClicks = Math.max(0, parsed.clicks);
          } else {
            this.masterCopyClicks = 0;
            this.saveMasterCopyClicks();
          }
        } else {
          this.masterCopyClicks = 0;
          this.saveMasterCopyClicks();
        }
        this.realClicksOffset = this.masterCopyClicks;
      }
    } catch {}
  }

  private saveMasterCopyClicks(): void {
    if (typeof window !== 'undefined') {
      try {
        const today = this.getTodayDateKey();
        this.currentClickDate = today;
        const payload = { date: today, clicks: this.masterCopyClicks };
        localStorage.setItem(MARKETING_REAL_CLICKS_KEY, JSON.stringify(payload));
      } catch {}
    }
  }

  private initDailyMaxCopyCount(): void {
    if (typeof window === 'undefined') return;
    try {
      const today = this.getTodayDateKey();
      this.dailyMaxCopyDate = today;
      const saved = localStorage.getItem('wcg_marketing_daily_max_copy_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.date === today && typeof parsed.count === 'number') {
          this.dailyMaxCopyCount = Math.max(0, parsed.count);
        }
      }
    } catch {}
  }

  private saveDailyMaxCopyCount(): void {
    if (typeof window === 'undefined') return;
    try {
      const today = this.dailyMaxCopyDate || this.getTodayDateKey();
      localStorage.setItem('wcg_marketing_daily_max_copy_v1', JSON.stringify({
        date: today,
        count: this.dailyMaxCopyCount,
      }));
    } catch {}
  }

  private initProcessedNotifIds(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = sessionStorage.getItem(MARKETING_PROCESSED_IDS_KEY) || localStorage.getItem(MARKETING_PROCESSED_IDS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((id: string) => {
            if (typeof id === 'string' && id) this.processedNotifIds.add(id);
          });
        }
      }
    } catch {}
  }

  public markNotificationProcessed(notifId: string): void {
    if (!notifId) return;
    this.processedNotifIds.add(notifId);
    if (this.processedNotifIds.size > 500) {
      const arr = Array.from(this.processedNotifIds);
      this.processedNotifIds = new Set(arr.slice(arr.length - 250));
    }
    if (typeof window !== 'undefined') {
      try {
        const arr = Array.from(this.processedNotifIds);
        sessionStorage.setItem(MARKETING_PROCESSED_IDS_KEY, JSON.stringify(arr));
        localStorage.setItem(MARKETING_PROCESSED_IDS_KEY, JSON.stringify(arr));
      } catch {}
    }
  }

  public isNotificationProcessed(notifId: string): boolean {
    if (!notifId) return false;
    return this.processedNotifIds.has(notifId);
  }

  private initBroadcastChannel(): void {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      this.broadcastChannel = new BroadcastChannel('wcg_marketing_real_events');
      this.broadcastChannel.onmessage = (event) => {
        if (!event || !event.data) return;
        const { type, payload } = event.data;
        if (type === 'REAL_EVENT_BROADCAST' && payload) {
          this.handleIncomingRealEvent(payload, false);
        } else if (type === 'REAL_EVENT_SCHEDULED' && payload) {
          const match = this.recentRealEvents.find((e) => e && e.id === payload.id);
          if (match && payload.scheduledFireTime) {
            match.scheduledFireTime = payload.scheduledFireTime;
            this.sortAndPruneRealEventQueue();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('wcg_new_real_events_available'));
            }
          }
        } else if (type === 'COPY_INCREMENT_BROADCAST' && payload) {
          const today = this.getTodayDateKey();
          if (payload.date === today) {
            const clicks = Number(payload.totalRealClicks) || 0;
            if (clicks > this.masterCopyClicks) {
              this.masterCopyClicks = clicks;
              this.realClicksOffset = clicks;
              this.saveMasterCopyClicks();
              this.broadcastCurrentCount();
            }
          }
        } else if (type === 'STATS_SYNC_BROADCAST' && payload) {
          if (payload.productId && typeof payload.totalSold === 'number') {
            this.realProductSoldCountsMap.set(payload.productId, payload.totalSold);
            this.notifySoldCountChanged(payload.productId, payload.totalSold);
          }
          if (payload.giveawayId && typeof payload.totalClaimed === 'number') {
            this.realGiveawayClaimedCountsMap.set(payload.giveawayId, payload.totalClaimed);
            this.notifySoldCountChanged(payload.giveawayId, payload.totalClaimed);
          }
        } else if (type === 'VIRTUAL_STOCK_DECREMENT' && payload) {
          if (payload.productId && typeof payload.newStock === 'number') {
            if (payload.notifId) this.processedStockNotifIds.add(payload.notifId);
            const cur = this.liveVirtualStockMap.get(payload.productId);
            if (cur !== undefined && payload.newStock > cur) {
              this.recentRestockTimestampsMap.set(payload.productId, Date.now());
            }
            this.liveVirtualStockMap.set(payload.productId, payload.newStock);
            this.saveLiveVirtualStock();
            this.notifyStockChanged(payload.productId, payload.newStock);
          }
        } else if (type === 'FOMO_SOLD_INCREMENT' && payload) {
          if (payload.productId && typeof payload.totalFomoSold === 'number') {
            if (payload.notifId) this.processedStockNotifIds.add(`sold_${payload.notifId}`);
            this.liveFomoSoldCountMap.set(payload.productId, payload.totalFomoSold);
            this.saveLiveFomoCounts();
            const curHigh = this.highWaterSoldCountMap.get(payload.productId) || 0;
            if (payload.totalFomoSold > curHigh) {
              this.highWaterSoldCountMap.set(payload.productId, payload.totalFomoSold);
              this.saveHighWaterCounts();
            }
            this.notifySoldCountChanged(payload.productId, this.getSoldDisplay({ id: payload.productId }));
          }
        } else if (type === 'FOMO_CLAIMED_INCREMENT' && payload) {
          if (payload.campaignId && typeof payload.totalFomoClaimed === 'number') {
            if (payload.notifId) this.processedStockNotifIds.add(`gw_${payload.notifId}`);
            this.liveFomoClaimedCountMap.set(payload.campaignId, payload.totalFomoClaimed);
            this.saveLiveFomoCounts();
            const curHigh = this.highWaterClaimedCountMap.get(payload.campaignId) || 0;
            if (payload.totalFomoClaimed > curHigh) {
              this.highWaterClaimedCountMap.set(payload.campaignId, payload.totalFomoClaimed);
              this.saveHighWaterCounts();
            }
            this.notifySoldCountChanged(payload.campaignId, this.getClaimedDisplay({ id: payload.campaignId }));
          }
        } else if (type === 'FOMO_SOLD_RESET' && payload) {
          if (payload.productId && typeof payload.targetDisplay === 'number') {
            this.highWaterSoldCountMap.set(payload.productId, payload.targetDisplay);
            this.liveFomoSoldCountMap.set(payload.productId, Math.max(0, payload.virtualCount || 0));
            this.saveHighWaterCounts();
            this.saveLiveFomoCounts();
            this.sessionAnchorMap.set(payload.productId, { lastCount: payload.targetDisplay, lastTimestamp: Date.now() });
            this.notifySoldCountChanged(payload.productId, payload.targetDisplay);
          }
        } else if (type === 'FOMO_CLAIMED_RESET' && payload) {
          if (payload.campaignId && typeof payload.targetDisplay === 'number') {
            this.highWaterClaimedCountMap.set(payload.campaignId, payload.targetDisplay);
            this.liveFomoClaimedCountMap.set(payload.campaignId, Math.max(0, payload.virtualCount || 0));
            this.saveHighWaterCounts();
            this.saveLiveFomoCounts();
            this.sessionAnchorMap.set(payload.campaignId, { lastCount: payload.targetDisplay, lastTimestamp: Date.now() });
            this.notifySoldCountChanged(payload.campaignId, payload.targetDisplay);
          }
        }
      };
    } catch {}
  }

  private initLiveVirtualStock(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = sessionStorage.getItem(MARKETING_VIRTUAL_STOCK_KEY) || localStorage.getItem(MARKETING_VIRTUAL_STOCK_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'number' && !isNaN(v)) {
              const pw = this.getProductConfig(k);
              const realStock = this.getRealStockFor(k);
              if (realStock <= 0) {
                this.liveVirtualStockMap.set(k, 0);
              } else {
                const rawThreshold = Math.max(1, Number(pw.autoRestockThreshold) || 1);
                const restockAmount = Math.max(1, Number(pw.autoRestockAmount) || 20);
                const effectiveThreshold = (realStock > 0 && rawThreshold < realStock)
                  ? realStock
                  : rawThreshold;
                const maxAllowed = (pw.priority === 'off' || !pw.virtualStockBonus || pw.virtualStockBonus <= 0)
                  ? realStock
                  : Math.max(realStock + Number(pw.virtualStockBonus || 0), effectiveThreshold + restockAmount);
                const healed = Math.min(Math.max(1, v), maxAllowed);
                this.liveVirtualStockMap.set(k, healed);
              }
            }
          });
        }
      }
    } catch {}
  }

  private saveLiveVirtualStock(): void {
    if (typeof window === 'undefined') return;
    try {
      const obj: Record<string, number> = {};
      this.liveVirtualStockMap.forEach((v, k) => {
        if (typeof v === 'number' && !isNaN(v)) {
          obj[k] = v;
        }
      });
      sessionStorage.setItem(MARKETING_VIRTUAL_STOCK_KEY, JSON.stringify(obj));
      localStorage.setItem(MARKETING_VIRTUAL_STOCK_KEY, JSON.stringify(obj));
    } catch {}
  }

  private initLiveFomoCounts(): void {
    if (typeof window === 'undefined') return;
    try {
      const savedSold = localStorage.getItem(MARKETING_FOMO_SOLD_KEY);
      if (savedSold) {
        const parsed = JSON.parse(savedSold);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'number' && !isNaN(v)) {
              this.liveFomoSoldCountMap.set(k, v);
            }
          });
        }
      }
      const savedClaimed = localStorage.getItem(MARKETING_FOMO_CLAIMED_KEY);
      if (savedClaimed) {
        const parsed = JSON.parse(savedClaimed);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'number' && !isNaN(v)) {
              this.liveFomoClaimedCountMap.set(k, v);
            }
          });
        }
      }
    } catch {}
  }

  private saveLiveFomoCounts(): void {
    if (typeof window === 'undefined') return;
    try {
      const soldObj: Record<string, number> = {};
      this.liveFomoSoldCountMap.forEach((val, key) => {
        soldObj[key] = val;
      });
      localStorage.setItem(MARKETING_FOMO_SOLD_KEY, JSON.stringify(soldObj));

      const claimedObj: Record<string, number> = {};
      this.liveFomoClaimedCountMap.forEach((val, key) => {
        claimedObj[key] = val;
      });
      localStorage.setItem(MARKETING_FOMO_CLAIMED_KEY, JSON.stringify(claimedObj));
    } catch {}
  }

  private initHighWaterCounts(): void {
    if (typeof window === 'undefined') return;
    try {
      const savedSold = localStorage.getItem(MARKETING_HIGH_WATER_SOLD_KEY);
      if (savedSold) {
        const parsed = JSON.parse(savedSold);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'number' && !isNaN(v)) {
              this.highWaterSoldCountMap.set(k, v);
            }
          });
        }
      }
      const savedClaimed = localStorage.getItem(MARKETING_HIGH_WATER_CLAIMED_KEY);
      if (savedClaimed) {
        const parsed = JSON.parse(savedClaimed);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'number' && !isNaN(v)) {
              this.highWaterClaimedCountMap.set(k, v);
            }
          });
        }
      }
    } catch {}
  }

  private saveHighWaterCounts(): void {
    if (typeof window === 'undefined') return;
    if (this.saveHighWaterTimer) return;
    this.saveHighWaterTimer = setTimeout(() => {
      this.saveHighWaterTimer = null;
      try {
        const soldObj: Record<string, number> = {};
        this.highWaterSoldCountMap.forEach((val, key) => {
          soldObj[key] = val;
        });
        localStorage.setItem(MARKETING_HIGH_WATER_SOLD_KEY, JSON.stringify(soldObj));

        const claimedObj: Record<string, number> = {};
        this.highWaterClaimedCountMap.forEach((val, key) => {
          claimedObj[key] = val;
        });
        localStorage.setItem(MARKETING_HIGH_WATER_CLAIMED_KEY, JSON.stringify(claimedObj));
      } catch {}
    }, 300);
  }

  private initAdminOverrides(): void {
    if (typeof window === 'undefined') return;
    try {
      const savedClaimed = localStorage.getItem(MARKETING_ADMIN_OVERRIDE_CLAIMED_KEY);
      if (savedClaimed) {
        const parsed = JSON.parse(savedClaimed);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'number' && !isNaN(v)) {
              this.adminOverrideClaimedMap.set(k, v);
            }
          });
        }
      }
      const savedSold = localStorage.getItem(MARKETING_ADMIN_OVERRIDE_SOLD_KEY);
      if (savedSold) {
        const parsed = JSON.parse(savedSold);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'number' && !isNaN(v)) {
              this.adminOverrideSoldMap.set(k, v);
            }
          });
        }
      }
    } catch {}
  }

  private saveAdminOverrides(): void {
    if (typeof window === 'undefined') return;
    try {
      const claimedObj: Record<string, number> = {};
      this.adminOverrideClaimedMap.forEach((val, key) => {
        claimedObj[key] = val;
      });
      localStorage.setItem(MARKETING_ADMIN_OVERRIDE_CLAIMED_KEY, JSON.stringify(claimedObj));

      const soldObj: Record<string, number> = {};
      this.adminOverrideSoldMap.forEach((val, key) => {
        soldObj[key] = val;
      });
      localStorage.setItem(MARKETING_ADMIN_OVERRIDE_SOLD_KEY, JSON.stringify(soldObj));
    } catch {}
  }

  // --- Session Anchor & Offline Catch-Up Engine ---
  public ensureSessionAnchorsSeeded(): void {
    if (typeof window === 'undefined') return;
    try {
      const now = this.getCalibratedNow();
      let changed = false;

      // 1. Seed store products & utilities
      const spRaw = localStorage.getItem('wcg_admin_store_products_v4') || localStorage.getItem('wcg_store_products_v4');
      if (spRaw) {
        try {
          const spList = JSON.parse(spRaw);
          if (Array.isArray(spList)) {
            spList.forEach((p: any) => {
              if (p && p.id && !this.sessionAnchorMap.has(p.id)) {
                const base = (Number(p.sold_count) || 0) + (Number(p.virtual_sold_count) || 0);
                this.sessionAnchorMap.set(p.id, { lastCount: base, lastTimestamp: now });
                changed = true;
              }
            });
          }
        } catch {}
      }

      const utRaw = localStorage.getItem('wcg_admin_utilities_v4') || localStorage.getItem('wcg_utilities_v4');
      if (utRaw) {
        try {
          const utList = JSON.parse(utRaw);
          if (Array.isArray(utList)) {
            utList.forEach((u: any) => {
              if (u && u.id && !this.sessionAnchorMap.has(u.id)) {
                const base = (Number(u.sold_count) || 0) + (Number(u.virtual_sold_count) || 0);
                this.sessionAnchorMap.set(u.id, { lastCount: base, lastTimestamp: now });
                changed = true;
              }
            });
          }
        } catch {}
      }

      // 2. Seed giveaways
      const gwRaw = localStorage.getItem('wcg_admin_giveaways_v4') || localStorage.getItem('wcg_giveaways_v4');
      if (gwRaw) {
        try {
          const gwList = JSON.parse(gwRaw);
          if (Array.isArray(gwList)) {
            gwList.forEach((g: any) => {
              if (g && g.id && !this.sessionAnchorMap.has(g.id)) {
                const base = (Number(g.claimed_codes) || 0) + (Number(g.virtual_claimed_offset) || 0);
                this.sessionAnchorMap.set(g.id, { lastCount: base, lastTimestamp: now });
                changed = true;
              }
            });
          }
        } catch {}
      }

      if (changed) {
        this.saveSessionAnchor();
      }
    } catch {}
  }

  private initSessionAnchor(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(MARKETING_FOMO_SESSION_ANCHOR_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, v]: [string, any]) => {
            if (v && typeof v.lastCount === 'number' && typeof v.lastTimestamp === 'number') {
              this.sessionAnchorMap.set(k, {
                lastCount: Number(v.lastCount) || 0,
                lastTimestamp: Number(v.lastTimestamp) || 0,
              });
            }
          });
        }
      }
      // Khởi tạo các mốc còn thiếu từ highWater counts
      const now = this.getCalibratedNow();
      this.highWaterSoldCountMap.forEach((count, id) => {
        if (!this.sessionAnchorMap.has(id)) {
          this.sessionAnchorMap.set(id, { lastCount: count, lastTimestamp: now });
        }
      });
      this.highWaterClaimedCountMap.forEach((count, id) => {
        if (!this.sessionAnchorMap.has(id)) {
          this.sessionAnchorMap.set(id, { lastCount: count, lastTimestamp: now });
        }
      });
      // Tự động seed cho toàn bộ catalog nếu chưa có trong sessionAnchorMap
      this.ensureSessionAnchorsSeeded();
    } catch {}
  }

  private saveSessionAnchor(): void {
    if (typeof window === 'undefined') return;
    if (this.saveSessionAnchorTimer) return;
    this.saveSessionAnchorTimer = setTimeout(() => {
      this.saveSessionAnchorTimer = null;
      this.flushSessionAnchor();
    }, 300);
  }

  public saveSessionAnchors(): void {
    this.saveSessionAnchor();
  }

  public flushSessionAnchor(): void {
    if (typeof window === 'undefined') return;
    try {
      const now = this.getCalibratedNow();
      const obj: Record<string, { lastCount: number; lastTimestamp: number }> = {};
      this.sessionAnchorMap.forEach((val, key) => {
        obj[key] = {
          lastCount: val.lastCount,
          lastTimestamp: Math.max(val.lastTimestamp, now),
        };
      });
      localStorage.setItem(MARKETING_FOMO_SESSION_ANCHOR_KEY, JSON.stringify(obj));
    } catch {}
  }

  private updateSessionAnchor(id: string, count: number): void {
    if (!id || typeof count !== 'number' || isNaN(count)) return;
    const now = this.getCalibratedNow();
    const existing = this.sessionAnchorMap.get(id);
    if (!existing || count > existing.lastCount) {
      this.sessionAnchorMap.set(id, {
        lastCount: count,
        lastTimestamp: now,
      });
      this.saveSessionAnchor();
    }
  }

  /**
   * Giải pháp 1: Lấy mốc đã lưu làm Điểm tựa + Tự động cộng thêm thời gian ngoại tuyến.
   * Khắc phục triệt để việc mở lại web số bị đứng im do kẹt high-water mark của phiên trước.
   */
  public applyOfflineCatchUp(): void {
    if (typeof window === 'undefined') return;
    const catchUp = this.config.offlineCatchUp || DEFAULT_OFFLINE_CATCHUP_CONFIG;
    if (!catchUp.enabled) return;

    // Khi chọn 'server_only', chỉ điều chỉnh bộ đếm toàn máy chủ, không can thiệp bộ nhớ đệm cục bộ
    if (catchUp.scope === 'server_only') {
      return;
    }

    this.ensureSessionAnchorsSeeded();

    const now = this.getCalibratedNow();
    let anyChanged = false;

    this.sessionAnchorMap.forEach((anchor, id) => {
      if (!anchor || anchor.lastTimestamp <= 0) return;
      const elapsedMs = Math.max(0, now - anchor.lastTimestamp);
      const elapsedMinutes = Math.floor(elapsedMs / 60000);
      if (elapsedMinutes < 1) return;

      const pw = this.getProductConfig(id);
      if (pw.priority === 'off') return;

      // Chỉ áp dụng bù ngoại tuyến khi mục này thực sự có cấu hình số lượng ảo > 0 hoặc admin override
      if (id.startsWith('gw_')) {
        const gwDetails = this.findGiveawayDetails(id);
        const virtualOffset = gwDetails?.virtual_claimed_offset ?? 0;
        if (virtualOffset <= 0 && !this.adminOverrideClaimedMap.has(id)) return;
      } else {
        const prodDetails = this.findItemDetails(id);
        const virtualSold = (prodDetails as any)?.virtual_sold_count ?? 0;
        if (virtualSold <= 0 && !this.adminOverrideSoldMap.has(id)) return;
      }

      const realStock = this.getRealStockFor(id);
      const isOos = realStock <= 0;
      if (isOos && !catchUp.outOfStockEnabled) return;

      let unitsToAdd = 0;
      if (catchUp.mode === 'custom') {
        const interval = Math.max(1, Number(catchUp.intervalMinutes) || 15);
        const step = Math.max(1, Number(catchUp.incrementStep) || 1);
        unitsToAdd = Math.floor(elapsedMinutes / interval) * step;
      } else {
        // 'auto' mode: Tăng đều theo các thiết lập đã cài (mức ưu tiên + giờ cao điểm)
        let rateMinutes = pw.priority === 'high' ? 10 : pw.priority === 'low' ? 35 : 18;
        if (this.isPeakHourAt(now)) {
          const mult = Math.max(1, Number(this.config.peakHours?.multiplier) || 2.0);
          rateMinutes = Math.max(4, Math.round(rateMinutes / mult));
        }
        unitsToAdd = Math.floor(elapsedMinutes / rateMinutes);
      }

      const maxCap = isOos && catchUp.outOfStockEnabled
        ? Math.max(1, Number(catchUp.outOfStockMaxUnits) || 70)
        : Math.max(1, Number(catchUp.maxCatchUpUnits) || 70);
      unitsToAdd = Math.min(unitsToAdd, maxCap);

      if (unitsToAdd > 0) {
        if (id.startsWith('gw_')) {
          const currentClaimed = this.highWaterClaimedCountMap.get(id) || anchor.lastCount;
          const newTarget = Math.max(currentClaimed, anchor.lastCount + unitsToAdd);
          this.highWaterClaimedCountMap.set(id, newTarget);
          this.sessionAnchorMap.set(id, {
            lastCount: newTarget,
            lastTimestamp: now,
          });
        } else {
          const currentHighSold = this.highWaterSoldCountMap.get(id) || anchor.lastCount;
          const newTarget = Math.max(currentHighSold, anchor.lastCount + unitsToAdd);
          this.highWaterSoldCountMap.set(id, newTarget);
          this.sessionAnchorMap.set(id, {
            lastCount: newTarget,
            lastTimestamp: now,
          });

          // TỒN KHO ẢO ĐỒNG BỘ 1 - 1 KHI OFFLINE:
          // Cứ mỗi đơn bán bù ngoại tuyến, giảm tồn kho ảo đi đúng unitsToAdd đơn vị tương ứng (có tự động bù kho nếu chạm đáy):
          if (realStock > 0 && pw.virtualStockBonus && pw.virtualStockBonus > 0 && pw.priority !== 'off') {
            this.decrementProductStock(id, unitsToAdd, `offline_catchup_${id}_${now}`);
          }
        }
        anyChanged = true;
      }
    });

    if (anyChanged) {
      this.saveHighWaterCounts();
      this.saveSessionAnchor();
      this.notifySoldCountChanged('*', 0);
      this.notifyStockChanged('*', 0);
      this.schedulePeakReport();
    }
  }

  private initHourlyServerStats(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(MARKETING_HOURLY_SERVER_STATS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.products === 'object') {
          Object.entries(parsed.products).forEach(([k, v]: [string, any]) => {
            this.hourlyServerStatsMap.set(k, v);
            if (v && typeof v.totalSold === 'number') {
              const cur = this.highWaterSoldCountMap.get(k) || 0;
              if (v.totalSold > cur) this.highWaterSoldCountMap.set(k, v.totalSold);
            }
          });
        }
        if (parsed && typeof parsed.giveaways === 'object') {
          Object.entries(parsed.giveaways).forEach(([k, v]: [string, any]) => {
            if (v && typeof v.totalClaimed === 'number') {
              const cur = this.highWaterClaimedCountMap.get(k) || 0;
              if (v.totalClaimed > cur) this.highWaterClaimedCountMap.set(k, v.totalClaimed);
            }
          });
        }
      }
    } catch {}
  }

  public startHourlySyncEngine(): void {
    if (typeof window === 'undefined') return;
    if (this.hourlySyncTimer) clearInterval(this.hourlySyncTimer);

    const checkAndSync = async () => {
      const lastSync = Number(localStorage.getItem(MARKETING_LAST_HOURLY_SYNC_KEY)) || 0;
      const now = Date.now();
      if (now - lastSync >= this.ONE_HOUR_MS) {
        await this.performHourlySync();
      }
    };

    // Run initial check shortly after app load
    setTimeout(checkAndSync, 2000);

    // Periodic check every 60 seconds
    this.hourlySyncTimer = setInterval(checkAndSync, 60000);
  }

  public async performHourlySync(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' });
      if (!res.ok) return;
      const data: any = await res.json();

      if (data && typeof data.server_time === 'number') {
        this.calibrateServerTime(data.server_time);
      }

      if (data && data.hourly_fomo_stats) {
        const hStats = data.hourly_fomo_stats;
        if (hStats.products && typeof hStats.products === 'object') {
          Object.entries(hStats.products).forEach(([pId, info]: [string, any]) => {
            if (info && typeof info.totalSold === 'number') {
              this.hourlyServerStatsMap.set(pId, info);
              const cur = this.highWaterSoldCountMap.get(pId) || 0;
              if (info.totalSold > cur) this.highWaterSoldCountMap.set(pId, info.totalSold);
            }
          });
        }
        if (hStats.giveaways && typeof hStats.giveaways === 'object') {
          Object.entries(hStats.giveaways).forEach(([gId, info]: [string, any]) => {
            if (info && typeof info.totalClaimed === 'number') {
              this.hourlyServerStatsMap.set(gId, info);
              const cur = this.highWaterClaimedCountMap.get(gId) || 0;
              if (info.totalClaimed > cur) this.highWaterClaimedCountMap.set(gId, info.totalClaimed);
            }
          });
        }

        const serialized = {
          products: Object.fromEntries(this.hourlyServerStatsMap),
          timestamp: Date.now(),
        };
        localStorage.setItem(MARKETING_HOURLY_SERVER_STATS_KEY, JSON.stringify(serialized));
      }

      const today = this.getTodayDateKey();
      if (this.currentClickDate && this.currentClickDate !== today) {
        this.masterCopyClicks = 0;
        this.currentClickDate = today;
        this.saveMasterCopyClicks();
      }
      const serverDate = data.master_copy_clicks_date || data.masterCopyClicksDate;
      const isDateValid = !serverDate || serverDate === today;
      if (isDateValid && typeof data.master_copy_clicks === 'number' && !isNaN(data.master_copy_clicks)) {
        if (data.master_copy_clicks > this.masterCopyClicks) {
          this.masterCopyClicks = data.master_copy_clicks;
          this.realClicksOffset = data.master_copy_clicks;
          this.saveMasterCopyClicks();
          this.broadcastCurrentCount();
        }
      }
      if (data.real_product_sold_counts && typeof data.real_product_sold_counts === 'object') {
        Object.entries(data.real_product_sold_counts).forEach(([k, v]) => {
          if (typeof v === 'number') this.realProductSoldCountsMap.set(k, v);
        });
      }
      if (data.real_giveaway_claimed_counts && typeof data.real_giveaway_claimed_counts === 'object') {
        Object.entries(data.real_giveaway_claimed_counts).forEach(([k, v]) => {
          if (typeof v === 'number') this.realGiveawayClaimedCountsMap.set(k, v);
        });
      }
      if (data.peak_product_sold_counts && typeof data.peak_product_sold_counts === 'object') {
        let pChanged = false;
        Object.entries(data.peak_product_sold_counts).forEach(([k, v]) => {
          if (this.adminOverrideSoldMap.has(k)) {
            // Keep admin target intact
            return;
          }
          if (typeof v === 'number' && !isNaN(v) && v > 0) {
            const cur = this.highWaterSoldCountMap.get(k) || 0;
            if (v > cur) {
              this.highWaterSoldCountMap.set(k, v);
              pChanged = true;
            }
          }
        });
        if (pChanged) this.saveHighWaterCounts();
      }
      if (data.peak_giveaway_claimed_counts && typeof data.peak_giveaway_claimed_counts === 'object') {
        let gChanged = false;
        Object.entries(data.peak_giveaway_claimed_counts).forEach(([k, v]) => {
          if (this.adminOverrideClaimedMap.has(k)) {
            // Keep admin target intact
            return;
          }
          if (typeof v === 'number' && !isNaN(v) && v > 0) {
            const cur = this.highWaterClaimedCountMap.get(k) || 0;
            if (v > cur) {
              this.highWaterClaimedCountMap.set(k, v);
              gChanged = true;
            }
          }
        });
        if (gChanged) this.saveHighWaterCounts();
      }

      localStorage.setItem(MARKETING_LAST_HOURLY_SYNC_KEY, String(Date.now()));
      this.notifySoldCountChanged('*', 0);
    } catch {}
  }

  // --- Layer 3: CDN Edge Cached Realtime Events Poller ---
  public startRealtimeEventsPoller(): void {
    if (typeof window === 'undefined') return;
    if (this.isPollerRunning) return;
    this.isPollerRunning = true;

    const poll = async () => {
      if (!this.config.isEnabled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return; // Pause polling when browser tab is hidden to save client & network resources
      }

      try {
        const res = await fetch('/api/realtime-events', { cache: 'no-store' });
        if (res.ok) {
          const data: any = await res.json();
          if (data && data.success) {
            if (typeof data.server_time === 'number') {
              this.calibrateServerTime(data.server_time);
            }
            this.syncFromHub(
              data.events,
              data.master_copy_clicks,
              data.real_product_sold_counts,
              data.real_giveaway_claimed_counts,
              data.master_copy_clicks_date,
              data.peak_product_sold_counts,
              data.peak_giveaway_claimed_counts,
              data.lowest_product_stock,
              data.lowest_giveaway_remaining
            );
          }
        }
      } catch {}
    };

    // First background poll after 1 second for snappy start
    setTimeout(poll, 1000);

    // Periodic poll (18s to 22s) for smooth real-user sync with Cloudflare Edge Cache
    const scheduleNextPoll = () => {
      const intervalMs = 18000 + Math.floor(Math.random() * 4000);
      this.realtimePollerTimer = setTimeout(async () => {
        await poll();
        if (this.isPollerRunning) {
          scheduleNextPoll();
        }
      }, intervalMs);
    };
    scheduleNextPoll();

    // Fetch immediately when tab resumes active visibility
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          poll();
        }
      });
    }
  }

  public setInitialSyncCompleted(completed: boolean = true): void {
    this.initialSyncCompleted = completed;
  }

  public isInitialSyncCompleted(): boolean {
    return this.initialSyncCompleted;
  }

  // --- Clock Calibration ---
  public calibrateServerTime(serverTimestampMs: number): void {
    if (typeof serverTimestampMs === 'number' && !isNaN(serverTimestampMs) && serverTimestampMs > 0) {
      this.serverTimeOffset = serverTimestampMs - Date.now();
    }
  }

  public getCalibratedNow(): number {
    return Date.now() + this.serverTimeOffset;
  }

  public isPeakHourAt(timestampMs: number = this.getCalibratedNow()): boolean {
    if (!this.config.peakHours?.enabled) return false;
    try {
      // Calibrate to Vietnam Time (UTC+7)
      const vnDate = new Date(timestampMs + 7 * 3600 * 1000);
      const currentMinutes = vnDate.getUTCHours() * 60 + vnDate.getUTCMinutes();
      const [startH, startM] = (this.config.peakHours.startTime || '19:00').split(':').map(Number);
      const [endH, endM] = (this.config.peakHours.endTime || '23:30').split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      } else {
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
      }
    } catch {
      return false;
    }
  }

  public isCurrentPeakHour(): boolean {
    return this.isPeakHourAt(this.getCalibratedNow());
  }

  public getSlotDurationMs(timestampMs: number = this.getCalibratedNow()): number {
    const minSec = Math.max(5, Number(this.config.intervalMin) || 12);
    const maxSec = Math.max(minSec, Number(this.config.intervalMax) || 24);
    let baseSec = Math.round((minSec + maxSec) / 2);

    if (this.isPeakHourAt(timestampMs)) {
      const multiplier = Math.max(1, Number(this.config.peakHours?.multiplier) || 2.0);
      baseSec = Math.max(4, Math.round(baseSec / multiplier));
    }
    return baseSec * 1000;
  }

  public getNextIntervalMs(): number {
    return this.getSlotDurationMs(this.getCalibratedNow());
  }

  // --- Real Click Offset for Global Counter ---
  private initRealClicks(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(MARKETING_REAL_CLICKS_KEY);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) this.realClicksOffset = val;
      }
    } catch {}
  }

  private startGlobalCounterTicker(): void {
    if (typeof window === 'undefined') return;
    // Periodic ticker (every 3.5s) to update hero banner smoothly
    setInterval(() => {
      const current = this.getLiveCopyCount();
      if (current !== this.lastBroadcastCount) {
        this.lastBroadcastCount = current;
        this.counterListeners.forEach((cb) => {
          try { cb(current); } catch {}
        });
      }
    }, 3500);
  }

  public recordToastFiredTime(): void {
    this.lastToastFiredTime = this.getCalibratedNow();
  }

  /**
   * Đồng bộ nguyên tử 1 - 1: Giảm kho hiển thị đúng 1 đơn & Tăng số đã bán đúng 1 đơn
   */
  public recordVirtualSale(productId: string, notifId?: string): { stock: number; sold: number } {
    const stock = this.decrementProductStock(productId, 1, notifId);
    const sold = this.incrementLiveSoldCount(productId, 1, notifId);
    return { stock, sold };
  }

  /**
   * Đồng bộ nguyên tử 1 - 1: Giảm mã còn lại đúng 1 đơn & Tăng mã đã giật đúng 1 đơn
   */
  public recordVirtualGiveawayClaim(campaignId: string, notifId?: string): { remaining: number; claimed: number } {
    const remaining = this.decrementProductStock(campaignId, 1, notifId);
    const claimed = this.incrementLiveClaimedCount(campaignId, 1, notifId);
    return { remaining, claimed };
  }

  // --- Deterministic Live Copy Counter (Reset về 0 lúc 0h hàng ngày) ---
  public getLiveCopyCount(timestampMs: number = this.getCalibratedNow()): number {
    const vnDate = new Date(timestampMs + 7 * 3600 * 1000);
    const dateKey = vnDate.toISOString().slice(0, 10);

    // Reset daily max copy count at midnight
    if (this.dailyMaxCopyDate && this.dailyMaxCopyDate !== dateKey) {
      this.dailyMaxCopyCount = 0;
      this.masterCopyAnchorCount = 0;
      this.masterCopyAnchorTime = 0;
      this.localSessionCopyClicks = 0;
      this.dailyMaxCopyDate = dateKey;
      this.saveDailyMaxCopyCount();
    } else if (!this.dailyMaxCopyDate) {
      this.dailyMaxCopyDate = dateKey;
    }

    // Check if day has rolled over for real copy clicks
    if (this.currentClickDate && this.currentClickDate !== dateKey) {
      this.masterCopyClicks = 0;
      this.currentClickDate = dateKey;
      this.saveMasterCopyClicks();
    }

    let calculated = 0;
    if (this.masterCopyAnchorCount > 0 && this.masterCopyAnchorTime > 0) {
      // Progression relative to authoritative server snapshot anchor
      const growthSinceAnchor = Math.max(
        0,
        calculateDeterministicCopyCount(timestampMs, 0) -
        calculateDeterministicCopyCount(this.masterCopyAnchorTime, 0)
      );
      calculated = this.masterCopyAnchorCount + growthSinceAnchor + this.localSessionCopyClicks;
    } else {
      // Fallback before first snapshot is retrieved
      calculated = calculateDeterministicCopyCount(timestampMs, this.masterCopyClicks) + this.localSessionCopyClicks;
    }

    if (calculated > this.dailyMaxCopyCount) {
      this.dailyMaxCopyCount = calculated;
      this.saveDailyMaxCopyCount();
    }
    // RÀNG BUỘC ĐƠN ĐIỆU TUYỆT ĐỐI (Monotonically Non-Decreasing):
    // Trong cùng một ngày, bộ đếm hiển thị chỉ được phép tăng hoặc giữ nguyên,
    // tuyệt đối không bao giờ tụt lùi dù client có bị trễ mạng hay lệch xung nhịp.
    return Math.max(calculated, this.dailyMaxCopyCount);
  }

  public getLiveCounter(): number {
    return this.getLiveCopyCount();
  }

  private broadcastCurrentCount(): void {
    const current = this.getLiveCopyCount();
    this.lastBroadcastCount = current;
    this.counterListeners.forEach((cb) => {
      try { cb(current); } catch {}
    });
  }

  public incrementLiveCounter(amount: number = 1, notifId?: string): void {
    if (notifId) {
      const copyKey = `copy_${notifId}`;
      if (this.processedStockNotifIds.has(copyKey)) return;
      this.processedStockNotifIds.add(copyKey);
    }
    const today = this.getTodayDateKey();
    if (this.currentClickDate && this.currentClickDate !== today) {
      this.masterCopyClicks = 0;
      this.currentClickDate = today;
    }
    const inc = Math.max(1, amount);
    this.localSessionCopyClicks += inc;
    this.masterCopyClicks += inc;
    this.realClicksOffset = this.masterCopyClicks;
    this.saveMasterCopyClicks();
    this.broadcastCurrentCount();
    this.schedulePeakReport();
  }

  public subscribeCounter(callback: (count: number) => void): () => void {
    this.counterListeners.add(callback);
    callback(this.getLiveCopyCount());
    return () => this.counterListeners.delete(callback);
  }

  // --- Event-Driven & Deterministic Virtual Stock Engine ---
  /** Cấu hình marketing của 1 mục; nếu chưa có (sản phẩm mới) thì dùng mẫu mặc định. */
  public getProductConfig(id: string): ProductMarketingConfig {
    const pw = this.config.productWeights?.[id];
    return pw ? { ...DEFAULT_PRODUCT_MARKETING_CONFIG, ...pw } : { ...DEFAULT_PRODUCT_MARKETING_CONFIG };
  }

  /** Tồn kho thật tối thiểu để FOMO của mục này hoạt động. */
  public getMinRealStock(id: string): number {
    return Math.max(1, Number(this.getProductConfig(id).minRealStock) || 1);
  }

  /** Kiểm tra xem một loại thông báo FOMO cụ thể có đang được bật hay không */
  public isTypeEnabled(type: NotificationType, itemType?: 'store' | 'utility' | 'giveaway'): boolean {
    if (!this.config.isEnabled) return false;
    const toggles = this.config.typeToggles || DEFAULT_TYPE_TOGGLES;

    if (type === 'COPY_CODE') return toggles.copyCode !== false;
    if (type === 'DEPOSIT_WALLET') return toggles.depositWallet !== false;
    if (type === 'STATS_COPY') return toggles.statsCopy !== false;
    if (type === 'CLAIM_GIVEAWAY') return toggles.claimGiveaway !== false;
    if (type === 'RESTOCK_PRODUCT') return toggles.restockProduct !== false;
    if (type === 'BUY_PRODUCT') {
      if (toggles.buyProduct === false) return false;
      if (itemType === 'store') return toggles.buyStore !== false;
      if (itemType === 'utility') return toggles.buyUtility !== false;
      return (toggles.buyStore !== false) || (toggles.buyUtility !== false);
    }
    return true;
  }

  /** Lấy toàn bộ bộ cờ bật/tắt của các loại thông báo */
  public getTypeToggles(): NotificationTypeToggles {
    return {
      ...DEFAULT_TYPE_TOGGLES,
      ...(this.config.typeToggles || {}),
    };
  }

  public getVirtualBonusStock(productId: string, timestampMs: number = this.getCalibratedNow(), maybeRealStock?: number): number {
    const pw = this.getProductConfig(productId);
    if (pw.priority === 'off' || !pw.virtualStockBonus || pw.virtualStockBonus <= 0) return 0;

    const rawThreshold = Math.max(1, Number(pw.autoRestockThreshold) || 1);
    const restockAmount = Math.max(1, Number(pw.autoRestockAmount) || 20);

    const realStock = typeof maybeRealStock === 'number'
      ? maybeRealStock
      : (this.productRealStockMap.get(productId) ?? this.activeSnapshot?.products?.[productId]?.real_stock ?? this.activeSnapshot?.giveaways?.[productId]?.real_remaining ?? 0);

    if (realStock <= 0) return 0;

    const effectiveTotalThreshold = (realStock > 0 && rawThreshold < realStock)
      ? realStock
      : rawThreshold;

    const maxAllowedStock = Math.max(realStock + Number(pw.virtualStockBonus || 0), effectiveTotalThreshold + restockAmount);

    // 1. Ưu tiên giá trị đã lưu trong liveVirtualStockMap (nếu hợp lệ <= maxAllowedStock)
    if (this.liveVirtualStockMap.has(productId)) {
      const liveVal = this.liveVirtualStockMap.get(productId);
      if (typeof liveVal === 'number' && !isNaN(liveVal) && liveVal > 0 && liveVal <= maxAllowedStock) {
        return liveVal;
      }
    }

    // 2. Tính baseline ban đầu từ config admin: Tồn kho thật + Kho ảo cộng thêm
    const initialBonus = realStock + Number(pw.virtualStockBonus || 0);

    this.liveVirtualStockMap.set(productId, initialBonus);
    this.liveVirtualStockTimestampsMap.set(productId, timestampMs);
    this.saveLiveVirtualStock();

    return initialBonus;
  }

  public clearRealStockCache(id?: string): void {
    if (id) {
      this.productRealStockMap.delete(id);
    } else {
      this.productRealStockMap.clear();
    }
  }

  public getRealStockFor(id: string): number {
    if (!id) return 0;
    if (typeof localStorage !== 'undefined') {
      try {
        const invRaw = localStorage.getItem('wcg_admin_inventory_v4');
        if (invRaw) {
          const invList = JSON.parse(invRaw);
          if (Array.isArray(invList) && invList.length > 0) {
            const matching = invList.filter(
              (i: any) => i && (i.sku === id || i.product_id === id)
            );
            if (matching.length > 0) {
              const s = matching.filter((i: any) => i.status === 'AVAILABLE').length;
              this.productRealStockMap.set(id, s);
              return s;
            }
          }
        }

        const utRaw = localStorage.getItem('wcg_admin_utilities_v4');
        if (utRaw) {
          const utList = JSON.parse(utRaw);
          const found = Array.isArray(utList) ? utList.find((u: any) => u && u.id === id) : null;
          if (found && found.stock_quantity !== undefined) {
            const s = Math.max(0, Number(found.stock_quantity) || 0);
            this.productRealStockMap.set(id, s);
            return s;
          }
        }
        const spRaw = localStorage.getItem('wcg_admin_store_products_v4');
        if (spRaw) {
          const spList = JSON.parse(spRaw);
          const found = Array.isArray(spList) ? spList.find((p: any) => p && p.id === id) : null;
          if (found && found.stock_quantity !== undefined) {
            const s = Math.max(0, Number(found.stock_quantity) || 0);
            this.productRealStockMap.set(id, s);
            return s;
          }
        }
        const gwRaw = localStorage.getItem('wcg_admin_giveaways_v4');
        if (gwRaw) {
          const gwList = JSON.parse(gwRaw);
          const found = Array.isArray(gwList) ? gwList.find((g: any) => g && g.id === id) : null;
          if (found) {
            const count = Array.isArray(found.codes_pool)
              ? found.codes_pool.length
              : (typeof found.remaining_codes === 'number' ? found.remaining_codes : 0);
            const s = Math.max(0, Number(count) || 0);
            this.productRealStockMap.set(id, s);
            return s;
          }
        }
      } catch {}
    }
    if (this.productRealStockMap.has(id)) {
      const val = this.productRealStockMap.get(id);
      if (typeof val === 'number') return val;
    }
    if (this.activeSnapshot?.products?.[id]?.real_stock !== undefined) {
      const s = Math.max(0, Number(this.activeSnapshot.products[id].real_stock) || 0);
      this.productRealStockMap.set(id, s);
      return s;
    }
    if (this.activeSnapshot?.giveaways?.[id]?.real_remaining !== undefined) {
      const s = Math.max(0, Number(this.activeSnapshot.giveaways[id].real_remaining) || 0);
      this.productRealStockMap.set(id, s);
      return s;
    }
    return 0;
  }

  public decrementProductStock(
    productId: string,
    amountOrNotifId?: number | string,
    notifIdOrAmount?: string | number,
    maybeRealStock?: number
  ): number {
    if (!productId) return 0;

    let amount = 1;
    let notifId: string | undefined = undefined;

    if (typeof amountOrNotifId === 'number') {
      amount = Math.max(1, amountOrNotifId);
      if (typeof notifIdOrAmount === 'string') notifId = notifIdOrAmount;
    } else if (typeof amountOrNotifId === 'string') {
      notifId = amountOrNotifId;
      if (typeof notifIdOrAmount === 'number') amount = Math.max(1, notifIdOrAmount);
    }

    const pw = this.getProductConfig(productId);
    const realStock = typeof maybeRealStock === 'number'
      ? maybeRealStock
      : this.getRealStockFor(productId);

    // CRITICAL: Nếu hàng thật <= 0, ngắt hoàn toàn
    if (realStock <= 0) {
      this.liveVirtualStockMap.set(productId, 0);
      return 0;
    }

    // Deduplication check: process each unique notification ID exactly once across all tabs/mounts
    if (notifId) {
      const stockKey = notifId.startsWith('stock_') ? notifId : `stock_${notifId}`;
      if (this.processedStockNotifIds.has(stockKey)) {
        return this.getDisplayStock(productId, realStock);
      }
      this.processedStockNotifIds.add(stockKey);
      if (this.processedStockNotifIds.size > 200) {
        const arr = Array.from(this.processedStockNotifIds);
        this.processedStockNotifIds = new Set(arr.slice(arr.length - 100));
      }
    }

    const dec = Math.max(1, amount || 1);
    const rawThreshold = Math.max(1, Number(pw.autoRestockThreshold) || 1);
    const restockAmount = Math.max(1, Number(pw.autoRestockAmount) || 20);

    // Quy tắc FOMO người dùng yêu cầu: Nếu cài đặt giới hạn sản phẩm còn để tăng đơn ảo nhỏ hơn số lượng thực tế trong kho,
    // thì mặc định khi đến số hàng còn lại trong kho thực tế sẽ tăng sản phẩm ảo đã cài.
    const effectiveThreshold = (realStock > 0 && rawThreshold < realStock)
      ? realStock
      : rawThreshold;

    const maxAllowedStock = (pw.priority === 'off' || !pw.virtualStockBonus || pw.virtualStockBonus <= 0)
      ? realStock
      : Math.max(realStock + Number(pw.virtualStockBonus || 0), effectiveThreshold + restockAmount);

    // Lấy tồn kho hiện tại và trừ bớt
    let currentStock = this.liveVirtualStockMap.get(productId);
    if (typeof currentStock !== 'number' || isNaN(currentStock) || currentStock <= 0) {
      currentStock = this.getDisplayStock(productId, realStock);
    } else if (currentStock > maxAllowedStock) {
      currentStock = maxAllowedStock;
    }

    let nextStock = currentStock - dec;

    // Tự động bù thêm nếu kho ảo tụt về <= ngưỡng kích hoạt (effectiveThreshold)
    if (pw.virtualStockBonus && pw.virtualStockBonus > 0 && nextStock <= effectiveThreshold) {
      nextStock = effectiveThreshold + restockAmount;
      this.recentRestockTimestampsMap.set(productId, Date.now());
      if (this.lastReportedPeaks) {
        if (this.lastReportedPeaks.stock?.[productId] !== undefined) {
          delete this.lastReportedPeaks.stock[productId];
        }
        if (this.lastReportedPeaks.remaining?.[productId] !== undefined) {
          delete this.lastReportedPeaks.remaining[productId];
        }
      }
      if (this.isTypeEnabled('RESTOCK_PRODUCT')) {
        const itemInfo = this.findItemTitle(productId);
        const titleStr = itemInfo?.title || 'Sản phẩm';
        this.recordRealRestock(titleStr, productId, restockAmount, itemInfo?.itemType || 'utility');
      }
    } else {
      nextStock = Math.max(1, nextStock);
    }
    nextStock = Math.min(nextStock, maxAllowedStock);

    const now = this.getCalibratedNow();
    this.liveVirtualStockMap.set(productId, nextStock);
    this.liveVirtualStockTimestampsMap.set(productId, now);
    this.saveLiveVirtualStock();
    this.notifyStockChanged(productId, nextStock);
    this.schedulePeakReport();

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'VIRTUAL_STOCK_DECREMENT',
          payload: { productId, newStock: nextStock, notifId },
        });
      } catch {}
    }

    return nextStock;
  }

  public findItemTitle(id: string): { title: string; itemType: 'store' | 'utility' | 'giveaway' } | null {
    if (!id) return null;
    if (typeof localStorage !== 'undefined') {
      try {
        const utRaw = localStorage.getItem('wcg_admin_utilities_v4') || localStorage.getItem('wcg_utilities_v4');
        if (utRaw) {
          const list = JSON.parse(utRaw);
          const found = Array.isArray(list) ? list.find((u: any) => u && u.id === id) : null;
          if (found && found.title) return { title: found.title, itemType: 'utility' };
        }
        const spRaw = localStorage.getItem('wcg_admin_store_products_v4') || localStorage.getItem('wcg_store_products_v4');
        if (spRaw) {
          const list = JSON.parse(spRaw);
          const found = Array.isArray(list) ? list.find((p: any) => p && p.id === id) : null;
          if (found && found.title) return { title: found.title, itemType: 'store' };
        }
        const gwRaw = localStorage.getItem('wcg_admin_giveaways_v4') || localStorage.getItem('wcg_giveaways_v4');
        if (gwRaw) {
          const list = JSON.parse(gwRaw);
          const found = Array.isArray(list) ? list.find((g: any) => g && g.id === id) : null;
          if (found && found.title) return { title: found.title, itemType: 'giveaway' };
        }
      } catch {}
    }
    return null;
  }

  public boostProductStock(productId: string, amount: number = 20, notifId?: string): number {
    if (!productId) return 0;
    if (notifId) {
      const restockKey = notifId.startsWith('restock_') ? notifId : `restock_${notifId}`;
      if (this.processedStockNotifIds.has(restockKey)) {
        return this.getDisplayStock(productId);
      }
      this.processedStockNotifIds.add(restockKey);
    }
    const realStock = this.getRealStockFor(productId);
    if (realStock <= 0) return 0;
    const inc = Math.max(1, amount || 20);
    const curStock = this.getDisplayStock(productId, realStock);
    const nextStock = curStock + inc;
    this.liveVirtualStockMap.set(productId, nextStock);
    this.saveLiveVirtualStock();
    this.notifyStockChanged(productId, nextStock);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'VIRTUAL_STOCK_RESTOCK',
          payload: { productId, newStock: nextStock, notifId },
        });
      } catch {}
    }
    return nextStock;
  }

  public recordRealRestock(
    productTitle: string,
    productId: string,
    restockAmount: number = 20,
    itemType: 'store' | 'utility' | 'giveaway' = 'utility'
  ): void {
    // QUY TẮC BẮT BUỘC: Chỉ thông báo bổ sung hàng cho các mục còn hàng đang bán trên web
    if (productId) {
      const realStock = this.getRealStockFor(productId);
      if (realStock <= 0) return;
      const displayStock = this.getDisplayStock(productId, realStock);
      if (displayStock <= 0) return;
    }

    const now = this.getCalibratedNow();
    const amt = Math.max(1, restockAmount || 20);
    const event: MarketingNotification = {
      id: `restock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'RESTOCK_PRODUCT',
      title: itemType === 'giveaway' ? 'Nạp thêm mã quà tặng' : 'Bổ sung tồn kho',
      message: itemType === 'giveaway'
        ? `Sự kiện ${productTitle} vừa được nạp thêm +${amt} mã quà tặng mới!`
        : `Kho hàng vừa bổ sung thêm +${amt} ${productTitle}!`,
      timeAgo: 'vừa xong',
      userName: 'Hệ thống',
      productId,
      productName: productTitle,
      giveawayId: itemType === 'giveaway' ? productId : undefined,
      giveawayTitle: itemType === 'giveaway' ? productTitle : undefined,
      restockAmount: amt,
      itemType,
      isRealUser: true,
      timestamp: now,
      scheduledFireTime: now,
    };
    (event as any).localOrigin = true;

    this.boostProductStock(productId, amt, event.id);
    this.pushRealEvent(event, true, true);
    this.schedulePushRealEvent(event, 0);
  }

  private getInitialCalculatedStock(productId: string): number {
    if (this.activeSnapshot?.giveaways?.[productId]) {
      const r = this.activeSnapshot.giveaways[productId].remaining;
      return r > 0 ? r : 5;
    }
    if (this.activeSnapshot?.products?.[productId]) {
      const s = this.activeSnapshot.products[productId].stock;
      return s > 0 ? s : 10;
    }
    const bonus = this.getVirtualBonusStock(productId);
    return bonus > 0 ? bonus : 10;
  }

  public getDisplayStock(productId: string, realStock?: number, timestampMs: number = this.getCalibratedNow()): number {
    const baseStock = Math.max(0, Number(typeof realStock === 'number' ? realStock : this.getRealStockFor(productId)) || 0);
    // CRITICAL BUSINESS RULE: Hết hàng thật = Hết hàng hiển thị (0)
    if (baseStock <= 0) {
      this.liveVirtualStockMap.set(productId, 0);
      this.productRealStockMap.set(productId, 0);
      return 0;
    }

    // Ghi nhớ tồn kho thật
    this.productRealStockMap.set(productId, baseStock);

    const pw = this.getProductConfig(productId);
    const rawThreshold = Math.max(1, Number(pw.autoRestockThreshold) || 1);
    const restockAmount = Math.max(1, Number(pw.autoRestockAmount) || 20);
    const effectiveThreshold = (baseStock > 0 && rawThreshold < baseStock)
      ? baseStock
      : rawThreshold;

    const maxAllowedStock = (pw.priority === 'off' || !pw.virtualStockBonus || pw.virtualStockBonus <= 0)
      ? baseStock
      : Math.max(baseStock + Number(pw.virtualStockBonus || 0), effectiveThreshold + restockAmount);

    // Lấy tồn kho sống động:
    let liveStock = this.liveVirtualStockMap.get(productId);
    if (typeof liveStock !== 'number' || isNaN(liveStock) || liveStock <= 0 || liveStock > maxAllowedStock) {
      if (this.activeSnapshot?.products?.[productId]?.stock && this.activeSnapshot.products[productId].stock <= maxAllowedStock) {
        liveStock = this.activeSnapshot.products[productId].stock;
      } else if (this.activeSnapshot?.giveaways?.[productId]?.remaining && this.activeSnapshot.giveaways[productId].remaining <= maxAllowedStock) {
        liveStock = this.activeSnapshot.giveaways[productId].remaining;
      } else {
        liveStock = baseStock + (pw.virtualStockBonus && pw.virtualStockBonus > 0 ? Number(pw.virtualStockBonus) : 0);
      }
      liveStock = Math.min(liveStock, maxAllowedStock);
      this.liveVirtualStockMap.set(productId, liveStock);
      this.saveLiveVirtualStock();
    }

    // Auto-restock check ngay khi đọc tồn kho hiển thị:
    if (pw.virtualStockBonus && pw.virtualStockBonus > 0 && baseStock > 0 && liveStock <= effectiveThreshold) {
      liveStock = effectiveThreshold + restockAmount;
      this.recentRestockTimestampsMap.set(productId, Date.now());
      this.liveVirtualStockMap.set(productId, liveStock);
      this.saveLiveVirtualStock();
      this.notifyStockChanged(productId, liveStock);
      if (this.lastReportedPeaks) {
        if (this.lastReportedPeaks.stock?.[productId] !== undefined) {
          delete this.lastReportedPeaks.stock[productId];
        }
        if (this.lastReportedPeaks.remaining?.[productId] !== undefined) {
          delete this.lastReportedPeaks.remaining[productId];
        }
      }
      this.schedulePeakReport();
    }

    return Math.max(1, Math.min(liveStock, maxAllowedStock));
  }

  public getHourlyGrowth(id: string, createdAt?: string, priority?: string, anchorTime?: string): number {
    if (!id) return 0;
    const pw = this.getProductConfig(id);
    const p = priority || pw?.priority || 'normal';
    if (p === 'off') return 0;

    let parsedAnchorMs: number | null = null;
    if (anchorTime) {
      let str = String(anchorTime).trim();
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
        str = str.replace(' ', 'T') + 'Z';
      }
      const t = new Date(str).getTime();
      if (!isNaN(t) && t > 0) {
        parsedAnchorMs = Math.min(t, this.getCalibratedNow());
      }
    }

    if (!parsedAnchorMs) {
      return 0;
    }

    const nowMs = this.getCalibratedNow();
    const safeStart = Math.min(parsedAnchorMs, nowMs);
    const elapsedMinutes = Math.max(0, Math.floor((nowMs - safeStart) / 60000));
    if (elapsedMinutes <= 0) return 0;

    const elapsedHours = elapsedMinutes / 60;
    let rate = p === 'high' ? 1.5 : p === 'low' ? 0.2 : 0.5;
    const catchUp = this.config.offlineCatchUp || DEFAULT_OFFLINE_CATCHUP_CONFIG;
    if (catchUp.enabled && catchUp.mode === 'custom') {
      const interval = Math.max(1, Number(catchUp.intervalMinutes) || 60);
      const step = Math.max(1, Number(catchUp.incrementStep) || 1);
      rate = Math.min(2.5, (60 / interval) * step);
    } else if (this.isCurrentPeakHour()) {
      const mult = Math.max(1, Number(this.config.peakHours?.multiplier) || 1.5);
      rate = Math.min(2.5, rate * mult);
    }
    let baseGrowth = Math.floor(elapsedHours * rate);
    const maxCap = Math.max(1, Math.min(30, Number(catchUp.maxCatchUpUnits) || 30));
    baseGrowth = Math.min(baseGrowth, maxCap);

    return baseGrowth;
  }

  public getInHourProgression(id: string, createdAt?: string, priority?: string, anchorTime?: string): number {
    if (!id) return 0;
    const pw = this.getProductConfig(id);
    const p = priority || pw?.priority || 'normal';
    if (p === 'off') return 0;

    let parsedAnchorMs: number | null = null;
    if (anchorTime) {
      let str = String(anchorTime).trim();
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
        str = str.replace(' ', 'T') + 'Z';
      }
      const t = new Date(str).getTime();
      if (!isNaN(t) && t > 0) {
        parsedAnchorMs = Math.min(t, this.getCalibratedNow());
      }
    }
    if (!parsedAnchorMs) {
      return 0;
    }

    const nowMs = this.getCalibratedNow();
    // Items within 15 minutes of anchor start at clean baseline without artificial in-hour jump
    if (nowMs - parsedAnchorMs < 15 * 60 * 1000) {
      return 0;
    }

    const currentHourIndex = Math.floor(nowMs / this.ONE_HOUR_MS);
    const vnDate = new Date(nowMs + 7 * 3600 * 1000);
    const minuteInHour = vnDate.getUTCMinutes(); // 0 to 59

    const maxHourInc = p === 'high' ? 2 : p === 'low' ? 0 : 1;
    if (maxHourInc <= 0) return 0;

    const seed = (stringHash(id) ^ (currentHourIndex * 1664525)) >>> 0;
    const triggerMinute1 = 12 + (seed % 22);
    const triggerMinute2 = 36 + ((seed >> 8) % 20);

    let inc = 0;
    if (minuteInHour >= triggerMinute1) inc += 1;
    if (maxHourInc >= 2 && minuteInHour >= triggerMinute2) inc += 1;
    return inc;
  }

  public findItemDetails(id: string): { sold_count?: number; virtual_sold_count?: number; created_at?: string; fomo_anchor_time?: string; virtual_sold_updated_at?: string } | null {
    if (!id) return null;
    if (typeof localStorage !== 'undefined') {
      try {
        const spRaw = localStorage.getItem('wcg_admin_store_products_v4') || localStorage.getItem('wcg_store_products_v4');
        if (spRaw) {
          const spList = JSON.parse(spRaw);
          const found = Array.isArray(spList) ? spList.find((p: any) => p && p.id === id) : null;
          if (found) {
            return {
              sold_count: typeof found.sold_count === 'number' ? found.sold_count : Number(found.sold_count) || 0,
              virtual_sold_count: found.virtual_sold_count !== undefined ? Number(found.virtual_sold_count) : 0,
              created_at: found.created_at || found.createdAt,
              fomo_anchor_time: found.fomo_anchor_time || found.virtual_sold_updated_at,
              virtual_sold_updated_at: found.virtual_sold_updated_at || found.fomo_anchor_time,
            };
          }
        }
        const utRaw = localStorage.getItem('wcg_admin_utilities_v4') || localStorage.getItem('wcg_utilities_v4');
        if (utRaw) {
          const utList = JSON.parse(utRaw);
          const found = Array.isArray(utList) ? utList.find((u: any) => u && u.id === id) : null;
          if (found) {
            return {
              sold_count: typeof found.sold_count === 'number' ? found.sold_count : Number(found.sold_count) || 0,
              virtual_sold_count: found.virtual_sold_count !== undefined ? Number(found.virtual_sold_count) : 0,
              created_at: found.created_at || found.createdAt,
              fomo_anchor_time: found.fomo_anchor_time || found.virtual_sold_updated_at,
              virtual_sold_updated_at: found.virtual_sold_updated_at || found.fomo_anchor_time,
            };
          }
        }
      } catch {}
    }
    return null;
  }

  public findGiveawayDetails(id: string): { claimed_codes?: number; virtual_claimed_offset?: number; created_at?: string; fomo_anchor_time?: string; virtual_claimed_updated_at?: string } | null {
    if (!id) return null;
    if (typeof localStorage !== 'undefined') {
      try {
        const gwRaw = localStorage.getItem('wcg_admin_giveaways_v4') || localStorage.getItem('wcg_giveaways_v4');
        if (gwRaw) {
          const gwList = JSON.parse(gwRaw);
          const found = Array.isArray(gwList) ? gwList.find((g: any) => g && g.id === id) : null;
          if (found) {
            return {
              claimed_codes: typeof found.claimed_codes === 'number' ? found.claimed_codes : Number(found.claimed_codes) || 0,
              virtual_claimed_offset: found.virtual_claimed_offset !== undefined ? Number(found.virtual_claimed_offset) : 0,
              created_at: found.created_at || found.createdAt,
              fomo_anchor_time: found.fomo_anchor_time || found.virtual_claimed_updated_at,
              virtual_claimed_updated_at: found.virtual_claimed_updated_at || found.fomo_anchor_time,
            };
          }
        }
      } catch {}
    }
    return null;
  }

  public getSoldDisplay(item: { id?: string; sold_count?: number; virtual_sold_count?: number; created_at?: string; createdAt?: string; fomo_anchor_time?: string; virtual_sold_updated_at?: string; packages?: any[] } | null | undefined): number {
    if (!item) return 0;

    // NẾU LÀ SẢN PHẨM GOM NHÓM CÓ NHIỀU GÓI CON (VARIANTS / PACKAGES):
    // Tự động cộng tổng số lượng đã bán của tất cả các gói con lại hiển thị cho thẻ đại diện
    if (Array.isArray((item as any)?.packages) && (item as any).packages.length > 1) {
      const sumVariantSold = (item as any).packages.reduce((sum: number, pkg: any) => {
        const singlePkg = {
          ...pkg,
          packages: undefined,
          created_at: pkg.created_at || item.created_at || (item as any).createdAt,
          fomo_anchor_time: (pkg as any).fomo_anchor_time || (item as any).fomo_anchor_time,
        };
        return sum + this.getSoldDisplay(singlePkg);
      }, 0);

      const id = item.id || '';
      const recordedMax = id ? (this.highWaterSoldCountMap.get(id) || 0) : 0;
      const finalDisplay = Math.max(sumVariantSold, recordedMax);
      if (id && finalDisplay > recordedMax) {
        this.highWaterSoldCountMap.set(id, finalDisplay);
        this.saveHighWaterCounts();
      }
      return finalDisplay;
    }

    const id = item.id || '';
    const details = id && (item.sold_count === undefined || item.virtual_sold_count === undefined) ? this.findItemDetails(id) : null;

    const pw = this.getProductConfig(id);
    const realSold = Number(item.sold_count !== undefined ? item.sold_count : (details?.sold_count ?? 0)) || 0;
    const realFromHub = id ? (this.realProductSoldCountsMap.get(id) || 0) : 0;
    const effectiveRealSold = Math.max(realSold, realFromHub);

    let recordedMax = id ? (this.highWaterSoldCountMap.get(id) || 0) : 0;
    const virtualBaseRaw = item.virtual_sold_count !== undefined ? item.virtual_sold_count : (details?.virtual_sold_count ?? 0);
    const virtualBase = Number(virtualBaseRaw || 0);

    // If priority is 'off' or virtualBase <= 0 (and no admin override):
    // Cho phép số đã bán tăng 1 theo thông báo toast (recordedMax), chỉ thanh lọc nếu vượt quá đỉnh ma rác phi lý (+35)
    if (pw.priority === 'off' || (virtualBase <= 0 && (!id || !this.adminOverrideSoldMap.has(id)))) {
      if (id && recordedMax > effectiveRealSold + 35) {
        recordedMax = effectiveRealSold;
        this.highWaterSoldCountMap.set(id, effectiveRealSold);
        this.saveHighWaterCounts();
      }
      return Math.max(effectiveRealSold, recordedMax);
    }

    const anchorTime = (item as any)?.fomo_anchor_time || (item as any)?.virtual_sold_updated_at || details?.fomo_anchor_time || details?.virtual_sold_updated_at;
    const createdAt = item.created_at || item.createdAt || details?.created_at;
    let hourlyGrowth = this.getHourlyGrowth(id, createdAt, pw.priority, anchorTime);
    let inHourProg = this.getInHourProgression(id, createdAt, pw.priority, anchorTime);

    const realStock = this.getRealStockFor(id);
    const catchUp = this.config.offlineCatchUp || DEFAULT_OFFLINE_CATCHUP_CONFIG;
    const oosEnabled = Boolean(catchUp.outOfStockEnabled);
    const oosMax = Math.max(1, Math.min(30, Number(catchUp.outOfStockMaxUnits) || 10));

    const effectiveStock = typeof (item as any)?.stock_quantity === 'number'
      ? (item as any).stock_quantity
      : realStock;
    const hasActiveDisplayStock = effectiveStock > 0 || (pw.priority !== 'off' && Number(pw.virtualStockBonus) > 0);

    if (effectiveStock <= 0 && !hasActiveDisplayStock) {
      if (!oosEnabled) {
        // Hết hàng thật & không bật bù ngoại tuyến: ngắt toàn bộ tiến trình tăng theo giờ, bảo toàn tuyệt đối số lượng đã bán trước đó
        hourlyGrowth = 0;
        inHourProg = 0;
      } else {
        hourlyGrowth = Math.min(hourlyGrowth, oosMax);
        inHourProg = 0;
      }
    }

    let effectiveBaseTarget = effectiveRealSold + virtualBase;
    if (id && this.adminOverrideSoldMap.has(id)) {
      effectiveBaseTarget = Math.max(effectiveRealSold, this.adminOverrideSoldMap.get(id)!);
    }

    const calculatedBase = Math.max(0, effectiveBaseTarget + hourlyGrowth + inHourProg);

    // RÀNG BUỘC ĐƠN ĐIỆU TUYỆT ĐỐI (Monotonically Non-Decreasing):
    // Đảm bảo recordedMax không bao giờ nhỏ hơn mốc sàn tối thiểu (effectiveBaseTarget).
    // TUYỆT ĐỐI KHÔNG ép lùi recordedMax về calculatedBase khi số lượng đã bán tăng trưởng theo thông báo toast.
    if (effectiveBaseTarget > 0 && recordedMax < effectiveBaseTarget) {
      recordedMax = effectiveBaseTarget;
      if (id) {
        this.highWaterSoldCountMap.set(id, recordedMax);
        this.liveFomoSoldCountMap.set(id, Math.max(0, recordedMax - effectiveRealSold));
        this.saveHighWaterCounts();
        this.saveLiveFomoCounts();
      }
    }

    const finalDisplay = Math.max(calculatedBase, recordedMax);
    if (id && finalDisplay > recordedMax) {
      this.highWaterSoldCountMap.set(id, finalDisplay);
      this.saveHighWaterCounts();
    }
    if (id && !this.sessionAnchorMap.has(id)) {
      this.sessionAnchorMap.set(id, { lastCount: finalDisplay, lastTimestamp: this.getCalibratedNow() });
      this.saveSessionAnchor();
    }
    return finalDisplay;
  }

  public getClaimedDisplay(campaign: { id?: string; claimed_codes?: number; virtual_claimed_offset?: number; created_at?: string; createdAt?: string; fomo_anchor_time?: string; virtual_claimed_updated_at?: string; packages?: any[] } | null | undefined): number {
    if (!campaign) return 0;

    // NẾU LÀ CHIẾN DỊCH GOM NHÓM CÓ NHIỀU GÓI QUÀ (PACKAGES):
    // Tự động cộng tổng số lượng đã nhận của tất cả các gói quà lại hiển thị cho thẻ đại diện
    if (Array.isArray((campaign as any)?.packages) && (campaign as any).packages.length > 1) {
      const sumVariantClaimed = (campaign as any).packages.reduce((sum: number, pkg: any) => {
        const singlePkg = {
          ...pkg,
          packages: undefined,
          created_at: pkg.created_at || campaign.created_at || (campaign as any).createdAt,
          fomo_anchor_time: (pkg as any).fomo_anchor_time || (campaign as any).fomo_anchor_time,
        };
        return sum + this.getClaimedDisplay(singlePkg);
      }, 0);

      const id = campaign.id || '';
      const recordedMax = id ? (this.highWaterClaimedCountMap.get(id) || 0) : 0;
      const finalDisplay = Math.max(sumVariantClaimed, recordedMax);
      if (id && finalDisplay > recordedMax) {
        this.highWaterClaimedCountMap.set(id, finalDisplay);
        this.saveHighWaterCounts();
      }
      return finalDisplay;
    }

    const id = campaign.id || '';
    const details = id && (campaign.claimed_codes === undefined || campaign.virtual_claimed_offset === undefined) ? this.findGiveawayDetails(id) : null;

    const pw = this.getProductConfig(id);
    const realClaimed = Number(campaign.claimed_codes !== undefined ? campaign.claimed_codes : (details?.claimed_codes ?? 0)) || 0;
    const realFromHub = id ? (this.realGiveawayClaimedCountsMap.get(id) || 0) : 0;
    const effectiveRealClaimed = Math.max(realClaimed, realFromHub);

    let recordedMax = id ? (this.highWaterClaimedCountMap.get(id) || 0) : 0;
    const virtualBaseRaw = campaign.virtual_claimed_offset !== undefined ? campaign.virtual_claimed_offset : (details?.virtual_claimed_offset ?? 0);
    const virtualBase = Number(virtualBaseRaw || 0);

    // If priority is 'off' or virtualBase <= 0 (and no admin override):
    // Cho phép số đã nhận tăng 1 theo thông báo toast (recordedMax), chỉ thanh lọc nếu vượt quá đỉnh ma rác phi lý (+35)
    if (pw.priority === 'off' || (virtualBase <= 0 && (!id || !this.adminOverrideClaimedMap.has(id)))) {
      if (id && recordedMax > effectiveRealClaimed + 35) {
        recordedMax = effectiveRealClaimed;
        this.highWaterClaimedCountMap.set(id, effectiveRealClaimed);
        this.saveHighWaterCounts();
      }
      return Math.max(effectiveRealClaimed, recordedMax);
    }

    const anchorTime = (campaign as any)?.fomo_anchor_time || (campaign as any)?.virtual_claimed_updated_at || details?.fomo_anchor_time || details?.virtual_claimed_updated_at;
    const createdAt = campaign.created_at || campaign.createdAt || details?.created_at;
    let hourlyGrowth = this.getHourlyGrowth(id, createdAt, pw.priority, anchorTime);
    let inHourProg = this.getInHourProgression(id, createdAt, pw.priority, anchorTime);

    const realRemaining = this.getRealStockFor(id);
    const catchUp = this.config.offlineCatchUp || DEFAULT_OFFLINE_CATCHUP_CONFIG;
    const oosEnabled = Boolean(catchUp.outOfStockEnabled);
    const oosMax = Math.max(1, Math.min(30, Number(catchUp.outOfStockMaxUnits) || 10));
    const hasActiveDisplayStock = realRemaining > 0 || (pw.priority !== 'off' && Number(pw.virtualStockBonus) > 0);

    if (realRemaining <= 0 && !hasActiveDisplayStock) {
      if (!oosEnabled) {
        // Hết mã thật trong kho & không bật bù ngoại tuyến: ngắt tăng theo giờ, bảo toàn tuyệt đối số mã đã nhận
        hourlyGrowth = 0;
        inHourProg = 0;
      } else {
        hourlyGrowth = Math.min(hourlyGrowth, oosMax);
        inHourProg = 0;
      }
    }

    let effectiveBaseTarget = effectiveRealClaimed + virtualBase;
    if (id && this.adminOverrideClaimedMap.has(id)) {
      effectiveBaseTarget = Math.max(effectiveRealClaimed, this.adminOverrideClaimedMap.get(id)!);
    }

    const calculatedBase = Math.max(0, effectiveBaseTarget + hourlyGrowth + inHourProg);

    // RÀNG BUỘC ĐƠN ĐIỆU TUYỆT ĐỐI (Monotonically Non-Decreasing):
    // Đảm bảo recordedMax không bao giờ nhỏ hơn mốc sàn tối thiểu (effectiveBaseTarget).
    // TUYỆT ĐỐI KHÔNG ép lùi recordedMax về calculatedBase khi số lượng đã nhận tăng trưởng theo thông báo toast.
    if (effectiveBaseTarget > 0 && recordedMax < effectiveBaseTarget) {
      recordedMax = effectiveBaseTarget;
      if (id) {
        this.highWaterClaimedCountMap.set(id, recordedMax);
        this.liveFomoClaimedCountMap.set(id, Math.max(0, recordedMax - effectiveRealClaimed));
        this.saveHighWaterCounts();
        this.saveLiveFomoCounts();
      }
    }

    const finalDisplay = Math.max(calculatedBase, recordedMax);
    if (id && finalDisplay > recordedMax) {
      this.highWaterClaimedCountMap.set(id, finalDisplay);
      this.saveHighWaterCounts();
    }
    if (id && !this.sessionAnchorMap.has(id)) {
      this.sessionAnchorMap.set(id, { lastCount: finalDisplay, lastTimestamp: this.getCalibratedNow() });
      this.saveSessionAnchor();
    }
    return finalDisplay;
  }

  public syncProductVirtualSold(productId: string, virtualCount: number, forceReset: boolean = true, exactTargetDisplay?: number, anchorTime?: string): void {
    if (!productId) return;
    const count = Math.max(0, Number(virtualCount) || 0);
    this.liveFomoSoldCountMap.set(productId, count);
    this.saveLiveFomoCounts();

    const details = this.findItemDetails(productId);
    const realSold = Number(details?.sold_count) || 0;
    const realFromHub = this.realProductSoldCountsMap.get(productId) || 0;
    const effectiveRealSold = Math.max(realSold, realFromHub);
    const createdAt = details?.created_at;
    const anchor = anchorTime || details?.fomo_anchor_time || details?.virtual_sold_updated_at;
    const hourlyGrowth = this.getHourlyGrowth(productId, createdAt, undefined, anchor);
    const inHourProg = this.getInHourProgression(productId, createdAt, undefined, anchor);

    const calculatedBase = Math.max(0, effectiveRealSold + count + hourlyGrowth + inHourProg);
    const currentHigh = this.highWaterSoldCountMap.get(productId) || 0;

    let targetDisplay = 0;
    if (exactTargetDisplay !== undefined) {
      targetDisplay = Math.max(effectiveRealSold, exactTargetDisplay);
      this.adminOverrideSoldMap.set(productId, targetDisplay);
      this.saveAdminOverrides();
    } else {
      if (forceReset && count === 0) {
        this.adminOverrideSoldMap.delete(productId);
        this.saveAdminOverrides();
      }
      targetDisplay = forceReset ? calculatedBase : Math.max(calculatedBase, currentHigh);
    }

    this.highWaterSoldCountMap.set(productId, targetDisplay);
    this.liveFomoSoldCountMap.set(productId, targetDisplay);
    this.saveHighWaterCounts();
    this.saveLiveFomoCounts();

    if (forceReset) {
      const now = Date.now();
      this.sessionAnchorMap.set(productId, { lastCount: targetDisplay, lastTimestamp: now });
      this.saveSessionAnchor();
      this.lastReportedPeaks.sold[productId] = targetDisplay;

      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            type: 'FOMO_SOLD_RESET',
            payload: { productId, targetDisplay, virtualCount: count },
          });
        } catch {}
      }

      if (typeof window !== 'undefined') {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'report_peak_metrics',
            forceResetSold: true,
            peakSold: { [productId]: targetDisplay },
          }),
        }).catch(() => null);
      }
    }

    this.notifySoldCountChanged(productId, targetDisplay);
  }

  public syncGiveawayVirtualClaimed(campaignId: string, virtualCount: number, forceReset: boolean = true, exactTargetDisplay?: number, anchorTime?: string): void {
    if (!campaignId) return;
    const count = Math.max(0, Number(virtualCount) || 0);
    this.liveFomoClaimedCountMap.set(campaignId, count);
    this.saveLiveFomoCounts();

    const details = this.findGiveawayDetails(campaignId);
    const realClaimed = Number(details?.claimed_codes) || 0;
    const realFromHub = this.realGiveawayClaimedCountsMap.get(campaignId) || 0;
    const effectiveRealClaimed = Math.max(realClaimed, realFromHub);
    const createdAt = details?.created_at;
    const anchor = anchorTime || details?.fomo_anchor_time || details?.virtual_claimed_updated_at;
    const hourlyGrowth = this.getHourlyGrowth(campaignId, createdAt, undefined, anchor);
    const inHourProg = this.getInHourProgression(campaignId, createdAt, undefined, anchor);

    const calculatedBase = Math.max(0, effectiveRealClaimed + count + hourlyGrowth + inHourProg);
    const currentHigh = this.highWaterClaimedCountMap.get(campaignId) || 0;

    let targetDisplay = 0;
    if (exactTargetDisplay !== undefined) {
      targetDisplay = Math.max(effectiveRealClaimed, exactTargetDisplay);
      this.adminOverrideClaimedMap.set(campaignId, targetDisplay);
      this.saveAdminOverrides();
    } else {
      if (forceReset && count === 0) {
        this.adminOverrideClaimedMap.delete(campaignId);
        this.saveAdminOverrides();
      }
      targetDisplay = forceReset ? calculatedBase : Math.max(calculatedBase, currentHigh);
    }

    this.highWaterClaimedCountMap.set(campaignId, targetDisplay);
    this.liveFomoClaimedCountMap.set(campaignId, targetDisplay);
    this.saveHighWaterCounts();
    this.saveLiveFomoCounts();

    if (forceReset) {
      const now = Date.now();
      this.sessionAnchorMap.set(campaignId, { lastCount: targetDisplay, lastTimestamp: now });
      this.saveSessionAnchor();
      this.lastReportedPeaks.claimed[campaignId] = targetDisplay;

      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            type: 'FOMO_CLAIMED_RESET',
            payload: { campaignId, targetDisplay, virtualCount: count },
          });
        } catch {}
      }

      if (typeof window !== 'undefined') {
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'report_peak_metrics',
            forceResetClaimed: true,
            peakClaimed: { [campaignId]: targetDisplay },
          }),
        }).catch(() => null);
      }
    }

    this.notifySoldCountChanged(campaignId, targetDisplay);
  }

  public async updateItemVirtualSettings(
    id: string,
    options: {
      targetDisplaySoldOrClaimed?: number;
      virtualStockBonus?: number;
      priority?: ProductPriority;
      forceReset?: boolean;
      fomoAnchorTime?: string;
    }
  ): Promise<void> {
    if (!id) return;

    if (!this.config.productWeights) this.config.productWeights = {};
    const curPw = this.config.productWeights[id] || {
      priority: 'normal',
      virtualStockBonus: 20,
      autoRestockThreshold: 1,
      autoRestockAmount: 20,
    };

    const nextPriority = options.priority !== undefined ? options.priority : curPw.priority;
    const nextBonus = options.virtualStockBonus !== undefined ? Math.max(0, Number(options.virtualStockBonus) || 0) : curPw.virtualStockBonus;

    this.config.productWeights[id] = {
      ...curPw,
      priority: nextPriority,
      virtualStockBonus: nextBonus,
      targetDisplaySoldOrClaimed: options.targetDisplaySoldOrClaimed,
      virtualSold: options.targetDisplaySoldOrClaimed,
      virtualClaimed: options.targetDisplaySoldOrClaimed,
      lastUpdated: new Date().toISOString(),
    };

    const forceReset = options.forceReset === true;
    const anchorTime = options.fomoAnchorTime || new Date().toISOString();
    if (options.targetDisplaySoldOrClaimed !== undefined) {
      if (id.startsWith('gw_')) {
        this.syncGiveawayVirtualClaimed(id, 0, forceReset, options.targetDisplaySoldOrClaimed, anchorTime);
      } else {
        this.syncProductVirtualSold(id, 0, forceReset, options.targetDisplaySoldOrClaimed, anchorTime);
      }
    }

    const realStock = this.getRealStockFor(id);
    if (realStock <= 0) {
      this.liveVirtualStockMap.set(id, 0);
    } else if (nextPriority === 'off' || nextBonus <= 0) {
      this.liveVirtualStockMap.set(id, realStock);
    } else {
      this.liveVirtualStockMap.set(id, realStock + nextBonus);
    }
    this.saveLiveVirtualStock();

    const shouldResetStock = options.forceReset === true || options.virtualStockBonus !== undefined;
    if (shouldResetStock && typeof window !== 'undefined') {
      const targetStockVal = realStock <= 0 ? 0 : (nextBonus <= 0 ? realStock : realStock + nextBonus);
      const isGw = id.startsWith('gw_');
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'report_peak_metrics',
          forceResetStock: true,
          lowestStock: !isGw ? { [id]: targetStockVal } : undefined,
          lowestRemaining: isGw ? { [id]: targetStockVal } : undefined,
        }),
      }).catch(() => null);
    }

    await this.saveConfig(this.config);
    this.notifyStockChanged(id, this.getDisplayStock(id, realStock));
    this.notifySoldCountChanged(id, id.startsWith('gw_') ? this.getClaimedDisplay({ id }) : this.getSoldDisplay({ id }));
  }

  public async resetAllGiveawaysToReal(giveaways: Array<{ id: string; claimed_codes?: number; remaining_codes?: number }>): Promise<void> {
    if (!Array.isArray(giveaways) || giveaways.length === 0) return;
    if (!this.config.productWeights) this.config.productWeights = {};

    const peakClaimedUpdates: Record<string, number> = {};
    const lowestRemainingUpdates: Record<string, number> = {};

    giveaways.forEach((gw) => {
      const realClaimed = Math.max(0, Number(gw.claimed_codes) || 0);
      const realRemaining = Math.max(0, Number(gw.remaining_codes) || 0);

      this.config.productWeights[gw.id] = {
        priority: 'off',
        virtualStockBonus: 0,
        autoRestockThreshold: 1,
        autoRestockAmount: 0,
      };

      this.highWaterClaimedCountMap.set(gw.id, realClaimed);
      this.liveFomoClaimedCountMap.set(gw.id, 0);
      this.liveVirtualStockMap.set(gw.id, realRemaining);
      this.sessionAnchorMap.set(gw.id, { lastCount: realClaimed, lastTimestamp: Date.now() });
      this.adminOverrideClaimedMap.delete(gw.id);

      peakClaimedUpdates[gw.id] = realClaimed;
      lowestRemainingUpdates[gw.id] = realRemaining;
    });

    this.saveAdminOverrides();
    this.saveHighWaterCounts();
    this.saveLiveFomoCounts();
    this.saveLiveVirtualStock();
    this.saveSessionAnchor();

    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'report_peak_metrics',
            forceResetClaimed: true,
            forceResetStock: true,
            peakClaimed: peakClaimedUpdates,
            lowestRemaining: lowestRemainingUpdates,
          }),
        });
      } catch {}
    }

    await this.saveConfig(this.config);
    giveaways.forEach((gw) => {
      this.notifyStockChanged(gw.id, Number(gw.remaining_codes) || 0);
      this.notifySoldCountChanged(gw.id, Number(gw.claimed_codes) || 0);
    });
  }

  public incrementLiveSoldCount(productId: string, amount: number = 1, notifId?: string): number {
    if (!productId) return 0;

    // Check hàng thật: Nếu hết hàng thật và không phải do thông báo toast kích hoạt, ngắt tăng đơn ảo
    const realStock = this.getRealStockFor(productId);
    if (!notifId && realStock <= 0) {
      return this.getSoldDisplay({ id: productId });
    }

    if (notifId) {
      const soldNotifKey = notifId.startsWith('sold_') ? notifId : `sold_${notifId}`;
      if (this.processedStockNotifIds.has(soldNotifKey)) {
        return this.getSoldDisplay({ id: productId });
      }
      this.processedStockNotifIds.add(soldNotifKey);
    }

    const inc = Math.max(1, amount || 1);
    const currentSold = this.getSoldDisplay({ id: productId });
    const nextSold = currentSold + inc;
    this.highWaterSoldCountMap.set(productId, nextSold);
    this.saveHighWaterCounts();

    this.updateSessionAnchor(productId, nextSold);
    this.notifySoldCountChanged(productId, nextSold);
    this.schedulePeakReport();

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'FOMO_SOLD_INCREMENT',
          payload: { productId, totalFomoSold: nextSold, notifId },
        });
      } catch {}
    }

    return nextSold;
  }

  public incrementLiveClaimedCount(campaignId: string, amount: number = 1, notifId?: string): number {
    if (!campaignId) return 0;

    // Check mã thật: Nếu hết mã thật và không phải do thông báo toast kích hoạt, ngắt tăng đơn ảo
    const realRemaining = this.getRealStockFor(campaignId);
    if (!notifId && realRemaining <= 0) {
      return this.getClaimedDisplay({ id: campaignId });
    }

    if (notifId) {
      const gwNotifKey = notifId.startsWith('gw_') ? notifId : `gw_${notifId}`;
      if (this.processedStockNotifIds.has(gwNotifKey)) {
        return this.getClaimedDisplay({ id: campaignId });
      }
      this.processedStockNotifIds.add(gwNotifKey);
    }

    const inc = Math.max(1, amount || 1);
    const currentClaimed = this.getClaimedDisplay({ id: campaignId });
    const nextClaimed = currentClaimed + inc;
    this.highWaterClaimedCountMap.set(campaignId, nextClaimed);
    this.saveHighWaterCounts();

    this.updateSessionAnchor(campaignId, nextClaimed);
    this.notifySoldCountChanged(campaignId, nextClaimed);
    this.schedulePeakReport();

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'FOMO_CLAIMED_INCREMENT',
          payload: { campaignId, totalFomoClaimed: nextClaimed, notifId },
        });
      } catch {}
    }

    return nextClaimed;
  }

  public getLiveFomoSoldCount(productId: string): number {
    return this.getSoldDisplay({ id: productId });
  }

  public getLiveFomoClaimedCount(campaignId: string): number {
    return this.getClaimedDisplay({ id: campaignId });
  }

  public notifySoldCountChanged(id: string, count: number): void {
    this.soldCountListeners.forEach((cb) => {
      try { cb(id, count); } catch {}
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wcg_sold_count_updated', { detail: { id, count } }));
    }
  }

  public subscribeSoldCountChange(callback: (id: string, count: number) => void): () => void {
    this.soldCountListeners.add(callback);
    return () => this.soldCountListeners.delete(callback);
  }

  public getRandomVirtualAccount(rng?: () => number): string {
    const accounts = Array.isArray(this.config.virtualAccounts) && this.config.virtualAccounts.length > 0
      ? this.config.virtualAccounts
      : PRESET_VIRTUAL_ACCOUNTS;

    // Filter out accounts in recent memory ring buffer
    const bufferSet = new Set(this.recentAccountsRingBuffer);
    let available = accounts.filter((acc) => !bufferSet.has(acc));

    // If pool drops below dynamic threshold, trim the oldest buffer entries
    const minThreshold = Math.max(5, Math.floor(accounts.length * 0.2));
    if (available.length < minThreshold) {
      this.recentAccountsRingBuffer = this.recentAccountsRingBuffer.slice(-minThreshold);
      const updatedSet = new Set(this.recentAccountsRingBuffer);
      available = accounts.filter((acc) => !updatedSet.has(acc));
    }

    const randFn = typeof rng === 'function' ? rng : Math.random;
    const picked = available.length > 0
      ? available[Math.floor(randFn() * available.length)]
      : accounts[Math.floor(randFn() * accounts.length)];

    this.recentAccountsRingBuffer.push(picked);
    const dynamicLimit = Math.min(45, Math.max(10, Math.floor(accounts.length * 0.5)));
    if (this.recentAccountsRingBuffer.length > dynamicLimit) {
      this.recentAccountsRingBuffer.shift();
    }

    return picked;
  }

  /**
   * Deterministic Permutation Shuffle Deck:
   * Phân bổ đồng đều 100% tài khoản trong danh sách cài đặt Admin.
   * Trong mỗi vòng lặp (vòng = số lượng tài khoản, ví dụ 90 slots):
   * - TOÀN BỘ 90 TÀI KHOẢN đều xuất hiện ĐÚNG 1 LẦN, không sót bất kỳ ai.
   * - TUYỆT ĐỐI KHÔNG TRÙNG LẶP tên trong 90 thông báo liên tiếp.
   * - Đồng bộ tuyệt đối giữa mọi thiết bị & trình duyệt theo slotIndex UTC.
   */
  public getDeterministicAccountIndex(slotIndex: number, totalCount: number): number {
    if (totalCount <= 1) return 0;
    const round = Math.floor(slotIndex / totalCount);
    const pos = ((slotIndex % totalCount) + totalCount) % totalCount;

    if (this.cachedRound !== round || this.cachedRoundCount !== totalCount) {
      this.cachedRound = round;
      this.cachedRoundCount = totalCount;
      const roundSeed = (Math.imul(round, 0x9e3779b9) ^ 0x65ac932f) >>> 0;
      const roundRng = createPRNG(roundSeed);
      const indices = Array.from({ length: totalCount }, (_, i) => i);
      // Fisher-Yates permutation
      for (let i = totalCount - 1; i > 0; i--) {
        const j = Math.floor(roundRng() * (i + 1));
        const tmp = indices[i];
        indices[i] = indices[j];
        indices[j] = tmp;
      }

      // Xử lý giáp ranh giữa 2 vòng để tránh tên cuối vòng trước trùng tên đầu vòng sau
      if (round > 0 && totalCount > 1) {
        const prevSeed = (Math.imul(round - 1, 0x9e3779b9) ^ 0x65ac932f) >>> 0;
        const prevRng = createPRNG(prevSeed);
        const prevIndices = Array.from({ length: totalCount }, (_, i) => i);
        for (let i = totalCount - 1; i > 0; i--) {
          const j = Math.floor(prevRng() * (i + 1));
          const tmp = prevIndices[i];
          prevIndices[i] = prevIndices[j];
          prevIndices[j] = tmp;
        }
        if (indices[0] === prevIndices[totalCount - 1]) {
          const swapTarget = Math.min(1, totalCount - 1);
          const tmp = indices[0];
          indices[0] = indices[swapTarget];
          indices[swapTarget] = tmp;
        }
      }
      this.cachedRoundIndices = indices;
    }

    return this.cachedRoundIndices[pos];
  }

  public notifyStockChanged(productId: string, newStock: number): void {
    this.stockListeners.forEach((cb) => {
      try { cb(productId, newStock); } catch {}
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wcg_virtual_stock_updated', { detail: { productId, stock: newStock } }));
    }
  }

  public subscribeStockChange(callback: (productId: string, newStock: number) => void): () => void {
    this.stockListeners.add(callback);
    return () => this.stockListeners.delete(callback);
  }

  // --- Time Ago & Random Delay Engine ---
  public formatTimeAgo(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    if (s < 5) return 'vừa xong';
    if (s < 60) return `${s}s trước`;
    const minutes = Math.floor(s / 60);
    return `${minutes} phút trước`;
  }

  public getRandomTimeAgo(rngOrRandom?: () => number): string {
    const tac = this.config.timeAgoConfig;
    if (tac?.enabled === false) return 'vừa xong';
    const maxSec = Math.min(600, Math.max(5, tac?.maxDelaySeconds ?? 30));
    const rand = typeof rngOrRandom === 'function' ? rngOrRandom() : Math.random();
    const delaySec = Math.floor(rand * (maxSec + 1));
    return this.formatTimeAgo(delaySec);
  }

  private extractNameOrEmail(u: any): string | null {
    if (!u || typeof u !== 'object') return null;

    const displayName = typeof u.displayName === 'string' ? u.displayName.trim() : '';
    const fullName = typeof u.full_name === 'string' ? u.full_name.trim() : '';
    const username = typeof u.username === 'string' ? u.username.trim() : '';
    const name = typeof u.name === 'string' ? u.name.trim() : '';
    const email = typeof u.email === 'string' ? u.email.trim() : '';
    const phone = typeof u.phone === 'string' ? u.phone.trim() : '';

    // 1. Prioritize real display name / full name / username (if not an auto-id)
    if (displayName && !displayName.includes('@') && !displayName.startsWith('usr_')) {
      return displayName;
    }
    if (fullName && !fullName.includes('@') && !fullName.startsWith('usr_')) {
      return fullName;
    }
    if (username && !username.includes('@') && !username.startsWith('usr_')) {
      return username;
    }
    if (name && !name.includes('@') && !name.startsWith('usr_')) {
      return name;
    }

    // 2. Fallback to Email if name is not available
    if (email && email.includes('@')) {
      return email;
    }

    // 3. Fallback to Phone
    if (phone) {
      return phone;
    }

    // 4. Any name present even if it has @ or generic
    if (displayName) return displayName;
    if (username) return username;

    return null;
  }

  public resolveUserName(userOrName?: UserProfile | string | null): string {
    // 1. Explicit string passed
    if (typeof userOrName === 'string' && userOrName.trim()) {
      return userOrName.trim();
    }

    // 2. UserProfile object passed directly
    if (userOrName && typeof userOrName === 'object') {
      const resolved = this.extractNameOrEmail(userOrName);
      if (resolved) return resolved;
    }

    // 3. Fallback: check logged in user from all known localStorage & sessionStorage keys
    if (typeof window !== 'undefined') {
      try {
        const userKeys = ['wcg_user', 'wcg_current_user', 'wcg_auth_user'];
        for (const key of userKeys) {
          const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object') {
                const resolved = this.extractNameOrEmail(parsed);
                if (resolved) return resolved;
              }
            } catch {}
          }
        }
      } catch {}
    }

    // 4. Guest user identifier (authentic & stable for this browser session)
    if (typeof window !== 'undefined') {
      try {
        let guestAlias = localStorage.getItem('wcg_client_guest_name');
        if (!guestAlias) {
          const guestNum = Math.floor(1000 + Math.random() * 9000);
          guestAlias = `Khách #${guestNum}`;
          localStorage.setItem('wcg_client_guest_name', guestAlias);
        }
        return guestAlias;
      } catch {}
    }
    return 'Khách vãng lai';
  }

  // --- Real Event Queue ---
  public hasPendingRealEvent(): boolean {
    return this.peekRealEvent() !== null;
  }

  public peekRealEvent(): MarketingNotification | null {
    while (this.recentRealEvents.length > 0) {
      const evt = this.recentRealEvents[0];
      if (evt && this.isTypeEnabled(evt.type, evt.itemType)) {
        return evt;
      }
      this.recentRealEvents.shift(); // remove disabled or invalid event
    }
    return null;
  }

  public popRealEvent(): MarketingNotification | null {
    while (this.recentRealEvents.length > 0) {
      const evt = this.recentRealEvents.shift();
      if (evt && this.isTypeEnabled(evt.type, evt.itemType)) {
        return evt;
      }
    }
    return null;
  }

  public getEventPriority(evt: MarketingNotification): number {
    if (!evt) return 0;
    if (evt.type === 'BUY_PRODUCT') return 3;
    if (evt.type === 'CLAIM_GIVEAWAY') return 2;
    if (evt.type === 'DEPOSIT_WALLET') return 2;
    if (evt.type === 'COPY_CODE') return 1;
    return 0;
  }

  public sortAndPruneRealEventQueue(): void {
    // 1. Sort by scheduledFireTime ascending so the earliest scheduled to fire is at index 0.
    // If fire times are within 1 second of each other, break tie with priority.
    this.recentRealEvents.sort((a, b) => {
      const fA = Number(a.scheduledFireTime) || Number(a.timestamp) || 0;
      const fB = Number(b.scheduledFireTime) || Number(b.timestamp) || 0;
      if (Math.abs(fA - fB) >= 1000) return fA - fB;
      const pA = this.getEventPriority(a);
      const pB = this.getEventPriority(b);
      return pB - pA;
    });

    // 2. Anti-spam filter: keep at most 2 COPY_CODE events in visual queue, deduplicating by game
    const seenGames = new Set<string>();
    this.recentRealEvents = this.recentRealEvents.filter((evt) => {
      if (evt.type === 'COPY_CODE') {
        const gameKey = evt.gameSlug || evt.gameName || 'default';
        if (seenGames.has(gameKey)) return false;
        seenGames.add(gameKey);
        return true;
      }
      return true;
    });

    // 3. Keep visual queue compact (at most 15 real events)
    if (this.recentRealEvents.length > 15) {
      this.recentRealEvents = this.recentRealEvents.slice(0, 15);
    }
  }

  public pushRealEvent(
    event: MarketingNotification,
    shouldBroadcast: boolean = true,
    notifyImmediately: boolean = false
  ): void {
    if (!event || !event.id) return;
    const isTest = Boolean(event.id && event.id.startsWith('test_'));
    if (!isTest && (!this.config.isEnabled || !this.isTypeEnabled(event.type, event.itemType))) return;

    // Persistent deduplication check
    if (this.isNotificationProcessed(event.id)) return;

    // Ensure name & message are masked according to config
    event = this.sanitizeNotificationMasking(event);

    if (event.type === 'STATS_COPY') {
      event.timeAgo = 'vừa xong';
    } else if (!event.timeAgo || event.timeAgo === 'vừa xong') {
      event.timeAgo = this.getRandomTimeAgo();
    }

    if (notifyImmediately) {
      this.markNotificationProcessed(event.id);
      this.notificationListeners.forEach((cb) => {
        try { cb(event); } catch {}
      });
    } else {
      // Add to pending real events queue if not duplicate
      if (!this.recentRealEvents.some((e) => e && e.id === event.id)) {
        this.recentRealEvents.unshift(event);
        this.sortAndPruneRealEventQueue();
      }
    }

    // Broadcast across same-machine tabs via BroadcastChannel
    if (shouldBroadcast && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'REAL_EVENT_BROADCAST',
          payload: event,
        });
      } catch {}
    }
  }

  private handleIncomingRealEvent(event: MarketingNotification, shouldBroadcast: boolean = false): void {
    if (!event || !this.config.isEnabled || !this.isTypeEnabled(event.type, event.itemType)) return;
    event = this.sanitizeNotificationMasking(event);
    this.pushRealEvent(event, shouldBroadcast, false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wcg_new_real_events_available'));
    }
  }

  private schedulePushRealEvent(event: MarketingNotification | null, copyIncrement: number = 0): void {
    if (typeof window === 'undefined') return;

    if (copyIncrement > 0) {
      this.pendingCopyIncrement += copyIncrement;
    }

    if (event && event.type === 'COPY_CODE') {
      this.pendingCopyEvent = event;
      const now = Date.now();
      const elapsed = now - this.lastCopyPushTime;

      if (elapsed >= this.COPY_PUSH_COOLDOWN_MS) {
        this.flushPendingCopyPush();
      } else if (!this.copyPushTimer) {
        this.copyPushTimer = setTimeout(() => {
          this.flushPendingCopyPush();
        }, this.COPY_PUSH_COOLDOWN_MS - elapsed);
      }
    } else if (event) {
      // Non-copy events (BUY_PRODUCT, DEPOSIT_WALLET, CLAIM_GIVEAWAY) are high priority: flush immediately!
      this.sendPushToEdge(event, this.pendingCopyIncrement);
      this.pendingCopyIncrement = 0;
      this.pendingCopyEvent = null;
      this.lastCopyPushTime = Date.now();
    } else if (this.pendingCopyIncrement > 0) {
      this.flushPendingCopyPush();
    }
  }

  private flushPendingCopyPush(): void {
    if (this.copyPushTimer) {
      clearTimeout(this.copyPushTimer);
      this.copyPushTimer = null;
    }
    const evt = this.pendingCopyEvent;
    const inc = this.pendingCopyIncrement;
    this.pendingCopyEvent = null;
    this.pendingCopyIncrement = 0;
    this.lastCopyPushTime = Date.now();

    if (evt || inc > 0) {
      this.sendPushToEdge(evt, inc);
    }
  }

  private async sendPushToEdge(event: MarketingNotification | null, copyIncrement: number): Promise<void> {
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'push_real_event',
          event: event || undefined,
          copyIncrement: copyIncrement > 0 ? copyIncrement : undefined,
          cooldownSec: Math.max(5, Number(this.config.realUserCooldownSec) || 20),
        }),
      });
      if (res.ok) {
        const data: any = await res.json().catch(() => null);
        if (data && data.success) {
          if (typeof data.server_time === 'number') {
            this.calibrateServerTime(data.server_time);
          }
          if (data.event && data.event.id && data.event.scheduledFireTime) {
            const match = this.recentRealEvents.find((e) => e && e.id === data.event.id);
            if (match) {
              match.scheduledFireTime = data.event.scheduledFireTime;
              this.sortAndPruneRealEventQueue();
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('wcg_new_real_events_available'));
              }
            }
            if (this.broadcastChannel) {
              try {
                this.broadcastChannel.postMessage({
                  type: 'REAL_EVENT_SCHEDULED',
                  payload: data.event,
                });
              } catch {}
            }
          }
        }
      }
    } catch {}
  }

  public syncFromHub(
    serverEvents?: MarketingNotification[],
    masterCopyClicks?: number,
    realProductSoldCounts?: Record<string, number>,
    realGiveawayClaimedCounts?: Record<string, number>,
    masterCopyClicksDate?: string,
    peakProductSoldCounts?: Record<string, number>,
    peakGiveawayClaimedCounts?: Record<string, number>,
    lowestProductStock?: Record<string, number>,
    lowestGiveawayRemaining?: Record<string, number>
  ): void {
    this.initialSyncCompleted = true;
    const today = this.getTodayDateKey();
    if (this.currentClickDate && this.currentClickDate !== today) {
      this.masterCopyClicks = 0;
      this.currentClickDate = today;
      this.saveMasterCopyClicks();
    }
    const isDateValid = !masterCopyClicksDate || masterCopyClicksDate === today;
    if (isDateValid && typeof masterCopyClicks === 'number' && !isNaN(masterCopyClicks)) {
      if (masterCopyClicks > this.masterCopyClicks) {
        this.masterCopyClicks = masterCopyClicks;
        this.realClicksOffset = masterCopyClicks;
        this.saveMasterCopyClicks();
        this.broadcastCurrentCount();
      }
    }
    if (realProductSoldCounts && typeof realProductSoldCounts === 'object') {
      let changed = false;
      Object.entries(realProductSoldCounts).forEach(([k, v]) => {
        if (typeof v === 'number' && this.realProductSoldCountsMap.get(k) !== v) {
          this.realProductSoldCountsMap.set(k, v);
          changed = true;
        }
      });
      if (changed) this.notifySoldCountChanged('*', 0);
    }
    if (realGiveawayClaimedCounts && typeof realGiveawayClaimedCounts === 'object') {
      let changed = false;
      Object.entries(realGiveawayClaimedCounts).forEach(([k, v]) => {
        if (typeof v === 'number' && this.realGiveawayClaimedCountsMap.get(k) !== v) {
          this.realGiveawayClaimedCountsMap.set(k, v);
          changed = true;
        }
      });
      if (changed) this.notifySoldCountChanged('*', 0);
    }

    // Synchronize peak sold counts from Hub across all devices instantly (3s)
    if (peakProductSoldCounts && typeof peakProductSoldCounts === 'object') {
      let peakSoldChanged = false;
      const oosEnabled = Boolean(this.config.offlineCatchUp?.outOfStockEnabled);
      Object.entries(peakProductSoldCounts).forEach(([k, v]) => {
        if (typeof v === 'number' && !isNaN(v) && v > 0) {
          const realStock = this.getRealStockFor(k);
          const details = this.findItemDetails(k);
          const hasVirtual = Number(details?.virtual_sold_count || 0) > 0;
          if (realStock <= 0 && !oosEnabled && !hasVirtual) return;
          const cur = this.highWaterSoldCountMap.get(k) || 0;
          if (v > cur) {
            this.highWaterSoldCountMap.set(k, v);
            this.liveFomoSoldCountMap.set(k, v);
            peakSoldChanged = true;
          }
        }
      });
      if (peakSoldChanged) {
        this.saveHighWaterCounts();
        this.saveLiveFomoCounts();
        this.notifySoldCountChanged('*', 0);
      }
    }

    // Synchronize peak claimed counts from Hub across all devices instantly (3s)
    if (peakGiveawayClaimedCounts && typeof peakGiveawayClaimedCounts === 'object') {
      let peakClaimedChanged = false;
      const oosEnabled = Boolean(this.config.offlineCatchUp?.outOfStockEnabled);
      Object.entries(peakGiveawayClaimedCounts).forEach(([k, v]) => {
        if (typeof v === 'number' && !isNaN(v) && v > 0) {
          const realRemaining = this.getRealStockFor(k);
          const details = this.findGiveawayDetails(k);
          const hasVirtual = Number(details?.virtual_claimed_offset || 0) > 0;
          if (realRemaining <= 0 && !oosEnabled && !hasVirtual) return;
          const cur = this.highWaterClaimedCountMap.get(k) || 0;
          if (v > cur) {
            this.highWaterClaimedCountMap.set(k, v);
            this.liveFomoClaimedCountMap.set(k, v);
            peakClaimedChanged = true;
          }
        }
      });
      if (peakClaimedChanged) {
        this.saveHighWaterCounts();
        this.saveLiveFomoCounts();
        this.notifySoldCountChanged('*', 0);
      }
    }

    // Synchronize lowest stock for products from Hub across all devices instantly (3s)
    if (lowestProductStock && typeof lowestProductStock === 'object') {
      let stockChanged = false;
      const nowMs = Date.now();
      Object.entries(lowestProductStock).forEach(([k, v]) => {
        let val = Number(v);
        if (!isNaN(val) && val > 0) {
          const pw = this.getProductConfig(k);
          const baseStock = Math.max(0, Number(this.getRealStockFor(k)) || 0);
          const rawThreshold = Math.max(1, Number(pw.autoRestockThreshold) || 1);
          const restockAmount = Math.max(1, Number(pw.autoRestockAmount) || 20);
          const effectiveThreshold = (baseStock > 0 && rawThreshold < baseStock)
            ? baseStock
            : rawThreshold;

          // Nếu cấu hình có kho ảo và hàng thật còn, nhưng giá trị nhận về <= effectiveThreshold:
          // Đây là tồn kho đã chạm đáy cần bù kho!
          if (pw.priority !== 'off' && pw.virtualStockBonus && pw.virtualStockBonus > 0 && baseStock > 0 && val <= effectiveThreshold) {
            val = effectiveThreshold + restockAmount;
          }

          const cur = this.liveVirtualStockMap.get(k);
          const restockTime = this.recentRestockTimestampsMap.get(k) || 0;
          const isUnderRestockProtection = (nowMs - restockTime) < 60000;

          // Nếu máy này vừa bù kho trong vòng 60s, không để packet trễ từ server kéo tụt số hiển thị về số cũ
          if (isUnderRestockProtection && cur !== undefined && val < cur) {
            return;
          }

          const isRestockJump = cur !== undefined && val > cur;
          if (cur === undefined || val < cur || isRestockJump) {
            if (isRestockJump) {
              this.recentRestockTimestampsMap.set(k, nowMs);
            }
            this.liveVirtualStockMap.set(k, val);
            stockChanged = true;
          }
        }
      });
      if (stockChanged) {
        this.saveLiveVirtualStock();
        this.notifyStockChanged('*', 0);
      }
    }

    // Synchronize lowest giveaway remaining from Hub across all devices instantly (3s)
    if (lowestGiveawayRemaining && typeof lowestGiveawayRemaining === 'object') {
      let gwStockChanged = false;
      const nowMs = Date.now();
      Object.entries(lowestGiveawayRemaining).forEach(([k, v]) => {
        let val = Number(v);
        if (!isNaN(val) && val > 0) {
          const pw = this.getProductConfig(k);
          const baseRemaining = Math.max(0, Number(this.getRealStockFor(k)) || 0);
          const rawThreshold = Math.max(1, Number(pw.autoRestockThreshold) || 1);
          const restockAmount = Math.max(1, Number(pw.autoRestockAmount) || 20);
          const effectiveThreshold = (baseRemaining > 0 && rawThreshold < baseRemaining)
            ? baseRemaining
            : rawThreshold;

          if (pw.priority !== 'off' && pw.virtualStockBonus && pw.virtualStockBonus > 0 && baseRemaining > 0 && val <= effectiveThreshold) {
            val = effectiveThreshold + restockAmount;
          }

          const cur = this.liveVirtualStockMap.get(k);
          const restockTime = this.recentRestockTimestampsMap.get(k) || 0;
          const isUnderRestockProtection = (nowMs - restockTime) < 60000;

          // Nếu máy này vừa bù kho trong vòng 60s, không để packet trễ từ server kéo tụt số hiển thị về số cũ
          if (isUnderRestockProtection && cur !== undefined && val < cur) {
            return;
          }

          const isRestockJump = cur !== undefined && val > cur;
          if (cur === undefined || val < cur || isRestockJump) {
            if (isRestockJump) {
              this.recentRestockTimestampsMap.set(k, nowMs);
            }
            this.liveVirtualStockMap.set(k, val);
            gwStockChanged = true;
          }
        }
      });
      if (gwStockChanged) {
        this.saveLiveVirtualStock();
        this.notifyStockChanged('*', 0);
      }
    }

    if (Array.isArray(serverEvents) && serverEvents.length > 0) {
      const TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for real events

      let deletedStoreSet = new Set<string>();
      let deletedUtilSet = new Set<string>();
      let deletedGwSet = new Set<string>();
      try {
        if (typeof window !== 'undefined') {
          const rawDelSp = localStorage.getItem('wcg_deleted_store_products');
          if (rawDelSp) {
            const parsed = JSON.parse(rawDelSp);
            if (Array.isArray(parsed)) deletedStoreSet = new Set(parsed);
          }
          const rawDelUt = localStorage.getItem('wcg_deleted_utilities');
          if (rawDelUt) {
            const parsed = JSON.parse(rawDelUt);
            if (Array.isArray(parsed)) deletedUtilSet = new Set(parsed);
          }
          const rawDelGw = localStorage.getItem('wcg_deleted_giveaways');
          if (rawDelGw) {
            const parsed = JSON.parse(rawDelGw);
            if (Array.isArray(parsed)) deletedGwSet = new Set(parsed);
          }
        }
      } catch {}

      // Process from earliest scheduled fire time to latest
      const sorted = [...serverEvents].sort(
        (a, b) => (Number(a.scheduledFireTime || a.timestamp || 0)) - (Number(b.scheduledFireTime || b.timestamp || 0))
      );
      let newEventsAdded = false;
      const calibratedNow = this.getCalibratedNow();

      sorted.forEach((evt) => {
        if (!evt || !evt.id || this.isNotificationProcessed(evt.id)) return;

        const fireTime = Number(evt.scheduledFireTime) || Number(evt.timestamp) || calibratedNow;

        // TTL check: discard events older than 5 mins
        if (calibratedNow - fireTime > TTL_MS) return;

        // PAST EVENTS CHECK: Cho phép hiển thị các sự kiện thật vừa diễn ra trong vòng 60 giây gần đây
        // ngay cả khi người dùng vừa mới tải lại trang hoặc mở trình duyệt mới, để giữ hiệu ứng FOMO sôi động.
        // Chỉ loại bỏ các sự kiện đã diễn ra hơn 60 giây trước khi phiên web hiện tại bắt đầu.
        if (fireTime + 60000 <= this.sessionStartTime) {
          this.markNotificationProcessed(evt.id);
          return;
        }

        // Deleted check: discard deleted products/giveaways
        if (evt.type === 'BUY_PRODUCT' && evt.productId) {
          if (deletedStoreSet.has(evt.productId) || deletedUtilSet.has(evt.productId)) {
            this.markNotificationProcessed(evt.id);
            return;
          }
        }
        if (evt.type === 'CLAIM_GIVEAWAY' && evt.giveawayId) {
          if (deletedGwSet.has(evt.giveawayId)) {
            this.markNotificationProcessed(evt.id);
            return;
          }
        }

        // Semantic deduplication: ignore if same product/giveaway action within realUserCooldownSec window
        const targetId = evt.productId || evt.giveawayId || evt.gameSlug || '';
        const cdMs = Math.max(5, Number(this.config.realUserCooldownSec) || 20) * 1000;
        if (targetId) {
          const isDuplicateAction = this.recentRealEvents.some((r) => {
            if (!r) return false;
            const rTarget = r.productId || r.giveawayId || r.gameSlug || '';
            const rTime = Number(r.scheduledFireTime) || Number(r.timestamp) || 0;
            return r.type === evt.type && rTarget === targetId && Math.abs(rTime - fireTime) < cdMs;
          });
          if (isDuplicateAction) {
            this.markNotificationProcessed(evt.id);
            return;
          }
        }

        evt.scheduledFireTime = fireTime;
        evt.isRealUser = true;
        if (!evt.timeAgo || evt.timeAgo.includes('trước')) {
          evt.timeAgo = 'vừa xong';
        }

        // Ensure name and message are masked if config.isNameMasked is active
        evt = this.sanitizeNotificationMasking(evt);

        const existing = this.recentRealEvents.find((e) => e && e.id === evt.id);
        if (!existing) {
          this.recentRealEvents.push(evt);
          newEventsAdded = true;
        } else {
          existing.scheduledFireTime = fireTime;
          existing.isRealUser = true;
          existing.userName = evt.userName;
          existing.message = evt.message;
        }
      });

      if (newEventsAdded) {
        this.sortAndPruneRealEventQueue();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('wcg_new_real_events_available'));
        }
      }
    }
  }

  public recordRealCopy(
    gameName: string,
    gameSlug: string = '',
    count: number = 1,
    userOrName?: UserProfile | string | null
  ): void {
    const rawName = this.resolveUserName(userOrName);
    const masked = this.maskName(rawName);

    // 1. Luôn tăng bộ đếm số lượt sao chép
    this.incrementLiveCounter(count);

    const now = this.getCalibratedNow();
    // 2. Giới hạn thông báo: Chỉ thông báo lần đầu trong khoảng CD (mặc định 20s) đối với việc sao chép code
    const cdSec = Math.max(5, Number(this.config.realUserCooldownSec) || 20);
    const cooldownMs = cdSec * 1000;
    const shouldShowToast = (now - this.lastRealCopyToastTime) >= cooldownMs;

    let event: MarketingNotification | null = null;
    if (shouldShowToast) {
      this.lastRealCopyToastTime = now;
      event = {
        id: `copy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'COPY_CODE',
        title: 'Sao chép mã Giftcode',
        message: `${masked} vừa sao chép ${count > 1 ? `tất cả ${count}` : '1'} mã code cho ${gameName}`,
        timeAgo: 'vừa xong',
        userName: masked,
        gameName,
        gameSlug,
        isRealUser: true,
        timestamp: now,
        scheduledFireTime: now,
      };
      (event as any).localOrigin = true;

      // Nổ luôn lập tức trên màn hình người bấm (0s delay!)
      this.pushRealEvent(event, true, true);
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'COPY_INCREMENT_BROADCAST',
          payload: { date: this.getTodayDateKey(), totalRealClicks: this.masterCopyClicks },
        });
      } catch {}
    }

    this.schedulePushRealEvent(event, count);
  }

  public recordRealOrder(
    productTitle: string,
    productId: string,
    price: number,
    itemType: 'store' | 'utility' = 'store',
    userOrName?: UserProfile | string | null,
    quantity: number = 1
  ): void {
    const rawName = this.resolveUserName(userOrName);
    const masked = this.maskName(rawName);

    const now = this.getCalibratedNow();
    const qty = Math.max(1, quantity || 1);
    const event: MarketingNotification = {
      id: `buy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'BUY_PRODUCT',
      title: itemType === 'utility' ? 'Đơn hàng tiện ích' : 'Mua hàng thành công',
      message: `${masked} vừa mua thành công ${qty > 1 ? `${qty}x ` : ''}${productTitle}`,
      timeAgo: 'vừa xong',
      userName: masked,
      productId,
      productName: productTitle,
      productPrice: price,
      itemType,
      isRealUser: true,
      timestamp: now,
      scheduledFireTime: now,
    };
    (event as any).localOrigin = true;

    const currentSold = (this.realProductSoldCountsMap.get(productId) || 0) + qty;
    this.realProductSoldCountsMap.set(productId, currentSold);

    // Đồng bộ nguyên tử 1 - 1: Giảm tồn kho hiển thị và tăng số đã bán (bảo toàn vĩnh viễn, không bị hồi số)
    this.decrementProductStock(productId, qty, event.id);
    this.incrementLiveSoldCount(productId, qty, event.id);

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'STATS_SYNC_BROADCAST',
          payload: { productId, totalSold: currentSold },
        });
      } catch {}
    }

    // Nổ luôn lập tức trên màn hình người bấm (0s delay!)
    this.pushRealEvent(event, true, true);
    this.schedulePushRealEvent(event, 0);
  }

  public recordRealDeposit(amount: number, userOrName?: UserProfile | string | null): void {
    const rawName = this.resolveUserName(userOrName);
    const masked = this.maskName(rawName);

    const now = this.getCalibratedNow();
    const event: MarketingNotification = {
      id: `dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'DEPOSIT_WALLET',
      title: 'Nạp tiền vào ví',
      message: `${masked} vừa nạp thành công ${amount.toLocaleString('vi-VN')}đ qua SePay`,
      timeAgo: 'vừa xong',
      userName: masked,
      depositAmount: amount,
      isRealUser: true,
      timestamp: now,
      scheduledFireTime: now,
    };

    // Nổ luôn lập tức trên màn hình người bấm (0s delay!)
    this.pushRealEvent(event, true, true);
    this.schedulePushRealEvent(event, 0);
  }

  public recordRealGiveawayClaim(
    campaignTitle: string,
    campaignId: string,
    gameName?: string,
    gameSlug?: string,
    userOrName?: UserProfile | string | null
  ): void {
    const rawName = this.resolveUserName(userOrName);
    const masked = this.maskName(rawName);

    const now = this.getCalibratedNow();
    const event: MarketingNotification = {
      id: `gw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'CLAIM_GIVEAWAY',
      title: 'Săn Giveaway thành công',
      message: `${masked} vừa nhận mã quà tặng sự kiện ${campaignTitle}`,
      timeAgo: 'vừa xong',
      userName: masked,
      giveawayId: campaignId,
      giveawayTitle: campaignTitle,
      gameName,
      gameSlug,
      itemType: 'giveaway',
      isRealUser: true,
      timestamp: now,
      scheduledFireTime: now,
    };
    (event as any).localOrigin = true;

    const currentClaimed = (this.realGiveawayClaimedCountsMap.get(campaignId) || 0) + 1;
    this.realGiveawayClaimedCountsMap.set(campaignId, currentClaimed);

    // Đồng bộ nguyên tử 1 - 1: Giảm mã còn lại và tăng số đã giật (bảo toàn vĩnh viễn, không bị hồi số)
    this.decrementProductStock(campaignId, 1, event.id);
    this.incrementLiveClaimedCount(campaignId, 1, event.id);

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'STATS_SYNC_BROADCAST',
          payload: { giveawayId: campaignId, totalClaimed: currentClaimed },
        });
      } catch {}
    }

    // Nổ luôn lập tức trên màn hình người bấm (0s delay!)
    this.pushRealEvent(event, true, true);
    this.schedulePushRealEvent(event, 0);
  }

  // --- Vote Simulation Engine ---
  public getSimulatedVotes(codeValue: string, isExpiredStatus: boolean = false): { up: number; down: number } {
    const vc = this.config.voteConfig || DEFAULT_MARKETING_CONFIG.voteConfig;
    if (vc.enabled === false) {
      return { up: 0, down: 0 };
    }
    const clean = (codeValue || '').trim().toUpperCase();

    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = (hash * 31 + clean.charCodeAt(i)) & 0xffffffff;
    }
    const absHash = Math.abs(hash);

    const minV = Math.max(10, vc.baseVotesMin || 45);
    const maxV = Math.max(minV, vc.baseVotesMax || 180);
    const totalVotes = minV + (absHash % (maxV - minV + 1));

    let activePercent = vc.activeRate || 96;
    const variance = Math.max(0, vc.variance || 2);
    const jitter = (absHash % (variance * 2 + 1)) - variance;
    activePercent = Math.min(99, Math.max(60, activePercent + jitter));

    if (isExpiredStatus) {
      const down = Math.max(1, Math.round((totalVotes * activePercent) / 100));
      const up = Math.max(0, totalVotes - down);
      return { up, down };
    }

    const up = Math.max(1, Math.round((totalVotes * activePercent) / 100));
    const down = Math.max(0, totalVotes - up);
    return { up, down };
  }

  // --- Globally Synchronized Notification Engine for Slot ---
  public getDeterministicNotification(
    slotIndexOrTimestampMs: number,
    games: GameItem[],
    storeProducts: StoreProduct[],
    inventory: any[],
    utilityProducts: UtilityProduct[] = [],
    giveaways: GiveawayCampaign[] = []
  ): { notif: MarketingNotification; slotIndex: number; fireTimeMs: number; displayDurationMs: number } | null {
    if (!this.config.isEnabled) return null;

    const isTimestamp = slotIndexOrTimestampMs > 10000000000;
    const now = isTimestamp ? slotIndexOrTimestampMs : this.getCalibratedNow();
    const slotDurationMs = this.getSlotDurationMs(now);
    const slotIndex = isTimestamp ? Math.floor(now / slotDurationMs) : Math.floor(slotIndexOrTimestampMs);
    const slotStartMs = slotIndex * slotDurationMs;
    const displayDurationMs = Math.max(3, this.config.displayDuration || 5) * 1000;

    // Deterministic Pseudo-Random Engine (Hàm ngẫu nhiên tất định theo thời gian vũ trụ)
    // PRNG dựa trên Dòng thời gian Unix UTC (Coordinated Universal Time — Giờ Vũ trụ Phối hợp)
    // slotSeed dựa trên mốc thời gian vũ trụ slotIndex (32-bit golden ratio & MurmurHash3 avalanche)
    const slotSeed = (Math.imul(slotIndex, 0x9e3779b9) ^ 0x85ebca6b) >>> 0;
    const rng = createPRNG(slotSeed);

    // Exact fire time within this slot
    const maxJitter = Math.min(4000, Math.max(1000, slotDurationMs - displayDurationMs - 2000));
    const jitterMs = Math.floor(rng() * maxJitter);
    const fireTimeMs = slotStartMs + 1500 + jitterMs;

    // Deterministic selection by probability among ENABLED types according to Admin weights:
    const canCopy = this.isTypeEnabled('COPY_CODE');
    const canStore = this.config.typeToggles?.buyStore !== false;
    const canUtil = this.config.typeToggles?.buyUtility !== false;
    const canBuy = (canStore || canUtil) && (this.config.typeToggles?.buyProduct !== false);
    const canGw = this.isTypeEnabled('CLAIM_GIVEAWAY');
    const canDep = this.isTypeEnabled('DEPOSIT_WALLET');
    const canStats = this.isTypeEnabled('STATS_COPY');
    const canRestock = this.isTypeEnabled('RESTOCK_PRODUCT');

    const cfgWeights = {
      ...DEFAULT_TYPE_WEIGHTS,
      ...(this.config.typeWeights || {}),
    };

    const copyWeight = Math.max(0, Number(cfgWeights.copyCode) || 0);
    const storeWeight = Math.max(0, Number(cfgWeights.buyStore) || 0);
    const utilWeight = Math.max(0, Number(cfgWeights.buyUtility) || 0);
    const buyWeight = (canStore ? storeWeight : 0) + (canUtil ? utilWeight : 0);
    const gwWeight = Math.max(0, Number(cfgWeights.claimGiveaway) || 0);
    const depWeight = Math.max(0, Number(cfgWeights.depositWallet) || 0);
    const statsWeight = Math.max(0, Number(cfgWeights.statsCopy) || 0);
    const restockWeight = Math.max(0, Number(cfgWeights.restockProduct) || 0);

    const candidates: { type: NotificationType; weight: number }[] = [];
    if (canCopy && copyWeight > 0) candidates.push({ type: 'COPY_CODE', weight: copyWeight });
    if (canBuy && buyWeight > 0) candidates.push({ type: 'BUY_PRODUCT', weight: buyWeight });
    if (canGw && gwWeight > 0) candidates.push({ type: 'CLAIM_GIVEAWAY', weight: gwWeight });
    if (canDep && depWeight > 0) candidates.push({ type: 'DEPOSIT_WALLET', weight: depWeight });
    if (canStats && statsWeight > 0) candidates.push({ type: 'STATS_COPY', weight: statsWeight });
    if (canRestock && restockWeight > 0) candidates.push({ type: 'RESTOCK_PRODUCT', weight: restockWeight });

    // Fallback nếu các loại đang bật nhưng vô tình bị đặt weight = 0
    if (candidates.length === 0) {
      if (canCopy) candidates.push({ type: 'COPY_CODE', weight: 1 });
      if (canBuy) candidates.push({ type: 'BUY_PRODUCT', weight: 1 });
      if (canGw) candidates.push({ type: 'CLAIM_GIVEAWAY', weight: 1 });
      if (canDep) candidates.push({ type: 'DEPOSIT_WALLET', weight: 1 });
      if (canStats) candidates.push({ type: 'STATS_COPY', weight: 1 });
      if (canRestock) candidates.push({ type: 'RESTOCK_PRODUCT', weight: 1 });
    }

    if (candidates.length === 0) {
      // Tất cả các loại thông báo đều bị Admin tắt hoàn toàn
      return null;
    }

    const totalCandidateWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let chosenType: NotificationType = candidates[0].type;
    let weightRoll = rng() * totalCandidateWeight;
    for (const c of candidates) {
      if (weightRoll < c.weight) {
        chosenType = c.type;
        break;
      }
      weightRoll -= c.weight;
    }

    // Pick user deterministically using a globally synchronized Shuffle Deck across all configured virtual accounts
    const accounts = Array.isArray(this.config.virtualAccounts) && this.config.virtualAccounts.length > 0
      ? this.config.virtualAccounts
      : PRESET_VIRTUAL_ACCOUNTS;
    const userIdx = this.getDeterministicAccountIndex(slotIndex, accounts.length);
    const rawUser = accounts[userIdx];
    const maskedUser = this.maskName(rawUser);

    const timeAgo = this.getRandomTimeAgo(rng);

    // 1. STATS_COPY
    if (chosenType === 'STATS_COPY') {
      const count = this.getLiveCopyCount(fireTimeMs);
      return {
        notif: {
          id: `slot_stats_${slotIndex}`,
          type: 'STATS_COPY',
          title: 'Thống kê sôi động',
          message: `Hệ thống vừa ghi nhận ${count.toLocaleString('vi-VN')} lượt sao chép giftcode hôm nay!`,
          timeAgo: 'vừa xong',
          totalCopiesCount: count,
          timestamp: fireTimeMs,
        },
        slotIndex,
        fireTimeMs,
        displayDurationMs,
      };
    }

    const getActiveDepositPresets = (): number[] => {
      const presets = this.config.depositNotificationPresets;
      if (Array.isArray(presets) && presets.length > 0) {
        const valid = presets.filter((p) => typeof p === 'number' && p > 0);
        if (valid.length > 0) return valid;
      }
      return DEFAULT_DEPOSIT_PRESETS;
    };

    const buildDepositSlotResult = () => {
      const presets = getActiveDepositPresets();
      const amount = presets[Math.floor(rng() * presets.length)];
      return {
        notif: {
          id: `slot_dep_${slotIndex}`,
          type: 'DEPOSIT_WALLET' as const,
          title: 'Nạp tiền ví thành công',
          message: `${maskedUser} vừa nạp thành công ${amount.toLocaleString('vi-VN')}đ vào ví Core`,
          timeAgo,
          userName: maskedUser,
          depositAmount: amount,
          timestamp: fireTimeMs,
        },
        slotIndex,
        fireTimeMs,
        displayDurationMs,
      };
    };

    // 2. DEPOSIT_WALLET
    if (chosenType === 'DEPOSIT_WALLET') {
      return buildDepositSlotResult();
    }

    // 3. CLAIM_GIVEAWAY
    if (chosenType === 'CLAIM_GIVEAWAY') {
      let deletedGwSet = new Set<string>();
      try {
        if (typeof window !== 'undefined') {
          const rawDelGw = localStorage.getItem('wcg_deleted_giveaways');
          if (rawDelGw) {
            const parsed = JSON.parse(rawDelGw);
            if (Array.isArray(parsed)) deletedGwSet = new Set(parsed);
          }
        }
      } catch {}

      const eligibleGiveaways = (Array.isArray(giveaways) ? giveaways : [])
        .filter((gw) => {
          if (!gw || gw.is_active === false) return false;
          if (deletedGwSet.has(gw.id)) return false;
          const realStock = Array.isArray(gw.codes_pool)
            ? gw.codes_pool.length
            : (typeof gw.remaining_codes === 'number' ? gw.remaining_codes : 0);
          // CRITICAL ADMIN RULE: Hết hàng thật trong kho hoặc dưới minRealStock = Tắt hoàn toàn thông báo ảo
          if (realStock <= 0) return false;
          const pw = this.getProductConfig(gw.id);
          if (pw.priority === 'off') return false;
          if (realStock < this.getMinRealStock(gw.id)) return false;
          return true;
        })
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));

      if (eligibleGiveaways.length > 0) {
        // Áp dụng trọng số ưu tiên đã cấu hình trong Admin:
        // 'high' (x5): xuất hiện gấp 5 lần, 'normal' (x2): xuất hiện 2 lần, 'low' (x1): 1 lần
        const weightedGws: GiveawayCampaign[] = [];
        eligibleGiveaways.forEach((gw) => {
          const pw = this.getProductConfig(gw.id);
          const weight = pw.priority === 'high' ? 5 : pw.priority === 'low' ? 1 : 2;
          for (let w = 0; w < weight; w++) {
            weightedGws.push(gw);
          }
        });
        const selectedGw = weightedGws[Math.floor(rng() * weightedGws.length)] || eligibleGiveaways[0];
        return {
          notif: {
            id: `slot_gw_${slotIndex}`,
            type: 'CLAIM_GIVEAWAY',
            title: 'Săn Giveaway thành công',
            message: `${maskedUser} vừa nhận mã quà tặng sự kiện ${selectedGw.title}`,
            timeAgo,
            userName: maskedUser,
            giveawayId: selectedGw.id,
            giveawayTitle: selectedGw.title,
            gameName: selectedGw.game_name,
            gameSlug: selectedGw.game_slug,
            itemType: 'giveaway',
            timestamp: fireTimeMs,
          },
          slotIndex,
          fireTimeMs,
          displayDurationMs,
        };
      }
      
      // Fallback nếu không có Giveaway hợp lệ
      if (canBuy) chosenType = 'BUY_PRODUCT';
      else if (canCopy) chosenType = 'COPY_CODE';
      else if (canDep) return buildDepositSlotResult();
      else if (canStats) chosenType = 'STATS_COPY';
      else return null;
    }

    // 4. BUY_PRODUCT
    if (chosenType === 'BUY_PRODUCT') {
      let deletedStoreSet = new Set<string>();
      let deletedUtilSet = new Set<string>();
      try {
        if (typeof window !== 'undefined') {
          const rawDelSp = localStorage.getItem('wcg_deleted_store_products');
          if (rawDelSp) {
            const parsed = JSON.parse(rawDelSp);
            if (Array.isArray(parsed)) deletedStoreSet = new Set(parsed);
          }
          const rawDelUt = localStorage.getItem('wcg_deleted_utilities');
          if (rawDelUt) {
            const parsed = JSON.parse(rawDelUt);
            if (Array.isArray(parsed)) deletedUtilSet = new Set(parsed);
          }
        }
      } catch {}

      const eligibleStoreProds = canStore
        ? (Array.isArray(storeProducts) ? storeProducts : [])
            .filter((p) => {
              if (!p || p.is_active === false) return false;
              if (deletedStoreSet.has(p.id)) return false;
              const realStock = Number(p.stock_quantity) || 0;
              // CRITICAL ADMIN RULE: Hết hàng thật hoặc dưới minRealStock = Tắt thông báo ảo
              if (realStock <= 0) return false;
              const pw = this.getProductConfig(p.id);
              if (pw.priority === 'off') return false;
              if (realStock < this.getMinRealStock(p.id)) return false;
              return true;
            })
            .map((p) => ({
              id: p.id,
              title: p.title,
              price: Number(p.current_price ?? (p as any).price ?? 0),
              itemType: 'store' as const,
            }))
        : [];

      const eligibleUtilityProds = canUtil
        ? (Array.isArray(utilityProducts) ? utilityProducts : [])
            .filter((u) => {
              if (!u || u.is_active === false) return false;
              if (deletedUtilSet.has(u.id)) return false;
              const realStock = Number(u.stock_quantity) || 0;
              // CRITICAL ADMIN RULE: Hết hàng thật hoặc dưới minRealStock = Tắt thông báo ảo
              if (realStock <= 0) return false;
              const pw = this.getProductConfig(u.id);
              if (pw.priority === 'off') return false;
              if (realStock < this.getMinRealStock(u.id)) return false;
              return true;
            })
            .map((u) => ({
              id: u.id,
              title: u.title,
              price: Number(u.current_price ?? (u as any).price ?? 0),
              itemType: 'utility' as const,
            }))
        : [];

      const allEligible = [...eligibleStoreProds, ...eligibleUtilityProds].sort((a, b) => String(a.id).localeCompare(String(b.id)));

      if (allEligible.length > 0) {
        // Áp dụng trọng số ưu tiên đã cấu hình trong Admin:
        // 'high' (x5): xuất hiện gấp 5 lần, 'normal' (x2): xuất hiện 2 lần, 'low' (x1): 1 lần
        const weightedItems: typeof allEligible = [];
        allEligible.forEach((item) => {
          const pw = this.getProductConfig(item.id);
          const priorityWeight = pw.priority === 'high' ? 5 : pw.priority === 'low' ? 1 : 2;
          const categoryRatio = item.itemType === 'utility' ? (utilWeight > 0 ? utilWeight : 10) : (storeWeight > 0 ? storeWeight : 25);
          const weight = Math.max(1, Math.round(priorityWeight * (categoryRatio / 10)));
          for (let w = 0; w < weight; w++) {
            weightedItems.push(item);
          }
        });
        const selectedItem = weightedItems[Math.floor(rng() * weightedItems.length)] || allEligible[0];
        return {
          notif: {
            id: `slot_buy_${slotIndex}`,
            type: 'BUY_PRODUCT',
            title: selectedItem.itemType === 'utility' ? 'Đơn hàng tiện ích' : 'Đơn hàng mới',
            message: `${maskedUser} vừa mua thành công ${selectedItem.title}`,
            timeAgo,
            userName: maskedUser,
            productId: selectedItem.id,
            productName: selectedItem.title,
            productPrice: selectedItem.price,
            itemType: selectedItem.itemType,
            timestamp: fireTimeMs,
          },
          slotIndex,
          fireTimeMs,
          displayDurationMs,
        };
      }

      // Fallback nếu không có sản phẩm Store/Utility hợp lệ
      if (canCopy) chosenType = 'COPY_CODE';
      else if (canDep) {
        return buildDepositSlotResult();
      } else if (canStats) {
        const count = this.getLiveCopyCount(fireTimeMs);
        return {
          notif: {
            id: `slot_stats_${slotIndex}`,
            type: 'STATS_COPY',
            title: 'Thống kê sôi động',
            message: `Hệ thống vừa ghi nhận ${count.toLocaleString('vi-VN')} lượt sao chép giftcode hôm nay!`,
            timeAgo: 'vừa xong',
            totalCopiesCount: count,
            timestamp: fireTimeMs,
          },
          slotIndex,
          fireTimeMs,
          displayDurationMs,
        };
      } else {
        return null;
      }
    }

    // 5. COPY_CODE
    if (chosenType === 'COPY_CODE') {
      const validGames = (Array.isArray(games) ? games : [])
        .filter((g) => g && ((g.codes_count || 0) > 0 || (g.codes && g.codes.length > 0)))
        .sort((a, b) => String(a.slug || a.id).localeCompare(String(b.slug || b.id)));

      if (validGames.length > 0) {
        const chosenGame = validGames[Math.floor(rng() * validGames.length)];
        const gameName = chosenGame?.name || 'Free Fire';
        const gameSlug = chosenGame?.slug || 'free-fire';

        return {
          notif: {
            id: `slot_copy_${slotIndex}`,
            type: 'COPY_CODE',
            title: 'Sao chép mã Giftcode',
            message: `${maskedUser} vừa sao chép 1 Giftcode game ${gameName}`,
            timeAgo,
            userName: maskedUser,
            gameName: gameName,
            gameSlug: gameSlug,
            timestamp: fireTimeMs,
          },
          slotIndex,
          fireTimeMs,
          displayDurationMs,
        };
      }

      // Fallback nếu không có game nào có code
      if (canDep) {
        return buildDepositSlotResult();
      }
    }

    // 6. RESTOCK_PRODUCT (Thông báo Bổ sung tồn kho)
    if (chosenType === 'RESTOCK_PRODUCT') {
      let deletedStoreSet = new Set<string>();
      let deletedUtilSet = new Set<string>();
      let deletedGwSet = new Set<string>();
      try {
        if (typeof window !== 'undefined') {
          const rawDelSp = localStorage.getItem('wcg_deleted_store_products');
          if (rawDelSp) deletedStoreSet = new Set(JSON.parse(rawDelSp));
          const rawDelUt = localStorage.getItem('wcg_deleted_utilities');
          if (rawDelUt) deletedUtilSet = new Set(JSON.parse(rawDelUt));
          const rawDelGw = localStorage.getItem('wcg_deleted_giveaways');
          if (rawDelGw) deletedGwSet = new Set(JSON.parse(rawDelGw));
        }
      } catch {}

      const restockCandidates: { id: string; title: string; itemType: 'store' | 'utility' | 'giveaway' }[] = [];

      // QUY TẮC BẮT BUỘC TỪ NGƯỜI DÙNG: Chỉ thông báo những mục còn hàng đang bán trên web
      if (canStore) {
        (Array.isArray(storeProducts) ? storeProducts : []).forEach((p) => {
          if (p && p.is_active !== false && !deletedStoreSet.has(p.id)) {
            const realStock = Number(p.stock_quantity) || 0;
            if (realStock <= 0) return;
            const pw = this.getProductConfig(p.id);
            if (pw.priority === 'off') return;
            if (realStock < this.getMinRealStock(p.id)) return;
            const displayStock = this.getDisplayStock(p.id, realStock);
            if (displayStock <= 0) return;

            restockCandidates.push({ id: p.id, title: p.title, itemType: 'store' });
          }
        });
      }

      if (canUtil) {
        (Array.isArray(utilityProducts) ? utilityProducts : []).forEach((u) => {
          if (u && u.is_active !== false && !deletedUtilSet.has(u.id)) {
            const realStock = Number(u.stock_quantity) || 0;
            if (realStock <= 0) return;
            const pw = this.getProductConfig(u.id);
            if (pw.priority === 'off') return;
            if (realStock < this.getMinRealStock(u.id)) return;
            const displayStock = this.getDisplayStock(u.id, realStock);
            if (displayStock <= 0) return;

            restockCandidates.push({ id: u.id, title: u.title, itemType: 'utility' });
          }
        });
      }

      if (canGw) {
        (Array.isArray(giveaways) ? giveaways : []).forEach((g) => {
          if (g && g.is_active !== false && !deletedGwSet.has(g.id)) {
            const realStock = Array.isArray(g.codes_pool)
              ? g.codes_pool.length
              : (typeof g.remaining_codes === 'number' ? g.remaining_codes : 0);
            if (realStock <= 0) return;
            const pw = this.getProductConfig(g.id);
            if (pw.priority === 'off') return;
            if (realStock < this.getMinRealStock(g.id)) return;
            const displayStock = this.getDisplayStock(g.id, realStock);
            if (displayStock <= 0) return;

            restockCandidates.push({ id: g.id, title: g.title, itemType: 'giveaway' });
          }
        });
      }

      if (restockCandidates.length > 0) {
        restockCandidates.sort((a, b) => String(a.id).localeCompare(String(b.id)));

        // Áp dụng trọng số ưu tiên đã cấu hình trong Admin:
        // 'high' (x5): xuất hiện gấp 5 lần, 'normal' (x2): xuất hiện 2 lần, 'low' (x1): 1 lần
        const weightedCandidates: typeof restockCandidates = [];
        restockCandidates.forEach((cand) => {
          const pw = this.getProductConfig(cand.id);
          const priorityWeight = pw.priority === 'high' ? 5 : pw.priority === 'low' ? 1 : 2;
          const categoryRatio = cand.itemType === 'utility'
            ? (utilWeight > 0 ? utilWeight : 10)
            : cand.itemType === 'giveaway'
            ? (gwWeight > 0 ? gwWeight : 20)
            : (storeWeight > 0 ? storeWeight : 25);
          const weight = Math.max(1, Math.round(priorityWeight * (categoryRatio / 10)));
          for (let w = 0; w < weight; w++) {
            weightedCandidates.push(cand);
          }
        });

        const selected = weightedCandidates[Math.floor(rng() * weightedCandidates.length)] || restockCandidates[0];
        const pw = this.getProductConfig(selected.id);
        const restockAmount = Math.max(5, Number(pw.autoRestockAmount) || 20);

        return {
          notif: {
            id: `slot_restock_${slotIndex}`,
            type: 'RESTOCK_PRODUCT',
            title: selected.itemType === 'giveaway' ? 'Nạp thêm mã quà tặng' : 'Bổ sung tồn kho',
            message: selected.itemType === 'giveaway'
              ? `Sự kiện ${selected.title} vừa được nạp thêm +${restockAmount} mã quà tặng mới!`
              : `Kho hàng vừa bổ sung thêm +${restockAmount} ${selected.title}!`,
            timeAgo,
            userName: 'Hệ thống',
            productId: selected.id,
            productName: selected.title,
            giveawayId: selected.itemType === 'giveaway' ? selected.id : undefined,
            giveawayTitle: selected.itemType === 'giveaway' ? selected.title : undefined,
            restockAmount,
            itemType: selected.itemType,
            timestamp: fireTimeMs,
          },
          slotIndex,
          fireTimeMs,
          displayDurationMs,
        };
      }

      // Fallback nếu không có mục nào còn hàng đang bán trên web
      if (canCopy) chosenType = 'COPY_CODE';
      else if (canBuy) chosenType = 'BUY_PRODUCT';
      else if (canGw) chosenType = 'CLAIM_GIVEAWAY';
      else if (canDep) return buildDepositSlotResult();
      else if (canStats) chosenType = 'STATS_COPY';
      else return null;
    }

    return null;
  }

  // Backwards compatibility generator
  public generateNextNotification(
    games: GameItem[],
    storeProducts: StoreProduct[],
    inventory: any[],
    utilityProducts: UtilityProduct[] = [],
    giveaways: GiveawayCampaign[] = []
  ): MarketingNotification | null {
    if (!this.config.isEnabled) return null;
    if (this.recentRealEvents.length > 0) {
      return this.recentRealEvents.shift()!;
    }
    const now = this.getCalibratedNow();
    const slotData = this.getDeterministicNotification(now, games, storeProducts, inventory, utilityProducts, giveaways);
    return slotData?.notif || null;
  }

  public subscribeNotification(callback: (notif: MarketingNotification | null) => void): () => void {
    this.notificationListeners.add(callback);
    return () => this.notificationListeners.delete(callback);
  }

  // --- Configuration Management ---
  private loadConfig(): MarketingConfig {
    if (typeof window === 'undefined') return DEFAULT_MARKETING_CONFIG;
    try {
      const saved = localStorage.getItem(MARKETING_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const validPresets = Array.isArray(parsed.depositNotificationPresets) && parsed.depositNotificationPresets.length > 0
          ? parsed.depositNotificationPresets.filter((p: any) => typeof p === 'number' && p > 0)
          : DEFAULT_DEPOSIT_PRESETS;
        return {
          ...DEFAULT_MARKETING_CONFIG,
          ...parsed,
          toastPosition: parsed.toastPosition || 'bottom-left',
          depositNotificationPresets: (validPresets.length > 0) ? validPresets : DEFAULT_DEPOSIT_PRESETS,
          typeToggles: { ...DEFAULT_TYPE_TOGGLES, ...(parsed.typeToggles || {}) },
          typeWeights: { ...DEFAULT_TYPE_WEIGHTS, ...(parsed.typeWeights || {}) },
          peakHours: { ...DEFAULT_MARKETING_CONFIG.peakHours, ...(parsed.peakHours || {}) },
          voteConfig: { ...DEFAULT_MARKETING_CONFIG.voteConfig, ...(parsed.voteConfig || {}) },
          timeAgoConfig: { ...DEFAULT_MARKETING_CONFIG.timeAgoConfig, ...(parsed.timeAgoConfig || {}) },
          offlineCatchUp: { ...DEFAULT_OFFLINE_CATCHUP_CONFIG, ...(parsed.offlineCatchUp || {}) },
          virtualAccounts: Array.isArray(parsed.virtualAccounts) && parsed.virtualAccounts.length > 0
            ? parsed.virtualAccounts
            : PRESET_VIRTUAL_ACCOUNTS,
        };
      }
    } catch (e) {
      console.warn('[MarketingService] Failed to parse config, using defaults', e);
    }
    return DEFAULT_MARKETING_CONFIG;
  }

  private setupStorageListener(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('storage', (e) => {
      if (e.key === MARKETING_CONFIG_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const validPresets = Array.isArray(parsed.depositNotificationPresets) && parsed.depositNotificationPresets.length > 0
            ? parsed.depositNotificationPresets.filter((p: any) => typeof p === 'number' && p > 0)
            : DEFAULT_DEPOSIT_PRESETS;
          this.config = {
            ...DEFAULT_MARKETING_CONFIG,
            ...parsed,
            toastPosition: parsed.toastPosition || 'bottom-left',
            depositNotificationPresets: (validPresets.length > 0) ? validPresets : DEFAULT_DEPOSIT_PRESETS,
            typeToggles: {
              ...DEFAULT_TYPE_TOGGLES,
              ...(parsed.typeToggles || {}),
            },
            typeWeights: {
              ...DEFAULT_TYPE_WEIGHTS,
              ...(parsed.typeWeights || {}),
            },
            offlineCatchUp: {
              ...DEFAULT_OFFLINE_CATCHUP_CONFIG,
              ...(parsed.offlineCatchUp || {}),
            },
          };
        } catch {}
      }
      if (e.key === MARKETING_VIRTUAL_STOCK_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            Object.entries(parsed).forEach(([k, v]) => {
              if (typeof v === 'number' && !isNaN(v)) {
                this.liveVirtualStockMap.set(k, v);
              }
            });
            this.stockListeners.forEach((cb) => {
              try { cb('', 0); } catch {}
            });
            window.dispatchEvent(new CustomEvent('wcg_virtual_stock_updated', { detail: {} }));
          }
        } catch {}
      }
      if (e.key === MARKETING_FOMO_SOLD_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            Object.entries(parsed).forEach(([k, v]) => {
              if (typeof v === 'number' && !isNaN(v)) {
                this.liveFomoSoldCountMap.set(k, v);
              }
            });
            this.notifySoldCountChanged('*', 0);
          }
        } catch {}
      }
      if (e.key === MARKETING_FOMO_CLAIMED_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            Object.entries(parsed).forEach(([k, v]) => {
              if (typeof v === 'number' && !isNaN(v)) {
                this.liveFomoClaimedCountMap.set(k, v);
              }
            });
            this.notifySoldCountChanged('*', 0);
          }
        } catch {}
      }
      if (e.key === MARKETING_HIGH_WATER_SOLD_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            let changed = false;
            Object.entries(parsed).forEach(([k, v]) => {
              if (typeof v === 'number' && !isNaN(v)) {
                const cur = this.highWaterSoldCountMap.get(k) || 0;
                if (v > cur) {
                  this.highWaterSoldCountMap.set(k, v);
                  changed = true;
                }
              }
            });
            if (changed) this.notifySoldCountChanged('*', 0);
          }
        } catch {}
      }
      if (e.key === MARKETING_HIGH_WATER_CLAIMED_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            let changed = false;
            Object.entries(parsed).forEach(([k, v]) => {
              if (typeof v === 'number' && !isNaN(v)) {
                const cur = this.highWaterClaimedCountMap.get(k) || 0;
                if (v > cur) {
                  this.highWaterClaimedCountMap.set(k, v);
                  changed = true;
                }
              }
            });
            if (changed) this.notifySoldCountChanged('*', 0);
          }
        } catch {}
      }
      if (e.key === MARKETING_HOURLY_SERVER_STATS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed.products === 'object') {
            Object.entries(parsed.products).forEach(([k, v]) => {
              this.hourlyServerStatsMap.set(k, v);
            });
            this.notifySoldCountChanged('*', 0);
          }
        } catch {}
      }
      if (e.key === MARKETING_FOMO_SESSION_ANCHOR_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            Object.entries(parsed).forEach(([k, v]: [string, any]) => {
              if (v && typeof v.lastCount === 'number' && typeof v.lastTimestamp === 'number') {
                this.sessionAnchorMap.set(k, {
                  lastCount: Number(v.lastCount) || 0,
                  lastTimestamp: Number(v.lastTimestamp) || Date.now(),
                });
              }
            });
          }
        } catch {}
      }
      if (
        e.key === 'wcg_admin_utilities_v4' ||
        e.key === 'wcg_admin_store_products_v4' ||
        e.key === 'wcg_admin_giveaways_v4' ||
        e.key === 'wcg_admin_inventory_v4'
      ) {
        this.clearRealStockCache();
        this.notifyStockChanged('*', 0);
      }
    });

    if (typeof window !== 'undefined') {
      const handleInventoryReset = () => {
        this.clearRealStockCache();
        this.notifyStockChanged('*', 0);
      };
      window.addEventListener('wcg_admin_data_updated', handleInventoryReset);
      window.addEventListener('wcg_data_updated', handleInventoryReset);
      window.addEventListener('beforeunload', () => {
        this.flushSessionAnchor();
      });
      window.addEventListener('pagehide', () => {
        this.flushSessionAnchor();
      });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushSessionAnchor();
        } else if (document.visibilityState === 'visible') {
          this.applyOfflineCatchUp();
        }
      });
    }

    window.addEventListener('wcg_marketing_config_updated', (e: any) => {
      if (e.detail && typeof e.detail === 'object') {
        this.config = {
          ...DEFAULT_MARKETING_CONFIG,
          ...e.detail,
          typeToggles: {
            ...DEFAULT_TYPE_TOGGLES,
            ...(e.detail.typeToggles || {}),
          },
          offlineCatchUp: {
            ...DEFAULT_OFFLINE_CATCHUP_CONFIG,
            ...(e.detail.offlineCatchUp || {}),
          },
        };
      } else {
        this.config = this.loadConfig();
      }

      // Re-align high water marks if productWeights contains explicit target
      if (this.config.productWeights && typeof this.config.productWeights === 'object') {
        Object.entries(this.config.productWeights).forEach(([id, pw]: [string, any]) => {
          if (!pw) return;
          if (typeof pw.targetDisplaySoldOrClaimed === 'number') {
            if (id.startsWith('gw_')) {
              this.highWaterClaimedCountMap.set(id, pw.targetDisplaySoldOrClaimed);
              this.notifySoldCountChanged(id, pw.targetDisplaySoldOrClaimed);
            } else {
              this.highWaterSoldCountMap.set(id, pw.targetDisplaySoldOrClaimed);
              this.notifySoldCountChanged(id, pw.targetDisplaySoldOrClaimed);
            }
          }
        });
        this.saveHighWaterCounts();
      }

      this.startSnapshotPoller();
      this.notifyStockChanged('*', 0);
      this.notifySoldCountChanged('*', 0);
    });

    window.addEventListener('wcg_utilities_updated', (e: any) => {
      const list = Array.isArray(e.detail) ? e.detail : [];
      let changed = false;
      list.forEach((u: any) => {
        if (u && u.id && u.virtual_sold_count !== undefined) {
          const realSold = Number(u.sold_count) || 0;
          const target = realSold + Number(u.virtual_sold_count || 0);
          this.highWaterSoldCountMap.set(u.id, target);
          this.liveFomoSoldCountMap.set(u.id, Number(u.virtual_sold_count || 0));
          this.notifySoldCountChanged(u.id, target);
          changed = true;
        }
      });
      if (changed) {
        this.saveHighWaterCounts();
        this.saveLiveFomoCounts();
      }
    });

    window.addEventListener('wcg_giveaways_updated', (e: any) => {
      const list = Array.isArray(e.detail) ? e.detail : [];
      let changed = false;
      list.forEach((gw: any) => {
        if (gw && gw.id && gw.virtual_claimed_offset !== undefined) {
          const realClaimed = Number(gw.claimed_codes) || 0;
          const target = realClaimed + Number(gw.virtual_claimed_offset || 0);
          this.highWaterClaimedCountMap.set(gw.id, target);
          this.liveFomoClaimedCountMap.set(gw.id, Number(gw.virtual_claimed_offset || 0));
          this.notifySoldCountChanged(gw.id, target);
          changed = true;
        }
      });
      if (changed) {
        this.saveHighWaterCounts();
        this.saveLiveFomoCounts();
      }
    });

    window.addEventListener('wcg_store_products_updated', (e: any) => {
      const list = Array.isArray(e.detail) ? e.detail : [];
      let changed = false;
      list.forEach((p: any) => {
        if (p && p.id && p.virtual_sold_count !== undefined) {
          const realSold = Number(p.sold_count) || 0;
          const target = realSold + Number(p.virtual_sold_count || 0);
          this.highWaterSoldCountMap.set(p.id, target);
          this.liveFomoSoldCountMap.set(p.id, Number(p.virtual_sold_count || 0));
          this.notifySoldCountChanged(p.id, target);
          changed = true;
        }
      });
      if (changed) {
        this.saveHighWaterCounts();
        this.saveLiveFomoCounts();
      }
    });
  }

  public getConfig(): MarketingConfig {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(MARKETING_CONFIG_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const validPresets = Array.isArray(parsed.depositNotificationPresets) && parsed.depositNotificationPresets.length > 0
            ? parsed.depositNotificationPresets.filter((p: any) => typeof p === 'number' && p > 0)
            : DEFAULT_DEPOSIT_PRESETS;
          this.config = {
            ...DEFAULT_MARKETING_CONFIG,
            ...parsed,
            toastPosition: parsed.toastPosition || 'bottom-left',
            depositNotificationPresets: (validPresets.length > 0) ? validPresets : DEFAULT_DEPOSIT_PRESETS,
            isEnabled: parsed.isEnabled !== undefined ? Boolean(parsed.isEnabled) : true,
            typeToggles: { ...DEFAULT_TYPE_TOGGLES, ...(parsed.typeToggles || {}) },
            peakHours: { ...DEFAULT_MARKETING_CONFIG.peakHours, ...(parsed.peakHours || {}) },
            voteConfig: { ...DEFAULT_MARKETING_CONFIG.voteConfig, ...(parsed.voteConfig || {}) },
            timeAgoConfig: { ...DEFAULT_MARKETING_CONFIG.timeAgoConfig, ...(parsed.timeAgoConfig || {}) },
            offlineCatchUp: { ...DEFAULT_OFFLINE_CATCHUP_CONFIG, ...(parsed.offlineCatchUp || {}) },
            syncIntervalSeconds: typeof parsed.syncIntervalSeconds === 'number' ? parsed.syncIntervalSeconds : 60,
            enableGlobalSnapToGrid: parsed.enableGlobalSnapToGrid !== undefined ? Boolean(parsed.enableGlobalSnapToGrid) : true,
            virtualAccounts: Array.isArray(parsed.virtualAccounts) && parsed.virtualAccounts.length > 0
              ? parsed.virtualAccounts
              : PRESET_VIRTUAL_ACCOUNTS,
          };
        }
      } catch {}
    }
    return { ...this.config };
  }

  public getDepositNotificationPresets(): number[] {
    const presets = this.config.depositNotificationPresets;
    if (Array.isArray(presets) && presets.length > 0) {
      const valid = presets.filter((p) => typeof p === 'number' && p > 0);
      if (valid.length > 0) return valid;
    }
    return DEFAULT_DEPOSIT_PRESETS;
  }

  public getToastPosition(): ToastPosition {
    return this.config.toastPosition || 'bottom-left';
  }

  public async saveConfig(newConfig: MarketingConfig): Promise<boolean> {
    this.config = { ...newConfig, lastUpdated: new Date().toISOString() };

    // 1. Recalibrate & heal liveVirtualStockMap based on newly saved config weights
    if (this.config.productWeights && typeof this.config.productWeights === 'object') {
      Object.entries(this.config.productWeights).forEach(([id, pw]) => {
        if (!pw) return;
        const realStock = this.getRealStockFor(id);
        if (realStock <= 0) {
          this.liveVirtualStockMap.set(id, 0);
        } else if (pw.priority === 'off' || !pw.virtualStockBonus || pw.virtualStockBonus <= 0) {
          this.liveVirtualStockMap.set(id, realStock);
        } else {
          const rawThreshold = Math.max(1, Number(pw.autoRestockThreshold) || 1);
          const restockAmount = Math.max(1, Number(pw.autoRestockAmount) || 20);
          const effectiveThreshold = (realStock > 0 && rawThreshold < realStock)
            ? realStock
            : rawThreshold;
          const maxAllowed = Math.max(realStock + Number(pw.virtualStockBonus || 0), effectiveThreshold + restockAmount);
          const cur = this.liveVirtualStockMap.get(id);
          if (cur === undefined || cur > maxAllowed || cur <= effectiveThreshold) {
            this.liveVirtualStockMap.set(id, realStock + Number(pw.virtualStockBonus || 0));
          }
        }
      });
      this.saveLiveVirtualStock();
    }

    // Reset reported stock peaks so new values are immediately reported to server
    this.lastReportedPeaks.stock = {};
    this.lastReportedPeaks.remaining = {};

    this.startSnapshotPoller();
    this.notifyStockChanged('*', 0);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(MARKETING_CONFIG_KEY, JSON.stringify(this.config));
        window.dispatchEvent(new CustomEvent('wcg_marketing_config_updated', { detail: this.config }));
      } catch (err) {
        console.error('Failed to save marketing config to localStorage', err);
      }
    }

    this.schedulePeakReport(true);

    try {
      const ADMIN_SYNC_KEY = 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('wcg_auth_token') ||
            sessionStorage.getItem('wcg_auth_token') ||
            ''
          : '';
      const syncKey =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('wcg_admin_sync_key') || localStorage.getItem('wcg_admin_sync_key') || ADMIN_SYNC_KEY
          : ADMIN_SYNC_KEY;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (syncKey) {
        headers['X-Sync-Key'] = syncKey;
        if (!token) headers['Authorization'] = `Bearer ${syncKey}`;
      }

      const endpoints = [
        '/api/sync',
        'https://web-code-game.pages.dev/api/sync',
        'https://admin-code-game-shop.pages.dev/api/sync',
      ];

      const resList = await Promise.all(
        endpoints.map((url) =>
          fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              key: MARKETING_CONFIG_KEY,
              data: this.config,
              marketingConfig: this.config,
              forceReset: true,
              forceResetSold: true,
              forceResetClaimed: true,
            }),
          }).catch((err) => {
            console.warn(`[MarketingService] Push to ${url} failed:`, err);
            return null;
          })
        )
      );

      const successful = resList.some((r) => r && r.ok);
      if (!successful) {
        const firstErr = resList.find((r) => r && !r.ok);
        if (firstErr) {
          const errBody = await firstErr.json().catch(() => ({}));
          throw new Error(errBody.message || errBody.error || `Lỗi máy chủ (${firstErr.status})`);
        }
        throw new Error('Không thể kết nối đến máy chủ Cloudflare');
      }
      return true;
    } catch (e: any) {
      console.warn('[MarketingService] Failed to push config to Cloudflare KV:', e?.message || e);
      throw e;
    }
  }

  public resetToDefaults(): void {
    this.saveConfig(DEFAULT_MARKETING_CONFIG);
  }

  public maskName(name: string): string {
    if (!name) return 'Khách hàng';
    const trimmed = name.trim();

    // Already masked check
    if (trimmed.includes('***') || trimmed.includes('****') || trimmed.includes('**')) {
      return trimmed;
    }

    // Guest identity formatting: e.g. "Khách #4921" -> "Khách #49**"
    if (trimmed.startsWith('Khách #')) {
      if (!this.config.isNameMasked) return trimmed;
      const code = trimmed.replace('Khách #', '').trim();
      if (code.length >= 4) {
        return `Khách #${code.slice(0, 2)}**`;
      }
      return trimmed;
    }

    if (!this.config.isNameMasked) return name;

    // Email masking: e.g. "tuannguyen92@gmail.com" -> "tuan***@gmail.com"
    if (trimmed.includes('@')) {
      const [localPart, domain] = trimmed.split('@');
      if (!domain) return trimmed;
      if (localPart.length <= 3) {
        return `${localPart[0]}***@${domain}`;
      } else if (localPart.length <= 6) {
        return `${localPart.slice(0, 3)}***@${domain}`;
      } else {
        return `${localPart.slice(0, 4)}***@${domain}`;
      }
    }

    // Vietnamese phone number masking: e.g. "0984562189" -> "0984***189"
    if (/^\d{9,11}$/.test(trimmed)) {
      return `${trimmed.slice(0, 4)}***${trimmed.slice(-3)}`;
    }

    // Gamer usernames: e.g. "shadow_hunter" -> "shadow***"
    if (trimmed.includes('_') || /^[a-zA-Z0-9]+$/.test(trimmed)) {
      if (trimmed.length <= 4) return `${trimmed[0]}***`;
      return `${trimmed.slice(0, Math.min(6, trimmed.length - 2))}***`;
    }

    // Natural Vietnamese Full Name masking: e.g. "Nguyễn Minh Tuấn" -> "Nguyễn M*** Tuấn"
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length >= 3) {
      const first = words[0];
      const middleInitial = words[1].charAt(0).toUpperCase();
      const last = words[words.length - 1];
      return `${first} ${middleInitial}*** ${last}`;
    } else if (words.length === 2) {
      const first = words[0];
      const lastInitial = words[1].charAt(0).toUpperCase();
      return `${first} ${lastInitial}***`;
    }

    return `${trimmed.slice(0, Math.min(3, trimmed.length))}***`;
  }

  public sanitizeNotificationMasking(notif: MarketingNotification): MarketingNotification {
    if (!notif) return notif;
    if (!this.config.isNameMasked) return notif;

    const cloned = { ...notif };
    let userName = cloned.userName || '';

    if (userName && !userName.includes('*')) {
      const masked = this.maskName(userName);
      if (cloned.message && cloned.message.includes(userName)) {
        cloned.message = cloned.message.replace(userName, masked);
      }
      cloned.userName = masked;
    }

    if (cloned.message) {
      // Regex detects raw names before "vừa mua", "vừa sao chép", "vừa nhận", "vừa nạp"
      const match = cloned.message.match(/^(.+?)\s+(vừa\s+(?:mua|sao chép|nhận|nạp)\b.*)$/i);
      if (match) {
        const rawPrefix = match[1].trim();
        if (!rawPrefix.includes('*')) {
          const maskedPrefix = this.maskName(rawPrefix);
          cloned.message = `${maskedPrefix} ${match[2]}`;
          if (!cloned.userName || cloned.userName === rawPrefix) {
            cloned.userName = maskedPrefix;
          }
        }
      }
    }

    return cloned;
  }
}

export const marketingService = new MarketingService();

if (typeof window !== 'undefined') {
  (window as any).marketingService = marketingService;
  (window as any).triggerMarketingToast = () => {
    window.dispatchEvent(new CustomEvent('wcg_trigger_marketing_test'));
  };
}
