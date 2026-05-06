import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.academicgen.app',
  appName: 'AcademicGen',
  webDir: 'dist/public',
  server: {
    // Load from hosted website (requires internet connection)
    url: 'https://academicgen.com',
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#6366f1",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#6366f1"
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    }
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    }
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "AcademicGen"
  }
};

export default config;
