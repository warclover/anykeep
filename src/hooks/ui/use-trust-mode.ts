/**
 * Trust Mode Hook
 * V4.2 托管模式状态管理 Hook
 *
 * @description 提供托管模式的状态访问和切换功能
 * - 获取当前托管模式
 * - 切换托管模式
 * - 获取模式相关统计
 * - 支持乐观更新
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { TrustMode, TrustModeConfig } from "@/types/trust-mode";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";

// ============================================================================
// 类型定义
// ============================================================================

export interface TrustModeStats {
  autoDecisions: number;
  userCorrections: number;
  pendingConfirmations: number;
  correctionRate: number;
}

export interface TrustModeState {
  mode: TrustMode;
  config: TrustModeConfig;
  stats: TrustModeStats | null;
}

export interface SwitchOptions {
  processPendingAs: "keep" | "auto_execute" | "discard";
  preserveLearning: boolean;
}

interface UseTrustModeReturn {
  // 状态
  mode: TrustMode;
  config: TrustModeConfig | null;
  stats: TrustModeStats | null;
  isLoading: boolean;
  error: string | null;

  // 派生状态
  isFullAuto: boolean;
  isSemiAuto: boolean;
  isManual: boolean;
  autoConfirmThreshold: number;

  // 操作
  switchMode: (newMode: TrustMode, options?: SwitchOptions) => Promise<boolean>;
  updateConfig: (updates: Partial<TrustModeConfig>) => Promise<boolean>;
  refresh: () => Promise<void>;
}

// ============================================================================
// 默认值
// ============================================================================

const DEFAULT_CONFIG: TrustModeConfig = {
  mode: "full_auto",
  classification: {
    autoClassify: true,
    requireConfirmation: false,
    lowConfidenceAction: "auto_inbox_then_cluster",
    confirmationThreshold: 80,
  },
  folderManagement: {
    autoCreate: true,
    autoMerge: false,
    autoSplit: false,
    autoRename: false,
    dailyCreateLimit: 100,
  },
  notification: {
    onClassification: false,
    onLowConfidence: false,
    onFolderCreate: false,
  },
  learning: {
    learnFromManualMoves: true,
    learnFromDeletions: true,
    askForFeedback: false,
  },
};

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 托管模式 Hook
 */
export function useTrustMode(): UseTrustModeReturn {
  const [mode, setMode] = useState<TrustMode>("full_auto");
  const [config, setConfig] = useState<TrustModeConfig | null>(null);
  const [stats, setStats] = useState<TrustModeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载托管模式设置
  const loadTrustMode = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/settings/trust-mode");
      if (!response.ok) {
        throw new Error("Failed to load trust mode settings");
      }

      const result = await response.json();

      if (result.success && result.data) {
        setMode(result.data.mode || "full_auto");
        setConfig(result.data.config || DEFAULT_CONFIG);
        setStats(result.data.stats || null);
      } else {
        // 使用默认值
        setMode("full_auto");
        setConfig(DEFAULT_CONFIG);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      clientLogger.error({ err }, "[TrustMode] Failed to load trust mode");

      // 使用默认值
      setMode("full_auto");
      setConfig(DEFAULT_CONFIG);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadTrustMode();
  }, [loadTrustMode]);

  // 切换模式
  const switchMode = useCallback(
    async (newMode: TrustMode, options?: SwitchOptions): Promise<boolean> => {
      const previousMode = mode;
      const previousConfig = config;

      // 乐观更新
      setMode(newMode);

      try {
        const response = await fetch("/api/settings/trust-mode", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: newMode,
            ...(options && {
              processPendingAs: options.processPendingAs,
              preserveLearning: options.preserveLearning,
            }),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to switch trust mode");
        }

        const result = await response.json();

        if (result.success) {
          // 更新配置
          if (result.data?.config) {
            setConfig(result.data.config);
          }
          toast.success(`已切换到${getModeLabel(newMode)}模式`);
          return true;
        } else {
          throw new Error(result.error || "Switch failed");
        }
      } catch (err) {
        // 回滚
        setMode(previousMode);
        setConfig(previousConfig);

        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error(`切换失败: ${message}`);
        clientLogger.error({ err }, "[TrustMode] Failed to switch trust mode");
        return false;
      }
    },
    [mode, config],
  );

  // 更新配置
  const updateConfig = useCallback(
    async (updates: Partial<TrustModeConfig>): Promise<boolean> => {
      const previousConfig = config;

      // 乐观更新
      setConfig((prev) => (prev ? { ...prev, ...updates } : prev));

      try {
        const response = await fetch("/api/settings/trust-mode", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error("Failed to update config");
        }

        const result = await response.json();

        if (result.success) {
          if (result.data?.config) {
            setConfig(result.data.config);
          }
          return true;
        } else {
          throw new Error(result.error || "Update failed");
        }
      } catch (err) {
        // 回滚
        setConfig(previousConfig);

        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error(`更新失败: ${message}`);
        clientLogger.error(
          { err },
          "[TrustMode] Failed to update trust mode config",
        );
        return false;
      }
    },
    [config],
  );

  // 派生状态
  const isFullAuto = mode === "full_auto";
  const isSemiAuto = mode === "semi_auto";
  const isManual = mode === "manual";
  const autoConfirmThreshold =
    config?.classification?.confirmationThreshold || 80;

  // Memoized 返回值
  return useMemo(
    () => ({
      mode,
      config,
      stats,
      isLoading,
      error,
      isFullAuto,
      isSemiAuto,
      isManual,
      autoConfirmThreshold,
      switchMode,
      updateConfig,
      refresh: loadTrustMode,
    }),
    [
      mode,
      config,
      stats,
      isLoading,
      error,
      isFullAuto,
      isSemiAuto,
      isManual,
      autoConfirmThreshold,
      switchMode,
      updateConfig,
      loadTrustMode,
    ],
  );
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取模式标签
 */
function getModeLabel(mode: TrustMode): string {
  const labels: Record<TrustMode, string> = {
    full_auto: "全自动",
    semi_auto: "半自动",
    manual: "手动",
  };
  return labels[mode] || mode;
}

/**
 * 检查是否需要确认
 */
export function shouldRequireConfirmation(
  mode: TrustMode,
  confidence: number,
  threshold: number,
): boolean {
  if (mode === "manual") return false; // 手动模式不自动分类
  if (mode === "full_auto") return false; // 全自动模式不需要确认
  return confidence < threshold; // 半自动模式低于阈值需确认
}

/**
 * 获取默认配置
 */
export function getDefaultConfig(): TrustModeConfig {
  return { ...DEFAULT_CONFIG };
}

export default useTrustMode;
