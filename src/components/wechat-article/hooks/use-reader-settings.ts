/**
 * 微信文章阅读设置 Hook
 *
 * @module wechat-article/hooks
 * @description 管理阅读器字体、主题等设置
 *
 * Phase 4 升级：UX 优化 - 阅读器增强
 */

"use client";

import { useState, useCallback } from "react";

// =============================================================================
// 类型定义
// =============================================================================

export type ReaderTheme = "default" | "sepia" | "dark";

export interface ReaderSettings {
  /** 字体大小 (px) */
  fontSize: number;
  /** 阅读主题 */
  theme: ReaderTheme;
  /** 行高倍数 */
  lineHeight: number;
}

export interface UseReaderSettingsReturn {
  /** 当前设置 */
  settings: ReaderSettings;
  /** 更新字体大小 */
  setFontSize: (size: number) => void;
  /** 增加字体大小 */
  increaseFontSize: () => void;
  /** 减少字体大小 */
  decreaseFontSize: () => void;
  /** 更新主题 */
  setTheme: (theme: ReaderTheme) => void;
  /** 更新行高 */
  setLineHeight: (height: number) => void;
  /** 重置为默认值 */
  resetSettings: () => void;
  /** 生成内容样式 */
  getContentStyle: () => React.CSSProperties;
}

// =============================================================================
// 常量
// =============================================================================

const STORAGE_KEY = "wechat-reader-settings";

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 16,
  theme: "default",
  lineHeight: 1.8,
};

const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 24;
const FONT_SIZE_STEP = 2;

// 主题对应的样式
// default 主题不设置 color/backgroundColor，让 .reading-prose CSS 类生效
const THEME_STYLES: Record<ReaderTheme, React.CSSProperties> = {
  default: {},
  sepia: {
    backgroundColor: "#f4ecd8",
    color: "#5b4636",
  },
  dark: {
    backgroundColor: "#1a1a1a",
    color: "#d4d4d4",
  },
};

// =============================================================================
// Hook 实现
// =============================================================================

/**
 * 阅读器设置 Hook
 *
 * 功能：
 * - 字体大小调节（12-24px）
 * - 阅读主题切换
 * - 行高调节
 * - 本地存储持久化
 */
export function useReaderSettings(): UseReaderSettingsReturn {
  // 使用惰性初始化从 localStorage 加载设置（避免 useEffect 中 setState）
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    // SSR: 返回默认值
    if (typeof window === "undefined") {
      return DEFAULT_SETTINGS;
    }
    // 客户端: 尝试从 localStorage 加载
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
        };
      }
    } catch {
      // 忽略解析错误
    }
    return DEFAULT_SETTINGS;
  });

  // 保存设置到本地存储
  const saveSettings = useCallback((newSettings: ReaderSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch {
      // 忽略存储错误
    }
  }, []);

  // 更新字体大小
  const setFontSize = useCallback(
    (size: number) => {
      const clampedSize = Math.max(
        MIN_FONT_SIZE,
        Math.min(MAX_FONT_SIZE, size),
      );
      const newSettings = { ...settings, fontSize: clampedSize };
      setSettings(newSettings);
      saveSettings(newSettings);
    },
    [settings, saveSettings],
  );

  // 增加字体大小
  const increaseFontSize = useCallback(() => {
    setFontSize(settings.fontSize + FONT_SIZE_STEP);
  }, [settings.fontSize, setFontSize]);

  // 减少字体大小
  const decreaseFontSize = useCallback(() => {
    setFontSize(settings.fontSize - FONT_SIZE_STEP);
  }, [settings.fontSize, setFontSize]);

  // 更新主题
  const setTheme = useCallback(
    (theme: ReaderTheme) => {
      const newSettings = { ...settings, theme };
      setSettings(newSettings);
      saveSettings(newSettings);
    },
    [settings, saveSettings],
  );

  // 更新行高
  const setLineHeight = useCallback(
    (lineHeight: number) => {
      const newSettings = { ...settings, lineHeight };
      setSettings(newSettings);
      saveSettings(newSettings);
    },
    [settings, saveSettings],
  );

  // 重置设置
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, [saveSettings]);

  // 生成内容样式
  // 仅在用户主动调整了设置时输出内联样式，避免覆盖 .reading-prose CSS 类的默认值
  const getContentStyle = useCallback((): React.CSSProperties => {
    const style: React.CSSProperties = {};

    // 仅当字号偏离默认值时输出，否则让 .reading-prose 的 font-size 生效
    if (settings.fontSize !== DEFAULT_SETTINGS.fontSize) {
      style.fontSize = `${settings.fontSize}px`;
    }

    // 仅当行高偏离默认值时输出
    if (settings.lineHeight !== DEFAULT_SETTINGS.lineHeight) {
      style.lineHeight = settings.lineHeight;
    }

    // 主题样式（default 主题为空对象，不覆盖 CSS 类）
    Object.assign(style, THEME_STYLES[settings.theme]);

    return style;
  }, [settings]);

  return {
    settings,
    setFontSize,
    increaseFontSize,
    decreaseFontSize,
    setTheme,
    setLineHeight,
    resetSettings,
    getContentStyle,
  };
}
