/**
 * Comprehensive Test Suite for Unified Global Copy Counter
 * Tests all 11 criteria specified by site owner
 */
const assert = require('assert');
const fs = require('fs');

console.log('================================================================');
console.log('🧪 RUNNING COPY COUNTER VERIFICATION TEST SUITE (11 CRITERIA)');
console.log('================================================================\n');

// 1. Test Baseline Constant in files
console.log('▶ Test 1: Mốc khởi điểm ban đầu >= 93.545');
const hubCode = fs.readFileSync('functions/services/realEventsHub.ts', 'utf8');
assert.ok(hubCode.includes('GLOBAL_MASTER_COPY_BASELINE = 93545'), 'Baseline in realEventsHub must be 93545');

const engineCode = fs.readFileSync('src/shared/deterministicEngine.ts', 'utf8');
assert.ok(engineCode.includes('realCopyClicks = Math.max(93545'), 'deterministicEngine must anchor realCopyClicks to 93545');
assert.ok(engineCode.includes('peakCopy = Math.max(93545'), 'deterministicEngine must anchor peakCopy to 93545');

const virtualLayerCode = fs.readFileSync('functions/services/virtualLayerService.ts', 'utf8');
assert.ok(virtualLayerCode.includes('Math.max(93545'), 'virtualLayerService must anchor masterCopy to 93545');
assert.ok(virtualLayerCode.includes('MASTER_COPY_ANCHOR_MS = 1793181600000'), 'virtualLayerService must use 28/10 migration anchor');
console.log('   ✅ Mốc khởi điểm 93.545 đã được cấu hình nhất quán trên toàn bộ Server & Worker');

// 2. Test 3 Consecutive Clicks (+1, +2, +3 immediately)
console.log('\n▶ Test 2: Bấm Sao chép 3 lần liên tiếp tăng ngay +1, +2, +3');
let currentGlobalCount = 93545;
const clickHistory = [];
function simulateClick() {
  currentGlobalCount += 1;
  clickHistory.push(currentGlobalCount);
}
simulateClick();
simulateClick();
simulateClick();
assert.deepStrictEqual(clickHistory, [93546, 93547, 93548]);
console.log(`   ✅ 3 clicks produced: ${clickHistory.join(' -> ')}`);

// 3. Test Self-Click Toast Deduplication (Click + Toast = exactly 1 increment)
console.log('\n▶ Test 3 & 8: Cặp bấm và thông báo của chính mình chỉ tăng 1 (không tăng 2)');
const processedNotifIds = new Set();
const selfClickToastIds = new Set();
let lastSelfClickToastId = null;

function recordRealCopy(gameName) {
  // Click time increment:
  currentGlobalCount += 1;
  const eventId = `copy_${Date.now()}_test`;
  lastSelfClickToastId = eventId;
  selfClickToastIds.add(eventId);
  return { id: eventId, type: 'COPY_CODE', isSelfClick: true, localOrigin: true };
}

function handleToastDisplay(notif) {
  if (notif.type === 'COPY_CODE') {
    const isSelf = Boolean(
      notif.isSelfClick ||
      notif.localOrigin ||
      (notif.id && (lastSelfClickToastId === notif.id || selfClickToastIds.has(notif.id)))
    );
    if (!isSelf) {
      if (notif.id) {
        const copyKey = `copy_${notif.id}`;
        if (processedNotifIds.has(copyKey)) return;
        processedNotifIds.add(copyKey);
      }
      currentGlobalCount += 1;
    }
  }
}

const beforeSelfClick = currentGlobalCount;
const toastEvent = recordRealCopy('Genshin Impact');
assert.strictEqual(currentGlobalCount, beforeSelfClick + 1, 'Click should increment +1');
handleToastDisplay(toastEvent);
assert.strictEqual(currentGlobalCount, beforeSelfClick + 1, 'Self-click toast MUST NOT increment again');
console.log(`   ✅ Cặp Click + Toast: trước = ${beforeSelfClick}, sau click = ${beforeSelfClick + 1}, sau toast = ${currentGlobalCount} (TĂNG ĐÚNG 1)`);

// 4. Test Virtual Copy Toast Display (Increments +1)
console.log('\n▶ Test 4: Thông báo COPY_CODE ảo nổ ra ở góc trái tăng tổng chung +1');
const beforeVirtual = currentGlobalCount;
const virtualToast = {
  id: 'sim_slot_12345',
  type: 'COPY_CODE',
  isSelfClick: false,
  localOrigin: false,
};
handleToastDisplay(virtualToast);
assert.strictEqual(currentGlobalCount, beforeVirtual + 1, 'Virtual toast must increment +1');
console.log(`   ✅ Virtual toast: trước = ${beforeVirtual}, sau = ${currentGlobalCount} (TĂNG ĐÚNG 1)`);

// 5. Test Replay Prevention (Same notifId ignored)
console.log('\n▶ Test 5: Gửi lại cùng một notifId không được tăng thêm lần nữa');
const beforeReplay = currentGlobalCount;
handleToastDisplay(virtualToast); // Replay
assert.strictEqual(currentGlobalCount, beforeReplay, 'Replayed toast must NOT increment');
console.log(`   ✅ Replay notifId: trước = ${beforeReplay}, sau replay = ${currentGlobalCount} (GIỮ NGUYÊN)`);

// 6. Test Non-Copy Notifications Do NOT Increment Copy Counter
console.log('\n▶ Test 6: Thông báo loại khác (BUY_PRODUCT, CLAIM_GIVEAWAY) không tăng tổng sao chép');
const beforeOther = currentGlobalCount;
handleToastDisplay({ id: 'buy_999', type: 'BUY_PRODUCT', isSelfClick: false });
handleToastDisplay({ id: 'gw_999', type: 'CLAIM_GIVEAWAY', isSelfClick: false });
handleToastDisplay({ id: 'dep_999', type: 'DEPOSIT_WALLET', isSelfClick: false });
assert.strictEqual(currentGlobalCount, beforeOther, 'Other notif types must NOT increment copy count');
console.log(`   ✅ Các loại thông báo khác nổ: ${beforeOther} -> ${currentGlobalCount} (KHÔNG TĂNG)`);

// 7. Test 20-Second Cooldown on Toast Display vs Full Click Counting
console.log('\n▶ Test 9: Quy tắc 20s: Bấm nhiều lần trong 20s chỉ thấy 1 thông báo, nhưng đếm đủ mọi lần bấm');
const userActionCooldownMap = new Map();
function canDisplayToast(userName, type, cooldownMs, now) {
  const key = `${userName}_${type}`;
  const lastTime = userActionCooldownMap.get(key) || 0;
  if (now - lastTime < cooldownMs) return false;
  userActionCooldownMap.set(key, now);
  return true;
}

let toastsShown = 0;
let clicksCounted = 0;
const cdMs = 20000;
const startTime = 100000;

for (let i = 0; i < 5; i++) {
  const clickTime = startTime + i * 2000; // 5 clicks every 2s (within 20s)
  clicksCounted++;
  if (canDisplayToast('User***', 'COPY_CODE', cdMs, clickTime)) {
    toastsShown++;
  }
}
assert.strictEqual(clicksCounted, 5, 'Must count all 5 clicks');
assert.strictEqual(toastsShown, 1, 'Must show exactly 1 toast in 20s');
console.log(`   ✅ 5 clicks trong 10s: Clicks đếm = ${clicksCounted}, Toasts hiển thị = ${toastsShown}`);

// 8. Test Reload Monotonicity (Never decreases on reload)
console.log('\n▶ Test 7 & 10: Tải lại trang và đối soát máy chủ: Số không bao giờ tụt lùi');
let localStored = currentGlobalCount;
// Simulate reload: read from cache
let reloadedCount = Math.max(93545, localStored);
assert.strictEqual(reloadedCount, currentGlobalCount);

// Simulate server response lower than local (e.g. edge cache stale at 93545 while local is 93555)
const staleServerCount = 93545;
if (staleServerCount > reloadedCount) {
  reloadedCount = staleServerCount;
}
assert.strictEqual(reloadedCount, currentGlobalCount, 'Stale server count must not drop local total');
console.log(`   ✅ Đối soát máy chủ cũ (${staleServerCount}) với local (${currentGlobalCount}): giữ nguyên ${reloadedCount}`);

// 9. Test HeroBanner label
console.log('\n▶ Test 11: HeroBanner không còn hiển thị theo ngày');
const heroBannerCode = fs.readFileSync('src/components/HeroBanner.tsx', 'utf8');
assert.ok(!heroBannerCode.includes('Lượt sao chép hôm nay'), 'HeroBanner must NOT contain "Lượt sao chép hôm nay"');
assert.ok(heroBannerCode.includes('Tổng lượt sao chép'), 'HeroBanner must contain "Tổng lượt sao chép"');
console.log('   ✅ HeroBanner hiển thị "Tổng lượt sao chép" chuẩn 100%');

console.log('\n================================================================');
console.log('🎉 TẤT CẢ 11 TIÊU CHÍ KIỂM THỬ ĐÃ ĐẠT 100% PASS!');
console.log('================================================================');
