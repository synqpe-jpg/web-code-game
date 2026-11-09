const https = require('https');

const TARGET_HOST = 'https://codegame.shop';
const URLS_TO_WARM = [
  '/',
  '/danh-sach-game-a-z',
  '/news/',
  '/the-loai/nhap-vai-mmorpg',
  '/game/hiep-khach-hanh',
  '/game/3q-dao-dao-dao',
  '/game/khe-uoc-rong',
  '/game/tien-nghich',
  '/game/kiem-de',
  '/game/tam-quoc-x',
  '/game/me-ta-tam-quoc',
  '/game/delta-force',
  '/game/honkai-star-rail',
  '/game/genshin-impact',
  '/game/samkok-tam-quoc',
  '/game/chien-gioi-4d',
  '/game/call-of-duty-mobile-vn',
  '/game/tam-quoc-tu-thoi-ca',
  '/game/zingspeed-mobile',
  '/game/play-together',
  '/game/dau-truong-chan-ly',
  '/game/giang-ho-ky-ngo',
  '/game/rise-of-kingdoms',
  '/game/nam-lun-tien-len'
];

function fetchUrl(path, isHead = false) {
  return new Promise((resolve) => {
    const url = `${TARGET_HOST}${path}`;
    const start = Date.now();
    const req = https.request(url, { method: isHead ? 'HEAD' : 'GET', timeout: 10000 }, (res) => {
      let bodyLen = 0;
      res.on('data', (chunk) => { bodyLen += chunk.length; });
      res.on('end', () => {
        const dur = Date.now() - start;
        resolve({
          path,
          status: res.statusCode,
          dur,
          edgeCache: res.headers['x-edge-cache'] || 'NONE',
          serverTiming: res.headers['server-timing'] || '',
          bodyLen,
        });
      });
    });
    req.on('error', (err) => resolve({ path, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ path, error: 'Timeout' });
    });
    req.end();
  });
}

async function warmup() {
  console.log(`\n🔥 [Warm-up Cache] Starting edge cache warmup for ${URLS_TO_WARM.length} critical URLs on ${TARGET_HOST}...\n`);
  
  // Pass 1: Prime Cache
  console.log('▶ Pass 1: Seeding Edge Cache (Prime Cache)...');
  for (const path of URLS_TO_WARM) {
    const r = await fetchUrl(path);
    const timing = r.serverTiming ? ` [${r.serverTiming}]` : '';
    console.log(`   ${r.status === 200 ? '🌱' : '⚠️'} ${path.padEnd(32)} ${String(r.dur).padStart(4)}ms (Cache: ${r.edgeCache})${timing}`);
  }

  // Pass 2: Verify Cache HIT & Measure Warm TTFB
  console.log('\n▶ Pass 2: Verifying Edge Cache HITs & Warm TTFB...');
  let hitCount = 0;
  for (const path of URLS_TO_WARM) {
    const r = await fetchUrl(path);
    const isHit = r.edgeCache === 'HIT';
    if (isHit) hitCount++;
    const icon = isHit ? '⚡' : '⚠️';
    console.log(`   ${icon} ${path.padEnd(32)} ${String(r.dur).padStart(4)}ms (Cache: ${r.edgeCache}, Server-Timing: ${r.serverTiming})`);
  }

  console.log(`\n🎉 [Warm-up Cache] Completed! ${hitCount}/${URLS_TO_WARM.length} URLs verified HIT on Edge Cache.\n`);
}

warmup();
