import {
  CORS_HEADERS,
  Env,
  verifyAiKeyAuth,
  verifyAdminAuth,
  hasScope,
} from '../../services/mission_service';
import {
  loadAllStoreProductsD1,
  deleteStoreProductD1,
  deleteInventoryCodesD1,
  syncProductStockCounter,
  getSettingD1,
  setSettingD1,
  invalidateSettingMemoryCache,
  ensureSchemaUpgrades,
} from '../../services/d1_service';
import { recordSoftDelete } from '../../services/soft_delete_service';
import { invalidateCatalogEdgeCache } from '../../services/cache_service';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * Xác thực quyền quản trị Store & Inventory (Chấp nhận Scope STORE_FULL, STORE_PRODUCTS_FULL, ADMIN_FULL, FULL hoặc Master Admin Secret)
 */
async function authorizeStoreRequest(
  request: Request,
  env: Env
): Promise<{ authorized: boolean; keyRecord?: any; actor: string; error?: string }> {
  // 1. Kiểm tra Admin Cookie / Bearer JWT / Admin Sync Key
  const adminCheck = await verifyAdminAuth(request, env);
  if (adminCheck.authorized) {
    return {
      authorized: true,
      keyRecord: { id: 'admin_session', key_name: 'Quản Trị Viên (Admin Session)', scope: 'ADMIN_FULL' },
      actor: adminCheck.user?.username || 'Super Admin',
    };
  }

  // 2. Kiểm tra API Key từ Header (Authorization: Bearer <key>, X-Api-Key, X-Admin-Key, X-Sync-Key)
  if (env.DB) {
    const aiKeyCheck = await verifyAiKeyAuth(request, env.DB, env, 'STORE_FULL');
    if (aiKeyCheck.authorized && aiKeyCheck.keyRecord) {
      const scope = aiKeyCheck.keyRecord.scope;
      if (
        hasScope(scope, 'STORE_FULL') ||
        hasScope(scope, 'STORE_PRODUCTS_FULL') ||
        hasScope(scope, 'INVENTORY_FULL') ||
        hasScope(scope, 'ADMIN_FULL')
      ) {
        return {
          authorized: true,
          keyRecord: aiKeyCheck.keyRecord,
          actor: aiKeyCheck.keyRecord.key_name || 'Store API Key',
        };
      }
      return {
        authorized: false,
        actor: '',
        error: `Khóa API '${aiKeyCheck.keyRecord.key_name}' không có quyền STORE_FULL / STORE_PRODUCTS_FULL (Phạm vi hiện tại: ${scope || 'NONE'}).`,
      };
    }
    if (aiKeyCheck.error) {
      return { authorized: false, actor: '', error: aiKeyCheck.error };
    }
  }

  return {
    authorized: false,
    actor: '',
    error: 'Từ chối truy cập. Yêu cầu đính kèm header X-Api-Key hoặc Authorization: Bearer có quyền STORE_FULL hoặc STORE_PRODUCTS_FULL.',
  };
}

/**
 * Ghi nhật ký kiểm toán (Audit Log)
 */
async function logStoreAudit(
  db: D1Database | undefined,
  productId: string,
  productTitle: string,
  action: string,
  actor: string,
  details: string
) {
  if (!db) return;
  try {
    const id = `store_audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    await db
      .prepare(`
        INSERT INTO mission_audit_logs (id, mission_id, mission_title, submission_id, user_id, action, actor, details, created_at)
        VALUES (?, ?, ?, '', '', ?, ?, ?, ?)
      `)
      .bind(id, productId, productTitle, action, actor, details, nowIso)
      .run()
      .catch(() => {});
  } catch {}
}

/**
 * Chuẩn hóa danh sách mã code gửi lên (chấp nhận cả mảng chuỗi, mảng object, hoặc text nhiều dòng)
 */
function normalizeIncomingCodes(rawInput: any): string[] {
  if (!rawInput) return [];
  const set = new Set<string>();

  if (Array.isArray(rawInput)) {
    for (const item of rawInput) {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed) set.add(trimmed);
      } else if (item && typeof item === 'object') {
        const codeVal = String(item.code || item.code_content || item.codeValue || '').trim();
        if (codeVal) set.add(codeVal);
      }
    }
  } else if (typeof rawInput === 'string') {
    const lines = rawInput.split(/[\r\n,;]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) set.add(trimmed);
    }
  }

  return Array.from(set);
}

/**
 * Đồng bộ toàn diện vào wcg_admin_store_products_v4, wcg_master_state_v4 và làm sạch cache biên
 */
async function syncPublicStoreState(env: Env, context: any): Promise<void> {
  if (!env.DB) return;
  try {
    const freshProducts = await loadAllStoreProductsD1(env.DB);
    await setSettingD1(env.DB, 'wcg_admin_store_products_v4', freshProducts).catch(() => {});
    invalidateSettingMemoryCache('wcg_admin_store_products_v4');

    const currentMaster: any = (await getSettingD1(env.DB, 'wcg_master_state_v4', null, true).catch(() => null)) || {};
    currentMaster.storeProducts = freshProducts;
    currentMaster.timestamp = Date.now();
    await setSettingD1(env.DB, 'wcg_master_state_v4', currentMaster).catch(() => {});
    invalidateSettingMemoryCache('wcg_master_state_v4');

    // Xóa Edge Cache trên Cloudflare CDN
    invalidateCatalogEdgeCache(context, env, 'https://codegame.shop/api/sync');
  } catch {}
}

// =============================================================================
// GET HANDLER
// =============================================================================
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await authorizeStoreRequest(request, env);
  if (!auth.authorized) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  if (!env.DB) {
    return new Response(
      JSON.stringify({ success: false, error: 'Cơ sở dữ liệu D1 chưa được cấu hình.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  await ensureSchemaUpgrades(env.DB);
  const urlObj = new URL(request.url);
  const action = (urlObj.searchParams.get('action') || 'list_products').toLowerCase().trim();

  try {
    // 1. Thống kê tổng quan (Summary / Stats)
    if (action === 'summary' || action === 'stats') {
      const products = await loadAllStoreProductsD1(env.DB);
      const totalProducts = products.length;
      const activeProducts = products.filter((p) => p.is_active).length;

      const codeStatsRes: any = await env.DB.prepare(`
        SELECT 
          COUNT(*) AS total_codes,
          SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_codes,
          SUM(CASE WHEN status = 'SOLD' THEN 1 ELSE 0 END) AS sold_codes,
          SUM(CASE WHEN status = 'RESERVED' THEN 1 ELSE 0 END) AS reserved_codes
        FROM inventory_codes
        WHERE product_id NOT LIKE 'ut_%'
      `).first();

      return new Response(
        JSON.stringify({
          success: true,
          action: 'summary',
          summary: {
            total_products: totalProducts,
            active_products: activeProducts,
            total_codes: Number(codeStatsRes?.total_codes || 0),
            available_codes: Number(codeStatsRes?.available_codes || 0),
            sold_codes: Number(codeStatsRes?.sold_codes || 0),
            reserved_codes: Number(codeStatsRes?.reserved_codes || 0),
          },
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 2. Chi tiết một sản phẩm (Get Product)
    if (action === 'get_product' || action === 'product') {
      const id = String(urlObj.searchParams.get('id') || urlObj.searchParams.get('product_id') || '').trim();
      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu tham số id sản phẩm cần tra cứu.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const products = await loadAllStoreProductsD1(env.DB);
      const product = products.find((p) => p.id === id || p.sku === id);
      if (!product) {
        return new Response(
          JSON.stringify({ success: false, error: `Không tìm thấy gói sản phẩm có ID '${id}'.` }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      // Lấy 50 mã code tồn kho gần nhất
      const codesRes = await env.DB.prepare(`
        SELECT id, product_id, code_content, status, order_id, sold_at, created_at
        FROM inventory_codes
        WHERE product_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `).bind(id).all();

      return new Response(
        JSON.stringify({
          success: true,
          action: 'get_product',
          product,
          recent_codes: codesRes.results || [],
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 3. Danh sách mã code trong kho (List Codes)
    if (action === 'list_codes' || action === 'codes') {
      const productId = String(urlObj.searchParams.get('product_id') || urlObj.searchParams.get('sku') || urlObj.searchParams.get('id') || '').trim();
      const statusFilter = String(urlObj.searchParams.get('status') || 'ALL').toUpperCase().trim();
      const limit = Math.min(1000, Math.max(1, Number(urlObj.searchParams.get('limit')) || 100));
      const offset = Math.max(0, Number(urlObj.searchParams.get('offset')) || 0);

      let sql = 'SELECT id, product_id, code_content, status, order_id, sold_at, created_at FROM inventory_codes WHERE 1=1';
      const params: any[] = [];

      if (productId) {
        sql += ' AND product_id = ?';
        params.push(productId);
      }
      if (statusFilter && statusFilter !== 'ALL') {
        sql += ' AND status = ?';
        params.push(statusFilter);
      }

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const codesRes = await env.DB.prepare(sql).bind(...params).all();

      // Đếm tổng số bản ghi
      let countSql = 'SELECT COUNT(*) as total FROM inventory_codes WHERE 1=1';
      const countParams: any[] = [];
      if (productId) {
        countSql += ' AND product_id = ?';
        countParams.push(productId);
      }
      if (statusFilter && statusFilter !== 'ALL') {
        countSql += ' AND status = ?';
        countParams.push(statusFilter);
      }
      const countRes: any = await env.DB.prepare(countSql).bind(...countParams).first();

      return new Response(
        JSON.stringify({
          success: true,
          action: 'list_codes',
          product_id: productId || 'ALL',
          status_filter: statusFilter,
          total: Number(countRes?.total || 0),
          limit,
          offset,
          codes: codesRes.results || [],
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 4. Danh sách danh mục gói bán (List Categories)
    if (action === 'list_categories' || action === 'categories') {
      const cats = (await getSettingD1<any[]>(env.DB, 'wcg_admin_store_categories_v4', [])) || [];
      return new Response(
        JSON.stringify({ success: true, action: 'list_categories', categories: cats }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 5. Mặc định: Danh sách gói sản phẩm (List Products)
    const gameSlugFilter = String(urlObj.searchParams.get('game_slug') || '').trim().toLowerCase();
    const categoryFilter = String(urlObj.searchParams.get('category') || '').trim();
    const statusFilter = String(urlObj.searchParams.get('status') || 'ALL').toUpperCase().trim();

    let products = await loadAllStoreProductsD1(env.DB);

    if (gameSlugFilter) {
      products = products.filter((p) => String(p.game_slug || '').toLowerCase() === gameSlugFilter);
    }
    if (categoryFilter && categoryFilter !== 'ALL') {
      products = products.filter((p) => (p.category || p.package_type) === categoryFilter);
    }
    if (statusFilter === 'ACTIVE') {
      products = products.filter((p) => p.is_active === 1 || p.is_active === true);
    } else if (statusFilter === 'INACTIVE') {
      products = products.filter((p) => p.is_active === 0 || p.is_active === false);
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: 'list_products',
        total: products.length,
        products,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi khi xử lý yêu cầu GET Store API.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

// =============================================================================
// POST HANDLER (Tạo, Sửa, Xóa Gói Bán & Nạp / Xóa Mã Code Kho)
// =============================================================================
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await authorizeStoreRequest(request, env);
  if (!auth.authorized) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error || 'Unauthorized' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  if (!env.DB) {
    return new Response(
      JSON.stringify({ success: false, error: 'Cơ sở dữ liệu D1 chưa được cấu hình.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }

  await ensureSchemaUpgrades(env.DB);

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Dữ liệu JSON không hợp lệ.' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const action = String(body.action || '').toLowerCase().trim();
  if (!action) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Thiếu trường action bắt buộc. Các action hợp lệ: create_product, update_product, delete_product, import_codes, delete_codes, update_code_status, adjust_fomo.',
      }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    // -------------------------------------------------------------------------
    // ACTION: CREATE_PRODUCT (Tạo gói sản phẩm bán mới)
    // -------------------------------------------------------------------------
    if (action === 'create_product') {
      const title = String(body.title || '').trim();
      if (!title) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu tiêu đề gói sản phẩm (title).' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const gameSlug = String(body.game_slug || body.gameSlug || '').trim().toLowerCase();
      const gameName = String(body.game_name || body.gameName || title).trim();
      const currentPrice = Math.max(0, Number(body.current_price ?? body.currentPrice ?? body.price ?? 0));
      const originalPrice = Math.max(currentPrice, Number(body.original_price ?? body.originalPrice ?? currentPrice));
      const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;
      const category = String(body.category || body.package_type || 'pack').trim();
      const categoryLabel = String(body.category_label || body.categoryLabel || 'Gói nạp').trim();
      const badge = String(body.badge || '').trim();
      const description = String(body.description || '').trim();
      const coverImageUrl = String(body.cover_image_url || body.coverImageUrl || body.image || '').trim();
      const gameIconUrl = String(body.game_icon_url || body.gameIconUrl || coverImageUrl || `/game_icons/${gameSlug || 'default'}.webp`).trim();
      const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;
      const virtualSoldCount = Math.max(0, Number(body.virtual_sold_count ?? body.virtualSoldCount ?? 0));
      const showSoldCount = body.show_sold_count !== false ? 1 : 0;

      // Sinh ID định danh duy nhất cho sản phẩm
      const customId = String(body.id || body.product_id || '').trim();
      const cleanSlugPart = gameSlug ? gameSlug.replace(/[^a-z0-9]+/g, '-') : 'prod';
      const productId = customId || `sp_${cleanSlugPart}_${Date.now().toString(36)}`;

      const nowIso = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO store_products (
          id, title, game_slug, game_name, original_price, discount_percent, current_price,
          stock_quantity, sold_count, is_active, package_type, category, category_label,
          cover_image_url, game_icon_url, description, badge, virtual_sold_count, show_sold_count,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          game_slug = excluded.game_slug,
          game_name = excluded.game_name,
          original_price = excluded.original_price,
          discount_percent = excluded.discount_percent,
          current_price = excluded.current_price,
          is_active = excluded.is_active,
          package_type = excluded.package_type,
          category = excluded.category,
          category_label = excluded.category_label,
          cover_image_url = excluded.cover_image_url,
          game_icon_url = excluded.game_icon_url,
          description = excluded.description,
          badge = excluded.badge,
          virtual_sold_count = excluded.virtual_sold_count,
          show_sold_count = excluded.show_sold_count,
          updated_at = excluded.updated_at
      `).bind(
        productId,
        title,
        gameSlug,
        gameName,
        originalPrice,
        discountPercent,
        currentPrice,
        isActive,
        category,
        category,
        categoryLabel,
        coverImageUrl,
        gameIconUrl,
        description,
        badge,
        virtualSoldCount,
        showSoldCount,
        nowIso,
        nowIso
      ).run();

      // Cập nhật metadata mở rộng (guide_links, product_images...) vào setting wcg_admin_store_products_v4
      const existingMetaList = (await getSettingD1<any[]>(env.DB, 'wcg_admin_store_products_v4', [])) || [];
      const productMeta = {
        id: productId,
        title,
        game_slug: gameSlug,
        game_name: gameName,
        original_price: originalPrice,
        discount_percent: discountPercent,
        current_price: currentPrice,
        stock_quantity: 0,
        sold_count: 0,
        is_active: isActive === 1,
        package_type: category,
        category,
        category_label: categoryLabel,
        badge,
        description,
        cover_image_url: coverImageUrl,
        game_icon_url: gameIconUrl,
        product_images: Array.isArray(body.product_images) && body.product_images.length > 0 ? body.product_images : (coverImageUrl ? [coverImageUrl] : []),
        guide_links: Array.isArray(body.guide_links) ? body.guide_links : (body.guide_url ? [{ id: 'guide_1', text: body.guide_text || 'Xem hướng dẫn', url: body.guide_url }] : []),
        guide_url: body.guide_url || '',
        guide_text: body.guide_text || '',
        show_guide_link: body.show_guide_link !== false,
        virtual_sold_count: virtualSoldCount,
        show_sold_count: showSoldCount === 1,
        show_stock_count: body.show_stock_count !== false,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const metaIdx = existingMetaList.findIndex((m) => m && m.id === productId);
      if (metaIdx !== -1) {
        existingMetaList[metaIdx] = { ...existingMetaList[metaIdx], ...productMeta };
      } else {
        existingMetaList.unshift(productMeta);
      }
      await setSettingD1(env.DB, 'wcg_admin_store_products_v4', existingMetaList);

      // Nếu có kèm danh sách mã khởi tạo ban đầu (initial_codes)
      let initialCodesImported = 0;
      const initialCodes = normalizeIncomingCodes(body.initial_codes || body.codes);
      if (initialCodes.length > 0) {
        const insertStmts: D1PreparedStatement[] = [];
        for (const codeStr of initialCodes) {
          const codeId = `inv_${productId}_${encodeURIComponent(codeStr)}`;
          insertStmts.push(
            env.DB.prepare(`
              INSERT OR IGNORE INTO inventory_codes (id, product_id, code_content, status, created_at)
              VALUES (?, ?, ?, 'AVAILABLE', ?)
            `).bind(codeId, productId, codeStr, nowIso)
          );
        }
        if (insertStmts.length > 0) {
          await env.DB.batch(insertStmts);
          initialCodesImported = insertStmts.length;
        }
      }

      await syncProductStockCounter(env.DB, productId);
      await syncPublicStoreState(env, context);
      await logStoreAudit(env.DB, productId, title, 'CREATE_STORE_PRODUCT', auth.actor, `Tạo gói sản phẩm ${title} (${productId}) thành công. Nạp ${initialCodesImported} mã ban đầu.`);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'create_product',
          message: `Đã tạo gói sản phẩm '${title}' thành công!`,
          product: { ...productMeta, stock_quantity: initialCodesImported },
          initial_codes_imported: initialCodesImported,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: UPDATE_PRODUCT (Cập nhật gói sản phẩm)
    // -------------------------------------------------------------------------
    if (action === 'update_product') {
      const productId = String(body.id || body.product_id || '').trim();
      if (!productId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu ID gói sản phẩm cần cập nhật (id hoặc product_id).' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const existingRow: any = await env.DB.prepare('SELECT * FROM store_products WHERE id = ? LIMIT 1').bind(productId).first();
      if (!existingRow) {
        return new Response(
          JSON.stringify({ success: false, error: `Không tìm thấy gói sản phẩm có ID '${productId}'.` }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      const title = body.title !== undefined ? String(body.title).trim() : existingRow.title;
      const gameSlug = body.game_slug !== undefined ? String(body.game_slug).trim().toLowerCase() : existingRow.game_slug;
      const gameName = body.game_name !== undefined ? String(body.game_name).trim() : existingRow.game_name;
      const currentPrice = body.current_price !== undefined ? Math.max(0, Number(body.current_price)) : existingRow.current_price;
      const originalPrice = body.original_price !== undefined ? Math.max(currentPrice, Number(body.original_price)) : existingRow.original_price;
      const discountPercent = originalPrice > 0 ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;
      const category = body.category !== undefined ? String(body.category).trim() : existingRow.category;
      const categoryLabel = body.category_label !== undefined ? String(body.category_label).trim() : existingRow.category_label;
      const badge = body.badge !== undefined ? String(body.badge).trim() : existingRow.badge;
      const description = body.description !== undefined ? String(body.description).trim() : existingRow.description;
      const coverImageUrl = body.cover_image_url !== undefined ? String(body.cover_image_url).trim() : existingRow.cover_image_url;
      const gameIconUrl = body.game_icon_url !== undefined ? String(body.game_icon_url).trim() : existingRow.game_icon_url;
      const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : existingRow.is_active;
      const virtualSoldCount = body.virtual_sold_count !== undefined ? Math.max(0, Number(body.virtual_sold_count)) : existingRow.virtual_sold_count;
      const showSoldCount = body.show_sold_count !== undefined ? (body.show_sold_count ? 1 : 0) : existingRow.show_sold_count;

      const nowIso = new Date().toISOString();

      await env.DB.prepare(`
        UPDATE store_products SET
          title = ?,
          game_slug = ?,
          game_name = ?,
          original_price = ?,
          discount_percent = ?,
          current_price = ?,
          is_active = ?,
          package_type = ?,
          category = ?,
          category_label = ?,
          cover_image_url = ?,
          game_icon_url = ?,
          description = ?,
          badge = ?,
          virtual_sold_count = ?,
          show_sold_count = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(
        title,
        gameSlug,
        gameName,
        originalPrice,
        discountPercent,
        currentPrice,
        isActive,
        category,
        category,
        categoryLabel,
        coverImageUrl,
        gameIconUrl,
        description,
        badge,
        virtualSoldCount,
        showSoldCount,
        nowIso,
        productId
      ).run();

      // Cập nhật metadata setting
      const existingMetaList = (await getSettingD1<any[]>(env.DB, 'wcg_admin_store_products_v4', [])) || [];
      const metaIdx = existingMetaList.findIndex((m) => m && m.id === productId);
      const updatedMeta = {
        ...(metaIdx !== -1 ? existingMetaList[metaIdx] : {}),
        id: productId,
        title,
        game_slug: gameSlug,
        game_name: gameName,
        original_price: originalPrice,
        discount_percent: discountPercent,
        current_price: currentPrice,
        is_active: isActive === 1,
        package_type: category,
        category,
        category_label: categoryLabel,
        badge,
        description,
        cover_image_url: coverImageUrl,
        game_icon_url: gameIconUrl,
        product_images: body.product_images !== undefined ? body.product_images : (existingMetaList[metaIdx]?.product_images || [coverImageUrl]),
        guide_links: body.guide_links !== undefined ? body.guide_links : (existingMetaList[metaIdx]?.guide_links || []),
        guide_url: body.guide_url !== undefined ? body.guide_url : (existingMetaList[metaIdx]?.guide_url || ''),
        guide_text: body.guide_text !== undefined ? body.guide_text : (existingMetaList[metaIdx]?.guide_text || ''),
        show_guide_link: body.show_guide_link !== undefined ? Boolean(body.show_guide_link) : (existingMetaList[metaIdx]?.show_guide_link !== false),
        virtual_sold_count: virtualSoldCount,
        show_sold_count: showSoldCount === 1,
        show_stock_count: body.show_stock_count !== undefined ? Boolean(body.show_stock_count) : true,
        updated_at: nowIso,
      };

      if (metaIdx !== -1) {
        existingMetaList[metaIdx] = updatedMeta;
      } else {
        existingMetaList.push(updatedMeta);
      }
      await setSettingD1(env.DB, 'wcg_admin_store_products_v4', existingMetaList);

      await syncProductStockCounter(env.DB, productId);
      await syncPublicStoreState(env, context);
      await logStoreAudit(env.DB, productId, title, 'UPDATE_STORE_PRODUCT', auth.actor, `Cập nhật thông tin gói sản phẩm ${title} (${productId}).`);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'update_product',
          message: `Đã cập nhật gói sản phẩm '${title}' thành công!`,
          product: updatedMeta,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: DELETE_PRODUCT (Xóa gói sản phẩm)
    // -------------------------------------------------------------------------
    if (action === 'delete_product') {
      const productId = String(body.id || body.product_id || '').trim();
      if (!productId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu ID gói sản phẩm cần xóa (id hoặc product_id).' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const existingRow: any = await env.DB.prepare('SELECT title FROM store_products WHERE id = ? LIMIT 1').bind(productId).first();
      const productTitle = existingRow?.title || productId;

      // 1. Xóa trong D1 (xóa unsold codes, hard delete hoặc soft-delete nếu có FK orders)
      await deleteStoreProductD1(env.DB, productId);

      // 2. Ghi nhận Tombstone chống hồi sinh
      await recordSoftDelete(env.DB, 'store_product', productId);
      const delStoreList = (await getSettingD1<string[]>(env.DB, 'wcg_deleted_store_products', [])) || [];
      if (!delStoreList.includes(productId)) {
        delStoreList.push(productId);
        await setSettingD1(env.DB, 'wcg_deleted_store_products', delStoreList);
      }

      // 3. Xóa khỏi setting wcg_admin_store_products_v4
      const existingMetaList = (await getSettingD1<any[]>(env.DB, 'wcg_admin_store_products_v4', [])) || [];
      const filteredMeta = existingMetaList.filter((m) => m && m.id !== productId);
      await setSettingD1(env.DB, 'wcg_admin_store_products_v4', filteredMeta);

      await syncPublicStoreState(env, context);
      await logStoreAudit(env.DB, productId, productTitle, 'DELETE_STORE_PRODUCT', auth.actor, `Đã xóa gói sản phẩm ${productTitle} (${productId}) và toàn bộ mã tồn kho.`);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'delete_product',
          product_id: productId,
          message: `Đã xóa thành công gói sản phẩm '${productTitle}' khỏi sàn!`,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: IMPORT_CODES / ADD_CODES (Nạp kho mã code bán)
    // -------------------------------------------------------------------------
    if (action === 'import_codes' || action === 'add_codes') {
      const productId = String(body.product_id || body.sku || body.id || '').trim();
      if (!productId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu product_id (hoặc sku) của gói sản phẩm cần nạp mã code.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const productRow: any = await env.DB.prepare('SELECT title FROM store_products WHERE id = ? LIMIT 1').bind(productId).first();
      if (!productRow) {
        return new Response(
          JSON.stringify({ success: false, error: `Gói sản phẩm '${productId}' không tồn tại trên hệ thống.` }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      const incomingCodes = normalizeIncomingCodes(body.codes || body.codes_text || body.code_list);
      if (incomingCodes.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Danh sách mã code rỗng hoặc không hợp lệ. Vui lòng gửi mảng chuỗi mã (codes) hoặc chuỗi text (codes_text).' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Lấy danh sách mã đã có trong kho của sản phẩm này để lọc trùng
      const existingCodesRes = await env.DB.prepare(`
        SELECT code_content FROM inventory_codes WHERE product_id = ?
      `).bind(productId).all();
      const existingSet = new Set((existingCodesRes.results || []).map((r: any) => String(r.code_content).trim().toUpperCase()));

      const nowIso = new Date().toISOString();
      const toInsert: string[] = [];
      let duplicateCount = 0;

      for (const c of incomingCodes) {
        if (existingSet.has(c.toUpperCase())) {
          duplicateCount++;
        } else {
          toInsert.push(c);
          existingSet.add(c.toUpperCase());
        }
      }

      let insertedCount = 0;
      const BATCH_SIZE = 50;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const slice = toInsert.slice(i, i + BATCH_SIZE);
        const stmts: D1PreparedStatement[] = [];
        for (const codeStr of slice) {
          const itemId = `inv_${productId}_${encodeURIComponent(codeStr)}`;
          stmts.push(
            env.DB.prepare(`
              INSERT INTO inventory_codes (id, product_id, code_content, status, created_at)
              VALUES (?, ?, ?, 'AVAILABLE', ?)
              ON CONFLICT(id) DO UPDATE SET
                status = CASE WHEN inventory_codes.status = 'SOLD' THEN 'SOLD' ELSE 'AVAILABLE' END
            `).bind(itemId, productId, codeStr, nowIso)
          );
        }
        if (stmts.length > 0) {
          await env.DB.batch(stmts);
          insertedCount += stmts.length;
        }
      }

      await syncProductStockCounter(env.DB, productId);
      await syncPublicStoreState(env, context);

      // Lấy lại tồn kho mới nhất
      const updatedProduct: any = await env.DB.prepare('SELECT stock_quantity, sold_count FROM store_products WHERE id = ?').bind(productId).first();
      const newStock = Number(updatedProduct?.stock_quantity || 0);

      await logStoreAudit(
        env.DB,
        productId,
        productRow.title,
        'IMPORT_INVENTORY_CODES',
        auth.actor,
        `Nạp thành công ${insertedCount} mã code mới vào gói '${productRow.title}'. Bỏ qua ${duplicateCount} mã trùng lặp. Tồn kho mới: ${newStock}.`
      );

      return new Response(
        JSON.stringify({
          success: true,
          action: 'import_codes',
          product_id: productId,
          product_title: productRow.title,
          imported_count: insertedCount,
          duplicate_ignored_count: duplicateCount,
          total_stock_now: newStock,
          message: `Nạp thành công ${insertedCount} mã code vào kho của gói '${productRow.title}'! (Bỏ qua ${duplicateCount} mã trùng lặp)`,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: DELETE_CODES (Xóa lẻ mã code hoặc xóa hàng loạt mã chưa bán)
    // -------------------------------------------------------------------------
    if (action === 'delete_codes') {
      const productId = String(body.product_id || body.sku || '').trim();
      const codeIds = Array.isArray(body.code_ids) ? body.code_ids : [];
      const codes = Array.isArray(body.codes) ? body.codes : (typeof body.code === 'string' ? [body.code] : []);
      const deleteAllUnsold = Boolean(body.delete_all_unsold);

      let deletedCount = 0;

      if (deleteAllUnsold && productId) {
        const delRes: any = await env.DB.prepare(`
          DELETE FROM inventory_codes WHERE product_id = ? AND status != 'SOLD'
        `).bind(productId).run();
        deletedCount = delRes?.meta?.changes || 0;
      } else if (codeIds.length > 0) {
        await deleteInventoryCodesD1(env.DB, codeIds);
        deletedCount = codeIds.length;
      } else if (codes.length > 0) {
        const BATCH_SIZE = 50;
        for (let i = 0; i < codes.length; i += BATCH_SIZE) {
          const slice = codes.slice(i, i + BATCH_SIZE);
          const placeholders = slice.map(() => '?').join(',');
          const query = productId
            ? `DELETE FROM inventory_codes WHERE product_id = ? AND code_content IN (${placeholders}) AND status != 'SOLD'`
            : `DELETE FROM inventory_codes WHERE code_content IN (${placeholders}) AND status != 'SOLD'`;
          const bindParams = productId ? [productId, ...slice] : slice;
          const res: any = await env.DB.prepare(query).bind(...bindParams).run();
          deletedCount += res?.meta?.changes || 0;
        }
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Vui lòng cung cấp danh sách code_ids, danh sách codes hoặc delete_all_unsold: true kèm product_id.',
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (productId) {
        await syncProductStockCounter(env.DB, productId);
      } else {
        await syncProductStockCounter(env.DB);
      }
      await syncPublicStoreState(env, context);

      await logStoreAudit(
        env.DB,
        productId || 'MULTIPLE',
        'Kho Code Bán',
        'DELETE_INVENTORY_CODES',
        auth.actor,
        `Đã xóa ${deletedCount} mã code chưa bán khỏi kho.`
      );

      return new Response(
        JSON.stringify({
          success: true,
          action: 'delete_codes',
          deleted_count: deletedCount,
          product_id: productId || null,
          message: `Đã xóa thành công ${deletedCount} mã code khỏi kho!`,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: UPDATE_CODE_STATUS (Cập nhật trạng thái mã: AVAILABLE, RESERVED, SOLD)
    // -------------------------------------------------------------------------
    if (action === 'update_code_status') {
      const codeId = String(body.code_id || body.id || '').trim();
      const codeContent = String(body.code || body.code_content || '').trim();
      const newStatus = String(body.status || '').toUpperCase().trim();

      if (!['AVAILABLE', 'RESERVED', 'SOLD'].includes(newStatus)) {
        return new Response(
          JSON.stringify({ success: false, error: "Trạng thái mới không hợp lệ. Chỉ chấp nhận 'AVAILABLE', 'RESERVED' hoặc 'SOLD'." }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      let targetRow: any = null;
      if (codeId) {
        targetRow = await env.DB.prepare('SELECT id, product_id, status FROM inventory_codes WHERE id = ? LIMIT 1').bind(codeId).first();
      } else if (codeContent) {
        targetRow = await env.DB.prepare('SELECT id, product_id, status FROM inventory_codes WHERE code_content = ? LIMIT 1').bind(codeContent).first();
      }

      if (!targetRow) {
        return new Response(
          JSON.stringify({ success: false, error: 'Không tìm thấy mã code cần cập nhật trạng thái.' }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      await env.DB.prepare(`
        UPDATE inventory_codes SET status = ? WHERE id = ?
      `).bind(newStatus, targetRow.id).run();

      await syncProductStockCounter(env.DB, targetRow.product_id);
      await syncPublicStoreState(env, context);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'update_code_status',
          code_id: targetRow.id,
          product_id: targetRow.product_id,
          previous_status: targetRow.status,
          new_status: newStatus,
          message: `Đã đổi trạng thái mã code sang '${newStatus}' thành công!`,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: ADJUST_FOMO (Điều chỉnh số đo ảo & cấu hình hiển thị FOMO)
    // -------------------------------------------------------------------------
    if (action === 'adjust_fomo') {
      const productId = String(body.id || body.product_id || '').trim();
      if (!productId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu ID gói sản phẩm cần chỉnh số đo FOMO.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const virtualSoldCount = body.virtual_sold_count !== undefined ? Math.max(0, Number(body.virtual_sold_count)) : undefined;
      const showSoldCount = body.show_sold_count !== undefined ? (body.show_sold_count ? 1 : 0) : undefined;
      const showStockCount = body.show_stock_count !== undefined ? Boolean(body.show_stock_count) : undefined;

      const updates: string[] = [];
      const params: any[] = [];
      if (virtualSoldCount !== undefined) {
        updates.push('virtual_sold_count = ?');
        params.push(virtualSoldCount);
      }
      if (showSoldCount !== undefined) {
        updates.push('show_sold_count = ?');
        params.push(showSoldCount);
      }
      if (updates.length > 0) {
        params.push(productId);
        await env.DB.prepare(`UPDATE store_products SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
      }

      // Cập nhật metadata
      const existingMetaList = (await getSettingD1<any[]>(env.DB, 'wcg_admin_store_products_v4', [])) || [];
      const metaIdx = existingMetaList.findIndex((m) => m && m.id === productId);
      if (metaIdx !== -1) {
        if (virtualSoldCount !== undefined) existingMetaList[metaIdx].virtual_sold_count = virtualSoldCount;
        if (showSoldCount !== undefined) existingMetaList[metaIdx].show_sold_count = showSoldCount === 1;
        if (showStockCount !== undefined) existingMetaList[metaIdx].show_stock_count = showStockCount;
        await setSettingD1(env.DB, 'wcg_admin_store_products_v4', existingMetaList);
      }

      await syncPublicStoreState(env, context);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'adjust_fomo',
          product_id: productId,
          virtual_sold_count: virtualSoldCount,
          show_sold_count: showSoldCount,
          show_stock_count: showStockCount,
          message: 'Đã cập nhật các chỉ số FOMO thành công!',
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // -------------------------------------------------------------------------
    // ACTION: RECONCILE_MEMBER_BALANCE (Điều chỉnh & chuẩn hóa số dư ví thành viên)
    // -------------------------------------------------------------------------
    if (action === 'reconcile_member_balance') {
      const email = String(body.email || body.member_email || '').trim().toLowerCase();
      const memberId = String(body.member_id || body.memberId || body.userId || '').trim();
      const newBal = Number(body.balance ?? body.wallet_balance);
      const totalSpent = body.total_spent !== undefined ? Number(body.total_spent) : undefined;

      if (!email && !memberId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Thiếu email hoặc member_id cần điều chỉnh.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (isNaN(newBal) || newBal < 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Số dư mới không hợp lệ.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const member = await env.DB.prepare(
        'SELECT id, username, email, balance, total_spent FROM members WHERE email = ? COLLATE NOCASE OR id = ? LIMIT 1'
      ).bind(email || memberId, memberId || email).first<any>();

      if (!member) {
        return new Response(
          JSON.stringify({ success: false, error: 'Không tìm thấy thành viên trong cơ sở dữ liệu.' }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      const stmts: D1PreparedStatement[] = [];
      if (totalSpent !== undefined) {
        stmts.push(env.DB.prepare('UPDATE members SET balance = ?, total_spent = ? WHERE id = ?').bind(newBal, totalSpent, member.id));
      } else {
        stmts.push(env.DB.prepare('UPDATE members SET balance = ? WHERE id = ?').bind(newBal, member.id));
      }

      // Chuẩn hóa timestamp của các transaction của member này sang ISO 8601 UTC
      const allTxRes = await env.DB.prepare(
        'SELECT id, created_at, type, amount, balance_before, balance_after FROM wallet_transactions WHERE member_id = ?'
      ).bind(member.id).all<any>();

      for (const t of (allTxRes.results || [])) {
        const rawTime = String(t.created_at || '');
        if (rawTime && !rawTime.includes('T')) {
          const isoTime = rawTime.replace(' ', 'T') + '.000Z';
          stmts.push(env.DB.prepare('UPDATE wallet_transactions SET created_at = ? WHERE id = ?').bind(isoTime, t.id));
        }
      }

      // Nếu có cập nhật cụ thể cho transaction thứ 2 của đơn 1 Core
      if (body.update_tx_id && body.tx_balance_before !== undefined && body.tx_balance_after !== undefined) {
        stmts.push(env.DB.prepare(
          'UPDATE wallet_transactions SET balance_before = ?, balance_after = ? WHERE id = ?'
        ).bind(Number(body.tx_balance_before), Number(body.tx_balance_after), String(body.update_tx_id)));
      }

      await env.DB.batch(stmts);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'reconcile_member_balance',
          member_id: member.id,
          email: member.email,
          previous_balance: member.balance,
          new_balance: newBal,
          total_spent: totalSpent !== undefined ? totalSpent : member.total_spent,
          message: 'Đã chuẩn hóa số dư và toàn bộ nhật ký giao dịch của thành viên thành công!',
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: `Action '${action}' không được hỗ trợ. Các action hợp lệ: create_product, update_product, delete_product, import_codes, delete_codes, update_code_status, adjust_fomo, reconcile_member_balance.`,
      }),
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi khi xử lý thao tác Store API.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
