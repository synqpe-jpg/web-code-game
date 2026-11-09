import {
  ensureSchemaUpgrades,
  loadAllUtilitiesD1,
  getSettingD1,
  setSettingD1,
} from '../../../services/d1_service';
import { verifyAdminAuth } from '../../../services/mission_service';
import fallbackUtilitiesData from '../../../../src/data/utilities.json';

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
 * GET /api/admin/utilities/first-purchase
 * Danh sách toàn bộ tiện ích kèm 3 cờ: first_purchase_enabled, first_purchase_price, first_purchase_max_price
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

    const d1Utils = await loadAllUtilitiesD1(env.DB);
    const delUtilsRaw = await getSettingD1(env.DB, 'wcg_deleted_utilities').catch(() => []);
    const delSet = new Set(Array.isArray(delUtilsRaw) ? delUtilsRaw : []);

    // Guaranteed complete 18 utilities list
    const fallbackList = (fallbackUtilitiesData as any[]).filter((u: any) => u && u.id && !delSet.has(u.id));
    const mergedMap = new Map<string, any>();
    fallbackList.forEach((fb) => mergedMap.set(fb.id, fb));
    (d1Utils || []).forEach((u) => {
      if (u && u.id && !delSet.has(u.id)) {
        mergedMap.set(u.id, { ...(mergedMap.get(u.id) || {}), ...u });
      }
    });

    const utilities = Array.from(mergedMap.values()).map((u: any) => ({
      id: u.id,
      title: u.title,
      sku: u.sku || '',
      category: u.category || 'cloud-phone',
      category_label: u.category_label || '',
      current_price: Number(u.current_price) || 0,
      original_price: Number(u.original_price) || 0,
      stock_quantity: typeof u.stock_quantity === 'number' ? u.stock_quantity : 0,
      is_active: u.is_active !== false && u.is_active !== 0,
      first_purchase_enabled: u.first_purchase_enabled === true || u.first_purchase_enabled === 1 || String(u.first_purchase_enabled) === '1' || String(u.first_purchase_enabled) === 'true',
      first_purchase_price: (u.first_purchase_price !== null && u.first_purchase_price !== undefined && !isNaN(Number(u.first_purchase_price)))
        ? Number(u.first_purchase_price)
        : null,
      first_purchase_max_price: (u.first_purchase_max_price !== null && u.first_purchase_max_price !== undefined && !isNaN(Number(u.first_purchase_max_price)))
        ? Number(u.first_purchase_max_price)
        : null,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        total: utilities.length,
        utilities,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi máy chủ khi lấy danh sách ưu đãi tiện ích.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * PUT /api/admin/utilities/first-purchase/:id
 * Cập nhật 3 cờ của 1 tiện ích: first_purchase_enabled, first_purchase_price, first_purchase_max_price
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

    // Extract utility id from path params, query params, or URL
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
        JSON.stringify({ success: false, error: 'Thiếu mã tiện ích (id).' }),
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

    // 1. Tìm bản ghi hiện tại trong bảng utilities hoặc fallback
    let existing = await env.DB.prepare(
      'SELECT * FROM utilities WHERE id = ? LIMIT 1'
    ).bind(targetId).first<any>();

    if (!existing) {
      const fbItem = (fallbackUtilitiesData as any[]).find((u: any) => u && u.id === targetId);
      if (fbItem) {
        // Chèn vào DB nếu chưa có dòng trong bảng utilities
        await env.DB.prepare(`
          INSERT INTO utilities (
            id, title, original_price, discount_percent, current_price, stock_quantity, sold_count, is_active,
            category, category_label, cover_image_url, icon_url, description, badge, instructions,
            first_purchase_enabled, first_purchase_price, first_purchase_max_price, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, datetime('now'))
        `).bind(
          fbItem.id, fbItem.title, fbItem.original_price || 0, fbItem.discount_percent || 0, fbItem.current_price || 0,
          fbItem.stock_quantity || 0, fbItem.sold_count || 0, fbItem.is_active !== false ? 1 : 0,
          fbItem.category || 'other', fbItem.category_label || '', fbItem.cover_image_url || '', fbItem.icon_url || '',
          fbItem.description || '', fbItem.badge || '', fbItem.instructions || ''
        ).run().catch(() => {});

        existing = await env.DB.prepare(
          'SELECT * FROM utilities WHERE id = ? LIMIT 1'
        ).bind(targetId).first<any>();
      }
    }

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy tiện ích có mã "${targetId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // 2. Phân giải các trường mới (giữ nguyên trường không được gửi lên)
    let newEnabled: number = existing.first_purchase_enabled !== null && existing.first_purchase_enabled !== undefined
      ? (existing.first_purchase_enabled === 1 || existing.first_purchase_enabled === true || String(existing.first_purchase_enabled) === '1' ? 1 : 0)
      : 0;

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

    // 3. Cập nhật bảng utilities trong SQLite D1
    await env.DB.prepare(`
      UPDATE utilities
      SET first_purchase_enabled = ?,
          first_purchase_price = ?,
          first_purchase_max_price = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(newEnabled, newPrice, newMaxPrice, targetId).run();

    // 4. Đồng bộ vào setting wcg_admin_utilities_v4 trong D1 (nếu có)
    try {
      const savedUtilsRaw = await getSettingD1(env.DB, 'wcg_admin_utilities_v4').catch(() => null);
      if (Array.isArray(savedUtilsRaw)) {
        let changed = false;
        const updated = savedUtilsRaw.map((u: any) => {
          if (u && u.id === targetId) {
            changed = true;
            return {
              ...u,
              first_purchase_enabled: newEnabled === 1,
              first_purchase_price: newPrice,
              first_purchase_max_price: newMaxPrice,
            };
          }
          return u;
        });
        if (changed) {
          await setSettingD1(env.DB, 'wcg_admin_utilities_v4', updated);
        }
      }
    } catch (e) {
      console.warn('[utilities/first-purchase update setting error]', e);
    }

    // 5. Trả về bản ghi sau khi sửa
    const updatedRecord = await env.DB.prepare(
      'SELECT * FROM utilities WHERE id = ? LIMIT 1'
    ).bind(targetId).first<any>();

    const resultUtility = {
      id: updatedRecord.id,
      title: updatedRecord.title,
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
        message: `Đã cập nhật ưu đãi mua lần đầu cho tiện ích "${updatedRecord.title}".`,
        utility: resultUtility,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi máy chủ khi cập nhật ưu đãi tiện ích.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
