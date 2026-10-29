import {
  CORS_HEADERS,
  Env,
  verifyAiKeyAuth,
  verifyAdminAuth,
  hasScope,
} from '../../services/mission_service';
import {
  syncGiveawaysToD1,
  loadAllGiveawaysD1,
  getSettingD1,
  setSettingD1,
  invalidateSettingMemoryCache,
} from '../../services/d1_service';

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

/**
 * Xác thực quyền quản trị Giveaway (Chấp nhận API Key có scope GIVEAWAYS_FULL, ADMIN_FULL, FULL hoặc Master Admin Secret)
 */
async function authorizeGiveawayRequest(
  request: Request,
  env: Env
): Promise<{ authorized: boolean; keyRecord?: any; error?: string }> {
  // 1. Kiểm tra Admin Cookie / Bearer JWT / Sync Key trước
  const adminCheck = await verifyAdminAuth(request, env);
  if (adminCheck.authorized) {
    return {
      authorized: true,
      keyRecord: { id: 'admin_session', key_name: 'Quản Trị Viên (Admin Session)', scope: 'ADMIN_FULL' },
    };
  }

  // 2. Kiểm tra API Key từ Header (X-Api-Key hoặc Authorization: Bearer <key>)
  if (env.DB) {
    const aiKeyCheck = await verifyAiKeyAuth(request, env.DB, env, 'GIVEAWAYS_FULL');
    if (aiKeyCheck.authorized && aiKeyCheck.keyRecord) {
      const scope = aiKeyCheck.keyRecord.scope;
      if (hasScope(scope, 'GIVEAWAYS_FULL')) {
        return {
          authorized: true,
          keyRecord: aiKeyCheck.keyRecord,
        };
      }
      return {
        authorized: false,
        error: `Khóa API '${aiKeyCheck.keyRecord.key_name}' không có quyền GIVEAWAYS_FULL (Phạm vi hiện tại: ${scope || 'NONE'}).`,
      };
    }
    if (aiKeyCheck.error) {
      return { authorized: false, error: aiKeyCheck.error };
    }
  }

  return {
    authorized: false,
    error: 'Từ chối truy cập. Yêu cầu đính kèm header X-Api-Key hoặc Authorization: Bearer có quyền GIVEAWAYS_FULL.',
  };
}

/**
 * Ghi nhật ký kiểm toán (Audit Log)
 */
async function logGiveawayAudit(
  db: D1Database | undefined,
  giveawayId: string,
  giveawayTitle: string,
  action: string,
  actor: string,
  details: string
) {
  if (!db) return;
  try {
    const id = `gw_audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    await db.prepare(`
      INSERT INTO mission_audit_logs (id, mission_id, mission_title, submission_id, user_id, action, actor, details, created_at)
      VALUES (?, ?, ?, '', '', ?, ?, ?, ?)
    `).bind(id, giveawayId, giveawayTitle, action, actor, details, nowIso).run().catch(() => {});
  } catch {}
}

/**
 * GET /api/giveaways/manage
 * Lấy danh sách toàn bộ chiến dịch giveaway kèm kho mã chi tiết, số lượng tồn thật và cấu hình mô phỏng
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

    const auth = await authorizeGiveawayRequest(request, env);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: auth.error || 'Quyền truy cập bị từ chối.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const url = new URL(request.url);
    const targetId = url.searchParams.get('id');
    const statusParam = (url.searchParams.get('status') || 'ALL').toUpperCase();
    const searchParam = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim().toLowerCase();

    // Tải danh sách chiến dịch đầy đủ kèm mã chi tiết từ D1
    const allGws = await loadAllGiveawaysD1(env.DB, true, true);

    // Lọc theo ID cụ thể nếu có
    if (targetId) {
      const found = allGws.find((g: any) => g.id === targetId);
      if (!found) {
        return new Response(
          JSON.stringify({ success: false, message: `Không tìm thấy chiến dịch giveaway với ID: ${targetId}` }),
          { status: 404, headers: CORS_HEADERS }
        );
      }
      return new Response(
        JSON.stringify({ success: true, giveaway: found }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Lọc theo trạng thái và từ khóa tìm kiếm
    let filtered = allGws;
    if (statusParam === 'ACTIVE') {
      filtered = filtered.filter((g: any) => g.is_active !== false && g.is_active !== 0 && g.status !== 'ENDED');
    } else if (statusParam === 'INACTIVE' || statusParam === 'PAUSED') {
      filtered = filtered.filter((g: any) => g.is_active === false || g.is_active === 0 || g.status === 'PAUSED');
    }

    if (searchParam) {
      filtered = filtered.filter((g: any) =>
        String(g.title || '').toLowerCase().includes(searchParam) ||
        String(g.game_slug || '').toLowerCase().includes(searchParam) ||
        String(g.game_name || '').toLowerCase().includes(searchParam)
      );
    }

    // Tính toán thống kê tổng quan
    let totalStock = 0;
    let totalClaimed = 0;
    let activeCount = 0;

    for (const gw of allGws) {
      const rem = Number(gw.remaining_codes || (Array.isArray(gw.codes_pool) ? gw.codes_pool.length : 0));
      const clm = Number(gw.claimed_codes || 0);
      totalStock += rem;
      totalClaimed += clm;
      if (gw.is_active !== false && gw.is_active !== 0) activeCount++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: allGws.length,
        filtered_count: filtered.length,
        active_count: activeCount,
        total_remaining_stock: totalStock,
        total_claimed_codes: totalClaimed,
        giveaways: filtered,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi xử lý yêu cầu GET giveaway.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * POST /api/giveaways/manage
 * Tạo mới hoặc cập nhật toàn diện một chiến dịch giveaway (hỗ trợ nạp mã kho ngay lúc tạo)
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

    const auth = await authorizeGiveawayRequest(request, env);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: auth.error || 'Quyền truy cập bị từ chối.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const body: any = await request.json().catch(() => ({}));
    const {
      title,
      game_slug,
      game_name,
      description = '',
      rewards = 'Code ngẫu nhiên',
      codes = [],
      codes_pool = [],
      use_template = true,
      min_account_age_days = 0,
      max_per_user = 1,
      max_per_ip = 1,
      cooldown_minutes = 60,
      cooldown_hours,
      global_cooldown_seconds = 0,
      enable_auto_simulation = true,
      simulation_idle_threshold_minutes = 0,
      virtual_remaining_addition = 20,
      virtual_remaining_current,
      virtual_claimed_offset = 0,
      show_claimed_count = true,
      custom_banner_enabled = true,
      custom_banner_text = 'Tham gia nhóm zalo của web tại đây',
      custom_banner_link = 'https://zalo.me/g/qdtlmj2tebfa0baraedg',
      custom_success_msg = '',
      custom_cooldown_msg = '',
      custom_out_of_stock_msg = '',
      enable_waiting_room = true,
      waiting_users_min = 25,
      waiting_users_max = 85,
      start_time = '',
      end_time = '',
      is_active = true,
      cover_image_url = '',
      packages = [],
    } = body;

    if (!title || !title.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'Thiếu trường bắt buộc: title (Tên đợt phát code).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const cleanGameSlug = String(game_slug || '').trim().toLowerCase() || 'game-vip';
    const cleanGameName = String(game_name || '').trim() || title.trim();

    // Tạo ID ổn định hoặc lấy ID truyền vào
    const id = body.id ? String(body.id).trim() : `gw_${cleanGameSlug}_${Date.now().toString(36)}`;

    // Xử lý mảng mã giftcode đưa vào kho
    const rawCodes = Array.isArray(codes) && codes.length > 0 ? codes : (Array.isArray(codes_pool) ? codes_pool : []);
    const incomingCodes = rawCodes.map((c: any) => String(c).trim()).filter(Boolean);

    // Tính toán cooldown
    const cdMinutes = cooldown_minutes !== undefined && cooldown_minutes !== null
      ? Number(cooldown_minutes)
      : (cooldown_hours !== undefined ? Number(cooldown_hours) * 60 : 60);
    const cdHours = cooldown_hours !== undefined ? Number(cooldown_hours) : Number((cdMinutes / 60).toFixed(2));

    // Lấy thông tin đợt phát hiện có nếu đang chỉnh sửa
    const existingList = await getSettingD1(env.DB, 'wcg_admin_giveaways_v4').catch(() => []);
    const existingItem = Array.isArray(existingList) ? existingList.find((g: any) => g && g.id === id) : null;
    const existingPool = Array.isArray(existingItem?.codes_pool) ? existingItem.codes_pool : [];

    const finalPool = incomingCodes.length > 0 ? incomingCodes : existingPool;
    const safeClaimed = Number(existingItem?.claimed_codes || body.claimed_codes || 0);
    const totalCount = finalPool.length + safeClaimed;

    const gwRecord: any = {
      id,
      title: title.trim(),
      game_slug: cleanGameSlug,
      game_name: cleanGameName,
      description: String(description || '').trim(),
      rewards: String(rewards || '').trim(),
      codes_pool: finalPool,
      total_codes: totalCount,
      remaining_codes: finalPool.length,
      claimed_codes: safeClaimed,
      use_template: use_template !== false,
      min_account_age_days: Number(min_account_age_days) || 0,
      max_per_user: Number(max_per_user) || 1,
      max_per_ip: Number(max_per_ip) || 1,
      cooldown_minutes: cdMinutes,
      cooldown_hours: cdHours,
      global_cooldown_seconds: Number(global_cooldown_seconds) || 0,
      last_global_claim_at: existingItem?.last_global_claim_at || '',
      last_claimer_name: existingItem?.last_claimer_name || '',
      enable_auto_simulation: enable_auto_simulation !== false,
      simulation_idle_threshold_minutes: Number(simulation_idle_threshold_minutes) || 0,
      virtual_remaining_addition: Math.max(0, Number(virtual_remaining_addition !== undefined ? virtual_remaining_addition : 20)),
      virtual_remaining_current: Math.max(0, Number(virtual_remaining_current !== undefined ? virtual_remaining_current : (virtual_remaining_addition || 20))),
      virtual_claimed_offset: Number(virtual_claimed_offset) || 0,
      show_claimed_count: show_claimed_count !== false,
      custom_banner_enabled: custom_banner_enabled !== false,
      custom_banner_text: String(custom_banner_text || 'Tham gia nhóm zalo của web tại đây').trim(),
      custom_banner_link: String(custom_banner_link || 'https://zalo.me/g/qdtlmj2tebfa0baraedg').trim(),
      custom_success_msg: String(custom_success_msg || '').trim(),
      custom_cooldown_msg: String(custom_cooldown_msg || '').trim(),
      custom_out_of_stock_msg: String(custom_out_of_stock_msg || '').trim(),
      enable_waiting_room: enable_waiting_room !== false,
      waiting_users_min: Number(waiting_users_min) || 25,
      waiting_users_max: Number(waiting_users_max) || 85,
      start_time: String(start_time || '').trim(),
      end_time: String(end_time || '').trim(),
      is_active: is_active !== false && is_active !== 0,
      cover_image_url: String(cover_image_url || '').trim(),
      packages: Array.isArray(packages) ? packages : [],
      updated_at: new Date().toISOString(),
    };

    // Lưu vào D1 (Tự động nạp mã vào bảng giveaway_codes)
    await syncGiveawaysToD1(env.DB, [gwRecord]);

    // Cập nhật metadata trong system_settings
    const updatedList = Array.isArray(existingList) ? [...existingList] : [];
    const idx = updatedList.findIndex((g: any) => g && g.id === id);
    if (idx >= 0) {
      updatedList[idx] = gwRecord;
    } else {
      updatedList.unshift(gwRecord);
    }
    await setSettingD1(env.DB, 'wcg_admin_giveaways_v4', updatedList);
    invalidateSettingMemoryCache('wcg_admin_giveaways_v4');

    // Xóa khỏi danh sách tombstones xóa nếu có
    const delList: any = await getSettingD1(env.DB, 'wcg_deleted_giveaways').catch(() => []);
    if (Array.isArray(delList) && delList.includes(id)) {
      const filteredDel = delList.filter((item: string) => item !== id);
      await setSettingD1(env.DB, 'wcg_deleted_giveaways', filteredDel);
      invalidateSettingMemoryCache('wcg_deleted_giveaways');
    }

    // Ghi nhật ký kiểm toán
    const actor = auth.keyRecord?.key_name || 'API Client';
    const actionDesc = existingItem ? 'Cập nhật chiến dịch Giveaway' : 'Tạo mới chiến dịch Giveaway';
    await logGiveawayAudit(
      env.DB,
      id,
      gwRecord.title,
      existingItem ? 'UPDATE_GIVEAWAY' : 'CREATE_GIVEAWAY',
      actor,
      `${actionDesc} "${gwRecord.title}", kho mã còn lại: ${finalPool.length}, đã săn: ${safeClaimed}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `${actionDesc} thành công!`,
        giveaway: gwRecord,
      }),
      { status: existingItem ? 200 : 201, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi xử lý yêu cầu POST giveaway.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * PUT /api/giveaways/manage
 * Thao tác nhanh: Nạp thêm mã giftcode, Bật/Tắt hoạt động, Reset hồi chiêu, Điều chỉnh mô phỏng
 */
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await authorizeGiveawayRequest(request, env);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: auth.error || 'Quyền truy cập bị từ chối.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const body: any = await request.json().catch(() => ({}));
    const action = String(body.action || '').toUpperCase().trim();
    const targetId = String(body.id || body.giveaway_id || '').trim();

    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Vui lòng cung cấp ID chiến dịch (id hoặc giveaway_id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const existingList: any[] = (await getSettingD1(env.DB, 'wcg_admin_giveaways_v4').catch(() => [])) || [];
    const targetIndex = existingList.findIndex((g: any) => g && g.id === targetId);

    if (targetIndex < 0) {
      return new Response(
        JSON.stringify({ success: false, message: `Không tìm thấy chiến dịch giveaway với ID: ${targetId}` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const currentGw = existingList[targetIndex];
    const actor = auth.keyRecord?.key_name || 'API Client';

    // 1. Nạp thêm danh sách mã code vào kho (action: ADD_CODES | RESTOCK)
    if (action === 'ADD_CODES' || action === 'RESTOCK' || Array.isArray(body.codes)) {
      const incomingCodes: string[] = (Array.isArray(body.codes) ? body.codes : (Array.isArray(body.codes_pool) ? body.codes_pool : []))
        .map((c: any) => String(c).trim())
        .filter(Boolean);

      if (incomingCodes.length === 0) {
        return new Response(
          JSON.stringify({ success: false, message: 'Vui lòng cung cấp mảng mã code cần nạp (codes: string[]).' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Nạp trực tiếp vào bảng giveaway_codes trong D1
      const BATCH_SIZE = 50;
      for (let j = 0; j < incomingCodes.length; j += BATCH_SIZE) {
        const slice = incomingCodes.slice(j, j + BATCH_SIZE);
        const stmts: D1PreparedStatement[] = slice.map((codeVal) => {
          const codeId = `gc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          return env.DB!.prepare(`
            INSERT INTO giveaway_codes (id, giveaway_id, code_value, status, created_at)
            VALUES (?, ?, ?, 'AVAILABLE', datetime('now'))
          `).bind(codeId, targetId, codeVal);
        });
        await env.DB.batch(stmts).catch((e) => console.warn('[Batch insert codes error]', e?.message));
      }

      // Cập nhật codes_pool trong metadata
      const oldPool = Array.isArray(currentGw.codes_pool) ? currentGw.codes_pool : [];
      const newPool = [...oldPool, ...incomingCodes];
      currentGw.codes_pool = newPool;
      currentGw.remaining_codes = newPool.length;
      currentGw.total_codes = newPool.length + Number(currentGw.claimed_codes || 0);
      currentGw.updated_at = new Date().toISOString();

      // Cập nhật remaining_codes trong bảng giveaways D1
      await env.DB.prepare(`
        UPDATE giveaways
        SET remaining_codes = ?, total_codes = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(newPool.length, currentGw.total_codes, targetId).run().catch(() => {});

      existingList[targetIndex] = currentGw;
      await setSettingD1(env.DB, 'wcg_admin_giveaways_v4', existingList);
      invalidateSettingMemoryCache('wcg_admin_giveaways_v4');

      await logGiveawayAudit(
        env.DB,
        targetId,
        currentGw.title,
        'RESTOCK_CODES',
        actor,
        `Đã nạp thêm ${incomingCodes.length} mã code mới vào kho. Tổng tồn kho hiện tại: ${newPool.length} mã.`
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: `Nạp thành công ${incomingCodes.length} mã code vào đợt phát "${currentGw.title}"!`,
          added_count: incomingCodes.length,
          total_remaining_codes: newPool.length,
          giveaway: currentGw,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 2. Bật / Tắt hoạt động (action: TOGGLE_ACTIVE)
    if (action === 'TOGGLE_ACTIVE') {
      const nextActive = body.is_active !== undefined ? Boolean(body.is_active) : !currentGw.is_active;
      currentGw.is_active = nextActive;
      currentGw.status = nextActive ? 'ACTIVE' : 'PAUSED';
      currentGw.updated_at = new Date().toISOString();

      await env.DB.prepare(`
        UPDATE giveaways
        SET is_active = ?, status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(nextActive ? 1 : 0, currentGw.status, targetId).run().catch(() => {});

      existingList[targetIndex] = currentGw;
      await setSettingD1(env.DB, 'wcg_admin_giveaways_v4', existingList);
      invalidateSettingMemoryCache('wcg_admin_giveaways_v4');

      await logGiveawayAudit(
        env.DB,
        targetId,
        currentGw.title,
        'TOGGLE_ACTIVE',
        actor,
        `Đã chuyển trạng thái chiến dịch sang: ${nextActive ? 'ĐANG MỞ (ACTIVE)' : 'TẠM DỪNG (PAUSED)'}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: `Đã ${nextActive ? 'kích hoạt' : 'tạm dừng'} chiến dịch "${currentGw.title}".`,
          is_active: nextActive,
          giveaway: currentGw,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 3. Reset thời gian hồi chiêu toàn sàn (action: RESET_COOLDOWN)
    if (action === 'RESET_COOLDOWN') {
      currentGw.last_global_claim_at = '';
      currentGw.updated_at = new Date().toISOString();

      await env.DB.prepare(`
        UPDATE giveaways
        SET last_global_claim_at = '', updated_at = datetime('now')
        WHERE id = ?
      `).bind(targetId).run().catch(() => {});

      existingList[targetIndex] = currentGw;
      await setSettingD1(env.DB, 'wcg_admin_giveaways_v4', existingList);
      invalidateSettingMemoryCache('wcg_admin_giveaways_v4');

      await logGiveawayAudit(
        env.DB,
        targetId,
        currentGw.title,
        'RESET_COOLDOWN',
        actor,
        `Đã xóa thời gian chờ toàn sàn. Người dùng có thể giật mã tiếp theo ngay lập tức.`
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: `Đã mở đợt phát ngay cho "${currentGw.title}". Khách có thể giật mã tiếp theo lập tức!`,
          giveaway: currentGw,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 4. Cập nhật thông số mô phỏng hiển thị (action: ADJUST_METRICS)
    if (action === 'ADJUST_METRICS' || action === 'UPDATE_CONFIG') {
      if (body.virtual_remaining_addition !== undefined) {
        currentGw.virtual_remaining_addition = Math.max(0, Number(body.virtual_remaining_addition));
        currentGw.virtual_remaining_current = currentGw.virtual_remaining_addition;
      }
      if (body.virtual_claimed_offset !== undefined) {
        currentGw.virtual_claimed_offset = Number(body.virtual_claimed_offset);
      }
      if (body.max_per_user !== undefined) currentGw.max_per_user = Number(body.max_per_user);
      if (body.max_per_ip !== undefined) currentGw.max_per_ip = Number(body.max_per_ip);
      if (body.cooldown_minutes !== undefined) currentGw.cooldown_minutes = Number(body.cooldown_minutes);
      if (body.global_cooldown_seconds !== undefined) currentGw.global_cooldown_seconds = Number(body.global_cooldown_seconds);

      currentGw.updated_at = new Date().toISOString();
      await syncGiveawaysToD1(env.DB, [currentGw]);

      existingList[targetIndex] = currentGw;
      await setSettingD1(env.DB, 'wcg_admin_giveaways_v4', existingList);
      invalidateSettingMemoryCache('wcg_admin_giveaways_v4');

      return new Response(
        JSON.stringify({
          success: true,
          message: `Cập nhật cấu hình thành công cho "${currentGw.title}".`,
          giveaway: currentGw,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: `Hành động không hợp lệ: "${action}". Các hành động được hỗ trợ: ADD_CODES, TOGGLE_ACTIVE, RESET_COOLDOWN, ADJUST_METRICS.`,
      }),
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi xử lý yêu cầu PUT giveaway.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

/**
 * DELETE /api/giveaways/manage
 * Xóa vĩnh viễn chiến dịch giveaway (Tombstone Deletion Pattern - Chống hồi sinh dữ liệu)
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    if (!env.DB) {
      return new Response(
        JSON.stringify({ success: false, message: 'D1 Database chưa được cấu hình.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const auth = await authorizeGiveawayRequest(request, env);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify({ success: false, message: auth.error || 'Quyền truy cập bị từ chối.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const url = new URL(request.url);
    const queryId = url.searchParams.get('id');
    const body: any = await request.json().catch(() => ({}));
    const targetId = String(queryId || body.id || '').trim();

    if (!targetId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Vui lòng cung cấp ID chiến dịch cần xóa (?id=... hoặc body.id).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Xóa khỏi D1 tables
    await env.DB.prepare('DELETE FROM giveaway_codes WHERE giveaway_id = ?').bind(targetId).run().catch(() => {});
    await env.DB.prepare('DELETE FROM giveaways WHERE id = ?').bind(targetId).run().catch(() => {});

    // 2. Thêm vào danh sách Tombstones để chống hồi sinh
    const delList: any = (await getSettingD1(env.DB, 'wcg_deleted_giveaways').catch(() => [])) || [];
    const delSet = new Set(Array.isArray(delList) ? delList : []);
    delSet.add(targetId);
    await setSettingD1(env.DB, 'wcg_deleted_giveaways', Array.from(delSet));
    invalidateSettingMemoryCache('wcg_deleted_giveaways');

    // 3. Xóa khỏi metadata trong system_settings
    const existingList: any[] = (await getSettingD1(env.DB, 'wcg_admin_giveaways_v4').catch(() => [])) || [];
    const filteredList = existingList.filter((g: any) => g && g.id !== targetId);
    await setSettingD1(env.DB, 'wcg_admin_giveaways_v4', filteredList);
    invalidateSettingMemoryCache('wcg_admin_giveaways_v4');

    // 4. Ghi nhật ký kiểm toán
    const actor = auth.keyRecord?.key_name || 'API Client';
    await logGiveawayAudit(
      env.DB,
      targetId,
      targetId,
      'DELETE_GIVEAWAY',
      actor,
      `Đã xóa vĩnh viễn chiến dịch giveaway "${targetId}" và đưa vào danh sách Tombstones.`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã xóa vĩnh viễn chiến dịch giveaway "${targetId}".`,
        deleted_id: targetId,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, message: error?.message || 'Lỗi xử lý yêu cầu DELETE giveaway.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
