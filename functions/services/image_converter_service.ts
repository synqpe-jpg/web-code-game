import { decode, Image } from 'imagescript';

export interface WebpConvertResult {
  success: boolean;
  webpBytes?: Uint8Array;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Chuyển đổi mọi định dạng ảnh (JPEG, PNG, GIF, BMP...) sang định dạng WebP thật.
 * Tự động nén/thu nhỏ nếu ảnh quá lớn (vượt 512px) để tối ưu kích thước icon <= 500KB.
 */
export async function convertToWebp(
  inputBytes: Uint8Array,
  maxDimension: number = 512
): Promise<WebpConvertResult> {
  try {
    const decoded: any = await decode(inputBytes);
    if (!decoded || !decoded.width || !decoded.height) {
      return { success: false, error: 'Không thể giải mã dữ liệu ảnh.' };
    }

    const origWidth = decoded.width;
    const origHeight = decoded.height;

    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (origWidth > maxDimension || origHeight > maxDimension) {
      if (origWidth >= origHeight) {
        targetWidth = maxDimension;
        targetHeight = Math.max(1, Math.round((origHeight * maxDimension) / origWidth));
      } else {
        targetHeight = maxDimension;
        targetWidth = Math.max(1, Math.round((origWidth * maxDimension) / origHeight));
      }
      decoded.resize(targetWidth, targetHeight);
    }

    // Mã hóa thành WebP thật
    const webpUint8 = await decoded.encodeWebP(80);

    return {
      success: true,
      webpBytes: webpUint8,
      width: targetWidth,
      height: targetHeight,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Không thể chuyển đổi ảnh sang định dạng WebP',
    };
  }
}
