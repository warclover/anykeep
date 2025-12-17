/**
 * MD 收藏视图偏好 Hook
 * P2-007: Markdown 内容收藏 - 视图偏好持久化
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { STORAGE_KEYS } from "../constants";
import type { MdViewMode } from "../types";

interface UseMdViewPreferenceReturn {
  /** 当前视图模式 */
  viewMode: MdViewMode;
  /** 设置视图模式 */
  setViewMode: (mode: MdViewMode) => void;
  /** 切换视图模式 */
  toggleViewMode: () => void;
}

/**
 * MD 收藏视图偏好 Hook
 * 使用 localStorage 持久化用户的视图偏好
 */
export function useMdViewPreference(
  defaultMode: MdViewMode = "list",
): UseMdViewPreferenceReturn {
  // 初始化状态，从 localStorage 读取
  const [viewMode, setViewModeState] = useState<MdViewMode>(() => {
    if (typeof window === "undefined") {
      return defaultMode;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.VIEW_PREFERENCE);
      if (stored === "list" || stored === "card") {
        return stored;
      }
    } catch {
      // localStorage 不可用
    }

    return defaultMode;
  });

  // 设置视图模式并持久化
  const setViewMode = useCallback((mode: MdViewMode) => {
    setViewModeState(mode);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEYS.VIEW_PREFERENCE, mode);
      } catch {
        // localStorage 不可用
      }
    }
  }, []);

  // 切换视图模式
  const toggleViewMode = useCallback(() => {
    setViewMode(viewMode === "list" ? "card" : "list");
  }, [viewMode, setViewMode]);

  // 同步其他标签页的更改
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.VIEW_PREFERENCE && e.newValue) {
        if (e.newValue === "list" || e.newValue === "card") {
          setViewModeState(e.newValue);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return {
    viewMode,
    setViewMode,
    toggleViewMode,
  };
}

export default useMdViewPreference;
