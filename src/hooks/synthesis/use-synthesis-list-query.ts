/**
 * 综述列表 Hook（TanStack Query）
 *
 * 使用 useQuery 管理综述列表：请求去重、staleTime 减少重复请求，
 * 支持 enabled 按需请求（如仅在「历史记录」Tab 激活时请求）。
 *
 * @version 1.0.0
 * @since 2026-03-03
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { synthesisKeys, type SynthesisListFilters } from "@/hooks/queries/keys";
import type {
  SynthesisListResponse,
  SynthesisSourceType,
  SynthesisDepthMode,
  SynthesisStatus,
} from "@/lib/synthesis";

const STALE_TIME_MS = 60 * 1000; // 1 分钟内不重复请求

export interface UseSynthesisListQueryOptions {
  sourceType?: SynthesisSourceType;
  depthMode?: SynthesisDepthMode;
  status?: SynthesisStatus;
  search?: string;
  sort?: "createdAt" | "updatedAt" | "wordCount";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  /** 为 false 时不发起请求（按需加载，如仅 history Tab 时请求） */
  enabled?: boolean;
}

function buildFilters(
  options: UseSynthesisListQueryOptions,
): SynthesisListFilters {
  return {
    sourceType: options.sourceType,
    depthMode: options.depthMode,
    status: options.status,
    search: options.search ?? undefined,
    sort: options.sort ?? "createdAt",
    order: options.order ?? "desc",
    page: options.page ?? 1,
    pageSize: options.pageSize,
  };
}

async function fetchSynthesisList(
  options: UseSynthesisListQueryOptions,
): Promise<SynthesisListResponse> {
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
  return response.json();
}

export interface UseSynthesisListQueryResult {
  data: SynthesisListResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * 综述列表 Hook（TanStack Query）
 * 与 useSynthesisList 接口兼容，支持 enabled 与缓存去重。
 */
export function useSynthesisListQuery(
  options: UseSynthesisListQueryOptions = {},
): UseSynthesisListQueryResult {
  const { enabled = true } = options;

  const queryKey = synthesisKeys.list(buildFilters(options));

  const {
    data,
    error,
    isLoading,
    refetch: queryRefetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchSynthesisList(options),
    enabled,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    data: data ?? null,
    isLoading: enabled ? isLoading : false,
    error:
      error instanceof Error ? error : error ? new Error(String(error)) : null,
    refetch,
  };
}

/** 预取综述列表（用于预加载或缓存预热） */
export function prefetchSynthesisList(
  queryClient: ReturnType<typeof useQueryClient>,
  options: UseSynthesisListQueryOptions,
) {
  return queryClient.prefetchQuery({
    queryKey: synthesisKeys.list(buildFilters(options)),
    queryFn: () => fetchSynthesisList(options),
    staleTime: STALE_TIME_MS,
  });
}
