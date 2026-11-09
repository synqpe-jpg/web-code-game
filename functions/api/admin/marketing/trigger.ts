import { ensureSchemaUpgrades, logAdminAudit } from '../../../services/d1_service';
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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * POST /api/admin/marketing/trigger
 * Kích hoạt phát tức thì một thông báo tiếp thị (Broadcast Marketing Event)
 * Body: { type: 'BUY_PRODUCT' | 'CLAIM_GIVEAWAY' | 'COPY_CODE' | 'RESTOCK_PRODUCT'; productId?: string; productName?: string; userName?: string; amount?: number }
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

    const auth = await verifyAdminAuth(request, env as any, 'MARKETING_FULL');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền MARKETING_FULL, STORE_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Body JSON không hợp lệ' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const type = String(body.type || 'BUY_PRODUCT').toUpperCase().trim();
    const eventId = `mkt_ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const productId = body.productId ? String(body.productId).trim() : null;
    const now = new Date().toISOString();

    // Ghi sự kiện vào wcg_virtual_events
    await env.DB.prepare(`
      INSERT INTO wcg_virtual_events (id, type, product_id, event_data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      eventId,
      type,
      productId,
      JSON.stringify({
        userName: body.userName || 'Người chơi ẩn danh',
        productName: body.productName || 'Vật phẩm game',
        amount: body.amount || 1,
        source: 'ADMIN_REMOTE_TRIGGER',
      }),
      now
    ).run().catch(() => {});

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'API Client',
      action: 'TRIGGER_MARKETING_EVENT',
      targetId: productId || eventId,
      details: JSON.stringify({ eventId, type, userName: body.userName, productName: body.productName }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã kích hoạt sự kiện tiếp thị "${type}" thành công.`,
        eventId,
        type,
        productId,
        triggeredAt: now,
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi kích hoạt sự kiện tiếp thị' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
