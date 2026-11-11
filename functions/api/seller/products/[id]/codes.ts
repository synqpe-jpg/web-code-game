import { verifyMemberAuth } from '../../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../../services/d1_service';
import { encryptCode, decryptCode, hashCode, maskCode } from '../../../../services/marketplace_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
  MARKETPLACE_CODE_KEY?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET: Danh sách mã trong kho của sản phẩm
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const productId = params.id as string;
    const memberId = auth.member.id;

    // Kiểm tra quyền
    const product = await env.DB
      .prepare(`
        SELECT sp.id, sp.seller_id, sp.name as product_name
        FROM seller_products sp
        JOIN sellers s ON sp.seller_id = s.id
        WHERE sp.id = ? AND sp.deleted_at IS NULL
          AND (s.owner_member_id = ? OR s.id IN (SELECT seller_id FROM seller_subaccounts WHERE member_id = ?))
        LIMIT 1
      `)
      .bind(productId, memberId, memberId)
      .first<any>();

    if (!product) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sản phẩm không tồn tại hoặc bạn không có quyền truy cập.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(10, parseInt(url.searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, status, batch_id, code_encrypted, sold_at, reported_at, created_at, updated_at
      FROM seller_codes
      WHERE product_id = ? AND deleted_at IS NULL
    `;
    const binds: any[] = [productId];

    if (statusFilter) {
      query += ` AND status = ?`;
      binds.push(statusFilter);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    binds.push(limit, offset);

    const codesResult = await env.DB.prepare(query).bind(...binds).all<any>();

    // Đếm tổng số
    let countQuery = `SELECT COUNT(*) as total FROM seller_codes WHERE product_id = ? AND deleted_at IS NULL`;
    const countBinds: any[] = [productId];
    if (statusFilter) {
      countQuery += ` AND status = ?`;
      countBinds.push(statusFilter);
    }
    const countResult = await env.DB.prepare(countQuery).bind(...countBinds).first<{ total: number }>();

    // Che mã bằng maskCode (§5.2: xem mã che ••••••)
    const items = await Promise.all(
      (codesResult.results || []).map(async (row) => {
        let plainCode = '';
        try {
          plainCode = await decryptCode(row.code_encrypted, env.MARKETPLACE_CODE_KEY);
        } catch {
          plainCode = 'CODE_MASKED';
        }
        return {
          id: row.id,
          masked_code: maskCode(plainCode),
          status: row.status,
          batch_id: row.batch_id,
          sold_at: row.sold_at,
          reported_at: row.reported_at,
          created_at: row.created_at,
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        product: { id: product.id, name: product.product_name },
        codes: items,
        pagination: {
          page,
          limit,
          total: countResult?.total || 0,
          totalPages: Math.ceil((countResult?.total || 0) / limit),
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

// POST: Nạp mã vào kho (§5.2)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const productId = params.id as string;
    const memberId = auth.member.id;

    // Kiểm tra quyền nạp kho
    const product = await env.DB
      .prepare(`
        SELECT sp.id, sp.seller_id, sp.name as product_name
        FROM seller_products sp
        JOIN sellers s ON sp.seller_id = s.id
        WHERE sp.id = ? AND sp.deleted_at IS NULL
          AND (s.owner_member_id = ? OR s.id IN (SELECT seller_id FROM seller_subaccounts WHERE member_id = ? AND role = 'MANAGE_STOCK'))
        LIMIT 1
      `)
      .bind(productId, memberId, memberId)
      .first<any>();

    if (!product) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sản phẩm không tồn tại hoặc bạn không có quyền nạp kho.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const body = (await request.json().catch(() => ({}))) as any;
    const rawCodesInput = body.codes;

    let codeList: string[] = [];
    if (Array.isArray(rawCodesInput)) {
      codeList = rawCodesInput.map((c) => String(c || '').trim()).filter((c) => c.length > 0);
    } else if (typeof rawCodesInput === 'string') {
      codeList = rawCodesInput
        .split(/[\r\n,]+/)
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
    }

    if (codeList.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng nhập danh sách mã code hợp lệ.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Giới hạn 1 lần nạp tối đa 1000 mã
    if (codeList.length > 1000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mỗi lần nạp tối đa 1,000 mã code.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!env.MARKETPLACE_CODE_KEY || !env.MARKETPLACE_CODE_KEY.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chưa cấu hình biến môi trường MARKETPLACE_CODE_KEY trên máy chủ.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const batchId = `bat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    // Chuẩn bị kiểm tra trùng lặp
    let addedCount = 0;
    let duplicateShopCount = 0;
    let warningFloorDuplicateCount = 0;

    // Lấy danh sách hash hiện có trong gian hàng này
    const existingHashesRows = await env.DB
      .prepare("SELECT code_hash FROM seller_codes WHERE seller_id = ? AND deleted_at IS NULL")
      .bind(product.seller_id)
      .all<{ code_hash: string }>();

    const existingHashSet = new Set(
      (existingHashesRows.results || []).map((r) => r.code_hash).filter(Boolean)
    );

    // Set để lọc trùng ngay trong danh sách gửi lên
    const currentInputHashSet = new Set<string>();

    const insertStatements: D1PreparedStatement[] = [];

    for (const rawCode of codeList) {
      const codeHash = await hashCode(rawCode);

      // Nếu trùng trong danh sách gửi lên hoặc trùng trong kho của chính gian hàng -> tự loại trùng
      if (currentInputHashSet.has(codeHash) || existingHashSet.has(codeHash)) {
        duplicateShopCount++;
        continue;
      }

      currentInputHashSet.add(codeHash);

      // Kiểm tra trùng kho sàn khác (cảnh báo)
      const floorCheck = await env.DB
        .prepare("SELECT id FROM seller_codes WHERE code_hash = ? AND seller_id != ? AND deleted_at IS NULL LIMIT 1")
        .bind(codeHash, product.seller_id)
        .first<any>();

      if (floorCheck) {
        warningFloorDuplicateCount++;
      }

      const encrypted = await encryptCode(rawCode, env.MARKETPLACE_CODE_KEY);
      const codeId = `scd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      insertStatements.push(
        env.DB.prepare(`
          INSERT INTO seller_codes (
            id, seller_id, product_id, code_encrypted, code_hash,
            status, batch_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'IN_STOCK', ?, ?, ?)
        `).bind(
          codeId,
          product.seller_id,
          product.id,
          encrypted,
          codeHash,
          batchId,
          nowIso,
          nowIso
        )
      );

      addedCount++;
    }

    // Chạy batch insert nếu có mã mới
    if (insertStatements.length > 0) {
      // D1 cho phép batch tối đa 128 stmts / batch, chia chunk an toàn
      const chunkSize = 100;
      for (let i = 0; i < insertStatements.length; i += chunkSize) {
        const chunk = insertStatements.slice(i, i + chunkSize);
        await env.DB.batch(chunk);
      }
    }

    // Ghi audit log
    await logAdminAudit(env.DB, {
      actorName: auth.member.username || auth.member.email,
      actorEmail: auth.member.email,
      action: 'SELLER_RESTOCK_CODES',
      targetId: product.id,
      details: {
        product_name: product.product_name,
        batch_id: batchId,
        added_count: addedCount,
        duplicate_shop_count: duplicateShopCount,
        warning_floor_duplicate_count: warningFloorDuplicateCount,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã nạp thành công ${addedCount} mã vào kho. Đã tự động loại bỏ ${duplicateShopCount} mã trùng lặp.`,
        added_count: addedCount,
        duplicate_count: duplicateShopCount,
        warning_floor_duplicate_count: warningFloorDuplicateCount,
        batch_id: batchId,
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
