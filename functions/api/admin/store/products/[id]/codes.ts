import { ensureSchemaUpgrades, logAdminAudit } from '../../../../../services/d1_service';
import { verifyAdminAuth } from '../../../../../services/mission_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/admin/store/products/:id/codes
 * Danh sách mã kho của gói sản phẩm bán + lọc trạng thái + phân trang
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;
  const productId = String(params.id || '').trim();

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'INVENTORY_ITEMS_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền INVENTORY_ITEMS_MANAGE, STORE_FULL hoặc ADMIN_FULL.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    // Kiểm tra sản phẩm tồn tại trong store_products
    const product = await env.DB.prepare('SELECT id, title, game_slug, price, base_stock FROM store_products WHERE id = ?')
      .bind(productId)
      .first<any>();

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    const status = (url.searchParams.get('status') || 'ALL').toUpperCase().trim();
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();

    const conditions: string[] = ['product_id = ?'];
    const sqlParams: any[] = [productId];

    if (status !== 'ALL' && ['AVAILABLE', 'SOLD', 'RESERVED'].includes(status)) {
      conditions.push('status = ?');
      sqlParams.push(status);
    }

    if (search) {
      conditions.push('(code_content LIKE ? OR order_id LIKE ?)');
      const wild = `%${search}%`;
      sqlParams.push(wild, wild);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRow = await env.DB.prepare(`SELECT COUNT(*) as total FROM inventory_codes ${whereClause}`)
      .bind(...sqlParams)
      .first<any>();
    const total = Number(countRow?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const rows = await env.DB.prepare(`
      SELECT id, product_id, code_content, status, order_id, sold_at, created_at
      FROM inventory_codes
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).bind(...sqlParams, limit, offset).all<any>();

    // Đếm tổng số có sẵn và đã bán của sản phẩm
    const summaryRow = await env.DB.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_count,
        SUM(CASE WHEN status = 'SOLD' THEN 1 ELSE 0 END) as sold_count
      FROM inventory_codes
      WHERE product_id = ?
    `).bind(productId).first<any>();

    return new Response(
      JSON.stringify({
        success: true,
        productId,
        productTitle: product?.title || null,
        productGameSlug: product?.game_slug || null,
        summary: {
          available: Number(summaryRow?.available_count || 0),
          sold: Number(summaryRow?.sold_count || 0),
          totalInDb: Number(summaryRow?.available_count || 0) + Number(summaryRow?.sold_count || 0),
          baseStockSetting: Number(product?.base_stock || 0),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        codes: (rows?.results || []).map((r: any) => ({
          id: r.id,
          code: r.code_content,
          status: r.status,
          orderId: r.order_id || null,
          soldAt: r.sold_at || null,
          createdAt: r.created_at,
        })),
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi truy vấn kho mã bán' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * POST /api/admin/store/products/:id/codes
 * Nạp hàng loạt mã bán mới vào bảng inventory_codes
 * Body: { codes: string[] | string }
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;
  const productId = String(params.id || '').trim();

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'INVENTORY_ITEMS_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền INVENTORY_ITEMS_MANAGE, STORE_FULL hoặc ADMIN_FULL.' }),
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

    let rawCodes: string[] = [];
    if (Array.isArray(body.codes)) {
      rawCodes = body.codes.map((c: any) => String(c).trim()).filter(Boolean);
    } else if (typeof body.codes === 'string') {
      rawCodes = body.codes
        .split(/[\r\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (rawCodes.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng cung cấp ít nhất 1 mã code trong trường codes' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Loại bỏ mã trùng trong batch nạp
    const uniqueBatch = Array.from(new Set(rawCodes));

    // Lấy các mã đã tồn tại sẵn trong product này để chống nạp đúp
    const placeholders = uniqueBatch.map(() => '?').join(',');
    const existingRows = await env.DB.prepare(
      `SELECT code_content FROM inventory_codes WHERE product_id = ? AND code_content IN (${placeholders})`
    ).bind(productId, ...uniqueBatch).all<any>().catch(() => ({ results: [] }));

    const existingSet = new Set((existingRows?.results || []).map((r: any) => r.code_content));
    const toInsert = uniqueBatch.filter((code) => !existingSet.has(code));

    if (toInsert.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Tất cả các mã gửi lên đều đã tồn tại trong kho của sản phẩm này.',
          addedCount: 0,
          skippedDuplicatesCount: uniqueBatch.length,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Chèn từng lô tối đa 50 bản ghi
    const chunkSize = 50;
    const now = new Date().toISOString();
    let totalInserted = 0;

    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      const statements = chunk.map((code, idx) => {
        const id = `inv_${Date.now()}_${i + idx}_${Math.random().toString(36).substring(2, 7)}`;
        return env.DB.prepare(`
          INSERT INTO inventory_codes (id, product_id, code_content, status, created_at)
          VALUES (?, ?, ?, 'AVAILABLE', ?)
        `).bind(id, productId, code, now);
      });
      await env.DB.batch(statements);
      totalInserted += chunk.length;
    }

    // Cập nhật lại số lượng tồn kho trong store_products nếu bảng có tồn tại
    const countRow = await env.DB.prepare(
      "SELECT COUNT(*) as available_count FROM inventory_codes WHERE product_id = ? AND status = 'AVAILABLE'"
    ).bind(productId).first<any>();
    const newAvailableCount = Number(countRow?.available_count || 0);

    await env.DB.prepare('UPDATE store_products SET base_stock = ? WHERE id = ?')
      .bind(newAvailableCount, productId)
      .run()
      .catch(() => {});

    // Ghi audit log
    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'API Client',
      action: 'INGEST_STORE_CODES',
      targetId: productId,
      details: JSON.stringify({
        totalSubmitted: rawCodes.length,
        insertedCount: totalInserted,
        duplicatesSkipped: existingSet.size,
        newAvailableStock: newAvailableCount,
      }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã nạp thành công ${totalInserted} mã mới vào kho. Bỏ qua ${existingSet.size} mã trùng.`,
        productId,
        insertedCount: totalInserted,
        skippedDuplicatesCount: existingSet.size,
        currentAvailableStock: newAvailableCount,
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi nạp mã kho sản phẩm' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * DELETE /api/admin/store/products/:id/codes
 * Xóa mã kho chưa bán (status = 'AVAILABLE')
 * Body: { codeIds?: string[]; codes?: string[]; deleteAllAvailable?: boolean }
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, request, params } = context;
  const productId = String(params.id || '').trim();

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Database not available' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyAdminAuth(request, env as any, 'INVENTORY_ITEMS_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Unauthorized: Yêu cầu quyền INVENTORY_ITEMS_MANAGE, STORE_FULL hoặc ADMIN_FULL.' }),
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

    let deletedCount = 0;

    if (body.deleteAllAvailable === true) {
      const res = await env.DB.prepare(
        "DELETE FROM inventory_codes WHERE product_id = ? AND status = 'AVAILABLE'"
      ).bind(productId).run();
      deletedCount = Number(res?.meta?.changes || 0);
    } else if (Array.isArray(body.codeIds) && body.codeIds.length > 0) {
      const ids = body.codeIds.map((id: any) => String(id).trim()).filter(Boolean);
      const placeholders = ids.map(() => '?').join(',');
      const res = await env.DB.prepare(
        `DELETE FROM inventory_codes WHERE product_id = ? AND status = 'AVAILABLE' AND id IN (${placeholders})`
      ).bind(productId, ...ids).run();
      deletedCount = Number(res?.meta?.changes || 0);
    } else if (Array.isArray(body.codes) && body.codes.length > 0) {
      const codes = body.codes.map((c: any) => String(c).trim()).filter(Boolean);
      const placeholders = codes.map(() => '?').join(',');
      const res = await env.DB.prepare(
        `DELETE FROM inventory_codes WHERE product_id = ? AND status = 'AVAILABLE' AND code_content IN (${placeholders})`
      ).bind(productId, ...codes).run();
      deletedCount = Number(res?.meta?.changes || 0);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng cung cấp codeIds, codes hoặc deleteAllAvailable: true để xóa' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Cập nhật lại tồn kho trong store_products
    const countRow = await env.DB.prepare(
      "SELECT COUNT(*) as available_count FROM inventory_codes WHERE product_id = ? AND status = 'AVAILABLE'"
    ).bind(productId).first<any>();
    const newAvailableCount = Number(countRow?.available_count || 0);

    await env.DB.prepare('UPDATE store_products SET base_stock = ? WHERE id = ?')
      .bind(newAvailableCount, productId)
      .run()
      .catch(() => {});

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'API Client',
      action: 'DELETE_STORE_CODES',
      targetId: productId,
      details: JSON.stringify({ deletedCount, remainingAvailableStock: newAvailableCount }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã xóa thành công ${deletedCount} mã kho chưa bán.`,
        productId,
        deletedCount,
        remainingAvailableStock: newAvailableCount,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Lỗi xóa mã kho sản phẩm' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
