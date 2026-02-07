/**
 * 聚类分布 Hook
 *
 * 获取用户书签聚类的大小分布统计
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { clientLogger } from "@/lib/client-logger";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 聚类分布数据项
 */
export interface ClusterDistributionItem {
  /** 大小范围标识 */
  size: string;
  /** 该范围内的聚类数量 */
  count: number;
  /** 显示标签 */
  label: string;
}

/**
 * Hook 返回值
 */
export interface UseClusterDistributionReturn {
  /** 分布数据 */
  distribution: ClusterDistributionItem[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
}

// ============================================================================
// 查询键
// ============================================================================

const QUERY_KEY = ["cluster-distribution"] as const;

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 聚类分布 Hook
 *
 * @example
 * ```tsx
 * const { distribution, isLoading } = useClusterDistribution();
 * ```
 */
export function useClusterDistribution(): UseClusterDistributionReturn {
  const {
    data: distribution,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ClusterDistributionItem[]> => {
      const supabase = createBrowserSupabaseClient();

      const { data, error } = await supabase.rpc(
        "get_cluster_size_distribution",
      );

      if (error) {
        clientLogger.warn({ error }, "[useClusterDistribution] RPC error");
        throw new Error(error.message);
      }

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((item: Record<string, unknown>) => ({
        size: String(item.size_range ?? ""),
        count: Number(item.cluster_count ?? 0),
        label: String(item.label ?? ""),
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
    refetchOnWindowFocus: false,
  });

  return {
    distribution: distribution ?? [],
    isLoading,
    error: queryError?.message ?? null,
  };
}
