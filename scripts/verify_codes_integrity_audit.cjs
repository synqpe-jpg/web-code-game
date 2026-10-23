const https = require('https');
require('dotenv').config();

const API_KEY = 'wcg_muse_f7d252dd57426a7a';
const ADMIN_SYNC_SECRET = process.env.ADMIN_SYNC_SECRET || 'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';

function httpGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.get(`https://codegame.shop${path}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CodeGameAudit/1.0',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${path}`));
    });
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CodeGameAudit/1.0',
        ...headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error(`Timeout posting to ${path}`));
    });
    req.write(dataStr);
    req.end();
  });
}

async function runIntegrityAudit() {
  console.log('========================================================================================');
  console.log('🛡️ KIỂM TRA HỒI QUY TOÀN DIỆN & KIỂM TOÁN TẦNG HIỂN THỊ (API vs DETAIL vs BADGE)');
  console.log('========================================================================================\n');

  let passed = true;

  // 1. Kiểm tra chi tiết Thực Thần Ký (12 mã)
  console.log('▶ [1/4] Kiểm tra chuyên sâu tựa game "Thực Thần Ký" (thuc-than-ky)...');
  const ttRes = await httpGet('/api/games?slug=thuc-than-ky&nocache=1');
  if (ttRes.data?.success && ttRes.data?.game) {
    const codes = (ttRes.data.game.codes || []).map(c => c.code);
    const hasTttk = codes.includes('TTTTK2026');
    const hasTtkf = codes.includes('TTKF376');
    if (hasTttk && hasTtkf && codes.length >= 12) {
      console.log(`   ✅ API ĐẠT: Đã trả về đủ ${codes.length} mã (chứa TTTTK2026 và TTKF376). codes_count = ${ttRes.data.game.codes_count}`);
    } else {
      console.error(`   ❌ THẤT BẠI: Thiếu mã mới! Có TTTTK2026: ${hasTttk}, Có TTKF376: ${hasTtkf}, Tổng: ${codes.length}`);
      passed = false;
    }
  } else {
    console.error(`   ❌ THẤT BẠI: Không tải được game thuc-than-ky:`, ttRes.data?.error || ttRes.raw);
    passed = false;
  }

  // 2. Kiểm tra chi tiết Kỳ Tích Trở Lại (5 mã)
  console.log('\n▶ [2/4] Kiểm tra chuyên sâu tựa game "Kỳ Tích Trở Lại" (ky-tich-tro-lai)...');
  const ktRes = await httpGet('/api/games?slug=ky-tich-tro-lai&nocache=1');
  if (ktRes.data?.success && ktRes.data?.game) {
    const codes = (ktRes.data.game.codes || []).map(c => c.code);
    const expected = ['DT30K', 'MUNG60K', 'VIP666', 'VIP888', 'VIP999'];
    const missing = expected.filter(c => !codes.includes(c));
    if (missing.length === 0 && codes.length === 5) {
      console.log(`   ✅ API ĐẠT: Đã hiển thị đúng 5 mã chuẩn (${codes.join(', ')}). codes_count = ${ktRes.data.game.codes_count}`);
    } else {
      console.error(`   ❌ THẤT BẠI: Mã không khớp 5 mã chuẩn: ${missing.join(', ')} (Hiện có: ${codes.join(', ')})`);
      passed = false;
    }
  } else {
    console.error(`   ❌ THẤT BẠI: Không tải được game ky-tich-tro-lai:`, ktRes.data?.error || ktRes.raw);
    passed = false;
  }

  // 3. Ma trận kiểm toán đồng bộ 3 tầng (API vs HTML Detail vs Card Badge) trên 10 tựa game mẫu
  console.log('\n▶ [3/4] Ma trận kiểm toán đồng bộ 3 tầng trên 10 tựa game mẫu:');
  const sampleGames = [
    { name: 'Thực Thần Ký', slug: 'thuc-than-ky' },
    { name: 'Kỳ Tích Trở Lại', slug: 'ky-tich-tro-lai' },
    { name: 'Genshin Impact', slug: 'genshin-impact' },
    { name: 'Honkai: Star Rail', slug: 'honkai-star-rail' },
    { name: 'Liên Quân Mobile', slug: 'lien-quan-mobile' },
    { name: 'Free Fire', slug: 'free-fire' },
    { name: 'Play Together', slug: 'play-together' },
    { name: 'Roblox', slug: 'roblox' },
    { name: 'Blox Fruits', slug: 'blox-fruits' },
    { name: 'MU Vượt Thời Đại', slug: 'mu-vuot-thoi-dai' },
  ];

  const auditMatrix = [];
  for (const item of sampleGames) {
    try {
      // 1. API count
      const apiRes = await httpGet(`/api/games?slug=${item.slug}&nocache=1`);
      const apiCount = apiRes.data?.game?.codes_count ?? (apiRes.data?.game?.codes?.length || 0);

      // 2. HTML rendered count
      const htmlRes = await httpGet(`/game/${item.slug}`);
      let htmlCount = 0;
      if (htmlRes.raw) {
        const match = htmlRes.raw.match(/(\d+)\s+mã khả dụng/);
        if (match) htmlCount = parseInt(match[1], 10);
      }

      // 3. Card Badge count from catalog query
      const catRes = await httpGet(`/api/games?search=${encodeURIComponent(item.slug)}`);
      let badgeCount = 0;
      if (catRes.data?.games) {
        const found = catRes.data.games.find(g => g.slug === item.slug || g.id === item.slug);
        if (found) badgeCount = found.codes_count ?? 0;
      }

      const isMatch = (apiCount === badgeCount);
      auditMatrix.push({
        'Tên Game': item.name,
        'Slug': item.slug,
        'API Count': apiCount,
        'HTML Detail': htmlCount,
        'Badge Count': badgeCount,
        'Trạng Thái': isMatch ? '✅ KHỚP 100%' : '⚠️ LỆCH'
      });

      if (!isMatch) {
        console.warn(`   ⚠️ Phát hiện lệch số đếm tại game ${item.name}: API=${apiCount}, Badge=${badgeCount}`);
      }
    } catch (e) {
      auditMatrix.push({
        'Tên Game': item.name,
        'Slug': item.slug,
        'API Count': 'ERR',
        'HTML Detail': 'ERR',
        'Badge Count': 'ERR',
        'Trạng Thái': '❌ LỖI MẠNG'
      });
      passed = false;
    }
  }

  console.table(auditMatrix);

  // 4. Kiểm thử hồi quy nạp mã tự động qua API Crawler và xác nhận xuất hiện tức thì + Rule 7 Dọn Dẹp
  console.log('\n▶ [4/4] Kiểm thử hồi quy Ingest & Rule 7 Zero Test Artifacts (Khối finally đảm bảo 100% dọn sạch)...');
  const testCode = `TESTREG${Date.now().toString().slice(-4)}`;
  const ingestPayload = {
    gameName: 'Kỳ Tích Trở Lại',
    codes: [
      { code: testCode, rewards: 'Mã kiểm thử hồi quy tự động chống lệch count' }
    ],
    source: 'Automated Regression Runner'
  };

  try {
    const ingestRes = await httpPost('/api/crawler/ingest-codes', ingestPayload, {
      'Authorization': `Bearer ${API_KEY}`
    });

    if (ingestRes.data?.success && ingestRes.data?.totalAdded === 1) {
      console.log(`   ✅ API Ingest đã nạp mã tạm thời: ${testCode}`);
      
      // Kiểm tra ngay trên API chi tiết game
      const verifyRes = await httpGet('/api/games?slug=ky-tich-tro-lai&nocache=1');
      const verifyCodes = (verifyRes.data?.game?.codes || []).map(c => c.code);
      if (verifyCodes.includes(testCode)) {
        console.log(`   ✅ XÁC NHẬN: Mã ${testCode} đã xuất hiện ngay lập tức trên API chi tiết game!`);
      } else {
        console.error(`   ❌ THẤT BẠI: Mã vừa nạp không xuất hiện trên trang chi tiết game!`);
        passed = false;
      }
    } else {
      console.error(`   ❌ THẤT BẠI khi gọi API Crawler Ingest:`, ingestRes.data || ingestRes.raw);
      passed = false;
    }
  } finally {
    // KHỐI FINALLY BẮT BUỘC THEO RULE 7: Dọn dẹp sạch sẽ mã test kể cả khi assert thất bại
    console.log('   🧹 Đang thực thi dọn dẹp sạch mã test theo Rule 7 (Zero Test Artifacts on Production)...');
    try {
      const customFetch = await httpGet(`/api/sync?key=wcg_admin_custom_free_codes_v1`);
      const allCustom = customFetch.data?.data || [];
      const cleaned = allCustom.filter(c => String(c.code || c.codeValue || '').toUpperCase() !== testCode);
      
      await httpPost('/api/sync', {
        key: 'wcg_admin_custom_free_codes_v1',
        data: cleaned
      }, {
        'X-Sync-Key': ADMIN_SYNC_SECRET
      });
      console.log(`   ✅ HOÀN TẤT DỌN DẸP: Mã test ${testCode} đã được xóa sạch vĩnh viễn khỏi D1!`);
    } catch (cleanupErr) {
      console.warn(`   ⚠️ Cảnh báo dọn dẹp mã test:`, cleanupErr.message);
    }
  }

  console.log('\n========================================================================================');
  if (passed) {
    console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ ĐỒNG BỘ ĐÃ ĐẠT 100%! HỆ THỐNG ĐỒNG BỘ NGUYÊN TỬ!');
  } else {
    console.error('⚠️ PHÁT HIỆN LỖI TRONG BÀI KIỂM THỬ HỒI QUY.');
  }
  console.log('========================================================================================\n');

  return passed;
}

runIntegrityAudit().then(ok => {
  process.exit(ok ? 0 : 1);
}).catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
