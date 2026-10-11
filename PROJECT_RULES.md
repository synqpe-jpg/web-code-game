# PROJECT_RULES: Web Code Game Development & Guardrails

Các chỉ thị hoạt động bắt buộc trong suốt quá trình xây dựng dự án:

### 🛑 1. BẢO TỒN MÃ NGUỒN VÀ TÍNH NĂNG (Code Preservation Guard)
* Không được tự ý xóa, thay thế hoặc viết lại các tính năng, component, hàm hay logic đang chạy bình thường nếu người dùng không yêu cầu.
* Mọi tính năng mới phải được phát triển theo hướng bổ sung (additive), bảo đảm backward compatibility.
* Giữ nguyên vẹn toàn bộ chú thích, comments, cấu hình Cloudflare Pages và KV bindings.

### ⚡ 2. TỐI ƯU HIỆU SUẤT & CHỐNG LẶP VÔ HẠN (Anti-Loop & Fast Execution)
* Nghiêm cấm chạy các lệnh vòng lặp vô hạn (polling status / sleep loop).
* Khi gặp lỗi, phân tích nguyên nhân gốc rễ và sửa chính xác, không chạy lại lệnh hỏng quá 2 lần.
* Thực hiện các thao tác dứt khoát, chính xác theo vùng thay đổi (surgical edits).

### 🎨 3. CHUẨN THIẾT KẾ UI/UX PRO MAX
* Tuân thủ triệt để [`.antigravity/skills/ui-ux-pro-max/SKILL.md`](file:///c:/4%20Antigravity%20all/13%20web%20code%20game/.antigravity/skills/ui-ux-pro-max/SKILL.md).
* Không "AI Generic Slop": Dùng SVG icons (Lucide), không emoji; contrast >= 4.5:1; bảng màu có chiều sâu; responsive 375px đến 1440px+.

### 📢 4. BÁO CÁO KẾT QUẢ & TIẾP NHẬN CÔNG VIỆC MỚI
* Khi hoàn thành công việc: Luôn lập báo cáo kết quả rõ ràng, súc tích (đảm bảo độ dài không quá 4.000 từ).
* Tích hợp và tự động gửi thông báo qua Telegram khi được cấu hình `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`.
* Luôn sẵn sàng tiếp nhận và triển khai ngay các nhiệm vụ mới tiếp theo của người dùng.

### 🔐 5. BẢO MẬT & XÁC THỰC DUY NHẤT CHỦ SỞ HỮU (Owner-Only Access Guard)
* **Quyền hạn duy nhất**: Chỉ duy nhất tài khoản Telegram của bạn (ID: `7791142901`) mới có quyền tương tác, nhận báo cáo, điều khiển và giao việc cho trợ lý/bot.
* **Chống giả mạo & Xâm nhập**: Mọi yêu cầu từ bất kỳ tài khoản/Chat ID nào khác đều bị chặn và từ chối tuyệt đối (Strict ID Whitelist).
* **Bảo mật mã nguồn & Token**: Toàn bộ Bot Token và API Keys được lưu trữ an toàn trong `.env`, không bao giờ để lộ công khai ra bên ngoài.

### 📌 6. LÀM VIỆC CỐ ĐỊNH TRÊN 1 PHIÊN CHAT DUY NHẤT (Single Session Continuity)
* **Khóa phiên làm việc**: Mọi yêu cầu và nhiệm vụ giao qua Telegram đều được định tuyến trực tiếp vào đúng phiên chat hiện tại (`e4ba7ced-492a-4203-bd9b-e0bbf53eff95`) bằng lệnh `send-message`.
* **Không phân mảnh ngữ cảnh**: Tuyệt đối không tự ý mở phiên chat mới (`new-conversation`) khi người dùng đang giao việc trong tiến trình dự án.
* **Bảo toàn lịch sử**: Giữ trọn vẹn context làm việc, biến môi trường và tiến độ dự án xuyên suốt một phiên làm việc.


