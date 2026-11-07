import {
  ensureSchemaUpgrades,
  getFirstPurchaseConfigD1,
  FirstPurchaseConfig,
} from '../../services/d1_service';
import { verifyAdminAuth } from '../../services/mission_service';

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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

async function authenticateAdmin(request: Request, env: Env): Promise<{ authorized: boolean; user?: any; error?: string }> {
  const adminCheck = await verifyAdminAuth(request, env as any, 'FIRST_PURCHASE_MANAGE');
  if (adminCheck.authorized) {
    return {
      authorized: true,
      user: {
        id: adminCheck.adminId || 'usr_admin',
        username: adminCheck.adminName || 'Admin',
        email: 'admin@codegame.shop',
        role: 'SUPER_ADMIN',
      },
    };
  }
  return { authorized: false, error: adminCheck.error || 'Yêu cầu quyền Quản trị viên (ADMIN hoặc SUPER_ADMIN).' };
}

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

    const auth = await authenticateAdmin(request, env);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: auth.error || 'Truy cập bị từ chối.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const config = await getFirstPurchaseConfigD1(env.DB);

    // 1. Thống kê tổng quan (Metrics)
    const statsRow = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_used,
        COALESCE(SUM(discount_amount), 0) as total_discount,
        COALESCE(SUM(CASE WHEN created_at >= date('now', 'start of day') THEN 1 ELSE 0 END), 0) as today_used
      FROM orders
      WHERE discount_type = 'first_purchase' AND status = 'COMPLETED'
    `).first<any>();

    const totalUsed = Number(statsRow?.total_used) || 0;
    const totalDiscount = Number(statsRow?.total_discount) || 0;
    const todayUsed = Number(statsRow?.today_used) || 0;

    // Tỉ lệ tài khoản mới trong 7 ngày dùng ưu đãi
    const newMembersRow = await env.DB.prepare(`
      SELECT COUNT(DISTINCT o.member_id) as new_user_orders
      FROM orders o
      JOIN members m ON o.member_id = m.id
      WHERE o.discount_type = 'first_purchase' AND o.status = 'COMPLETED'
        AND m.created_at >= datetime('now', '-7 days')
    `).first<any>();
    const newUserOrders = Number(newMembersRow?.new_user_orders) || 0;
    const newMembersRatio = totalUsed > 0 ? Math.round((newUserOrders / totalUsed) * 100) : 0;

    // 2. Danh sách lượt đã dùng ưu đãi gần nhất (tối đa 100 đơn)
    const usedListRes = await env.DB.prepare(`
      SELECT 
        o.id as order_id,
        o.member_id,
        o.buyer_email,
        o.product_id,
        o.product_title,
        o.quantity,
        o.unit_price,
        o.original_price,
        o.price_paid,
        o.discount_amount,
        o.created_at,
        m.display_name,
        m.username
      FROM orders o
      LEFT JOIN members m ON o.member_id = m.id
      WHERE o.discount_type = 'first_purchase' AND o.status = 'COMPLETED'
      ORDER BY o.created_at DESC
      LIMIT 100;
    `).all<any>();

    // 3. Lịch sử đặt lại ưu đãi (first_purchase_resets)
    const resetsListRes = await env.DB.prepare(`
      SELECT 
        r.id,
        r.member_id,
        r.product_id,
        r.admin_id,
        r.admin_username,
        r.reason,
        r.reset_at,
        m.email as member_email,
        p.title as product_title
      FROM first_purchase_resets r
      LEFT JOIN members m ON r.member_id = m.id
      LEFT JOIN store_products p ON r.product_id = p.id
      ORDER BY r.reset_at DESC
      LIMIT 50;
    `).all<any>();

    // 4. Cảnh báo nghi vấn IP (nhiều tài khoản dùng ưu đãi trên cùng 1 IP trong 7 ngày)
    const ipAlertsRes = await env.DB.prepare(`
      SELECT 
        m.registered_ip as ip_address,
        COUNT(DISTINCT o.member_id) as account_count,
        COUNT(o.id) as order_count,
        GROUP_CONCAT(DISTINCT o.buyer_email) as sample_emails
      FROM orders o
      JOIN members m ON o.member_id = m.id
      WHERE o.discount_type = 'first_purchase' AND o.status = 'COMPLETED'
        AND m.registered_ip IS NOT NULL AND m.registered_ip != ''
      GROUP BY m.registered_ip
      HAVING account_count >= 2
      ORDER BY account_count DESC, order_count DESC
      LIMIT 15;
    `).all<any>();

    const excludedList = config.excluded_products || config.excluded_product_ids || [];

    return new Response(
      JSON.stringify({
        success: true,
        // Top-level configuration fields according to API specifications
        enabled: Boolean(config.enabled),
        offer_price: Number(config.offer_price) || 2000,
        max_original_price: config.max_original_price !== undefined ? config.max_original_price : null,
        require_verified_email: Boolean(config.require_verified_email),
        excluded_product_ids: excludedList,
        updated_at: config.updated_at || new Date().toISOString(),
        updated_by: config.updated_by || 'admin',
        // Backward-compatibility object for FirstPurchaseModule admin UI
        config: {
          ...config,
          excluded_products: excludedList,
          excluded_product_ids: excludedList,
        },
        metrics: {
          total_used_count: totalUsed,
          total_discount_core: totalDiscount,
          today_used_count: todayUsed,
          new_members_ratio_percent: newMembersRatio,
        },
        used_orders: usedListRes.results || [],
        reset_logs: resetsListRes.results || [],
        ip_alerts: ipAlertsRes.results || [],
      }),
      { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Lỗi nạp dữ liệu quản trị ưu đãi: ' + (err?.message || 'Không xác định'),
      }),
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

    const auth = await authenticateAdmin(request, env);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: auth.error || 'Truy cập bị từ chối.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const body: any = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    // ACTION 1: ĐẶT LẠI ƯU ĐÃI (RESET OFFER) CHO 1 TÀI KHOẢN & 1 GÓI CỤ THỂ
    if (action === 'reset_offer') {
      const { memberId, memberEmail, productId, reason } = body || {};

      if (!productId || (!memberId && !memberEmail)) {
        return new Response(
          JSON.stringify({ success: false, message: 'Thiếu thông tin tài khoản hoặc mã gói cần đặt lại.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Tra cứu member chuẩn xác
      let targetMember: any = null;
      if (memberId) {
        targetMember = await env.DB.prepare('SELECT id, email, username FROM members WHERE id = ? LIMIT 1').bind(memberId).first<any>();
      }
      if (!targetMember && memberEmail) {
        targetMember = await env.DB.prepare('SELECT id, email, username FROM members WHERE LOWER(email) = LOWER(?) LIMIT 1').bind(memberEmail).first<any>();
      }

      if (!targetMember) {
        return new Response(
          JSON.stringify({ success: false, message: 'Không tìm thấy tài khoản thành viên.' }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      const resetReason = String(reason || 'Quản trị viên đặt lại quyền ưu đãi hỗ trợ khách hàng').trim();
      const resetId = 'rst_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      const nowIso = new Date().toISOString();
      const adminId = auth.user.id || 'admin';
      const adminUsername = auth.user.username || auth.user.display_name || 'Admin';

      // Ghi bản ghi reset
      await env.DB.prepare(`
        INSERT INTO first_purchase_resets (id, member_id, product_id, admin_id, admin_username, reason, reset_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(resetId, targetMember.id, productId, adminId, adminUsername, resetReason, nowIso).run();

      // Ghi audit log vào security_logs
      const logId = 'sec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      await env.DB.prepare(`
        INSERT INTO security_logs (id, actor_name, actor_email, action, target_id, ip_address, severity, details, created_at)
        VALUES (?, ?, ?, 'RESET_FIRST_PURCHASE_OFFER', ?, ?, 'WARN', ?, ?)
      `).bind(
        logId,
        adminUsername,
        auth.user.email || 'admin@codegame.shop',
        targetMember.id,
        request.headers.get('cf-connecting-ip') || '127.0.0.1',
        JSON.stringify({
          member_id: targetMember.id,
          member_email: targetMember.email,
          product_id: productId,
          reason: resetReason,
        }),
        nowIso
      ).run().catch(() => {});

      return new Response(
        JSON.stringify({
          success: true,
          message: `Đã đặt lại ưu đãi mua lần đầu cho tài khoản ${targetMember.email} với gói ${productId}.`,
          reset: {
            id: resetId,
            member_id: targetMember.id,
            member_email: targetMember.email,
            product_id: productId,
            reason: resetReason,
            reset_at: nowIso,
          },
        }),
        { headers: CORS_HEADERS }
      );
    }

    // ACTION 2: CẬP NHẬT CẤU HÌNH CHIẾN DỊCH (Hỗ trợ cả partial update trực tiếp và action === 'update_config')
    const currentConfig = await getFirstPurchaseConfigD1(env.DB);
    const incoming = (body && typeof body.config === 'object' && body.config !== null) ? body.config : body;

    let newEnabled = currentConfig.enabled;
    if (incoming.enabled !== undefined) {
      newEnabled = Boolean(incoming.enabled);
    }

    let newOfferPrice = currentConfig.offer_price;
    if (incoming.offer_price !== undefined) {
      const parsedOffer = Number(incoming.offer_price);
      if (isNaN(parsedOffer) || parsedOffer <= 0) {
        return new Response(
          JSON.stringify({ success: false, message: 'offer_price phải là số dương lớn hơn 0.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
      newOfferPrice = Math.floor(parsedOffer);
    }

    let newMaxOriginalPrice = currentConfig.max_original_price;
    if (incoming.max_original_price !== undefined) {
      if (incoming.max_original_price === null || incoming.max_original_price === '' || incoming.max_original_price === 'null') {
        newMaxOriginalPrice = null;
      } else {
        const parsedMax = Number(incoming.max_original_price);
        if (isNaN(parsedMax) || parsedMax <= newOfferPrice) {
          return new Response(
            JSON.stringify({ success: false, message: `max_original_price phải lớn hơn offer_price (${newOfferPrice} Core) hoặc để null.` }),
            { status: 400, headers: CORS_HEADERS }
          );
        }
        newMaxOriginalPrice = Math.floor(parsedMax);
      }
    }

    let newRequireVerifiedEmail = currentConfig.require_verified_email;
    if (incoming.require_verified_email !== undefined) {
      newRequireVerifiedEmail = Boolean(incoming.require_verified_email);
    }

    let newExcludedProducts = currentConfig.excluded_products || [];
    const rawExcluded = incoming.excluded_product_ids !== undefined ? incoming.excluded_product_ids : incoming.excluded_products;
    if (rawExcluded !== undefined) {
      if (Array.isArray(rawExcluded)) {
        newExcludedProducts = rawExcluded.map((s) => String(s).trim()).filter(Boolean);
      } else if (typeof rawExcluded === 'string') {
        newExcludedProducts = rawExcluded.split('\n').map((s) => s.trim()).filter(Boolean);
      } else {
        return new Response(
          JSON.stringify({ success: false, message: 'excluded_product_ids phải là mảng chuỗi ID hợp lệ.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    const nowIso = new Date().toISOString();
    const actorName = auth.user.username || auth.user.display_name || 'admin';
    const actorEmail = auth.user.email || 'admin@codegame.shop';

    const updatedConfig: FirstPurchaseConfig = {
      enabled: newEnabled,
      offer_price: newOfferPrice,
      max_original_price: newMaxOriginalPrice,
      excluded_products: newExcludedProducts,
      excluded_product_ids: newExcludedProducts,
      require_verified_email: newRequireVerifiedEmail,
      updated_at: nowIso,
      updated_by: actorName,
    };

    await env.DB.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('wcg_first_purchase_config_v1', ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at;
    `).bind(JSON.stringify(updatedConfig), nowIso).run();

    // Ghi audit log vào security_logs
    const logId = 'sec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    await env.DB.prepare(`
      INSERT INTO security_logs (id, actor_name, actor_email, action, target_id, ip_address, severity, details, created_at)
      VALUES (?, ?, ?, 'UPDATE_FIRST_PURCHASE_CONFIG', 'system_settings', ?, 'INFO', ?, ?)
    `).bind(
      logId,
      actorName,
      actorEmail,
      request.headers.get('cf-connecting-ip') || '127.0.0.1',
      JSON.stringify({
        previous: currentConfig,
        updated: updatedConfig,
        changes: {
          enabled: newEnabled !== currentConfig.enabled ? { from: currentConfig.enabled, to: newEnabled } : undefined,
          offer_price: newOfferPrice !== currentConfig.offer_price ? { from: currentConfig.offer_price, to: newOfferPrice } : undefined,
          max_original_price: newMaxOriginalPrice !== currentConfig.max_original_price ? { from: currentConfig.max_original_price, to: newMaxOriginalPrice } : undefined,
          require_verified_email: newRequireVerifiedEmail !== currentConfig.require_verified_email ? { from: currentConfig.require_verified_email, to: newRequireVerifiedEmail } : undefined,
          excluded_products: newExcludedProducts !== currentConfig.excluded_products ? { count: newExcludedProducts.length } : undefined,
        },
      }),
      nowIso
    ).run().catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cập nhật cấu hình chiến dịch ưu đãi mua lần đầu thành công.',
        enabled: updatedConfig.enabled,
        offer_price: updatedConfig.offer_price,
        max_original_price: updatedConfig.max_original_price,
        require_verified_email: updatedConfig.require_verified_email,
        excluded_product_ids: updatedConfig.excluded_products,
        updated_at: updatedConfig.updated_at,
        updated_by: updatedConfig.updated_by,
        config: updatedConfig,
      }),
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Lỗi thực thi quản trị ưu đãi: ' + (err?.message || 'Không xác định'),
      }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
