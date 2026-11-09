const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const OUT_DIR = 'C:\\Users\\farm2\\.gemini\\antigravity\\brain\\2475b5c8-d3b0-42fe-84ea-99766b845182';

const shots = [
  { name: 'homepage_before_desktop_1440px.png', url: 'https://codegame.shop/', w: 1440, h: 900 },
  { name: 'homepage_before_mobile_390px.png', url: 'https://codegame.shop/', w: 390, h: 844 },
  { name: 'game_before_desktop_1440px.png', url: 'https://codegame.shop/game/hiep-khach-hanh', w: 1440, h: 900 },
  { name: 'game_before_mobile_390px.png', url: 'https://codegame.shop/game/hiep-khach-hanh', w: 390, h: 844 },
];

for (const s of shots) {
  const outPath = path.join(OUT_DIR, s.name);
  console.log(`📸 Capturing ${s.name}...`);
  try {
    execSync(`${CHROME} --headless=new --disable-gpu --window-size=${s.w},${s.h} --screenshot="${outPath}" "${s.url}"`, {
      timeout: 15000,
      stdio: 'ignore'
    });
    console.log(`   ✅ Saved ${s.name} (${fs.statSync(outPath).size} bytes)`);
  } catch (err) {
    console.warn(`   ⚠️ Error capturing ${s.name}:`, err.message);
  }
}
