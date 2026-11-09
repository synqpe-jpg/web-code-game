import { ensureSchemaUpgrades, ensureUtilitiesSchema, getSettingD1, setSettingD1, logAdminAudit } from '../../../services/d1_service';
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
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

function extractTargetId(params: any, url: URL): string {
  let targetId = String(params?.id || url.searchParams.get('id') || '').trim();
  if (!targetId) {
    const parts = url.pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart !== 'utilities') {
      targetId = lastPart;
    }
  }
  return targetId;
}

/**
 * GET /api/admin/utilities/:id
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

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

    const targetId = extractTargetId(params, new URL(request.url));
    const utility = await env.DB.prepare('SELECT * FROM utilities WHERE id = ? LIMIT 1').bind(targetId).first<any>();

    if (!utility) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy tiện ích "${targetId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ success: true, utility }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi lấy tiện ích: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * PUT /api/admin/utilities/:id
 * Cập nhật thông tin gói tiện ích
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

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

    const targetId = extractTargetId(params, new URL(request.url));
    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã tiện ích (:id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON payload required' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const existing = await env.DB.prepare('SELECT * FROM utilities WHERE id = ? LIMIT 1').bind(targetId).first<any>();
    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy tiện ích "${targetId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const newTitle = body.title !== undefined ? String(body.title).trim() : existing.title;
    const newOrigPrice = body.original_price !== undefined ? Math.max(0, Number(body.original_price)) : existing.original_price;
    const newDiscPercent = body.discount_percent !== undefined ? Math.max(0, Math.min(100, Number(body.discount_percent))) : existing.discount_percent;
    const newCurrPrice = body.current_price !== undefined ? Math.max(0, Number(body.current_price)) : existing.current_price;
    const newStock = body.stock_quantity !== undefined ? Math.max(0, Number(body.stock_quantity)) : existing.stock_quantity;
    const newIsActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active;
    const newCategory = body.category !== undefined ? String(body.category).trim() : existing.category;
    const newCategoryLabel = body.category_label !== undefined ? String(body.category_label).trim() : existing.category_label;
    const newCoverImage = body.cover_image_url !== undefined ? String(body.cover_image_url).trim() : existing.cover_image_url;
    const newIconUrl = body.icon_url !== undefined ? String(body.icon_url).trim() : existing.icon_url;
    const newDesc = body.description !== undefined ? String(body.description).trim() : existing.description;
    const newBadge = body.badge !== undefined ? String(body.badge).trim() : existing.badge;
    const newInstructions = body.instructions !== undefined ? String(body.instructions).trim() : existing.instructions;

    await env.DB.prepare(`
      UPDATE utilities
      SET title = ?,
          original_price = ?,
          discount_percent = ?,
          current_price = ?,
          stock_quantity = ?,
          is_active = ?,
          category = ?,
          category_label = ?,
          cover_image_url = ?,
          icon_url = ?,
          description = ?,
          badge = ?,
          instructions = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      newTitle, newOrigPrice, newDiscPercent, newCurrPrice, newStock, newIsActive,
      newCategory, newCategoryLabel, newCoverImage, newIconUrl, newDesc, newBadge,
      newInstructions, targetId
    ).run();

    // Đồng bộ vào wcg_admin_utilities_v4
    try {
      const savedList = await getSettingD1<any[]>(env.DB, 'wcg_admin_utilities_v4').catch(() => []);
      if (Array.isArray(savedList)) {
        const updatedList = savedList.map((u: any) => {
          if (u && u.id === targetId) {
            return {
              ...u,
              title: newTitle,
              original_price: newOrigPrice,
              discount_percent: newDiscPercent,
              current_price: newCurrPrice,
              stock_quantity: newStock,
              is_active: newIsActive === 1,
              category: newCategory,
              category_label: newCategoryLabel,
              cover_image_url: newCoverImage,
              icon_url: newIconUrl,
              description: newDesc,
              badge: newBadge,
              instructions: newInstructions,
            };
          }
          return u;
        });
        await setSettingD1(env.DB, 'wcg_admin_utilities_v4', updatedList);
      }
    } catch {}

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'UPDATE_UTILITY',
      targetId,
      details: { title: newTitle, currentPrice: newCurrPrice, stockQuantity: newStock },
    });

    const updated = await env.DB.prepare('SELECT * FROM utilities WHERE id = ? LIMIT 1').bind(targetId).first<any>();

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã cập nhật tiện ích "${newTitle}" thành công.`,
        utility: updated,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi cập nhật tiện ích: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * DELETE /api/admin/utilities/:id
 * Xóa gói tiện ích (xóa CSDL D1, setting KV và đánh dấu tombstone)
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;

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

    const targetId = extractTargetId(params, new URL(request.url));
    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã tiện ích (:id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const existing = await env.DB.prepare('SELECT * FROM utilities WHERE id = ? LIMIT 1').bind(targetId).first<any>();

    // Xóa từ bảng utilities
    await env.DB.prepare('DELETE FROM utilities WHERE id = ?').bind(targetId).run();

    // Xóa khỏi setting wcg_admin_utilities_v4
    try {
      const savedList = await getSettingD1<any[]>(env.DB, 'wcg_admin_utilities_v4').catch(() => []);
      if (Array.isArray(savedList)) {
        const filtered = savedList.filter((u: any) => u && u.id !== targetId);
        await setSettingD1(env.DB, 'wcg_admin_utilities_v4', filtered);
      }
    } catch {}

    // Ghi vào tombstone wcg_deleted_utilities để chống hồi sinh
    try {
      const delList = await getSettingD1<string[]>(env.DB, 'wcg_deleted_utilities').catch(() => []);
      const set = new Set(Array.isArray(delList) ? delList : []);
      set.add(targetId);
      await setSettingD1(env.DB, 'wcg_deleted_utilities', Array.from(set));
    } catch {}

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'DELETE_UTILITY',
      targetId,
      details: { title: existing?.title || targetId },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã xóa tiện ích "${existing?.title || targetId}" thành công.`,
        deletedId: targetId,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi xóa tiện ích: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
