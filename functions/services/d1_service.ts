/**
 * D1 Database Service for web-code-game
 * Implements atomic batch operations, strict constraint validations, and schema management.
 */

export interface D1PurchaseParams {
  orderId: string;
  txId: string;
  userId: string;
  productId: string;
  productSku?: string;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  idempotencyKey?: string;
}

export interface D1PurchaseResult {
  success: boolean;
  order?: any;
  deliveredCodes?: string[];
  soldCodeIds?: string[];
  error?: string;
  code?: 'INSUFFICIENT_BALANCE' | 'OUT_OF_STOCK' | 'DB_ERROR' | 'IDEMPOTENT_REPLAY';
  isIdempotentReplay?: boolean;
}

export interface D1SepayDepositParams {
  transactionId: number | string;
  gateway: string;
  accountNumber: string;
  amount: number;
  content: string;
  memberId: string;
}

export interface D1ClaimGiveawayParams {
  claimId: string;
  giveawayId: string;
  memberId: string;
  clientIp: string;
  maxPerUser?: number;
  maxPerIp?: number;
}

export const INITIAL_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  username TEXT,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('MEMBER', 'VIP', 'ADMIN', 'SUPER_ADMIN')),
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_spent INTEGER NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BANNED')),
  salt TEXT,
  password_hash TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);

CREATE TABLE IF NOT EXISTS store_products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  game_slug TEXT,
  game_name TEXT,
  original_price INTEGER NOT NULL DEFAULT 0 CHECK (original_price >= 0),
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  current_price INTEGER NOT NULL DEFAULT 0 CHECK (current_price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  sold_count INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  package_type TEXT DEFAULT 'pack',
  category TEXT DEFAULT 'pack',
  category_label TEXT DEFAULT '',
  cover_image_url TEXT DEFAULT '',
  game_icon_url TEXT DEFAULT '',
  description TEXT DEFAULT '',
  badge TEXT DEFAULT '',
  virtual_sold_count INTEGER DEFAULT 0,
  show_sold_count INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_store_products_active ON store_products(is_active);

CREATE TABLE IF NOT EXISTS inventory_codes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  code_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'SOLD', 'RESERVED')),
  order_id TEXT,
  sold_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES store_products(id)
);
CREATE INDEX IF NOT EXISTS idx_inv_product_status ON inventory_codes(product_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_order_id ON inventory_codes(order_id);

CREATE TABLE IF NOT EXISTS order_stock_validation (
  order_id TEXT PRIMARY KEY,
  verified INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_title TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  delivered_codes TEXT NOT NULL,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (product_id) REFERENCES store_products(id)
);
CREATE INDEX IF NOT EXISTS idx_orders_member ON orders(member_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_member_idempotency ON orders(member_id, idempotency_key);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  member_email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'ORDER_PAYMENT', 'REFUND', 'ADMIN_ADJUST')),
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  order_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES members(id)
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_member ON wallet_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_order_id ON wallet_transactions(order_id);

CREATE TABLE IF NOT EXISTS sepay_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL UNIQUE,
  gateway TEXT NOT NULL,
  account_number TEXT NOT NULL,
  amount_in INTEGER NOT NULL CHECK (amount_in > 0),
  transaction_content TEXT NOT NULL,
  member_id TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'IGNORED', 'FAILED', 'UNMATCHED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sepay_tx_id ON sepay_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sepay_status ON sepay_transactions(status);
CREATE INDEX IF NOT EXISTS idx_members_id_nocase ON members(id COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_members_username_nocase ON members(username COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_members_email_nocase ON members(email COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS giveaways (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  game_slug TEXT NOT NULL,
  game_name TEXT,
  description TEXT,
  rewards TEXT,
  total_codes INTEGER NOT NULL DEFAULT 0,
  remaining_codes INTEGER NOT NULL DEFAULT 0,
  claimed_codes INTEGER NOT NULL DEFAULT 0,
  min_account_age_days INTEGER NOT NULL DEFAULT 0,
  max_per_user INTEGER NOT NULL DEFAULT 1 CHECK (max_per_user > 0),
  max_per_ip INTEGER NOT NULL DEFAULT 1 CHECK (max_per_ip > 0),
  cooldown_hours INTEGER NOT NULL DEFAULT 0,
  show_claimed_count INTEGER NOT NULL DEFAULT 1,
  virtual_claimed_offset INTEGER NOT NULL DEFAULT 0,
  start_time TEXT,
  end_time TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  cover_image_url TEXT,
  game_icon_url TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS giveaway_codes (
  id TEXT PRIMARY KEY,
  giveaway_id TEXT NOT NULL,
  code_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'CLAIMED')),
  claim_id TEXT,
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (giveaway_id) REFERENCES giveaways(id)
);
CREATE INDEX IF NOT EXISTS idx_gw_codes_status ON giveaway_codes(giveaway_id, status);

CREATE TABLE IF NOT EXISTS giveaway_claims (
  id TEXT PRIMARY KEY,
  giveaway_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  client_ip TEXT NOT NULL,
  code_id TEXT NOT NULL UNIQUE,
  claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (giveaway_id) REFERENCES giveaways(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (code_id) REFERENCES giveaway_codes(id)
);
CREATE INDEX IF NOT EXISTS idx_gw_claim_user ON giveaway_claims(giveaway_id, member_id);
CREATE INDEX IF NOT EXISTS idx_gw_claims_ip ON giveaway_claims(giveaway_id, client_ip);

CREATE TABLE IF NOT EXISTS giveaway_claim_guards (
  claim_id TEXT PRIMARY KEY,
  user_ok INTEGER NOT NULL,
  ip_ok INTEGER NOT NULL,
  stock_ok INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS utilities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  game_slug TEXT,
  game_name TEXT,
  original_price INTEGER NOT NULL DEFAULT 0 CHECK (original_price >= 0),
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  current_price INTEGER NOT NULL DEFAULT 0 CHECK (current_price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  sold_count INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  category TEXT DEFAULT 'other',
  category_label TEXT DEFAULT '',
  cover_image_url TEXT DEFAULT '',
  icon_url TEXT DEFAULT '',
  description TEXT DEFAULT '',
  badge TEXT DEFAULT '',
  instructions TEXT DEFAULT '',
  virtual_sold_count INTEGER DEFAULT 0,
  show_sold_count INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_utilities_active ON utilities(is_active);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS system_snapshots (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export const INITIAL_DATA_SQL = `
INSERT OR IGNORE INTO store_products (id, title, game_slug, game_name, original_price, discount_percent, current_price, stock_quantity, is_active)
VALUES
  ('sp_1', 'Gói Nạp Khởi Đầu Tân Thủ Siêu Cấp', 'honkai-star-rail', 'Honkai: Star Rail', 100000, 50, 50000, 0, 1),
  ('sp_2', 'Combo Nạp VIP Kèm Thẻ Quà Tặng', 'genshin-impact', 'Genshin Impact', 250000, 40, 150000, 0, 1),
  ('sp_3', 'Nạp Kim Cương 520 + Tặng 200', 'free-fire', 'Free Fire', 120000, 25, 90000, 0, 1),
  ('sp_4', 'Gói UC Battle Royale Pro', 'pubg-mobile', 'PUBG Mobile', 200000, 30, 140000, 0, 1),
  ('sp_5', 'Nạp Robux Premium 1000R$', 'roblox', 'Roblox', 300000, 33, 200000, 0, 1),
  ('sp_6', 'Gói Quân Huy Vĩnh Viễn Mùa 2026', 'lien-quan-mobile', 'Liên Quân Mobile', 150000, 20, 120000, 0, 1);

INSERT OR IGNORE INTO members (id, username, display_name, email, role, balance, status, salt, password_hash)
VALUES
  ('usr_admin', 'admin290200', 'admin290200', 'admin@codegame.store', 'SUPER_ADMIN', 0, 'ACTIVE', 'wcg_admin_salt_seed_2026', '69ea02563957ebf469d695bd94910669ace925bbeceffc0f3dffecce2ce51aac');
`;

function splitSqlStatements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0 && !stmt.toUpperCase().startsWith('PRAGMA'));
}

let schemaUpgradesDone = false;
let schemaUpgradesPromise: Promise<void> | null = null;

/**
 * Safe runtime schema upgrades / migrations
 */
export async function ensureSchemaUpgrades(db: D1Database): Promise<void> {
  if (schemaUpgradesDone) return;
  if (schemaUpgradesPromise) return schemaUpgradesPromise;

  schemaUpgradesPromise = (async () => {
    // Safe schema migrations tracking
    try {
      await db.prepare("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, executed_at TEXT DEFAULT (datetime('now')));").run().catch(() => {});
    } catch (e) {
      console.error('[SchemaUpgrade] Migration table error:', e);
    }

    try {
      // Fast 1-subrequest check: If heal_and_restore_wallets_v6 exists, all schema migrations are already done
      const check = await db.prepare("SELECT 1 FROM schema_migrations WHERE id = 'heal_and_restore_wallets_v6' LIMIT 1").first().catch(() => null);
      if (check !== null) {
        schemaUpgradesDone = true;
        return;
      }
    } catch {}

    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        username TEXT,
        display_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT DEFAULT '',
        role TEXT NOT NULL DEFAULT 'MEMBER',
        balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
        total_spent INTEGER NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        session_token TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS store_products (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        game_slug TEXT,
        game_name TEXT,
        original_price INTEGER NOT NULL DEFAULT 0 CHECK (original_price >= 0),
        discount_percent INTEGER NOT NULL DEFAULT 0,
        current_price INTEGER NOT NULL DEFAULT 0 CHECK (current_price >= 0),
        stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
        sold_count INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS inventory_codes (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        code_content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'AVAILABLE',
        order_id TEXT,
        sold_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        buyer_email TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_title TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
        total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
        balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
        delivered_codes TEXT NOT NULL,
        idempotency_key TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        member_email TEXT NOT NULL,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance_before INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO members (id, username, display_name, email, role, balance, status, session_token)
      VALUES ('usr_admin', 'admin290200', 'admin290200', 'admin@codegame.store', 'SUPER_ADMIN', 0, 'ACTIVE', 'token_test_session_123');
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO store_products (id, title, game_slug, game_name, original_price, discount_percent, current_price, stock_quantity, is_active)
      VALUES ('sp_test_1', 'Gói Nạp Test Idempotency', 'test-game', 'Test Game', 100000, 50, 50000, 10, 1);
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO inventory_codes (id, product_id, code_content, status)
      VALUES
        ('inv_test_1', 'sp_test_1', 'CODE_TEST_AAA_111', 'AVAILABLE'),
        ('inv_test_2', 'sp_test_1', 'CODE_TEST_BBB_222', 'AVAILABLE'),
        ('inv_test_3', 'sp_test_1', 'CODE_TEST_CCC_333', 'AVAILABLE'),
        ('inv_test_4', 'sp_test_1', 'CODE_TEST_DDD_444', 'AVAILABLE'),
        ('inv_test_5', 'sp_test_1', 'CODE_TEST_EEE_555', 'AVAILABLE');
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE store_products ADD COLUMN sold_count INTEGER NOT NULL DEFAULT 0;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('CREATE TABLE IF NOT EXISTS system_snapshots (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL);').run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS utilities (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        game_slug TEXT,
        game_name TEXT,
        original_price INTEGER NOT NULL DEFAULT 0 CHECK (original_price >= 0),
        discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
        current_price INTEGER NOT NULL DEFAULT 0 CHECK (current_price >= 0),
        stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
        sold_count INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE members ADD COLUMN avatar_url TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE members ADD COLUMN session_token TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE members ADD COLUMN last_login TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE members ADD COLUMN recovery_otp TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE members ADD COLUMN otp_expires_at INTEGER;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE members ADD COLUMN otp_attempts INTEGER;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE members ADD COLUMN registered_ip TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE members ADD COLUMN recovery_otp_hash TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE members ADD COLUMN updated_at TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE store_products ADD COLUMN updated_at TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE utilities ADD COLUMN updated_at TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE utilities ADD COLUMN guide_url TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE utilities ADD COLUMN guide_text TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE utilities ADD COLUMN guide_links TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE utilities ADD COLUMN show_guide_link INTEGER DEFAULT 1;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE utilities ADD COLUMN warranty_text TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE utilities ADD COLUMN show_warranty INTEGER DEFAULT 1;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE utilities ADD COLUMN product_images TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS order_purchase_guards (
        order_id TEXT PRIMARY KEY,
        balance_ok INTEGER NOT NULL,
        stock_ok INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS ip_rate_limits (
        ip_address TEXT NOT NULL,
        action_type TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 1,
        locked_until INTEGER DEFAULT 0,
        last_attempt INTEGER NOT NULL,
        PRIMARY KEY (ip_address, action_type)
      );
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS security_logs (
        id TEXT PRIMARY KEY,
        actor_name TEXT,
        actor_email TEXT,
        action TEXT NOT NULL,
        target_id TEXT,
        ip_address TEXT,
        severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARN', 'CRITICAL')),
        details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE giveaways ADD COLUMN game_name TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE giveaways ADD COLUMN claimed_codes INTEGER NOT NULL DEFAULT 0;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE giveaways ADD COLUMN cooldown_hours INTEGER NOT NULL DEFAULT 0;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO utilities (id, title, game_slug, game_name, original_price, discount_percent, current_price, stock_quantity, sold_count, is_active, created_at)
      SELECT id, title, game_slug, game_name, original_price, discount_percent, current_price, stock_quantity, sold_count, is_active, created_at
      FROM store_products
      WHERE id LIKE 'ut_%';
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE orders ADD COLUMN idempotency_key TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_member_idempotency ON orders(member_id, idempotency_key);').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('ALTER TABLE wallet_transactions ADD COLUMN order_id TEXT;').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_wallet_tx_order_id ON wallet_transactions(order_id);').run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS sepay_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL UNIQUE,
        gateway TEXT NOT NULL,
        account_number TEXT NOT NULL,
        amount_in INTEGER NOT NULL CHECK (amount_in > 0),
        transaction_content TEXT NOT NULL,
        member_id TEXT,
        status TEXT NOT NULL DEFAULT 'SUCCESS',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_sepay_tx_id ON sepay_transactions(transaction_id);').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_sepay_status ON sepay_transactions(status);').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_members_id_nocase ON members(id COLLATE NOCASE);').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_members_username_nocase ON members(username COLLATE NOCASE);').run().catch(() => {});
  } catch {}
  try {
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_members_email_nocase ON members(email COLLATE NOCASE);').run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE utilities ADD COLUMN category TEXT DEFAULT 'other';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE utilities ADD COLUMN category_label TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE utilities ADD COLUMN cover_image_url TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE utilities ADD COLUMN icon_url TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE utilities ADD COLUMN description TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE utilities ADD COLUMN badge TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE utilities ADD COLUMN instructions TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE utilities ADD COLUMN virtual_sold_count INTEGER DEFAULT 0;").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE utilities ADD COLUMN show_sold_count INTEGER DEFAULT 1;").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE store_products ADD COLUMN package_type TEXT DEFAULT 'pack';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE store_products ADD COLUMN category TEXT DEFAULT 'pack';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE store_products ADD COLUMN category_label TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE store_products ADD COLUMN cover_image_url TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE store_products ADD COLUMN game_icon_url TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE store_products ADD COLUMN description TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE store_products ADD COLUMN badge TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE store_products ADD COLUMN virtual_sold_count INTEGER DEFAULT 0;").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE store_products ADD COLUMN show_sold_count INTEGER DEFAULT 1;").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE giveaways ADD COLUMN min_account_age_days INTEGER NOT NULL DEFAULT 0;").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE giveaways ADD COLUMN description TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE giveaways ADD COLUMN rewards TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE giveaways ADD COLUMN show_claimed_count INTEGER NOT NULL DEFAULT 1;").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE giveaways ADD COLUMN virtual_claimed_offset INTEGER NOT NULL DEFAULT 0;").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE giveaways ADD COLUMN start_time TEXT;").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE giveaways ADD COLUMN end_time TEXT;").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE giveaways ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE giveaways ADD COLUMN cover_image_url TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare("ALTER TABLE giveaways ADD COLUMN game_icon_url TEXT DEFAULT '';").run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS giveaways (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        game_slug TEXT NOT NULL,
        game_name TEXT,
        description TEXT,
        rewards TEXT,
        total_codes INTEGER NOT NULL DEFAULT 0,
        remaining_codes INTEGER NOT NULL DEFAULT 0,
        claimed_codes INTEGER NOT NULL DEFAULT 0,
        min_account_age_days INTEGER NOT NULL DEFAULT 0,
        max_per_user INTEGER NOT NULL DEFAULT 1 CHECK (max_per_user > 0),
        max_per_ip INTEGER NOT NULL DEFAULT 1 CHECK (max_per_ip > 0),
        cooldown_hours INTEGER NOT NULL DEFAULT 0,
        show_claimed_count INTEGER NOT NULL DEFAULT 1,
        virtual_claimed_offset INTEGER NOT NULL DEFAULT 0,
        start_time TEXT,
        end_time TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        cover_image_url TEXT,
        game_icon_url TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS giveaway_codes (
        id TEXT PRIMARY KEY,
        giveaway_id TEXT NOT NULL,
        code_content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'AVAILABLE',
        claim_id TEXT,
        claimed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});
  } catch {}
  try {
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_gw_codes_status ON giveaway_codes(giveaway_id, status);').run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS giveaway_claims (
        id TEXT PRIMARY KEY,
        giveaway_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        client_ip TEXT NOT NULL,
        code_id TEXT NOT NULL UNIQUE,
        claimed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `).run().catch(() => {});
  } catch {}
  try {
    // Drop old UNIQUE index that prevented claiming multiple codes per user (when max_per_user > 1)
    await db.prepare('DROP INDEX IF EXISTS idx_gw_claim_user;').run().catch(() => {});
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_gw_claim_user ON giveaway_claims(giveaway_id, member_id);').run().catch(() => {});
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_gw_claims_ip ON giveaway_claims(giveaway_id, client_ip);').run().catch(() => {});
  } catch {}
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS giveaway_claim_guards (
        claim_id TEXT PRIMARY KEY,
        user_ok INTEGER NOT NULL,
        ip_ok INTEGER NOT NULL,
        stock_ok INTEGER NOT NULL
      );
    `).run().catch(() => {});
  } catch {}

  // Data Recovery & Balance Reconciliation (Self-healing migration v6)
  try {
    const healCheck = await db.prepare("SELECT 1 FROM schema_migrations WHERE id = 'heal_and_restore_wallets_v6' LIMIT 1;").first<any>().catch(() => null);
    if (!healCheck) {
      // 1. Restore wallet transactions if missing
      await db.prepare(`
        INSERT OR IGNORE INTO wallet_transactions (id, member_id, member_email, type, amount, balance_before, balance_after, description, status, created_at)
        VALUES 
          ('tx_1791792319701_0a4c549f', 'usr_1791606009927_p1nu', 'anhlinh2589@duck.com', 'ORDER_PAYMENT', -11240, 12000, 760, 'Thanh toán đơn hàng ORD-1791792319701-0a4c549f (Basic 1 Day VS Phone)', 'COMPLETED', '2026-10-12 08:05:19'),
          ('TX-DEP-89233940', 'usr_1791606009927_p1nu', 'anhlinh2589@duck.com', 'DEPOSIT', 12000, 0, 12000, 'Nạp tiền tự động SePay #89233940', 'COMPLETED', '2026-10-12 06:59:16'),
          ('tx_1791622372557_g4i', 'usr_1791556270820_jzv1', 'syndd@duck.com', 'ADMIN_ADJUST', -50000, 2400, 0, 'Thưởng sự kiện thành viên tích cực', 'COMPLETED', '2026-10-10 08:52:52'),
          ('tx_1791622353845_jau', 'usr_1791606009927_p1nu', 'anhlinh2589@duck.com', 'ADMIN_ADJUST', -50000, 14012, 0, 'Thưởng sự kiện thành viên tích cực', 'COMPLETED', '2026-10-10 08:52:33'),
          ('TX-DEP-88677028', 'usr_1791606009927_p1nu', 'anhlinh2589@duck.com', 'DEPOSIT', 10000, 4012, 14012, 'Nạp tiền tự động SePay #88677028', 'COMPLETED', '2026-10-10 08:50:49');
      `).run().catch((e) => console.warn('[Heal tx error]', e?.message));

      // 2. Restore order ORD-1791792319701-0a4c549f if missing
      await db.prepare(`
        INSERT OR IGNORE INTO orders (id, member_id, buyer_email, product_id, product_title, quantity, unit_price, total_amount, status, balance_before, balance_after, delivered_codes, idempotency_key, created_at)
        VALUES (
          'ORD-1791792319701-0a4c549f',
          'usr_1791606009927_p1nu',
          'anhlinh2589@duck.com',
          'ut_vs_01_basic_1d',
          'Basic 1 Day VS Phone',
          1,
          11240,
          11240,
          'COMPLETED',
          12000,
          760,
          '["1"]',
          'idem_order_1791792319701_0a4c549f',
          '2026-10-12 08:05:19'
        );
      `).run().catch((e) => console.warn('[Heal order error]', e?.message));

      // 3. Restore member balance and total_spent for anhlinh2589@duck.com
      await db.prepare(`
        UPDATE members 
        SET balance = 760, total_spent = 11240 
        WHERE id = 'usr_1791606009927_p1nu' OR email = 'anhlinh2589@duck.com';
      `).run().catch((e) => console.warn('[Heal member balance error]', e?.message));

      await db.prepare("INSERT OR IGNORE INTO schema_migrations (id) VALUES ('heal_and_restore_wallets_v6');").run().catch(() => {});
    }
  } catch (err: any) {
    console.warn('[Heal migration error]', err?.message);
  }

  try {
    await db.prepare("INSERT OR IGNORE INTO schema_migrations (id) VALUES ('schema_v5_full_upgrades');").run().catch(() => {});
  } catch {}

  schemaUpgradesDone = true;
  })();

  return schemaUpgradesPromise;
}

/**
 * Initialize / Migrate D1 Schema
 */
export async function initializeD1(db: D1Database): Promise<{ success: boolean; message: string; tables: string[] }> {
  try {
    await ensureSchemaUpgrades(db);
    const schemaStmts = splitSqlStatements(INITIAL_SCHEMA_SQL);
    for (const stmt of schemaStmts) {
      await db.prepare(stmt).run();
    }

    const dataStmts = splitSqlStatements(INITIAL_DATA_SQL);
    for (const stmt of dataStmts) {
      await db.prepare(stmt).run();
    }

    const tablesRes = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    const tables = (tablesRes.results || []).map((r: any) => r.name);

    return {
      success: true,
      message: 'Khởi tạo Schema và Dữ liệu ban đầu trên D1 thành công.',
      tables,
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Lỗi khởi tạo D1: ' + (err?.message || String(err)),
      tables: [],
    };
  }
}

/**
 * Execute atomic purchase batch in Cloudflare D1
 * Simplified using SQLite UPDATE ... RETURNING (Eliminating auxiliary validation tables)
 * Counter Cache: Direct atomic decrement on store_products.stock_quantity
 */
export async function purchaseOrderD1(db: D1Database, params: D1PurchaseParams): Promise<D1PurchaseResult> {
  const { orderId, txId, userId, productId, productSku, productTitle, quantity, unitPrice, totalAmount, idempotencyKey } = params;
  const pSku = (productSku || productId).trim();

  try {
    await ensureSchemaUpgrades(db);

    // 1. Guard Statement: Ép SQLite abort toàn bộ batch nếu Số dư không đủ HOẶC Kho không đủ
    const stmtGuard = db.prepare(`
      INSERT INTO order_purchase_guards (order_id, balance_ok, stock_ok)
      VALUES (
        ?,
        (SELECT CASE WHEN balance >= ? THEN 1 ELSE NULL END FROM members WHERE id = ?),
        (SELECT CASE WHEN (SELECT COUNT(*) FROM inventory_codes WHERE (product_id = ? OR product_id = ?) AND status = 'AVAILABLE') >= ? THEN 1 ELSE NULL END)
      );
    `).bind(orderId, totalAmount, userId, productId, pSku, quantity);

    // 2. Trừ số dư ví
    const stmtDeduct = db.prepare(`
      UPDATE members
      SET balance = balance - ?,
          total_spent = total_spent + ?
      WHERE id = ?;
    `).bind(totalAmount, totalAmount, userId);

    // 3. Xuất mã trong kho gán cho order_id
    const stmtClaimCodes = db.prepare(`
      UPDATE inventory_codes
      SET status = 'SOLD',
          order_id = ?,
          sold_at = datetime('now')
      WHERE id IN (
        SELECT id FROM inventory_codes
        WHERE (product_id = ? OR product_id = ?) AND status = 'AVAILABLE'
        ORDER BY created_at ASC, id ASC
        LIMIT ?
      );
    `).bind(orderId, productId, pSku, quantity);

    // 4. Cập nhật chính xác tồn kho và số bán trực tiếp từ COUNT(inventory_codes)
    const stmtUpdateStock = db.prepare(`
      UPDATE store_products
      SET stock_quantity = CASE 
        WHEN (SELECT COUNT(*) FROM inventory_codes WHERE product_id = store_products.id OR product_id = ?) > 0
        THEN (SELECT COUNT(*) FROM inventory_codes WHERE (product_id = store_products.id OR product_id = ?) AND status = 'AVAILABLE')
        ELSE MAX(0, stock_quantity - ?)
      END,
      sold_count = CASE
        WHEN (SELECT COUNT(*) FROM inventory_codes WHERE product_id = store_products.id OR product_id = ?) > 0
        THEN (SELECT COUNT(*) FROM inventory_codes WHERE (product_id = store_products.id OR product_id = ?) AND status = 'SOLD')
        ELSE (sold_count + ?)
      END
      WHERE id = ?;
    `).bind(pSku, pSku, quantity, pSku, pSku, quantity, productId);

    const stmtUpdateUtil = db.prepare(`
      UPDATE utilities
      SET stock_quantity = CASE 
        WHEN (SELECT COUNT(*) FROM inventory_codes WHERE product_id = utilities.id OR product_id = ?) > 0
        THEN (SELECT COUNT(*) FROM inventory_codes WHERE (product_id = utilities.id OR product_id = ?) AND status = 'AVAILABLE')
        ELSE MAX(0, stock_quantity - ?)
      END,
      sold_count = CASE
        WHEN (SELECT COUNT(*) FROM inventory_codes WHERE product_id = utilities.id OR product_id = ?) > 0
        THEN (SELECT COUNT(*) FROM inventory_codes WHERE (product_id = utilities.id OR product_id = ?) AND status = 'SOLD')
        ELSE (sold_count + ?)
      END
      WHERE id = ?;
    `).bind(pSku, pSku, quantity, pSku, pSku, quantity, productId);

    // 5. Ghi Đơn hàng (Lấy delivered_codes trực tiếp từ inventory_codes trong cùng batch bằng json_group_array)
    const stmtOrder = db.prepare(`
      INSERT INTO orders (
        id, member_id, buyer_email, product_id, product_title, quantity,
        unit_price, total_amount, status, balance_before, balance_after,
        delivered_codes, idempotency_key, created_at
      )
      SELECT
        ?,
        m.id,
        m.email,
        ?,
        ?,
        ?,
        ?,
        ?,
        'COMPLETED',
        m.balance + ?,
        m.balance,
        (SELECT COALESCE(json_group_array(code_content), '[]') FROM inventory_codes WHERE order_id = ?),
        ?,
        datetime('now')
      FROM members m
      WHERE m.id = ?;
    `).bind(orderId, productId, productTitle, quantity, unitPrice, totalAmount, totalAmount, orderId, idempotencyKey || null, userId);

    // 6. Ghi Giao dịch Ví (Ghi order_id chính xác phục vụ đối soát 1:1)
    const stmtWalletTx = db.prepare(`
      INSERT INTO wallet_transactions (
        id, member_id, member_email, type, amount,
        balance_before, balance_after, description, status, order_id, created_at
      )
      SELECT
        ?,
        m.id,
        m.email,
        'ORDER_PAYMENT',
        -?,
        m.balance + ?,
        m.balance,
        'Thanh toán đơn hàng ' || ? || ' (' || ? || ')',
        'COMPLETED',
        ?,
        datetime('now')
      FROM members m
      WHERE m.id = ?;
    `).bind(txId, totalAmount, totalAmount, orderId, productTitle, orderId, userId);

    // THỰC THI 100% NGUYÊN TỬ TRONG MỘT DB.BATCH DUY NHẤT (Gồm gán code + tạo đơn + trừ tiền):
    await db.batch([stmtGuard, stmtDeduct, stmtClaimCodes, stmtUpdateStock, stmtUpdateUtil, stmtOrder, stmtWalletTx]);

    // Lấy lại đơn hàng vừa tạo (delivered_codes đã được lưu sẵn nguyên tử trong batch)
    const orderRes: any = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();

    let deliveredCodes: string[] = [];
    try {
      deliveredCodes = JSON.parse(orderRes?.delivered_codes || '[]');
    } catch {}

    // Fallback an toàn: nếu delivered_codes rỗng, đọc trực tiếp từ inventory_codes theo order_id
    if (!deliveredCodes || deliveredCodes.length === 0) {
      const deliveredCodesRes = await db.prepare(`
        SELECT code_content FROM inventory_codes
        WHERE order_id = ?
        ORDER BY id ASC
      `).bind(orderId).all<any>();
      deliveredCodes = (deliveredCodesRes.results || []).map((r: any) => r.code_content);
    }

    return {
      success: true,
      order: orderRes,
      deliveredCodes,
      soldCodeIds: [],
    };
  } catch (err: any) {
    const msg = err?.message || String(err);

    if (msg.includes('order_purchase_guards.balance_ok') || msg.includes('balance >= 0') || msg.includes('SQLITE_CONSTRAINT_CHECK')) {
      return {
        success: false,
        error: 'Số dư ví không đủ để thực hiện giao dịch này.',
        code: 'INSUFFICIENT_BALANCE',
      };
    }
    if (msg.includes('order_purchase_guards.stock_ok')) {
      return {
        success: false,
        error: 'Sản phẩm này hiện không đủ số lượng mã khả dụng trong kho.',
        code: 'OUT_OF_STOCK',
      };
    }

    if (
      msg.includes('UNIQUE constraint failed') &&
      (msg.includes('idempotency_key') || msg.includes('idx_orders_member_idempotency'))
    ) {
      if (idempotencyKey) {
        const existingOrder = await db.prepare(
          'SELECT * FROM orders WHERE member_id = ? AND idempotency_key = ? LIMIT 1'
        ).bind(userId, idempotencyKey).first<any>();

        if (existingOrder) {
          let deliveredCodes: string[] = [];
          try {
            deliveredCodes = JSON.parse(existingOrder.delivered_codes || '[]');
          } catch {}

          if (!deliveredCodes || deliveredCodes.length === 0) {
            const codeRows = await db.prepare(
              'SELECT code_content FROM inventory_codes WHERE order_id = ? ORDER BY id ASC'
            ).bind(existingOrder.id).all<any>();
            deliveredCodes = (codeRows.results || []).map((r: any) => r.code_content);
          }

          return {
            success: true,
            order: existingOrder,
            deliveredCodes,
            isIdempotentReplay: true,
            code: 'IDEMPOTENT_REPLAY',
          };
        }
      }
    }

    return {
      success: false,
      error: 'Lỗi thực thi giao dịch mua hàng trên D1: ' + msg,
      code: 'DB_ERROR',
    };
  }
}

export interface DriftAuditItem {
  productId: string;
  title: string;
  currentStock: number;
  actualAvailableStock: number;
  stockDelta: number;
  currentSold: number;
  actualSoldCount: number;
  soldDelta: number;
  hasDrift: boolean;
  status: 'IN_SYNC' | 'DRIFT_DETECTED' | 'REBALANCED';
}

export interface DriftAuditResult {
  success: boolean;
  auditedAt: string;
  autoFixed: boolean;
  totalProducts: number;
  driftDetectedCount: number;
  items: DriftAuditItem[];
  summary: string;
}

/**
 * Đồng bộ Counter Cache stock_quantity & sold_count trên store_products từ inventory_codes
 */
export async function syncProductStockCounter(db: D1Database, productId?: string): Promise<void> {
  try {
    await ensureSchemaUpgrades(db);
    if (productId) {
      await db.prepare(`
        UPDATE store_products
        SET stock_quantity = (
          SELECT COUNT(*) FROM inventory_codes
          WHERE (inventory_codes.product_id = store_products.id OR inventory_codes.product_id = ?) AND inventory_codes.status = 'AVAILABLE'
        ),
        sold_count = (
          SELECT COUNT(*) FROM inventory_codes
          WHERE (inventory_codes.product_id = store_products.id OR inventory_codes.product_id = ?) AND inventory_codes.status = 'SOLD'
        )
        WHERE id = ?;
      `).bind(productId, productId, productId).run().catch(() => {});

      await db.prepare(`
        UPDATE utilities
        SET stock_quantity = (
          SELECT COUNT(*) FROM inventory_codes
          WHERE (inventory_codes.product_id = utilities.id OR inventory_codes.product_id = ?) AND inventory_codes.status = 'AVAILABLE'
        ),
        sold_count = (
          SELECT COUNT(*) FROM inventory_codes
          WHERE (inventory_codes.product_id = utilities.id OR inventory_codes.product_id = ?) AND inventory_codes.status = 'SOLD'
        )
        WHERE id = ?;
      `).bind(productId, productId, productId).run().catch(() => {});
    } else {
      await db.prepare(`
        UPDATE store_products
        SET stock_quantity = (
          SELECT COUNT(*) FROM inventory_codes
          WHERE inventory_codes.product_id = store_products.id AND inventory_codes.status = 'AVAILABLE'
        ),
        sold_count = (
          SELECT COUNT(*) FROM inventory_codes
          WHERE inventory_codes.product_id = store_products.id AND inventory_codes.status = 'SOLD'
        );
      `).run().catch(() => {});

      await db.prepare(`
        UPDATE utilities
        SET stock_quantity = (
          SELECT COUNT(*) FROM inventory_codes
          WHERE inventory_codes.product_id = utilities.id AND inventory_codes.status = 'AVAILABLE'
        ),
        sold_count = (
          SELECT COUNT(*) FROM inventory_codes
          WHERE inventory_codes.product_id = utilities.id AND inventory_codes.status = 'SOLD'
        );
      `).run().catch(() => {});
    }
  } catch (err: any) {
    console.warn('[syncProductStockCounter Error]:', err?.message);
  }
}

/**
 * Kiểm toán & Tái cân bằng Counter Cache (Audit & Drift Recovery Engine)
 * Đối chiếu stock_quantity & sold_count hiện tại trên store_products với số liệu thực tế trong inventory_codes
 */
export async function auditAndRebalanceStockCounters(
  db: D1Database,
  autoFix: boolean = false
): Promise<DriftAuditResult> {
  await ensureSchemaUpgrades(db);
  const auditedAt = new Date().toISOString();

  try {
    // 1. Lấy danh sách sản phẩm và counter hiện tại
    const productsRes = await db.prepare(`
      SELECT id, title, stock_quantity, sold_count
      FROM store_products
      ORDER BY id ASC
    `).all<any>();
    const products = productsRes.results || [];

    // 2. Thống kê thực tế từ inventory_codes
    const statsRes = await db.prepare(`
      SELECT
        product_id,
        SUM(CASE WHEN status = 'AVAILABLE' THEN 1 ELSE 0 END) as avail_count,
        SUM(CASE WHEN status = 'SOLD' THEN 1 ELSE 0 END) as sold_count
      FROM inventory_codes
      GROUP BY product_id
    `).all<any>();

    const statsMap = new Map<string, { avail: number; sold: number }>();
    for (const r of (statsRes.results || [])) {
      if (r && r.product_id) {
        statsMap.set(r.product_id, {
          avail: Number(r.avail_count) || 0,
          sold: Number(r.sold_count) || 0,
        });
      }
    }

    const items: DriftAuditItem[] = [];
    let driftDetectedCount = 0;
    const rebalanceStatements: D1PreparedStatement[] = [];

    for (const prod of products) {
      const pId = prod.id;
      const title = prod.title || pId;
      const currentStock = Number(prod.stock_quantity) || 0;
      const currentSold = Number(prod.sold_count) || 0;

      const realStat = statsMap.get(pId) || { avail: 0, sold: 0 };
      const actualAvailableStock = realStat.avail;
      const actualSoldCount = realStat.sold;

      const stockDelta = actualAvailableStock - currentStock;
      const soldDelta = actualSoldCount - currentSold;
      const hasDrift = (stockDelta !== 0) || (soldDelta !== 0);

      let status: 'IN_SYNC' | 'DRIFT_DETECTED' | 'REBALANCED' = 'IN_SYNC';

      if (hasDrift) {
        driftDetectedCount++;
        if (autoFix) {
          status = 'REBALANCED';
          rebalanceStatements.push(
            db.prepare(`
              UPDATE store_products
              SET stock_quantity = ?,
                  sold_count = ?
              WHERE id = ?
            `).bind(actualAvailableStock, actualSoldCount, pId)
          );
          if (pId.startsWith('ut_')) {
            rebalanceStatements.push(
              db.prepare(`
                UPDATE utilities
                SET stock_quantity = ?,
                    sold_count = ?
                WHERE id = ?
              `).bind(actualAvailableStock, actualSoldCount, pId)
            );
          }
        } else {
          status = 'DRIFT_DETECTED';
        }
      }

      items.push({
        productId: pId,
        title,
        currentStock,
        actualAvailableStock,
        stockDelta,
        currentSold,
        actualSoldCount,
        soldDelta,
        hasDrift,
        status,
      });
    }

    // 3. Thực thi batch cập nhật nếu autoFix = true và có độ lệch
    if (autoFix && rebalanceStatements.length > 0) {
      await db.batch(rebalanceStatements);
    }

    const summary = driftDetectedCount === 0
      ? `Đã kiểm toán ${products.length} sản phẩm: 100% Counter Cache chuẩn xác (0 độ lệch).`
      : autoFix
        ? `Phát hiện ${driftDetectedCount}/${products.length} sản phẩm bị lệch Counter Cache. ĐÃ TỰ ĐỘNG KHÔI PHỤC VÀ TÁI CÂN BẰNG THÀNH CÔNG 100%.`
        : `Cảnh báo: Phát hiện ${driftDetectedCount}/${products.length} sản phẩm bị lệch Counter Cache. Chạy chế độ Auto-Recover để khôi phục.`;

    return {
      success: true,
      auditedAt,
      autoFixed: autoFix,
      totalProducts: products.length,
      driftDetectedCount,
      items,
      summary,
    };
  } catch (err: any) {
    return {
      success: false,
      auditedAt,
      autoFixed: autoFix,
      totalProducts: 0,
      driftDetectedCount: 0,
      items: [],
      summary: 'Lỗi trong quá trình kiểm toán Counter Cache: ' + (err?.message || String(err)),
    };
  }
}

/**
 * Execute atomic SePay Deposit in Cloudflare D1
 */
export async function depositSepayD1(db: D1Database, params: D1SepayDepositParams): Promise<{ success: boolean; duplicate?: boolean; balanceAfter?: number; error?: string }> {
  const { transactionId, gateway, accountNumber, amount, content, memberId } = params;

  try {
    const stmt1 = db.prepare(`
      INSERT INTO sepay_transactions (transaction_id, gateway, account_number, amount_in, transaction_content, member_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'SUCCESS')
    `).bind(transactionId, gateway, accountNumber, amount, content, memberId);

    const stmt2 = db.prepare(`
      UPDATE members
      SET balance = balance + ?
      WHERE id = ?
    `).bind(amount, memberId);

    const stmt3 = db.prepare(`
      INSERT INTO wallet_transactions (
        id, member_id, member_email, type, amount,
        balance_before, balance_after, description, status, order_id, created_at
      )
      SELECT
        ?,
        m.id,
        m.email,
        'DEPOSIT',
        ?,
        m.balance - ?,
        m.balance,
        'Nạp tiền tự động SePay #' || ?,
        'COMPLETED',
        NULL,
        datetime('now')
      FROM members m
      WHERE m.id = ?
    `).bind(`tx_dep_${transactionId}`, amount, amount, transactionId, memberId);

    await db.batch([stmt1, stmt2, stmt3]);

    const memRes = await db.prepare('SELECT balance FROM members WHERE id = ?').bind(memberId).first();
    const balanceAfter = memRes ? Number((memRes as any).balance) : undefined;

    return { success: true, balanceAfter };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (
      msg.includes('UNIQUE constraint failed: sepay_transactions.transaction_id') ||
      msg.includes('SQLITE_CONSTRAINT_UNIQUE') ||
      (msg.includes('UNIQUE') && msg.includes('sepay_transactions'))
    ) {
      return { success: false, duplicate: true, error: 'Giao dịch chuyển khoản này đã được xử lý trước đó (Idempotent).' };
    }
    return { success: false, error: msg };
  }
}

/**
 * Execute atomic Giveaway Claim in Cloudflare D1
 */
export async function claimGiveawayD1(db: D1Database, params: D1ClaimGiveawayParams): Promise<{ success: boolean; codeContent?: string; error?: string }> {
  const { claimId, giveawayId, memberId, clientIp, maxPerUser = 1, maxPerIp = 1 } = params;

  try {
    const stmt1 = db.prepare(`
      INSERT INTO giveaway_claim_guards (claim_id, user_ok, ip_ok, stock_ok)
      VALUES (
        ?,
        (SELECT CASE WHEN COUNT(*) < ? THEN 1 ELSE NULL END FROM giveaway_claims WHERE giveaway_id = ? AND member_id = ?),
        (SELECT CASE WHEN COUNT(*) < ? THEN 1 ELSE NULL END FROM giveaway_claims WHERE giveaway_id = ? AND client_ip = ?),
        (SELECT CASE WHEN (SELECT COUNT(*) FROM giveaway_codes WHERE giveaway_id = ? AND status = 'AVAILABLE') > 0 THEN 1 ELSE NULL END)
      )
    `).bind(claimId, maxPerUser, giveawayId, memberId, maxPerIp, giveawayId, clientIp, giveawayId);

    const stmt2 = db.prepare(`
      UPDATE giveaway_codes
      SET status = 'CLAIMED',
          claim_id = ?,
          claimed_at = datetime('now')
      WHERE id = (
        SELECT id FROM giveaway_codes
        WHERE giveaway_id = ? AND status = 'AVAILABLE'
        ORDER BY rowid ASC
        LIMIT 1
      )
    `).bind(claimId, giveawayId);

    const stmt3 = db.prepare(`
      INSERT INTO giveaway_claims (id, giveaway_id, member_id, client_ip, code_id, claimed_at)
      SELECT
        ?,
        ?,
        ?,
        ?,
        gc.id,
        datetime('now')
      FROM giveaway_codes gc
      WHERE gc.claim_id = ?
    `).bind(claimId, giveawayId, memberId, clientIp, claimId);

    await db.batch([stmt1, stmt2, stmt3]);

    const codeRow: any = await db.prepare('SELECT code_content FROM giveaway_codes WHERE claim_id = ?').bind(claimId).first();
    if (!codeRow || !codeRow.code_content) {
      return {
        success: false,
        error: 'Mã quà tặng của chương trình này đã hết hoặc đang được xử lý.',
      };
    }
    return {
      success: true,
      codeContent: codeRow.code_content,
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('giveaway_claim_guards.user_ok')) {
      return { success: false, error: `Bạn đã nhận đủ giới hạn (${maxPerUser} mã) cho sự kiện này.` };
    }
    if (msg.includes('UNIQUE constraint failed: giveaway_claims')) {
      return { success: false, error: 'Mã này vừa được giật bởi thành viên khác hoặc đã đạt giới hạn nhận.' };
    }
    if (msg.includes('giveaway_claim_guards.ip_ok')) {
      return { success: false, error: `Địa chỉ mạng (IP) của bạn đã đạt giới hạn nhận (${maxPerIp} mã).` };
    }
    if (msg.includes('giveaway_claim_guards.stock_ok')) {
      return { success: false, error: 'Mã quà tặng của chương trình này đã hết.' };
    }
    return { success: false, error: 'Không thể nhận quà tặng: ' + msg };
  }
}

/**
 * Read system setting / document from D1
 */
export async function getSettingD1<T = any>(db: D1Database, key: string, defaultValue: T | null = null): Promise<T | null> {
  try {
    await ensureSchemaUpgrades(db);
    const row = await db.prepare('SELECT value FROM system_settings WHERE key = ?').bind(key).first<any>();
    if (row && row.value !== undefined && row.value !== null) {
      try {
        return JSON.parse(row.value) as T;
      } catch {
        return row.value as unknown as T;
      }
    }
  } catch (err: any) {
    console.warn('[getSettingD1 error]', key, err?.message);
  }
  return defaultValue;
}

/**
 * Write / Upsert system setting into D1 (Zero KV write)
 */
export async function setSettingD1(db: D1Database, key: string, value: any): Promise<void> {
  try {
    await ensureSchemaUpgrades(db);
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    await db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).bind(key, strVal).run();
  } catch (err: any) {
    console.warn('[setSettingD1 error]', key, err?.message);
  }
}

/**
 * Read multiple system settings from D1 in one go
 */
export async function getMultipleSettingsD1(db: D1Database, keys: string[]): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  if (!keys || keys.length === 0) return result;
  try {
    await ensureSchemaUpgrades(db);
    const placeholders = keys.map(() => '?').join(',');
    const rows = await db.prepare(`SELECT key, value FROM system_settings WHERE key IN (${placeholders})`).bind(...keys).all<any>();
    if (rows && rows.results) {
      for (const r of rows.results) {
        if (r && r.key) {
          try {
            result[r.key] = JSON.parse(r.value);
          } catch {
            result[r.key] = r.value;
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[getMultipleSettingsD1 error]', err?.message);
  }
  return result;
}

/**
 * Batch Upsert Store Products to D1
 */
export async function syncProductsToD1(db: D1Database, products: any[]): Promise<void> {
  if (!products || !Array.isArray(products) || products.length === 0) return;
  await ensureSchemaUpgrades(db);
  const BATCH_SIZE = 50;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const slice = products.slice(i, i + BATCH_SIZE);
    const stmts: D1PreparedStatement[] = [];
    for (const p of slice) {
      if (!p || !p.id) continue;
      const pId = String(p.id).trim();
      const title = String(p.title || p.name || pId).trim();
      const gameSlug = String(p.game_slug || p.slug || '').trim();
      const gameName = String(p.game_name || p.gameName || '').trim();
      const origPrice = Math.max(0, Number(p.original_price || p.originalPrice || p.price || 0));
      const discPercent = Math.max(0, Math.min(100, Number(p.discount_percent || p.discountPercent || 0)));
      const currPrice = Math.max(0, Number(p.current_price || p.currentPrice || p.price || origPrice));
      const stockQty = Math.max(0, Number(p.stock_quantity ?? p.stockQuantity ?? 0));
      const soldCnt = Math.max(0, Number(p.sold_count ?? p.soldCount ?? 0));
      const isActive = p.is_active === false || p.isActive === false ? 0 : 1;
      const pkgType = String(p.package_type || p.category || 'pack').trim();
      const category = String(p.category || p.package_type || 'pack').trim();
      const categoryLabel = String(p.category_label || '').trim();
      const coverImageUrl = String(p.cover_image_url || p.game_icon_url || '').trim();
      const gameIconUrl = String(p.game_icon_url || p.cover_image_url || '').trim();
      const description = String(p.description || '').trim();
      const badge = String(p.badge || '').trim();
      const virtualSoldCount = Math.max(0, Number(p.virtual_sold_count || 0));
      const showSoldCount = p.show_sold_count === false ? 0 : 1;

      stmts.push(
        db.prepare(`
          INSERT INTO store_products (
            id, title, game_slug, game_name, original_price, discount_percent, current_price, stock_quantity, sold_count, is_active,
            package_type, category, category_label, cover_image_url, game_icon_url, description, badge, virtual_sold_count, show_sold_count
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            game_slug = excluded.game_slug,
            game_name = excluded.game_name,
            original_price = excluded.original_price,
            discount_percent = excluded.discount_percent,
            current_price = excluded.current_price,
            stock_quantity = excluded.stock_quantity,
            sold_count = excluded.sold_count,
            is_active = excluded.is_active,
            package_type = excluded.package_type,
            category = excluded.category,
            category_label = excluded.category_label,
            cover_image_url = excluded.cover_image_url,
            game_icon_url = excluded.game_icon_url,
            description = excluded.description,
            badge = excluded.badge,
            virtual_sold_count = excluded.virtual_sold_count,
            show_sold_count = excluded.show_sold_count
        `).bind(
          pId, title, gameSlug, gameName, origPrice, discPercent, currPrice, stockQty, soldCnt, isActive,
          pkgType, category, categoryLabel, coverImageUrl, gameIconUrl, description, badge, virtualSoldCount, showSoldCount
        )
      );
    }
    if (stmts.length > 0) {
      await db.batch(stmts).catch((err) => console.warn('[syncProductsToD1 batch error]', err?.message));
    }
  }

  // Double fail-safe: Also persist full store products payload in system_settings
  await setSettingD1(db, 'wcg_admin_store_products_v4', products).catch(() => {});
}

/**
 * Batch Upsert Utilities to D1 (Both utilities table and store_products for FK support)
 */
export async function syncUtilitiesToD1(db: D1Database, utilities: any[]): Promise<void> {
  if (!utilities || !Array.isArray(utilities) || utilities.length === 0) return;
  await ensureSchemaUpgrades(db);
  const BATCH_SIZE = 50;
  for (let i = 0; i < utilities.length; i += BATCH_SIZE) {
    const slice = utilities.slice(i, i + BATCH_SIZE);
    const stmts: D1PreparedStatement[] = [];
    for (const u of slice) {
      if (!u || !u.id) continue;
      const uId = String(u.id).trim();
      const title = String(u.title || u.name || uId).trim();
      const gameSlug = String(u.game_slug || u.slug || '').trim();
      const gameName = String(u.game_name || u.gameName || '').trim();
      const origPrice = Math.max(0, Number(u.original_price || u.originalPrice || u.price || 0));
      const discPercent = Math.max(0, Math.min(100, Number(u.discount_percent || u.discountPercent || 0)));
      const currPrice = Math.max(0, Number(u.current_price || u.currentPrice || u.price || origPrice));
      const stockQty = Math.max(0, Number(u.stock_quantity ?? u.stockQuantity ?? 0));
      const soldCnt = Math.max(0, Number(u.sold_count ?? u.soldCount ?? 0));
      const isActive = u.is_active === false || u.isActive === false ? 0 : 1;
      const category = String(u.category || 'other').trim();
      const categoryLabel = String(u.category_label || '').trim();
      const coverImageUrl = String(u.cover_image_url || u.icon_url || '').trim();
      const iconUrl = String(u.icon_url || u.cover_image_url || '').trim();
      const description = String(u.description || '').trim();
      const badge = String(u.badge || '').trim();
      const instructions = String(u.instructions || '').trim();
      const virtualSoldCount = Math.max(0, Number(u.virtual_sold_count || 0));
      const showSoldCount = u.show_sold_count === false ? 0 : 1;
      const guideUrl = String(u.guide_url || '').trim();
      const guideText = String(u.guide_text || '').trim();
      const guideLinks = typeof u.guide_links === 'string' ? u.guide_links : JSON.stringify(Array.isArray(u.guide_links) ? u.guide_links : []);
      const showGuideLink = u.show_guide_link === false ? 0 : 1;
      const warrantyText = String(u.warranty_text || '').trim();
      const showWarranty = u.show_warranty === false ? 0 : 1;
      const productImages = typeof u.product_images === 'string' ? u.product_images : JSON.stringify(Array.isArray(u.product_images) ? u.product_images : []);

      // Upsert into utilities table
      stmts.push(
        db.prepare(`
          INSERT INTO utilities (
            id, title, game_slug, game_name, original_price, discount_percent, current_price, stock_quantity, sold_count, is_active,
            category, category_label, cover_image_url, icon_url, description, badge, instructions, virtual_sold_count, show_sold_count,
            guide_url, guide_text, guide_links, show_guide_link, warranty_text, show_warranty, product_images
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            game_slug = excluded.game_slug,
            game_name = excluded.game_name,
            original_price = excluded.original_price,
            discount_percent = excluded.discount_percent,
            current_price = excluded.current_price,
            stock_quantity = excluded.stock_quantity,
            sold_count = excluded.sold_count,
            is_active = excluded.is_active,
            category = excluded.category,
            category_label = excluded.category_label,
            cover_image_url = excluded.cover_image_url,
            icon_url = excluded.icon_url,
            description = excluded.description,
            badge = excluded.badge,
            instructions = excluded.instructions,
            virtual_sold_count = excluded.virtual_sold_count,
            show_sold_count = excluded.show_sold_count,
            guide_url = excluded.guide_url,
            guide_text = excluded.guide_text,
            guide_links = excluded.guide_links,
            show_guide_link = excluded.show_guide_link,
            warranty_text = excluded.warranty_text,
            show_warranty = excluded.show_warranty,
            product_images = excluded.product_images
        `).bind(
          uId, title, gameSlug, gameName, origPrice, discPercent, currPrice, stockQty, soldCnt, isActive,
          category, categoryLabel, coverImageUrl, iconUrl, description, badge, instructions, virtualSoldCount, showSoldCount,
          guideUrl, guideText, guideLinks, showGuideLink, warrantyText, showWarranty, productImages
        )
      );

      // Also upsert into store_products table to preserve FK integrity for inventory and orders
      stmts.push(
        db.prepare(`
          INSERT INTO store_products (id, title, game_slug, game_name, original_price, discount_percent, current_price, stock_quantity, sold_count, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            game_slug = excluded.game_slug,
            game_name = excluded.game_name,
            original_price = excluded.original_price,
            discount_percent = excluded.discount_percent,
            current_price = excluded.current_price,
            stock_quantity = excluded.stock_quantity,
            sold_count = excluded.sold_count,
            is_active = excluded.is_active
        `).bind(uId, title, gameSlug, gameName, origPrice, discPercent, currPrice, stockQty, soldCnt, isActive)
      );
    }
    if (stmts.length > 0) {
      try {
        await db.batch(stmts);
      } catch (err: any) {
        console.warn('[syncUtilitiesToD1 batch error, trying base fallback]', err?.message);
        const fallbackStmts: D1PreparedStatement[] = [];
        for (const u of slice) {
          if (!u || !u.id) continue;
          const uId = String(u.id).trim();
          const title = String(u.title || u.name || uId).trim();
          const gameSlug = String(u.game_slug || u.slug || '').trim();
          const gameName = String(u.game_name || u.gameName || '').trim();
          const origPrice = Math.max(0, Number(u.original_price || u.originalPrice || u.price || 0));
          const discPercent = Math.max(0, Math.min(100, Number(u.discount_percent || u.discountPercent || 0)));
          const currPrice = Math.max(0, Number(u.current_price || u.currentPrice || u.price || origPrice));
          const stockQty = Math.max(0, Number(u.stock_quantity ?? u.stockQuantity ?? 0));
          const soldCnt = Math.max(0, Number(u.sold_count ?? u.soldCount ?? 0));
          const isActive = u.is_active === false || u.isActive === false ? 0 : 1;
          const category = String(u.category || 'other').trim();
          const categoryLabel = String(u.category_label || '').trim();
          const coverImageUrl = String(u.cover_image_url || u.icon_url || '').trim();
          const iconUrl = String(u.icon_url || u.cover_image_url || '').trim();
          const description = String(u.description || '').trim();
          const badge = String(u.badge || '').trim();
          const instructions = String(u.instructions || '').trim();
          const virtualSoldCount = Math.max(0, Number(u.virtual_sold_count || 0));
          const showSoldCount = u.show_sold_count === false ? 0 : 1;

          fallbackStmts.push(
            db.prepare(`
              INSERT INTO utilities (
                id, title, game_slug, game_name, original_price, discount_percent, current_price, stock_quantity, sold_count, is_active,
                category, category_label, cover_image_url, icon_url, description, badge, instructions, virtual_sold_count, show_sold_count
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                game_slug = excluded.game_slug,
                game_name = excluded.game_name,
                original_price = excluded.original_price,
                discount_percent = excluded.discount_percent,
                current_price = excluded.current_price,
                stock_quantity = excluded.stock_quantity,
                sold_count = excluded.sold_count,
                is_active = excluded.is_active,
                category = excluded.category,
                category_label = excluded.category_label,
                cover_image_url = excluded.cover_image_url,
                icon_url = excluded.icon_url,
                description = excluded.description,
                badge = excluded.badge,
                instructions = excluded.instructions,
                virtual_sold_count = excluded.virtual_sold_count,
                show_sold_count = excluded.show_sold_count
            `).bind(
              uId, title, gameSlug, gameName, origPrice, discPercent, currPrice, stockQty, soldCnt, isActive,
              category, categoryLabel, coverImageUrl, iconUrl, description, badge, instructions, virtualSoldCount, showSoldCount
            )
          );
        }
        if (fallbackStmts.length > 0) {
          await db.batch(fallbackStmts).catch((fbErr) => console.warn('[syncUtilitiesToD1 base fallback error]', fbErr?.message));
        }
      }

      // Explicit description update guarantee
      const descStmts: D1PreparedStatement[] = [];
      for (const u of slice) {
        if (u && u.id && u.description) {
          descStmts.push(db.prepare('UPDATE utilities SET description = ? WHERE id = ?').bind(String(u.description).trim(), String(u.id).trim()));
        }
      }
      if (descStmts.length > 0) {
        await db.batch(descStmts).catch((descErr) => console.warn('[syncUtilitiesToD1 desc update error]', descErr?.message));
      }
    }
  }

  // Double fail-safe: Also persist full utilities payload in system_settings
  await setSettingD1(db, 'wcg_admin_utilities_v4', utilities).catch(() => {});
}

/**
 * Batch Upsert Giveaways & codes_pool to D1
 */
export async function syncGiveawaysToD1(db: D1Database, giveaways: any[]): Promise<void> {
  if (!giveaways || !Array.isArray(giveaways) || giveaways.length === 0) return;
  await ensureSchemaUpgrades(db);
  for (const gw of giveaways) {
    if (!gw || !gw.id) continue;
    const pool = Array.isArray(gw.codes_pool) ? gw.codes_pool : [];
    const remainingCount = Array.isArray(gw.codes_pool)
      ? gw.codes_pool.length
      : (typeof gw.remaining_codes === 'number' ? gw.remaining_codes : Math.max(0, (gw.total_codes || 0) - (gw.claimed_codes || 0)));
    const claimedCount = Number(gw.claimed_codes) || 0;
    const totalCount = Number(gw.total_codes) || (remainingCount + claimedCount);
    const minAccountAge = Math.max(0, Number(gw.min_account_age_days ?? gw.minAccountAgeDays ?? 0));
    const rawMaxUser = Number(gw.max_per_user ?? gw.maxPerUser);
    const maxUser = (rawMaxUser === 0 || rawMaxUser >= 999999) ? 999999 : (rawMaxUser > 0 ? rawMaxUser : 1);
    const rawMaxIp = Number(gw.max_per_ip ?? gw.maxPerIp);
    const maxIp = (rawMaxIp === 0 || rawMaxIp >= 999999) ? 999999 : (rawMaxIp > 0 ? rawMaxIp : 1);
    const cooldown = Math.max(0, Number(gw.cooldown_hours ?? gw.cooldownHours ?? 0));
    const showClaimed = (gw.show_claimed_count !== false && (gw as any).showClaimedCount !== false) ? 1 : 0;
    const virtualOffset = Number(gw.virtual_claimed_offset ?? gw.virtualClaimedOffset ?? 0);
    const isActive = (gw.is_active !== false && (gw as any).isActive !== false) ? 1 : 0;
    const status = gw.status === 'ENDED' ? 'ENDED' : (isActive === 0 ? 'PAUSED' : 'ACTIVE');
    const description = gw.description || '';
    const rewards = gw.rewards || '';
    const startTime = gw.start_time || gw.startTime || null;
    const endTime = gw.end_time || gw.endTime || null;
    const coverImageUrl = gw.cover_image_url || gw.coverImageUrl || null;
    const gameIconUrl = gw.game_icon_url || gw.gameIconUrl || null;

    await db.prepare(`
      INSERT INTO giveaways (
        id, title, game_slug, game_name, description, rewards,
        total_codes, remaining_codes, claimed_codes,
        min_account_age_days, max_per_user, max_per_ip, cooldown_hours,
        show_claimed_count, virtual_claimed_offset,
        start_time, end_time, is_active,
        cover_image_url, game_icon_url, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        game_slug = excluded.game_slug,
        game_name = excluded.game_name,
        description = excluded.description,
        rewards = excluded.rewards,
        total_codes = excluded.total_codes,
        remaining_codes = excluded.remaining_codes,
        claimed_codes = excluded.claimed_codes,
        min_account_age_days = excluded.min_account_age_days,
        max_per_user = excluded.max_per_user,
        max_per_ip = excluded.max_per_ip,
        cooldown_hours = excluded.cooldown_hours,
        show_claimed_count = excluded.show_claimed_count,
        virtual_claimed_offset = excluded.virtual_claimed_offset,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        is_active = excluded.is_active,
        cover_image_url = excluded.cover_image_url,
        game_icon_url = excluded.game_icon_url,
        status = excluded.status,
        created_at = COALESCE(giveaways.created_at, excluded.created_at)
    `).bind(
      gw.id,
      gw.title || gw.rewards || 'Chiến dịch Giveaway',
      gw.game_slug || gw.gameSlug || 'giveaway',
      gw.game_name || gw.gameName || 'Game',
      description,
      rewards,
      totalCount,
      remainingCount,
      claimedCount,
      minAccountAge,
      maxUser,
      maxIp,
      cooldown,
      showClaimed,
      virtualOffset,
      startTime,
      endTime,
      isActive,
      coverImageUrl,
      gameIconUrl,
      status,
      gw.created_at || gw.createdAt || new Date().toISOString()
    ).run().catch((e) => console.warn('[syncGiveawaysToD1 gw error]', e?.message));

    // Reconcile and batch insert codes_pool into giveaway_codes if present
    if (pool.length > 0) {
      // 1. Delete old UNCLAIMED codes for this campaign so the warehouse strictly matches admin's pool
      await db.prepare("DELETE FROM giveaway_codes WHERE giveaway_id = ? AND status = 'AVAILABLE'").bind(gw.id).run().catch(() => {});

      // 2. Insert codes from pool with unique IDs to allow any code value (even re-stocked or duplicate promo codes)
      const BATCH_SIZE = 50;
      for (let j = 0; j < pool.length; j += BATCH_SIZE) {
        const slice = pool.slice(j, j + BATCH_SIZE);
        const codeStmts: D1PreparedStatement[] = [];
        for (let sIdx = 0; sIdx < slice.length; sIdx++) {
          const codeStr = slice[sIdx];
          if (!codeStr || !codeStr.trim()) continue;
          const codeVal = codeStr.trim();
          const codeId = `gwc_${gw.id}_${Date.now()}_${j + sIdx}_${Math.random().toString(36).substring(2, 7)}`;
          codeStmts.push(
            db.prepare(`
              INSERT INTO giveaway_codes (id, giveaway_id, code_content, status, created_at)
              VALUES (?, ?, ?, 'AVAILABLE', datetime('now'))
            `).bind(codeId, gw.id, codeVal)
          );
        }
        if (codeStmts.length > 0) {
          await db.batch(codeStmts).catch(() => {});
        }
      }

      // 3. Keep remaining_codes strictly synced
      await db.prepare(`
        UPDATE giveaways
        SET remaining_codes = ?,
            total_codes = claimed_codes + ?
        WHERE id = ?
      `).bind(pool.length, pool.length, gw.id).run().catch(() => {});
    } else if (Array.isArray(gw.codes_pool) && gw.codes_pool.length === 0) {
      await db.prepare("DELETE FROM giveaway_codes WHERE giveaway_id = ? AND status = 'AVAILABLE'").bind(gw.id).run().catch(() => {});
      await db.prepare("UPDATE giveaways SET remaining_codes = 0 WHERE id = ?").bind(gw.id).run().catch(() => {});
    }
  }

  // Double fail-safe: Also persist full giveaways payload in system_settings
  await setSettingD1(db, 'wcg_admin_giveaways_v4', giveaways).catch(() => {});
}

/**
 * Batch Upsert Inventory Codes to D1
 */
export async function syncInventoryToD1(db: D1Database, inventory: any[]): Promise<void> {
  if (!inventory || !Array.isArray(inventory) || inventory.length === 0) return;
  await ensureSchemaUpgrades(db);
  const BATCH_SIZE = 50;
  for (let i = 0; i < inventory.length; i += BATCH_SIZE) {
    const slice = inventory.slice(i, i + BATCH_SIZE);
    const stmts: D1PreparedStatement[] = [];
    for (const item of slice) {
      if (!item) continue;
      const pId = String(item.sku || item.productId || item.product_id || '').trim();
      const codeContent = String(item.codeValue || item.code_content || item.code || '').trim();
      if (!pId || !codeContent) continue;
      const itemId = item.id || `inv_${pId}_${encodeURIComponent(codeContent)}`;
      const rawStatus = String(item.status || '').toUpperCase();
      const status = (rawStatus === 'SOLD') ? 'SOLD' : (rawStatus === 'HOLD' ? 'HOLD' : 'AVAILABLE');
      stmts.push(
        db.prepare(`
          INSERT INTO inventory_codes (id, product_id, code_content, status, order_id, sold_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = CASE WHEN inventory_codes.status = 'SOLD' THEN 'SOLD' ELSE excluded.status END,
            order_id = COALESCE(inventory_codes.order_id, excluded.order_id),
            sold_at = COALESCE(inventory_codes.sold_at, excluded.sold_at)
        `).bind(
          itemId,
          pId,
          codeContent,
          status,
          item.orderId || item.order_id || null,
          item.soldAt || item.sold_at || null,
          item.createdAt || item.created_at || new Date().toISOString()
        )
      );
    }
    if (stmts.length > 0) {
      await db.batch(stmts).catch((err: any) => {
        console.error('[syncInventoryToD1 Batch Error]:', err?.message || err);
      });
    }
  }
  await syncProductStockCounter(db);
}

/**
 * Batch Upsert Members to D1
 */
export async function syncMembersToD1(db: D1Database, members: any[]): Promise<void> {
  if (!members || !Array.isArray(members) || members.length === 0) return;
  await ensureSchemaUpgrades(db);
  const BATCH_SIZE = 50;
  for (let i = 0; i < members.length; i += BATCH_SIZE) {
    const slice = members.slice(i, i + BATCH_SIZE);
    const stmts: D1PreparedStatement[] = [];
    for (const m of slice) {
      if (!m || !m.id) continue;
      const role = ['MEMBER', 'VIP', 'ADMIN', 'SUPER_ADMIN'].includes(String(m.role || '').toUpperCase())
        ? String(m.role).toUpperCase()
        : 'MEMBER';
      const balance = Math.max(0, Number(m.balance) || 0);
      const totalSpent = Math.max(0, Number(m.totalSpent || m.total_spent || 0));
      const status = m.status === 'BANNED' ? 'BANNED' : 'ACTIVE';
      stmts.push(
        db.prepare(`
          INSERT INTO members (id, username, display_name, email, phone, role, balance, total_spent, status, salt, password_hash, session_token, last_login, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            username = excluded.username,
            display_name = excluded.display_name,
            email = excluded.email,
            phone = excluded.phone,
            role = excluded.role,
            balance = CASE 
              WHEN (SELECT COUNT(*) FROM wallet_transactions WHERE member_id = members.id) > 0 
              THEN members.balance 
              ELSE excluded.balance 
            END,
            total_spent = CASE 
              WHEN (SELECT COUNT(*) FROM wallet_transactions WHERE member_id = members.id) > 0 
              THEN members.total_spent 
              ELSE excluded.total_spent 
            END,
            status = excluded.status,
            salt = CASE WHEN excluded.salt != '' AND excluded.password_hash != '' THEN excluded.salt ELSE members.salt END,
            password_hash = CASE WHEN excluded.password_hash != '' THEN excluded.password_hash ELSE members.password_hash END,
            session_token = COALESCE(excluded.session_token, members.session_token),
            last_login = COALESCE(excluded.last_login, members.last_login)
        `).bind(
          m.id,
          m.username || m.displayName || m.id,
          m.displayName || m.username || m.id,
          m.email || `${m.id}@webcodegame.vn`,
          m.phone || '',
          role,
          balance,
          totalSpent,
          status,
          m.salt || '',
          m.passwordHash || m.password_hash || '',
          m.sessionToken || m.session_token || null,
          m.lastLogin || m.last_login || null,
          m.createdAt || m.created_at || new Date().toISOString()
        )
      );
    }
    if (stmts.length > 0) {
      await db.batch(stmts).catch(() => {});
    }
  }
}

/**
 * Reset all Member Wallets, Ledger Transactions, and Orders Revenue to 0 in D1
 */
export async function resetAllWalletsAndRevenueD1(db: D1Database): Promise<void> {
  await db.prepare('UPDATE members SET balance = 0, total_spent = 0').run().catch(() => {});
  await db.prepare('DELETE FROM wallet_transactions').run().catch(() => {});
  await db.prepare('DELETE FROM orders').run().catch(() => {});
  await db.prepare('DELETE FROM sepay_transactions').run().catch(() => {});
  await setSettingD1(db, 'wcg_admin_transactions_v4', []);
  await setSettingD1(db, 'wcg_admin_orders_v4', []);
}

/**
 * Load all Store Products from D1
 */
export async function loadAllStoreProductsD1(db: D1Database): Promise<any[]> {
  try {
    await ensureSchemaUpgrades(db);
    const metaSetting = await getSettingD1(db, 'wcg_admin_store_products_v4').catch(() => null);
    const metaMap = new Map<string, any>();
    if (Array.isArray(metaSetting)) {
      metaSetting.forEach((m: any) => {
        if (m && m.id) metaMap.set(m.id, m);
      });
    }

    const res = await db.prepare(`
      SELECT 
        sp.id, 
        sp.title, 
        sp.game_slug, 
        sp.game_name, 
        sp.original_price, 
        sp.discount_percent, 
        sp.current_price, 
        CASE 
          WHEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = sp.id) > 0 
          THEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = sp.id AND ic.status = 'AVAILABLE')
          ELSE sp.stock_quantity 
        END AS stock_quantity,
        CASE 
          WHEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = sp.id) > 0 
          THEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = sp.id AND ic.status = 'SOLD')
          ELSE sp.sold_count 
        END AS sold_count,
        sp.is_active, 
        COALESCE(sp.package_type, 'pack') AS package_type,
        COALESCE(sp.category, 'pack') AS category,
        COALESCE(sp.category_label, '') AS category_label,
        COALESCE(sp.cover_image_url, '') AS cover_image_url,
        COALESCE(sp.game_icon_url, '') AS game_icon_url,
        COALESCE(sp.description, '') AS description,
        COALESCE(sp.badge, '') AS badge,
        COALESCE(sp.virtual_sold_count, 0) AS virtual_sold_count,
        COALESCE(sp.show_sold_count, 1) AS show_sold_count,
        sp.created_at
      FROM store_products sp
      WHERE sp.is_active = 1 AND sp.id NOT LIKE 'ut_%'
      ORDER BY sp.id ASC
    `).all();
    const rows = (res && res.results) || [];
    if (rows.length === 0 && Array.isArray(metaSetting) && metaSetting.length > 0) {
      return metaSetting;
    }
    return rows.map((r: any) => {
      const meta = metaMap.get(r.id) || {};
      return {
        ...meta,
        ...r,
        virtual_sold_count: meta.virtual_sold_count !== undefined ? Math.max(0, Number(meta.virtual_sold_count) || 0) : Math.max(0, Number(r.virtual_sold_count) || 0),
        fomo_anchor_time: meta.fomo_anchor_time || r.fomo_anchor_time || null,
        show_stock_count: r.show_stock_count !== undefined ? Boolean(r.show_stock_count) : (meta.show_stock_count !== undefined ? Boolean(meta.show_stock_count) : true),
        show_sold_count: r.show_sold_count !== undefined ? Boolean(r.show_sold_count) : (meta.show_sold_count !== undefined ? Boolean(meta.show_sold_count) : true),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Load all active Utilities from D1
 */
export async function loadAllUtilitiesD1(db: D1Database): Promise<any[]> {
  try {
    await ensureSchemaUpgrades(db);
    const metaSetting = await getSettingD1(db, 'wcg_admin_utilities_v4').catch(() => null);
    const metaMap = new Map<string, any>();
    if (Array.isArray(metaSetting)) {
      metaSetting.forEach((m: any) => {
        if (m && m.id) metaMap.set(m.id, m);
      });
    }

    let rows: any[] = [];
    try {
      const res = await db.prepare(`
        SELECT 
          u.id, 
          u.title, 
          u.game_slug, 
          u.game_name, 
          u.original_price, 
          u.discount_percent, 
          u.current_price, 
          CASE 
            WHEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = u.id) > 0 
            THEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = u.id AND ic.status = 'AVAILABLE')
            ELSE u.stock_quantity 
          END AS stock_quantity,
          CASE 
            WHEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = u.id) > 0 
            THEN (SELECT COUNT(*) FROM inventory_codes ic WHERE ic.product_id = u.id AND ic.status = 'SOLD')
            ELSE u.sold_count 
          END AS sold_count,
          u.is_active, 
          COALESCE(u.category, 'other') AS category,
          COALESCE(u.category_label, '') AS category_label,
          COALESCE(u.cover_image_url, '') AS cover_image_url,
          COALESCE(u.icon_url, '') AS icon_url,
          COALESCE(u.description, '') AS description,
          COALESCE(u.badge, '') AS badge,
          COALESCE(u.instructions, '') AS instructions,
          COALESCE(u.virtual_sold_count, 0) AS virtual_sold_count,
          COALESCE(u.show_sold_count, 1) AS show_sold_count,
          COALESCE(u.guide_url, '') AS guide_url,
          COALESCE(u.guide_text, '') AS guide_text,
          COALESCE(u.guide_links, '[]') AS guide_links,
          COALESCE(u.show_guide_link, 1) AS show_guide_link,
          COALESCE(u.warranty_text, '') AS warranty_text,
          COALESCE(u.show_warranty, 1) AS show_warranty,
          COALESCE(u.product_images, '[]') AS product_images,
          u.created_at
        FROM utilities u
        WHERE u.is_active = 1
        ORDER BY u.id ASC
      `).all();
      rows = (res && res.results) || [];
    } catch {
      const fallbackRes = await db.prepare(`
        SELECT 
          u.id, u.title, u.game_slug, u.game_name, u.original_price, u.discount_percent, u.current_price,
          u.stock_quantity, u.sold_count, u.is_active,
          COALESCE(u.category, 'other') AS category,
          COALESCE(u.category_label, '') AS category_label,
          COALESCE(u.cover_image_url, '') AS cover_image_url,
          COALESCE(u.icon_url, '') AS icon_url,
          COALESCE(u.description, '') AS description,
          COALESCE(u.badge, '') AS badge,
          COALESCE(u.instructions, '') AS instructions,
          COALESCE(u.virtual_sold_count, 0) AS virtual_sold_count,
          COALESCE(u.show_sold_count, 1) AS show_sold_count,
          u.created_at
        FROM utilities u
        WHERE u.is_active = 1
        ORDER BY u.id ASC
      `).all().catch(() => null);
      rows = (fallbackRes && fallbackRes.results) || [];
    }

    if (rows.length === 0 && Array.isArray(metaSetting) && metaSetting.length > 0) {
      return metaSetting;
    }

    return rows.map((r: any) => {
      const meta = metaMap.get(r.id) || {};
      let guideLinks = [];
      try {
        guideLinks = typeof r.guide_links === 'string' ? JSON.parse(r.guide_links) : (Array.isArray(r.guide_links) ? r.guide_links : []);
      } catch {
        guideLinks = [];
      }
      if ((!guideLinks || guideLinks.length === 0) && Array.isArray(meta.guide_links)) {
        guideLinks = meta.guide_links;
      }

      let productImages = [];
      try {
        productImages = typeof r.product_images === 'string' ? JSON.parse(r.product_images) : (Array.isArray(r.product_images) ? r.product_images : []);
      } catch {
        productImages = [];
      }
      if ((!productImages || productImages.length === 0) && Array.isArray(meta.product_images)) {
        productImages = meta.product_images;
      }

      return {
        ...meta,
        ...r,
        guide_url: r.guide_url || meta.guide_url || '',
        guide_text: r.guide_text || meta.guide_text || '',
        guide_links: guideLinks,
        show_guide_link: r.show_guide_link !== undefined ? Boolean(r.show_guide_link) : (meta.show_guide_link !== undefined ? Boolean(meta.show_guide_link) : true),
        warranty_text: r.warranty_text || meta.warranty_text || '',
        show_warranty: r.show_warranty !== undefined ? Boolean(r.show_warranty) : (meta.show_warranty !== undefined ? Boolean(meta.show_warranty) : true),
        product_images: productImages.length > 0 ? productImages : (meta.product_images || ['/vs-phone-logo.png']),
        description: r.description || meta.description || '',
        instructions: r.instructions || meta.instructions || '',
      };
    });
  } catch {
    return [];
  }
}

/**
 * Delete a Store Product from D1:
 * - Deletes all available inventory codes for this product
 * - Attempts hard delete of the product
 * - Falls back to soft-delete (is_active = 0) if referenced by completed orders (FK constraint)
 */
export async function deleteStoreProductD1(db: D1Database, productId: string): Promise<void> {
  if (!productId) return;
  await ensureSchemaUpgrades(db);
  // 1. Delete all unsold inventory codes (both AVAILABLE and HOLD)
  await db.prepare("DELETE FROM inventory_codes WHERE product_id = ? AND status != 'SOLD'").bind(productId).run().catch(() => {});
  // 2. Try hard delete of the product
  const res = await db.prepare("DELETE FROM store_products WHERE id = ?").bind(productId).run().catch(() => null);
  // 3. Fallback to soft delete if referenced by foreign key in orders
  if (!res || !res.success) {
    await db.prepare("UPDATE store_products SET is_active = 0, stock_quantity = 0 WHERE id = ?").bind(productId).run().catch(() => {});
  }
}

/**
 * Delete a Utility Product from D1:
 * - Deletes all available and hold inventory codes
 * - Hard deletes from utilities and store_products (fallback to is_active = 0)
 */
export async function deleteUtilityD1(db: D1Database, utilityId: string): Promise<void> {
  if (!utilityId) return;
  await ensureSchemaUpgrades(db);
  await db.prepare("DELETE FROM inventory_codes WHERE product_id = ? AND status != 'SOLD'").bind(utilityId).run().catch(() => {});
  const res = await db.prepare("DELETE FROM utilities WHERE id = ?").bind(utilityId).run().catch(() => null);
  if (!res || !res.success) {
    await db.prepare("UPDATE utilities SET is_active = 0, stock_quantity = 0 WHERE id = ?").bind(utilityId).run().catch(() => {});
  }
  await db.prepare("DELETE FROM store_products WHERE id = ?").bind(utilityId).run().catch(() => {
    db.prepare("UPDATE store_products SET is_active = 0, stock_quantity = 0 WHERE id = ?").bind(utilityId).run().catch(() => {});
  });
}

/**
 * Delete specific Inventory Codes from D1 by IDs (only unsold codes)
 */
export async function deleteInventoryCodesD1(db: D1Database, codeIds: string[]): Promise<void> {
  if (!codeIds || !Array.isArray(codeIds) || codeIds.length === 0) return;
  await ensureSchemaUpgrades(db);
  const BATCH_SIZE = 50;
  for (let i = 0; i < codeIds.length; i += BATCH_SIZE) {
    const slice = codeIds.slice(i, i + BATCH_SIZE);
    const placeholders = slice.map(() => '?').join(',');
    await db.prepare(`DELETE FROM inventory_codes WHERE (id IN (${placeholders}) OR code_content IN (${placeholders})) AND status != 'SOLD'`).bind(...slice, ...slice).run().catch(() => {});
  }
  await syncProductStockCounter(db);
}

/**
 * Purge all orphaned inventory codes belonging to inactive or deleted products
 */
export async function purgeOrphanedInventoryCodesD1(db: D1Database): Promise<void> {
  try {
    await ensureSchemaUpgrades(db);
    // Delete unsold inventory codes for products/utilities marked is_active = 0
    await db.prepare(`
      DELETE FROM inventory_codes
      WHERE status != 'SOLD'
      AND (
        product_id IN (SELECT id FROM store_products WHERE is_active = 0)
        OR product_id IN (SELECT sku FROM store_products WHERE is_active = 0 AND sku IS NOT NULL AND sku != '')
        OR product_id IN (SELECT id FROM utilities WHERE is_active = 0)
        OR product_id IN (SELECT sku FROM utilities WHERE is_active = 0 AND sku IS NOT NULL AND sku != '')
      )
    `).run().catch(() => {});
  } catch {}
}

/**
 * Load all Giveaways from D1 (optionally with codes_pool)
 */
export async function loadAllGiveawaysD1(db: D1Database, includeCodes: boolean = false): Promise<any[]> {
  try {
    await ensureSchemaUpgrades(db);
    const metaSetting = await getSettingD1(db, 'wcg_admin_giveaways_v4').catch(() => null);
    const metaMap = new Map<string, any>();
    if (Array.isArray(metaSetting)) {
      metaSetting.forEach((m: any) => {
        if (m && m.id) metaMap.set(m.id, m);
      });
    }

    const res = await db.prepare(`
      SELECT 
        g.id, 
        g.title, 
        g.game_slug, 
        COALESCE(g.game_name, '') AS game_name, 
        COALESCE(g.description, '') AS description, 
        COALESCE(g.rewards, '') AS rewards, 
        g.total_codes, 
        CASE 
          WHEN (SELECT COUNT(*) FROM giveaway_codes gc WHERE gc.giveaway_id = g.id) > 0 
          THEN (SELECT COUNT(*) FROM giveaway_codes gc WHERE gc.giveaway_id = g.id AND gc.status = 'AVAILABLE')
          ELSE g.remaining_codes 
        END AS remaining_codes,
        CASE 
          WHEN (SELECT COUNT(*) FROM giveaway_codes gc WHERE gc.giveaway_id = g.id) > 0 
          THEN (SELECT COUNT(*) FROM giveaway_codes gc WHERE gc.giveaway_id = g.id AND gc.status = 'CLAIMED')
          ELSE g.claimed_codes 
        END AS claimed_codes,
        COALESCE(g.min_account_age_days, 0) AS min_account_age_days,
        COALESCE(g.max_per_user, 1) AS max_per_user, 
        COALESCE(g.max_per_ip, 1) AS max_per_ip, 
        COALESCE(g.cooldown_hours, 0) AS cooldown_hours, 
        CASE WHEN g.show_claimed_count = 0 THEN 0 ELSE 1 END AS show_claimed_count,
        COALESCE(g.virtual_claimed_offset, 0) AS virtual_claimed_offset,
        g.start_time,
        g.end_time,
        CASE WHEN g.is_active = 0 THEN 0 ELSE 1 END AS is_active,
        g.cover_image_url,
        g.game_icon_url,
        g.status, 
        g.created_at
      FROM giveaways g
      ORDER BY g.created_at DESC
    `).all();
    const rows = (res && res.results) || [];
    if (rows.length === 0 && Array.isArray(metaSetting) && metaSetting.length > 0) {
      return metaSetting;
    }
    const list = rows.map((gw: any) => {
      const meta = metaMap.get(gw.id) || {};
      return {
        ...meta,
        ...gw,
        virtual_claimed_offset: meta.virtual_claimed_offset !== undefined ? Math.max(0, Number(meta.virtual_claimed_offset) || 0) : Math.max(0, Number(gw.virtual_claimed_offset) || 0),
        fomo_anchor_time: meta.fomo_anchor_time || gw.fomo_anchor_time || null,
        show_claimed_count: gw.show_claimed_count !== undefined ? Boolean(gw.show_claimed_count) : (meta.show_claimed_count !== undefined ? Boolean(meta.show_claimed_count) : true),
      };
    });
    if (!includeCodes || list.length === 0) return list;

    const [codesRes, claimsRes] = await Promise.all([
      db.prepare(`
        SELECT giveaway_id, code_content
        FROM giveaway_codes
        WHERE status = 'AVAILABLE'
        ORDER BY rowid ASC
      `).all().catch(() => ({ results: [] })),
      db.prepare(`
        SELECT 
          cl.id,
          cl.giveaway_id,
          COALESCE(m.username, cl.member_id) as user,
          COALESCE(m.email, '') as email,
          gc.code_content as code,
          cl.claimed_at as claimedAt
        FROM giveaway_claims cl
        JOIN giveaway_codes gc ON cl.code_id = gc.id
        LEFT JOIN members m ON cl.member_id = m.id
        ORDER BY cl.claimed_at DESC
        LIMIT 500
      `).all().catch(() => ({ results: [] })),
    ]);

    const poolMap = new Map<string, string[]>();
    for (const r of ((codesRes && codesRes.results) || [])) {
      const gwId = (r as any).giveaway_id;
      const code = (r as any).code_content;
      if (!poolMap.has(gwId)) poolMap.set(gwId, []);
      poolMap.get(gwId)!.push(code);
    }

    const historyMap = new Map<string, any[]>();
    for (const c of ((claimsRes && claimsRes.results) || [])) {
      const gwId = (c as any).giveaway_id;
      if (!historyMap.has(gwId)) historyMap.set(gwId, []);
      historyMap.get(gwId)!.push({
        id: (c as any).id,
        user: (c as any).user,
        email: (c as any).email,
        code: (c as any).code,
        claimedAt: (c as any).claimedAt,
      });
    }

    return list.map((gw: any) => ({
      ...gw,
      codes_pool: poolMap.get(gw.id) || [],
      claim_history: historyMap.get(gw.id) || [],
    }));
  } catch {
    return [];
  }
}

/**
 * Load all Members from D1
 */
export async function loadAllMembersD1(db: D1Database, stripSensitive: boolean = true): Promise<any[]> {
  try {
    await ensureSchemaUpgrades(db);
    const res = await db.prepare(`
      SELECT 
        id, 
        username, 
        display_name, 
        display_name AS displayName,
        email, 
        phone, 
        role, 
        COALESCE(
          (SELECT balance_after FROM wallet_transactions WHERE member_id = members.id ORDER BY created_at DESC LIMIT 1),
          balance
        ) AS balance, 
        COALESCE(
          (SELECT balance_after FROM wallet_transactions WHERE member_id = members.id ORDER BY created_at DESC LIMIT 1),
          balance
        ) AS wallet_balance,
        total_spent, 
        total_spent AS totalSpent,
        status, 
        avatar_url, 
        avatar_url AS avatar,
        session_token, 
        last_login, 
        created_at, 
        created_at AS createdAt,
        registered_ip
      ${stripSensitive ? '' : ', salt, password_hash, recovery_otp, otp_expires_at, otp_attempts'}
      FROM members
      ORDER BY created_at DESC
    `).all();
    return (res && res.results) || [];
  } catch {
    return [];
  }
}

/**
 * Batch Upsert Wallet Transactions to D1
 */
export async function syncTransactionsToD1(db: D1Database, transactions: any[]): Promise<void> {
  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) return;
  await ensureSchemaUpgrades(db);
  const BATCH_SIZE = 50;
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const slice = transactions.slice(i, i + BATCH_SIZE);
    const stmts: D1PreparedStatement[] = [];
    for (const tx of slice) {
      if (!tx || !tx.id) continue;
      const txId = String(tx.id).trim();
      const memberId = String(tx.memberId || tx.member_id || '').trim();
      const memberEmail = String(tx.memberEmail || tx.member_email || '').trim();
      let type = String(tx.type || 'DEPOSIT').toUpperCase();
      if (!['DEPOSIT', 'ORDER_PAYMENT', 'REFUND', 'ADMIN_ADJUST'].includes(type)) {
        type = type === 'REWARD' ? 'ADMIN_ADJUST' : 'DEPOSIT';
      }
      const amount = Number(tx.amount) || 0;
      const balanceBefore = Math.max(0, Number(tx.balanceBefore ?? tx.balance_before) || 0);
      const balanceAfter = Math.max(0, Number(tx.balanceAfter ?? tx.balance_after) || 0);
      const description = String(tx.note || tx.description || 'Giao dịch ví').trim();
      const status = ['COMPLETED', 'PENDING', 'FAILED'].includes(String(tx.status).toUpperCase())
        ? String(tx.status).toUpperCase()
        : 'COMPLETED';
      const orderId = tx.orderId || tx.order_id || null;
      const createdAt = tx.createdAt || tx.created_at || new Date().toISOString();

      if (!memberId) continue;

      stmts.push(
        db.prepare(`
          INSERT INTO wallet_transactions (id, member_id, member_email, type, amount, balance_before, balance_after, description, status, order_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            description = excluded.description
        `).bind(
          txId,
          memberId,
          memberEmail,
          type,
          amount,
          balanceBefore,
          balanceAfter,
          description,
          status,
          orderId,
          createdAt
        )
      );
    }
    if (stmts.length > 0) {
      await db.batch(stmts).catch((err) => {
        console.warn('[syncTransactionsToD1 batch error]', err?.message);
      });
    }
  }
}

