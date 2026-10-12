import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Gift,
  ShoppingBag,
  Wallet,
  Zap,
  X,
  ChevronRight,
  Sparkles,
  Wrench,
  Flame,
  BellOff,
} from 'lucide-react';
import type { MarketingNotification } from '../types/marketing';
import { marketingService } from '../services/marketingService';
import { dataService } from '../services/dataService';

const MARKETING_SNOOZE_KEY = 'wcg_marketing_toast_snooze_until';

interface MarketingNotificationToastProps {
  onSelectGameSlug?: (slug: string) => void;
  onSelectProduct?: (productId: string) => void;
  onSelectUtility?: (utilityId: string) => void;
  onSelectGiveaway?: (giveawayId: string) => void;
  onOpenWallet?: () => void;
  onExploreClick?: () => void;
}

export const MarketingNotificationToast: React.FC<MarketingNotificationToastProps> = ({
  onSelectGameSlug,
  onSelectProduct,
  onSelectUtility,
  onSelectGiveaway,
  onOpenWallet,
  onExploreClick,
}) => {
  const [notification, setNotification] = useState<MarketingNotification | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const timerRef = useRef<any>(null);
  const hideTimerRef = useRef<any>(null);
  const dismissTimerRef = useRef<any>(null);
  const initialWelcomeTimerRef = useRef<any>(null);
  const isTabHiddenRef = useRef(false);
  const isHoveredRef = useRef(false);
  const lastToastDismissedTimeRef = useRef<number>(0);
  const currentNotificationIdRef = useRef<string | null>(null);
  isHoveredRef.current = isHovered;

  // Check if user has snoozed notifications within the last 1 hour
  const isSnoozed = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem(MARKETING_SNOOZE_KEY);
      if (saved) {
        const until = parseInt(saved, 10);
        if (!isNaN(until)) {
          if (until > Date.now()) {
            return true;
          } else {
            // Tự động xóa cờ snooze đã hết hạn
            localStorage.removeItem(MARKETING_SNOOZE_KEY);
          }
        }
      }
    } catch {}
    return false;
  }, []);

  // Dismiss current notification smoothly
  const dismissNotification = useCallback(() => {
    setIsExiting(true);
    lastToastDismissedTimeRef.current = Date.now();
    const dismissingId = currentNotificationIdRef.current;
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      // Chỉ ẩn khi ID thông báo đang đóng vẫn là ID hiện tại (tránh ghi đè khi thông báo thật mới vừa hiển thị)
      if (currentNotificationIdRef.current === dismissingId) {
        setIsVisible(false);
        setIsExiting(false);
        setNotification(null);
        currentNotificationIdRef.current = null;
      }
      // Sau khi thông báo hiện tại đóng, chỉ duy trì vòng lặp nếu marketing FOMO vẫn đang BẬT
      const activeCfg = marketingService.getConfig();
      if (activeCfg.isEnabled) {
        const nextDelay = marketingService.hasPendingRealEvent() ? 1200 : 1500;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => scheduleRef.current(), nextDelay);
      }
    }, 300);
  }, []);

  // Mute notifications for 1 hour (3600 seconds)
  const snoozeForOneHour = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      const until = Date.now() + 60 * 60 * 1000;
      localStorage.setItem(MARKETING_SNOOZE_KEY, String(until));
    } catch {}
    dismissNotification();
  }, [dismissNotification]);

  // Display a notification
  const displayNotification = useCallback((notif: MarketingNotification, customDurationMs?: number) => {
    if (isSnoozed()) return;
    const isTest = Boolean(notif.id && notif.id.startsWith('test_'));
    if (!isTest && !marketingService.isTypeEnabled(notif.type, notif.itemType)) return;

    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    // Safety guard: ensure not a deleted or unlisted product
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

    if (notif.type === 'BUY_PRODUCT' && notif.productId) {
      if (deletedStoreSet.has(notif.productId) || deletedUtilSet.has(notif.productId)) {
        return;
      }
    }
    if (notif.type === 'CLAIM_GIVEAWAY' && notif.giveawayId) {
      if (deletedGwSet.has(notif.giveawayId)) {
        return;
      }
    }

    const finalNotif = marketingService.sanitizeNotificationMasking(notif);

    setNotification(finalNotif);
    currentNotificationIdRef.current = finalNotif.id || null;
    setIsVisible(true);
    setIsExiting(false);

    // Mark as processed in marketingService so it is NEVER duplicated or replayed
    if (finalNotif.id) {
      marketingService.markNotificationProcessed(finalNotif.id);
    }

    // Luôn ưu tiên tăng giảm số lượng của web theo thông báo nổ (bảo toàn 1 - 1 tuyệt đối cho cả thật và ảo):
    marketingService.recordToastFiredTime();
    if (notif.type === 'BUY_PRODUCT' && notif.productId) {
      if (!(notif as any).localOrigin) {
        marketingService.recordVirtualSale(notif.productId, notif.id);
      }
    } else if (notif.type === 'CLAIM_GIVEAWAY' && (notif.giveawayId || notif.productId)) {
      const gwId = notif.giveawayId || notif.productId;
      if (gwId && !(notif as any).localOrigin) {
        marketingService.recordVirtualGiveawayClaim(gwId, notif.id);
      }
    } else if (notif.type === 'COPY_CODE') {
      if (!(notif as any).localOrigin) {
        marketingService.incrementLiveCounter(1, notif.id);
      }
    }

    const config = marketingService.getConfig();
    const defaultDuration = Math.max(3, config.displayDuration || 5) * 1000;
    const duration = customDurationMs !== undefined ? customDurationMs : defaultDuration;

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isHoveredRef.current) {
        dismissNotification();
      }
    }, duration);
  }, [dismissNotification, isSnoozed]);

  // Helper to fetch current datasets
  const getDatasets = useCallback(() => {
    const games = typeof dataService.getGames === 'function' ? dataService.getGames() : [];
    const storeProducts = typeof dataService.getStoreProducts === 'function' ? dataService.getStoreProducts() : [];
    const utilityProducts = typeof dataService.getUtilityProducts === 'function' ? dataService.getUtilityProducts() : [];
    const giveaways = typeof dataService.getGiveaways === 'function' ? dataService.getGiveaways().filter((g) => g && g.is_active !== false) : [];
    let inventory: any[] = [];
    try {
      const invRaw = localStorage.getItem('wcg_admin_inventory_v4');
      if (invRaw) inventory = JSON.parse(invRaw);
    } catch {}
    return { games, storeProducts, utilityProducts, giveaways, inventory };
  }, []);

  // Globally Synchronized Deterministic Slot Scheduler
  const scheduleDeterministicSlot = useCallback(() => {
    try {
      const config = marketingService.getConfig();
      if (!config.isEnabled) return;
      if (isTabHiddenRef.current) return;
      if (isSnoozed()) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => scheduleRef.current(), 30000);
        return;
      }

      const now = marketingService.getCalibratedNow();

      // =========================================================================
      // 1. REAL USER EVENTS (Luồng thông báo riêng cho Người Dùng Thật - Top Priority)
      // =========================================================================
      if (marketingService.hasPendingRealEvent()) {
        const nextRealEvent = marketingService.peekRealEvent();
        if (nextRealEvent) {
          const evtTimeMs = Number(nextRealEvent.scheduledFireTime) || Number(nextRealEvent.timestamp) || now;
          const displayDurationMs = Math.max(3, Number(config.displayDuration) || 5) * 1000;

          // Case 1: Event was created more than 180s ago -> discard stale event
          if (now - evtTimeMs > 180000) {
            marketingService.popRealEvent();
            if (nextRealEvent.id) marketingService.markNotificationProcessed(nextRealEvent.id);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => scheduleRef.current(), 50);
            return;
          }

          // Case 2: Fresh real user event -> NỔ LUÔN LẬP TỨC (0s delay)!
          marketingService.popRealEvent();
          const datasets = getDatasets();
          let isValid = true;

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

          if (nextRealEvent.type === 'BUY_PRODUCT' && nextRealEvent.productId) {
            if (deletedStoreSet.has(nextRealEvent.productId) || deletedUtilSet.has(nextRealEvent.productId)) {
              isValid = false;
            } else {
              const storeProd = (datasets.storeProducts || []).find((p) => p && p.id === nextRealEvent.productId);
              const utilProd = (datasets.utilityProducts || []).find((u) => u && u.id === nextRealEvent.productId);
              const prod = storeProd || utilProd;
              if (prod && prod.is_active === false) {
                isValid = false;
              }
            }
          } else if (nextRealEvent.type === 'CLAIM_GIVEAWAY' && nextRealEvent.giveawayId) {
            if (deletedGwSet.has(nextRealEvent.giveawayId)) {
              isValid = false;
            } else {
              const gw = (datasets.giveaways || []).find((g) => g && g.id === nextRealEvent.giveawayId);
              if (gw && gw.is_active === false) {
                isValid = false;
              }
            }
          }

          if (isValid && !marketingService.isTypeEnabled(nextRealEvent.type, nextRealEvent.itemType)) {
            isValid = false;
          }

          if (isValid) {
            nextRealEvent.isRealUser = true;
            displayNotification(nextRealEvent, displayDurationMs);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => scheduleRef.current(), displayDurationMs + 1500);
            return;
          } else {
            if (nextRealEvent.id) marketingService.markNotificationProcessed(nextRealEvent.id);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => scheduleRef.current(), 50);
            return;
          }
        }
      }
      const slotDuration = marketingService.getSlotDurationMs(now);
      const slotIndex = Math.floor(now / slotDuration);
      const slotStartMs = slotIndex * slotDuration;
      const datasets = getDatasets();

      // Check notification for current time-slot
      const currentSlotData = marketingService.getDeterministicNotification(
        slotStartMs,
        datasets.games,
        datasets.storeProducts,
        datasets.inventory,
        datasets.utilityProducts,
        datasets.giveaways
      );

      if (currentSlotData) {
        const { notif, fireTimeMs, displayDurationMs } = currentSlotData;
        const endTimeMs = fireTimeMs + displayDurationMs;
        const isAlreadyProcessed = notif.id ? marketingService.isNotificationProcessed(notif.id) : false;

        // 1. Toast is scheduled in the future of the current slot
        if (now < fireTimeMs && !isAlreadyProcessed) {
          const waitMs = Math.max(50, fireTimeMs - now);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            // Hiển thị đồng bộ 100% theo PRNG Dòng thời gian Unix UTC
            displayNotification(notif, displayDurationMs);
            const nextSlotStartMs = (slotIndex + 1) * slotDuration;
            const timeUntilNextSlot = Math.max(100, nextSlotStartMs - marketingService.getCalibratedNow());
            timerRef.current = setTimeout(() => {
              scheduleRef.current();
            }, timeUntilNextSlot);
          }, waitMs);
          return;
        }

        // 2. Toast is actively live right now in current slot
        if (now >= fireTimeMs && now < endTimeMs && !isAlreadyProcessed) {
          const remainingDisplayMs = Math.max(1000, endTimeMs - now);
          const timeSinceLastDismiss = Date.now() - lastToastDismissedTimeRef.current;
          if (remainingDisplayMs >= 2000 && timeSinceLastDismiss >= 3000) {
            if (currentNotificationIdRef.current !== notif.id) {
              displayNotification(notif, remainingDisplayMs);
            }
          }

          const nextSlotStartMs = (slotIndex + 1) * slotDuration;
          const timeUntilNextSlot = Math.max(100, nextSlotStartMs - marketingService.getCalibratedNow());
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            scheduleRef.current();
          }, timeUntilNextSlot);
          return;
        }
      }

      // 3. Past current slot window -> wait until exact next slot start
      const nextSlotStartMs = (slotIndex + 1) * slotDuration;
      const waitToNextSlotMs = Math.max(100, nextSlotStartMs - now);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => scheduleRef.current(), waitToNextSlotMs);
    } catch (err) {
      console.warn('[MarketingToast] Error scheduling deterministic slot:', err);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => scheduleRef.current(), 15000);
    }
  }, [displayNotification, getDatasets, isSnoozed]);

  // Stable reference for timer loops
  const scheduleRef = useRef<() => void>(() => {});
  scheduleRef.current = scheduleDeterministicSlot;

  // Handle visibility changes (Pause when tab hidden, re-sync to exact clock slot on resume)
  useEffect(() => {
    const handleVisibility = () => {
      isTabHiddenRef.current = document.visibilityState === 'hidden';
      if (isTabHiddenRef.current) {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
        // Immediately sync to the deterministic slot when user returns to tab
        scheduleRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Subscribe to real actions (local or broadcast)
  useEffect(() => {
    const unsubscribe = marketingService.subscribeNotification((event) => {
      if (event && !isTabHiddenRef.current && !isSnoozed()) {
        const config = marketingService.getConfig();
        const displayDurationMs = Math.max(3, Number(config.displayDuration) || 5) * 1000;
        displayNotification(event, displayDurationMs);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          scheduleRef.current();
        }, displayDurationMs + 1500);
      }
    });
    return () => unsubscribe();
  }, [displayNotification, isSnoozed]);

  // Listen for real events arriving from poller or edge sync (Luồng Người Dùng Thật)
  useEffect(() => {
    const handleNewRealEvents = () => {
      if (isTabHiddenRef.current || isSnoozed()) return;
      // If currently showing a simulated system event, dismiss it and display real user event after smooth transition!
      const currId = currentNotificationIdRef.current;
      const isSimulatedSystemEvent = currId && currId.startsWith('slot_');
      if (isSimulatedSystemEvent) {
        dismissNotification();
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => scheduleRef.current(), 320);
      } else if (!currId) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => scheduleRef.current(), 50);
      }
    };

    window.addEventListener('wcg_new_real_events_available', handleNewRealEvents);
    return () => window.removeEventListener('wcg_new_real_events_available', handleNewRealEvents);
  }, [dismissNotification, isSnoozed]);

  // Initial startup: calibrate with server atomic time, trigger welcome toast & kick off deterministic schedule
  useEffect(() => {
    const config = marketingService.getConfig();
    if (!config.isEnabled) return;

    let isMounted = true;

    // 1. Initial Welcome Toast: Kích hoạt ngay sau initialDelay để tạo độ sôi động tức thì
    const initDelaySec = Math.max(1, Math.min(60, Number(config.initialDelay) || 3));
    initialWelcomeTimerRef.current = setTimeout(() => {
      if (!isMounted || isTabHiddenRef.current || isSnoozed()) return;
      if (!marketingService.getConfig().isEnabled) return;
      if (!currentNotificationIdRef.current) {
        const datasets = getDatasets();
        const welcomeData = marketingService.getDeterministicNotification(
          marketingService.getCalibratedNow(),
          datasets.games,
          datasets.storeProducts,
          datasets.inventory,
          datasets.utilityProducts,
          datasets.giveaways
        );
        if (welcomeData && welcomeData.notif) {
          // Welcome toast dynamically rotates a fresh random virtual account from the configured 90 pool
          const welcomeAcc = marketingService.getRandomVirtualAccount();
          const maskedWelcomeAcc = marketingService.maskName(welcomeAcc);
          if (welcomeData.notif.userName && welcomeData.notif.message && welcomeData.notif.message.includes(welcomeData.notif.userName)) {
            welcomeData.notif.message = welcomeData.notif.message.replace(welcomeData.notif.userName, maskedWelcomeAcc);
          }
          welcomeData.notif.userName = maskedWelcomeAcc;
          displayNotification(welcomeData.notif, welcomeData.displayDurationMs);
        }
      }
    }, initDelaySec * 1000);

    // 2. Calibrate atomic clock and sync stats immediately from edge server
    fetch('/api/stats', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        if (data && typeof data.server_time === 'number') {
          marketingService.calibrateServerTime(data.server_time);
        }
        if (data && (typeof data.master_copy_clicks === 'number' || data.real_product_sold_counts || data.real_giveaway_claimed_counts || data.peak_product_sold_counts)) {
          marketingService.syncFromHub(
            undefined,
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
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          scheduleRef.current();
        }
      });

    return () => {
      isMounted = false;
      if (initialWelcomeTimerRef.current) clearTimeout(initialWelcomeTimerRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [displayNotification, getDatasets, isSnoozed]);

  // Listen for config updates or manual test triggers
  useEffect(() => {
    const handleConfigUpdate = () => {
      const newConfig = marketingService.getConfig();
      if (!newConfig.isEnabled) {
        if (initialWelcomeTimerRef.current) {
          clearTimeout(initialWelcomeTimerRef.current);
          initialWelcomeTimerRef.current = null;
        }
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
        dismissNotification();
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
        scheduleRef.current();
      }
    };

    const handleTestTrigger = () => {
      const datasets = getDatasets();
      const testNotif = marketingService.generateNextNotification(
        datasets.games,
        datasets.storeProducts,
        datasets.inventory,
        datasets.utilityProducts,
        datasets.giveaways
      );
      if (testNotif) displayNotification(testNotif);
    };

    window.addEventListener('wcg_marketing_config_updated', handleConfigUpdate);
    window.addEventListener('storage', handleConfigUpdate);
    window.addEventListener('wcg_trigger_marketing_test', handleTestTrigger);

    return () => {
      window.removeEventListener('wcg_marketing_config_updated', handleConfigUpdate);
      window.removeEventListener('storage', handleConfigUpdate);
      window.removeEventListener('wcg_trigger_marketing_test', handleTestTrigger);
    };
  }, [dismissNotification, displayNotification, getDatasets]);

  // Handle click on the toast
  const handleClickToast = () => {
    if (!notification) return;

    if (notification.type === 'COPY_CODE' && notification.gameSlug) {
      onSelectGameSlug?.(notification.gameSlug);
      dismissNotification();
    } else if (notification.type === 'BUY_PRODUCT' && notification.productId) {
      if (notification.itemType === 'utility') {
        onSelectUtility ? onSelectUtility(notification.productId) : onSelectProduct?.(notification.productId);
      } else {
        onSelectProduct?.(notification.productId);
      }
      dismissNotification();
    } else if (notification.type === 'CLAIM_GIVEAWAY' && notification.giveawayId) {
      if (onSelectGiveaway) {
        onSelectGiveaway(notification.giveawayId);
      } else {
        onExploreClick?.();
      }
      dismissNotification();
    } else if (notification.type === 'DEPOSIT_WALLET') {
      onOpenWallet?.();
      dismissNotification();
    } else if (notification.type === 'STATS_COPY') {
      onExploreClick?.();
      dismissNotification();
    }
  };

  if (!notification || !isVisible || !marketingService.getConfig().isEnabled) return null;
  if (typeof document === 'undefined') return null;

  // Icon & Theme per notification type
  const getTypeMeta = () => {
    switch (notification.type) {
      case 'COPY_CODE':
        return {
          icon: Gift,
          badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          dotColor: 'bg-emerald-400',
          hoverBorder: 'hover:border-emerald-500/50',
        };
      case 'BUY_PRODUCT':
        if (notification.itemType === 'utility') {
          return {
            icon: Wrench,
            badgeColor: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
            dotColor: 'bg-teal-400',
            hoverBorder: 'hover:border-teal-500/50',
          };
        }
        return {
          icon: ShoppingBag,
          badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
          dotColor: 'bg-indigo-400',
          hoverBorder: 'hover:border-indigo-500/50',
        };
      case 'CLAIM_GIVEAWAY':
        return {
          icon: Flame,
          badgeColor: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          dotColor: 'bg-rose-400',
          hoverBorder: 'hover:border-rose-500/50',
        };
      case 'DEPOSIT_WALLET':
        return {
          icon: Wallet,
          badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          dotColor: 'bg-amber-400',
          hoverBorder: 'hover:border-amber-500/50',
        };
      case 'STATS_COPY':
      default:
        return {
          icon: Zap,
          badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
          dotColor: 'bg-cyan-400',
          hoverBorder: 'hover:border-cyan-500/50',
        };
    }
  };

  const meta = getTypeMeta();
  const IconComponent = meta.icon;

  return (
    <div
      role="alert"
      aria-live="polite"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        const config = marketingService.getConfig();
        const duration = Math.max(2, config.displayDuration || 4) * 1000;
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(dismissNotification, duration);
      }}
      onClick={handleClickToast}
      className={`fixed bottom-20 left-3 right-3 sm:right-auto sm:bottom-6 sm:left-6 z-[95] pointer-events-auto sm:max-w-sm w-auto box-border overflow-hidden transition-all duration-300 select-none cursor-pointer ${
        isExiting
          ? 'opacity-0 translate-y-2 pointer-events-none'
          : 'opacity-100 translate-y-0'
      }`}
      style={{
        maxWidth: 'calc(100vw - 24px)',
        contain: 'paint layout',
        willChange: 'transform, opacity',
      }}
    >
      <div
        className={`relative flex items-start gap-2.5 p-3 rounded-2xl bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl ${meta.hoverBorder} transition-all duration-200 group overflow-hidden active:scale-[0.98] w-full max-w-full box-border min-h-[76px] sm:min-h-[80px]`}
      >
        {/* Subtle accent highlight line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        />

        {/* Icon Avatar */}
        <div className="relative shrink-0">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border shadow-sm ${meta.badgeColor}`}
          >
            <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          {/* Pulsing online dot */}
          <span
            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${meta.dotColor} ring-2 ring-card animate-pulse`}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-4 overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 mb-0.5">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-tight text-foreground truncate flex items-center gap-1 min-w-0">
              <span className="truncate">{notification.title}</span>
              <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
            </span>
            <span
              className="text-[9px] sm:text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded-md text-muted-foreground bg-muted/60"
            >
              {notification.timeAgo}
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug line-clamp-2 break-words break-all font-medium overflow-hidden">
            {notification.message}
          </p>

          {/* Interactive Action Hint & Snooze Option */}
          <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-border/40 min-w-0">
            <div className="flex items-center gap-0.5 text-[10px] sm:text-[11px] text-primary-light font-semibold group-hover:underline shrink-0">
              <span>Xem chi tiết</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>

            <button
              type="button"
              onClick={snoozeForOneHour}
              className="text-[9px] sm:text-[10px] text-muted-foreground/80 hover:text-foreground hover:bg-muted/70 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer shrink-0 truncate max-w-[140px]"
              title="Tắt thông báo nổi trên màn hình trong 1 giờ"
            >
              <BellOff className="w-2.5 h-2.5 shrink-0" />
              <span className="hidden sm:inline">Không hiện 1h</span>
              <span className="sm:hidden">Tắt 1h</span>
            </button>
          </div>
        </div>

        {/* Close Button (✕) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismissNotification();
          }}
          className="absolute top-2 right-2 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
          title="Đóng thông báo"
          aria-label="Đóng thông báo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
