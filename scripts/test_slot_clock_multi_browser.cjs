// scripts/test_slot_clock_multi_browser.cjs
// Kiểm chứng hành vi hiển thị theo đồng hồ khe & loại bỏ replay ngẫu nhiên trên đa trình duyệt

const assert = require('assert');

console.log('=== BẮT ĐẦU KIỂM THỬ: ĐỒNG HỒ KHE ĐA TRÌNH DUYỆT (SLOT CLOCK ENGINE) ===');

// 1. Giả lập logic đồng hồ khe chuẩn từ marketingService.ts & MarketingNotificationToast.tsx
function getVnDayAnchor(nowMs) {
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
  const vnNow = new Date(nowMs + VN_OFFSET_MS);
  const vnMidnightUtc = Date.UTC(
    vnNow.getUTCFullYear(),
    vnNow.getUTCMonth(),
    vnNow.getUTCDate(),
    0, 0, 0, 0
  );
  return vnMidnightUtc - VN_OFFSET_MS;
}

function extractSlotIndex(evt, dayStartMs) {
  if (evt.id) {
    const m = evt.id.match(/(?:sim_slot|slot_\w+)_(\d+)/);
    if (m) {
      return parseInt(m[1], 10);
    }
  }
  if (evt.timestamp) {
    return Math.floor((evt.timestamp - dayStartMs) / 30000);
  }
  return null;
}

class SimulatedBrowserClient {
  constructor(name, clockSkewMs = 0) {
    this.name = name;
    this.clockSkewMs = clockSkewMs; // Độ lệch đồng hồ (nếu có, tối đa vài trăm ms)
    this.slotEventsMap = new Map();
    this.realEventsQueue = [];
    this.lastDisplayedSlot = -1;
    this.displayedHistory = [];
  }

  // Nhận dữ liệu sổ máy chủ từ /api/realtime-events
  syncFromHub(serverEvents, currentServerTime) {
    const dayStartMs = getVnDayAnchor(currentServerTime);
    for (const evt of serverEvents) {
      const slotIdx = extractSlotIndex(evt, dayStartMs);
      if (slotIdx !== null) {
        this.slotEventsMap.set(slotIdx, evt);
      }
    }
  }

  getCurrentSlotEvent(slotIndex) {
    return this.slotEventsMap.get(slotIndex) || null;
  }

  // Giả lập vòng tick hiển thị (như hàm scheduleDeterministicSlot)
  tick(currentTimeMs) {
    const calibratedNow = currentTimeMs + this.clockSkewMs;
    const dayStartMs = getVnDayAnchor(calibratedNow);
    const currentSlotIndex = Math.floor((calibratedNow - dayStartMs) / 30000);
    const slotStartMs = dayStartMs + currentSlotIndex * 30000;
    const slotFireTimeMs = slotStartMs + 1500;
    const slotHideTimeMs = slotFireTimeMs + 5000;

    // Ưu tiên 1: Real event
    if (this.realEventsQueue.length > 0) {
      const realEvt = this.realEventsQueue.shift();
      this.displayedHistory.push({ type: 'real', event: realEvt, time: calibratedNow });
      return { action: 'show_real', event: realEvt };
    }

    // Ưu tiên 2: Sự kiện theo khe
    if (this.lastDisplayedSlot === currentSlotIndex) {
      return { action: 'already_shown_this_slot', slotIndex: currentSlotIndex };
    }

    if (calibratedNow < slotFireTimeMs) {
      return { action: 'wait_until_fire_time', waitMs: slotFireTimeMs - calibratedNow };
    }

    if (calibratedNow >= slotFireTimeMs && calibratedNow < slotHideTimeMs + 4000) {
      const slotEvt = this.getCurrentSlotEvent(currentSlotIndex);
      if (!slotEvt) {
        // Tuyệt đối không sinh replay
        return { action: 'no_slot_event_and_no_replay' };
      }
      this.lastDisplayedSlot = currentSlotIndex;
      this.displayedHistory.push({ type: 'slot', slotIndex: currentSlotIndex, event: slotEvt, time: calibratedNow });
      return { action: 'show_slot', slotIndex: currentSlotIndex, event: slotEvt };
    }

    // Quá cửa sổ khe -> Bỏ qua, không phát lại
    this.lastDisplayedSlot = currentSlotIndex;
    return { action: 'skip_expired_slot', slotIndex: currentSlotIndex };
  }
}

// BẮT ĐẦU CHẠY CÁC BÀI TEST

// Bài test 1: Hai trình duyệt hỏi dữ liệu lệch pha nhưng cùng thấy một thông báo tại cùng khe
console.log('\n--- Test 1: Hai trình duyệt hỏi lệch pha, hiển thị khớp tuyệt đối 100% theo khe ---');
const baseTime = 1792913000000; // Mốc thời gian bất kỳ
const dayStart = getVnDayAnchor(baseTime);
const slotA = Math.floor((baseTime - dayStart) / 30000);

const mockServerEvents = [
  { id: `sim_slot_${slotA}`, message: 'Người dùng *88 mua Thẻ Tuần VIP', type: 'order', timestamp: dayStart + slotA * 30000 + 1000 },
  { id: `sim_slot_${slotA + 1}`, message: 'Người dùng *92 nhận Giftcode Rotwood', type: 'giveaway', timestamp: dayStart + (slotA + 1) * 30000 + 1000 },
];

const browser1 = new SimulatedBrowserClient('Chrome Desktop', 0);
const browser2 = new SimulatedBrowserClient('Safari Mobile', 200); // Lệch 200ms do đồng hồ

// Browser 1 hỏi dữ liệu lúc giây thứ 2 của slotA
const time1 = dayStart + slotA * 30000 + 2000;
browser1.syncFromHub(mockServerEvents, time1);

// Browser 2 hỏi dữ liệu lúc giây thứ 12 của slotA (lệch pha 10 giây so với Browser 1)
const time2 = dayStart + slotA * 30000 + 12000;
browser2.syncFromHub(mockServerEvents, time2);

// Cả 2 client cùng hiển thị tại đúng slotA
const res1 = browser1.tick(time1);
assert.strictEqual(res1.action, 'show_slot');
assert.strictEqual(res1.event.id, `sim_slot_${slotA}`);

// Sang slot tiếp theo (slotA + 1)
const timeSlotNext = dayStart + (slotA + 1) * 30000 + 2000;
const res1Next = browser1.tick(timeSlotNext);
const res2Next = browser2.tick(timeSlotNext);

assert.strictEqual(res1Next.action, 'show_slot');
assert.strictEqual(res2Next.action, 'show_slot');
assert.strictEqual(res1Next.event.id, res2Next.event.id, 'Cả 2 browser phải hiển thị cùng một id sự kiện!');
assert.strictEqual(res1Next.event.message, res2Next.event.message, 'Cả 2 browser phải hiển thị cùng nội dung thông báo!');
console.log(`[PASS] Test 1: Cả 2 trình duyệt hiển thị chính xác cùng sự kiện [${res1Next.event.id}] - "${res1Next.event.message}"`);

// Bài test 2: Xóa bỏ hoàn toàn replay_ khi không có sự kiện cho khe hiện tại
console.log('\n--- Test 2: Tuyệt đối không phát lại ngẫu nhiên (Zero replay_) ---');
const browserEmpty = new SimulatedBrowserClient('Firefox', 0);
// Đồng bộ danh sách cũ không có slot hiện tại
browserEmpty.syncFromHub([
  { id: `sim_slot_${slotA - 10}`, message: 'Sự kiện cũ 5 phút trước', type: 'order', timestamp: dayStart + (slotA - 10) * 30000 }
], time1);

const resEmpty = browserEmpty.tick(time1);
assert.strictEqual(resEmpty.action, 'no_slot_event_and_no_replay', 'Không được sinh replay khi khe hiện tại không có sự kiện');
assert.strictEqual(browserEmpty.displayedHistory.length, 0, 'Lịch sử hiển thị phải trống, không có thông báo giả mạo');
console.log('[PASS] Test 2: Không sinh bất kỳ id replay_ nào khi khe rỗng!');

// Bài test 3: Trình duyệt mới mở & Tab ẩn quay lại (Không phát lại quá khứ)
console.log('\n--- Test 3: Trình duyệt mới mở / Tab ẩn không xả lại sự kiện cũ trong quá khứ ---');
const browserNew = new SimulatedBrowserClient('Edge New Tab', 0);
// Nhận 10 sự kiện cũ trong quá khứ + sự kiện hiện tại
const manyEvents = [];
for (let i = 10; i >= 1; i--) {
  manyEvents.push({
    id: `sim_slot_${slotA - i}`,
    message: `Sự kiện cũ slot -${i}`,
    type: 'order',
    timestamp: dayStart + (slotA - i) * 30000
  });
}
manyEvents.push({
  id: `sim_slot_${slotA}`,
  message: 'Sự kiện hiện tại',
  type: 'order',
  timestamp: dayStart + slotA * 30000
});

browserNew.syncFromHub(manyEvents, time1);

// Khi tick, browserNew chỉ hiển thị slotA, tuyệt đối không xả slotA-10 ... slotA-1
const resNew = browserNew.tick(time1);
assert.strictEqual(resNew.action, 'show_slot');
assert.strictEqual(resNew.slotIndex, slotA);
assert.strictEqual(resNew.event.id, `sim_slot_${slotA}`);
assert.strictEqual(browserNew.displayedHistory.length, 1);
assert.strictEqual(browserNew.displayedHistory[0].event.id, `sim_slot_${slotA}`);
console.log('[PASS] Test 3: Trình duyệt mới mở chỉ hiển thị đúng khe hiện tại, không xả lại 10 sự kiện cũ!');

// Bài test 4: Quá cửa sổ khe thì bỏ qua, không hiển thị trễ
console.log('\n--- Test 4: Quá thời lượng khe (sau 9s) thì bỏ qua, không nổ trễ ---');
const browserLate = new SimulatedBrowserClient('Late Browser', 0);
browserLate.syncFromHub(mockServerEvents, baseTime);
// Giả lập mở tab ở giây thứ 15 của khe (đã quá thời lượng 5s + 4s buffer)
const timeLate = dayStart + slotA * 30000 + 15000;
const resLate = browserLate.tick(timeLate);
assert.strictEqual(resLate.action, 'skip_expired_slot');
assert.strictEqual(browserLate.displayedHistory.length, 0, 'Không được hiển thị sự kiện đã quá hạn');
console.log('[PASS] Test 4: Quá cửa sổ khe được bỏ qua an toàn, không nổ trễ!');

// Bài test 5: Sự kiện thật hiển thị ngay lập tức (Ưu tiên vượt khe)
console.log('\n--- Test 5: Sự kiện thật của người dùng hiển thị ngay lập tức ---');
const browserReal = new SimulatedBrowserClient('User Browser', 0);
browserReal.syncFromHub(mockServerEvents, baseTime);
browserReal.realEventsQueue.push({ id: 'real_order_123', message: 'Bạn vừa mua thành công!', type: 'order' });

const resReal = browserReal.tick(baseTime);
assert.strictEqual(resReal.action, 'show_real');
assert.strictEqual(resReal.event.id, 'real_order_123');
console.log('[PASS] Test 5: Sự kiện thật được ưu tiên hiển thị ngay lập tức!');

console.log('\n=== TẤT CẢ 5 BÀI TEST ĐỒNG HỒ KHE ĐA TRÌNH DUYỆT ĐÃ VƯỢT QUA 100% ===\n');
