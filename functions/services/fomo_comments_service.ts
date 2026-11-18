/**
 * FOMO Comments & Review Generator Service
 * Tự động tính toán và sinh đánh giá / bình luận chân thực cho từng tựa game
 * theo độ HOT và số ngày trôi qua, tuân thủ nghiêm ngặt các quy tắc:
 * 1. Tên người dùng thuần chữ thường, KHÔNG dấu gạch ngăn (_ hay -).
 * 2. Nội dung nhận xét đời thường, KHÔNG ghi phần thưởng cụ thể.
 * 3. Sử dụng từ viết tắt phổ biến: ad, dc, k, ko, ae, nha, mn, code, mã, oki, tks...
 * 4. KHÔNG dấu chấm cuối câu.
 * 5. Xen lẫn một vài câu phản hồi về mã hết hạn (~8%).
 * 6. Điểm đánh giá trung bình tổng thể luôn >= 4.5 sao.
 * 7. Kho mẫu đúng 100 câu phân biệt: 82 câu 5★, 10 câu 4★, 8 câu phản hồi hết hạn.
 * 8. Tuyệt đối không trùng lặp nội dung bình luận trong cùng 1 game.
 */

// 1. Kho tên tài khoản ảo (thuần chữ thường, không gạch nối, không dấu gạch dưới)
export const FOMO_USERNAMES: string[] = [
  'hoanglong23', 'minhtuan99', 'quanghuyvt', 'tranducnam', 'phamtuananh',
  'ducminh02', 'vanhau98', 'thanhtung88', 'quocbao95', 'minhkhang',
  'kimngan2k', 'thuyduong99', 'baonam2k', 'huynhanh97', 'tienphat88',
  'nguyenanh2k', 'tuanvu95', 'hoangnam9x', 'phuonglinh', 'ducviet01',
  'thanhthao99', 'minhtri88', 'quangminh23', 'ngocmai2k', 'lananh98',
  '0984***231', '0903***556', '0356***889', '0978***112', '0868***456',
  '0912***789', '0779***321', '0398***654', '0966***890', '0833***124',
  'gamerpro2k', 'shadowvn', 'kiemhiep9x', 'sieunhanh99', 'trumgame',
  'thanlongvt', 'chienthan99', 'vualapcode', 'gamevip88', 'accvip2k',
  'dinhkhoa', 'vanquyen', 'thanhphong', 'anhkhoa2k', 'hongphuc99',
  '0945***678', '0932***119', '0877***443', '0344***992', '0922***558'
];

// 2. Mẫu bình luận 5 sao (Đúng 82 mẫu phân biệt, không có dấu chấm cuối câu, không thưởng cụ thể)
export const POSITIVE_COMMENTS_5_STAR: string[] = [
  'mã xài ngon nha ae',
  'web cập nhật code nhanh thật tks ad',
  'vừa nhập dc hết mã tân thủ ngon lành',
  'code chuẩn nha mn nhập phát dc luôn',
  'uy tín nha ad cho 5 sao',
  'game hay mã dùng tốt lắm',
  'ae tranh thủ nhập sớm kẻo hết hạn nha',
  'shop này cập nhật code nhanh nhất luôn',
  'mã vẫn còn hạn dùng mượt nha ae',
  'nhập full hết mã luôn sướng ghê',
  'ngon lành cành đào tks shop nhiều',
  'đã test và thành công hết nha mn',
  'web xịn xò code ngon quá chừng',
  'lần đầu nhập code ở đây thấy ok phết',
  'code xịn nha ad hóng thêm mã mới',
  'vừa tạo acc nhập cái lên lực chiến vèo vèo',
  'ae nhập nhớ chú ý chữ hoa chữ thường là dc nha',
  'đã nhận quà thành công cảm ơn ad',
  'mã dùng ok lắm mn ơi',
  'mới chơi game này có code đỡ thọt hẳn',
  'mong ad cập nhật thêm code mới sớm nha',
  'toàn code xịn nhập cái ăn ngay tks ad',
  'code chuẩn đét nha ae vào húp lẹ',
  'web uy tín cập nhật code đúng từng ngày luôn',
  'vừa nhập xong dc bao nhiêu đồ ngon',
  'mã ngon tks ad nhiều nha',
  'game cuốn code lại nhiều nữa cho 5 sao liền',
  'mọi người nhập nhanh còn kịp nha',
  'ad đỉnh quá tìm dc toàn mã còn hạn',
  'code dùng ngon lành cành đào luôn mn',
  'mới tải game về nhập code mượt re',
  'web này uy tín số 1 luôn ae yên tâm nhập',
  'code còn hạn nhiều lắm nha mn',
  'vừa test xong dùng ngon lành cành đào',
  'quá xịn sò ae ơi nhập phát ăn ngay',
  'code mới tinh dùng mượt lắm nha ad',
  'nhập thành công hết nha mn tks ad nhiều',
  'húp trọn bộ code ngon cho 5 sao liền tay',
  'ae nhanh tay copy kẻo sv đóng mã nha',
  'mã ngon quá trời luôn shop ơi',
  'code chuẩn chỉ ae vào copy lẹ nha',
  'test thử ai ngờ ăn thật tks shop nhiều',
  'mã nào cũng nhận dc quà đã ghê',
  'vào copy phát ăn trọn bộ code ngon',
  'code xịn mượt mà lắm mn ơi',
  'web đỉnh code lúc nào cũng mới',
  'nhập mỏi tay luôn code nhiều thật sự',
  'vừa tạo acc phụ nhập phát lên vèo vèo',
  'code ngon lành ae vào nhận lẹ nhé',
  'mã vip thật sự cảm ơn ad nhiều nha',
  'nhập phát dc luôn uy tín quá shop',
  'toàn mã còn hạn xài sướng cả người',
  'ae mới chơi nhớ nhập hết mã này nha',
  'code dùng ok hết nha mn tks ad',
  'web cập nhật chuẩn từng phút luôn đỉnh ghê',
  'mã xịn đét nhập phát ăn liền',
  'lụm dc mớ code ngon tks ad đẹp trai',
  'mã mượt lắm mn ơi nhập lẹ kẻo hết',
  'chúc web ngày càng phát triển code ngon lắm',
  'quà về hòm thư liền tay sướng ghê',
  'code chuẩn từng chữ ae cứ yên tâm nhập',
  'quá đã ae ơi code còn hạn dài dài',
  'hóng ad lên thêm code mới từng ngày nha',
  'nhập xong quà ngập acc luôn tks shop',
  'code dùng bao mượt luôn nha ae',
  'mới test lúc nãy dùng ngon ơ mn ơi',
  'code tân thủ chuẩn bài luôn ad ơi',
  'vừa húp dc hết mã tks shop uy tín',
  'mã sự kiện xài ngon lành cành đào',
  'ae tranh thủ nhập kẻo hết lượt nha',
  'code chuẩn phết mn vào nhận lẹ',
  'web mượt code xịn cho ad 5 sao',
  'nhập code cái đồ về túi đầy ắp luôn',
  'mã ngon xài ổn định lắm nha mn',
  'ad cập nhật nhanh dã man tks ad nha',
  'toàn code ngon húp trọn gói luôn',
  'code vip dùng mượt ru nha ae',
  'vừa vào game nhập dc liền thích thật',
  'code dùng ngon ơ cảm ơn ad nhiều',
  'mã chuẩn đét không trượt phát nào',
  'lần nào lấy code ở đây cũng ăn dc hết',
  'tuyệt vời ad ơi code dùng ngon lành'
];

// 3. Mẫu bình luận 4 sao (Đúng 10 mẫu phân biệt)
export const POSITIVE_COMMENTS_4_STAR: string[] = [
  'code dùng ok nha ae',
  'mã nhận quà mượt tks ad',
  'web cập nhật khá nhanh cho 4 sao ủng hộ',
  'nhập dc gần hết mã ngon lành',
  'ae vào copy mã lẹ nha',
  'code xịn tks shop',
  'nhận quà ok nha mọi người',
  'code dùng khá ổn áp tks shop',
  'vài mã sự kiện hơi cũ nhưng vẫn nhận dc quà',
  'cho 4 sao ủng hộ ad hóng code mới nha'
];

// 4. Mẫu bình luận phản hồi mã hết hạn (Đúng 8 mẫu phân biệt, rating 4 sao hoặc 3 sao, không dấu chấm cuối câu)
export const EXPIRED_FEEDBACK_COMMENTS: Array<{ text: string; rating: number }> = [
  { text: 'mấy mã cũ hết hạn rồi ad ơi còn mã mới vẫn dc nha', rating: 4 },
  { text: 'mã cuối k dc nha mn còn lại nhập ok hết', rating: 4 },
  { text: 'code tân thủ vẫn dùng ok mã sự kiện hình như hết hạn r', rating: 4 },
  { text: 'có 1 2 mã cũ báo hết hạn ad xem cập nhật lại nha', rating: 4 },
  { text: 'mã đầu tiên hết hạn rồi ad ơi', rating: 4 },
  { text: 'ae test mã mới thôi mấy mã cũ hết hạn r', rating: 4 },
  { text: 'vài mã cũ hết hạn nha mn mã mới vẫn mượt', rating: 4 },
  { text: 'mã sự kiện sv cũ k nhập dc nữa r ad', rating: 3 }
];

export interface FomoCommentItem {
  id: string;
  game_slug: string;
  user_id: string;
  user_name: string;
  rating: number;
  content: string;
  confirmed_working: number;
  status: 'APPROVED';
  created_at: string;
  is_fomo?: boolean;
}

export interface FomoCommentsOverview {
  average_rating: number;
  rating_count: number;
  total_comments: number;
  distribution: {
    '1': number;
    '2': number;
    '3': number;
    '4': number;
    '5': number;
  };
  confirmed_working_count: number;
}

/**
 * Hàm băm chuỗi số nguyên tất định (Deterministic Hash)
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Pseudo-Random Number Generator (PRNG LCG) tất định từ seed
 */
function createPrng(seed: number) {
  let s = Math.abs(seed) || 123456789;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Xáo trộn mảng bằng thuật toán Fisher-Yates tất định
 */
function deterministicShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  const rand = createPrng(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Sinh danh sách đánh giá FOMO tăng trưởng theo ngày và độ HOT của game
 * ĐẢM BẢO:
 * - Tối đa 100 bình luận
 * - 100% KHÔNG TRÙNG NỘI DUNG TRONG CÙNG 1 GAME
 * - Điểm trung bình luôn >= 4.5 sao
 */
export function generateFomoComments(
  gameSlug: string,
  gameMeta: {
    is_hot?: boolean | number;
    is_featured?: boolean | number;
    is_new?: boolean | number;
    total_codes_count?: number;
    active_codes_count?: number;
  } = {},
  nowMs: number = Date.now()
): { comments: FomoCommentItem[]; overview: FomoCommentsOverview } {
  const slug = String(gameSlug || '').trim().toLowerCase();
  const slugHash = hashString(slug);

  // Mốc neo thời gian bắt đầu hệ thống (2026-10-01 UTC)
  const ANCHOR_DATE_MS = new Date('2026-10-01T00:00:00Z').getTime();
  const daysElapsed = Math.max(1, Math.floor((nowMs - ANCHOR_DATE_MS) / 86400000));

  // Xác định độ HOT của game để tính số lượng cơ sở (Base) và tốc độ tăng trưởng hàng ngày (Daily Growth)
  const isHot = Boolean(gameMeta.is_hot || (gameMeta.total_codes_count && gameMeta.total_codes_count >= 100));
  const isFeatured = Boolean(gameMeta.is_featured || gameMeta.is_new || (gameMeta.total_codes_count && gameMeta.total_codes_count >= 20));

  let baseCount = 12 + (slugHash % 10); // Tiêu chuẩn: 12-21 đánh giá
  let dailyGrowth = 0.4; // Cứ ~2-3 ngày tăng 1 đánh giá

  if (isHot) {
    baseCount = 55 + (slugHash % 25); // Game Hot: 55-79 đánh giá
    dailyGrowth = 2.5 + ((slugHash % 10) * 0.15); // Mỗi ngày tăng 2.5 - 4.0 đánh giá
  } else if (isFeatured) {
    baseCount = 28 + (slugHash % 15); // Nổi bật: 28-42 đánh giá
    dailyGrowth = 1.2 + ((slugHash % 10) * 0.1); // Mỗi ngày tăng 1.2 - 2.2 đánh giá
  }

  // Giới hạn số bình luận tối đa 100 (đúng bằng số mẫu trong kho)
  const totalReviewsCount = Math.min(100, Math.floor(baseCount + (daysElapsed * dailyGrowth)));

  // 1. Xáo trộn riêng từng nhóm mẫu theo seed của game
  const shuffled5Star = deterministicShuffle(POSITIVE_COMMENTS_5_STAR, slugHash + 555);
  const shuffled4Star = deterministicShuffle(POSITIVE_COMMENTS_4_STAR, slugHash + 444);
  const shuffledExpired = deterministicShuffle(EXPIRED_FEEDBACK_COMMENTS, slugHash + 333);
  const shuffledUsers = deterministicShuffle(FOMO_USERNAMES, slugHash + 777);

  // 2. Tính số lượng từng nhóm mẫu theo tỷ lệ chuẩn: ~8% hết hạn, ~10% 4 sao, còn lại 5 sao
  const numExpired = Math.min(shuffledExpired.length, Math.max(1, Math.round(totalReviewsCount * 0.08)));
  const num4Star = Math.min(shuffled4Star.length, Math.max(1, Math.round(totalReviewsCount * 0.10)));
  const num5Star = Math.min(shuffled5Star.length, totalReviewsCount - numExpired - num4Star);

  // Lấy các câu đánh giá duy nhất từ các mẫu đã xáo trộn
  interface RawReviewChoice {
    text: string;
    rating: number;
    confirmed: number;
  }

  const selectedChoices: RawReviewChoice[] = [];

  // Lấy mẫu hết hạn
  for (let i = 0; i < numExpired; i++) {
    selectedChoices.push({
      text: shuffledExpired[i].text,
      rating: shuffledExpired[i].rating,
      confirmed: 0,
    });
  }

  // Lấy mẫu 4 sao
  for (let i = 0; i < num4Star; i++) {
    selectedChoices.push({
      text: shuffled4Star[i],
      rating: 4,
      confirmed: (i % 2 === 0) ? 1 : 0,
    });
  }

  // Lấy mẫu 5 sao
  for (let i = 0; i < num5Star; i++) {
    selectedChoices.push({
      text: shuffled5Star[i],
      rating: 5,
      confirmed: 1,
    });
  }

  // Nếu vẫn còn thiếu so với totalReviewsCount, lấy thêm từ 5 sao hoặc 4 sao còn dư
  if (selectedChoices.length < totalReviewsCount) {
    const needed = totalReviewsCount - selectedChoices.length;
    let extra5Added = 0;
    for (let i = num5Star; i < shuffled5Star.length && extra5Added < needed; i++) {
      selectedChoices.push({
        text: shuffled5Star[i],
        rating: 5,
        confirmed: 1,
      });
      extra5Added++;
    }
  }

  // 3. Xáo trộn thứ tự xuất hiện giữa các loại bình luận để không bị dồn cục
  const finalShuffledChoices = deterministicShuffle(selectedChoices, slugHash + 999);

  // 4. Khởi tạo danh sách kết quả kèm kiểm tra chống trùng lặp tuyệt đối
  const generatedList: FomoCommentItem[] = [];
  const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let confirmedWorkingCount = 0;
  let totalRatingSum = 0;
  const seenTexts = new Set<string>();

  const actualCount = finalShuffledChoices.length;

  for (let i = 0; i < actualCount; i++) {
    const choice = finalShuffledChoices[i];
    const normText = choice.text.trim().toLowerCase();

    // Lọc trùng tuyệt đối: nếu đã xuất hiện rồi thì bỏ qua ngay
    if (seenTexts.has(normText)) {
      continue;
    }
    seenTexts.add(normText);

    const userName = shuffledUsers[i % shuffledUsers.length];

    // Thời gian sinh: trải đều từ ngày neo tới hiện tại
    // i càng nhỏ (các review mới nhất) thời gian càng gần nowMs
    const ageFactor = Math.pow(i / actualCount, 1.8);
    const timeOffsetMs = Math.floor(ageFactor * (nowMs - ANCHOR_DATE_MS));
    const reviewTimeMs = Math.max(ANCHOR_DATE_MS, nowMs - timeOffsetMs);
    const createdAt = new Date(reviewTimeMs).toISOString();

    const starKey = String(choice.rating) as '3' | '4' | '5';
    distribution[starKey]++;
    totalRatingSum += choice.rating;
    if (choice.confirmed === 1) confirmedWorkingCount++;

    generatedList.push({
      id: `fomo_cm_${slug}_${i}`,
      game_slug: slug,
      user_id: `fomo_u_${userName}`,
      user_name: userName,
      rating: choice.rating,
      content: choice.text,
      confirmed_working: choice.confirmed,
      status: 'APPROVED',
      created_at: createdAt,
      is_fomo: true,
    });
  }

  // Sắp xếp các bình luận mới nhất lên đầu
  generatedList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Điểm đánh giá trung bình (được neo tối thiểu 4.5 sao)
  const validTotal = generatedList.length;
  const calculatedAvg = validTotal > 0 ? (totalRatingSum / validTotal) : 4.8;
  const averageRating = Math.max(4.5, Math.min(5.0, Math.round(calculatedAvg * 10) / 10));

  const overview: FomoCommentsOverview = {
    average_rating: averageRating,
    rating_count: validTotal,
    total_comments: validTotal,
    distribution,
    confirmed_working_count: confirmedWorkingCount,
  };

  return { comments: generatedList, overview };
}
