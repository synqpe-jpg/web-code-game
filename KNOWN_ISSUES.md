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
