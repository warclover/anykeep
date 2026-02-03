/**
 * 自定义用途标签数据 Hook (V3 - TanStack Query 版本)
 *
 * 使用 TanStack Query 统一管理自定义标签的获取、缓存和同步
 *
 * 优化点：
 * - TanStack Query 自动缓存去重，消除重复请求
 * - 配置合理的 staleTime，减少不必要的 revalidation
 * - 支持 SSR 初始数据透传，消除客户端加载延迟
 * - 跨组件自动共享缓存状态
 *
 * @version 3.0.0 - 迁移到 TanStack Query
 * @since 2025-12-29
 */

"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customTagKeys } from "@/hooks/queries/keys";
import type { CustomUsageTag } from "@/types/supabase";

// ============================================
// Constants
// ============================================

/** API 路径 */
const API_URL = "/api/settings/usage-tags";

/** 缓存有效期：30 分钟 */
const STALE_TIME = 30 * 60 * 1000;

// ============================================
// Fetcher
// ============================================

async function customUsageTagsFetcher(): Promise<CustomUsageTag[]> {
  const response = await fetch(API_URL);
  if (!response.ok) {
    const error = new Error("加载自定义标签失败") as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  return data.data?.customUsageTags || [];
}

// ============================================
// Hook Interface
// ============================================

export interface UseCustomUsageTagsResult {
  /** 自定义标签列表 */
  customTags: CustomUsageTag[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 手动刷新数据 */
  refresh: () => Promise<void>;
  /** 乐观更新：添加标签 */
  addTag: (tag: CustomUsageTag) => void;
  /** 乐观更新：更新标签 */
  updateTag: (tagId: string, updates: Partial<CustomUsageTag>) => void;
  /** 乐观更新：删除标签 */
  removeTag: (tagId: string) => void;
  /** 设置完整标签列表（用于 API 返回后同步） */
  setTags: (tags: CustomUsageTag[]) => void;
}

export interface UseCustomUsageTagsOptions {
  /** SSR 预取的初始数据，避免客户端重复请求 */
  initialData?: CustomUsageTag[];
  /** 是否启用自动请求（默认 true） */
  enabled?: boolean;
}

// ============================================
// Main Hook
// ============================================

/**
 * 自定义用途标签 Hook
 *
 * @param options - 配置选项
 * @returns 标签数据和操作方法
 *
 * @example
 * ```tsx
 * // 基础用法
 * const { customTags, isLoading } = useCustomUsageTags();
 *
 * // 使用 SSR 预取数据
 * const { customTags } = useCustomUsageTags({
 *   initialData: initialCustomUsageTags
 * });
 * ```
 */
export function useCustomUsageTags(
  options: UseCustomUsageTagsOptions = {},
): UseCustomUsageTagsResult {
  const { initialData, enabled = true } = options;
  const queryClient = useQueryClient();

  // 稳定化 initialData 引用
  const stableInitialData = useMemo(
    () => initialData,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialData?.length],
  );

  const queryKey = customTagKeys.list();

  const { data, error, isLoading, refetch } = useQuery<CustomUsageTag[]>({
    queryKey,
    queryFn: customUsageTagsFetcher,
    enabled,
    staleTime: STALE_TIME,
    initialData: stableInitialData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 3,
    retryDelay: (attemptIndex) =>
      Math.min(5000 * Math.pow(2, attemptIndex), 30000),
  });

  // 手动刷新
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // 乐观更新：添加
  const addTag = useCallback(
    (tag: CustomUsageTag) => {
      queryClient.setQueryData<CustomUsageTag[]>(queryKey, (current) => [
        ...(current || []),
        tag,
      ]);
    },
    [queryClient, queryKey],
  );

  // 乐观更新：更新
  const updateTag = useCallback(
    (tagId: string, updates: Partial<CustomUsageTag>) => {
      queryClient.setQueryData<CustomUsageTag[]>(queryKey, (current) =>
        (current || []).map((t) => (t.id === tagId ? { ...t, ...updates } : t)),
      );
    },
    [queryClient, queryKey],
  );

  // 乐观更新：删除
  const removeTag = useCallback(
    (tagId: string) => {
      queryClient.setQueryData<CustomUsageTag[]>(queryKey, (current) =>
        (current || []).filter((t) => t.id !== tagId),
      );
    },
    [queryClient, queryKey],
  );

  // 设置完整列表（API 返回后同步）
  const setTags = useCallback(
    (tags: CustomUsageTag[]) => {
      queryClient.setQueryData(queryKey, tags);
    },
    [queryClient, queryKey],
  );

  return {
    customTags: data || [],
    isLoading,
    error: error || null,
    refresh,
    addTag,
    updateTag,
    removeTag,
    setTags,
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * 清除自定义标签缓存（登出时使用）
 * 需要在组件内通过 queryClient 调用
 */
export function clearCustomUsageTagsCache(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.removeQueries({ queryKey: customTagKeys.all });
}

/**
 * 预加载自定义标签数据
 */
export function prefetchCustomUsageTags(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.prefetchQuery({
    queryKey: customTagKeys.list(),
    queryFn: customUsageTagsFetcher,
    staleTime: STALE_TIME,
  });
}

// 兼容旧版 API - 保留导出但标记为废弃
/** @deprecated 使用 useCustomUsageTags 替代 */
export const CUSTOM_USAGE_TAGS_KEY = "/api/settings/usage-tags" as const;
