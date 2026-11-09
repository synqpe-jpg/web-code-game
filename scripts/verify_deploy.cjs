const { execSync } = require('child_process');
const https = require('https');

function getExpectedCommit() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (err) {
    console.error('❌ Failed to get git commit hash:', err.message);
    process.exit(1);
  }
}

function fetchBuildId(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout: 8000 }, (res) => {
      resolve({
        url,
        status: res.statusCode,
        buildId: res.headers['x-build-id'] || null,
        edgeCache: res.headers['x-edge-cache'] || res.headers['cf-cache-status'] || null,
        serverTiming: res.headers['server-timing'] || null,
      });
    });
    req.on('error', (err) => resolve({ url, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ url, error: 'Timeout' });
    });
    req.end();
  });
}

async function verify() {
  const expectedHash = getExpectedCommit();
  console.log(`\n🔍 [Post-Deploy Verify] Checking production hosts against expected commit: ${expectedHash}`);

  const hosts = [
    'https://codegame.shop/',
    'https://web-code-game.pages.dev/',
    'https://admin-code-game-shop.pages.dev/admin'
  ];

  let allPass = true;
  for (const host of hosts) {
    const result = await fetchBuildId(host);
    if (result.error) {
      console.error(`   ❌ ${host.padEnd(46)} -> Network Error: ${result.error}`);
      allPass = false;
    } else if (result.buildId === expectedHash) {
      console.log(`   ✅ ${host.padEnd(46)} -> X-Build-Id: ${result.buildId} (MATCH)`);
    } else {
      console.error(`   ❌ ${host.padEnd(46)} -> X-Build-Id: ${result.buildId} (MISMATCH! Expected: ${expectedHash})`);
      allPass = false;
    }
  }

  if (!allPass) {
    console.error(`\n❌ [Post-Deploy Verify] FAILED: Production hosts do not match commit ${expectedHash}!`);
    process.exit(1);
  }

  console.log(`\n🎉 [Post-Deploy Verify] PASSED: All 3 production hosts verified running commit ${expectedHash}!\n`);
}

verify();
