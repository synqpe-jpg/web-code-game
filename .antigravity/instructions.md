# HƯỚNG DẪN VẬN HÀNH & NGUYÊN TẮC PHÁT TRIỂN DỰ ÁN

## 🛑 1. NGUYÊN TẮC BẢO VỆ CODE & TÍNH NĂNG (Code & Feature Guard)
- **Cấm xóa hoặc thay đổi mã nguồn hiện có**: Mọi module, hàm, file cấu hình, giao diện đã hoàn thiện hoặc đang hoạt động KHÔNG ĐƯỢC PHÉP bị xóa bỏ, thay thế hoặc tái cấu trúc trừ khi người dùng yêu cầu rõ ràng.
- **Phát triển bổ sung độc lập**: Khi tạo tính năng mới, tạo các component/hàm mới tách biệt để không gây regression hoặc xung đột với code cũ.
- **Bảo lưu thông tin kết nối**: Giữ nguyên vẹn các cấu hình Cloudflare Pages, KV binding (`KV`: `09226ab144a34523bb2d43f182d576b8`), file `.env` và `wrangler.jsonc`.

---

## ⚡ 2. CƠ CHẾ CHỐNG LẶP VÔ HẠN & TĂNG TỐC DỰ ÁN (Anti-Loop & Fast Execution)
- **Không Polling / Loop Check**: Tuyệt đối không chạy vòng lặp sleep/polling liên tục để kiểm tra trạng thái tiến trình nền.
- **Chính sách phân tích lỗi tức thì (Fail-Fast & Root-Cause)**: Khi gặp lỗi trong quá trình thực thi terminal hay build, đọc kỹ trace log và sửa đúng điểm lỗi. Không bao giờ chạy lặp lại lệnh cũ mà không sửa đổi gì.
- **Thao tác nhanh, chính xác**: Sử dụng các lệnh tìm kiếm và chỉnh sửa file đích (Targeted edits) thay vì ghi đè lại toàn bộ mã nguồn lớn.

---

## 🎨 3. QUY CHUẨN THIẾT KẾ UI/UX PRO MAX (Bắt buộc tuân thủ)
- **Tài liệu tham chiếu**: [`.antigravity/skills/ui-ux-pro-max/SKILL.md`](file:///c:/4%20Antigravity%20all/13%20web%20code%20game/.antigravity/skills/ui-ux-pro-max/SKILL.md)
- **Chống "AI Generic Slop"**:
  - KHÔNG dùng emoji làm icon chức năng (bắt buộc dùng SVG: Lucide, Heroicons).
  - KHÔNG dùng gradient tím/hồng vô nghĩa, không dùng phong cách thiết kế đại trà thiếu cá tính.
  - Đảm bảo độ tương phản chữ $\ge 4.5:1$ (chuẩn WCAG AA).
  - Vùng chạm tối thiểu $44 \times 44\text{px}$, hiệu ứng hover/focus-visible mượt mà ($150\text{ms} - 300\text{ms}$).
  - Thiết kế thích ứng mượt trên Mobile (375px), Tablet (768px), Desktop (1024px+).

---

## 🛠️ 4. QUY TRÌNH KIỂM THỬ TRƯỚC KHI BÀN GIAO
Mỗi khi hoàn thành một tính năng:
1. Kiểm tra không có lỗi cú pháp Javascript/Typescript/HTML/CSS.
2. Kiểm tra giao diện responsive không bị tràn chiều ngang (Zero horizontal scroll).
3. Đảm bảo toàn bộ các nút, liên kết đều có phản hồi tương tác rõ ràng (`cursor-pointer`, hover, active, focus).
