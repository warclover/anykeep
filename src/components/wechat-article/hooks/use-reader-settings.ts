/**
 * 微信文章阅读设置 Hook
 *
 * @module wechat-article/hooks
 * @description 管理阅读器字体、主题等设置
 *
 * Phase 4 升级：UX 优化 - 阅读器增强
 */

"use client";

import { useState, useCallback, useEffect } from "react";

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
const THEME_STYLES: Record<ReaderTheme, React.CSSProperties> = {
  default: {
    backgroundColor: "inherit",
    color: "inherit",
  },
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
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);

  // 从本地存储加载设置
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
        });
      }
    } catch {
      // 忽略解析错误
    }
  }, []);

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
      const clampedSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
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
  const getContentStyle = useCallback((): React.CSSProperties => {
    return {
      fontSize: `${settings.fontSize}px`,
      lineHeight: settings.lineHeight,
      ...THEME_STYLES[settings.theme],
    };
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
