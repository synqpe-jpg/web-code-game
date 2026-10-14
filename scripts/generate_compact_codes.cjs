/**
 * generate_compact_codes.cjs
 * Compiles crawled_codes_188.json into ultra-lightweight compact_codes_by_game.json
 * Reduces 4.78MB raw crawler output down to ~55KB gzipped indexed by game slug.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_CODES = path.join(ROOT, 'src/data/crawled_codes_188.json');
const DEST_COMPACT = path.join(ROOT, 'src/data/compact_codes_by_game.json');

try {
  if (!fs.existsSync(SRC_CODES)) {
    console.error('❌ crawled_codes_188.json not found!');
    process.exit(1);
  }

  const rawCodes = JSON.parse(fs.readFileSync(SRC_CODES, 'utf-8'));
  const map = {};

  for (const c of rawCodes) {
    const slug = c.gameSlug || c.gameId || c.game_slug || c.slug;
    const codeVal = c.codeValue || c.code || c.code_value || c.gift_code;
    if (!slug || !codeVal) continue;

    const normSlug = slug.trim().toLowerCase();
    if (!map[normSlug]) map[normSlug] = [];

    const isExp = (c.status || '').toLowerCase().includes('exp');
    map[normSlug].push({
      code: codeVal.trim(),
      rewards: c.rewards || c.description || 'Quà tân thủ & vật phẩm ingame',
      status: isExp ? 'expired' : 'active',
      expiry: c.expiresAt || c.expires_at || c.expiry || '',
      added_at: c.createdAt || c.created_at || c.added_at || '2026-10-14T00:00:00.000Z',
    });
  }

  // Alias support for Pirate Legends
  const pirateCodes = map['pirate-legends'] || map['huyen-thoai-hai-tac'];
  if (pirateCodes) {
    map['pirate-legends'] = pirateCodes;
    map['huyen-thoai-hai-tac'] = pirateCodes;
  }

  fs.writeFileSync(DEST_COMPACT, JSON.stringify(map));
  console.log(`✅ Generated compact codes map: ${Object.keys(map).length} games, ${(fs.statSync(DEST_COMPACT).size / 1024).toFixed(1)} KB`);
} catch (err) {
  console.error('❌ Error generating compact codes:', err);
  process.exit(1);
}
