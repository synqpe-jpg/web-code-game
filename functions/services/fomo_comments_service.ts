/**
 * FOMO Comments & Review Generator Service
 * Tự động tính toán và sinh đánh giá / bình luận chân thực cho từng tựa game
 * theo độ HOT và số ngày trôi qua, tuân thủ nghiêm ngặt các quy tắc:
 * 1. Tên người dùng thuần chữ thường, KHÔNG dấu gạch ngăn (_ hay -).
 * 2. Nội dung nhận xét đời thường, KHÔNG ghi phần thưởng cụ thể.
 * 3. Sử dụng từ viết tắt phổ biến: ad, dc, k, ko, ae, nha, mn, code, mã, oki, tks...
 * 4. KHÔNG dấu chấm cuối câu.
 * 5. Xen lẫn một vài câu phản hồi về mã hết hạn.
 * 6. Điểm đánh giá trung bình tổng thể luôn >= 4.5 sao.
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

// 2. Mẫu bình luận 5 sao (chiếm ~82%, không có dấu chấm cuối câu, không thưởng cụ thể)
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
  'vừa test xong dùng ngon lành cành đào'
];

// 3. Mẫu bình luận 4 sao (chiếm ~10%)
export const POSITIVE_COMMENTS_4_STAR: string[] = [
  'code dùng ok nha ae',
  'mã nhận quà mượt tks ad',
  'web cập nhật khá nhanh cho 4 sao ủng hộ',
  'nhập dc gần hết mã ngon lành',
  'ae vào copy mã lẹ nha',
  'code xịn tks shop',
  'nhận quà ok nha mọi người',
  'code dùng khá ổn áp tks shop'
];

// 4. Mẫu bình luận phản hồi mã hết hạn (chiếm ~8%, rating 4 sao hoặc 3 sao, không dấu chấm cuối câu)
export const EXPIRED_FEEDBACK_COMMENTS: Array<{ text: string; rating: number }> = [
  { text: 'mấy mã cũ hết hạn rồi ad ơi còn mã mới vẫn dc nha', rating: 4 },
  { text: 'mã cuối k dc nha mn còn lại nhập ok hết', rating: 4 },
  { text: 'code tân thủ vẫn dùng ok mã sự kiện hình như hết hạn r', rating: 4 },
  { text: 'có 1 2 mã cũ báo hết hạn ad xem cập nhật lại nha', rating: 4 },
  { text: 'mã đầu tiên hết hạn rồi ad ơi', rating: 4 },
  { text: 'ae test mã mới thôi mấy mã cũ hết hạn r', rating: 4 },
  { text: 'vài mã cũ hết hạn nha mn mã mới vẫn mượt', rating: 4 },
  { text: 'mã sự kiện sv cũ k nhập dc nữa r ad', rating: 3 },
  { text: 'mã hết hạn ad cập nhật mã mới nha', rating: 4 }
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
 * Sinh danh sách đánh giá FOMO tăng trưởng theo ngày và độ HOT của game
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

  const totalReviewsCount = Math.floor(baseCount + (daysElapsed * dailyGrowth));

  const generatedList: FomoCommentItem[] = [];
  const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let confirmedWorkingCount = 0;
  let totalRatingSum = 0;

  for (let i = 0; i < totalReviewsCount; i++) {
    const itemSeed = hashString(`${slug}_review_${i}`);
    const userIndex = (slugHash + i * 7 + (itemSeed % 13)) % FOMO_USERNAMES.length;
    const userName = FOMO_USERNAMES[userIndex];

    // Xác định phân loại bình luận:
    // Tỷ lệ: 82% 5 sao, 10% 4 sao khen, 8% báo mã hết hạn (4 sao hoặc 3 sao)
    const typeRoll = itemSeed % 100;
    let rating = 5;
    let commentText = '';
    let confirmed = 1;

    if (typeRoll < 8) {
      // Nhóm phản hồi mã hết hạn (8%)
      const expIndex = (itemSeed + i) % EXPIRED_FEEDBACK_COMMENTS.length;
      const expItem = EXPIRED_FEEDBACK_COMMENTS[expIndex];
      commentText = expItem.text;
      rating = expItem.rating;
      confirmed = 0; // Báo mã hết hạn nên không tích confirmed_working
    } else if (typeRoll < 18) {
      // Nhóm 4 sao tích cực (10%)
      const pos4Index = (itemSeed + i) % POSITIVE_COMMENTS_4_STAR.length;
      commentText = POSITIVE_COMMENTS_4_STAR[pos4Index];
      rating = 4;
      confirmed = (itemSeed % 2 === 0) ? 1 : 0;
    } else {
      // Nhóm 5 sao áp đảo (82%)
      const pos5Index = (itemSeed + i) % POSITIVE_COMMENTS_5_STAR.length;
      commentText = POSITIVE_COMMENTS_5_STAR[pos5Index];
      rating = 5;
      confirmed = 1; // 5 sao luôn xác nhận mã dùng tốt
    }

    // Thời gian sinh: trải đều từ ngày neo tới hiện tại
    // i càng nhỏ (các review mới nhất) thời gian càng gần nowMs
    const ageFactor = Math.pow(i / totalReviewsCount, 1.8);
    const timeOffsetMs = Math.floor(ageFactor * (nowMs - ANCHOR_DATE_MS));
    const reviewTimeMs = Math.max(ANCHOR_DATE_MS, nowMs - timeOffsetMs);
    const createdAt = new Date(reviewTimeMs).toISOString();

    distribution[String(rating) as '3' | '4' | '5']++;
    totalRatingSum += rating;
    if (confirmed === 1) confirmedWorkingCount++;

    generatedList.push({
      id: `fomo_cm_${slug}_${i}`,
      game_slug: slug,
      user_id: `fomo_u_${userName}`,
      user_name: userName,
      rating,
      content: commentText,
      confirmed_working: confirmed,
      status: 'APPROVED',
      created_at: createdAt,
      is_fomo: true
    });
  }

  // Sắp xếp các bình luận mới nhất lên đầu
  generatedList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Điểm đánh giá trung bình (được neo tối thiểu 4.5 sao)
  const calculatedAvg = totalReviewsCount > 0 ? (totalRatingSum / totalReviewsCount) : 4.8;
  const averageRating = Math.max(4.5, Math.min(5.0, Math.round(calculatedAvg * 10) / 10));

  const overview: FomoCommentsOverview = {
    average_rating: averageRating,
    rating_count: totalReviewsCount,
    total_comments: totalReviewsCount,
    distribution,
    confirmed_working_count: confirmedWorkingCount
  };

  return { comments: generatedList, overview };
}
