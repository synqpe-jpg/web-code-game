import {
  ensureSchemaUpgrades,
  loadAllStoreProductsD1,
  getSettingD1,
  setSettingD1,
} from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

async function authenticateAdmin(request: Request, env: Env): Promise<{ authorized: boolean; error?: string }> {
  const adminCheck = await verifyAdminAuth(request, env as any, 'FIRST_PURCHASE_MANAGE');
  if (adminCheck.authorized) {
    return { authorized: true };
  }
  return { authorized: false, error: adminCheck.error || 'Unauthorized: Yêu cầu khóa quản trị hợp lệ.' };
}

/**
 * GET /api/admin/store/first-purchase
 * Danh sách toàn bộ gói cửa hàng kèm 3 cờ: first_purchase_enabled, first_purchase_price, first_purchase_max_price
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cơ sở dữ liệu Cloudflare D1 chưa được kích hoạt.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await authenticateAdmin(request, env);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const products = await loadAllStoreProductsD1(env.DB);
    const resultList = (products || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      game_slug: p.game_slug || '',
      game_name: p.game_name || '',
      current_price: Number(p.current_price) || 0,
      original_price: Number(p.original_price) || 0,
      is_active: p.is_active !== false && p.is_active !== 0,
      sale_mode: p.sale_mode || 'normal',
      first_purchase_enabled: p.first_purchase_enabled === true || p.first_purchase_enabled === 1 || String(p.first_purchase_enabled) === '1' || String(p.first_purchase_enabled) === 'true',
      first_purchase_price: (p.first_purchase_price !== null && p.first_purchase_price !== undefined && !isNaN(Number(p.first_purchase_price)))
        ? Number(p.first_purchase_price)
        : null,
      first_purchase_max_price: (p.first_purchase_max_price !== null && p.first_purchase_max_price !== undefined && !isNaN(Number(p.first_purchase_max_price)))
        ? Number(p.first_purchase_max_price)
        : null,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        total: resultList.length,
        products: resultList,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi máy chủ khi lấy danh sách ưu đãi gói cửa hàng.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * PUT /api/admin/store/first-purchase/:id
 * Cập nhật 3 cờ của 1 gói cửa hàng: first_purchase_enabled, first_purchase_price, first_purchase_max_price
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cơ sở dữ liệu Cloudflare D1 chưa được kích hoạt.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await authenticateAdmin(request, env);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const url = new URL(request.url);
    let targetId = String(params?.id || url.searchParams.get('id') || '').trim();

    if (!targetId) {
      const parts = url.pathname.split('/').filter(Boolean);
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart !== 'first-purchase') {
        targetId = lastPart;
      }
    }

    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã gói cửa hàng (id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ (JSON format required).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const existing = await env.DB.prepare(
      'SELECT * FROM store_products WHERE id = ? LIMIT 1'
    ).bind(targetId).first<any>();

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy gói cửa hàng có mã "${targetId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    let newEnabled: number = existing.first_purchase_enabled !== null && existing.first_purchase_enabled !== undefined
      ? (existing.first_purchase_enabled === 1 || existing.first_purchase_enabled === true || String(existing.first_purchase_enabled) === '1' ? 1 : 0)
      : 1;

    if (body.first_purchase_enabled !== undefined) {
      newEnabled = (body.first_purchase_enabled === true || body.first_purchase_enabled === 1 || String(body.first_purchase_enabled) === '1' || String(body.first_purchase_enabled) === 'true') ? 1 : 0;
    }

    let newPrice: number | null = (existing.first_purchase_price !== null && existing.first_purchase_price !== undefined)
      ? Number(existing.first_purchase_price)
      : null;

    if (body.first_purchase_price !== undefined) {
      if (body.first_purchase_price === null || body.first_purchase_price === '' || String(body.first_purchase_price).trim() === '') {
        newPrice = null;
      } else {
        const numP = Number(body.first_purchase_price);
        newPrice = (!isNaN(numP) && numP > 0) ? Math.round(numP) : null;
      }
    }

    let newMaxPrice: number | null = (existing.first_purchase_max_price !== null && existing.first_purchase_max_price !== undefined)
      ? Number(existing.first_purchase_max_price)
      : null;

    if (body.first_purchase_max_price !== undefined) {
      if (body.first_purchase_max_price === null || body.first_purchase_max_price === '' || String(body.first_purchase_max_price).trim() === '') {
        newMaxPrice = null;
      } else {
        const numM = Number(body.first_purchase_max_price);
        newMaxPrice = (!isNaN(numM) && numM > 0) ? Math.round(numM) : null;
      }
    }

    await env.DB.prepare(`
      UPDATE store_products
      SET first_purchase_enabled = ?,
          first_purchase_price = ?,
          first_purchase_max_price = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(newEnabled, newPrice, newMaxPrice, targetId).run();

    try {
      const savedStoreRaw = await getSettingD1(env.DB, 'wcg_admin_store_products_v4').catch(() => null);
      if (Array.isArray(savedStoreRaw)) {
        let changed = false;
        const updated = savedStoreRaw.map((p: any) => {
          if (p && p.id === targetId) {
            changed = true;
            return {
              ...p,
              first_purchase_enabled: newEnabled === 1,
              first_purchase_price: newPrice,
              first_purchase_max_price: newMaxPrice,
            };
          }
          return p;
        });
        if (changed) {
          await setSettingD1(env.DB, 'wcg_admin_store_products_v4', updated);
        }
      }
    } catch (e) {
      console.warn('[store/first-purchase update setting error]', e);
    }

    const updatedRecord = await env.DB.prepare(
      'SELECT * FROM store_products WHERE id = ? LIMIT 1'
    ).bind(targetId).first<any>();

    const resultProduct = {
      id: updatedRecord.id,
      title: updatedRecord.title,
      game_slug: updatedRecord.game_slug || '',
      current_price: Number(updatedRecord.current_price) || 0,
      original_price: Number(updatedRecord.original_price) || 0,
      first_purchase_enabled: newEnabled === 1,
      first_purchase_price: newPrice,
      first_purchase_max_price: newMaxPrice,
      is_active: updatedRecord.is_active !== 0,
    };

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã cập nhật ưu đãi mua lần đầu cho gói "${updatedRecord.title}".`,
        product: resultProduct,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi máy chủ khi cập nhật ưu đãi gói cửa hàng.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
