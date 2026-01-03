/**
 * 待整理文件夹智能整理 Hook
 * 管理待整理文件夹的分析和建议处理
 *
 * 注意：此 hook 与 AI 聊天无关，主要用于文件夹聚类分析和整理建议。
 * 历史原因放置在 domain/ai/ 目录下，未来版本考虑迁移到 domain/folder/ 或 domain/analytics/。
 *
 * @version V4.2.24 - 性能优化：
 * - 添加 enabled 选项支持延迟加载
 * - 添加 SWR 缓存和去重
 * - 添加 requestIdleCallback 空闲时加载
 * - 改善超时错误处理
 *
 * @module hooks/domain/ai/use-inbox-organization
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type {
  OrganizationAnalysis,
  ClusterProcessingStatus,
} from "@/lib/classification";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";

// ============================================
// 类型定义
// ============================================

interface UseInboxOrganizationOptions {
  /** 是否启用数据获取（默认 true） */
  enabled?: boolean;
  /** 是否使用空闲时加载（默认 true） */
  useIdleCallback?: boolean;
  /** 延迟加载时间（毫秒），0 表示立即加载 */
  loadDelay?: number;
}

interface UseInboxOrganizationResult {
  /** 分析结果 */
  analysis: OrganizationAnalysis | null;
  /** V4.2 聚类处理状态 */
  clusterStatus: ClusterProcessingStatus | null;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新分析 */
  refresh: () => Promise<void>;
  /** 应用建议 */
  applySuggestion: (suggestionId: number) => Promise<boolean>;
  /** 拒绝建议 */
  rejectSuggestion: (suggestionId: number) => Promise<boolean>;
  /** 待处理建议数量 */
  pendingCount: number;
}

// ============================================
// 常量配置
// ============================================

/** API 请求超时时间（毫秒） */
const REQUEST_TIMEOUT = 8000;

/** SWR 缓存 Key */
const SWR_KEY = API_CLASSIFICATION.inbox;

// ============================================
// Fetcher 函数
// ============================================

/**
 * 带超时的 Inbox 分析 Fetcher
 */
async function inboxFetcher(url: string): Promise<OrganizationAnalysis> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error?.message || "获取整理建议失败");
    }

    const data = await response.json();
    return data.data;
  } catch (err) {
    // 处理超时错误
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("分析超时，请稍后重试");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================
// Hook 实现
// ============================================

export function useInboxOrganization(
  options: UseInboxOrganizationOptions = {},
): UseInboxOrganizationResult {
  const {
    enabled = true,
    useIdleCallback = true,
    loadDelay = 500, // 默认延迟 500ms
  } = options;

  // V4.2.24: 延迟加载控制
  const [shouldFetch, setShouldFetch] = useState(loadDelay === 0 && enabled);
  const hasInitialized = useRef(false);

  // 延迟加载逻辑
  useEffect(() => {
    if (!enabled || shouldFetch || hasInitialized.current) return;

    hasInitialized.current = true;
    let cleanup: (() => void) | undefined;

    if (
      useIdleCallback &&
      typeof window !== "undefined" &&
      "requestIdleCallback" in window
    ) {
      // 使用 requestIdleCallback 在浏览器空闲时加载
      const idleId = window.requestIdleCallback(
        () => setShouldFetch(true),
        { timeout: loadDelay + 2000 }, // 最大等待时间
      );
      cleanup = () => window.cancelIdleCallback(idleId);
    } else {
      // 回退到 setTimeout
      const timerId = setTimeout(() => setShouldFetch(true), loadDelay);
      cleanup = () => clearTimeout(timerId);
    }

    return cleanup;
  }, [enabled, loadDelay, useIdleCallback, shouldFetch]);

  // V4.2.24: 使用 SWR 进行数据获取和缓存
  const {
    data: analysis,
    error: swrError,
    isLoading,
    mutate,
  } = useSWR<OrganizationAnalysis>(
    shouldFetch ? SWR_KEY : null, // 条件获取
    inboxFetcher,
    {
      // 5 分钟内不重复请求（与服务端缓存 TTL 一致）
      dedupingInterval: 300000,
      // 不在聚焦时自动刷新（手动控制）
      revalidateOnFocus: false,
      // 网络恢复时不自动刷新
      revalidateOnReconnect: false,
      // 保持之前的数据（避免闪烁）
      keepPreviousData: true,
      // 错误重试配置
      errorRetryCount: 2,
      errorRetryInterval: 3000,
      // 失败时静默处理（不自动 toast）
      shouldRetryOnError: true,
    },
  );

  // 处理状态
  const [isProcessing, setIsProcessing] = useState(false);

  // 错误信息
  const error = swrError
    ? swrError instanceof Error
      ? swrError.message
      : "获取整理建议失败"
    : null;

  /**
   * 刷新分析
   */
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  /**
   * 应用建议
   */
  const applySuggestion = useCallback(
    async (suggestionId: number): Promise<boolean> => {
      setIsProcessing(true);

      try {
        const response = await fetch(API_CLASSIFICATION.inbox, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || "应用建议失败");
        }

        // 乐观更新：从列表中移除已应用的建议
        await mutate(
          (prev) =>
            prev
              ? {
                  ...prev,
                  suggestions: prev.suggestions.filter(
                    (s) => s.id !== suggestionId,
                  ),
                }
              : prev,
          { revalidate: false },
        );

        toast.success("建议已应用");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "应用建议失败";
        toast.error(message);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [mutate],
  );

  /**
   * 拒绝建议
   */
  const rejectSuggestion = useCallback(
    async (suggestionId: number): Promise<boolean> => {
      setIsProcessing(true);

      try {
        const response = await fetch(API_CLASSIFICATION.inbox, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || "忽略建议失败");
        }

        // 乐观更新：从列表中移除已拒绝的建议
        await mutate(
          (prev) =>
            prev
              ? {
                  ...prev,
                  suggestions: prev.suggestions.filter(
                    (s) => s.id !== suggestionId,
                  ),
                }
              : prev,
          { revalidate: false },
        );

        toast.success("已忽略该建议");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "忽略建议失败";
        toast.error(message);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [mutate],
  );

  // 计算待处理建议数量
  const pendingCount = analysis?.suggestions.length ?? 0;

  // V4.2: 获取聚类处理状态
  const clusterStatus = analysis?.clusterStatus ?? null;

  return {
    analysis: analysis ?? null,
    clusterStatus,
    isLoading: !shouldFetch || isLoading,
    isProcessing,
    error,
    refresh,
    applySuggestion,
    rejectSuggestion,
    pendingCount,
  };
}

export default useInboxOrganization;
