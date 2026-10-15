# PROJECT_MEMORY.md — Hệ Thống Kiến Trúc & Tri Thức Dự Án Web Code Game

> **QUY TẮC BẮT BUỘC DÀNH CHO AI AGENT & DEVELOPER**:
> Trước khi thực hiện bất kỳ chỉnh sửa nào trong codebase, **BẮT BUỘC** phải đọc file này cùng với `CHANGELOG.md` và `KNOWN_ISSUES.md`.
> Phân tích nguyên nhân gốc rễ (Root Cause), phạm vi ảnh hưởng (Impact Scope), tuyệt đối không lặp lại giải pháp đã ghi nhận thất bại trong `KNOWN_ISSUES.md`.

---

## 1. TỔNG QUAN DỰ ÁN & VẬN HÀNH

- **Tên dự án**: Web Code Game & Tiện Ích Game Số 1 Việt Nam
- **Tên miền sản xuất**:
  - Web Khách: `https://codegame.shop` / `https://codegame.store` (Cloudflare Pages: `web-code-game`)
  - Web Quản trị (Admin): `https://admin.codegame.shop` (Cloudflare Pages: `admin-code-game-shop`)
- **Mục tiêu cốt lõi**:
  1. Cung cấp và tự động cập nhật Giftcode của hơn 623+ tựa game có giấy phép ABEI (G1/G234) và Studio game Việt Nam tại thị trường trong nước & quốc tế.
  2. Nền tảng thương mại điện tử chuyên biệt: Mua bán Tiện ích game (VIP, buff, tool, dịch vụ), Cửa hàng tài khoản, Thẻ game, Giveaway mã quà tặng miễn phí.
  3. Hệ thống Marketing & FOMO thông minh với cơ chế đồng bộ nguyên tử 1 - 1 giữa thông báo và số liệu hiển thị thực tế.
  4. Hệ thống Tự động hóa 24/7: GitHub Actions quét giftcode và tự động xuất bản bài viết tin tức chuẩn SEO kèm ảnh và code game.

---

## 2. KIẾN TRÚC CÔNG NGHỆ (TECH STACK)

### 2.1. Frontend
- **Framework & Runtime**: React 18.3.1, TypeScript 5.6.3, Vite 5.4.10.
- **Styling**: Tailwind CSS 3.4.14, PostCSS, Autoprefixer.
- **Iconography**: Lucide React (`lucide-react`) — Sử dụng 100% SVG Vector tinh xảo, không dùng emoji trôi nổi.
- **Hiệu ứng & UI**: Canvas Confetti, CSS Micro-interactions, Modal Portals (`createPortal`), Sticky Viewports.
- **Bộ máy tìm kiếm cục bộ**: Fuse.js + thuật toán chuẩn hóa dấu tiếng Việt (`textUtils.ts`).

### 2.2. Backend & Serverless Edge (Cloudflare Ecosystem)
- **Cloudflare Pages Functions**: Serverless APIs đặt tại thư mục `functions/api/`:
  - `functions/api/sync.ts`: Endpoint đồng bộ 2 chiều dữ liệu Admin $\leftrightarrow$ KV $\leftrightarrow$ Khách.
  - `functions/api/metrics/synced.ts`: Lưu trữ snapshot các chỉ số đỉnh (High-water marks: số đã bán, số quà đã nhận, lượt copy).
  - `functions/api/orders/create.ts`: Khởi tạo và thực thi giao dịch thanh toán đơn hàng bằng số dư ví.
  - `functions/api/webhooks/sepay.ts`: Webhook nhận biến động số dư ngân hàng tự động qua SePay.
  - `functions/api/auth/*`: Đăng ký, đăng nhập JWT, đổi mật khẩu, xác thực phiên người dùng.
  - `functions/api/giveaways/claim.ts`: Thực thi nhận mã quà tặng giveaway an toàn.
- **Cloudflare KV**:
  - `GAME_DATA_KV`: Lưu trữ games, giftcodes, tin tức (articles), nguồn cào (crawler sources), banner, cấu hình marketing.
  - `INVENTORY_KV`: Lưu trữ danh mục sản phẩm tiện ích, store products, và kho mã số.
- **Cloudflare D1 SQL Database**:
  - Quản lý giao dịch mua hàng (`orders`), kho mã chi tiết (`inventory_items`), tài khoản người dùng (`users`), giao dịch nạp tiền (`transactions`).

### 2.3. Tự Động Hóa 24/7 (Automation & Crawlers)
- **GitHub Actions Workflows**:
  - `.github/workflows/auto-crawler-sync.yml`: Quét giftcode tự động mỗi giờ vào phút 15 (`15 * * * *`).
  - `.github/workflows/auto-news-publisher.yml`: Tự động viết và xuất bản bài viết SEO tin tức game mỗi giờ vào phút 45 (`45 * * * *`).
- **Engine Scripts**:
  - `scripts/crawler/run_crawler.cjs`: Bộ máy cào mã quà tặng đa nguồn kèm thuật toán chấm điểm 4 tầng (4-tier scoring).
  - `scripts/crawler/auto_news_publisher.cjs`: Tự động tìm kiếm nguồn tin game mới, tạo bài viết kèm giftcode game và sync lên Cloudflare.
  - `scripts/sync_games_licenses_icons.cjs`: Đồng bộ danh mục 486 game G1/G234, chuẩn hóa icon và thông tin pháp lý ABEI.

### 2.4. Quản Lý Phiên Bản & Quy Trình Git Chuyên Nghiệp
- **Hệ thống Git**: Repository chính nhánh `main`, liên kết GitHub `origin` (`https://github.com/synqpe-jpg/web-code-game.git`).
- **Quy chuẩn vận hành**: Tuân thủ tuyệt đối [**`GIT_WORKFLOW.md`**](file:///c:/4%20Antigravity%20all/13%20web%20code%20game/GIT_WORKFLOW.md) với 6 quy tắc (Pre-modification, In-flight, Post-modification, Rollback an toàn, Báo cáo 6 thành phần, và Zero destructive commands).
- **Quy tắc khôi phục**: Ưu tiên `git revert`, không bao giờ dùng `git reset --hard` hay `git clean -fd` khi chưa được người dùng cho phép.

---

## 3. CÁC QUY TẮC KINH DOANH & NGUYÊN TẮC BẤT DI BẤT DỊCH (CORE BUSINESS RULES)

### 3.1. Quy Tắc Kho Hàng & Tồn Kho Thật (Strict Real Inventory Rule)
- **Quy tắc vàng**: **HÀNG THẬT TRONG KHO = 0 $\rightarrow$ HIỂN THỊ TỒN KHO = 0 ("HẾT HÀNG")**.
- Khi một sản phẩm tiện ích, store product, hoặc giveaway có số lượng thực tế trong kho bằng 0:
  1. Hàm `getDisplayStock()` trả về đúng `0`.
  2. Tuyệt đối **KHÔNG** cộng tồn kho ảo (`virtualStockBonus`).
  3. Tuyệt đối **KHÔNG** kích hoạt cơ chế tự động bù kho (`autoRestock`).
  4. Hệ thống marketing tự động **NGẮT HOÀN TOÀN** việc sinh thông báo ảo (`BUY_PRODUCT`) cho sản phẩm đó.
  5. Nút mua ngoài web khách chuyển sang trạng thái Disabled ("Tạm hết hàng").

### 3.2. Quy Tắc Đồng Bộ Nguyên Tử 1 - 1 Của Thông Báo Marketing
- Mọi thông báo xuất hiện trên màn hình (thật hoặc ảo) **PHẢI TÁC ĐỘNG NGAY LẬP TỨC** lên số liệu hiển thị của Web Khách:
  - Thông báo mua (`BUY_PRODUCT`): Tồn kho hiển thị (`Còn:`) **-1**, Số lượng đã bán (`Đã bán:`) **+1**.
  - Thông báo nhận quà (`CLAIM_GIVEAWAY`): Mã còn lại **-1**, Mã đã săn **+1**.
  - Thông báo copy (`COPY_CODE`): Bộ đếm tổng lượt copy toàn trang **+1**.
  - Thông báo bổ sung kho (`RESTOCK_PRODUCT`): Tồn kho hiển thị (`Còn:`) **+{restockAmount}**.
- Cơ chế `BroadcastChannel` và Custom Event (`wcg_virtual_stock_updated`, `wcg_sold_count_updated`) phát tín hiệu để toàn bộ các thẻ sản phẩm cập nhật tức thì trong 0 giây mà không cần F5.
- Bộ nhớ `processedStockNotifIds` lưu ID thông báo để đảm bảo **chống trừ đúp** khi mở nhiều tab.

### 3.3. Quy Tắc Tự Động Bù Kho (Auto-Restock)
- Khi sản phẩm còn hàng thật (`baseStock > 0`) và có cấu hình tồn kho ảo:
- Nếu tồn kho ảo tụt dần về $\le$ Ngưỡng bù kho (`effectiveThreshold`, mặc định $\le 1$ hoặc $\le baseStock$), hệ thống tự động bù thêm `restockAmount` (mặc định +20) ngay lập tức.
- Giúp sàn luôn duy trì trạng thái khan hiếm nhưng không bao giờ bị âm hoặc kẹt số cũ.

### 3.4. Quy Tắc Chống Hồi Sinh Dữ Liệu (Tombstone Deletion Pattern)
- Khi Admin xóa vĩnh viễn một mục (game, code, sản phẩm, bài viết tin tức):
- Không được chỉ xóa ở LocalStorage frontend vì khi sync với Cloudflare KV / D1 dữ liệu cũ sẽ bị merge ngược lại (resurrection bug).
- Bắt buộc tạo bản ghi Tombstone (`deleted_at`, `deletedIdsSet`) gửi lên `/api/sync` để xóa triệt để trên Cloudflare KV và D1.

### 3.5. Quy Tắc Bảo Mật & Phân Quyền Duy Nhất Chủ Sở Hữu (Owner-Only Guard)
- Chỉ duy nhất tài khoản Telegram của Chủ sở hữu (`ID: 7791142901`) có quyền tương tác, nhận báo cáo và kích hoạt bot tự động.
- Mọi API admin được bảo vệ bằng Secret Token `ADMIN_SYNC_SECRET`.

### 3.6. Quy Tắc Tự Động Xóa Dữ Liệu Test (Zero Test Artifacts On Production)
- Mọi dữ liệu test (sản phẩm tiện ích test `ut_test_*`, sản phẩm cửa hàng test `sp_test_*`, mã giftcode test) được sinh ra để kiểm thử hệ thống phải được dọn dẹp sạch sẽ 100% ngay sau khi hoàn thành bài test (khối `finally`).
- Tuyệt đối không để sót bất kỳ sản phẩm test nào trên production Cloudflare D1/KV hoặc trong mã nguồn hiển thị cho khách.
- Chỉ những sản phẩm và mã kho do chính người dùng nhập vào mới được hiển thị và tính tồn kho hợp lệ.

---

## 4. BẢN ĐỒ DỮ LIỆU & STATE MANAGEMENT

### 4.1. LocalStorage Keys Chính
| Key | Ý nghĩa & Dữ liệu chứa |
| :--- | :--- |
| `wcg_admin_games_v4` | Danh sách 486+ tựa game, ảnh bìa, logo, nhà phát hành, trạng thái |
| `wcg_admin_custom_codes_v4` | Danh sách giftcode do admin quản trị hoặc crawler nhập vào |
| `wcg_admin_utilities_v4` | Danh mục gói tiện ích (VIP, cày thuê, buff code, tool) |
| `wcg_admin_store_products_v4` | Danh mục tài khoản game / vật phẩm trong Cửa Hàng |
| `wcg_admin_giveaways_v4` | Các chiến dịch tặng quà giveaway miễn phí |
| `wcg_admin_inventory_v4` | Kho mã chi tiết (mỗi mã là 1 dòng SKU/code) |
| `wcg_marketing_config_v4` | Cấu hình thông báo ảo, tần suất, khung giờ vàng, tài khoản ảo |
| `wcg_admin_news_v4` | Danh sách bài viết tin tức game, hướng dẫn nhập code |
| `wcg_admin_deleted_*_v4` | Danh sách Tombstone lưu ID các mục đã bị xóa vĩnh viễn |

### 4.2. Các Service Nòng Cốt
- `src/services/dataService.ts`: Trung tâm cung cấp dữ liệu đọc/ghi, quản lý games, codes, utilities, store products, giveaways.
- `src/services/marketingService.ts`: Bộ máy tính toán hiển thị tồn kho, lượt bán, lượt copy, tạo thông báo nổ ảo, điều phối auto-restock và offline catch-up.
- `src/services/adminService.ts`: Xử lý phân quyền quản trị, đồng bộ dữ liệu lên Cloudflare KV/D1.
- `src/services/authService.ts`: Xử lý đăng ký, đăng nhập, nạp tiền ví, lịch sử giao dịch.
