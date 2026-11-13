import { PagesFunction } from '@cloudflare/workers-types';
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
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// POST /api/admin/seller-disputes/:id/resolve: Quản trị viên xử lý khiếu nại (REFUND | REPLACE | REJECT) (§B)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyAdminAuth(request, env as any, 'MARKETPLACE_MANAGE');
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Yêu cầu quyền Quản trị viên.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const disputeId = String(params.id || '').trim();
    const body = (await request.json().catch(() => ({}))) as any;
    const decision = String(body.decision || '').toUpperCase().trim();
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const replacementCode = typeof body.replacement_code === 'string' ? body.replacement_code.trim() : '';

    if (!['REFUND', 'REPLACE', 'REJECT'].includes(decision)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Quyết định không hợp lệ. Chọn 1 trong 3 hành động: REFUND (Hoàn tiền), REPLACE (Đổi mã mới), REJECT (Từ chối).',
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!note) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bắt buộc phải nhập lý do/ghi chú giải quyết cho khiếu nại này.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Tìm bản ghi khiếu nại kèm đơn hàng
    const dispute = await env.DB
      .prepare(`
        SELECT 
          sd.*,
          so.id as order_id,
          so.order_code,
          so.price_core,
          so.seller_id as order_seller_id,
          so.delivered_code,
          so.code_id,
          so.status as order_status,
          so.released_at,
          so.hold_until
        FROM seller_disputes sd
        JOIN seller_orders so ON sd.order_id = so.id
        WHERE sd.id = ?
        LIMIT 1
      `)
      .bind(disputeId)
      .first<any>();

    if (!dispute) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy khiếu nại này.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    if (['RESOLVED_REFUNDED', 'RESOLVED_REPLACED', 'REJECTED'].includes(dispute.status)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Khiếu nại này đã được giải quyết trước đó với trạng thái: ${dispute.status}.`,
        }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const adminActor = (auth as any).member?.username || (auth as any).keyRecord?.key_name || 'Admin';
    const nowIso = new Date().toISOString();

    // 2. Phân rẽ nhánh xử lý theo quyết định
    if (decision === 'REFUND') {
      // ===== NHÁNH 1: HOÀN TIỀN (REFUND) =====
      // Kiểm tra khách đã xem mã chưa
      const codeViewRow = await env.DB
        .prepare('SELECT id FROM seller_code_views WHERE order_id = ? LIMIT 1')
        .bind(dispute.order_id)
        .first<any>();

      const hasViewedCode = Boolean(codeViewRow);
      let finalResolutionNote = note;

      if (!hasViewedCode) {
        // Khách chưa xem mã: thu hồi mã về trạng thái RECALLED trong kho
        if (dispute.code_id) {
          await env.DB
            .prepare("UPDATE seller_codes SET status = 'RECALLED', updated_at = ? WHERE id = ?")
            .bind(nowIso, dispute.code_id)
            .run();
        }
      } else {
        // Khách đã xem mã: hoàn tiền nhưng ghi rõ vào biên bản và mở ngoại lệ đối soát
        finalResolutionNote = `[Khách đã xem mã - Mở ngoại lệ đối soát CODE_VIEWED_REFUND] ${note}`;
        const exId = `ex_viewed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await env.DB
          .prepare(`
            INSERT INTO reconciliation_exceptions (
              id, run_id, exception_type, severity, order_id, seller_id, details, status, created_at
            ) VALUES (?, 'manual_dispute_refund', 'CODE_VIEWED_REFUND', 'MEDIUM', ?, ?, ?, 'RESOLVED', ?)
          `)
          .bind(
            exId,
            dispute.order_id,
            dispute.seller_id,
            `Hoàn tiền khiếu nại ${dispute.id} cho đơn ${dispute.order_code} dù khách đã bấm xem mã code trước đó. Ghi chú: ${note}`,
            nowIso
          )
          .run()
          .catch(() => {});
      }

      // Hoàn tiền Core vào ví của khách hàng
      const priceCore = Number(dispute.price_core) || 0;
      await env.DB
        .prepare('UPDATE members SET balance = balance + ? WHERE id = ?')
        .bind(priceCore, dispute.buyer_member_id)
        .run();

      // Ghi dòng sổ cái REFUND (trừ ngăn đang giữ nếu chưa giải ngân, trừ ngăn khả dụng nếu đã giải ngân)
      const isOrderAlreadyReleased = Boolean(dispute.released_at || dispute.order_status === 'COMPLETED');
      const ledgerResult = await recordLedgerTransaction(env.DB, {
        sellerId: dispute.seller_id,
        orderId: dispute.order_id,
        type: 'REFUND',
        amountCore: priceCore,
        actor: adminActor,
        reason: `Hoàn tiền khiếu nại ${dispute.id} (Đơn ${dispute.order_code}): ${finalResolutionNote}`,
        isOrderAlreadyReleased,
      });

      if (!ledgerResult.success) {
        return new Response(
          JSON.stringify({ success: false, error: ledgerResult.error || 'Lỗi khi ghi nhận sổ cái tài chính.' }),
          { status: 500, headers: CORS_HEADERS }
        );
      }

      // Cập nhật đơn con sang REFUNDED
      await env.DB
        .prepare(`
          UPDATE seller_orders
          SET status = 'REFUNDED',
              resolution_type = 'REFUND',
              resolution_note = ?,
              resolved_at = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .bind(finalResolutionNote, nowIso, nowIso, dispute.order_id)
        .run();

      // Cập nhật khiếu nại sang RESOLVED_REFUNDED
      await env.DB
        .prepare(`
          UPDATE seller_disputes
          SET status = 'RESOLVED_REFUNDED',
              resolved_by = ?,
              resolution_note = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .bind(adminActor, finalResolutionNote, nowIso, disputeId)
        .run();

      await logAdminAudit(env.DB, {
        adminEmail: adminActor,
        action: 'RESOLVE_DISPUTE_REFUND',
        targetType: 'seller_disputes',
        targetId: disputeId,
        details: {
          order_id: dispute.order_id,
          order_code: dispute.order_code,
          seller_id: dispute.seller_id,
          buyer_member_id: dispute.buyer_member_id,
          amount_refunded_core: priceCore,
          has_viewed_code: hasViewedCode,
          note: finalResolutionNote,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `Đã hoàn tiền ${priceCore} Core vào ví của khách hàng thành công. Trạng thái đơn đã chuyển sang REFUNDED.`,
          decision: 'REFUND',
          status: 'RESOLVED_REFUNDED',
          resolution_note: finalResolutionNote,
          amount_refunded_core: priceCore,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } else if (decision === 'REPLACE') {
      // ===== NHÁNH 2: ĐỔI MÃ MỚI (REPLACE) =====
      const finalCode = (replacementCode || dispute.seller_replacement_code || '').trim();
      if (!finalCode) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Không tìm thấy mã thay thế. Vui lòng yêu cầu người bán cung cấp mã hoặc nhập trực tiếp mã thay thế tại đây.',
          }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Cập nhật đơn con: giao mã thay thế, đưa đơn về lại PAID, giữ nguyên hold_until cũ (không gia hạn giữ)
      await env.DB
        .prepare(`
          UPDATE seller_orders
          SET replacement_code = ?,
              status = 'PAID',
              resolution_type = 'REPLACE',
              resolution_note = ?,
              resolved_at = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .bind(finalCode, note, nowIso, nowIso, dispute.order_id)
        .run();

      // Cập nhật khiếu nại sang RESOLVED_REPLACED
      await env.DB
        .prepare(`
          UPDATE seller_disputes
          SET status = 'RESOLVED_REPLACED',
              seller_replacement_code = ?,
              resolved_by = ?,
              resolution_note = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .bind(finalCode, adminActor, note, nowIso, disputeId)
        .run();

      await logAdminAudit(env.DB, {
        adminEmail: adminActor,
        action: 'RESOLVE_DISPUTE_REPLACE',
        targetType: 'seller_disputes',
        targetId: disputeId,
        details: {
          order_id: dispute.order_id,
          order_code: dispute.order_code,
          seller_id: dispute.seller_id,
          buyer_member_id: dispute.buyer_member_id,
          note,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Đã hoàn tất đổi mã mới cho khách hàng. Đơn hàng quay về trạng thái PAID và giữ nguyên thời hạn giải ngân.',
          decision: 'REPLACE',
          status: 'RESOLVED_REPLACED',
          replacement_code: finalCode,
          resolution_note: note,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } else {
      // ===== NHÁNH 3: TỪ CHỐI KHIẾU NẠI (REJECT) =====
      // Đơn con về lại PAID, giữ nguyên hold_until cũ, tiền tiếp tục quy trình giải ngân bình thường
      await env.DB
        .prepare(`
          UPDATE seller_orders
          SET status = 'PAID',
              resolution_type = 'REJECT',
              resolution_note = ?,
              resolved_at = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .bind(note, nowIso, nowIso, dispute.order_id)
        .run();

      // Cập nhật khiếu nại sang REJECTED
      await env.DB
        .prepare(`
          UPDATE seller_disputes
          SET status = 'REJECTED',
              resolved_by = ?,
              resolution_note = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .bind(adminActor, note, nowIso, disputeId)
        .run();

      await logAdminAudit(env.DB, {
        adminEmail: adminActor,
        action: 'RESOLVE_DISPUTE_REJECT',
        targetType: 'seller_disputes',
        targetId: disputeId,
        details: {
          order_id: dispute.order_id,
          order_code: dispute.order_code,
          seller_id: dispute.seller_id,
          buyer_member_id: dispute.buyer_member_id,
          note,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Đã từ chối khiếu nại. Đơn hàng quay về trạng thái PAID và tiếp tục thời gian giải ngân như bình thường.',
          decision: 'REJECT',
          status: 'REJECTED',
          resolution_note: note,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }
  } catch (err: any) {
    console.error('[Admin Resolve Dispute Error]', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi xử lý giải quyết khiếu nại.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
