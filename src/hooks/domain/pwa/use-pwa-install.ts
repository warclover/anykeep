/**
 * usePwaInstall - 封装 PWA 安装提示逻辑
 *
 * 核心能力：
 * 1. 拦截 `beforeinstallprompt` 事件，保存安装提示引用
 * 2. 检测是否已以 standalone 模式运行（已安装）
 * 3. 提供 `install()` 方法触发原生安装对话框
 * 4. 管理安装引导的展示时机（visitCount 阈值）
 *
 * @since 2026-03-16
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ---------- 类型 ----------

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

// ---------- 常量 ----------

const STORAGE_KEY_VISITS = "anykeep_pwa_install_visits";
const STORAGE_KEY_DISMISSED = "anykeep_pwa_install_dismissed";
/** 移动端访问 N 次后自动展示安装横幅 */
const MOBILE_VISIT_THRESHOLD = 3;

// ---------- 工具函数 ----------

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(
      "standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone
    )
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ---------- Hook ----------

export interface UsePwaInstallReturn {
  /** 浏览器是否支持安装提示（即有待处理的 beforeinstallprompt） */
  canInstall: boolean;
  /** 是否已安装（standalone 模式运行中） */
  isInstalled: boolean;
  /** 是否 iOS 设备（需要手动引导） */
  isIOS: boolean;
  /** 是否应展示安装引导横幅（综合 visitCount + dismissed + installed 判断） */
  shouldShowBanner: boolean;
  /** 触发原生安装对话框，返回是否安装成功 */
  install: () => Promise<boolean>;
  /** 用户主动关闭横幅（记录 dismissed，不再自动展示） */
  dismiss: () => void;
}

export function usePwaInstall(): UsePwaInstallReturn {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  // 惰性初始化，避免 effect 内同步 setState
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY_DISMISSED) === "true";
  });
  const [visitCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    const prev = parseInt(localStorage.getItem(STORAGE_KEY_VISITS) || "0", 10);
    const next = prev + 1;
    localStorage.setItem(STORAGE_KEY_VISITS, String(next));
    return next;
  });
  const [iosDevice] = useState(() => isIOS());
  const listenerAttached = useRef(false);

  // 监听 beforeinstallprompt
  useEffect(() => {
    if (typeof window === "undefined" || listenerAttached.current) return;
    listenerAttached.current = true;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // 监听安装完成
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!installPrompt) return false;
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
        setInstallPrompt(null);
        return true;
      }
    } catch {
      // prompt() 只能调用一次，忽略错误
    }
    return false;
  }, [installPrompt]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY_DISMISSED, "true");
  }, []);

  // 综合判断是否应展示横幅
  const shouldShowBanner =
    !installed &&
    !dismissed &&
    isMobile() &&
    visitCount >= MOBILE_VISIT_THRESHOLD &&
    (!!installPrompt || iosDevice);

  return {
    canInstall: !!installPrompt,
    isInstalled: installed,
    isIOS: iosDevice,
    shouldShowBanner,
    install,
    dismiss,
  };
}
