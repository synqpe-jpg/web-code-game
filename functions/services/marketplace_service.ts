/**
 * Marketplace Service (Sàn TMĐT Số - Nền Gian Hàng MVP)
 * Handles encryption, batch validation, stock lifecycle, seller permission checks,
 * atomic Core transactions, and dispute resolutions.
 */

export interface SellerRecord {
  id: string;
  owner_member_id: string;
  name: string;
  slug: string;
  contact_phone?: string;
  bank_name?: string;
  bank_account?: string;
  bank_account_name?: string;
  avatar_url?: string;
  cover_url?: string;
  description?: string;
  support_hours: string;
  warranty_policy?: string;
  refund_policy?: string;
  status: 'PENDING' | 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  reject_reason?: string;
  request_info_note?: string;
  is_vacation: number;
  trial_product_limit: number;
  trial_order_max: number;
  reputation_score: number;
  pending_balance_core: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SellerProductRecord {
  id: string;
  seller_id: string;
  game_slug: string;
  game_name?: string;
  name: string;
  cover_url: string;
  description?: string;
  price_core: number;
  original_price_core?: number;
  ceiling_price_core?: number;
  warranty_type: string;
  warranty_hours: number;
  delivery_type: 'AUTO' | 'MANUAL';
  low_stock_threshold: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  reject_reason?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SellerCodeRecord {
  id: string;
  seller_id: string;
  product_id: string;
  code_encrypted: string;
  code_hash?: string;
  status: 'IN_STOCK' | 'RESERVED' | 'SOLD' | 'REPORTED' | 'RECALLED';
  order_id?: string;
  batch_id?: string;
  sold_at?: string;
  reported_at?: string;
  recalled_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SellerOrderRecord {
  id: string;
  order_code: string;
  buyer_member_id: string;
  buyer_name?: string;
  buyer_email?: string;
  seller_id: string;
  product_id: string;
  product_name: string;
  game_slug?: string;
  code_id?: string;
  delivered_code?: string;
  price_core: number;
  status: 'PENDING_PAYMENT' | 'PAID' | 'DELIVERED' | 'REPORTED' | 'REFUNDED' | 'CANCELLED';
  report_reason?: string;
  report_note?: string;
  reported_at?: string;
  resolution_type?: 'REPLACE_CODE' | 'REFUND_CORE';
  resolution_note?: string;
  resolved_at?: string;
  replacement_code_id?: string;
  replacement_code?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

// Băm SHA-256 mã code để kiểm tra trùng lặp
export async function hashCode(code: string): Promise<string> {
  const clean = code.trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(clean);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Mã hóa mã code an toàn chuẩn AES-GCM với Web Crypto
// BẮT BUỘC dùng biến môi trường MARKETPLACE_CODE_KEY; cấm hardcode, cấm fallback sang dạng đọc được
export async function encryptCode(code: string, secretKeyStr?: string): Promise<string> {
  if (!secretKeyStr || typeof secretKeyStr !== 'string' || !secretKeyStr.trim()) {
    throw new Error('Chưa cấu hình biến môi trường MARKETPLACE_CODE_KEY trên máy chủ.');
  }

  const clean = code.trim();
  if (!clean) {
    throw new Error('Mã code không được để trống.');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(clean);
  const keyData = encoder.encode(secretKeyStr.padEnd(32, '0').slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
  
  // Ghép iv và ciphertext thành chuỗi hex có tiền tố enc_v1
  const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join('');
  const encryptedArray = Array.from(new Uint8Array(encrypted));
  const cipherHex = encryptedArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `enc_v1:${ivHex}:${cipherHex}`;
}

// Giải mã mã code (BẮT BUỘC dùng MARKETPLACE_CODE_KEY; cấm fallback base64)
export async function decryptCode(cipherText: string, secretKeyStr?: string): Promise<string> {
  if (!secretKeyStr || typeof secretKeyStr !== 'string' || !secretKeyStr.trim()) {
    throw new Error('Chưa cấu hình biến môi trường MARKETPLACE_CODE_KEY trên máy chủ.');
  }

  if (!cipherText || typeof cipherText !== 'string') {
    throw new Error('Dữ liệu mã hóa không hợp lệ.');
  }

  if (!cipherText.startsWith('enc_v1:')) {
    throw new Error('Định dạng mã hóa không hợp lệ hoặc không được hỗ trợ.');
  }

  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new Error('Cấu trúc mã hóa enc_v1 không hợp lệ.');
  }

  const ivHex = parts[1];
  const cipherHex = parts[2];
  const ivMatches = ivHex.match(/.{1,2}/g);
  const cipherMatches = cipherHex.match(/.{1,2}/g);

  if (!ivMatches || !cipherMatches) {
    throw new Error('Dữ liệu hex mã hóa bị hỏng.');
  }

  const iv = new Uint8Array(ivMatches.map((byte) => parseInt(byte, 16)));
  const cipherBytes = new Uint8Array(cipherMatches.map((byte) => parseInt(byte, 16)));
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKeyStr.padEnd(32, '0').slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, cipherBytes);
  return new TextDecoder().decode(decrypted);
}

// Ẩn một phần mã code để bảo vệ bí mật
export function maskCode(code: string): string {
  const clean = code.trim();
  if (clean.length <= 4) return '••••••';
  if (clean.length <= 8) return clean.slice(0, 2) + '••••' + clean.slice(-2);
  return clean.slice(0, 3) + '••••••' + clean.slice(-3);
}

// Kiểm tra quyền của Member đối với Gian hàng
export async function verifySellerAccess(
  db: D1Database,
  memberId: string,
  sellerId: string,
  requiredRole: 'ANY' | 'MANAGE_STOCK' | 'OWNER' = 'ANY'
): Promise<{ allowed: boolean; role?: 'OWNER' | 'MANAGE_STOCK' | 'VIEW_ORDERS'; seller?: SellerRecord; error?: string }> {
  // 1. Kiểm tra có phải Owner
  const seller = await db
    .prepare("SELECT * FROM sellers WHERE id = ? AND deleted_at IS NULL LIMIT 1")
    .bind(sellerId)
    .first<SellerRecord>();

  if (!seller) {
    return { allowed: false, error: 'Gian hàng không tồn tại hoặc đã bị xóa.' };
  }

  if (seller.owner_member_id === memberId) {
    return { allowed: true, role: 'OWNER', seller };
  }

  if (requiredRole === 'OWNER') {
    return { allowed: false, error: 'Chỉ chủ gian hàng mới có quyền thực hiện thao tác này.' };
  }

  // 2. Kiểm tra subaccount
  const sub = await db
    .prepare("SELECT * FROM seller_subaccounts WHERE seller_id = ? AND member_id = ? LIMIT 1")
    .bind(sellerId, memberId)
    .first<any>();

  if (!sub) {
    return { allowed: false, error: 'Bạn không có quyền truy cập gian hàng này.' };
  }

  if (requiredRole === 'MANAGE_STOCK' && sub.role !== 'MANAGE_STOCK') {
    return { allowed: false, error: 'Tài khoản phụ cần quyền Quản lý kho (MANAGE_STOCK).' };
  }

  return { allowed: true, role: sub.role, seller };
}

// Cấu hình sàn TMĐT & Hạn mức thử việc (TRIAL) & Giai đoạn 2 (Tiền thật, Phí, Giữ tiền, Rút tiền)
export interface MarketplaceConfig {
  default_trial_product_limit: number;
  default_trial_order_max: number;
  batch_freeze_error_rate: number;
  min_batch_size_for_freeze: number;
  // Giai đoạn 2
  hold_hours: number; // Mặc định 168 giờ (7 ngày)
  fee_rate: number; // Mặc định 0.05 (5%)
  withdraw_approval_threshold_core: number; // Mặc định 500 Core
  test_seller_ids: string[]; // Danh sách gian hàng thử nghiệm bán tiền thật
}

export const DEFAULT_MARKETPLACE_CONFIG: MarketplaceConfig = {
  default_trial_product_limit: 5,
  default_trial_order_max: 200,
  batch_freeze_error_rate: 0.25,
  min_batch_size_for_freeze: 5,
  hold_hours: 168,
  fee_rate: 0.05,
  withdraw_approval_threshold_core: 500,
  test_seller_ids: ['sel_1794399949383_052f1'], // Test Key Shop
};

// Interface các thực thể Giai đoạn 2
export interface SellerParentOrderRecord {
  id: string;
  parent_order_code: string;
  buyer_member_id: string;
  buyer_email?: string;
  total_amount: number;
  payment_method: 'CORE' | 'QR_SEPAY';
  status: 'PENDING_PAYMENT' | 'PARTIALLY_PAID' | 'PAID' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  expires_at: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface SellerLedgerRecord {
  id: string;
  seller_id: string;
  order_id?: string | null;
  type: 'HOLD' | 'RELEASE' | 'FEE' | 'WITHDRAW' | 'REFUND' | 'ADJUST';
  amount_core: number;
  balance_held_after: number;
  balance_available_after: number;
  balance_withdrawn_after: number;
  actor: string;
  reason: string;
  created_at: string;
}

export interface SellerWithdrawalRecord {
  id: string;
  seller_id: string;
  amount_core: number;
  bank_name: string;
  bank_account: string;
  bank_account_name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  requested_by: string;
  reviewed_by?: string;
  review_note?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface ReconciliationRunRecord {
  id: string;
  run_date: string;
  total_orders: number;
  total_sepay_transactions: number;
  total_ledger_lines: number;
  matched_count: number;
  exception_count: number;
  status: 'COMPLETED' | 'COMPLETED_WITH_EXCEPTIONS';
  created_at: string;
}

export interface ReconciliationExceptionRecord {
  id: string;
  run_id: string;
  source: 'ORDERS' | 'SEPAY' | 'LEDGER';
  reference_id: string;
  expected_amount: number;
  actual_amount: number;
  suggested_cause: string;
  status: 'OPEN' | 'RESOLVED';
  resolved_by?: string;
  resolved_note?: string;
  created_at: string;
  updated_at: string;
}

// Đọc cấu hình sàn TMĐT từ D1 (system_settings), có fallback mặc định an toàn
export async function getMarketplaceConfig(db: D1Database): Promise<MarketplaceConfig> {
  try {
    const row = await db
      .prepare("SELECT value FROM system_settings WHERE key = 'wcg_marketplace_config_v1' LIMIT 1")
      .first<{ value: string }>();

    if (row && row.value) {
      const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      const testIds = Array.isArray(parsed.test_seller_ids)
        ? parsed.test_seller_ids
        : (typeof parsed.test_seller_ids === 'string' ? parsed.test_seller_ids.split(',').map((s: string) => s.trim()).filter(Boolean) : DEFAULT_MARKETPLACE_CONFIG.test_seller_ids);

      return {
        default_trial_product_limit: Number(parsed.default_trial_product_limit) || DEFAULT_MARKETPLACE_CONFIG.default_trial_product_limit,
        default_trial_order_max: Number(parsed.default_trial_order_max) || DEFAULT_MARKETPLACE_CONFIG.default_trial_order_max,
        batch_freeze_error_rate: typeof parsed.batch_freeze_error_rate === 'number'
          ? parsed.batch_freeze_error_rate
          : (parseFloat(parsed.batch_freeze_error_rate) || DEFAULT_MARKETPLACE_CONFIG.batch_freeze_error_rate),
        min_batch_size_for_freeze: Number(parsed.min_batch_size_for_freeze) || DEFAULT_MARKETPLACE_CONFIG.min_batch_size_for_freeze,
        hold_hours: Number(parsed.hold_hours) >= 0 ? Number(parsed.hold_hours) : DEFAULT_MARKETPLACE_CONFIG.hold_hours,
        fee_rate: typeof parsed.fee_rate === 'number' ? parsed.fee_rate : (parseFloat(parsed.fee_rate) >= 0 ? parseFloat(parsed.fee_rate) : DEFAULT_MARKETPLACE_CONFIG.fee_rate),
        withdraw_approval_threshold_core: Number(parsed.withdraw_approval_threshold_core) >= 0 ? Number(parsed.withdraw_approval_threshold_core) : DEFAULT_MARKETPLACE_CONFIG.withdraw_approval_threshold_core,
        test_seller_ids: testIds.length > 0 ? testIds : DEFAULT_MARKETPLACE_CONFIG.test_seller_ids,
      };
    }
  } catch (err) {
    console.warn('[getMarketplaceConfig error]', err);
  }
  return { ...DEFAULT_MARKETPLACE_CONFIG };
}

// Kiểm tra xem gian hàng có nằm trong danh sách được phép bán tiền thật (QR) không (§1.11)
export function isTestSellerAllowed(config: MarketplaceConfig, sellerId: string): boolean {
  if (!config.test_seller_ids || config.test_seller_ids.length === 0) {
    return false;
  }
  return config.test_seller_ids.includes(sellerId);
}

// Ghi một dòng vào sổ cái seller_ledger (APPEND-ONLY) và cập nhật 3 ngăn số dư của gian hàng
export async function recordLedgerTransaction(
  db: D1Database,
  params: {
    sellerId: string;
    orderId?: string | null;
    type: 'HOLD' | 'RELEASE' | 'FEE' | 'WITHDRAW' | 'REFUND' | 'ADJUST';
    amountCore: number;
    actor: string;
    reason: string;
    isOrderAlreadyReleased?: boolean;
  }
): Promise<{
  success: boolean;
  ledgerId?: string;
  balance_held_after: number;
  balance_available_after: number;
  balance_withdrawn_after: number;
  error?: string;
}> {
  try {
    const { sellerId, orderId, type, amountCore, actor, reason, isOrderAlreadyReleased } = params;

    // 1. Đọc số dư hiện tại của seller
    const seller = await db
      .prepare(`
        SELECT id, pending_balance_core, available_balance_core, withdrawn_balance_core 
        FROM sellers 
        WHERE id = ? LIMIT 1
      `)
      .bind(sellerId)
      .first<any>();

    if (!seller) {
      return {
        success: false,
        error: `Không tìm thấy gian hàng ${sellerId} để ghi sổ cái.`,
        balance_held_after: 0,
        balance_available_after: 0,
        balance_withdrawn_after: 0,
      };
    }

    const currentHeld = Number(seller.pending_balance_core) || 0;
    const currentAvailable = Number(seller.available_balance_core) || 0;
    const currentWithdrawn = Number(seller.withdrawn_balance_core) || 0;

    let newHeld = currentHeld;
    let newAvailable = currentAvailable;
    let newWithdrawn = currentWithdrawn;
    const absAmount = Math.abs(amountCore);

    switch (type) {
      case 'HOLD':
        newHeld = currentHeld + absAmount;
        break;
      case 'RELEASE':
        newHeld = Math.max(0, currentHeld - absAmount);
        newAvailable = currentAvailable + absAmount;
        break;
      case 'FEE':
        newAvailable = Math.max(0, currentAvailable - absAmount);
        break;
      case 'WITHDRAW':
        newAvailable = Math.max(0, currentAvailable - absAmount);
        newWithdrawn = currentWithdrawn + absAmount;
        break;
      case 'REFUND':
        if (isOrderAlreadyReleased) {
          newAvailable = Math.max(0, currentAvailable - absAmount);
        } else {
          newHeld = Math.max(0, currentHeld - absAmount);
        }
        break;
      case 'ADJUST':
        // Nếu amountCore > 0 thì cộng vào available, ngược lại trừ
        if (amountCore >= 0) {
          newAvailable = currentAvailable + amountCore;
        } else {
          newAvailable = Math.max(0, currentAvailable + amountCore);
        }
        break;
      default:
        return {
          success: false,
          error: `Loại giao dịch sổ cái ${type} không hợp lệ.`,
          balance_held_after: currentHeld,
          balance_available_after: currentAvailable,
          balance_withdrawn_after: currentWithdrawn,
        };
    }

    const ledgerId = `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    // Thực thi nguyên tử ghi sổ cái APPEND-ONLY và cập nhật số dư seller
    await db.batch([
      db.prepare(`
        INSERT INTO seller_ledger (
          id, seller_id, order_id, type, amount_core,
          balance_held_after, balance_available_after, balance_withdrawn_after,
          actor, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        ledgerId,
        sellerId,
        orderId || null,
        type,
        amountCore,
        newHeld,
        newAvailable,
        newWithdrawn,
        actor,
        reason,
        nowIso
      ),
      db.prepare(`
        UPDATE sellers
        SET pending_balance_core = ?,
            available_balance_core = ?,
            withdrawn_balance_core = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(newHeld, newAvailable, newWithdrawn, nowIso, sellerId),
    ]);

    return {
      success: true,
      ledgerId,
      balance_held_after: newHeld,
      balance_available_after: newAvailable,
      balance_withdrawn_after: newWithdrawn,
    };
  } catch (err: any) {
    console.error('[recordLedgerTransaction error]', err);
    return {
      success: false,
      error: err?.message || 'Lỗi khi ghi sổ cái.',
      balance_held_after: 0,
      balance_available_after: 0,
      balance_withdrawn_after: 0,
    };
  }
}

// Quét và tự động giải ngân các đơn hàng sàn đã hết thời gian giữ tiền (§6.1)
export async function releaseDueSellerOrders(
  db: D1Database,
  actor = 'system_cron'
): Promise<{ processed: number; successCount: number; errors: string[] }> {
  const config = await getMarketplaceConfig(db);
  const nowIso = new Date().toISOString();

  // Tìm các đơn con PAID, đã qua hold_until, không bị khiếu nại/báo cáo, chưa giải ngân
  const dueOrdersRes = await db
    .prepare(`
      SELECT * FROM seller_orders
      WHERE status = 'PAID'
        AND hold_until IS NOT NULL
        AND datetime(hold_until) <= datetime('now')
        AND (report_reason IS NULL OR status != 'REPORTED')
        AND deleted_at IS NULL
      LIMIT 100
    `)
    .all<SellerOrderRecord>();

  const dueOrders = dueOrdersRes?.results || [];
  let successCount = 0;
  const errors: string[] = [];

  for (const order of dueOrders) {
    try {
      const priceCore = Number(order.price_core) || 0;
      const feeRate = config.fee_rate || 0.05;
      const feeCore = Math.round(priceCore * feeRate);

      // 1. Ghi dòng RELEASE (giải ngân toàn bộ tiền đơn từ pending sang available)
      const releaseRes = await recordLedgerTransaction(db, {
        sellerId: order.seller_id,
        orderId: order.id,
        type: 'RELEASE',
        amountCore: priceCore,
        actor,
        reason: `Giải ngân tự động sau khi hết ${config.hold_hours}h giữ tiền (Đơn ${order.order_code})`,
      });

      if (!releaseRes.success) {
        errors.push(`Đơn ${order.id}: ${releaseRes.error}`);
        continue;
      }

      // 2. Ghi dòng FEE (khấu trừ phí sàn từ ngăn available)
      if (feeCore > 0) {
        await recordLedgerTransaction(db, {
          sellerId: order.seller_id,
          orderId: order.id,
          type: 'FEE',
          amountCore: feeCore,
          actor,
          reason: `Thu phí sàn ${feeRate * 100}% cho đơn ${order.order_code}`,
        });
      }

      // 3. Cập nhật trạng thái đơn sang COMPLETED
      await db
        .prepare(`
          UPDATE seller_orders
          SET status = 'COMPLETED',
              released_at = ?,
              fee_core = ?,
              updated_at = ?
          WHERE id = ? AND status = 'PAID'
        `)
        .bind(nowIso, feeCore, nowIso, order.id)
        .run();

      successCount++;
    } catch (err: any) {
      errors.push(`Đơn ${order.id}: ${err?.message || 'Lỗi xử lý giải ngân'}`);
    }
  }

  return {
    processed: dueOrders.length,
    successCount,
    errors,
  };
}

// Đối soát 3 nguồn hằng ngày (Sổ đơn - SePay - Sổ cái) (§7)
export async function runDailyReconciliation(
  db: D1Database,
  targetDateStr?: string,
  actor = 'system'
): Promise<{
  runId: string;
  runDate: string;
  totalOrders: number;
  totalSepay: number;
  totalLedger: number;
  matchedCount: number;
  exceptionCount: number;
  status: 'COMPLETED' | 'COMPLETED_WITH_EXCEPTIONS';
  exceptions: ReconciliationExceptionRecord[];
}> {
  // Xác định ngày đối soát (mặc định hôm qua giờ VN: UTC+7)
  let runDate = targetDateStr;
  if (!runDate) {
    const d = new Date(Date.now() + 7 * 3600 * 1000 - 24 * 3600 * 1000);
    runDate = d.toISOString().slice(0, 10);
  }

  const runId = `rec_${runDate.replace(/-/g, '')}_${Date.now().toString(36)}`;
  const exceptions: ReconciliationExceptionRecord[] = [];
  const nowIso = new Date().toISOString();

  // 1. Sổ đơn: Tất cả đơn con sàn trong ngày (PAID, COMPLETED, REFUNDED)
  const ordersRes = await db
    .prepare(`
      SELECT id, order_code, seller_id, price_core, status, sepay_transaction_id, fee_core, refund_core, created_at
      FROM seller_orders
      WHERE date(created_at, '+7 hours') = ?
        AND status IN ('PAID', 'COMPLETED', 'REFUNDED')
        AND deleted_at IS NULL
    `)
    .bind(runDate)
    .all<any>();
  const orders = ordersRes?.results || [];

  // 2. Giao dịch SePay: Các giao dịch khớp đơn con trong ngày
  const sepayRes = await db
    .prepare(`
      SELECT transaction_id, amount_in, status, note, created_at
      FROM sepay_transactions
      WHERE date(created_at, '+7 hours') = ?
        AND status = 'SUCCESS'
        AND (note LIKE '%ORD-QR-%' OR note LIKE '%ORD-%')
    `)
    .bind(runDate)
    .all<any>();
  const sepayTxs = sepayRes?.results || [];

  // 3. Sổ cái: Các dòng ledger trong ngày
  const ledgerRes = await db
    .prepare(`
      SELECT id, seller_id, order_id, type, amount_core, created_at
      FROM seller_ledger
      WHERE date(created_at, '+7 hours') = ?
    `)
    .bind(runDate)
    .all<any>();
  const ledgerLines = ledgerRes?.results || [];

  let matchedCount = 0;

  // Đối chiếu từng đơn con
  for (const ord of orders) {
    // Tìm giao dịch SePay tương ứng nếu đơn thanh toán bằng QR_SEPAY
    if (ord.sepay_transaction_id) {
      const tx = sepayTxs.find((t: any) => t.transaction_id === ord.sepay_transaction_id);
      if (!tx) {
        exceptions.push({
          id: `ex_${runId}_${ord.id}_notx`,
          run_id: runId,
          source: 'SEPAY',
          reference_id: ord.sepay_transaction_id,
          expected_amount: ord.price_core,
          actual_amount: 0,
          suggested_cause: `Đơn ${ord.order_code} gắn mã giao dịch ${ord.sepay_transaction_id} nhưng không tìm thấy trong sepay_transactions thành công của ngày.`,
          status: 'OPEN',
          created_at: nowIso,
          updated_at: nowIso,
        });
      } else if (Number(tx.amount_in) !== Number(ord.price_core)) {
        exceptions.push({
          id: `ex_${runId}_${ord.id}_amt`,
          run_id: runId,
          source: 'ORDERS',
          reference_id: ord.order_code,
          expected_amount: ord.price_core,
          actual_amount: Number(tx.amount_in),
          suggested_cause: `Lệch số tiền: Đơn ${ord.order_code} giá ${ord.price_core} Core nhưng SePay nhận ${tx.amount_in}đ.`,
          status: 'OPEN',
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    }

    // Kiểm tra dòng sổ cái HOLD tương ứng với đơn con này
    const holdLine = ledgerLines.find((l: any) => l.order_id === ord.id && l.type === 'HOLD');
    if (!holdLine) {
      exceptions.push({
        id: `ex_${runId}_${ord.id}_noheld`,
        run_id: runId,
        source: 'LEDGER',
        reference_id: ord.order_code,
        expected_amount: ord.price_core,
        actual_amount: 0,
        suggested_cause: `Đơn ${ord.order_code} ở trạng thái ${ord.status} nhưng chưa có dòng HOLD trong sổ cái.`,
        status: 'OPEN',
        created_at: nowIso,
        updated_at: nowIso,
      });
    } else {
      matchedCount++;
    }
  }

  // 4. Kiểm tra đối soát số dư của từng gian hàng so với tổng các dòng sổ cái
  const sellersRes = await db
    .prepare("SELECT id, name, pending_balance_core, available_balance_core, withdrawn_balance_core FROM sellers WHERE deleted_at IS NULL")
    .all<any>();

  for (const sel of sellersRes?.results || []) {
    const allSellerLines = await db
      .prepare("SELECT type, amount_core FROM seller_ledger WHERE seller_id = ?")
      .bind(sel.id)
      .all<any>();

    let calcHeld = 0;
    let calcAvailable = 0;
    let calcWithdrawn = 0;

    for (const line of allSellerLines?.results || []) {
      const amt = Math.abs(Number(line.amount_core) || 0);
      switch (line.type) {
        case 'HOLD':
          calcHeld += amt;
          break;
        case 'RELEASE':
          calcHeld = Math.max(0, calcHeld - amt);
          calcAvailable += amt;
          break;
        case 'FEE':
          calcAvailable = Math.max(0, calcAvailable - amt);
          break;
        case 'WITHDRAW':
          calcAvailable = Math.max(0, calcAvailable - amt);
          calcWithdrawn += amt;
          break;
        case 'REFUND':
          calcHeld = Math.max(0, calcHeld - amt);
          break;
        case 'ADJUST':
          calcAvailable += Number(line.amount_core) || 0;
          break;
      }
    }

    if (
      Math.abs(calcHeld - Number(sel.pending_balance_core || 0)) > 0.01 ||
      Math.abs(calcAvailable - Number(sel.available_balance_core || 0)) > 0.01 ||
      Math.abs(calcWithdrawn - Number(sel.withdrawn_balance_core || 0)) > 0.01
    ) {
      exceptions.push({
        id: `ex_${runId}_${sel.id}_balance`,
        run_id: runId,
        source: 'LEDGER',
        reference_id: sel.id,
        expected_amount: calcAvailable,
        actual_amount: Number(sel.available_balance_core || 0),
        suggested_cause: `Số dư 3 ngăn trên bảng sellers của gian hàng "${sel.name}" lệch so với tổng dòng sổ cái (Held: ${sel.pending_balance_core} vs ${calcHeld}, Avail: ${sel.available_balance_core} vs ${calcAvailable}, Withdrawn: ${sel.withdrawn_balance_core} vs ${calcWithdrawn}).`,
        status: 'OPEN',
        created_at: nowIso,
        updated_at: nowIso,
      });
    }
  }

  const runStatus = exceptions.length > 0 ? 'COMPLETED_WITH_EXCEPTIONS' : 'COMPLETED';

  // Lưu phiên đối soát vào CSDL
  await db
    .prepare(`
      INSERT INTO reconciliation_runs (
        id, run_date, total_orders, total_sepay_transactions, total_ledger_lines,
        matched_count, exception_count, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      runId,
      runDate,
      orders.length,
      sepayTxs.length,
      ledgerLines.length,
      matchedCount,
      exceptions.length,
      runStatus,
      nowIso
    )
    .run();

  // Lưu các ngoại lệ phát hiện
  for (const ex of exceptions) {
    await db
      .prepare(`
        INSERT INTO reconciliation_exceptions (
          id, run_id, source, reference_id, expected_amount, actual_amount,
          suggested_cause, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        ex.id,
        ex.run_id,
        ex.source,
        ex.reference_id,
        ex.expected_amount,
        ex.actual_amount,
        ex.suggested_cause,
        ex.status,
        ex.created_at,
        ex.updated_at
      )
      .run()
      .catch((e) => console.warn('[reconciliation exception insert error]', e));
  }

  return {
    runId,
    runDate,
    totalOrders: orders.length,
    totalSepay: sepayTxs.length,
    totalLedger: ledgerLines.length,
    matchedCount,
    exceptionCount: exceptions.length,
    status: runStatus,
    exceptions,
  };
}

// Chuẩn hóa và sinh chuỗi mã VietQR EMVCo TLV (Napas 247)
function crc16Ccitt(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    crc ^= (c << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function removeVietnameseAccents(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

const BANK_BIN_MAP: Record<string, string> = {
  TPBANK: '970423',
  TPB: '970423',
  MBBANK: '970422',
  MB: '970422',
  VIETCOMBANK: '970436',
  VCB: '970436',
  VIETINBANK: '970415',
  CTG: '970415',
  TECHCOMBANK: '970407',
  TCB: '970407',
  VPBANK: '970432',
  ACB: '970416',
  BIDV: '970418',
  SACOMBANK: '970403',
  MSB: '970426',
  VIB: '970441',
  SHB: '970443',
  HDBANK: '970437',
  OCB: '970448',
  AGRIBANK: '970405',
};

export function getBankBin(bankName: string): string {
  const clean = (bankName || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const [key, bin] of Object.entries(BANK_BIN_MAP)) {
    if (clean.includes(key)) return bin;
  }
  return '970423'; // Default TPBank BIN
}

function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

export function generateVietQrPayload(params: {
  bankName: string;
  accountNumber: string;
  amount: number;
  content: string;
}): string {
  const bin = getBankBin(params.bankName);
  const cleanAcc = params.accountNumber.trim().replace(/\s+/g, '');
  const cleanContent = removeVietnameseAccents(params.content.trim()).slice(0, 50);

  const sub00 = tlv('00', 'A000000727');
  const subBank = tlv('00', bin) + tlv('01', cleanAcc);
  const sub01 = tlv('01', subBank);
  const sub02 = tlv('02', 'QRIBFTTA');
  const tag38 = tlv('38', sub00 + sub01 + sub02);

  const isDynamic = params.amount > 0;
  let raw =
    tlv('00', '01') +
    tlv('01', isDynamic ? '12' : '11') +
    tag38 +
    tlv('53', '704');

  if (isDynamic) {
    raw += tlv('54', String(Math.round(params.amount)));
  }
  raw += tlv('58', 'VN');

  if (cleanContent) {
    const sub08 = tlv('08', cleanContent);
    raw += tlv('62', sub08);
  }

  raw += '6304';
  const checksum = crc16Ccitt(raw);
  return raw + checksum;
}

// Tự động kiểm tra tỷ lệ lỗi lô mã và đóng băng nếu vượt ngưỡng (§5.2)
export async function checkAndFreezeBatchIfHighErrorRate(db: D1Database, batchId: string): Promise<boolean> {
  if (!batchId) return false;
  try {
    const config = await getMarketplaceConfig(db);
    const stats = await db
      .prepare(`
        SELECT 
          COUNT(*) as total_count,
          SUM(CASE WHEN status = 'REPORTED' THEN 1 ELSE 0 END) as reported_count
        FROM seller_codes
        WHERE batch_id = ? AND deleted_at IS NULL
      `)
      .bind(batchId)
      .first<{ total_count: number; reported_count: number }>();

    if (stats && stats.total_count >= config.min_batch_size_for_freeze) {
      const errorRate = (stats.reported_count || 0) / stats.total_count;
      if (errorRate >= config.batch_freeze_error_rate) {
        // Tự động đóng băng các mã IN_STOCK còn lại trong lô này chuyển sang RECALLED
        await db
          .prepare(`
            UPDATE seller_codes 
            SET status = 'RECALLED', recalled_at = datetime('now'), updated_at = datetime('now')
            WHERE batch_id = ? AND status = 'IN_STOCK' AND deleted_at IS NULL
          `)
          .bind(batchId)
          .run();
        return true;
      }
    }
  } catch (err) {
    console.warn('[checkAndFreezeBatchIfHighErrorRate error]', err);
  }
  return false;
}
