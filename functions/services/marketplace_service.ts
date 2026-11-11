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

// Mã hóa mã code đơn giản an toàn với Web Crypto
export async function encryptCode(code: string, secretKeyStr: string = 'WCG_SELLER_KEY_SAFE_SALT_2026'): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(code.trim());
    const keyData = encoder.encode(secretKeyStr.padEnd(32, '0').slice(0, 32));
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
    
    // Ghép iv và ciphertext thành base64
    const ivHex = Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join('');
    const encryptedArray = Array.from(new Uint8Array(encrypted));
    const cipherHex = encryptedArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `enc_v1:${ivHex}:${cipherHex}`;
  } catch {
    // Fallback an toàn nếu crypto bị lỗi
    return `b64:${btoa(unescape(encodeURIComponent(code.trim())))}`;
  }
}

// Giải mã mã code
export async function decryptCode(cipherText: string, secretKeyStr: string = 'WCG_SELLER_KEY_SAFE_SALT_2026'): Promise<string> {
  try {
    if (cipherText.startsWith('enc_v1:')) {
      const parts = cipherText.split(':');
      if (parts.length === 3) {
        const ivHex = parts[1];
        const cipherHex = parts[2];
        const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
        const cipherBytes = new Uint8Array(cipherHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secretKeyStr.padEnd(32, '0').slice(0, 32));
        const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, cipherBytes);
        return new TextDecoder().decode(decrypted);
      }
    } else if (cipherText.startsWith('b64:')) {
      return decodeURIComponent(escape(atob(cipherText.slice(4))));
    }
  } catch {
    // Return original if cannot decrypt
  }
  return cipherText;
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

// Tự động kiểm tra tỷ lệ lỗi lô mã và đóng băng nếu vượt ngưỡng (§5.2)
export async function checkAndFreezeBatchIfHighErrorRate(db: D1Database, batchId: string): Promise<boolean> {
  if (!batchId) return false;
  try {
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

    if (stats && stats.total_count >= 5) {
      const errorRate = (stats.reported_count || 0) / stats.total_count;
      if (errorRate >= 0.25) {
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
