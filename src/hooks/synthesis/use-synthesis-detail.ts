/**
 * 综述详情 Hook
 *
 * 获取单个综述报告的完整数据
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { SynthesisReport } from "@/lib/synthesis";

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
 * 综述详情 Hook
 */
export function useSynthesisDetail(reportId: string): UseSynthesisDetailResult {
  const [data, setData] = useState<SynthesisReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!reportId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/synthesis/${reportId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Synthesis report not found");
        }
        throw new Error("Failed to fetch synthesis detail");
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
