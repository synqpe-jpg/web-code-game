const { execSync } = require('child_process');

console.log('🛡️ 0. Verifying Pre-Deploy Data Integrity & Anti-Regression Guarantees...');
execSync('node scripts/verify_data_integrity.cjs', { stdio: 'inherit' });

console.log('🖼️ 1. Ensuring OG JPG Icons for Zalo/Facebook compatibility...');
execSync('node scripts/generate_og_jpg_icons.cjs', { stdio: 'inherit' });

console.log('📦 2. Building Vite Frontend...');
execSync('npx vite build', { stdio: 'inherit' });

console.log('🌐 3. Generating Prerendered Static SEO HTML Pages for 486+ Games...');
execSync('node scripts/prerender.js', { stdio: 'inherit' });

console.log('⚡ 4. Compiling Cloudflare Pages Edge Worker bundle...');
execSync('npx esbuild functions/_worker.ts --bundle --target=es2022 --format=esm --outfile=dist/_worker.js', { stdio: 'inherit' });

console.log('✅ Build completed successfully with active Cloudflare Edge Worker bundle (_worker.js)!');

