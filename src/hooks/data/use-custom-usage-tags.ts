/**
 * 自定义用途标签数据 Hook (V2 - SWR 版本)
 *
 * 使用 SWR 统一管理自定义标签的获取、缓存和同步
 *
 * 优化点：
 * - SWR 自动缓存去重，消除重复请求
 * - 配置合理的 staleTime，减少不必要的 revalidation
 * - 支持 SSR 初始数据透传，消除客户端加载延迟
 * - 跨组件自动共享缓存状态
 *
 * @version 2.1.0
 * @since 2025-12-19
 */

"use client";

import { useCallback, useMemo } from "react";
import useSWR, { useSWRConfig, preload, mutate as globalMutate } from "swr";
import { clientLogger } from "@/lib/client-logger";
import type { CustomUsageTag } from "@/types/supabase";

// ============================================
// Constants
// ============================================

/** SWR 缓存键 */
export const CUSTOM_USAGE_TAGS_KEY = "/api/settings/usage-tags" as const;

/** 缓存有效期：30 分钟（SWR dedupingInterval） */
const DEDUPING_INTERVAL = 30 * 60 * 1000;

// ============================================
// Fetcher
// ============================================

async function customUsageTagsFetcher(url: string): Promise<CustomUsageTag[]> {
  const response = await fetch(url);
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

  // 稳定化 initialData 引用，避免不必要的缓存更新
  const stableFallbackData = useMemo(
    () => initialData,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialData?.length],
  );

  const { data, error, isLoading, mutate } = useSWR<CustomUsageTag[]>(
    enabled ? CUSTOM_USAGE_TAGS_KEY : null,
    customUsageTagsFetcher,
    {
      // SSR 预取数据作为初始值，避免客户端首次请求
      fallbackData: stableFallbackData,
      // 请求去重间隔：30 分钟内相同 key 的请求会被合并
      dedupingInterval: DEDUPING_INTERVAL,
      // 窗口获得焦点时不自动 revalidate（标签不常变）
      revalidateOnFocus: false,
      // 网络恢复时不自动 revalidate
      revalidateOnReconnect: false,
      // 挂载时不自动 revalidate（如果有 fallbackData）
      revalidateOnMount: !stableFallbackData || stableFallbackData.length === 0,
      // 30分钟内强制使用缓存，不检查是否过期
      revalidateIfStale: false,
      // 错误时保留旧数据
      keepPreviousData: true,
      // 重试配置
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      // 错误回调
      onError: (err) => {
        clientLogger.error({ err }, "[CustomUsageTags] 加载失败");
      },
      // 自定义重试逻辑
      onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => {
        // 服务端错误（5xx）不重试
        const status = (err as Error & { status?: number }).status;
        if (status && status >= 500) return;
        // 最多重试 3 次
        if (retryCount >= 3) return;
        // 指数退避重试
        setTimeout(
          () => revalidate({ retryCount }),
          5000 * Math.pow(2, retryCount),
        );
      },
    },
  );

  // 手动刷新
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // 乐观更新辅助函数
  const optimisticUpdate = useCallback(
    (updater: (current?: CustomUsageTag[]) => CustomUsageTag[]) => {
      mutate(updater, { revalidate: false });
    },
    [mutate],
  );

  // 乐观更新：添加
  const addTag = useCallback(
    (tag: CustomUsageTag) => {
      optimisticUpdate((current) => [...(current || []), tag]);
    },
    [optimisticUpdate],
  );

  // 乐观更新：更新
  const updateTag = useCallback(
    (tagId: string, updates: Partial<CustomUsageTag>) => {
      optimisticUpdate((current) =>
        (current || []).map((t) => (t.id === tagId ? { ...t, ...updates } : t)),
      );
    },
    [optimisticUpdate],
  );

  // 乐观更新：删除
  const removeTag = useCallback(
    (tagId: string) => {
      optimisticUpdate((current) =>
        (current || []).filter((t) => t.id !== tagId),
      );
    },
    [optimisticUpdate],
  );

  // 设置完整列表（API 返回后同步）
  const setTags = useCallback(
    (tags: CustomUsageTag[]) => {
      mutate(tags, { revalidate: false });
    },
    [mutate],
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
 * 可在组件外部调用
 */
export function clearCustomUsageTagsCache() {
  if (typeof window !== "undefined") {
    globalMutate(CUSTOM_USAGE_TAGS_KEY, undefined, { revalidate: false });
  }
}

/**
 * 预加载自定义标签数据（在首页或布局中调用）
 * 静默加载，不阻塞渲染
 *
 * @example
 * ```tsx
 * // 在首页组件中
 * useEffect(() => {
 *   prefetchCustomUsageTags();
 * }, []);
 * ```
 */
export function prefetchCustomUsageTags() {
  preload(CUSTOM_USAGE_TAGS_KEY, customUsageTagsFetcher);
}

/**
 * 全局 mutate 钩子，用于在组件内部更新缓存
 *
 * @example
 * ```tsx
 * function SomeComponent() {
 *   const { mutateCustomUsageTags } = useCustomUsageTagsMutate();
 *
 *   const handleSave = async () => {
 *     await saveToServer();
 *     mutateCustomUsageTags(); // 刷新缓存
 *   };
 * }
 * ```
 */
export function useCustomUsageTagsMutate() {
  const { mutate } = useSWRConfig();

  const mutateCustomUsageTags = useCallback(
    (
      data?:
        | CustomUsageTag[]
        | ((current?: CustomUsageTag[]) => CustomUsageTag[]),
      opts?: { revalidate?: boolean },
    ) => {
      return mutate(CUSTOM_USAGE_TAGS_KEY, data, opts);
    },
    [mutate],
  );

  return { mutateCustomUsageTags };
}
