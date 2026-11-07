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

    return new Response(
      JSON.stringify({
        success: true,
        config,
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

    // ACTION 1: CẬP NHẬT CẤU HÌNH CHIẾN DỊCH
    if (action === 'update_config') {
      const {
        enabled,
        offer_price = 2000,
        max_original_price = null,
        excluded_products = ['sp_1793943215070_fxm', 'BỘ CODE'],
        require_verified_email = true,
      } = body?.config || {};

      const nowIso = new Date().toISOString();
      const newConfig: FirstPurchaseConfig = {
        enabled: Boolean(enabled),
        offer_price: Math.max(1, Math.floor(Number(offer_price) || 2000)),
        max_original_price: max_original_price !== null && max_original_price !== '' && !isNaN(Number(max_original_price))
          ? Math.max(1, Math.floor(Number(max_original_price)))
          : null,
        excluded_products: Array.isArray(excluded_products)
          ? excluded_products.map((s) => String(s).trim()).filter(Boolean)
          : ['sp_1793943215070_fxm', 'BỘ CODE'],
        require_verified_email: Boolean(require_verified_email),
        updated_at: nowIso,
      };

      await env.DB.prepare(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ('wcg_first_purchase_config_v1', ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at;
      `).bind(JSON.stringify(newConfig), nowIso).run();

      // Ghi audit log
      const actorName = auth.user.username || auth.user.display_name || 'Admin';
      const actorEmail = auth.user.email || 'admin@codegame.shop';
      const logId = 'sec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      await env.DB.prepare(`
        INSERT INTO security_logs (id, actor_name, actor_email, action, target_id, ip_address, severity, details, created_at)
        VALUES (?, ?, ?, 'UPDATE_FIRST_PURCHASE_CONFIG', 'system_settings', ?, 'INFO', ?, ?)
      `).bind(
        logId,
        actorName,
        actorEmail,
        request.headers.get('cf-connecting-ip') || '127.0.0.1',
        JSON.stringify(newConfig),
        nowIso
      ).run().catch(() => {});

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Cập nhật cấu hình chiến dịch ưu đãi mua lần đầu thành công.',
          config: newConfig,
        }),
        { headers: CORS_HEADERS }
      );
    }

    // ACTION 2: ĐẶT LẠI ƯU ĐÃI (RESET OFFER) CHO 1 TÀI KHOẢN & 1 GÓI CỤ THỂ
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

    return new Response(
      JSON.stringify({ success: false, message: 'Action không hợp lệ.' }),
      { status: 400, headers: CORS_HEADERS }
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
