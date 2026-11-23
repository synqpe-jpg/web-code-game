import React, { useState, useEffect } from 'react';
import {
  Globe,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Plus,
  Trash2,
  ExternalLink,
  Mail,
  Send,
  Eye,
  Search,
  Layers,
  Smartphone,
  RefreshCw,
} from 'lucide-react';
import { adminDataService } from '../services/adminDataService';
import {
  BrandingConfig,
  DEFAULT_BRANDING_CONFIG,
  setLocalBranding,
  formatCopyright,
} from '../../services/brandingService';
import { useLanguage } from '../../context/LanguageContext';

interface BrandingModuleProps {
  onShowToast: (title: string, message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const BrandingModule: React.FC<BrandingModuleProps> = ({ onShowToast }) => {
  const { t, language } = useLanguage();
  const tb = t.admin?.branding || {} as any;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<BrandingConfig>(DEFAULT_BRANDING_CONFIG);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'general' | 'seo_pwa' | 'faq' | 'bulk_replace'>('general');

  // Bulk replace modal/form state
  const [bulkOldDomain, setBulkOldDomain] = useState('codegame.shop');
  const [bulkNewDomain, setBulkNewDomain] = useState('');
  const [bulkOldBrand, setBulkOldBrand] = useState('CodeGame.Shop');
  const [bulkNewBrand, setBulkNewBrand] = useState('');
  const [bulkReplacing, setBulkReplacing] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await adminDataService.getBrandingConfig();
      setConfig(data);
      const cleanBase = data.baseUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      setBulkNewDomain(cleanBase);
      setBulkNewBrand(data.brandDisplay);
    } catch {
      onShowToast('Lỗi', 'Không thể nạp cấu hình thương hiệu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!config.brandName || !config.brandName.trim()) {
      errs.brandName = tb.brandName ? `${tb.brandName} không được để trống.` : 'Tên thương hiệu không được để trống.';
    }

    if (!config.brandDisplay || !config.brandDisplay.trim()) {
      errs.brandDisplay = tb.brandDisplay ? `${tb.brandDisplay} không được để trống.` : 'Tên hiển thị không được để trống.';
    }

    const rawUrl = (config.baseUrl || '').trim();
    if (!rawUrl) {
      errs.baseUrl = tb.baseUrl ? `${tb.baseUrl} không được để trống.` : 'URL gốc không được để trống.';
    } else {
      try {
        const u = new URL(rawUrl);
        if (u.protocol !== 'https:' && !u.hostname.includes('localhost') && !u.hostname.includes('127.0.0.1')) {
          errs.baseUrl = 'URL gốc phải sử dụng giao thức HTTPS (https://...).';
        }
      } catch {
        errs.baseUrl = 'URL gốc không đúng định dạng URL hợp lệ.';
      }
    }

    const rawEmail = (config.emailFromAddress || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!rawEmail || !emailRegex.test(rawEmail)) {
      errs.emailFromAddress = 'Địa chỉ email người gửi không đúng định dạng hợp lệ.';
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      onShowToast(
        tb.validationErrors || 'Lỗi kiểm tra',
        'Vui lòng sửa các trường thông tin không hợp lệ trước khi lưu.',
        'error'
      );
      return;
    }

    setSaving(true);
    try {
      const res = await adminDataService.updateBrandingConfig(config);
      if (res.success && res.branding) {
        setConfig(res.branding);
        setLocalBranding(res.branding);
        onShowToast(
          'Thành công',
          tb.saveSuccess || 'Cập nhật cấu hình thương hiệu và tên miền thành công!',
          'success'
        );
      } else {
        if (res.errors) {
          setValidationErrors(res.errors);
        }
        onShowToast('Lỗi lưu cấu hình', res.message || 'Không thể lưu cấu hình', 'error');
      }
    } catch (e: any) {
      onShowToast('Lỗi hệ thống', e?.message || 'Lỗi kết nối máy chủ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm('Khôi phục toàn bộ cài đặt thương hiệu về mặc định CodeGame.Shop?')) {
      setConfig(DEFAULT_BRANDING_CONFIG);
      setValidationErrors({});
    }
  };

  const handleAddFaq = () => {
    setConfig((prev) => ({
      ...prev,
      faqList: [...prev.faqList, { q: '', a: '' }],
    }));
  };

  const handleRemoveFaq = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      faqList: prev.faqList.filter((_, i) => i !== index),
    }));
  };

  const handleFaqChange = (index: number, field: 'q' | 'a', value: string) => {
    setConfig((prev) => {
      const nextList = [...prev.faqList];
      nextList[index] = { ...nextList[index], [field]: value };
      return { ...prev, faqList: nextList };
    });
  };

  const handleRunBulkReplace = async () => {
    if (!bulkOldDomain && !bulkOldBrand) {
      onShowToast('Thiếu thông tin', 'Vui lòng nhập tên miền cũ hoặc tên thương hiệu cũ cần thay thế.', 'warning');
      return;
    }

    const confirmMsg = tb.bulkReplaceConfirm || 'Bạn có chắc chắn muốn thay thế hàng loạt tên và tên miền cũ trong toàn bộ dữ liệu?';
    if (!window.confirm(confirmMsg)) return;

    setBulkReplacing(true);
    setBulkResult(null);
    try {
      const res = await adminDataService.bulkReplaceBranding({
        oldDomain: bulkOldDomain,
        newDomain: bulkNewDomain,
        oldBrand: bulkOldBrand,
        newBrand: bulkNewBrand,
      });

      if (res.success) {
        setBulkResult(res.affected);
        onShowToast('Hoàn tất', tb.bulkReplaceSuccess || 'Thay thế hàng loạt thành công!', 'success');
      } else {
        onShowToast('Lỗi', res.message || 'Thay thế thất bại', 'error');
      }
    } catch (e: any) {
      onShowToast('Lỗi hệ thống', e?.message || 'Lỗi khi gọi API thay thế', 'error');
    } finally {
      setBulkReplacing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin mr-2" />
        Đang tải cấu hình thương hiệu & tên miền...
      </div>
    );
  }

  const effectiveBrandDisplay = config.brandDisplay || 'CodeGame.Shop';
  const effectiveBaseUrl = config.baseUrl || 'https://codegame.shop';
  const effectiveDomain = effectiveBaseUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const previewCopyright = formatCopyright(config.footerCopyright, effectiveBrandDisplay);

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              {tb.title || 'Quản Lý Thương Hiệu & Tên Miền'}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                LIVE CONFIG
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              {tb.subtitle || 'Cấu hình tập trung tên thương hiệu, tên miền, email, bot telegram, SEO và FAQ'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Khôi phục mặc định CodeGame.Shop"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mặc Định</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{tb.saving || 'Đang lưu...'}</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{tb.save || 'Lưu Cài Đặt'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-1 overflow-x-auto scrollbar-none text-xs">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'general'
              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Thương Hiệu & Tên Miền</span>
        </button>
        <button
          onClick={() => setActiveTab('seo_pwa')}
          className={`px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'seo_pwa'
              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>SEO, PWA & Thông Báo</span>
        </button>
        <button
          onClick={() => setActiveTab('faq')}
          className={`px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'faq'
              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Hỏi Đáp FAQ ({config.faqList.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('bulk_replace')}
          className={`px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'bulk_replace'
              ? 'bg-amber-600 text-white font-semibold shadow-sm'
              : 'text-amber-500 hover:text-amber-400 hover:bg-amber-500/10'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Đổi Hàng Loạt Trong Bài Tin & Mã</span>
        </button>
      </div>

      {/* Main Content Area: 2-column Grid (Form + Live Preview Card) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Form: 7 cols */}
        <div className="lg:col-span-7 space-y-4">
          {/* TAB 1: General Branding */}
          {activeTab === 'general' && (
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-2">
                <Globe className="w-4 h-4 text-primary" />
                Nhận Diện Thương Hiệu & Địa Chỉ Web
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {tb.brandName || 'Tên thương hiệu ngắn'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.brandName}
                    onChange={(e) => setConfig({ ...config, brandName: e.target.value })}
                    placeholder={tb.brandNamePlaceholder || 'VD: CodeGame'}
                    className={`w-full px-3 py-2 rounded-lg bg-background border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
                      validationErrors.brandName ? 'border-rose-500' : 'border-border'
                    }`}
                  />
                  {validationErrors.brandName && (
                    <p className="text-[11px] text-rose-500 mt-1">{validationErrors.brandName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {tb.brandDisplay || 'Tên hiển thị đầy đủ'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.brandDisplay}
                    onChange={(e) => setConfig({ ...config, brandDisplay: e.target.value })}
                    placeholder={tb.brandDisplayPlaceholder || 'VD: CodeGame.Shop'}
                    className={`w-full px-3 py-2 rounded-lg bg-background border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
                      validationErrors.brandDisplay ? 'border-rose-500' : 'border-border'
                    }`}
                  />
                  {validationErrors.brandDisplay && (
                    <p className="text-[11px] text-rose-500 mt-1">{validationErrors.brandDisplay}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {tb.baseUrl || 'URL gốc (Base URL)'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={config.baseUrl}
                  onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                  placeholder={tb.baseUrlPlaceholder || 'VD: https://codegame.shop'}
                  className={`w-full px-3 py-2 rounded-lg bg-background border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary ${
                    validationErrors.baseUrl ? 'border-rose-500' : 'border-border'
                  }`}
                />
                {validationErrors.baseUrl ? (
                  <p className="text-[11px] text-rose-500 mt-1">{validationErrors.baseUrl}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Bắt buộc giao thức HTTPS. Tất cả canonical, sitemap.xml, robots.txt và link chia sẻ sẽ đồng bộ theo URL này.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {tb.siteTitle || 'Tiêu đề trang web'}
                  </label>
                  <input
                    type="text"
                    value={config.siteTitle}
                    onChange={(e) => setConfig({ ...config, siteTitle: e.target.value })}
                    placeholder={tb.siteTitlePlaceholder || 'Tiêu đề trang chủ...'}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {tb.portalSubtitle || 'Tiêu đề phụ Header'}
                  </label>
                  <input
                    type="text"
                    value={config.portalSubtitle}
                    onChange={(e) => setConfig({ ...config, portalSubtitle: e.target.value })}
                    placeholder={tb.portalSubtitlePlaceholder || 'VD: Cổng Tra Cứu Giftcode'}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {tb.tagline || 'Khẩu hiệu (Tagline)'}
                </label>
                <input
                  type="text"
                  value={config.tagline}
                  onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
                  placeholder={tb.taglinePlaceholder || 'Khẩu hiệu ngắn...'}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {tb.footerCopyright || 'Mẫu bản quyền Footer (chứa biến {brand})'}
                </label>
                <input
                  type="text"
                  value={config.footerCopyright}
                  onChange={(e) => setConfig({ ...config, footerCopyright: e.target.value })}
                  placeholder={tb.footerCopyrightPlaceholder || 'VD: Toàn bộ bản quyền thuộc về {brand}.'}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Biến <code className="text-primary font-mono">{'{brand}'}</code> sẽ tự động thay bằng Tên hiển thị đầy đủ.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: SEO, PWA, Email & Telegram */}
          {activeTab === 'seo_pwa' && (
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-2">
                <Layers className="w-4 h-4 text-primary" />
                Cấu Hình SEO, PWA Manifest & Kênh Thông Báo
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {tb.emailFromName || 'Tên người gửi Email'}
                  </label>
                  <input
                    type="text"
                    value={config.emailFromName}
                    onChange={(e) => setConfig({ ...config, emailFromName: e.target.value })}
                    placeholder={tb.emailFromNamePlaceholder || 'VD: CodeGame.shop - Thông Báo'}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {tb.emailFromAddress || 'Địa chỉ Email người gửi'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={config.emailFromAddress}
                    onChange={(e) => setConfig({ ...config, emailFromAddress: e.target.value })}
                    placeholder={tb.emailFromAddressPlaceholder || 'VD: notifications@codegame.shop'}
                    className={`w-full px-3 py-2 rounded-lg bg-background border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
                      validationErrors.emailFromAddress ? 'border-rose-500' : 'border-border'
                    }`}
                  />
                  {validationErrors.emailFromAddress && (
                    <p className="text-[11px] text-rose-500 mt-1">{validationErrors.emailFromAddress}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {tb.telegramBotName || 'Tên Bot Telegram hiển thị'}
                </label>
                <input
                  type="text"
                  value={config.telegramBotName}
                  onChange={(e) => setConfig({ ...config, telegramBotName: e.target.value })}
                  placeholder={tb.telegramBotNamePlaceholder || 'VD: CodeGame.Shop Bot'}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {tb.seoTitle || 'Tiêu đề mặc định SEO'}
                </label>
                <input
                  type="text"
                  value={config.seoTitle}
                  onChange={(e) => setConfig({ ...config, seoTitle: e.target.value })}
                  placeholder={tb.seoTitlePlaceholder || 'Tiêu đề SEO...'}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {tb.seoDescription || 'Mô tả mặc định SEO'}
                </label>
                <textarea
                  rows={2}
                  value={config.seoDescription}
                  onChange={(e) => setConfig({ ...config, seoDescription: e.target.value })}
                  placeholder={tb.seoDescriptionPlaceholder || 'Mô tả SEO...'}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {tb.logoAlt || 'Alt Logo'}
                  </label>
                  <input
                    type="text"
                    value={config.logoAlt}
                    onChange={(e) => setConfig({ ...config, logoAlt: e.target.value })}
                    placeholder={tb.logoAltPlaceholder || 'VD: CodeGame.Shop Logo'}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {tb.manifestName || 'Tên PWA Manifest'}
                  </label>
                  <input
                    type="text"
                    value={config.manifestName}
                    onChange={(e) => setConfig({ ...config, manifestName: e.target.value })}
                    placeholder={tb.manifestNamePlaceholder || 'CodeGame - Cổng Tra Cứu'}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {tb.manifestShortName || 'Tên ngắn PWA'}
                  </label>
                  <input
                    type="text"
                    value={config.manifestShortName}
                    onChange={(e) => setConfig({ ...config, manifestShortName: e.target.value })}
                    placeholder={tb.manifestShortNamePlaceholder || 'CodeGame'}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FAQ List */}
          {activeTab === 'faq' && (
            <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-primary" />
                  {tb.faqTitle || 'Câu Hỏi Thường Gặp (FAQ Trang Chủ)'}
                </h3>
                <button
                  type="button"
                  onClick={handleAddFaq}
                  className="px-2.5 py-1 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{tb.addFaq || 'Thêm câu hỏi'}</span>
                </button>
              </div>

              <div className="space-y-3">
                {config.faqList.map((item, idx) => (
                  <div key={idx} className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-primary">
                        Câu {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFaq(idx)}
                        className="text-muted-foreground hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                        title={tb.removeFaq || 'Xóa'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={item.q}
                        onChange={(e) => handleFaqChange(idx, 'q', e.target.value)}
                        placeholder={tb.question || 'Nội dung câu hỏi...'}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <textarea
                        rows={2}
                        value={item.a}
                        onChange={(e) => handleFaqChange(idx, 'a', e.target.value)}
                        placeholder={tb.answer || 'Nội dung câu trả lời...'}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: 1-Click Bulk Replace Tool */}
          {activeTab === 'bulk_replace' && (
            <div className="bg-card border border-amber-500/30 rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
              <div className="border-b border-border pb-2">
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-amber-500" />
                  {tb.bulkReplaceTitle || 'Thay Thế Hàng Loạt Tên & Link Cũ'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {tb.bulkReplaceDesc || 'Tự động quét và thay thế tên miền cũ, tên thương hiệu cũ trong toàn bộ 295 bài tin, 3.388 mã code miễn phí và nội dung CMS.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {tb.oldDomain || 'Tên miền cũ'}
                  </label>
                  <input
                    type="text"
                    value={bulkOldDomain}
                    onChange={(e) => setBulkOldDomain(e.target.value)}
                    placeholder={tb.oldDomainPlaceholder || 'codegame.shop'}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {tb.newDomain || 'Tên miền mới'}
                  </label>
                  <input
                    type="text"
                    value={bulkNewDomain}
                    onChange={(e) => setBulkNewDomain(e.target.value)}
                    placeholder={tb.newDomainPlaceholder || 'yournewdomain.com'}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {tb.oldBrand || 'Thương hiệu cũ'}
                  </label>
                  <input
                    type="text"
                    value={bulkOldBrand}
                    onChange={(e) => setBulkOldBrand(e.target.value)}
                    placeholder={tb.oldBrandPlaceholder || 'CodeGame.Shop'}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {tb.newBrand || 'Thương hiệu mới'}
                  </label>
                  <input
                    type="text"
                    value={bulkNewBrand}
                    onChange={(e) => setBulkNewBrand(e.target.value)}
                    placeholder={tb.newBrandPlaceholder || 'NewBrand.Com'}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleRunBulkReplace}
                  disabled={bulkReplacing}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {bulkReplacing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{tb.bulkReplacing || 'Đang thay thế...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{tb.runBulkReplace || 'Bắt Đầu Thay Thế Hàng Loạt'}</span>
                    </>
                  )}
                </button>
              </div>

              {bulkResult && (
                <div className="p-3 bg-muted/60 border border-emerald-500/30 rounded-xl space-y-1.5 text-xs text-foreground">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Kết quả thay thế thành công:</span>
                  </div>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5 text-[11px]">
                    <li>Bài tin tức cập nhật: <strong className="text-foreground">{bulkResult.newsArticles || 0}</strong> bài</li>
                    <li>Mã miễn phí tùy chỉnh: <strong className="text-foreground">{bulkResult.codesCustom || 0}</strong> mã</li>
                    <li>Mã miễn phí V5: <strong className="text-foreground">{bulkResult.codesFreeV5 || 0}</strong> mã</li>
                    <li>Bảng codes (cột source): <strong className="text-foreground">{bulkResult.codesTable || 0}</strong> hàng</li>
                    <li>Mục CMS Content: <strong className="text-foreground">{bulkResult.contentItems || 0}</strong> mục</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Preview Card: 5 cols */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3 sticky top-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              {tb.preview || 'Xem Trước Hiển Thị Trực Quan'}
            </h3>

            {/* 1. Browser Tab Preview */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                {tb.tabTitle || 'Tab Trình Duyệt'}:
              </span>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground truncate shadow-inner">
                <img src="/favicon.png" alt="Favicon" className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-sans">
                  Giftcode Mới Nhất 2026 | <strong className="text-primary">{effectiveBrandDisplay}</strong>
                </span>
              </div>
            </div>

            {/* 2. Header Preview */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                {tb.headerPreview || 'Giao Diện Header'}:
              </span>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white shrink-0 overflow-hidden">
                  <img src="/logo.webp" alt={config.logoAlt || 'Logo'} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {effectiveBrandDisplay}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {config.portalSubtitle || 'Cổng Tra Cứu Giftcode'}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Footer Copyright Preview */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                {tb.footerPreview || 'Chân Trang (Footer Copyright)'}:
              </span>
              <div className="p-2.5 rounded-lg bg-background border border-border text-[11px] text-muted-foreground leading-relaxed">
                © {new Date().getFullYear()} <strong className="text-foreground">{effectiveBrandDisplay}</strong>. {previewCopyright}
              </div>
            </div>

            {/* 4. Google Search SERP Preview */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                Xem Trước Kết Quả Google:
              </span>
              <div className="p-3 rounded-lg bg-white dark:bg-slate-950 border border-border space-y-1 text-left">
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono truncate">
                  {effectiveBaseUrl}
                </div>
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer truncate">
                  {config.seoTitle || config.siteTitle || `${effectiveBrandDisplay} - Cổng Tra Cứu Giftcode`}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-snug">
                  {config.seoDescription}
                </div>
              </div>
            </div>

            {/* 5. System Quick Info */}
            <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Tên miền hiển thị:</span>
                <span className="font-mono text-foreground">{effectiveDomain}</span>
              </div>
              <div className="flex justify-between">
                <span>Email hệ thống:</span>
                <span className="font-mono text-foreground truncate max-w-[180px]">{config.emailFromAddress}</span>
              </div>
              <div className="flex justify-between">
                <span>Bot Telegram:</span>
                <span className="text-foreground">{config.telegramBotName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
