import {
  calculateGlobalSnapshot,
  GlobalMetricsSnapshot,
  ProductInput,
  GiveawayInput,
} from '../../src/shared/deterministicEngine';
import {
  ensureSchemaUpgrades,
  getSettingD1,
  loadAllStoreProductsD1,
  loadAllUtilitiesD1,
  loadAllGiveawaysD1,
} from './d1_service';
import { getRealEventsHub, saveRealEventsHub } from './realEventsHub';

const SNAPSHOT_ROW_ID = 'GLOBAL_REALTIME_SNAPSHOT';
export const SNAPSHOT_REFRESH_INTERVAL_MS = 10000; // 10 seconds

// In-memory isolate cache to prevent redundant D1 reads across rapid requests in the same isolate
const globalScope = globalThis as any;
if (!globalScope.__wcg_metrics_snapshot) {
  globalScope.__wcg_metrics_snapshot = null;
  globalScope.__wcg_metrics_snapshot_syncing = false;
}

export function safeParseJson<T = any>(val: any): T | null {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

/**
 * Fetch products and utilities from D1 with authoritative COUNT(inventory_codes AVAILABLE) priority
 */
async function loadProducts(env: any): Promise<ProductInput[]> {
  if (env && env.DB) {
    try {
      await ensureSchemaUpgrades(env.DB);
      const [spList, utList] = await Promise.all([
        loadAllStoreProductsD1(env.DB).catch((e) => { console.warn('sp error:', e?.message); return []; }),
        loadAllUtilitiesD1(env.DB).catch((e) => { console.warn('ut error:', e?.message); return []; }),
      ]);

      const items: ProductInput[] = [];
      const seenIds = new Set<string>();

      const addItems = (list: any[]) => {
        if (!Array.isArray(list)) return;
        for (const r of list) {
          if (!r || !r.id || seenIds.has(r.id)) continue;
          seenIds.add(r.id);

          items.push({
            id: r.id,
            title: r.title,
            stock_quantity: Math.max(0, Number(r.stock_quantity) || 0),
            sold_count: Math.max(0, Number(r.sold_count) || 0),
            virtual_sold_count: Math.max(0, Number(r.virtual_sold_count) || 0),
            created_at: r.created_at || r.createdAt,
            is_active: r.is_active === 1 || r.is_active === true,
          });
        }
      };

      addItems(spList);
      addItems(utList);
      return items;
    } catch (e: any) {
      console.warn('[SnapshotService] Error reading store_products and utilities from D1:', e?.message);
    }
  }

  return [];
}

/**
 * Fetch giveaways from D1 with authoritative COUNT(giveaway_codes AVAILABLE) priority
 */
async function loadGiveaways(env: any): Promise<GiveawayInput[]> {
  // Authoritative: Đọc từ Cloudflare D1
  if (env && env.DB) {
    try {
      await ensureSchemaUpgrades(env.DB);
      const gwList = await loadAllGiveawaysD1(env.DB).catch((e) => { console.warn('gw error:', e?.message); return []; });
      if (Array.isArray(gwList)) {
        return gwList
          .filter((gw: any) => gw && gw.id && (gw.status === 'ACTIVE' || gw.is_active !== false))
          .map((gw: any) => ({
            id: gw.id,
            title: gw.title,
            remaining_codes: Math.max(0, Number(gw.remaining_codes) || 0),
            total_codes: Math.max(0, Number(gw.total_codes) || 0),
            claimed_codes: Math.max(0, Number(gw.claimed_codes) || 0),
            virtual_claimed_offset: Math.max(0, Number(gw.virtual_claimed_offset) || 0),
            created_at: gw.created_at || gw.createdAt,
            status: gw.status || 'ACTIVE',
            is_active: gw.status === 'ACTIVE' || gw.is_active === true,
          }));
      }
    } catch (e: any) {
      console.warn('[SnapshotService] Error reading giveaways from D1:', e?.message);
    }
  }

  return [];
}

/**
 * Build and save a fresh snapshot into D1
 */
export async function generateAndPersistSnapshot(env: any): Promise<GlobalMetricsSnapshot> {
  const now = Date.now();

  // 1. Gather all inputs
  const [products, giveaways, hub, marketingConfigRaw] = await Promise.all([
    loadProducts(env),
    loadGiveaways(env),
    getRealEventsHub(env).catch(() => ({
      masterCopyClicks: 0,
      realProductSoldCounts: {},
      realGiveawayClaimedCounts: {},
    })),
    env.DB ? getSettingD1(env.DB, 'wcg_marketing_config_v1') : null,
  ]);
  let marketingConfig = safeParseJson<any>(marketingConfigRaw);
  if (!marketingConfig && env.DB) {
    try {
      const masterRaw = await getSettingD1(env.DB, 'wcg_master_state_v4');
      const masterParsed = safeParseJson<any>(masterRaw);
      if (masterParsed?.marketingConfig) {
        marketingConfig = masterParsed.marketingConfig;
      }
    } catch {}
  }

  // 1.5. Cleanse runaway peaks in hub only if values are corrupted (> 1,000,000 or NaN)
  let hubModified = false;
  if (hub.peakProductSoldCounts && typeof hub.peakProductSoldCounts === 'object') {
    for (const [pId, val] of Object.entries(hub.peakProductSoldCounts)) {
      const numVal = Number(val);
      if (isNaN(numVal) || numVal < 0 || numVal > 1000000) {
        delete hub.peakProductSoldCounts[pId];
        hubModified = true;
      }
    }
  }

  if (hub.peakGiveawayClaimedCounts && typeof hub.peakGiveawayClaimedCounts === 'object') {
    for (const [gId, val] of Object.entries(hub.peakGiveawayClaimedCounts)) {
      const numVal = Number(val);
      if (isNaN(numVal) || numVal < 0 || numVal > 1000000) {
        delete hub.peakGiveawayClaimedCounts[gId];
        hubModified = true;
      }
    }
  }

  // 1.6. Cleanse lowestProductStock in hub (prevent stale inflated cache from older configurations)
  if (hub.lowestProductStock && typeof hub.lowestProductStock === 'object') {
    const prodMap = new Map((products || []).map(p => [p.id, p]));
    for (const [pId, val] of Object.entries(hub.lowestProductStock)) {
      const prod = prodMap.get(pId);
      const realStock = Math.max(0, Number(prod?.stock_quantity) || 0);
      const pw = marketingConfig?.productWeights?.[pId];
      const virtualBonus = pw?.virtualStockBonus !== undefined ? Number(pw.virtualStockBonus) : 20;
      const threshold = pw?.autoRestockThreshold !== undefined ? Number(pw.autoRestockThreshold) : 1;
      const restockAmount = pw?.autoRestockAmount !== undefined ? Number(pw.autoRestockAmount) : 20;
      const priority = pw?.priority || 'normal';
      const effectiveThreshold = (realStock > 0 && threshold < realStock) ? realStock : threshold;
      const maxAllowedStock = (priority === 'off' || virtualBonus <= 0)
        ? realStock
        : Math.max(realStock + virtualBonus, effectiveThreshold + restockAmount);

      const numVal = Number(val);
      if (realStock <= 0) {
        delete hub.lowestProductStock[pId];
        hubModified = true;
      } else if (numVal > maxAllowedStock || numVal <= 0) {
        hub.lowestProductStock[pId] = maxAllowedStock;
        hubModified = true;
      }
    }
  }

  // 1.7. Cleanse lowestGiveawayRemaining in hub
  if (hub.lowestGiveawayRemaining && typeof hub.lowestGiveawayRemaining === 'object') {
    const gwMap = new Map((giveaways || []).map(g => [g.id, g]));
    for (const [gId, val] of Object.entries(hub.lowestGiveawayRemaining)) {
      const gw = gwMap.get(gId);
      const realRemaining = Math.max(0, Number(gw?.remaining_codes) || 0);
      const pw = marketingConfig?.productWeights?.[gId];
      const virtualBonus = pw?.virtualStockBonus !== undefined ? Number(pw.virtualStockBonus) : 20;
      const threshold = pw?.autoRestockThreshold !== undefined ? Number(pw.autoRestockThreshold) : 1;
      const restockAmount = pw?.autoRestockAmount !== undefined ? Number(pw.autoRestockAmount) : 20;
      const priority = pw?.priority || 'normal';
      const effectiveThreshold = (realRemaining > 0 && threshold < realRemaining) ? realRemaining : threshold;
      const maxAllowedRemaining = (priority === 'off' || virtualBonus <= 0)
        ? realRemaining
        : Math.max(realRemaining + virtualBonus, effectiveThreshold + restockAmount);

      const numVal = Number(val);
      if (realRemaining <= 0) {
        delete hub.lowestGiveawayRemaining[gId];
        hubModified = true;
      } else if (numVal > maxAllowedRemaining || numVal <= 0) {
        hub.lowestGiveawayRemaining[gId] = maxAllowedRemaining;
        hubModified = true;
      }
    }
  }

  if (hubModified && env && env.DB) {
    try {
      await saveRealEventsHub(env, hub, true);
    } catch (e: any) {
      console.warn('[SnapshotService] Failed to persist cleansed hub:', e?.message);
    }
  }

  // 2. Compute canonical snapshot using universal deterministic engine
  const snapshot = calculateGlobalSnapshot(
    {
      products,
      giveaways,
      masterCopyClicks: hub.masterCopyClicks || 0,
      realProductSoldCounts: hub.realProductSoldCounts || {},
      realGiveawayClaimedCounts: hub.realGiveawayClaimedCounts || {},
      peakProductSoldCounts: hub.peakProductSoldCounts || {},
      peakGiveawayClaimedCounts: hub.peakGiveawayClaimedCounts || {},
      peakCopyClicks: hub.peakCopyClicks || 0,
      lowestProductStock: hub.lowestProductStock || {},
      lowestGiveawayRemaining: hub.lowestGiveawayRemaining || {},
      productWeights: marketingConfig?.productWeights || {},
      offlineCatchUp: marketingConfig?.offlineCatchUp,
    },
    now
  );

  // 3. Update memory isolate cache
  globalScope.__wcg_metrics_snapshot = snapshot;

  // 4. Persist to D1 system_snapshots table
  if (env && env.DB) {
    try {
      await ensureSchemaUpgrades(env.DB);
      const payloadStr = JSON.stringify(snapshot);
      await env.DB.prepare(
        `INSERT INTO system_snapshots (id, payload, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`
      )
        .bind(SNAPSHOT_ROW_ID, payloadStr, now)
        .run();
    } catch (dbErr: any) {
      console.warn('[SnapshotService] Failed to persist snapshot to D1:', dbErr?.message);
    }
  }

  return snapshot;
}

/**
 * Get the latest Snapshot with single-flight mutex & Stale-While-Revalidate protection
 */
export async function getOrRefreshSnapshot(
  env: any,
  waitUntil?: (promise: Promise<any>) => void
): Promise<GlobalMetricsSnapshot> {
  const now = Date.now();

  // 1. Check in-memory isolate cache
  let cached: GlobalMetricsSnapshot | null = globalScope.__wcg_metrics_snapshot;

  // 2. If memory cache empty, attempt to read existing snapshot from D1
  if (!cached && env && env.DB) {
    try {
      await ensureSchemaUpgrades(env.DB);
      const row = await env.DB.prepare(
        'SELECT payload, updated_at FROM system_snapshots WHERE id = ?'
      )
        .bind(SNAPSHOT_ROW_ID)
        .first();

      if (row && row.payload) {
        cached = safeParseJson<GlobalMetricsSnapshot>(row.payload);
        if (cached) {
          globalScope.__wcg_metrics_snapshot = cached;
        }
      }
    } catch (e: any) {
      console.warn('[SnapshotService] Error reading snapshot from D1:', e?.message);
    }
  }

  // 3. Check if cached snapshot is still fresh (under 60s old)
  if (cached && now - (cached.updated_at || 0) < SNAPSHOT_REFRESH_INTERVAL_MS) {
    return cached;
  }

  // 4. If stale, handle single-flight concurrency lock to prevent SQLITE_BUSY
  if (globalScope.__wcg_metrics_snapshot_syncing) {
    // Another request in this isolate is already revalidating -> return cached stale copy immediately
    if (cached) return cached;
  }

  // If we have a cached copy and waitUntil is available: return stale copy now and revalidate in background!
  if (cached && waitUntil) {
    globalScope.__wcg_metrics_snapshot_syncing = true;
    const backgroundTask = (async () => {
      try {
        await generateAndPersistSnapshot(env);
      } finally {
        globalScope.__wcg_metrics_snapshot_syncing = false;
      }
    })();
    waitUntil(backgroundTask);
    return cached;
  }

  // Otherwise, synchronous revalidation (e.g. first boot or cold start)
  globalScope.__wcg_metrics_snapshot_syncing = true;
  try {
    return await generateAndPersistSnapshot(env);
  } finally {
    globalScope.__wcg_metrics_snapshot_syncing = false;
  }
}
