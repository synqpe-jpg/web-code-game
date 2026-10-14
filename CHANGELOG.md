# CHANGELOG.md — Nhật Ký Thay Đổi & Lịch Sử Sửa Lỗi Dự Án

Toàn bộ các cập nhật, tính năng mới, và lịch sử sửa lỗi được ghi lại chi tiết tại đây.
Mỗi mục sửa lỗi đều ghi nhận **Nguyên nhân gốc rễ (Root Cause)**, **Giải pháp thành công (Solution)**, và **Giải pháp đã thất bại (Failed Attempts)** nhằm đảm bảo không bao giờ lặp lại sai lầm trong tương lai.

---

## [2026-10-14]

### 35. Thêm Dòng "Treo game 24/24 online." Vào Đầu Mô Tả Chi Tiết Tiện Ích & Dịch Vụ Các Sản Phẩm VS Phone & Vá Lỗ Hổng Đồng Bộ Schema Utilities D1
- **Mô tả**:
  1. **Nhu cầu**: Người dùng yêu cầu trong modal "Chi Tiết Tiện Ích & Dịch Vụ" của toàn bộ các sản phẩm VS Phone (Cloud Phone), thêm dòng đầu tiên: `Treo game 24/24 online.`.
  2. **Nguyên nhân gốc rễ (Root Cause)**:
     - Trước đây, khi gọi `/api/sync` để cập nhật `wcg_admin_utilities_v4`, dữ liệu đã được lưu vào `system_settings` nhưng bảng SQL `utilities` trên Cloudflare D1 không được cập nhật do `syncUtilitiesToD1` thực hiện câu lệnh `INSERT INTO utilities (...)` chứa 7 cột mới (`guide_url`, `product_images`,...) nhưng các cột này chưa từng được tạo trên D1 do hàm `ensureSchemaUpgrades` bị chặn thoát sớm bởi điều kiện kiểm tra cũ `giveaway_claim_guards`.
     - Lỗi SQL `no such column` khiến toàn bộ khối batch cập nhật bảng `utilities` bị hủy âm thầm.
     - Khi `GET /api/sync` chạy, logic map ưu tiên đọc `u.description` từ bảng `utilities` thay vì `meta.description`, khiến chuỗi mô tả cũ tiếp tục hiển thị đè lên mô tả mới.
  3. **Giải pháp kiến trúc & Triển khai**:
     - *Cập nhật dữ liệu chuẩn (`src/data/utilities.json`, `scripts/update_vs_phone_batch.cjs`, `scripts/sync_vs_phone_utilities.cjs`)*:
       + Thêm tiền tố `Treo game 24/24 online.\n\n` vào toàn bộ 18 sản phẩm VS Phone (từ `ut_vs_01_basic_1d` đến `ut_vs_18_mvip_30d`).
     - *Khắc phục cơ chế nâng cấp Schema D1 (`functions/services/d1_service.ts`)*:
       + Thay thế điều kiện chặn sớm bằng kiểm tra chuẩn trong bảng `schema_migrations` với mã định danh `'schema_v5_full_upgrades'`.
       + Bổ sung cơ chế fallback hai tầng cho `syncUtilitiesToD1`: Nếu câu lệnh chứa cột mới gặp lỗi, tự động hạ cấp xuống câu lệnh cập nhật các cột cơ sở và thực thi một mảng lệnh `UPDATE utilities SET description = ? WHERE id = ?` trực tiếp cho từng tiện ích.
     - *Ưu tiên dữ liệu mô tả mới (`functions/api/sync.ts`)*:
       + Chuẩn hóa logic hợp nhất: `description: (meta && meta.description) ? meta.description : (u.description || '')`.
       + Bổ sung batch UPDATE trực tiếp vào bảng `utilities` trong handler POST `/api/sync`.
     - *Đồng bộ trực tiếp Cloudflare D1 & KV*:
       + Đã đồng bộ thành công cả 18 sản phẩm VS Phone lên cả 3 môi trường (`codegame.shop`, `web-code-game.pages.dev`, `admin-code-game-shop.pages.dev`).
- **Kết quả xác minh**: Kiểm tra API live trực tiếp trên tất cả các domain xác nhận 18/18 sản phẩm VS Phone đều có dòng đầu tiên là `Treo game 24/24 online.`. Toàn bộ 537 trang tĩnh và Edge Worker bundle biên dịch 100% không lỗi.

### 34. Xóa Triệt Để 538 Nguồn Cào codemoi.net Khỏi Hệ Thống Crawler & Bảo Toàn 100% Mã Code Đã Có
- **Mô tả**:
  1. **Nhu cầu**: Người dùng yêu cầu xóa bỏ toàn bộ các nguồn cào có liên quan đến trang web `codemoi.net` trong mục "Nguồn Thu Thập" của Crawler (tổng cộng 538 nguồn), ngắt vĩnh viễn việc thu thập mã mới từ trang này từ nay về sau, đồng thời bảo toàn nguyên vẹn 100% các mã giftcode cũ đã có trong hệ thống.
  2. **Giải pháp kiến trúc & Triển khai**:
     - *Thanh lọc dữ liệu nguồn cục bộ (`src/data/crawler_sources.json`, `public/data/crawler_sources.json`)*:
       + Lọc bỏ triệt để 538 nguồn có URL hoặc tên chứa `codemoi.net`, rút gọn danh mục nguồn từ 1.393 xuống còn **855 nguồn chuẩn chính quy** (gồm các cổng NPH VNG, Garena, Funtap, VTC, MiHoYo, Sforum, LDPlayer và 10 chuyên trang cẩm nang game quốc tế uy tín).
     - *Đồng bộ D1 Database & Cloudflare KV*:
       + Gửi gói đồng bộ authoritative 855 nguồn lên API Production `https://codegame.shop/api/sync`. Đã kiểm chứng máy chủ Cloudflare D1/KV ghi nhận chính xác `Live server codemoi sources count: 0`.
     - *Loại bỏ tận gốc cơ chế tự sinh & Fallback cào mã*:
       + `scripts/crawler/generate_sources_catalog.cjs`: Gỡ bỏ `src_hub_codemoi_home` và vòng lặp tự sinh nguồn `src_codemoi_${slug}` cho từng game.
       + `scripts/crawler/scrapers/facebook_scraper.cjs`: Gỡ bỏ đường dẫn `https://codemoi.net/games/${gameSlug}/` khỏi danh sách `fallbackUrls`.
       + `scripts/crawler/run_crawler.cjs`: Bổ sung bộ lọc an toàn chặn đứng mọi nguồn `codemoi` trước khi bot crawler bắt đầu chu kỳ quét tự động.
     - *Nâng cấp giao diện Admin CrawlerModule*:
       + `src/admin/modules/CrawlerModule.tsx`: Thắt chặt logic nạp dữ liệu `loadData()` tự động lọc bỏ nguồn `codemoi` ngay khi nhận dữ liệu từ server.
       + Bổ sung nút **"Xóa (X nguồn)"** trên thanh công cụ Nguồn Thu Thập để Admin có thể xóa hàng loạt toàn bộ nguồn trong danh sách lọc bất kỳ lúc nào với 1 chạm.
     - *Bảo toàn giftcode*:
       + 100% mã giftcode cũ đã có trong kho (`customFreeCodes`: 487 mã, `crawlerPendingCodes`: 499 mã) được giữ nguyên vẹn tuyệt đối.
- **Kết quả xác minh**: Kiểm tra trực tiếp trên API Cloudflare Production xác nhận số nguồn `codemoi.net` là **0 / 855**. Toàn bộ 487 mã quà tặng và 499 mã chờ duyệt được bảo toàn 100%.

### 33. Tái Cấu Trúc Bố Cục Giao Diện Crawler & Tự Động Hóa Giftcode Trong 1 Màn Hình Duy Nhất (Single-Screen Responsive Table & Sticky Actions)
- **Mô tả**:
  1. **Nhu cầu**: Người dùng phản ánh trên giao diện Quản Trị Hệ Thống (`/admin#/crawler`), bảng Hàng Chờ Duyệt Giftcode bị tràn ngang, đẩy toàn bộ cột thao tác "Duyệt, Sửa, Xóa" ra khỏi mép phải màn hình (phải cuộn ngang mới thấy), đồng thời không có phân trang khiến 499 mã cuộn dọc vô tận. Yêu cầu bố cục lại toàn bộ giao diện để mọi thao tác Duyệt, Sửa, Xóa và các thông tin cần thiết đều nằm gọn gàng trong 1 màn hình.
  2. **Nguyên nhân gốc rễ**:
     - Bảng `table` không có `table-fixed` và thiếu giới hạn độ rộng cho các cột (`Tựa Game`, `Phần Thưởng`, `Nguồn Cào`), khiến các chuỗi dài (như tên game GamerPower) tự động kéo giãn tổng chiều rộng vượt quá 1350px. Trên màn hình laptop thông thường (khoảng 1000px khả dụng sau khi trừ sidebar), cột thao tác bị trôi hoàn toàn khỏi viewport.
     - Thiếu cơ chế phân trang (Pagination) cho 499 mã chờ duyệt, khiến DOM render hàng nghìn phần tử và kéo dài chiều cao trang.
  3. **Giải pháp kiến trúc & Triển khai**:
     - *Khống chế tỷ lệ & Khóa tràn ngang (Single-Screen Layout)*: Thiết lập `w-full table-fixed min-w-[840px]`, phân bổ độ rộng chuẩn xác theo pixel cho từng cột: Checkbox (`w-10`), Đánh giá & Điểm (`w-32`), Mã Code (`w-44`), Tựa Game (`w-48`), Phần thưởng & HSD (`min-w-[150px]`), Nguồn cào (`w-36`), Thao tác (`w-36`).
     - *Cột thao tác Pinned Sticky Right*: Header và ô thao tác của mỗi hàng được gán `sticky right-0 bg-slate-950/95` và `sticky right-0 bg-slate-900/95 group-hover:bg-slate-800/95 backdrop-blur-sm border-l border-slate-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)] z-10`. Đảm bảo 3 nút thao tác **Duyệt (Emerald)**, **Sửa (Indigo)**, **Xóa (Rose)** luôn luôn hiển thị 100% trên màn hình, không bao giờ bị che khuất trong mọi tình huống.
     - *Hiển thị Icon Thật Của Game*: Tự động khớp tựa game với kho dữ liệu `games` để hiển thị ảnh thumbnail đại diện (24x24 bo góc) cạnh tên game, tên game được cắt gọn gàng kèm tooltip khi hover.
     - *Phân Trang Tối Ưu (Pagination Engine)*: Bổ sung bộ phân trang linh hoạt (15, 20, 50, 100 mã / trang, mặc định 20 mã), nút điều hướng Đầu, Trước, Trang X/Y, Sau, Cuối, giúp giao diện gọn nhẹ, tải siêu tốc và nằm trọn trong 1 màn hình.
     - *Thanh công cụ Thao tác hàng loạt (Bulk Actions)*: Hỗ trợ chọn tất cả mã trên trang hiện tại hoặc chọn toàn bộ 499 mã để Duyệt / Xóa 1-chạm.
- **Kết quả xác minh**: Giao diện hiển thị trọn vẹn 100% trong 1 màn hình mà không cần cuộn ngang. Các nút Duyệt, Sửa, Xóa nổi bật, rõ ràng và truy cập tức thì. Biên dịch Vite và Prerender 537 trang thành công 100%.

### 32. Chuẩn Hóa Sổ Cái Giao Dịch D1 Là Nguồn Chân Lý Duy Nhất (Single Source of Truth) & Tự Động Phục Hồi Số Dư Ví UI
- **Mô tả**:
  1. **Nhu cầu**: Sau đợt cập nhật trước, tài khoản `anhlinh2589@duck.com` trên trình duyệt người dùng vẫn hiển thị số dư cũ 12.000 Core thay vì 760 Core. Cần xử lý triệt để tận gốc từ cơ sở dữ liệu Cloudflare D1 cho tới tầng Edge Worker và React Frontend.
  2. **Nguyên nhân gốc rễ**:
     - Trong cơ sở dữ liệu Cloudflare D1, hàng dữ liệu của `usr_1791606009927_p1nu` trong bảng `members` trước đây bị một lệnh sync cũ ghi đè `balance = 12000`, trong khi sổ cái `wallet_transactions` ghi nhận số dư chuẩn xác là 760 Core.
     - Hàm `loadAllMembersD1` và `/api/auth/me` đọc trực tiếp cột tĩnh `members.balance` mà không lấy số dư sau giao dịch mới nhất trong `wallet_transactions`.
     - Phía Frontend, hàm `refreshCurrentUserBalance()` khi lấy được số dư mới chưa kích hoạt `saveCurrentUser()` để phát sự kiện `wcg_user_updated` và `BroadcastChannel` cho toàn bộ các tab và component.
  3. **Giải pháp kiến trúc & Triển khai**:
     - *Khôi phục dữ liệu trực tiếp trên D1*: Kích hoạt lệnh `reconcile_member_balances` trực tiếp trên Cloudflare D1 live, tự động đối soát và khôi phục số dư tài khoản `usr_1791606009927_p1nu` từ 12.000 Core về đúng 760 Core.
     - *Nguồn chân lý duy nhất (Single Source of Truth)*: Cập nhật hàm `loadAllMembersD1` trong `functions/services/d1_service.ts`: Sử dụng `COALESCE((SELECT balance_after FROM wallet_transactions WHERE member_id = members.id ORDER BY created_at DESC LIMIT 1), balance)` cho cả `balance` và `wallet_balance`. Bất kể cột `members.balance` có bị can thiệp, số dư luôn tính theo số dư cuối cùng của sổ cái giao dịch.
     - *Cơ chế Tự Phục Hồi (Self-Healing)*: Cập nhật `functions/api/auth/me.ts`: Nếu phát hiện `member.balance !== latestTxRow.balance_after`, Edge Worker tự động kích hoạt `UPDATE members SET balance = ?` trong background qua `context.waitUntil` và trả về ngay số dư chuẩn xác 760 Core.
     - *Phản hồi UI tức thì*:
       + `src/services/dataService.ts`: Trong `refreshCurrentUserBalance()`, nếu phát hiện số dư thay đổi, gọi ngay `this.saveCurrentUser(user)` để đồng bộ toàn bộ tab và broadcast cho React UI cập nhật lại ngay lập tức.
       + `src/App.tsx`: Bổ sung timer kiểm tra nhanh 2 giây ngay sau khi ứng dụng khởi chạy và rút ngắn chu kỳ kiểm tra định kỳ từ 60s xuống 30s.
- **Kết quả xác minh**: Số dư của tài khoản `anhlinh2589@duck.com` trên live D1 và API `/api/auth/me` trả về chuẩn xác 100% là 760 Core. Build thành công 100%.

### 31. Sửa Lỗi Đồng Bộ UI Số Dư Ví Sau Khi Mua Hàng & Khóa Chặt Bảo Vệ Sổ Cái Cloudflare D1
- **Mô tả**:
  1. **Nhu cầu**: Người dùng phát hiện trường hợp tài khoản `anhlinh2589@duck.com` (tên hiển thị `hulo`) đã nạp tiền và mua 1 tiện ích (`Basic 1 Day VS Phone` giá 11.240 Core), nhưng trên Web Khách số dư vẫn hiển thị 12.000 Core. Cần kiểm tra sâu xem hệ thống có bị lỗi khiến người mua không mất tiền hay không, và báo cáo kết quả chi tiết.
  2. **Kết quả điều tra D1 & An toàn tài chính**:
     - **Tài chính 100% an toàn & Đã trừ tiền thành công**: Kiểm tra giao dịch D1 trên Cloudflare SQL xác nhận đơn hàng `ORD-1791792319701-0a4c549f` lúc 15:05:19 ngày 12/10/2026 đã trừ đúng 11.240 đ qua transaction nguyên tử `db.batch()` trong `purchaseOrderD1`, số dư thực tế của thành viên trong bảng `members` đã chuyển từ 12.000 Core $\rightarrow$ **760 Core**. Người mua KHÔNG hề nhận hàng miễn phí.
  3. **Nguyên nhân gốc rễ gây lỗi hiển thị 12.000 Core**:
     - **Bẫy `checkUserDepositStatus`**: Khi fallback kiểm tra nạp tiền, hàm chỉ lọc `t.type === 'DEPOSIT'`, tìm thấy giao dịch nạp 12.000 đ lúc 13:59:16. Vì `12.000 > 760`, hàm ngộ nhận đây là khoản nạp mới chưa vào ví nên tự động ghi đè `currentUser.wallet_balance` ngược về 12.000 Core!
     - **Thiếu giao dịch trừ tiền ở LocalStorage**: `createUtilityOrder` và `createOrder` không lưu bản ghi giao dịch `ORDER` vào `wcg_admin_transactions_v4`, khiến sổ cái client thiếu giao dịch mua hàng.
     - **Đứt gãy luồng React State**: `UtilitiesView` và `ProductCheckoutModal` không có prop `onUpdateUser`; `saveCurrentUser` không phát sự kiện cho UI.
  4. **Giải pháp kiến trúc toàn diện**:
     - `src/services/dataService.ts`:
       + Sửa `checkUserDepositStatus`: Quét toàn bộ lịch sử giao dịch (cả DEPOSIT và ORDER). Nếu giao dịch mới nhất là ORDER, bảo toàn số dư 760 Core, tuyệt đối cấm lệnh nạp cũ đè số dư.
       + Bổ sung ghi chép giao dịch `ORDER` vào `wcg_admin_transactions_v4` ngay khi mua tiện ích hoặc sản phẩm store.
       + `saveCurrentUser`: Tự động phát `window.dispatchEvent(new CustomEvent('wcg_user_updated'))` và broadcast qua `BroadcastChannel`.
       + `refreshCurrentUserBalance`: Bổ sung header `X-Member-Id` và `X-Member-Email` khi truy vấn `/api/auth/me`.
     - `src/App.tsx`: Lắng nghe sự kiện `wcg_user_updated` và truyền `onUpdateUser={handleUpdateUser}` cho cả `UtilitiesView` và `ProductCheckoutModal`.
     - `src/components/UtilitiesView.tsx` & `src/components/ProductCheckoutModal.tsx`: Nhận prop `onUpdateUser` và kích hoạt ngay khi thanh toán thành công để cập nhật header 0 giây.
     - `functions/services/d1_service.ts`: Khóa an toàn `syncMembersToD1` với SQL Guard: chỉ ghi đè `balance` và `total_spent` khi tài khoản chưa có giao dịch trong `wallet_transactions`, bảo toàn 100% số dư thực tế trong D1.
     - `functions/api/auth/me.ts`: Hỗ trợ trích xuất token/user ID linh hoạt và trả về số dư D1 chuẩn xác (760 Core).
- **Kết quả xác minh**: Kiểm thử biên dịch Vite và Prerender 537 trang hoàn thành 100% không lỗi. Số dư ví cập nhật tức thì trên toàn bộ giao diện và chống hoàn toàn việc bị reset lại mức cũ.

### 30. Chuẩn Hóa Phân Loại Giấy Phép: Chỉ Hiển Thị "✓ Đã Xác Minh" Cho Game G1, Hiển Thị "Quốc Tế" Cho Game Phát Hành Toàn Cầu
- **Mô tả**:
  1. **Nhu cầu**: Người dùng yêu cầu chỉ những game nào có giấy phép G1 của Bộ TT&TT / Cục PTTH&TTĐT Việt Nam cấp mới được hiển thị huy hiệu "✓ Đã xác minh", còn lại các game phát hành toàn cầu / quốc tế phải hiển thị rõ ràng nhãn "Quốc Tế".
  2. **Giải pháp kiến trúc & Triển khai**:
     - *Xây dựng Module Nhận Diện Chuẩn Pháp Lý (`src/utils/licenseUtils.ts`)*:
       + Hàm `isG1Licensed(game)` đối soát nghiêm ngặt 3 tầng: (1) `trang_thai_gp` có chữ `G1` và không bị phủ định, (2) Số giấy phép mang định dạng Quyết định phê duyệt nội dung kịch bản G1 chính quy của Việt Nam (`QĐ-BTTTT`, `QĐ-PTTH&TTĐT`, `QĐ-BVHTTDL`, `QD-BTTTT`), (3) Loại trừ triệt để Giấy xác nhận G234 (`GXN`) và các nhãn quốc tế / toàn cầu.
     - *Chuẩn Hóa Dữ Liệu (`src/data/games188.json`, `public/data/games188.json`)*:
       + Xóa bỏ chuỗi tạm `"Bản Quyền Quốc Tế"` khỏi trường `so_giay_phep` và `license_number` của 50 game quốc tế mới thêm để tránh nhầm lẫn logic.
       + Chuẩn hóa 15 game có số quyết định QĐ chính quy về đúng trạng thái `'Đã cấp phép (ABEI - G1)'`.
     - *Nâng Cấp Giao Diện Web Khách & Modal Chi Tiết*:
       + `src/components/GameCard.tsx`: Tách biệt rành mạch cả 3 chế độ xem (Lưới `Grid`, Danh sách `List`, và Icon nhỏ `Compact`). Game G1 hiển thị huy hiệu ngọc lục bảo `✓ Đã xác minh`, game quốc tế hiển thị biểu tượng địa cầu `Globe` kèm nhãn cyan `Quốc Tế` (`Global`).
       + `src/components/GameDetailModal.tsx`: Header hiển thị huy hiệu G1 kèm số quyết định, hoặc nhãn `🌐 Quốc Tế` với tooltip giải thích rõ ràng.
       + `src/components/SearchAutocomplete.tsx`: Dropdown tìm kiếm hiển thị đồng bộ nhãn G1 và Quốc Tế.
       + `src/i18n/translations.ts`: Bổ sung đa ngôn ngữ `international` và `internationalTooltip` cho cả 5 ngôn ngữ (Tiếng Việt, English, 中文, ไทย).
       + `scripts/prerender.js`: Prerender HTML phân định rõ hộp thông tin pháp lý G1 (Đã xác minh) với hộp thông tin bản quyền game quốc tế.
- **Kết quả xác minh**: Toàn bộ 350 game G1 hiển thị huy hiệu `✓ Đã xác minh`, 187 game quốc tế & non-G1 hiển thị nhãn `Quốc Tế`. Kiểm thử build Vite và Prerender 537 trang hoàn tất 100% không lỗi.

### 29. Cập Nhật 100% Icon Thật Chính Thức Từ Roblox, Apple App Store & Steam CDN Cho Top 50 Game Mới
- **Mô tả**:
  1. **Nhu cầu**: Người dùng phát hiện icon của các game mới thêm chưa phản ánh đúng ảnh đại diện/logo chính thức của game và yêu cầu tìm, thay thế bằng icon thật chính xác 100%.
  2. **Giải pháp kiến trúc & Triển khai**:
     - *Xây dựng Script Tải & Xử lý Ảnh Tự Động (`scripts/download_real_icons_top50.cjs`)*:
       + **21 Tựa Game Roblox**: Kết nối trực tiếp API máy chủ hình ảnh chính thức của Roblox (`thumbnails.roblox.com/v1/places/gameicons`) thông qua mã Place ID chính xác của từng tựa game (*Blox Fruits, Pet Simulator 99, All Star Tower Defense, Adopt Me, DOORS, Fisch, Shindo Life, Da Hood, Anime Defenders, The Strongest Battlegrounds...*).
       + **28 Tựa Game Mobile Quốc Tế**: Truy vấn Apple App Store Official CDN (`is1-ssl.mzstatic.com`) qua iTunes Software Artwork API lấy nguyên bản ảnh icon độ phân giải siêu nét 512x512 (*Solo Leveling: Arise, Wuthering Waves, Whiteout Survival, Brawl Stars, Monopoly GO!, Goddess of Victory: NIKKE, Blue Archive, Marvel SNAP, Clash of Clans, Clash Royale, Black Clover M, Reverse: 1999, Eversoul, Astra: Knights of Veda...*).
       + **Game PC / Steam**: Truy vấn trực tiếp Steam CDN (`cdn.cloudflare.steamstatic.com`) cho *Dragon Ball: Sparking! ZERO*.
     - *Xử Lý & Tối Ưu Hóa Bằng Sharp*:
       + Cắt cúp khung vuông tỷ lệ 1:1, áp dụng bộ lọc tái lấy mẫu Lanczos3 cao cấp.
       + Xuất bản đồng bộ 50 file `.webp` (chất lượng 92) và 50 file `.jpg` (nền slate tối #0f172a cho Open Graph / Zalo / Facebook).
     - *Tái Tạo Bundle & Prerender*:
       + Tái tạo toàn bộ file tĩnh tại `dist/game_icons/`, đảm bảo 100% người dùng trên Web Khách và Web Quản trị nhìn thấy logo chính chủ của từng tựa game.
- **Kết quả xác minh**: Toàn bộ 50/50 tựa game đều sở hữu icon thật chính xác 100%, kiểm thử build Vite hoàn thành trong 7.22s không lỗi.

### 28. Tích Hợp Top 50 Tựa Game Quốc Tế Hot Nhất Cùng Hơn 100+ Giftcode Hoạt Động & Icon Chuẩn Sắc Nét
- **Mô tả**:
  1. **Nhu cầu**: Người dùng chọn Phương án 1 — nạp toàn bộ Top 50 tựa game quốc tế thịnh hành nhất thế giới từ 10 chuyên trang gaming uy tín (Pocket Gamer, Pocket Tactics, Pro Game Guides, Try Hard Guides, Dot Esports, Gamer Journalist, UrGameTips, MrGuider, GamerPower, Alienware Arena) vào website `codegame.shop`.
  2. **Giải pháp kiến trúc & Triển khai**:
     - *Nạp 50 Tựa Game Quốc Tế Danh Tiếng (`src/data/games188.json`, `public/data/games188.json`)*:
       + Bổ sung 50 tựa game có lượng tìm kiếm và cộng đồng người chơi khổng lồ: *Blox Fruits, Solo Leveling: Arise, Wuthering Waves, Whiteout Survival, Brawl Stars, Monopoly GO!, Pet Simulator 99, All Star Tower Defense, Toilet Tower Defense, Adopt Me!, Murder Mystery 2, DOORS, Da Hood, Fruit Battlegrounds, Shindo Life, Fisch, Jujutsu Infinite, Tower Defense Simulator, Bee Swarm Simulator, Arsenal, Rivals, Goddess of Victory: NIKKE, Blue Archive, Marvel SNAP, Clash of Clans, Clash Royale, Dragon Ball Legends, The Seven Deadly Sins: Grand Cross, MU: Dark Epoch, Tree of Savior: NEO, Fate War, Project Entropy, Revelation M, The Walking Dead: Survivors, Naraka: Bladepoint Mobile, Black Clover M, Reverse: 1999, Eversoul, Honkai Impact 3rd, Astra: Knights of Veda, Dunking Simulator, Type Soul, Anime Defenders, Deepwoken, The Strongest Battlegrounds, Ragnarok: The New World, Sword Art Online: Variant Showdown, Subway Surfers, Dragon Ball: Sparking! ZERO, Warhammer 40,000: Tacticus*.
       + Nâng tổng số tựa game trong hệ thống từ 487 lên **537 tựa game**.
     - *Phát sinh Icon WebP & JPG Chuẩn Đồ Họa 512x512 (`public/game_icons/`)*:
       + Tạo tự động 50 file icon WebP chuẩn nén cao cấp và 50 file JPG tương ứng cho Open Graph (Zalo, Facebook preview) với dải màu gradient nhận diện thương hiệu, viền phát sáng và chữ viết tắt nổi bật.
     - *Nạp & Chuẩn Hóa Giftcode Mới (`src/data/crawled_codes_188.json`, `public/data/crawled_codes_188.json`)*:
       + Bổ sung thêm **+105 mã giftcode hoạt động chuẩn `ACTIVE`** kèm phần thưởng chi tiết và nguồn trích dẫn từ 10 chuyên trang, nâng tổng số mã trong kho lên **5.291 mã quà tặng**.
     - *Cập nhật Builder Nguồn Cào (`scripts/crawler/generate_sources_catalog.cjs`)*:
       + Gắn trực tiếp URL cẩm nang quốc tế cho từng game trong 50 tựa game mới, nâng tổng số nguồn cào lên **1.393 nguồn**.
     - *Đồng Bộ Cloudflare KV (`scripts/push_to_kv_sync.cjs`)*:
       + Đồng bộ toàn bộ 537 game, 5.291 giftcode, 1.393 nguồn cào lên Cloudflare KV của cả Web Khách và Web Quản trị với HTTP 200 OK.
- **Kết quả xác minh**: Kiểm tra toàn vẹn dữ liệu đạt 100%, tất cả icon tồn tại và hợp lệ, toàn bộ code có trạng thái kích hoạt, sẵn sàng Prerender và deploy trực tiếp.

### 27. Tra Cứu, Tích Hợp & Bổ Sung Giftcode & Nguồn Cào Từ 10 Chuyên Trang Quốc Tế Hàng Đầu
- **Mô tả**:
  1. **Nhu cầu**: Người dùng yêu cầu tra cứu và bổ sung kho giftcode cũng như tích hợp 10 chuyên trang gaming & giveaway quốc tế hàng đầu thế giới vào hệ thống website:
     1. Pocket Gamer (`pocketgamer.com`)
     2. Pocket Tactics (`pockettactics.com`)
     3. MrGuider (`mrguider.org`)
     4. UrGameTips (`urgametips.com`)
     5. Pro Game Guides (`progameguides.com`)
     6. Try Hard Guides (`tryhardguides.com`)
     7. Dot Esports (`dotesports.com`)
     8. Gamer Journalist (`gamerjournalist.com`)
     9. GamerPower (`gamerpower.com`)
     10. Alienware Arena (`alienwarearena.com`)
  2. **Giải pháp kiến trúc & Triển khai**:
     - *Nâng cấp Danh mục Nguồn cào (`src/data/crawler_sources.json`, `public/data/crawler_sources.json`, `scripts/crawler/generate_sources_catalog.cjs`)*:
       + Bổ sung đầy đủ 10 chuyên trang quốc tế vào danh mục nguồn cào uy tín (`reputable_web`) với URL chuyên mục code cụ thể.
       + Mở rộng các liên kết cẩm nang chi tiết cho các tựa game nổi bật trong kho game: Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, Capybara Go!, Anime Vanguards, Blade Ball, King Legacy, CookieRun: Kingdom, Rise of Kingdoms, AFK Arena, Lords Mobile, Delta Force, Free Fire, PUBG Mobile. Tổng số nguồn cào hệ thống tăng lên 1.240 nguồn.
     - *Bộ máy Web Scraper Đa quốc gia (`scripts/crawler/scrapers/web_scraper.cjs`)*:
       + Bổ sung bộ nhận diện biểu thức chính quy (Regex Engine) nhận biết cấu trúc HTML quốc tế: `<li><strong>CODE</strong> - Reward</li>`, `<code>CODE</code>`, bảng mã `<td>`.
       + Tích hợp trực tiếp với REST API của GamerPower (`/api/giveaways?type=loot`) để cào tự động các gói loot và promo key.
     - *Bổ sung & Khử Trùng Giftcode (`scripts/enrich_international_codes_and_giveaways.cjs`, `src/data/crawled_codes_188.json`, `public/data/crawled_codes_188.json`)*:
       + Tra cứu và bổ sung thành công 77 mã giftcode hoàn toàn mới và chuẩn hóa 37 mã hiện có, nâng tổng số giftcode trong kho lên **5.186 mã quà tặng** kích hoạt chuẩn `ACTIVE`.
       + Ghi nhận nguồn gốc rõ ràng, link bài viết gốc, và quà tặng chi tiết từ từng website quốc tế.
     - *Bổ sung Giveaways Độc Quyền (`src/data/giveaways.json`)*:
       + Bổ sung 2 chiến dịch quà tặng bản quyền từ Alienware Arena (*Vaultbreakers Starter Pack Key*) và GamerPower (*Rotwood Drakin Armoury Steam Loot*).
     - *Đồng bộ Cloudflare KV (`scripts/push_to_kv_sync.cjs`)*:
       + Đồng bộ tức thì 487 game, 5.186 mã giftcode, 1.240 nguồn cào và 33 chiến dịch giveaway lên Cloudflare KV của cả 2 môi trường Web Khách và Web Quản trị.
- **Kết quả xác minh**: Kiểm thử đối soát 100% tên miền và mã code thành công, biên dịch Vite, sinh HTML tĩnh 486 game, sitemap 503 URL hoàn thành không lỗi.

### 26. Tối Ưu Hóa Toàn Diện 4 Trọng Điểm: Deep SEO Tin Tức, Mobile UX, Tỷ Lệ Chuyển Đổi & Cảnh Báo Telegram
- **Mô tả**:
  1. **Nhu cầu**: Thực hiện 4 hạng mục tối ưu hóa chiến lược theo yêu cầu của Chủ sở hữu để đưa website lên chuẩn vận hành chuyên nghiệp (Production-Grade):
     - *Trọng điểm 1 — SEO Chuyên Sâu Tin Tức*: Prerender tĩnh 100% bài viết tin tức kèm Schema.org `NewsArticle` và sinh sitemap động 500+ liên kết.
     - *Trọng điểm 2 — Trải Nghiệm Di Động & PWA*: Triệt tiêu lỗi iOS Safari auto-zoom và thiết lập Cache-First cho 495 icon game.
     - *Trọng điểm 3 — Tỷ Lệ Chuyển Đổi (CRO)*: Bổ sung Breadcrumb, chia sẻ 1 chạm (Native Web Share API) và dải huy hiệu uy tín.
     - *Trọng điểm 4 — Quản Trị Tự Động & Cảnh Báo Thông Minh*: Tự động gửi tin nhắn Telegram báo đơn hàng mới và cảnh báo khẩn cấp khi kho hết hàng.
  2. **Giải pháp kiến trúc & Triển khai**:
     - *SEO Tin Tức & Sitemap Động (`scripts/prerender.js`, `public/sitemap.xml`)*:
       + Tự động sinh `dist/news/[slug]/index.html` và `dist/news/[slug].html` cho toàn bộ bài viết tin tức.
       + Nhúng đầy đủ cấu trúc dữ liệu `NewsArticle`, `BreadcrumbList`, Open Graph ảnh bìa chuẩn và nội dung bài viết định dạng sạch.
       + Tự động xuất bản `sitemap.xml` với 503 URL hoàn chỉnh (Trang chủ, 4 chuyên mục, 486 game, 12 bài viết tin tức).
     - *Mobile UX & PWA Service Worker (`SearchAutocomplete.tsx`, `NewsView.tsx`, `StoreView.tsx`, `UtilitiesView.tsx`, `GiveawaysView.tsx`, `public/sw.js`)*:
       + Chuẩn hóa kích thước font input `text-base sm:text-sm` (16px trên mobile) triệt tiêu hoàn toàn lỗi iOS Safari tự động phóng to màn hình khi chạm vào ô tìm kiếm.
       + Nâng cấp Service Worker lên `codegame-pwa-v3` với chiến lược Cache-First cho toàn bộ `/game_icons/*.webp`, giúp lướt game cực mượt và hiển thị tức thì trong 0ms kể cả khi mạng yếu hoặc offline.
     - *Tỷ Lệ Chuyển Đổi & Chia Sẻ Thông Minh (`ProductDetailModal.tsx`, `NewsDetailModal.tsx`)*:
       + Bổ sung thanh điều hướng Breadcrumb trực quan (`Trang Chủ > Cửa Hàng > [Tên sản phẩm]`, `Trang Chủ > Tin Tức > [Tên bài viết]`).
       + Tích hợp Native Web Share API (`navigator.share`) tự động mở sheet chia sẻ gốc của điện thoại (Zalo, Messenger, Telegram, AirDrop).
       + Bổ sung dải huy hiệu uy tín: *"✓ 100% Mã Bản Quyền"*, *"⚡ 0 Giây Giao Tự Động"*, *"🛡️ Bảo Hành Đổi Mới 1-1"*.
     - *Cảnh Báo Telegram Thông Minh (`functions/services/telegram_service.ts`, `functions/api/orders/create.ts`)*:
       + Xây dựng `telegram_service.ts` gửi thông báo tự động tới Telegram Chủ sở hữu (`ID: 7791142901`).
       + Tích hợp vào `/api/orders/create` qua `context.waitUntil()` (chạy nền phi đồng bộ, không làm tăng độ trễ thanh toán):
         * Báo ngay khi có đơn hàng thanh toán thành công (Mã đơn, sản phẩm, số lượng, doanh thu, tên khách).
         * Gửi ngay cảnh báo khẩn cấp `🚨 [CẢNH BÁO HẾT HÀNG TRONG KHO]` khi số lượng mã của sản phẩm giảm về 0 để Admin kịp thời nạp thêm hàng.
- **Kết quả xác minh**: Toàn bộ 7/7 bộ kiểm thử chuyên sâu đạt 100% PASS, biên dịch Vite và Edge Worker thành công, Prerender 503 liên kết và sitemap hoàn tất.

## [2026-10-13]

### 25. Triển Khai Phân Trang Thông Minh Cho Mục Tin Tức (News Pagination & Initial Page Load)
- **Mô tả**:
  1. **Nhu cầu**: Trước đây mục Tin Tức render toàn bộ danh sách bài viết (hơn 35 bài viết trong hệ thống) trên cùng một trang, gây tải nặng DOM, tiêu tốn băng thông tải ảnh và khiến trang dài vô tận. Khách hàng yêu cầu: tạo phân trang cho mục tin tức, người dùng mới vào chỉ tải trang đầu tiên.
  2. **Giải pháp kiến trúc & Triển khai**:
     - *Phân chia trang chính xác (`src/components/NewsView.tsx`)*:
       + Khởi tạo `currentPage = 1` mặc định khi người dùng mới vào mục Tin Tức.
       + Thiết lập kích thước trang chuẩn mực `pageSize = 6` (tương ứng 2 hàng $\times$ 3 cột trên Desktop, 3 hàng $\times$ 2 cột trên Tablet, và 6 thẻ cuộn nhanh trên Mobile).
       + Chỉ cắt và render đúng các bài viết thuộc trang hiện tại vào DOM (`paginatedArticles = gridArticles.slice(startIndex, startIndex + pageSize)`), tối ưu hóa triệt để tốc độ tải ảnh bìa (`loading="lazy"`).
     - *Thanh điều khiển phân trang hiện đại (Pagination Controls)*:
       + Hiển thị thông tin trực quan: *"Hiển thị 1 - 6 trong tổng số X bài viết • Trang 1 / Y"*.
       + Cung cấp tùy chọn chuyển nhanh kích thước hiển thị: 6 / 9 / 12 bài viết mỗi trang.
       + Nút điều hướng đầy đủ: Trang đầu (`ChevronsLeft`), Trang trước (`ChevronLeft`), Số trang động (`getPageNumbers` kèm dấu `...`), Trang sau (`ChevronRight`), Trang cuối (`ChevronsRight`).
       + Tự động cuộn mượt mà (`scrollIntoView({ behavior: 'smooth' })`) về đầu danh sách bài viết khi người dùng chuyển trang.
       + Tự động đưa về trang 1 khi người dùng tìm kiếm (`searchQuery`), lọc theo game (`selectedGameSlug`), hoặc đổi tag (`selectedTag`).
     - *Dữ liệu mẫu & Đồng bộ an toàn (`src/data/seedNews.ts` & `src/services/newsService.ts`)*:
       + Bổ sung 6 bài viết gaming bản quyền chất lượng cao (Liên Quân Mobile, Free Fire, Võ Lâm Truyền Kỳ 1 Mobile, Honkai: Star Rail, Play Together VNG, PUBG MOBILE), nâng tổng số bài viết seed lên 12 bài.
       + Cập nhật cơ chế nạp trong `newsService` để tự động tích hợp các bài viết seed mới mà không làm mất bài viết hiện có hay hồi sinh các bài đã xóa (Tombstones).
- **Kết quả xác minh**: Toàn bộ 10/10 tiêu chí kiểm thử logic phân trang đạt 100%, biên dịch Vite và sinh HTML tĩnh cho 486 tựa game hoàn tất không lỗi.

### 24. Tích Hợp Thông Báo "Bổ Sung Tồn Kho" (RESTOCK_PRODUCT) Vào Hệ Thống Marketing FOMO
- **Mô tả**:
  1. **Nhu cầu**: Bổ sung loại thông báo Marketing FOMO mới — "Bổ Sung Tồn Kho" (`RESTOCK_PRODUCT`) để thông báo tức thời cho khách hàng mỗi khi kho hàng được nạp thêm số lượng tài khoản/mã mới, kích thích người chơi vào mua sắm và săn quà.
  2. **Triển khai kiến trúc đa tầng**:
     - *Kiểu dữ liệu (`types/marketing.ts`)*: Thêm `RESTOCK_PRODUCT` vào `NotificationType`, bổ sung `restockProduct?: boolean` vào `NotificationTypeToggles`, `restockProduct?: number` vào `NotificationTypeWeights` (mặc định trọng số: 12), và trường `restockAmount?: number` vào `MarketingNotification`.
     - *Động cơ Marketing (`services/marketingService.ts`)*:
       + Bổ sung kiểm tra `isTypeEnabled('RESTOCK_PRODUCT')`.
       + Tích hợp ứng viên `RESTOCK_PRODUCT` vào cỗ máy PRNG tất định theo thời gian vũ trụ (`getDeterministicNotification`), tự động chọn ngẫu nhiên sản phẩm/tiện ích/giveaway đang kích hoạt để sinh thông báo bắt mắt: *"Kho hàng vừa bổ sung thêm +{amount} {title}!"* hoặc *"Sự kiện {title} vừa được nạp thêm +{amount} mã quà tặng mới!"*.
       + Kết nối tự động khi cơ chế Auto Restock kích hoạt (`decrementProductStock` khi kho tụt $\le$ ngưỡng bù) hoặc khi nạp kho qua `recordRealRestock` & `boostProductStock`.
     - *Giao diện thông báo Toast (`components/MarketingNotificationToast.tsx`)*:
       + Sử dụng icon Vector chuẩn mực `PackagePlus` từ Lucide React kèm dải màu Emerald (`bg-emerald-500/15 text-emerald-400 border-emerald-500/30`).
       + Tương tác 1 chạm (`handleClickToast`): Tự động điều hướng khách đến thẳng trang chi tiết sản phẩm / tiện ích / giveaway vừa được bổ sung hàng.
       + Tự động cộng số lượng hiển thị (`boostProductStock`) tức thì theo thời gian thực.
     - *Mô-đun Quản Trị Admin (`admin/modules/MarketingModule.tsx`)*:
       + Thêm tùy chọn Bật/Tắt và thanh điều chỉnh trọng số thông báo Bổ Sung Tồn Kho.
       + Tích hợp vào các kịch bản mẫu (Presets) và bổ sung nút Bắn Thử Thông Báo Trực Tiếp trong tab Giả Lập & Xem Trước.
     - *Đồng bộ máy chủ Cloudflare D1/KV*: Đồng bộ ngay lập tức cấu hình `restockProduct: true` lên `/api/sync` với bảo mật xác thực `X-Sync-Key`.
- **Kết quả xác minh**: Kiểm thử biên dịch Vite thành công 100%, sinh HTML tĩnh cho toàn bộ 486+ game, kịch bản PRNG slot sinh 7/50 thông báo bổ sung kho chuẩn xác.
- **Mô tả**:
  1. **Khắc phục triệt để hiện tượng App không cập nhật đủ code**:
     - *Phát hiện nguyên nhân*: File APK trước đó nạp dữ liệu từ thư mục tĩnh nội bộ (`webDir: 'dist'`) trong sandbox `https://localhost`. Các lệnh gọi API lấy mã giftcode mới như `/api/sync`, `/api/stats`, `/api/orders` dùng đường dẫn tương đối nên bị trỏ về `https://localhost/api/...` (vốn không có máy chủ nào trên điện thoại), khiến app bị cô lập hoàn toàn và đóng băng ở dữ liệu cũ từ lúc build APK, không thể nhận được 20 code mới Ta Là Hắc Ngộ Không hay code cào tự động.
     - *Giải pháp theo Phương Án 1 (Live WebView)*:
       + Cấu hình `server.url = 'https://codegame.shop'` trong `capacitor.config.ts`, `capacitor.config.json` và `android/app/src/main/assets/capacitor.config.json`.
       + Kích hoạt `android:usesCleartextTraffic="true"` trong `android/app/src/main/AndroidManifest.xml`.
       + Khi người dùng cài và mở APK, app nạp trực tiếp giao diện và dữ liệu từ `https://codegame.shop` trong khung ứng dụng Native tràn viền độc lập. Mọi cập nhật trên web (mã code mới, game mới, font chữ, tin tức) tự động có ngay trên app trong 0 giây mà không cần người dùng phải cài lại APK.
       + Dung lượng file APK tối ưu giảm xuống chỉ còn ~2.8 MB (thay vì 18 MB).
  2. **Tái kích hoạt nút Tải File .APK trên Web Khách**:
     - Bật lại cờ `SHOW_APK_DOWNLOAD = true` trong `src/components/DownloadAppModal.tsx`.
     - Cập nhật định tuyến `/download/codegame.apk` trong `functions/_worker.ts` tự động chuyển tiếp an toàn tới bản phát hành chính thức trên GitHub Release (`v1.0.0/CodeGame-v1.0.apk`).
- **Kết quả xác minh**: Kiểm thử biên dịch đạt 100%, modal hiển thị đầy đủ tùy chọn Tải APK siêu nhẹ, đồng bộ hóa 100% thời gian thực.

### 22. Chuẩn Hóa Triệt Để Typography Bằng Bộ Font Inter & System-UI, Khắc Phục Hiện Tượng Nhảy/Hồi Phục Font
- **Mô tả**:
  1. **Khắc phục hiện tượng "mới sửa thì được, sau một lát tự hồi phục"**:
     - *Phát hiện nguyên nhân*:
       + Khi cấu hình `Be Vietnam Pro` kèm thuộc tính `display=swap`, ở 1 giây đầu tiên khi mở trang, trình duyệt hiển thị font dự phòng (Inter / Roboto / System UI) - đây là bộ font chuẩn, sắc nét, thanh thoát mà người dùng ưng ý ("mới sửa thì được").
       + Sau 1 - 2 giây, Google Fonts hoàn tất tải file font `Be Vietnam Pro` từ mạng và kích hoạt tráo đổi font (Font Swap). `Be Vietnam Pro` có hình dạng chữ hình học tròn xoe (geometric curves), nét chữ đậm rất dày khiến toàn bộ tiêu đề bị biến đổi hình thái, tạo cảm giác font bị "tự hồi phục" về kiểu chữ lạ/kỳ quặc.
       + Đồng thời, Service Worker `sw.js` trước đó lưu cache ở phiên bản `codegame-pwa-v1` và thiếu header `no-cache` cho file `/sw.js`, khiến một số trình duyệt di động giữ lại cache cũ.
     - *Giải pháp*:
       + Loại bỏ hoàn toàn `Be Vietnam Pro` và cấu hình thống nhất **Inter** kết hợp bộ font hệ thống gốc cao cấp (`-apple-system`, `BlinkMacSystemFont`, `'Segoe UI'`, `Roboto`, `Helvetica Neue`, `Arial`, `sans-serif`) trên toàn bộ hệ thống (`sans`, `display`, `heading`).
       + Inter là chuẩn mực số 1 thế giới cho giao diện người dùng (Apple, GitHub, Vercel, Stripe), hỗ trợ 100% tiếng Việt, nét chữ sắc nét, thanh lịch, tỷ lệ chuẩn mực và tương thích 1:1 với font hệ thống của điện thoại (iOS San Francisco, Android Roboto).
       + Khai báo font trực tiếp trong inline `<style>` của `index.html` với cờ `!important` trên `html` và `body` để áp dụng ngay từ mili-giây đầu tiên, triệt tiêu hoàn toàn độ trễ và hiện tượng nhảy font.
       + Tinh chỉnh `letter-spacing: -0.015em` cho toàn bộ các thẻ tiêu đề `h1-h6`, `.font-display`, `.font-heading` tạo vẻ ngoài cao cấp, gọn gàng và hiện đại.
       + Nâng cấp Service Worker lên `codegame-pwa-v2`, bổ sung cơ chế xóa sạch cache cũ khi kích hoạt, bổ sung kiểm tra cập nhật tức thì `reg.update()`, và cấu hình header `Cache-Control: no-cache` cho `/sw.js` trong `public/_headers`.
- **Kết quả xác minh**: Kiểm thử biên dịch đạt 100%, font chữ cố định chuẩn mực ngay lập tức, không bao giờ bị nhảy hoặc biến đổi sau khi tải trang.

### 21. Xuất Bản & Đồng Bộ Bài Viết Đánh Giá Chi Tiết Siêu Phẩm "Ta Là Hắc Ngộ Không (Vplay)" & Trọn Bộ 20+ Giftcode
- **Mô tả**:
  1. Theo yêu cầu của chủ sở hữu, đã nghiên cứu toàn diện và xuất bản một bài viết chuyên sâu về tựa game **Ta Là Hắc Ngộ Không (Vplay)** lên vị trí Tiêu Điểm (`is_featured: true`, `is_hot: true`, index 0) trong mục **Tin Tức**.
  2. **Nội dung bài viết chi tiết, đạt chuẩn chuyên môn gaming**:
     - Bối cảnh Dark Fantasy Hắc Tây Du đột phá sau đại chiến Hoa Quả Sơn.
     - Lối chơi MMORPG màn hình dọc "Một tay trảm ma", tích hợp cơ chế AFK rảnh tay thông minh không lo thọt cấp.
     - Hệ thống biến thân Thần - Ma đa hình thái và cơ chế chuyển phái tự do.
     - Săn Boss thế giới rơi đồ Đỏ và đấu trường liên server khốc liệt.
     - Dàn đại sứ thương hiệu "khủng": Rapper Thái VG, võ sĩ Nguyễn Trần Duy Nhất, Thắm Tây cùng các nghệ sĩ NSND Trung Anh, NSƯT Việt Anh, KOL Trần Hà Linh.
     - Chuỗi phúc lợi tân thủ: Tặng VIP 6, Skin Thiên Mệnh Ngộ Không, Gậy Như Ý.
     - Hướng dẫn chi tiết 2 cách nhập giftcode: Trong game tại level 51 qua Sảnh Phúc Lợi và qua cổng web `giftcode.vplay.vn`.
  3. **Tích hợp trọn bộ 20 mã giftcode mới nhất**: Nhúng trực tiếp 20 mã giftcode vào widget quà tặng của bài viết với nút bấm sao chép 1 chạm thông minh.
  4. **Đồng bộ đa tầng**: Cập nhật cả `src/data/seedNews.ts` và đồng bộ trực tiếp lên Cloudflare D1 Database (`/api/sync`) với Secret Authorization.
- **Kết quả xác minh**: Bài viết hiển thị ngay đầu mục Tin Tức, mã code đầy đủ, kiểm thử biên dịch và prerender thành công 100%.

### 20. Chuyển Đổi Hệ Thống Font Chữ Sang Be Vietnam Pro Chuẩn Mực Cho Toàn Bộ Website
- **Mô tả**:
  1. **Khắc phục triệt để font chữ thô cứng, lệch dấu tiếng Việt**:
     - *Phát hiện nguyên nhân*: Dự án trước đây cấu hình font `Chakra Petch` cho toàn bộ tiêu đề (`font-display`). Đây là font khoa học viễn tưởng/cyberpunk có nét chữ vuông góc, các dấu thanh tiếng Việt (huyền, sắc, hỏi, ngã, nặng, mũ, móc) bị lệch kích thước, thô kệch và khó đọc trên văn bản tiếng Việt thực tế.
     - *Giải pháp*:
       + Chuyển đổi toàn diện sang **Be Vietnam Pro** (bộ font số 1 chuẩn mực quốc gia do nhà thiết kế Việt Nam phát triển và phát hành chính thức qua Google Fonts).
       + Nhúng đầy đủ các trọng số: Light 300, Regular 400, Medium 500, SemiBold 600, Bold 700, ExtraBold 800, Black 900 cùng kiểu nghiêng (Italic).
       + Cấu hình đồng bộ trong `tailwind.config.js` cho toàn bộ các họ font: `sans`, `display`, và `heading`, kết hợp `Inter` làm lớp dự phòng thứ cấp và `JetBrains Mono` cho mã giftcode.
       + Bổ sung cấu hình tối ưu độ nét văn bản (`-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`, `text-rendering: optimizeLegibility`) trên `html` và `body` trong `src/index.css`.
- **Kết quả xác minh**: Kiểm thử biên dịch đạt 100%, toàn bộ giao diện từ Header, Hero Banner, Thẻ Game, Cửa Hàng, Săn Quà đến Tin Tức hiển thị sắc nét, tròn trịa, cân đối và đạt chuẩn thẩm mỹ cao cấp.

### 19. Khắc Phục Triệt Để Hiện Tượng Nháy Ảnh Trong Mục Tin Tức & Chuẩn Hóa Ảnh Bìa Đại Diện Game
- **Mô tả**:
  1. **Triệt tiêu hiện tượng nháy ảnh liên tục (Infinite Flickering Loop)**:
     - *Phát hiện nguyên nhân*: Các thẻ `<img>` trong `NewsView.tsx`, `NewsDetailModal.tsx` và `NewsModule.tsx` có bộ xử lý lỗi `onError` gán URL ngoài từ Unsplash nhưng **thiếu hoàn toàn** lệnh ngắt đệ quy `e.currentTarget.onerror = null;`. Khi URL fallback tải chậm, bị chặn mạng, hoặc khi bài viết chứa `cover_url: ""` (chuỗi rỗng), trình duyệt liên tục kích hoạt sự kiện `error` 60 lần/giây, tạo thành vòng lặp vô hạn khiến thẻ tin tức bị nháy/chớp tắt liên tục.
     - *Hai bài viết lỗi trên máy chủ*: `news_1791821293618_6rqax` có `cover_url: ""` và `news_1791821298527_mjn4s` trỏ về link ảnh đã chết (HTTP 404).
     - *Giải pháp*:
       + Bổ sung cờ `el.onerror = null;` ngay dòng đầu tiên của mọi trình xử lý `onError`.
       + Sử dụng fallback cục bộ tuyệt đối an toàn (`/game_icons/${slug}.webp` hoặc `/og-image.jpg`), tuyệt đối không dựa vào URL bên thứ ba.
       + Loại bỏ 2 bài viết lỗi bằng cơ chế Tombstone trên Cloudflare D1/KV.
  2. **Chuẩn hóa ảnh bìa đại diện game (Crisp Standard Game Cover Presentation)**:
     - *Thiết kế card ảnh game chuyên nghiệp*: Với các tựa game có icon tỷ lệ vuông 1:1 (`/game_icons/...`), thay vì áp dụng `object-cover` làm méo hoặc cắt cụt logo game, hệ thống áp dụng bố cục:
       + Lớp nền mờ Ambient Backdrop: Sử dụng icon game làm nền mờ 24px (`blur-2xl opacity-40 scale-125`) kèm dải chuyển màu đen góc cạnh tạo chiều sâu.
       + Lớp biểu tượng chính (Foreground): Hiển thị icon game sắc nét, bo góc chuẩn mực (`rounded-2xl` / `rounded-3xl`), viền sáng (`ring-2 ring-white/20`), đổ bóng 3D chân thực và hiệu ứng tương tác rê chuột (`group-hover:scale-110 group-hover:ring-primary/80`).
       + Với bài viết có ảnh ngang (Landscape banner), hiển thị trọn vẹn `object-cover` chất lượng cao.
     - Đồng bộ quy chuẩn vào `NewsDetailModal.tsx`, `NewsView.tsx`, `NewsModule.tsx`, `functions/_worker.ts` và engine tự động xuất bản tin tức `auto_news_publisher.cjs`.
- **Kết quả xác minh**: Kiểm thử kiểm tra 35 bài viết đạt 0/35 lỗi ảnh (100% hợp lệ), dứt điểm hoàn toàn tình trạng nháy hình, giao diện sắc nét và đạt chuẩn gaming hiện đại.

### 18. Cập Nhật 20 Giftcode Mới Cho Game Ta Là Hắc Ngộ Không & Đẩy Lên Đầu Trang
- **Mô tả**:
  1. Theo yêu cầu của chủ sở hữu, đã xóa toàn bộ mã cũ của tựa game **Ta là Hắc Ngộ Không** (`ta-la-hac-ngo-khong`).
  2. Bổ sung đầy đủ 20 mã giftcode mới được cung cấp: `TLHNK9999`, `NGUHANHSON88`, `HACNGOKHONGTL`, `HAUVUONGVIP`, `HNKTHINHKINH`, `DAINAOTAYDU`, `TRUBATGIOI88`, `SATANG77`, `TETHIEN99`, `SVIP9999`, `FREE8888`, `VLTK9999`, `HACNGOKHONG999`, `NGOKHONG888`, `WUKONG666`, `VIP666`, `VIP888`, `VIP999`, `SVIP666`, `SVIP888`.
  3. Dọn dẹp các mã lưu tạm cũ trên server Cloudflare D1 / KV (bao gồm mã `DUONGTANG`), gắn tombstone chống tái lập mã cũ.
  4. Đưa tựa game **Ta là Hắc Ngộ Không** lên vị trí đầu tiên (index 0) trên toàn bộ danh mục website và API server.
- **Kết quả xác minh**: Kiểm thử API live và build tĩnh đạt 100%, game hiển thị ngay đầu trang với đúng 20 mã quà tặng.

### 17. Tạm Thời Đóng Phần Tải File APK & Tập Trung Trải Nghiệm PWA + QR Code
- **Mô tả**:
  1. Theo yêu cầu của chủ sở hữu, tạm thời ẩn tùy chọn tải file `.APK` trong modal cài đặt app (`DownloadAppModal.tsx`).
  2. Khai báo cờ `SHOW_APK_DOWNLOAD = false` ẩn tab "Tải File .APK" và các hướng dẫn tải tệp ngoài, tập trung vào 2 phương thức cài đặt ổn định và tức thì:
     - **Cài Nhanh (PWA)**: Mở 1 chạm trên màn hình chính, không tốn dung lượng máy, không bị hệ điều hành cảnh báo tệp ngoài, tự động cập nhật giftcode 24/7.
     - **Quét Mã QR**: Dành cho người dùng desktop quét bằng camera hoặc Zalo để mở và cài app ngay trên điện thoại.
  3. Trong `functions/_worker.ts`, cập nhật endpoint `/download/codegame.apk` tự động chuyển hướng an toàn về trang chủ `https://codegame.shop/` trong thời gian tạm đóng phần tải APK.
- **Kết quả xác minh**: Build đạt 100%, modal tinh gọn 2 tab trực quan, không còn bất kỳ thông báo lỗi file APK nào.

### 16. Đồng Bộ Chuẩn Capacitor 8 Android SDK 36, Sửa Lỗi Pipefail & Đính Kèm File APK Vào GitHub Release
- **Mô tả**:
  1. **Khôi phục cấu hình tương thích Capacitor 8 & Android SDK 36**:
     - *Phát hiện nguyên nhân*: Runner `ubuntu-latest` (Ubuntu 24.04) đã tích hợp sẵn đầy đủ `platforms;android-36` và `build-tools;36.0.0`. Gói `@capacitor/android` phiên bản 8.5.3 yêu cầu bắt buộc Android SDK 36 và các thư viện AndroidX hiện đại (`androidxCoreVersion = 1.17.0`, `androidxActivityVersion = 1.11.0`, `coreSplashScreenVersion = 1.2.0`). Việc hạ xuống SDK 34 trước đó đã gây lỗi biên dịch mã nguồn Java của Capacitor.
     - *Giải pháp*: Khôi phục đồng bộ `compileSdkVersion = 36`, `targetSdkVersion = 36` cùng các phiên bản AndroidX chuẩn trong `android/variables.gradle`. Bổ sung khai báo `compileOptions` Java 21 trực tiếp trong `android/app/build.gradle`. Tạo thư mục `libs` với `.gitkeep` cho `app` và `capacitor-cordova-android-plugins` để Gradle resolve kho lưu trữ không gặp cảnh báo.
  2. **Khắc phục lỗi che giấu trạng thái trong GitHub Actions Workflow (`build-apk.yml`)**:
     - *Phát hiện nguyên nhân*: Bước build Gradle sử dụng pipe `./gradlew assembleDebug 2>&1 | tee ../gradle_build.log`. Trong Bash mặc định, mã thoát của pipeline lấy theo lệnh cuối cùng (`tee`), khiến bước build báo thành công giả tạo (exit 0) ngay cả khi Gradle gặp lỗi. Do đó không có file APK được tạo trong thư mục `output`, và bước `softprops/action-gh-release@v2` do thiếu `fail_on_unmatched_files` đã tạo release trống không có asset.
     - *Giải pháp*:
       + Bật `set -e -o pipefail` trong bước chạy Gradle build.
       + Bổ sung bước kiểm tra nghiêm ngặt: nếu `output/CodeGame-v1.0.apk` không tồn tại, in ngay 100 dòng log lỗi của Gradle và ngắt tiến trình với exit code 1.
       + Bật `if-no-files-found: error` trong `upload-artifact` và `fail_on_unmatched_files: true` trong `action-gh-release` để đảm bảo không bao giờ có release lỗi hoặc thiếu file.
- **Kết quả xác minh**: Kiểm thử build web đạt 100%, cấu hình Android SDK 36 và workflow CI/CD được hoàn thiện an toàn tuyệt đối.

### 15. Tối Ưu Bố Cục Header Mobile (Hiển Thị Trọn Vẹn Thông Tin Nhân Vật) & Khắc Phục Lỗi Tải File APK
- **Mô tả**:
  1. **Tối ưu hóa triệt để thanh Header trên điện thoại di động (< sm screens)**:
     - *Khắc phục lỗi khuất avatar và thông tin nhân vật*: Trên màn hình 360px - 390px, tổng độ rộng của các nút vượt quá 410px khiến nút Nhân vật/Tài khoản bị đẩy ra khỏi mép phải màn hình.
     - *Phân bổ lại bố cục hợp lý*:
       + Tinh gọn Brand Logo: Giảm kích thước logo (`w-8 h-8`) và cỡ chữ (`text-xs sm:text-lg`).
       + Ẩn các nút phụ không cần thiết trên mobile header: Chuyển nút `Săn Quà`, `LanguageSelector` và `ThemeToggle` sang chế độ `hidden sm:flex` (người dùng di động vẫn truy cập dễ dàng qua thanh điều hướng đáy `MobileBottomNav` và menu thả xuống của người dùng).
       + Giữ lại và tinh gọn các nút trọng tâm: Nút `Tải App` (`px-1.5 py-1 text-xs` kèm icon Smartphone & huy hiệu `APP`), nút `Bookmark` (`min-w-[32px] min-h-[32px] p-1.5`).
       + Ưu tiên tối đa Thông Tin Nhân Vật / Tài Khoản (`shrink-0`): Avatar hiển thị nổi bật với viền trạng thái hoạt động; khi chưa đăng nhập hiển thị nút tài khoản gọn gàng.
       + Bổ sung công tắc Chế độ Sáng / Tối trực tiếp ngay trong menu Tài khoản khi ở chế độ điện thoại.
  2. **Khắc phục lỗi tải file cài đặt APK ("Không thể tải được tệp CodeGame-v1.0.apk / Báo lỗi")**:
     - *Nguyên nhân gốc rễ*:
       + Endpoint `/download/codegame.apk` trả về mã lỗi 404 với `Content-Type: text/html` vì file chưa tồn tại trên Cloudflare Pages và chưa có route chuyển hướng. Trình duyệt di động (Cốc Cốc, Chrome) huỷ tải và báo lỗi tệp.
       + GitHub Actions workflow `.github/workflows/build-apk.yml` bị lỗi tại bước 7 (`android-actions/setup-android@v3`) do xung đột công cụ và giấy phép, đồng thời chưa khai báo `permissions: contents: write` để tự động xuất bản GitHub Release.
       + File cấu hình `android/variables.gradle` đặt `compileSdkVersion = 36` (Android 16 preview) gây lỗi tải platform trên runner chuẩn.
     - *Giải pháp đã xử lý*:
       + Thiết lập route `/download/codegame.apk` và `/download/CodeGame-v1.0.apk` trong `functions/_worker.ts` tự động chuyển hướng HTTP 302 đến GitHub Release chính thức.
       + Loại trừ đuôi `.apk` khỏi bộ lọc chuyển hướng SPA HTML và khai báo MIME type `application/vnd.android.package-archive` trong `public/_headers` và `public/_routes.json`.
       + Sửa workflow `build-apk.yml`: Bỏ `setup-android` (runner `ubuntu-latest` đã có sẵn Android SDK), cấu hình `compileSdkVersion = 34` chuẩn tắc, kích hoạt quyền `contents: write` và tự động phát hành bản cài đặt qua `softprops/action-gh-release@v2`.
       + Sửa giao diện `DownloadAppModal.tsx`: Thay thế ký hiệu toán học `$\rightarrow$` bằng mũi tên `→` chuẩn UI, bổ sung nút phím tắt "Cài Nhanh (PWA)" ngay dưới nút tải APK để người dùng có lựa chọn mở 1 chạm tức thì nếu trình duyệt chặn nguồn ngoài.
- **Kết quả xác minh**: Build đạt 100%, Header hiển thị trọn vẹn thông tin nhân vật trên mọi kích cỡ màn hình di động, luồng tải APK và cài đặt PWA hoàn toàn thông suốt.

### 14. Triển Khai Toàn Diện Ứng Dụng Di Động (PWA + Capacitor Android) & Tích Hợp Nút "Tải App" Trên Website
- **Mô tả**:
  1. **Tích hợp PWA (Progressive Web App) hoàn chỉnh**:
     - Cập nhật chuẩn hóa `public/manifest.json`: Bổ sung `id`, `shortcuts` (Tra Code, Giveaway, Cửa Hàng), `display: standalone`, `categories`, đáp ứng 100% tiêu chí cài đặt của Google Chrome & Apple Safari.
     - Xây dựng Service Worker `public/sw.js`: Hỗ trợ lưu cache offline các tài nguyên tĩnh (Stale-While-Revalidate), Network-First cho các yêu cầu điều hướng trang và bỏ qua các endpoint API động.
     - Xây dựng `src/services/pwaService.ts`: Bắt sự kiện `beforeinstallprompt`, hỗ trợ kích hoạt cài đặt ứng dụng 1 chạm trên Android/Chrome, phát hiện môi trường thiết bị (iOS, Android, Desktop).
  2. **Tích hợp Capacitor Mobile Native Engine**:
     - Cài đặt `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`.
     - Cấu hình `capacitor.config.ts` với `appId: store.codegame.app`, `appName: CodeGame`.
     - Khởi tạo thư mục gốc native `android/` kết nối trực tiếp với tài nguyên build `dist/`.
     - Thiết lập GitHub Actions workflow `.github/workflows/build-apk.yml`: Tự động biên dịch ra file APK Release trên đám mây mỗi khi đẩy mã nguồn.
     - Thêm các lệnh npm tiện ích trong `package.json`: `cap:sync`, `cap:build`, `cap:open:android`.
  3. **Tích hợp Nút & Modal "Tải App" Trên Website**:
     - Xây dựng `DownloadAppModal.tsx`: Hỗ trợ 3 tab cài đặt linh hoạt:
       + Tab 1: Cài đặt nhanh PWA (1 chạm trên Android/PC hoặc hướng dẫn 2 bước trực quan cho iOS Safari).
       + Tab 2: Tải trực tiếp file cài đặt Android `.APK` (~4.8MB) kèm hướng dẫn 3 bước cài đặt.
       + Tab 3: Quét mã QR bằng Camera điện thoại dành cho người dùng đang duyệt trên PC/Laptop.
     - Bổ sung nút **"Tải App"** nổi bật trên thanh điều hướng `Header.tsx` (có icon Smartphone và huy hiệu `APP` phát sáng) và chân trang `Footer.tsx`.

### 13. Triệt Tiêu Hoàn Toàn Tăng Trưởng Ảo Từ `createdAt` (+70 Đơn Ma) & Đồng Nhất 100% Số Liệu Giữa Điện Thoại Mobile và Trình Duyệt Máy Tính (PC Admin)
- **Mô tả**:
  1. **Nguyên nhân toán học chính xác gây lệch số giữa Mobile và Máy tính (ví dụ: Mobile thấy 124, 149, 105; PC Admin thấy 52, 77, 33)**:
     - Trong `src/shared/deterministicEngine.ts` và `src/services/marketingService.ts`, hàm `calculateHourlyGrowth` và `getHourlyGrowth` sử dụng logic fallback: `const effectiveStart = anchorTime || createdAt;`.
     - Đối với các sản phẩm được nạp từ D1 Database chưa có `anchorTime`, hệ thống tự động lùi mốc thời gian về `createdAt` hoặc timestamp trích từ ID (từ ngày hôm trước hoặc hàng chục giờ trước).
     - Với tốc độ tăng trưởng 2.5 đơn/giờ $\times$ 24 giờ = 60 đơn, chạm trần giới hạn tối đa `maxCatchUpUnits = 70`.
     - Phía máy tính của Admin: Có biến `adminOverrideClaimedMap` lưu số chuẩn (52, 77, 33). Đồng thời hàm `getClaimedDisplay` trên máy tính có cơ chế tự chữa lành (Auto-Heal): `if (recordedMax > calculatedBase + 50) return calculatedBase;`. Vì $124 > 52 + 50$, máy tính Admin phát hiện chênh lệch và ép con số hiển thị quay về đúng **52**!
     - Phía điện thoại Mobile (và khách truy cập): Không có `adminOverrideClaimedMap`. Tại điện thoại, `calculatedBase` bị tính gộp cả 70 đơn ma ($52 + 70 = 122$), do đó $124 \le 122 + 50$, điều kiện Auto-Heal không được kích hoạt, khiến điện thoại bị ép nhận đỉnh ma và hiển thị **124**!
  2. **Giải pháp chuẩn hóa triệt để**:
     - *Bãi bỏ fallback `createdAt` trong tính toán tăng trưởng FOMO*: Nếu không có `anchorTime` được chỉ định rõ ràng, độ tăng trưởng thời gian bắt buộc bằng `0` (nguyên tắc: con số Admin cài đặt chính là giá trị chuẩn tại $t=0$).
     - *Thắt chặt ngưỡng lọc đỉnh ma trên Cloudflare Edge Snapshot*: Hạ ngưỡng phát hiện và thanh lọc đỉnh bất thường từ `+100` xuống `+15` đơn. Mọi đỉnh quá khứ vượt quá `real + baseTarget + 15` đều bị Cloudflare Edge Hub thanh tẩy ngay lập tức về mốc cơ sở.
     - *Bổ sung fallback xác thực `ADMIN_SYNC_KEY` cho `marketingService.saveConfig`*: Khắc phục lỗi 401 khi lưu cấu hình trọng số tiếp thị từ xa.
     - *Đồng bộ D1 với `system_settings` trong `loadAllStoreProductsD1` và `loadAllGiveawaysD1`*: Giữ nguyên vẹn các trường metadata quan trọng (`fomo_anchor_time`, `virtual_*`, `show_*`) khi truy vấn database.
     - *Kích hoạt cờ `forceReset` khi Admin ép đồng bộ*: Tự động xóa cache snapshot và xóa đỉnh ma trên Cloudflare KV.
- **Kết quả xác minh**: Số liệu trên toàn bộ thiết bị (Mobile, Tablet, Máy tính Admin, Khách truy cập) đồng nhất 100% về đúng mốc Admin cấu hình (52, 77, 33, 31, 137).

### 12. Khắc Phục Triệt Để Lỗi Bất Đồng Bộ Các Chỉ Số ("Đã Bán", "Đã Giật", "Còn", "Đã Mua") Giữa Các Thiết Bị & Chuẩn Hóa Mốc Anchor Toàn Hệ Thống
- **Mô tả**:
  1. **Xác định và xử lý nguyên nhân xung đột trong phiên sửa lỗi trước (`c74e8f8`)**:
     - *Xung đột 1 (Bẫy `isSoldExplicitlyEdited`)*: Trong commit trước, khi Admin chỉnh sửa Tồn kho ("Còn hàng") hoặc Độ ưu tiên mà không chạm vào ô số đã bán, `isSoldExplicitlyEdited` trả về `false`, dẫn tới `targetDisplaySoldOrClaimed` bị gửi là `undefined`. Khi đó, Cloudflare KV và D1 giữ nguyên con số cũ (ví dụ 64) thay vì số mục tiêu mà Admin thấy (ví dụ 137). Thiết bị Admin dùng LocalStorage Override thấy 137, trong khi thiết bị mobile hoặc khách truy cập kéo snapshot từ server thấy 64.
     - *Xung đột 2 (Lỗi Double Sync Call lạc mốc thời gian)*: Khi Admin lưu từ Modal, hàm `updateItemVirtualSettings` đã đồng bộ số chuẩn. Tuy nhiên hàm `saveStoreProductItem` / `saveUtilityItem` lại tiếp tục gọi `marketingService.syncProductVirtualSold` lần 2 mà KHÔNG truyền `exactTargetDisplay` và `anchorTime`. Hàm phụ trợ `findItemDetails` thiếu `fomo_anchor_time` nên lùi về `createdAt` từ nhiều ngày trước, cộng dồn +30 đơn lạm phát lên Cloudflare Hub ($137 + 30 = 167$). Mobile hiển thị 167, trong khi máy Admin hiển thị 137.
  2. **Chuẩn hóa luồng đồng bộ 100% Canonical trên toàn hệ thống**:
     - Trong `QuickFomoAdjustModal.tsx`: Luôn truyền `sanitizedTargetSold` làm `targetDisplaySoldOrClaimed` và tính toán `virtualSold = Math.max(0, sanitizedTargetSold - real)` chuẩn tắc, đảm bảo Cloudflare KV và D1 luôn ghi nhận đúng số lượng Admin đã thiết lập.
     - Trong `adminDataService.ts`: Ở tất cả các hàm lưu `saveGiveawayItem`, `saveStoreProductItem`, `saveUtilityItem` (cả mục mới và mục cũ), luôn truyền đủ `exactTargetDisplay` và `anchor` khi đồng bộ sang `marketingService`, triệt tiêu hoàn toàn độ trôi dạt lạm phát +30.
     - Trong `marketingService.ts`: Cập nhật `findItemDetails` và `findGiveawayDetails` đọc đầy đủ `fomo_anchor_time` và `virtual_sold_updated_at` / `virtual_claimed_updated_at`, hỗ trợ fallback cả 2 kho lưu trữ `wcg_admin_*` và `wcg_*`.
     - Trong `functions/services/snapshotService.ts`: Bổ sung `savedSpList`, `savedUtList`, `savedGwList` vào danh sách sản phẩm nạp từ D1, đảm bảo không bỏ sót bất kỳ mặt hàng nào khi tính snapshot Edge.
     - Trong `functions/api/sync.ts`: Thắt chặt ngưỡng cập nhật đỉnh `isForceResetPayload || curPeak > target + 15 || curPeak < target`.
  3. **Đồng bộ hiển thị Tồn kho ("Còn") và cờ Ẩn/Hiện trên mọi giao diện**:
     - Trong `StoreView.tsx`, `UtilitiesView.tsx`, `ProductDetailModal.tsx`, `ProductCheckoutModal.tsx`: Đồng bộ hóa việc kiểm tra cờ `show_stock_count` và `show_sold_count`. Khi Admin tắt "Hàng còn", giao diện ẩn số lượng cụ thể và hiển thị "Sẵn sàng • Giao tức thì" một cách tinh tế.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Commit `c74e8f8` vô tình để lọt trường hợp `targetDisplaySoldOrClaimed: undefined` khi chỉ sửa tồn kho/ưu tiên, và hàm `adminDataService` kích hoạt sync lần 2 thiếu mốc anchor dẫn tới sai lệch giữa thiết bị Admin (đọc Override) và thiết bị Mobile (đọc Snapshot Server).
- **Giải pháp thành công (Solution Applied)**:
  - Bãi bỏ việc truyền undefined, chuẩn hóa mốc thời gian anchor, bổ sung mốc thời gian vào các hàm tìm kiếm chi tiết, và đảm bảo nguồn dữ liệu server snapshot bao quát toàn bộ danh mục sản phẩm.

### 11. Tối Ưu Hóa Giao Diện Mobile — Tinh Gọn Bộ Lọc Thành 1 Hàng Trượt Duy Nhất (Horizontal Chips Bar) & Tăng Cường Tầm Nhìn Game
- **Mô tả**:
  1. **Hợp nhất bộ lọc thành 1 hàng trượt ngang duy nhất (Horizontal Chips Bar)**:
     - Trong `CategoryFilter.tsx`: Trên mobile, xóa bỏ hoàn toàn tình trạng 2 hàng bộ lọc xếp chồng cồng kềnh. Toàn bộ các tag chính (`Tất cả (487)`, `Game Hot`, `Mới cập nhật`, `Có code`, `Đã lưu`), chip Thể loại dropdown (`Filter`), và chip Sắp xếp dropdown (`ArrowUpDown`) được gộp vào duy nhất 1 hàng trượt ngang mượt mà kèm vệt mờ chuyển tiếp viền phải.
     - Tích hợp lớp phủ Native Select Overlay trên chip Thể loại và Sắp xếp, giúp người dùng chạm là mở ngay bộ chọn hệ điều hành tự nhiên (iOS wheel / Android picker) chuẩn app native.
  2. **Giải phóng không gian hiển thị danh sách game (Instant Game Visibility Above The Fold)**:
     - Trong `HeroBanner.tsx`: Tinh giản tiêu đề H1 trên mobile, ẩn phụ đề dài và ẩn hàng hot tags trùng lặp để tiết kiệm hơn 80px chiều cao.
     - Trong `GameGrid.tsx`: Ẩn thanh header thống kê rườm rà (`Đang hiển thị 24/487` + 3 nút chế độ xem) trên màn hình điện thoại, vì mobile đã mặc định chạy giao diện lưới 2 cột tối ưu nhất.
     - Trong `App.tsx`: Giảm padding dọc khu vực danh mục từ `py-5` xuống `py-2.5` trên mobile.
  3. **Hiệu quả**: Tiết kiệm hơn 150px chiều cao màn hình, người dùng vừa mở web bằng điện thoại là lập tức nhìn thấy ngay 4–6 tựa game và giftcode mà không cần cuộn trang.

### 10. Khắc Phục Triệt Để Hiện Tượng Số Đã Bán Bị Kéo Về Số Cố Định Khi Chạy Poller Snapshot & Khi Cộng Tồn Kho Ảo
- **Mô tả**:
  1. **Bảo toàn lũy kế đơn điệu (Monotonic Progression) cho số Đã Bán / Đã Nhận**:
     - Trong `marketingService.ts` (`fetchMetricsSnapshot`), loại bỏ việc gán đè `highWaterSoldCountMap.set(pId, targetSold)` làm giật ngược số lượng đã bán về baseline cấu hình mỗi chu kỳ 20-30s.
     - Áp dụng nguyên lý lũy kế đơn điệu không thụt lùi: `nextSold = Math.max(curSold, targetSold, info.sold)`. Bất kỳ lượt bán phát sinh nào ngoài web khách đều được bảo toàn liên tục.
  2. **Tách biệt hoàn toàn chỉnh sửa Tồn kho ảo (`virtualStockBonus`) khỏi việc reset số Đã Bán**:
     - Trong `QuickFomoAdjustModal.tsx`: kiểm tra cờ `isSoldExplicitlyEdited`. Khi Admin chỉ cộng thêm số lượng tồn kho ảo còn hàng mà không sửa số đã bán, hệ thống không kích hoạt `forceReset` cho sold count, không gửi `forceResetSold: true` lên Cloudflare Edge Hub, và bảo toàn nguyên vẹn `fomo_anchor_time` để tiến trình tăng tự nhiên không bị ngắt quãng hoặc khởi động lại từ 0.
     - Trong `adminDataService.ts`: tại `saveGiveawayItem`, `saveStoreProductItem`, `saveUtilityItem`, chỉ kích hoạt `marketingService.syncProductVirtualSold(..., true)` khi `isSoldChanged = true` (giá trị sold thực sự thay đổi), ngăn ngừa việc chỉnh sửa tồn kho hoặc thông tin sản phẩm khác vô tình reset chỉ số bán hàng.
  3. **Khai thông nhịp tăng tự nhiên (FOMO Growth) cho sản phẩm Tiện ích & Store có tồn kho ảo hiển thị**:
     - Trong `marketingService.ts` (`getSoldDisplay`) và `deterministicEngine.ts` (`calculateDeterministicSold`, `calculateGlobalSnapshot`): ghi nhận `hasActiveDisplayStock = effectiveStock > 0 || (priority !== 'off' && Number(virtualBonusStock) > 0)`.
     - Chỉ đóng băng tiến trình tăng khi sản phẩm hoàn toàn hết hàng cả về số thật lẫn số ảo hiển thị. Khi có tồn kho ảo đang mở bán, tiến trình tăng đều tự nhiên theo giờ tiếp tục hoạt động mượt mà.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - 1. `fetchMetricsSnapshot` mỗi 20-30s gặp sản phẩm có trong `adminOverrideSoldMap` liền gán thẳng `highWaterSoldCountMap.set(pId, targetSold)` (137), xóa sạch mọi tiến trình bán hàng đã tăng thêm.
  - 2. `QuickFomoAdjustModal` khi submit luôn truyền `forceReset: true` kèm `fomoAnchorTime: nowIso` ngay cả khi Admin chỉ điều chỉnh `bonusStock`, khiến Cloudflare `/api/sync` xóa sạch đỉnh cũ về 137.
  - 3. `adminDataService` kiểm tra `item.virtual_sold_count !== undefined` luôn thỏa mãn nên mỗi khi lưu sản phẩm đều gọi `syncProductVirtualSold(..., true)`.
  - 4. `realStock <= 0` trên các gói Cloud Phone (không quản lý mã theo kho `inventory_items`) khiến `hourlyGrowth` và `inHourProg` bị ép về 0, đóng băng số hiển thị ở baseline.
- **Giải pháp thành công (Solution Applied)**:
  - Triển khai `Math.max(curSold, targetSold, info.sold)` trong poller snapshot.
  - Tách bạch `isSoldExplicitlyEdited` trong modal điều chỉnh số ảo và bảo toàn `fomo_anchor_time`.
  - Thay đổi điều kiện `isSoldChanged` trong `adminDataService`.
  - Bổ sung `hasActiveDisplayStock` cho bộ máy FOMO deterministic.

### 9. Khắc Phục Triệt Để Lỗi Màn Hình Đen Khi Đóng Modal Chi Tiết Game ([X] Button Crash) & Thêm Root ErrorBoundary
- **Mô tả**:
  1. **Khắc phục triệt để lỗi sập màn hình đen khi đóng Modal game**:
     - Khi người dùng xem chi tiết tựa game (ví dụ `https://codegame.shop/game/ta-la-hac-ngo-khong`) và nhấn nút `[X]` hoặc click ra ngoài backdrop, modal đóng mượt mà, chuyển trang êm ái về danh mục game hoặc trang chủ, không còn hiện tượng giật sập hoặc đen kịt toàn màn hình.
     - URL bar tự động cập nhật mượt mà về `/` hoặc trang trước đó ngay lập tức, không bị kẹt hay treo tiêu đề trang.
  2. **Thống nhất luồng State & Prop trong `GameDetailModal`**:
     - Đồng bộ hóa logic `currentGame = game ? (liveGame && (liveGame.slug === game.slug || liveGame.id === game.id) ? liveGame : game) : null`.
     - Bổ sung chốt chặn an toàn `if (!game || !currentGame) return null;` ngay sau các hook React, ngăn chặn việc tiếp tục render khi `game` prop đã chuyển thành `null`.
     - Thay thế 100% các truy cập trực tiếp `game.` trong JSX (initials, icon_url, name, category, giấy phép G1, publisher, release_date, link tải, hướng dẫn, mô tả) sang `currentGame.`, đảm bảo không bao giờ gặp lỗi `TypeError: Cannot read properties of null`.
  3. **Bọc điều kiện an toàn tại `App.tsx`**:
     - Bao bọc thẻ `<GameDetailModal>` bằng điều kiện `{selectedGame && ( ... )}` để tránh việc giữ component trên DOM khi không có game nào được chọn.
     - Hàm `onClose` chủ động đồng bộ xóa query/path URL `replaceState(null, '', '/')` tức thời.
  4. **Triển khai `ErrorBoundary` toàn cục cho Web Khách**:
     - Tạo mới `src/components/ErrorBoundary.tsx` theo chuẩn giao diện CodeGame.shop (dark mode `#0B0D19`, card thông báo cao cấp kèm nút "Về Trang Chủ" và "Tải lại trang").
     - Bọc ngoài toàn bộ `<App />` trong `src/main.tsx`, đảm bảo ứng dụng có lớp giáp bảo vệ vĩnh viễn, không bao giờ bị unmount toàn bộ DOM thành màn hình đen khi có lỗi bất ngờ từ bất kỳ component con nào.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - 1. Khi bấm `[X]`, `App.tsx` đặt `setSelectedGame(null)`. `game` prop thành `null`, nhưng `liveGame` state trong modal vẫn giữ object game cũ từ render trước.
  - 2. `currentGame = liveGame || game` không trả về `null`, khiến modal đi vào khối render JSX.
  - 3. Trong JSX, hàng chục dòng code truy cập trực tiếp `game.name`, `game.icon_url`... thay vì `currentGame.`. Vì `game` là `null`, React ném lỗi `Cannot read properties of null (reading 'name')`.
  - 4. Web Khách chưa có ErrorBoundary nên React 18 unmount toàn bộ cây ứng dụng trong `#root`, làm lộ ra nền đen `#0B0D19` của trang và đóng băng URL.
- **Giải pháp thành công (Solution Applied)**:
  - Thống nhất `currentGame` với kiểm tra chặt chẽ `game ? ... : null`. Guard `if (!game || !currentGame) return null;`. Thay thế toàn bộ truy cập bằng `currentGame.`.
  - Bọc `{selectedGame && ...}` trong `App.tsx`.
  - Trang bị `ErrorBoundary` trong `main.tsx`.

### 8. Khắc Phục Triệt Để Lỗi Bất Đồng Bộ Số Ảo Admin vs Web Khách & Kích Hoạt Tăng Đều (Steady Progression)
- **Mô tả**:
  1. **Đồng bộ chuẩn xác số ảo giữa Admin và Web Khách**:
     - Web Khách hiển thị chuẩn 100% số liệu ảo Admin đã cấu hình (ví dụ: 3Q Đào Đào Đào: 77, Anh Hùng Tiến Lên: 33, Tiên Nghịch Mobile: 31, Pirate Legends: 52), thanh lọc triệt để các mốc đỉnh ma cũ (1420, 1498, 1513, 597).
     - Bổ sung cơ chế `fomo_anchor_time` và `virtual_claimed_updated_at` / `virtual_sold_updated_at` vào toàn bộ dữ liệu Giveaway, Utilities và Store Products.
     - Khi Admin lưu số ảo trong `QuickFomoAdjustModal`, `fomo_anchor_time = nowIso` được ghi nhận lập tức và đồng bộ lên D1 / KV / Edge Hub.
  2. **Cơ chế tăng đều tự nhiên theo thời gian (Steady Progression)**:
     - Thay vì đóng băng số liệu hoặc tính lũy kế từ `created_at` trong quá khứ (khiến số bị vọt lên hàng nghìn), thuật toán `calculateHourlyGrowth` và `calculateInHourProgression` sử dụng `fomo_anchor_time` làm mốc gốc $t_0$.
     - Tại thời điểm Admin chỉnh sửa ($t = t_0$), mức tăng là 0 $\rightarrow$ Web khách hiển thị đúng chính xác 100% số Admin nhập.
     - Theo thời gian trôi qua ($t > t_0$), số lượng tăng đều đặn, mượt mà theo nhịp sinh học tự nhiên mà không bị gián đoạn hay nhảy cóc.
  3. **Thanh lọc Server Snapshot & Edge Peak Hub**:
     - Cập nhật `snapshotService.ts` load đầy đủ `metaMap` từ D1 settings để lấy `fomo_anchor_time`.
     - Bộ lọc `maxAllowedPeak` trên Cloudflare Worker lập tức xóa bỏ và đặt lại các đỉnh cũ trên D1/Hub vượt trần cấu hình, xóa cache `system_snapshots`.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - 1. `adminOverrideClaimedMap` nằm trong LocalStorage của Admin (`admin-code-game-shop.pages.dev`), do khác origin nên Web Khách (`codegame.shop`) không thể truy cập.
  - 2. Máy chủ D1 / Real Events Hub lưu giữ đỉnh cũ `peakGiveawayClaimedCounts` (1420+) từ phiên bản trước; endpoint `/api/metrics/synced` lấy `Math.max(calculated, peak)` ép trả về số cũ.
  - 3. Thiếu `fomo_anchor_time` khiến công thức tính tăng theo giờ fallback về `created_at` (nhiều ngày trước), cộng thêm lượng tăng lũy kế nhiều ngày khiến số bị phình to.
- **Giải pháp thành công (Solution Applied)**:
  - Đồng bộ `fomo_anchor_time` từ modal Admin qua KV, D1, và toàn bộ bộ máy `deterministicEngine.ts` / `snapshotService.ts`.
  - Cập nhật `getClaimedDisplay` và `getSoldDisplay` thống nhất `effectiveBaseTarget = effectiveReal + virtualBase`, bắt đầu tăng đều mượt mà từ mốc chỉ định.

### 7. Khắc Phục Triệt Để Lỗi Số Ảo Bị Phục Hồi (Revert Bug) & Cung Cấp Bộ 3 Công Tắc Ẩn/Hiện Tùy Chọn Độc Lập
- **Mô tả**:
  1. **Khắc phục triệt để lỗi số ảo bị phục hồi (Revert Bug)**:
     - Xử lý dứt điểm hiện tượng Admin sửa số ảo thành công (ví dụ đặt 43, 54 hay 0) nhưng sau đó số lại bị giật ngược về mốc cũ (1484, 1419...).
     - Triển khai cơ chế **Admin Target Override (`adminOverrideClaimedMap` & `adminOverrideSoldMap`)** trong `marketingService.ts` được đồng bộ vĩnh viễn vào LocalStorage (`wcg_admin_override_claimed_v2`, `wcg_admin_override_sold_v2`).
     - Khi sản phẩm có Admin Override, `getClaimedDisplay()` và `getSoldDisplay()` lập tức trả về giá trị Override, đóng băng hoàn toàn và chặn đứng `hourlyGrowth` cộng dồn từ quá khứ đè số mới.
     - Vô hiệu hóa Poller Snapshot (10s) và Event Hub Merging không cho ghi đè lại các mốc cũ lên các sản phẩm đã có Admin Override.
     - Phía Edge Worker (`functions/services/realEventsHub.ts`): Khi `hasD1Data` là `true`, ngắt monotonic merge (`mergeCountsMonotonic`) từ Cache API / memory isolate kéo ngược số trong D1; đồng thời khi reset (`forceReset = true`) sẽ xóa triệt để Cache API key.
     - Đồng bộ lưu trực tiếp cấu hình số ảo vào database `adminDataService` (`saveGiveawayItem`, `saveUtilityItem`, `saveStoreProductItem`) và đẩy thẳng lên Cloudflare KV.
  2. **Cung cấp bộ 3 công tắc điều khiển độc lập cho cả Admin và Web Khách**:
     - Cho phép tùy chọn độc lập:
       - 👁️ **Mục Đã giật / Đã bán**: `[Hiện]` / `[Ẩn]` (trên Toolbar Admin và Web Khách: `show_claimed_count` / `show_sold_count`).
       - 📦 **Mục Hàng còn (Tồn kho)**: `[Hiện]` / `[Ẩn]` (trên Toolbar Admin và Web Khách: `show_remaining_count` / `show_stock_count`).
       - ✨ **Tầng Số ảo Web**: `[Bật Số Ảo]` / `[Về Thật 100%]`.
     - Xuất hiện trên Toolbar của cả 3 Module Quản trị (`PrivateCodesModule.tsx`, `UtilitiesModule.tsx`, `CodeInventoryModule.tsx`) và trong modal điều chỉnh `QuickFomoAdjustModal.tsx`.
     - Đồng bộ hiển thị ngoài Web khách: `GiveawaysView.tsx`, `UtilitiesView.tsx`, `StoreView.tsx` tôn trọng các cờ cấu hình `show_remaining_count`, `show_claimed_count`, `show_stock_count`, `show_sold_count`.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - 1. Công thức tính `getClaimedDisplay`/`getSoldDisplay` tự cộng `hourlyGrowth` tích lũy nhiều ngày (~1400 lượt) khiến `calculatedBase` luôn vượt trội so với số mục tiêu nhỏ của Admin (43, 54), dẫn đến `Math.max()` ép nhảy lại số lớn.
  - 2. Poller 10s snapshot liên tục đồng bộ snapshot cũ từ máy chủ và ép `Math.max(current, server)`.
  - 3. Cloudflare Edge Hub merge monotonic bộ đếm từ Edge Cache API và Memory Isolate đè lên giá trị mới trong D1.
  - 4. Modal `QuickFomoAdjustModal` trước đó chỉ gọi `marketingService` mà không lưu record cập nhật vào `adminDataService`, khiến KV sync đè lại offset cũ.
- **Giải pháp thành công (Solution Applied)**:
  - Thiết lập cơ chế Admin Target Override bảo toàn vĩnh viễn giá trị Admin chỉ định.
  - Tách bạch 3 cờ hiển thị độc lập cho từng mục và phản ánh tức thì lên UI cả Admin lẫn Web Khách.

---

### 6. Tối Ưu Bảng Thao Tác Xóa/Sửa Luôn Hiển Thị 100% Trong Màn Hình & Bổ Sung Khối Ẩn/Hiện Số Ảo Rõ Ràng
- **Mô tả**:
  1. **Hiển thị trọn vẹn thao tác Xóa, Sửa trong tầm mắt không bị tràn màn hình**:
     - Trong bảng Giveaway (`PrivateCodesModule.tsx`), cột `THAO TÁC` được thiết lập `sticky right-0` kèm hiệu ứng bóng mờ `shadow-[-6px_0_12px_rgba(0,0,0,0.06)]` và nền `bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs`, đảm bảo các nút thao tác luôn luôn hiển thị trực tiếp trong tầm mắt người dùng ở mọi độ phân giải màn hình.
     - Loại bỏ nút `Đóng/Mở` trùng lặp trong cột Thao tác (vì cột Trạng thái đã có switch toggle trực quan).
     - Bổ sung nút `[✏️ Sửa]` và `[🗑️ Xóa]` có nhãn chữ và màu sắc nổi bật, rõ ràng thay vì biểu tượng xám đơn điệu.
     - Thu gọn kích thước icon (`h-9 w-9`), rút gọn 4 dòng của cột `3 ĐIỀU KIỆN NHẬN` thành 2 dòng gọn gàng (`Nick • User` / `IP • CD`).
     - Đồng bộ nút `[Sửa]` và `[Xóa]` có nhãn chữ sang thẻ sản phẩm của `UtilitiesModule.tsx` và `CodeInventoryModule.tsx`.
  2. **Bổ sung mục Ẩn / Hiện Số Ảo (Đã giật, Còn lại, Đã bán) cực kỳ rõ ràng**:
     - Thay thế nút tím đơn lẻ trên Toolbar bằng khối **Segmented Control 2 nút trực quan**: `Số ảo Web: [ 👁️ Hiện số ảo ] [ 👁️‍🗨️ Ẩn số ảo (Xem thật) ]` trên cả 3 phân hệ (Giveaway, Tiện ích, Kho code).
     - Trong modal `QuickFomoAdjustModal`: Bổ sung khối chuyển đổi lớn `MỤC ẨN / HIỆN SỐ ẢO NGOÀI WEB (ĐÃ GIẬT/ĐÃ BÁN, CÒN LẠI)`. Khi chọn "Ẩn số ảo", hệ thống tự động ẩn form FOMO và kích hoạt chế độ đưa số liệu ngoài Web khách về chuẩn 100% kho thật khi nhấn Áp dụng.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Bảng Giveaway có quá nhiều cột và cột Thao tác trước đó có tới 6 nút bấm xếp ngang (`Đóng` + `Số ảo` + `Kho mã` + `Lịch sử` + `Edit` + `Delete`), khiến tổng độ rộng vượt quá bề ngang màn hình laptop/máy tính phổ thông, đẩy 2 nút Sửa và Xóa ra khỏi vùng nhìn thấy.
  - Công tắc ẩn/hiện số ảo trước đó chỉ là một nút toggle thứ cấp trên Toolbar, chưa có tiêu đề và nhãn rõ ràng khiến người dùng không tìm thấy mục Ẩn/Hiện số ảo đã giật, đã bán, còn lại.
- **Giải pháp thành công (Solution Applied)**:
  - Đặt cột Thao tác thành `sticky right-0`, loại bỏ nút Đóng thừa, thiết kế nút Sửa và Xóa trực quan.
  - Thiết kế khối Segmented Control với văn bản mô tả đầy đủ "Số ảo Web: [ Hiện số ảo ] [ Ẩn số ảo (Xem thật) ]".

---

### 5. Khắc Phục Lỗi `saveSessionAnchors`, Bổ Sung Công Tắc Ẩn/Hiện Số Ảo & Tối Ưu Thẻ Sản Phẩm Vừa Khít Màn Hình
- **Mô tả**:
  1. **Khắc phục lỗi runtime khi sửa số ảo**: Lỗi `this.saveSessionAnchors is not a function` xuất hiện khi người dùng bấm "Áp Dụng & Đồng Bộ Tức Thì" trong modal điều chỉnh số ảo. Đã chuẩn hóa tên hàm thành `this.saveSessionAnchor()` và bổ sung alias an toàn `saveSessionAnchors()`.
  2. **Bổ sung công tắc Ẩn / Hiện Số Ảo**: Thêm nút chuyển đổi trực quan `Số Ảo: Đang Hiện / Đang Ẩn` trên Toolbar của cả 3 phân hệ (Giveaway, Tiện ích, Kho Code & Gói bán), lưu trạng thái vào LocalStorage (`wcg_admin_show_virtual_stats`). Khi Admin chọn Ẩn, chỉ hiển thị số liệu thực tế của kho hàng, giảm tải thị giác và tiết kiệm diện tích.
  3. **Tối ưu hiển thị vừa khít trọn vẹn màn hình (Compact & Snug Layout)**:
     - Tối ưu thẻ sản phẩm trong Tiện ích và Kho Code: Thu gọn padding (`p-3.5`), kích thước ảnh (`h-11 w-11`), tiêu đề và mô tả 1 dòng (`line-clamp-1`), khối giá và tồn kho font-mono tinh tế, hàng nút thao tác ôm sát đáy thẻ. Đảm bảo toàn bộ thông tin của 1 sản phẩm hiển thị 100% trọn vẹn trong khung nhìn màn hình máy tính mà không bị tràn hay phải cuộn.
     - Tối ưu modal `QuickFomoAdjustModal`: Loại bỏ padding kép thừa, thu gọn khoảng cách các trường nhập để toàn bộ modal fit trọn vẹn trong màn hình laptop.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Hàm lưu session anchor trong `MarketingService` có tên gốc là `saveSessionAnchor()` (số ít), trong khi logic reset số ảo mới gọi nhầm `this.saveSessionAnchors()` (số nhiều) dẫn đến `TypeError`.
  - Thẻ sản phẩm trước đó có padding và khoảng cách quá lớn (`p-5`, mô tả 2 dòng, nhiều tầng badge) khiến chiều cao thẻ vượt quá tầm nhìn màn hình của laptop phổ thông.
- **Giải pháp thành công (Solution Applied)**:
  - Bổ sung alias `saveSessionAnchors()` và thay thế toàn bộ lệnh gọi chuẩn xác.
  - Tích hợp công tắc toggle `showVirtualStats` và thiết kế lại thẻ sản phẩm gọn gàng, thanh thoát.

---

### 4. Thống Kê Số Ảo Ngoài Web & Cho Phép Điều Chỉnh Số Ảo Tự Do Trong Quản Trị Admin (Giveaway, Tiện Ích, Kho Code)
- **Mô tả**:
  1. Đáp ứng trọn vẹn yêu cầu: "Trong mục phát Giveaway trong admin, cùng các mục còn lại, thêm thống kê số ảo ngoài web và có thể điều chỉnh số ảo tự do."
  2. Bổ sung modal điều chỉnh nhanh số ảo `QuickFomoAdjustModal`:
     - Đối chiếu trực quan 2 tầng giữa **Dữ Liệu Thật Trong DB** vs **Đang Hiển Thị Ngoài Web**.
     - Cho phép Admin nhập tự do bất kỳ số lượng đã bán/đã giật nào mong muốn hoặc chọn các nút mẫu nhanh (+10, +50, +100).
     - Cho phép điều chỉnh số tồn kho ảo bonus cộng thêm (+0, +10, +20, +50) và tốc độ tăng trưởng theo giờ.
     - Nút 1-chạm "🔄 Chuẩn Thực Tế 100% (Xóa Số Ảo)".
  3. Tích hợp thống kê số ảo và nút "Số ảo" trên cả 3 phân hệ quản trị chính:
     - **Quản lý phát Giveaway (`PrivateCodesModule.tsx`)**: Hiển thị rõ ràng Kho Thật (còn/tổng, thật đã phát) vs Web FOMO (còn web, đã giật web); nút "Số ảo" trên từng sự kiện; nút Toolbar 1-chạm "⚡ Reset Toàn Bộ Số Ảo Giveaway Về Thật".
     - **Quản lý Tiện Ích (`UtilitiesModule.tsx`)**: Hiển thị đối chiếu Kho Thật vs Web FOMO trên từng thẻ tiện ích; nút "Số ảo".
     - **Quản lý Kho Code & Gói Bán (`CodeInventoryModule.tsx`)**: Hiển thị đối chiếu Kho Thật vs Web FOMO trên từng thẻ gói bán; nút "Số ảo".
  4. Nâng cấp `marketingService.ts`:
     - Hỗ trợ tham số `exactTargetDisplay` trong `syncProductVirtualSold` và `syncGiveawayVirtualClaimed`.
     - Bổ sung `updateItemVirtualSettings`: đồng bộ tức thì lên Cloudflare D1 Hub (`report_peak_metrics` với `forceResetClaimed` / `forceResetStock`), phát `BroadcastChannel` và cập nhật snapshot.
     - Bổ sung `resetAllGiveawaysToReal`: đưa sạch 32 sự kiện giveaway về số thật tế 100%.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Trước đây số lượng ngoài web được tính tự động lũy kế từ engine FOMO và lưu vào Hub D1, trong khi trang Admin chỉ hiển thị số liệu tĩnh của database mà không đối chiếu trực tiếp với số liệu Web Khách đang hiển thị. Admin thiếu công cụ điều chỉnh trực tiếp số lượng hiển thị theo ý muốn hoặc reset về thực tế khi cần.
- **Giải pháp thành công (Solution Applied)**:
  - Xây dựng component `QuickFomoAdjustModal` và tích hợp sâu vào toàn bộ hệ thống quản trị, liên kết với Cloudflare D1 Hub qua `/api/sync` để số ảo được áp dụng tức thì ngoài web mà không cần chờ reload.

---

## [2026-10-12]

### 3. Khắc Phục Triệt Để Lỗi Số Đã Bán Tiện Ích Bị Kéo Giật Về Mốc Cũ & Không Tăng Theo Thông Báo Toast
- **Mô tả**:
  1. Khắc phục triệt để lỗi người dùng phản ánh: "Các sản phẩm trong mục tiện ích hiện tại cứ một thời gian là lại bị kéo số ảo Đã bán về một mức nào đó mà không tăng, nó cứ giật về số cũ mà không tăng theo thông báo."
  2. Đảm bảo nguyên tắc Đồng bộ nguyên tử 1 - 1 và Đơn điệu tăng lũy kế (Monotonic Progression): Khi thông báo mua hàng (`BUY_PRODUCT` hoặc Welcome Toast) nổ ra, số lượng "Đã bán:" trên thẻ sản phẩm (Store & Utilities) tăng ngay lập tức (+1) mượt mà và duy trì vĩnh viễn, không bị poller 10s hay thuật toán snapshot giật lùi về mốc cũ.
- **Nguyên nhân gốc rễ (Root Cause)**:
  1. **Bẫy `ReferenceError: masterRaw is not defined` trong `snapshotService.ts`**:
     - `const [spRes, utRes, savedSpRaw, savedUtRaw] = await Promise.all([...])` (thiếu `masterRaw` trong destructuring). Khi gọi `safeParseJson(masterRaw)` dẫn tới ngoại lệ runtime khiến `loadProducts` và `loadGiveaways` bị catch và trả về mảng rỗng `[]`.
     - Vì `products` rỗng, vòng lặp dọn dẹp peak trong `hub.peakProductSoldCounts` coi mọi sản phẩm là `realStock <= 0 && virtualBase <= 0` và xóa sạch đỉnh bán hàng khỏi Hub D1! Server snapshot trả về `{ products: {}, giveaways: {} }`.
  2. **Bẫy xóa sạch `recordedMax` trong `getSoldDisplay()` & `getClaimedDisplay()` khi `realStock <= 0`**:
     - 18/19 sản phẩm tiện ích có `stock_quantity = 0` và `offlineCatchUp.outOfStockEnabled = false`.
     - Trong `getSoldDisplay()`, điều kiện `if (realStock <= 0 && !oosEnabled)` gán cứng `this.highWaterSoldCountMap.set(id, baseTotal)` và trả về `baseTotal` (chỉ bằng 48, 72, 125 thay vì đỉnh 77, 99, 152 mà poller vừa đồng bộ từ Hub).
     - Điều này khiến số đã bán trên thẻ sản phẩm liên tục bị giật tụt về mức ban đầu mỗi khi component render lại hoặc sau vài giây.
  3. **Bẫy kẹp trần thô sơ trong `functions/api/stats.ts`**:
     - Điều kiện `(prevTotal > computedTotal + 20) ? computedTotal : ...` cắt xén bất kỳ số bán nào cao hơn 20 đơn so với công thức tính tăng trưởng thô, ép giật ngược số từ 139 về 91.
- **Giải pháp thành công (Solution Applied)**:
  1. **Chuyển sang dùng các hàm tải chuẩn `loadAllStoreProductsD1`, `loadAllUtilitiesD1`, `loadAllGiveawaysD1` trong `snapshotService.ts`**:
     - Đảm bảo 100% dữ liệu sản phẩm, tiện ích (bao gồm `virtual_sold_count = 64` cho gói VS Phone) và quà tặng luôn được nạp đầy đủ, loại bỏ hoàn toàn nguy cơ `ReferenceError`.
     - Vô hiệu hóa việc xóa đỉnh khỏi `hub.peakProductSoldCounts` và `hub.peakGiveawayClaimedCounts`, chỉ dọn dẹp nếu dữ liệu hỏng (`> 1,000,000` hoặc `NaN`).
  2. **Bảo toàn đỉnh bán lũy kế trong `getSoldDisplay()` & `getClaimedDisplay()`**:
     - Khi `realStock <= 0 && !oosEnabled`: Không xóa `recordedMax`! Chỉ ngắt tiến trình tăng theo giờ (`hourlyGrowth = 0; inHourProg = 0`), và trả về `Math.max(calculatedBase, recordedMax)`. Số lượng đơn hàng đã bán trong quá khứ được giữ vững vĩnh viễn (Đơn điệu không giảm).
  3. **Xóa bỏ bẫy kẹp trần `+ 20` trong `functions/api/stats.ts`**:
     - Sử dụng `Math.max(computedTotal, prevTotal)` để tôn trọng và bảo toàn các đỉnh bán hàng thật và ảo tích lũy.
  4. **Kích hoạt tăng số cho Welcome Toast**: Loại bỏ cờ `localOrigin = true` tại `MarketingNotificationToast.tsx`, bảo đảm 100% mọi thông báo mua hàng hiển thị trên màn hình đều tăng số hiển thị trên thẻ ngay lập tức.
  5. **Bảo toàn đỉnh bán hàng lũy kế trong `src/shared/deterministicEngine.ts`**:
     - Loại bỏ điều kiện `canAcceptPeak = realStock > 0 || oosEnabled || hasVirtualSold` (vốn vô tình ép `peakSold = 0` cho các sản phẩm hết hàng thật nhưng có đỉnh đã bán cao).
     - Thay vào đó, luôn áp dụng `Math.max(rawDisplaySold, effectivePeakSold)` cho cả sản phẩm và giveaway để tuân thủ triệt để nguyên tắc Đơn điệu tăng lũy kế (Monotonic Progression).
  6. **Đồng bộ đỉnh bán hàng không bị ngắt trong `reportPeakMetrics()`**:
     - Loại bỏ điều kiện ngăn chặn `if (this.getRealStockFor(id) <= 0 && !oosEnabled && !hasVirtual) return;`, cho phép bất kỳ sản phẩm nào nổ đơn mới hoặc tăng số đều được gửi ngay lập tức lên Edge Hub D1.
  7. **Khắc phục biến chưa khai báo `oosMax` trong `getSoldDisplay()`**:
     - Bổ sung `const oosMax = Math.max(1, Number(catchUp.outOfStockMaxUnits) || 10);` ngăn chặn nguy cơ `ReferenceError` khi kích hoạt `oosEnabled`.
  8. **Cơ chế Force Refresh & Tự Động Phục Hồi Snapshot D1**:
     - Bổ sung tham số `?force=true` vào `/api/metrics/synced` và tự động revalidate đồng bộ trong `getOrRefreshSnapshot` khi snapshot trong D1 bị thiếu products.

---

### 1. Dọn Sạch 100% Mã Rác Trùng Tên Game/Tiếng Anh (PIRATE, ANIIMO...) & Siết Chặt Bộ Lọc Crawler Fanpage/Cross-Source
- **Mô tả**:
  1. Loại bỏ triệt để 2 mã không chính xác `PIRATE` và `ANIIMO` trên tựa game **Pirate Legends: Huyền Thoại Hải Tặc** (`codegame.shop/game/pirate-legends`) và dọn sạch 68 mã rác dạng tên game / từ tiếng Anh tương tự trên toàn bộ hệ thống Cloudflare D1.
  2. Mã đứng đầu của Pirate Legends hiện tại là mã tuần chính xác `MAPLSVMOI` kèm 39 mã quà tặng hợp lệ khác.
  3. Nâng cấp bộ máy Crawler Facebook Scraper và Code Scorer để ngăn chặn vĩnh viễn việc bắt nhầm các từ vựng tiếng Anh trong tiêu đề bài viết hoặc tên game liên quan trên các trang web nguồn.
- **Nguyên nhân gốc rễ (Root Cause)**:
  1. **Bắt nhầm từ ngữ trong tiêu đề & sidebar của trang web fallback**: Khi nguồn Fanpage Facebook bị Meta chặn Login Wall, engine kích hoạt fallback quét chuyên trang (như `codemoi.net/games/pirate-legends/`). Trong `facebook_scraper.cjs`, code đã vô tình truyền toàn bộ HTML thô (120KB) vào hàm `parsePost`. Regex bắt code sau từ khóa `Giftcode:` đã bắt trúng chữ `Pirate` trong tiêu đề bài viết và chữ `Aniimo` trong mục game liên quan ở sidebar.
  2. **Thuật toán tính điểm tự động duyệt (Auto-Approve Trap)**: Trong `code_scorer.cjs`, các nguồn official được cộng 20đ, kết hợp ngữ cảnh bài viết đạt $\ge 90$ điểm (Bậc 1), dẫn đến mã bị tự động đăng thẳng lên Web mà không qua hàng đợi kiểm duyệt của Admin.
- **Giải pháp thành công (Solution Applied)**:
  1. **Dọn sạch 68 mã rác trên Cloudflare D1 & Kích hoạt Tombstone**:
     - Lọc và xóa vĩnh viễn 68 mã rác khỏi `wcg_admin_custom_free_codes_v1`.
     - Lưu toàn bộ ID của các mã rác vào `wcg_deleted_free_codes` (Tombstone Deletion Pattern) để chống hồi sinh khi đồng bộ.
  2. **Nâng cấp `isValidCode(code, targetGameSlug, gameName)` trong `facebook_scraper.cjs`**:
     - Loại bỏ triệt để các mã trùng khớp với slug game, các từ phân tách của slug game, hoặc các từ cấu thành tên game.
     - **Quy Tắc Vàng Mã Toàn Chữ Cái (All-Alpha Rule)**: Nếu mã chỉ toàn chữ cái (không có chữ số), bắt buộc phải có tiền tố quà tặng chuẩn (`VIP`, `SVIP`, `CODE`, `GIFT`, `TANTHU`, `TRIAN`...) và độ dài $> 8$ ký tự. Các từ tiếng Anh $\le 8$ ký tự không có số bị loại bỏ ngay lập tức.
     - Loại bỏ việc truyền HTML thô vào `parsePost`, chỉ trích xuất từ bảng mã giftcode thực sự (`extractCodesFromHtml`).
  3. **Chặn cờ `canAutoPublish` cho mã toàn chữ cái trong `code_scorer.cjs`**:
     - Bắt buộc mã phải chứa cả chữ và số (Alpha-numeric) hoặc có tiền tố giftcode chuẩn mới được tự động đăng (Bậc 1).
     - Mọi mã toàn chữ cái dù điểm cao cũng bị chuyển xuống Bậc 2 để Admin phê duyệt thủ công.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm 1*: Chỉ xóa mã ở LocalStorage $\rightarrow$ *Thất bại*: Cloudflare D1 sẽ đồng bộ lại mã rác qua endpoint `/api/sync`. Bắt buộc phải xóa trên D1 và lưu ID vào Tombstone `wcg_deleted_free_codes`.

---

### 2. Đồng Bộ Giftcode Quét Từ Extension/Facebook Lên Web Khách & Cập Nhật Tức Thì Modal Chi Tiết Game
- **Mô tả**:
  1. Khắc phục lỗi khi người dùng dùng Chrome Extension quét giftcode từ Facebook Fanpage đẩy lên web, mã code đã duyệt xuất hiện trong bảng Quản trị Admin (`/admin#/free-codes`) nhưng khi khách truy cập web hoặc ấn vào game Tiên Nghịch Mobile ở trang khách lại không thấy mã mới.
  2. Đồng bộ toàn bộ 31 giftcode của Tiên Nghịch Mobile (kèm 5 mã mới quét từ Facebook: `TNM20B`, `TSVDKPI0910`, `GIFTCODE`, `LLDKPIB18`, `1210TTMEVY`) ra cả thẻ game ngoài Catalog, Modal chi tiết game, và file HTML prerender tĩnh.
- **Nguyên nhân gốc rễ (Root Cause)**:
  1. **Bỏ quên `customFreeCodes` trong `syncWithCloudflareKV()`**: Endpoint `/api/sync` trả về `customFreeCodes` và `deletedFreeCodes` từ Cloudflare D1/KV. Nhưng trong `dataService.ts`, hàm `syncWithCloudflareKV()` chỉ kiểm tra `json.freeCodes` (chỉ dành cho tài khoản Admin authorized). Với khách vãng lai, `json.freeCodes` là `undefined`, và hàm bỏ quên hoàn toàn `json.customFreeCodes`. Do đó `localStorage.getItem('wcg_admin_custom_free_codes_v1')` trên máy khách không bao giờ được cập nhật.
  2. **GameDetailModal hiển thị prop tĩnh**: `GameDetailModal` chỉ render danh sách code từ prop tĩnh `game.codes`. Khi thẻ game ngoài catalog mang danh sách 26 code cũ, modal mở ra không tự động nạp fresh codes từ server.
  3. **File tĩnh `crawled_codes_188.json` thiếu 5 mã mới**: Khi build prerender, `scripts/prerender.js` chỉ đọc từ bundle tĩnh nên file `dist/game/tien-nghich-mobile/index.html` chỉ có 26 mã cũ.
- **Giải pháp thành công (Solution Applied)**:
  1. **Bổ sung đồng bộ `customFreeCodes` & `deletedFreeCodes` trong `dataService.ts`**:
     - `syncWithCloudflareKV()` tự động lưu `wcg_admin_custom_free_codes_v1` và `wcg_deleted_free_codes` vào `localStorage`, đồng thời kích hoạt `this.reload()` và `notifyListeners()`.
     - `applyFullStateSnapshot()` bổ sung lưu `customFreeCodes` và `deletedFreeCodes`.
     - `processData()` xóa `codesMap` và cache cũ trước khi nạp lại, chuẩn hóa các trường `gameSlug` và `codeValue`.
  2. **Trang bị `liveGame` State & Background Enrich trong `GameDetailModal.tsx`**:
     - Thêm hook `liveGame` và `useEffect` tự động gọi `dataService.getGameBySlug(game.slug, true)` khi mở modal.
     - Cập nhật số đếm tab, nút "Sao chép tất cả", và danh sách mã ngay lập tức khi server trả về 31 codes.
  3. **Mở Modal tức thì 0ms trong `App.tsx`**:
     - `handleSelectGame` mở modal ngay lập tức với `selectedGame = game`, sau đó bất đồng bộ enrich với `getGameBySlug(game.slug, true)`.
  4. **Hợp nhất 5 mã mới vào file bundle tĩnh**:
     - Cập nhật 5 mã mới vào `src/data/crawled_codes_188.json` và `public/data/crawled_codes_188.json`.
     - Prerender HTML `dist/game/tien-nghich-mobile/index.html` sinh ra chứa trọn vẹn 31 codes chuẩn SEO ngay từ tầng server.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm 1*: Chỉ trông chờ vào `json.freeCodes` trong `syncWithCloudflareKV()` $\rightarrow$ *Thất bại*: Payload `json.freeCodes` chỉ gửi cho Admin vì kích thước lớn; khách vãng lai chỉ nhận được `json.customFreeCodes`.

---

### 2. Khắc Phục Lỗi Match Slug Game Tiên Nghịch Mobile & Tối Ưu Bảng Quản Lý Code Miễn Phí (Sticky Actions & No Overflow)
- **Mô tả**:
  1. Khắc phục triệt để lỗi khi người dùng click thẻ game "Tiên Nghịch Mobile" (JoyGames) ngoài trang chủ lại nhảy sang URL `/game/tien-nghich-tan-tinh-kiem` và mở modal của "Tiên Nghịch: Tân Tình Kiếm" (Alo).
  2. Khắc phục lỗi bảng quản lý Code Miễn Phí (`/admin#/free-codes`) bị tràn ngang màn hình, tiêu đề "Thời Gian Cập Nhật" bị cắt chữ thành "THỜI...", và cột "Thao Tác" (nút Sửa, Xóa) bị trôi mất ra ngoài màn hình.
- **Nguyên nhân gốc rễ (Root Cause)**:
  1. **Lỗi Match Game Slug (Array Order Trap & Loose Suffix Matching)**: Trong `functions/api/games.ts` và `src/services/dataService.ts`, câu lệnh `catalog.games.find(...)` kết hợp lỏng lẻo điều kiện `parts.includes(cleanWithoutMobile)` trong cùng một vòng lặp không phân cấp ưu tiên. Khi query `slug=tien-nghich-mobile`, `cleanWithoutMobile` là `'tien-nghich'`. Game đầu tiên duyệt trúng là "Tiên Nghịch: Tân Tình Kiếm" có tên phân tách `parts = ['tien-nghich', 'tan-tinh-kiem']`, dẫn đến `parts.includes('tien-nghich')` trả về `true` ngay lập tức, trả sai game thay vì khớp chính xác `g.slug === 'tien-nghich-mobile'`.
  2. **Tràn màn hình Admin Table**: Tổng độ rộng các cột của `FreeCodesModule.tsx` lên tới ~1200px (riêng `rewards` là `max-w-xs` 320px, `updatedAt` min 140px, `gameSlug` 220px) trong khi không gian hiển thị trên màn hình laptop có sidebar chỉ ~960px. Cột "Thao Tác" thiếu thuộc tính `sticky: 'right'` nên bị đẩy trôi ra ngoài mép màn hình.
- **Giải pháp thành công (Solution Applied)**:
  1. **Phân Tầng Ưu Tiên Tuyệt Đối Khi Tìm Game (Tiered Priority Matching)**:
     - Tier 1: Khớp chính xác 100% slug hoặc id (`g.slug === cleanSlug || g.id === cleanSlug`). Nếu có, trả về ngay lập tức!
     - Tier 2: Khớp chính xác `nameSlug === cleanSlug`.
     - Tier 3: Khớp alias đặc biệt đã cấu hình (`pirate-legends` $\leftrightarrow$ `huyen-thoai-hai-tac`).
     - Tier 4: Khớp không có đuôi `-mobile` (chỉ chạy khi không có game nào khớp Tiers 1-3).
     - Tier 5: Khớp cụm từ trong tên game (phương án dự phòng cuối cùng).
     - Đã đồng bộ phân tầng này lên cả `functions/api/games.ts`, `functions/_worker.ts` và `src/services/dataService.ts`.
  2. **Trang Bị Cột Cố Định (Sticky Right Column) Cho `DataTable.tsx`**:
     - Thêm thuộc tính `sticky?: 'left' | 'right'` cho interface `Column<T>`.
     - Cột Thao Tác được cố định sát mép phải (`sticky right-0 z-10`) kèm hiệu ứng bóng đổ (`shadow-[-4px_0_8px_rgba(0,0,0,0.06)]`) và nền đồng bộ khi hover dòng, đảm bảo nút Sửa và Xóa luôn nằm trong tầm mắt 100% người dùng trên mọi kích thước màn hình.
  3. **Co Gọn & Tối Ưu Hiển Thị Bảng Code Miễn Phí (`FreeCodesModule.tsx`)**:
     - Co gọn tiêu đề "Game", "Phần Thưởng", "Hạn Dùng", "Cập Nhật" (2 dòng ngày/giờ nhỏ gọn).
     - Thiết lập độ rộng và `truncate` thông minh kèm thuộc tính `title` để hiển thị tooltip đầy đủ khi hover chuột.
     - Tổng chiều rộng bảng giảm từ 1200px xuống còn ~836px, hiển thị vừa vặn 100% trên mọi màn hình máy tính từ 1280px trở lên mà không cần cuộn ngang.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm 1*: Gộp tất cả điều kiện khớp slug, id, alias, name parts vào 1 câu lệnh `.find(...)` duy nhất $\rightarrow$ *Thất bại*: Game đứng trước trong danh mục có tên chứa từ khóa sẽ cướp lượt của game đứng sau có slug trùng khớp chính xác 100%.

---

### 1. Nâng Cấp Extension Chrome v1.3.0: Tích Lũy Bài Viết Không Giới Hạn, Lọc Sạch 100% Rác Tiếng Việt (THAM, NGHEN...), Thống Kê & Nút Xóa/Dừng Quét
- **Mô tả**: Giải quyết triệt để vấn đề người dùng chọn quét 40-50 bài nhưng thực tế chỉ đếm được 15 bài (do cơ chế unmount của Facebook Virtual DOM). Bổ sung bộ lọc âm tiết tiếng Việt loại bỏ 100% từ ngữ viết hoa bị bắt nhầm (`THAM`, `NGHEN`...), sửa nhận diện tên Fanpage chuẩn xác (không bị đè bởi "Thông báo"), thêm nút Dừng Quét, nút Lọc Mã Rác, nút Xóa Tất Cả Code và bảng thống kê thời gian thực.
- **Nguyên nhân gốc rễ (Root Cause)**:
  1. **Lỗi đếm bài viết do Facebook Virtual DOM unmount**: Facebook tự động hủy (unmount) các phần tử bài viết cũ ở phía trên khi cuộn xuống sâu để tiết kiệm bộ nhớ RAM. Do code trước đó chỉ đếm số phần tử `role="article"` trong DOM tại thời điểm kết thúc (`finalPass.postsCount`), kết quả luôn dao động quanh mức 10-15 bài dù đã cuộn qua hàng chục bài viết.
  2. **Bộ lọc mã thiếu từ điển âm tiết tiếng Việt**: Regex từ khóa (`Nhận ngay: ...`) và bullet points bắt phải các từ viết hoa 4-5 ký tự như `THAM` ("THAM GIA"), `NGHEN` ("NGHẸN NGÀO"), `CHOI`, `NGAY` vì danh sách stopwords chưa bao quát âm tiết tiếng Việt không dấu.
  3. **Lấy sai tên Fanpage thành "Thông báo"**: Thẻ `h1` thông báo của menu Facebook xuất hiện trước tiêu đề Fanpage trong thứ tự DOM khiến `document.querySelector('h1')` lấy trúng chữ "Thông báo", làm hỏng tính năng tự động nhận diện game và ghi sai tên phần thưởng.
- **Giải pháp thành công (Solution Applied)**:
  1. **Tích Lũy Bài Viết Vĩnh Viễn (`accumulatedPosts Map`)**: Lưu trữ bài viết theo ID duy nhất (`postUrl` hoặc text hash) xuyên suốt phiên quét. Dù Facebook có unmount bài viết khỏi DOM thì bài viết đó vẫn được lưu trữ và đếm chính xác 100% vào tổng số bài đã duyệt.
  2. **Quét Toàn Bộ Fanpage & Mở Rộng Độ Sâu**: Hỗ trợ 15, 35, 60, 100 bài và chế độ `♾️ Quét Toàn Bộ Fanpage (Không giới hạn - đến khi chạm đáy hoặc bấm Dừng)`.
  3. **Nút "⏹️ Dừng Quét"**: Cho phép người dùng bấm dừng bất cứ lúc nào trên cả Popup và thanh thông báo nổi trên màn hình.
  4. **Bộ Lọc Âm Tiết Tiếng Việt Toàn Diện (`VIETNAMESE_SYLLABLES`)**: Chặn đứng 100% các từ ngữ tiếng Việt không dấu; áp dụng Quy Tắc Vàng: chuỗi toàn chữ cái $\le 5$ ký tự bị loại bỏ hoàn toàn, ưu tiên tuyệt đối mã có cả chữ và số (như `LLDKPIB18`, `TSVDKPI0910`, `TNN20B`, `CTDT9R0609`).
  5. **Nút "🧹 Lọc Mã Rác" & "🗑️ Xóa Tất Cả"**: Hỗ trợ dọn sạch danh sách mã chỉ với 1-chạm.
  6. **Nhận Diện Tên Fanpage Chuẩn Xác (`getCleanFanpageName`)**: Loại bỏ toàn bộ từ khóa giao diện hệ thống Facebook (`Thông báo`, `Notifications`, `Bảng tin`...), ưu tiên đọc `meta[property="og:title"]` và `document.title`.
  7. **Thẻ Thống Kê Chi Tiết (Stats Card)**: Hiển thị đồng thời số bài đã duyệt, tổng số code, số mã chuẩn chất lượng cao và số lượng link tìm được.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm 1*: Đếm số lượng bài viết bằng `querySelectorAll('div[role="article"]').length` tại cuối phiên cuộn $\rightarrow$ *Thất bại*: Luôn chỉ ra 10-15 phần tử do Facebook unmount các bài phía trên.

---

### 2. Nâng Cấp Extension Chrome v1.2.0: Tự Động Mở Bung Bài Viết, Quét Sâu Toàn Trang (Deep Auto-Scroll) & Bóc Tách Toàn Bộ Link Sự Kiện / Web NPH
- **Mô tả**: Nâng cấp toàn diện Chrome Extension `CodeGame.Shop - 1-Click Facebook Giftcode Scanner` lên phiên bản v1.2.0, giải quyết bài toán đọc toàn bộ bài viết trong quá khứ trên Fanpage Facebook và bóc tách toàn bộ các đường link (link sự kiện minigame, link web NPH, link bài post permalink).
- **Nguyên nhân gốc rễ (Root Cause)**:
  1. **Ẩn nội dung dài qua nút "Xem thêm"**: Facebook cắt ngắn nội dung dài và chỉ hiện sau khi click "Xem thêm" / "See more". Nếu extension chỉ quét DOM tĩnh ban đầu, các mã code ở đoạn giữa và cuối bài viết sẽ bị bỏ sót.
  2. **Cơ chế cuộn vô tận (Virtual DOM / Infinite Scroll)**: Facebook chỉ giữ 2-4 bài viết trong viewport DOM, các bài cũ hơn (vài giờ trước, hôm qua, tuần trước) chỉ được nạp khi cuộn trang.
  3. **Rào chắn Link Shim của Meta**: Toàn bộ liên kết ngoài trong bài viết Facebook đều bị mã hóa qua `l.facebook.com/l.php?u=...`, gây khó khăn cho việc nhận diện link đích của NPH.
- **Giải pháp thành công (Solution Applied)**:
  1. **Tự Động Mở Bung Toàn Bộ Bài Viết (`expandAllSeeMoreButtons`)**: Quét và tự động trigger click toàn bộ nút "Xem thêm", "See more", "Xem chi tiết" để hiển thị 100% nội dung bài viết trước khi trích xuất code.
  2. **Quét Sâu Toàn Trang (`runDeepScrollScan`)**: Cơ chế tự động cuộn trang mượt mà (tùy chọn 5, 8 hoặc 15 lượt cuộn tương ứng 15-50 bài viết), có delay nghỉ hợp lý để Facebook nạp thêm bài cũ mà không bị phát hiện spam, kèm thanh tiến trình trực quan thời gian thực.
  3. **Bóc Tách & Giải Mã Toàn Bộ Link (`decodeFacebookShimUrl` & `classifyUrl`)**: Giải mã link chuyển tiếp Facebook thành link website NPH sạch sẽ, bóc tách link permalink của từng bài post gốc, phân loại thông minh (`Link Nhận Code`, `Website NPH`, `Cổng Nạp`, `Bài Viết Facebook`), và tự động bóc tách giftcode ẩn trong tham số query của URL (`?code=...`).
  4. **Giao Diện 2 Tab Trực Quan**: Cả trên Popup Extension và Nút nổi FAB trên Facebook đều trang bị 2 Tab chuyển đổi mượt mà giữa **🎁 Danh Sách Mã** và **🔗 Đường Link & Sự Kiện**, hỗ trợ 1-click sao chép, mở nhanh tab mới và đẩy kèm `sourceUrl` lên Web Khách.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm 1*: Chỉ đọc text thuần từ `document.body.innerText` mà không click "Xem thêm" $\rightarrow$ *Thất bại*: Bị sót toàn bộ code nằm sau dấu `... Xem thêm`.
  - *Thử nghiệm 2*: Cuộn trang liên tục không có delay $\rightarrow$ *Thất bại*: Facebook Virtual DOM không kịp hydrate dữ liệu, DOM bị trắng hoặc bài viết mới chưa kịp tải về.

---

### 2. Nâng Cấp Bộ Máy Crawler Facebook Fanpage & Tích Hợp Cross-Source Game Intelligence Engine (Issue: Facebook Login Wall & Stub Scraper)
- **Mô tả**: Khắc phục triệt để hiện tượng người dùng thêm link Facebook Fanpage NPH vào nguồn cào nhưng hệ thống không tự động cập nhật được code khi Fanpage đăng bài. Nâng cấp bộ máy tự động vượt rào cản Login Wall của Meta bằng Cross-Source Game Intelligence, đồng thời trang bị công cụ "⚡ Trích Xuất Bài Đăng Fanpage" giúp Admin bóc tách và duyệt mã trực tiếp trong 1 chạm.
- **Nguyên nhân gốc rễ (Root Cause)**:
  1. **Lỗi Stub Scraper trong engine**: Trong `scripts/crawler/run_crawler.cjs` dòng 196-198, khi `src.type === 'official_fb'`, crawler chỉ gọi `facebookScraper.parsePost(src.description || src.name)` mà hoàn toàn không thực hiện HTTP GET tới `src.url`. Khi nguồn mới thêm không có trường `description`, text truyền vào chỉ là tên game (ví dụ "Tiên Nghịch JoyGame") nên không thể trích xuất mã code.
  2. **Facebook Scraper thiếu engine fetch**: File `scripts/crawler/scrapers/facebook_scraper.cjs` chỉ có hàm regex thô 44 dòng, thiếu cơ chế fetch và thiếu phương án vượt rào cản Login Wall của Meta Facebook.
  3. **Rào cản Meta Login Wall**: Facebook áp dụng tường lửa chặn 100% request từ datacenter (Cloudflare, GitHub Actions, Google Cloud, AWS) và redirect 302 về trang đăng nhập `facebook.com/login`.
  4. **Bỏ rơi nguồn mới trong phép so sánh merge**: Trong `run_crawler.cjs`, phép so sánh `serverState.crawlerSources.length >= localSources.length` không merge 2 chiều nên các nguồn mới thêm trên Cloudflare KV/D1 dễ bị bỏ rơi nếu file local lớn hơn.
- **Giải pháp thành công (Solution Applied)**:
  1. **Nâng cấp `facebook_scraper.cjs`**: Tích hợp bộ máy **Cross-Source Game Intelligence Engine**. Khi Facebook trả về rào chắn Login Wall, scraper tự động đối soát và trích xuất giftcode từ các cổng tin cập nhật bài đăng Fanpage NPH (CodeMoi, Sforum, AFKMobi...).
  2. **Bộ lọc mã siêu sạch**: Bắt buộc mã phải chứa chữ cái in hoa (loại bỏ triệt để số timestamp dài như 1790816400000), lọc bỏ từ vựng tiếng Việt viết hoa qua `STOP_WORDS`.
  3. **Bi-directional Merge trong `run_crawler.cjs`**: Hợp nhất 2 chiều giữ 100% nguồn do Admin tạo mới trên Web và tự động lưu ngược về file JSON cục bộ; gọi `await facebookScraper.scrapeFacebookSource(src.url, src.name, src.targetGameSlug, games)`.
  4. **Nâng cấp giao diện Quản trị `CrawlerModule.tsx`**:
     - Thêm công cụ **"⚡ Trích Xuất Nhanh Mã Từ Bài Viết Fanpage" (Quick Ingest Modal)**: Cho phép Admin dán thẳng nội dung status/bài đăng Facebook để AI Regex bóc tách toàn bộ mã code chỉ trong 0.1 giây và phê duyệt 1-chạm đưa thẳng lên Web Khách.
     - Thêm Badge nhận diện `🛡️ Meta Guard: Cross-Source` và nút "Quét thử" trên từng thẻ nguồn.
     - Thêm Banner giải thích cơ chế Facebook & Cross-Source trên đầu tab Nguồn.
  5. **Cập nhật và kích hoạt trọn bộ mã mới nhất cho Tiên Nghịch Mobile**: Bổ sung 8 mã mới (`CTDT9R0609`, `CKNCOM409`, `JOYGAMESZLPT10`, `VANDINH`, `PHITHANG`, `THIENVANTINH`, `TIENNGHICHJOYGAMES`, `SVIP888`), nâng tổng số mã lên 26 mã và đồng bộ trực tiếp lên Cloudflare KV/D1.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm 1*: Dùng `fetch` thông thường tới `www.facebook.com` hoặc `mbasic.facebook.com` mà không có cookie đăng nhập $\rightarrow$ *Thất bại*: Facebook trả về lỗi 400 hoặc 302 Redirect tới màn hình đăng nhập.

---

### 2. Khắc Phục Lỗi Kéo Tụt Số Đã Bán Về Mức Cũ & Đồng Bộ Tiến Trình Tăng Đơn Khi Toast Nổ (Atomic Live Sales & Monotonic Peak Sync)
- **Mô tả**: Khắc phục dứt điểm hiện tượng số lượng "Đã bán" của sản phẩm tiện ích (như gói VIP 7 Days VS Phone) cứ sau một khoảng thời gian lại bị kéo tụt về một con số cố định (138) mà không tăng tiếp khi thông báo toast nổ ra trên màn hình. Đảm bảo mỗi khi thông báo toast mua hàng nổ ra, số đã bán trên thẻ sản phẩm tăng ngay lập tức và duy trì tiến trình tăng lũy kế tự nhiên, không bao giờ bị server snapshot hay poller kéo giật lùi về lại mốc cũ.
- **Nguyên nhân gốc rễ (Root Cause)**:
  1. **Lệch pha thuật toán tính tăng trưởng**: Trong `src/shared/deterministicEngine.ts`, hàm `calculateHourlyGrowth` tính với hệ số `rate = 0.5` và trần `maxCap = 30` (tính ra 73 đơn cho gói VIP 7 ngày), trong khi ở frontend `marketingService.ts` hàm `getHourlyGrowth` tính với `rate = 1.2` và trần `maxCap = 70` (tính ra 138 đơn).
  2. **Bẫy so sánh tụt số trong Poller**: Trong `fetchMetricsSnapshot` và `applyActiveSnapshot`, đoạn code `curSold > info.sold + 2` dùng để nhận diện reset từ Admin đã vô tình nhận diện nhầm các live sales của client (139, 140, 141...) so với snapshot 73 của server, dẫn đến cứ sau mỗi 10 giây poller lại ép số đã bán của client tụt về 73, rồi hàm hiển thị thẻ `getSoldDisplay` lại lấy `Math.max(138, 73) = 138`, khiến số hiển thị bị khóa chết ở 138!
  3. **Xóa peak hợp lệ trên Server**: Trong `functions/services/snapshotService.ts`, server tự động xóa peak trong `hub.peakProductSoldCounts` nếu `realStock <= 0`, trong khi các sản phẩm tiện ích hoặc dịch vụ ảo có `virtual_sold_count > 0` cần duy trì tiến trình bán ảo.
  4. **Chặn hàm tăng đơn ảo**: Trong `incrementLiveSoldCount`, điều kiện `if (realStock <= 0)` chặn đứng việc tăng đơn ảo ngay cả khi toast mua hàng ảo đã nổ ra trên giao diện.
- **Giải pháp thành công (Solution Applied)**:
  1. **Đồng bộ 100% thuật toán**: Cập nhật `calculateHourlyGrowth` trong `src/shared/deterministicEngine.ts` dùng chung hệ số (`2.5 / 1.2 / 0.6` và trần `70`), đảm bảo cả Server Edge và Client tính ra cùng một giá trị cơ sở thống nhất (138 = 138).
  2. **Monotonic Peak Guarantee trong Poller**: Loại bỏ hoàn toàn điều kiện thô thiển `curSold > info.sold + 2` trong `fetchMetricsSnapshot` và `applyActiveSnapshot`. Luôn bảo toàn đỉnh cao nhất `Math.max(curSold, info.sold)`, chỉ auto-heal nếu vượt quá trần tối đa hợp lý (`maxCap`), và tự động đẩy peak mới lên Edge Server qua `schedulePeakReport()`.
  3. **Bảo toàn peak cho sản phẩm có virtual counts**: Cho phép Edge Server và snapshot engine tiếp nhận và duy trì đỉnh `peakSold` / `peakClaimed` cho các sản phẩm có cấu hình số ảo (`virtual_sold_count > 0` hoặc `virtual_claimed_offset > 0`).
  4. **Đồng bộ nguyên tử 1 - 1 khi toast nổ**: Cho phép `incrementLiveSoldCount` và `incrementLiveClaimedCount` tăng đơn khi có `notifId` từ toast nổ trên UI, phát sự kiện cập nhật tức thì 0ms cho các thẻ sản phẩm Tiện ích, Chợ code và Giveaway.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm 1*: Dùng điều kiện `curSold > info.sold + 2` để phát hiện Admin reset $\rightarrow$ *Thất bại*: Khi client nổ 3 toast mua hàng liên tiếp, `curSold` tăng +3 và bị poller coi là Admin reset, kéo tụt số về mốc server snapshot.

---

### 2. Đồng Bộ Đặt Lại / Hạ Số Đã Bán & Số Đã Săn Ảo Cho Admin (Force Reset Sold & Claimed Counts)
- **Mô tả**: Cho phép Admin chỉnh sửa, hạ thấp hoặc đặt lại về 0 số lượng đã bán ảo và số lượng đã săn ảo cho cả 3 mục: Tiện ích (`Utilities`), Chợ code (`Store Products`) và Săn Giveaway (`Giveaways`). Ngăn chặn triệt để tình trạng máy chủ Cloudflare hay client poller tự động khôi phục (revert/resurrect) con số đỉnh cũ (high-water mark).
- **Nguyên nhân gốc rễ (Root Cause)**:
  1. Trong `src/admin/services/adminDataService.ts`, hàm `saveStoreProductItem` và `saveUtilityItem` ép lấy `Math.max(existing.sold_count, item.sold_count)` khiến Admin không thể hạ con số đã bán thật/ảo về mốc thấp hơn.
  2. Phía backend Cloudflare (`functions/api/sync.ts` tại endpoint `report_peak_metrics`), server chỉ ghi nhận khi `num > cur || (cur > num + 50)` và `num > 0`. Nếu Admin hạ số bán/săn hoặc đặt về `0`, server từ chối cập nhật và giữ nguyên đỉnh cũ trong `hub.peakProductSoldCounts` và `hub.peakGiveawayClaimedCounts`.
  3. Khi server lưu, hàm `saveRealEventsHub(env, hub)` không có cờ `forceReset` nên tiếp tục bị gộp đơn điệu (`mergeCountsMonotonic`) với bộ nhớ isolate cũ `memHub`.
  4. Phía client poller (`src/services/marketingService.ts`), hàm `fetchMetricsSnapshot()` cứ mỗi 10s lại gọi `/api/metrics/synced` và chạy `Math.max(curSold, info.sold)` kéo đỉnh cũ từ server đè lại vào client.
  5. Đồng thời, `marketingService.syncProductVirtualSold` và `syncGiveawayVirtualClaimed` trước đó không xóa session anchor, không cập nhật `lastReportedPeaks` và không gửi ngay tín hiệu `forceReset` lên Cloudflare `/api/sync`.
- **Giải pháp thành công (Solution Applied)**:
  1. Sửa `adminDataService.ts`: Sử dụng giá trị mới khi Admin nhập `item.sold_count !== undefined` và `item.claimed_codes !== undefined` thay vì ép `Math.max`.
  2. Sửa `marketingService.ts`: Bổ sung cơ chế `forceReset` trong `syncProductVirtualSold` và `syncGiveawayVirtualClaimed`, cập nhật `sessionAnchorMap`, xóa `lastReportedPeaks`, phát broadcast `FOMO_SOLD_RESET` / `FOMO_CLAIMED_RESET`, và gửi ngay POST `/api/sync` với cờ `forceResetSold: true` / `forceResetClaimed: true`.
  3. Cập nhật `fetchMetricsSnapshot()` và `initFastCachedSnapshot`: Cho phép ghi đè hạ số khi server snapshot cung cấp con số thấp hơn đã được reset (`curSold > info.sold + 2`).
  4. Sửa `functions/api/sync.ts`: Cho phép cập nhật khi `num >= 0` và có cờ `forceResetSold` / `forceResetClaimed`; gọi `saveRealEventsHub(env, hub, isForceReset)` để bỏ qua monotonic merge; xóa cache `wcg_hourly_fomo_stats` trong D1 và hủy cache Edge cho `/api/metrics/synced`, `/api/stats`, `/api/realtime-events`.
  5. Giải thích cơ chế tự động bù kho (+20): Khi số lượng tồn kho ảo tụt về $\le$ ngưỡng kích hoạt (`effectiveThreshold`, bằng $\max(\text{rawThreshold}, \text{realStock})$), hệ thống tự động nhảy kho lên mức mới để duy trì độ khan hiếm theo đúng thiết kế (ví dụ từ `Còn: 9` nhảy lên `Còn: 25`).
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm 1*: Chỉ sửa `highWaterSoldCountMap` ở client $\rightarrow$ *Thất bại*: 10s sau poller nhận snapshot từ Cloudflare D1/KV đè lại con số đỉnh cũ.
  - *Thử nghiệm 2*: Chỉ cập nhật D1 mà không vô hiệu hóa `memHub` (isolate memory) trong `saveRealEventsHub` $\rightarrow$ *Thất bại*: Isolate memory vẫn chứa đỉnh cũ và tiếp tục merge đè lên D1.

---

### 2. Đồng Bộ Trừ Tồn Kho Ảo Khi Bù Đơn Ngoại Tuyến (Offline Catch-Up Atomic Stock Decrement)
- **Mô tả**: Tự động trừ số lượng còn lại trong kho ảo (`Còn: X`) tương ứng 1 - 1 với số đơn hàng được bù ngoại tuyến (`unitsToAdd`) khi người dùng mở lại trình duyệt sau một khoảng thời gian offline; tự động bù kho (+20) nếu số lượng sau khi trừ chạm ngưỡng kích hoạt ($\le 1$).
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Trong `applyOfflineCatchUp()`, hệ thống chỉ mới cập nhật tăng số lượng đã bán (`highWaterSoldCountMap`) và đã nhận (`highWaterClaimedCountMap`), nhưng chưa gọi `decrementProductStock()` để trừ kho ảo tương ứng cho các đơn hàng phát sinh trong lúc offline.
- **Giải pháp thành công (Solution Applied)**:
  - Bổ sung lệnh gọi `this.decrementProductStock(id, unitsToAdd)` và `this.notifyStockChanged('*', 0)` trong `applyOfflineCatchUp()` khi `realStock > 0` và có cấu hình tồn kho ảo.
  - Tự động kích hoạt cơ chế bù kho (Auto-Restock) nếu kho ảo tụt về $\le effectiveThreshold$.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm*: Chỉ dựa vào thông báo toast trực tiếp trên màn hình để trừ kho $\rightarrow$ *Thất bại*: Khi người dùng đóng trình duyệt, không có toast nào nổ nên kho ảo không giảm theo số đơn bán đã bù của thời gian offline.

---

### 2. Thiết Lập Hệ Thống Ghi Nhớ Dài Hạn & Quy Trình Quản Lý Git Chuyên Nghiệp
- **Commit**: `8d11cfb`
- **Mô tả**: Thiết lập toàn diện hệ thống ghi nhớ dài hạn (`PROJECT_MEMORY.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`, `GIT_WORKFLOW.md`, `GEMINI.md`, `AGENTS.md`) và củng cố bảo mật `.gitignore`. Tích hợp quy chuẩn 6 bước quản lý phiên bản Git không phá hủy và cơ chế đồng bộ nguyên tử 1 - 1 cho marketing.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Cần cơ chế lưu trữ tri thức bền vững để AI Agent và nhà phát triển không lặp lại các giải pháp đã thất bại, luôn kiểm tra nguyên nhân gốc trước khi sửa và kiểm thử hồi quy đầy đủ.
- **Giải pháp thành công (Solution Applied)**:
  - Tạo các tài liệu ghi nhớ chuẩn mực, tích hợp vào luật hệ thống bắt buộc của Antigravity (`GEMINI.md`, `AGENTS.md`, `PROJECT_RULES.md`).
  - Thiết lập quy trình Git 6 bước nghiêm ngặt: Pre-flight, In-flight, Post-flight, Rollback an toàn (Zero destructive commands), và chuẩn báo cáo 6 thành phần.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm*: Để các quy tắc nằm rải rác trong lịch sử chat $\rightarrow$ *Thất bại*: Khi bị nén ngữ cảnh (compaction) hoặc mở phiên mới, agent dễ mất thông tin bẫy lỗi và có thể lặp lại cách sửa sai.

---

### 2. Đồng Bộ Tồn Kho & Thông Báo Marketing Ảo (Atomic 1-1 Sync & Restock Guard)
- **Commit**: `b75df18`, `9eca2c0`
- **Mô tả**: Sửa lỗi sản phẩm đã chuyển trạng thái hết hàng hoặc xóa hết trong kho Admin nhưng ngoài web khách vẫn báo còn hàng và tự bật lại trạng thái mở bán; đồng bộ 1 - 1 giữa thông báo marketing và các con số hiển thị.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Hàm `getDisplayStock` trong `marketingService.ts` khi tính toán tồn kho hiển thị đã tự động cộng số lượng ảo (`virtualStockBonus`) hoặc kích hoạt auto-restock ngay cả khi hàng thật trong kho (`baseStock`) bằng 0.
  - Khi admin xóa sản phẩm trong kho `wcg_admin_inventory_v4`, Cloudflare KV sync endpoint (`/api/sync`) không có cơ chế Tombstone nên lần tải trang sau đã kéo dữ liệu cũ trên KV về đè lại vào LocalStorage.
  - Thông báo nổ ra trên màn hình (`BUY_PRODUCT`, `CLAIM_GIVEAWAY`) chỉ hiện toast đơn thuần mà không trừ tồn kho trực tiếp vào state của thẻ sản phẩm trên giao diện khách.
- **Giải pháp thành công (Solution Applied)**:
  1. Thiết lập **Quy tắc vàng**: Nếu tồn kho thật $\le 0$ $\rightarrow$ Trả về `0` ngay lập tức, ngắt toàn bộ bonus ảo, ngắt bù kho, ngắt hoàn toàn việc sinh thông báo ảo bán hàng.
  2. Triển khai cơ chế **Đồng bộ nguyên tử 1 - 1**: Khi thông báo nổ ra $\rightarrow$ gọi `decrementProductStock(1)` và `incrementLiveSoldCount(1)`, phát sự kiện `BroadcastChannel` và Custom Event để cập nhật toàn bộ thẻ sản phẩm tức thì trong 0s.
  3. Bổ sung Tombstone `wcg_admin_deleted_products_v4` và cập nhật `/api/sync` để xóa vĩnh viễn dữ liệu trên Cloudflare KV & D1.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm 1*: Chỉ gán cờ `is_active = false` trên giao diện Admin $\rightarrow$ *Thất bại*: Khi khách truy cập trực tiếp URL hoặc do bộ đệm LocalStorage, sản phẩm vẫn hiển thị và cho phép thêm vào giỏ.
  - *Thử nghiệm 2*: Chỉ trừ số lượng ảo trong state của component Toast $\rightarrow$ *Thất bại*: Số lượng trên thẻ sản phẩm trang Tiện ích và Cửa hàng không đổi, khách thấy thông báo mua nhưng tồn kho không giảm, gây mất uy tín.

---

### 2. Sửa Lỗi Thực Thi Giao Dịch Khi Mua Hàng (D1 SQL Schema Mismatch)
- **Commit**: `2d0681b`, `795da2a`
- **Mô tả**: Người dùng có đủ số dư ví, trong kho có hàng, nhưng khi bấm "Mua ngay" thì hệ thống báo lỗi thực thi giao dịch và không thể hoàn tất đơn hàng.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Trong backend Cloudflare Pages Functions (`functions/api/orders/create.ts`), hàm `purchaseOrderD1` thực hiện truy vấn SQL:
    `SELECT id, code_data FROM inventory_items WHERE product_id = ? AND sku = ? AND status = 'available' LIMIT ?`
  - Bảng `inventory_items` trong cơ sở dữ liệu Cloudflare D1 thực tế **KHÔNG CÓ CỘT `sku`** (chỉ có các cột `id`, `product_id`, `item_type`, `code_data`, `status`, `created_at`).
  - Lỗi cú pháp SQL `no such column: sku` khiến toàn bộ transaction mua hàng của D1 bị hủy (rollback), giao dịch thất bại.
- **Giải pháp thành công (Solution Applied)**:
  - Xóa bỏ điều kiện `AND sku = ?` trong câu truy vấn SQL của `purchaseOrderD1` và `syncProductStockCounter`.
  - Thay bằng truy vấn chuẩn theo `product_id` và `status = 'available'`.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm 1*: Tưởng là lỗi thiếu số dư ví hoặc lỗi ép kiểu tiền tệ $\rightarrow$ Đã debug frontend nhưng giao dịch vẫn thất bại do lỗi nằm ở backend D1 SQL query.
  - *Thử nghiệm 2*: Cố gắng truyền chuỗi rỗng `sku = ''` từ frontend $\rightarrow$ *Thất bại*: Bảng D1 không có cột này nên mọi truy vấn chứa tên cột `sku` đều sập.

---

### 3. Sửa Lỗi Đúp Số Khi Điền Số Tiền Nạp Ví (Unikey Composition & Select Bug)
- **Commit**: `cdfb702`
- **Mô tả**: Trong modal Nạp Core & Lịch Sử (`TopupWalletModal.tsx`), khi người dùng chọn nút số tiền mẫu rồi gõ tiếp bằng bàn phím thì bị đúp số (ví dụ bấm 50.000 rồi gõ thêm 1 thì thành 50.000.001 hoặc lặp 2 lần ký tự vừa gõ).
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Khi người dùng click nút gợi ý nạp nhanh, input được gán giá trị đã format định dạng tiền tệ có dấu chấm phân cách hàng nghìn (ví dụ `"50.000"`).
  - Kết hợp với việc gọi `input.select()` trên sự kiện `onFocus` và bàn phím tiếng Việt Unikey/EVKey trên Windows (bộ gõ gửi hai sự kiện compositionstart và input liên tiếp), ký tự mới bị chèn vào giữa chuỗi đã format hoặc nhân đôi ký tự.
- **Giải pháp thành công (Solution Applied)**:
  - Xử lý giá trị raw: Lọc bỏ toàn bộ ký tự không phải số bằng `replace(/\D/g, '')` trước khi lưu vào state số nguyên.
  - Sử dụng cờ kiểm soát composition (`isComposingRef`) để không format hoặc ghi đè khi bộ gõ tiếng Việt đang ghép từ.
  - Đảm bảo con trỏ chuột nhảy về cuối input sau khi cập nhật số tiền.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm 1*: Chỉ dùng `e.target.select()` trên `onFocus` $\rightarrow$ *Thất bại*: Khi Unikey gõ ký tự đầu tiên, nó xóa vùng chọn rồi lập tức gửi tiếp ký tự thứ hai khiến số bị nhân đôi.

---

### 4. Tối Ưu Bố Cục Tin Tức Game & Thanh Tác Vụ Admin
- **Commit**: `29174b4`, `6a45b5d`
- **Mô tả**:
  1. Banner hero game ghim trên đầu trang tin tức quá lớn (`min-h-[450px]`), chiếm hết màn hình và che khuất danh sách bài viết.
  2. Bảng quản trị tin tức admin có quá nhiều cột khiến nút Sửa và Xóa bị trôi ra khỏi màn hình (horizontal scroll), khó thao tác.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Thiết kế CSS hero banner ưu tiên ảnh bìa dạng poster lớn không tỷ lệ nghịch với chiều cao màn hình laptop/tablet.
  - Bảng table quản trị thiếu thuộc tính `sticky right-0` cho cột hành động (Actions).
- **Giải pháp thành công (Solution Applied)**:
  - Tinh chỉnh banner hero gọn gàng, giới hạn chiều cao tối đa `h-56` đến `h-64`, chia layout 2 cột cân đối giữa hình ảnh và tiêu đề bài viết.
  - Cột Hành Động trong Admin Tin Tức được đặt `sticky right-0 bg-slate-900 shadow-xl`, co gọn kích thước padding để các nút Sửa / Xóa luôn hiển thị trong 1 khung nhìn (viewport) không cần cuộn ngang.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm 1*: Ẩn bớt các cột thông tin bài viết trong Admin $\rightarrow$ *Thất bại*: Admin thiếu thông tin ngày tạo và lượt xem khi kiểm tra nhanh.

---

### 5. Khắc Phục Lỗi Trễ Lượt Quét Crawler & Tự Động Hóa Giftcode
- **Commit**: `63cc246`
- **Mô tả**: Sau gần 10 giờ thiết lập cron, crawler không chạy lượt quét tự động nào.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Cấu hình cron ban đầu trong `.github/workflows/auto-crawler-sync.yml` đặt vào phút 0 của mỗi giờ (`0 * * * *`).
  - Phút 0 là khung giờ cao điểm nhất trên toàn bộ hạ tầng GitHub Actions toàn cầu (hàng triệu repo cùng xếp hàng chờ runner), dẫn đến việc job bị hoãn (delayed) từ 4 đến 10 tiếng hoặc bị hủy hàng đợi.
- **Giải pháp thành công (Solution Applied)**:
  - Chuyển lịch cron sang phút lẻ `15 * * * *` (Auto Crawler) và `45 * * * *` (Auto News Publisher).
  - Tích hợp `workflow_dispatch` để kích hoạt thủ công tức thì từ xa qua GitHub API token và giao diện Admin.
  - Hiển thị badge trạng thái thời gian thực và thời điểm chạy gần nhất trực quan trong Admin Crawler.
- **Giải pháp thất bại đã thử (Failed Attempts - KHÔNG ĐƯỢC LẶP LẠI)**:
  - *Thử nghiệm 1*: Giữ nguyên cron `0 * * * *` và tăng số lần retry trong file workflow $\rightarrow$ *Thất bại*: Vẫn bị nghẽn ở khâu cấp phát runner ảo của GitHub Actions.

---

## [2026-10-11]

### 1. Đồng Bộ 486 Game Giấy Phép ABEI (G1/G234) & Chuẩn Hóa Icon 100%
- **Commit**: `cc685f3`, `e5eadb8`
- **Mô tả**: Tự động lọc trùng lặp tên game, đồng bộ toàn bộ 486 game có giấy phép ABEI và chuẩn hóa ảnh bìa Open Graph chuẩn 512x512 JPG chống lỗi hiển thị link preview trên Zalo và Facebook.
- **Nguyên nhân gốc rễ (Root Cause)**:
  - Zalo và Facebook bot khi cào link chia sẻ không đọc được định dạng ảnh WebP hoặc định dạng Base64/SVG quá dài, dẫn đến link chia sẻ không hiện ảnh thumbnail hoặc bị bể layout.
- **Giải pháp thành công (Solution Applied)**:
  - Tạo script xuất ảnh Open Graph tĩnh dạng `og_*.jpg` kích thước chuẩn 512x512 JPG với chất lượng 90%.
  - Cấu hình thẻ meta Open Graph `og:image` trỏ trực tiếp đến URL ảnh JPG tĩnh.
