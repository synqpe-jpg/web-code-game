/**
 * Voucher Service — Hệ Thống Mã Giảm Giá Đa Tầng Phong Cách Shopee (Shopee-Style Voucher Stacking)
 * Hỗ trợ áp dụng đồng thời:
 * 1. Voucher Vận Chuyển (Freeship Xtra / Giảm phí ship)
 * 2. Voucher Đơn Hàng (Voucher Sàn / Voucher Shop)
 */

export type VoucherType = 'freeship' | 'platform' | 'shop';
export type DiscountType = 'fixed' | 'percent';
export type VoucherScope = 'all' | 'physical_only' | 'digital_only' | 'category';

export interface VoucherItem {
  id: string;
  code: string;
  title: string;
  description: string;
  voucherType: VoucherType;
  discountType: DiscountType;
  discountValue: number; // e.g. 20000 (VND) hoặc 10 (%)
  maxDiscount?: number;  // Tối đa giảm bao nhiêu khi là %
  minOrderValue: number; // Giá trị đơn hàng tối thiểu
  scopeType: VoucherScope;
  targetCategory?: string;
  totalUsage: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  badgeText?: string;
  highlightColor?: string;
}

export interface VoucherStackingResult {
  productTotal: number;
  shippingFee: number;
  freeshipVoucher: VoucherItem | null;
  discountVoucher: VoucherItem | null;
  freeshipDiscount: number;
  productDiscount: number;
  finalShippingFee: number;
  finalProductTotal: number;
  finalTotal: number;
  totalSavings: number;
}

const STORAGE_KEY_VOUCHERS = 'wcg_vouchers_registry_v1';

export const INITIAL_VOUCHERS: VoucherItem[] = [
  {
    id: 'vc_fs_15k',
    code: 'FREESHIP15K',
    title: 'Freeship Xtra 15.000đ',
    description: 'Giảm 15.000đ phí vận chuyển cho đơn hàng từ 50.000đ',
    voucherType: 'freeship',
    discountType: 'fixed',
    discountValue: 15000,
    minOrderValue: 50000,
    scopeType: 'physical_only',
    totalUsage: 1000,
    usedCount: 234,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    isActive: true,
    badgeText: 'Freeship Xtra',
    highlightColor: '#00bfa5',
  },
  {
    id: 'vc_fs_30k',
    code: 'FREESHIP30K',
    title: 'Freeship Toàn Quốc 30.000đ',
    description: 'Giảm 30.000đ phí vận chuyển cho đơn hàng từ 150.000đ',
    voucherType: 'freeship',
    discountType: 'fixed',
    discountValue: 30000,
    minOrderValue: 150000,
    scopeType: 'physical_only',
    totalUsage: 500,
    usedCount: 189,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    isActive: true,
    badgeText: 'Freeship Max',
    highlightColor: '#00bfa5',
  },
  {
    id: 'vc_fs_100pct',
    code: 'FREESHIPALL',
    title: 'Miễn Phí Vận Chuyển 100%',
    description: 'Miễn 100% phí ship (tối đa 50.000đ) cho đơn từ 300.000đ',
    voucherType: 'freeship',
    discountType: 'percent',
    discountValue: 100,
    maxDiscount: 50000,
    minOrderValue: 300000,
    scopeType: 'physical_only',
    totalUsage: 200,
    usedCount: 78,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    isActive: true,
    badgeText: 'Freeship 100%',
    highlightColor: '#00bfa5',
  },
  {
    id: 'vc_san_20k',
    code: 'SAN20K',
    title: 'Voucher Sàn Giảm 20.000đ',
    description: 'Giảm ngay 20.000đ cho đơn hàng bất kỳ từ 99.000đ',
    voucherType: 'platform',
    discountType: 'fixed',
    discountValue: 20000,
    minOrderValue: 99000,
    scopeType: 'all',
    totalUsage: 2000,
    usedCount: 842,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    isActive: true,
    badgeText: 'Toàn Sàn',
    highlightColor: '#ee4d2d',
  },
  {
    id: 'vc_san_10pct',
    code: 'SAN10PCT',
    title: 'Siêu Hội Mua Sắm - Giảm 10%',
    description: 'Giảm 10% (tối đa 50.000đ) cho đơn hàng từ 150.000đ',
    voucherType: 'platform',
    discountType: 'percent',
    discountValue: 10,
    maxDiscount: 50000,
    minOrderValue: 150000,
    scopeType: 'all',
    totalUsage: 800,
    usedCount: 321,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    isActive: true,
    badgeText: 'Shopee Mall',
    highlightColor: '#ee4d2d',
  },
  {
    id: 'vc_san_50k',
    code: 'SAN50K',
    title: 'Voucher Độc Quyền Giảm 50.000đ',
    description: 'Giảm cực lớn 50.000đ cho đơn hàng từ 250.000đ',
    voucherType: 'platform',
    discountType: 'fixed',
    discountValue: 50000,
    minOrderValue: 250000,
    scopeType: 'all',
    totalUsage: 300,
    usedCount: 165,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    isActive: true,
    badgeText: 'Hot Voucher',
    highlightColor: '#ee4d2d',
  },
  {
    id: 'vc_shop_game10k',
    code: 'GAMEVIP10K',
    title: 'Voucher Game VIP Giảm 10.000đ',
    description: 'Giảm 10.000đ cho tất cả mã thẻ, tài khoản game từ 50.000đ',
    voucherType: 'shop',
    discountType: 'fixed',
    discountValue: 10000,
    minOrderValue: 50000,
    scopeType: 'digital_only',
    totalUsage: 1500,
    usedCount: 654,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    isActive: true,
    badgeText: 'Shop Game',
    highlightColor: '#8b5cf6',
  },
  {
    id: 'vc_shop_fashion25k',
    code: 'FASHION25K',
    title: 'Thời Trang & Mỹ Phẩm Giảm 25.000đ',
    description: 'Giảm 25.000đ khi đặt mua quần áo, phụ kiện từ 120.000đ',
    voucherType: 'shop',
    discountType: 'fixed',
    discountValue: 25000,
    minOrderValue: 120000,
    scopeType: 'physical_only',
    totalUsage: 500,
    usedCount: 112,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    isActive: true,
    badgeText: 'Shop Thời Trang',
    highlightColor: '#ec4899',
  },
];

class VoucherService {
  private vouchers: Map<string, VoucherItem> = new Map();

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(STORAGE_KEY_VOUCHERS);
        if (raw) {
          const list: VoucherItem[] = JSON.parse(raw);
          list.forEach((v) => this.vouchers.set(v.id, v));
        } else {
          // Initialize defaults
          INITIAL_VOUCHERS.forEach((v) => this.vouchers.set(v.id, v));
          this.save();
        }
      } else {
        INITIAL_VOUCHERS.forEach((v) => this.vouchers.set(v.id, v));
      }
    } catch {
      INITIAL_VOUCHERS.forEach((v) => this.vouchers.set(v.id, v));
    }
  }

  private save() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const list = Array.from(this.vouchers.values());
        localStorage.setItem(STORAGE_KEY_VOUCHERS, JSON.stringify(list));
      }
    } catch {}
  }

  public getAll(): VoucherItem[] {
    return Array.from(this.vouchers.values());
  }

  public getById(id: string): VoucherItem | undefined {
    return this.vouchers.get(id);
  }

  public getByCode(code: string): VoucherItem | undefined {
    const cleanCode = code.trim().toUpperCase();
    return Array.from(this.vouchers.values()).find(
      (v) => v.code.toUpperCase() === cleanCode && v.isActive
    );
  }

  /**
   * Lọc và phân loại voucher theo điều kiện đơn hàng
   */
  public evaluateVouchers(params: {
    productTotal: number;
    shippingFee: number;
    isPhysical: boolean;
    categoryId?: string;
  }): {
    freeshipVouchers: { voucher: VoucherItem; eligible: boolean; diffNeeded: number }[];
    discountVouchers: { voucher: VoucherItem; eligible: boolean; diffNeeded: number }[];
  } {
    const { productTotal, isPhysical } = params;
    const all = this.getAll().filter((v) => v.isActive);

    const freeshipList: { voucher: VoucherItem; eligible: boolean; diffNeeded: number }[] = [];
    const discountList: { voucher: VoucherItem; eligible: boolean; diffNeeded: number }[] = [];

    all.forEach((v) => {
      // Check scope
      if (v.scopeType === 'physical_only' && !isPhysical) return;
      if (v.scopeType === 'digital_only' && isPhysical) return;

      const diff = Math.max(0, v.minOrderValue - productTotal);
      const eligible = diff === 0 && v.usedCount < v.totalUsage;

      const item = { voucher: v, eligible, diffNeeded: diff };

      if (v.voucherType === 'freeship') {
        freeshipList.push(item);
      } else {
        discountList.push(item);
      }
    });

    // Sắp xếp: Eligible lên trước, sau đó ưu tiên giá trị giảm cao hơn
    const sorter = (
      a: { voucher: VoucherItem; eligible: boolean; diffNeeded: number },
      b: { voucher: VoucherItem; eligible: boolean; diffNeeded: number }
    ) => {
      if (a.eligible && !b.eligible) return -1;
      if (!a.eligible && b.eligible) return 1;
      return b.voucher.discountValue - a.voucher.discountValue;
    };

    freeshipList.sort(sorter);
    discountList.sort(sorter);

    return { freeshipVouchers: freeshipList, discountVouchers: discountList };
  }

  /**
   * Tính toán voucher đa tầng (Shopee Stacking Calculation)
   * 1 Voucher Freeship + 1 Voucher Giảm giá
   */
  public calculateStacking(params: {
    productTotal: number;
    shippingFee: number;
    freeshipVoucher: VoucherItem | null;
    discountVoucher: VoucherItem | null;
  }): VoucherStackingResult {
    const { productTotal, shippingFee, freeshipVoucher, discountVoucher } = params;

    let freeshipDiscount = 0;
    if (freeshipVoucher && shippingFee > 0) {
      if (freeshipVoucher.discountType === 'fixed') {
        freeshipDiscount = Math.min(shippingFee, freeshipVoucher.discountValue);
      } else {
        const pctDiscount = Math.round((shippingFee * freeshipVoucher.discountValue) / 100);
        freeshipDiscount = Math.min(
          shippingFee,
          freeshipVoucher.maxDiscount ? Math.min(pctDiscount, freeshipVoucher.maxDiscount) : pctDiscount
        );
      }
    }

    let productDiscount = 0;
    if (discountVoucher && productTotal > 0) {
      if (discountVoucher.discountType === 'fixed') {
        productDiscount = Math.min(productTotal, discountVoucher.discountValue);
      } else {
        const pctDiscount = Math.round((productTotal * discountVoucher.discountValue) / 100);
        productDiscount = Math.min(
          productTotal,
          discountVoucher.maxDiscount ? Math.min(pctDiscount, discountVoucher.maxDiscount) : pctDiscount
        );
      }
    }

    const finalShippingFee = Math.max(0, shippingFee - freeshipDiscount);
    const finalProductTotal = Math.max(0, productTotal - productDiscount);
    const finalTotal = finalProductTotal + finalShippingFee;
    const totalSavings = freeshipDiscount + productDiscount;

    return {
      productTotal,
      shippingFee,
      freeshipVoucher,
      discountVoucher,
      freeshipDiscount,
      productDiscount,
      finalShippingFee,
      finalProductTotal,
      finalTotal,
      totalSavings,
    };
  }

  /**
   * Ghi nhận sử dụng voucher sau khi đặt hàng thành công
   */
  public recordUsage(code?: string): void {
    if (!code) return;
    const v = this.getByCode(code);
    if (v) {
      v.usedCount = Math.min(v.totalUsage, v.usedCount + 1);
      this.vouchers.set(v.id, v);
      this.save();
    }
  }

  /**
   * Quản trị CRUD Voucher
   */
  public saveVoucher(item: Partial<VoucherItem> & { code: string; title: string }): VoucherItem {
    const existing = item.id ? this.vouchers.get(item.id) : undefined;
    const id = existing ? existing.id : `vc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullItem: VoucherItem = {
      id,
      code: item.code.trim().toUpperCase(),
      title: item.title,
      description: item.description || '',
      voucherType: item.voucherType || 'platform',
      discountType: item.discountType || 'fixed',
      discountValue: Number(item.discountValue) || 0,
      maxDiscount: item.maxDiscount ? Number(item.maxDiscount) : undefined,
      minOrderValue: Number(item.minOrderValue) || 0,
      scopeType: item.scopeType || 'all',
      targetCategory: item.targetCategory,
      totalUsage: Number(item.totalUsage) || 100,
      usedCount: existing ? existing.usedCount : 0,
      startDate: item.startDate || new Date().toISOString(),
      endDate: item.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: item.isActive !== undefined ? item.isActive : true,
      badgeText: item.badgeText || (item.voucherType === 'freeship' ? 'Freeship Xtra' : 'Mã Giảm Giá'),
      highlightColor: item.highlightColor || (item.voucherType === 'freeship' ? '#00bfa5' : '#ee4d2d'),
    };
    this.vouchers.set(id, fullItem);
    this.save();
    return fullItem;
  }

  public deleteVoucher(id: string): boolean {
    const ok = this.vouchers.delete(id);
    if (ok) this.save();
    return ok;
  }

  public toggleVoucher(id: string): boolean {
    const item = this.vouchers.get(id);
    if (!item) return false;
    item.isActive = !item.isActive;
    this.save();
    return item.isActive;
  }
}

export const voucherService = new VoucherService();
