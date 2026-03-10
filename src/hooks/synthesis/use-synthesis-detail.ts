/**
 * 综述详情 Hook
 *
 * 获取单个综述报告的完整数据
 * 使用 TanStack Query 提供缓存和自动刷新
 *
 * 性能优化：
 * - staleTime 2分钟（报告内容可能被编辑）
 * - 缓存后二次访问秒开
 * - 支持自动刷新生成中的报告
 *
 * @version 2.0.0
 * @since 2025-12-29
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { synthesisKeys } from "@/hooks/queries/keys";
import type { SynthesisReport } from "@/lib/synthesis";
import { API_SYNTHESIS } from "@/lib/constants/api-paths";

interface UseSynthesisDetailResult {
  /** 综述数据 */
  data: SynthesisReport | null;
  /** 加载状态 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 刷新数据 */
  refetch: () => Promise<void>;
}

/**
 * 获取综述详情
 */
async function fetchSynthesisDetail(
  reportId: string,
): Promise<SynthesisReport> {
  const response = await fetch(API_SYNTHESIS.detail(reportId));

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Synthesis report not found");
    }
    throw new Error("Failed to fetch synthesis detail");
  }

  const result = await response.json();
  return result.data;
}

/**
 * 综述详情 Hook
 *
 * @example
 * ```tsx
 * const { data: report, isLoading, error, refetch } = useSynthesisDetail(reportId);
 * ```
 */
export function useSynthesisDetail(reportId: string): UseSynthesisDetailResult {
  const query = useQuery({
    queryKey: synthesisKeys.detail(reportId),
    queryFn: () => fetchSynthesisDetail(reportId),
    enabled: !!reportId,
    staleTime: 2 * 60 * 1000, // 2 分钟
    gcTime: 10 * 60 * 1000, // 10 分钟垃圾回收
    // 生成中的报告需要更频繁地刷新
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "generating" || data?.status === "pending") {
        return 3000; // 3 秒轮询
      }
      return false;
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
}
