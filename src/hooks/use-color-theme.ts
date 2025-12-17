/**
 * 颜色主题 Hook
 * 管理用户的品牌色偏好
 *
 * V4.2.25: 支持三种品牌色主题（知性蓝/活力紫/温暖橙）
 *
 * @version 1.0.0
 * @since 2025-12-17
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { ColorTheme } from "@/types/user-settings";

const STORAGE_KEY = "anykeep-color-theme";
const DEFAULT_THEME: ColorTheme = "blue";
const VALID_THEMES: ColorTheme[] = ["blue", "purple", "orange"];

export interface UseColorThemeReturn {
  /** 当前颜色主题 */
  colorTheme: ColorTheme;
  /** 设置颜色主题 */
  setColorTheme: (theme: ColorTheme) => void;
  /** 是否已加载完成 */
  isLoaded: boolean;
}

/**
 * 验证主题值是否有效
 */
function isValidTheme(value: string | null): value is ColorTheme {
  return value !== null && VALID_THEMES.includes(value as ColorTheme);
}

/**
 * 应用主题到 DOM
 */
function applyTheme(theme: ColorTheme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-color-theme", theme);
  }
}

/**
 * 从 localStorage 读取初始主题（SSR 安全）
 */
function getInitialTheme(): ColorTheme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isValidTheme(stored)) {
      return stored;
    }
  } catch {
    // localStorage 不可用
  }
  return DEFAULT_THEME;
}

export function useColorTheme(): UseColorThemeReturn {
  // 使用 lazy initializer 避免 effect 中 setState
  const [colorTheme, setColorThemeState] =
    useState<ColorTheme>(getInitialTheme);
  // 客户端渲染时直接标记为已加载（lazy initializer 避免 effect 中 setState）
  const [isLoaded] = useState(() => typeof window !== "undefined");

  // 应用主题到 DOM（仅当主题变化时）
  useEffect(() => {
    applyTheme(colorTheme);
  }, [colorTheme]);

  // 设置主题
  const setColorTheme = useCallback((theme: ColorTheme) => {
    if (!isValidTheme(theme)) {
      // 无效主题值，静默忽略
      return;
    }

    setColorThemeState(theme);

    // 保存到 localStorage
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage 不可用时静默失败
    }

    // 应用到 DOM
    applyTheme(theme);

    // 异步同步到服务器（不阻塞 UI）
    fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appearance: { colorTheme: theme } }),
    }).catch(() => {
      // 静默失败，本地已保存
    });
  }, []);

  return {
    colorTheme,
    setColorTheme,
    isLoaded,
  };
}

// ============================================
// 工具函数
// ============================================

/**
 * 获取主题的显示信息
 */
export const COLOR_THEME_INFO: Record<
  ColorTheme,
  {
    name: string;
    description: string;
    gradient: string;
    primaryColor: string;
  }
> = {
  blue: {
    name: "知性蓝",
    description: "专业稳重，适合知识管理",
    gradient: "from-blue-500 to-blue-400",
    primaryColor: "#3b82f6",
  },
  purple: {
    name: "活力紫",
    description: "创意灵感，激发想象力",
    gradient: "from-purple-500 to-purple-400",
    primaryColor: "#8b5cf6",
  },
  orange: {
    name: "温暖橙",
    description: "高效能量，提升专注力",
    gradient: "from-orange-500 to-orange-400",
    primaryColor: "#f97316",
  },
};

/**
 * 预加载主题（在页面加载前执行）
 * 用于防止闪烁的内联脚本
 */
export const COLOR_THEME_INIT_SCRIPT = `
(function() {
  try {
    var theme = localStorage.getItem('${STORAGE_KEY}');
    if (theme && ['blue', 'purple', 'orange'].includes(theme)) {
      document.documentElement.setAttribute('data-color-theme', theme);
    } else {
      document.documentElement.setAttribute('data-color-theme', '${DEFAULT_THEME}');
    }
  } catch (e) {
    document.documentElement.setAttribute('data-color-theme', '${DEFAULT_THEME}');
  }
})();
`;
