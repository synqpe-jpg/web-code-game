/**
 * Client-side Smart Image Compressor
 * Automatically scales, optimizes, and compresses uploaded image files to lightweight WebP/JPEG Base64
 * Ensures zero-bloat for LocalStorage and instant 0ms edge loading.
 */

export interface CompressionResult {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  originalSizeFormatted: string;
  compressedSizeFormatted: string;
  savedPercent: number;
  width: number;
  height: number;
}

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/webp' | 'image/jpeg' | 'image/png';
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.8,
    mimeType = 'image/webp',
  } = options;

  return new Promise((resolve, reject) => {
    // If SVG, read as text/dataURL directly
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve({
          dataUrl,
          originalSize: file.size,
          compressedSize: file.size,
          originalSizeFormatted: formatBytes(file.size),
          compressedSizeFormatted: formatBytes(file.size),
          savedPercent: 0,
          width: 0,
          height: 0,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = reject;

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Không thể đọc định dạng hình ảnh.'));

      img.onload = () => {
        let { width, height } = img;

        // Calculate aspect ratio scaling
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Không thể khởi tạo Canvas Context.'));
          return;
        }

        // Smooth image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fallback to JPEG if browser doesn't support WebP export
        let outputMime = mimeType;
        let dataUrl = canvas.toDataURL(outputMime, quality);

        if (!dataUrl.startsWith(`data:${outputMime}`)) {
          outputMime = 'image/jpeg';
          dataUrl = canvas.toDataURL(outputMime, quality);
        }

        // Calculate approximate size in bytes from Base64 string
        const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
        const compressedSize = Math.round((base64Length * 3) / 4);

        const savedBytes = Math.max(0, file.size - compressedSize);
        const savedPercent = file.size > 0 ? Math.round((savedBytes / file.size) * 100) : 0;

        resolve({
          dataUrl,
          originalSize: file.size,
          compressedSize,
          originalSizeFormatted: formatBytes(file.size),
          compressedSizeFormatted: formatBytes(compressedSize),
          savedPercent,
          width,
          height,
        });
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
