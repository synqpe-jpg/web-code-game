/**
 * Gatekeeper Audit Script: Zero Test Artifacts on Production
 * Run via: node scripts/audit_zero_test_artifacts.cjs
 * Fails fast (exit 1) if ANY test artifact (giveaway, utility, store product, or test giftcode) is detected.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🛡️ RUNNING AUDIT: ZERO TEST ARTIFACTS ON PRODUCTION & CODEBASE');
console.log('================================================================\n');

const KNOWN_TEST_IDS = new Set([
  'gw_gamerpower_rotwood',
  'gw_alienware_vaultbreakers',
  'gw_garena_delta_force',
  'ut_test_01',
  'sp_hsr_pass',
  'sp_genshin_welkin',
  'sp_roblox_robux_1000',
  'sp_lq_qh_500',
  'sp_ff_kc_520',
  'sp_pubg_uc_600',
  'code_delta-force_GP-3812-VAULTBRE',
  'code_delta-force_AA-VAULTBREAKER-2026',
  'code_where-winds-meet-mobile_GP-EVERWIND-AW51',
  'code_yen-van-thap-luc-thanh_AA-WWM-EXCL-2026'
]);

function isTestItem(item) {
  if (!item) return false;
  const id = String(item.id || '').toLowerCase();
  const title = String(item.title || item.name || '').toLowerCase();
  const gameName = String(item.game_name || item.gameName || '').toLowerCase();

  if (KNOWN_TEST_IDS.has(item.id)) return true;
  if (id.startsWith('test_') || id.includes('_test_') || id.startsWith('ut_test_') || id.startsWith('sp_test_') || id.startsWith('gw_test_')) return true;
  if (title.includes('rotwood') || title.includes('vaultbreaker')) return true;
  if (item.is_test === true) return true;
  return false;
}

// 1. Audit src/data/giveaways.json
console.log('▶ [1/4] Kiểm tra giveaways.json (Giật Code)...');
const giveaways = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/giveaways.json'), 'utf8'));
const badGw = giveaways.filter(isTestItem);
if (badGw.length > 0) {
  console.error('❌ LỖI NGHIÊM TRỌNG: Phát hiện chiến dịch test trong giveaways.json:', badGw.map(g => ({ id: g.id, title: g.title })));
  process.exit(1);
}
console.log(`   ✅ giveaways.json sạch 100% (${giveaways.length} chiến dịch thực tế, 0 mục test).`);

// 2. Audit src/data/storeProducts.json
console.log('▶ [2/4] Kiểm tra storeProducts.json (Cửa Hàng)...');
const storeProducts = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/storeProducts.json'), 'utf8'));
const badSp = storeProducts.filter(isTestItem);
if (badSp.length > 0) {
  console.error('❌ LỖI NGHIÊM TRỌNG: Phát hiện sản phẩm test trong storeProducts.json:', badSp.map(p => ({ id: p.id, title: p.title })));
  process.exit(1);
}
assert(storeProducts.length === 0, 'storeProducts.json must remain [] until real products are added by admin');
console.log('   ✅ storeProducts.json sạch 100% (0 sản phẩm test).');

// 3. Audit src/data/utilities.json
console.log('▶ [3/4] Kiểm tra utilities.json (Tiện Ích)...');
const utilities = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/utilities.json'), 'utf8'));
const badUt = utilities.filter(isTestItem);
if (badUt.length > 0) {
  console.error('❌ LỖI NGHIÊM TRỌNG: Phát hiện tiện ích test trong utilities.json:', badUt.map(u => ({ id: u.id, title: u.title })));
  process.exit(1);
}
assert(utilities.length === 19, 'utilities.json must contain exactly 19 canonical user packages');
const vip7d = utilities.find(u => u.id === 'ut_vs_05_vip_7d');
assert(vip7d && vip7d.stock_quantity === 8, 'ut_vs_05_vip_7d must have stock_quantity: 8');
console.log('   ✅ utilities.json sạch 100% (19 tiện ích người dùng, ut_vs_05_vip_7d còn 8, 0 mục test).');

// 4. Audit src/data/crawled_codes_188.json
console.log('▶ [4/4] Kiểm tra crawled_codes_188.json (Kho Giftcode)...');
const codes = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/crawled_codes_188.json'), 'utf8'));
const badCodes = codes.filter(c => KNOWN_TEST_IDS.has(c.id) || (c.code && (c.code.includes('VAULTBRE') || c.code.includes('EXCL-2026'))));
if (badCodes.length > 0) {
  console.error('❌ LỖI NGHIÊM TRỌNG: Phát hiện giftcode test trong crawled_codes_188.json:', badCodes.map(c => ({ id: c.id, code: c.code })));
  process.exit(1);
}
console.log(`   ✅ crawled_codes_188.json sạch 100% (${codes.length} giftcode thực tế, 0 mã test).\n`);

console.log('================================================================');
console.log('🎉 AUDIT THÀNH CÔNG: KHÔNG CÓ BẤT KỲ SẢN PHẨM HOẶC DỮ LIỆU TEST NÀO!');
console.log('================================================================');
