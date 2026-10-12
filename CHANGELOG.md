# CHANGELOG.md — Nhật Ký Thay Đổi & Lịch Sử Sửa Lỗi Dự Án

Toàn bộ các cập nhật, tính năng mới, và lịch sử sửa lỗi được ghi lại chi tiết tại đây.
Mỗi mục sửa lỗi đều ghi nhận **Nguyên nhân gốc rễ (Root Cause)**, **Giải pháp thành công (Solution)**, và **Giải pháp đã thất bại (Failed Attempts)** nhằm đảm bảo không bao giờ lặp lại sai lầm trong tương lai.

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
