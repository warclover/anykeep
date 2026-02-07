/**
 * 聚类统计 Hook
 *
 * 获取用户待聚类书签的统计信息，用于显示待处理数量徽章
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { clientLogger } from "@/lib/client-logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 聚类统计数据
 */
export interface ClusterStats {
  /** 待聚类总数 */
  totalPending: number;
  /** 已聚类数量 */
  clusteredCount: number;
  /** 未聚类数量 */
  unclusteredCount: number;
  /** 聚类组数 */
  clusterCount: number;
  /** 最早待聚类时间 */
  oldestPending: string | null;
}

/**
 * Hook 返回值
 */
export interface UseClusterStatsReturn {
  /** 聚类统计数据 */
  stats: ClusterStats | null;
  /** 待处理数量（快捷访问） */
  pendingCount: number;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新数据 */
  refresh: () => Promise<void>;
}

// ============================================================================
// 查询键
// ============================================================================

const QUERY_KEY = ["cluster-stats"] as const;

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 聚类统计 Hook
 *
 * @example
 * ```tsx
 * const { pendingCount, isLoading } = useClusterStats();
 * // 在快速操作卡片上显示徽章
 * {pendingCount > 0 && <Badge>{pendingCount}</Badge>}
 * ```
 */
export function useClusterStats(): UseClusterStatsReturn {
  const queryClient = useQueryClient();

  // ==================== 数据查询 ====================
  const {
    data: stats,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ClusterStats> => {
      const supabase = createClient();

      const { data, error } = await supabase.rpc("get_user_cluster_stats");

      if (error) {
        clientLogger.error({ error }, "[useClusterStats] RPC error");
        throw new Error(error.message);
      }

      // RPC 返回数组格式，取第一个结果
      const result = Array.isArray(data) ? data[0] : data;

      if (!result) {
        // 无数据时返回默认值
        return {
          totalPending: 0,
          clusteredCount: 0,
          unclusteredCount: 0,
          clusterCount: 0,
          oldestPending: null,
        };
      }

      return {
        totalPending: result.total_pending ?? 0,
        clusteredCount: result.clustered_count ?? 0,
        unclusteredCount: result.unclustered_count ?? 0,
        clusterCount: result.cluster_count ?? 0,
        oldestPending: result.oldest_pending ?? null,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 分钟内数据视为新鲜
    refetchOnWindowFocus: false,
  });

  // ==================== 刷新函数 ====================
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  // ==================== 返回值 ====================
  return {
    stats: stats ?? null,
    pendingCount: stats?.totalPending ?? 0,
    isLoading,
    error: queryError?.message ?? null,
    refresh,
  };
}
