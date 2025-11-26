import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.anykeep.app',
  appName: 'AnyKeep',
  webDir: 'out',
  // 服务器配置
  server: {
    // 开发时使用本地服务器
    // url: 'http://localhost:3000',
    // cleartext: true,
    // 生产环境使用打包的静态文件
    androidScheme: 'https',
  },
  // 插件配置
  plugins: {
    // 启动画面配置
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#6366F1',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    // 状态栏配置
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#6366F1',
    },
    // App 配置
    App: {
      // 深度链接配置
      // 支持 anykeep:// 和 https://anykeep.app 链接
    },
  },
  // Android 特定配置
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    // 分享目标配置
    appendUserAgent: 'AnyKeep-App/1.0.0',
  },
  // iOS 特定配置 (macOS 上配置)
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
  },
}

export default config
