import { ensureSchemaUpgrades, isMemberEmailVerified } from '../../services/d1_service';
import { verifyToken, extractUserIdFromToken } from '../../services/auth_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    await ensureSchemaUpgrades(env.DB);

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, message: 'Yêu cầu đăng nhập để xác minh email.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const { valid, userId: tokenUserId } = await verifyToken(token, [env.JWT_SECRET, env.ADMIN_SYNC_SECRET]);

    let member: any = await env.DB.prepare(
      'SELECT * FROM members WHERE session_token = ? LIMIT 1'
    ).bind(token).first<any>();

    if (!member && valid && tokenUserId) {
      member = await env.DB.prepare(
        'SELECT * FROM members WHERE id = ? OR username = ? OR email = ? LIMIT 1'
      ).bind(tokenUserId, tokenUserId, tokenUserId).first<any>();
    }

    if (!member && token) {
      const extractedUserId = extractUserIdFromToken(token);
      if (extractedUserId) {
        member = await env.DB.prepare(
          'SELECT * FROM members WHERE id = ? OR username = ? LIMIT 1'
        ).bind(extractedUserId, extractedUserId).first<any>();
      }
    }

    if (!member) {
      return new Response(
        JSON.stringify({ success: false, message: 'Phiên đăng nhập không tồn tại hoặc đã hết hạn.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    if (member.status === 'BANNED') {
      return new Response(
        JSON.stringify({ success: false, message: 'Tài khoản của bạn đã bị khóa.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const email = String(member.email || '').trim();
    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Tài khoản chưa có địa chỉ email hợp lệ để xác minh.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const nowIso = new Date().toISOString();

    // Cập nhật trạng thái email_verified = 1 vào D1 database
    await env.DB.prepare(`
      UPDATE members
      SET email_verified = 1,
          email_verified_at = COALESCE(email_verified_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).bind(member.id).run();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Xác minh email thành công! Tài khoản đã mở khóa Ưu Đãi Mua Lần Đầu 2.000 Core.',
        email_verified: true,
        email_verified_at: nowIso,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: 'Lỗi xác minh email: ' + (err?.message || 'Không xác định') }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
