/**
 * Utilities định dạng Tiền tệ, Ngày giờ và Số lượng chuẩn hóa theo Ngôn ngữ
 * Tuân thủ yêu cầu: Tiền tệ luôn là VND (không đổi USD), giữ múi giờ gốc GMT+7 của Việt Nam
 */

/**
 * Định dạng tiền tệ VND theo ngôn ngữ:
 * - Tiếng Việt: "20.000đ" hoặc "20.000 VNĐ"
 * - Tiếng Anh: "VND 20,000"
 */
export function formatCurrency(amount: number | undefined | null, language: string = 'vi'): string {
  const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const isEn = language.startsWith('en');

  if (isEn) {
    const formatted = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(val);
    return `VND ${formatted}`;
  }

  // Mặc định Tiếng Việt
  const formatted = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(val);
  return `${formatted}đ`;
}

/**
 * Định dạng ngày giờ:
 * Múi giờ gốc luôn là giờ Việt Nam (Asia/Ho_Chi_Minh - GMT+7) cho hạn dùng mã code và thời gian sự kiện.
 * Khi ở giao diện Tiếng Anh: ghi rõ "(GMT+7)"
 */
export function formatDateTime(
  dateInput: string | number | Date | null | undefined,
  language: string = 'vi',
  options?: {
    showTimezone?: boolean;
    includeTime?: boolean;
  }
): string {
  if (!dateInput) return '';

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);

  const isEn = language.startsWith('en');
  const showTz = options?.showTimezone ?? true;
  const includeTime = options?.includeTime ?? true;

  try {
    if (isEn) {
      const datePart = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }).format(date);

      if (!includeTime) {
        return showTz ? `${datePart} (GMT+7)` : datePart;
      }

      const timePart = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date);

      return showTz ? `${datePart}, ${timePart} (GMT+7)` : `${datePart}, ${timePart}`;
    }

    // Mặc định Tiếng Việt
    const datePart = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);

    if (!includeTime) {
      return datePart;
    }

    const timePart = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);

    return `${timePart} ${datePart}`;
  } catch (e) {
    return date.toLocaleDateString();
  }
}

/**
 * Định dạng số nguyên có dấu phân cách
 */
export function formatNumber(num: number | undefined | null, language: string = 'vi'): string {
  const val = typeof num === 'number' && !isNaN(num) ? num : 0;
  const isEn = language.startsWith('en');
  return new Intl.NumberFormat(isEn ? 'en-US' : 'vi-VN').format(val);
}
