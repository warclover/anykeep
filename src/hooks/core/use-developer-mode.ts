/**
 * 开发者模式 Hook
 * 管理用户的开发者工具可见性偏好
 *
 * 存储策略：localStorage（纯 UI 偏好，无需跨设备同步）
 *
 * @version 1.0.0
 * @since 2026-02-08
 */

"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "anykeep-developer-mode";

export interface UseDeveloperModeReturn {
  /** 是否启用开发者模式 */
  isDeveloperMode: boolean;
  /** 切换开发者模式 */
  toggleDeveloperMode: () => void;
  /** 设置开发者模式 */
  setDeveloperMode: (enabled: boolean) => void;
}

// 订阅 storage 事件（跨 Tab 同步）
const subscribers = new Set<() => void>();

function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

function notifySubscribers() {
  subscribers.forEach((cb) => cb());
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * 开发者模式管理 Hook
 *
 * 使用 useSyncExternalStore 读取 localStorage，避免 effect 内 setState。
 * 启用后侧边栏将显示开发者工具分组。
 */
export function useDeveloperMode(): UseDeveloperModeReturn {
  const isDeveloperMode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setDeveloperMode = useCallback((enabled: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // 静默降级
    }
    notifySubscribers();
  }, []);

  const toggleDeveloperMode = useCallback(() => {
    setDeveloperMode(!getSnapshot());
  }, [setDeveloperMode]);

  return {
    isDeveloperMode,
    toggleDeveloperMode,
    setDeveloperMode,
  };
}
