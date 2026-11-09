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
  const files = fs.readdirSync(iconsDir).filter(f => f.endsWith('.webp') && !f.includes('-thumb'));
  console.log(`🖼️ [Icon Thumbs] Bắt đầu sinh bản thu nhỏ 128px & 256px cho ${files.length} icon game...`);

  let created128 = 0;
  let created256 = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const slug = file.replace(/\.webp$/i, '');
    const webpPath = path.join(iconsDir, file);

    const thumb128Name = `${slug}-thumb.webp`;
    const thumb128Path = path.join(iconsDir, thumb128Name);

    const thumb256Name = `${slug}-thumb-256.webp`;
    const thumb256Path = path.join(iconsDir, thumb256Name);

    const srcStat = fs.statSync(webpPath);

    // 1. Sinh thumb 128px (nếu chưa có hoặc cũ hơn file gốc)
    let need128 = true;
    if (fs.existsSync(thumb128Path)) {
      const stat128 = fs.statSync(thumb128Path);
      if (stat128.mtimeMs >= srcStat.mtimeMs && stat128.size > 200) {
        need128 = false;
      }
    }

    // 2. Sinh thumb 256px (nếu chưa có hoặc cũ hơn file gốc)
    let need256 = true;
    if (fs.existsSync(thumb256Path)) {
      const stat256 = fs.statSync(thumb256Path);
      if (stat256.mtimeMs >= srcStat.mtimeMs && stat256.size > 200) {
        need256 = false;
      }
    }

    if (!need128 && !need256) {
      skippedCount++;
      continue;
    }

    try {
      if (need128) {
        await sharp(webpPath)
          .resize(128, 128, { fit: 'cover' })
          .webp({ quality: 80, effort: 4 })
          .toFile(thumb128Path);
        created128++;
      }
      if (need256) {
        await sharp(webpPath)
          .resize(256, 256, { fit: 'cover' })
          .webp({ quality: 80, effort: 4 })
          .toFile(thumb256Path);
        created256++;
      }
    } catch (err) {
      console.warn(`[Icon Thumbs] ⚠️ Lỗi tạo thumb cho ${file}:`, err.message);
      errorCount++;
    }
  }

  console.log(`✅ [Icon Thumbs] Hoàn tất: Tạo mới 128px: ${created128}, 256px: ${created256}, bỏ qua ${skippedCount}, lỗi ${errorCount}.`);
}

if (require.main === module) {
  generateThumbs().catch(console.error);
}

module.exports = { generateThumbs };
