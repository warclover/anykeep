/**
 * MD 阅读器主题配置
 * Spec: md-reader-upgrade / REQ-1
 */

import type { ReaderTheme, ThemeId } from "../../types/reader";

/**
 * 阅读器主题配置
 * 4 种主题：明亮、暗黑、护眼、羊皮纸
 */
export const READER_THEMES: Record<ThemeId, ReaderTheme> = {
  light: {
    id: "light",
    name: "明亮",
    colors: {
      background: "#ffffff",
      foreground: "#1a1a1a",
      accent: "#2563eb",
      muted: "#f5f5f5",
      border: "#e5e5e5",
    },
  },
  dark: {
    id: "dark",
    name: "暗黑",
    colors: {
      background: "#1a1a1a",
      foreground: "#e5e5e5",
      accent: "#60a5fa",
      muted: "#2d2d2d",
      border: "#404040",
    },
  },
  sepia: {
    id: "sepia",
    name: "护眼",
    colors: {
      background: "#f0f7f4",
      foreground: "#2d4a3e",
      accent: "#0d9488",
      muted: "#e0efea",
      border: "#c6ddd4",
    },
  },
  paper: {
    id: "paper",
    name: "羊皮纸",
    colors: {
      background: "#faf8f5",
      foreground: "#3d3d3d",
      accent: "#6366f1",
      muted: "#f0ede8",
      border: "#e0ddd5",
    },
  },
} as const;

/**
 * 主题列表（用于 UI 渲染）
 */
export const THEME_LIST: ReaderTheme[] = Object.values(READER_THEMES);

/**
 * 默认主题 ID
 */
export const DEFAULT_THEME_ID: ThemeId = "light";

/**
 * localStorage 存储键
 */
export const THEME_STORAGE_KEY = "md-reader-theme";

/**
 * 将主题配置转换为 CSS 变量对象
 */
export function themeToCssVariables(
  theme: ReaderTheme,
): Record<string, string> {
  return {
    "--reader-bg": theme.colors.background,
    "--reader-fg": theme.colors.foreground,
    "--reader-accent": theme.colors.accent,
    "--reader-muted": theme.colors.muted,
    "--reader-border": theme.colors.border,
  };
}

/**
 * 检测系统暗色模式偏好
 */
export function getSystemThemePreference(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * 从 localStorage 获取保存的主题
 */
export function getSavedTheme(): ThemeId | null {
  if (typeof window === "undefined") return null;

  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && saved in READER_THEMES) {
      return saved as ThemeId;
    }
  } catch {
    // localStorage 不可用
  }
  return null;
}

/**
 * 保存主题到 localStorage
 */
export function saveTheme(themeId: ThemeId): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // localStorage 不可用
  }
}
