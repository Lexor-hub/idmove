import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.idtransportes.idmove',
  appName: 'ID Move',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    useLegacyBridge: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2563eb',
      showSpinner: false,
    },
    BackgroundGeolocation: {
      locationAuthorizationAlert: {
        titleWhenNotEnabled: 'Localização necessária',
        titleWhenOff: 'Localização desativada',
        instructions: 'Habilite localização em segundo plano para rastreamento de rotas.',
        cancelButton: 'Cancelar',
        settingsButton: 'Configurações',
      },
    },
  },
};

export default config;
