import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aquagen.farm',
  appName: 'AquaGen Farm',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
