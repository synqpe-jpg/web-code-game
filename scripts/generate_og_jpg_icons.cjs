const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const iconsDir = path.resolve(__dirname, '../public/game_icons');
  if (!fs.existsSync(iconsDir)) {
    console.error('Không tìm thấy thư mục', iconsDir);
    return;
  }

  // Dọn dẹp các file -thumb.jpg nếu vô tình được sinh ra
  const allFiles = fs.readdirSync(iconsDir);
  for (const f of allFiles) {
    if (f.endsWith('-thumb.jpg')) {
      try { fs.unlinkSync(path.join(iconsDir, f)); } catch {}
    }
  }

  const files = fs.readdirSync(iconsDir).filter(f => f.endsWith('.webp') && !f.endsWith('-thumb.webp'));
  console.log(`Bắt đầu chuyển đổi ${files.length} icon webp sang jpg cho Open Graph / Zalo / Facebook...`);

  let count = 0;
  let skipped = 0;
  for (const file of files) {
    const webpPath = path.join(iconsDir, file);
    const jpgName = file.replace(/\.webp$/i, '.jpg');
    const jpgPath = path.join(iconsDir, jpgName);

    if (fs.existsSync(jpgPath)) {
      const webpStat = fs.statSync(webpPath);
      const jpgStat = fs.statSync(jpgPath);
      if (jpgStat.mtimeMs >= webpStat.mtimeMs && jpgStat.size > 200) {
        skipped++;
        continue;
      }
    }

    try {
      await sharp(webpPath)
        .flatten({ background: { r: 15, g: 23, b: 42 } }) // #0f172a dark slate background if transparent
        .jpeg({ quality: 90 })
        .toFile(jpgPath);
      count++;
    } catch (err) {
      console.warn(`Lỗi convert ${file}:`, err.message);
    }
  }

  console.log(`Đã xuất bản thành công ${count} file JPG mới/cập nhật, bỏ qua ${skipped} file đã tồn tại!`);
}

main().catch(console.error);
