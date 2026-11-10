import {
  CORS_HEADERS,
  Env,
  verifyAdminAuth,
  formatScopes,
  computeSha256,
} from '../../services/mission_service';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * PATCH /api/api-keys/:id
 * Cập nhật trạng thái, gia hạn thời gian hoặc ĐỔI KHÓA MỚI (Key Rotation)
 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const adminCheck = await verifyAdminAuth(request, env);
    if (!adminCheck.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: adminCheck.error || 'Quyền truy cập bị từ chối.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const keyId = params.id as string;
    if (!keyId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Thiếu ID khóa API.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (keyId === 'key_system_master') {
      return new Response(
        JSON.stringify({ success: false, message: 'Không thể chỉnh sửa Khóa Master hệ thống qua endpoint này.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const body: any = await request.json().catch(() => ({}));

    // ==========================================
    // THAO TÁC XOAY KHÓA / ĐỔI KHÓA API MỚI (ROTATE KEY)
    // ==========================================
    if (body.action === 'rotate' || body.action === 'regenerate') {
      const existing = await env.DB.prepare(
        'SELECT id, key_name, scope, description, expires_at FROM mission_ai_api_keys WHERE id = ? LIMIT 1'
      ).bind(keyId).first<any>();

      if (!existing) {
        return new Response(
          JSON.stringify({ success: false, message: 'Không tìm thấy khóa API để đổi.' }),
          { status: 404, headers: CORS_HEADERS }
        );
      }

      // Sinh 24 bytes ngẫu nhiên (48 ký tự hex)
      const randomBytes = new Uint8Array(24);
      crypto.getRandomValues(randomBytes);
      const randomHex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

      const validScope = existing.scope || 'NEWS_FULL';
      let prefixTag = 'wcg_sec_';
      if (validScope.includes(',')) prefixTag = 'wcg_multi_';
      else if (validScope === 'NEWS_FULL') prefixTag = 'wcg_news_';
      else if (validScope === 'MISSIONS_FULL') prefixTag = 'wcg_mis_';
      else if (validScope === 'GIVEAWAYS_FULL') prefixTag = 'wcg_gw_';
      else if (validScope === 'EVENT_SCHEDULER_FULL') prefixTag = 'wcg_ev_';
      else if (validScope === 'TELEGRAM_FULL') prefixTag = 'wcg_tg_';
      else if (validScope === 'MISSIONS_REVIEW' || validScope === 'REVIEW_ONLY') prefixTag = 'wcg_ai_';
      else if (validScope === 'ADMIN_FULL' || validScope === 'FULL') prefixTag = 'wcg_adm_';
      else prefixTag = 'wcg_multi_';

      const rawKey = `${prefixTag}${randomHex}`;
      const keyPrefix = `${rawKey.substring(0, 12)}••••••••••••••••••••${rawKey.slice(-4)}`;
      const keyHash = await computeSha256(rawKey);
      const nowIso = new Date().toISOString();

      // Cập nhật ngay: Khóa cũ lập tức vô hiệu lực vì hash cũ bị ghi đè thành công
      await env.DB.prepare(`
        UPDATE mission_ai_api_keys 
        SET raw_key = ?,
            api_key_hash = ?,
            key_prefix = ?,
            is_active = 1,
            created_at = ?
        WHERE id = ?
      `).bind(
        rawKey,
        keyHash,
        keyPrefix,
        nowIso,
        keyId
      ).run();

      // Ghi nhật ký kiểm toán an ninh
      await env.DB.prepare(`
        INSERT INTO security_logs (id, actor_name, actor_email, action, target_id, severity, details, created_at)
        VALUES (?, ?, ?, 'API_KEY_ROTATED', ?, 'WARNING', ?, ?)
      `).bind(
        `sec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        adminCheck.user?.email || 'Admin Portal',
        adminCheck.user?.email || 'admin@codegame.shop',
        keyId,
        JSON.stringify({ key_name: existing.key_name, scope: validScope, action: 'rotate_key' }),
        nowIso
      ).run().catch(() => null);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Khóa cũ đã hết hạn. Đã đổi thành công khóa API mới cho "${existing.key_name}".`,
          key: {
            id: keyId,
            key_name: existing.key_name,
            raw_key: rawKey,
            key_prefix: keyPrefix,
            scope: validScope,
            description: existing.description,
            expires_at: existing.expires_at,
            is_active: 1,
            created_at: nowIso,
          },
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // ==========================================
    // CẬP NHẬT THÔNG TIN / GIA HẠN / BẬT TẮT
    // ==========================================
    const { is_active, key_name, scope, scopes, description, expires_at, extend_days } = body;

    const existing = await env.DB.prepare(
      'SELECT id, is_active, scope, expires_at FROM mission_ai_api_keys WHERE id = ? LIMIT 1'
    ).bind(keyId).first<any>();

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, message: 'Không tìm thấy khóa API.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const nextActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    let nextExpiresAt = existing.expires_at || '';
    if (expires_at !== undefined) {
      nextExpiresAt = String(expires_at).trim();
    } else if (typeof extend_days === 'number' && extend_days > 0) {
      const baseTime = existing.expires_at ? Math.max(Date.now(), new Date(existing.expires_at).getTime()) : Date.now();
      nextExpiresAt = new Date(baseTime + extend_days * 86400000).toISOString();
    }

    let nextScope = existing.scope;
    if (scopes !== undefined && Array.isArray(scopes)) {
      nextScope = formatScopes(scopes);
    } else if (scope !== undefined) {
      nextScope = formatScopes(scope);
    }

    await env.DB.prepare(`
      UPDATE mission_ai_api_keys 
      SET is_active = ?,
          expires_at = ?,
          key_name = COALESCE(?, key_name),
          scope = ?,
          description = COALESCE(?, description)
      WHERE id = ?
    `).bind(
      nextActive,
      nextExpiresAt,
      key_name || null,
      nextScope,
      description || null,
      keyId
    ).run();

    return new Response(
      JSON.stringify({
        success: true,
        message: nextActive === 1 ? 'Đã kích hoạt khóa API.' : 'Đã tạm vô hiệu hóa khóa API.',
        id: keyId,
        is_active: nextActive,
        expires_at: nextExpiresAt,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi cập nhật khóa API.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * POST /api/api-keys/:id
 * Tương đương PATCH (cho phép gọi xoay khóa hoặc cập nhật qua phương thức POST)
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  return onRequestPatch(context);
};

/**
 * DELETE /api/api-keys/:id
 * Thu hồi và xóa vĩnh viễn khóa API khỏi cơ sở dữ liệu
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const adminCheck = await verifyAdminAuth(request, env);
    if (!adminCheck.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: adminCheck.error || 'Quyền truy cập bị từ chối.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const keyId = params.id as string;
    if (!keyId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Thiếu ID khóa API.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (keyId === 'key_system_master') {
      return new Response(
        JSON.stringify({ success: false, message: 'Không thể xóa Khóa Master hệ thống.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    await env.DB.prepare('DELETE FROM mission_ai_api_keys WHERE id = ?').bind(keyId).run();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Đã thu hồi và xóa khóa API thành công.',
        id: keyId,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi khi xóa khóa API.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
