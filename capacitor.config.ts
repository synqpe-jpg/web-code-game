import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'store.codegame.app',
  appName: 'CodeGame',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
