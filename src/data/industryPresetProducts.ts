import type { StoreProduct } from '../types/game';

/**
 * Danh sách sản phẩm mẫu đa ngành chuẩn E-Commerce
 * Hỗ trợ 5 ngành hàng chính:
 * 1. fashion (Thời Trang & Phụ Kiện)
 * 2. beauty (Mỹ Phẩm & Sắc Đẹp)
 * 3. tech (Thiết Bị Số & Công Nghệ)
 * 4. services (Khóa Học & Dịch Vụ Số)
 * 5. gaming (Game & Tiện Ích Số)
 */

export const INDUSTRY_PRESET_PRODUCTS: Record<string, StoreProduct[]> = {
  // 1. THỜI TRANG & PHỤ KIỆN
  fashion: [
    {
      id: 'fash_polo_classic_01',
      sku: 'FS-POLO-01',
      title: 'Áo Polo Nam Classic Pique Cotton Co Giãn 4 Chiều Cao Cấp',
      game_slug: 'thoi-trang-nam',
      game_name: 'POLO MAN',
      brand: 'POLO MAN Official',
      origin: 'Việt Nam (Chính Hãng)',
      product_type: 'physical',
      industry: 'fashion',
      category: 'thoi-trang-nam',
      category_label: 'Thời Trang Nam',
      badge: 'BÁN CHẠY #1',
      cover_image_url: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=600&q=80',
      product_images: [
        'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1625910513413-5b8719bcfe96?auto=format&fit=crop&w=600&q=80'
      ],
      description: 'Chất vải Pique Cotton cao cấp mềm mại, thấm hút mồ hôi tối đa, không xù lông sau nhiều lần giặt. Form regular tôn dáng nam tính, phù hợp đi làm lẫn đi chơi.',
      original_price: 299000,
      discount_percent: 37,
      current_price: 189000,
      stock_quantity: 180,
      sold_count: 1420,
      virtual_sold_count: 1850,
      is_active: true,
      shipping_fee: 0,
      warranty_period: 'Đổi trả miễn phí 15 ngày tận nhà',
      package_type: 'pack',
      attributes: [
        { id: 'color', name: 'Màu Sắc', values: ['Đen Huyền Bí', 'Trắng Tinh Khôi', 'Xanh Navy'] },
        { id: 'size', name: 'Kích Cỡ', values: ['M (50-62kg)', 'L (63-72kg)', 'XL (73-82kg)'] }
      ],
      variants: [
        { id: 'fash_p1_blk_m', name: 'Đen Huyền Bí / M', sku: 'POLO-BLK-M', attributes: { 'Màu Sắc': 'Đen Huyền Bí', 'Kích Cỡ': 'M (50-62kg)' }, price: 189000, original_price: 299000, stock_quantity: 35 },
        { id: 'fash_p1_blk_l', name: 'Đen Huyền Bí / L', sku: 'POLO-BLK-L', attributes: { 'Màu Sắc': 'Đen Huyền Bí', 'Kích Cỡ': 'L (63-72kg)' }, price: 189000, original_price: 299000, stock_quantity: 40 },
        { id: 'fash_p1_blk_xl', name: 'Đen Huyền Bí / XL', sku: 'POLO-BLK-XL', attributes: { 'Màu Sắc': 'Đen Huyền Bí', 'Kích Cỡ': 'XL (73-82kg)' }, price: 189000, original_price: 299000, stock_quantity: 25 },
        { id: 'fash_p1_wht_m', name: 'Trắng Tinh Khôi / M', sku: 'POLO-WHT-M', attributes: { 'Màu Sắc': 'Trắng Tinh Khôi', 'Kích Cỡ': 'M (50-62kg)' }, price: 189000, original_price: 299000, stock_quantity: 30 },
        { id: 'fash_p1_wht_l', name: 'Trắng Tinh Khôi / L', sku: 'POLO-WHT-L', attributes: { 'Màu Sắc': 'Trắng Tinh Khôi', 'Kích Cỡ': 'L (63-72kg)' }, price: 189000, original_price: 299000, stock_quantity: 30 },
        { id: 'fash_p1_nav_l', name: 'Xanh Navy / L', sku: 'POLO-NAV-L', attributes: { 'Màu Sắc': 'Xanh Navy', 'Kích Cỡ': 'L (63-72kg)' }, price: 189000, original_price: 299000, stock_quantity: 20 }
      ]
    },
    {
      id: 'fash_jean_wide_02',
      sku: 'FS-JEAN-02',
      title: 'Quần Jean Nữ Ống Rộng Cạp Cao Vintage Hack Dáng Cực Đẹp',
      game_slug: 'thoi-trang-nu',
      game_name: 'CHIC STYLE',
      brand: 'Chic Studio',
      origin: 'Quảng Châu Cao Cấp',
      product_type: 'physical',
      industry: 'fashion',
      category: 'thoi-trang-nu',
      category_label: 'Thời Trang Nữ',
      badge: 'TRENDING 2026',
      cover_image_url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80',
      product_images: ['https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80'],
      description: 'Chất liệu bò jean dày dặn đứng form, khóa kéo đồng mạ bền bỉ. Thiết kế cạp cao ôm eo giúp chân dài thon gọn, dễ mix áo croptop hoặc sơ mi.',
      original_price: 380000,
      discount_percent: 30,
      current_price: 265000,
      stock_quantity: 110,
      sold_count: 890,
      virtual_sold_count: 1120,
      is_active: true,
      shipping_fee: 15000,
      warranty_period: 'Đổi size trong vòng 7 ngày',
      package_type: 'pack',
      attributes: [
        { id: 'color', name: 'Màu Sắc', values: ['Xanh Khói Retro', 'Xanh Nhạt Vintage'] },
        { id: 'size', name: 'Kích Cỡ', values: ['S (<47kg)', 'M (48-53kg)', 'L (54-60kg)'] }
      ],
      variants: [
        { id: 'fash_j2_smk_s', name: 'Xanh Khói Retro / S', sku: 'JEAN-SMK-S', attributes: { 'Màu Sắc': 'Xanh Khói Retro', 'Kích Cỡ': 'S (<47kg)' }, price: 265000, original_price: 380000, stock_quantity: 30 },
        { id: 'fash_j2_smk_m', name: 'Xanh Khói Retro / M', sku: 'JEAN-SMK-M', attributes: { 'Màu Sắc': 'Xanh Khói Retro', 'Kích Cỡ': 'M (48-53kg)' }, price: 265000, original_price: 380000, stock_quantity: 35 },
        { id: 'fash_j2_nht_m', name: 'Xanh Nhạt Vintage / M', sku: 'JEAN-NHT-M', attributes: { 'Màu Sắc': 'Xanh Nhạt Vintage', 'Kích Cỡ': 'M (48-53kg)' }, price: 265000, original_price: 380000, stock_quantity: 45 }
      ]
    },
    {
      id: 'fash_sneaker_chunky_03',
      sku: 'FS-SHOE-03',
      title: 'Giày Sneaker Thể Thao Độn Đế 5cm Thoáng Khí Êm Chân Unisex',
      game_slug: 'giay-sneaker-boots',
      game_name: 'URBAN FOOTWEAR',
      brand: 'Urban Footwear',
      origin: 'Chính Hãng',
      product_type: 'physical',
      industry: 'fashion',
      category: 'giay-sneaker-boots',
      category_label: 'Giày Sneaker & Boots',
      badge: 'HOT DEAL',
      cover_image_url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80',
      product_images: ['https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80'],
      description: 'Đế cao su non nguyên khối đàn hồi cực tốt, lót đệm bọt khí êm ái chống đau gót. Thiết kế độn đế 5cm hack chiều cao tinh tế.',
      original_price: 520000,
      discount_percent: 33,
      current_price: 349000,
      stock_quantity: 85,
      sold_count: 670,
      virtual_sold_count: 940,
      is_active: true,
      shipping_fee: 0,
      warranty_period: 'Bảo hành keo chỉ 6 tháng',
      package_type: 'pack',
      attributes: [
        { id: 'color', name: 'Màu Sắc', values: ['Trắng Full Clean', 'Đen Xám Thể Thao'] },
        { id: 'size', name: 'Kích Cỡ', values: ['39', '40', '41', '42', '43'] }
      ],
      variants: [
        { id: 'fash_s3_wht_40', name: 'Trắng Full Clean / 40', sku: 'SNK-WHT-40', attributes: { 'Màu Sắc': 'Trắng Full Clean', 'Kích Cỡ': '40' }, price: 349000, original_price: 520000, stock_quantity: 20 },
        { id: 'fash_s3_wht_41', name: 'Trắng Full Clean / 41', sku: 'SNK-WHT-41', attributes: { 'Màu Sắc': 'Trắng Full Clean', 'Kích Cỡ': '41' }, price: 349000, original_price: 520000, stock_quantity: 25 },
        { id: 'fash_s3_blk_42', name: 'Đen Xám Thể Thao / 42', sku: 'SNK-BLK-42', attributes: { 'Màu Sắc': 'Đen Xám Thể Thao', 'Kích Cỡ': '42' }, price: 349000, original_price: 520000, stock_quantity: 20 }
      ]
    },
    {
      id: 'fash_bag_crossbody_04',
      sku: 'FS-BAG-04',
      title: 'Túi Đeo Chéo Nữ Da PU Vân Nổi Khóa Kim Loại Mạ Vàng Sang Trọng',
      game_slug: 'tui-xach-vi-da',
      game_name: 'LADY BAGS',
      brand: 'Lady Bags',
      origin: 'Nhập Khẩu',
      product_type: 'physical',
      industry: 'fashion',
      category: 'tui-xach-vi-da',
      category_label: 'Túi Xách & Ví Da',
      badge: 'SANG TRỌNG',
      cover_image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80',
      product_images: ['https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80'],
      description: 'Da PU nhập khẩu chống xước, đường may tỉ mỉ sắc nét. Quai đeo có thể tùy chỉnh độ dài, chứa vừa điện thoại, son phấn và ví tiền.',
      original_price: 320000,
      discount_percent: 32,
      current_price: 219000,
      stock_quantity: 60,
      sold_count: 530,
      virtual_sold_count: 810,
      is_active: true,
      shipping_fee: 0,
      warranty_period: 'Bảo hành khóa kéo 3 tháng',
      package_type: 'pack',
      attributes: [
        { id: 'color', name: 'Màu Sắc', values: ['Đen Tuyển Chọn', 'Nâu Be Quý Phái', 'Trắng Sữa'] }
      ],
      variants: [
        { id: 'fash_b4_blk', name: 'Đen Tuyển Chọn', sku: 'BAG-BLK', attributes: { 'Màu Sắc': 'Đen Tuyển Chọn' }, price: 219000, original_price: 320000, stock_quantity: 25 },
        { id: 'fash_b4_nau', name: 'Nâu Be Quý Phái', sku: 'BAG-NAU', attributes: { 'Màu Sắc': 'Nâu Be Quý Phái' }, price: 219000, original_price: 320000, stock_quantity: 20 },
        { id: 'fash_b4_wht', name: 'Trắng Sữa', sku: 'BAG-WHT', attributes: { 'Màu Sắc': 'Trắng Sữa' }, price: 219000, original_price: 320000, stock_quantity: 15 }
      ]
    }
  ],

  // 2. MỸ PHẨM & SẮC ĐẸP
  beauty: [
    {
      id: 'bt_serum_b5_01',
      sku: 'BT-SERUM-B5',
      title: 'Serum Phục Hồi & Cấp Nước B5 Hyaluronic Acid 2% Giảm Kích Ứng',
      game_slug: 'cham-soc-da-mat',
      game_name: 'DERMA LAB',
      brand: 'Derma Lab Official',
      origin: 'Hàn Quốc (Chính Ngạch)',
      product_type: 'physical',
      industry: 'beauty',
      category: 'cham-soc-da-mat',
      category_label: 'Chăm Sóc Da Mặt',
      badge: 'TOP 1 SERUM',
      cover_image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80',
      product_images: ['https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80'],
      description: 'Chứa 5% Vitamin B5 và Hyaluronic Acid phân tử nhỏ giúp thẩm thấu sâu, phục hồi hàng rào bảo vệ da sau mụn hoặc treatment. Lành tính 100% không cồn không hương liệu.',
      original_price: 450000,
      discount_percent: 29,
      current_price: 320000,
      stock_quantity: 140,
      sold_count: 2310,
      virtual_sold_count: 3100,
      is_active: true,
      shipping_fee: 0,
      warranty_period: 'Cam kết chính hãng 100% đền gấp 10',
      package_type: 'pack',
      attributes: [
        { id: 'capacity', name: 'Dung Tích', values: ['Chai 30ml (Dùng Thử)', 'Chai 50ml (Tiết Kiệm)'] }
      ],
      variants: [
        { id: 'bt_s1_30ml', name: 'Chai 30ml (Dùng Thử)', sku: 'SERUM-B5-30', attributes: { 'Dung Tích': 'Chai 30ml (Dùng Thử)' }, price: 320000, original_price: 450000, stock_quantity: 80 },
        { id: 'bt_s1_50ml', name: 'Chai 50ml (Tiết Kiệm)', sku: 'SERUM-B5-50', attributes: { 'Dung Tích': 'Chai 50ml (Tiết Kiệm)' }, price: 479000, original_price: 650000, stock_quantity: 60 }
      ]
    },
    {
      id: 'bt_lipstick_velvet_02',
      sku: 'BT-LIP-02',
      title: 'Son Kem Lì Mịn Mượt Như Nhung Velvet Tint Bền Màu 8 Giờ',
      game_slug: 'son-trang-diem',
      game_name: 'ROSE BEAUTY',
      brand: 'Rose Beauty Paris',
      origin: 'Pháp',
      product_type: 'physical',
      industry: 'beauty',
      category: 'son-trang-diem',
      category_label: 'Son & Trang Điểm',
      badge: 'CHỐNG LEM',
      cover_image_url: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=600&q=80',
      product_images: ['https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=600&q=80'],
      description: 'Chất son xốp mềm nhẹ tênh không gây khô vân môi. Lên màu chuẩn sắc ngay từ lần quẹt đầu tiên, kháng nước kháng lem khi đeo khẩu trang.',
      original_price: 280000,
      discount_percent: 30,
      current_price: 195000,
      stock_quantity: 95,
      sold_count: 1840,
      virtual_sold_count: 2420,
      is_active: true,
      shipping_fee: 0,
      warranty_period: 'Đổi mới nếu vỡ hỏng do vận chuyển',
      package_type: 'pack',
      attributes: [
        { id: 'shade', name: 'Màu Son', values: ['#01 Đỏ Cam Cháy', '#02 Đỏ Ruby Quý Phái', '#03 Hồng Đất Trầm'] }
      ],
      variants: [
        { id: 'bt_l2_01', name: '#01 Đỏ Cam Cháy', sku: 'LIP-01', attributes: { 'Màu Son': '#01 Đỏ Cam Cháy' }, price: 195000, original_price: 280000, stock_quantity: 40 },
        { id: 'bt_l2_02', name: '#02 Đỏ Ruby Quý Phái', sku: 'LIP-02', attributes: { 'Màu Son': '#02 Đỏ Ruby Quý Phái' }, price: 195000, original_price: 280000, stock_quantity: 35 },
        { id: 'bt_l2_03', name: '#03 Hồng Đất Trầm', sku: 'LIP-03', attributes: { 'Màu Son': '#03 Hồng Đất Trầm' }, price: 195000, original_price: 280000, stock_quantity: 20 }
      ]
    },
    {
      id: 'bt_sunscreen_oil_03',
      sku: 'BT-SUN-03',
      title: 'Kem Chống Nắng Kiềm Dầu Nâng Tone Tự Nhiên SPF50+ PA++++ 50ml',
      game_slug: 'cham-soc-da-mat',
      game_name: 'SUN SHIELD',
      brand: 'Sun Shield Japan',
      origin: 'Nhật Bản',
      product_type: 'physical',
      industry: 'beauty',
      category: 'cham-soc-da-mat',
      category_label: 'Chăm Sóc Da Mặt',
      badge: 'KIỀM DẦU 12H',
      cover_image_url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=600&q=80',
      product_images: ['https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=600&q=80'],
      description: 'Màng lọc quang phổ rộng chống tia UVA/UVB và ánh sáng xanh. Kết cấu mỏng nhẹ thấm nhanh không để lại vệt trắng, tạo hiệu ứng mịn lì ráo dầu suốt ngày dài.',
      original_price: 390000,
      discount_percent: 27,
      current_price: 285000,
      stock_quantity: 120,
      sold_count: 1450,
      virtual_sold_count: 1980,
      is_active: true,
      shipping_fee: 0,
      warranty_period: 'Bảo hành chất lượng sản phẩm',
      package_type: 'pack',
      attributes: [
        { id: 'skin_type', name: 'Loại Da', values: ['Da Dầu Mụn / Nhạy Cảm', 'Da Thường / Hỗn Hợp Khô'] }
      ],
      variants: [
        { id: 'bt_s3_oil', name: 'Da Dầu Mụn / Nhạy Cảm', sku: 'SUN-OIL', attributes: { 'Loại Da': 'Da Dầu Mụn / Nhạy Cảm' }, price: 285000, original_price: 390000, stock_quantity: 70 },
        { id: 'bt_s3_dry', name: 'Da Thường / Hỗn Hợp Khô', sku: 'SUN-DRY', attributes: { 'Loại Da': 'Da Thường / Hỗn Hợp Khô' }, price: 285000, original_price: 390000, stock_quantity: 50 }
      ]
    }
  ],

  // 3. THIẾT BỊ SỐ & CÔNG NGHỆ
  tech: [
    {
      id: 'tech_keyboard_rgb_01',
      sku: 'TECH-KB-01',
      title: 'Bàn Phím Cơ Không Dây 3 Chế Độ RGB Hot-swap Pin 4000mAh',
      game_slug: 'chuot-ban-phim-co',
      game_name: 'PRO GEAR',
      brand: 'CyberGear Gaming',
      origin: 'Chính Hãng',
      product_type: 'physical',
      industry: 'tech',
      category: 'chuot-ban-phim-co',
      category_label: 'Chuột & Bàn Phím Cơ',
      badge: 'TOP ĐÁNH GIÁ',
      cover_image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
      product_images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80'],
      description: 'Hỗ trợ 3 kết nối: Bluetooth 5.1, Wireless 2.4G và Type-C. Switch cơ bản gõ cực êm mượt đã được lube sẵn từ xưởng, đèn led RGB 16.8 triệu màu tùy chỉnh qua app.',
      original_price: 990000,
      discount_percent: 24,
      current_price: 750000,
      stock_quantity: 55,
      sold_count: 820,
      virtual_sold_count: 1250,
      is_active: true,
      shipping_fee: 0,
      warranty_period: 'Bảo hành 12 tháng 1 đổi 1',
      package_type: 'pack',
      attributes: [
        { id: 'switch', name: 'Loại Switch', values: ['Red Switch (Êm Ái)', 'Brown Switch (Khấc Nhẹ)', 'Blue Switch (Clicky)'] },
        { id: 'color', name: 'Màu Khung', values: ['Trắng Xám Retro', 'Đen Cam Gaming'] }
      ],
      variants: [
        { id: 't_kb_red_wht', name: 'Red Switch (Êm Ái) / Trắng Xám', sku: 'KB-RED-WHT', attributes: { 'Loại Switch': 'Red Switch (Êm Ái)', 'Màu Khung': 'Trắng Xám Retro' }, price: 750000, original_price: 990000, stock_quantity: 20 },
        { id: 't_kb_brn_wht', name: 'Brown Switch (Khấc Nhẹ) / Trắng Xám', sku: 'KB-BRN-WHT', attributes: { 'Loại Switch': 'Brown Switch (Khấc Nhẹ)', 'Màu Khung': 'Trắng Xám Retro' }, price: 750000, original_price: 990000, stock_quantity: 20 },
        { id: 't_kb_blu_blk', name: 'Blue Switch (Clicky) / Đen Cam', sku: 'KB-BLU-BLK', attributes: { 'Loại Switch': 'Blue Switch (Clicky)', 'Màu Khung': 'Đen Cam Gaming' }, price: 750000, original_price: 990000, stock_quantity: 15 }
      ]
    },
    {
      id: 'tech_anc_earbuds_02',
      sku: 'TECH-EAR-02',
      title: 'Tai Nghe Chống Ồn Chủ Động ANC Bluetooth 5.4 Bass Sâu Pin 36 Giờ',
      game_slug: 'tai-nghe-loa',
      game_name: 'SOUND PRO',
      brand: 'Acoustic Sound',
      origin: 'Nhập Khẩu Chính Hãng',
      product_type: 'physical',
      industry: 'tech',
      category: 'tai-nghe-loa',
      category_label: 'Tai Nghe & Loa',
      badge: 'CHỐNG ỒN 45dB',
      cover_image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80',
      product_images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80'],
      description: 'Công nghệ chống ồn chủ động ANC Hybrid lên đến 45dB, đàm thoại 6 micro AI lọc gió cực rõ. Màng loa mạ titan 10mm cho dải bass uy lực.',
      original_price: 1290000,
      discount_percent: 31,
      current_price: 890000,
      stock_quantity: 70,
      sold_count: 650,
      virtual_sold_count: 980,
      is_active: true,
      shipping_fee: 0,
      warranty_period: 'Bảo hành 12 tháng chính hãng',
      package_type: 'pack',
      attributes: [
        { id: 'color', name: 'Màu Sắc', values: ['Đen Nhám (Matte Black)', 'Trắng Ngọc Trai (Pearl)'] }
      ],
      variants: [
        { id: 't_ear_blk', name: 'Đen Nhám (Matte Black)', sku: 'EAR-BLK', attributes: { 'Màu Sắc': 'Đen Nhám (Matte Black)' }, price: 890000, original_price: 1290000, stock_quantity: 40 },
        { id: 't_ear_wht', name: 'Trắng Ngọc Trai (Pearl)', sku: 'EAR-WHT', attributes: { 'Màu Sắc': 'Trắng Ngọc Trai (Pearl)' }, price: 890000, original_price: 1290000, stock_quantity: 30 }
      ]
    },
    {
      id: 'tech_gan_charger_03',
      sku: 'TECH-GAN-03',
      title: 'Củ Sạc Nhanh GaN 65W 3 Cổng (2 Type-C + 1 USB) Sạc Cả Laptop & Phone',
      game_slug: 'phu-kien-cap-sac',
      game_name: 'POWER MAX',
      brand: 'VoltFast GaN',
      origin: 'Chính Hãng',
      product_type: 'physical',
      industry: 'tech',
      category: 'phu-kien-cap-sac',
      category_label: 'Phụ Kiện Cáp Sạc',
      badge: 'SẠC SIÊU NHANH',
      cover_image_url: 'https://images.unsplash.com/photo-1622445268045-8f644b419b67?auto=format&fit=crop&w=600&q=80',
      product_images: ['https://images.unsplash.com/photo-1622445268045-8f644b419b67?auto=format&fit=crop&w=600&q=80'],
      description: 'Công nghệ bán dẫn GaN thế hệ mới giúp kích thước nhỏ gọn hơn 40%, không bị nóng khi sạc đầy công suất. Tương thích chuẩn PD 3.0, QC 4.0 cho iPhone, Samsung, MacBook.',
      original_price: 490000,
      discount_percent: 27,
      current_price: 360000,
      stock_quantity: 90,
      sold_count: 1100,
      virtual_sold_count: 1650,
      is_active: true,
      shipping_fee: 0,
      warranty_period: 'Bảo hành 18 tháng lỗi đổi mới',
      package_type: 'pack',
      attributes: [
        { id: 'bundle', name: 'Gói Phụ Kiện', values: ['Chỉ Củ Sạc 65W', 'Kèm Cáp C-to-C 100W Dù 1.2m'] }
      ],
      variants: [
        { id: 't_gan_only', name: 'Chỉ Củ Sạc 65W', sku: 'GAN-ONLY', attributes: { 'Gói Phụ Kiện': 'Chỉ Củ Sạc 65W' }, price: 360000, original_price: 490000, stock_quantity: 50 },
        { id: 't_gan_cable', name: 'Kèm Cáp C-to-C 100W Dù 1.2m', sku: 'GAN-CABLE', attributes: { 'Gói Phụ Kiện': 'Kèm Cáp C-to-C 100W Dù 1.2m' }, price: 430000, original_price: 590000, stock_quantity: 40 }
      ]
    }
  ],

  // 4. KHÓA HỌC & DỊCH VỤ SỐ
  services: [
    {
      id: 'srv_canva_pro_01',
      sku: 'SRV-CANVA',
      title: 'Tài Khoản Canva Pro Bản Quyền Không Giới Hạn Tính Năng AI Magic',
      game_slug: 'tai-khoan-pro-ban-quyen',
      game_name: 'DESIGN SUITE',
      brand: 'Canva Official Edu/Team',
      origin: 'Kích Hoạt Tự Động Email Riêng',
      product_type: 'digital',
      industry: 'services',
      category: 'tai-khoan-pro-ban-quyen',
      category_label: 'Tài Khoản Pro / Bản Quyền',
      badge: 'GIAO TỰ ĐỘNG 0s',
      cover_image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
      product_images: ['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80'],
      description: 'Mở khóa 100% kho ảnh, template, video cao cấp và công cụ xóa phông 1-click. Kích hoạt trực tiếp trên email chính chủ của bạn, không đổi tài khoản.',
      original_price: 360000,
      discount_percent: 67,
      current_price: 120000,
      stock_quantity: 250,
      sold_count: 4210,
      virtual_sold_count: 5300,
      is_active: true,
      shipping_fee: 0,
      warranty_period: 'Bảo hành toàn bộ thời gian sử dụng',
      package_type: 'monthly',
      attributes: [
        { id: 'duration', name: 'Thời Hạn', values: ['Gói 6 Tháng', 'Gói 1 Năm', 'Gói Vĩnh Viễn'] }
      ],
      variants: [
        { id: 'srv_c1_6m', name: 'Gói 6 Tháng', sku: 'CANVA-6M', attributes: { 'Thời Hạn': 'Gói 6 Tháng' }, price: 120000, original_price: 360000, stock_quantity: 100 },
        { id: 'srv_c1_1y', name: 'Gói 1 Năm', sku: 'CANVA-1Y', attributes: { 'Thời Hạn': 'Gói 1 Năm' }, price: 199000, original_price: 600000, stock_quantity: 100 },
        { id: 'srv_c1_life', name: 'Gói Vĩnh Viễn', sku: 'CANVA-LIFE', attributes: { 'Thời Hạn': 'Gói Vĩnh Viễn' }, price: 350000, original_price: 1200000, stock_quantity: 50 }
      ]
    },
    {
      id: 'srv_fullstack_course_02',
      sku: 'SRV-DEV-02',
      title: 'Khóa Học Fullstack Web Developer Từ Zero Đến Có Việc Làm Thực Tế',
      game_slug: 'lap-trinh-ai',
      game_name: 'TECH ACADEMY',
      brand: 'Tech Academy VN',
      origin: 'Video & Source Code Bản Quyền',
      product_type: 'digital',
      industry: 'services',
      category: 'lap-trinh-ai',
      category_label: 'Lập Trình & AI',
      badge: 'KÈM 1-1 MENTOR',
      cover_image_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80',
      product_images: ['https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80'],
      description: 'Lộ trình bài bản 6 tháng: HTML/CSS, React 18, Node.js, Database Cloudflare/PostgreSQL và Deploy Production. Bao gồm 12 dự án thực chiến chuẩn CV.',
      original_price: 1800000,
      discount_percent: 51,
      current_price: 890000,
      stock_quantity: 50,
      sold_count: 510,
      virtual_sold_count: 820,
      is_active: true,
      shipping_fee: 0,
      warranty_period: 'Hỗ trợ sửa code trọn đời',
      package_type: 'pack',
      attributes: [
        { id: 'plan', name: 'Gói Đào Tạo', values: ['Gói Tự Học Video + Source', 'Gói VIP Kèm 1-1 Mentor'] }
      ],
      variants: [
        { id: 'srv_d2_self', name: 'Gói Tự Học Video + Source', sku: 'COURSE-SELF', attributes: { 'Gói Đào Tạo': 'Gói Tự Học Video + Source' }, price: 890000, original_price: 1800000, stock_quantity: 35 },
        { id: 'srv_d2_vip', name: 'Gói VIP Kèm 1-1 Mentor', sku: 'COURSE-VIP', attributes: { 'Gói Đào Tạo': 'Gói VIP Kèm 1-1 Mentor' }, price: 2490000, original_price: 4500000, stock_quantity: 15 }
      ]
    }
  ],

  // 5. GAME & TIỆN ÍCH SỐ
  gaming: [
    {
      id: 'gm_robux_fast_01',
      sku: 'GM-ROBUX-01',
      title: 'Gói Nạp Robux Server VIP Chính Hãng Rate Cao Giao Tự Động 24/7',
      game_slug: 'roblox',
      game_name: 'ROBLOX',
      brand: 'Roblox Corporation',
      origin: 'Chính Hãng (Nạp ID Game)',
      product_type: 'digital',
      industry: 'gaming',
      category: 'giftcode-game',
      category_label: 'Giftcode Game',
      badge: 'RATE CAO NHẤT',
      cover_image_url: '/game_icons/play-together.webp',
      product_images: ['/game_icons/play-together.webp'],
      description: 'Nạp trực tiếp qua game pass/server VIP không cần mật khẩu. Nhận Robux sạch an toàn tài khoản 100%, bảo hành hoàn tiền nếu phát hiện lỗi.',
      original_price: 250000,
      discount_percent: 28,
      current_price: 180000,
      stock_quantity: 500,
      sold_count: 6720,
      virtual_sold_count: 8900,
      is_active: true,
      shipping_fee: 0,
      warranty_period: 'Bảo hành vĩnh viễn không ban acc',
      package_type: 'pack',
      attributes: [
        { id: 'amount', name: 'Mệnh Giá Robux', values: ['Gói 800 Robux', 'Gói 2.000 Robux', 'Gói 5.000 Robux VIP'] }
      ],
      variants: [
        { id: 'gm_rb_800', name: 'Gói 800 Robux', sku: 'RBX-800', attributes: { 'Mệnh Giá Robux': 'Gói 800 Robux' }, price: 180000, original_price: 250000, stock_quantity: 200 },
        { id: 'gm_rb_2000', name: 'Gói 2.000 Robux', sku: 'RBX-2000', attributes: { 'Mệnh Giá Robux': 'Gói 2.000 Robux' }, price: 420000, original_price: 600000, stock_quantity: 200 },
        { id: 'gm_rb_5000', name: 'Gói 5.000 Robux VIP', sku: 'RBX-5000', attributes: { 'Mệnh Giá Robux': 'Gói 5.000 Robux VIP' }, price: 990000, original_price: 1450000, stock_quantity: 100 }
      ]
    },
    {
      id: 'gm_genshin_acc_02',
      sku: 'GM-GENSHIN-02',
      title: 'Tài Khoản Genshin Impact AR55+ Full Nhân Vật 5 Sao Trấn Chuẩn Build',
      game_slug: 'genshin-impact',
      game_name: 'Genshin Impact',
      brand: 'HoYoverse',
      origin: 'Chính Chủ (Trắng Thông Tin)',
      product_type: 'digital',
      industry: 'gaming',
      category: 'tai-khoan-vip',
      category_label: 'Tài Khoản VIP',
      badge: 'TRẮNG TT',
      cover_image_url: '/game_icons/genshin-impact.webp',
      product_images: ['/game_icons/genshin-impact.webp'],
      description: 'Acc AR55-58 server Asia sạch 100%, chưa liên kết số điện thoại hay email ảo. Đổi mật khẩu ngay sau khi nhận mã tài khoản tự động.',
      original_price: 850000,
      discount_percent: 35,
      current_price: 550000,
      stock_quantity: 18,
      sold_count: 320,
      virtual_sold_count: 510,
      is_active: true,
      shipping_fee: 0,
      warranty_period: 'Bảo hành back acc trọn đời',
      package_type: 'account',
      attributes: [
        { id: 'server', name: 'Máy Chủ', values: ['Server Asia', 'Server America'] }
      ],
      variants: [
        { id: 'gm_gen_asia', name: 'Server Asia', sku: 'GEN-ASIA', attributes: { 'Máy Chủ': 'Server Asia' }, price: 550000, original_price: 850000, stock_quantity: 12 },
        { id: 'gm_gen_na', name: 'Server America', sku: 'GEN-NA', attributes: { 'Máy Chủ': 'Server America' }, price: 550000, original_price: 850000, stock_quantity: 6 }
      ]
    }
  ]
};

/**
 * Lấy danh sách sản phẩm mẫu theo ngành hàng
 */
export function getIndustryPresetProducts(industryId: string): StoreProduct[] {
  if (INDUSTRY_PRESET_PRODUCTS[industryId]) {
    return INDUSTRY_PRESET_PRODUCTS[industryId];
  }
  return INDUSTRY_PRESET_PRODUCTS['gaming'] || [];
}
