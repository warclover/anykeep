/**
 * Capacitor 原生功能集成
 * 提供移动端原生功能：分享、剪贴板、深度链接等
 */

import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Browser } from "@capacitor/browser";
import { Preferences } from "@capacitor/preferences";
import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { clientLogger } from "@/lib/client-logger";

// 空操作函数，用于非原生平台的清理回调
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

// 检测是否在原生平台运行
export const isNativePlatform = () => Capacitor.isNativePlatform();
export const getPlatform = () => Capacitor.getPlatform(); // 'web' | 'ios' | 'android'
export const isAndroid = () => Capacitor.getPlatform() === "android";
export const isIOS = () => Capacitor.getPlatform() === "ios";

// ==================== 分享功能 ====================

/**
 * 分享内容到其他应用
 */
export async function shareContent(options: {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}) {
  if (!isNativePlatform()) {
    // Web 平台使用 Web Share API
    if (navigator.share) {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
      return { success: true };
    }
    // 不支持分享则复制到剪贴板
    if (options.url) {
      await navigator.clipboard.writeText(options.url);
      return { success: true, copied: true };
    }
    return { success: false };
  }

  try {
    await Share.share({
      title: options.title,
      text: options.text,
      url: options.url,
      dialogTitle: options.dialogTitle || "分享到",
    });
    return { success: true };
  } catch (error) {
    clientLogger.error({ error }, "Share failed");
    return { success: false, error };
  }
}

/**
 * 检查是否可以分享
 */
export async function canShare(): Promise<boolean> {
  if (!isNativePlatform()) {
    return !!navigator.share;
  }
  return true;
}

// ==================== 外部链接 ====================

/**
 * 在浏览器中打开链接
 */
export async function openUrl(url: string, inApp = false) {
  if (!isNativePlatform() || !inApp) {
    window.open(url, "_blank");
    return;
  }

  await Browser.open({
    url,
    presentationStyle: "popover",
    toolbarColor: "#6366F1",
  });
}

/**
 * 关闭应用内浏览器
 */
export async function closeBrowser() {
  if (isNativePlatform()) {
    await Browser.close();
  }
}

// ==================== 本地存储 (Preferences) ====================

/**
 * 设置本地存储值
 */
export async function setPreference(key: string, value: string) {
  await Preferences.set({ key, value });
}

/**
 * 获取本地存储值
 */
export async function getPreference(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key });
  return value;
}

/**
 * 删除本地存储值
 */
export async function removePreference(key: string) {
  await Preferences.remove({ key });
}

/**
 * 清除所有本地存储
 */
export async function clearPreferences() {
  await Preferences.clear();
}

// ==================== App 生命周期 ====================

/**
 * 监听 App 状态变化
 */
export function onAppStateChange(
  callback: (state: { isActive: boolean }) => void,
) {
  if (!isNativePlatform()) return noop;

  const listenerPromise = App.addListener("appStateChange", callback);
  return async () => {
    const listener = await listenerPromise;
    await listener.remove();
  };
}

/**
 * 监听 App URL 打开事件 (深度链接)
 */
export function onAppUrlOpen(callback: (data: { url: string }) => void) {
  if (!isNativePlatform()) return noop;

  const listenerPromise = App.addListener("appUrlOpen", callback);
  return async () => {
    const listener = await listenerPromise;
    await listener.remove();
  };
}

/**
 * 监听返回按钮 (Android)
 */
export function onBackButton(callback: () => void) {
  if (!isAndroid()) return noop;

  const listenerPromise = App.addListener("backButton", callback);
  return async () => {
    const listener = await listenerPromise;
    await listener.remove();
  };
}

/**
 * 退出 App
 */
export async function exitApp() {
  if (isNativePlatform()) {
    await App.exitApp();
  }
}

// ==================== 启动画面 ====================

/**
 * 隐藏启动画面
 */
export async function hideSplashScreen() {
  if (isNativePlatform()) {
    await SplashScreen.hide();
  }
}

/**
 * 显示启动画面
 */
export async function showSplashScreen() {
  if (isNativePlatform()) {
    await SplashScreen.show({
      autoHide: false,
    });
  }
}

// ==================== 状态栏 ====================

/**
 * 设置状态栏样式
 */
export async function setStatusBarStyle(style: "light" | "dark") {
  if (!isNativePlatform()) return;

  await StatusBar.setStyle({
    style: style === "light" ? Style.Light : Style.Dark,
  });
}

/**
 * 设置状态栏背景色 (仅 Android)
 */
export async function setStatusBarColor(color: string) {
  if (!isAndroid()) return;

  await StatusBar.setBackgroundColor({ color });
}

/**
 * 隐藏状态栏
 */
export async function hideStatusBar() {
  if (!isNativePlatform()) return;

  await StatusBar.hide();
}

/**
 * 显示状态栏
 */
export async function showStatusBar() {
  if (!isNativePlatform()) return;

  await StatusBar.show();
}

// ==================== 初始化 ====================

/**
 * 初始化 Capacitor 原生功能
 * 在 App 启动时调用
 */
export async function initCapacitor() {
  if (!isNativePlatform()) return;

  // 设置状态栏
  await setStatusBarStyle("light");
  if (isAndroid()) {
    await setStatusBarColor("#6366F1");
  }

  // 隐藏启动画面
  await hideSplashScreen();

  if (process.env.NODE_ENV === "development") {
    clientLogger.info({ platform: getPlatform() }, "[Capacitor] Initialized");
  }
}
