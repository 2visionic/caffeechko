import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cz.magicware.dochazka',
  appName: 'Docházka',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    CapacitorNfc: {
      // Config for hardware NFC
    }
  }
};

export default config;
