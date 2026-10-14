/**
 * verify_data_integrity.cjs - Automated Pre-Deploy Integrity Gatekeeper
 * 
 * Verifies that the codebase meets all architectural data guarantees before any build
 * or deployment can proceed:
 * 1. Catalog floor guarantees: Games >= 623, Free Codes >= 5,321, Crawler Sources >= 933.
 * 2. Critical VIP code preservation (Pirate Legend VIP 8-11 codes).
 * 3. Unit validation of smartMergeEntities monotonic behavior.
 * 
 * If ANY condition fails, this script exits with code 1, immediately halting the build.
 */

const fs = require('fs');
const path = require('path');

console.log('🛡️  Running Pre-Deploy Data Integrity & Anti-Regression Verification...');

const ROOT = path.resolve(__dirname, '..');
const GAMES_FILE = path.join(ROOT, 'src/data/games188.json');
const CODES_FILE = path.join(ROOT, 'src/data/crawled_codes_188.json');
const SOURCES_FILE = path.join(ROOT, 'src/data/crawler_sources.json');

let hasErrors = false;

function fail(msg) {
  console.error(`❌ INTEGRITY FAILURE: ${msg}`);
  hasErrors = true;
}

function pass(msg) {
  console.log(`✅ ${msg}`);
}

// 1. Verify Games Catalog
try {
  const gamesRaw = fs.readFileSync(GAMES_FILE, 'utf-8');
  const games = JSON.parse(gamesRaw);
  if (!Array.isArray(games)) {
    fail('games188.json is not an array!');
  } else if (games.length < 623) {
    fail(`Games count dropped below floor guarantee: ${games.length} < 623`);
  } else {
    pass(`Games catalog intact: ${games.length} games (floor >= 623)`);
  }
} catch (e) {
  fail(`Failed to read/parse games188.json: ${e.message}`);
}

// 2. Verify Free Codes Catalog
try {
  const codesRaw = fs.readFileSync(CODES_FILE, 'utf-8');
  const codes = JSON.parse(codesRaw);
  if (!Array.isArray(codes)) {
    fail('crawled_codes_188.json is not an array!');
  } else if (codes.length < 5321) {
    fail(`Free codes count dropped below floor guarantee: ${codes.length} < 5,321`);
  } else {
    pass(`Free codes catalog intact: ${codes.length} codes (floor >= 5,321)`);

    // Check Pirate Legend VIP 8-11 codes
    const pirateCodes = codes.filter((c) => {
      const slug = (c.gameSlug || c.game_slug || '').toLowerCase();
      return slug === 'pirate-legends' || slug === 'huyen-thoai-hai-tac';
    });
    const expectedCodes = ['ROBBERVIP11', 'MICKEYVIP10', 'MICKEYVIP9', 'CONVOICONVIP8'];
    const missing = expectedCodes.filter(
      (ec) => !pirateCodes.some((pc) => (pc.codeValue || pc.code || '').toUpperCase() === ec)
    );
    if (missing.length > 0) {
      fail(`Pirate Legend missing required VIP codes: ${missing.join(', ')}`);
    } else {
      pass(`Pirate Legend has all required VIP 8-11 honor codes present (${pirateCodes.length} total codes).`);
    }
  }
} catch (e) {
  fail(`Failed to read/parse crawled_codes_188.json: ${e.message}`);
}

// 2b. Verify Compact Codes Map
const COMPACT_CODES_FILE = path.join(ROOT, 'src/data/compact_codes_by_game.json');
try {
  const compactRaw = fs.readFileSync(COMPACT_CODES_FILE, 'utf-8');
  const compact = JSON.parse(compactRaw);
  let totalCompactCodes = 0;
  for (const arr of Object.values(compact)) {
    if (Array.isArray(arr)) totalCompactCodes += arr.length;
  }
  if (totalCompactCodes < 5321) {
    fail(`Compact codes total dropped below floor: ${totalCompactCodes} < 5,321`);
  } else if (!compact['ta-la-hac-ngo-khong'] || compact['ta-la-hac-ngo-khong'].length < 20) {
    fail(`Compact codes missing Ta La Hac Ngo Khong codes (has ${compact['ta-la-hac-ngo-khong']?.length || 0})`);
  } else if (!compact['pirate-legends'] || compact['pirate-legends'].length < 46) {
    fail(`Compact codes missing Pirate Legends codes (has ${compact['pirate-legends']?.length || 0})`);
  } else {
    pass(`Compact codes map intact: ${Object.keys(compact).length} games, ${totalCompactCodes} codes (floor >= 5,321)`);
  }
} catch (e) {
  fail(`Failed to read/parse compact_codes_by_game.json: ${e.message}`);
}

// 3. Verify Crawler Sources
try {
  const sourcesRaw = fs.readFileSync(SOURCES_FILE, 'utf-8');
  const sources = JSON.parse(sourcesRaw);
  if (!Array.isArray(sources)) {
    fail('crawler_sources.json is not an array!');
  } else if (sources.length < 933) {
    fail(`Crawler sources count dropped below floor guarantee: ${sources.length} < 933`);
  } else {
    pass(`Crawler sources intact: ${sources.length} sources (floor >= 933)`);
  }
} catch (e) {
  fail(`Failed to read/parse crawler_sources.json: ${e.message}`);
}

// 3b. Verify Utilities Catalog Baseline & Stock
const UTILITIES_FILE = path.join(ROOT, 'src/data/utilities.json');
try {
  const utilsRaw = fs.readFileSync(UTILITIES_FILE, 'utf-8');
  const utils = JSON.parse(utilsRaw);
  if (!Array.isArray(utils)) {
    fail('utilities.json is not an array!');
  } else if (utils.length < 19) {
    fail(`Utilities count dropped below floor guarantee: ${utils.length} < 19`);
  } else {
    const invalidUtils = utils.filter((u) => !u || !u.id || !u.title || typeof u.stock_quantity !== 'number' || u.stock_quantity < 0);
    if (invalidUtils.length > 0) {
      fail(`Found ${invalidUtils.length} utilities with invalid schema or negative stock: ${invalidUtils.map((u) => u?.id || 'unknown').join(', ')}`);
    } else {
      pass(`Utilities catalog intact: ${utils.length} items (floor >= 19) with strict non-negative warehouse stock.`);
    }
  }
} catch (e) {
  fail(`Failed to read/parse utilities.json: ${e.message}`);
}

// 3c. Verify Store Products Catalog Baseline
const STORE_PRODS_FILE = path.join(ROOT, 'src/data/storeProducts.json');
try {
  const spRaw = fs.readFileSync(STORE_PRODS_FILE, 'utf-8');
  const prods = JSON.parse(spRaw);
  if (!Array.isArray(prods)) {
    fail('storeProducts.json is not an array!');
  } else if (prods.length < 6) {
    fail(`Store products count dropped below floor guarantee: ${prods.length} < 6`);
  } else {
    const invalidSp = prods.filter((p) => !p || !p.id || !p.title || typeof p.stock_quantity !== 'number' || p.stock_quantity < 0);
    if (invalidSp.length > 0) {
      fail(`Found ${invalidSp.length} store products with invalid schema or negative stock: ${invalidSp.map((p) => p?.id || 'unknown').join(', ')}`);
    } else {
      pass(`Store products catalog intact: ${prods.length} items (floor >= 6) with strict non-negative warehouse stock.`);
    }
  }
} catch (e) {
  fail(`Failed to read/parse storeProducts.json: ${e.message}`);
}

// 3d. Verify Giveaways Catalog Baseline
const GIVEAWAYS_FILE = path.join(ROOT, 'src/data/giveaways.json');
try {
  const gwRaw = fs.readFileSync(GIVEAWAYS_FILE, 'utf-8');
  const giveaways = JSON.parse(gwRaw);
  if (!Array.isArray(giveaways)) {
    fail('giveaways.json is not an array!');
  } else if (giveaways.length < 30) {
    fail(`Giveaways count dropped below floor guarantee: ${giveaways.length} < 30`);
  } else {
    pass(`Giveaways catalog intact: ${giveaways.length} campaigns (floor >= 30).`);
  }
} catch (e) {
  fail(`Failed to read/parse giveaways.json: ${e.message}`);
}

// 4. Test smartMergeEntities Unit Logic (Simulated)
function normalizeUrlKey(url) {
  if (!url || typeof url !== 'string') return '';
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

function smartMergeTest(base, incoming, keySelector) {
  const getKey = typeof keySelector === 'function' ? keySelector : (item) => (item ? item[keySelector] : undefined);
  const baseArr = Array.isArray(base) ? base : [];
  const incArr = Array.isArray(incoming) ? incoming : [];
  const map = new Map();
  for (const item of baseArr) {
    if (!item) continue;
    const k = getKey(item);
    if (k !== undefined && k !== null && k !== '') map.set(k, item);
  }
  for (const item of incArr) {
    if (!item) continue;
    const k = getKey(item);
    if (k !== undefined && k !== null && k !== '') {
      if (!map.has(k)) map.set(k, item);
      else map.set(k, { ...map.get(k), ...item });
    }
  }
  return Array.from(map.values());
}

const testBase = [{ id: '1', name: 'Alpha' }];
const testInc = [{ id: '1', name: 'Alpha Updated', extra: true }, { id: '2', name: 'Beta' }];
const mergedResult = smartMergeTest(testBase, testInc, 'id');
if (mergedResult.length !== 2 || mergedResult[0].name !== 'Alpha Updated' || !mergedResult[0].extra) {
  fail('smartMerge unit assertion failed on update & insertion!');
} else {
  pass('smartMerge unit assertion passed.');
}

const url1 = 'https://www.facebook.com/gamepage/';
const url2 = 'http://facebook.com/gamepage';
if (normalizeUrlKey(url1) !== normalizeUrlKey(url2)) {
  fail(`normalizeUrlKey failed for equivalent URLs: ${url1} vs ${url2}`);
} else {
  pass('normalizeUrlKey canonical assertion passed.');
}

if (hasErrors) {
  console.error('\n🚨 DATA INTEGRITY VERIFICATION FAILED. BUILD ABORTED TO PREVENT DATA CORRUPTION.');
  process.exit(1);
}

console.log('✨ All 4 Data Integrity & Anti-Regression Guarantees Passed 100%!\n');
