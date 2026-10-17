/**
 * Centralized Giftcode Validation & Anti-Junk Filter Engine
 * 
 * Bộ lọc mã giftcode đa tầng chuẩn mực cho toàn hệ thống:
 * 1. Blacklist từ cấm, từ vựng tiếng Anh/Việt thông dụng, nhãn UI, tiêu đề cột.
 * 2. Tên Nhà Phát Hành, nền tảng, thể loại game bị bóc tách nhầm.
 * 3. Kiểm tra cấu trúc hình thái học: độ dài, chữ số, tiền tố quà tặng hợp lệ.
 * 4. Loại trừ tuyệt đối mã không có tựa game gắn liền (unknown-game).
 */

// 1. TẬP HỢP TỪ CẤM & TỪ VỰNG THÔNG DỤNG (STOP WORDS / JUNK WORDS)
const JUNK_WORDS_SET = new Set([
  // UI Actions & Prepositions (English)
  'TYPE', 'BELOW', 'OFFERS', 'OFFER', 'FROM', 'WITH', 'WITHIN', 'WILL', 'MIGHT', 'WORKS', 'WORKING', 'WORK',
  'DROPS', 'DROP', 'THAT', 'BEFORE', 'AFTER', 'ADDED', 'OPTION', 'OPTIONS', 'HERE', 'THERE', 'WHERE', 'WHEN',
  'WHAT', 'WHICH', 'SOME', 'MANY', 'MORE', 'LESS', 'CLICK', 'PRESS', 'ENTER', 'SUBMIT', 'CHECK', 'FOLLOW',
  'SHARE', 'SUBSCRIBE', 'JOIN', 'DISCORD', 'SERVER', 'CHANNEL', 'ADMIN', 'MODERATOR', 'PLAYER', 'PLAYERS',
  'ONLINE', 'OFFLINE', 'STATUS', 'VERSION', 'UPDATE', 'UPDATED', 'PATCH', 'NOTES', 'GUIDE', 'GUIDES', 'TRICKS',
  'TIPS', 'LIST', 'CODES', 'CODE', 'EXPIRED', 'ACTIVE', 'INACTIVE', 'VALID', 'INVALID', 'REDEEM', 'REDEEMED',
  'REWARDS', 'REWARD', 'FREE', 'ITEM', 'ITEMS', 'GIFT', 'GIFTS', 'GIFTCODE', 'GIFTCODES', 'PROMO', 'PROMOCODE',
  'PROMOCODES', 'EVENT', 'EVENTS', 'NEWS', 'ARTICLE', 'POST', 'POSTS', 'PAGE', 'PAGES', 'HOME', 'ABOUT',
  'CONTACT', 'TERMS', 'PRIVACY', 'POLICY', 'LOGIN', 'LOGOUT', 'SIGNUP', 'REGISTER', 'ACCOUNT', 'PASSWORD',
  'EMAIL', 'DEVICE', 'ANDROID', 'IPHONE', 'IPAD', 'MOBILE', 'TABLET', 'DESKTOP', 'BROWSER', 'WEBSITE', 'STORE',
  'SHOP', 'BUY', 'SELL', 'PRICE', 'COST', 'MONEY', 'CASH', 'COIN', 'COINS', 'GEM', 'GEMS', 'TOKEN', 'TOKENS',
  'POINT', 'POINTS', 'LEVEL', 'STAGE', 'WORLD', 'ZONE', 'QUEST', 'MISSION', 'HERO', 'HEROES', 'CHAMPION',
  'BOSS', 'RAID', 'BATTLE', 'ARENA', 'PVP', 'PVE', 'GAME', 'GAMES', 'GAMING', 'GAMER', 'GAMERS', 'ROBUX',
  'OBBY', 'ZOMBIE', 'ZOMBIES', 'DIGIT', 'NUMBER', 'CHARS', 'CHARACTER', 'LETTER', 'CASE', 'UPPER', 'LOWER',
  'TEXT', 'STRING', 'VALUE', 'INPUT', 'OUTPUT', 'ERROR', 'SUCCESS', 'WARNING', 'INFO', 'IN-GAME', 'INGAME',
  'ABOUT', 'COUPON', 'CLAIM', 'CLAIMED', 'VERIFIED', 'METHOD', 'STEPS', 'HOWTO', 'TITLE', 'TABLE', 'HEADER',
  'FOOTER', 'BANNER', 'IMAGE', 'COVER', 'THUMB', 'VIDEO', 'WATCH', 'STREAM', 'TOTAL', 'COUNT', 'SEARCH',
  'MONTH', 'YEAR', 'DAILY', 'WEEKLY', 'MONTHLY', 'NEWEST', 'LATEST', 'OLDEST', 'RANDOM', 'DEFAULT',

  // UI Actions & Common Words (Vietnamese)
  'THEO', 'NGAY', 'TRONG', 'NGOAI', 'TREN', 'DUOI', 'TRUOC', 'SAU', 'GIUA', 'DANG', 'CHON', 'NHAP', 'XUAT',
  'NHAN', 'TANG', 'THUONG', 'PHAN', 'QUA', 'GIFTCODE', 'CODE', 'GAME', 'CHOI', 'TAI', 'CAI', 'DAT', 'HUONG',
  'DAN', 'CHI', 'TIET', 'TIN', 'TUC', 'SU', 'KIEN', 'CAP', 'NHAT', 'MOI', 'CU', 'HET', 'HAN', 'CON',
  'DUNG', 'DUOC', 'KHONG', 'THOI', 'GIAN', 'DANH', 'SACH', 'KHO', 'MA', 'SO', 'TRANG', 'CHU', 'CONG',
  'DONG', 'NHOM', 'HOI', 'QUAN', 'TRI', 'VIEN', 'TAI', 'KHOAN', 'MAT', 'KHAU', 'NAP', 'THE', 'GIA',
  'TIEN', 'XU', 'VANG', 'KIM', 'CUONG', 'BAN', 'BE', 'CHIA', 'SE', 'BINH', 'LUAN', 'THICH', 'DOI',
  'HOAC', 'CUNG', 'NHUNG', 'CAC', 'MOT', 'HAI', 'BA', 'BON', 'NAM', 'SAU', 'BAY', 'TAM', 'CHIN', 'MUOI',
  'DOC', 'XEM', 'GUI', 'LICK', 'LIEN', 'KET', 'DUONG', 'DAN', 'TRUC', 'TUYEN', 'MAY', 'CHU', 'PHIEN', 'BAN',
  'PHAT', 'TRI', 'AN', 'MUNG', 'TONG', 'HOP', 'CHUAN', 'NGAY', 'THANG', 'GIO', 'PHUT', 'GIAY',

  // Publishers, Studios, Platforms & Misidentified Game Titles
  'GAMOTA', 'GARENA', 'VNG', 'VNGGAMES', 'SOHAGAME', 'SOHA', 'FUNTAP', 'GOSU', 'VTCMOBILE', 'VTCGAME',
  'VTC', 'DZOGAME', 'APPOTA', 'ACEGAME', 'VGP', 'KPLAY', 'VPLAY', 'DIGIGAMES', 'GZONE', 'JOYGAMES',
  'CAPCOM', 'TIMI', 'EFUN', 'ALOGAME', 'VELAGAME', 'VELA', 'MOCGAME', 'REDFOX', 'HABBY', 'ZINGPLAY',
  'MIHOYO', 'HOYOVERSE', 'COGNOSPHERE', 'KURO', 'KUROGAMES', 'FACEBOOK', 'GOOGLE', 'YOUTUBE', 'TIKTOK',
  'TELEGRAM', 'DISCORD', 'ZALO', 'CHPLAY', 'APPSTORE', 'STEAM', 'EPIC', 'ROBLOX', 'MINECRAFT', 'GENSHIN',
  'HONKAI', 'DISLYTE', 'WUTHERING', 'NINJA', 'MONSTER', 'POKEMON', 'NARUTO', 'ONEPIECE', 'DRAGONBALL'
]);

// Tiền tố giftcode chuẩn được công nhận
const VALID_CODE_PREFIXES = /^(VIP|SVIP|CODE|GIFT|TANTHU|TRIAN|FREE|NEW|HOT|PROMO|KAME|HAPPY|WELCOME|DISCORD|FB|LUCKY|REWARD)/i;

/**
 * Kiểm tra xem một chuỗi mã code ứng viên có phải là mã quà tặng hợp lệ không
 * @param {string} rawCode - Chuỗi mã thô
 * @param {Object} options - Tùy chọn kiểm tra kèm tựa game
 * @returns {boolean} - true nếu là mã hợp lệ, false nếu là mã rác
 */
function isValidGiftCode(rawCode, options = {}) {
  if (!rawCode || typeof rawCode !== 'string') return false;

  const clean = String(rawCode).trim().toUpperCase().replace(/^[^A-Z0-9_-]+|[^A-Z0-9_-]+$/g, '');

  // 1. Kiểm tra độ dài cơ bản (4 - 28 ký tự)
  if (clean.length < 4 || clean.length > 28) return false;

  // 2. Ký tự hợp lệ (chỉ gồm chữ in hoa, số, dấu gạch ngang hoặc gạch dưới)
  if (!/^[A-Z0-9_-]+$/.test(clean)) return false;

  // 3. Không nằm trong Blacklist / Stop words
  if (JUNK_WORDS_SET.has(clean)) return false;

  // 4. Loại trừ chuỗi số nguyên thuần túy (như ngày tháng 0401, timestamp, số ID bài viết)
  if (/^\d+$/.test(clean)) {
    // Chỉ chấp nhận nếu có ít nhất 6 chữ số và là chuỗi số có quy luật (nhưng hầu hết code game đều có chữ cái)
    return false;
  }

  // 5. Loại trừ chuỗi lặp ký tự đơn điệu (như AAAAA, 11111, -----)
  if (/^(.)\1{3,}$/.test(clean)) return false;

  // 6. Kiểm tra quy tắc mã thuần chữ cái (Không có chữ số nào):
  const isAllLetters = !/\d/.test(clean);
  if (isAllLetters) {
    // Có tiền tố quà tặng chuẩn không? (VIP, SVIP, GIFT, CODE, TANTHU...)
    const hasPrefix = VALID_CODE_PREFIXES.test(clean);

    // Nếu độ dài <= 4 ký tự (như GAME, NGAY, TYPE, WITH, FROM):
    // BẮT BUỘC phải có tiền tố quà tặng (như VIP, GIFT)
    if (clean.length <= 4 && !hasPrefix) {
      return false;
    }

    // Nếu độ dài 5 - 8 ký tự nhưng không có tiền tố code và không chứa gạch nối:
    // Cần kiểm tra xem có phải là từ vựng bình thường không
    if (clean.length <= 8 && !hasPrefix && !clean.includes('-') && !clean.includes('_')) {
      // Nếu là từ chỉ gồm 1 nguyên âm đơn điệu hoặc dạng từ ghép thông thường
      if (JUNK_WORDS_SET.has(clean)) return false;
    }
  }

  // 7. Loại trừ nếu mã trùng với slug hoặc các từ trong tên game đang xét
  const gameSlug = (options.gameSlug || '').toUpperCase();
  if (gameSlug) {
    if (clean === gameSlug || clean === gameSlug.replace(/-/g, '')) return false;
    const slugParts = gameSlug.split('-');
    if (slugParts.some(p => p.length >= 3 && clean === p)) return false;
  }

  const gameName = (options.gameName || '').toUpperCase();
  if (gameName) {
    const nameParts = gameName.replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(p => p.length >= 3);
    if (nameParts.some(p => clean === p)) return false;
  }

  return true;
}

module.exports = {
  JUNK_WORDS_SET,
  VALID_CODE_PREFIXES,
  isValidGiftCode,
};
