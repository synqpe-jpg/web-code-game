import { ensureSchemaUpgrades, logAdminAudit } from '../../../../services/d1_service';
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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, x-admin-sync-key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * POST /api/admin/orders/:id/refund
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
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

    const url = new URL(request.url);
    let targetId = String(params?.id || '').trim();
    if (!targetId) {
      const parts = url.pathname.split('/').filter(Boolean);
      const refundIdx = parts.lastIndexOf('refund');
      if (refundIdx > 0) {
        targetId = parts[refundIdx - 1];
      }
    }

    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã đơn hàng (:id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let reason = 'Quản trị viên hoàn tiền đơn hàng';
    try {
      const body: any = await request.json();
      if (body?.reason) reason = String(body.reason).trim();
    } catch {}

    const order = await env.DB.prepare(`
      SELECT *
      FROM orders
      WHERE id = ?
      LIMIT 1
    `).bind(targetId).first<any>();

    if (!order) {
      return new Response(
        JSON.stringify({ success: false, error: `Không tìm thấy đơn hàng "${targetId}".` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (order.status === 'REFUNDED') {
      return new Response(
        JSON.stringify({ success: false, error: `Đơn hàng #${order.id} đã được hoàn tiền trước đó.` }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const refundAmount = Number(order.price_paid !== null && order.price_paid !== undefined ? order.price_paid : (order.total_amount ?? order.amount)) || 0;
    const memberId = order.member_id;

    const stmts: D1PreparedStatement[] = [];

    // 1. Cập nhật trạng thái đơn hàng sang REFUNDED
    stmts.push(
      env.DB.prepare("UPDATE orders SET status = 'REFUNDED', payment_status = 'REFUNDED' WHERE id = ?").bind(order.id)
    );

    // 2. Thu hồi mã kho về trạng thái AVAILABLE
    stmts.push(
      env.DB.prepare("UPDATE inventory_codes SET status = 'AVAILABLE', order_id = NULL, sold_at = NULL WHERE order_id = ?").bind(order.id)
    );

    // 3. Nếu khách có tài khoản ví và thanh toán bằng số dư Core hoặc đã trừ tiền -> Hoàn tiền ví
    if (memberId && refundAmount > 0) {
      const member = await env.DB.prepare('SELECT id, balance, email FROM members WHERE id = ?').bind(memberId).first<any>();
      if (member) {
        const balBefore = Number(member.balance || 0);
        const balAfter = balBefore + refundAmount;
        stmts.push(
          env.DB.prepare('UPDATE members SET balance = balance + ? WHERE id = ?').bind(refundAmount, member.id)
        );
        const txId = `TX_REF_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        stmts.push(
          env.DB.prepare(`
            INSERT INTO wallet_transactions (
              id, member_id, member_email, type, amount, balance_before, balance_after, description, status, order_id, created_at
            ) VALUES (?, ?, ?, 'REFUND', ?, ?, ?, ?, 'COMPLETED', ?, datetime('now'))
          `).bind(
            txId,
            member.id,
            member.email || order.buyer_email || `${member.id}@webcodegame.vn`,
            refundAmount,
            balBefore,
            balAfter,
            `Hoàn tiền đơn hàng #${order.id} - ${order.product_title || 'Sản phẩm'} (${reason})`,
            order.id
          )
        );
      }
    }

    await env.DB.batch(stmts);

    await logAdminAudit(env.DB, {
      actorName: auth.adminName || 'Admin',
      action: 'REFUND_ORDER',
      targetId: order.id,
      targetUser: order.buyer_email || order.member_id,
      details: {
        orderId: order.id,
        refundAmount,
        reason,
        productTitle: order.product_title,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã hoàn tiền đơn hàng #${order.id} thành công (${refundAmount.toLocaleString('vi-VN')} Core).`,
        orderId: order.id,
        refundedAmount: refundAmount,
        reason,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi máy chủ khi hoàn tiền đơn hàng: ' + (err?.message || String(err)) }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
