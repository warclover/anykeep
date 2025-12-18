/**
 * AI 摘要调试配置 Hook
 *
 * 提供响应式的调试配置状态管理
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getDebugConfig,
  setDebugConfig,
  resetDebugConfig,
  CONFIG_CHANGED_EVENT,
  isDevEnvironment,
  type AIDebugConfig,
} from "@/lib/classification/config/debug-config-store";

/**
 * 使用调试配置的 Hook
 *
 * @returns [config, updateConfig, resetConfig, isEnabled]
 */
export function useDebugConfig() {
  const [config, setConfig] = useState<AIDebugConfig>(() => getDebugConfig());
  // 使用初始化函数避免在 effect 中调用 setState
  const [isEnabled] = useState(() => isDevEnvironment());

  // 监听配置变更事件
  useEffect(() => {
    const handleConfigChange = (event: CustomEvent<AIDebugConfig>) => {
      setConfig(event.detail);
    };

    window.addEventListener(
      CONFIG_CHANGED_EVENT,
      handleConfigChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        CONFIG_CHANGED_EVENT,
        handleConfigChange as EventListener,
      );
    };
  }, []);

  /**
   * 更新配置
   */
  const updateConfig = useCallback((updates: Partial<AIDebugConfig>) => {
    setDebugConfig(updates);
    // 状态会通过事件自动更新
  }, []);

  /**
   * 重置配置
   */
  const reset = useCallback(() => {
    resetDebugConfig();
    setConfig(getDebugConfig());
  }, []);

  return {
    config,
    updateConfig,
    resetConfig: reset,
    isEnabled,
  };
}

/**
 * 简化的配置开关 Hook
 */
export function useDebugConfigToggle() {
  const { config, updateConfig } = useDebugConfig();

  const toggle = useCallback(() => {
    updateConfig({ enabled: !config.enabled });
  }, [config.enabled, updateConfig]);

  return {
    enabled: config.enabled,
    toggle,
    setEnabled: (enabled: boolean) => updateConfig({ enabled }),
  };
}
