import { verifyMemberAuth } from '../../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit, checkAndExpireSellerOrdersD1 } from '../../../../services/d1_service';
import {
  decryptCode,
  recordLedgerTransaction,
  getMarketplaceConfig,
} from '../../../../services/marketplace_service';

interface Env {
  DB: D1Database;
  MARKETPLACE_CODE_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { params, request, env } = context;
  const orderId = String(params.id || '').trim();

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'D1 Database chưa sẵn sàng.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureMarketplaceSchema(env.DB);
    await checkAndExpireSellerOrdersD1(env.DB, orderId);

    // 1. Xác thực người mua
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập để thanh toán đơn hàng bằng ví Core.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }
    const buyer = auth.member;

    // 2. Tìm đơn cha
    const parentOrder = await env.DB.prepare(`
      SELECT * FROM seller_parent_orders
      WHERE (id = ? OR parent_order_code = ?) AND deleted_at IS NULL
      LIMIT 1
    `).bind(orderId, orderId).first<any>();

    if (!parentOrder) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy đơn hàng đa gian hàng.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (parentOrder.buyer_member_id !== buyer.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bạn không có quyền thanh toán đơn hàng này.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    if (parentOrder.status === 'PAID' || parentOrder.status === 'COMPLETED') {
      return new Response(
        JSON.stringify({ success: false, error: 'Đơn hàng này đã được thanh toán trước đó.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (parentOrder.status === 'EXPIRED' || parentOrder.status === 'CANCELLED') {
      return new Response(
        JSON.stringify({ success: false, error: 'Đơn hàng đã hết hạn hoặc bị hủy.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Tìm các đơn con còn chờ thanh toán
    const childOrdersRes = await env.DB.prepare(`
      SELECT * FROM seller_orders
      WHERE parent_order_id = ? AND status = 'PENDING_PAYMENT' AND deleted_at IS NULL
    `).bind(parentOrder.id).all<any>();

    const childOrders = childOrdersRes?.results || [];
    if (childOrders.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không có đơn con nào cần thanh toán.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const totalToPay = childOrders.reduce((sum: number, co: any) => sum + (Number(co.price_core) || 0), 0);

    // 4. Kiểm tra số dư Core của khách trên bảng members
    const memberRow = await env.DB.prepare(`
      SELECT id, balance, email, username FROM members WHERE id = ? LIMIT 1
    `).bind(buyer.id).first<any>();

    const currentBalance = Number(memberRow?.balance ?? buyer.balance) || 0;
    if (currentBalance < totalToPay) {
      const missing = totalToPay - currentBalance;
      return new Response(
        JSON.stringify({
          success: false,
          error: `Số dư ví không đủ. Bạn có ${currentBalance.toLocaleString('vi-VN')} Core, cần ${totalToPay.toLocaleString('vi-VN')} Core (còn thiếu ${missing.toLocaleString('vi-VN')} Core).`,
          current_balance: currentBalance,
          required_balance: totalToPay,
          missing_balance: missing,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const mConfig = await getMarketplaceConfig(env.DB);
    const holdHours = mConfig.hold_hours || 168;
    const holdUntil = new Date(Date.now() + holdHours * 3600 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    // 5. Chuẩn bị giao mã và cập nhật từng đơn con
    const batchStatements: any[] = [
      // Trừ tiền người mua 1 lần nguyên tử có chặn race-condition
      env.DB.prepare(`
        UPDATE members
        SET balance = balance - ?, updated_at = ?
        WHERE id = ? AND balance >= ?
      `).bind(totalToPay, nowIso, buyer.id, totalToPay),
    ];

    const deliveredResults: any[] = [];

    for (const co of childOrders) {
      let reservedCode = null;
      if (co.code_id) {
        reservedCode = await env.DB.prepare("SELECT * FROM seller_codes WHERE id = ? LIMIT 1")
          .bind(co.code_id).first<any>();
      }
      if (!reservedCode) {
        reservedCode = await env.DB.prepare("SELECT * FROM seller_codes WHERE order_id = ? AND status = 'RESERVED' LIMIT 1")
          .bind(co.id).first<any>();
      }

      let plainCode = '';
      let keyMissing = false;

      if (!env.MARKETPLACE_CODE_KEY || !env.MARKETPLACE_CODE_KEY.trim()) {
        keyMissing = true;
      } else if (reservedCode?.code_encrypted) {
        try {
          plainCode = await decryptCode(reservedCode.code_encrypted, env.MARKETPLACE_CODE_KEY);
        } catch {
          keyMissing = true;
        }
      } else {
        keyMissing = true;
      }

      if (keyMissing) {
        // Chuyển sang chờ xử lý tay
        batchStatements.push(
          env.DB.prepare(`
            UPDATE seller_orders
            SET payment_method = 'CORE', pending_manual_code = 1, updated_at = ?
            WHERE id = ?
          `).bind(nowIso, co.id)
        );
      } else {
        // Đổi trạng thái sang PAID, gán code và hold_until
        batchStatements.push(
          env.DB.prepare(`
            UPDATE seller_orders
            SET status = 'PAID',
                code_id = ?,
                delivered_code = ?,
                payment_method = 'CORE',
                hold_until = ?,
                updated_at = ?
            WHERE id = ?
          `).bind(
            reservedCode?.id || co.code_id,
            plainCode,
            holdUntil,
            nowIso,
            co.id
          )
        );

        if (reservedCode?.id) {
          batchStatements.push(
            env.DB.prepare(`
              UPDATE seller_codes
              SET status = 'SOLD',
                  order_id = ?,
                  sold_at = ?,
                  updated_at = ?
              WHERE id = ?
            `).bind(co.id, nowIso, nowIso, reservedCode.id)
          );
        }
      }

      deliveredResults.push({
        child_order_id: co.id,
        order_code: co.order_code,
        seller_id: co.seller_id,
        product_name: co.product_name,
        price_core: co.price_core,
        delivered_code: plainCode,
        pending_manual_code: keyMissing,
      });
    }

    // Cập nhật đơn cha
    batchStatements.push(
      env.DB.prepare(`
        UPDATE seller_parent_orders
        SET status = 'PAID', payment_method = 'CORE', updated_at = ?
        WHERE id = ?
      `).bind(nowIso, parentOrder.id)
    );

    const batchRes = await env.DB.batch(batchStatements);
    const memberUpdateMeta = (batchRes[0] as any)?.meta;
    if (memberUpdateMeta && memberUpdateMeta.changes === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Số dư không đủ hoặc có giao dịch khác thực hiện song song.' }),
        { status: 409, headers: CORS_HEADERS }
      );
    }

    // 6. Ghi dòng HOLD vào sổ cái cho từng gian hàng (§4.3)
    for (const co of childOrders) {
      await recordLedgerTransaction(env.DB, {
        sellerId: co.seller_id,
        orderId: co.id,
        type: 'HOLD',
        amountCore: co.price_core,
        actor: buyer.username || buyer.email || 'buyer_core_wallet',
        reason: `Thanh toán giỏ đa gian hàng bằng ví Core (Đơn con ${co.order_code})`,
      });
    }

    // Ghi audit log
    await logAdminAudit(env.DB, {
      actorName: buyer.username || buyer.email,
      actorEmail: buyer.email,
      action: 'SELLER_PARENT_ORDER_CORE_PAID',
      targetId: parentOrder.id,
      details: {
        total_amount: totalToPay,
        child_orders_count: childOrders.length,
      },
    });

    const newBalance = currentBalance - totalToPay;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Thanh toán giỏ hàng bằng ví Core thành công!',
        parent_order_id: parentOrder.id,
        total_paid: totalToPay,
        new_balance: newBalance,
        child_orders: deliveredResults,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[paySellerMultiOrderWithCore error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi khi thanh toán bằng ví Core.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
