const fs = require('fs');

async function syncAllToKV() {
  const games = JSON.parse(fs.readFileSync('src/data/games188.json', 'utf8'));
  const freeCodes = JSON.parse(fs.readFileSync('src/data/crawled_codes_188.json', 'utf8'));

  const endpoints = [
    'https://web-code-game.pages.dev/api/sync',
    'https://admin-code-game-shop.pages.dev/api/sync'
  ];

  console.log(`Đang đồng bộ ${games.length} game và ${freeCodes.length} mã lên Cloudflare KV...`);

  for (const url of endpoints) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'X-Sync-Key': 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef'
      };

      // 1. Sync Games v5
      const resG = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'wcg_admin_games_v5', data: games })
      });
      console.log(`[${url}] Push games_v5: ${resG.status}`);

      // 2. Sync Free Codes v5
      const resC = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'wcg_admin_free_codes_v5', data: freeCodes })
      });
      console.log(`[${url}] Push free_codes_v5: ${resC.status}`);
    } catch (e) {
      console.error(`[${url}] Error:`, e.message);
    }
  }

  console.log('Hoàn tất đồng bộ Cloudflare KV!');
}

syncAllToKV();
