import { ensureSchemaUpgrades, ensureUtilitiesSchema, getSettingD1, setSettingD1, logAdminAudit } from '../../../../services/d1_service';
import { verifyAdminAuth } from '../../../../services/mission_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

function extractTargetId(params: any, url: URL): string {
  let targetId = String(params?.id || url.searchParams.get('id') || '').trim();
  if (!targetId) {
    const parts = url.pathname.split('/').filter(Boolean);
    // Path: /api/admin/utilities/:id/stock
    const stockIdx = parts.lastIndexOf('stock');
    if (stockIdx > 0) {
      targetId = parts[stockIdx - 1];
    } else {
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart !== 'utilities' && lastPart !== 'stock') {
        targetId = lastPart;
      }
    }
  }
  return targetId;
}

/**
 * PUT /api/admin/utilities/:id/stock
 * Cập nhật số lượng kho hàng tiện ích
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
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền STORE_FULL hoặc UTILITIES_FULL' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    await ensureUtilitiesSchema(env.DB);

    const targetId = extractTargetId(params, new URL(request.url));
    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng cung cấp mã tiện ích (id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Payload không hợp lệ (yêu cầu JSON format).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const existing = await env.DB.prepare('SELECT * FROM utilities WHERE id = ? LIMIT 1').bind(targetId).first<any>();
    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy tiện ích với mã "${targetId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const currentStock = Math.max(0, Number(existing.stock_quantity ?? existing.stock) || 0);
    let newStock = currentStock;

    if (body.stock_quantity !== undefined || body.stock !== undefined || body.quantity !== undefined) {
      const raw = body.stock_quantity ?? body.stock ?? body.quantity;
      const parsed = Math.max(0, Math.floor(Number(raw) || 0));
      newStock = parsed;
    } else if (body.delta !== undefined || body.adjust_stock !== undefined || body.change !== undefined) {
      const rawDelta = Number(body.delta ?? body.adjust_stock ?? body.change) || 0;
      newStock = Math.max(0, Math.floor(currentStock + rawDelta));
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng cung cấp stock_quantity hoặc delta để cập nhật kho.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const nowIso = new Date().toISOString();
    await env.DB.prepare('UPDATE utilities SET stock_quantity = ?, updated_at = ? WHERE id = ?')
      .bind(newStock, nowIso, targetId)
      .run();

    // Đồng bộ vào wcg_admin_utilities_v4 trong system_settings
    try {
      const rawList = await getSettingD1<any[]>(env.DB, 'wcg_admin_utilities_v4', []);
      if (Array.isArray(rawList) && rawList.length > 0) {
        let changed = false;
        const updatedList = rawList.map((item) => {
          if (item && (item.id === targetId || item.sku === targetId)) {
            changed = true;
            return {
              ...item,
              stock: newStock,
              stock_quantity: newStock,
              updated_at: nowIso,
            };
          }
          return item;
        });
        if (changed) {
          await setSettingD1(env.DB, 'wcg_admin_utilities_v4', updatedList);
        }
      }
    } catch (e) {
      console.warn('[Admin Utilities Stock] Sync system_settings warning:', e);
    }

    await logAdminAudit(env.DB, {
      action: 'UPDATE_UTILITY_STOCK',
      targetId,
      actor: auth.adminName || auth.keyName || 'Admin',
      actorEmail: auth.adminId || 'admin@codegame.shop',
      severity: 'INFO',
      details: {
        utilityId: targetId,
        title: existing.title || existing.name,
        previousStock: currentStock,
        newStock,
        updatedAt: nowIso,
      },
    });

    const updated = await env.DB.prepare('SELECT * FROM utilities WHERE id = ? LIMIT 1').bind(targetId).first<any>();

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã cập nhật tồn kho tiện ích "${existing.title || targetId}" thành ${newStock}.`,
        utility: {
          id: targetId,
          title: existing.title || existing.name,
          previous_stock: currentStock,
          stock_quantity: newStock,
          updated_at: nowIso,
          details: updated,
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('[Admin Utilities Stock Error]:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi cập nhật kho tiện ích: ' + (error?.message || String(error)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

export const onRequestPost = onRequestPut;
