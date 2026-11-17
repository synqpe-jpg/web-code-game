import type { StoreProduct } from '../types/game';

/**
 * Danh sách sản phẩm mẫu đa ngành chuẩn E-Commerce
 * Đã làm sạch 100% dữ liệu mẫu demo theo lệnh Chủ sở hữu.
 * Hệ thống chỉ hiển thị sản phẩm thật được lưu trữ từ CSDL D1.
 */

export const INDUSTRY_PRESET_PRODUCTS: Record<string, StoreProduct[]> = {
  fashion: [],
  beauty: [],
  tech: [],
  services: [],
  gaming: [],
};

/**
 * Lấy danh sách sản phẩm mẫu theo ngành hàng (luôn trả về mảng rỗng để ưu tiên hàng thật từ D1)
 */
export function getIndustryPresetProducts(industryId: string): StoreProduct[] {
  if (INDUSTRY_PRESET_PRODUCTS[industryId]) {
    return INDUSTRY_PRESET_PRODUCTS[industryId];
  }
  return INDUSTRY_PRESET_PRODUCTS['gaming'] || [];
}
