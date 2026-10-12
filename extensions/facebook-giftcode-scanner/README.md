# ⚡ CodeGame.Shop - 1-Click Facebook Giftcode & Link Scanner (Chrome Extension v1.2.0)

Tiện ích mở rộng Google Chrome chính thức dành cho Quản trị viên và CTV của **codegame.shop**, cho phép trích xuất tự động **toàn bộ mã giftcode**, **toàn bộ bài viết**, và **toàn bộ đường link liên kết sự kiện / web NPH** từ bất kỳ Fanpage Facebook nào chỉ với 1-Click.

---

## 🌟 TÍNH NĂNG ĐỘT PHÁ MỚI (v1.2.0)

1. **🔓 Tự Động Mở Bung Toàn Bộ Bài Viết (Auto-Expand "Xem thêm" / "See more")**:
   - Tự động nhận diện và click toàn bộ nút "Xem thêm" / "See more" trên tất cả bài viết của Fanpage.
   - Đảm bảo 100% nội dung dài bị Facebook thu gọn đều được bung ra, không bao giờ bị bỏ sót mã code nằm ở đuôi bài viết.

2. **🌀 Quét Sâu Toàn Trang (Deep Auto-Scroll Scan)**:
   - Cơ chế tự động cuộn trang mượt mà (chọn từ 5, 8 đến 15 lượt cuộn) để đọc bài viết từ quá khứ (vài giờ trước, hôm qua, tuần trước).
   - Tự động tạm dừng chờ Facebook nạp bài viết mới (Virtual DOM Hydration), sau đó tiếp tục mở bung bài và gom dữ liệu.
   - Hiển thị thanh tiến trình trực quan thời gian thực: `🌀 Đang cuộn bài viết: Lượt X/Y...`.

3. **🔗 Bóc Tách & Giải Mã Toàn Bộ Đường Link (Links Extractor)**:
   - **Giải mã Link Chuyển Tiếp Meta (`l.facebook.com/l.php?u=...`)**: Lấy đường link web gốc sạch sẽ 100%.
   - **Phân loại thông minh**:
     + `[🎯 Link Nhận / Đổi Code]`: Các link landing page, sự kiện minigame nhận quà.
     + `[🌐 Website / Trang Chủ NPH]`: Cổng thông tin chính thức của game.
     + `[💳 Cổng Nạp NPH]`: Trang nạp thẻ, đổi quà NPH.
     + `[📌 Bài Viết Facebook]`: Link gốc permalink của từng status.
   - **Bóc tách mã trong URL**: Tự động trích xuất giftcode ẩn trong tham số query link (`?code=...`, `?giftcode=...`).
   - Hỗ trợ **Sao chép 1-Click** hoặc **Mở nhanh trong Tab mới**.

4. **🚀 Bắn Thẳng Lên Web codegame.shop Trong 1 Chạm**:
   - Đẩy trực tiếp các mã đã lọc sạch lên Cloudflare D1/KV.
   - Tự động lưu kèm đường link bài viết gốc (`sourceUrl`) để hiển thị nguồn xác thực cho người chơi.
   - Phê duyệt và kích hoạt tức thì, khách hàng vào web là thấy và copy dùng được ngay.

5. **🎮 Nhận Diện Tự Động Tựa Game (486+ Game)**:
   - Tích hợp sẵn cơ sở dữ liệu `games.json` 486 game có giấy phép G1/G234.
   - Tự động khớp game theo URL hoặc tên Fanpage (ví dụ: Tiên Nghịch Mobile, Liên Quân Mobile, Genshin Impact...).

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT NHANH (30 GIÂY)

1. Mở trình duyệt Google Chrome, truy cập: `chrome://extensions/`
2. Bật công tắc **"Chế độ dành cho nhà phát triển" (Developer mode)** ở góc trên bên phải.
3. Bấm nút **"Tải tiện ích đã giải nén" (Load unpacked)**.
4. Chọn thư mục:
   `c:\4 Antigravity all\13 web code game\extensions\facebook-giftcode-scanner`
5. Tiện ích biểu tượng tia sét vàng ⚡ sẽ xuất hiện trên thanh công cụ của Chrome!

---

## 📖 HƯỚNG DẪN SỬ DỤNG

### Cách 1: Dùng Nút Nổi 1-Click Trực Tiếp Trên Facebook (Nhanh Nhất)
1. Mở bất kỳ Fanpage Facebook game nào (ví dụ: `https://www.facebook.com/tiennghichmobile`).
2. Nhìn góc dưới bên phải màn hình, bạn sẽ thấy nút nổi gradient tím: **`⚡ Quét Code & Link`** kèm nút con **`🌀 Quét Sâu`**.
3. Bấm **`🌀 Quét Sâu`**: Trang web sẽ tự động cuộn trang và đọc toàn bộ bài viết.
4. Cửa sổ Modal hiện lên với 2 Tab:
   - **Tab 1 - Danh Sách Mã**: Kiểm tra các mã tìm được.
   - **Tab 2 - Đường Link & Sự Kiện**: Danh sách toàn bộ link web, landing page và link bài viết gốc.
5. Bấm **`🚀 Bắn Thẳng Lên Web codegame.shop`** $\rightarrow$ Mã được kích hoạt ngay cho khách dùng!

### Cách 2: Dùng Popup Trên Thanh Công Cụ Chrome
1. Click vào icon tiện ích trên thanh tiện ích Chrome.
2. Chọn độ sâu cuộn (5, 8 hoặc 15 lượt).
3. Bấm **`🌀 Quét Sâu Toàn Trang`** hoặc **`⚡ Quét Nhanh`**.
4. Chuyển đổi giữa 2 tab **Mã Code** và **Đường Link**, bấm **Bắn thẳng lên Web** khi hoàn tất!
