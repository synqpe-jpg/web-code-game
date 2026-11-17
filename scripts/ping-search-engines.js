import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOST = 'codegame.shop';
const KEY = 'e47e8c3bf4d84f8db27da7c55cb8e30b';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;

// Timeout tiêu chuẩn cho mỗi request (chống treo hệ thống)
const REQUEST_TIMEOUT_MS = 15000;

function createFetchWithTimeout() {
  return async (url, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  };
}

const safeFetch = createFetchWithTimeout();

/**
 * 1. Thu thập danh sách URLs từ sitemap.xml
 */
async function loadSitemapUrls() {
  const localCandidates = [
    path.resolve(__dirname, '../public/sitemap.xml'),
    path.resolve(__dirname, '../dist/sitemap.xml')
  ];

  for (const p of localCandidates) {
    if (fs.existsSync(p)) {
      try {
        const sitemapXml = fs.readFileSync(p, 'utf8');
        const locRegex = /<loc>(https:\/\/codegame\.shop[^<]+)<\/loc>/g;
        const urls = [];
        let match;
        while ((match = locRegex.exec(sitemapXml)) !== null) {
          urls.push(match[1]);
        }
        if (urls.length > 0) {
          console.log(`[SEO INDEXER] Đã nạp ${urls.length} URLs từ file cục bộ: ${path.basename(p)}`);
          return urls;
        }
      } catch (err) {
        console.warn(`[SEO INDEXER] Không thể đọc sitemap cục bộ ${p}:`, err.message);
      }
    }
  }

  // Fallback tải trực tiếp từ live web
  try {
    console.log(`[SEO INDEXER] Đang tải sitemap từ live web: ${SITEMAP_URL}...`);
    const res = await safeFetch(SITEMAP_URL);
    if (res.ok) {
      const xml = await res.text();
      const locRegex = /<loc>(https:\/\/codegame\.shop[^<]+)<\/loc>/g;
      const urls = [];
      let match;
      while ((match = locRegex.exec(xml)) !== null) {
        urls.push(match[1]);
      }
      console.log(`[SEO INDEXER] Đã nạp ${urls.length} URLs từ live sitemap.xml`);
      return urls;
    }
  } catch (err) {
    console.warn('[SEO INDEXER] Không thể tải live sitemap:', err.message);
  }

  // Fallback tối thiểu nếu không đọc được sitemap
  return [
    `https://${HOST}/`,
    `https://${HOST}/danh-sach-game-a-z`,
    `https://${HOST}/news`,
    `https://${HOST}/su-kien`,
    `https://${HOST}/giveaways`,
    `https://${HOST}/the-loai/nhap-vai-mmorpg`
  ];
}

/**
 * 2. Gửi thông báo IndexNow đến Bing, IndexNow API, Yandex, Naver
 */
async function sendIndexNow(urls) {
  console.log('\n--------------------------------------------------------');
  console.log('📡 BƯỚC 1: Gửi thông báo qua giao thức IndexNow (Bing, Cốc Cốc, Yandex)');
  console.log('--------------------------------------------------------');

  // IndexNow giới hạn tối đa 10,000 URLs / request
  const batchUrls = urls.slice(0, 10000);
  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: batchUrls
  };

  const endpoints = [
    { name: 'Bing IndexNow', url: 'https://www.bing.com/indexnow' },
    { name: 'IndexNow Global Engine', url: 'https://api.indexnow.org/indexnow' },
    { name: 'Yandex IndexNow', url: 'https://yandex.com/indexnow' }
  ];

  const results = [];

  for (const ep of endpoints) {
    try {
      console.log(`[IndexNow] Gửi ${batchUrls.length} URLs tới ${ep.name}...`);
      const res = await safeFetch(ep.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
        timeout: 12000
      });

      const statusText = `HTTP ${res.status} ${res.statusText}`;
      if (res.status === 200 || res.status === 202) {
        console.log(`  ✅ ${ep.name}: Thành công (${statusText}). URLs đã vào hàng đợi lập chỉ mục!`);
        results.push({ name: ep.name, success: true, status: statusText });
      } else {
        const txt = await res.text().catch(() => '');
        console.log(`  ⚠️ ${ep.name}: Phản hồi ${statusText} - ${txt.slice(0, 150)}`);
        results.push({ name: ep.name, success: false, status: statusText, error: txt.slice(0, 150) });
      }
    } catch (err) {
      console.warn(`  ❌ ${ep.name}: Lỗi kết nối (${err.message})`);
      results.push({ name: ep.name, success: false, status: 'Connection Error', error: err.message });
    }
  }

  return results;
}

/**
 * 3. Gửi thông báo cập nhật Sitemap (Sitemap Ping)
 */
async function pingSitemapSearchEngines() {
  console.log('\n--------------------------------------------------------');
  console.log('📡 BƯỚC 2: Gửi tín hiệu làm mới Sitemap đến các bộ máy tìm kiếm');
  console.log('--------------------------------------------------------');

  const pingTargets = [
    { name: 'Google Sitemap Ping', url: `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}` },
    { name: 'Bing Sitemap Ping', url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}` }
  ];

  const results = [];

  for (const t of pingTargets) {
    try {
      console.log(`[Sitemap Ping] Đang gửi thông báo tới ${t.name}...`);
      const res = await safeFetch(t.url, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CodeGameBot/1.0; +https://codegame.shop)' },
        timeout: 10000
      });
      const statusText = `HTTP ${res.status} ${res.statusText}`;
      console.log(`  ℹ️ ${t.name}: Phản hồi ${statusText}`);
      results.push({ name: t.name, status: statusText, ok: res.ok });
    } catch (err) {
      console.warn(`  ⚠️ ${t.name}: Lỗi gửi tín hiệu (${err.message})`);
      results.push({ name: t.name, status: 'Error', error: err.message, ok: false });
    }
  }

  return results;
}

/**
 * 4. Hỗ trợ Google Indexing API nếu có Google Service Account Key
 */
async function publishGoogleIndexingApi(urls) {
  console.log('\n--------------------------------------------------------');
  console.log('📡 BƯỚC 3: Kiểm tra & Gửi Google Indexing API');
  console.log('--------------------------------------------------------');

  const rawCredentials = process.env.GOOGLE_INDEXING_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!rawCredentials) {
    console.log('[Google Indexing API] ℹ️ Chưa phát hiện biến môi trường GOOGLE_INDEXING_CREDENTIALS.');
    console.log('  => Googlebot sẽ tự động thu thập và lập chỉ mục các URL thông qua sitemap.xml.');
    console.log('  => (Để kích hoạt đẩy tức thì lên Google: thêm Secret GOOGLE_INDEXING_CREDENTIALS chứa JSON Service Account)');
    return { enabled: false, message: 'No credentials configured' };
  }

  try {
    let creds;
    if (rawCredentials.trim().startsWith('{')) {
      creds = JSON.parse(rawCredentials);
    } else if (fs.existsSync(rawCredentials)) {
      creds = JSON.parse(fs.readFileSync(rawCredentials, 'utf8'));
    } else {
      console.warn('[Google Indexing API] Không nhận dạng được định dạng GOOGLE_INDEXING_CREDENTIALS.');
      return { enabled: false, message: 'Invalid credentials format' };
    }

    const { client_email, private_key } = creds;
    if (!client_email || !private_key) {
      console.warn('[Google Indexing API] Thiếu client_email hoặc private_key trong JSON.');
      return { enabled: false, message: 'Missing client_email/private_key' };
    }

    // Tạo JWT ký RS256 chuẩn OAuth2 của Google
    console.log(`[Google Indexing API] Xác thực Service Account: ${client_email}...`);
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
      iss: client_email,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const b64Claim = Buffer.from(JSON.stringify(claim)).toString('base64url');
    const unsignedToken = `${b64Header}.${b64Claim}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsignedToken);
    const signature = signer.sign(private_key, 'base64url');
    const jwt = `${unsignedToken}.${signature}`;

    // Lấy OAuth Access Token
    const tokenRes = await safeFetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      }).toString()
    });

    if (!tokenRes.ok) {
      const errTxt = await tokenRes.text();
      console.warn('[Google Indexing API] Không thể lấy Access Token từ Google:', errTxt);
      return { enabled: false, error: errTxt };
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    console.log('[Google Indexing API] Lấy Access Token thành công. Đang gửi các URL trọng điểm...');

    // Giới hạn Google Indexing API: thường 200 URLs/ngày, ưu tiên URL trang chủ và các bài mới
    const targetUrls = urls.slice(0, 50);
    let successCount = 0;

    for (const url of targetUrls) {
      try {
        const notifyRes = await safeFetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            url: url,
            type: 'URL_UPDATED'
          })
        });

        if (notifyRes.ok) {
          successCount++;
        }
      } catch (e) {
        // bỏ qua lỗi từng URL
      }
    }

    console.log(`  ✅ Google Indexing API: Đã thông báo thành công ${successCount}/${targetUrls.length} URLs trọng điểm!`);
    return { enabled: true, published: successCount, total: targetUrls.length };
  } catch (err) {
    console.warn('[Google Indexing API] Lỗi thực thi:', err.message);
    return { enabled: false, error: err.message };
  }
}

/**
 * 5. Báo cáo trạng thái qua Telegram (nếu có cấu hình)
 */
async function notifyTelegram(stats) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) return;

  try {
    const msg = 
      `🚀 *[SEO AUTO-INDEXING]* Hoàn tất lập chỉ mục hàng ngày!\n\n` +
      `🌐 *Tên miền:* https://${HOST}\n` +
      `📄 *Tổng số URL:* ${stats.totalUrls}\n` +
      `📡 *IndexNow:* ${stats.indexNowStatus}\n` +
      `🗺️ *Sitemap Ping:* ${stats.sitemapStatus}\n` +
      `🤖 *Google Indexing:* ${stats.googleStatus}\n` +
      `⏱️ *Thời gian:* ${new Date().toISOString()}`;

    await safeFetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: msg,
        parse_mode: 'Markdown'
      }),
      timeout: 8000
    });
  } catch {}
}

/**
 * Main Runner
 */
async function runAutoIndexer() {
  console.log('========================================================');
  console.log('🚀 [SEO AUTO-INDEXER] KHỞI ĐỘNG HỆ THỐNG LẬP CHỈ MỤC TỰ ĐỘNG');
  console.log(`🌐 Website: https://${HOST} | Thời gian: ${new Date().toLocaleString('vi-VN')}`);
  console.log('========================================================\n');

  // 1. Nạp danh sách URL
  const urls = await loadSitemapUrls();

  // 2. IndexNow
  const indexNowResults = await sendIndexNow(urls);
  const indexNowOk = indexNowResults.filter(r => r.success).length;

  // 3. Sitemap Ping
  const pingResults = await pingSitemapSearchEngines();

  // 4. Google Indexing API
  const googleRes = await publishGoogleIndexingApi(urls);

  // 5. Báo cáo Telegram
  await notifyTelegram({
    totalUrls: urls.length,
    indexNowStatus: `${indexNowOk}/${indexNowResults.length} engines OK`,
    sitemapStatus: `${pingResults.filter(p => p.ok).length}/${pingResults.length} OK`,
    googleStatus: googleRes.enabled ? `Đã đẩy ${googleRes.published} URLs` : 'Qua Sitemap'
  });

  console.log('\n========================================================');
  console.log('🎉 [SEO AUTO-INDEXER] HOÀN TẤT CHU KỲ LẬP CHỈ MỤC THÀNH CÔNG!');
  console.log('========================================================');
}

runAutoIndexer().catch(err => {
  console.error('[SEO AUTO-INDEXER] Lỗi fatal:', err);
  process.exit(0); // Không làm fail build nếu search engine tạm thời bảo trì
});
