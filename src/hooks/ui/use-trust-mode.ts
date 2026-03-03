"use client";

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
 * V2.0 - TanStack Query 迁移：同一 query key 全局只发 1 次 GET，多页面/Strict Mode 共享缓存，减少重复 3s+ 请求
 *
 * @version 2.0.0
 * @since 2025-12-11
 */

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TrustMode, TrustModeConfig } from "@/types/trust-mode";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import { trustModeKeys } from "@/hooks/queries/keys";

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

/** GET 接口返回的 data 形状 */
interface TrustModeApiData {
  mode: TrustMode;
  config: TrustModeConfig;
  stats: TrustModeStats | null;
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

const API_URL = "/api/settings/trust-mode";
const STALE_TIME_MS = 5 * 60 * 1000;

// ============================================================================
// Fetcher
// ============================================================================

async function fetchTrustMode(): Promise<TrustModeApiData> {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error("Failed to load trust mode settings");
  }
  const result = await response.json();
  if (!result.success || !result.data) {
    return {
      mode: "full_auto",
      config: DEFAULT_CONFIG,
      stats: null,
    };
  }
  return {
    mode: result.data.mode || "full_auto",
    config: result.data.config || DEFAULT_CONFIG,
    stats: result.data.stats ?? null,
  };
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 托管模式 Hook（TanStack Query：全局单次请求 + 缓存共享）
 */
export function useTrustMode(): UseTrustModeReturn {
  const queryClient = useQueryClient();
  const key = trustModeKeys.current();

  const {
    data,
    error: queryError,
    isLoading,
  } = useQuery({
    queryKey: key,
    queryFn: fetchTrustMode,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
    retryDelay: 2000,
  });

  const mode = data?.mode ?? "full_auto";
  const config = data?.config ?? null;
  const stats = data?.stats ?? null;
  const error = queryError ? (queryError as Error).message : null;

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: key });
  }, [queryClient, key]);

  const switchMode = useCallback(
    async (newMode: TrustMode, options?: SwitchOptions): Promise<boolean> => {
      const previousData = queryClient.getQueryData<TrustModeApiData>(key);

      // 乐观更新
      if (previousData) {
        queryClient.setQueryData<TrustModeApiData>(key, {
          ...previousData,
          mode: newMode,
        });
      }

      try {
        const response = await fetch(API_URL, {
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
        if (result.success && result.data) {
          queryClient.setQueryData<TrustModeApiData>(key, {
            mode: result.data.mode || newMode,
            config:
              result.data.config || previousData?.config || DEFAULT_CONFIG,
            stats: result.data.stats ?? previousData?.stats ?? null,
          });
          toast.success(`已切换到${getModeLabel(newMode)}模式`);
          return true;
        }
        throw new Error(result.error || "Switch failed");
      } catch (err) {
        if (previousData) {
          queryClient.setQueryData(key, previousData);
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error(`切换失败: ${message}`);
        clientLogger.error({ err }, "[TrustMode] Failed to switch trust mode");
        return false;
      }
    },
    [queryClient, key],
  );

  const updateConfig = useCallback(
    async (updates: Partial<TrustModeConfig>): Promise<boolean> => {
      const previousData = queryClient.getQueryData<TrustModeApiData>(key);

      if (previousData?.config) {
        queryClient.setQueryData<TrustModeApiData>(key, {
          ...previousData,
          config: { ...previousData.config, ...updates },
        });
      }

      try {
        const response = await fetch(API_URL, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error("Failed to update config");
        }

        const result = await response.json();
        if (result.success && result.data?.config) {
          queryClient.setQueryData<TrustModeApiData>(key, {
            mode: previousData?.mode ?? "full_auto",
            config: result.data.config,
            stats: previousData?.stats ?? null,
          });
          return true;
        }
        throw new Error(result.error || "Update failed");
      } catch (err) {
        if (previousData) {
          queryClient.setQueryData(key, previousData);
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error(`更新失败: ${message}`);
        clientLogger.error(
          { err },
          "[TrustMode] Failed to update trust mode config",
        );
        return false;
      }
    },
    [queryClient, key],
  );

  const isFullAuto = mode === "full_auto";
  const isSemiAuto = mode === "semi_auto";
  const isManual = mode === "manual";
  const autoConfirmThreshold =
    config?.classification?.confirmationThreshold ?? 80;

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
      refresh,
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
      refresh,
    ],
  );
}

// ============================================================================
// 辅助函数
// ============================================================================

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
  if (mode === "manual") return false;
  if (mode === "full_auto") return false;
  return confidence < threshold;
}

export function getDefaultConfig(): TrustModeConfig {
  return { ...DEFAULT_CONFIG };
}

export default useTrustMode;
