/**
 * 主动简报 Hook
 *
 * 管理主动简报的获取、状态和操作
 *
 * @version 1.1.0
 * @since 2025-12-30
 * @updated 2026-02-01 - 添加请求去重机制
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  ProactiveBriefing,
  ProactiveInsight,
  BriefingApiResponse,
} from "@/lib/ai-agent/proactive-briefing";
import { requestDeduplicator } from "@/lib/utils/request-deduplicator";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 类型定义
// ============================================

/**
 * 加载状态
 */
export type BriefingLoadState =
  | "idle" // 空闲
  | "loading" // 加载中
  | "success" // 成功
  | "error"; // 错误

/**
 * Hook 状态值
 */
export interface UseBriefingState {
  /** 加载状态 */
  loadState: BriefingLoadState;
  /** 简报数据 */
  briefing: ProactiveBriefing | null;
  /** 未读洞察数量 */
  unreadCount: number;
  /** 错误信息 */
  error: string | null;
  /** 是否正在刷新 */
  isRefreshing: boolean;
  /** 生成耗时（毫秒） */
  generationTimeMs?: number;
}

/**
 * Hook 操作方法
 */
export interface UseBriefingActions {
  /** 刷新简报 */
  refresh: () => Promise<void>;
  /** 标记洞察为已读 */
  markRead: (insightId: string) => Promise<void>;
  /** 标记所有洞察为已读 */
  markAllRead: () => Promise<void>;
  /** 忽略洞察 */
  dismiss: (insightId: string) => Promise<void>;
}

/**
 * Hook 返回值
 */
export interface UseBriefingReturn {
  /** 状态 */
  state: UseBriefingState;
  /** 操作方法 */
  actions: UseBriefingActions;
}

/**
 * Hook 配置选项
 */
export interface UseBriefingOptions {
  /** 是否自动获取简报，默认 true */
  autoFetch?: boolean;
  /** 是否启用，默认 true */
  enabled?: boolean;
}

// ============================================
// 初始状态
// ============================================

const initialState: UseBriefingState = {
  loadState: "idle",
  briefing: null,
  unreadCount: 0,
  error: null,
  isRefreshing: false,
};

// ============================================
// Hook 实现
// ============================================

/**
 * 主动简报 Hook
 *
 * @example
 * ```tsx
 * const { state, actions } = useBriefing();
 *
 * // 刷新简报
 * await actions.refresh();
 *
 * // 标记已读
 * await actions.markRead(insightId);
 *
 * // 忽略洞察
 * await actions.dismiss(insightId);
 * ```
 */
export function useBriefing(
  options: UseBriefingOptions = {},
): UseBriefingReturn {
  const { autoFetch = true, enabled = true } = options;

  // 状态
  const [state, setState] = useState<UseBriefingState>(initialState);

  /**
   * 获取简报
   */
  const fetchBriefing = useCallback(async (isRefresh = false) => {
    setState((prev) => ({
      ...prev,
      loadState: isRefresh ? prev.loadState : "loading",
      isRefreshing: isRefresh,
      error: null,
    }));

    try {
      const url = "/api/agent/briefing";

      // 使用请求去重器，防止并发重复请求（仅 GET 请求去重���
      const result = isRefresh
        ? await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "refresh" }),
          }).then((r) => r.json())
        : await requestDeduplicator.dedupe("/api/agent/briefing", async () => {
            const response = await fetch(url);
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(
                errorData.error?.message || `请求失败: ${response.status}`,
              );
            }
            return response.json();
          });

      if (!result.success) {
        throw new Error(result.error?.message || "获取简报失败");
      }

      const data = result.data as BriefingApiResponse;

      setState({
        loadState: "success",
        briefing: data.briefing,
        unreadCount: data.unreadCount,
        error: null,
        isRefreshing: false,
        generationTimeMs: data.generationTimeMs,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loadState: "error",
        error: error instanceof Error ? error.message : "获取简报失败",
        isRefreshing: false,
      }));
    }
  }, []);

  /**
   * 刷新简报
   */
  const refresh = useCallback(async () => {
    await fetchBriefing(true);
  }, [fetchBriefing]);

  /**
   * 标记洞察为已读
   */
  const markRead = useCallback(async (insightId: string) => {
    try {
      const response = await fetch("/api/agent/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", insightId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "操作失败");
      }

      // 乐观更新：标记本地洞察为已读
      setState((prev) => {
        if (!prev.briefing) return prev;

        const updatedInsights = prev.briefing.pendingInsights.map((insight) =>
          insight.id === insightId ? { ...insight, isRead: true } : insight,
        );

        return {
          ...prev,
          briefing: {
            ...prev.briefing,
            pendingInsights: updatedInsights,
          },
          unreadCount: Math.max(0, prev.unreadCount - 1),
        };
      });
    } catch (error) {
      clientLogger.error({ error }, "Mark read failed:");
      throw error;
    }
  }, []);

  /**
   * 标记所有洞察为已读
   */
  const markAllRead = useCallback(async () => {
    try {
      const response = await fetch("/api/agent/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "操作失败");
      }

      // 乐观更新：标记所有洞察为已读
      setState((prev) => {
        if (!prev.briefing) return prev;

        const updatedInsights = prev.briefing.pendingInsights.map(
          (insight) => ({
            ...insight,
            isRead: true,
          }),
        );

        return {
          ...prev,
          briefing: {
            ...prev.briefing,
            pendingInsights: updatedInsights,
          },
          unreadCount: 0,
        };
      });
    } catch (error) {
      clientLogger.error({ error }, "Mark all read failed:");
      throw error;
    }
  }, []);

  /**
   * 忽略洞察
   */
  const dismiss = useCallback(async (insightId: string) => {
    try {
      const response = await fetch("/api/agent/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", insightId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "操作失败");
      }

      // 乐观更新：从列表中移除洞察
      setState((prev) => {
        if (!prev.briefing) return prev;

        const dismissedInsight = prev.briefing.pendingInsights.find(
          (i) => i.id === insightId,
        );
        const updatedInsights = prev.briefing.pendingInsights.filter(
          (insight) => insight.id !== insightId,
        );

        return {
          ...prev,
          briefing: {
            ...prev.briefing,
            pendingInsights: updatedInsights,
          },
          unreadCount: dismissedInsight?.isRead
            ? prev.unreadCount
            : Math.max(0, prev.unreadCount - 1),
        };
      });
    } catch (error) {
      clientLogger.error({ error }, "Dismiss failed:");
      throw error;
    }
  }, []);

  // 自动获取简报
  useEffect(() => {
    if (enabled && autoFetch) {
      fetchBriefing(false);
    }
  }, [enabled, autoFetch, fetchBriefing]);

  return {
    state,
    actions: {
      refresh,
      markRead,
      markAllRead,
      dismiss,
    },
  };
}

// ============================================
// 辅助 Hook
// ============================================

/**
 * 获取洞察的显示配置
 */
export function useInsightConfig(type: ProactiveInsight["type"]) {
  const configMap: Record<
    ProactiveInsight["type"],
    { label: string; icon: string; color: string; bgColor: string }
  > = {
    topic_emergence: {
      label: "新主题发现",
      icon: "Sparkles",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    pattern_detected: {
      label: "模式检测",
      icon: "TrendingUp",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    recommendation: {
      label: "推荐内容",
      icon: "Lightbulb",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    knowledge_gap: {
      label: "知识盲区",
      icon: "AlertCircle",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    content_update: {
      label: "内容更新",
      icon: "RefreshCw",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
  };

  return configMap[type];
}
