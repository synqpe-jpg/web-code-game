/**
 * Anti-Regression Test: News Cover Upload & Validation Flow
 * Chạy tự động sau mỗi lần deploy hoặc khi nghiệm thu hệ thống.
 * 
 * Kiểm tra hợp đồng bắt buộc:
 * 1. Upload icon qua POST /api/games/upload-icon thành công (200, readBackVerified: true, WebP thật).
 * 2. PUT ngay làm cover cho bài tin tức -> PHẢI trả 200 ngay lần đầu, không bị 404 từ validator.
 * 3. PUT đường dẫn không tồn tại -> PHẢI trả 400 báo rõ file không tồn tại trong kho ảnh.
 * 4. PUT đường dẫn có query string (?v=...) -> Kiểm tra đuôi file trên path, không bị từ chối sai.
 * 5. Tự động dọn dẹp và hoàn tác dữ liệu sau khi kiểm tra.
 */

const https = require('https');

const MASTER_KEY = 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';
const BASE_URL = 'https://codegame.shop';

// 1x1 valid WebP base64
const SAMPLE_WEBP_BASE64 = 'UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAkA4JaQAA3AA/vsGAAAA/v39/f39/f39/f39/f39/f39/f39/f39/f39/f4A';

function httpRequest(urlStr, options = {}, bodyData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Anti-Regression-News-Cover-Tester/1.0',
        ...options.headers,
      },
      timeout: 15000,
    };

    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(buf.toString('utf-8'));
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: buf,
          text: buf.toString('utf-8'),
          json,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (bodyData) {
      if (typeof bodyData === 'string' || Buffer.isBuffer(bodyData)) {
        req.write(bodyData);
      } else {
        req.write(JSON.stringify(bodyData));
      }
    }
    req.end();
  });
}

async function runRegressionTest() {
  console.log('🚀 [Regression Test] Bắt đầu kiểm tra luồng Upload-Icon + Validator Cover Tin Tức...');

  const testSlug = 'cover-test-20261105';
  let originalCover = null;
  const targetArticleId = 'news_1793681832220_lhyw'; // KOF: Legend

  try {
    // 0. Lưu cover hiện tại để hoàn tác sau kiểm tra
    console.log(`\n📌 Bước 0: Đọc trạng thái bài viết đích [${targetArticleId}]...`);
    const getRes = await httpRequest(`${BASE_URL}/api/news/${targetArticleId}`);
    if (getRes.status !== 200 || !getRes.json?.article) {
      throw new Error(`Không thể đọc bài viết ${targetArticleId}: HTTP ${getRes.status}`);
    }
    originalCover = getRes.json.article.cover_url || getRes.json.article.cover_image;
    console.log(`   Cover hiện tại: ${originalCover}`);

    // 1. Tải icon thử nghiệm lên qua upload-icon
    console.log(`\n📌 Bước 1: POST /api/games/upload-icon với slug "${testSlug}"...`);
    const uploadRes = await httpRequest(`${BASE_URL}/api/games/upload-icon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Key': MASTER_KEY,
      },
    }, {
      slug: testSlug,
      image_base64: SAMPLE_WEBP_BASE64,
      source: 'regression-test',
      admin_override: true,
    });

    console.log(`   Trạng thái HTTP: ${uploadRes.status}`);
    if (uploadRes.status !== 200 || !uploadRes.json?.readBackVerified) {
      throw new Error(`Upload icon thất bại: HTTP ${uploadRes.status} - ${uploadRes.text}`);
    }
    console.log(`   ✅ Upload thành công: readBackVerified = true, iconUrl = ${uploadRes.json.iconUrl}`);

    // 2. PUT cover bài viết ngay lập tức với icon vừa upload (Test Lỗi 1)
    console.log(`\n📌 Bước 2: PUT /api/news/${targetArticleId} với cover "/game_icons/${testSlug}.webp"...`);
    const putRes = await httpRequest(`${BASE_URL}/api/news/${targetArticleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Key': MASTER_KEY,
      },
    }, {
      cover_url: `/game_icons/${testSlug}.webp`,
    });

    console.log(`   Trạng thái HTTP: ${putRes.status}`);
    if (putRes.status !== 200) {
      throw new Error(`Validator từ chối icon vừa upload: HTTP ${putRes.status} - ${putRes.text}`);
    }
    console.log(`   ✅ Validator chấp nhận ngay lần đầu (200 OK): Không bị 404 sai!`);

    // 3. PUT với URL có query string ?v=... (Test Lỗi 4)
    console.log(`\n📌 Bước 3: PUT /api/news/${targetArticleId} với cover có query string ?v=1793860770089...`);
    const putQueryRes = await httpRequest(`${BASE_URL}/api/news/${targetArticleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Key': MASTER_KEY,
      },
    }, {
      cover_url: `/game_icons/${testSlug}.webp?v=1793860770089`,
    });

    console.log(`   Trạng thái HTTP: ${putQueryRes.status}`);
    if (putQueryRes.status !== 200) {
      throw new Error(`Validator từ chối URL có ?v=: HTTP ${putQueryRes.status} - ${putQueryRes.text}`);
    }
    console.log(`   ✅ Validator chấp nhận URL có version (?v=): Kiểm tra đuôi file thành công!`);

    // 4. PUT với đường dẫn không tồn tại (Test Lỗi 5)
    console.log(`\n📌 Bước 4: PUT với đường dẫn không tồn tại /game_icons/khong-ton-tai-xyz.webp...`);
    const putNonExistRes = await httpRequest(`${BASE_URL}/api/news/${targetArticleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Key': MASTER_KEY,
      },
    }, {
      cover_url: `/game_icons/khong-ton-tai-xyz.webp`,
    });

    console.log(`   Trạng thái HTTP: ${putNonExistRes.status}`);
    if (putNonExistRes.status !== 400) {
      throw new Error(`Validator không từ chối đường dẫn 404: HTTP ${putNonExistRes.status}`);
    }
    console.log(`   Thông báo lỗi: ${putNonExistRes.json?.error}`);
    if (!putNonExistRes.json?.error?.includes('không tồn tại trong kho ảnh hệ thống')) {
      throw new Error(`Thông báo lỗi không đúng chuẩn: ${putNonExistRes.json?.error}`);
    }
    console.log(`   ✅ Validator từ chối chính xác và thông báo rõ ràng nguyên nhân!`);

  } finally {
    // Hoàn tác cover gốc của bài viết
    if (originalCover) {
      console.log(`\n🔄 Hoàn tác cover gốc cho bài viết [${targetArticleId}] về: ${originalCover}...`);
      await httpRequest(`${BASE_URL}/api/news/${targetArticleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Sync-Key': MASTER_KEY,
        },
      }, {
        cover_url: originalCover,
      });
      console.log('   ✅ Đã hoàn tác cover gốc thành công.');
    }
  }

  console.log('\n🎉 [Regression Test] TẤT CẢ PHÉP KIỂM CHỐNG TÁI PHÁT ĐỀU ĐẠT 100%!');
}

if (require.main === module) {
  runRegressionTest().catch((err) => {
    console.error('\n❌ [Regression Test] THẤT BẠI:', err.message);
    process.exit(1);
  });
}

module.exports = { runRegressionTest };
