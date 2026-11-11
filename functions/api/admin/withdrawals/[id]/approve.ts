import { verifyAdminAuth } from '../../../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../../../services/d1_service';

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

    if (item.status !== 'PENDING') {
      return new Response(
        JSON.stringify({ success: false, error: `Yêu cầu rút đang ở trạng thái ${item.status}, chỉ có thể duyệt yêu cầu PENDING.` }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const adminName = auth.adminName || 'Admin';
    const nowIso = new Date().toISOString();

    await env.DB.prepare(`
      UPDATE seller_withdrawals
      SET status = 'APPROVED',
          reviewed_by = ?,
          review_note = 'Quản trị viên đã duyệt yêu cầu rút tiền. Chờ chuyển khoản.',
          updated_at = ?
      WHERE id = ?
    `).bind(adminName, nowIso, withdrawalId).run();

    await logAdminAudit(env.DB, {
      actorName: adminName,
      action: 'ADMIN_APPROVE_WITHDRAWAL',
      targetId: withdrawalId,
      details: {
        seller_id: item.seller_id,
        amount_core: item.amount_core,
        bank_name: item.bank_name,
        bank_account: item.bank_account,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã duyệt yêu cầu rút ${item.amount_core.toLocaleString('vi-VN')} Core thành công. Vui lòng chuyển khoản và bấm Xác Nhận Đã Chuyển Khoản.`,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[approveWithdrawal error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
