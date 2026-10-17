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
  - Bẫy ngắt toàn bộ tiến trình tăng trưởng `if (!parsedAnchorMs) return 0;` trong `getHourlyGrowth` và `getInHourProgression` khi sản phẩm không có `fomo_anchor_time`.
  - Bẫy auto-heal `if (recordedMax > calculatedBase + 50)` xóa sạch số bán tích lũy khi offline catch-up đạt > 50 đơn.
  - Initial Welcome Toast trong `MarketingNotificationToast.tsx` bị gán nhầm `(welcomeData.notif as any).localOrigin = true;`, ngăn cản toast gọi `recordVirtualSale`.
- **Giải pháp chuẩn đã kiểm chứng**:
  - `loadProducts` và `loadGiveaways` trong `snapshotService.ts` chuyển sang dùng `loadAllStoreProductsD1`, `loadAllUtilitiesD1`, và `loadAllGiveawaysD1` chuẩn từ `d1_service.ts`.
  - Vô hiệu hóa việc xóa đỉnh khỏi `hub.peakProductSoldCounts` và `hub.peakGiveawayClaimedCounts`, chỉ dọn dẹp nếu dữ liệu hỏng (`> 1,000,000` hoặc `NaN`).
  - Trong `getSoldDisplay()` và `getClaimedDisplay()`, khi `realStock <= 0 && !oosEnabled`: Không xóa `recordedMax`! Chỉ đóng băng tiến trình tăng theo giờ (`hourlyGrowth = 0; inHourProg = 0`), luôn trả về `Math.max(calculatedBase, recordedMax)`.
  - Fallback anchor thông minh về `sessionAnchor.lastTimestamp` hoặc đầu ngày `dayStart` khi không có `anchorTime` cụ thể.
  - Mở rộng trần bảo vệ an toàn `Math.max(50000, baseline + 5000)` thay cho các mức hẹp `+ 10 / + 15` hay `+ 50`, và xóa bỏ kẹp trần `+ 20` trong `stats.ts`.
  - Bổ sung `ensureSessionAnchorsSeeded()` nạp mốc cho toàn bộ catalog và nới `maxCap` lên 70 đơn theo cấu hình Admin.
  - Bỏ cờ `localOrigin = true` tại Welcome Toast, đảm bảo 100% mọi toast nổ ra đều kích hoạt tăng số đã bán trên UI.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không được dùng điều kiện `curSold > info.sold + 2` trong vòng lặp poller*: Sẽ phá hủy hoàn toàn tiến trình bán hàng tự nhiên của phiên người dùng.
  - ❌ *Không được kẹp trần `maxAllowedCap` ở mức hẹp `maxCatchUp + 10` hoặc `+ 15` hay `+ 50`*: Khi số đơn bán thêm vượt quá 6-10 đơn hoặc 50 đơn, số lượng sẽ bị tự động giật lùi về mốc ban đầu (rubber-band trap).
  - ❌ *Không được return 0 khi thiếu `anchorTime`*: Khiến toàn bộ số ảo Admin thiết lập không thể tự trôi theo thời gian.
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
    - Sửa workflow `build-apk.yml`: Bỏ bước `setup-android` bị lỗi, giữ nguyên `compileSdkVersion = 36` chuẩn Capacitor 8 (hỗ trợ đầy đủ trên runner Ubuntu 24.04), bổ sung `permissions: contents: write`, bật `set -e -o pipefail`, kiểm tra bắt buộc file APK tồn tại trước khi upload và tích hợp `softprops/action-gh-release@v2` với `fail_on_unmatched_files: true` tự động phát hành bản APK v1.0.0.
    - Sửa `DownloadAppModal.tsx`: Sửa ký tự `$\rightarrow$` thành `→`, bổ sung nút phím tắt "Cài Nhanh (PWA)" mở 1 chạm không cần quyền tải file.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không nhồi nhét tất cả các nút desktop lên header của mobile*: Màn hình điện thoại nhỏ hẹp bắt buộc phải ẩn bớt các nút thứ cấp vào menu và thanh đáy.
  - ❌ *Không dùng `android-actions/setup-android@v3` trên runner `ubuntu-latest`*: Gây lỗi xung đột giấy phép Android SDK và treo tiến trình build.
  - ❌ *Không để đường dẫn tải APK trỏ về URL chưa cấu hình MIME type hoặc route xử lý*: Trình duyệt di động sẽ nhận diện nhầm thành file HTML 404 và hủy lượt tải.
  - ❌ *Không dùng pipe `| tee` mà thiếu `set -e -o pipefail` trong bash CI/CD*: Mã thoát của lệnh trước bị nuốt chửng bởi `tee`, dẫn đến CI báo thành công giả tạo (False Positive) dù lệnh Gradle đã thất bại.
  - ❌ *Không được hạ `compileSdkVersion` xuống thấp hơn phiên bản yêu cầu của Capacitor (Capacitor 8 yêu cầu SDK 36)*: Khiến các thư viện AndroidX và mã nguồn Java của Capacitor bị lỗi biên dịch.

---

### ISSUE-021: Vòng Lặp Nháy Ảnh Liên Tục Trong Thẻ Tin Tức & Bẫy Cắt Cụt Logo Game (Infinite Image Flickering & Cover Ratio Trap)
- **Triệu chứng**:
  - 1. Mục tin tức có một số thẻ bài viết bị nhấp nháy, chớp tắt liên tục với tần số cao, gây khó chịu cho người xem.
  - 2. Ảnh bìa đại diện của các tựa game bị cắt cụt đầu đuôi (do icon game là hình vuông 1:1 nhưng thẻ tin tức lại ép tỷ lệ ngang 16:10 hoặc 21:9 bằng `object-cover`), khiến tên và nhân vật game trong logo bị mất góc.
- **Nguyên nhân gốc rễ**:
  - 1. *Vòng lặp nháy ảnh vô hạn*: Các thẻ `<img>` trong `NewsView.tsx`, `NewsDetailModal.tsx` và `NewsModule.tsx` có `onError` gán URL ảnh dự phòng từ Unsplash nhưng **thiếu hoàn toàn** `e.currentTarget.onerror = null;`. Khi URL dự phòng bị chặn/chậm hoặc khi bài viết chứa `cover_url: ""` (chuỗi rỗng từ bài viết cào lỗi), trình duyệt liên tục bắn sự kiện `error` lặp đi lặp lại hàng chục lần mỗi giây. Đồng thời mỗi khi có sự kiện React re-render (như ticker marketing hay poller), chuỗi rỗng lại kích hoạt chu trình lỗi mới, gây nhấp nháy dữ dội.
  - 2. *Tỷ lệ khung hình không tương thích*: Game icon là ảnh vuông 1:1 (`512x512`), khi hiển thị với `w-full h-full object-cover` trong khung 16:10, trình duyệt phóng to và cắt bỏ ~38% phần trên và dưới của icon.
- **Giải pháp chuẩn đã kiểm chứng**:
  - 1. *Ngắt triệt để đệ quy lỗi*: Luôn đặt `el.onerror = null;` ngay đầu `onError`. Fallback 100% sử dụng tài nguyên cục bộ an toàn (`/game_icons/${slug}.webp` hoặc `/og-image.jpg`), tuyệt đối không dùng link mạng ngoài bên thứ 3.
  - 2. *Hàm lấy ảnh an toàn `getSafeArticleCover`*: Tuyệt đối không để `<img src="">`, nếu rỗng tự động fallback sang icon game hoặc `/og-image.jpg`.
  - 3. *Bố cục chuẩn mực cho Game Cover (Crisp Game Cover Pattern)*:
    - Nếu là icon game vuông (`/game_icons/...`): Render lớp nền mờ nghệ thuật Ambient Backdrop (`blur-2xl opacity-40 scale-125`) kết hợp chuyển màu tối góc cạnh. Ở chính giữa hiển thị icon game sắc nét, giữ nguyên tỷ lệ 1:1, bo góc (`rounded-2xl` / `rounded-3xl`), viền sáng nổi bật (`ring-2 ring-white/20`), đổ bóng 3D chân thực và hiệu ứng tương tác mượt mà khi rê chuột (`group-hover:scale-110`).
    - Nếu là ảnh phong cảnh / banner ngang (Landscape banner): Hiển thị trọn vẹn với `object-cover`.
  - 4. *Làm sạch dữ liệu máy chủ*: Chạy script dọn dẹp các bài viết rỗng, kích hoạt Tombstone xóa vĩnh viễn trên Cloudflare D1 và KV.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không gán `(e.target as HTMLImageElement).src = 'https://images.unsplash...'` mà quên `e.currentTarget.onerror = null;`*: Nếu link dự phòng gặp sự cố hoặc offline, trình duyệt sẽ rơi vào vòng lặp tử thần (infinite loop error).
  - ❌ *Không để `<img src={article.cover_url} />` khi `cover_url` có thể là chuỗi rỗng `""`*: Trình duyệt sẽ cố tải lại chính file HTML hiện tại dưới dạng ảnh, gây lỗi liên hoàn.
  - ❌ *Không ép `w-full h-full object-cover` lên các icon game tỷ lệ 1:1 trong khung hình ngang*: Sẽ cắt cụt logo và nhân vật của game.

---

### ISSUE-022: Lỗi Bất Đồng Bộ UI Hiển Thị Số Dư Ví Sau Khi Mua Tiện Ích/Sản Phẩm (checkUserDepositStatus False Revert & Missing State Callback)
- **Triệu chứng**:
  - Khách nạp 12.000 Core, mua 1 sản phẩm tiện ích hoặc store (ví dụ Basic 1 Day VS Phone giá 11.240 Core), đơn hàng thành công, kho trừ hàng chuyển sang "Hết hàng", sổ cái Admin D1 trừ tiền chính xác (Ví: 12.000 Core -> 760 Core). Nhưng trên Header / Dropdown thông tin nhân vật của Web Khách vẫn hiển thị nguyên "Số dư: 12.000 Core", gây cảm giác người mua không bị trừ tiền.
- **Nguyên nhân gốc rễ**:
  1. **Bẫy lọc duy nhất DEPOSIT trong `checkUserDepositStatus`**: Hàm `checkUserDepositStatus(userId)` trong `dataService.ts` chỉ lọc `t.type === 'DEPOSIT'`, tìm thấy giao dịch nạp tiền cũ (12.000 Core lúc 13:59:16) mà bỏ qua giao dịch mua hàng (11.240 Core lúc 15:05:19). Khi so sánh `txBalance (12.000) > currentBal (760)`, hàm ngộ nhận đây là một khoản nạp tiền mới chưa vào ví và tự động ghi đè ngược `currentUser.wallet_balance` về 12.000 Core!
  2. **Thiếu ghi chép giao dịch trừ tiền ở local**: `createUtilityOrder` và `createOrder` gửi request lên Cloudflare Pages Functions để trừ tiền trong D1 nhưng không lưu bản ghi giao dịch `ORDER` vào `wcg_admin_transactions_v4` ở LocalStorage, dẫn đến mảng giao dịch client chỉ có duy nhất lệnh nạp tiền.
  3. **Đứt gãy luồng React State**: `UtilitiesView` và `ProductCheckoutModal` không được truyền prop `onUpdateUser` từ `App.tsx`; `dataService.saveCurrentUser()` lưu vào LocalStorage nhưng không dispatch CustomEvent `wcg_user_updated`, khiến state React `currentUser` trong `App.tsx` không được render lại ngay lập tức.
  4. **Bẫy ghi đè dữ liệu thành viên từ Client Sync (`syncMembersToD1`)**: `d1_service.ts:1829` dùng `ON CONFLICT(id) DO UPDATE SET balance = excluded.balance`, có nguy cơ bị client sync mảng thành viên cũ đè lên số dư thực tế trong D1.
- **Giải pháp chuẩn đã kiểm chứng**:
  - *Sửa triệt để `checkUserDepositStatus`*: Quét toàn bộ lịch sử giao dịch (cả DEPOSIT và ORDER) xếp theo thời gian mới nhất. Nếu giao dịch mới nhất là ORDER/PURCHASE, ép số dư client phải khớp với `balanceAfter` của lệnh mua (760 Core), cấm tuyệt đối việc dùng giao dịch nạp cũ để ghi đè số dư.
  - *Ghi nhận giao dịch mua vào sổ cái client*: Trong `createUtilityOrder` và `createOrder`, tự động ghi bản ghi giao dịch `{ type: 'ORDER', amount: totalPrice, balanceBefore, balanceAfter }` vào `wcg_admin_transactions_v4`.
  - *Hoàn thiện cầu nối React State & CustomEvent*:
    + `dataService.saveCurrentUser` phát ngay `window.dispatchEvent(new CustomEvent('wcg_user_updated', { detail: user }))` và broadcast qua `BroadcastChannel('wcg_data_sync')`.
    + `App.tsx` lắng nghe sự kiện `wcg_user_updated` và truyền `onUpdateUser={handleUpdateUser}` cho cả `UtilitiesView` và `ProductCheckoutModal`.
    + `UtilitiesView` và `ProductCheckoutModal` gọi `onUpdateUser` ngay sau khi thanh toán thành công để header đổi số dư ngay lập tức 0 giây.
  - *Khóa an toàn D1 Ledger*: Trong `d1_service.ts:syncMembersToD1`, thêm điều kiện SQL `balance = CASE WHEN (SELECT COUNT(*) FROM wallet_transactions WHERE member_id = members.id) > 0 THEN members.balance ELSE excluded.balance END` để D1 luôn là Single Source of Truth tuyệt đối.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không được lọc duy nhất `t.type === 'DEPOSIT'` rồi so sánh `txBalance > currentBal`*: Sẽ luôn khiến bất kỳ lệnh nạp cũ nào đè bẹp số dư sau khi khách đã mua hàng.
### ISSUE-023: Bất Đồng Bộ Giữa Cột Tĩnh members.balance Và Sổ Cái wallet_transactions Trong Cloudflare D1 (ACID Single Source of Truth Desync)
- **Triệu chứng**:
  - Dù tài khoản đã trừ tiền và sổ cái `wallet_transactions` ghi nhận số dư sau giao dịch là 760 Core, nhưng khi người dùng mở trình duyệt (hoặc sau khi cập nhật mã nguồn) màn hình vẫn hiển thị 12.000 Core. Cột tĩnh `members.balance` trên Cloudflare D1 bị lưu lệch giá trị so với số dư sau giao dịch mới nhất.
- **Nguyên nhân gốc rễ**:
  1. *Lệch pha giữa bảng `members` và bảng `wallet_transactions`*: Trước đây lệnh `syncMembersToD1` đã vô tình ghi đè mảng thành viên cũ từ client vào bảng `members`, khiến hàng của user `usr_1791606009927_p1nu` có `balance = 12000` trong khi bảng `wallet_transactions` ghi nhận số dư thực tế là 760 Core.
  2. *Truy vấn tĩnh không tham chiếu sổ cái*: Hàm `loadAllMembersD1` và `/api/auth/me` chỉ `SELECT balance FROM members`, đọc trực tiếp cột tĩnh bị sai lệch mà không tham chiếu đến số dư cuối cùng của sổ cái `wallet_transactions.balance_after`.
  3. *Thiếu phản xạ trạng thái tức thì khi refresh balance*: `dataService.refreshCurrentUserBalance()` chỉ gán vào `localStorage.setItem` mà không gọi `saveCurrentUser(user)`, dẫn đến việc không kích hoạt `wcg_user_updated` và `BroadcastChannel`, UI không được thông báo để render lại số dư mới.
- **Giải pháp chuẩn đã kiểm chứng**:
  - 1. *Đối soát và khôi phục D1 trực tiếp (Reconciliation)*: Chạy endpoint `/api/sync` với action `reconcile_member_balances` để đồng bộ lại 100% các dòng `members.balance` khớp với `wallet_transactions.balance_after` mới nhất.
  2. *Động hóa số dư qua Subquery SQL (Single Source of Truth)*:
     - Trong `loadAllMembersD1` (`functions/services/d1_service.ts`):
       ```sql
       COALESCE(
         (SELECT balance_after FROM wallet_transactions WHERE member_id = members.id ORDER BY created_at DESC LIMIT 1),
         balance
       ) AS balance
       ```
     - Biến bảng sổ cái giao dịch `wallet_transactions` thành chân lý duy nhất. Bất kể cột tĩnh `members.balance` có giá trị gì, hệ thống luôn trả về số dư thực tế của sổ cái.
  3. *Cơ chế Tự Phục Hồi (Self-Healing) trong `/api/auth/me`*:
     - Kiểm tra nếu `latestTxRow.balance_after !== member.balance`, hệ thống tự động sửa `members.balance` trong D1 qua `context.waitUntil` và lập tức trả về số dư từ sổ cái.
  4. *Đồng bộ UI 0 giây*:
     - `src/services/dataService.ts`: Trong `refreshCurrentUserBalance()`, nếu phát hiện số dư thay đổi thì gọi `this.saveCurrentUser(user)` để phát `wcg_user_updated` và gửi qua `BroadcastChannel`.
     - `src/App.tsx`: Thêm timer 2 giây ngay khi khởi chạy để đồng bộ tức thì số dư mới nhất từ Edge server.
### ISSUE-024: Tràn Bảng Moderation Đẩy Cột Thao Tác (Duyệt/Sửa/Xóa) Ra Ngoài Màn Hình & Tràn Chiều Cao Vô Hạn Do Thiếu Phân Trang
- **Triệu chứng**:
  - Trong Admin (`/admin#/crawler`), bảng Hàng Chờ Duyệt Giftcode bị tràn ngang, các nút thao tác Duyệt (Approve), Sửa (Edit), Xóa (Reject) bị đẩy ra khỏi rìa phải màn hình, người dùng phải cuộn ngang sang phải mới thấy. Đồng thời khi danh sách có hàng trăm mã (499 mã), bảng bị kéo dài hàng nghìn pixel theo chiều dọc.
- **Nguyên nhân gốc rễ**:
  1. Thiếu thuộc tính `table-fixed` và thiếu giới hạn `truncate` cho tên tựa game và phần thưởng, khiến các chuỗi dài tự do giãn rộng hàng trăm pixel làm vỡ khung hiển thị.
  2. Cột thao tác nằm ở cuối bảng nhưng không được gán `sticky right-0`, khiến bất kỳ sự co giãn nào của màn hình hoặc sidebar đều đẩy cột này ra ngoài viewport.
  3. Thiếu phân trang (Pagination) ở hàng chờ duyệt khiến toàn bộ 499 mã render cùng một lúc trên DOM.
- **Giải pháp chuẩn đã kiểm chứng**:
  1. *Khóa cứng tỷ lệ bảng*: Áp dụng `table-fixed min-w-[840px] w-full` và phân bổ độ rộng pixel cố định cho các cột nhỏ (`w-10`, `w-32`, `w-44`, `w-48`, `w-36`).
  2. *Sticky Action Column Pattern*: Header và cell của cột Thao Tác luôn mang cờ `sticky right-0 bg-slate-950/95` và `sticky right-0 bg-slate-900/95 group-hover:bg-slate-800/95 border-l border-slate-800 shadow-[-6px_0_12px_rgba(0,0,0,0.5)] z-10`, ghim chặt 3 nút Duyệt, Sửa, Xóa cố định trên màn hình trong mọi tình huống.
  3. *Trang bị Pagination Engine*: Phân trang 20 mã / trang mặc định kèm nút chuyển trang và thanh chọn số lượng mã mỗi trang (15/20/50/100).
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không để bảng dữ liệu admin co giãn tự do mà không có `table-fixed`*: Tên game hoặc nội dung quà dài sẽ đẩy bung toàn bộ các cột hành động ra khỏi màn hình.
### ISSUE-025: Lỗi Chặn Thoát Sớm Trong ensureSchemaUpgrades Làm Đứt Gãy Cập Nhật Bảng SQL utilities D1 & Tràn Ngược Mô Tả Cũ
- **Triệu chứng**:
  - Dữ liệu tiện ích (như description, instructions) được gửi lên `/api/sync` báo thành công 200 và đã lưu vào `system_settings`, nhưng khi truy vấn lại `GET /api/sync`, dữ liệu mô tả vẫn là văn bản cũ không thay đổi.
- **Nguyên nhân gốc rễ**:
  1. Trong `ensureSchemaUpgrades`, dòng kiểm tra `SELECT 1 FROM giveaway_claim_guards LIMIT 1` trả về true khiến hàm thoát sớm (early return) trước khi kịp thực thi các lệnh `ALTER TABLE utilities ADD COLUMN guide_url...` phía sau.
  2. Bảng `utilities` trên D1 thiếu các cột mới, dẫn đến câu lệnh upsert hàng loạt trong `syncUtilitiesToD1` bị sập với lỗi `no such column`. Khối lệnh bị `catch` âm thầm nên bảng `utilities` không được cập nhật.
  3. Trong `sync.ts`, logic merge sử dụng `u.description || meta.description || ''`. Vì `u.description` lấy từ bảng SQL `utilities` vẫn còn chứa chuỗi mô tả cũ nên nó luôn đè lên chuỗi mô tả mới trong `meta.description`.
- **Giải pháp chuẩn đã kiểm chứng**:
  1. Chuyển cơ chế kiểm tra checkpoint di chuyển schema sang bảng `schema_migrations` với ID duy nhất (ví dụ `'schema_v5_full_upgrades'`).
  2. Bổ sung cơ chế fallback hai tầng trong `syncUtilitiesToD1`: nếu upsert toàn bộ cột thất bại, tự động hạ cấp xuống upsert các cột cơ sở và thực thi mảng lệnh `UPDATE utilities SET description = ? WHERE id = ?` trực tiếp cho từng bản ghi.
  3. Trong `sync.ts`, ưu tiên dữ liệu từ cấu hình admin/sync mới nhất: `description: (meta && meta.description) ? meta.description : (u.description || '')`.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không dùng sự tồn tại của 1 bảng ngẫu nhiên làm cờ đánh dấu toàn bộ các migration sau đó đã hoàn tất*: Khi thêm migration mới, các câu lệnh mới sẽ bị bỏ qua hoàn toàn trên DB đã tồn tại bảng đó.
### ISSUE-026: Tràn Thông Báo Toast Chồng Chất Đè Lên Cột Nút Thao Tác Trong Admin (Toast Action Obstruction)
- **Triệu chứng**:
  - Khi quản trị viên thao tác liên tục (như duyệt hoặc xóa giftcode nhanh), hàng loạt thông báo Toast xếp chồng lên nhau thành cột cao ở góc dưới bên phải, đè trực tiếp lên cột nút "THAO TÁC" (Duyệt, Sửa, Xóa).
  - Vì toast có `pointer-events-auto`, cú click tiếp theo của admin bị rơi vào toast thay vì nút bấm của hàng tiếp theo.
- **Nguyên nhân gốc rễ**:
  1. Trong `AdminApp.tsx`, hàm `showToast` không cài đặt timer `setTimeout` tự động đóng, khiến mọi toast hiển thị vĩnh viễn cho đến khi bấm dấu 'X' thủ công.
  2. Vị trí hiển thị `ToastContainer` đặt cố định ở góc dưới bên phải (`sm:right-5 sm:bottom-5`), thẳng hàng với cột thao tác dính mép phải (`sticky right-0`).
  3. Không giới hạn số lượng toast hiển thị tối đa (Queue Capping).
- **Giải pháp chuẩn đã kiểm chứng**:
  1. Chuyển vị trí `ToastContainer` trong Admin sang đỉnh giữa màn hình (`top-center`: `fixed top-4 left-1/2 -translate-x-1/2`), giải phóng 100% không gian cho các nút thao tác bên phải.
  2. Tích hợp bộ đếm tự động đóng (Auto-Dismiss Timer: 2.5s) bên trong `ToastItem` và `AdminApp.tsx`, hỗ trợ tạm dừng khi rê chuột và click vào toast để tắt ngay.
  3. Khóa cứng giới hạn tối đa 3 thông báo hiển thị cùng lúc (`maxVisible={3}` và `prev.slice(-2)`), tự động đẩy thông báo cũ nhất ra khỏi màn hình khi có thông báo mới.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không đặt ToastContainer ở góc dưới bên phải hoặc góc trên bên phải trên các trang có bảng dữ liệu sở hữu cột thao tác sticky*: Sẽ luôn đè lên các nút thao tác của bảng.
  - ❌ *Không tạo toast mà không có timer tự động tắt (auto-dismiss)*: Khiến màn hình bị kẹt thông báo vô tận.
### ISSUE-027: Bẫy Lọc & Thao Tác Duyệt / Xóa Giftcode Hàng Chờ Theo Nguồn Thiếu Chuẩn Hóa Domain (Crawler Source Filter & Bulk Action Trap)
- **Triệu chứng**:
  - Khi quản lý mã cào trong Hàng Chờ Duyệt (`/admin#/crawler`), danh sách mã cào đến từ nhiều nguồn khác nhau (như các chuyên trang game quốc tế hoặc các nguồn cũ). Quản trị viên không thể lọc riêng theo từng nguồn để duyệt nhanh hoặc xóa nhanh toàn bộ mã của một nguồn.
  - Nếu lọc theo chuỗi thô `item.sourceName`, các chuỗi có định dạng khác nhau (ví dụ: `CodeMoi - Game A`, `CodeMoi - Game B`, `Try Hard Guides`) bị phân tán thành hàng trăm nhóm riêng lẻ, khiến bộ lọc không thể gom nhóm.
- **Nguyên nhân gốc rễ**:
  1. Dữ liệu `PendingCrawlerCode` lưu `sourceName` gắn kèm tên tựa game (`sourceName: "CodeMoi - Tên Game"`), trong khi `sourceUrl` chứa URL bài viết cụ thể.
  2. Nếu chỉ so sánh chính xác chuỗi `item.sourceName`, mỗi game tạo thành 1 nguồn riêng lẻ khiến dropdown có hàng trăm mục thay vì nhóm lại theo thương hiệu/domain nguồn.
  3. Thiếu thao tác 1-chạm kết hợp với các endpoint backend `batch_approve_crawler_codes` và `batch_reject_crawler_codes` cho một nguồn đã chọn.
- **Giải pháp chuẩn đã kiểm chứng**:
  1. *Hàm phân nhóm nguồn chuẩn mực `getCrawlerSourceInfo`*: Phân tích kết hợp cả `sourceUrl` và `sourceName`, nhận diện các thương hiệu nguồn chính xác (`codemoi.net`, `tryhardguides.com`, `pockettactics.com`, `gamerpower.com`, `sforum.vn`, `ldplayer.net`, `facebook.com`, `discord.com`).
  2. Fallback trích xuất hostname động `new URL(item.sourceUrl).hostname.replace(/^www\./, '')` cho mọi website quốc tế mới mà không cần hardcode thủ công.
  3. Tổng hợp `availablePendingSources` tính sẵn số lượng mã (`count`) để hiển thị trực tiếp trong dropdown và banner.
  4. Cung cấp banner thao tác 1-chạm: "Duyệt tất cả nguồn này (X mã)" và "Xóa tất cả nguồn này (X mã)" kết nối trực tiếp với batch API D1/KV.
  5. Trong bảng dữ liệu, nhấp vào tên nguồn ở cột "NGUỒN CÀO" sẽ tự động kích hoạt bộ lọc nguồn tương ứng.
### ISSUE-028: Bẫy Lệnh Reset Ngủ Quên (Dormant Reset Bomb) & Lỗi Ép Tồn Kho Bằng 0 Đè Lên Kho D1 Thật
- **Triệu chứng**:
  - Sau một cập nhật schema hoặc khởi động lại worker, số dư của tất cả thành viên bị reset về 0 VNĐ / 0 Core, bảng lịch sử giao dịch và đơn hàng bị xóa sạch.
  - Các sản phẩm tiện ích hoặc gói nạp dù trong kho mã D1 (`inventory_codes`) vẫn còn hàng sẵn nhưng trên web khách lại hiển thị 0 mã tồn kho ("HẾT HÀNG") và không thể đặt mua.
- **Nguyên nhân gốc rễ**:
  1. *Khối reset ngủ quên (Dormant Reset Bomb)*: Trong `d1_service.ts`, các đoạn mã reset cũ (như `UPDATE members SET balance = 0`, `DELETE FROM wallet_transactions`) từng được viết cho giai đoạn test và được "bảo vệ" ngầm bằng một lệnh return sớm ở đầu hàm `ensureSchemaUpgrades`. Khi điều kiện return sớm bị thay đổi hoặc nâng cấp schema migration ID, luồng thực thi lọt xuống cuối hàm và kích hoạt lại khối lệnh hủy diệt trên database production.
  2. *Lỗi ép tồn kho bằng 0*: Trong `functions/api/sync.ts`, logic `(meta.stock_quantity !== undefined && Number(meta.stock_quantity) === 0) ? 0 : ...` đọc `stock_quantity: 0` từ snapshot/file JSON tĩnh và ép tồn kho bằng 0, ghi đè lên số lượng tồn kho thực tế tính từ các mã `AVAILABLE` trong D1.
- **Giải pháp chuẩn đã kiểm chứng**:
  1. **Tuyệt đối không bao giờ để lại câu lệnh `DELETE` hoặc `UPDATE balance = 0` diện rộng bên trong mã nguồn khởi động hệ thống (`ensureSchemaUpgrades`, `init`, v.v.)**: Mọi thao tác reset chỉ được phép chạy thủ công có chủ đích bằng tay qua lệnh CLI bảo mật, không bao giờ đặt trong code runtime của Serverless Worker.
  2. Xóa bỏ triệt để các khối `reset_all_wallets_to_zero_v1` và `wcg_d1_wallets_revenue_reset_v5`.
  3. Xây dựng migration tự phục hồi `heal_and_restore_wallets_v6` để tự động khôi phục số dư ví thành viên và lịch sử giao dịch theo đúng sổ cái kế toán.
  4. Trong `sync.ts`, luôn ưu tiên số lượng tồn kho thực tế từ D1 (`u.stock_quantity !== undefined ? Math.max(0, Number(u.stock_quantity)) : ...`), không để file tĩnh ghi đè trạng thái hết hàng lên cơ sở dữ liệu.
### ISSUE-029: Bẫy Treo Màn Hình Xác Thực Quản Trị Vô Tận (Admin Auth Spin Loop & Missing Watchdog Trap)
- **Triệu chứng**:
  - Khi quản trị viên truy cập trang `/admin` (hoặc `admin-code-game-shop.pages.dev/admin#/utilities`), màn hình bị đứng yên ở trạng thái "Đang xác thực phiên quản trị..." với vòng xoay vô tận. Không vào được dashboard và cũng không tự chuyển sang form đăng nhập.
- **Nguyên nhân gốc rễ**:
  1. *Lệnh fetch không timeout*: `verifyAdminSession` gọi `fetch()` đến 4 endpoint liên tiếp (`/api/auth/me`, `codegame.shop`, v.v.) không có `AbortSignal` hay giới hạn thời gian. Khi gặp domain bị chậm mạng hoặc preflight CORS nghẽn, trình duyệt treo promise vô thời hạn.
  2. *Bẫy cờ `cancelled` trong React `useEffect`*: Khi component mount hoặc router đổi hash, cleanup function gán `cancelled = true`. Khi `verifyAdminSession()` kết thúc, khối `if (!cancelled) setIsVerifying(false)` bị bỏ qua hoàn toàn, khiến `isVerifying` kẹt ở `true` vĩnh viễn.
  3. *Không có cơ chế thoát hiểm (Escape Hatch)*: Màn hình loading chỉ hiển thị spinner mà không có nút hủy bỏ hay đăng nhập lại.
- **Giải pháp chuẩn đã kiểm chứng**:
  1. Sử dụng `fetchWithTimeout(url, options, 3000)` với `AbortController` cho mọi lệnh gọi xác thực mạng.
  2. Fail-fast ngay lập tức nếu server trả về `401` hoặc `403` (phiên đã hết hạn): Xóa cờ, gán `isVerifying = false` ngay, không duyệt tiếp các domain khác.
  3. Tích hợp Safety Watchdog Timer (3.5s) trong `useEffect` để ép `setIsVerifying(false)` trong mọi tình huống.
  4. Cung cấp nút bấm "Đăng nhập lại bằng tài khoản quản trị" ngay dưới spinner để người dùng luôn có lối thoát chủ động.
### ISSUE-030: Bẫy Robot Xanh Mặc Định & Lưới Ô Android Trên File Cài Đặt (.APK) (Android Default Vector & Adaptive Icon Trap)
- **Triệu chứng**:
  - Người dùng tải file `.APK` về cài đặt trên điện thoại Android nhưng icon ứng dụng hiển thị logo robot màu xanh mặc định của Android hoặc hình ảnh placeholder Capacitor, không hiển thị logo chính thức của web CodeGame.
- **Nguyên nhân gốc rễ**:
  1. *Bẫy vector override trong `drawable-v24/`*: Thư mục `android/app/src/main/res/drawable-v24/` chứa file `ic_launcher_foreground.xml` là vector hình robot Android xanh mặc định. Trên mọi thiết bị Android API 24+ (Android 7.0 đến Android 15), hệ điều hành ưu tiên nạp file vector này đè lên các file PNG trong `mipmap-*/`.
  2. *Bẫy adaptive icon grid*: File `drawable/ic_launcher_background.xml` chứa đường vẽ lưới ô xanh ngọc `#26A69A` của Android Studio template, khiến adaptive icon bị viền và nền xanh ngọc không khớp giao diện web.
  3. *Màu nền XML*: `values/ic_launcher_background.xml` để `#FFFFFF` thay vì màu đen thương hiệu `#0B0D19`.
- **Giải pháp chuẩn đã kiểm chứng**:
  1. Xóa hoàn toàn file vector robot `drawable-v24/ic_launcher_foreground.xml`.
  2. Dùng sharp tạo trọn bộ PNG cho 5 mật độ màn hình (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`):
     - `ic_launcher.png`: Bo góc 18% của logo web.
     - `ic_launcher_round.png`: Cắt tròn 100% của logo web.
     - `ic_launcher_foreground.png`: Logo căn giữa trong vùng an toàn (Safe-Zone 68% của canvas 108dp) trên nền trong suốt.
  3. Cập nhật màu nền `ic_launcher_background` sang chuẩn màu thương hiệu `#0B0D19`.
  4. Tạo đồng bộ 11 kích thước ảnh splash screen màn hình chờ (`splash.png`) với logo căn giữa trên nền `#0B0D19`.
  5. Đưa lệnh `node scripts/generate_android_icons.cjs` vào CI/CD workflow `.github/workflows/build-apk.yml`.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không chỉ thay file PNG trong `mipmap/` mà quên xóa `drawable-v24/ic_launcher_foreground.xml`*: Android 7.0+ sẽ luôn ưu tiên file vector robot xanh trong `drawable-v24/`.
  - ❌ *Không để logo tràn 100% mép canvas trong `ic_launcher_foreground.png`*: Khi các launcher Android (Samsung OneUI, Xiaomi MIUI, Google Pixel) áp dụng mặt nạ hình tròn hoặc squircle sẽ làm cắt mất chi tiết logo nếu không có lề an toàn 68%.

### ISSUE-031: Bẫy Lệch Key Cấu Hình Khi Lưu Crawler Sources Giữa KV & D1 Settings (D1 Crawler Settings Desync Trap)
- **Triệu chứng**:
  - Dữ liệu nguồn cào code đã được mở rộng lên 933 nguồn trong mã nguồn frontend và file JSON tĩnh, nhưng khi mở trang Quản lý Crawler trong Admin (`/admin#/crawler`), hệ thống vẫn hiển thị cố định số lượng cũ (855 nguồn).
- **Nguyên nhân gốc rễ**:
  1. *Lệch key giữa KV và D1*: Trong Cloudflare Worker `functions/api/sync.ts`, `GET /api/sync` ưu tiên đọc nguồn crawler từ D1 settings với key `wcg_crawler_sources_v1`. Tuy nhiên, khi script đồng bộ gửi payload dạng `{ key: 'wcg_admin_crawler_sources_v5', data: sources }`, nhánh lưu D1 `if (body.crawlerSources !== undefined)` không được kích hoạt vì dữ liệu nằm trong `body.data`, dẫn đến việc D1 giữ nguyên snapshot cũ 855 nguồn.
  2. *Ghi đè mù quáng ở Frontend*: `CrawlerModule.tsx` trước đây khi nhận mảng `data.crawlerSources` từ server đã gán trực tiếp vào state mà không thực hiện phép hợp (union) với `defaultSources` có sẵn trong build frontend.
- **Giải pháp chuẩn đã kiểm chứng**:
  1. Chuẩn hóa Worker API `sync.ts` xử lý trọn vẹn cả 2 key `wcg_crawler_sources_v1`, `wcg_admin_crawler_sources_v5` và trường `body.crawlerSources`, tự động parse mảng và ghi đồng bộ vào cả Cloudflare KV lẫn bảng cài đặt D1.
  2. Trang bị cơ chế Self-Healing Auto-Merge trong `CrawlerModule.tsx`: Frontend tự động lấy tập hợp (union) theo URL chuẩn hóa giữa danh sách server và `defaultSources`. Nếu phát hiện có nguồn mới chưa có trên server, frontend ngay lập tức khôi phục đủ và đẩy ngược về server để cập nhật D1.
  3. Cập nhật script đồng bộ `scripts/push_to_kv_sync.cjs` truyền đủ cả 2 trường `key: 'wcg_crawler_sources_v1'` và `crawlerSources: sources`.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không chỉ push lên Cloudflare KV mà quên đồng bộ vào bảng cài đặt D1*: `sync.ts` khi có query `?fresh=true` luôn đọc D1 settings làm nguồn gốc sự thật, nếu D1 không được cập nhật thì KV sẽ bị vô hiệu.
### ISSUE-032: Bẫy D1 Row Quota 1MB Làm Rỗng Danh Mục Khi Không Có Bundled Fallback Trong Worker API (Edge Worker API D1 Fallback Trap)
- **Triệu chứng**:
  - Khi gọi `/api/games` hoặc `/api/games?slug=...`, API trả về 0 games (`total: 0`) hoặc lỗi 404 `"Không tìm thấy trò chơi."` mặc dù file tĩnh và frontend vẫn hiển thị đủ 623 tựa game.
- **Nguyên nhân gốc rễ**:
  1. *Giới hạn dung lượng hàng D1 (D1 1MB Row Quota)*: Cloudflare D1 giới hạn 1MB cho mỗi tham số truy vấn và hàng dữ liệu. Khi lưu danh mục mã quà tặng `wcg_admin_free_codes_v5` (>4MB) hoặc danh mục lớn vào bảng `system_settings`, thao tác `INSERT` bị D1 từ chối hoặc bỏ qua để tránh sập transaction.
  2. *Thiếu tầng dữ liệu dự phòng (Bundled Fallback)*: Trong `functions/api/games.ts` và `functions/api/sync.ts`, nếu D1 settings chưa có hoặc rỗng, code gán mảng rỗng `[]` thay vì fallback về danh mục 623 games và 5,321 mã có sẵn trong build.
- **Giải pháp chuẩn đã kiểm chứng**:
  1. Import trực tiếp `fallbackGamesData` (`src/data/games188.json`) và `fallbackCodesData` (`src/data/crawled_codes_188.json`) vào worker bundle `dist/_worker.js` bằng ESBuild.
  2. Sử dụng toán tử fallback: Nếu D1 settings không có hoặc rỗng (`!Array.isArray(settings[...]) || settings[...].length === 0`), Worker tự động sử dụng `fallbackGamesData` và `fallbackCodesData`.
  3. Khi có mã mới (custom codes), Worker hợp nhất các mã custom từ D1 lên trên danh mục bundled, đảm bảo API luôn trả về đủ 623 tựa game và đầy đủ 100% giftcode.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không phụ thuộc 100% vào việc ghi mảng monolithic >1MB vào 1 hàng trong bảng system_settings D1*: Bắt buộc phải có bundled fallback trong Edge Worker bundle.

### ISSUE-033: Lệch Tầng Giữa Git Rollback và Cơ Sở Dữ Liệu Cloudflare D1/KV Làm Trắng Trang Bán Hàng & Tiện Ích
- **Triệu chứng**:
  - Khi hoàn tác mã nguồn bằng `git checkout` hoặc `git revert`, mã nguồn cục bộ đã trở về commit cũ nhưng trên web trực tuyến:
    1. Trang Cửa Hàng và Tiện Ích bị rỗng hoàn toàn, không có sản phẩm nào.
    2. Mục Giật Code vẫn hiển thị các chiến dịch giveaway đã thêm ở các bản sau (như Delta Force).
    3. Thông tin ngân hàng nạp tiền bị nhảy về tài khoản mẫu placeholder (MBBank 0987654321) thay vì tài khoản chủ shop (TPBank 10004681879).
- **Nguyên nhân gốc rễ**:
  1. *Lệch tầng dữ liệu*: Lệnh `git checkout` chỉ tác động đến tệp tĩnh trên ổ cứng máy tính, hoàn toàn không thay đổi trạng thái Cloudflare D1 SQL hoặc KV trên Edge Server. Khi client gọi `/api/sync`, Worker đọc từ D1 (lúc này các bảng sản phẩm có thể chưa được nạp hoặc rỗng), trả về `utilities: []` và `storeProducts: []`, ghi đè làm trắng trình duyệt.
  2. *Thời điểm commit*: Chiến dịch giveaway như Delta Force (`gw_alienware_vaultbreakers`) được commit lúc 00:49 ngày 14/10, trước commit cập nhật 8 mã Pirate Legends (19:11 ngày 14/10), do đó việc rollback về thời điểm up code Pirate Legends vẫn giữ lại Delta Force trong file mã nguồn nếu không kiểm tra và xóa thủ công.
- **Giải pháp chuẩn đã kiểm chứng**:
  1. *Đồng bộ D1/KV đi kèm Rollback*: Bất cứ khi nào hoàn tác Git, bắt buộc phải chạy script `scripts/push_to_kv_sync.cjs` để nạp đồng bộ toàn bộ 8 danh mục dữ liệu tương ứng lên Cloudflare D1 & KV.
  2. *Cơ chế Fallback & Tự Lành (Self-Healing Baseline)*:
     - Trong `functions/api/sync.ts`: Nếu D1 trả về `utilities` hoặc `storeProducts` rỗng, Worker tự động nạp từ `src/data/utilities.json` (19 tiện ích) và `src/data/storeProducts.json` (6 sản phẩm), đồng thời auto-heal ghi ngược lại D1.
     - Trong `dataService.ts`: Nếu API trả về mảng rỗng, client tuyệt đối không ghi đè xóa sạch state mà fallback về `defaultUtilities` và `defaultStoreProducts`.
  3. *Khóa cứng tài khoản thanh toán*: Enforce TPBank `10004681879` `CODE GAME SHOP` ở cả Edge Worker và Client.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Tuyệt đối không chỉ rollback Git mà không chạy push_to_kv_sync.cjs*: Sẽ gây đứt gãy giữa Edge Worker và cơ sở dữ liệu cloud.

---

### ISSUE-034: Bẫy Đặt Hook Phía Sau Early Return Trong Modal Nạp Tiền & Lỗi Trình Duyệt Cốc Cốc Chặn Ảnh QR Bên Thứ Ba
- **Triệu chứng**:
  1. Khi mở hoặc đóng modal nạp tiền `UserWalletModal`, ứng dụng React bị sập với mã lỗi `React error #310` ("Rendered more hooks than during the previous render").
  2. Trên trình duyệt Cốc Cốc hoặc trình duyệt có cài tiện ích chặn quảng cáo (uBlock Origin, AdGuard), khung hiển thị mã QR thanh toán nạp Core bị vỡ icon ảnh hoặc báo lỗi mạng không tải được ảnh từ CDN bên ngoài (`qr.sepay.vn` hoặc `img.vietqr.io`).
- **Nguyên nhân gốc rễ**:
  1. *Vi phạm React Rules of Hooks*: Trong `UserWalletModal.tsx`, câu lệnh thoát sớm `if (!isOpen) return null;` được đặt ở dòng 182. Nếu đặt `useEffect` hoặc hook nào phía dưới câu lệnh này, React sẽ ghi nhận số lượng hook bị thay đổi khi modal chuyển từ đóng sang mở hoặc ngược lại $\rightarrow$ gây crash sập toàn bộ component cây DOM.
  2. *Chặn ảnh QR CDN bên ngoài*: CDN của các dịch vụ sinh QR bên ngoài (`qr.sepay.vn`, `vietqr.io`) thường nằm trong danh sách bộ lọc EasyPrivacy / Fanboy's Annoyance của trình duyệt Cốc Cốc và adblockers, khiến yêu cầu tải ảnh PNG bị chặn (ERR_BLOCKED_BY_CLIENT).
- **Giải pháp chuẩn đã kiểm chứng**:
  1. *Tuân thủ 100% Rules of Hooks*: Di chuyển toàn bộ khai báo State, Refs, useMemo, và `useEffect` sinh `qrDataUrl` lên top-level của component, nằm hoàn toàn trước câu lệnh `if (!isOpen) return null;`.
  2. *Sinh mã VietQR nội bộ chuẩn EMVCo Base64*: Sử dụng thư viện `qrcode` và bộ tạo chuỗi EMVCo NAPAS 247 cục bộ (`generateVietQrDataUrl` trong `vietQrUtils.ts`) sinh Data URL Base64 (`data:image/png;base64,...`) ngay trong trình duyệt. Không gọi bất kỳ network request nào ra bên ngoài $\rightarrow$ Miễn nhiễm 100% với Adblocker, Cốc Cốc, và lỗi gián đoạn mạng.
  3. *Chuẩn hóa tài khoản TPBank*: Fallback mặc định trong cả `UserWalletModal.tsx` và `adminDataService.ts` luôn là **TPBank - 10004681879 - CODE GAME SHOP**.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Tuyệt đối không đặt bất kỳ hook (`useEffect`, `useState`, `useMemo`) phía dưới `if (!isOpen) return null;`*: Sẽ gây lỗi React crash #310 ngay lập tức khi mở modal.
  - ❌ *Không chỉ sử dụng URL ảnh CDN `qr.sepay.vn` làm nguồn duy nhất*: Sẽ bị Cốc Cốc và uBlock Origin chặn làm vỡ icon ảnh mã QR.

---

### ISSUE-035: Sản Phẩm & Chiến Dịch Test Của Hệ Thống Bị Sót Lại Trên Production (Test Artifacts Leaking to Production - Case Yến Vân & Rotwood)
- **Triệu chứng**:
  - Trên web khách mục "Giật code" (/giveaways), xuất hiện chiến dịch test `GamerPower × Rotwood Drakin Armoury Steam Loot` gán nhầm vào tựa game `Yến Vân Thập Lục Thanh (Where Winds Meet)` (`gw_gamerpower_rotwood`) hiển thị còn 15-50 code, kèm 4 mã giftcode test quốc tế.
  - Tương tự, trước đó xuất hiện `ut_test_01` trong Tiện Ích và 6 gói mock trong Cửa Hàng.
- **Nguyên nhân gốc rễ**:
  - Trong commit `9ee758c` (khi tích hợp nguồn cào quốc tế GamerPower / Alienware Arena), các chiến dịch giveaway và giftcode test đã được inject trực tiếp vào `giveaways.json` và `crawled_codes_188.json`.
  - Khi dọn dẹp Delta Force ở các lượt trước, tác nhân chỉ lọc ID Delta Force mà bỏ sót `gw_gamerpower_rotwood`. Vì `giveaways.json` và bảng SQL Cloudflare D1 vẫn lưu bản ghi này nên hệ thống tiếp tục xếp nó lên đầu danh sách Giật Code vì còn code.
  - Thiếu chốt chặn tự động (Gatekeeper) trước khi build/deploy để rà soát toàn diện các artifact test.
- **Giải pháp chuẩn đã kiểm chứng (Kiến trúc phòng vệ 4 lớp dứt điểm)**:
  1. *Lớp 1 (Tombstones triệt để)*: Bổ sung `gw_gamerpower_rotwood`, `ut_test_01`, `sp_*` mock và 4 mã test quốc tế vào danh sách Tombstones `legacySeedGwIds`, `legacySeedStoreIds`, `legacySeedUtilIds` trong `sync.ts` và gửi lệnh `DELETE FROM` tới Cloudflare D1 SQL.
  2. *Lớp 2 (Edge Worker Guard)*: `functions/api/sync.ts` tự động phát hiện và loại bỏ 100% item test, không bao giờ serve ra API công khai.
  3. *Lớp 3 (Client Disinfection)*: `dataService.ts` tự động thanh tẩy LocalStorage và memory cache 0ms khi khởi động.
  4. *Lớp 4 (Pre-Build Gatekeeper Hook)*: Tạo script `scripts/audit_zero_test_artifacts.cjs` tích hợp trực tiếp vào `npm run build`. Bất kỳ tệp JSON hay API nào còn sót 1 mục test sẽ khiến build bị dừng ngay lập tức (Fail Fast).
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không sửa sót nửa vời (chỉ xóa Delta Force mà quên Yến Vân/Rotwood cùng commit)*: Phải luôn dùng `git diff` kiểm tra toàn bộ thay đổi của commit gốc sinh ra dữ liệu test.
  - ❌ *Không chỉ xóa trên frontend mà không gửi Tombstone lên D1*: Bảng SQL D1 sẽ tự phục hồi bản ghi cũ.
  - ❌ *Không build/deploy mà không qua script kiểm tra tự động*: Phải luôn để `audit_zero_test_artifacts.cjs` làm chốt chặn.

### ISSUE-036: Lệch Số Ảo Admin & Web Khách Do Khóa Đỉnh Đơn Điệu (Monotonic Peak Lock) & Nhảy Mốc Anchor (+70 Đơn Bù Giờ)
- **Triệu chứng**:
  - Admin vào trang quản trị hạ hoặc cài đặt lại số ảo cho Tiện ích (ví dụ VIP 7 Days VS Phone từ 136 xuống 64) hoặc Giveaway (Pirate Legends từ 123 xuống 52), nhưng sau khi lưu và tải lại trang, Web Khách vẫn giữ số cũ (137, 124).
- **Nguyên nhân gốc rễ**:
  1. *Khóa Đỉnh Đơn Điệu (`Math.max`)*: Server `functions/api/sync.ts` và bộ nhớ đỉnh `realEventsHub` sử dụng `Math.max(peak, target)`. Khi Admin hạ số, `Math.max` từ chối hạ đỉnh cũ.
  2. *Trần Đỉnh Quá Cao (`50000`)*: `deterministicEngine.ts` và `snapshotService.ts` đặt trần 50.000 nên coi 137 là đỉnh hợp lệ.
  3. *Client Gửi Ngược Đỉnh Lên Server*: `marketingService.ts` lưu `recordedMax` trong LocalStorage và sau đó gọi `schedulePeakReport()` gửi 137 đè ngược lại server.
  4. *Lệch Mốc Thời Gian Tăng Trưởng (Anchor Desync)*: Khi Admin lưu số mới, trường `fomo_anchor_time` không được cập nhật sang thời điểm hiện tại (`new Date().toISOString()`). Thuật toán `calculateHourlyGrowth` fallback về đầu ngày (`dayStart` cách nhiều tiếng), làm số hiển thị nhảy vọt ngay lập tức +70 đơn bù giờ.
  5. *Thiếu cờ `forceReset: true` trong các hàm Save Admin*: Các hàm `saveUtilityItem`, `saveGiveawayItem`, `saveStoreProductItem` chỉ gọi `this.pushFullStateToKV()` (mặc định không có cờ `forceReset`).
- **Giải pháp chuẩn đã kiểm chứng**:
  1. *Ghi Đè Đỉnh SSOT Trực Tiếp*: Server `functions/api/sync.ts` trực tiếp ghi đè `hub.peakProductSoldCounts[id] = target` khi Admin sync, xóa cache RAM `__wcg_metrics_snapshot` và xóa bảng `system_snapshots` D1.
  2. *Cập Nhật Anchor Time Hiện Tại*: Khi Admin lưu số ảo mới, lập tức cập nhật `fomo_anchor_time = new Date().toISOString()`. Nhờ đó ngay sau khi lưu, thời gian trôi qua là 0 phút $\rightarrow$ số hiển thị đúng 100% bằng số Admin đã đặt.
  3. *Tự Động Auto-Heal Khi Phát Hiện Đỉnh Bất Thường*: Trong `deterministicEngine.ts`, nếu `peakSold > rawDisplaySold + 5`, hệ thống tự động reset đỉnh về `rawDisplaySold`.
  4. *Bảo đảm `forceReset: true`*: `adminDataService.pushFullStateToKV` luôn đính kèm `forceReset: true, forceResetSold: true, forceResetClaimed: true`.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không dùng `Math.max` vô điều kiện khi Admin thực hiện đồng bộ snapshot*: Phải cho phép Admin ghi đè đỉnh khi có cờ `forceReset`.
  - ❌ *Không để `fomo_anchor_time` bị null khi Admin vừa sửa số ảo*: Sẽ làm thuật toán tính bù giờ từ đầu ngày và cộng thêm hàng chục đơn ảo ngoài ý muốn.
  - ❌ *Không cho phép Client LocalStorage tự ý ghi đè ngược đỉnh cũ lên Server nếu không có đơn hàng thật phát sinh*: Client chỉ được báo cáo tăng nếu người dùng thực sự mua hàng tại máy.

---

### ISSUE-037: Bẫy Trùng Lặp Game Khác Hậu Tố NPH Khi Quét Nguồn CodeMoi.net & Bộ Lọc Domain Cũ Bị Chặn
- **Triệu chứng**:
  - Khi cào game từ `codemoi.net/game-moi/`, một số game bị sinh slug trùng với game đã có trong catalog (ví dụ: CodeMoi đặt slug `ta-la-hac-ngo-khong-vplay`, trong khi kho game `games188.json` đã có sẵn `ta-la-hac-ngo-khong`). Nếu chỉ so khớp chuỗi slug thô hoặc packageId (CodeMoi không có packageId), game sẽ bị nhân bản gây trùng lặp.
  - Nguồn `https://codemoi.net/game-moi/` trước đó không thể hiển thị trong tab Nguồn Cào của Crawler do bộ lọc chặn tên miền `codemoi.net` (tránh các nguồn giftcode cũ lỗi).
- **Nguyên nhân gốc rễ**:
  1. CodeMoi thường ghép tên game với mã NPH làm slug (`{ten-game}-{nph}`), trong khi cơ sở dữ liệu gốc lưu slug tên game thuần túy.
  2. Tab CrawlerModule có bộ lọc `src.url.includes('codemoi.net')` chặn cứng toàn bộ domain này.
- **Giải pháp chuẩn đã kiểm chứng**:
  1. *Thuật toán `getBaseSlug()` đa tầng*:
     - Tự động chuẩn hóa chuỗi và bóc tách các hậu tố NPH thông dụng: `-(vplay|vtc|gosu|gamota|soha|funtap|vng|garena|vn|mobile|joygames|efun|online)$`.
     - So sánh cả slug gốc lẫn base slug với 623+ game hiện tại và danh sách chờ duyệt trước khi quyết định đăng tự động hoặc thêm vào hàng chờ.
  2. *Mở khóa chọn lọc nguồn Game Mới*:
     - Chỉ cho phép `https://codemoi.net/game-moi/` và ID `src_codemoi_game_moi` hiển thị và thực thi, đồng thời duy trì việc chặn các nguồn giftcode cũ không còn hoạt động.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không chỉ so sánh `existingSlugs.has(game.slug)` đối với CodeMoi*: Bắt buộc phải so sánh thêm `existingSlugs.has(getBaseSlug(game.slug))`.
  - ❌ *Không mở chặn toàn bộ domain `codemoi.net` mà không phân loại nguồn*: Chỉ cho phép nguồn `/game-moi/`, không phục hồi các nguồn cào code cũ bị 404.

---

### ISSUE-038: Lỗi Tràn Call Stack (RangeError: Maximum call stack size exceeded) Do Vòng Lặp Gọi Đệ Quy getHourlyGrowth - getSoldDisplay
- **Triệu chứng**:
  - Người dùng mở web từ link chia sẻ trên mạng xã hội (Zalo In-App Browser, Messenger, Facebook) hoặc truy cập các mục Tiện ích / Cửa hàng: Toàn bộ trang web bị sập và hiển thị màn hình cứu hộ ErrorBoundary với thông báo lỗi đỏ: `Maximum call stack size exceeded`.
- **Nguyên nhân gốc rễ**:
  1. *Lỗi đệ quy đồng bộ trong `marketingService.ts`*: Trong hàm `getHourlyGrowth(id, ...)`, nhánh `else` khi chưa có `anchorTime` thực hiện:
     `this.sessionAnchorMap.set(id, { baseSold: this.getSoldDisplay({ id }, 0), lastTimestamp: nowMs });`
     Để gán thuộc tính `baseSold`, JavaScript bắt buộc phải thực thi `getSoldDisplay({ id })`. Nhưng bên trong `getSoldDisplay`, hàm lại gọi ngược `getHourlyGrowth(id, ...)`! Do `sessionAnchorMap.set` chưa chạy xong nên `sessionAnchorMap.get(id)` vẫn undefined, khiến nhánh `else` lại gọi tiếp `getSoldDisplay({ id })`. Vòng lặp đệ quy lặp lại liên tục hàng ngàn lần trong 1 microsecond làm tràn ngăn xếp call stack của trình duyệt.
  2. *Đè xoá route deep-link quá sớm trong `App.tsx`*: Effect đồng bộ URL chạy trong khi `parseHash()` còn đang đọc dữ liệu bất đồng bộ từ slug, đè ngược URL `/game/...` thành `/` và kích hoạt re-render hàng loạt thẻ sản phẩm.
- **Giải pháp chuẩn đã kiểm chứng**:
  1. *Khởi tạo Session Anchor độc lập không đệ quy*:
     - Trong `getHourlyGrowth`: Thiết lập trực tiếp `this.sessionAnchorMap.set(id, { lastCount: 0, lastTimestamp: nowMs });` và `return 0;`.
     - Tuyệt đối không gọi `getSoldDisplay` hay bất kỳ hàm tính toán ngoài nào bên trong `getHourlyGrowth`.
  2. *Bảo vệ URL chia sẻ Deep-Link trong `App.tsx`*:
     - Bổ sung cờ `isInitialLoadDone`. Chỉ cho phép xóa URL `/game/...` khi tiến trình định tuyến ban đầu đã hoàn thành 100%.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không bao giờ gọi hàm cha (`getSoldDisplay`) từ hàm con (`getHourlyGrowth`) mà không có điều kiện dừng (base case) đã lưu sẵn*: Sẽ luôn gây crash `Maximum call stack size exceeded` trên mọi phiên truy cập mới.
  - ❌ *Không dùng `window.history.replaceState` để ép đổi pathname khi component cha chưa hoàn tất lifecycle khởi tạo (`isInitialLoadDone === false`)*.

---

### ISSUE-039: Logo Game Quét Được Bị Lỗi Hiển Thị & Biến Dạng Thành Khối DiceBear Identicon
- **Triệu chứng**:
  - Trong trang Quản trị Admin (tab "Crawler & Auto Sync"), toàn bộ các game cào về từ CodeMoi hoặc các nguồn ngoài bị lỗi tải ảnh và biến dạng thành các hình khối pixel / avatar vuông ngẫu nhiên (DiceBear identicon).
- **Nguyên nhân gốc rễ**:
  1. *Lỗi ngắt kết nối ECONNRESET & Chặn Adblock*: Tên miền nguồn ngoài (`codemoi.net`) thường xuyên bị ngắt kết nối hoặc chặn cross-origin. Ngoài ra, trình duyệt Cốc Cốc / Adblock chặn tài nguyên từ domain này.
  2. *Fallback DiceBear*: Sự kiện `onError` trong thẻ `<img>` thay thế bằng `https://api.dicebear.com/7.x/identicon/svg?seed=...`, làm mất hoàn toàn nhận diện game.
  3. *Thiếu tầng tra cứu Google Play & Lưu trữ nội bộ*: Hệ thống chưa tự động tra cứu logo chính thức từ Google Play CDN (`play-lh.googleusercontent.com`) và chưa tải về lưu trữ nội bộ tại `public/game_icons/{slug}.webp`.
- **Giải pháp chuẩn đã kiểm chứng**:
  1. *Engine `game_logo_resolver.cjs`*: Tự động tra cứu Google Play Store VN, lấy logo WebP 512x512/256x256 sắc nét và tải về lưu cố định vào `public/game_icons/{slug}.webp` cùng bản `.jpg` cho Open Graph.
  2. *Edge Image Proxy (`functions/api/game-icon.ts`)*: Cung cấp endpoint proxy an toàn tại Cloudflare Edge chống 100% việc bị chặn bởi AdBlock.
  3. *Giao diện Admin thông minh*: Thẻ ảnh ưu tiên nạp từ local icon hoặc Google Play CDN hoặc Edge Proxy; xóa bỏ hoàn toàn fallback DiceBear; bổ sung nút "🖼️ Logo" cho phép Admin đổi link logo nhanh chóng.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
---

### ISSUE-040: Bẫy So Khớp Chuỗi Rỗng Khi Tra Cứu Google Play Gây Ghép Nhầm Ứng Dụng Tiện Ích AI Vào Game
- **Triệu chứng**:
  - Khi tra cứu tự động trên Google Play cho các game có tên ngắn hoặc tên tiếng Anh (như `Girls Echo`, `MAke Drama: MAD`, `Strinova VN`), hệ thống tự động gán nhầm sang các ứng dụng chat AI (`com.chat.whisper`), công cụ làm video AI (`luma.sora.pika...`), hoặc game sinh tồn không liên quan.
- **Nguyên nhân gốc rễ**:
  1. *Thất bại khi bóc tách tiêu đề ứng dụng*: Google Play phiên bản mới bọc tiêu đề trong thẻ `<h1><span class="..." itemprop="name">Tiêu đề</span></h1>`. Biểu thức regex cũ tìm `h1 itemprop="name"` bị miss, khiến biến `appTitle` nhận giá trị rỗng `""`.
  2. *Bẫy `String.prototype.includes("")` trong JavaScript*: Biểu thức `normTarget.includes(normFound)` khi `normFound === ""` luôn luôn trả về `true` đối với bất kỳ chuỗi mục tiêu nào. Do đó ứng dụng đầu tiên trong danh sách tìm kiếm (thường là các app AI hot nhiều lượt tải) bị coi là "khớp 100%".
- **Giải pháp chuẩn đã kiểm chứng**:
  1. Sử dụng `<meta property="og:title">` kết hợp `itemprop="name"` để lấy tiêu đề chính xác 100%.
  2. Bắt buộc kiểm tra độ dài tối thiểu: `if (!normFound || normFound.length < 2 || !normTarget || normTarget.length < 2) continue;`.
  3. Lọc bỏ các package hoặc tiêu đề có dấu hiệu app tiện ích AI/video/chat (`isSuspectNonGame`).
  4. Nếu không khớp Google Play, ưu tiên tải và lưu trực tiếp cover sắc nét gốc của game ($\ge 10KB$) từ trang chủ cào thay vì cố ép sang một ứng dụng Google Play không liên quan.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không bao giờ gọi `target.includes(found)` khi `found` chưa được kiểm tra `found.trim().length > 0`*: Gây ra lỗi False Positive 100%.
  - ❌ *Không dùng điều kiện fallback `packageIds.length === 1` khi tên ứng dụng hoàn toàn không có từ khóa tương đồng*: Dễ gán nhầm các ứng dụng rác khi kết quả tìm kiếm chỉ có 1 app.

---

### ISSUE-041: Bẫy Bóc Tách Từ Vựng Web Thông Dụng Thành Giftcode (Web Scraper False Positives)
- **Triệu chứng**:
  - Hàng chờ duyệt Giftcode (`crawlerPendingCodes`) bị tràn ngập các từ ngữ thông dụng tiếng Anh / tiếng Việt như `GAME`, `NGAY`, `TYPE`, `BELOW`, `OFFERS`, `FROM`, `GAMOTA`, `THEO`, `WITH`, `WITHIN`, `WORKS`, `DROPS`...
- **Nguyên nhân gốc rễ**:
  1. *Thiếu bộ lọc từ vựng & Blacklist trong Scraper*: Các thẻ HTML `<td>`, `<strong>`, `<b>` trong các câu hướng dẫn hoặc bảng thanh toán (vd: "Type below offers from Gamota") bị regex bóc tách thành mã code nếu từ đó viết hoa hoặc đứng đầu dòng.
  2. *Thiếu ràng buộc tựa game đích*: Mã không khớp với bất kỳ game nào vẫn được gán nhãn `unknown-game` và đưa vào hàng chờ thay vì loại bỏ.
  3. *Chấm điểm lỏng lẻo*: Mã không rõ game vẫn được cộng điểm nguồn cào và điểm quà tặng mặc định, đạt 45-60 điểm (vượt ngưỡng 40đ để vào hàng chờ Bậc 3, 4).
- **Giải pháp chuẩn đã kiểm chứng**:
  1. Xây dựng engine lọc mã rác đa tầng tập trung (`scripts/crawler/engine/code_filter.cjs`):
     - Blacklist hơn 200+ từ vựng, nhãn UI, giới từ, tên NPH, thương hiệu nền tảng.
     - Quy tắc hình thái học: Chặn số nguyên thuần túy dạng ngày tháng (`0401`), bắt buộc tiền tố chuẩn cho mã ngắn thuần chữ cái ($\le 4$ ký tự), chặn ký tự lặp đơn điệu.
  2. Bắt buộc ràng buộc game: Mã không khớp được game trong catalog (`matchConfidence <= 0` hoặc `unknown-game`) bị loại bỏ ngay lập tức (0 điểm).
  3. Nâng ngưỡng hàng chờ lên $\ge 50$ điểm kèm điều kiện có tựa game xác định.
  4. Bổ sung nút "🧹 Dọn mã rác" trong trang Admin để thanh lọc nhanh chóng.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không chỉ dùng regex độ dài `/^[A-Z0-9]{4,24}$/` mà bỏ qua kiểm tra từ điển*: Sẽ bóc tách nhầm hàng trăm từ tiếng Anh/Việt thông dụng.
  - ❌ *Không lưu trữ mã `unknown-game` vào hàng chờ*: Giftcode không có game là vô dụng và gây rác hệ thống.

---

### ISSUE-042: Khó Khăn Khi Chọn Game Nạp Giftcode Do Sử Dụng Thẻ Native Select Không Tìm Kiếm Được Tiếng Việt
- **Triệu chứng**:
  - Trong trang Quản trị Code Miễn Phí (`/admin#/free-codes`), khi mở modal "Nhập Giftcode Hàng Loạt" hoặc "Thêm Code Mới", quản trị viên rất khó tìm game vì dropdown danh mục chứa hơn 624 tựa game.
  - Không thể gõ tên game, không tìm kiếm được tiếng Việt có dấu/không dấu, không có logo nhận diện, phải cuộn chuột tìm kiếm thủ công.
- **Nguyên nhân gốc rễ**:
  - Sử dụng thẻ HTML `<select>` mặc định của trình duyệt với danh sách tĩnh 624 `<option>`. Thẻ `<select>` không cung cấp input tìm kiếm và không có cơ chế chuẩn hóa dấu tiếng Việt.
- **Giải pháp chuẩn đã kiểm chứng**:
  - Sử dụng component `SearchableGameSelect` tích hợp thuật toán `calculateGameSearchScore` + `normalizeVietnamese`:
    + Hỗ trợ gõ tiếng Việt có dấu (`Tiên Giới`, `Hắc Ngộ Không`) và không dấu (`tien gioi`, `hac ngo khong`).
    + Hỗ trợ viết tắt (`tg`, `nk`, `tala`, `hnk`, `tlhnk`, `vltk`, `lq`, `ff`), tên NPH (`VGP`, `VPlay`, `VNG`...), thể loại hoặc slug.
    + Hiển thị logo chính thức của game, số lượng giftcode hiện có, highlight trực quan cụm từ tìm kiếm.
    + Tích hợp vào cả Modal Nhập hàng loạt, Modal Thêm/Sửa code, và thanh lọc trên bảng dữ liệu `DataTable`.
### ISSUE-043: Lỗi Bất Đồng Bộ Đa Dự Án Cloudflare Pages Giữa codegame.store và codegame.shop (Multi-Project Binding Divergence)
- **Triệu chứng**:
  - Admin duyệt game mới trong trang quản trị, hệ thống báo thành công và game đã xuất hiện khi kiểm tra trên `codegame.shop`.
  - Tuy nhiên, khi truy cập `codegame.store`, dù đã tải lại trang nhiều lần (F5, Ctrl+F5) vẫn không thấy game mới xuất hiện trong catalog.
- **Nguyên nhân gốc rễ**:
  1. *Hai miền trỏ vào 2 dự án Cloudflare Pages độc lập*: `codegame.shop` gắn với project `web-code-game`, còn `codegame.store` gắn với project riêng `codegamestore`.
  2. *Sai lệch Database D1 Binding*: Project `codegamestore` bị gán sai database D1 cũ (`be54527d-...`) thay vì Database D1 SSOT chính (`b2b5372f-1c6f-4067-a74d-8029ded6ec79`), đồng thời thiếu các biến môi trường bí mật `ADMIN_SYNC_SECRET`, `PASSWORD_PEPPER`.
  3. *Script `deploy:all` bị sót dự án*: Lệnh `npm run deploy:all` trước đây chỉ triển khai `web-code-game` và `admin-code-game-shop`, hoàn toàn không deploy bản build lên `codegamestore`.
  4. *Edge cache PoP không được xóa cho `codegame.store`*: Hàm `invalidateCatalogEdgeCache` chỉ purge URL của `codegame.shop`.
- **Giải pháp chuẩn đã kiểm chứng**:
  1. Sử dụng Cloudflare REST API vá (PATCH) project `codegamestore` sang cùng database D1 SSOT (`b2b5372f-1c6f-4067-a74d-8029ded6ec79`) và nạp đủ secrets.
  2. Cập nhật `package.json` script `deploy:all` triển khai đồng thời cả 3 project: `web-code-game`, `codegamestore`, `admin-code-game-shop`.
  3. Bổ sung toàn bộ domain `codegame.store` vào danh sách purge của `cache_service.ts`.
  4. Bổ sung cơ chế tự động xuất bản (Auto-Publish) khi phát hiện game mới có sẵn giftcode (`activeCodesCount > 0`) với toggle điều khiển trực quan `Có Code: Lên Web Ngay (⚡)` trong Admin Crawler.
- ⛔ **CÁCH SỬA ĐÃ THẤT BẠI - TUYỆT ĐỐI KHÔNG LẶP LẠI**:
  - ❌ *Không chỉ kiểm tra deploy trên 1 domain `codegame.shop` rồi kết luận hoàn thành*: Bắt buộc phải kiểm tra và deploy đồng bộ cả `codegame.store` và `codegame.shop`.
  - ❌ *Không sửa mã nguồn client để gọi API chéo domain (CORS issue)*: Cả 2 project phải cùng kết nối trực tiếp vào chung database D1 SSOT tại Edge Worker.

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
