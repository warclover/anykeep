/**
 * 综述列表 Hook
 *
 * 获取用户的综述报告列表，支持搜索、筛选和分页
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  SynthesisListResponse,
  SynthesisSourceType,
  SynthesisDepthMode,
  SynthesisStatus,
} from "@/lib/synthesis";

interface UseSynthesisListOptions {
  /** 来源类型筛选 */
  sourceType?: SynthesisSourceType;
  /** 深度模式筛选 */
  depthMode?: SynthesisDepthMode;
  /** 状态筛选 */
  status?: SynthesisStatus;
  /** 搜索关键词 */
  search?: string;
  /** 排序字段 */
  sort?: "createdAt" | "updatedAt" | "wordCount";
  /** 排序方向 */
  order?: "asc" | "desc";
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 为 false 时不发起请求（按需加载） */
  enabled?: boolean;
}

interface UseSynthesisListResult {
  /** 列表数据 */
  data: SynthesisListResponse | null;
  /** 加载状态 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 刷新数据 */
  refetch: () => Promise<void>;
}

/**
 * 综述列表 Hook
 */
export function useSynthesisList(
  options: UseSynthesisListOptions = {},
): UseSynthesisListResult {
  const [data, setData] = useState<SynthesisListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(() => options.enabled !== false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (options.sourceType) params.set("sourceType", options.sourceType);
      if (options.depthMode) params.set("depthMode", options.depthMode);
      if (options.status) params.set("status", options.status);
      if (options.search) params.set("search", options.search);
      if (options.sort) params.set("sort", options.sort);
      if (options.order) params.set("order", options.order);
      if (options.page) params.set("page", String(options.page));
      if (options.pageSize) params.set("pageSize", String(options.pageSize));

      const response = await fetch(`/api/synthesis?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch synthesis list");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [
    options.sourceType,
    options.depthMode,
    options.status,
    options.search,
    options.sort,
    options.order,
    options.page,
    options.pageSize,
  ]);

  useEffect(() => {
    if (options.enabled !== false) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [fetchData, options.enabled]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
