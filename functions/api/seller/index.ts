import { verifyMemberAuth } from '../../services/mission_service';
import { ensureMarketplaceSchema, logAdminAudit } from '../../services/d1_service';
import { SellerRecord } from '../../services/marketplace_service';

interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ADMIN_SYNC_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8',
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

// GET: Lấy thông tin gian hàng của thành viên hiện tại
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const memberId = auth.member.id;

    // Tìm xem thành viên là chủ gian hàng hay tài khoản phụ
    let seller = await env.DB
      .prepare("SELECT * FROM sellers WHERE owner_member_id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(memberId)
      .first<SellerRecord>();

    let subRole: string | null = null;
    if (!seller) {
      const sub = await env.DB
        .prepare(`
          SELECT s.*, sa.role as sub_role 
          FROM seller_subaccounts sa
          JOIN sellers s ON sa.seller_id = s.id
          WHERE sa.member_id = ? AND s.deleted_at IS NULL
          LIMIT 1
        `)
        .bind(memberId)
        .first<any>();

      if (sub) {
        seller = sub;
        subRole = sub.sub_role;
      }
    }

    if (!seller) {
      return new Response(
        JSON.stringify({ success: true, has_seller: false }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Thống kê nhanh (§4)
    // 1. Doanh thu Core hôm nay
    const todayRevenue = await env.DB
      .prepare(`
        SELECT COALESCE(SUM(price_core), 0) as total
        FROM seller_orders
        WHERE seller_id = ? AND status IN ('PAID', 'DELIVERED') AND date(created_at) = date('now')
      `)
      .bind(seller.id)
      .first<{ total: number }>();

    // 2. Doanh thu 30 ngày qua
    const monthRevenue = await env.DB
      .prepare(`
        SELECT COALESCE(SUM(price_core), 0) as total
        FROM seller_orders
        WHERE seller_id = ? AND status IN ('PAID', 'DELIVERED') AND datetime(created_at) >= datetime('now', '-30 days')
      `)
      .bind(seller.id)
      .first<{ total: number }>();

    // 3. Đơn chờ xử lý báo lỗi
    const reportedOrdersCount = await env.DB
      .prepare(`
        SELECT COUNT(*) as count
        FROM seller_orders
        WHERE seller_id = ? AND status = 'REPORTED'
      `)
      .bind(seller.id)
      .first<{ count: number }>();

    // 4. Sản phẩm cảnh báo kho thấp
    const lowStockCount = await env.DB
      .prepare(`
        SELECT COUNT(*) as count
        FROM seller_products sp
        WHERE sp.seller_id = ? AND sp.deleted_at IS NULL AND sp.status = 'APPROVED'
          AND (
            SELECT COUNT(*) FROM seller_codes sc 
            WHERE sc.product_id = sp.id AND sc.status = 'IN_STOCK' AND sc.deleted_at IS NULL
          ) <= sp.low_stock_threshold
      `)
      .bind(seller.id)
      .first<{ count: number }>();

    // 5. Tổng số sản phẩm đang có
    const totalProducts = await env.DB
      .prepare("SELECT COUNT(*) as count FROM seller_products WHERE seller_id = ? AND deleted_at IS NULL")
      .bind(seller.id)
      .first<{ count: number }>();

    return new Response(
      JSON.stringify({
        success: true,
        has_seller: true,
        seller,
        is_subaccount: Boolean(subRole),
        sub_role: subRole,
        stats: {
          today_revenue_core: todayRevenue?.total || 0,
          month_revenue_core: monthRevenue?.total || 0,
          reported_orders_count: reportedOrdersCount?.count || 0,
          low_stock_products_count: lowStockCount?.count || 0,
          total_products: totalProducts?.count || 0,
          pending_balance_core: seller.pending_balance_core || 0,
          reputation_score: seller.reputation_score || 100,
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

// POST: Đăng ký mở gian hàng mới
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập để đăng ký gian hàng.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const member = auth.member;
    const body = (await request.json().catch(() => ({}))) as any;
    const {
      name,
      slug,
      contact_phone,
      bank_name,
      bank_account,
      bank_account_name,
      description,
      support_hours,
      warranty_policy,
      refund_policy,
    } = body;

    if (!name || name.trim().length < 3 || name.trim().length > 50) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tên gian hàng phải từ 3 đến 50 ký tự.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const cleanSlug = (slug || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!cleanSlug || cleanSlug.length < 3 || cleanSlug.length > 50) {
      return new Response(
        JSON.stringify({ success: false, error: 'Đường dẫn gian hàng (slug) không hợp lệ (3-50 ký tự thường, số, dấu gạch ngang).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Kiểm tra 1 shop / 1 member
    const existingOwnShop = await env.DB
      .prepare("SELECT id, status, reject_reason FROM sellers WHERE owner_member_id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(member.id)
      .first<any>();

    if (existingOwnShop) {
      if (existingOwnShop.status === 'PENDING') {
        return new Response(
          JSON.stringify({ success: false, error: 'Hồ sơ gian hàng của bạn đang chờ quản trị viên duyệt.' }),
          { status: 409, headers: CORS_HEADERS }
        );
      }
      if (existingOwnShop.status === 'TRIAL' || existingOwnShop.status === 'ACTIVE') {
        return new Response(
          JSON.stringify({ success: false, error: 'Mỗi thành viên chỉ được sở hữu 1 gian hàng duy nhất.' }),
          { status: 409, headers: CORS_HEADERS }
        );
      }
    }

    // 2. Kiểm tra trùng slug hoặc tên với shop khác
    const conflictCheck = await env.DB
      .prepare("SELECT id FROM sellers WHERE (slug = ? OR name = ?) AND id != COALESCE(?, '') AND deleted_at IS NULL LIMIT 1")
      .bind(cleanSlug, name.trim(), existingOwnShop?.id || null)
      .first<any>();

    if (conflictCheck) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tên gian hàng hoặc đường dẫn (slug) đã được người khác sử dụng.' }),
        { status: 409, headers: CORS_HEADERS }
      );
    }

    // 3. Kiểm tra số tài khoản ngân hàng trùng nếu có nhập
    if (bank_account && bank_account.trim()) {
      const bankConflict = await env.DB
        .prepare("SELECT id FROM sellers WHERE bank_account = ? AND id != COALESCE(?, '') AND deleted_at IS NULL LIMIT 1")
        .bind(bank_account.trim(), existingOwnShop?.id || null)
        .first<any>();

      if (bankConflict) {
        return new Response(
          JSON.stringify({ success: false, error: 'Số tài khoản ngân hàng này đã được liên kết với một gian hàng khác.' }),
          { status: 409, headers: CORS_HEADERS }
        );
      }
    }

    const sellerId = existingOwnShop?.id || `sel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    if (existingOwnShop) {
      // Cập nhật lại hồ sơ nộp lại
      await env.DB
        .prepare(`
          UPDATE sellers
          SET name = ?, slug = ?, contact_phone = ?, bank_name = ?, bank_account = ?, bank_account_name = ?,
              description = ?, support_hours = ?, warranty_policy = ?, refund_policy = ?,
              status = 'PENDING', reject_reason = NULL, request_info_note = NULL, updated_at = ?
          WHERE id = ?
        `)
        .bind(
          name.trim(),
          cleanSlug,
          contact_phone?.trim() || null,
          bank_name?.trim() || null,
          bank_account?.trim() || null,
          bank_account_name?.trim() || null,
          description?.trim() || null,
          support_hours?.trim() || '08:00 - 22:00',
          warranty_policy?.trim() || null,
          refund_policy?.trim() || null,
          nowIso,
          sellerId
        )
        .run();
    } else {
      await env.DB
        .prepare(`
          INSERT INTO sellers (
            id, owner_member_id, name, slug, contact_phone, bank_name, bank_account, bank_account_name,
            description, support_hours, warranty_policy, refund_policy, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
        `)
        .bind(
          sellerId,
          member.id,
          name.trim(),
          cleanSlug,
          contact_phone?.trim() || null,
          bank_name?.trim() || null,
          bank_account?.trim() || null,
          bank_account_name?.trim() || null,
          description?.trim() || null,
          support_hours?.trim() || '08:00 - 22:00',
          warranty_policy?.trim() || null,
          refund_policy?.trim() || null,
          nowIso,
          nowIso
        )
        .run();
    }

    // Ghi audit log
    await logAdminAudit(env.DB, {
      actorName: member.username || member.email,
      actorEmail: member.email,
      action: 'SELLER_REGISTER',
      targetId: sellerId,
      details: { name: name.trim(), slug: cleanSlug },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Hồ sơ mở gian hàng đã được gửi và đang chờ duyệt.',
        seller_id: sellerId,
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

// PUT: Cập nhật thông tin gian hàng (giờ hỗ trợ, chính sách, mô tả, avatar, cover)
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const memberId = auth.member.id;
    const body = (await request.json().catch(() => ({}))) as any;

    const seller = await env.DB
      .prepare("SELECT * FROM sellers WHERE owner_member_id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(memberId)
      .first<SellerRecord>();

    if (!seller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chỉ chủ gian hàng mới có quyền cập nhật thông tin này.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const {
      description,
      support_hours,
      warranty_policy,
      refund_policy,
      avatar_url,
      cover_url,
      contact_phone,
    } = body;

    const nowIso = new Date().toISOString();

    await env.DB
      .prepare(`
        UPDATE sellers
        SET description = COALESCE(?, description),
            support_hours = COALESCE(?, support_hours),
            warranty_policy = COALESCE(?, warranty_policy),
            refund_policy = COALESCE(?, refund_policy),
            avatar_url = COALESCE(?, avatar_url),
            cover_url = COALESCE(?, cover_url),
            contact_phone = COALESCE(?, contact_phone),
            updated_at = ?
        WHERE id = ?
      `)
      .bind(
        description !== undefined ? description : null,
        support_hours !== undefined ? support_hours : null,
        warranty_policy !== undefined ? warranty_policy : null,
        refund_policy !== undefined ? refund_policy : null,
        avatar_url !== undefined ? avatar_url : null,
        cover_url !== undefined ? cover_url : null,
        contact_phone !== undefined ? contact_phone : null,
        nowIso,
        seller.id
      )
      .run();

    return new Response(
      JSON.stringify({ success: true, message: 'Đã cập nhật thông tin gian hàng.' }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};

// PATCH: Bật/tắt chế độ nghỉ bán 1 chạm (§6.4)
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    await ensureMarketplaceSchema(env.DB);
    const auth = await verifyMemberAuth(request, env as any);
    if (!auth.authorized || !auth.member) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error || 'Vui lòng đăng nhập.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const memberId = auth.member.id;
    const body = (await request.json().catch(() => ({}))) as any;
    const { is_vacation } = body;

    const seller = await env.DB
      .prepare("SELECT * FROM sellers WHERE owner_member_id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(memberId)
      .first<SellerRecord>();

    if (!seller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chỉ chủ gian hàng mới có quyền bật/tắt chế độ nghỉ bán.' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const vacationVal = is_vacation ? 1 : 0;
    await env.DB
      .prepare("UPDATE sellers SET is_vacation = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(vacationVal, seller.id)
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        is_vacation: vacationVal,
        message: vacationVal === 1 ? 'Đã bật chế độ nghỉ bán. Toàn bộ sản phẩm sẽ tạm ẩn ngoài web khách.' : 'Đã tắt chế độ nghỉ bán. Gian hàng đã mở lại bình thường.',
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Lỗi hệ thống.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
};
