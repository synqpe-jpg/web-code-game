const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateThumbs() {
  const iconsDir = path.resolve(__dirname, '../public/game_icons');
  if (!fs.existsSync(iconsDir)) {
    console.error('[Icon Thumbs] Thư mục không tồn tại:', iconsDir);
    return;
  }

  // Lấy tất cả file webp gốc (không lấy file đã là thumb)
  const files = fs.readdirSync(iconsDir).filter(f => f.endsWith('.webp') && !f.endsWith('-thumb.webp'));
  console.log(`🖼️ [Icon Thumbs] Bắt đầu sinh bản thu nhỏ 128px cho ${files.length} icon game...`);

  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const slug = file.replace(/\.webp$/i, '');
    const webpPath = path.join(iconsDir, file);
    const thumbName = `${slug}-thumb.webp`;
    const thumbPath = path.join(iconsDir, thumbName);

    // Nếu thumb đã tồn tại và mới hơn file gốc, bỏ qua để tiết kiệm thời gian
    if (fs.existsSync(thumbPath)) {
      const srcStat = fs.statSync(webpPath);
      const thumbStat = fs.statSync(thumbPath);
      if (thumbStat.mtimeMs >= srcStat.mtimeMs && thumbStat.size > 200) {
        skippedCount++;
        continue;
      }
    }

    try {
      await sharp(webpPath)
        .resize(128, 128, { fit: 'cover' })
        .webp({ quality: 80, effort: 4 })
        .toFile(thumbPath);
      createdCount++;
    } catch (err) {
      console.warn(`[Icon Thumbs] ⚠️ Lỗi tạo thumb cho ${file}:`, err.message);
      errorCount++;
    }
  }

  console.log(`✅ [Icon Thumbs] Hoàn tất: Tạo mới/cập nhật ${createdCount}, bỏ qua ${skippedCount}, lỗi ${errorCount}.`);
}

if (require.main === module) {
  generateThumbs().catch(console.error);
}

module.exports = { generateThumbs };
