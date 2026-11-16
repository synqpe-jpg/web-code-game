import React, { useState } from 'react';
import {
  Rocket,
  ShieldCheck,
  Zap,
  Globe,
  CreditCard,
  Package,
  Layers,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Phone,
  MessageCircle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Server,
  Palette,
  Check,
  Star,
  Clock,
  ArrowLeft,
  ShoppingBag,
  Cpu,
  Heart,
  Gamepad2,
  BookOpen,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import type { TenantLeadRecord } from '../../types/game';
import { LanguageSelector } from '../LanguageSelector';
import { useLanguage } from '../../context/LanguageContext';

interface PlatformSolutionsViewProps {
  onNavigateBack?: () => void;
  onOpenStoreDemo?: (industry?: string) => void;
}

export const PlatformSolutionsView: React.FC<PlatformSolutionsViewProps> = ({
  onNavigateBack,
  onOpenStoreDemo,
}) => {
  const { language, t } = useLanguage();
  const isEn = language === 'en';

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [shopName, setShopName] = useState('');
  const [industry, setIndustry] = useState<string>('gaming');
  const [planType, setPlanType] = useState<string>('rental_business');
  const [expectedDomain, setExpectedDomain] = useState('');
  const [budgetRange, setBudgetRange] = useState('Dưới 10 triệu');
  const [note, setNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedLead, setSubmittedLead] = useState<TenantLeadRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active industry demo tab
  const [activeIndustryDemo, setActiveIndustryDemo] = useState<string>('gaming');

  // Open FAQ Accordion
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !shopName.trim()) {
      setErrorMessage('Vui lòng điền đủ Họ tên, Số điện thoại và Tên shop dự kiến.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await dataService.submitTenantLead({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        shop_name: shopName.trim(),
        industry,
        plan_type: planType,
        expected_domain: expectedDomain.trim() || undefined,
        budget_range: budgetRange,
        note: note.trim() || undefined,
      });

      if (res.success && res.lead) {
        setSubmittedLead(res.lead);
        // Reset form
        setFullName('');
        setPhone('');
        setEmail('');
        setShopName('');
        setExpectedDomain('');
        setNote('');
      } else {
        setErrorMessage(res.message || 'Không thể gửi đăng ký, vui lòng thử lại.');
      }
    } catch (err: any) {
      setErrorMessage('Lỗi gửi hồ sơ: ' + (err?.message || 'Không xác định'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const industriesList = [
    {
      id: 'gaming',
      title: 'Gaming & Phần Mềm',
      icon: Gamepad2,
      color: 'from-cyan-500 to-blue-600',
      tag: 'Phát Code 0s Tự Động',
      desc: 'Bán giftcode game, tài khoản VIP, thẻ nạp, bản quyền key phần mềm. Hệ thống tự động trích xuất mã và giao tức thì 0 giây sau khi quét VietQR.',
    },
    {
      id: 'fashion',
      title: 'Thời Trang & Phụ Kiện',
      icon: ShoppingBag,
      color: 'from-amber-500 to-orange-600',
      tag: 'Đầy Đủ Size & Màu Sắc',
      desc: 'Quần áo streetwear, sneaker, túi xách. Quản lý phân loại biến thể kích cỡ (S/M/L/XL), màu sắc, tự động tính phí vận chuyển và xuất đơn GHTK / GHN.',
    },
    {
      id: 'beauty',
      title: 'Mỹ Phẩm & Skincare',
      icon: Heart,
      color: 'from-rose-500 to-pink-600',
      tag: 'Chuẩn Thương Hiệu Đẳng Cấp',
      desc: 'Serum, son môi, kem dưỡng da, nước hoa. Thiết kế tông màu tinh tế, hình ảnh chuẩn HD, thông số chi tiết dung tích và xuất xứ chính hãng.',
    },
    {
      id: 'tech',
      title: 'Công Nghệ & Điện Tử',
      icon: Cpu,
      color: 'from-indigo-500 to-purple-600',
      tag: 'Bảo Hành & Serial Số',
      desc: 'Tai nghe gaming, chuột không dây, cáp sạc, linh kiện. Quản lý thông số kỹ thuật đa dạng, số serial bảo hành và tình trạng tồn kho chuẩn xác.',
    },
    {
      id: 'services',
      title: 'Dịch Vụ Số & Khóa Học',
      icon: BookOpen,
      color: 'from-emerald-500 to-teal-600',
      tag: 'Kích Hoạt Tài Khoản 0s',
      desc: 'Khóa học online, tài khoản AI/Canva/Netflix, dịch vụ thiết kế, tư vấn. Tự động gửi link kích hoạt và tài liệu ngay khi thanh toán thành công.',
    },
  ];

  const pricingPlans = [
    {
      id: 'rental_starter',
      name: 'Thuê Khởi Nghiệp',
      tagline: 'Phù hợp cá nhân & shop mới bắt đầu bán hàng',
      price: '390.000',
      period: 'VNĐ / tháng',
      badge: 'TIẾT KIỆM',
      badgeColor: 'bg-neutral-800 text-neutral-300 border border-neutral-700',
      features: [
        'Triển khai hoàn tất trong 2 phút',
        'Miễn phí Hosting Cloudflare Pages & D1 (0đ server)',
        'Cổng VietQR / SePay tự động 0s - Tiền về tài khoản riêng',
        'Bán song song Sản phẩm số & Hàng vật lý',
        'Quản lý tối đa 500 sản phẩm & 2.000 đơn hàng/tháng',
        'White-label đổi tên shop, logo, slogan trong 30s',
        'Giao diện Quản trị chuẩn Single-Screen (Rule 9)',
        'Hỗ trợ kỹ thuật qua Zalo 24/7',
      ],
      ctaText: 'Đăng Ký Gói Khởi Nghiệp',
      isPopular: false,
    },
    {
      id: 'rental_business',
      name: 'Thuê Chuyên Nghiệp',
      tagline: 'Lựa chọn số 1 cho shop kinh doanh đa ngành tăng trưởng nhanh',
      price: '790.000',
      period: 'VNĐ / tháng',
      badge: '🔥 BÁN CHẠY NHẤT',
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
      features: [
        'Toàn bộ quyền lợi gói Khởi Nghiệp',
        'KHÔNG GIỚI HẠN sản phẩm, danh mục và đơn hàng',
        'Hỗ trợ gắn Tên Miền Riêng (.vn / .com / .shop) miễn phí',
        '5 Bộ màu sắc giao diện theo ngành hàng chuẩn SEO',
        'Hệ thống quản lý biến thể Size / Màu sắc / Thuộc tính',
        'Quản lý vận chuyển & Mã vận đơn (GHTK, GHN, Viettel Post)',
        'Tích hợp thông báo Email & Telegram Bot tự động',
        'Đội ngũ kỹ sư hỗ trợ ưu tiên 1-1 riêng biệt',
      ],
      ctaText: 'Đăng Ký Gói Chuyên Nghiệp',
      isPopular: true,
    },
    {
      id: 'buyout_full',
      name: 'Sở Hữu Trọn Đời',
      tagline: 'Mua đứt toàn bộ mã nguồn - Độc quyền sở hữu 100%',
      price: '15.000.000',
      period: 'VNĐ / Trọn Gói 1 Lần',
      badge: '💎 TOÀN QUYỀN SỞ HỮU',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
      features: [
        'Bàn giao 100% Full Source Code (React 19, Vite, Tailwind, Edge Worker, D1 DB)',
        'Không phải trả bất kỳ phí thuê định kỳ hàng tháng',
        'Hỗ trợ cài đặt hoàn chỉnh lên tài khoản Cloudflare riêng của bạn',
        'Tự do tùy biến, phát triển tính năng và mở rộng không giới hạn',
        'Tự do mở sàn cho người khác thuê lại (Mô hình SaaS đa khách hàng)',
        'Bảo hành kỹ thuật & sửa lỗi 12 tháng liên tục',
        'Tài liệu hướng dẫn triển khai và quản trị chi tiết từ A-Z',
      ],
      ctaText: 'Mua Đứt Mã Nguồn Ngay',
      isPopular: false,
    },
  ];

  const faqs = [
    {
      q: 'Tôi không biết lập trình, tôi có thể tự quản lý và bán hàng được không?',
      a: 'Hoàn toàn được! Nền tảng được thiết kế với giao diện quản trị 100% trực quan bằng tiếng Việt. Bạn chỉ cần vào Quản trị để thêm sản phẩm, tải ảnh, cài giá tiền và dán số tài khoản ngân hàng nhận tiền. Mọi quy trình thanh toán QR, xuất mã code hoặc lưu thông tin giao hàng đều diễn ra tự động 100%.',
    },
    {
      q: 'Tiền khách mua hàng sẽ chuyển về đâu? Có bị giam vốn hay mất phí chiết khấu không?',
      a: 'Tiền quét mã VietQR sẽ chạy THẲNG VÀO TÀI KHOẢN NGÂN HÀNG CÁ NHÂN HOẶC DOANH NGHIỆP CỦA BẠN ngay lập tức trong 1 giây. Nền tảng không giữ tiền trung gian, không giam vốn và không thu bất kỳ % chiết khấu nào trên doanh thu bán hàng của bạn!',
    },
    {
      q: 'Chi phí vận hành máy chủ (Server Hosting) mỗi tháng là bao nhiêu?',
      a: 'Chính xác là 0 VNĐ/tháng! Hệ thống được tối ưu hóa chạy trực tiếp trên mạng lưới Cloudflare Pages & Workers toàn cầu kết hợp cơ sở dữ liệu Cloudflare D1. Hạn mức miễn phí của Cloudflare lên tới 100.000 lượt truy cập mỗi ngày, giúp bạn tiết kiệm hàng chục triệu tiền thuê VPS hay máy chủ riêng.',
    },
    {
      q: 'Nếu tôi đang thuê theo tháng, sau này tôi có thể nâng cấp lên Mua Đứt Mã Nguồn không?',
      a: 'Hoàn toàn được! Toàn bộ số tiền bạn đã thanh toán thuê sàn trong vòng 3 tháng gần nhất sẽ được trừ thẳng vào chi phí gói Mua Đứt Mã Nguồn (15.000.000đ). Toàn bộ dữ liệu sản phẩm, đơn hàng và khách hàng của bạn sẽ được chuyển giao nguyên vẹn.',
    },
    {
      q: 'Thời gian bàn giao website là bao lâu sau khi tôi đăng ký?',
      a: 'Với gói Thuê Sàn: Chỉ mất đúng 2 phút! Kỹ thuật viên sẽ cấp ngay tài khoản quản trị và link sàn riêng cho bạn. Với gói Mua Đứt: Bàn giao toàn bộ mã nguồn Git Repository và hỗ trợ cài đặt lên tài khoản Cloudflare của bạn trong vòng 2-4 giờ làm việc.',
    },
    {
      q: 'Website có hỗ trợ bán cả hàng vật lý giao tận nhà và hàng số không?',
      a: 'Có, đây chính là ưu điểm độc bản của nền tảng! Bạn có thể bán song song hàng số (kho thẻ game, acc, bản quyền phần mềm giao tức thì 0s) và hàng vật lý (quần áo, mỹ phẩm, đồ điện tử) với đầy đủ form thu thập Họ tên, SĐT, Địa chỉ nhận hàng toàn quốc và mã vận đơn theo dõi.',
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 selection:bg-amber-500 selection:text-neutral-950">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onNavigateBack && (
              <button
                onClick={onNavigateBack}
                className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
                title="Quay lại trang mua hàng"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Quay Lại Sàn</span>
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-neutral-950 font-black shadow-lg shadow-amber-500/20">
                <Rocket className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                  E-COMMERCE SaaS <span className="text-amber-400">PRO</span>
                </span>
                <span className="text-[10px] block text-neutral-400 uppercase tracking-wider font-semibold">
                  Giải Pháp Bán & Thuê Sàn Đa Ngành
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSelector variant="compact" />
            <a
              href="https://zalo.me/0988123456"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-neutral-800 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">{isEn ? 'Support Zalo' : 'Chat Zalo 24/7'}</span>
            </a>
            <a
              href="#pricing-section"
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all transform active:scale-95"
            >
              <span>{isEn ? 'Pricing Plans' : 'Xem Báo Giá'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 border-b border-neutral-900">
        {/* Glow ambient background effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-amber-500/10 via-orange-500/10 to-cyan-500/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-6 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.solutions?.badge || (isEn ? '#1 MULTI-INDUSTRY E-COMMERCE PLATFORM' : 'NỀN TẢNG TMĐT ĐA NGÀNH SỐ 1 VIỆT NAM')}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight sm:leading-tight mb-6">
            {t.solutions?.heroTitle || (isEn ? 'Own Your Multi-Industry E-Commerce Platform' : 'Sở Hữu Sàn TMĐT Đa Ngành Riêng')}
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
              {t.solutions?.heroSubtitle || (isEn ? '0 VND Server Cost • Launch in 2 Minutes' : 'Vận Hành 0đ Server • Khởi Chạy 2 Phút')}
            </span>
          </h1>

          <p className="text-neutral-300 text-sm sm:text-lg max-w-3xl mx-auto mb-8 font-normal leading-relaxed">
            {t.solutions?.heroDesc || (isEn
              ? 'The complete solution turning any business idea into a high-converting storefront: sell digital products with 0s delivery & physical goods with courier tracking. Built-in VietQR auto-verification directly to your personal bank account!'
              : 'Giải pháp hoàn chỉnh biến mọi ý tưởng kinh doanh thành sàn thương mại điện tử chuyên nghiệp: Bán song song Sản phẩm số giao 0s (giftcode, tài khoản, khóa học) & Hàng vật lý (thời trang, mỹ phẩm, công nghệ). Tích hợp sẵn VietQR tự động tiền về thẳng tài khoản, không giam vốn!')}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-12">
            <a
              href="#lead-form-section"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-sm flex items-center gap-2 shadow-xl shadow-amber-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Rocket className="w-4 h-4" />
              <span>{t.solutions?.ctaRegister || (isEn ? 'Rent / Buy Platform Now' : 'Đăng Ký Thuê / Mua Sàn Ngay')}</span>
            </a>

            <button
              onClick={() => {
                if (onOpenStoreDemo) {
                  onOpenStoreDemo(activeIndustryDemo);
                } else {
                  window.location.hash = '#shopee-test';
                }
              }}
              className="px-6 py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-100 font-bold text-sm flex items-center gap-2 border border-neutral-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-cyan-400" />
              <span>{t.solutions?.ctaDemo || (isEn ? 'Explore Live Platform Demo' : 'Trải Nghiệm Live Demo Sàn')}</span>
            </button>
          </div>

          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-black text-amber-400 mb-1">
                {t.solutions?.statDeployTime || (isEn ? '2 Minutes' : '2 Phút')}
              </div>
              <div className="text-xs text-neutral-400 font-medium">
                {t.solutions?.statDeployDesc || (isEn ? 'Ready to launch instantly' : 'Bàn giao shop dùng ngay')}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 mb-1">
                {t.solutions?.statHostingCost || (isEn ? '0 VND / Mo' : '0đ / Tháng')}
              </div>
              <div className="text-xs text-neutral-400 font-medium">
                {t.solutions?.statHostingDesc || (isEn ? 'Cloudflare Edge serverless cost' : 'Phí duy trì máy chủ Cloudflare')}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-black text-cyan-400 mb-1">
                {t.solutions?.statSpeed || '< 100ms'}
              </div>
              <div className="text-xs text-neutral-400 font-medium">
                {t.solutions?.statSpeedDesc || (isEn ? 'Global Edge response latency' : 'Tốc độ tải trang Edge toàn cầu')}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-black text-rose-400 mb-1">
                {t.solutions?.statPayment || 'VietQR 0s'}
              </div>
              <div className="text-xs text-neutral-400 font-medium">
                {t.solutions?.statPaymentDesc || (isEn ? 'Direct bank settlement, zero escrow' : 'Tiền thẳng vào tài khoản của bạn')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6 Core Pillars Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">
            6 Trụ Cột Công Nghệ Độc Bản Của Nền Tảng
          </h2>
          <p className="text-neutral-400 text-sm sm:text-base">
            Không cần thuê lập trình viên, không tốn hàng trăm triệu mua phần mềm. Mọi tính năng tinh vi nhất của các sàn TMĐT lớn đã sẵn sàng phục vụ bạn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Pillar 1 */}
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">1. Siêu Tốc Độ Cloudflare Edge &lt;100ms</h3>
            <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
              Hệ thống vận hành trên mạng lưới 300+ PoPs toàn cầu của Cloudflare. Tải trang tức thì, tự động nén ảnh WebP/AVIF và miễn nhiễm 100% trước các đợt quá tải truy cập.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-emerald-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">2. VietQR Tự Động 0s • Tiền Về Thẳng Ví</h3>
            <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
              Tích hợp VietQR / SePay quét mã thanh toán tự động xác thực trong 1 giây. Tiền về thẳng tài khoản ngân hàng cá nhân của bạn, 0% chiết khấu sàn, không giam vốn 1 giây nào.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-cyan-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">3. Bán Đa Ngành • Hàng Số & Hàng Vật Lý</h3>
            <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
              Vừa bán tự động kho mã thẻ, giftcode, tài khoản (0s), vừa quản lý đơn hàng vật lý (Thời trang, Mỹ phẩm, Phụ kiện) với đầy đủ SĐT, Địa chỉ giao hàng và mã vận đơn theo dõi.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-rose-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Palette className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">4. White-Label Đổi Thương Hiệu Trong 30s</h3>
            <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
              Tùy biến toàn diện Tên sàn, Slogan, Logo, Tiền tệ (VNĐ, Core, USD) và 5 bộ màu sắc chủ đạo theo ngành hàng chỉ bằng 1 cú nhấp chuột trong Admin, không cần chạm vào code.
            </p>
          </div>

          {/* Pillar 5 */}
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-indigo-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">5. Quản Trị Chuẩn Single-Screen First</h3>
            <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
              100% giao diện quản lý nằm trọn vẹn trong 1 màn hình máy tính laptop tiêu chuẩn. Không bao giờ tràn ngang (Rule 9), bảng điều khiển tối ưu hóa thao tác siêu nhanh cho chủ shop.
            </p>
          </div>

          {/* Pillar 6 */}
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-purple-500/40 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">6. CSDL Cloudflare D1 Phân Tán An Toàn</h3>
            <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
              Dữ liệu được lưu trữ trên cơ sở dữ liệu SQL phân tán của Cloudflare, tự động sao lưu, mã hóa và bảo mật chống rò rỉ thông tin khách hàng tuyệt đối theo tiêu chuẩn quốc tế.
            </p>
          </div>
        </div>
      </section>

      {/* 5 Industry Demos Section */}
      <section className="py-16 bg-neutral-900/30 border-y border-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              Bộ Giao Diện Sẵn Sàng Cho 5 Ngành Hàng Hot Nhất
            </h2>
            <p className="text-neutral-400 text-sm">
              Chọn ngay ngành hàng của bạn để xem trước cách hệ thống tự động tối ưu danh mục, tiền tệ và cấu trúc sản phẩm.
            </p>
          </div>

          {/* Tab buttons */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar">
            {industriesList.map((ind) => {
              const IconComp = ind.icon;
              const isActive = activeIndustryDemo === ind.id;
              return (
                <button
                  key={ind.id}
                  onClick={() => setActiveIndustryDemo(ind.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap border ${
                    isActive
                      ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-lg shadow-amber-500/20 scale-105'
                      : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:text-white'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  <span>{ind.title}</span>
                </button>
              );
            })}
          </div>

          {/* Active Industry Showcase Card */}
          {(() => {
            const currentInd = industriesList.find((i) => i.id === activeIndustryDemo) || industriesList[0];
            return (
              <div className="max-w-4xl mx-auto p-6 sm:p-8 rounded-3xl bg-neutral-900/80 border border-neutral-800 shadow-2xl relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl ${currentInd.color} opacity-10 rounded-full blur-3xl pointer-events-none`} />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {currentInd.tag}
                    </span>
                    <h3 className="text-2xl font-black text-white mt-2">{currentInd.title}</h3>
                  </div>

                  <button
                    onClick={() => {
                      if (onOpenStoreDemo) {
                        onOpenStoreDemo(currentInd.id);
                      } else {
                        window.location.hash = '#shopee-test';
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 transition-transform active:scale-95"
                  >
                    <span>Mở Ngay Demo Sàn Này</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-neutral-300 text-sm leading-relaxed mb-6 font-normal">
                  {currentInd.desc}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-xs text-neutral-200 font-medium">Danh mục cấu hình sẵn</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-xs text-neutral-200 font-medium">Bảng giá & Thuộc tính chuẩn</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-xs text-neutral-200 font-medium">Cổng VietQR 0s đồng bộ</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Transparent Pricing Section */}
      <section id="pricing-section" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>BẢNG GIÁ MINH BẠCH • CAM KẾT KHÔNG PHÍ ẨN</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white mb-4">
            Lựa Chọn Gói Dịch Vụ Phù Hợp Với Bạn
          </h2>
          <p className="text-neutral-400 text-sm sm:text-base">
            Thuê sàn SaaS vận hành ngay hoặc Mua đứt trọn gói mã nguồn để làm chủ 100% tài sản số của bạn.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {pricingPlans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-3xl p-8 flex flex-col justify-between transition-all relative ${
                plan.isPopular
                  ? 'bg-neutral-900 border-2 border-amber-500 shadow-2xl shadow-amber-500/10 lg:-translate-y-2'
                  : 'bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${plan.badgeColor}`}>
                    {plan.badge}
                  </span>
                </div>

                <h3 className="text-2xl font-black text-white mb-1">{plan.name}</h3>
                <p className="text-xs text-neutral-400 mb-6 h-8">{plan.tagline}</p>

                <div className="mb-6 pb-6 border-b border-neutral-800">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tight">
                      {plan.price}
                    </span>
                    <span className="text-xs text-neutral-400 font-semibold">{plan.period}</span>
                  </div>
                </div>

                <div className="space-y-3.5 mb-8">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-neutral-300">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <a
                href="#lead-form-section"
                onClick={() => setPlanType(plan.id)}
                className={`w-full py-3.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                  plan.isPopular
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 shadow-lg shadow-amber-500/20'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                }`}
              >
                <span>{plan.ctaText}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Tenant Lead Registration Form */}
      <section id="lead-form-section" className="py-16 bg-neutral-900/40 border-t border-neutral-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="p-8 sm:p-10 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl relative">
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3">
                <Rocket className="w-6 h-6" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
                Đăng Ký Tư Vấn & Nhận Sàn Dùng Thử
              </h2>
              <p className="text-neutral-400 text-xs sm:text-sm">
                Điền thông tin bên dưới, kỹ thuật viên sẽ liên hệ lại qua Zalo/SĐT trong vòng 15 phút để cấu hình và bàn giao web cho bạn.
              </p>
            </div>

            {submittedLead ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Đăng Ký Tư Vấn Thành Công!</h3>
                <p className="text-xs text-neutral-300 mb-3 leading-relaxed">
                  Cảm ơn bạn <strong className="text-white">{submittedLead.full_name}</strong> đã quan tâm đến giải pháp sàn <strong className="text-amber-400">{submittedLead.shop_name}</strong>.
                </p>
                <div className="inline-block px-3 py-1.5 rounded-lg bg-neutral-950 text-emerald-400 font-mono text-xs font-bold mb-4">
                  Mã Hồ Sơ: {submittedLead.id}
                </div>
                <p className="text-xs text-neutral-400 mb-6">
                  Chuyên viên hỗ trợ sẽ gọi điện hoặc nhắn tin Zalo tới số <strong className="text-white">{submittedLead.phone}</strong> trong ít phút.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setSubmittedLead(null)}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold"
                  >
                    Gửi Đăng Ký Khác
                  </button>
                  <a
                    href="https://zalo.me/0988123456"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Nhắn Zalo Trực Tiếp</span>
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                    {errorMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Họ Và Tên Của Bạn <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ví dụ: Nguyễn Văn Minh"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Số Điện Thoại / Zalo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ví dụ: 0988123456"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Tên Shop / Thương Hiệu Dự Kiến <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="Ví dụ: Vintage Store, CyberGear..."
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Email Liên Hệ (Nếu có)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Ngành Hàng Bạn Muốn Kinh Doanh
                    </label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white text-xs outline-none"
                    >
                      <option value="gaming">Gaming & Thẻ Code (Phát 0s)</option>
                      <option value="fashion">Thời Trang & Streetwear (Size/Màu)</option>
                      <option value="beauty">Mỹ Phẩm & Chăm Sóc Da</option>
                      <option value="tech">Công Nghệ & Phụ Kiện Điện Tử</option>
                      <option value="services">Dịch Vụ Số & Khóa Học Online</option>
                      <option value="other">Ngành Hàng Khác</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Gói Dịch Vụ Bạn Quan Tâm
                    </label>
                    <select
                      value={planType}
                      onChange={(e) => setPlanType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white text-xs outline-none"
                    >
                      <option value="rental_starter">Thuê Khởi Nghiệp (390.000đ/tháng)</option>
                      <option value="rental_business">Thuê Chuyên Nghiệp (790.000đ/tháng - Khuyên Dùng)</option>
                      <option value="buyout_full">Mua Đứt Trọn Gói Mã Nguồn (15.000.000đ 1 Lần)</option>
                      <option value="enterprise_custom">Yêu Cầu Tùy Biến Riêng (Enterprise)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Tên Miền Dự Kiến (Nếu có)
                    </label>
                    <input
                      type="text"
                      value={expectedDomain}
                      onChange={(e) => setExpectedDomain(e.target.value)}
                      placeholder="Ví dụ: tenshop.vn hoặc tenshop.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                      Ngân Sách Dự Kiến Đầu Tư
                    </label>
                    <select
                      value={budgetRange}
                      onChange={(e) => setBudgetRange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white text-xs outline-none"
                    >
                      <option value="Dưới 5 triệu">Dưới 5 triệu VNĐ</option>
                      <option value="Dưới 10 triệu">5 - 10 triệu VNĐ</option>
                      <option value="15 - 25 triệu">15 - 25 triệu VNĐ (Mua đứt source code)</option>
                      <option value="Trên 25 triệu">Trên 25 triệu VNĐ (Mở hệ thống sàn lớn)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    Ghi Chú Yêu Cầu Riêng (Nếu có)
                  </label>
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Mô tả thêm về sản phẩm hoặc mong muốn tính năng của bạn..."
                    className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white text-xs outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:opacity-95 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Đang gửi hồ sơ đăng ký...</span>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" />
                      <span>Gửi Đăng Ký Tư Vấn & Nhận Sàn Dùng Thử Ngay</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-3">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>GIẢI ĐÁP THẮC MẮC</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Câu Hỏi Thường Gặp Của Chủ Shop
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div
                key={index}
                className="rounded-2xl bg-neutral-900/60 border border-neutral-800 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-neutral-100 hover:text-amber-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronRight
                    className={`w-4 h-4 text-neutral-400 transition-transform ${
                      isOpen ? 'rotate-90 text-amber-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-neutral-300 leading-relaxed border-t border-neutral-800/60 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-10 text-center text-xs text-neutral-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-neutral-200">E-Commerce SaaS Solution Platform</span>
            <span>• Cloudflare Edge Native</span>
          </div>
          <div className="flex items-center gap-4 text-neutral-400">
            <span>Hotline Kỹ Thuật: 0988.123.456</span>
            <span>•</span>
            <span>Email: contact@codegame.shop</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
