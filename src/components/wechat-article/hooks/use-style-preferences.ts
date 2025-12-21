/**
 * 微信文章样式偏好 Hook
 *
 * @module wechat-article/hooks
 * @description 管理用户样式保留级别偏好
 *
 * 样式选项升级：用户偏好持久化
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import type { StylePreserveLevel } from "@/lib/wechat-article/wechat-article.config";
import {
  DEFAULT_WECHAT_PREFERENCES,
  WECHAT_PREFERENCES_STORAGE_KEY,
  type WechatArticleUserPreferences,
} from "@/lib/wechat-article/wechat-article.types";

// =============================================================================
// 类型定义
// =============================================================================

export interface UseStylePreferencesReturn {
  /** 当前偏好设置 */
  preferences: WechatArticleUserPreferences;
  /** 当前默认样式级别 */
  styleLevel: StylePreserveLevel;
  /** 设置样式级别 */
  setStyleLevel: (level: StylePreserveLevel) => void;
  /** 设置"记住选择"开关 */
  setRememberChoice: (remember: boolean) => void;
  /** 重置为默认值 */
  resetPreferences: () => void;
  /** 是否已从存储加载 */
  isLoaded: boolean;
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 从 localStorage 加载偏好设置
 */
function loadPreferences(): WechatArticleUserPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_WECHAT_PREFERENCES;
  }

  try {
    const stored = localStorage.getItem(WECHAT_PREFERENCES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // 验证数据结构
      if (
        typeof parsed.defaultStyleLevel === "string" &&
        typeof parsed.rememberChoice === "boolean"
      ) {
        return parsed as WechatArticleUserPreferences;
      }
    }
  } catch (error) {
    console.warn("[useStylePreferences] Failed to load preferences:", error);
  }

  return DEFAULT_WECHAT_PREFERENCES;
}

/**
 * 保存偏好设置到 localStorage
 */
function savePreferences(preferences: WechatArticleUserPreferences): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      WECHAT_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  } catch (error) {
    console.warn("[useStylePreferences] Failed to save preferences:", error);
  }
}

// =============================================================================
// Hook 实现
// =============================================================================

/**
 * 用户样式偏好 Hook
 *
 * 功能：
 * - 从 localStorage 加载偏好
 * - 持久化用户选择
 * - 支持"记住我的选择"开关
 */
export function useStylePreferences(): UseStylePreferencesReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [preferences, setPreferences] = useState<WechatArticleUserPreferences>(
    DEFAULT_WECHAT_PREFERENCES,
  );

  // 客户端挂载时加载偏好
  useEffect(() => {
    const loaded = loadPreferences();
    setPreferences(loaded);
    setIsLoaded(true);
  }, []);

  // 设置样式级别
  const setStyleLevel = useCallback(
    (level: StylePreserveLevel) => {
      setPreferences((prev) => {
        const updated = { ...prev, defaultStyleLevel: level };
        // 仅在"记住选择"开启时保存
        if (prev.rememberChoice) {
          savePreferences(updated);
        }
        return updated;
      });
    },
    [],
  );

  // 设置"记住选择"开关
  const setRememberChoice = useCallback(
    (remember: boolean) => {
      setPreferences((prev) => {
        const updated = { ...prev, rememberChoice: remember };
        // 保存新设置
        savePreferences(updated);
        return updated;
      });
    },
    [],
  );

  // 重置为默认值
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_WECHAT_PREFERENCES);
    if (typeof window !== "undefined") {
      localStorage.removeItem(WECHAT_PREFERENCES_STORAGE_KEY);
    }
  }, []);

  return {
    preferences,
    styleLevel: preferences.defaultStyleLevel,
    setStyleLevel,
    setRememberChoice,
    resetPreferences,
    isLoaded,
  };
}

export default useStylePreferences;
