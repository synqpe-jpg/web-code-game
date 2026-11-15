# KẾ HOẠCH PHÁT TRIỂN BẢN SÀN TOÀN DIỆN (SHOPEE GAME STYLE)

> **Mục tiêu chiến lược**:
> 1. Xây dựng một **Sàn Thương Mại Điện Tử Tiện Ích & Code Game chuẩn phong cách Shopee**, hiện đại, trực quan, tốc độ giao dịch 0 giây.
> 2. Đóng gói hoàn chỉnh thành một **Sản phẩm bàn giao hàng loạt (White-Label Turnkey Solution)** để kinh doanh bán website cho khách hàng với thời gian bàn giao siêu tốc (dưới 2 phút) và chi phí vận hành server gần như 0 đồng trên Cloudflare.
> 3. Kế thừa trọn vẹn tài sản lớn nhất từ `codegame.shop`: Danh mục 623+ game ABEI và bot tự động quét cập nhật giftcode 24/7.

---

## GIAI ĐOẠN 1: HOÀN THIỆN "CỬA HÀNG MẪU HOÀN CHỈNH" (DEMO STOREFRONT V1)
*(Thời gian dự kiến: Hoàn thiện ngay tại tuyến đường `/test1`)*

### 1.1. Luồng Bán Hàng & Mua Sắm Chuẩn Shopee
* **Giỏ Hàng Đa Sản Phẩm (Cart Drawer Modal)**:
  * Cho phép người mua chọn nhiều món: 1 thẻ Garena, 1 gói Kim Cương, 1 giftcode VIP, 1 tài khoản game.
  * Tự động tính toán tổng tiền, áp dụng mã giảm giá voucher (ví dụ: `GIAM20K`, `FREESHIP`).
* **Cổng Thanh Toán VietQR Tự Động (Tích hợp SePay)**:
  * Sinh mã VietQR chuẩn EMVCo có sẵn nội dung chuyển khoản và số tiền chính xác.
  * Khi khách quét app ngân hàng thanh toán $\rightarrow$ Web tự động nhận biến động số dư qua Webhook trong 3 - 5 giây và hoàn tất đơn hàng ngay lập tức.
* **Giao Mã Tức Thì 0 Giây (Auto Key Delivery)**:
  * Mã số thẻ, tài khoản mật khẩu được giải mã bảo mật Web Crypto AES-GCM và hiển thị ngay trên màn hình hoàn tất đơn hàng.
  * Đồng thời lưu vĩnh viễn vào **"Tủ Mã Của Tôi"** của khách hàng.

### 1.2. Bốn Nhóm Sản Phẩm Mẫu Thực Tế (Bày Sẵn Trên Kệ Hàng)
1. **Giftcode Game Miễn Phí (0 Đồng)**: Kết nối kho 623+ game thật, người mua bấm copy hoặc săn mã kèm pháo hoa Confetti.
2. **Thẻ Game & Thẻ Điện Thoại**: Thẻ Garena, Zing Xu, Thẻ Gate, Vcoin (hỗ trợ nhập kho mã thẻ và số seri).
3. **Gói Nạp Tiện Ích Tự Động**: Nạp Kim Cương Free Fire, Robux Roblox, Quân Huy Liên Quân, FC Online qua ID nhân vật.
4. **Tài Khoản Game & Acc Reroll Giá Rẻ**: Bán acc trắng thông tin (1K, 10K, 50K, 100K) kèm thông tin đăng nhập tự động bàn giao.

### 1.3. Động Cơ Marketing & Kích Thích Mua Hàng (FOMO Engine)
* **Flash Sale Giờ Vàng**: Đồng hồ đếm ngược thời gian thực, huy hiệu giảm giá sốc `-50%`, `-70%`, thanh tiến độ cuộn sóng *"ĐÃ BÁN xx/yy"*.
* **Thông Báo Nổi Mua Hàng Thời Gian Thực**: Hiển thị thông báo người chơi vừa nạp tiền / mua acc thành công, tự động tác động lên số lượng tồn kho theo quy tắc 1 - 1.

---

## GIAI ĐOẠN 2: HỆ THỐNG QUẢN TRỊ ĐƠN GIẢN CHO CHỦ SHOP (SHOP OWNER ADMIN)
*(Mục tiêu: Người mua web không cần biết lập trình vẫn tự quản trị shop của mình dễ dàng)*

### 2.1. Trang Quản Trị Thu Nhỏ Dành Riêng Cho Khách Mua Web (`/admin`)
* **Bảng Doanh Thu & Đơn Hàng**: Xem tổng tiền thu được trong ngày/tuần/tháng, số đơn thành công, số mã đã bán.
* **Quản Lý Sản Phẩm (Thêm / Sửa / Xóa trong 1 phút)**:
  * Nhập tên sản phẩm, giá bán, tải ảnh bìa.
  * Nhập kho mã hàng loạt (Copy & Paste danh sách thẻ hoặc tài khoản dạng `user|pass` vào ô văn bản $\rightarrow$ Hệ thống tự động tách từng mã lưu vào kho).
* **Cài Đặt Tài Khoản Ngân Hàng Nhận Tiền**:
  * Chủ shop chỉ cần dán Mã API SePay hoặc số tài khoản ngân hàng của họ.
  * Toàn bộ tiền khách nạp sẽ **chạy thẳng 100% vào tài khoản ngân hàng của chủ shop**, bạn không cần giữ tiền hay chuyển khoản thủ công cho họ.

### 2.2. Cơ Chế Đồng Bộ Kho Game Tự Động Trọn Đời
* Dữ liệu 623+ game, logo và giftcode mới tự động đồng bộ từ hệ thống `codegame.shop`. Chủ shop không cần phải thuê người đi cào mã hay nhập liệu thủ công mỗi ngày.

---

## GIAI ĐOẠN 3: ĐÓNG GÓI & QUY TRÌNH BÀN GIAO SIÊU TỐC HÀNG LOẠT
*(Mục tiêu: Khi có khách mua, chỉ mất đúng 2 phút để bàn giao)*

### 3.1. Cơ Chế Nhận Diện Tên Miền Thông Minh (Dynamic Multi-Tenant Domain)
* Toàn bộ các web bán cho khách chạy chung trên 1 mã nguồn máy chủ duy nhất.
* Khi khách mua web trỏ tên miền (ví dụ: `shopaccnam.com`) về hệ thống:
  * Hệ thống tự động nhận diện tên miền `shopaccnam.com`.
  * Tự động tải Logo, Tên shop, Bảng giá và Tài khoản ngân hàng của Nam.
  * Tự động cấp chứng chỉ bảo mật HTTPS/SSL xanh uy tín qua Cloudflare for SaaS.

### 3.2. Bảng Điều Khiển "Tổng Quản Lý Web Đã Bán" Dành Riêng Cho Bạn
Trong trang Admin mẹ của bạn, có 1 bảng danh sách các web đã bán:
* **Nút "Thêm Web Khách Mới" (Nhập 3 thông tin)**:
  1. Tên miền khách (`shopaccnam.com`)
  2. Tên Shop (`Shop Acc Nam Gaming`)
  3. STK / Khóa SePay của khách
* **Nút "Kích Hoạt 1-Chạm"**: Bấm xong là web của khách lên sóng ngay lập tức.
* **Nút "Khóa / Mở Web"**: Bật/tắt khi khách đóng hoặc chưa đóng phí duy trì hàng tháng/năm.

---

## GIAI ĐOẠN 4: GÓI BÁN HÀNG & CÔNG CỤ CHÀO KHÁCH (GO-TO-MARKET)

### 4.1. Bảng Giá Đề Xuất & Chiến Lược Thu Phí
1. **Gói Khởi Nghiệp (Dành cho CTV, Game thủ nhỏ lẻ)**:
   * Giá bán: **1.500.000đ** (đã gồm web phong cách Shopee + kho 600 game + tích hợp VietQR).
   * Phí duy trì server: **500.000đ / năm** (bắt đầu thu từ năm thứ 2).
2. **Gói Chuyên Nghiệp (Dành cho Shop lớn, Streamer)**:
   * Giá bán: **2.500.000đ – 3.500.000đ** (thêm tính năng Vòng quay may mắn, tên miền `.vn` hoặc `.com`, hỗ trợ thiết kế logo banner riêng).
   * Phí duy trì: **800.000đ / năm**.

### 4.2. Bộ Công Cụ Bán Hàng (Sales Assets)
* **Link Web Mẫu Live**: [https://codegame.shop/test1](https://codegame.shop/test1) (Khách tự bấm thử, tự quét QR thử).
* **Video Demo 60 Giây**: Quay cận cảnh giao diện Shopee mượt mà trên điện thoại + thao tác nạp VietQR 3 giây tiền vào tài khoản.
* **Mẫu Bài Viết Chào Khách Trong Hội Nhóm**: Nêu bật 2 điểm độc nhất: *"Có sẵn 600 game tự cập nhật code trọn đời"* và *"Giao diện Shopee ai cũng biết dùng"*.

---

## KẾ HOẠCH HÀNH ĐỘNG CỤ THỂ BẮT ĐẦU NGAY HÔM NAY:
1. **Bước 1**: Hoàn thiện nốt giỏ hàng và dữ liệu sản phẩm mẫu thật tại `/test1` để biến link này thành một Showroom bán hàng lung linh.
2. **Bước 2**: Thiết kế bảng cấu hình thông tin shop (Tên shop, logo, STK) để chuẩn bị sẵn cho việc nhân bản.
3. **Bước 3**: Tạo tài liệu và hình ảnh demo để bạn bắt đầu đem đi chào thử nghiệm tìm kiếm **Người Mua Đầu Tiên**.
