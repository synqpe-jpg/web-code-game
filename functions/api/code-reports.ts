import { ensureSchemaUpgrades, ensureCodeReportsSchema } from '../services/d1_service';
import { verifyMemberAuth } from '../services/mission_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Admin-Key, X-Api-Key, X-Requested-With',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * POST /api/code-reports
 * Báo lỗi giftcode một chạm (1-Tap Giftcode Error Report)
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cơ sở dữ liệu chưa sẵn sàng' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập để báo lỗi giftcode.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const member = auth.member;
    const body: any = await request.json().catch(() => ({}));
    const gameSlug = String(body.game_slug || '').toLowerCase().trim();
    const code = String(body.code || '').trim();

    if (!gameSlug || !code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thiếu thông tin game_slug hoặc code.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);
    await ensureCodeReportsSchema(env.DB);

    // 1. Chống trùng lặp: 1 người chỉ được báo cùng 1 mã 1 lần trong 7 ngày
    const existing = await env.DB.prepare(`
      SELECT id FROM code_reports 
      WHERE user_id = ? AND game_slug = ? AND code = ? AND created_at >= datetime('now', '-7 days')
      LIMIT 1
    `).bind(member.id, gameSlug, code).first<any>();

    if (existing) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bạn đã báo lỗi cho mã này rồi. Hệ thống đã ghi nhận và đang chờ kiểm tra.',
          is_duplicate: true,
        }),
        { status: 409, headers: CORS_HEADERS }
      );
    }

    // 2. Chống spam: Tối đa 5 báo cáo / ngày / người
    const dailyCountRes = await env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM code_reports 
      WHERE user_id = ? AND created_at >= datetime('now', '-1 day')
    `).bind(member.id).first<any>();

    if ((dailyCountRes?.cnt || 0) >= 5) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bạn đã đạt giới hạn 5 lượt báo lỗi trong ngày. Vui lòng thử lại vào ngày mai.',
        }),
        { status: 429, headers: CORS_HEADERS }
      );
    }

    // 3. Tự suy lý do: Tra cứu expires_at của mã trong bảng codes
    const codeRecord = await env.DB.prepare(`
      SELECT expires_at FROM codes 
      WHERE game_slug = ? AND code = ? 
      LIMIT 1
    `).bind(gameSlug, code).first<any>();

    // Chuẩn ngày Việt Nam hiện tại (UTC+7) dạng YYYY-MM-DD
    const todayVN = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

    let reason: 'expired' | 'not_working' = 'not_working';
    if (codeRecord?.expires_at) {
      const expDate = String(codeRecord.expires_at).trim().split(' ')[0].split('T')[0];
      if (expDate < todayVN) {
        reason = 'expired';
      }
    }

    const reportId = `cr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const userName = member.display_name || member.username || 'Thành viên';

    await env.DB.prepare(`
      INSERT INTO code_reports (id, game_slug, code, reason, user_id, user_name, note, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', datetime('now'))
    `).bind(reportId, gameSlug, code, reason, member.id, userName, body.note || null).run();

    return new Response(
      JSON.stringify({
        success: true,
        id: reportId,
        reason,
        reason_label: reason === 'expired' ? 'Hết hạn' : 'Nhập không được',
        message: 'Báo lỗi giftcode thành công! Đội ngũ kiểm duyệt sẽ kiểm tra và cập nhật sớm.',
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống khi gửi báo lỗi mã.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
