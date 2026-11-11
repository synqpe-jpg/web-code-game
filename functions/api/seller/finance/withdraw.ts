import { verifyMemberAuth } from '../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../services/d1_service';
import { getMarketplaceConfig, SellerRecord } from '../../../services/marketplace_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
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
  const { request, env } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'D1 Database chưa sẵn sàng.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureMarketplaceSchema(env.DB);

    // 1. Xác thực đăng nhập
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }
    const memberId = auth.member.id;

    // 2. Kiểm tra quyền chủ gian hàng (subaccount cấm rút tiền §0.5)
    const seller = await env.DB
      .prepare("SELECT * FROM sellers WHERE owner_member_id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(memberId)
      .first<SellerRecord>();

    if (!seller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chỉ chủ gian hàng mới có quyền thực hiện yêu cầu rút tiền.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // 3. Kiểm tra thông tin tài khoản ngân hàng
    if (!seller.bank_name || !seller.bank_account || !seller.bank_account_name) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Gian hàng chưa cập nhật thông tin tài khoản ngân hàng nhận tiền. Vui lòng cập nhật tại Cài Đặt Gian Hàng trước khi rút.',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 4. Phân tích số tiền rút
    const body = (await request.json().catch(() => ({}))) as any;
    const amount = Math.floor(Number(body?.amount_core || body?.amount || 0));

    if (amount < 1) {
      return new Response(
        JSON.stringify({ success: false, error: 'Số tiền rút tối thiểu là 1 Core.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const availableBalance = Number(seller.available_balance_core) || 0;
    if (amount > availableBalance) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Số dư khả dụng không đủ. Bạn có ${availableBalance.toLocaleString('vi-VN')} Core khả dụng, yêu cầu rút ${amount.toLocaleString('vi-VN')} Core.`,
          available_balance: availableBalance,
          requested_amount: amount,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Kiểm tra xem có yêu cầu rút nào đang PENDING không (tránh gửi dồn dập)
    const pendingWithdrawal = await env.DB.prepare(`
      SELECT id FROM seller_withdrawals
      WHERE seller_id = ? AND status = 'PENDING' AND deleted_at IS NULL
      LIMIT 1
    `).bind(seller.id).first<any>();

    if (pendingWithdrawal) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Gian hàng đang có 1 yêu cầu rút tiền đang chờ duyệt. Vui lòng chờ xử lý xong trước khi tạo thêm.',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 5. Kiểm tra ngưỡng duyệt tự động vs duyệt tay (§8)
    const config = await getMarketplaceConfig(env.DB);
    const threshold = config.withdraw_approval_threshold_core || 500;
    const isAutoApproved = amount <= threshold;
    const initialStatus = isAutoApproved ? 'APPROVED' : 'PENDING';
    const initialNote = isAutoApproved
      ? `Tự động duyệt (số tiền ${amount} Core <= ngưỡng ${threshold} Core). Chờ chuyển khoản.`
      : `Chờ duyệt (số tiền ${amount} Core > ngưỡng ${threshold} Core).`;

    const withdrawalId = `wdr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    // 6. Thực thi nguyên tử:
    // Tạm khóa số tiền trong ngăn khả dụng (available_balance_core -= amount)
    // Tạo bản ghi seller_withdrawals
    const batchRes = await env.DB.batch([
      env.DB.prepare(`
        UPDATE sellers
        SET available_balance_core = available_balance_core - ?, updated_at = ?
        WHERE id = ? AND available_balance_core >= ?
      `).bind(amount, nowIso, seller.id, amount),

      env.DB.prepare(`
        INSERT INTO seller_withdrawals (
          id, seller_id, amount_core, bank_name, bank_account, bank_account_name,
          status, requested_by, reviewed_by, review_note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        withdrawalId,
        seller.id,
        amount,
        seller.bank_name,
        seller.bank_account,
        seller.bank_account_name,
        initialStatus,
        auth.member.username || auth.member.email,
        isAutoApproved ? 'system_auto' : null,
        initialNote,
        nowIso,
        nowIso
      ),
    ]);

    const updateSellerMeta = (batchRes[0] as any)?.meta;
    if (updateSellerMeta && updateSellerMeta.changes === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Số dư khả dụng không đủ hoặc có giao dịch khác thực hiện song song.' }),
        { status: 409, headers: CORS_HEADERS }
      );
    }

    await logAdminAudit(env.DB, {
      actorName: auth.member.username || auth.member.email,
      actorEmail: auth.member.email,
      action: 'SELLER_WITHDRAWAL_REQUESTED',
      targetId: withdrawalId,
      details: {
        seller_id: seller.id,
        amount_core: amount,
        bank_name: seller.bank_name,
        bank_account: seller.bank_account,
        status: initialStatus,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: isAutoApproved
          ? `Yêu cầu rút ${amount.toLocaleString('vi-VN')} Core đã được duyệt tự động. Quản trị viên sẽ chuyển khoản theo thông tin ngân hàng của bạn.`
          : `Yêu cầu rút ${amount.toLocaleString('vi-VN')} Core đã gửi thành công và đang chờ Quản trị viên duyệt.`,
        withdrawal: {
          id: withdrawalId,
          amount_core: amount,
          status: initialStatus,
          bank_name: seller.bank_name,
          bank_account: seller.bank_account,
          bank_account_name: seller.bank_account_name,
          created_at: nowIso,
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[sellerWithdraw error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi khi gửi yêu cầu rút tiền.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
