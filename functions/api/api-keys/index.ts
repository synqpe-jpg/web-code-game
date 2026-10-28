import {
  CORS_HEADERS,
  Env,
  verifyAdminAuth,
  computeSha256,
} from '../../services/mission_service';
import { ensureMissionSchema } from '../../services/d1_service';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * GET /api/api-keys
 * Lấy danh sách toàn bộ các Khóa API trong hệ thống kèm thông tin phân quyền & Khóa Master
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

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

    await ensureMissionSchema(env.DB);

    // Ensure description column exists in mission_ai_api_keys
    await env.DB.prepare(
      "ALTER TABLE mission_ai_api_keys ADD COLUMN description TEXT DEFAULT '';"
    ).run().catch(() => {});

    const result = await env.DB.prepare(
      `SELECT id, key_name, key_prefix, scope, description, is_active, last_used_at, created_at 
       FROM mission_ai_api_keys 
       ORDER BY created_at DESC`
    ).all<any>();

    const masterSecret = env.ADMIN_SYNC_SECRET || 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';
    const masterPrefix = masterSecret.length > 10 
      ? `${masterSecret.slice(0, 6)}••••••••••••••••••••••••••••••••••••••••••••••••••••••${masterSecret.slice(-5)}`
      : 'b4e084••••••2faef';

    const masterKeyInfo = {
      id: 'key_system_master',
      key_name: 'Khóa Quản Trị Hệ Thống (Master Key)',
      scope: 'ADMIN_FULL',
      description: 'Quyền tối cao: Toàn quyền đồng bộ hệ thống, quản lý cơ sở dữ liệu D1/KV, truy cập mọi API admin.',
      key_prefix: masterPrefix,
      raw_key: masterSecret,
      is_master: true,
      is_active: 1,
      last_used_at: new Date().toISOString(),
      created_at: '2026-01-01T00:00:00.000Z',
    };

    return new Response(
      JSON.stringify({
        success: true,
        master_key: masterKeyInfo,
        keys: result?.results || [],
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi tải danh sách API keys.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * POST /api/api-keys
 * Tạo khóa API mới với cấp quyền xác định:
 * - NEWS_FULL: Toàn quyền Tin tức & Bài viết
 * - MISSIONS_FULL: Toàn quyền Quản lý Nhiệm vụ & Duyệt bài
 * - MISSIONS_REVIEW: Thẩm định bài nộp nhiệm vụ (AI Pine)
 * - ADMIN_FULL: Toàn quyền Quản trị & Đồng bộ hệ thống
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

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

    await ensureMissionSchema(env.DB);
    await env.DB.prepare(
      "ALTER TABLE mission_ai_api_keys ADD COLUMN description TEXT DEFAULT '';"
    ).run().catch(() => {});

    const body: any = await request.json().catch(() => ({}));
    const { key_name, scope = 'NEWS_FULL', description = '' } = body;

    if (!key_name || typeof key_name !== 'string' || !key_name.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'Vui lòng đặt tên định danh cho khóa API.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate scope
    const allowedScopes = ['NEWS_FULL', 'MISSIONS_FULL', 'MISSIONS_REVIEW', 'REVIEW_ONLY', 'ADMIN_FULL', 'FULL'];
    const validScope = allowedScopes.includes(scope) ? scope : 'NEWS_FULL';

    // Generate random 24 bytes (48 hex chars)
    const randomBytes = new Uint8Array(24);
    crypto.getRandomValues(randomBytes);
    const randomHex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

    let prefixTag = 'wcg_sec_';
    if (validScope === 'NEWS_FULL') prefixTag = 'wcg_news_';
    else if (validScope === 'MISSIONS_FULL') prefixTag = 'wcg_mis_';
    else if (validScope === 'MISSIONS_REVIEW' || validScope === 'REVIEW_ONLY') prefixTag = 'wcg_ai_';
    else if (validScope === 'ADMIN_FULL' || validScope === 'FULL') prefixTag = 'wcg_adm_';

    const rawKey = `${prefixTag}${randomHex}`;
    const keyPrefix = `${rawKey.substring(0, 12)}••••••••••••••••••••${rawKey.slice(-4)}`;
    const keyHash = await computeSha256(rawKey);

    const id = `ak_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO mission_ai_api_keys (id, key_name, api_key_hash, key_prefix, scope, description, is_active, last_used_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, '', ?)
    `).bind(id, key_name.trim(), keyHash, keyPrefix, validScope, description?.trim() || '', nowIso).run();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Khởi tạo khóa API thành công.',
        key: {
          id,
          key_name: key_name.trim(),
          scope: validScope,
          description: description?.trim() || '',
          key_prefix: keyPrefix,
          raw_key: rawKey,
          is_active: 1,
          created_at: nowIso,
        },
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi khi tạo khóa API mới.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
