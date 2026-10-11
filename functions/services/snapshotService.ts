import {
  calculateGlobalSnapshot,
  GlobalMetricsSnapshot,
  ProductInput,
  GiveawayInput,
} from '../../src/shared/deterministicEngine';
import { ensureSchemaUpgrades, getSettingD1 } from './d1_service';
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
      const [spRes, utRes] = await Promise.all([
        env.DB.prepare(`
          SELECT 
            sp.id, 
            sp.title, 
            sp.created_at, 
            sp.is_active,
            COALESCE(sp.virtual_sold_count, 0) AS virtual_sold_count,
            sp.stock_quantity AS counter_stock,
            (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = sp.id AND ic.status = 'AVAILABLE') AS avail_count,
            (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = sp.id) AS total_inv_count,
            CASE 
              WHEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = sp.id) > 0 
              THEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = sp.id AND ic.status = 'AVAILABLE')
              ELSE sp.stock_quantity 
            END AS stock_quantity,
            CASE 
              WHEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = sp.id) > 0 
              THEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = sp.id AND ic.status = 'SOLD')
              ELSE sp.sold_count 
            END AS sold_count
          FROM store_products sp
          WHERE sp.is_active = 1
        `).all().catch(() => ({ results: [] })),
        env.DB.prepare(`
          SELECT 
            u.id, 
            u.title, 
            u.created_at, 
            u.is_active,
            COALESCE(u.virtual_sold_count, 0) AS virtual_sold_count,
            u.stock_quantity AS counter_stock,
            (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = u.id AND ic.status = 'AVAILABLE') AS avail_count,
            (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = u.id) AS total_inv_count,
            CASE 
              WHEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = u.id) > 0 
              THEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = u.id AND ic.status = 'AVAILABLE')
              ELSE u.stock_quantity 
            END AS stock_quantity,
            CASE 
              WHEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = u.id) > 0 
              THEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = u.id AND ic.status = 'SOLD')
              ELSE u.sold_count 
            END AS sold_count
          FROM utilities u
          WHERE u.is_active = 1
        `).all().catch(() => ({ results: [] })),
      ]);

      const items: ProductInput[] = [];
      const seenIds = new Set<string>();

      const processRows = (rows: any[], source: string) => {
        if (!Array.isArray(rows)) return;
        for (const r of rows) {
          if (!r || !r.id || seenIds.has(r.id)) continue;
          seenIds.add(r.id);

          // Cảnh báo nếu counter lệch với COUNT(inventory_codes AVAILABLE)
          if (r.total_inv_count > 0 && r.counter_stock !== r.avail_count) {
            console.warn(`[Stock Drift Warning] ${source} '${r.id}' counter (${r.counter_stock}) differs from COUNT available (${r.avail_count}). Prioritizing COUNT.`);
          }

          items.push({
            id: r.id,
            title: r.title,
            stock_quantity: Math.max(0, Number(r.stock_quantity) || 0),
            sold_count: Math.max(0, Number(r.sold_count) || 0),
            virtual_sold_count: Math.max(0, Number(r.virtual_sold_count) || 0),
            created_at: r.created_at,
            is_active: r.is_active === 1,
          });
        }
      };

      processRows(spRes?.results || [], 'store_products');
      processRows(utRes?.results || [], 'utilities');

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
      const res = await env.DB.prepare(`
        SELECT 
          id, 
          title, 
          max_per_user, 
          status, 
          created_at,
          COALESCE(virtual_claimed_offset, 0) AS virtual_claimed_offset,
          CASE 
            WHEN (SELECT COUNT(*) FROM giveaway_codes gc WHERE gc.giveaway_id = giveaways.id) > 0 
            THEN (SELECT COUNT(*) FROM giveaway_codes gc WHERE gc.giveaway_id = giveaways.id AND gc.status = 'CLAIMED')
            ELSE claimed_codes 
          END AS claimed_codes,
          CASE 
            WHEN (SELECT COUNT(*) FROM giveaway_codes gc WHERE gc.giveaway_id = giveaways.id) > 0 
            THEN (SELECT COUNT(*) FROM giveaway_codes gc WHERE gc.giveaway_id = giveaways.id AND gc.status = 'AVAILABLE')
            ELSE 0 
          END AS remaining_codes,
          CASE 
            WHEN (SELECT COUNT(*) FROM giveaway_codes gc WHERE gc.giveaway_id = giveaways.id) > 0 
            THEN (SELECT COUNT(*) FROM giveaway_codes gc WHERE gc.giveaway_id = giveaways.id)
            ELSE total_codes 
          END AS total_codes
        FROM giveaways 
        WHERE status = 'ACTIVE'
      `).all();

      if (res && Array.isArray(res.results) && res.results.length > 0) {
        return res.results.map((r: any) => ({
          id: r.id,
          title: r.title,
          remaining_codes: Math.max(0, Number(r.remaining_codes) || 0),
          total_codes: Math.max(0, Number(r.total_codes) || 0),
          claimed_codes: Math.max(0, Number(r.claimed_codes) || 0),
          virtual_claimed_offset: Math.max(0, Number(r.virtual_claimed_offset) || 0),
          created_at: r.created_at,
          status: r.status,
          is_active: r.status === 'ACTIVE',
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
  const marketingConfig = safeParseJson<any>(marketingConfigRaw);

  // 1.5. Cleanse runaway peaks in hub if items are out of stock or peaks exceed reasonable cap
  const oosEnabled = Boolean(marketingConfig?.offlineCatchUp?.outOfStockEnabled);
  const oosMax = Math.max(1, Number(marketingConfig?.offlineCatchUp?.outOfStockMaxUnits) || 10);
  let hubModified = false;
  if (hub.peakProductSoldCounts && typeof hub.peakProductSoldCounts === 'object') {
    const prodMap = new Map((products || []).map(p => [p.id, p]));
    for (const [pId, val] of Object.entries(hub.peakProductSoldCounts)) {
      const prod = prodMap.get(pId);
      const realStock = Math.max(0, Number(prod?.stock_quantity) || 0);
      const virtualBase = Number(prod?.virtual_sold_count) || 0;
      const realSold = Number(prod?.sold_count) || 0;
      const maxAllowed = realStock <= 0 && oosEnabled
        ? realSold + virtualBase + oosMax
        : realSold + virtualBase + (Number(marketingConfig?.offlineCatchUp?.maxCatchUpUnits) || 70) + 10;
      if ((realStock <= 0 && !oosEnabled) || val > maxAllowed) {
        delete hub.peakProductSoldCounts[pId];
        hubModified = true;
      }
    }
  }

  if (hub.peakGiveawayClaimedCounts && typeof hub.peakGiveawayClaimedCounts === 'object') {
    const gwMap = new Map((giveaways || []).map(g => [g.id, g]));
    for (const [gId, val] of Object.entries(hub.peakGiveawayClaimedCounts)) {
      const gw = gwMap.get(gId);
      const realRemaining = Math.max(0, Number(gw?.remaining_codes) || 0);
      const virtualBase = Number(gw?.virtual_claimed_offset) || 0;
      const realClaimed = Number(gw?.claimed_codes) || 0;
      const maxAllowed = realRemaining <= 0 && oosEnabled
        ? realClaimed + virtualBase + oosMax
        : realClaimed + virtualBase + (Number(marketingConfig?.offlineCatchUp?.maxCatchUpUnits) || 70) + 10;
      if ((realRemaining <= 0 && !oosEnabled) || val > maxAllowed) {
        delete hub.peakGiveawayClaimedCounts[gId];
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
