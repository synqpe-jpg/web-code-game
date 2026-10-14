const fs = require('fs');

async function syncAllToKV() {
  const games = JSON.parse(fs.readFileSync('src/data/games188.json', 'utf8'));
  const freeCodes = JSON.parse(fs.readFileSync('src/data/crawled_codes_188.json', 'utf8'));
  const sources = JSON.parse(fs.readFileSync('src/data/crawler_sources.json', 'utf8'));
  const giveaways = JSON.parse(fs.readFileSync('src/data/giveaways.json', 'utf8'));
  const utilities = JSON.parse(fs.readFileSync('src/data/utilities.json', 'utf8'));
  const storeProducts = JSON.parse(fs.readFileSync('src/data/storeProducts.json', 'utf8'));

  const sepay = {
    bankName: 'TPBank',
    accountNumber: '10004681879',
    bankAccount: 'CODE GAME SHOP',
    paymentPrefix: 'WCG',
    autoCreditCoreRatio: 1,
    isConnected: true
  };

  const endpoints = [
    'https://web-code-game.pages.dev/api/sync',
    'https://admin-code-game-shop.pages.dev/api/sync'
  ];

  console.log(`Đang đồng bộ dữ liệu chuẩn lên Cloudflare D1 / KV:`);
  console.log(`- Games: ${games.length}`);
  console.log(`- Free Codes: ${freeCodes.length}`);
  console.log(`- Sources: ${sources.length}`);
  console.log(`- Giveaways: ${giveaways.length} (KHÔNG CÓ Delta Force)`);
  console.log(`- Utilities: ${utilities.length}`);
  console.log(`- Store Products: ${storeProducts.length}`);
  console.log(`- Payment: TPBank - 10004681879 - CODE GAME SHOP`);

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
        body: JSON.stringify({ key: 'wcg_admin_games_v5', games, data: games })
      });
      console.log(`[${url}] Push games_v5: ${resG.status}`);

      // 2. Sync Free Codes v5
      const resC = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'wcg_admin_free_codes_v5', freeCodes, data: freeCodes })
      });
      console.log(`[${url}] Push free_codes_v5: ${resC.status}`);

      // 3. Sync Crawler Sources
      const resS = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'wcg_crawler_sources_v1', crawlerSources: sources, data: sources })
      });
      console.log(`[${url}] Push crawler_sources_v1: ${resS.status}`);

      // 4. Sync Giveaways v4
      const resGw = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'wcg_admin_giveaways_v4', giveaways, data: giveaways })
      });
      console.log(`[${url}] Push giveaways_v4: ${resGw.status}`);

      // 5. Sync Utilities v4
      const resUt = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'wcg_admin_utilities_v4', utilities, data: utilities })
      });
      console.log(`[${url}] Push utilities_v4: ${resUt.status}`);

      // 6. Sync Store Products v4
      const resSp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'wcg_admin_store_products_v4', storeProducts, data: storeProducts })
      });
      console.log(`[${url}] Push store_products_v4: ${resSp.status}`);

      // 7. Sync Payment (TPBank)
      const resPay = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'wcg_admin_sepay_v4', sepay, data: sepay })
      });
      console.log(`[${url}] Push sepay_v4 (TPBank): ${resPay.status}`);

      // 8. Sync Custom Free Codes (Pirate Legends VIP Vinh Danh)
      const pirateCustomCodes = freeCodes.filter(c => c.gameSlug === 'pirate-legends' && c.source === 'GIFTCODE VINH DANH');
      if (pirateCustomCodes.length > 0) {
        const resCust = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ key: 'wcg_admin_custom_free_codes_v1', data: pirateCustomCodes })
        });
        console.log(`[${url}] Push custom_free_codes_v1 (Pirate Legends): ${resCust.status}`);
      }
    } catch (e) {
      console.error(`[${url}] Error:`, e.message);
    }
  }

  console.log('Hoàn tất đồng bộ toàn bộ cơ sở dữ liệu Cloudflare D1 & KV!');
}

syncAllToKV();
