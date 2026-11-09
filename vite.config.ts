import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'https://web-code-game.pages.dev',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('crawled_codes_188.json')) return 'crawled-codes-offline-fallback';
          if (id.includes('games188.json')) return 'games-catalog-fallback';
          if (id.includes('seedNews.ts') || id.includes('seedNews')) return 'seed-news-fallback';
          if (id.includes('utilities.json')) return 'utilities-data-fallback';
          if (id.includes('node_modules/lucide-react')) {
            return 'lucide-icons';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/qrcode')) {
            return 'qrcode-vendor';
          }
          if (
            id.includes('node_modules/fuse.js') ||
            id.includes('node_modules/canvas-confetti') ||
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/tailwind-merge')
          ) {
            return 'utils-vendor';
          }
          if (id.includes('node_modules/bcryptjs') || id.includes('bcryptjs')) {
            return 'crypto-vendor';
          }
        },
      },
    },
  },
});
