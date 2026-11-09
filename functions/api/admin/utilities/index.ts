import { ensureSchemaUpgrades, ensureUtilitiesSchema, loadAllUtilitiesD1, getSettingD1, setSettingD1, logAdminAudit } from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/admin/utilities
 * Danh sách toàn bộ tiện ích game
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'STORE_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền STORE_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    await ensureUtilitiesSchema(env.DB);

    const utilities = await loadAllUtilitiesD1(env.DB);

    return new Response(
      JSON.stringify({
        success: true,
        count: utilities.length,
        utilities,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy danh sách tiện ích: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * POST /api/admin/utilities
 * Tạo gói tiện ích mới
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'STORE_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    await ensureUtilitiesSchema(env.DB);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON payload required' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const title = String(body.title || body.name || '').trim();
    if (!title) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tiêu đề tiện ích (title) là bắt buộc.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const id = String(body.id || `ut_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`).trim();
    const gameSlug = String(body.game_slug || body.gameSlug || '').trim();
    const gameName = String(body.game_name || body.gameName || '').trim();
    const originalPrice = Math.max(0, Number(body.original_price ?? body.originalPrice ?? 0));
    const discountPercent = Math.max(0, Math.min(100, Number(body.discount_percent ?? body.discountPercent ?? 0)));
    const currentPrice = Math.max(0, Number(body.current_price ?? body.currentPrice ?? originalPrice));
    const stockQuantity = Math.max(0, Number(body.stock_quantity ?? body.stockQuantity ?? 100));
    const isActive = body.is_active === false || body.isActive === false ? 0 : 1;
    const category = String(body.category || 'other').trim();
    const categoryLabel = String(body.category_label || body.categoryLabel || '').trim();
    const coverImageUrl = String(body.cover_image_url || body.coverImageUrl || '').trim();
    const iconUrl = String(body.icon_url || body.iconUrl || '').trim();
    const description = String(body.description || '').trim();
    const badge = String(body.badge || '').trim();
    const instructions = String(body.instructions || '').trim();
    const fpEnabled = body.first_purchase_enabled === true || body.first_purchase_enabled === 1 ? 1 : 0;
    const fpPrice = body.first_purchase_price ? Number(body.first_purchase_price) : null;
    const fpMaxPrice = body.first_purchase_max_price ? Number(body.first_purchase_max_price) : null;

    await env.DB.prepare(`
      INSERT INTO utilities (
        id, title, game_slug, game_name, original_price, discount_percent, current_price,
        stock_quantity, sold_count, is_active, category, category_label, cover_image_url,
        icon_url, description, badge, instructions, virtual_sold_count, show_sold_count,
        first_purchase_enabled, first_purchase_price, first_purchase_max_price, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, datetime('now'))
    `).bind(
      id, title, gameSlug, gameName, originalPrice, discountPercent, currentPrice,
      stockQuantity, isActive, category, categoryLabel, coverImageUrl,
      iconUrl, description, badge, instructions, fpEnabled, fpPrice, fpMaxPrice
    ).run();

    // Đồng bộ vào wcg_admin_utilities_v4
    try {
      const savedList = await getSettingD1<any[]>(env.DB, 'wcg_admin_utilities_v4').catch(() => []);
      const list = Array.isArray(savedList) ? savedList : [];
      list.unshift({
        id, title, game_slug: gameSlug, game_name: gameName, original_price: originalPrice,
        discount_percent: discountPercent, current_price: currentPrice, stock_quantity: stockQuantity,
        sold_count: 0, is_active: isActive === 1, category, category_label: categoryLabel,
        cover_image_url: coverImageUrl, icon_url: iconUrl, description, badge, instructions,
        first_purchase_enabled: fpEnabled === 1, first_purchase_price: fpPrice, first_purchase_max_price: fpMaxPrice,
      });
      await setSettingD1(env.DB, 'wcg_admin_utilities_v4', list);
    } catch {}

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'CREATE_UTILITY',
      targetId: id,
      details: { title, currentPrice, stockQuantity },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã tạo gói tiện ích "${title}" thành công.`,
        utility: {
          id,
          title,
          currentPrice,
          originalPrice,
          stockQuantity,
          isActive: isActive === 1,
        },
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi tạo gói tiện ích: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
