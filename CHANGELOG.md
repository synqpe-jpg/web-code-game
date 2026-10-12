# CHANGELOG.md — Nhật Ký Thay Đổi & Lịch Sử Sửa Lỗi Dự Án

Toàn bộ các cập nhật, tính năng mới, và lịch sử sửa lỗi được ghi lại chi tiết tại đây.
Mỗi mục sửa lỗi đều ghi nhận **Nguyên nhân gốc rễ (Root Cause)**, **Giải pháp thành công (Solution)**, và **Giải pháp đã thất bại (Failed Attempts)** nhằm đảm bảo không bao giờ lặp lại sai lầm trong tương lai.

---

## [2026-10-12]

### 1. Khắc Phục Lỗi Kéo Tụt Số Đã Bán Về Mức Cũ & Đồng Bộ Tiến Trình Tăng Đơn Khi Toast Nổ (Atomic Live Sales & Monotonic Peak Sync)
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
