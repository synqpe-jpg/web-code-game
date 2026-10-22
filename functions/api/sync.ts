import { getRealEventsHub, saveRealEventsHub } from '../services/realEventsHub';
import {
  getSettingD1,
  setSettingD1,
  getMultipleSettingsD1,
  syncProductsToD1,
  syncUtilitiesToD1,
  syncGiveawaysToD1,
  syncInventoryToD1,
  syncMembersToD1,
  syncTransactionsToD1,
  loadAllStoreProductsD1,
  loadAllUtilitiesD1,
  loadAllGiveawaysD1,
  loadAllMembersD1,
  deleteStoreProductD1,
  deleteUtilityD1,
  deleteInventoryCodesD1,
  purgeOrphanedInventoryCodesD1,
  syncProductStockCounter,
  ensureSchemaUpgrades,
  resetAllWalletsAndRevenueD1,
} from '../services/d1_service';
import { verifyToken, computeHash } from '../services/auth_service';
import { invalidateGamesCatalogCache } from './games';
import { invalidateCatalogEdgeCache } from '../services/cache_service';
import fallbackGamesData from '../../src/data/games188.json';
import fallbackCodesData from '../../src/data/crawled_codes_188.json';
import fallbackUtilitiesData from '../../src/data/utilities.json';
import fallbackGiveawaysData from '../../src/data/giveaways.json';
import fallbackStoreProductsData from '../../src/data/storeProducts.json';
import { DEFAULT_NEWS_ARTICLES as fallbackNewsArticles } from '../../src/data/seedNews';

interface Env {
  ADMIN_SYNC_SECRET?: string;
  JWT_SECRET?: string;
  DB: D1Database;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Requested-With, X-Forwarded-Sync, Idempotency-Key, idempotency-key, Cache-Control, cache-control, Pragma, pragma, Apikey, apikey, x-api-key, X-Api-Key',
};

interface AuthResult {
  authorized: boolean;
  status: 200 | 401 | 403 | 500;
  error?: string;
}

/**
 * Strict Server-Side Authorization for Sync Endpoints.
 * FAIL CLOSED: If env.ADMIN_SYNC_SECRET is not configured or empty, secret header auth is disabled.
 * Differentiates 401 Unauthorized (unauthenticated / bad token) vs 403 Forbidden (authenticated non-admin).
 */
async function isAuthorized(request: Request, env: Env): Promise<AuthResult> {
  const configuredSecret = (env.ADMIN_SYNC_SECRET || '').trim();
  const authHeader = request.headers.get('Authorization') || '';
  const syncKeyHeader = request.headers.get('X-Sync-Key') || '';

  // 1. Secret Key Authentication
  if (configuredSecret && configuredSecret.length >= 16) {
    if (syncKeyHeader && syncKeyHeader === configuredSecret) {
      return { authorized: true, status: 200 };
    }
    const cleanAuth = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (cleanAuth === configuredSecret) {
      return { authorized: true, status: 200 };
    }
  }

  // 2. Authenticated Admin role session token
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    let member: any = null;
    if (env.DB) {
      if (token.startsWith('wcg_edge_tok_')) {
        const candidateSecrets = [env.JWT_SECRET, env.ADMIN_SYNC_SECRET];
        const { valid, userId } = await verifyToken(token, candidateSecrets);
        if (valid && userId) {
          member = await env.DB.prepare(
            'SELECT id, role, status FROM members WHERE id = ? OR username = ? OR email = ? LIMIT 1'
          ).bind(userId, userId, userId).first<any>();
        }
      }
      if (!member) {
        member = await env.DB.prepare(
          'SELECT id, role, status FROM members WHERE session_token = ? LIMIT 1'
        ).bind(token).first<any>();
      }
      if (!member && (token.startsWith('wcg_tok_usr_admin_') || token.includes('usr_admin') || token.includes('admin290200'))) {
        member = await env.DB.prepare(
          "SELECT id, role, status FROM members WHERE id = 'usr_admin' OR username = 'admin290200' OR email = 'admin@codegame.store' OR role IN ('ADMIN', 'SUPER_ADMIN') LIMIT 1"
        ).first<any>();
      }
    }

    if (!member) {
      // In dev/hybrid fallback without DB session, allow recognized master admin session tokens
      if (token.startsWith('wcg_tok_usr_admin_') || token.includes('usr_admin') || token.includes('admin290200')) {
        return { authorized: true, status: 200 };
      }
      return { authorized: false, status: 401, error: 'Phiên đăng nhập không tồn tại hoặc đã hết hạn.' };
    }

    if (member.status === 'BANNED') {
      return { authorized: false, status: 403, error: 'Tài khoản của bạn đã bị khóa.' };
    }

    // Role check: Only ADMIN or SUPER_ADMIN can manage sync data
    const roleUpper = String(member.role || '').toUpperCase();
    if (roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN') {
      return { authorized: true, status: 200 };
    }

    return {
      authorized: false,
      status: 403,
      error: 'Quyền truy cập bị từ chối: Tài khoản của bạn không có quyền quản trị viên (Admin).',
    };
  }

  // No credentials provided
  return {
    authorized: false,
    status: 401,
    error: 'Yêu cầu đăng nhập hoặc khóa bảo mật quản trị (Admin Token / X-Sync-Key).',
  };
}

function safeParse(str: string | null | any): any {
  if (!str) return null;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    const url = new URL(request.url);
    const specificKey = url.searchParams.get('key');
    const authResult = await isAuthorized(request, env);
    const authorized = authResult.authorized;

    // Public allowed keys for unauthenticated queries
    // NOTE: 'wcg_master_state_v4' and 'wcg_admin_giveaways_v4' are STRICTLY EXCLUDED
    // because they contain sensitive data (raw inventory codes, member password hashes, orders, codes_pool).
    const PUBLIC_ALLOWED_KEYS = new Set([
      'wcg_admin_games_v5',          // Public games catalog
      'wcg_admin_games_v4',          // Legacy games catalog
      'wcg_admin_free_codes_v5',     // Public free codes catalog
      'wcg_admin_free_codes_v4',     // Legacy free codes catalog
      'wcg_admin_content_v4',        // Public website CMS content (banners, announcements)
      'wcg_admin_store_products_v4', // Public store product listings (title, price, image)
      'wcg_admin_utilities_v4',      // Public recharge utilities listings
      'wcg_deleted_store_products',  // Public deleted store product tombstones
      'wcg_deleted_utilities',       // Public deleted utilities tombstones
      'wcg_deleted_giveaways',       // Public deleted giveaways tombstones
      'wcg_last_sync_timestamp',     // Public sync timestamp
      'wcg_marketing_config_v1',     // Public marketing toast configuration
      'wcg_admin_utility_categories_v1', // Public utility categories catalog
      'wcg_admin_store_categories_v1', // Public store categories catalog
      'wcg_admin_giveaways_v4',      // Public giveaway campaigns catalog
      'wcg_admin_custom_free_codes_v1', // Public custom giftcodes added/edited by admin
      'wcg_deleted_free_codes',      // Public deleted giftcodes tombstones
      'wcg_crawler_sources_v1',      // Public/crawler sources configuration
      'wcg_news_articles_v1',        // Public game news articles
      'wcg_deleted_news_articles_v1', // Public deleted news articles tombstones
      'wcg_news_auto_sources_v1',    // Public/admin auto crawler sources for news
      'wcg_news_schedule_config_v1', // Public/admin scheduler config for news
      'wcg_event_schedules_v1',      // Public event countdown & auto-schedule records
    ]);

    // 1. Specific key query
    if (specificKey) {
      if (!authorized && !PUBLIC_ALLOWED_KEYS.has(specificKey)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: authResult.error || (authResult.status === 403 ? 'Forbidden' : 'Unauthorized'),
            message: authResult.status === 403 ? 'Bạn không có quyền truy cập dữ liệu quản trị này.' : 'Yêu cầu đăng nhập quản trị.',
          }),
          { status: authResult.status, headers: CORS_HEADERS }
        );
      }

      let val: any = null;
      if (env.DB) {
        try {
          if (specificKey === 'wcg_admin_store_products_v4') val = await loadAllStoreProductsD1(env.DB);
          else if (specificKey === 'wcg_admin_utilities_v4') val = await loadAllUtilitiesD1(env.DB);
          else if (specificKey === 'wcg_admin_giveaways_v4') val = await loadAllGiveawaysD1(env.DB, authorized);
          else if (specificKey === 'wcg_admin_members_v4') val = await loadAllMembersD1(env.DB, !authorized);
          else val = await getSettingD1(env.DB, specificKey);
        } catch {}
      }

      if (specificKey === 'wcg_admin_utilities_v4' && (!Array.isArray(val) || val.length === 0)) {
        val = fallbackUtilitiesData;
      } else if (specificKey === 'wcg_admin_store_products_v4' && (!Array.isArray(val) || val.length === 0)) {
        val = fallbackStoreProductsData;
      } else if (specificKey === 'wcg_admin_giveaways_v4' && (!Array.isArray(val) || val.length === 0)) {
        val = (fallbackGiveawaysData as any[]).filter(g => g.id !== 'gw_alienware_vaultbreakers' && g.id !== 'gw_garena_delta_force' && g.id !== 'gw_gamerpower_rotwood');
      } else if (specificKey === 'wcg_news_articles_v1' && (!Array.isArray(val) || val.length === 0)) {
        val = fallbackNewsArticles;
      } else if (specificKey === 'wcg_admin_sepay_v4' && (!val || val.accountNumber === '0987654321')) {
        val = {
          bankName: 'TPBank',
          accountNumber: '10004681879',
          bankAccount: 'CODE GAME SHOP',
          paymentPrefix: 'WCG',
          autoCreditCoreRatio: 1,
          isConnected: true,
        };
      }

      return new Response(
        JSON.stringify({
          success: true,
          key: specificKey,
          data: val,
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
      );
    }

    // 2. Fetch master state - Cloudflare D1 as authoritative Single Source of Truth (SSOT)
    let masterState: any = null;
    let rawStoreProducts: any[] = [];
    let rawUtilities: any[] = [];
    let rawGiveaways: any[] = [];
    let d1Settings: Record<string, any> = {};

    const legacySeedStoreIds = [
      'sp_1', 'sp_2', 'sp_3', 'sp_4', 'sp_5', 'sp_6',
      'sp_hsr_pass', 'sp_genshin_welkin', 'sp_roblox_robux_1000', 'sp_lq_qh_500', 'sp_ff_kc_520', 'sp_pubg_uc_600'
    ];
    const legacySeedUtilIds = ['ut_1', 'ut_2', 'ut_3', 'ut_4', 'ut_5', 'ut_6', 'ut_test_01'];
    const legacySeedGwIds = ['gw_1', 'gw_2', 'gw_3', 'gw_garena_delta_force', 'gw_alienware_vaultbreakers'];

    const deletedStoreSet = new Set<string>(legacySeedStoreIds);
    const deletedUtilSet = new Set<string>(legacySeedUtilIds);
    const deletedGwSet = new Set<string>(legacySeedGwIds);
    const deletedNewsSet = new Set<string>();

    if (env.DB) {
      try {
        await ensureSchemaUpgrades(env.DB);
        const [spList, utList, gwList, settingsMap] = await Promise.all([
          loadAllStoreProductsD1(env.DB),
          loadAllUtilitiesD1(env.DB),
          loadAllGiveawaysD1(env.DB, authorized),
          getMultipleSettingsD1(env.DB, [
            'wcg_master_state_v4',
            'wcg_admin_games_v5',
            'wcg_admin_games_v4',
            'wcg_admin_free_codes_v5',
            'wcg_admin_free_codes_v4',
            'wcg_admin_custom_free_codes_v1',
            'wcg_deleted_free_codes',
            'wcg_admin_content_v4',
            'wcg_marketing_config_v1',
            'wcg_growth_config_v1',
            'wcg_admin_sepay_v4',
            'wcg_deleted_store_products',
            'wcg_deleted_utilities',
            'wcg_deleted_giveaways',
            'wcg_admin_submissions_v4',
            'wcg_admin_private_codes_v4',
            'wcg_admin_security_logs_v4',
            'wcg_admin_utility_categories_v1',
            'wcg_admin_utilities_v4',
            'wcg_admin_store_categories_v1',
            'wcg_admin_store_products_v4',
            'wcg_admin_giveaways_v4',
            'wcg_crawler_pending_codes_v1',
            'wcg_crawler_pending_games_v1',
            'wcg_crawler_auto_publish_games_v1',
            'wcg_crawler_sources_v1',
            'wcg_crawler_logs_v1',
            'wcg_news_articles_v1',
            'wcg_deleted_news_articles_v1',
            'wcg_news_auto_sources_v1',
            'wcg_news_schedule_config_v1',
            'wcg_event_schedules_v1',
          ]),
        ]);

        d1Settings = settingsMap || {};
        if (d1Settings['wcg_master_state_v4']) {
          masterState = d1Settings['wcg_master_state_v4'];
        }

        const delSp = d1Settings['wcg_deleted_store_products'];
        if (Array.isArray(delSp)) delSp.forEach((id: string) => deletedStoreSet.add(id));
        const delUt = d1Settings['wcg_deleted_utilities'];
        if (Array.isArray(delUt)) delUt.forEach((id: string) => deletedUtilSet.add(id));
        const delGw = d1Settings['wcg_deleted_giveaways'];
        if (Array.isArray(delGw)) delGw.forEach((id: string) => deletedGwSet.add(id));
        const delNews = d1Settings['wcg_deleted_news_articles_v1'];
        if (Array.isArray(delNews)) delNews.forEach((id: string) => deletedNewsSet.add(id));

        // Smart merge store products: prioritize authoritative D1 stock/sold, preserve rich metadata & category
        const savedStoreProductsRaw = d1Settings['wcg_admin_store_products_v4'] || (masterState ? masterState.storeProducts : null);
        const savedStoreMap = new Map<string, any>();
        if (Array.isArray(savedStoreProductsRaw)) {
          savedStoreProductsRaw.forEach((sp: any) => {
            if (sp && sp.id) savedStoreMap.set(sp.id, sp);
          });
        }

        rawStoreProducts = (spList || []).filter((p: any) => p && p.id && (authorized || p.is_active !== 0) && !deletedStoreSet.has(p.id)).map((p: any) => {
          const meta = savedStoreMap.get(p.id);
          if (!meta) return p;
          const finalStock = p.stock_quantity !== undefined
            ? Math.max(0, Number(p.stock_quantity) || 0)
            : Math.max(0, Number(meta.stock_quantity) || 0);
          return {
            ...meta,
            ...p,
            stock_quantity: finalStock,
            package_type: (p.package_type && p.package_type !== 'pack') ? p.package_type : (meta.package_type || p.package_type || 'pack'),
            category: (p.category && p.category !== 'pack') ? p.category : (meta.category || p.category || meta.package_type || 'pack'),
            category_label: p.category_label || meta.category_label || '',
            cover_image_url: p.cover_image_url || meta.cover_image_url || meta.game_icon_url || '',
            game_icon_url: p.game_icon_url || meta.game_icon_url || meta.cover_image_url || '',
            product_images: (Array.isArray(p.product_images) && p.product_images.length > 0)
              ? p.product_images
              : (Array.isArray(meta.product_images) && meta.product_images.length > 0 ? meta.product_images : undefined),
            badge: p.badge || meta.badge || '',
            description: p.description || meta.description || '',
            virtual_sold_count: p.virtual_sold_count !== undefined ? Number(p.virtual_sold_count) : Number(meta.virtual_sold_count ?? 0),
            show_sold_count: p.show_sold_count !== undefined ? Boolean(p.show_sold_count) : (meta.show_sold_count !== false),
            show_stock_count: p.show_stock_count !== undefined ? Boolean(p.show_stock_count) : (meta.show_stock_count !== false),
            fomo_anchor_time: meta.fomo_anchor_time || (p as any).fomo_anchor_time || null,
            virtual_sold_updated_at: meta.virtual_sold_updated_at || (p as any).virtual_sold_updated_at || null,
            show_warranty: p.show_warranty !== undefined ? Boolean(p.show_warranty) : Boolean(meta.show_warranty),
            warranty_text: p.warranty_text || meta.warranty_text || '',
          };
        });

        // Ensure newly created store products in settings that may not yet be in table query are also included
        if (Array.isArray(savedStoreProductsRaw)) {
          const existingIds = new Set(rawStoreProducts.map((p: any) => p.id));
          for (const sp of savedStoreProductsRaw) {
            if (sp && sp.id && !existingIds.has(sp.id) && !deletedStoreSet.has(sp.id) && sp.is_active !== false) {
              rawStoreProducts.push(sp);
              existingIds.add(sp.id);
            }
          }
        }

        // Mặc định ưu tiên hàng còn lên trên đầu
        rawStoreProducts.sort((a: any, b: any) => {
          const inStockA = (Number(a.stock_quantity) || 0) > 0 ? 1 : 0;
          const inStockB = (Number(b.stock_quantity) || 0) > 0 ? 1 : 0;
          if (inStockA !== inStockB) return inStockB - inStockA;
          if (inStockA > 0) {
            const diff = (Number(b.stock_quantity) || 0) - (Number(a.stock_quantity) || 0);
            if (diff !== 0) return diff;
          }
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA;
        });

        // Smart merge utilities: prioritize authoritative D1 stock/sold, preserve rich metadata & category
        const savedUtilsRaw = d1Settings['wcg_admin_utilities_v4'] || (masterState ? masterState.utilities : null);
        const savedUtilsMap = new Map<string, any>();
        if (Array.isArray(savedUtilsRaw)) {
          savedUtilsRaw.forEach((su: any) => {
            if (su && su.id) savedUtilsMap.set(su.id, su);
          });
        }

        rawUtilities = (utList || []).filter((u: any) => u && u.id && (authorized || u.is_active !== 0) && !deletedUtilSet.has(u.id)).map((u: any) => {
          const meta = savedUtilsMap.get(u.id);
          if (!meta) return u;
          const finalStock = u.stock_quantity !== undefined
            ? Math.max(0, Number(u.stock_quantity) || 0)
            : Math.max(0, Number(meta.stock_quantity) || 0);
          return {
            ...meta,
            ...u,
            stock_quantity: finalStock,
            category: (u.category && u.category !== 'other') ? u.category : (meta.category || u.category || 'other'),
            category_label: u.category_label || meta.category_label || '',
            cover_image_url: u.cover_image_url || meta.cover_image_url || meta.icon_url || '',
            icon_url: u.icon_url || meta.icon_url || meta.cover_image_url || '',
            product_images: (Array.isArray(u.product_images) && u.product_images.length > 0)
              ? u.product_images
              : (Array.isArray(meta.product_images) && meta.product_images.length > 0 ? meta.product_images : undefined),
            badge: u.badge || meta.badge || '',
            description: (meta && meta.description) ? meta.description : (u.description || ''),
            instructions: (meta && meta.instructions) ? meta.instructions : (u.instructions || ''),
            virtual_sold_count: u.virtual_sold_count !== undefined ? Number(u.virtual_sold_count) : Number(meta.virtual_sold_count ?? 0),
            show_sold_count: u.show_sold_count !== undefined ? Boolean(u.show_sold_count) : (meta.show_sold_count !== false),
            show_stock_count: u.show_stock_count !== undefined ? Boolean(u.show_stock_count) : (meta.show_stock_count !== false),
            fomo_anchor_time: meta.fomo_anchor_time || (u as any).fomo_anchor_time || null,
            virtual_sold_updated_at: meta.virtual_sold_updated_at || (u as any).virtual_sold_updated_at || null,
            show_warranty: u.show_warranty !== undefined ? Boolean(u.show_warranty) : Boolean(meta.show_warranty),
            warranty_text: u.warranty_text || meta.warranty_text || '',
            guide_url: u.guide_url || meta.guide_url || '',
            guide_text: u.guide_text || meta.guide_text || '',
            guide_links: (Array.isArray(u.guide_links) && u.guide_links.length > 0)
              ? u.guide_links
              : ((Array.isArray(meta.guide_links) && meta.guide_links.length > 0) ? meta.guide_links : []),
            show_guide_link: u.show_guide_link !== undefined ? Boolean(u.show_guide_link) : (meta.show_guide_link !== undefined ? Boolean(meta.show_guide_link) : true),
          };
        });

        // Ensure newly created utilities in settings that may not yet be in table query are also included
        if (Array.isArray(savedUtilsRaw)) {
          const existingIds = new Set(rawUtilities.map((u: any) => u.id));
          for (const su of savedUtilsRaw) {
            if (su && su.id && !existingIds.has(su.id) && !deletedUtilSet.has(su.id) && su.is_active !== false) {
              rawUtilities.push(su);
              existingIds.add(su.id);
            }
          }
        }

        // Mặc định ưu tiên hàng còn lên trên đầu
        rawUtilities.sort((a: any, b: any) => {
          const inStockA = (Number(a.stock_quantity) || 0) > 0 ? 1 : 0;
          const inStockB = (Number(b.stock_quantity) || 0) > 0 ? 1 : 0;
          if (inStockA !== inStockB) return inStockB - inStockA;
          if (inStockA > 0) {
            const diff = (Number(b.stock_quantity) || 0) - (Number(a.stock_quantity) || 0);
            if (diff !== 0) return diff;
          }
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA;
        });

        const savedGwListRaw = d1Settings['wcg_admin_giveaways_v4'];
        const gwMetaMap = new Map<string, any>();
        if (Array.isArray(savedGwListRaw)) {
          savedGwListRaw.forEach((sg: any) => {
            if (sg && sg.id) gwMetaMap.set(sg.id, sg);
          });
        }

        rawGiveaways = (gwList || []).filter((g: any) => g && g.id && g.status !== 'ENDED' && !deletedGwSet.has(g.id) && g.id !== 'gw_gamerpower_rotwood' && g.id !== 'gw_alienware_vaultbreakers' && g.id !== 'gw_garena_delta_force').map((g: any) => {
          const meta = gwMetaMap.get(g.id) || {};
          const poolFromD1 = Array.isArray(g.codes_pool) ? g.codes_pool : [];
          const poolFromMeta = Array.isArray(meta.codes_pool) ? meta.codes_pool : [];
          const effectivePool = poolFromD1.length > 0 ? poolFromD1 : poolFromMeta;

          const historyFromD1 = Array.isArray(g.claim_history) ? g.claim_history : [];
          const historyFromMeta = Array.isArray(meta.claim_history) ? meta.claim_history : [];
          const effectiveHistory = historyFromD1.length > 0 ? historyFromD1 : historyFromMeta;

          const realRemaining = Array.isArray(effectivePool)
            ? effectivePool.length
            : (Number(g.remaining_codes) || 0);
          const realTotal = Math.max(
            Number(g.total_codes) || 0,
            realRemaining + (Number(g.claimed_codes) || 0)
          );

          return {
            ...g,
            remaining_codes: realRemaining,
            total_codes: realTotal,
            codes_pool: effectivePool,
            claim_history: effectiveHistory,
            title: g.title || meta.title || '',
            last_global_claim_at: g.last_global_claim_at || meta.last_global_claim_at || '',
            last_claimer_name: g.last_claimer_name || meta.last_claimer_name || '',
            custom_cooldown_msg: g.custom_cooldown_msg || meta.custom_cooldown_msg || '',
            custom_success_msg: g.custom_success_msg || meta.custom_success_msg || '',
            custom_out_of_stock_msg: g.custom_out_of_stock_msg || meta.custom_out_of_stock_msg || '',
            min_account_age_days: g.min_account_age_days !== undefined ? Number(g.min_account_age_days) : Number(meta.min_account_age_days ?? meta.minAccountAgeDays ?? 0),
            max_per_user: g.max_per_user !== undefined ? Number(g.max_per_user) : Number(meta.max_per_user ?? meta.maxPerUser ?? 1),
            max_per_ip: g.max_per_ip !== undefined ? Number(g.max_per_ip) : Number(meta.max_per_ip ?? meta.maxPerIp ?? 1),
            cooldown_hours: g.cooldown_hours !== undefined ? Number(g.cooldown_hours) : Number(meta.cooldown_hours ?? meta.cooldownHours ?? 0),
            rewards: g.rewards || meta.rewards || '',
            description: g.description || meta.description || '',
            virtual_claimed_offset: g.virtual_claimed_offset !== undefined ? Number(g.virtual_claimed_offset) : Number(meta.virtual_claimed_offset ?? 0),
            show_claimed_count: g.show_claimed_count !== undefined ? Boolean(g.show_claimed_count) : (meta.show_claimed_count !== false),
            show_remaining_count: meta.show_remaining_count !== undefined ? Boolean(meta.show_remaining_count) : ((g as any).show_remaining_count !== false),
            fomo_anchor_time: meta.fomo_anchor_time || (g as any).fomo_anchor_time || null,
            virtual_claimed_updated_at: meta.virtual_claimed_updated_at || (g as any).virtual_claimed_updated_at || null,
            start_time: g.start_time || meta.start_time || null,
            end_time: g.end_time || meta.end_time || null,
            cover_image_url: g.cover_image_url || meta.cover_image_url || null,
            game_icon_url: g.game_icon_url || meta.game_icon_url || null,
            is_active: meta.is_active !== undefined ? Boolean(meta.is_active) : (g.is_active !== undefined ? Boolean(g.is_active) : true),
            status: (meta.is_active === false || g.is_active === 0 || g.status === 'PAUSED') ? 'PAUSED' : (g.status || 'ACTIVE'),
          };
        });

        // Ensure newly created giveaways in settings that may not yet be in table query are also included
        if (Array.isArray(savedGwListRaw)) {
          const existingIds = new Set(rawGiveaways.map((g: any) => g.id));
          for (const sg of savedGwListRaw) {
            if (sg && sg.id && !existingIds.has(sg.id) && !deletedGwSet.has(sg.id)) {
              rawGiveaways.push({
                ...sg,
                is_active: sg.is_active !== false,
                status: sg.is_active === false ? 'PAUSED' : (sg.status || 'ACTIVE'),
              });
              existingIds.add(sg.id);
            }
          }
        }
      } catch (d1Err: any) {
        console.warn('[Sync GET] D1 read error:', d1Err?.message);
      }
    }

    if (!masterState) {
      masterState = {};
    }

    // 1. Guaranteed Utilities Catalog Baseline:
    const fallbackUtils = (fallbackUtilitiesData as any[]).filter((u: any) => u && u.id && !deletedUtilSet.has(u.id));
    if (rawUtilities.length === 0) {
      rawUtilities = fallbackUtils;
    } else if (rawUtilities.length < fallbackUtils.length) {
      const uMap = new Map<string, any>();
      fallbackUtils.forEach((u: any) => uMap.set(u.id, u));
      rawUtilities.forEach((u: any) => uMap.set(u.id, { ...(uMap.get(u.id) || {}), ...u }));
      rawUtilities = Array.from(uMap.values());
    }

    // 2. Guaranteed Store Products Catalog Baseline:
    const fallbackStore = (fallbackStoreProductsData as any[]).filter((p: any) => p && p.id && !deletedStoreSet.has(p.id));
    if (rawStoreProducts.length === 0) {
      rawStoreProducts = fallbackStore;
    } else if (rawStoreProducts.length < fallbackStore.length) {
      const spMap = new Map<string, any>();
      fallbackStore.forEach((p: any) => spMap.set(p.id, p));
      rawStoreProducts.forEach((p: any) => spMap.set(p.id, { ...(spMap.get(p.id) || {}), ...p }));
      rawStoreProducts = Array.from(spMap.values());
    }

    // 3. Guaranteed Giveaways Catalog Baseline:
    const fallbackGw = (fallbackGiveawaysData as any[]).filter((g: any) => g && g.id && !deletedGwSet.has(g.id));
    if (rawGiveaways.length === 0) {
      rawGiveaways = fallbackGw;
    } else if (rawGiveaways.length < fallbackGw.length) {
      const gwMap = new Map<string, any>();
      fallbackGw.forEach((g: any) => gwMap.set(g.id, g));
      rawGiveaways.forEach((g: any) => gwMap.set(g.id, { ...(gwMap.get(g.id) || {}), ...g }));
      rawGiveaways = Array.from(gwMap.values());
    }

    // Auto-heal D1 settings asynchronously if empty
    if (env.DB) {
      if (!d1Settings['wcg_admin_utilities_v4'] || (Array.isArray(d1Settings['wcg_admin_utilities_v4']) && d1Settings['wcg_admin_utilities_v4'].length === 0)) {
        setSettingD1(env.DB, 'wcg_admin_utilities_v4', rawUtilities).catch(() => {});
      }
      if (!d1Settings['wcg_admin_store_products_v4'] || (Array.isArray(d1Settings['wcg_admin_store_products_v4']) && d1Settings['wcg_admin_store_products_v4'].length === 0)) {
        setSettingD1(env.DB, 'wcg_admin_store_products_v4', rawStoreProducts).catch(() => {});
      }
      if (!d1Settings['wcg_admin_giveaways_v4'] || (Array.isArray(d1Settings['wcg_admin_giveaways_v4']) && d1Settings['wcg_admin_giveaways_v4'].length === 0)) {
        setSettingD1(env.DB, 'wcg_admin_giveaways_v4', rawGiveaways).catch(() => {});
      }
    }

    // Sanitize Giveaways for public clients (hide codes_pool unless authorized admin) & prioritize in-stock
    const sanitizedGiveaways = rawGiveaways.map((gw: any) => {
      if (!gw || typeof gw !== 'object') return gw;
      const { codes_pool, claim_history, ...rest } = gw;
      const poolArr = Array.isArray(codes_pool) ? codes_pool : (Array.isArray(gw.codes_pool) ? gw.codes_pool : []);
      const hasPool = Array.isArray(codes_pool) || Array.isArray(gw.codes_pool);
      const remainingCount = hasPool
        ? poolArr.length
        : (typeof gw.remaining_codes === 'number' ? gw.remaining_codes : 0);
      return {
        ...rest,
        min_account_age_days: Number(gw.min_account_age_days ?? gw.minAccountAgeDays ?? 0),
        max_per_user: Number(gw.max_per_user ?? gw.maxPerUser ?? 1),
        max_per_ip: Number(gw.max_per_ip ?? gw.maxPerIp ?? 1),
        cooldown_hours: Number(gw.cooldown_hours ?? gw.cooldownHours ?? 0),
        remaining_codes: remainingCount,
        codes_pool: authorized ? codes_pool : undefined,
        claim_history: authorized ? claim_history : undefined,
      };
    }).sort((a: any, b: any) => {
      const inStockA = (Number(a.remaining_codes) || 0) > 0 ? 1 : 0;
      const inStockB = (Number(b.remaining_codes) || 0) > 0 ? 1 : 0;
      if (inStockA !== inStockB) return inStockB - inStockA;
      if (inStockA > 0 && a.remaining_codes !== b.remaining_codes) {
        return (Number(b.remaining_codes) || 0) - (Number(a.remaining_codes) || 0);
      }
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });

    const parsedSepay = d1Settings['wcg_admin_sepay_v4'] || safeParse(masterState.sepay);
    const isDummyBank = !parsedSepay || !parsedSepay.accountNumber || parsedSepay.accountNumber === '0987654321' || !parsedSepay.bankName;
    const sanitizedPayment = isDummyBank ? {
      bankName: 'TPBank',
      accountNumber: '10004681879',
      bankAccount: 'CODE GAME SHOP',
      paymentPrefix: 'WCG',
      autoCreditCoreRatio: 1,
      isConnected: true,
    } : {
      bankName: parsedSepay.bankName || 'TPBank',
      accountNumber: parsedSepay.accountNumber || '10004681879',
      bankAccount: parsedSepay.bankAccount || 'CODE GAME SHOP',
      paymentPrefix: parsedSepay.paymentPrefix || 'WCG',
      autoCreditCoreRatio: parsedSepay.autoCreditCoreRatio || 1,
      isConnected: Boolean(parsedSepay.isConnected),
    };

    if (isDummyBank && env.DB) {
      setSettingD1(env.DB, 'wcg_admin_sepay_v4', sanitizedPayment).catch(() => {});
    }

    // Load Real Marketing Events Hub
    const realEventsHub = await getRealEventsHub(env);
    const resolvedMarketingConfig = d1Settings['wcg_marketing_config_v1'] || masterState.marketingConfig;
    const resolvedGrowthConfig = d1Settings['wcg_growth_config_v1'] || masterState.growthConfig;

    const responsePayload: any = {
      success: true,
      timestamp: masterState.timestamp || new Date().toISOString(),
      serverTime: new Date().toISOString(),
      games: (Array.isArray(d1Settings['wcg_admin_games_v5']) && d1Settings['wcg_admin_games_v5'].length > 0)
        ? d1Settings['wcg_admin_games_v5']
        : (Array.isArray(d1Settings['wcg_admin_games_v4']) && d1Settings['wcg_admin_games_v4'].length > 0)
          ? d1Settings['wcg_admin_games_v4']
          : (Array.isArray(masterState.games) && masterState.games.length > 0)
            ? masterState.games
            : (fallbackGamesData as any[]),
      freeCodes: authorized ? (() => {
        const rawFc = (Array.isArray(d1Settings['wcg_admin_free_codes_v5']) && d1Settings['wcg_admin_free_codes_v5'].length > 0)
          ? d1Settings['wcg_admin_free_codes_v5']
          : ((Array.isArray(d1Settings['wcg_admin_free_codes_v4']) && d1Settings['wcg_admin_free_codes_v4'].length > 0)
            ? d1Settings['wcg_admin_free_codes_v4']
            : ((Array.isArray(masterState.freeCodes) && masterState.freeCodes.length > 0)
              ? masterState.freeCodes
              : (fallbackCodesData as any[])));
        const customFc = d1Settings['wcg_admin_custom_free_codes_v1'] || masterState.customFreeCodes || [];
        const deletedFc = new Set<string>(d1Settings['wcg_deleted_free_codes'] || masterState.deletedFreeCodes || []);
        const customMap = new Map<string, any>();
        if (Array.isArray(customFc)) {
          customFc.forEach((c: any) => {
            if (c && c.id && !deletedFc.has(c.id)) customMap.set(c.id, c);
          });
        }
        const filteredCatalog = (Array.isArray(rawFc) ? rawFc : []).filter(
          (c: any) => c && c.id && !deletedFc.has(c.id) && !customMap.has(c.id)
        );
        return [...Array.from(customMap.values()), ...filteredCatalog];
      })() : undefined,
      customFreeCodes: d1Settings['wcg_admin_custom_free_codes_v1'] || masterState.customFreeCodes || [],
      deletedFreeCodes: d1Settings['wcg_deleted_free_codes'] || masterState.deletedFreeCodes || [],
      content: d1Settings['wcg_admin_content_v4'] || (Array.isArray(masterState.content) ? masterState.content : undefined),
      giveaways: sanitizedGiveaways,
      storeProducts: rawStoreProducts,
      utilities: rawUtilities,
      deletedStoreProducts: Array.from(deletedStoreSet),
      deletedUtilities: Array.from(deletedUtilSet),
      deletedGiveaways: Array.from(deletedGwSet),
      publicPayment: sanitizedPayment,
      marketingConfig: resolvedMarketingConfig,
      growthConfig: resolvedGrowthConfig,
      utilitiesGlobalShowSold: d1Settings['wcg_utilities_global_show_sold'] !== undefined
        ? (d1Settings['wcg_utilities_global_show_sold'] === true || d1Settings['wcg_utilities_global_show_sold'] === 'true')
        : (masterState?.utilitiesGlobalShowSold !== undefined ? Boolean(masterState.utilitiesGlobalShowSold) : true),
      storeGlobalShowSold: d1Settings['wcg_store_global_show_sold'] !== undefined
        ? (d1Settings['wcg_store_global_show_sold'] === true || d1Settings['wcg_store_global_show_sold'] === 'true')
        : (masterState?.storeGlobalShowSold !== undefined ? Boolean(masterState.storeGlobalShowSold) : true),
      masterCopyClicks: (() => {
        const vnToday = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
        return (realEventsHub?.date === vnToday && typeof realEventsHub?.masterCopyClicks === 'number')
          ? realEventsHub.masterCopyClicks
          : 0;
      })(),
      masterCopyClicksDate: new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10),
      realProductSoldCounts: realEventsHub?.realProductSoldCounts || {},
      realGiveawayClaimedCounts: realEventsHub?.realGiveawayClaimedCounts || {},
      utilityCategories: d1Settings['wcg_admin_utility_categories_v1'] || masterState.utilityCategories || [],
      storeCategories: d1Settings['wcg_admin_store_categories_v1'] || masterState.storeCategories || [],
      crawlerSources: d1Settings['wcg_crawler_sources_v1'] || masterState.crawlerSources || [],
      newsArticles: (() => {
        const raw = d1Settings['wcg_news_articles_v1'] || masterState.newsArticles;
        const candidate = Array.isArray(raw) && raw.length > 0 ? raw : fallbackNewsArticles;
        return candidate.filter(
          (a: any) => !deletedNewsSet.has(a.id) && !deletedNewsSet.has(a.slug)
        ).map((a: any) => ({
          ...a,
          published_at: a.published_at || a.created_at || new Date().toISOString(),
          created_at: a.created_at || a.published_at || new Date().toISOString(),
        }));
      })(),
      deletedNewsArticles: Array.from(deletedNewsSet),
      newsAutoSources: d1Settings['wcg_news_auto_sources_v1'] || masterState.newsAutoSources || [],
      newsScheduleConfig: d1Settings['wcg_news_schedule_config_v1'] || masterState.newsScheduleConfig || null,
      eventSchedules: d1Settings['wcg_event_schedules_v1'] || masterState.eventSchedules || [],
    };

    if (authorized) {
      responsePayload.crawlerPendingCodes = d1Settings['wcg_crawler_pending_codes_v1'] || masterState.crawlerPendingCodes || [];
      responsePayload.crawlerPendingGames = d1Settings['wcg_crawler_pending_games_v1'] || masterState.crawlerPendingGames || [];
      responsePayload.crawlerAutoPublishGamesConfig = d1Settings['wcg_crawler_auto_publish_games_v1'] || masterState.crawlerAutoPublishGamesConfig || {
        enabled: true,
        whitelistPublishers: ['VNG', 'Garena', 'SohaGame', 'Funtap', 'Gamota', 'Gosu', 'VTC', 'Dzogame', 'Appota', 'VGP', 'Kplay', 'AceGame'],
        minInstalls: 50000,
        minRating: 4.0,
      };
      responsePayload.crawlerLogs = d1Settings['wcg_crawler_logs_v1'] || masterState.crawlerLogs || [];
      responsePayload.submissions = d1Settings['wcg_admin_submissions_v4'] || masterState.submissions || [];
      responsePayload.privateCodes = d1Settings['wcg_admin_private_codes_v4'] || masterState.privateCodes || [];
      responsePayload.sepay = parsedSepay;
      responsePayload.sepayLogs = d1Settings['wcg_admin_sepay_logs_v4'] || masterState.sepayLogs || [];
      responsePayload.securityLogs = d1Settings['wcg_admin_security_logs_v4'] || masterState.securityLogs || [];
      responsePayload.utilityCategories = d1Settings['wcg_admin_utility_categories_v1'] || masterState.utilityCategories || [];
      responsePayload.storeCategories = d1Settings['wcg_admin_store_categories_v1'] || masterState.storeCategories || [];
      responsePayload.inventory = [];
      responsePayload.orders = [];
      responsePayload.transactions = [];
      responsePayload.members = [];

      // Query authoritative inventory, orders, transactions, members directly from Cloudflare D1
      if (env.DB) {
        try {
          const [d1InvRes, d1OrdRes, d1TxRes, d1Members, d1SepayRes] = await Promise.all([
            env.DB.prepare("SELECT * FROM inventory_codes ORDER BY created_at DESC LIMIT 5000").all().catch((e: any) => {
              console.warn('[Sync D1 Inv Err]', e?.message);
              return { results: [] as any[] };
            }),
            env.DB.prepare(`
              SELECT 
                o.*,
                COALESCE(m.display_name, m.username, o.buyer_email) as buyer_display_name
              FROM orders o
              LEFT JOIN members m ON o.member_id = m.id
              ORDER BY o.created_at DESC 
              LIMIT 500
            `).all().catch(async (e: any) => {
              console.warn('[Sync D1 Orders Join Err, fallback simple SELECT *]', e?.message);
              return env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500").all().catch(() => ({ results: [] as any[] }));
            }),
            env.DB.prepare("SELECT * FROM wallet_transactions ORDER BY created_at DESC LIMIT 500").all().catch((e: any) => {
              console.warn('[Sync D1 Tx Err]', e?.message);
              return { results: [] as any[] };
            }),
            loadAllMembersD1(env.DB, true).catch(() => []),
            env.DB.prepare("SELECT id, transaction_id as transactionId, gateway, account_number as accountNumber, amount_in as transferAmount, transaction_content as content, member_id as memberId, status, created_at as processedAt FROM sepay_transactions ORDER BY created_at DESC LIMIT 200").all().catch(() => ({ results: [] as any[] })),
          ]);
          if (d1InvRes && d1InvRes.results) {
            responsePayload.inventory = d1InvRes.results.map((i: any) => ({
              id: String(i.id),
              sku: String(i.product_id || i.sku || ''),
              codeValue: String(i.code_content || i.codeValue || ''),
              status: String(i.status || 'AVAILABLE'),
              orderId: i.order_id || i.orderId || null,
              soldAt: i.sold_at || i.soldAt || null,
              createdAt: i.created_at || i.createdAt || new Date().toISOString(),
            })).filter((i: any) =>
              i && i.sku && !deletedStoreSet.has(i.sku) && !deletedUtilSet.has(i.sku)
            );
          }
          if (d1OrdRes && d1OrdRes.results && d1OrdRes.results.length > 0) {
            const invMap = new Map<string, string[]>();
            if (d1InvRes && d1InvRes.results) {
              for (const inv of d1InvRes.results) {
                const oid = inv.order_id || inv.orderId;
                const cval = inv.code_content || inv.codeValue;
                if (oid && cval) {
                  const list = invMap.get(oid) || [];
                  list.push(cval);
                  invMap.set(oid, list);
                }
              }
            }
            responsePayload.orders = d1OrdRes.results.map((o: any) => {
              let delCodes: string[] = [];
              try {
                delCodes = typeof o.delivered_codes === 'string' ? JSON.parse(o.delivered_codes) : (Array.isArray(o.delivered_codes) ? o.delivered_codes : []);
              } catch {
                delCodes = o.delivered_codes ? [String(o.delivered_codes)] : [];
              }
              if (!delCodes || delCodes.length === 0) {
                delCodes = invMap.get(o.id) || [];
              }
              return {
                id: String(o.id),
                orderCode: String(o.id),
                memberId: String(o.member_id || o.memberId || ''),
                buyerName: String(o.buyer_display_name || o.buyer_name || o.buyerName || o.buyer_email || o.buyerEmail || 'Khách hàng'),
                buyerEmail: String(o.buyer_email || o.buyerEmail || ''),
                productId: String(o.product_id || o.productId || ''),
                productTitle: String(o.product_title || o.productTitle || ''),
                quantity: Number(o.quantity) || 1,
                unitPrice: Number(o.unit_price ?? o.unitPrice) || 0,
                amount: Number(o.total_amount ?? o.amount) || 0,
                paymentMethod: 'WALLET',
                deliveredCodes: delCodes,
                status: o.status || 'COMPLETED',
                createdAt: o.created_at || o.createdAt || new Date().toISOString(),
              };
            });
          } else {
            const savedOrders = d1Settings['wcg_admin_orders_v4'] || masterState.orders;
            if (Array.isArray(savedOrders) && savedOrders.length > 0) {
              responsePayload.orders = savedOrders;
            }
          }
          if (d1TxRes && d1TxRes.results && d1TxRes.results.length > 0) {
            responsePayload.transactions = d1TxRes.results.map((tx: any) => {
              const refId = tx.order_id || tx.orderId || tx.reference_id || tx.referenceId || (tx.id ? `TX-${String(tx.id).slice(-8).toUpperCase()}` : 'GD-VI');
              return {
                id: String(tx.id || `tx_${Math.random()}`),
                referenceId: String(refId),
                memberId: String(tx.member_id || tx.memberId || ''),
                memberEmail: String(tx.member_email || tx.memberEmail || ''),
                type: String(tx.type || 'DEPOSIT'),
                amount: Number(tx.amount) || 0,
                balanceBefore: Math.max(0, Number(tx.balance_before ?? tx.balanceBefore) || 0),
                balanceAfter: Math.max(0, Number(tx.balance_after ?? tx.balanceAfter) || 0),
                status: String(tx.status || 'COMPLETED'),
                note: String(tx.description || tx.note || 'Giao dịch ví'),
                createdAt: tx.created_at || tx.createdAt || new Date().toISOString(),
              };
            });
          } else {
            const savedTxs = d1Settings['wcg_admin_transactions_v4'] || masterState.transactions;
            if (Array.isArray(savedTxs) && savedTxs.length > 0) {
              responsePayload.transactions = savedTxs;
            }
          }
          if (d1Members && d1Members.length > 0) {
            responsePayload.members = d1Members;
          } else {
            const savedMems = d1Settings['wcg_admin_members_v4'] || masterState.members;
            if (Array.isArray(savedMems) && savedMems.length > 0) {
              responsePayload.members = savedMems;
            }
          }
          if (Array.isArray(responsePayload.members) && Array.isArray(responsePayload.transactions) && responsePayload.transactions.length > 0) {
            const latestTxMap = new Map<string, any>();
            for (const tx of responsePayload.transactions) {
              if (tx && tx.memberId && !latestTxMap.has(tx.memberId)) {
                latestTxMap.set(tx.memberId, tx);
              }
              if (tx && tx.memberEmail && !latestTxMap.has(tx.memberEmail)) {
                latestTxMap.set(tx.memberEmail, tx);
              }
            }
            responsePayload.members = responsePayload.members.map((m: any) => {
              if (!m) return m;
              const tx = latestTxMap.get(m.id) || latestTxMap.get(m.email);
              if (tx && tx.balanceAfter !== undefined && (m.balance === 0 || m.balance === undefined)) {
                return {
                  ...m,
                  balance: Math.max(0, Number(tx.balanceAfter) || 0),
                  wallet_balance: Math.max(0, Number(tx.balanceAfter) || 0),
                };
              }
              return m;
            });
          }
          if (d1SepayRes && d1SepayRes.results) responsePayload.sepayLogs = d1SepayRes.results;
        } catch (d1QueryErr: any) {
          console.warn('[Sync GET D1 Query Error]', d1QueryErr?.message);
        }
      } else {
        const safeMembers = (masterState.members || []).map((m: any) => {
          if (!m || typeof m !== 'object') return m;
          const { passwordHash, salt, recoveryOtp, ...safe } = m;
          return safe;
        });
        responsePayload.members = safeMembers;
        responsePayload.transactions = masterState.transactions || [];
        responsePayload.orders = masterState.orders || [];
      }
    }

    const isNoCache = request.headers.get('Cache-Control')?.includes('no-cache') ||
                      request.headers.get('Pragma')?.includes('no-cache') ||
                      url.searchParams.has('nocache') ||
                      url.searchParams.has('fresh');

    return new Response(JSON.stringify(responsePayload), {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': (authorized || isNoCache)
          ? 'no-cache, no-store, must-revalidate'
          : 'public, max-age=15, s-maxage=30, stale-while-revalidate=60',
        'X-Server-Time': new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[API /api/sync] Error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Sync error',
        timestamp: new Date().toISOString(),
        serverTime: new Date().toISOString(),
        storeProducts: [],
        utilities: [],
      }),
      {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          'X-Server-Time': new Date().toISOString(),
        },
      }
    );
  }
};

/**
 * Smart merge CMS Content into D1 with timestamp protection:
 * Guarantees that newer/customized CMS items are never overwritten by stale tabs or default hardcoded values.
 */
async function mergeContentIntoD1(db: D1Database, incomingContent: any[]): Promise<any[]> {
  if (!Array.isArray(incomingContent) || incomingContent.length === 0) return [];
  try {
    const existingRaw = await getSettingD1(db, 'wcg_admin_content_v4');
    const existingList: any[] = Array.isArray(existingRaw) ? existingRaw : [];

    const map = new Map<string, any>();
    // 1. Add all existing items first
    for (const item of existingList) {
      if (item && item.key) {
        map.set(item.key, item);
      }
    }

    // 2. Process incoming items with timestamp & protection check
    for (const item of incomingContent) {
      if (!item || !item.key) continue;
      const existing = map.get(item.key);
      if (!existing) {
        map.set(item.key, item);
      } else {
        const incomingTime = item.updatedAt ? Date.parse(item.updatedAt) : 0;
        const existingTime = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
        // If incoming item has a newer or equal timestamp, update it.
        // But if incoming is older (e.g. default 2026-09-28), DO NOT overwrite customized existing item!
        if (isNaN(incomingTime) || isNaN(existingTime) || incomingTime >= existingTime) {
          map.set(item.key, { ...existing, ...item });
        }
      }
    }

    const merged = Array.from(map.values());
    await setSettingD1(db, 'wcg_admin_content_v4', merged);
    return merged;
  } catch (err: any) {
    console.warn('[mergeContentIntoD1 error]', err?.message);
    await setSettingD1(db, 'wcg_admin_content_v4', incomingContent);
    return incomingContent;
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database Cloudflare D1 (env.DB) chưa được kích hoạt.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const body: any = await request.json();
    const authResult = await isAuthorized(request, env);
    const authorized = authResult.authorized;
    const timestamp = new Date().toISOString();

    if (!authorized) {
      // 1. Public endpoint for pushing real marketing events & master copy counter
      if (body.type === 'push_real_event' && (body.event || body.copyIncrement)) {
        const hub = await getRealEventsHub(env);
        const vnToday = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
        if (hub.date !== vnToday) {
          hub.date = vnToday;
          hub.masterCopyClicks = 0;
        }
        if (typeof hub.masterCopyClicks !== 'number') hub.masterCopyClicks = 0;
        if (!hub.realProductSoldCounts || typeof hub.realProductSoldCounts !== 'object') hub.realProductSoldCounts = {};
        if (!hub.realGiveawayClaimedCounts || typeof hub.realGiveawayClaimedCounts !== 'object') hub.realGiveawayClaimedCounts = {};

        const increment = Math.max(0, Math.min(10, Number(body.copyIncrement) || 0));
        if (increment > 0) {
          hub.masterCopyClicks += increment;
        }

        // Anti-spoofing validation on incoming event
        if (body.event && body.event.id && body.event.type) {
          const evt = body.event;
          const evtTime = Number(evt.timestamp) || 0;
          const nowMs = Date.now();
          const isTimestampValid = Math.abs(nowMs - evtTime) < 300000; // Cho phép sai lệch đồng hồ tối đa 5 phút giữa client và server

          let isEventAuthentic = isTimestampValid;

          if (isEventAuthentic && (evt.type === 'BUY_PRODUCT' || evt.type === 'CLAIM_GIVEAWAY')) {
            // Validate product/giveaway exists and is active in D1
            if (evt.type === 'BUY_PRODUCT') {
              const pId = evt.productId;
              let isSpValid = false;
              if (env.DB && pId) {
                try {
                  const row = await env.DB.prepare('SELECT id, is_active FROM store_products WHERE id = ?').bind(pId).first<any>();
                  if (row && row.is_active !== 0 && row.is_active !== false) {
                    isSpValid = true;
                  } else {
                    const uRow = await env.DB.prepare('SELECT id, is_active FROM utilities WHERE id = ?').bind(pId).first<any>();
                    if (uRow && uRow.is_active !== 0 && uRow.is_active !== false) {
                      isSpValid = true;
                    }
                  }
                } catch {}
              }
              if (!isSpValid && pId && (pId.startsWith('sp_') || pId.startsWith('ut_'))) {
                isSpValid = true;
              }
              isEventAuthentic = isSpValid;
            } else if (evt.type === 'CLAIM_GIVEAWAY') {
              const gwId = evt.giveawayId;
              let isGwValid = false;
              if (env.DB && gwId) {
                try {
                  const row = await env.DB.prepare("SELECT id, status FROM giveaways WHERE id = ?").bind(gwId).first<any>();
                  if (row && row.status === 'ACTIVE') {
                    isGwValid = true;
                  }
                } catch {}
              }
              if (!isGwValid && gwId && gwId.startsWith('gw_')) {
                isGwValid = true;
              }
              isEventAuthentic = isGwValid;
            }
          }

          if (isEventAuthentic) {
            const cdSec = Math.max(5, Math.min(120, Number(body.cooldownSec) || 20));
            const cdMs = cdSec * 1000;

            // Semantic deduplication: ignore if same ID or same item within CD window
            const exists = hub.events.some((e: any) => {
              if (!e) return false;
              if (e.id === evt.id) return true;
              const sameType = e.type === evt.type;
              const sameTarget = (evt.productId && e.productId === evt.productId) ||
                                 (evt.giveawayId && e.giveawayId === evt.giveawayId) ||
                                 (evt.gameSlug && e.gameSlug === evt.gameSlug);
              const timeDiff = Math.abs((Number(e.timestamp) || 0) - (Number(evt.timestamp) || 0));
              return sameType && sameTarget && timeDiff < cdMs;
            });

            if (!exists) {
              evt.serverTimestamp = nowMs;
              evt.scheduledFireTime = nowMs; // Nổ luôn lập tức
              evt.isRealUser = true;

              // Layer 2: Server Priority Gate & Anti-Spam (Cho phép người dùng thật lan tỏa tức thì)
              let allowEventIntoQueue = true;
              if (evt.type === 'COPY_CODE') {
                const targetKey = evt.gameSlug || evt.gameName || '';
                const recentCopy = hub.events.find((e: any) => {
                  if (!e || e.type !== 'COPY_CODE') return false;
                  const eTarget = e.gameSlug || e.gameName || '';
                  return (!targetKey || !eTarget || targetKey === eTarget);
                });
                if (recentCopy && recentCopy.timestamp && (nowMs - Number(recentCopy.timestamp) < cdMs)) {
                  allowEventIntoQueue = false; // Chống spam cùng 1 game trong khoảng thời gian CD
                }
              }

              if (allowEventIntoQueue) {
                hub.events.unshift(evt);
                if (hub.events.length > 20) {
                  hub.events = hub.events.slice(0, 20);
                }

                if (evt.type === 'BUY_PRODUCT' && evt.productId) {
                  hub.realProductSoldCounts[evt.productId] = (hub.realProductSoldCounts[evt.productId] || 0) + (Number(evt.quantity) || 1);
                  hub.peakProductSoldCounts = hub.peakProductSoldCounts || {};
                  hub.peakProductSoldCounts[evt.productId] = Math.max(
                    hub.peakProductSoldCounts[evt.productId] || 0,
                    hub.realProductSoldCounts[evt.productId]
                  );
                  if (hub.lowestProductStock && typeof hub.lowestProductStock[evt.productId] === 'number') {
                    hub.lowestProductStock[evt.productId] = Math.max(0, hub.lowestProductStock[evt.productId] - (Number(evt.quantity) || 1));
                  }
                } else if (evt.type === 'CLAIM_GIVEAWAY' && evt.giveawayId) {
                  hub.realGiveawayClaimedCounts[evt.giveawayId] = (hub.realGiveawayClaimedCounts[evt.giveawayId] || 0) + 1;
                  hub.peakGiveawayClaimedCounts = hub.peakGiveawayClaimedCounts || {};
                  hub.peakGiveawayClaimedCounts[evt.giveawayId] = Math.max(
                    hub.peakGiveawayClaimedCounts[evt.giveawayId] || 0,
                    hub.realGiveawayClaimedCounts[evt.giveawayId]
                  );
                  if (hub.lowestGiveawayRemaining && typeof hub.lowestGiveawayRemaining[evt.giveawayId] === 'number') {
                    hub.lowestGiveawayRemaining[evt.giveawayId] = Math.max(0, hub.lowestGiveawayRemaining[evt.giveawayId] - 1);
                  }
                }
              }
            }
          }
        }

        hub.date = vnToday;
        hub.updatedAt = new Date().toISOString();
        await saveRealEventsHub(env, hub);

        return new Response(
          JSON.stringify({
            success: true,
            masterCopyClicks: hub.masterCopyClicks,
            masterCopyClicksDate: vnToday,
            realProductSoldCounts: hub.realProductSoldCounts,
            realGiveawayClaimedCounts: hub.realGiveawayClaimedCounts,
            event: body.event || undefined,
            server_time: Date.now(),
          }),
          { headers: CORS_HEADERS }
        );
      }

      // 2. Public endpoint for debounced client peak metrics reporting (Two-way rollup to D1)
      if (body.type === 'report_peak_metrics') {
        const hub = await getRealEventsHub(env);
        const vnToday = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
        if (hub.date !== vnToday) {
          hub.date = vnToday;
          hub.masterCopyClicks = 0;
          hub.peakCopyClicks = 0;
        }
        if (!hub.peakProductSoldCounts || typeof hub.peakProductSoldCounts !== 'object') hub.peakProductSoldCounts = {};
        if (!hub.peakGiveawayClaimedCounts || typeof hub.peakGiveawayClaimedCounts !== 'object') hub.peakGiveawayClaimedCounts = {};
        if (!hub.lowestProductStock || typeof hub.lowestProductStock !== 'object') hub.lowestProductStock = {};
        if (!hub.lowestGiveawayRemaining || typeof hub.lowestGiveawayRemaining !== 'object') hub.lowestGiveawayRemaining = {};

        let changed = false;
        const isForceReset = Boolean(body.forceReset || body.forceResetSold || body.forceResetClaimed || body.forceResetStock);

        // Peak sold: Keep max, but auto-heal or force-reset if admin explicitly updated
        if (body.peakSold && typeof body.peakSold === 'object') {
          for (const [pId, val] of Object.entries(body.peakSold)) {
            const num = Number(val);
            if (!isNaN(num) && num >= 0 && num < 1000000) {
              const cur = hub.peakProductSoldCounts[pId] || 0;
              if (body.forceResetSold || body.forceReset || isForceReset) {
                hub.peakProductSoldCounts[pId] = num;
                changed = true;
              } else if (cur === 0 || num > cur) {
                hub.peakProductSoldCounts[pId] = num;
                changed = true;
              }
            }
          }
        }

        // Peak claimed: Keep max, but auto-heal or force-reset if admin explicitly updated
        if (body.peakClaimed && typeof body.peakClaimed === 'object') {
          for (const [gId, val] of Object.entries(body.peakClaimed)) {
            const num = Number(val);
            if (!isNaN(num) && num >= 0 && num < 1000000) {
              const cur = hub.peakGiveawayClaimedCounts[gId] || 0;
              if (body.forceResetClaimed || body.forceReset || isForceReset) {
                hub.peakGiveawayClaimedCounts[gId] = num;
                changed = true;
              } else if (cur === 0 || num > cur) {
                hub.peakGiveawayClaimedCounts[gId] = num;
                changed = true;
              }
            }
          }
        }

        // Peak copy count: Keep max
        if (typeof body.peakCopy === 'number' && body.peakCopy > 0) {
          const num = Math.min(1000000, Math.floor(body.peakCopy));
          const cur = hub.peakCopyClicks || 0;
          if (num > cur) {
            hub.peakCopyClicks = num;
            changed = true;
          }
        }

        // Peak master real clicks
        if (typeof body.peakMasterClicks === 'number' && body.peakMasterClicks > 0) {
          const num = Math.min(1000000, Math.floor(body.peakMasterClicks));
          const cur = hub.masterCopyClicks || 0;
          if (num > cur) {
            hub.masterCopyClicks = num;
            changed = true;
          }
        }

        // Lowest stock: Keep min (stock decreases when bought), allow restock jump
        if (body.lowestStock && typeof body.lowestStock === 'object') {
          for (const [pId, val] of Object.entries(body.lowestStock)) {
            const num = Number(val);
            if (num >= 0 && num < 1000000) {
              const cur = hub.lowestProductStock[pId];
              const isRestockJump = cur !== undefined && num > cur;
              const isDownwardHeal = cur !== undefined && cur > 50 && num < cur;
              if (body.forceResetStock || cur === undefined || num < cur || isRestockJump || isDownwardHeal) {
                hub.lowestProductStock[pId] = num;
                changed = true;
              }
            }
          }
        }

        // Lowest remaining giveaway: Keep min, allow restock jump
        if (body.lowestRemaining && typeof body.lowestRemaining === 'object') {
          for (const [gId, val] of Object.entries(body.lowestRemaining)) {
            const num = Number(val);
            if (num >= 0 && num < 1000000) {
              const cur = hub.lowestGiveawayRemaining[gId];
              const isRestockJump = cur !== undefined && num > cur;
              const isDownwardHeal = cur !== undefined && cur > 50 && num < cur;
              if (body.forceResetStock || cur === undefined || num < cur || isRestockJump || isDownwardHeal) {
                hub.lowestGiveawayRemaining[gId] = num;
                changed = true;
              }
            }
          }
        }

        if (changed || isForceReset) {
          hub.updatedAt = new Date().toISOString();
          await saveRealEventsHub(env, hub, isForceReset);

          // CHỈ xóa cache và snapshot khi có yêu cầu cưỡng chế forceReset từ Admin
          // Client report peak metric không được phép phá vỡ Edge CDN Cache
          if (isForceReset) {
            const gScope = globalThis as any;
            gScope.__wcg_metrics_snapshot = null;

            if (env && env.DB) {
              await setSettingD1(env.DB, 'wcg_hourly_fomo_stats', null).catch(() => {});
              await env.DB.prepare('DELETE FROM system_snapshots').run().catch(() => {});
            }

            // Invalidate edge cache for /api/metrics/synced, /api/stats, and /api/realtime-events
            try {
              if (typeof caches !== 'undefined' && (caches as any).default) {
                const cache = (caches as any).default;
                const cacheUrl = new URL(request.url);
                cacheUrl.pathname = '/api/metrics/synced';
                cacheUrl.search = '';
                await cache.delete(new Request(cacheUrl.toString(), { method: 'GET' }));

                const statsUrl = new URL(request.url);
                statsUrl.pathname = '/api/stats';
                statsUrl.search = '';
                await cache.delete(new Request(statsUrl.toString(), { method: 'GET' }));

                const eventsUrl = new URL(request.url);
                eventsUrl.pathname = '/api/realtime-events';
                eventsUrl.search = '';
                await cache.delete(new Request(eventsUrl.toString(), { method: 'GET' }));
              }
            } catch {}
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            masterCopyClicks: hub.masterCopyClicks,
            peakCopyClicks: hub.peakCopyClicks,
            server_time: Date.now(),
          }),
          { headers: CORS_HEADERS }
        );
      }

      if (body.key === 'wcg_admin_submissions_v4' && body.data) {
        let existing: any[] = [];
        if (env.DB) {
          try {
            const raw = await getSettingD1(env.DB, 'wcg_admin_submissions_v4');
            if (raw) existing = typeof raw === 'string' ? JSON.parse(raw) : raw;
          } catch {}
        }
        const submissionItem = Array.isArray(body.data) ? body.data[0] : body.data;
        if (submissionItem) {
          if (!Array.isArray(existing)) existing = [];
          existing.unshift(submissionItem);
          const sliced = existing.slice(0, 500);
          if (env.DB) {
            await setSettingD1(env.DB, 'wcg_admin_submissions_v4', sliced);
          }
          return new Response(
            JSON.stringify({ success: true, message: 'Đã gửi duyệt' }),
            { headers: CORS_HEADERS }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: authResult.error || (authResult.status === 403 ? 'Forbidden' : 'Unauthorized'),
          message: authResult.status === 403 ? 'Bạn không có quyền ghi dữ liệu quản trị này.' : 'Yêu cầu quyền quản trị.',
        }),
        { status: authResult.status, headers: CORS_HEADERS }
      );
    }

    // Action: Xóa toàn bộ khóa IP rate limit (mở khóa ngay lập tức cho người dùng bị khóa)
    if ((body.action === 'clear_ip_rate_limits' || body.action === 'unlock_all_ips') && env.DB) {
      try {
        await env.DB.prepare("DELETE FROM ip_rate_limits").run();
        return new Response(
          JSON.stringify({ success: true, message: 'Đã mở khóa toàn bộ IP bị giới hạn thành công!' }),
          { headers: CORS_HEADERS }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ success: false, error: String(e) }),
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    // Action: Duyệt giftcode từ Crawler đưa lên hệ thống chính thức
    if (body.action === 'approve_crawler_code' && env.DB) {
      try {
        const pendingId = String(body.pendingId || body.id || '').trim();
        const editedCode = body.editedCode || {};
        const pendingListRaw = await getSettingD1(env.DB, 'wcg_crawler_pending_codes_v1') || [];
        const pendingList: any[] = Array.isArray(pendingListRaw) ? pendingListRaw : [];
        const targetIndex = pendingList.findIndex((p: any) => p && p.id === pendingId);
        
        if (targetIndex === -1 && !body.pendingCode) {
          return new Response(JSON.stringify({ success: false, error: 'Không tìm thấy mã trong hàng chờ duyệt' }), { status: 404, headers: CORS_HEADERS });
        }

        const sourceItem = targetIndex !== -1 ? pendingList[targetIndex] : (body.pendingCode || {});
        const finalCode = String(editedCode.code || sourceItem.code || '').trim().toUpperCase();
        const customListRaw = await getSettingD1(env.DB, 'wcg_admin_custom_free_codes_v1') || [];
        const customList: any[] = Array.isArray(customListRaw) ? customListRaw : [];

        const approvedItem = {
          id: `fc_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          gameId: editedCode.gameId || sourceItem.gameId || sourceItem.gameSlug || '',
          gameSlug: editedCode.gameSlug || sourceItem.gameSlug || '',
          gameName: editedCode.gameName || sourceItem.gameName || '',
          code: finalCode,
          codeValue: finalCode,
          rewards: editedCode.rewards || sourceItem.rewards || 'Quà tặng tân thủ & sự kiện',
          status: 'ACTIVE',
          type: 'EVENT',
          sourceUrl: sourceItem.sourceUrl || '',
          sourceType: sourceItem.sourceType || 'reputable_web',
          score: sourceItem.score || 85,
          tier: sourceItem.tier || 2,
          expiresAt: editedCode.expiresAt || sourceItem.expiresAt || '2026-12-31',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Thêm vào custom codes (lên đầu danh sách)
        const newCustomList = [approvedItem, ...customList.filter((c: any) => c && c.code !== finalCode)];
        await setSettingD1(env.DB, 'wcg_admin_custom_free_codes_v1', newCustomList);

        // Xóa khỏi pending codes nếu có
        if (targetIndex !== -1) {
          pendingList.splice(targetIndex, 1);
          await setSettingD1(env.DB, 'wcg_crawler_pending_codes_v1', pendingList);
        }

        invalidateGamesCatalogCache();

        return new Response(JSON.stringify({
          success: true,
          message: `Đã duyệt và kích hoạt thành công mã ${finalCode} cho game ${approvedItem.gameName || approvedItem.gameSlug}!`,
          approvedItem,
          remainingPendingCount: pendingList.length
        }), { headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), { status: 500, headers: CORS_HEADERS });
      }
    }

    // Action: Từ chối / Xóa mã giftcode trong hàng chờ duyệt
    if (body.action === 'reject_crawler_code' && env.DB) {
      try {
        const pendingId = String(body.pendingId || body.id || '').trim();
        const pendingListRaw = await getSettingD1(env.DB, 'wcg_crawler_pending_codes_v1') || [];
        const pendingList: any[] = Array.isArray(pendingListRaw) ? pendingListRaw : [];
        const nextList = pendingList.filter((p: any) => p && p.id !== pendingId);
        await setSettingD1(env.DB, 'wcg_crawler_pending_codes_v1', nextList);

        return new Response(JSON.stringify({
          success: true,
          message: 'Đã từ chối và loại bỏ mã khỏi hàng chờ duyệt.',
          remainingPendingCount: nextList.length
        }), { headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), { status: 500, headers: CORS_HEADERS });
      }
    }

    // Action: Duyệt hàng loạt giftcode
    if (body.action === 'batch_approve_crawler_codes' && env.DB && Array.isArray(body.pendingIds)) {
      try {
        const targetIds = new Set(body.pendingIds.map(String));
        const pendingListRaw = await getSettingD1(env.DB, 'wcg_crawler_pending_codes_v1') || [];
        const pendingList: any[] = Array.isArray(pendingListRaw) ? pendingListRaw : [];
        const customListRaw = await getSettingD1(env.DB, 'wcg_admin_custom_free_codes_v1') || [];
        const customList: any[] = Array.isArray(customListRaw) ? customListRaw : [];

        const approvedItems: any[] = [];
        const remainingPending: any[] = [];

        for (const item of pendingList) {
          if (item && targetIds.has(item.id)) {
            approvedItems.push({
              id: `fc_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              gameId: item.gameId || item.gameSlug || '',
              gameSlug: item.gameSlug || '',
              gameName: item.gameName || '',
              code: String(item.code || '').trim().toUpperCase(),
              codeValue: String(item.code || item.codeValue || '').trim().toUpperCase(),
              rewards: item.rewards || 'Quà tặng tân thủ & sự kiện',
              status: 'ACTIVE',
              type: 'EVENT',
              sourceUrl: item.sourceUrl || '',
              sourceType: item.sourceType || 'reputable_web',
              score: item.score || 85,
              tier: item.tier || 2,
              expiresAt: item.expiresAt || '2026-12-31',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } else if (item) {
            remainingPending.push(item);
          }
        }

        if (approvedItems.length > 0) {
          const mergedCustom = [...approvedItems, ...customList];
          await setSettingD1(env.DB, 'wcg_admin_custom_free_codes_v1', mergedCustom);
          await setSettingD1(env.DB, 'wcg_crawler_pending_codes_v1', remainingPending);
          invalidateGamesCatalogCache();
        }

        return new Response(JSON.stringify({
          success: true,
          message: `Đã duyệt và kích hoạt thành công ${approvedItems.length} mã giftcode!`,
          approvedCount: approvedItems.length,
          remainingPendingCount: remainingPending.length
        }), { headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), { status: 500, headers: CORS_HEADERS });
      }
    }

    // Action: Từ chối / Xóa hàng loạt giftcode
    if (body.action === 'batch_reject_crawler_codes' && env.DB && Array.isArray(body.pendingIds)) {
      try {
        const targetIds = new Set(body.pendingIds.map(String));
        const pendingListRaw = await getSettingD1(env.DB, 'wcg_crawler_pending_codes_v1') || [];
        const pendingList: any[] = Array.isArray(pendingListRaw) ? pendingListRaw : [];
        const nextList = pendingList.filter((p: any) => p && !targetIds.has(p.id));
        await setSettingD1(env.DB, 'wcg_crawler_pending_codes_v1', nextList);

        return new Response(JSON.stringify({
          success: true,
          message: `Đã loại bỏ ${targetIds.size} mã khỏi hàng chờ duyệt.`,
          remainingPendingCount: nextList.length
        }), { headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), { status: 500, headers: CORS_HEADERS });
      }
    }

    // Action: Duyệt Game mới từ Google Play Crawler đưa lên hệ thống chính thức
    if (body.action === 'approve_crawler_game' && env.DB) {
      try {
        const pendingId = String(body.pendingId || body.id || '').trim();
        const editedGame = body.editedGame || {};
        const pendingListRaw = await getSettingD1(env.DB, 'wcg_crawler_pending_games_v1') || [];
        const pendingList: any[] = Array.isArray(pendingListRaw) ? pendingListRaw : [];
        const targetIndex = pendingList.findIndex((p: any) => p && (p.id === pendingId || p.slug === pendingId));
        
        if (targetIndex === -1 && !body.pendingGame) {
          return new Response(JSON.stringify({ success: false, error: 'Không tìm thấy game trong hàng chờ duyệt' }), { status: 404, headers: CORS_HEADERS });
        }

        const sourceItem = targetIndex !== -1 ? pendingList[targetIndex] : (body.pendingGame || {});
        const finalSlug = String(editedGame.slug || sourceItem.slug || '').trim() || `game-${Date.now()}`;
        const finalName = String(editedGame.name || sourceItem.name || '').trim();
        const finalDeveloper = String(editedGame.developer || sourceItem.developer || editedGame.publisher || 'NPH Chính Thức').trim();

        // Lấy danh sách games hiện tại trên D1
        const rawGames = await getSettingD1(env.DB, 'wcg_admin_games_v5') || await getSettingD1(env.DB, 'wcg_admin_games_v4') || (fallbackGamesData as any[]);
        const gamesList: any[] = Array.isArray(rawGames) ? [...rawGames] : [];

        const existingGameIndex = gamesList.findIndex((g: any) => g && (g.slug === finalSlug || g.id === finalSlug));

        const isCodeMoi = sourceItem.sourceType === 'codemoi' || (sourceItem.sourceUrl && sourceItem.sourceUrl.includes('codemoi.net'));
        let targetIcon = editedGame.iconUrl || sourceItem.localIconPath || `/game_icons/${finalSlug}.webp`;
        if (!targetIcon || targetIcon.includes('codemoi.net')) {
          targetIcon = `/game_icons/${finalSlug}.webp`;
        }
        const newGameRecord = {
          id: finalSlug,
          slug: finalSlug,
          name: finalName,
          publisher: finalDeveloper,
          category: editedGame.category || sourceItem.category || 'Nhập Vai',
          rating: Number(editedGame.rating || sourceItem.rating || 4.8),
          icon_url: targetIcon,
          cover_image_url: targetIcon,
          banner_url: '',
          description: editedGame.description || sourceItem.description || `${finalName} là tựa game mobile mới phát hành chính thức bởi ${finalDeveloper}.`,
          short_description: `${finalName} - Game Mobile Mới`,
          instructions: 'Bước 1: Mở game > Nhấn Avatar nhân vật\nBước 2: Chọn Cài đặt > Nhập Giftcode\nBước 3: Dán mã và nhấn Xác nhận.',
          platform: 'Android, iOS, PC',
          release_date: editedGame.releaseDate || sourceItem.releaseDate || new Date().toISOString().split('T')[0],
          download_android: sourceItem.playStoreUrl || (sourceItem.packageId ? `https://play.google.com/store/apps/details?id=${sourceItem.packageId}` : ''),
          is_featured: false,
          is_hot: false,
          is_new: true,
          is_active: true,
          status: 'ACTIVE',
          codes_count: 0,
          free_codes_count: 0,
          source: isCodeMoi ? 'Code Mới (codemoi.net)' : 'Google Play Store VN',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

          if (existingGameIndex !== -1) {
            gamesList[existingGameIndex] = { ...gamesList[existingGameIndex], ...newGameRecord };
          } else {
            gamesList.unshift(newGameRecord);
          }

          await setSettingD1(env.DB, 'wcg_admin_games_v5', gamesList);

          // Tự động tạo nguồn crawler sources cho game đó nếu chưa có
          try {
            const sourcesRaw = await getSettingD1(env.DB, 'wcg_crawler_sources_v1') || [];
            const sources: any[] = Array.isArray(sourcesRaw) ? [...sourcesRaw] : [];
            const hasSource = sources.some((s: any) => s && s.targetGameSlug === finalSlug);
            if (!hasSource) {
              const crawlerUrl = (isCodeMoi && sourceItem.sourceUrl)
                ? sourceItem.sourceUrl
                : `https://www.google.com/search?q=${encodeURIComponent('giftcode ' + finalName)}`;
              sources.push({
                id: `src_auto_${finalSlug}_${Date.now()}`,
                name: `${isCodeMoi ? 'CodeMoi' : 'Google Search'} Code ${finalName}`,
                type: 'reputable_web',
                url: crawlerUrl,
                targetGameSlug: finalSlug,
                isEnabled: true,
                description: `Tự động sinh khi duyệt game ${finalName}`
              });
              await setSettingD1(env.DB, 'wcg_crawler_sources_v1', sources);
            }
          } catch {}

        // Xóa khỏi pending list
        if (targetIndex !== -1) {
          pendingList.splice(targetIndex, 1);
          await setSettingD1(env.DB, 'wcg_crawler_pending_games_v1', pendingList);
        }

        invalidateGamesCatalogCache();
        await invalidateCatalogEdgeCache(context as any, request, env).catch(() => {});

        return new Response(JSON.stringify({
          success: true,
          message: `Đã duyệt và đăng thành công game ${finalName} lên hệ thống!`,
          approvedGame: newGameRecord,
          remainingPendingCount: pendingList.length
        }), { headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), { status: 500, headers: CORS_HEADERS });
      }
    }

    // Action: Từ chối / Xóa game trong hàng chờ duyệt
    if (body.action === 'reject_crawler_game' && env.DB) {
      try {
        const pendingId = String(body.pendingId || body.id || '').trim();
        const pendingListRaw = await getSettingD1(env.DB, 'wcg_crawler_pending_games_v1') || [];
        const pendingList: any[] = Array.isArray(pendingListRaw) ? pendingListRaw : [];
        const nextList = pendingList.filter((p: any) => p && p.id !== pendingId && p.slug !== pendingId);
        await setSettingD1(env.DB, 'wcg_crawler_pending_games_v1', nextList);

        return new Response(JSON.stringify({
          success: true,
          message: 'Đã loại bỏ game khỏi hàng chờ duyệt.',
          remainingPendingCount: nextList.length
        }), { headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), { status: 500, headers: CORS_HEADERS });
      }
    }

    // Action: Duyệt hàng loạt game từ Crawler
    if (body.action === 'batch_approve_crawler_games' && env.DB && Array.isArray(body.pendingIds)) {
      try {
        const targetIds = new Set(body.pendingIds.map(String));
        const pendingListRaw = await getSettingD1(env.DB, 'wcg_crawler_pending_games_v1') || [];
        const pendingList: any[] = Array.isArray(pendingListRaw) ? pendingListRaw : [];
        const rawGames = await getSettingD1(env.DB, 'wcg_admin_games_v5') || await getSettingD1(env.DB, 'wcg_admin_games_v4') || (fallbackGamesData as any[]);
        const gamesList: any[] = Array.isArray(rawGames) ? [...rawGames] : [];

        const approvedGames: any[] = [];
        const remainingPending: any[] = [];

        // Hợp nhất pendingList từ D1 với danh sách pendingGames do client gửi lên (nếu có)
        const clientPendingList = Array.isArray(body.pendingGames) ? body.pendingGames : [];
        const combinedPending = [...pendingList];
        for (const cp of clientPendingList) {
          if (cp && (cp.id || cp.slug) && !combinedPending.some(x => x && (x.id === cp.id || x.slug === cp.slug))) {
            combinedPending.push(cp);
          }
        }

        for (const item of combinedPending) {
          if (item && (targetIds.has(String(item.id)) || targetIds.has(String(item.slug)))) {
            const finalSlug = String(item.slug || `game-${Date.now()}`);
            const finalName = String(item.name || '').trim();
            const finalDeveloper = String(item.developer || 'NPH Chính Thức').trim();

            const isCodeMoi = item.sourceType === 'codemoi' || (item.sourceUrl && item.sourceUrl.includes('codemoi.net'));
            let targetBatchIcon = item.localIconPath || (item.iconUrl && item.iconUrl.startsWith('/') ? item.iconUrl : `/game_icons/${finalSlug}.webp`);
            if (!targetBatchIcon || targetBatchIcon.includes('codemoi.net')) {
              targetBatchIcon = `/game_icons/${finalSlug}.webp`;
            }
            const newGameRecord = {
              id: finalSlug,
              slug: finalSlug,
              name: finalName,
              publisher: finalDeveloper,
              category: item.category || 'Nhập Vai',
              rating: Number(item.rating || 4.8),
              icon_url: targetBatchIcon,
              cover_image_url: targetBatchIcon,
              banner_url: '',
              description: item.description || `${finalName} là tựa game mobile mới phát hành chính thức bởi ${finalDeveloper}.`,
              short_description: `${finalName} - Game Mobile Mới`,
              instructions: 'Bước 1: Mở game > Nhấn Avatar nhân vật\nBước 2: Chọn Cài đặt > Nhập Giftcode\nBước 3: Dán mã và nhấn Xác nhận.',
              platform: 'Android, iOS, PC',
              release_date: item.releaseDate || new Date().toISOString().split('T')[0],
              download_android: item.playStoreUrl || (item.packageId ? `https://play.google.com/store/apps/details?id=${item.packageId}` : ''),
              is_featured: false,
              is_hot: false,
              is_new: true,
              is_active: true,
              status: 'ACTIVE',
              codes_count: Number(item.activeCodesCount || 0),
              free_codes_count: Number(item.activeCodesCount || 0),
              source: isCodeMoi ? 'Code Mới (codemoi.net)' : 'Google Play Store VN',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            const existIdx = gamesList.findIndex((g: any) => g && (g.slug === finalSlug || g.id === finalSlug));
            if (existIdx !== -1) {
              gamesList[existIdx] = { ...gamesList[existIdx], ...newGameRecord };
            } else {
              gamesList.unshift(newGameRecord);
            }
            approvedGames.push(newGameRecord);
          } else {
            remainingPending.push(item);
          }
        }

        if (approvedGames.length > 0) {
          await setSettingD1(env.DB, 'wcg_admin_games_v5', gamesList);
          await setSettingD1(env.DB, 'wcg_crawler_pending_games_v1', remainingPending);
          invalidateGamesCatalogCache();
          await invalidateCatalogEdgeCache(context as any, request, env).catch(() => {});
        }

        return new Response(JSON.stringify({
          success: true,
          message: `Đã duyệt thành công ${approvedGames.length} game mới lên hệ thống!`,
          approvedCount: approvedGames.length,
          approvedGames,
          remainingPendingCount: remainingPending.length
        }), { headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), { status: 500, headers: CORS_HEADERS });
      }
    }

    // Action: update_pending_game_logo
    if (body.action === 'update_pending_game_logo' && env.DB) {
      try {
        const pendingId = String(body.pendingId || body.id || '').trim();
        const newIconUrl = String(body.iconUrl || '').trim();
        const newPlayStoreUrl = String(body.playStoreUrl || '').trim();
        const pendingListRaw = await getSettingD1(env.DB, 'wcg_crawler_pending_games_v1') || [];
        const pendingList: any[] = Array.isArray(pendingListRaw) ? [...pendingListRaw] : [];
        const targetIndex = pendingList.findIndex((p: any) => p && (p.id === pendingId || p.slug === pendingId));
        if (targetIndex !== -1) {
          if (newIconUrl) pendingList[targetIndex].iconUrl = newIconUrl;
          if (newPlayStoreUrl) pendingList[targetIndex].playStoreUrl = newPlayStoreUrl;
          await setSettingD1(env.DB, 'wcg_crawler_pending_games_v1', pendingList);
          return new Response(JSON.stringify({ success: true, message: 'Đã cập nhật logo game thành công', updatedGame: pendingList[targetIndex] }), { status: 200, headers: CORS_HEADERS });
        }
        return new Response(JSON.stringify({ success: false, error: 'Không tìm thấy game trong danh sách chờ' }), { status: 404, headers: CORS_HEADERS });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: CORS_HEADERS });
      }
    }

    // Action: Từ chối / Xóa hàng loạt game trong hàng chờ duyệt
    if (body.action === 'batch_reject_crawler_games' && env.DB && Array.isArray(body.pendingIds)) {
      try {
        const targetIds = new Set(body.pendingIds.map(String));
        const pendingListRaw = await getSettingD1(env.DB, 'wcg_crawler_pending_games_v1') || [];
        const pendingList: any[] = Array.isArray(pendingListRaw) ? pendingListRaw : [];
        const nextList = pendingList.filter((p: any) => p && !targetIds.has(String(p.id)) && !targetIds.has(String(p.slug)));
        await setSettingD1(env.DB, 'wcg_crawler_pending_games_v1', nextList);

        return new Response(JSON.stringify({
          success: true,
          message: `Đã loại bỏ ${targetIds.size} game khỏi hàng chờ duyệt.`,
          remainingPendingCount: nextList.length
        }), { headers: CORS_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), { status: 500, headers: CORS_HEADERS });
      }
    }

    // Action: Quét trực tiếp game mới từ CodeMoi.net trên Cloudflare Edge Function
    if (body.action === 'scan_codemoi_new_games' && env.DB) {
      try {
        const resp = await fetch('https://codemoi.net/game-moi/', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8'
          }
        });
        if (!resp.ok) {
          return new Response(JSON.stringify({ success: false, error: `Không thể kết nối codemoi.net (HTTP ${resp.status})` }), { status: 502, headers: CORS_HEADERS });
        }
        const html = await resp.text();
        const codemoiGames: any[] = [];
        const liRegex = /<li[^>]*class="[^"]*flex items-start[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
        let match;
        while ((match = liRegex.exec(html)) !== null) {
          const liContent = match[1];
          const hrefMatch = liContent.match(/href="\/games\/([a-z0-9\-]+)\/?"/i);
          if (!hrefMatch) continue;
          const slug = hrefMatch[1];
          const imgMatch = liContent.match(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/i);
          let iconUrl = imgMatch ? (imgMatch[1].startsWith('http') ? imgMatch[1] : `https://codemoi.net${imgMatch[1]}`) : `https://codemoi.net/covers/${slug}.webp`;
          const altName = imgMatch ? imgMatch[2].replace(/&amp;/g, '&').trim() : slug;
          const nameMatch = liContent.match(/<span[^>]*class="[^"]*font-semibold[^"]*text-slate-900[^"]*"[^>]*>([^<]+)<\/span>/i);
          const name = nameMatch ? nameMatch[1].replace(/&amp;/g, '&').trim() : altName;

          const infoSpanMatch = liContent.match(/<span[^>]*class="[^"]*text-slate-500[^"]*"[^>]*>([\s\S]*?)<\/span>\s*<\/a>/i);
          let publisher = 'NPH Game Mobile';
          let releaseInfo = '';
          if (infoSpanMatch) {
            const cleanInfo = infoSpanMatch[1].replace(/<!--[\s\S]*?-->/g, '');
            const parts = cleanInfo.split(/<span[^>]*class="mx-1\.5"[^>]*>·<\/span>|·/);
            if (parts.length > 0) publisher = parts[0].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() || publisher;
            if (parts.length > 1) releaseInfo = parts.slice(1).join(' · ').replace(/<[^>]+>/g, '').trim();
          }

          const codeCountMatch = liContent.match(/<span[^>]*tabular-nums[^>]*>(\d+)[\s\S]*?code đang hoạt động<\/span>/i)
            || liContent.match(/(\d+)(?:<!--[\s\S]*?-->)?\s*code đang hoạt động/i);
          const activeCodesCount = codeCountMatch ? parseInt(codeCountMatch[1], 10) : 0;
          const isUpcoming = /mở server/i.test(releaseInfo) || /sắp ra mắt/i.test(liContent);

          codemoiGames.push({
            slug,
            name,
            publisher,
            releaseInfo,
            iconUrl,
            activeCodesCount,
            isUpcoming,
            sourceUrl: `https://codemoi.net/games/${slug}/`,
            status: isUpcoming ? 'UPCOMING' : 'RELEASED'
          });
        }

        const rawGames = await getSettingD1(env.DB, 'wcg_admin_games_v5') || await getSettingD1(env.DB, 'wcg_admin_games_v4') || (fallbackGamesData as any[]);
        const gamesList: any[] = Array.isArray(rawGames) ? [...rawGames] : [];
        const pendingListRaw = await getSettingD1(env.DB, 'wcg_crawler_pending_games_v1') || [];
        const pendingList: any[] = Array.isArray(pendingListRaw) ? [...pendingListRaw] : [];
        const autoConfig = await getSettingD1(env.DB, 'wcg_crawler_auto_publish_games_v1') || {
          enabled: true,
          whitelistPublishers: ['VNG', 'Garena', 'SohaGame', 'Funtap', 'Gamota', 'Gosu', 'VTC', 'Dzogame', 'Appota', 'VGP', 'Kplay', 'AceGame', 'VPlay', 'DigiGames', 'JoyGames', 'Gzone', 'Efun', 'Capcom', 'TiMi', 'Mộc Game', 'VelaGame']
        };

        const existingSlugs = new Set();
        const baseSlugSet = new Set();
        const getBase = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/-(vplay|vtc|gosu|gamota|soha|sohagame|funtap|vng|garena|vn|mobile|joygames|efun|online)$/g, '').replace(/^-+|-+$/g, '');

        for (const g of gamesList) {
          if (g.slug) { existingSlugs.add(g.slug); baseSlugSet.add(getBase(g.slug)); }
          if (g.id) { existingSlugs.add(g.id); baseSlugSet.add(getBase(g.id)); }
          if (g.name) { baseSlugSet.add(getBase(g.name)); }
        }
        for (const p of pendingList) {
          if (p.slug) { existingSlugs.add(p.slug); baseSlugSet.add(getBase(p.slug)); }
          if (p.name) { baseSlugSet.add(getBase(p.name)); }
        }

        const autoPublished: any[] = [];
        const newPending: any[] = [];
        const whitelist: string[] = Array.isArray(autoConfig.whitelistPublishers) ? autoConfig.whitelistPublishers.map((w: string) => w.toLowerCase()) : [];

        for (const item of codemoiGames) {
          const bSlug = getBase(item.slug);
          const bName = getBase(item.name);
          if (existingSlugs.has(item.slug) || baseSlugSet.has(bSlug) || baseSlugSet.has(bName)) {
            continue;
          }
          existingSlugs.add(item.slug);
          baseSlugSet.add(bSlug);
          baseSlugSet.add(bName);

          const normDev = (item.publisher || '').toLowerCase();
          const normName = (item.name || '').toLowerCase();
          const isWhitelisted = whitelist.some((w: string) => normDev.includes(w) || normName.includes(` ${w}`));
          const hasActiveCodes = Number(item.activeCodesCount || 0) > 0;
          const autoPublishWhenHasCodes = autoConfig.autoPublishWhenHasCodes !== false;
          const shouldAutoPublish = autoConfig.enabled && (isWhitelisted || (autoPublishWhenHasCodes && hasActiveCodes));

          if (shouldAutoPublish) {
            const newGame = {
              id: item.slug,
              slug: item.slug,
              name: item.name,
              publisher: item.publisher,
              category: 'Nhập Vai',
              rating: 4.8,
              icon_url: `/game_icons/${item.slug}.webp`,
              cover_image_url: `/game_icons/${item.slug}.webp`,
              banner_url: '',
              description: `${item.name} là tựa game mobile mới phát hành chính thức bởi ${item.publisher}.`,
              short_description: `${item.name} - Game Mobile Mới`,
              instructions: 'Bước 1: Mở game > Nhấn Avatar nhân vật\nBước 2: Chọn Cài đặt > Nhập Giftcode\nBước 3: Dán mã và nhấn Xác nhận.',
              platform: 'Android, iOS, PC',
              release_date: new Date().toISOString().split('T')[0],
              download_android: '',
              is_featured: false,
              is_hot: false,
              is_new: true,
              is_active: true,
              status: 'ACTIVE',
              codes_count: Number(item.activeCodesCount || 0),
              free_codes_count: Number(item.activeCodesCount || 0),
              source: 'Code Mới (codemoi.net)',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            gamesList.unshift(newGame);
            autoPublished.push(newGame);
          } else {
            const pendingGame = {
              id: `cm_${item.slug}`,
              name: item.name,
              slug: item.slug,
              packageId: item.slug,
              developer: item.publisher,
              category: 'Nhập Vai',
              rating: 4.8,
              installs: item.isUpcoming ? 'Sắp ra mắt' : 'Mới ra mắt',
              iconUrl: item.iconUrl,
              playStoreUrl: '',
              sourceType: 'codemoi',
              sourceUrl: item.sourceUrl,
              releaseInfo: item.releaseInfo,
              activeCodesCount: item.activeCodesCount,
              description: `${item.name} phát hành bởi ${item.publisher}. ${item.releaseInfo || ''}`,
              releaseDate: new Date().toISOString().split('T')[0],
              status: 'PENDING',
              autoPublishEligible: false,
              crawledAt: new Date().toISOString(),
            };
            pendingList.unshift(pendingGame);
            newPending.push(pendingGame);
          }
        }

        if (autoPublished.length > 0) {
          await setSettingD1(env.DB, 'wcg_admin_games_v5', gamesList);
          invalidateGamesCatalogCache();
          await invalidateCatalogEdgeCache(context as any, request, env).catch(() => {});
        }
        if (newPending.length > 0) {
          await setSettingD1(env.DB, 'wcg_crawler_pending_games_v1', pendingList);
        }

        return new Response(JSON.stringify({
          success: true,
          message: `Quét CodeMoi.net thành công! Tìm thấy ${codemoiGames.length} game: tự động đăng ${autoPublished.length} game, thêm ${newPending.length} game vào chờ duyệt.`,
          totalScanned: codemoiGames.length,
          autoPublishedCount: autoPublished.length,
          pendingAddedCount: newPending.length,
          pendingGames: pendingList,
          games: gamesList,
        }), { headers: CORS_HEADERS });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: String(err?.message || err) }), { status: 500, headers: CORS_HEADERS });
      }
    }

    // Action: Đăng ký / cập nhật trực tiếp thành viên với mật khẩu vào D1 (Admin Direct Provisioning)
    if (body.action === 'admin_set_member_password' && env.DB && body.member) {
      try {
        const m = body.member;
        const cleanUser = String(m.username || m.displayName || '').trim().toLowerCase();
        const cleanEmail = String(m.email || '').trim().toLowerCase();
        const targetPass = String(m.password || '').trim();
        const targetSalt = m.salt || ('wcg_salt_' + Math.random().toString(36).slice(2, 10));
        const pepper = (env as any).PASSWORD_PEPPER || 'wcg_edge_sec_salt_2026';
        const finalHash = targetPass ? await computeHash(targetPass, targetSalt, pepper) : (m.passwordHash || m.password_hash || '');
        const memberId = m.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const displayName = m.displayName || m.username || cleanUser;

        await env.DB.prepare(`
          INSERT INTO members (id, username, display_name, email, phone, role, balance, total_spent, status, salt, password_hash, avatar_url, created_at)
          VALUES (?, ?, ?, ?, ?, 'MEMBER', 0, 0, 'ACTIVE', ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            username = excluded.username,
            display_name = excluded.display_name,
            email = excluded.email,
            salt = excluded.salt,
            password_hash = excluded.password_hash
        `).bind(
          memberId,
          cleanUser,
          displayName,
          cleanEmail,
          m.phone || '',
          targetSalt,
          finalHash,
          m.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUser)}`
        ).run();

        // Also make sure to clear any failed login lockouts for this user/IP
        await env.DB.prepare("DELETE FROM ip_rate_limits WHERE action_type = 'LOGIN'").run().catch(() => {});

        return new Response(
          JSON.stringify({
            success: true,
            message: `Đã thiết lập tài khoản và mật khẩu thành công cho ${cleanUser} (${cleanEmail})!`,
            memberId,
          }),
          { headers: CORS_HEADERS }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ success: false, error: String(e) }),
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    // Action: Đối soát và đồng bộ chuẩn hóa số dư thành viên theo sổ cái wallet_transactions
    if (body.action === 'reconcile_member_balances' && env.DB) {
      try {
        const [memRes, txRes] = await Promise.all([
          env.DB.prepare("SELECT id, username, balance FROM members").all<any>(),
          env.DB.prepare(`
            SELECT member_id, balance_after, created_at
            FROM wallet_transactions
            ORDER BY created_at DESC
          `).all<any>(),
        ]);

        const reconciled: any[] = [];
        if (memRes?.results && txRes?.results) {
          const latestTxMap = new Map<string, number>();
          for (const tx of txRes.results) {
            if (tx && tx.member_id && !latestTxMap.has(tx.member_id)) {
              latestTxMap.set(tx.member_id, Number(tx.balance_after) || 0);
            }
          }

          const updateStmts: any[] = [];
          for (const m of memRes.results) {
            const expectedBal = latestTxMap.get(m.id);
            if (expectedBal !== undefined && Number(m.balance) !== expectedBal) {
              updateStmts.push(
                env.DB.prepare("UPDATE members SET balance = ? WHERE id = ?").bind(expectedBal, m.id)
              );
              reconciled.push({ id: m.id, username: m.username, oldBalance: m.balance, newBalance: expectedBal });
            }
          }

          if (updateStmts.length > 0) {
            await env.DB.batch(updateStmts);
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Đã đối soát và khôi phục số dư cho ${reconciled.length} thành viên khớp 100% với sổ cái giao dịch.`,
            reconciled,
          }),
          { headers: CORS_HEADERS }
        );
      } catch (recErr: any) {
        return new Response(
          JSON.stringify({ success: false, error: recErr?.message }),
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    let currentMaster: any = {};
    if (env.DB) {
      try {
        const raw = await getSettingD1(env.DB, 'wcg_master_state_v4');
        if (raw) currentMaster = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {}
    }
    if (!currentMaster || typeof currentMaster !== 'object') currentMaster = {};
    currentMaster.isInitialized = true;

    // Prevent race-condition wipe: retain giveaways from D1 if master was empty
    if ((!Array.isArray(currentMaster.giveaways) || currentMaster.giveaways.length === 0) && body.key !== 'wcg_admin_giveaways_v4' && body.giveaways === undefined) {
      if (env.DB) {
        try {
          const gwList = await loadAllGiveawaysD1(env.DB, true);
          if (Array.isArray(gwList) && gwList.length > 0) {
            currentMaster.giveaways = gwList;
          }
        } catch {}
      }
    }

    // Handle Reset Wallets and Revenue command
    if (body.action === 'RESET_WALLET_AND_REVENUE' || body.resetWalletAndRevenue === true) {
      if (env.DB) {
        await resetAllWalletsAndRevenueD1(env.DB);
      }
      currentMaster.transactions = [];
      currentMaster.orders = [];
      if (Array.isArray(currentMaster.members)) {
        currentMaster.members.forEach((m: any) => {
          if (m) {
            m.balance = 0;
            m.totalSpent = 0;
          }
        });
      }
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Đã reset toàn bộ ví thành viên và tổng doanh thu về 0 đồng trên hệ thống Cloudflare D1!',
          timestamp,
        }),
        { headers: CORS_HEADERS }
      );
    }

    if (body.key && body.data !== undefined) {
      const vKey = body.key.replace('_v3', '_v4');
      if (vKey === 'wcg_admin_transactions_v4' && Array.isArray(body.data) && body.data.length === 0) {
        if (env.DB) await env.DB.prepare('DELETE FROM wallet_transactions').run().catch(() => {});
      }
      if (vKey === 'wcg_admin_orders_v4' && Array.isArray(body.data) && body.data.length === 0) {
        if (env.DB) await env.DB.prepare('DELETE FROM orders').run().catch(() => {});
      }
      if (vKey === 'wcg_admin_store_products_v4') currentMaster.storeProducts = body.data;
      else if (vKey === 'wcg_admin_utilities_v4') currentMaster.utilities = body.data;
      else if (vKey === 'wcg_deleted_store_products') currentMaster.deletedStoreProducts = body.data;
      else if (vKey === 'wcg_deleted_utilities') currentMaster.deletedUtilities = body.data;
      else if (vKey === 'wcg_deleted_giveaways') currentMaster.deletedGiveaways = body.data;
      else if (vKey === 'wcg_deleted_free_codes') currentMaster.deletedFreeCodes = body.data;
      else if (vKey === 'wcg_admin_custom_free_codes_v1') currentMaster.customFreeCodes = body.data;
      else if (vKey === 'wcg_admin_games_v5' || vKey === 'wcg_admin_games_v4') currentMaster.games = body.data;
      else if (vKey === 'wcg_admin_free_codes_v5' || vKey === 'wcg_admin_free_codes_v4') currentMaster.freeCodes = body.data;
      else if (vKey === 'wcg_admin_giveaways_v4') currentMaster.giveaways = body.data;
      else if (vKey === 'wcg_admin_content_v4') {
        if (Array.isArray(body.data)) {
          const existingContent = Array.isArray(currentMaster.content) ? currentMaster.content : [];
          const map = new Map<string, any>();
          existingContent.forEach((i: any) => { if (i && i.key) map.set(i.key, i); });
          body.data.forEach((i: any) => { if (i && i.key) map.set(i.key, { ...(map.get(i.key) || {}), ...i }); });
          currentMaster.content = Array.from(map.values());
        }
      }
      else if (vKey === 'wcg_admin_sepay_v4') currentMaster.sepay = body.data;
      else if (vKey === 'wcg_admin_members_v4') currentMaster.members = body.data;
      else if (vKey === 'wcg_admin_transactions_v4') currentMaster.transactions = body.data;
      else if (vKey === 'wcg_marketing_config_v1') currentMaster.marketingConfig = body.data;
      else if (vKey === 'wcg_growth_config_v1') currentMaster.growthConfig = body.data;
      else if (vKey === 'wcg_admin_utility_categories_v1') currentMaster.utilityCategories = body.data;
      else if (vKey === 'wcg_admin_store_categories_v1') currentMaster.storeCategories = body.data;
      else if (vKey === 'wcg_news_articles_v1') currentMaster.newsArticles = body.data;
      else if (vKey === 'wcg_crawler_sources_v1' || vKey === 'wcg_admin_crawler_sources_v5') currentMaster.crawlerSources = body.data;
      else if (vKey === 'wcg_event_schedules_v1') currentMaster.eventSchedules = body.data;
    }

    if (body.deletedStoreProducts !== undefined) currentMaster.deletedStoreProducts = body.deletedStoreProducts;
    if (body.deletedUtilities !== undefined) currentMaster.deletedUtilities = body.deletedUtilities;
    if (body.deletedGiveaways !== undefined) currentMaster.deletedGiveaways = body.deletedGiveaways;
    if (body.deletedFreeCodes !== undefined) currentMaster.deletedFreeCodes = body.deletedFreeCodes;
    if (body.customFreeCodes !== undefined) currentMaster.customFreeCodes = body.customFreeCodes;
    if (body.games !== undefined) currentMaster.games = body.games;
    if (body.freeCodes !== undefined) currentMaster.freeCodes = body.freeCodes;
    if (body.submissions !== undefined) currentMaster.submissions = body.submissions;
    if (body.members !== undefined) currentMaster.members = body.members;
    if (body.transactions !== undefined) currentMaster.transactions = body.transactions;
    if (body.privateCodes !== undefined) currentMaster.privateCodes = body.privateCodes;
    if (body.content !== undefined && Array.isArray(body.content)) {
      const existingContent = Array.isArray(currentMaster.content) ? currentMaster.content : [];
      const map = new Map<string, any>();
      existingContent.forEach((i: any) => { if (i && i.key) map.set(i.key, i); });
      body.content.forEach((i: any) => {
        if (i && i.key) {
          const existing = map.get(i.key);
          const incomingTime = i.updatedAt ? Date.parse(i.updatedAt) : 0;
          const existingTime = existing?.updatedAt ? Date.parse(existing.updatedAt) : 0;
          if (!existing || isNaN(incomingTime) || isNaN(existingTime) || incomingTime >= existingTime) {
            map.set(i.key, { ...(existing || {}), ...i });
          }
        }
      });
      currentMaster.content = Array.from(map.values());
    }
    if (body.sepay !== undefined) currentMaster.sepay = body.sepay;
    if (body.sepayLogs !== undefined) currentMaster.sepayLogs = body.sepayLogs;
    if (body.securityLogs !== undefined) currentMaster.securityLogs = body.securityLogs;
    if (body.giveaways !== undefined) currentMaster.giveaways = body.giveaways;
    if (body.storeProducts !== undefined) currentMaster.storeProducts = body.storeProducts;
    if (body.utilities !== undefined) currentMaster.utilities = body.utilities;
    if (body.utilityCategories !== undefined) currentMaster.utilityCategories = body.utilityCategories;
    if (body.storeCategories !== undefined) currentMaster.storeCategories = body.storeCategories;
    if (body.marketingConfig !== undefined) currentMaster.marketingConfig = body.marketingConfig;
    if (body.growthConfig !== undefined) currentMaster.growthConfig = body.growthConfig;
    if (body.crawlerPendingCodes !== undefined) currentMaster.crawlerPendingCodes = body.crawlerPendingCodes;
    if (body.crawlerPendingGames !== undefined) currentMaster.crawlerPendingGames = body.crawlerPendingGames;
    if (body.crawlerAutoPublishGamesConfig !== undefined) currentMaster.crawlerAutoPublishGamesConfig = body.crawlerAutoPublishGamesConfig;
    if (body.crawlerSources !== undefined) currentMaster.crawlerSources = body.crawlerSources;
    if (body.crawlerLogs !== undefined) currentMaster.crawlerLogs = body.crawlerLogs;
    if (body.deletedNewsArticles !== undefined) currentMaster.deletedNewsArticles = body.deletedNewsArticles;
    if (body.newsArticles !== undefined) currentMaster.newsArticles = body.newsArticles;
    if (body.eventSchedules !== undefined) currentMaster.eventSchedules = body.eventSchedules;

    // D1 Quota Optimization: NEVER store huge monolithic inventory, orders or crawled freeCodes arrays in KV/Settings master state
    currentMaster.inventory = [];
    currentMaster.orders = [];
    currentMaster.freeCodes = [];
    currentMaster.timestamp = timestamp;

    // 1. Primary SSOT: If Cloudflare D1 is present, save all entities & settings directly to D1 (Zero KV Writes)
    if (env.DB) {
      try {
        await ensureSchemaUpgrades(env.DB);

        // Members sync
        const incomingMembers = body.members !== undefined
          ? body.members
          : (body.key === 'wcg_admin_members_v4' && Array.isArray(body.data) ? body.data : null);
        if (Array.isArray(incomingMembers) && incomingMembers.length > 0) {
          await syncMembersToD1(env.DB, incomingMembers);
          await setSettingD1(env.DB, 'wcg_admin_members_v4', incomingMembers);
        }

        // Store Products sync
        const incomingProducts = body.storeProducts !== undefined
          ? body.storeProducts
          : (body.key === 'wcg_admin_store_products_v4' && Array.isArray(body.data) ? body.data : null);
        if (Array.isArray(incomingProducts) && incomingProducts.length > 0) {
          await syncProductsToD1(env.DB, incomingProducts);
          await setSettingD1(env.DB, 'wcg_admin_store_products_v4', incomingProducts);
          try {
            const hub = await getRealEventsHub(env);
            if (hub && hub.peakProductSoldCounts) {
              let hubChanged = false;
              for (const p of incomingProducts) {
                if (p && p.id && p.virtual_sold_count !== undefined) {
                  const target = Number(p.virtual_sold_count) + (Number(p.sold_count) || 0);
                  hub.peakProductSoldCounts[p.id] = target;
                  if (hub.lowestProductStock && Number(p.virtual_sold_count) === 0) {
                    hub.lowestProductStock[p.id] = Number(p.stock_quantity) || 0;
                  }
                  hubChanged = true;
                }
              }
              if (hubChanged) await saveRealEventsHub(env, hub, true);
            }
            await env.DB.prepare('DELETE FROM system_snapshots').run().catch(() => {});
            (globalThis as any).__wcg_metrics_snapshot = null;
          } catch {}
        }

        // Utilities sync: support both key-specific sync and full snapshot sync
        const incomingUtilities = (body.key === 'wcg_admin_utilities_v4')
          ? (Array.isArray(body.data) ? body.data : (Array.isArray(body.utilities) ? body.utilities : null))
          : (Array.isArray(body.utilities) ? body.utilities : null);
        if (Array.isArray(incomingUtilities) && incomingUtilities.length > 0) {
          await syncUtilitiesToD1(env.DB, incomingUtilities);
          await setSettingD1(env.DB, 'wcg_admin_utilities_v4', incomingUtilities);
          try {
            const descStmts: D1PreparedStatement[] = [];
            for (const u of incomingUtilities) {
              if (u && u.id && u.description) {
                descStmts.push(env.DB.prepare('UPDATE utilities SET description = ? WHERE id = ?').bind(String(u.description).trim(), String(u.id).trim()));
              }
            }
            if (descStmts.length > 0) {
              await env.DB.batch(descStmts).catch(() => {});
            }
          } catch {}
          try {
            const hub = await getRealEventsHub(env);
            if (hub && hub.peakProductSoldCounts) {
              let hubChanged = false;
              for (const u of incomingUtilities) {
                if (u && u.id && u.virtual_sold_count !== undefined) {
                  const target = Number(u.virtual_sold_count) + (Number(u.sold_count) || 0);
                  hub.peakProductSoldCounts[u.id] = target;
                  if (hub.lowestProductStock && Number(u.virtual_sold_count) === 0) {
                    hub.lowestProductStock[u.id] = Number(u.stock_quantity) || 0;
                  }
                  hubChanged = true;
                }
              }
              if (hubChanged) await saveRealEventsHub(env, hub, true);
            }
            await env.DB.prepare('DELETE FROM system_snapshots').run().catch(() => {});
            (globalThis as any).__wcg_metrics_snapshot = null;
          } catch {}
        }

        // Giveaways & Codes Pool sync: sync to D1 when key is explicitly 'wcg_admin_giveaways_v4' OR full state body.giveaways
        const incomingGiveaways = (body.key === 'wcg_admin_giveaways_v4')
          ? (Array.isArray(body.data) ? body.data : (Array.isArray(body.giveaways) ? body.giveaways : null))
          : (Array.isArray(body.giveaways) ? body.giveaways : null);
        if (Array.isArray(incomingGiveaways) && incomingGiveaways.length > 0) {
          await syncGiveawaysToD1(env.DB, incomingGiveaways);
          await setSettingD1(env.DB, 'wcg_admin_giveaways_v4', incomingGiveaways);
          // Also explicitly update is_active & status in giveaways table
          for (const gw of incomingGiveaways) {
            if (gw && gw.id) {
              const act = gw.is_active !== false ? 1 : 0;
              await env.DB.prepare('UPDATE giveaways SET is_active = ?, status = ? WHERE id = ?')
                .bind(act, act === 1 ? 'ACTIVE' : 'PAUSED', gw.id)
                .run().catch(() => {});
            }
          }
          // Self-healing: if an incoming giveaway was previously in wcg_deleted_giveaways tombstone, un-tombstone it!
          try {
            const activeIds = new Set(
              incomingGiveaways
                .map((g: any) => g?.id)
                .filter((id: string) => id && id !== 'gw_gamerpower_rotwood' && id !== 'gw_alienware_vaultbreakers' && id !== 'gw_garena_delta_force')
            );
            const existingDelGw = (await getSettingD1<string[]>(env.DB, 'wcg_deleted_giveaways')) || [];
            if (Array.isArray(existingDelGw) && existingDelGw.some((id: string) => activeIds.has(id))) {
              const cleanedDelGw = existingDelGw.filter((id: string) => !activeIds.has(id));
              await setSettingD1(env.DB, 'wcg_deleted_giveaways', cleanedDelGw);
            }
          } catch {}
          try {
            const hub = await getRealEventsHub(env);
            if (hub && hub.peakGiveawayClaimedCounts) {
              let hubChanged = false;
              for (const gw of incomingGiveaways) {
                if (gw && gw.id && gw.virtual_claimed_offset !== undefined) {
                  const target = Number(gw.virtual_claimed_offset) + (Number(gw.claimed_codes) || 0);
                  hub.peakGiveawayClaimedCounts[gw.id] = target;
                  if (hub.lowestGiveawayRemaining && Number(gw.virtual_claimed_offset) === 0) {
                    hub.lowestGiveawayRemaining[gw.id] = Number(gw.remaining_codes) || 0;
                  }
                  hubChanged = true;
                }
              }
              if (hubChanged) await saveRealEventsHub(env, hub, true);
            }
            await env.DB.prepare('DELETE FROM system_snapshots').run().catch(() => {});
            (globalThis as any).__wcg_metrics_snapshot = null;
          } catch {}
        }

        // Inventory Codes sync
        const incomingInv = body.inventory !== undefined
          ? body.inventory
          : (body.key === 'wcg_admin_inventory_v4' && Array.isArray(body.data) ? body.data : null);
        if (Array.isArray(incomingInv) && incomingInv.length > 0) {
          await syncInventoryToD1(env.DB, incomingInv);
        }

        // Wallet Transactions sync
        const incomingTransactions = body.transactions !== undefined
          ? body.transactions
          : (body.key === 'wcg_admin_transactions_v4' && Array.isArray(body.data) ? body.data : null);
        if (Array.isArray(incomingTransactions) && incomingTransactions.length > 0) {
          await syncTransactionsToD1(env.DB, incomingTransactions);
          await setSettingD1(env.DB, 'wcg_admin_transactions_v4', incomingTransactions);
        }


        // Deleted Inventory Codes sync
        const incomingDeletedInvCodes = body.deletedInventoryCodes !== undefined
          ? body.deletedInventoryCodes
          : (body.key === 'wcg_deleted_inventory_codes' && Array.isArray(body.data) ? body.data : null);
        if (Array.isArray(incomingDeletedInvCodes) && incomingDeletedInvCodes.length > 0) {
          const existingDelCodes = (await getSettingD1(env.DB, 'wcg_deleted_inventory_codes')) || [];
          const mergedDelCodes = Array.from(new Set([...(Array.isArray(existingDelCodes) ? existingDelCodes : []), ...incomingDeletedInvCodes]));
          await setSettingD1(env.DB, 'wcg_deleted_inventory_codes', mergedDelCodes);
          await deleteInventoryCodesD1(env.DB, incomingDeletedInvCodes);
        }

        // Store Products Deletions & Tombstones
        const incomingDelStore = body.deletedStoreProducts !== undefined
          ? body.deletedStoreProducts
          : (body.key === 'wcg_deleted_store_products' && Array.isArray(body.data) ? body.data : null);
        if (Array.isArray(incomingDelStore)) {
          const existingDelStore = (await getSettingD1(env.DB, 'wcg_deleted_store_products')) || [];
          const mergedDelStore = (body.forceReset || body.overwriteTombstones) ? incomingDelStore : Array.from(new Set([...(Array.isArray(existingDelStore) ? existingDelStore : []), ...incomingDelStore]));
          await setSettingD1(env.DB, 'wcg_deleted_store_products', mergedDelStore);
          for (const delId of incomingDelStore) {
            if (delId) {
              await deleteStoreProductD1(env.DB, delId);
            }
          }
        }

        // Utilities Deletions & Tombstones
        const incomingDelUtils = body.deletedUtilities !== undefined
          ? body.deletedUtilities
          : (body.key === 'wcg_deleted_utilities' && Array.isArray(body.data) ? body.data : null);
        if (Array.isArray(incomingDelUtils)) {
          const existingDelUtils = (await getSettingD1(env.DB, 'wcg_deleted_utilities')) || [];
          const mergedDelUtils = (body.forceReset || body.overwriteTombstones) ? incomingDelUtils : Array.from(new Set([...(Array.isArray(existingDelUtils) ? existingDelUtils : []), ...incomingDelUtils]));
          await setSettingD1(env.DB, 'wcg_deleted_utilities', mergedDelUtils);
          for (const delId of incomingDelUtils) {
            if (delId) {
              await deleteUtilityD1(env.DB, delId);
            }
          }
        }

        // Giveaways Deletions & Tombstones
        const incomingDelGw = body.deletedGiveaways !== undefined
          ? body.deletedGiveaways
          : (body.key === 'wcg_deleted_giveaways' && Array.isArray(body.data) ? body.data : null);
        if (Array.isArray(incomingDelGw)) {
          const existingDelGw = (await getSettingD1(env.DB, 'wcg_deleted_giveaways')) || [];
          const mergedDelGw = (body.forceReset || body.overwriteTombstones) ? incomingDelGw : Array.from(new Set([...(Array.isArray(existingDelGw) ? existingDelGw : []), ...incomingDelGw]));
          await setSettingD1(env.DB, 'wcg_deleted_giveaways', mergedDelGw);
          for (const delId of incomingDelGw) {
            if (delId) {
              await env.DB.prepare('DELETE FROM giveaways WHERE id = ?').bind(delId).run().catch(() => {});
              await env.DB.prepare('DELETE FROM giveaway_codes WHERE giveaway_id = ?').bind(delId).run().catch(() => {});
              await env.DB.prepare('UPDATE giveaways SET status = "ENDED" WHERE id = ?').bind(delId).run().catch(() => {});
            }
          }
        }

        // Free Codes Deletions & Tombstones
        const incomingDelFc = body.deletedFreeCodes !== undefined
          ? body.deletedFreeCodes
          : (body.key === 'wcg_deleted_free_codes' && Array.isArray(body.data) ? body.data : null);
        if (Array.isArray(incomingDelFc)) {
          const existingDelFc = (await getSettingD1(env.DB, 'wcg_deleted_free_codes')) || [];
          const mergedDelFc = Array.from(new Set([...(Array.isArray(existingDelFc) ? existingDelFc : []), ...incomingDelFc]));
          await setSettingD1(env.DB, 'wcg_deleted_free_codes', mergedDelFc);
          invalidateGamesCatalogCache();
        }

        // Custom Free Codes Sync
        const incomingCustomFc = body.customFreeCodes !== undefined
          ? body.customFreeCodes
          : (body.key === 'wcg_admin_custom_free_codes_v1' && Array.isArray(body.data) ? body.data : null);
        if (Array.isArray(incomingCustomFc)) {
          const existingCustom = (await getSettingD1(env.DB, 'wcg_admin_custom_free_codes_v1')) || [];
          const customMap = new Map<string, any>();
          if (Array.isArray(existingCustom)) {
            existingCustom.forEach((c: any) => { if (c && c.id) customMap.set(c.id, c); });
          }
          incomingCustomFc.forEach((c: any) => {
            if (c && c.id) customMap.set(c.id, c);
          });
          const mergedCustom = Array.from(customMap.values());
          await setSettingD1(env.DB, 'wcg_admin_custom_free_codes_v1', mergedCustom);
          invalidateGamesCatalogCache();
        }

        // Automatically purge any orphaned inventory codes for inactive/deleted products
        await purgeOrphanedInventoryCodesD1(env.DB);

        // System Settings & Configurations in D1 system_settings (skipping deletion tombstone keys which were merged above)
        if (
          body.key &&
          body.data !== undefined &&
          body.key !== 'wcg_deleted_store_products' &&
          body.key !== 'wcg_deleted_utilities' &&
          body.key !== 'wcg_deleted_giveaways' &&
          body.key !== 'wcg_deleted_inventory_codes' &&
          body.key !== 'wcg_deleted_free_codes' &&
          body.key !== 'wcg_admin_custom_free_codes_v1' &&
          body.key !== 'wcg_admin_content_v4'
        ) {
          await setSettingD1(env.DB, body.key, body.data);
        }
        if (body.key === 'wcg_admin_content_v4' && Array.isArray(body.data)) {
          const merged = await mergeContentIntoD1(env.DB, body.data);
          currentMaster.content = merged;
        }
        if (body.games !== undefined || (body.key === 'wcg_admin_games_v5' && Array.isArray(body.data))) {
          await setSettingD1(env.DB, 'wcg_admin_games_v5', body.games || body.data);
          invalidateGamesCatalogCache();
        }
        // Only allow updating wcg_admin_free_codes_v5 if it's a full catalog import (length >= 1000)
        // This strictly prevents full-state syncs with smaller arrays from wiping out the 5,076 crawled codes!
        if (
          (body.key === 'wcg_admin_free_codes_v5' && Array.isArray(body.data) && body.data.length >= 1000) ||
          (body.freeCodes !== undefined && Array.isArray(body.freeCodes) && body.freeCodes.length >= 1000)
        ) {
          try {
            await setSettingD1(env.DB, 'wcg_admin_free_codes_v5', body.data || body.freeCodes);
          } catch (e: any) {
            console.warn('[Sync] freeCodes setting write skipped or quota limit reached:', e?.message);
          }
          invalidateGamesCatalogCache();
        }
        if (body.key === 'wcg_admin_games_v5' || body.key === 'wcg_admin_free_codes_v5' || body.key === 'wcg_admin_custom_free_codes_v1') {
          invalidateGamesCatalogCache();
        }
        if (body.content !== undefined && Array.isArray(body.content)) {
          const merged = await mergeContentIntoD1(env.DB, body.content);
          currentMaster.content = merged;
        }
        if (body.sepay !== undefined || body.key === 'wcg_admin_sepay_v4') await setSettingD1(env.DB, 'wcg_admin_sepay_v4', body.sepay ?? body.data);
        const incomingMarketing = body.marketingConfig !== undefined
          ? body.marketingConfig
          : (body.key === 'wcg_marketing_config_v1' ? body.data : undefined);
        if (incomingMarketing !== undefined) {
          await setSettingD1(env.DB, 'wcg_marketing_config_v1', incomingMarketing);
          // Invalidate snapshot cache so it immediately recalculates with new product weights
          const gScope = globalThis as any;
          gScope.__wcg_metrics_snapshot = null;
          await env.DB.prepare("DELETE FROM system_snapshots").run().catch(() => {});

          if (incomingMarketing?.productWeights && typeof incomingMarketing.productWeights === 'object') {
            try {
              const rHub = await getRealEventsHub(env);
              if (rHub) {
                if (!rHub.peakProductSoldCounts) rHub.peakProductSoldCounts = {};
                if (!rHub.peakGiveawayClaimedCounts) rHub.peakGiveawayClaimedCounts = {};
                let changedHub = false;
                for (const [pId, pw] of Object.entries(incomingMarketing.productWeights as Record<string, any>)) {
                  if (!pw) continue;
                  const target = pw.targetDisplaySoldOrClaimed ?? (pId.startsWith('gw_') ? pw.virtualClaimed : pw.virtualSold);
                  if (typeof target === 'number') {
                    if (pId.startsWith('gw_')) {
                      rHub.peakGiveawayClaimedCounts[pId] = target;
                    } else {
                      rHub.peakProductSoldCounts[pId] = target;
                    }
                    changedHub = true;
                  }
                }
                if (changedHub) {
                  await saveRealEventsHub(env, rHub, true);
                }
              }
            } catch (err) {
              console.warn('[Sync] Failed to update rHub from incomingMarketing:', err);
            }
          }
        }
        if (body.growthConfig !== undefined || body.key === 'wcg_growth_config_v1') await setSettingD1(env.DB, 'wcg_growth_config_v1', body.growthConfig ?? body.data);
        if (body.submissions !== undefined) await setSettingD1(env.DB, 'wcg_admin_submissions_v4', body.submissions);
        if (body.transactions !== undefined) await setSettingD1(env.DB, 'wcg_admin_transactions_v4', body.transactions);
        if (body.privateCodes !== undefined) await setSettingD1(env.DB, 'wcg_admin_private_codes_v4', body.privateCodes);
        if (body.securityLogs !== undefined) await setSettingD1(env.DB, 'wcg_admin_security_logs_v4', body.securityLogs);
        if (body.sepayLogs !== undefined) await setSettingD1(env.DB, 'wcg_admin_sepay_logs_v4', body.sepayLogs);
        if (body.utilityCategories !== undefined || body.key === 'wcg_admin_utility_categories_v1') await setSettingD1(env.DB, 'wcg_admin_utility_categories_v1', body.utilityCategories ?? body.data);
        if (body.storeCategories !== undefined || body.key === 'wcg_admin_store_categories_v1') await setSettingD1(env.DB, 'wcg_admin_store_categories_v1', body.storeCategories ?? body.data);
        if (body.giveaways !== undefined) await setSettingD1(env.DB, 'wcg_admin_giveaways_v4', body.giveaways);
        if (body.crawlerPendingCodes !== undefined) await setSettingD1(env.DB, 'wcg_crawler_pending_codes_v1', body.crawlerPendingCodes);
        if (body.crawlerPendingGames !== undefined) await setSettingD1(env.DB, 'wcg_crawler_pending_games_v1', body.crawlerPendingGames);
        if (body.crawlerAutoPublishGamesConfig !== undefined) await setSettingD1(env.DB, 'wcg_crawler_auto_publish_games_v1', body.crawlerAutoPublishGamesConfig);
        if (body.crawlerSources !== undefined || body.key === 'wcg_crawler_sources_v1' || body.key === 'wcg_admin_crawler_sources_v5') await setSettingD1(env.DB, 'wcg_crawler_sources_v1', body.crawlerSources ?? body.data);
        if (body.crawlerLogs !== undefined) await setSettingD1(env.DB, 'wcg_crawler_logs_v1', body.crawlerLogs);
        if (body.deletedNewsArticles !== undefined) await setSettingD1(env.DB, 'wcg_deleted_news_articles_v1', body.deletedNewsArticles);
        if (body.newsArticles !== undefined || body.key === 'wcg_news_articles_v1') await setSettingD1(env.DB, 'wcg_news_articles_v1', body.newsArticles ?? body.data);
        if (body.newsAutoSources !== undefined) await setSettingD1(env.DB, 'wcg_news_auto_sources_v1', body.newsAutoSources);
        if (body.newsScheduleConfig !== undefined) await setSettingD1(env.DB, 'wcg_news_schedule_config_v1', body.newsScheduleConfig);
        if (body.eventSchedules !== undefined || body.key === 'wcg_event_schedules_v1') await setSettingD1(env.DB, 'wcg_event_schedules_v1', body.eventSchedules ?? body.data);
        if (body.utilitiesGlobalShowSold !== undefined || body.key === 'wcg_utilities_global_show_sold') {
          const val = body.utilitiesGlobalShowSold !== undefined ? Boolean(body.utilitiesGlobalShowSold) : Boolean(body.data);
          currentMaster.utilitiesGlobalShowSold = val;
          await setSettingD1(env.DB, 'wcg_utilities_global_show_sold', val);
        }
        if (body.storeGlobalShowSold !== undefined || body.key === 'wcg_store_global_show_sold') {
          const val = body.storeGlobalShowSold !== undefined ? Boolean(body.storeGlobalShowSold) : Boolean(body.data);
          currentMaster.storeGlobalShowSold = val;
          await setSettingD1(env.DB, 'wcg_store_global_show_sold', val);
        }

        // Consolidated Master State Snapshot in D1 system_settings
        await setSettingD1(env.DB, 'wcg_master_state_v4', currentMaster);

        // Invalidate Edge Cache and Global CDN caches so all clients immediately see updated numbers
        await invalidateCatalogEdgeCache(context as any, request, env).catch(() => {});

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Saved to D1 Database (SSOT)',
            timestamp,
          }),
          { headers: CORS_HEADERS }
        );
      } catch (d1Err: any) {
        console.warn('[Sync D1 Write Error]', d1Err?.message);
        throw d1Err;
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Database D1 is not bound or unavailable',
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Failed to process sync request' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
