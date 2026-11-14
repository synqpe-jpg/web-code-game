const { execSync } = require('child_process');
const fs = require('fs');

console.log('🖼️ 1. Ensuring OG JPG Icons for Zalo/Facebook compatibility...');
execSync('node scripts/generate_og_jpg_icons.cjs', { stdio: 'inherit' });

console.log('📐 1b. Ensuring 128px Lightweight Game Icon Thumbs for Fast Delivery...');
execSync('node scripts/generate_game_icon_thumbs.cjs', { stdio: 'inherit' });

console.log('🧹 1c. Cleaning old stale dist/assets chunks to avoid cache pollution...');
try {
  if (fs.existsSync('dist/assets')) {
    fs.rmSync('dist/assets', { recursive: true, force: true });
  }
} catch (e) {
  console.warn('   Could not clean dist/assets:', e.message);
}

console.log('📦 2. Building Vite Frontend...');
execSync('npx vite build', { stdio: 'inherit' });

console.log('🌐 3. Generating Prerendered Static SEO HTML Pages for 486+ Games...');
execSync('node scripts/prerender.js', { stdio: 'inherit' });

console.log('⚡ 4. Compiling Cloudflare Pages Edge Worker bundle...');
let commitHash = 'unknown';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch {}
const buildTime = new Date().toISOString();
console.log(`   🏷️ Injected Build ID: ${commitHash} (${buildTime})`);
execSync(`npx esbuild functions/_worker.ts --bundle --target=es2022 --format=esm --define:__BUILD_ID__="'${commitHash}'" --define:__BUILD_TIME__="'${buildTime}'" --outfile=dist/_worker.js`, { stdio: 'inherit' });

console.log('✅ Build completed successfully with active Cloudflare Edge Worker bundle (_worker.js)!');
