import React, { useState, useEffect, useMemo } from 'react';
import {
  KeyRound,
  Key,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Trash2,
  Power,
  AlertTriangle,
  Code2,
  BookOpen,
  RefreshCw,
  Terminal,
  CheckCircle2,
  Clock,
  Newspaper,
  Zap,
  Search,
  Lock,
  Layers,
  Sparkles,
  X,
  Calendar,
  Hourglass,
  Timer,
  ChevronRight,
  ExternalLink,
  Gamepad2,
  Gift,
  ShoppingBag,
  Users,
  SlidersHorizontal,
  Database,
  Bot,
  Settings,
  Send,
  Coins,
  CreditCard,
  TrendingUp,
  FileText,
  Tag,
  Wrench,
  Inbox,
  BarChart3,
  Boxes,
  Megaphone,
  Globe,
  Mail,
} from 'lucide-react';

export type ApiKeyScope =
  | 'TELEGRAM_NOTIFY'
  | 'TELEGRAM_FULL'
  | 'NEWS_FULL'
  | 'EVENTS_FULL'
  | 'GAME_ICONS_FULL'
  | 'MISSIONS_FULL'
  | 'MISSIONS_REVIEW'
  | 'GAMES_FULL'
  | 'GAMES_MANAGE'
  | 'GIVEAWAYS_FULL'
  | 'EVENT_SCHEDULER_FULL'
  | 'STORE_FULL'
  | 'FIRST_PURCHASE_MANAGE'
  | 'ESCALATING_MANAGE'
  | 'MEMBERS_FULL'
  | 'WALLET_MANAGE'
  | 'ORDERS_FULL'
  | 'SEPAY_FULL'
  | 'FREE_CODES_FULL'
  | 'SUBMISSIONS_FULL'
  | 'CONTENT_FULL'
  | 'UTILITIES_FULL'
  | 'GROWTH_FULL'
  | 'DASHBOARD_STATS_FULL'
  | 'INVENTORY_ITEMS_MANAGE'
  | 'MARKETING_FULL'
  | 'CRAWLER_MANAGE'
  | 'NOTIFICATIONS_FULL'
  | 'SECURITY_LOGS_FULL'
  | 'SYSTEM_SETTINGS_FULL'
  | 'SYNC_FULL' 
  | 'API_KEYS_FULL'
  | 'HISTORY_FULL'
  | 'ADMIN_FULL'
  | string;

export interface ScopeOption {
  id: string;
  name: string;
  category: string;
  description: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  icon: any;
}

export const ALL_API_SCOPES: ScopeOption[] = [
  {
    id: 'TELEGRAM_NOTIFY',
    name: 'Đăng Thông Báo Telegram (Telegram Notify API)',
    category: 'Kết Nối',
    description: 'Đăng bài viết, giftcode mới, thông báo sự kiện lên Nhóm Telegram qua /api/telegram/notify kèm kiểm tra chống trùng ref_key.',
    color: 'blue',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-500',
    badgeBorder: 'border-blue-500/20',
    icon: Send,
  },
  {
    id: 'TELEGRAM_FULL',
    name: 'Toàn Quyền Telegram (Telegram Full & Management API)',
    category: 'Kết Nối',
    description: 'Toàn quyền điều hành và quản lý nhóm Telegram qua POST /api/telegram/manage (trạng thái nhóm, admin, tin nhắn webhook, xóa/ghim tin, quản lý thành viên, đổi tên/mô tả, link mời) và đăng bài qua /api/telegram/notify.',
    color: 'cyan',
    badgeBg: 'bg-cyan-500/10',
    badgeText: 'text-cyan-500',
    badgeBorder: 'border-cyan-500/20',
    icon: Send,
  },
  {
    id: 'NEWS_FULL',
    name: 'Quản Lý Tin Tức & Sự Kiện (News & Events API)',
    category: 'Nội Dung',
    description: 'Thêm mới, chỉnh sửa, xóa bài viết tin tức và toàn quyền đăng, sửa link nguồn, duyệt hàng chờ sự kiện game (/api/events).',
    color: 'emerald',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-500',
    badgeBorder: 'border-emerald-500/20',
    icon: Newspaper,
  },
  {
    id: 'EVENTS_FULL',
    name: 'Quản Lý Sự Kiện Game (Game Events API)',
    category: 'Nội Dung',
    description: 'Toàn quyền đăng, sửa link nguồn, cập nhật cách tham gia, duyệt và xóa sự kiện (/api/events). Dùng chung hoặc kế thừa từ NEWS_FULL.',
    color: 'amber',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-500',
    badgeBorder: 'border-amber-500/20',
    icon: Zap,
  },
  {
    id: 'GAME_ICONS_FULL',
    name: 'Pipeline Logo & Icon Game (Game Icons API)',
    category: 'Dữ Liệu',
    description: 'Tải file logo thật, tự động đối chiếu Store (CH Play / App Store), xác minh cờ icon_verified và cập nhật bản ghi game (/api/games/upload-icon). Kế thừa từ NEWS_FULL, EVENTS_FULL, GAMES_FULL.',
    color: 'sky',
    badgeBg: 'bg-sky-500/10',
    badgeText: 'text-sky-500',
    badgeBorder: 'border-sky-500/20',
    icon: Sparkles,
  },
  {
    id: 'MISSIONS_FULL',
    name: 'Quản Lý Nhiệm Vụ (Missions API)',
    category: 'Vận Hành',
    description: 'Tạo chiến dịch, chỉnh sửa, xóa, nạp kho code thưởng, duyệt và từ chối bài nộp của người dùng.',
    color: 'indigo',
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-500',
    badgeBorder: 'border-indigo-500/20',
    icon: Layers,
  },
  {
    id: 'MISSIONS_REVIEW',
    name: 'Thẩm Định Nhiệm Vụ AI (Pine AI Reviewer)',
    category: 'Tự Động Hóa AI',
    description: 'Tra cứu danh sách hồ sơ PENDING, gửi kết quả phê duyệt và trả thưởng tự động tức thì.',
    color: 'amber',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-500',
    badgeBorder: 'border-amber-500/20',
    icon: Bot,
  },
  {
    id: 'GAMES_FULL',
    name: 'Kho Giftcode & Tựa Game (Games & Codes API)',
    category: 'Dữ Liệu',
    description: 'Tra cứu, bổ sung giftcode mới, chỉnh sửa thông tin game live (update_game), xóa lẻ mã (delete_codes), đặt icon live (update_icon_live) và đồng bộ danh mục game toàn sàn.',
    color: 'teal',
    badgeBg: 'bg-teal-500/10',
    badgeText: 'text-teal-500',
    badgeBorder: 'border-teal-500/20',
    icon: Gamepad2,
  },
  {
    id: 'GAMES_MANAGE',
    name: 'Quản Trị Bản Ghi Game (Games Management API)',
    category: 'Dữ Liệu',
    description: 'Toàn quyền tra cứu chi tiết game (get_game), danh sách quản trị (list_games), cập nhật thông tin game live (update_game), xóa lẻ từng mã (delete_codes), đặt icon live (update_icon_live), ẩn/hiện và quản lý giấy phép.',
    color: 'emerald',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-500',
    badgeBorder: 'border-emerald-500/20',
    icon: Gamepad2,
  },
  {
    id: 'GIVEAWAYS_FULL',
    name: 'Sự Kiện Giật Code (Giveaways API)',
    category: 'Vận Hành',
    description: 'Cài đặt chiến dịch giật code, nạp mã kho, điều chỉnh thông số mô phỏng hiển thị.',
    color: 'purple',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-500',
    badgeBorder: 'border-purple-500/20',
    icon: Gift,
  },
  {
    id: 'EVENT_SCHEDULER_FULL',
    name: 'Lịch Sự Kiện & Đếm Ngược (Event Scheduler API)',
    category: 'Vận Hành',
    description: 'Toàn quyền tạo lịch đếm ngược tự động, lên lịch phát code/flash sale, bật tắt trạng thái và ghim banner.',
    color: 'amber',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-500',
    badgeBorder: 'border-amber-500/20',
    icon: Clock,
  },
  {
    id: 'STORE_FULL',
    name: 'Kho Code Bán & Gói Sản Phẩm (Store & Paid Codes API)',
    category: 'Thương Mại & Kho',
    description: 'Toàn quyền quản trị gói sản phẩm bán, kho mã code bán, tiện ích, đơn hàng và kế thừa toàn diện các quyền quản lý thành viên, ví số dư, code miễn phí, duyệt mã đóng góp và nội dung CMS.',
    color: 'purple',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-400',
    badgeBorder: 'border-purple-500/20',
    icon: ShoppingBag,
  },
  {
    id: 'FIRST_PURCHASE_MANAGE',
    name: 'Ưu Đãi Mua Lần Đầu (First Purchase Offer API)',
    category: 'Thương Mại & Kho',
    description: 'Quản trị chiến dịch ưu đãi mua lần đầu (bật/tắt, giá ưu đãi, trần giá gốc, danh sách gói loại trừ, yêu cầu xác minh email), xem lượt đã dùng và đặt lại quyền ưu đãi cho thành viên qua /api/admin/first-purchase.',
    color: 'rose',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-400',
    badgeBorder: 'border-rose-500/20',
    icon: Sparkles,
  },
  {
    id: 'ESCALATING_MANAGE',
    name: 'Quản Lý Nâng Giá (Escalating Price API)',
    category: 'Thương Mại & Kho',
    description: 'Tra cứu danh sách gói đang bật Nâng Giá (/api/admin/escalating/packages), xem lịch sử mua hàng theo thang giá (/api/admin/escalating/history), và đặt lại thang giá về mốc ban đầu (/api/admin/escalating/reset).',
    color: 'amber',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/20',
    icon: SlidersHorizontal,
  },
  {
    id: 'MEMBERS_FULL',
    name: 'Quản Lý Thành Viên (Members API)',
    category: 'Hệ Thống',
    description: 'Tra cứu thông tin tài khoản, nạp/trừ số dư ví thành viên (/api/admin/members/adjust-balance), xem danh sách thành viên, cập nhật thông tin và khóa/mở tài khoản.',
    color: 'blue',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-500',
    badgeBorder: 'border-blue-500/20',
    icon: Users,
  },
  {
    id: 'WALLET_MANAGE',
    name: 'Quản Lý Ví & Giao Dịch (Wallets & Balance API)',
    category: 'Tài Chính & Ví',
    description: 'Toàn quyền tra cứu lịch sử giao dịch ví toàn sàn (/api/admin/wallets/transactions), xem chi tiết số dư thành viên (/api/admin/wallets/:memberId) và duyệt nạp tiền thủ công.',
    color: 'emerald',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/20',
    icon: Coins,
  },
  {
    id: 'ORDERS_FULL',
    name: 'Quản Lý Đơn Hàng Code (Orders & Refunds API)',
    category: 'Thương Mại & Kho',
    description: 'Tra cứu danh sách đơn hàng mua code (/api/admin/orders), xem chi tiết mã kho đã phát và thực hiện hoàn tiền đơn hàng (/api/admin/orders/:id/refund).',
    color: 'amber',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/20',
    icon: ShoppingBag,
  },
  {
    id: 'SEPAY_FULL',
    name: 'Liên Kết SePay & Đối Soát (SePay Transactions & Config API)',
    category: 'Tài Chính & Ví',
    description: 'Xem lịch sử biến động số dư SePay D1 (/api/admin/sepay/transactions) và đọc/ghi cấu hình kết nối tài khoản ngân hàng SePay (/api/admin/sepay/config).',
    color: 'teal',
    badgeBg: 'bg-teal-500/10',
    badgeText: 'text-teal-400',
    badgeBorder: 'border-teal-500/20',
    icon: CreditCard,
  },
  {
    id: 'FREE_CODES_FULL',
    name: 'Quản Lý Code Miễn Phí (Free Giftcodes API)',
    category: 'Dữ Liệu',
    description: 'Toàn quyền tra cứu danh sách (/api/admin/free-codes), thêm mới, cập nhật và xóa mã giftcode miễn phí (kèm xóa hàng loạt).',
    color: 'indigo',
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-400',
    badgeBorder: 'border-indigo-500/20',
    icon: Tag,
  },
  {
    id: 'SUBMISSIONS_FULL',
    name: 'Duyệt Giftcode Khách Đóng Góp (Submissions API)',
    category: 'Vận Hành',
    description: 'Xem danh sách giftcode do thành viên gửi lên (/api/admin/submissions), phê duyệt mã tự động nạp vào bảng codes (/approve) hoặc từ chối (/reject).',
    color: 'sky',
    badgeBg: 'bg-sky-500/10',
    badgeText: 'text-sky-400',
    badgeBorder: 'border-sky-500/20',
    icon: Inbox,
  },
  {
    id: 'CONTENT_FULL',
    name: 'Quản Lý Nội Dung CMS Web (Web Content CMS API)',
    category: 'Nội Dung',
    description: 'Xem và cập nhật các khối nội dung, banner chiến dịch, thông báo nổi và chân trang website qua /api/admin/content.',
    color: 'purple',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-400',
    badgeBorder: 'border-purple-500/20',
    icon: FileText,
  },
  {
    id: 'UTILITIES_FULL',
    name: 'Quản Lý Gói Tiện Ích & Kho (Utilities Management API)',
    category: 'Thương Mại & Kho',
    description: 'Tạo mới, chỉnh sửa, xóa vĩnh viễn và cập nhật kho hàng gói tiện ích qua /api/admin/utilities (kèm cờ ưu đãi mua lần đầu).',
    color: 'cyan',
    badgeBg: 'bg-cyan-500/10',
    badgeText: 'text-cyan-400',
    badgeBorder: 'border-cyan-500/20',
    icon: Wrench,
  },
  {
    id: 'GROWTH_FULL',
    name: 'Cấu Hình Tăng Trưởng & Viral (Growth & Gamification API)',
    category: 'Vận Hành',
    description: 'Đọc và cập nhật các thông số tăng trưởng, gamification (vòng quay, điểm danh, nạp đầu, đua top) qua /api/admin/growth.',
    color: 'emerald',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/20',
    icon: TrendingUp,
  },
  {
    id: 'DASHBOARD_STATS_FULL',
    name: 'Báo Cáo & Thống Kê Tổng Quan (Dashboard Stats API)',
    category: 'Báo Cáo & Thống Kê',
    description: 'Truy xuất toàn bộ số liệu thống kê thời gian thực: doanh thu đơn hàng, dòng tiền SePay, số dư ví thành viên, dung lượng kho code bán, tổng thành viên và bài nộp nhiệm vụ qua GET /api/admin/dashboard/stats.',
    color: 'emerald',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/20',
    icon: BarChart3,
  },
  {
    id: 'INVENTORY_ITEMS_MANAGE',
    name: 'Nạp Kho Mã Bán Theo Lô & Quản Lý Mã Kho Bán (Inventory Codes API)',
    category: 'Thương Mại & Kho',
    description: 'Quản lý mã code thực tế trong từng gói sản phẩm bán: lấy danh sách mã kèm trạng thái AVAILABLE/SOLD (/api/admin/store/products/:id/codes), nạp kho hàng loạt mã chống trùng lặp, và xóa mã chưa bán tự động cập nhật base_stock.',
    color: 'purple',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-400',
    badgeBorder: 'border-purple-500/20',
    icon: Boxes,
  },
  {
    id: 'MARKETING_FULL',
    name: 'Quản Trị Tiếp Thị & Sự Kiện Ảo FOMO (Marketing & FOMO Events API)',
    category: 'Tiếp Thị & FOMO',
    description: 'Đọc/ghi cấu hình pop-up mua hàng ảo (/api/admin/marketing/config) và kích hoạt broadcast sự kiện mua hàng tức thì lên toàn bộ màn hình người dùng qua POST /api/admin/marketing/trigger.',
    color: 'rose',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-400',
    badgeBorder: 'border-rose-500/20',
    icon: Megaphone,
  },
  {
    id: 'CRAWLER_MANAGE',
    name: 'Cấu Hình & Vận Hành Crawler Tự Động (Crawler Sources & Trigger API)',
    category: 'Tự Động Hóa AI',
    description: 'Quản lý danh sách nguồn cào giftcode (/api/admin/crawler/sources) và kích hoạt tác vụ cào mã tức thì theo yêu cầu (/api/admin/crawler/trigger).',
    color: 'cyan',
    badgeBg: 'bg-cyan-500/10',
    badgeText: 'text-cyan-400',
    badgeBorder: 'border-cyan-500/20',
    icon: Globe,
  },
  {
    id: 'NOTIFICATIONS_FULL',
    name: 'Quản Trị Email & Chiến Dịch Thông Báo (Notifications & Broadcast API)',
    category: 'Thông Báo & Email',
    description: 'Quản lý danh sách người dùng đăng ký nhận tin (/api/admin/notifications/subscribers), gửi email thông báo hàng loạt qua Resend/Brevo (/api/admin/notifications/broadcast), và cấu hình nhà cung cấp email (/api/admin/notifications/settings).',
    color: 'indigo',
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-400',
    badgeBorder: 'border-indigo-500/20',
    icon: Mail,
  },
  {
    id: 'SECURITY_LOGS_FULL',
    name: 'Tra Cứu Nhật Ký Bảo Mật & Audit Logs (Security & Audit Logs API)',
    category: 'Bảo Mật',
    description: 'Tra cứu lịch sử thao tác quản trị, sự kiện bảo mật hệ thống (/api/admin/security-logs) kèm bộ lọc đa năng (action, actor, severity, date) và cho phép remote agent ghi log kiểm toán.',
    color: 'amber',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-500',
    badgeBorder: 'border-amber-500/20',
    icon: ShieldCheck,
  },
  {
    id: 'SYSTEM_SETTINGS_FULL',
    name: 'Cấu Hình Hệ Thống & Bảo Trì (System Settings & Maintenance API)',
    category: 'Hệ Thống',
    description: 'Đọc và cập nhật các thông số hệ thống toàn sàn: bật/tắt chế độ bảo trì, khuyến mãi nạp tiền %, thông báo thanh banner, kênh hỗ trợ Telegram/Zalo qua /api/admin/settings.',
    color: 'blue',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-500',
    badgeBorder: 'border-blue-500/20',
    icon: Settings,
  },
  {
    id: 'SYNC_FULL',
    name: 'Đồng Bộ & Sao Lưu (Cloudflare KV/D1 Sync)',
    category: 'Hệ Thống',
    description: 'Đồng bộ hai chiều dữ liệu KV/D1, truy cập snapshot hệ thống và phục hồi sao lưu.',
    color: 'violet',
    badgeBg: 'bg-violet-500/10',
    badgeText: 'text-violet-500',
    badgeBorder: 'border-violet-500/20',
    icon: RefreshCw,
  },
  {
    id: 'HISTORY_FULL',
    name: 'Lịch Sử Xóa & Khôi Phục (History API)',
    category: 'Vận Hành',
    description: 'Tra cứu danh sách bản ghi đã xóa mềm (game, mã, bài viết, giveaway), thực hiện khôi phục tường minh vào hệ thống.',
    color: 'rose',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-500',
    badgeBorder: 'border-rose-500/20',
    icon: Trash2,
  },
  {
    id: 'API_KEYS_FULL',
    name: 'Quản Lý Khóa API & Phân Quyền (API Keys Set Permissions)',
    category: 'Bảo Mật',
    description: 'Quyền dùng chính mã API này để tạo khóa mới, set quyền linh hoạt cho các mã API khác.',
    color: 'orange',
    badgeBg: 'bg-orange-500/10',
    badgeText: 'text-orange-500',
    badgeBorder: 'border-orange-500/20',
    icon: KeyRound,
  },
  {
    id: 'ADMIN_FULL',
    name: 'Toàn Quyền Quản Trị Tối Cao (Master Admin Full)',
    category: 'Tối Cao',
    description: 'Sở hữu 100% tất cả các quyền trên website, có thể can thiệp vào mọi module quản trị.',
    color: 'rose',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-500',
    badgeBorder: 'border-rose-500/20',
    icon: Shield,
  },
];

export interface ManagedApiKey {
  id: string;
  key_name: string;
  key_prefix: string;
  raw_key?: string;
  scope: ApiKeyScope | string;
  description?: string;
  expires_at?: string;
  is_active: number;
  last_used_at?: string;
  created_at: string;
  is_master?: boolean;
}

interface ApiKeysModuleProps {
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ApiKeysModule: React.FC<ApiKeysModuleProps> = ({ onShowToast }) => {
  const [keys, setKeys] = useState<ManagedApiKey[]>([]);
  const [masterKey, setMasterKey] = useState<ManagedApiKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Show/Hide state for keys (id -> boolean)
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Modal Create state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'SINGLE' | 'MULTI'>('MULTI');
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScope, setNewKeyScope] = useState<ApiKeyScope>('NEWS_FULL');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([
    'NEWS_FULL',
    'MISSIONS_FULL',
    'GAMES_FULL',
    'GIVEAWAYS_FULL',
    'SYNC_FULL',
  ]);
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [validityType, setValidityType] = useState<'30' | '90' | '365' | 'permanent' | 'custom'>('90');
  const [customExpiresAt, setCustomExpiresAt] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Modal Set Permissions state (Cài Đặt Phân Quyền Đa Năng)
  const [permissionModalKey, setPermissionModalKey] = useState<ManagedApiKey | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // Modal Extend / Change Expiration
  const [extendingKey, setExtendingKey] = useState<ManagedApiKey | null>(null);
  const [extendDaysOption, setExtendDaysOption] = useState<number>(30);
  const [isExtending, setIsExtending] = useState(false);

  // Modal Newly Generated Key Reveal (Only once)
  const [generatedKeyResult, setGeneratedKeyResult] = useState<{
    key_name: string;
    raw_key: string;
    scope: ApiKeyScope;
    expires_at?: string;
  } | null>(null);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'keys' | 'permissions' | 'docs'>('keys');
  const [docCategory, setDocCategory] = useState<'universal' | 'remote' | 'store' | 'telegram' | 'news' | 'icons' | 'missions' | 'giveaways' | 'events' | 'games' | 'sync' | 'history'>('universal');

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (onShowToast) {
      onShowToast(msg, type);
    }
  };

  const getAuthHeaders = (): Record<string, string> => {
    const token =
      localStorage.getItem('wcg_auth_token') ||
      sessionStorage.getItem('wcg_auth_token') ||
      '';
    const syncKey =
      sessionStorage.getItem('wcg_admin_sync_key') ||
      localStorage.getItem('wcg_admin_sync_key') ||
      'b4e08494bf1c3fd6a0c965dd2411780c60513f7f87001bc955d7496331b2faef';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Sync-Key': syncKey,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const loadApiKeys = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/api-keys', {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setKeys(data.keys || []);
        if (data.master_key) {
          setMasterKey(data.master_key);
        }
      } else {
        showToast(data.message || 'Không thể tải danh sách khóa API', 'error');
      }
    } catch (e: any) {
      showToast('Lỗi kết nối khi tải danh sách khóa API', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
  }, []);

  const handleCopy = (text: string, id: string) => {
    if (!text) {
      showToast('Khóa không có giá trị để sao chép', 'error');
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    showToast('Đã sao chép khóa API vào clipboard!', 'success');
    setTimeout(() => {
      setCopiedKeyId(null);
    }, 2000);
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Helper to parse scopes list from string
  const parseScopesList = (scopeStr?: string): string[] => {
    if (!scopeStr) return [];
    const upper = scopeStr.toUpperCase().trim();
    if (['ADMIN_FULL', 'FULL', '*', 'SUPER_ADMIN'].includes(upper)) {
      return ['ADMIN_FULL'];
    }
    return upper
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  };

  // Helper to compute expiration ISO
  const computeExpirationIso = (): string => {
    if (validityType === 'permanent') return '';
    if (validityType === 'custom') return customExpiresAt;
    const days = parseInt(validityType, 10) || 30;
    return new Date(Date.now() + days * 86400000).toISOString();
  };

  // Handle Create API Key (Supports Single and Multi-Scope)
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      showToast('Vui lòng nhập tên định danh cho khóa API', 'error');
      return;
    }

    const expiresIso = computeExpirationIso();

    let finalPayload: any = {
      key_name: newKeyName.trim(),
      description: newKeyDescription.trim(),
      expires_at: expiresIso,
    };

    if (createMode === 'MULTI') {
      if (newKeyScopes.length === 0) {
        showToast('Vui lòng chọn ít nhất 1 quyền cho khóa API Đa Năng', 'error');
        return;
      }
      finalPayload.scopes = newKeyScopes;
    } else {
      finalPayload.scope = newKeyScope;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(finalPayload),
      });

      const data = await res.json();
      if (data.success && data.key) {
        showToast('Khởi tạo khóa API thành công!', 'success');
        setGeneratedKeyResult({
          key_name: data.key.key_name,
          raw_key: data.key.raw_key,
          scope: data.key.scope,
          expires_at: data.key.expires_at,
        });
        setIsCreateModalOpen(false);
        setNewKeyName('');
        setNewKeyDescription('');
        setValidityType('90');
        loadApiKeys();
      } else {
        showToast(data.message || 'Lỗi khi tạo khóa API mới', 'error');
      }
    } catch (e: any) {
      showToast('Lỗi máy chủ khi tạo khóa API', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // Quick Preset Creators
  const handleQuickCreate = (scope: ApiKeyScope, defaultName: string) => {
    setCreateMode('SINGLE');
    setNewKeyScope(scope);
    setNewKeyName(defaultName);
    setValidityType('90');
    setIsCreateModalOpen(true);
  };

  const handleQuickCreateMulti = () => {
    setCreateMode('MULTI');
    setNewKeyName('Khóa API Đa Năng Tùy Chỉnh');
    setNewKeyScopes(['NEWS_FULL', 'MISSIONS_FULL', 'GAMES_FULL', 'GIVEAWAYS_FULL', 'SYNC_FULL']);
    setValidityType('90');
    setIsCreateModalOpen(true);
  };

  // Open Permission Modal for a key
  const handleOpenPermissionModal = (keyItem: ManagedApiKey) => {
    setPermissionModalKey(keyItem);
    const existing = parseScopesList(keyItem.scope);
    if (existing.includes('ADMIN_FULL')) {
      setSelectedScopes(ALL_API_SCOPES.filter((s) => s.id !== 'ADMIN_FULL').map((s) => s.id));
    } else {
      setSelectedScopes(existing);
    }
  };

  // Save Permissions Modal
  const handleSavePermissions = async () => {
    if (!permissionModalKey) return;

    if (selectedScopes.length === 0) {
      showToast('Khóa API phải có ít nhất 1 quyền', 'error');
      return;
    }

    setIsSavingPermissions(true);
    try {
      const isAllSelected = selectedScopes.length === ALL_API_SCOPES.filter((s) => s.id !== 'ADMIN_FULL').length;
      const scopesToSend = isAllSelected ? ['ADMIN_FULL'] : selectedScopes;

      const res = await fetch('/api/api-keys/set-permissions', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          key_id: permissionModalKey.id,
          scopes: scopesToSend,
        }),
      });

      const data = await res.json();
      if (data.success && data.key) {
        setKeys((prev) =>
          prev.map((k) =>
            k.id === permissionModalKey.id ? { ...k, scope: data.key.scope } : k
          )
        );
        showToast(
          `Đã cập nhật phân quyền thành công cho khóa "${permissionModalKey.key_name}"!`,
          'success'
        );
        setPermissionModalKey(null);
      } else {
        showToast(data.message || 'Lỗi khi lưu phân quyền', 'error');
      }
    } catch (e) {
      showToast('Lỗi kết nối khi lưu phân quyền', 'error');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // Toggle Active / Deactivate
  const handleToggleActive = async (keyItem: ManagedApiKey) => {
    const nextState = keyItem.is_active === 1 ? 0 : 1;
    try {
      const res = await fetch(`/api/api-keys/${keyItem.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: nextState }),
      });
      const data = await res.json();
      if (data.success) {
        setKeys((prev) =>
          prev.map((k) => (k.id === keyItem.id ? { ...k, is_active: nextState } : k))
        );
        showToast(
          nextState === 1
            ? `Đã kích hoạt khóa "${keyItem.key_name}"`
            : `Đã vô hiệu hóa khóa "${keyItem.key_name}"`,
          nextState === 1 ? 'success' : 'info'
        );
      } else {
        showToast(data.message || 'Lỗi cập nhật trạng thái khóa API', 'error');
      }
    } catch (e) {
      showToast('Không thể kết nối đến máy chủ', 'error');
    }
  };

  // Extend validity (phân quyền theo thời gian)
  const handleExtendKey = async () => {
    if (!extendingKey) return;
    setIsExtending(true);
    try {
      let nextExpiresAt = '';
      if (extendDaysOption > 0) {
        const base = extendingKey.expires_at
          ? Math.max(Date.now(), new Date(extendingKey.expires_at).getTime())
          : Date.now();
        nextExpiresAt = new Date(base + extendDaysOption * 86400000).toISOString();
      } else {
        nextExpiresAt = ''; // Permanent
      }

      const res = await fetch(`/api/api-keys/${extendingKey.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          expires_at: nextExpiresAt,
          is_active: 1, // Auto re-activate if extended
        }),
      });

      const data = await res.json();
      if (data.success) {
        setKeys((prev) =>
          prev.map((k) =>
            k.id === extendingKey.id ? { ...k, expires_at: nextExpiresAt, is_active: 1 } : k
          )
        );
        showToast(
          extendDaysOption > 0
            ? `Đã gia hạn thêm ${extendDaysOption} ngày cho khóa "${extendingKey.key_name}"!`
            : `Đã chuyển khóa "${extendingKey.key_name}" sang trạng thái Vĩnh viễn!`,
          'success'
        );
        setExtendingKey(null);
      } else {
        showToast(data.message || 'Lỗi gia hạn khóa', 'error');
      }
    } catch (e) {
      showToast('Lỗi kết nối khi gia hạn khóa', 'error');
    } finally {
      setIsExtending(false);
    }
  };

  const handleDeleteKey = async (keyItem: ManagedApiKey) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn thu hồi và XÓA VĨNH VIỄN khóa API "${keyItem.key_name}"? Mọi bot hoặc AI đang dùng khóa này sẽ bị từ chối truy cập ngay lập tức!`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/api-keys/${keyItem.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setKeys((prev) => prev.filter((k) => k.id !== keyItem.id));
        showToast('Đã thu hồi và xóa khóa API thành công!', 'success');
      } else {
        showToast(data.message || 'Lỗi khi xóa khóa API', 'error');
      }
    } catch (e) {
      showToast('Không thể kết nối đến máy chủ', 'error');
    }
  };

  // Render scope badges for each key
  const renderScopeBadges = (scopeStr?: string) => {
    const scopes = parseScopesList(scopeStr);
    if (scopes.includes('ADMIN_FULL')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-sm">
          <Shield className="w-3.5 h-3.5" />
          Toàn Quyền Quản Trị (ADMIN_FULL)
        </span>
      );
    }

    if (scopes.length === 0) {
      return (
        <span className="text-xs text-muted-foreground font-mono">Chưa gán quyền</span>
      );
    }

    return (
      <div className="flex items-center gap-1.5 flex-wrap max-w-sm">
        {scopes.length >= 3 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Sparkles className="w-3 h-3" />
            Đa Năng ({scopes.length} quyền)
          </span>
        )}
        {scopes.map((s) => {
          const found = ALL_API_SCOPES.find((item) => item.id === s);
          if (!found) {
            return (
              <span
                key={s}
                className="px-2 py-0.5 rounded-full text-[11px] bg-slate-500/10 text-slate-400 font-mono"
              >
                {s}
              </span>
            );
          }
          const Icon = found.icon;
          return (
            <span
              key={s}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${found.badgeBg} ${found.badgeText} border ${found.badgeBorder}`}
              title={found.description}
            >
              <Icon className="w-3 h-3" />
              {found.name.split(' (')[0]}
            </span>
          );
        })}
      </div>
    );
  };

  // Helper to format time-based permission status
  const formatExpirationInfo = (expiresAt?: string) => {
    if (!expiresAt) {
      return {
        badge: (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="w-3 h-3" />
            Vĩnh Viễn
          </span>
        ),
        text: 'Không giới hạn thời gian',
        isExpired: false,
      };
    }

    const expTime = new Date(expiresAt).getTime();
    if (isNaN(expTime)) {
      return {
        badge: <span className="text-muted-foreground text-xs font-mono">Không xác định</span>,
        text: '',
        isExpired: false,
      };
    }

    const diffMs = expTime - Date.now();
    const isExpired = diffMs <= 0;

    if (isExpired) {
      return {
        badge: (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" />
            ĐÃ HẾT HẠN
          </span>
        ),
        text: `Hết hạn: ${new Date(expTime).toLocaleDateString('vi-VN')}`,
        isExpired: true,
      };
    }

    const daysLeft = Math.ceil(diffMs / 86400000);
    const hoursLeft = Math.ceil(diffMs / 3600000);

    if (daysLeft <= 3) {
      return {
        badge: (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse">
            <Clock className="w-3 h-3" />
            Còn {hoursLeft} giờ
          </span>
        ),
        text: `Hết hạn: ${new Date(expTime).toLocaleDateString('vi-VN')}`,
        isExpired: false,
      };
    }

    return {
      badge: (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <Clock className="w-3 h-3" />
          Còn {daysLeft} ngày
        </span>
      ),
      text: `Hạn: ${new Date(expTime).toLocaleDateString('vi-VN')}`,
      isExpired: false,
    };
  };

  // Find versatile key for spotlight card
  const versatileKey = useMemo(() => {
    return (
      keys.find((k) => k.id === 'ak_preset_multi_versatile') ||
      keys.find((k) => k.raw_key?.startsWith('wcg_multi_')) ||
      keys.find((k) => String(k.scope).includes(',')) ||
      null
    );
  }, [keys]);

  const filteredKeys = useMemo(() => {
    return keys.filter((k) => {
      const matchSearch =
        k.key_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (k.description && k.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        k.key_prefix.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (k.raw_key && k.raw_key.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchScope = true;
      if (scopeFilter !== 'ALL') {
        const scopes = parseScopesList(k.scope);
        if (scopeFilter === 'MULTI') {
          matchScope = scopes.length > 1;
        } else {
          matchScope = scopes.includes('ADMIN_FULL') || scopes.includes(scopeFilter);
        }
      }

      let matchStatus = true;
      if (statusFilter === 'ACTIVE') matchStatus = k.is_active === 1;
      else if (statusFilter === 'INACTIVE') matchStatus = k.is_active === 0;
      else if (statusFilter === 'EXPIRED') {
        matchStatus = Boolean(k.expires_at && new Date(k.expires_at).getTime() <= Date.now());
      } else if (statusFilter === 'PERMANENT') {
        matchStatus = !k.expires_at;
      }

      return matchSearch && matchScope && matchStatus;
    });
  }, [keys, searchQuery, scopeFilter, statusFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-card to-card/60 p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <KeyRound className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground flex items-center gap-2">
                Quản Lý Khóa API & Phân Quyền Đa Năng
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono font-medium">
                  v3.0 UNIVERSAL
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Tạo khóa API đa năng, dùng 1 mã duy nhất để cấu hình và set bất kỳ tổ hợp quyền nào trên website
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadApiKeys}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleQuickCreateMulti}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Sparkles className="w-4 h-4" />
            + Tạo Khóa API Đa Năng
          </button>

          <button
            onClick={() => {
              setCreateMode('SINGLE');
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border hover:bg-muted text-foreground font-medium text-xs sm:text-sm shadow-sm transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Tạo Khóa Đơn Quyền
          </button>
        </div>
      </div>

      {/* Quick Action Presets (Tạo Nhanh 1-Click) */}
      <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Khởi tạo nhanh theo nhóm quyền:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleQuickCreateMulti}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 border border-purple-500/30 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            ⚡ Khóa API Đa Năng (Tuỳ biến mọi quyền)
          </button>
          <button
            onClick={() => handleQuickCreate('NEWS_FULL', 'Bot Tin Tức 24/7')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all"
          >
            <Plus className="w-3 h-3" />
            Tin Tức (90 ngày)
          </button>
          <button
            onClick={() => handleQuickCreate('MISSIONS_FULL', 'Admin Nhiệm Vụ')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all"
          >
            <Plus className="w-3 h-3" />
            Nhiệm Vụ (90 ngày)
          </button>
          <button
            onClick={() => handleQuickCreate('MISSIONS_REVIEW', 'Pine AI Thẩm Định')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 transition-all"
          >
            <Plus className="w-3 h-3" />
            AI Pine (30 ngày)
          </button>
        </div>
      </div>

      {/* Nav Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('keys')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
            activeTab === 'keys'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Key className="w-4 h-4" />
          Danh Sách Khóa API ({keys.length + (masterKey ? 1 : 0)})
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
            activeTab === 'permissions'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Bảng 10 Cấp Quyền & Mục Áp Dụng
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
            activeTab === 'docs'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Tài Liệu API Đa Năng & Code Mẫu (cURL / JS)
        </button>
      </div>

      {activeTab === 'keys' && (
        <>
          {/* Spotlight VIP Cards: Master Key & Versatile API Key */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Spotlight 1: Master Key Card */}
            {masterKey && (
              <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-card to-card p-5 sm:p-6 shadow-sm flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/30">
                      <Lock className="w-3.5 h-3.5" />
                      Khóa Master Hệ Thống
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      VĨNH VIỄN
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    ADMIN_SYNC_SECRET (Toàn Quyền Quản Trị Tối Cao)
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    Cấp quyền tối cao: Đồng bộ dữ liệu hai chiều KV/D1, can thiệp mọi module, bỏ qua mọi giới hạn kiểm tra.
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-border/60">
                  <div className="flex items-center gap-2 bg-background/80 border border-border px-3 py-2 rounded-xl font-mono text-xs max-w-full overflow-hidden shadow-inner">
                    <span className="text-muted-foreground select-none shrink-0 font-bold">KEY:</span>
                    <span className="text-foreground select-all font-semibold truncate flex-1">
                      {visibleKeys['master'] ? masterKey.raw_key : masterKey.key_prefix}
                    </span>
                    <button
                      onClick={() => toggleVisibility('master')}
                      className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      title={visibleKeys['master'] ? 'Ẩn mã' : 'Hiện đầy đủ mã'}
                    >
                      {visibleKeys['master'] ? (
                        <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleCopy(masterKey.raw_key || '', 'master')}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 border border-amber-500/30"
                      title="Sao chép nhanh khóa này"
                    >
                      {copiedKeyId === 'master' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500">Đã Copy!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Spotlight 2: Khóa API Đa Năng (Versatile Multi-Scope Key) */}
            {versatileKey && (
              <div className="relative overflow-hidden rounded-2xl border-2 border-purple-500/40 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-card p-5 sm:p-6 shadow-sm flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      Khóa API Đa Năng Tùy Biến
                    </span>
                    <button
                      onClick={() => handleOpenPermissionModal(versatileKey)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Set Quyền Cho Khóa Này
                    </button>
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {versatileKey.key_name}
                  </h3>
                  <div className="text-xs text-muted-foreground">
                    {renderScopeBadges(versatileKey.scope)}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border/60">
                  <div className="flex items-center gap-2 bg-background/80 border border-border px-3 py-2 rounded-xl font-mono text-xs max-w-full overflow-hidden shadow-inner">
                    <span className="text-purple-400 select-none shrink-0 font-bold">KEY:</span>
                    <span className="text-foreground select-all font-semibold truncate flex-1">
                      {visibleKeys[versatileKey.id] ? versatileKey.raw_key : versatileKey.key_prefix}
                    </span>
                    {versatileKey.raw_key && (
                      <button
                        onClick={() => toggleVisibility(versatileKey.id)}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        title={visibleKeys[versatileKey.id] ? 'Ẩn mã' : 'Hiện đầy đủ mã'}
                      >
                        {visibleKeys[versatileKey.id] ? (
                          <EyeOff className="w-3.5 h-3.5 text-purple-400" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(versatileKey.raw_key || versatileKey.key_prefix, versatileKey.id)}
                      className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 border border-purple-500/30"
                      title="Sao chép nhanh khóa này"
                    >
                      {copiedKeyId === versatileKey.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500">Đã Copy!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo tên khóa, mô tả, quyền hoặc prefix..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-card border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Quyền:</span>
                {[
                  { id: 'ALL', label: 'Tất Cả' },
                  { id: 'MULTI', label: '⚡ Đa Năng' },
                  { id: 'NEWS_FULL', label: 'Tin Tức' },
                  { id: 'MISSIONS_FULL', label: 'Nhiệm Vụ' },
                  { id: 'MISSIONS_REVIEW', label: 'AI Pine' },
                  { id: 'ADMIN_FULL', label: 'Toàn Quyền' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setScopeFilter(filter.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      scopeFilter === filter.id
                        ? 'bg-foreground text-background font-semibold'
                        : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none border-l border-border pl-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Thời hạn:</span>
                {[
                  { id: 'ALL', label: 'Tất Cả' },
                  { id: 'ACTIVE', label: 'Hoạt Động' },
                  { id: 'INACTIVE', label: 'Đã Tắt' },
                  { id: 'EXPIRED', label: 'Hết Hạn' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setStatusFilter(filter.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      statusFilter === filter.id
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Keys Table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">TÊN KHÓA & MÔ TẢ</th>
                    <th className="py-3 px-4">PHÂN QUYỀN (CÁC QUYỀN SỞ HỮU)</th>
                    <th className="py-3 px-4">KHÓA API (SAO CHÉP / HIỆN 1 PHẦN)</th>
                    <th className="py-3 px-4">HIỆU LỰC (THỜI HẠN)</th>
                    <th className="py-3 px-4 text-center">TRẠNG THÁI</th>
                    <th className="py-3 px-4">LẦN DÙNG</th>
                    <th className="py-3 px-4 text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredKeys.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">Chưa có khóa API nào phù hợp với bộ lọc.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredKeys.map((item) => {
                      const expInfo = formatExpirationInfo(item.expires_at);
                      const keyToCopy = item.raw_key || item.key_prefix.replace('••••••••••••••••••••', '');
                      const isRevealed = visibleKeys[item.id] && item.raw_key;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-muted/20 transition-colors ${
                            expInfo.isExpired || item.is_active === 0 ? 'opacity-70 bg-muted/5' : ''
                          }`}
                        >
                          {/* Name & Desc */}
                          <td className="py-3.5 px-4 font-medium max-w-[200px]">
                            <div className="text-foreground font-semibold flex items-center gap-1.5">
                              <span>{item.key_name}</span>
                              {expInfo.isExpired && (
                                <span className="text-[10px] text-rose-500 font-bold bg-rose-500/10 px-1.5 py-0.2 rounded">
                                  Hết hạn
                                </span>
                              )}
                            </div>
                            {item.description ? (
                              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                {item.description}
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">
                                ID: {item.id}
                              </div>
                            )}
                          </td>

                          {/* Scope Badges */}
                          <td className="py-3.5 px-4">
                            {renderScopeBadges(item.scope)}
                          </td>

                          {/* Key Display & Quick Copy */}
                          <td className="py-3.5 px-4">
                            <div className="inline-flex items-center gap-2 bg-background border border-border/80 px-2.5 py-1.5 rounded-xl font-mono text-xs shadow-inner">
                              <span className="text-foreground select-all font-semibold max-w-[140px] sm:max-w-[180px] truncate">
                                {isRevealed ? item.raw_key : item.key_prefix}
                              </span>

                              {item.raw_key && (
                                <button
                                  onClick={() => toggleVisibility(item.id)}
                                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                                  title={isRevealed ? 'Ẩn mã' : 'Hiện đầy đủ mã'}
                                >
                                  {isRevealed ? (
                                    <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}

                              <button
                                onClick={() => handleCopy(keyToCopy, item.id)}
                                className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs flex items-center gap-1 transition-all shrink-0 border border-primary/20"
                                title="Sao chép nhanh khóa này"
                              >
                                {copiedKeyId === item.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-500" />
                                    <span className="text-emerald-500">Đã Copy!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Expiration (Time-based Permission) */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <div>{expInfo.badge}</div>
                              {expInfo.text && (
                                <div className="text-[10px] text-muted-foreground/80 font-mono">
                                  {expInfo.text}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleToggleActive(item)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                                item.is_active === 1 && !expInfo.isExpired
                                  ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
                              }`}
                              title={item.is_active === 1 ? 'Bấm để vô hiệu hóa' : 'Bấm để kích hoạt lại'}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  item.is_active === 1 && !expInfo.isExpired
                                    ? 'bg-emerald-500 animate-pulse'
                                    : 'bg-rose-500'
                                }`}
                              />
                              {item.is_active === 1 && !expInfo.isExpired ? 'Hoạt Động' : 'Đã Tắt'}
                            </button>
                          </td>

                          {/* Last Used */}
                          <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap font-mono">
                            {item.last_used_at ? (
                              <span title={item.last_used_at}>
                                {new Date(item.last_used_at).toLocaleDateString('vi-VN')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60 italic">Chưa dùng</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Set Permissions Button (Phân Quyền Đa Năng) */}
                              <button
                                onClick={() => handleOpenPermissionModal(item)}
                                className="px-2.5 py-1.5 rounded-lg border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 text-xs font-semibold flex items-center gap-1 transition-colors"
                                title="Set và tùy biến các quyền cho mã API này"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Set Quyền</span>
                              </button>

                              {/* Extend button (Phân quyền theo thời gian) */}
                              <button
                                onClick={() => setExtendingKey(item)}
                                className="px-2 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 text-xs font-medium flex items-center gap-1 transition-colors"
                                title="Gia hạn hoặc điều chỉnh thời hạn hiệu lực"
                              >
                                <Hourglass className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Gia Hạn</span>
                              </button>

                              {/* Toggle Active / Deactivate */}
                              <button
                                onClick={() => handleToggleActive(item)}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  item.is_active === 1
                                    ? 'border-amber-500/30 text-amber-500 hover:bg-amber-500/10'
                                    : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                                }`}
                                title={item.is_active === 1 ? 'Vô hiệu hóa khóa này' : 'Kích hoạt lại'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteKey(item)}
                                className="p-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-colors"
                                title="Thu hồi & Xóa vĩnh viễn"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Permissions Breakdown Tab (Bảng 10 Cấp Quyền) */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-purple-500/30 bg-purple-500/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-purple-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-foreground">Cơ Chế Phân Quyền Đa Năng Linh Hoạt</h3>
                <p className="text-xs text-muted-foreground">
                  Một mã API có thể sở hữu 1 quyền riêng biệt hoặc sở hữu đồng thời nhiều quyền cùng lúc. Quản trị viên có thể bấm nút <strong>"Set Quyền"</strong> trên danh sách để điều chỉnh bất kỳ lúc nào.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_API_SCOPES.map((scopeItem) => {
              const Icon = scopeItem.icon;
              return (
                <div
                  key={scopeItem.id}
                  className={`p-4 rounded-2xl border ${scopeItem.badgeBorder} bg-gradient-to-br from-card to-card/60 space-y-2.5 shadow-sm`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${scopeItem.badgeBg} ${scopeItem.badgeText}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {scopeItem.category}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground font-semibold">
                      {scopeItem.id}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground">{scopeItem.name}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{scopeItem.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* API Documentation Tab */}
      {activeTab === 'docs' && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setDocCategory('remote')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                docCategory === 'remote'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              🚀 7 API Điều Khiển Từ Xa (Remote Control)
            </button>
            <button
              onClick={() => setDocCategory('universal')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                docCategory === 'universal'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              ⚡ API Đa Năng (Set Quyền Bằng 1 Mã API)
            </button>
            <button
              onClick={() => setDocCategory('store')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                docCategory === 'store'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              🛍️ API Code Bán & Gói Bán (Mới)
            </button>
            <button
              onClick={() => setDocCategory('telegram')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                docCategory === 'telegram'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              🤖 API Quản Lý Telegram (Mới)
            </button>
            <button
              onClick={() => setDocCategory('news')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                docCategory === 'news'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Newspaper className="w-3.5 h-3.5" />
              API Tin Tức
            </button>
            <button
              onClick={() => setDocCategory('icons')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                docCategory === 'icons'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              API Logo & Icon Game (Mới)
            </button>
            <button
              onClick={() => setDocCategory('missions')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                docCategory === 'missions'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              API Nhiệm Vụ & AI Pine
            </button>
            <button
              onClick={() => setDocCategory('giveaways')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                docCategory === 'giveaways'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              API Giveaway (Mới)
            </button>
            <button
              onClick={() => setDocCategory('events')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                docCategory === 'events'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              API Lịch Đếm Ngược (Mới)
            </button>
            <button
              onClick={() => setDocCategory('games')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                docCategory === 'games'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              API Quản Lý Game & Mã (Mới)
            </button>
            <button
              onClick={() => setDocCategory('sync')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                docCategory === 'sync'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              API Đồng Bộ Master
            </button>
            <button
              onClick={() => setDocCategory('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                docCategory === 'history'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              API Lịch Sử & Xóa Mềm (Mới)
            </button>
          </div>
          
          {docCategory === 'store' && (
            <div className="space-y-4 bg-card border border-border p-5 rounded-2xl">
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs leading-relaxed space-y-2">
                <div className="flex items-center gap-2 font-bold text-purple-400 text-sm">
                  <ShoppingBag className="w-4 h-4" />
                  <span>🛍️ Cổng Quản Lý Code Bán & Gói Sản Phẩm (Store & Inventory API)</span>
                </div>
                <p>
                  Endpoint <code>/api/store/manage</code> cung cấp toàn quyền quản trị danh mục gói sản phẩm bán (tạo, cập nhật, xóa gói, điều chỉnh giá bán / giá gốc, cấu hình hiển thị FOMO) và nạp kho mã code bán thực tế cho website. Mọi thay đổi về tồn kho mã code tự động kích hoạt tính toán lại số lượng tồn kho hiển thị (Quy tắc kho hàng thật = 0 thì hiển thị = 0 "HẾT HÀNG") và đồng bộ nguyên tử 1 - 1 lên Cửa Hàng <code>codegame.shop/store</code>.
                </p>
                <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Scope yêu cầu: STORE_FULL</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Method: GET &amp; POST</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Edge Cache Auto-Purge: Có</span>
                </div>
              </div>

              {/* Mẫu 1 */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  Mẫu 1: Liệt kê danh sách gói sản phẩm &amp; số lượng tồn kho thực tế (GET - cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# Lấy toàn bộ danh sách gói sản phẩm bán trên sàn
curl -X GET "https://codegame.shop/api/store/manage?action=list_products" \
  -H "X-API-Key: YOUR_API_KEY_HERE"

# Lọc theo game_slug hoặc danh mục (category: pack, card, item...)
curl -X GET "https://codegame.shop/api/store/manage?action=list_products&game_slug=3q-dao-dao-dao&status=ACTIVE" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE"`}
                </pre>
              </div>

              {/* Mẫu 2 */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Mẫu 2: Tạo mới gói sản phẩm / gói nạp chiết khấu (Action: create_product - cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/store/manage \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "action": "create_product",
    "title": "Gói Nạp Đầu 200K Kim Cương",
    "game_slug": "sword-x-staff",
    "game_name": "Sword x Staff",
    "category": "pack",
    "category_label": "Gói nạp",
    "original_price": 200000,
    "current_price": 149000,
    "badge": "HOT BÁN CHẠY",
    "description": "Nhận ngay 200.000 Kim Cương và Quà Nạp Đầu Độc Quyền.",
    "cover_image_url": "https://codegame.shop/game_icons/sword-x-staff.webp",
    "virtual_sold_count": 86,
    "show_sold_count": true,
    "initial_codes": [
      "SXS200K_A8F1",
      "SXS200K_B9C2",
      "SXS200K_D3E4"
    ]
  }'`}
                </pre>
              </div>

              {/* Mẫu 3 */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Mẫu 3: Nạp kho hàng loạt mã code bán mới (Action: import_codes - cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/store/manage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  -d '{
    "action": "import_codes",
    "product_id": "sp_sword-x-staff_pack1",
    "codes": [
      "CODE_VIP_001",
      "CODE_VIP_002",
      "CODE_VIP_003",
      "CODE_VIP_004",
      "CODE_VIP_005"
    ]
  }'`}
                </pre>
              </div>

              {/* Mẫu 4 */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  Mẫu 4: Tra cứu danh sách mã code trong kho theo gói (GET list_codes - cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# Xem danh sách mã code chưa bán (AVAILABLE) của gói sản phẩm
curl -X GET "https://codegame.shop/api/store/manage?action=list_codes&product_id=sp_sword-x-staff_pack1&status=AVAILABLE&limit=100" \
  -H "X-API-Key: YOUR_API_KEY_HERE"

# Xem toàn bộ mã đã bán kèm ID đơn hàng
curl -X GET "https://codegame.shop/api/store/manage?action=list_codes&product_id=sp_sword-x-staff_pack1&status=SOLD" \
  -H "X-API-Key: YOUR_API_KEY_HERE"`}
                </pre>
              </div>

              {/* Mẫu 5 */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  Mẫu 5: Cập nhật thông tin gói bán &amp; Điều chỉnh FOMO (Action: update_product / adjust_fomo)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# Cập nhật giá bán và huy hiệu khuyến mãi
curl -X POST https://codegame.shop/api/store/manage \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "action": "update_product",
    "id": "sp_sword-x-staff_pack1",
    "current_price": 129000,
    "badge": "GIẢM SỐC 35%",
    "is_active": true
  }'

# Điều chỉnh số lượng đã bán ảo và hiển thị FOMO
curl -X POST https://codegame.shop/api/store/manage \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "action": "adjust_fomo",
    "id": "sp_sword-x-staff_pack1",
    "virtual_sold_count": 120,
    "show_sold_count": true
  }'`}
                </pre>
              </div>

              {/* Mẫu 6 */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-rose-400" />
                  Mẫu 6: Xóa lẻ mã code hoặc xóa toàn bộ gói bán (Action: delete_codes / delete_product)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# Xóa các mã code chưa bán cụ thể khỏi kho
curl -X POST https://codegame.shop/api/store/manage \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "action": "delete_codes",
    "product_id": "sp_sword-x-staff_pack1",
    "codes": ["CODE_VIP_001", "CODE_VIP_002"]
  }'

# Xóa vĩnh viễn gói sản phẩm khỏi Cửa Hàng (kèm toàn bộ mã tồn kho chưa bán)
curl -X POST https://codegame.shop/api/store/manage \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "action": "delete_product",
    "id": "sp_sword-x-staff_pack1"
  }'`}
                </pre>
              </div>

              {/* Mẫu 7: JavaScript Fetch */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-purple-400" />
                  Mẫu 7: Tích hợp tự động hóa nạp kho (Node.js / JavaScript Fetch)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`const res = await fetch('https://codegame.shop/api/store/manage', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_API_KEY_HERE',
  },
  body: JSON.stringify({
    action: 'import_codes',
    product_id: 'sp_sword-x-staff_pack1',
    codes: ['GIFTCODE_AUTO_1', 'GIFTCODE_AUTO_2']
  }),
});

const data = await res.json();
console.log('Kết quả nạp kho:', data.imported_count, 'Tồn kho mới:', data.total_stock_now);`}
                </pre>
              </div>

              {/* Mẫu 8: First Purchase Campaign Management */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-rose-400" />
                  Mẫu 8: Quản lý Chiến Dịch Ưu Đãi Mua Lần Đầu (GET / POST - Scope: FIRST_PURCHASE_MANAGE)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Đọc toàn bộ cấu hình chiến dịch, thống kê và danh sách lượt mua
curl -X GET "https://codegame.shop/api/admin/first-purchase" \\
  -H "X-API-Key: YOUR_API_KEY_HERE"

# 2. Cập nhật cấu hình từng phần (Partial Update)
curl -X POST "https://codegame.shop/api/admin/first-purchase" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY_HERE" \\
  -d '{
    "enabled": true,
    "offer_price": 2000,
    "max_original_price": 30000,
    "require_verified_email": false,
    "excluded_product_ids": ["sp_1793943215070_fxm", "BỘ CODE"]
  }'

# 3. Đặt lại quyền mua ưu đãi (Reset Offer) cho 1 thành viên
curl -X POST "https://codegame.shop/api/admin/first-purchase" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY_HERE" \\
  -d '{
    "action": "reset_offer",
    "memberEmail": "member@gmail.com",
    "productId": "sp_hiep-khach-hanh_nhu-lai",
    "reason": "Hỗ trợ khách hàng đổi thiết bị"
  }'

# 4. Tra cứu cờ ưu đãi mua lần đầu riêng từng tiện ích (Utilities)
curl -X GET "https://codegame.shop/api/admin/utilities/first-purchase" \\
  -H "Authorization: Bearer YOUR_API_KEY_OR_SECRET"

# 5. Cập nhật cờ ưu đãi mua lần đầu riêng cho 1 tiện ích (Bật / Giá riêng / Trần riêng)
curl -X PUT "https://codegame.shop/api/admin/utilities/first-purchase/ut_vs_05_vip_7d" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_OR_SECRET" \\
  -d '{
    "first_purchase_enabled": true,
    "first_purchase_price": 5000,
    "first_purchase_max_price": 30000
  }'

# 6. Cập nhật cờ ưu đãi mua lần đầu riêng cho 1 gói cửa hàng (Store Product)
curl -X PUT "https://codegame.shop/api/admin/store/first-purchase/sp_hiep-khach-hanh_nhu-lai" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_OR_SECRET" \\
  -d '{
    "first_purchase_enabled": true,
    "first_purchase_price": 2000
  }'`}
                </pre>
              </div>

              {/* Mẫu 9: Escalating Price Management */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                  Mẫu 9: Quản lý Hình Thức Nâng Giá Theo Gói (Scope: ESCALATING_MANAGE)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Liệt kê toàn bộ các gói đang bật hình thức Nâng Giá kèm bậc giá hiện tại & tiếp theo
curl -X GET "https://codegame.shop/api/admin/escalating/packages" \\
  -H "X-API-Key: YOUR_API_KEY_HERE"

# 2. Xem lịch sử đơn hàng đã mua theo thang giá của 1 gói
curl -X GET "https://codegame.shop/api/admin/escalating/history?product_id=sp_idle-cat-gunner_mw5yrnka" \\
  -H "X-API-Key: YOUR_API_KEY_HERE"

# 3. Đặt lại thang giá về mốc ban đầu (Reset Escalating Price)
curl -X POST "https://codegame.shop/api/admin/escalating/reset" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY_HERE" \\
  -d '{
    "productId": "sp_idle-cat-gunner_mw5yrnka",
    "reason": "Khởi động mùa giải mới, đưa giá về mốc ban đầu"
  }'`}
                </pre>
              </div>

              {/* Mẫu 10: Security & Audit Logs */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Mẫu 10: Tra Cứu Nhật Ký Kiểm Toán (Scope: FIRST_PURCHASE_MANAGE / ESCALATING_MANAGE / ADMIN_FULL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# Tra cứu nhật ký thay đổi chiến dịch mua lần đầu (phân trang page 1, 20 bản ghi)
curl -X GET "https://codegame.shop/api/admin/audit-log?scope=first-purchase&page=1&limit=20" \\
  -H "X-API-Key: YOUR_API_KEY_HERE"

# Tra cứu nhật ký thao tác Nâng Giá
curl -X GET "https://codegame.shop/api/admin/audit-log?scope=escalating&page=1&limit=20" \\
  -H "X-API-Key: YOUR_API_KEY_HERE"`}
                </pre>
              </div>

              {/* Mẫu 11: Member Wallet Balance Adjustment */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Mẫu 11: Điều Chỉnh Số Dư Ví Thành Viên — Nạp / Trừ Core (Scope: MEMBERS_FULL / ADMIN_FULL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Cộng Core cho thành viên (type: ADD)
curl -X POST "https://codegame.shop/api/admin/members/adjust-balance" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY_HERE" \\
  -d '{
    "memberId": "usr_1793366379892_cb88",
    "amount": 100,
    "type": "ADD",
    "reason": "Thưởng sự kiện thành viên tích cực",
    "idempotencyKey": "adj_muse_reward_001"
  }'

# 2. Trừ Core của thành viên (type: SUBTRACT)
curl -X POST "https://codegame.shop/api/admin/members/adjust-balance" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY_HERE" \\
  -d '{
    "memberId": "muse@synqp.com",
    "amount": 50,
    "type": "SUBTRACT",
    "reason": "Thu hồi Core nạp nhầm"
  }'`}
                </pre>
              </div>

              {/* Mẫu 12: Members API */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Mẫu 12: Quản Lý Danh Sách & Tài Khoản Thành Viên (Scope: MEMBERS_FULL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Danh sách thành viên (lọc theo role, status, tìm kiếm, phân trang)
curl -X GET "https://codegame.shop/api/admin/members?page=1&limit=20&status=ACTIVE&search=minh" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 2. Xem chi tiết 1 thành viên
curl -X GET "https://codegame.shop/api/admin/members/usr_1793366379892_cb88" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 3. Cập nhật thông tin thành viên (displayName, phone, status, role)
curl -X PUT "https://codegame.shop/api/admin/members/usr_1793366379892_cb88" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -d '{"displayName": "Minh Huỳnh Pro", "phone": "0987654321"}'

# 4. Khóa tài khoản thành viên
curl -X POST "https://codegame.shop/api/admin/members/usr_1793366379892_cb88/ban" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -d '{"reason": "Gian lận nhiệm vụ"}'

# 5. Mở khóa tài khoản thành viên
curl -X POST "https://codegame.shop/api/admin/members/usr_1793366379892_cb88/unban" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"`}
                </pre>
              </div>

              {/* Mẫu 13: Wallets API */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  Mẫu 13: Quản Lý Ví & Biến Động Số Dư (Scope: WALLET_MANAGE / MEMBERS_FULL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Tra cứu biến động số dư ví toàn sàn (lọc theo memberId, loại DEPOSIT/PURCHASE/REFUND, phân trang)
curl -X GET "https://codegame.shop/api/admin/wallets/transactions?page=1&limit=20&type=DEPOSIT" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 2. Tra cứu số dư và 20 giao dịch gần nhất của 1 thành viên
curl -X GET "https://codegame.shop/api/admin/wallets/usr_1793366379892_cb88" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"`}
                </pre>
              </div>

              {/* Mẫu 14: Orders API */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-400" />
                  Mẫu 14: Quản Lý Đơn Hàng Code & Hoàn Tiền (Scope: ORDERS_FULL / STORE_FULL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Danh sách đơn hàng mua code (lọc trạng thái COMPLETED/REFUNDED, phân trang)
curl -X GET "https://codegame.shop/api/admin/orders?page=1&limit=20&status=COMPLETED" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 2. Chi tiết 1 đơn hàng (kèm mã code kho đã phát cho khách)
curl -X GET "https://codegame.shop/api/admin/orders/ORD-1793366379892" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 3. Hoàn tiền đơn hàng (hồi mã kho, hoàn Core về ví thành viên)
curl -X POST "https://codegame.shop/api/admin/orders/ORD-1793366379892/refund" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -d '{"reason": "Khách mua nhầm gói, hoàn tiền theo yêu cầu"}'`}
                </pre>
              </div>

              {/* Mẫu 15: SePay API */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-teal-400" />
                  Mẫu 15: Liên Kết SePay & Cấu Hình Ngân Hàng (Scope: SEPAY_FULL / WALLET_MANAGE)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Lịch sử giao dịch SePay D1 (phân trang, tìm kiếm mã GD/nội dung, tính tổng tiền)
curl -X GET "https://codegame.shop/api/admin/sepay/transactions?page=1&limit=20&search=97104172" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 2. Xem cấu hình tài khoản nhận tiền SePay
curl -X GET "https://codegame.shop/api/admin/sepay/config" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 3. Cập nhật cấu hình SePay (hỗ trợ cập nhật từng trường riêng)
curl -X PUT "https://codegame.shop/api/admin/sepay/config" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -d '{"accountNumber": "10004681879", "bankName": "TPBank", "accountHolder": "CODEGAME SHOP"}'`}
                </pre>
              </div>

              {/* Mẫu 16: Free Codes API */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-400" />
                  Mẫu 16: Quản Lý Giftcode Miễn Phí (Scope: FREE_CODES_FULL / GAMES_FULL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Danh sách giftcode miễn phí (lọc theo game_slug, status, tìm kiếm)
curl -X GET "https://codegame.shop/api/admin/free-codes?game_slug=genshin-impact&status=ACTIVE&limit=20" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 2. Thêm mới 1 mã giftcode
curl -X POST "https://codegame.shop/api/admin/free-codes" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -d '{"code": "GENSHIN2026", "game_slug": "genshin-impact", "rewards": "300 Nguyên Thạch", "status": "ACTIVE"}'

# 3. Sửa mã giftcode
curl -X PUT "https://codegame.shop/api/admin/free-codes/code_12345" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -d '{"rewards": "500 Nguyên Thạch + 50k Mora"}'

# 4. Xóa lẻ 1 mã
curl -X DELETE "https://codegame.shop/api/admin/free-codes/code_12345" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 5. Xóa hàng loạt danh sách mã
curl -X DELETE "https://codegame.shop/api/admin/free-codes" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -d '{"ids": ["code_1", "code_2", "code_3"]}'`}
                </pre>
              </div>

              {/* Mẫu 17: Submissions API */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-sky-400" />
                  Mẫu 17: Duyệt Giftcode Khách Đóng Góp (Scope: SUBMISSIONS_FULL / GAMES_FULL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Danh sách mã khách gửi (lọc status: PENDING / APPROVED / REJECTED)
curl -X GET "https://codegame.shop/api/admin/submissions?status=PENDING" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 2. Duyệt mã (tự động nạp vào bảng codes)
curl -X POST "https://codegame.shop/api/admin/submissions/sub_1793366379892/approve" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 3. Từ chối mã kèm lý do
curl -X POST "https://codegame.shop/api/admin/submissions/sub_1793366379892/reject" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -d '{"reason": "Mã đã hết hạn sử dụng"}'`}
                </pre>
              </div>

              {/* Mẫu 18: Web Content CMS API */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  Mẫu 18: Quản Lý Khối Nội Dung CMS Web (Scope: CONTENT_FULL / NEWS_FULL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Lấy toàn bộ danh sách khối nội dung CMS
curl -X GET "https://codegame.shop/api/admin/content" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 2. Xem chi tiết khối nội dung theo key
curl -X GET "https://codegame.shop/api/admin/content/hero_banner" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 3. Cập nhật khối nội dung CMS
curl -X PUT "https://codegame.shop/api/admin/content/hero_banner" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -d '{"title": "Cổng Giftcode Game Số 1 Việt Nam 2026", "subtitle": "Cập nhật giftcode 24/7"}'`}
                </pre>
              </div>

              {/* Mẫu 19: Utilities API */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-cyan-400" />
                  Mẫu 19: Quản Lý Gói Tiện Ích & Kho Hàng (Scope: UTILITIES_FULL / STORE_FULL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Danh sách toàn bộ 18 tiện ích game
curl -X GET "https://codegame.shop/api/admin/utilities" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 2. Tạo mới 1 gói tiện ích
curl -X POST "https://codegame.shop/api/admin/utilities" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -d '{"id": "ut_custom_vpn", "title": "Gói VPN Game VIP 30 Ngày", "price": 45000, "stock": 100}'

# 3. Cập nhật thông tin gói tiện ích
curl -X PUT "https://codegame.shop/api/admin/utilities/ut_custom_vpn" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -d '{"price": 39000, "description": "VPN giảm ping siêu tốc"}'

# 4. Cập nhật kho hàng tiện ích (đặt số tuyệt đối hoặc cộng/trừ delta)
curl -X PUT "https://codegame.shop/api/admin/utilities/ut_custom_vpn/stock" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -d '{"stock_quantity": 250}'

# 5. Xóa vĩnh viễn gói tiện ích khỏi CSDL và setting KV
curl -X DELETE "https://codegame.shop/api/admin/utilities/ut_custom_vpn" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"`}
                </pre>
              </div>

              {/* Mẫu 20: Growth & Viral API */}
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Mẫu 20: Cấu Hình Tăng Trưởng & Viral (Scope: GROWTH_FULL / STORE_FULL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Đọc cấu hình tăng trưởng (vòng quay, điểm danh, nạp đầu, đua top)
curl -X GET "https://codegame.shop/api/admin/growth" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE"

# 2. Cập nhật cấu hình tăng trưởng (hỗ trợ partial update)
curl -X PUT "https://codegame.shop/api/admin/growth" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY_HERE" \\
  -d '{"lucky_wheel_enabled": true, "checkin_streak_bonus": 500}'`}
                </pre>
              </div>
            </div>
          )}

          {docCategory === 'telegram' && (
            <div className="space-y-4 bg-card border border-border p-5 rounded-2xl">
              <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs leading-relaxed">
                <span className="font-bold text-cyan-400">🤖 Cổng Điều Hành Nhóm Telegram Cho AI Agent (Muse) & Quản Trị Viên:</span> Endpoint <code>POST /api/telegram/manage</code> cho phép quản lý toàn bộ nhóm chat Telegram (đọc trạng thái nhóm/admin, phân trang tin nhắn webhook, xóa/ghim tin nhắn, cấm/hạn chế thành viên, sửa tên/mô tả nhóm, tạo/thu hồi link mời) bằng Khóa API mang scope <code>TELEGRAM_FULL</code> mà <b>không cần cầm Bot Token</b>.
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Mẫu 1: Đọc Thông Tin Nhóm & Danh Sách Admin (Action: get_chat / get_administrators)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# Lấy thông tin nhóm (Tên, mô tả, số lượng thành viên, permissions)
curl -X POST https://codegame.shop/api/telegram/manage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_WITH_TELEGRAM_FULL" \
  -d '{ "action": "get_chat" }'

# Lấy danh sách quản trị viên của nhóm
curl -X POST https://codegame.shop/api/telegram/manage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_WITH_TELEGRAM_FULL" \
  -d '{ "action": "get_administrators" }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Mẫu 2: Phân Trang Lịch Sử Tin Nhắn Nhận Từ Webhook (Action: get_recent_messages)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/telegram/manage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_WITH_TELEGRAM_FULL" \
  -d '{
    "action": "get_recent_messages",
    "limit": 30,
    "offset": 0
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Mẫu 3: Xóa & Ghim Tin Nhắn Trong Nhóm (Action: delete_message / pin_message / unpin_message)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Ghim tin nhắn thông báo quan trọng
curl -X POST https://codegame.shop/api/telegram/manage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_WITH_TELEGRAM_FULL" \
  -d '{
    "action": "pin_message",
    "message_id": 12345,
    "disable_notification": false
  }'

# 2. Xóa tin nhắn rác hoặc vi phạm quy tắc
curl -X POST https://codegame.shop/api/telegram/manage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_WITH_TELEGRAM_FULL" \
  -d '{
    "action": "delete_message",
    "message_id": 12345
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Mẫu 4: Cấm & Hạn Chế Thành Viên (Action: ban_member / restrict_member)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# Cấm thành viên vi phạm và thu hồi mọi tin nhắn cũ
curl -X POST https://codegame.shop/api/telegram/manage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_WITH_TELEGRAM_FULL" \
  -d '{
    "action": "ban_member",
    "user_id": 987654321,
    "revoke_messages": true
  }'

# Hạn chế quyền gửi tin nhắn trong 24 giờ
curl -X POST https://codegame.shop/api/telegram/manage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_WITH_TELEGRAM_FULL" \
  -d '{
    "action": "restrict_member",
    "user_id": 987654321,
    "duration_hours": 24,
    "permissions": {
      "can_send_messages": false,
      "can_send_media_messages": false
    }
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Mẫu 5: Đăng Tin Tức / Mã Code / Thông Báo Lên Nhóm (POST /api/telegram/notify)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/telegram/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY_WITH_TELEGRAM_NOTIFY" \
  -d '{
    "kind": "new_code",
    "game_slug": "genshin-impact",
    "game_name": "Genshin Impact",
    "codes": ["GENSHINGIFT", "NATLAN2026"],
    "title": "Mã mới khám phá Natlan",
    "source_name": "CodeGame.shop",
    "source_url": "https://codegame.shop/code/genshin-impact"
  }'`}
                </pre>
              </div>
            </div>
          )}

          {/* Docs: Universal Set Permissions API */}
          {docCategory === 'universal' && (
            <div className="space-y-4 bg-card border border-border p-5 rounded-2xl">
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs leading-relaxed">
                <span className="font-bold text-purple-400">⚡ API Đa Năng:</span> Sử dụng 1 mã API Quản trị (hoặc khóa Đa Năng có quyền <code>API_KEYS_FULL</code> / <code>ADMIN_FULL</code>) để gọi endpoint <code>POST /api/api-keys/set-permissions</code> nhằm cấu hình và set bất kỳ tổ hợp quyền nào cho các mã API trên hệ thống.
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  Mẫu 1: Dùng 1 Mã API Để Set Quyền Cho Mã Khác (cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/api-keys/set-permissions \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_ADMIN_OR_VERSATILE_KEY" \\
  -d '{
    "key_id": "ak_preset_multi_versatile",
    "scopes": [
      "NEWS_FULL",
      "MISSIONS_FULL",
      "GAMES_FULL",
      "GIVEAWAYS_FULL",
      "SYNC_FULL"
    ]
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-purple-400" />
                  Mẫu 2: Set Quyền Bằng JavaScript (Node.js / Fetch API)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`const res = await fetch('https://codegame.shop/api/api-keys/set-permissions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_ADMIN_OR_VERSATILE_KEY',
  },
  body: JSON.stringify({
    key_id: 'ak_preset_multi_versatile',
    scopes: ['NEWS_FULL', 'MISSIONS_FULL', 'SYNC_FULL'],
    description: 'Khóa đa năng cập nhật qua API tự động'
  })
});
const data = await res.json();
console.log('Kết quả cập nhật:', data);`}
                </pre>
              </div>
            </div>
          )}

          {docCategory === 'news' && (
            <div className="space-y-4 bg-card border border-border p-5 rounded-2xl">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  Mẫu 1: Đăng bài viết mới hoặc Đặt lịch hẹn giờ (cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/news \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY_HERE" \\
  -d '{
    "title": "Tổng Hợp Giftcode Game Mới Tháng 11/2026",
    "content": "Nội dung bài viết chi tiết ở đây...",
    "tags": ["Tin Mới", "Giftcode"],
    "status": "SCHEDULED",
    "scheduled_publish_at": "2026-11-01T08:00:00.000Z"
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-500" />
                  Mẫu 2: Cập nhật / Sửa nội dung bài viết (JavaScript)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`const res = await fetch('https://codegame.shop/api/news/news_123', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_API_KEY_HERE',
  },
  body: JSON.stringify({
    title: 'Tiêu đề bài viết sau khi cập nhật',
    content: 'Nội dung mới...',
    status: 'PUBLISHED'
  })
});
const data = await res.json();
console.log(data);`}
                </pre>
              </div>
            </div>
          )}

          {docCategory === 'icons' && (
            <div className="space-y-4 bg-card border border-border p-5 rounded-2xl">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  Mẫu 1: Tải logo thật và tự động đối chiếu Store (JSON Payload)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/games/upload-icon \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY_HERE" \\
  -d '{
    "slug": "kof-legend",
    "image_url": "https://play-lh.googleusercontent.com/F3o9a5E96MFcfrjlp526Goj6EMQtnCsp1t9Bwp_Kzg1kUsIKttc3VRVqxxP-NrbyZwKwx7fv8cE4n-Pk99A86g=s0-br30",
    "store_url": "https://play.google.com/store/apps/details?id=com.huanle.kof.sea",
    "verify": true
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  Mẫu 2: Tải file ảnh trực tiếp từ máy (Multipart Form-Data)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/games/upload-icon \\
  -H "X-API-Key: YOUR_API_KEY_HERE" \\
  -F "slug=kof-legend" \\
  -F "file=@icon_kyo_512.webp;type=image/webp" \\
  -F "store_url=https://play.google.com/store/apps/details?id=com.huanle.kof.sea"`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-sky-400" />
                  Mẫu 3: Tải và xác minh logo tự động (JavaScript Fetch)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`const res = await fetch('https://codegame.shop/api/games/upload-icon', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_API_KEY_HERE',
  },
  body: JSON.stringify({
    slug: 'kof-legend',
    image_url: 'https://play-lh.googleusercontent.com/...',
    store_url: 'https://play.google.com/store/apps/details?id=com.huanle.kof.sea',
    verify: true,
  }),
});
const data = await res.json();
console.log(data); // { success: true, iconUrl: '/game_icons/kof-legend.webp?v=...', verified: true }`}
                </pre>
              </div>
            </div>
          )}

          {/* Docs: Games & Codes API (GAMES_MANAGE & GAMES_FULL) */}
          {docCategory === 'games' && (
            <div className="space-y-4 bg-card border border-border p-5 rounded-2xl">
              <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs leading-relaxed">
                <span className="font-bold text-teal-400">🎮 Quyền Quản Trị GAMES_MANAGE & GAMES_FULL:</span> Toàn quyền sửa thông tin game live (<code className="bg-black/40 px-1.5 py-0.5 rounded text-teal-200 font-mono">update_game</code>: chỉ đổi trường được gửi, giữ nguyên mã), xóa lẻ từng mã khỏi game live (<code className="bg-black/40 px-1.5 py-0.5 rounded text-teal-200 font-mono">delete_codes</code>: đúng phạm vi slug, phân biệt hoa/thường, không ảnh hưởng game khác), và đặt icon live (<code className="bg-black/40 px-1.5 py-0.5 rounded text-teal-200 font-mono">update_icon_live</code>: xác minh file tồn tại và là ảnh thật). Chấp nhận Header <code className="bg-black/40 px-1.5 py-0.5 rounded text-teal-200 font-mono">Authorization: Bearer &lt;KEY&gt;</code> hoặc <code className="bg-black/40 px-1.5 py-0.5 rounded text-teal-200 font-mono">X-Api-Key: &lt;KEY&gt;</code>.
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-teal-400" />
                  Mẫu 1: Sửa Thông Tin Game Live (Action: update_game - cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/crawler/ingest-codes \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "action": "update_game",
    "slug": "sword-x-staff",
    "publisher": "Boltray Games"
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-rose-400" />
                  Mẫu 2: Xóa Lẻ Từng Mã Khỏi Game Live (Action: delete_codes - cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/crawler/ingest-codes \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "action": "delete_codes",
    "slug": "sword-x-staff",
    "codes": ["LEVELUPNOW", "SXSWITHYOU", "LUCKYGACHA", "SXSFACEBOOK"]
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  Mẫu 3: Đặt Icon Live Về Tập Tin Có Sẵn (Action: update_icon_live - cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/crawler/ingest-codes \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "action": "update_icon_live",
    "slug": "sword-x-staff-funtap",
    "iconUrl": "/game_icons/sword-x-staff.webp"
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Mẫu 4: Cập Nhật &amp; Tải Icon Game Live Từ URL Ảnh (Action: update_icon_from_url - cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/crawler/ingest-codes \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "action": "update_icon_from_url",
    "slug": "idle-cat-gunner",
    "image_url": "https://play-lh.googleusercontent.com/DP5-B3_N_pnc3SvmC2jXR61qDewhniXTQrIzhLKdVLkmLDcx8FtIi7Eh16KM59HhAHA3bTb0tDk0YP7WMFpUTWc=s0-br30"
  }'`}
                </pre>
              </div>
            </div>
          )}

          {docCategory === 'missions' && (
            <div className="space-y-4 bg-card border border-border p-5 rounded-2xl">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  Mẫu 1: AI Lấy danh sách bài nộp chờ duyệt (GET /api/missions/ai/pending)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X GET "https://codegame.shop/api/missions/ai/pending?limit=20" \\
  -H "X-API-Key: YOUR_AI_KEY_HERE"`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-indigo-400" />
                  Mẫu 2: AI Gửi kết quả duyệt bài và tự động trả thưởng (POST /api/missions/ai/review)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`const res = await fetch('https://codegame.shop/api/missions/ai/review', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_AI_KEY_HERE',
  },
  body: JSON.stringify({
    submission_id: 'sub_123456789',
    decision: 'APPROVED', // hoặc 'REJECTED'
    reason: 'Link bài đăng hợp lệ trên nhóm, đủ hashtag yêu cầu.',
    ai_confidence: 0.98
  })
});
const result = await res.json();
console.log(result);`}
                </pre>
              </div>
            </div>
          )}

          {docCategory === 'sync' && (
            <div className="space-y-4 bg-card border border-border p-5 rounded-2xl">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-rose-500" />
                  Mẫu: Đồng bộ toàn bộ dữ liệu qua Master API (POST /api/sync)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/sync \\
  -H "Content-Type: application/json" \\
  -H "X-Sync-Key: YOUR_MASTER_KEY_HERE" \\
  -d '{
    "newsArticles": [...],
    "missions": [...]
  }'`}
                </pre>
              </div>
            </div>
          )}

          {/* Docs: Giveaways API (GIVEAWAYS_FULL) */}
          {docCategory === 'giveaways' && (
            <div className="space-y-4 bg-card border border-border p-5 rounded-2xl">
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs leading-relaxed">
                <span className="font-bold text-purple-400">🎁 Quyền Quản Trị GIVEAWAYS_FULL:</span> Cho phép bot và hệ thống bên ngoài toàn quyền tra cứu chiến dịch giveaway, lấy danh sách mã kho, nạp hàng loạt giftcode, bật/tắt đợt phát và reset hồi chiêu. Chấp nhận Header <code className="bg-black/40 px-1.5 py-0.5 rounded text-purple-200 font-mono">X-Api-Key: &lt;KEY&gt;</code> hoặc <code className="bg-black/40 px-1.5 py-0.5 rounded text-purple-200 font-mono">Authorization: Bearer &lt;KEY&gt;</code>.
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  Mẫu 1: Tra Cứu Toàn Bộ Đợt Phát & Tồn Kho Chi Tiết (cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X GET "https://codegame.shop/api/giveaways/manage?status=ALL" \\
  -H "X-Api-Key: YOUR_GIVEAWAY_OR_ADMIN_KEY"`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  Mẫu 2: Nạp Thêm Hàng Loạt Mã Giftcode Vào Kho Đợt Phát (cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X PUT https://codegame.shop/api/giveaways/manage \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: YOUR_GIVEAWAY_OR_ADMIN_KEY" \\
  -d '{
    "action": "ADD_CODES",
    "giveaway_id": "gw_genshin-impact",
    "codes": [
      "GENSHIN_VIP_001",
      "GENSHIN_VIP_002",
      "GENSHIN_VIP_003"
    ]
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  Mẫu 3: Tạo Mới Chiến Dịch Giveaway Đầy Đủ Thông Số (cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/giveaways/manage \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: YOUR_GIVEAWAY_OR_ADMIN_KEY" \\
  -d '{
    "title": "Code riêng Honkai Star Rail VIP",
    "game_slug": "honkai-star-rail",
    "game_name": "Honkai: Star Rail",
    "description": "Code VIP độc quyền dành cho thành viên may mắn.",
    "rewards": "300 Ngọc Ánh Sao + 50.000 Điểm Tín Dụng",
    "max_per_user": 1,
    "max_per_ip": 1,
    "cooldown_minutes": 60,
    "virtual_remaining_addition": 25,
    "is_active": true,
    "codes": [
      "HSR_STAR_01",
      "HSR_STAR_02"
    ]
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-purple-400" />
                  Mẫu 4: Bật/Tắt Đợt Phát Hoặc Mở Ngay Lập Tức (JavaScript / Fetch)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`// 1. Reset thời gian chờ toàn sàn (Khách có thể giật code tiếp theo ngay lập tức)
await fetch('https://codegame.shop/api/giveaways/manage', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': 'YOUR_GIVEAWAY_OR_ADMIN_KEY',
  },
  body: JSON.stringify({
    action: 'RESET_COOLDOWN',
    id: 'gw_genshin-impact',
  }),
});

// 2. Tạm dừng / Kích hoạt lại đợt phát
await fetch('https://codegame.shop/api/giveaways/manage', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': 'YOUR_GIVEAWAY_OR_ADMIN_KEY',
  },
  body: JSON.stringify({
    action: 'TOGGLE_ACTIVE',
    id: 'gw_genshin-impact',
    is_active: false, // hoặc true để mở lại
  }),
});`}
                </pre>
              </div>
            </div>
          )}

          {/* Docs: Event Scheduler API (EVENT_SCHEDULER_FULL) */}
          {docCategory === 'events' && (
            <div className="space-y-4 bg-card border border-border p-5 rounded-2xl">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
                <span className="font-bold text-amber-400">⏰ Quyền Quản Trị EVENT_SCHEDULER_FULL:</span> Toàn quyền quản trị lịch sự kiện, đồng hồ đếm ngược tự động, lên lịch phát code/flash sale sản phẩm, kích hoạt Giờ G ngay lập tức và ghim banner trang chủ. Chấp nhận Header <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-200 font-mono">X-Api-Key: &lt;KEY&gt;</code> hoặc <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-200 font-mono">Authorization: Bearer &lt;KEY&gt;</code>.
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  Mẫu 1: Lấy Danh Sách Lịch Sự Kiện Kèm Trạng Thái Đếm Ngược Realtime (cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X GET "https://codegame.shop/api/event-scheduler?status=ALL" \\
  -H "X-Api-Key: YOUR_EVENT_OR_ADMIN_KEY"`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  Mẫu 2: Tạo Lịch Sự Kiện Đếm Ngược Mới (cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`curl -X POST https://codegame.shop/api/event-scheduler \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: YOUR_EVENT_OR_ADMIN_KEY" \\
  -d '{
    "title": "Đợt Phát Giftcode VIP Giang Hồ Kỳ Ngộ",
    "subtitle": "Đếm ngược đến giờ mở kho mã đặc biệt dành riêng cho thành viên",
    "type": "GIVEAWAY",
    "target_id": "gw_giang-ho-ky-ngo",
    "game_slug": "giang-ho-ky-ngo",
    "game_name": "Giang Hồ Kỳ Ngộ",
    "start_time": "2026-11-01T12:00:00.000Z",
    "end_time": "2026-11-01T18:00:00.000Z",
    "countdown_lead_hours": 72,
    "show_top_banner": true,
    "show_in_giveaways": true,
    "theme": "fire",
    "badge_label": "SẮP DIỄN RA",
    "cta_text": "Săn Mã Ngay",
    "is_active": true
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  Mẫu 3: Kích Hoạt Giờ G (LIVE Ngay Lập Tức) hoặc Gia Hạn Sự Kiện (cURL)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Kích hoạt LIVE ngay lập tức trong 120 phút
curl -X PUT https://codegame.shop/api/event-scheduler \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: YOUR_EVENT_OR_ADMIN_KEY" \\
  -d '{
    "action": "TRIGGER_LIVE",
    "id": "ev_1793290359485_abc",
    "duration_minutes": 120
  }'

# 2. Gia hạn thêm 60 phút
curl -X PUT https://codegame.shop/api/event-scheduler \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: YOUR_EVENT_OR_ADMIN_KEY" \\
  -d '{
    "action": "EXTEND_TIME",
    "id": "ev_1793290359485_abc",
    "extend_minutes": 60
  }'`}
                </pre>
              </div>

              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-amber-400" />
                  Mẫu 4: Xóa Sự Kiện Hoặc Bật/Tắt Trạng Thái (JavaScript / Fetch)
                </h4>
                <pre className="mt-2 p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`// Bật/tắt sự kiện
await fetch('https://codegame.shop/api/event-scheduler', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': 'YOUR_EVENT_OR_ADMIN_KEY',
  },
  body: JSON.stringify({
    action: 'TOGGLE_ACTIVE',
    id: 'ev_1793290359485_abc',
  }),
});

// Xóa sự kiện
await fetch('https://codegame.shop/api/event-scheduler?id=ev_1793290359485_abc', {
  method: 'DELETE',
  headers: {
    'X-Api-Key': 'YOUR_EVENT_OR_ADMIN_KEY',
  },
});`}
                </pre>
              </div>
            </div>
          )}
          {docCategory === 'remote' && (
            <div className="space-y-6 bg-card border border-border p-5 rounded-2xl">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
                  <Terminal className="w-4 h-4" />
                  <span>🚀 Bộ 7 API Điều Khiển Web Từ Xa (Remote Control & Headless APIs)</span>
                </div>
                <p>
                  Toàn bộ 7 module API dưới đây được thiết kế chuẩn RESTful, hỗ trợ xác thực bằng mã API Bearer (Header <code>Authorization: Bearer &lt;KEY&gt;</code>) hoặc Header <code>X-Api-Key: &lt;KEY&gt;</code>, được bảo vệ theo cơ chế phân quyền hạt nhân độc lập và tự động ghi nhận kiểm toán an ninh.
                </p>
              </div>

              {/* Module 1: Dashboard Stats */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  1. Báo Cáo & Thống Kê Tổng Quan (Scope: DASHBOARD_STATS_FULL)
                </h4>
                <div className="text-xs text-muted-foreground">
                  Truy xuất realtime doanh thu bán code, dòng tiền nạp SePay, số dư ví thành viên, tổng gói/mã tồn kho và bài nộp nhiệm vụ.
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# Lấy toàn bộ số liệu thống kê thời gian thực
curl -X GET "https://codegame.shop/api/admin/dashboard/stats" \
  -H "Authorization: Bearer YOUR_API_KEY"`}
                </pre>
              </div>

              {/* Module 2: Inventory Items Manage */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-purple-400" />
                  2. Quản Lý Mã Kho Bán & Nạp Mã Theo Lô (Scope: INVENTORY_ITEMS_MANAGE)
                </h4>
                <div className="text-xs text-muted-foreground">
                  Tra cứu danh sách mã, nạp mã hàng loạt chống trùng lặp, xóa mã tồn kho chưa bán (tự động cập nhật base_stock).
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Tra cứu danh sách mã code trong kho theo gói sản phẩm
curl -X GET "https://codegame.shop/api/admin/store/products/sp_12345/codes?status=AVAILABLE&page=1&limit=50" \
  -H "X-Api-Key: YOUR_API_KEY"

# 2. Nạp hàng loạt mã code bán mới vào kho (tự động lọc trùng + cập nhật tồn kho)
curl -X POST "https://codegame.shop/api/admin/store/products/sp_12345/codes" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{
    "codes": ["CODE_A1_XYZ", "CODE_B2_ABC", "CODE_C3_123"]
  }'

# 3. Xóa danh sách mã tồn kho chưa bán
curl -X DELETE "https://codegame.shop/api/admin/store/products/sp_12345/codes" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{
    "code_ids": ["code_id_1", "code_id_2"]
  }'`}
                </pre>
              </div>

              {/* Module 3: Marketing FOMO */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-rose-400" />
                  3. Quản Trị Tiếp Thị & Sự Kiện Ảo FOMO (Scope: MARKETING_FULL)
                </h4>
                <div className="text-xs text-muted-foreground">
                  Đọc/ghi cấu hình thông báo đơn hàng ảo và kích hoạt sự kiện phát thông báo mua hàng tức thì tới người dùng.
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Đọc cấu hình tiếp thị FOMO hiện tại
curl -X GET "https://codegame.shop/api/admin/marketing/config" \
  -H "X-Api-Key: YOUR_API_KEY"

# 2. Cập nhật cấu hình thông báo FOMO
curl -X PUT "https://codegame.shop/api/admin/marketing/config" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{
    "fomo_enabled": true,
    "fomo_interval_min": 10,
    "fomo_interval_max": 30,
    "virtual_buyers_count": 88
  }'

# 3. Kích hoạt phát sự kiện mua hàng ảo tức thì lên toàn website
curl -X POST "https://codegame.shop/api/admin/marketing/trigger" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{
    "type": "PURCHASE_POPUP",
    "buyer_name": "Game Thủ VIP ***9",
    "product_name": "Gói 10.000 Kim Cương",
    "game_slug": "3q-dao-dao-dao"
  }'`}
                </pre>
              </div>

              {/* Module 4: Crawler Sources */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  4. Cấu Hình & Vận Hành Crawler Tự Động (Scope: CRAWLER_MANAGE)
                </h4>
                <div className="text-xs text-muted-foreground">
                  Quản lý danh sách URL nguồn thu thập giftcode và kích hoạt cào mã tức thì theo yêu cầu.
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Lấy danh sách các nguồn cào giftcode
curl -X GET "https://codegame.shop/api/admin/crawler/sources" \
  -H "X-Api-Key: YOUR_API_KEY"

# 2. Thêm nguồn cào mới
curl -X POST "https://codegame.shop/api/admin/crawler/sources" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{
    "name": "Nguồn Giftcode GameK VIP",
    "url": "https://gamek.vn/giftcode",
    "game_slug": "3q-dao-dao-dao",
    "active": true
  }'

# 3. Kích hoạt cào giftcode tức thì
curl -X POST "https://codegame.shop/api/admin/crawler/trigger" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{
    "game_slug": "3q-dao-dao-dao",
    "force": true
  }'`}
                </pre>
              </div>

              {/* Module 5: Notifications */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  5. Quản Trị Email & Thông Báo Broadcast (Scope: NOTIFICATIONS_FULL)
                </h4>
                <div className="text-xs text-muted-foreground">
                  Quản lý người đăng ký nhận tin, phát email hàng loạt qua Resend/Brevo và cấu hình email.
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Lấy danh sách email đăng ký nhận giftcode
curl -X GET "https://codegame.shop/api/admin/notifications/subscribers?page=1&limit=50" \
  -H "X-Api-Key: YOUR_API_KEY"

# 2. Phát email thông báo hàng loạt (Broadcast)
curl -X POST "https://codegame.shop/api/admin/notifications/broadcast" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{
    "subject": "🎁 Siêu Giftcode Mới Đã Cập Bến CodeGame.Shop!",
    "content_html": "<h2>Chào bạn,</h2><p>Bộ giftcode VIP đã có sẵn, vào nhận ngay nhé!</p>",
    "target_game_slug": "3q-dao-dao-dao"
  }'

# 3. Cập nhật cấu hình email provider
curl -X PUT "https://codegame.shop/api/admin/notifications/settings" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{
    "provider": "resend",
    "sender_name": "CodeGame.Shop",
    "sender_email": "no-reply@codegame.shop"
  }'`}
                </pre>
              </div>

              {/* Module 6: Security Logs */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  6. Tra Cứu Nhật Ký Bảo Mật & Audit Logs (Scope: SECURITY_LOGS_FULL)
                </h4>
                <div className="text-xs text-muted-foreground">
                  Tra cứu lịch sử an ninh, thao tác quản trị viên và ghi nhận log kiểm toán từ xa.
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Tra cứu nhật ký bảo mật (kèm lọc action, actor, severity)
curl -X GET "https://codegame.shop/api/admin/security-logs?severity=WARNING&limit=30" \
  -H "X-Api-Key: YOUR_API_KEY"

# 2. Ghi nhận nhật ký kiểm toán mới từ remote agent
curl -X POST "https://codegame.shop/api/admin/security-logs" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{
    "action": "REMOTE_MAINTENANCE_TRIGGER",
    "severity": "INFO",
    "details": { "module": "database_vacuum", "status": "COMPLETED" }
  }'`}
                </pre>
              </div>

              {/* Module 7: System Settings */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-500" />
                  7. Cấu Hình Hệ Thống & Bảo Trì Toàn Sàn (Scope: SYSTEM_SETTINGS_FULL)
                </h4>
                <div className="text-xs text-muted-foreground">
                  Bật/tắt chế độ bảo trì, khuyến mãi nạp tiền %, thông báo thanh banner và kênh hỗ trợ.
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto">
{`# 1. Đọc cấu hình hệ thống hiện tại
curl -X GET "https://codegame.shop/api/admin/settings" \
  -H "X-Api-Key: YOUR_API_KEY"

# 2. Bật khuyến mãi nạp tiền hoặc bật chế độ bảo trì
curl -X PUT "https://codegame.shop/api/admin/settings" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -d '{
    "deposit_bonus_percent": 10,
    "site_announcement": "🔥 Khuyến mãi nạp ví tặng 10% giá trị nạp trong tuần này!",
    "site_announcement_enabled": true
  }'`}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Set Permissions for API Key (Cài Đặt Phân Quyền Đa Năng) */}
      {permissionModalKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    Cài Đặt Phân Quyền Cho Khóa API
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                      {permissionModalKey.id}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Chọn các quyền bạn muốn cấp cho khóa "{permissionModalKey.key_name}"
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPermissionModalKey(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Key Info Banner */}
              <div className="p-3.5 rounded-xl bg-background border border-border flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Key className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-muted-foreground shrink-0 font-medium">Mã Khóa:</span>
                  <span className="font-mono font-semibold text-foreground truncate">
                    {permissionModalKey.raw_key || permissionModalKey.key_prefix}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      permissionModalKey.raw_key || permissionModalKey.key_prefix,
                      'modal_perm_copy'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs shrink-0 flex items-center gap-1"
                >
                  {copiedKeyId === 'modal_perm_copy' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500">Đã Copy</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Fast Presets Toolbar */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Chọn nhanh:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedScopes(ALL_API_SCOPES.filter((s) => s.id !== 'ADMIN_FULL').map((s) => s.id))
                    }
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 transition-all"
                  >
                    ⚡ Chọn Tất Cả
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedScopes(['NEWS_FULL', 'MISSIONS_FULL', 'MISSIONS_REVIEW'])
                    }
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-card border border-border text-muted-foreground hover:text-foreground transition-all"
                  >
                    📰 Gói Nội Dung
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedScopes(['GAMES_FULL', 'GIVEAWAYS_FULL', 'STORE_FULL', 'SYNC_FULL'])
                    }
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-card border border-border text-muted-foreground hover:text-foreground transition-all"
                  >
                    🔄 Gói Vận Hành
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedScopes(['STORE_FULL', 'FIRST_PURCHASE_MANAGE', 'ESCALATING_MANAGE'])
                    }
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-card border border-border text-rose-400 hover:text-rose-300 border-rose-500/20 transition-all"
                  >
                    🎁 Gói Ưu Đãi & Nâng Giá
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedScopes([])}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-card border border-border text-rose-400 hover:bg-rose-500/10 transition-all"
                  >
                    🧹 Bỏ Chọn Hết
                  </button>
                </div>
              </div>

              {/* Permissions Checkbox Grid */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground">
                  Danh sách quyền có thể cấp ({selectedScopes.length}/
                  {ALL_API_SCOPES.filter((s) => s.id !== 'ADMIN_FULL').length} quyền đã chọn):
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ALL_API_SCOPES.filter((s) => s.id !== 'ADMIN_FULL').map((scopeItem) => {
                    const Icon = scopeItem.icon;
                    const isChecked = selectedScopes.includes(scopeItem.id);

                    const toggleScope = () => {
                      if (isChecked) {
                        setSelectedScopes((prev) => prev.filter((id) => id !== scopeItem.id));
                      } else {
                        setSelectedScopes((prev) => [...prev, scopeItem.id]);
                      }
                    };

                    return (
                      <div
                        key={scopeItem.id}
                        onClick={toggleScope}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                          isChecked
                            ? 'bg-purple-500/10 border-purple-500/40 shadow-sm'
                            : 'bg-background/60 border-border hover:bg-muted/30'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? 'bg-purple-600 border-purple-600 text-white'
                              : 'border-muted-foreground/40 bg-card'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              {scopeItem.name}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                            {scopeItem.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Đã chọn <strong className="text-foreground">{selectedScopes.length}</strong> quyền.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPermissionModalKey(null)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-medium"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={isSavingPermissions}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md transition-all flex items-center gap-2"
                >
                  {isSavingPermissions ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang Lưu...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Lưu Cấu Hình Phân Quyền
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create API Key (Supports Single and Multi-Scope) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <KeyRound className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Tạo Khóa API & Phân Quyền</h3>
                  <p className="text-xs text-muted-foreground">Tạo khóa đơn quyền hoặc khóa đa năng tự chọn quyền</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Tên Định Danh Khóa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Khóa Đa Năng Auto Bot, Pine AI Agent..."
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  required
                />
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Loại Khóa API <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateMode('MULTI')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      createMode === 'MULTI'
                        ? 'bg-purple-500/10 border-purple-500/50 shadow-sm'
                        : 'bg-background border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        Khóa API Đa Năng
                      </span>
                      {createMode === 'MULTI' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Tự chọn tổ hợp nhiều quyền cùng lúc
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateMode('SINGLE')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      createMode === 'SINGLE'
                        ? 'bg-primary/10 border-primary shadow-sm'
                        : 'bg-background border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-indigo-400" />
                        Khóa Đơn Quyền
                      </span>
                      {createMode === 'SINGLE' && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Gán 1 quyền cố định duy nhất
                    </div>
                  </button>
                </div>
              </div>

              {/* Multi-Scope Checkboxes */}
              {createMode === 'MULTI' ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Tổ Hợp Các Quyền Cấp Cho Khóa Đa Năng:
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setNewKeyScopes(
                          newKeyScopes.length === ALL_API_SCOPES.filter((s) => s.id !== 'ADMIN_FULL').length
                            ? []
                            : ALL_API_SCOPES.filter((s) => s.id !== 'ADMIN_FULL').map((s) => s.id)
                        )
                      }
                      className="text-[11px] text-purple-400 hover:underline font-semibold"
                    >
                      {newKeyScopes.length === ALL_API_SCOPES.filter((s) => s.id !== 'ADMIN_FULL').length
                        ? 'Bỏ chọn hết'
                        : 'Chọn tất cả'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-border/60 rounded-xl bg-background/50">
                    {ALL_API_SCOPES.filter((s) => s.id !== 'ADMIN_FULL').map((s) => {
                      const isChecked = newKeyScopes.includes(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            if (isChecked) {
                              setNewKeyScopes((prev) => prev.filter((id) => id !== s.id));
                            } else {
                              setNewKeyScopes((prev) => [...prev, s.id]);
                            }
                          }}
                          className={`p-2 rounded-lg border cursor-pointer text-xs flex items-center gap-2 select-none ${
                            isChecked
                              ? 'bg-purple-500/10 border-purple-500/40 text-foreground font-semibold'
                              : 'bg-background border-border/80 text-muted-foreground'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              isChecked
                                ? 'bg-purple-600 border-purple-600 text-white'
                                : 'border-muted-foreground/40'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="truncate">{s.name.split(' (')[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Chọn Mục Quyền Áp Dụng <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                    {ALL_API_SCOPES.map((s) => {
                      const Icon = s.icon;
                      const isSelected = newKeyScope === s.id;
                      return (
                        <div
                          key={s.id}
                          onClick={() => setNewKeyScope(s.id as ApiKeyScope)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-primary/5 border-primary shadow-sm text-foreground'
                              : 'bg-background/60 border-border hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                            <div className="flex-1">
                              <div className="text-xs font-bold flex items-center justify-between">
                                <span>{s.name}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                {s.description}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Time-based Permission (Thời Hạn Hiệu Lực) */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                  <Hourglass className="w-3.5 h-3.5 text-purple-400" />
                  Thời Hạn Hiệu Lực Của Khóa
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-2">
                  {[
                    { id: '30', label: '30 Ngày' },
                    { id: '90', label: '90 Ngày' },
                    { id: '365', label: '1 Năm' },
                    { id: 'permanent', label: 'Vĩnh Viễn' },
                    { id: 'custom', label: 'Tự Chọn' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setValidityType(opt.id as any)}
                      className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition-all ${
                        validityType === opt.id
                          ? 'bg-foreground text-background font-bold border-foreground shadow-sm'
                          : 'bg-background border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {validityType === 'custom' && (
                  <div className="mt-2">
                    <input
                      type="datetime-local"
                      value={customExpiresAt}
                      onChange={(e) => setCustomExpiresAt(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Khóa sẽ tự động ngắt quyền truy cập đúng vào thời điểm trên.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Mô Tả / Ghi Chú Sử Dụng (Không bắt buộc)
                </label>
                <textarea
                  placeholder="Ghi rõ ai đang sử dụng hoặc mục đích tích hợp của khóa này..."
                  value={newKeyDescription}
                  onChange={(e) => setNewKeyDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-xs sm:text-sm font-medium transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang Khởi Tạo...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Xác Nhận Tạo Khóa
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Extend / Modify Expiration (Gia Hạn Khóa) */}
      {extendingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Hourglass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Gia Hạn Hiệu Lực Khóa API</h3>
                  <p className="text-xs text-muted-foreground">Phân quyền theo thời gian cho "{extendingKey.key_name}"</p>
                </div>
              </div>
              <button
                onClick={() => setExtendingKey(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs space-y-1">
                <div className="text-muted-foreground">Thời hạn hiện tại:</div>
                <div className="font-semibold text-foreground">
                  {extendingKey.expires_at
                    ? new Date(extendingKey.expires_at).toLocaleString('vi-VN')
                    : 'Vĩnh viễn (Không thời hạn)'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  Chọn thời gian gia hạn thêm:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { days: 7, label: '+7 Ngày' },
                    { days: 30, label: '+30 Ngày (Khuyên dùng)' },
                    { days: 90, label: '+90 Ngày' },
                    { days: 0, label: 'Đặt Vĩnh Viễn' },
                  ].map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setExtendDaysOption(opt.days)}
                      className={`p-3 rounded-xl text-xs font-medium border text-center transition-all ${
                        extendDaysOption === opt.days
                          ? 'bg-primary text-primary-foreground font-bold border-primary shadow-sm'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setExtendingKey(null)}
                  className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-xs font-medium"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={handleExtendKey}
                  disabled={isExtending}
                  className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium text-xs shadow-md transition-all flex items-center gap-2"
                >
                  {isExtending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang Xử Lý...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Lưu & Gia Hạn Ngay
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reveal Newly Generated Raw Key */}
      {generatedKeyResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-card rounded-2xl border-2 border-emerald-500/50 shadow-2xl overflow-hidden">
            <div className="p-6 bg-gradient-to-br from-emerald-500/10 via-card to-card space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-500">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Khởi Tạo Khóa API Thành Công!</h3>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>
                      Khóa: <strong>{generatedKeyResult.key_name}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2.5 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                <span>
                  Khóa API đã sẵn sàng! Bạn có thể <strong>Sao chép nhanh</strong> ngay bên dưới. Khóa này cũng được lưu trực tiếp vào danh sách Quản lý để bạn có thể xem lại hoặc sao chép bất cứ lúc nào.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Khóa API Hoàn Chỉnh:
                </label>
                <div className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-border">
                  <code className="text-emerald-400 font-mono text-xs sm:text-sm select-all break-all flex-1">
                    {generatedKeyResult.raw_key}
                  </code>
                  <button
                    onClick={() => handleCopy(generatedKeyResult.raw_key, 'newly_generated')}
                    className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 shadow-sm"
                  >
                    {copiedKeyId === 'newly_generated' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Đã Copy!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Sao Chép
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setGeneratedKeyResult(null)}
                  className="px-5 py-2.5 rounded-xl bg-foreground text-background font-semibold text-xs sm:text-sm hover:opacity-90 transition-opacity"
                >
                  Hoàn Tất & Xem Danh Sách
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
