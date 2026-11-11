import { verifyAdminAuth } from '../../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../../services/d1_service';
import { recordLedgerTransaction } from '../../../../services/marketplace_service';

interface Env {
  DB: D1Database;
  ADMIN_SYNC_SECRET?: string;
  PINE_API_KEY?: string;
  MUSE_API_KEY?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { params, request, env } = context;
  const withdrawalId = String(params.id || '').trim();

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'D1 Database chưa sẵn sàng.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyAdminAuth(request, env as any, 'MARKETPLACE_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Yêu cầu quyền Quản trị viên (MARKETPLACE_MANAGE).' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    if (!withdrawalId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu mã yêu cầu rút tiền.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const item = await env.DB.prepare(`
      SELECT * FROM seller_withdrawals WHERE id = ? AND deleted_at IS NULL LIMIT 1
    `).bind(withdrawalId).first<any>();

    if (!item) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy yêu cầu rút tiền.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (item.status === 'PAID') {
      return new Response(
        JSON.stringify({ success: false, error: 'Yêu cầu rút này đã được xác nhận chi trả trước đó.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (item.status === 'REJECTED') {
      return new Response(
        JSON.stringify({ success: false, error: 'Yêu cầu rút đã bị từ chối, không thể xác nhận chuyển khoản.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const body = (await request.json().catch(() => ({}))) as any;
    const note = String(body.note || body.review_note || 'Đã chuyển khoản thành công qua ngân hàng.').trim();

    const adminName = auth.adminName || 'Admin';
    const nowIso = new Date().toISOString();
    const amount = Number(item.amount_core) || 0;

    // Lưu ý về sổ cái (§8):
    // Khi người bán gửi yêu cầu rút, số tiền đã được trừ khỏi available_balance_core để tạm khóa.
    // Nay khi xác nhận chuyển khoản ngoài thành công:
    // 1. Cập nhật trạng thái withdrawal sang PAID
    // 2. Ghi 1 dòng WITHDRAW vào seller_ledger
    // 3. Cộng withdrawn_balance_core của gian hàng
    const ledgerId = `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Đọc số dư hiện tại của seller
    const seller = await env.DB.prepare(`
      SELECT pending_balance_core, available_balance_core, withdrawn_balance_core
      FROM sellers WHERE id = ? LIMIT 1
    `).bind(item.seller_id).first<any>();

    const heldAfter = Number(seller?.pending_balance_core) || 0;
    const availAfter = Number(seller?.available_balance_core) || 0;
    const withdrawnAfter = (Number(seller?.withdrawn_balance_core) || 0) + amount;

    await env.DB.batch([
      // 1. Cập nhật withdrawal
      env.DB.prepare(`
        UPDATE seller_withdrawals
        SET status = 'PAID',
            reviewed_by = ?,
            review_note = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(adminName, note, nowIso, withdrawalId),

      // 2. Ghi sổ cái WITHDRAW
      env.DB.prepare(`
        INSERT INTO seller_ledger (
          id, seller_id, order_id, type, amount_core,
          balance_held_after, balance_available_after, balance_withdrawn_after,
          actor, reason, created_at
        ) VALUES (?, ?, ?, 'WITHDRAW', ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        ledgerId,
        item.seller_id,
        withdrawalId,
        -amount,
        heldAfter,
        availAfter,
        withdrawnAfter,
        adminName,
        `Xác nhận chuyển khoản ngân hàng thành công: ${amount.toLocaleString('vi-VN')} Core đến ${item.bank_name} - ${item.bank_account} (${item.bank_account_name})`,
        nowIso
      ),

      // 3. Cập nhật withdrawn_balance_core cho gian hàng
      env.DB.prepare(`
        UPDATE sellers
        SET withdrawn_balance_core = withdrawn_balance_core + ?, updated_at = ?
        WHERE id = ?
      `).bind(amount, nowIso, item.seller_id),
    ]);

    await logAdminAudit(env.DB, {
      actorName: adminName,
      action: 'ADMIN_MARK_PAID_WITHDRAWAL',
      targetId: withdrawalId,
      details: {
        seller_id: item.seller_id,
        amount_core: amount,
        bank_name: item.bank_name,
        bank_account: item.bank_account,
        note,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã xác nhận chuyển khoản ${amount.toLocaleString('vi-VN')} Core thành công. Sổ cái đã ghi nhận dòng WITHDRAW.`,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[markPaidWithdrawal error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
