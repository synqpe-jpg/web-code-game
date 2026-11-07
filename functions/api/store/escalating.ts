import {
  ensureSchemaUpgrades,
  getEscalatingPriceD1,
  resetEscalatingPriceD1,
  getEscalatingPurchasesHistoryD1,
} from '../../services/d1_service';
import { verifyAdminAuth } from '../../services/mission_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
  MASTER_SYSTEM_KEYS?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    const url = new URL(request.url);
    const pathname = url.pathname;
    const productId = (url.searchParams.get('product_id') || url.searchParams.get('productId') || '').trim();
    const gameSlug = (url.searchParams.get('game') || '').trim();

    // 1. Phân nhánh: Quản trị Admin (/api/admin/escalating/*)
    if (pathname.includes('/admin/')) {
      const adminCheck = await verifyAdminAuth(request, env as any, 'ESCALATING_MANAGE');
      if (!adminCheck.authorized) {
        return new Response(
          JSON.stringify({ success: false, message: adminCheck.error || 'Yêu cầu quyền Quản trị viên.' }),
          { status: 401, headers: CORS_HEADERS }
        );
      }

      // 1a. Danh sách toàn bộ các gói đang bật Nâng Giá (/api/admin/escalating/packages)
      if (pathname === '/api/admin/escalating/packages' || pathname.endsWith('/escalating/packages')) {
        const prodsRes = await env.DB.prepare(
          "SELECT id, title, game_slug, game_name, current_price, original_price, sale_mode, escalating_base_price, escalating_step, escalating_max_price, stock_quantity FROM store_products WHERE sale_mode = 'escalating' AND is_active = 1 ORDER BY game_slug ASC, id ASC"
        ).all<any>();

        const rows = prodsRes.results || [];
        const packages = [];

        for (const prod of rows) {
          const epInfo = await getEscalatingPriceD1(env.DB, prod);
          packages.push({
            id: prod.id,
            title: prod.title,
            game_slug: prod.game_slug,
            game_name: prod.game_name,
            escalating_base_price: epInfo.escalating_base_price ?? epInfo.base_price,
            escalating_step: epInfo.escalating_step ?? epInfo.step,
            escalating_max_price: epInfo.escalating_max_price ?? epInfo.max_price,
            completed_count: epInfo.completed_count,
            current_price: epInfo.current_price,
            next_price: epInfo.next_price,
            stock_quantity: prod.stock_quantity,
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            count: packages.length,
            packages,
          }),
          { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache, no-store' } }
        );
      }

      // 1b. Lịch sử mua hàng theo thang giá (/api/admin/escalating/history)
      if (!productId) {
        return new Response(
          JSON.stringify({ success: false, message: 'Vui lòng cung cấp product_id để xem lịch sử.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Lấy thông tin sản phẩm
      const product = await env.DB.prepare(
        'SELECT id, title, game_slug, game_name, current_price, sale_mode, escalating_base_price, escalating_step, escalating_max_price, stock_quantity FROM store_products WHERE id = ? LIMIT 1'
      ).bind(productId).first<any>();

      if (!product) {
        return new Response(
          JSON.stringify({ success: false, message: 'Không tìm thấy gói sản phẩm.' }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      const epInfo = await getEscalatingPriceD1(env.DB, product);
      const history = await getEscalatingPurchasesHistoryD1(env.DB, productId);

      return new Response(
        JSON.stringify({
          success: true,
          product,
          escalating_info: epInfo,
          history,
        }),
        { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache, no-store' } }
      );
    }

    // 2. Tra cứu công khai giá Nâng Giá cho khách hàng (/api/store/escalating)
    if (productId) {
      const product = await env.DB.prepare(
        'SELECT id, title, game_slug, game_name, current_price, sale_mode, escalating_base_price, escalating_step, escalating_max_price, stock_quantity FROM store_products WHERE id = ? LIMIT 1'
      ).bind(productId).first<any>();

      if (!product) {
        return new Response(
          JSON.stringify({ success: false, message: 'Không tìm thấy gói sản phẩm.' }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      const epInfo = await getEscalatingPriceD1(env.DB, product);
      return new Response(
        JSON.stringify({
          success: true,
          escalating: epInfo,
        }),
        { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache, no-store' } }
      );
    }

    if (gameSlug) {
      const prodsRes = await env.DB.prepare(
        'SELECT id, title, game_slug, game_name, current_price, sale_mode, escalating_base_price, escalating_step, escalating_max_price, stock_quantity FROM store_products WHERE game_slug = ? AND is_active = 1'
      ).bind(gameSlug).all<any>();

      const rows = prodsRes.results || [];
      const escalatingMap: Record<string, any> = {};

      for (const prod of rows) {
        escalatingMap[prod.id] = await getEscalatingPriceD1(env.DB, prod);
      }

      return new Response(
        JSON.stringify({
          success: true,
          game_slug: gameSlug,
          escalating_offers: escalatingMap,
        }),
        { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache, no-store' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: 'Yêu cầu tham số product_id hoặc game.' }),
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: 'Lỗi tra cứu Nâng Giá: ' + (err?.message || 'Không xác định') }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    // Xác thực quyền Quản trị viên
    const adminCheck = await verifyAdminAuth(request, env as any, 'STORE_FULL');
    if (!adminCheck.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: adminCheck.error || 'Yêu cầu quyền Quản trị viên để đặt lại thang giá.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body: any = await request.json().catch(() => ({}));
    const { productId, reason } = body || {};

    if (!productId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Vui lòng cung cấp productId cần đặt lại thang giá.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const product = await env.DB.prepare(
      'SELECT id, title, sale_mode, escalating_base_price, escalating_step FROM store_products WHERE id = ? LIMIT 1'
    ).bind(productId).first<any>();

    if (!product) {
      return new Response(
        JSON.stringify({ success: false, message: 'Gói sản phẩm không tồn tại.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const result = await resetEscalatingPriceD1(env.DB, {
      productId,
      adminId: adminCheck.user?.id || 'admin',
      adminName: adminCheck.user?.displayName || adminCheck.user?.username || 'Quản trị viên',
      reason: (reason || '').trim() || 'Quản trị viên đặt lại thang giá gói về ban đầu',
    });

    // Lấy lại thông số sau khi reset
    const updatedEpInfo = await getEscalatingPriceD1(env.DB, product);

    return new Response(
      JSON.stringify({
        success: true,
        message: result.message,
        previous_count: result.previous_count,
        reset_at: result.reset_at,
        escalating_info: updatedEpInfo,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: 'Lỗi đặt lại thang giá: ' + (err?.message || 'Không xác định') }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
