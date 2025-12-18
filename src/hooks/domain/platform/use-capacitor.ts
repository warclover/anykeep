/**
 * Capacitor React Hook
 * 提供移动端原生功能的 React 集成
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  isNativePlatform,
  getPlatform,
  initCapacitor,
  shareContent,
  onAppStateChange,
  onAppUrlOpen,
  onBackButton,
} from "@/lib/capacitor";

/**
 * 平台检测 Hook
 * 使用惰性初始化避免 useEffect 中同步调用 setState
 */
export function usePlatform() {
  // 使用惰性初始化，避免在 useEffect 中同步调用 setState
  const [platform] = useState<"web" | "ios" | "android">(
    () => getPlatform() as "web" | "ios" | "android",
  );
  const [isNative] = useState(() => isNativePlatform());

  return { platform, isNative, isWeb: !isNative };
}

/**
 * Capacitor 初始化 Hook
 */
export function useCapacitorInit() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initCapacitor().then(() => setInitialized(true));
  }, []);

  return initialized;
}

/**
 * App 状态 Hook
 * 监听 App 前台/后台切换
 */
export function useAppState() {
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const unsubscribe = onAppStateChange(({ isActive }) => {
      setIsActive(isActive);
    });
    return unsubscribe;
  }, []);

  return isActive;
}

/**
 * 深度链接 Hook
 * 监听从其他 App 打开的 URL
 */
export function useDeepLink(
  callback: (url: string) => void,
  deps: React.DependencyList = [],
) {
  useEffect(() => {
    const unsubscribe = onAppUrlOpen(({ url }) => {
      callback(url);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Android 返回按钮 Hook
 */
export function useBackButton(
  callback: () => void,
  deps: React.DependencyList = [],
) {
  useEffect(() => {
    const unsubscribe = onBackButton(callback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * 分享功能 Hook
 */
export function useShare() {
  const [isSharing, setIsSharing] = useState(false);

  const share = useCallback(
    async (options: { title?: string; text?: string; url?: string }) => {
      setIsSharing(true);
      try {
        const result = await shareContent({
          ...options,
          dialogTitle: "分享到",
        });
        return result;
      } finally {
        setIsSharing(false);
      }
    },
    [],
  );

  return { share, isSharing };
}

/**
 * 接收分享内容 Hook
 * 处理从其他 App 分享到 AnyKeep 的内容
 */
export function useShareReceiver(
  onReceive: (data: { url?: string; text?: string; title?: string }) => void,
  deps: React.DependencyList = [],
) {
  useEffect(() => {
    // 处理深度链接中的分享数据
    const unsubscribe = onAppUrlOpen(({ url }) => {
      // URL 格式: anykeep://share?url=xxx&title=xxx
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "anykeep:" && parsed.pathname === "//share") {
          const sharedUrl = parsed.searchParams.get("url");
          const title = parsed.searchParams.get("title");
          const text = parsed.searchParams.get("text");

          onReceive({
            url: sharedUrl || undefined,
            title: title || undefined,
            text: text || undefined,
          });
        }
      } catch {
        // 如果是普通 URL，直接作为分享 URL 处理
        if (url.startsWith("http")) {
          onReceive({ url });
        }
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * BeforeInstallPromptEvent 类型定义
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * 添加到主屏幕 Hook
 * 检测 PWA 安装状态和触发安装提示
 */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  // 使用惰性初始化检测是否已安装，避免 useEffect 中同步调用 setState
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches;
  });
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 如果已安装，不需要监听事件
    if (isInstalled) return;

    // 监听安装提示事件
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // 监听安装完成
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isInstalled]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setCanInstall(false);
      setDeferredPrompt(null);
      return true;
    }

    return false;
  }, [deferredPrompt]);

  return { canInstall, isInstalled, promptInstall };
}
