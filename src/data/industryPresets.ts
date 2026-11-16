import type { IndustryPreset, ProductCategoriesConfig, ProductCategoryItem } from '../types/game';

export const INDUSTRY_PRESETS: Record<string, IndustryPreset> = {
  gaming: {
    id: 'gaming',
    name: 'Game & Tiện Ích Số',
    icon: '🎮',
    badge: 'Mặc định',
    defaultShopName: 'CodeGame.Shop',
    defaultSlogan: 'Kho Mã Giftcode & Tiện Ích Game Số 1 Việt Nam',
    defaultHotline: '0987.654.321',
    defaultCurrency: 'VND',
    defaultAccent: 'orange',
    footerCategoryTitle: 'Chuyên Mục Game Hot',
    headerCategoryTitle: 'Tất Cả Danh Mục Game',
    searchSuggestions: [
      'Thẻ Garena',
      'Hiệp Khách Hành',
      'Liên Quân 0đ',
      'Roblox Blox Fruits',
      'Free Fire Kim Cương',
    ],
    categories: [
      { id: 'all', label: 'Tất Cả Game', icon: '🎮', description: 'Toàn bộ tựa game & giftcode', isSystem: true },
      { id: 'kiem-hiep-tien-hiep', label: 'Kiếm Hiệp & Tiên Hiệp', icon: '⚔️', description: 'Võ lâm, kiếm hiệp, tu tiên', matchKeywords: ['kiếm hiệp', 'tiên hiệp', 'võ hiệp', 'tu tiên'] },
      { id: 'nhap-vai-gacha-anime', label: 'Nhập Vai Gacha & Anime', icon: '✨', description: 'Anime, gacha, waifu, jRPG', matchKeywords: ['anime', 'gacha', 'waifu', 'genshin', 'honkai'] },
      { id: 'ban-sung-sinh-ton', label: 'Bắn Súng & Sinh Tồn', icon: '🎯', description: 'FPS, Battle Royale, sinh tồn', matchKeywords: ['bắn súng', 'sinh tồn', 'battle royale', 'fps', 'free fire', 'pubg'] },
      { id: 'tam-quoc-chien-thuat', label: 'Tam Quốc & Chiến Thuật', icon: '🏰', description: 'SLG, thẻ tướng, chiến lược', matchKeywords: ['tam quốc', 'chiến thuật', 'chiến lược', 'slg', 'đế chế', 'thẻ tướng'] },
      { id: 'roblox-mini-game', label: 'Roblox & Mini Game', icon: '🕹️', description: 'Blox Fruits, mini games', matchKeywords: ['roblox', 'mini game', 'blox fruit'] },
      { id: 'nhap-vai-morpg', label: 'Nhập Vai & MMORPG', icon: '🛡️', description: 'Thế giới mở, MMORPG', matchKeywords: ['mmorpg', 'nhập vai', 'arpg', 'thế giới mở'] },
    ],
  },

  fashion: {
    id: 'fashion',
    name: 'Thời Trang & Phụ Kiện',
    icon: '👕',
    badge: 'Hot Trend',
    defaultShopName: 'Shopee Fashion Mall',
    defaultSlogan: 'Thời Trang Thiết Kế Xu Hướng • Đổi Trả 7 Ngày • Miễn Phí Vận Chuyển',
    defaultHotline: '0988.888.999',
    defaultCurrency: 'VND',
    defaultAccent: 'red',
    footerCategoryTitle: 'Chuyên Mục Thời Trang Hot',
    headerCategoryTitle: 'Danh Mục Thời Trang & Phụ Kiện',
    searchSuggestions: [
      'Áo polo nam',
      'Quần ống rộng nữ',
      'Váy hoa vintage',
      'Sneaker cổ thấp',
      'Túi đeo chéo da',
    ],
    categories: [
      { id: 'all', label: 'Tất Cả Thời Trang', icon: '🛍️', description: 'Toàn bộ mặt hàng thời trang hot', isSystem: true },
      { id: 'ao-nam-nu', label: 'Áo Nam & Nữ', icon: '👕', description: 'Áo thun, áo polo, sơ mi, áo khoác', matchKeywords: ['áo', 'thun', 'polo', 'sơ mi', 'khoác', 'jacket', 'tee'] },
      { id: 'quan-jeans-kaki', label: 'Quần Jeans & Kaki', icon: '👖', description: 'Quần bò, jogger, quần tây công sở', matchKeywords: ['quần', 'jean', 'jeans', 'kaki', 'jogger', 'tây', 'short'] },
      { id: 'vay-dam-set-do', label: 'Váy Đầm & Set Đồ', icon: '👗', description: 'Đầm dự tiệc, set đồ dạo phố', matchKeywords: ['váy', 'đầm', 'set', 'yếm', 'maxi'] },
      { id: 'giay-dep-sneaker', label: 'Giày Dép & Sneaker', icon: '👟', description: 'Giày thể thao, sandal, giày tây', matchKeywords: ['giày', 'sneaker', 'dép', 'sandal', 'guốc', 'boot'] },
      { id: 'tui-xach-balo', label: 'Túi Xách & Balo', icon: '🎒', description: 'Túi đeo chéo, balo laptop, ví cầm tay', matchKeywords: ['túi', 'balo', 'ví', 'cặp', 'clutch'] },
      { id: 'dong-ho-phu-kien', label: 'Đồng Hồ & Phụ Kiện', icon: '⌚', description: 'Kính mắt, thắt lưng, mũ nón, trang sức', matchKeywords: ['đồng hồ', 'kính', 'nón', 'mũ', 'thắt lưng', 'nhẫn', 'vòng'] },
    ],
  },

  beauty: {
    id: 'beauty',
    name: 'Mỹ Phẩm & Sắc Đẹp',
    icon: '💄',
    badge: 'Chính Hãng',
    defaultShopName: 'Beauty Care Official',
    defaultSlogan: 'Mỹ Phẩm Chính Hãng 100% • Tươi Trẻ Mỗi Ngày • Tư Vấn Chuyên Sâu',
    defaultHotline: '0977.123.456',
    defaultCurrency: 'VND',
    defaultAccent: 'green',
    footerCategoryTitle: 'Chuyên Mục Mỹ Phẩm Hot',
    headerCategoryTitle: 'Danh Mục Mỹ Phẩm & Làm Đẹp',
    searchSuggestions: [
      'Kem chống nắng nâng tone',
      'Serum B5 phục hồi',
      'Son kem lì velvet',
      'Nước hoa mini 10ml',
      'Tẩy trang dịu nhẹ',
    ],
    categories: [
      { id: 'all', label: 'Tất Cả Mỹ Phẩm', icon: '✨', description: 'Sản phẩm chăm sóc sắc đẹp toàn diện', isSystem: true },
      { id: 'cham-soc-da-mat', label: 'Chăm Sóc Da Mặt', icon: '🧴', description: 'Serum, toner, kem dưỡng ẩm, trị mụn', matchKeywords: ['da mặt', 'serum', 'toner', 'kem dưỡng', 'trị mụn', 'chống nắng'] },
      { id: 'son-moi-trang-diem', label: 'Son Môi & Make-up', icon: '💄', description: 'Son thỏi, phấn nền, mascara, chì kẻ', matchKeywords: ['son', 'phấn', 'mascara', 'trang điểm', 'makeup', 'chì kẻ'] },
      { id: 'nuoc-hoa-cao-cap', label: 'Nước Hoa Cao Cấp', icon: '🌸', description: 'Nước hoa nam nữ, tinh dầu thơm', matchKeywords: ['nước hoa', 'perfume', 'tinh dầu'] },
      { id: 'cham-soc-toc-body', label: 'Tóc & Toàn Thân', icon: '🛁', description: 'Dầu gội thảo mộc, sữa tắm, dưỡng thể', matchKeywords: ['tóc', 'dầu gội', 'sữa tắm', 'body', 'dưỡng thể'] },
      { id: 'thuc-pham-chuc-nang', label: 'Thực Phẩm Bổ Sung', icon: '💊', description: 'Collagen, vitamin E/C, viên uống sáng da', matchKeywords: ['thực phẩm', 'collagen', 'vitamin', 'viên uống'] },
      { id: 'dung-cu-lam-dep', label: 'Dụng Cụ Làm Đẹp', icon: '🪞', description: 'Máy rửa mặt, cọ trang điểm, bông tẩy trang', matchKeywords: ['máy rửa mặt', 'cọ', 'bông', 'dụng cụ'] },
    ],
  },

  tech: {
    id: 'tech',
    name: 'Thiết Bị Số & Công Nghệ',
    icon: '📱',
    badge: 'Bảo Hành 1-1',
    defaultShopName: 'TechMart Digital Mall',
    defaultSlogan: 'Đồ Công Nghệ Chính Hãng • Bảo Hành 1 Đổi 1 • Giao Hỏa Tốc 2H',
    defaultHotline: '0966.999.888',
    defaultCurrency: 'VND',
    defaultAccent: 'blue',
    footerCategoryTitle: 'Danh Mục Thiết Bị Công Nghệ',
    headerCategoryTitle: 'Danh Mục Thiết Bị Số & Công Nghệ',
    searchSuggestions: [
      'Củ sạc nhanh 65W GaN',
      'Tai nghe chống ồn ANC',
      'Bàn phím cơ không dây',
      'Chuột công thái học',
      'Camera an ninh Wifi',
    ],
    categories: [
      { id: 'all', label: 'Tất Cả Thiết Bị', icon: '⚡', description: 'Công nghệ & phụ kiện cao cấp', isSystem: true },
      { id: 'dien-thoai-tablet', label: 'Điện Thoại & Tablet', icon: '📱', description: 'Smartphone, máy tính bảng, máy đọc sách', matchKeywords: ['điện thoại', 'iphone', 'samsung', 'tablet', 'ipad', 'máy đọc sách'] },
      { id: 'phu-kien-cap-sac', label: 'Cáp Sạc & Pin Dự Phòng', icon: '🔋', description: 'Sạc nhanh GaN, cáp Type-C, sạc MagSafe', matchKeywords: ['sạc', 'cáp', 'pin', 'dự phòng', 'gan', 'type-c', 'magsafe'] },
      { id: 'tai-nghe-loa-bluetooth', label: 'Tai Nghe & Loa Bluetooth', icon: '🎧', description: 'Tai nghe TWS, chụp tai chống ồn, loa di động', matchKeywords: ['tai nghe', 'loa', 'bluetooth', 'tws', 'headphone', 'soundbar'] },
      { id: 'ban-phim-chuot', label: 'Bàn Phím & Chuột Gaming', icon: '⌨️', description: 'Phím cơ custom, chuột bluetooth silent', matchKeywords: ['bàn phím', 'chuột', 'keyboard', 'mouse', 'gaming'] },
      { id: 'thiet-bi-smarthome', label: 'Nhà Thông Minh SmartHome', icon: '🏠', description: 'Camera Wifi, đèn LED thông minh, ổ cắm điều khiển', matchKeywords: ['smarthome', 'camera', 'wifi', 'đèn', 'ổ cắm', 'thông minh'] },
      { id: 'phu-kien-laptop-pc', label: 'Phụ Kiện Laptop & PC', icon: '💻', description: 'Hub chuyển đổi, giá đỡ nhôm, balo chống sốc', matchKeywords: ['laptop', 'hub', 'giá đỡ', 'balo', 'tản nhiệt', 'pc'] },
    ],
  },

  services: {
    id: 'services',
    name: 'Khóa Học & Dịch Vụ Số',
    icon: '📚',
    badge: 'Kích Hoạt Tự Động',
    defaultShopName: 'EduCode Academy & Tools',
    defaultSlogan: 'Nâng Tầm Kỹ Năng • Bản Quyền Phần Mềm Chính Hãng • Hỗ Trợ 24/7',
    defaultHotline: '0981.234.567',
    defaultCurrency: 'VND',
    defaultAccent: 'purple',
    footerCategoryTitle: 'Danh Mục Dịch Vụ & Khóa Học',
    headerCategoryTitle: 'Danh Mục Khóa Học & Dịch Vụ Số',
    searchSuggestions: [
      'Khóa học AI Automation',
      'Tài khoản Canva Pro vĩnh viễn',
      'Phần mềm kế toán',
      'Gói thiết kế Logo',
      'Bản quyền Office 365',
    ],
    categories: [
      { id: 'all', label: 'Tất Cả Dịch Vụ', icon: '💡', description: 'Khóa học, tài khoản & công cụ số', isSystem: true },
      { id: 'khoa-hoc-online', label: 'Khóa Học Trực Tuyến', icon: '🎓', description: 'Lập trình, Marketing, Ngoại ngữ, Kỹ năng số', matchKeywords: ['khóa học', 'course', 'video', 'học', 'đào tạo', 'online'] },
      { id: 'tai-khoan-ban-quyen', label: 'Tài Khoản & Phần Mềm VIP', icon: '🔑', description: 'Canva Pro, Office 365, Chatbot AI, VPN', matchKeywords: ['tài khoản', 'canva', 'office', 'chatgpt', 'netflix', 'vip', 'key', 'bản quyền'] },
      { id: 'dich-vu-thiet-ke', label: 'Thiết Kế & Media', icon: '🎨', description: 'Thiết kế logo, banner, dựng video clip', matchKeywords: ['thiết kế', 'design', 'logo', 'banner', 'video'] },
      { id: 'cong-cu-marketing-seo', label: 'Công Cụ Marketing & SEO', icon: '📈', description: 'Phần mềm gửi email, tool quét data, hosting', matchKeywords: ['tool', 'marketing', 'seo', 'email', 'quét', 'traffic'] },
      { id: 'tai-lieu-ebook', label: 'Ebook & Biểu Mẫu', icon: '📖', description: 'Mẫu hợp đồng kinh doanh, slide thuyết trình, tài liệu chuyên sâu', matchKeywords: ['ebook', 'tài liệu', 'biểu mẫu', 'template', 'slide'] },
      { id: 'lap-trinh-source-code', label: 'Mã Nguồn & Website Mẫu', icon: '💻', description: 'Source code web, template Landing Page, theme', matchKeywords: ['source code', 'mã nguồn', 'web', 'landing page', 'theme'] },
    ],
  },
};

export const INDUSTRY_PRESETS_LIST: IndustryPreset[] = Object.values(INDUSTRY_PRESETS);

export function getIndustryPreset(presetId: string): IndustryPreset {
  return INDUSTRY_PRESETS[presetId] || INDUSTRY_PRESETS.gaming;
}

export function getDefaultCategoriesConfig(presetId: string = 'gaming'): ProductCategoriesConfig {
  const p = getIndustryPreset(presetId);
  return {
    activePresetId: p.id,
    categories: [...p.categories],
    searchSuggestions: [...p.searchSuggestions],
    footerCategoryTitle: p.footerCategoryTitle,
    headerCategoryTitle: p.headerCategoryTitle,
  };
}
