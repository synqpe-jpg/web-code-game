# KNOWN_ISSUES.md — Danh Mục Lỗi Đã Biết, Bẫy Cần Tránh & Quy Trình Kiểm Thử

> **CẢNH BÁO BẮT BUỘC DÀNH CHO AI AGENT VÀ DEVELOPER**:
> Trước khi thực hiện bất kỳ thao tác sửa đổi nào:
> 1. **BẮT BUỘC ĐỌC** danh mục lỗi dưới đây để không bao giờ lặp lại các cách sửa đã thất bại.
> 2. Nếu vấn đề chưa rõ nguyên nhân: **ĐIỀU TRA & THU THẬP THÔNG TIN TRƯỚC**, tuyệt đối không sửa mò hoặc tự ý viết lại mã nguồn không liên quan.
> 3. Sau khi sửa: Thực hiện đầy đủ các bước trong **Post-flight Checklist** trước khi báo cáo hoàn thành.

---

## 1. DANH MỤC LỖI & CÁC BẪY ĐÃ THẤT BẠI (DO NOT REPEAT)

### ISSUE-001: Bất đồng bộ tồn kho thật vs tồn kho ảo (Ghost Stock & Data Resurrection)
- **Triệu chứng**:
  - Admin đã chuyển trạng thái sản phẩm sang hết hàng hoặc xóa hết sản phẩm trong kho `inventory`, nhưng web khách vẫn báo còn hàng, vẫn cho mua, hoặc sau khi F5 lại tự nhảy về trạng thái còn hàng.
- **Nguyên nhân gốc rễ**:
  - `marketingService.getDisplayStock` tự động cộng thêm số lượng tồn kho ảo (`virtualStockBonus`) hoặc kích hoạt auto-restock khi không kiểm tra chặt chẽ `baseStock <= 0`.
  - Phía backend Cloudflare KV (`/api/sync`) thiếu cơ chế Tombstone nên dữ liệu cũ trên KV bị merge ngược lại vào LocalStorage của client.
- **Giải pháp chuẩn đã kiểm chứng**:
  - **Quy tắc vàng**: Bất kể cấu hình ảo là gì, nếu `baseStock <= 0` $\rightarrow$ Trả về `0` ngay lập tức (`liveVirtualStockMap.set(id, 0); return 0;`), ngắt hoàn toàn bonus, ngắt auto-restock, ngắt thông báo mua ảo.
  - Sử dụng cơ chế Tombstone (`deletedIdsSet`) gửi lên `/api/sync` để xóa triệt để trên Cloudflare KV & D1.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không được chỉ gán cờ `is_active = false` trên UI mà bỏ qua hàm `getDisplayStock`*: Khách vẫn thấy tồn kho ảo hiển thị trên thẻ sản phẩm.
  - ❌ *Không được chỉ xóa sản phẩm ở LocalStorage mà không gửi Tombstone lên Cloudflare KV*: Lần đồng bộ tiếp theo KV sẽ "hồi sinh" lại dữ liệu vừa xóa.

---

### ISSUE-002: Lỗi SQL D1 khi mua hàng (`no such column: sku`)
- **Triệu chứng**:
  - Khách có đủ số dư ví, kho còn hàng, nhưng khi nhấn "Mua ngay" thì hệ thống báo lỗi thực thi giao dịch và không trừ hàng, không trừ tiền.
- **Nguyên nhân gốc rễ**:
  - Schema bảng `inventory_items` trong cơ sở dữ liệu Cloudflare D1 không có cột `sku` (chỉ có `id`, `product_id`, `item_type`, `code_data`, `status`, `created_at`).
  - Câu lệnh SQL trong `functions/api/orders/create.ts` truy vấn `WHERE product_id = ? AND sku = ?` làm sập transaction.
- **Giải pháp chuẩn đã kiểm chứng**:
  - Truy vấn theo `product_id` và `status = 'available'`, loại bỏ triệt để mọi điều kiện `AND sku = ?` khỏi SQL query D1.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không được sửa frontend truyền chuỗi rỗng `sku = ''`*: Bảng D1 không có cột `sku` nên câu lệnh SQL vẫn sập runtime.
  - ❌ *Không được đổ lỗi cho số dư ví hoặc ép kiểu tiền tệ mà chưa kiểm tra SQL log của Cloudflare D1*.

---

### ISSUE-003: Lỗi đúp số khi nhập số tiền nạp ví với bộ gõ tiếng Việt (Unikey/EVKey)
- **Triệu chứng**:
  - Trong modal nạp tiền, người dùng chọn số tiền mẫu (ví dụ 50.000) rồi gõ thêm số thì bị nhân đôi ký tự hoặc chèn sai vị trí (ví dụ gõ 1 thành 5000011).
- **Nguyên nhân gốc rễ**:
  - Bộ gõ tiếng Việt trên Windows (Unikey, EVKey) gửi sự kiện `compositionstart`, `compositionupdate`, `compositionend` kết hợp với `onChange`.
  - Nếu kết hợp với `input.select()` trên `onFocus` và format chuỗi có dấu chấm phân cách, Unikey xóa vùng chọn rồi chèn lại ký tự cũ kèm ký tự mới.
- **Giải pháp chuẩn đã kiểm chứng**:
  - Lọc bỏ ký tự không phải số bằng regex thô `replace(/\D/g, '')`.
  - Sử dụng cờ `isComposingRef` để bỏ qua xử lý định dạng khi Unikey đang ghép ký tự tiếng Việt.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không được dùng `e.target.select()` trên sự kiện `onFocus` của trường nhập tiền*: Gây xung đột nghiêm trọng với Unikey/EVKey.

---

### ISSUE-004: Nghẽn hàng đợi GitHub Actions Cron khi đặt vào phút 00 (`0 * * * *`)
- **Triệu chứng**:
  - Thiết lập cron tự động quét giftcode và xuất bản tin tức nhưng chờ 4 - 10 tiếng không thấy workflow nào được kích hoạt.
- **Nguyên nhân gốc rễ**:
  - Phút 00 của mỗi giờ là thời điểm hàng triệu repository trên toàn cầu cùng chạy cron, gây quá tải bộ lập lịch (scheduler queue) của GitHub Actions.
- **Giải pháp chuẩn đã kiểm chứng**:
  - Đặt lịch cron vào các phút lẻ: `15 * * * *` (cho Auto Crawler) và `45 * * * *` (cho Auto News Publisher).
  - Tích hợp `workflow_dispatch` để cho phép kích hoạt tức thì từ API và nút bấm thủ công.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không được giữ nguyên cron `0 * * * *` và tăng retry timeout*: Vấn đề nằm ở khâu cấp phát máy chủ ảo của GitHub, tăng timeout chỉ làm nghẽn thêm.

---

### ISSUE-005: Offline Catch-Up làm tăng vọt số lượng ảo phi thực tế
- **Triệu chứng**:
  - Sau một đêm hoặc khi người dùng mở lại trang sau thời gian dài offline, số lượng đã bán hoặc đã nhận mã tăng vọt từ 2 lên 70 đơn trong 1 giây.
- **Nguyên nhân gốc rễ**:
  - Thuật toán tính toán số lượng trôi qua theo thời gian (`getHourlyGrowth`) không có trần giới hạn (cap) tối đa cho mỗi phiên truy cập.
- **Giải pháp chuẩn đã kiểm chứng**:
  - Thiết lập chặn trần tối đa nghiêm ngặt (`oosMax`, `maxCatchUpUnits` tối đa không vượt quá 30 - 70 đơn).
  - Nếu hàng thật hết (`realStock <= 0`), ngắt toàn bộ in-hour progression và khóa trần `hourlyGrowth`.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không được để thuật toán tính bù thời gian lũy kế tuyến tính không giới hạn trần*.

---

### ISSUE-006: Lỗi Stacking Context và Trôi Màn Hình (Overflow) trong Admin
- **Triệu chứng**:
  - Modal chỉnh sửa bị che khuất bởi sidebar hoặc menu dropdown; các nút Sửa / Xóa trong bảng quản trị bị trôi ra khỏi màn hình bên phải.
- **Nguyên nhân gốc rễ**:
  - Modal lồng sâu trong component con bị giới hạn bởi `overflow: hidden` hoặc `z-index` của cha.
  - Bảng dữ liệu có quá nhiều cột nhưng không có `sticky` cho cột hành động.
- **Giải pháp chuẩn đã kiểm chứng**:
  - Sử dụng React `createPortal(modal, document.body)` để đưa modal lên thẳng root của DOM.
  - Thêm class `sticky right-0 bg-slate-900` cho cột Thao tác (Actions) trong các bảng quản trị.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không tăng `z-[999999]` bên trong component con bị che bởi parent có `overflow: hidden`*: Thuộc tính z-index không thể vượt qua ngữ cảnh xếp chồng (stacking context) của cha.

---

### ISSUE-007: Khóa đỉnh số đã bán/đã săn ảo và tự động khôi phục số cũ khi Admin chỉnh sửa (Peak Lock & Revert Bug)
- **Triệu chứng**:
  - Admin chỉnh sửa giảm số lượng đã bán ảo (`virtual_sold_count` trong Utilities hoặc Store Products) hoặc số lượng đã săn ảo (`virtual_claimed_offset` trong Giveaways), nhưng chỉ vài giây sau trang web tự nhảy lại con số cũ (ví dụ 139), không thể đặt về mức thấp hơn hoặc về 0.
- **Nguyên nhân gốc rễ**:
  - Admin save hàm `saveStoreProductItem` và `saveUtilityItem` ép lấy `Math.max(existing.sold_count, item.sold_count)`.
  - Phía Cloudflare API `report_peak_metrics` chỉ nhận cập nhật nếu `num > cur || (cur > num + 50)` và `num > 0`, từ chối cập nhật khi Admin giảm nhẹ hoặc về 0.
  - Hàm `saveRealEventsHub` tự động monotonic merge với bộ nhớ isolate cũ `memHub`.
  - Client poller chạy định kỳ 10s lấy snapshot từ Cloudflare và ép `Math.max(curSold, info.sold)` kéo số cũ đè lại LocalStorage.
  - Cho phép Admin ghi đè trực tiếp giá trị mới không qua `Math.max`.
  - Bổ sung cờ `forceResetSold: true` và `forceResetClaimed: true` trong API `/api/sync`.
  - Vô hiệu hóa `memHub` monotonic merge khi có cờ `forceReset` trong `saveRealEventsHub(env, hub, true)`.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không chỉ sửa LocalStorage ở client mà không cập nhật Cloudflare KV/D1 Hub*: Poller 10s sẽ kéo đỉnh cũ về ghi đè lại.
  - ❌ *Không chỉ sửa D1 mà quên vô hiệu hóa isolate memory `memHub`*: Bộ nhớ in-memory của Cloudflare Worker sẽ merge đè lại đỉnh cũ vào D1 trong các request tiếp theo.

---

### ISSUE-008: Xung đột Poller Snapshot kéo tụt số lượng đã bán của Live Toasts & Bẫy Kẹp Trần Rubber-Band (+10 / +15)
- **Triệu chứng**:
  - Khách đang xem web, thông báo toast nổ ra "vừa mua thành công..." nhưng số đã bán trên thẻ sản phẩm (đặc biệt là Tiện ích) không tăng lên hoặc cứ nhảy lên được 1-2 đơn lại bị giật lùi về con số cũ cố định (ví dụ 138-139), hoặc cứ một thời gian số ảo đã bán lại bị kéo lùi về mức ban đầu.
- **Nguyên nhân gốc rễ**:
  - `loadProducts(env)` và `loadGiveaways(env)` trong `snapshotService.ts` bị lỗi `ReferenceError: masterRaw is not defined` do thiếu biến trong destructuring `Promise.all`. Lỗi runtime khiến hàm trả về `[]`, dẫn đến vòng lặp dọn dẹp peak xóa sạch `hub.peakProductSoldCounts` trên D1!
  - Bẫy xóa sạch `recordedMax` trong `getSoldDisplay()` & `getClaimedDisplay()` khi `realStock <= 0 && !oosEnabled`: 18/19 tiện ích có `stock_quantity = 0`, nên mỗi khi render lại hàm tự ý gán `recordedMax = baseTotal` (48, 72, 125) thay vì giữ đỉnh (77, 99, 152).
  - Bẫy kẹp trần nhân tạo quá hẹp: `maxAllowedCap = maxCatchUp + 10` trong `getSoldDisplay()`, `maxCap = maxCatchUp + 15` trong poller, `maxAllowed = maxCatchUp + 15` trong `snapshotService.ts`, và `(prevTotal > computedTotal + 20)` trong `stats.ts`.
  - Initial Welcome Toast trong `MarketingNotificationToast.tsx` bị gán nhầm `(welcomeData.notif as any).localOrigin = true;`, ngăn cản toast gọi `recordVirtualSale`.
- **Giải pháp chuẩn đã kiểm chứng**:
  - `loadProducts` và `loadGiveaways` trong `snapshotService.ts` chuyển sang dùng `loadAllStoreProductsD1`, `loadAllUtilitiesD1`, và `loadAllGiveawaysD1` chuẩn từ `d1_service.ts`.
  - Vô hiệu hóa việc xóa đỉnh khỏi `hub.peakProductSoldCounts` và `hub.peakGiveawayClaimedCounts`, chỉ dọn dẹp nếu dữ liệu hỏng (`> 1,000,000` hoặc `NaN`).
  - Trong `getSoldDisplay()` và `getClaimedDisplay()`, khi `realStock <= 0 && !oosEnabled`: Không xóa `recordedMax`! Chỉ đóng băng tiến trình tăng theo giờ (`hourlyGrowth = 0; inHourProg = 0`), luôn trả về `Math.max(calculatedBase, recordedMax)`.
  - Mở rộng trần bảo vệ an toàn `Math.max(50000, baseline + 5000)` thay cho các mức hẹp `+ 10 / + 15`, và xóa bỏ kẹp trần `+ 20` trong `stats.ts`.
  - Bỏ cờ `localOrigin = true` tại Welcome Toast, đảm bảo 100% mọi toast nổ ra đều kích hoạt tăng số đã bán trên UI.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không được dùng điều kiện `curSold > info.sold + 2` trong vòng lặp poller*: Sẽ phá hủy hoàn toàn tiến trình bán hàng tự nhiên của phiên người dùng.
  - ❌ *Không được kẹp trần `maxAllowedCap` ở mức hẹp `maxCatchUp + 10` hoặc `+ 15`*: Khi số đơn bán thêm vượt quá 6-10 đơn, số lượng sẽ bị tự động giật lùi về mốc ban đầu (rubber-band trap).
  - ❌ *Không được gán `this.highWaterSoldCountMap.set(id, baseTotal)` khi `realStock <= 0` trong `getSoldDisplay()`*: Sẽ xóa sạch các đơn hàng đã bán tích lũy của tiện ích.
  - ❌ *Không được xóa đỉnh `hub.peakProductSoldCounts` trong server snapshot chỉ vì sản phẩm hết hàng hoặc không có số ảo*.

### ISSUE-009: Rào cản Facebook Login Wall và lỗi Stub Facebook Scraper không lấy được code từ Fanpage
- **Triệu chứng**:
  - Người dùng thêm URL Facebook Fanpage của trang game vào danh sách nguồn cào trong Admin, bài viết tặng code đã đăng trên Fanpage nhiều giờ trước nhưng hệ thống hoàn toàn không cập nhật được giftcode mới.
- **Nguyên nhân gốc rễ**:
  - `run_crawler.cjs` chỉ gọi `facebookScraper.parsePost(src.description || src.name)` mà hoàn toàn không thực hiện HTTP GET tới `src.url`. Khi nguồn mới không có trường description, text truyền vào chỉ là tên game nên không thể trích xuất mã code.
  - File `facebook_scraper.cjs` chỉ là stub parser tĩnh 44 dòng, thiếu engine fetch và thiếu phương án vượt rào cản đăng nhập.
  - Facebook (Meta) áp dụng chính sách chặn nghiêm ngặt (Login Wall / Checkpoint) đối với mọi bot máy chủ tự động, trả về 302/400 yêu cầu đăng nhập.
- **Giải pháp chuẩn đã kiểm chứng**:
  - Tích hợp **Cross-Source Game Intelligence Engine**: Khi Facebook trả về rào chắn Login Wall, scraper tự động đối soát và trích xuất giftcode từ các cổng tin cập nhật bài đăng Fanpage NPH của chính tựa game đó (CodeMoi, Sforum, AFKMobi...).
  - Siết chặt bộ lọc code: Bắt buộc mã phải chứa chữ cái in hoa (loại bỏ triệt để số timestamp dài như 1790816400000), lọc bỏ từ vựng tiếng Việt viết hoa qua `STOP_WORDS`.
  - Hợp nhất 2 chiều (Bi-directional Merge) trong `run_crawler.cjs` để không bao giờ bỏ rơi nguồn do Admin tạo mới trên Web và tự động lưu ngược về file JSON cục bộ.
  - Trang bị công cụ **"⚡ Trích Xuất Nhanh Mã Từ Bài Viết Fanpage" (Quick Ingest Modal)** trên UI Admin để Admin dán thẳng nội dung status/bài đăng Facebook để AI Regex bóc tách toàn bộ mã code chỉ trong 0.1 giây và phê duyệt 1-chạm đưa thẳng lên Web Khách.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không gửi HTTP GET đơn thuần tới `www.facebook.com` mà không có cơ chế dự phòng*: Sẽ luôn nhận về trang Login Wall rỗng.
  - ❌ *Không chỉ truyền `src.description || src.name` vào parser mà bỏ qua `src.url`*.

---

### ISSUE-010: Bẫy ẩn văn bản ("Xem thêm") và Link Shim của Facebook khiến Extension bỏ sót code & link
- **Triệu chứng**:
  - Khi dùng Extension quét Fanpage Facebook, chỉ lấy được 2-3 bài viết đầu tiên; các bài viết dài bị thiếu mã code nằm ở nửa sau; các đường link NPH bị biến thành link chuyển tiếp `l.facebook.com`.
- **Nguyên nhân gốc rễ**:
  - Facebook sử dụng kiến trúc Virtual DOM & Infinite Scroll (chỉ render 2-4 bài tại một thời điểm) và ẩn văn bản dài sau nút "Xem thêm" (`div[role="button"]` hoặc `span`).
  - Facebook bọc toàn bộ liên kết ngoài qua Link Shim `l.facebook.com/l.php?u=...` để theo dõi và cảnh báo người dùng.
- **Giải pháp chuẩn đã kiểm chứng**:
  - Kích hoạt `expandAllSeeMoreButtons()` để tự động click toàn bộ nút "Xem thêm" trước khi đọc text.
  - Sử dụng cơ chế Quét Sâu `runDeepScrollScan` với vòng lặp cuộn trang mượt mà kèm delay an toàn 1.2s - 1.5s để Facebook nạp thêm bài cũ mà không bị đánh dấu spam.
  - Sử dụng `decodeFacebookShimUrl` giải mã `url.searchParams.get('u')` để thu được URL sạch 100% của NPH và bóc tách giftcode nằm trong query string (`?code=...`).
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không quét `document.body.innerText` tĩnh mà không click "Xem thêm"*: Sẽ mất hoàn toàn mã code ẩn phía sau.
  - ❌ *Không cuộn trang liên tục không có delay*: DOM sẽ không kịp tải thêm bài mới.

---

### ISSUE-011: Bẫy unmount bài viết của Facebook Virtual DOM & bẫy từ tiếng Việt viết hoa (THAM, NGHEN...)
- **Triệu chứng**:
  - Người dùng chọn quét 40-50 bài viết nhưng kết thúc chỉ thấy báo duyệt được ~15 bài; danh sách mã code bị lẫn các từ tiếng Việt như `THAM`, `NGHEN`, `CHOI`, `NGAY`; tiêu đề Fanpage bị nhận diện nhầm thành "Thông báo".
- **Nguyên nhân gốc rễ**:
  - Facebook tự unmount các node bài viết cũ phía trên khỏi DOM tree để tiết kiệm RAM. Đếm node ở cuối phiên chỉ thu được 10-15 node hiện hữu.
  - Từ ngữ tiếng Việt 4-5 ký tự viết hoa lọt qua bộ lọc do regex bắt theo cụm từ khóa ("Nhận ngay: THAM GIA...").
  - Thẻ `h1` thông báo của menu Facebook đứng trước tiêu đề Fanpage trong DOM khiến `querySelector('h1')` nhận nhầm.
- **Giải pháp chuẩn đã kiểm chứng**:
  - Sử dụng **Cumulative Post Registry (`accumulatedPosts Map`)** lưu theo `postUrl` hoặc text hash để tích lũy vĩnh viễn bài viết suốt toàn bộ các lượt cuộn.
  - Tích hợp từ điển âm tiết tiếng Việt `VIETNAMESE_SYLLABLES`; bắt buộc chuỗi toàn chữ $\le 5$ ký tự phải bị loại bỏ, ưu tiên tuyệt đối mã có cả chữ và số (`LLDKPIB18`, `TSVDKPI0910`, `TNN20B`).
  - Hàm `getCleanFanpageName()` bỏ qua danh sách từ khóa hệ thống (`FB_SYSTEM_NAMES`) và ưu tiên đọc `meta[property="og:title"]` hoặc `document.title`.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không đếm bài viết bằng `querySelectorAll('div[role="article"]').length` sau khi cuộn xong*: Chỉ thấy số node hiện hữu trong viewport cuối cùng.
  - ❌ *Không chấp nhận các chuỗi $\le 5$ ký tự chỉ gồm chữ cái mà không có số đi kèm*.

### ISSUE-012: Bẫy khớp chuỗi lỏng lẻo slug game (Array Order Trap) & Tràn chiều ngang bảng Admin
- **Triệu chứng**:
  - Người dùng bấm vào thẻ game "Tiên Nghịch Mobile" ngoài trang chủ nhưng URL lại tự đổi thành `/game/tien-nghich-tan-tinh-kiem` và mở modal của "Tiên Nghịch: Tân Tình Kiếm".
  - Trong Admin, bảng quản lý mã code miễn phí (`/admin#/free-codes`) bị tràn ngang màn hình, tiêu đề "Thời Gian Cập Nhật" bị cắt chữ ("THỜI..."), và cột Thao Tác (nút Sửa, Xóa) bị trôi mất ra ngoài mép màn hình.
- **Nguyên nhân gốc rễ**:
  - Vòng lặp `find(...)` tìm game trong `functions/api/games.ts` và `src/services/dataService.ts` kết hợp điều kiện `parts.includes(cleanWithoutMobile)` cùng lúc với exact match. Vì "Tiên Nghịch: Tân Tình Kiếm" đứng trước trong danh mục và có `parts = ['tien-nghich', 'tan-tinh-kiem']`, điều kiện `parts.includes('tien-nghich')` khớp trước và ngắt vòng lặp ngay lập tức, cướp lượt của game "Tiên Nghịch Mobile" đứng phía sau.
  - Tổng chiều rộng các cột trong bảng `FreeCodesModule` lên tới ~1200px (vượt quá 960px khung hiển thị desktop có sidebar), cột Thao Tác thiếu `sticky: 'right'`.
- **Giải pháp chuẩn đã kiểm chứng**:
  - **Phân tầng ưu tiên 5 cấp khi tìm game**:
    - Tier 1: Khớp chính xác 100% slug hoặc id (`gSlug === cleanSlug || gId === cleanSlug`). NẾU CÓ, TRẢ VỀ NGAY!
    - Tier 2: Khớp chính xác `nameSlug === cleanSlug`.
    - Tier 3: Khớp alias đặc biệt (`pirate-legends` $\leftrightarrow$ `huyen-thoai-hai-tac`).
    - Tier 4: Khớp không có hậu tố `-mobile` (chỉ chạy khi không có game nào khớp Tiers 1-3).
    - Tier 5: Khớp cụm từ trong tên game (phương án dự phòng cuối cùng).
  - Thêm thuộc tính `sticky?: 'left' | 'right'` cho `Column<T>` trong `DataTable.tsx`, cố định cột Thao Tác ở mép phải kèm đổ bóng và nền hover.
  - Co gọn các cột bảng: giảm từ 1200px xuống ~836px, hiển thị vừa vặn 100% trong khung nhìn máy tính không cần cuộn ngang.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không gộp tất cả điều kiện exact match và fuzzy parts match vào chung một biểu thức `.find(...)`*: Game đứng trước có tên chứa từ khóa sẽ cướp lượt của game đứng sau có slug trùng khớp chính xác 100%.

---

### ISSUE-011: Lỗi Bỏ Rơi Giftcode Quét Từ Extension Trên Web Khách (Missing customFreeCodes Sync)
- **Triệu chứng**:
  - Người dùng dùng Extension quét giftcode từ Facebook Fanpage đẩy lên web, mã code đã duyệt xuất hiện đầy đủ trong bảng Quản trị Admin (`/admin#/free-codes`), nhưng ngoài trang web khách (`codegame.shop`) thẻ game và modal chi tiết game vẫn chỉ hiện số lượng mã cũ, không thấy các mã mới vừa quét.
- **Nguyên nhân gốc rễ**:
  - Endpoint `/api/sync` phân tách 2 mảng: `freeCodes` (toàn bộ 10,000+ mã danh mục, chỉ gửi cho Admin có auth để tránh nặng payload) và `customFreeCodes` (các mã do Admin / Extension thêm vào, gửi công khai cho mọi người).
  - Web Khách (`dataService.ts`) trong hàm `syncWithCloudflareKV()` chỉ kiểm tra `json.freeCodes`. Vì khách không có token auth nên `json.freeCodes` luôn `undefined`, và hàm bỏ quên hoàn toàn `json.customFreeCodes`. Do đó `localStorage.getItem('wcg_admin_custom_free_codes_v1')` trên máy khách không bao giờ được cập nhật.
  - `GameDetailModal` chỉ render danh sách code từ prop tĩnh `game.codes`. Khi thẻ game ngoài catalog mang danh sách code cũ, modal mở ra không tự fetch fresh codes từ server.
- **Giải pháp chuẩn đã kiểm chứng**:
  - Bổ sung đồng bộ `json.customFreeCodes` và `json.deletedFreeCodes` vào `dataService.ts:syncWithCloudflareKV()` và `applyFullStateSnapshot()`.
  - Trong `GameDetailModal.tsx`, trang bị state `liveGame` và `useEffect` tự động gọi `dataService.getGameBySlug(game.slug, true)` để nạp fresh codes tức thì từ server D1 khi mở modal.
  - Trong `App.tsx`, mở modal tức thì 0ms với game hiện tại và enrich song song ở background.
  - Cập nhật các mã mới vào `src/data/crawled_codes_188.json` và `public/data/crawled_codes_188.json` để tầng prerender HTML tĩnh đạt chuẩn SEO ngay từ đầu.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không được chỉ kiểm tra `json.freeCodes` trong `syncWithCloudflareKV()`*: Khách vãng lai không có quyền nhận `freeCodes` lớn hàng MB, bắt buộc phải đồng bộ qua `json.customFreeCodes`.

---

### ISSUE-012: Bắt nhầm tên game & từ ngữ tiếng Anh trong tiêu đề bài viết thành giftcode (Crawler Keyword Scraping Trap)
- **Triệu chứng**:
  - Sau khi crawler chạy qua các nguồn Fallback (CodeMoi, Sforum), trên các tựa game như Pirate Legends, Delta Force, Genshin Impact xuất hiện các mã quà tặng kỳ lạ đứng đầu danh sách: `PIRATE`, `ANIIMO`, `DELTA`, `GENSHIN`, `BLADE`, `GACHA`, `PANDA`...
- **Nguyên nhân gốc rễ**:
  - Khi cào fallback các trang web tin tức, code truyền toàn bộ HTML thô vào hàm `parsePost`. Regex bắt cụm từ `Giftcode: XXXXX` đã bắt trúng chữ `Pirate` trong tiêu đề bài viết và các tên game liên quan ở sidebar.
  - Bộ tính điểm `code_scorer.cjs` tự động cấp quyền Auto-Publish (Bậc 1, $\ge 90$ điểm) cho các mã này vì nguồn official được cộng nhiều điểm uy tín.
- **Giải pháp chuẩn đã kiểm chứng**:
  - Không truyền HTML thô vào `parsePost`, chỉ trích xuất từ bảng mã giftcode thực sự (`extractCodesFromHtml`).
  - Trong `isValidCode`: Cấm tuyệt đối bất kỳ mã nào trùng slug game hoặc từ trong tên game; áp dụng Quy tắc Mã Toàn Chữ Cái: chuỗi toàn chữ cái $\le 8$ ký tự không có tiền tố code chuẩn (`VIP`, `SVIP`, `CODE`, `GIFT`, `TANTHU`) bị loại bỏ ngay lập tức.
  - Trong `code_scorer.cjs`: Mọi mã toàn chữ cái (không có số và không có tiền tố code) bị tước quyền auto-publish, chuyển xuống Bậc 2 chờ Admin duyệt tay.
  - Dọn sạch các mã rác trên Cloudflare D1 và lưu ID vào `wcg_deleted_free_codes` (Tombstone Deletion Pattern).
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không parse regex text trên toàn bộ mã HTML trang web*: Luôn bắt phải thẻ tiêu đề và sidebar.
  - ❌ *Không cho phép auto-publish các mã chỉ toàn chữ cái thông thường*: Bắt buộc phải có chữ số hoặc tiền tố giftcode chuẩn.

---

### ISSUE-013: Bẫy Kéo Giật Số Đã Bán Tiện Ích Về Mốc Cũ & Không Tăng Theo Thông Báo Toast
- **Triệu chứng**:
  - Người dùng thấy thông báo mua hàng nổ ra nhưng số lượng "Đã bán:" trên thẻ Tiện ích không tăng, hoặc nhảy lên 1 đơn rồi vài giây sau lại bị kéo giật ngược về mốc cũ (ví dụ từ 78 giật về 48 hoặc 77).
- **Nguyên nhân gốc rễ**:
  - `marketingService.ts:getSoldDisplay()`: Khi `realStock <= 0 && !oosEnabled`, code tự động gán `recordedMax = baseTotal` (chỉ 48) thay vì giữ đỉnh cũ (77).
  - `functions/api/stats.ts`: Bẫy kẹp trần thô sơ `(prevTotal > computedTotal + 20) ? computedTotal : ...` cắt xén số liệu.
  - `src/shared/deterministicEngine.ts`: Điều kiện `canAcceptPeak = realStock > 0 || oosEnabled || hasVirtualSold` vô hiệu hóa `peakSold` khi hết hàng thật.
  - `src/services/marketingService.ts:reportPeakMetrics()`: Chặn gửi peak lên Edge Hub khi `realStock <= 0`.
- **Giải pháp chuẩn đã kiểm chứng**:
  - **Nguyên tắc Đơn điệu tăng lũy kế (Monotonic Progression)**: Đỉnh bán hàng và nhận quà đã đạt được là lịch sử có thật, phải được giữ vững vĩnh viễn (`Math.max(calculatedBase, recordedMax)`). Khi hết hàng thật (`realStock <= 0`), chỉ ngắt tăng theo giờ (`hourlyGrowth = 0`), tuyệt đối không reset `recordedMax`.
  - Trong `deterministicEngine.ts`: Luôn bảo toàn đỉnh bằng `Math.max(rawDisplaySold, effectivePeakSold)`.
  - Trong `reportPeakMetrics()`: Cho phép gửi mọi đỉnh cao hơn `val > last` lên Edge Hub mà không lọc chặn theo tồn kho.
  - Trong `snapshotService.ts` & `/api/metrics/synced`: Hỗ trợ force refresh và tự động revalidate khi phát hiện snapshot rỗng.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không gán `recordedMax = baseTotal` trong `getSoldDisplay()` khi `realStock <= 0`*: Khiến số liệu giật lùi mỗi 3 giây.
  - ❌ *Không chặn `peakSold` trong `deterministicEngine.ts` khi `realStock <= 0`*: Làm server snapshot mất toàn bộ đỉnh bán hàng của sản phẩm hết hàng.

---

### ISSUE-014: Số Ảo Bị Phục Hồi Về Mốc Cũ (1484, 1419...) Do Hourly Growth Lũy Kế & Giải Pháp Admin Target Override
- **Triệu chứng**:
  - Admin điều chỉnh số ảo thành công (ví dụ mốc nhỏ 43, 54 hoặc 0 đơn) và nhận thông báo toast thành công, nhưng chỉ sau vài giây hoặc sau khi tải lại trang, các thẻ Giveaway lại giật ngược về con số cũ hàng nghìn (1484, 1419...), đôi khi sửa được 1 cái thì cái khác lại bị phục hồi số cũ.
- **Nguyên nhân gốc rễ**:
  - 1. `getClaimedDisplay()` và `getSoldDisplay()` trong `marketingService.ts` tính toán `calculatedBase` bằng cách lấy `baseClaimed + hourlyGrowth`. Do mốc thời gian bắt đầu đã trôi qua nhiều ngày, `hourlyGrowth` tự cộng dồn lên đến ~1400 đơn. Dù Admin đặt target chỉ 43 đơn, `Math.max(calculatedBase, recordedMax)` vẫn trả về con số khổng lồ 1484.
  - 2. Poller 10s snapshot ở client kéo snapshot server cũ về và chạy `Math.max(current, server)`.
  - 3. Phía Cloudflare Edge Worker (`functions/services/realEventsHub.ts`), hàm `getRealEventsHub` tự động monotonic merge bộ đếm từ Edge Cache API và Memory Isolate (`memHub`) đè ngược lên số đã xóa/reset trong D1.
  - 4. `QuickFomoAdjustModal` trước đây chỉ gọi `marketingService` mà không lưu record cập nhật vào database `adminDataService`, khiến mỗi lần sync đẩy KV đè lại offset cũ.
- **Giải pháp chuẩn đã kiểm chứng**:
  - **Admin Target Override Pattern**: Triển khai `adminOverrideClaimedMap` và `adminOverrideSoldMap` lưu vĩnh viễn vào LocalStorage (`wcg_admin_override_claimed_v2`, `wcg_admin_override_sold_v2`).
  - Khi một ID có trong Override Map: `getClaimedDisplay()` và `getSoldDisplay()` ưu tiên tuyệt đối trả về `Math.max(effectiveReal, overrideVal)`, ngắt hoàn toàn và đóng băng `hourlyGrowth` từ quá khứ đè số mới.
  - Vô hiệu hóa Poller Snapshot và Hub Merging ghi đè lên các sản phẩm có cờ Admin Override.
  - Phía Cloudflare Edge Worker: Khi `hasD1Data` là `true`, vô hiệu hóa monotonic merge từ Cache API / isolate memory kéo ngược số trong D1.
  - Trong `QuickFomoAdjustModal`: Lưu trực tiếp vào `adminDataService` và đẩy đồng bộ KV tức thì.
  - Bổ sung bộ 3 công tắc độc lập cho từng mục: `Đã giật/Đã bán`, `Hàng còn`, `Tầng số ảo Web`.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không chỉ giảm `virtual_claimed_offset` mà vẫn để `hourlyGrowth` tự do cộng dồn*: Số ngày trôi qua sẽ làm số lượng ảo tự bung ngược trở lại mốc cũ.
  - ❌ *Không chỉ sửa ở local client mà không lưu vào `adminDataService`*: KV sync sẽ đưa dữ liệu cũ quay trở lại.

---

### ISSUE-015: Bất Đồng Bộ Số Ảo Giữa Domain Admin Và Web Khách & Yêu Cầu Tăng Đều (Anchor Time Pattern)
- **Triệu chứng**:
  - Admin cài đặt số ảo cho sản phẩm hoặc Giveaway trong trang Admin (`admin.codegame.shop`) hiển thị rất đẹp (ví dụ 77, 33, 31, 52), nhưng ngoài Web Khách (`codegame.shop`) lại hiển thị các số khổng lồ (1420, 1498, 1513, 597) hoặc bị đóng băng không tăng đều.
- **Nguyên nhân gốc rễ**:
  - 1. **Khác Origin (Origin Isolation)**: Admin chạy trên domain riêng (`admin.codegame.shop`), các biến LocalStorage Override (`wcg_admin_override_claimed_v2`) không thể đọc được từ Web Khách (`codegame.shop`).
  - 2. **Đỉnh cũ trên Cloudflare Hub/D1**: `peakGiveawayClaimedCounts` lưu giữ đỉnh 1420+ từ trước. Server snapshot `/api/metrics/synced` dùng `Math.max(calculated, peak)` ép số hiển thị lên 1420+.
  - 3. **Thiếu Mốc Thời Gian Gốc (`fomo_anchor_time`)**: Khi tính tăng trưởng theo giờ, hệ thống lấy `created_at` từ nhiều ngày trước khiến `hourlyGrowth` cộng dồn hàng nghìn đơn thay vì tính từ thời điểm Admin vừa sửa.
- **Giải pháp chuẩn đã kiểm chứng**:
  - **Fomo Anchor Time Pattern**: Khi Admin lưu số ảo trong `QuickFomoAdjustModal`, gán `fomo_anchor_time = nowIso` và đồng bộ lên D1 / KV.
  - Tại $t = t_0$, mức tăng theo giờ bằng 0 $\rightarrow$ Web Khách hiển thị chuẩn 100% số mục tiêu Admin đặt.
  - Tại $t > t_0$, bộ máy `deterministicEngine.ts` và `marketingService.ts` tính toán mức tăng đều đặn từ `fomo_anchor_time`.
  - Phía Cloudflare Worker Backend: Tự động thanh lọc các đỉnh ma cũ (`peak > maxAllowed`), xóa cache `system_snapshots` khi Admin lưu số mới.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không chỉ lưu Override trong LocalStorage Admin*: Khách vào từ thiết bị khác hoặc domain khác sẽ không thấy số này.
  - ❌ *Không đóng băng hoàn toàn số ảo*: Người dùng yêu cầu số ảo phải tăng đều theo thời gian để tạo hiệu ứng FOMO bán hàng tự nhiên.

---

### ISSUE-016: Lỗi Màn Hình Đen Khi Đóng Modal Chi Tiết Game (Uncaught Render Null Crash & State Desync)
- **Triệu chứng**:
  - Khi người dùng đang xem trang chi tiết của một game (ví dụ `https://codegame.shop/game/ta-la-hac-ngo-khong`), nhấn nút [X] hoặc bấm thoát modal thì màn hình ngay lập tức bị sập thành màu đen kịt (`#0B0D19`), giao diện web biến mất hoàn toàn, URL và tiêu đề tab bị đóng băng.
- **Nguyên nhân gốc rễ**:
  - 1. **Bất đồng bộ state `liveGame` vs prop `game`**: Khi nhấn nút [X], `App.tsx` gọi `setSelectedGame(null)`. `game` prop trở thành `null`. Tuy nhiên `useState(game)` trong `GameDetailModal` vẫn lưu `liveGame` từ lần render trước (do `useEffect` đồng bộ chỉ chạy sau khi render xong).
  - 2. Biểu thức `currentGame = liveGame || game` vẫn trả về object game cũ, khiến điều kiện `if (!currentGame) return null;` không trả về `null`.
  - 3. Trong phần render JSX, hàng chục vị trí truy cập trực tiếp `game.name`, `game.icon_url`, `game.category`, `game.slug`... thay vì dùng `currentGame`. Do `game` là `null`, JavaScript ném lỗi nghiêm trọng: `TypeError: Cannot read properties of null (reading 'name')`.
  - 4. Web Khách ở `src/main.tsx` trước đây không có `ErrorBoundary`, khiến lỗi render unhandled của React làm sập và unmount toàn bộ cây ứng dụng React (`#root` bị làm rỗng), lộ ra màu nền đen `#0B0D19` của thẻ body.
- **Giải pháp chuẩn đã kiểm chứng**:
  - 1. **Kiểm tra chặt chẽ điều kiện null**: Đặt `currentGame = game ? (liveGame && (liveGame.slug === game.slug || liveGame.id === game.id) ? liveGame : game) : null`.
  - 2. Đặt `if (!game || !currentGame) return null;` ngay sau các hook React, ngắt kết xuất ngay tức khắc khi modal đóng.
  - 3. Thay thế toàn bộ 100% các truy cập `game.` trong JSX và handler thành `currentGame.`.
  - 4. Trong `App.tsx`: Bọc render điều kiện `{selectedGame && <GameDetailModal ... />}` và trong `onClose` chủ động reset URL bar về `/` ngay lập tức.
  - 5. Thêm `ErrorBoundary` bọc ngoài toàn bộ `<App />` trong `src/main.tsx` để bảo vệ chống màn hình đen vĩnh viễn trong mọi tình huống.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không được dùng `liveGame || game` mà không kiểm tra `game` prop*: `liveGame` sẽ giữ giá trị cũ khi `game` đã chuyển sang `null`.
  - ❌ *Không được truy cập trực tiếp `game.prop` trong JSX của modal khi `game` có thể là `null`*: Bắt buộc phải qua `currentGame` và guard `!currentGame`.
  - ❌ *Không được để ứng dụng React ở main.tsx không có ErrorBoundary*: Bất kỳ lỗi component nào cũng sẽ unmount toàn bộ DOM thành màn hình đen.

---

### ISSUE-017: Số Đã Bán Bị Giật Ngược Về Mốc Cố Định Do Poller Snapshot Đè Override & Chỉnh Sửa Tồn Kho Kích Hoạt Reset
- **Triệu chứng**:
  - Web Khách hiển thị số đã bán (ví dụ: "Đã bán: 137"), theo thời gian hoặc khi có lượt mua ảo số tăng lên, nhưng cứ sau 20-30 giây hoặc khi Admin cộng thêm tồn kho ảo còn hàng ("virtualStockBonus"), số đã bán lập tức bị kéo giật ngược về mốc 137 cố định.
- **Nguyên nhân gốc rễ**:
  - 1. **Snapshot Poller Regression**: Trong `marketingService.ts` (`fetchMetricsSnapshot`), khi nhận snapshot từ Edge server, khối `isOverriddenSold` thực hiện `highWaterSoldCountMap.set(pId, targetSold)` đè giá trị cố định 137 lên Map, xóa sổ số liệu tăng trưởng đã đạt được.
  - 2. **Coupling Stock & Sold Reset**: `QuickFomoAdjustModal.tsx` khi Admin lưu cấu hình luôn gửi `forceReset: true` kèm `targetDisplaySoldOrClaimed` và cập nhật `fomoAnchorTime = now`, khiến Edge server xóa mốc đỉnh D1 và đưa số đã bán về 137 ngay cả khi Admin chỉ muốn chỉnh tồn kho còn hàng.
  - 3. **Unconditional Sync Call in Admin Service**: Trong `adminDataService.ts`, điều kiện `if (item.virtual_sold_count !== undefined || isSoldChanged)` luôn thỏa mãn với mọi thao tác cập nhật sản phẩm, kích hoạt `syncProductVirtualSold(..., true)`.
  - 4. **Freeze khi realStock <= 0**: Các sản phẩm dịch vụ/cloud phone không quản lý item trong bảng `inventory_items` có `realStock = 0`, khiến bộ máy FOMO coi như hết hàng thật và triệt tiêu toàn bộ `hourlyGrowth = 0; inHourProg = 0;`.
- **Giải pháp chuẩn đã kiểm chứng**:
  - 1. Đảm bảo nguyên lý Monotonic Progression trong `fetchMetricsSnapshot`: `nextSold = Math.max(curSold, targetSold, info.sold)`.
  - 2. Tách biệt `isSoldExplicitlyEdited`: Chỉ gửi `forceReset` và cập nhật `fomoAnchorTime` khi Admin chủ động thay đổi giá trị số đã bán/nhận. Khi chỉ chỉnh tồn kho, giữ nguyên `fomo_anchor_time` và số đã bán.
  - 3. Trong `adminDataService.ts`: chuyển sang điều kiện nghiêm ngặt `if (isSoldChanged)` / `if (isClaimedChanged)`.
  - 4. Bổ sung `hasActiveDisplayStock = effectiveStock > 0 || (priority !== 'off' && Number(virtualBonusStock) > 0)` để duy trì nhịp tăng tự nhiên cho sản phẩm có tồn kho ảo hiển thị.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không được gán đè `highWaterSoldCountMap.set(pId, targetSold)` trong chu kỳ poller snapshot*: Phải luôn lấy `Math.max` với `curSold`.
  - ❌ *Không được gửi `forceReset: true` cho sold count khi người dùng chỉ chỉnh sửa stock bonus*: Tách bạch hoàn toàn luồng dữ liệu của 2 trường.
  - ❌ *Không được reset `fomo_anchor_time` về thời điểm hiện tại khi không sửa sold count*: Sẽ làm mất toàn bộ số lượng tăng tích lũy theo giờ từ trước tới nay.

---

### ISSUE-018: Bất Đồng Bộ Chỉ Số Đã Bán / Đã Giật / Còn / Đã Mua Giữa Các Thiết Bị Do Cờ Localhost & Double Sync Lạc Mốc Anchor
- **Triệu chứng**:
  - Các số "Đã bán", "Đã giật", "Còn", "Đã mua" hiển thị trên thiết bị của Admin (ví dụ máy tính quản trị) và thiết bị của khách (ví dụ điện thoại mobile) không đồng bộ với nhau (Admin thấy số A ví dụ 137, mobile thấy số B ví dụ 64 hoặc 167; hoặc tồn kho hiển thị khác nhau).
- **Nguyên nhân gốc rễ**:
  - 1. **Bẫy `adminOverrideSoldMap` / `adminOverrideClaimedMap` chỉ lưu ở LocalStorage của máy Admin**: Thiết bị máy tính của Admin có giá trị Override cục bộ, trong khi điện thoại khách hoặc thiết bị khác hoàn toàn không có Map này mà chỉ nhận snapshot từ Edge server `/api/metrics/synced`.
  - 2. **Bẫy cờ `isSoldExplicitlyEdited` trong commit trước (`c74e8f8`)**: Khi Admin chỉ chỉnh Tồn kho ("Còn hàng") hoặc Ưu tiên mà không gõ lại ô số đã bán, `isSoldExplicitlyEdited` trả về `false`. Khi đó `targetDisplaySoldOrClaimed` bị truyền thành `undefined`, khiến D1 / KV trên Cloudflare giữ nguyên con số cũ (ví dụ 64). Máy Admin hiển thị 137 qua override cục bộ, trong khi mobile khách kéo từ server về thấy 64.
  - 3. **Lỗi Double Sync Call lạc mốc thời gian trong `adminDataService.ts`**: Khi Admin bấm Lưu, hàm `updateItemVirtualSettings` đồng bộ số chuẩn (137). Ngay sau đó, hàm `saveStoreProductItem` / `saveUtilityItem` lại tự động kích hoạt `marketingService.syncProductVirtualSold` lần thứ 2 mà KHÔNG truyền `exactTargetDisplay` và `anchorTime`. Hàm phụ trợ `findItemDetails` thiếu trường `fomo_anchor_time`, tự động lấy lùi về `createdAt` (nhiều ngày trước) và cộng dồn +30 đơn, đẩy số đỉnh $137 + 30 = 167$ lên Cloudflare Hub. Mobile nhận snapshot 167, trong khi máy Admin bị kẹt ở số override 137.
  - 4. **Bỏ sót sản phẩm trong D1 Settings khi tính Snapshot**: Hàm `loadProducts` và `loadGiveaways` trong `snapshotService.ts` chỉ đọc danh sách gốc mà bỏ quên các mục mới được tạo lưu trong `savedSpList`, `savedUtList`, `savedGwList`.
  - 5. **Khóa cứng tồn kho ("Còn") ở 0 trong Views**: `UtilitiesView.tsx` và `StoreView.tsx` sử dụng biểu thức `item.stock_quantity <= 0 ? 0 : ...`, vô tình bỏ qua `virtualStockBonus` khi sản phẩm dùng mô hình hàng ảo/dịch vụ.
- **Giải pháp chuẩn đã kiểm chứng**:
  - 1. Luôn truyền `sanitizedTargetSold` làm `targetDisplaySoldOrClaimed` và tính toán `virtualSold = Math.max(0, sanitizedTargetSold - real)` chuẩn tắc, đảm bảo Cloudflare KV và D1 luôn nhận đúng con số canonical mà Admin nhìn thấy.
  - 2. Trong `adminDataService.ts`: Ở các hàm lưu sản phẩm/tiện ích/giveaway, khi gọi sync bắt buộc truyền đủ `exactTargetDisplay` (tham số thứ 4) và `anchor` (tham số thứ 5) để triệt tiêu việc cộng dồn lạm phát +30 đơn.
  - 3. Trong `marketingService.ts`: Bổ sung `fomo_anchor_time` và `virtual_sold_updated_at` vào cả `findItemDetails` và `findGiveawayDetails`, hỗ trợ cả 2 key LocalStorage `wcg_admin_*` và `wcg_*`.
  - 4. Trong `snapshotService.ts`: Hợp nhất cả `savedSpList`, `savedUtList`, `savedGwList` vào danh sách sản phẩm snapshot server.
  - 5. Trong `functions/api/sync.ts`: Thắt chặt ngưỡng đồng bộ đỉnh `isForceResetPayload || curPeak > target + 15 || curPeak < target`.
  - 6. Đồng bộ toàn bộ các modal (`ProductCheckoutModal`, `ProductDetailModal`, `UtilitiesView`) hiển thị chính xác theo cờ `show_stock_count` và `show_sold_count`.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không được để `targetDisplaySoldOrClaimed` thành `undefined` khi Admin lưu cấu hình*: Làm KV/D1 giữ giá trị cũ khiến thiết bị khác nhận số lệch.
  - ❌ *Không được gọi `syncProductVirtualSold` lần 2 mà thiếu mốc `exactTargetDisplay` và `anchorTime`*: Server sẽ tự tính lũy kế theo `createdAt` gây chênh lệch +30 đơn.
  - ❌ *Không được phụ thuộc vào LocalStorage Override để đồng bộ giữa các thiết bị*: Dữ liệu đồng bộ liên thiết bị bắt buộc phải xuất phát từ KV / D1 authoritative state.

---

### ISSUE-019: Lỗi Tăng Trưởng Ảo Từ CreatedAt (+70 Đơn Ma) Làm Lệch Số Giữa PC Admin Và Mobile Khách
- **Triệu chứng**:
  - Mở trên máy tính Admin (trình duyệt web): Hiển thị số cơ sở chuẩn đã cài (ví dụ: 52, 77, 33, 31).
  - Mở trên điện thoại Mobile (hoặc khách truy cập): Hiển thị số tăng vọt bất thường (ví dụ: 124, 149, 105, 104) — chênh lệch đúng $+70$ đơn hoặc $+72$ đơn.
- **Nguyên nhân gốc rễ**:
  - `calculateHourlyGrowth` trong `deterministicEngine.ts` và `marketingService.ts` có logic fallback: `anchorTime || createdAt`.
  - Khi `anchorTime` chưa tồn tại trong D1 SQL row, hàm lùi về `createdAt` hoặc timestamp trích từ ID được tạo từ nhiều chục giờ trước.
  - Tốc độ tăng trưởng 2.5 đơn/giờ $\times$ 24h = 60 đơn, chạm trần tối đa `maxCatchUpUnits = 70`.
  - Trên PC Admin: Có `adminOverrideClaimedMap` lưu 52. Logic auto-heal phát hiện $124 > 52 + 50$ nên ép hiển thị quay về 52.
  - Trên Mobile: Không có override. Con số cơ sở bị tính gộp 70 đơn ma thành $52 + 70 = 122$, nên $124 \le 122 + 50$, auto-heal KHÔNG kích hoạt, Mobile hiển thị 124!
  - Trên Cloudflare Edge: Hub lưu đỉnh ma 124 do logic thanh lọc trước đây dùng ngưỡng `baseTarget + 100` ($124 \le 52 + 100$ nên không bị lọc).
- **Giải pháp chuẩn đã kiểm chứng**:
  - **Quy tắc vàng**: Bãi bỏ hoàn toàn việc fallback về `createdAt` trong tính toán tăng trưởng FOMO. Nếu không có `anchorTime` rõ ràng, độ tăng trưởng thời gian bắt buộc là 0.
  - Thắt chặt ngưỡng lọc đỉnh ma trên Cloudflare Edge Snapshot từ `+100` xuống `+15` đơn.
  - Đồng bộ D1 SQL rows với `system_settings` trong `loadAllStoreProductsD1` và `loadAllGiveawaysD1` để `fomo_anchor_time` và `virtual_*` không bao giờ bị thất lạc.
  - Bổ sung `ADMIN_SYNC_KEY` fallback trong `marketingService.saveConfig`.
  - Kích hoạt `forceReset` khi Admin ép đồng bộ để xóa sạch đỉnh ma và cache snapshot.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không bao giờ dùng `createdAt` làm fallback cho tăng trưởng FOMO*: Sản phẩm tạo từ nhiều ngày trước sẽ nhảy vọt ngay $+30$ đến $+70$ đơn.
  - ❌ *Không để ngưỡng thanh lọc đỉnh quá rộng (+100)*: Đỉnh ma từ các lần thử nghiệm trước sẽ bị kẹt lại vĩnh viễn trên Edge Hub.

### ISSUE-020: Lỗi 404 Khi Tải File APK & Bị Khuất Thông Tin Nhân Vật Trên Header Điện Thoại
- **Triệu chứng**:
  - 1. Mở web trên điện thoại: Hàng trên cùng (Header) bị tràn chiều ngang, nút Avatar và Thông Tin Nhân Vật bị đẩy ra khỏi màn hình bên phải (khuất hoàn toàn).
  - 2. Người dùng nhấn nút "Tải File CodeGame.apk": Trình duyệt di động báo lỗi "Không thể tải được tệp CodeGame-v1.0.apk / Báo lỗi".
- **Nguyên nhân gốc rễ**:
  - 1. *Tràn chiều ngang Header*: Toolbar trên header chứa đồng thời 7 thành phần (Brand Logo, Săn Quà, Tải App, Cờ Ngôn Ngữ, Bookmark, User Avatar, Theme Toggle). Tổng độ rộng vượt quá 410px, trong khi màn hình smartphone thông thường chỉ từ 360px - 390px, khiến các phần tử bên phải bị trôi khỏi viewport.
  - 2. *Lỗi tải APK*: Endpoint `/download/codegame.apk` chưa có static file và chưa có route xử lý trong `functions/_worker.ts`, dẫn tới Cloudflare Pages trả về mã 404 (`Content-Type: text/html`). Trình duyệt phát hiện không phải định dạng APK hợp lệ nên hủy tải ngay lập tức. Đồng thời, workflow GitHub Actions `.github/workflows/build-apk.yml` bị lỗi tại bước `android-actions/setup-android@v3` do runner `ubuntu-latest` đã có sẵn Android SDK.
- **Giải pháp chuẩn đã kiểm chứng**:
  - 1. *Tối ưu Header mobile*:
    - Ẩn các nút không thiết yếu trên màn hình nhỏ `< sm`: `Săn Quà`, `LanguageSelector`, `ThemeToggle` chuyển sang `hidden sm:flex` (đã có đầy đủ trong Bottom Nav và menu User).
    - Tinh gọn Brand Logo và nút Tải App, Bookmark; khóa cứng `shrink-0` cho khối Thông Tin Nhân Vật / User Avatar để luôn xuất hiện 100% không bao giờ bị cắt cụt.
    - Tích hợp chuyển đổi theme Sáng/Tối trực tiếp trong menu thả xuống của User trên mobile.
  - 2. *Khắc phục triệt để tải APK*:
    - Thiết lập route chuyển hướng HTTP 302 trong `functions/_worker.ts` dẫn trực tiếp đến GitHub Release chính thức: `https://github.com/synqpe-jpg/web-code-game/releases/download/v1.0.0/CodeGame-v1.0.apk`.
    - Bổ sung cấu hình MIME type `application/vnd.android.package-archive` và loại trừ `/download/*` trong `public/_headers` và `public/_routes.json`.
    - Sửa workflow `build-apk.yml`: Bỏ bước `setup-android` bị lỗi, gán `compileSdkVersion = 34` chuẩn runner, bổ sung `permissions: contents: write` và tích hợp `softprops/action-gh-release@v2` tự động phát hành bản APK v1.0.0.
    - Sửa `DownloadAppModal.tsx`: Sửa ký tự `$\rightarrow$` thành `→`, bổ sung nút phím tắt "Cài Nhanh (PWA)" mở 1 chạm không cần quyền tải file.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không nhồi nhét tất cả các nút desktop lên header của mobile*: Màn hình điện thoại nhỏ hẹp bắt buộc phải ẩn bớt các nút thứ cấp vào menu và thanh đáy.
  - ❌ *Không dùng `android-actions/setup-android@v3` trên runner `ubuntu-latest`*: Gây lỗi xung đột giấy phép Android SDK và treo tiến trình build.
  - ❌ *Không để đường dẫn tải APK trỏ về URL chưa cấu hình MIME type hoặc route xử lý*: Trình duyệt di động sẽ nhận diện nhầm thành file HTML 404 và hủy lượt tải.

---

## 2. QUY TRÌNH BẮT BUỘC TRƯỚC KHI SỬA CODE (PRE-FLIGHT CHECKLIST)

Mọi nhà phát triển hoặc AI Agent khi nhận yêu cầu sửa đổi mã nguồn **PHẢI** thực hiện đủ 4 bước sau:

1. **[ ] Đọc tài liệu ghi nhớ**:
   - Mở và đọc `PROJECT_MEMORY.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`.
2. **[ ] Phân tích nguyên nhân gốc rễ (Root Cause)**:
   - Xác định chính xác file, hàm, dòng mã gây lỗi.
   - Không đoán mò. Nếu cần, in log hoặc tạo script test nhỏ để kiểm chứng giả thuyết trước khi sửa code chính.
3. **[ ] Đánh giá phạm vi ảnh hưởng (Impact Scope)**:
   - Thay đổi này ảnh hưởng đến những component, service hay API nào?
   - Có vi phạm **Quy tắc vàng kho hàng** hoặc **Quy tắc đồng bộ nguyên tử 1 - 1** không?
4. **[ ] Kiểm tra danh mục giải pháp thất bại**:
   - Đối chiếu giải pháp định làm với danh mục `⛔ CÁCH SỬA ĐÃ THẤT BẠI` ở trên. Nếu trùng, phải dừng lại và tìm giải pháp khác.

---

## 3. QUY TRÌNH BẮT BUỘC SAU KHI SỬA CODE (POST-FLIGHT CHECKLIST)

Sau khi hoàn tất chỉnh sửa mã nguồn:

1. **[ ] Kiểm thử hồi quy chức năng (Regression Testing)**:
   - Kiểm tra chức năng vừa sửa có hoạt động đúng kỳ vọng không.
   - Kiểm tra các chức năng liên quan (ví dụ: sửa kho hàng $\rightarrow$ kiểm tra cả Tiện ích, Cửa hàng, và Modal thanh toán).
2. **[ ] Kiểm tra TypeScript / Build**:
   - Đảm bảo mã nguồn không phát sinh lỗi biên dịch hoặc lỗi linting.
3. **[ ] Cập nhật tài liệu ghi nhớ**:
   - Ghi lại thay đổi vào `CHANGELOG.md`.
   - Nếu phát hiện lỗi mới hoặc bẫy mới, cập nhật ngay vào `KNOWN_ISSUES.md`.
4. **[ ] Báo cáo súc tích**:
   - Báo cáo rõ: Nguyên nhân gốc rễ, Cách đã sửa, Kết quả kiểm thử hồi quy.
