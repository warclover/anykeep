/**
 * MD 阅读器主题 Hook
 * Spec: md-reader-upgrade / REQ-1
 */

"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type {
  ThemeId,
  ReaderTheme,
  ReaderThemeContextValue,
} from "../../types/reader";
import {
  READER_THEMES,
  THEME_LIST,
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
  getSavedTheme,
  saveTheme,
  getSystemThemePreference,
} from "../../lib/reader/theme-config";

/**
 * useReaderTheme Hook 返回值
 */
export interface UseReaderThemeReturn extends ReaderThemeContextValue {
  /** 是否已挂载（用于 SSR hydration） */
  isMounted: boolean;
}

/**
 * useReaderTheme Hook 选项
 */
export interface UseReaderThemeOptions {
  /** 是否跟随系统主题（默认 true） */
  followSystem?: boolean;
  /** 默认主题（未保存时使用） */
  defaultTheme?: ThemeId;
}

/**
 * MD 阅读器主题 Hook
 *
 * 功能：
 * - 管理主题状态（localStorage 持久化）
 * - 提供 setTheme 方法
 * - 监听系统暗色模式偏好变化
 * - 同步跨标签页主题变更
 * - 处理 SSR hydration 不匹配
 *
 * @example
 * ```tsx
 * function ReaderPage() {
 *   const { theme, setTheme, themes, isMounted } = useReaderTheme();
 *
 *   if (!isMounted) return null; // 避免 hydration 不匹配
 *
 *   return (
 *     <div style={{ background: theme.colors.background }}>
 *       {themes.map(t => (
 *         <button key={t.id} onClick={() => setTheme(t.id)}>
 *           {t.name}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useReaderTheme(
  options: UseReaderThemeOptions = {},
): UseReaderThemeReturn {
  const { followSystem = true, defaultTheme = DEFAULT_THEME_ID } = options;

  // 是否已挂载（客户端）— 使用 ref 避免额外渲染
  const mountedRef = useRef(false);
  const [isMounted, setIsMounted] = useState(false);

  // 初始化主题状态
  // SSR 和客户端首次渲染（hydration）都使用默认主题，确保输出一致
  // 客户端挂载后（useEffect）再从 localStorage 读取用户偏好
  const [themeId, setThemeIdState] = useState<ThemeId>(defaultTheme);

  // 挂载后从 localStorage 读取用户偏好并切换主题
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    // 使用 queueMicrotask 延迟 setState，满足 react-hooks/set-state-in-effect 规则
    queueMicrotask(() => {
      const saved = getSavedTheme();
      if (saved) {
        setThemeIdState(saved);
      } else if (followSystem) {
        setThemeIdState(getSystemThemePreference());
      }
      setIsMounted(true);
    });
  }, [followSystem]);

  // 设置主题并持久化
  const setTheme = useCallback((id: ThemeId) => {
    if (!(id in READER_THEMES)) {
      // 静默忽略无效的主题 ID
      return;
    }

    setThemeIdState(id);
    saveTheme(id);
  }, []);

  // 监听系统主题偏好变化
  useEffect(() => {
    if (typeof window === "undefined" || !followSystem) return;

    // 如果用户已手动选择主题，不跟随系统
    const savedTheme = getSavedTheme();
    if (savedTheme) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? "dark" : "light";
      setThemeIdState(newTheme);
    };

    // 添加监听器
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [followSystem]);

  // 监听跨标签页的 localStorage 变化
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        if (e.newValue in READER_THEMES) {
          setThemeIdState(e.newValue as ThemeId);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // 获取当前主题配置
  const theme = useMemo<ReaderTheme>(() => {
    return READER_THEMES[themeId];
  }, [themeId]);

  // 返回所有主题列表
  const themes = useMemo<ReaderTheme[]>(() => {
    return THEME_LIST;
  }, []);

  return {
    theme,
    setTheme,
    themes,
    isMounted,
  };
}

export default useReaderTheme;
