"use client";

/**
 * useDisplayMode Hook
 * 待确认分类建议 - 展示模式切换和持久化
 *
 * @description
 * - 支持内联模式和抽屉模式切换
 * - 用户偏好持久化到 localStorage
 * - 提供配置项管理
 *
 * @version 2.0.0
 * @since 2025-12-14
 */

import { useState, useEffect, useCallback } from "react";
import type {
  DisplayMode,
  DisplayModeConfig,
  UseDisplayModeReturn,
} from "../types";

// ============================================================================
// 常量
// ============================================================================

const STORAGE_KEY = "anykeep:confirmation-display-mode";
const DEFAULT_CONFIG: DisplayModeConfig = {
  mode: "inline", // 默认使用内联模式
  autoConfirmThreshold: undefined, // 默认不自动确认
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 从 localStorage 读取配置
 */
function loadConfig(): DisplayModeConfig {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
      };
    }
  } catch {
    // 静默忽略 localStorage 读取错误
  }

  return DEFAULT_CONFIG;
}

/**
 * 保存配置到 localStorage
 */
function saveConfig(config: DisplayModeConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // 静默忽略 localStorage 写入错误
  }
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useDisplayMode(): UseDisplayModeReturn {
  const [config, setConfig] = useState<DisplayModeConfig>(DEFAULT_CONFIG);
  const [isHydrated, setIsHydrated] = useState(false);

  // 客户端水合后从 localStorage 加载配置
  useEffect(() => {
    // 使用 requestAnimationFrame 避免同步 setState 警告
    const frameId = requestAnimationFrame(() => {
      setConfig(loadConfig());
      setIsHydrated(true);
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  // 设置模式
  const setMode = useCallback((mode: DisplayMode) => {
    setConfig((prev) => {
      const newConfig = { ...prev, mode };
      saveConfig(newConfig);
      return newConfig;
    });
  }, []);

  // 切换模式
  const toggleMode = useCallback(() => {
    setConfig((prev) => {
      const newMode: DisplayMode = prev.mode === "inline" ? "drawer" : "inline";
      const newConfig = { ...prev, mode: newMode };
      saveConfig(newConfig);
      return newConfig;
    });
  }, []);

  // 更新配置
  const updateConfig = useCallback((partial: Partial<DisplayModeConfig>) => {
    setConfig((prev) => {
      const newConfig = { ...prev, ...partial };
      saveConfig(newConfig);
      return newConfig;
    });
  }, []);

  // 在水合完成前使用默认值，避免 SSR 不匹配
  const effectiveMode = isHydrated ? config.mode : DEFAULT_CONFIG.mode;

  return {
    mode: effectiveMode,
    setMode,
    toggleMode,
    config,
    updateConfig,
  };
}
