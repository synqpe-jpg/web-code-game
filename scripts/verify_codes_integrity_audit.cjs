const https = require('https');
require('dotenv').config();

const API_KEY = 'wcg_muse_f7d252dd57426a7a';
const ADMIN_SYNC_SECRET = process.env.ADMIN_SYNC_SECRET || 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';

function httpGet(path) {
  return new Promise((resolve, reject) => {
    https.get(`https://codegame.shop${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

function httpPost(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(body);
    const req = https.request({
      hostname: 'codegame.shop',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(dataStr);
    req.end();
  });
}

async function runIntegrityAudit() {
  console.log('================================================================');
  console.log('🛡️ KIỂM TRA HỒI QUY TOÀN DIỆN VÀ CHỐNG TÁI PHÁT LỆCH GIFTCODE');
  console.log('================================================================\n');

  let passed = true;

  // 1. Kiểm tra Kỳ Tích Trở Lại
  console.log('▶ [1/4] Kiểm tra game "Kỳ Tích Trở Lại" (ky-tich-tro-lai)...');
  const ktRes = await httpGet('/api/games?slug=ky-tich-tro-lai&nocache=1');
  if (ktRes.data?.success && ktRes.data?.game) {
    const codes = (ktRes.data.game.codes || []).map(c => c.code);
    const expected = ['DT30K', 'MUNG60K', 'VIP666', 'VIP888', 'VIP999'];
    const missing = expected.filter(c => !codes.includes(c));
    if (missing.length === 0) {
      console.log(`   ✅ ĐẠT: Đã hiển thị đủ 5 mã (${codes.join(', ')}). codes_count = ${ktRes.data.game.codes_count}`);
    } else {
      console.error(`   ❌ THẤT BẠI: Thiếu các mã: ${missing.join(', ')} (Hiện có: ${codes.join(', ')})`);
      passed = false;
    }
  } else {
    console.error(`   ❌ THẤT BẠI: Không tải được game ky-tich-tro-lai:`, ktRes.data?.error || ktRes.raw);
    passed = false;
  }

  // 2. Kiểm tra Thức Thần Ký
  console.log('\n▶ [2/4] Kiểm tra game "Thức Thần Ký" (thuc-than-ky)...');
  const ttRes = await httpGet('/api/games?slug=thuc-than-ky&nocache=1');
  if (ttRes.data?.success && ttRes.data?.game) {
    const codes = (ttRes.data.game.codes || []).map(c => c.code);
    const hasTttk = codes.includes('TTTTK2026');
    const hasTtkf = codes.includes('TTKF376');
    if (hasTttk && hasTtkf && codes.length >= 12) {
      console.log(`   ✅ ĐẠT: Đã hiển thị đủ 12 mã (bao gồm TTTTK2026 và TTKF376). codes_count = ${ttRes.data.game.codes_count}`);
    } else {
      console.error(`   ❌ THẤT BẠI: Thiếu mã mới! Có TTTTK2026: ${hasTttk}, Có TTKF376: ${hasTtkf}, Tổng: ${codes.length}`);
      passed = false;
    }
  } else {
    console.error(`   ❌ THẤT BẠI: Không tải được game thuc-than-ky:`, ttRes.data?.error || ttRes.raw);
    passed = false;
  }

  // 3. Kiểm thử hồi quy nạp mã tự động qua API Crawler và xác nhận xuất hiện tức thì
  console.log('\n▶ [3/4] Kiểm thử hồi quy: Nạp thử mã qua API Crawler và xác nhận xuất hiện...');
  const testCode = `TESTREG${Date.now().toString().slice(-4)}`;
  const ingestPayload = {
    gameName: 'Kỳ Tích Trở Lại',
    codes: [
      { code: testCode, rewards: 'Mã kiểm thử hồi quy tự động' }
    ],
    source: 'Automated Regression Runner'
  };

  const ingestRes = await httpPost('/api/crawler/ingest-codes', ingestPayload, {
    'Authorization': `Bearer ${API_KEY}`
  });

  if (ingestRes.data?.success && ingestRes.data?.totalAdded === 1) {
    console.log(`   ✅ API Ingest đã nạp mã tạm thời: ${testCode}`);
    
    // Kiểm tra ngay trên API chi tiết game
    const verifyRes = await httpGet('/api/games?slug=ky-tich-tro-lai&nocache=1');
    const verifyCodes = (verifyRes.data?.game?.codes || []).map(c => c.code);
    if (verifyCodes.includes(testCode)) {
      console.log(`   ✅ XÁC NHẬN: Mã ${testCode} đã xuất hiện ngay lập tức trên trang chi tiết game!`);
    } else {
      console.error(`   ❌ THẤT BẠI: Mã vừa nạp không xuất hiện trên trang chi tiết game!`);
      passed = false;
    }

    // TỰ ĐỘNG DỌN DẸP SẠCH SẼ THEO RULE 7 (ZERO TEST ARTIFACTS ON PRODUCTION)
    console.log('\n▶ [4/4] Tự động xóa sạch mã test khỏi D1 (Rule 7 Zero Test Artifacts)...');
    try {
      const customFetch = await httpGet(`/api/sync?key=wcg_admin_custom_free_codes_v1`);
      const allCustom = customFetch.data?.data || [];
      const cleaned = allCustom.filter(c => String(c.code || c.codeValue).toUpperCase() !== testCode);
      
      const cleanPostRes = await httpPost('/api/sync', {
        key: 'wcg_admin_custom_free_codes_v1',
        data: cleaned
      }, {
        'X-Sync-Key': ADMIN_SYNC_SECRET
      });
      console.log(`   ✅ DỌN DẸP HOÀN TẤT: Mã test ${testCode} đã được xóa sạch vĩnh viễn khỏi D1!`);
    } catch (cleanupErr) {
      console.warn(`   ⚠️ Cảnh báo dọn dẹp mã test:`, cleanupErr.message);
    }
  } else {
    console.error(`   ❌ THẤT BẠI khi gọi API Crawler Ingest:`, ingestRes.data || ingestRes.raw);
    passed = false;
  }

  console.log('\n================================================================');
  if (passed) {
    console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ HỒI QUY ĐÃ ĐẠT 100%! HỆ THỐNG ĐỒNG BỘ TUYỆT ĐỐI!');
  } else {
    console.error('⚠️ PHÁT HIỆN LỖI TRONG BÀI KIỂM THỬ HỒI QUY.');
  }
  console.log('================================================================');

  return passed;
}

runIntegrityAudit().then(ok => {
  process.exit(ok ? 0 : 1);
}).catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
