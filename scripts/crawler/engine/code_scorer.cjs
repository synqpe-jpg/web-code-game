/**
 * Bộ Máy Chấm Điểm & Đánh Giá Giftcode 4 Cấp Bậc (0 - 100 Điểm)
 * 
 * PHÂN LOẠI 4 CẤP BẬC:
 * - BẬC 1 (90 - 100 điểm): [TỰ ĐỘNG ĐĂNG] Tuyệt đối tin cậy, tự động nạp thẳng lên Web khách.
 * - BẬC 2 (70 - 89 điểm):  [CHỜ DUYỆT - TIỀM NĂNG CAO] Khớp tốt, đề xuất Admin duyệt 1-chạm.
 * - BẬC 3 (50 - 69 điểm):  [CHỜ DUYỆT - CẦN KIỂM TRA] Nghi ngờ hoặc thiếu dữ liệu, cần xem lại.
 * - BẬC 4 (Dưới 50 điểm):  [RỦI RO / TỪ CHỐI] Không đạt chuẩn, tự động gắn cờ Spam/Bỏ qua.
 */

const { isValidGiftCode, VALID_CODE_PREFIXES } = require('./code_filter.cjs');

function calculateCodeScore({
  code,
  gameMatchConfidence, // 0 - 1 (tỷ lệ khớp tựa game)
  sourceType,          // 'official_fb' | 'official_site' | 'reputable_web' | 'community_discord' | 'forum'
  rewards,
  expiresAt,
  isDuplicate,
  contextText = ''
}) {
  const cleanCode = String(code || '').trim().toUpperCase();

  // Nếu mã bị trùng với kho code hiện có -> 0 điểm ngay
  if (isDuplicate) {
    return {
      score: 0,
      tier: 4,
      tierLabel: 'Bậc 4: Trùng lặp (0đ)',
      canAutoPublish: false,
      reasons: ['Mã code đã tồn tại trong kho hệ thống']
    };
  }

  // 1. KIỂM TRA BỘ LỌC MÃ RÁC ĐA TẦNG (ANTI-JUNK GUARD)
  if (!isValidGiftCode(cleanCode)) {
    return {
      score: 0,
      tier: 4,
      tierLabel: 'Bậc 4: Mã rác / Từ vựng thông dụng (0đ)',
      canAutoPublish: false,
      reasons: ['Phát hiện từ khóa rác, từ vựng thông dụng hoặc sai định dạng']
    };
  }

  // 2. KHÔNG XÁC ĐỊNH ĐƯỢC TỰA GAME -> KHÔNG ĐƯA VÀO HỆ THỐNG
  if (gameMatchConfidence <= 0) {
    return {
      score: 0,
      tier: 4,
      tierLabel: 'Bậc 4: Không xác định tựa game (0đ)',
      canAutoPublish: false,
      reasons: ['Không xác định được tựa game đích trong hệ thống']
    };
  }

  let score = 0;
  const reasons = [];

  // ==========================================
  // TIÊU CHÍ 1: ĐỘ KHỚP TỰA GAME (Tối đa 40 điểm)
  // ==========================================
  if (gameMatchConfidence >= 0.95) {
    score += 40;
    reasons.push('Khớp chính xác tên game (100%): +40đ');
  } else if (gameMatchConfidence >= 0.8) {
    score += 32;
    reasons.push('Khớp tên game theo từ khóa alias chuẩn: +32đ');
  } else if (gameMatchConfidence >= 0.6) {
    score += 20;
    reasons.push('Khớp tên game một phần: +20đ');
  } else if (gameMatchConfidence >= 0.4) {
    score += 10;
    reasons.push('Độ nhận diện tựa game thấp: +10đ');
  } else {
    reasons.push('Không xác định rõ tựa game: +0đ');
  }

  // ==========================================
  // TIÊU CHÍ 2: ĐỊNH DẠNG MÃ CODE (Tối đa 25 điểm)
  // ==========================================
  const hasDigit = /\d/.test(cleanCode);
  const hasLetter = /[A-Z]/.test(cleanCode);
  const hasLegitPrefix = VALID_CODE_PREFIXES.test(cleanCode);
  const isTrulyAlphaNumeric = (hasDigit && hasLetter) || hasLegitPrefix;
  const isUpperFormat = /^[A-Z0-9_-]{5,24}$/.test(cleanCode);
  const isMixedCase = /^[A-Za-z0-9_-]{5,24}$/.test(cleanCode);
  const hasSpamPattern = /(http|www|\.com|\.vn|link|sub|like|share)/i.test(cleanCode);

  if (hasSpamPattern) {
    score -= 30;
    reasons.push('Phát hiện ký tự URL hoặc từ khóa rác: -30đ');
  } else if (isTrulyAlphaNumeric && isUpperFormat) {
    score += 25;
    reasons.push('Mã chuẩn alphanumeric in hoa (có cả chữ và số hoặc tiền tố giftcode): +25đ');
  } else if (!hasDigit && !hasLegitPrefix) {
    score -= 25;
    reasons.push('Mã thuần chữ cái không có số và không có tiền tố giftcode: -25đ');
  } else if (isUpperFormat) {
    score += 12;
    reasons.push('Định dạng mã cơ bản: +12đ');
  } else if (isMixedCase) {
    score += 8;
    reasons.push('Mã có lẫn ký tự thường: +8đ');
  } else {
    reasons.push('Độ dài mã bất thường (<4 hoặc >32 ký tự): +0đ');
  }

  // ==========================================
  // TIÊU CHÍ 3: ĐỘ UY TÍN NGUỒN CÀO (Tối đa 20 điểm)
  // ==========================================
  switch (sourceType) {
    case 'official_fb':
    case 'official_site':
      score += 20;
      reasons.push('Nguồn Fanpage / Trang chủ NPH chính thức: +20đ');
      break;
    case 'reputable_web': // Sforum, GameK, TheGioiDiDong, CodeMoi, GamerPower
      score += 18;
      reasons.push('Nguồn chuyên trang tin tức game uy tín: +18đ');
      break;
    case 'community_discord':
      score += 14;
      reasons.push('Nguồn máy chủ Discord cộng đồng: +14đ');
      break;
    case 'forum':
    default:
      score += 8;
      reasons.push('Nguồn mạng xã hội / diễn đàn tự do: +8đ');
      break;
  }

  // ==========================================
  // TIÊU CHÍ 4: THÔNG TIN KÈM THEO (Tối đa 15 điểm)
  // ==========================================
  const hasRewards = rewards && rewards.trim().length > 3 && !rewards.includes('Chưa rõ');
  const hasExpiry = expiresAt && String(expiresAt).length >= 8;

  if (hasRewards && hasExpiry) {
    score += 15;
    reasons.push('Có đầy đủ mô tả phần thưởng và hạn sử dụng: +15đ');
  } else if (hasRewards) {
    score += 10;
    reasons.push('Có thông tin phần thưởng: +10đ');
  } else if (hasExpiry) {
    score += 8;
    reasons.push('Có thông tin hạn dùng: +8đ');
  } else {
    if (/tân thủ|quà tặng|tri ân|mừng|livestream|update|sự kiện/i.test(contextText)) {
      score += 5;
      reasons.push('Ngữ cảnh bài viết chứa từ khóa sự kiện NPH: +5đ');
    }
  }

  // Khóa trần điểm đối với mã thuần chữ cái không có số: tối đa 55 điểm (Bậc 3)
  let finalScore = Math.max(0, Math.min(100, Math.round(score)));
  if (!hasDigit && !hasLegitPrefix) {
    finalScore = Math.min(55, finalScore);
  }

  // ==========================================
  // PHÂN CẤP BẬC CHUẨN XÁC
  // ==========================================
  let tier = 4;
  let tierLabel = 'Bậc 4: Rủi ro / Điểm thấp (<50đ)';
  let canAutoPublish = false;

  // BẬC 1: Chỉ dành cho mã đạt >= 90 điểm VÀ là AlphaNumeric (có số hoặc tiền tố giftcode)
  if (finalScore >= 90 && isTrulyAlphaNumeric) {
    tier = 1;
    tierLabel = 'Bậc 1: Xuất sắc (90-100đ)';
    canAutoPublish = true;
  } else if (finalScore >= 70 && isTrulyAlphaNumeric) {
    tier = 2;
    tierLabel = 'Bậc 2: Tiềm năng cao (70-89đ)';
    canAutoPublish = false;
  } else if (finalScore >= 50) {
    tier = 3;
    tierLabel = 'Bậc 3: Cần kiểm tra (50-69đ)';
    canAutoPublish = false;
  } else {
    tier = 4;
    tierLabel = 'Bậc 4: Không đạt (<50đ)';
    canAutoPublish = false;
  }

  return {
    score: finalScore,
    tier,
    tierLabel,
    canAutoPublish,
    reasons,
  };
}

module.exports = {
  calculateCodeScore,
};
