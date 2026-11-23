import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ivanc54321.cardashboard',
  appName: 'Car Dashboard',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
