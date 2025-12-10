"use client";

/**
 * SWR 风格的数据缓存 Hook
 * 提供 stale-while-revalidate 策略的 React Hook 封装
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { dataCache } from "../data-cache";
import {
  DATA_CACHE_CONFIG,
  CACHE_KEYS,
  getDataCacheConfig,
} from "../cache-config";

/**
 * Hook 选项
 */
interface UseCachedDataOptions<T> {
  cacheKey: string;
  fetcher: () => Promise<T>;
  staleTime?: number;
  cacheTime?: number;
  enabled?: boolean;
  initialData?: T;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook 返回值
 */
interface UseCachedDataResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isValidating: boolean;
  isStale: boolean;
  error: Error | undefined;
  mutate: (data?: T | ((prev: T | undefined) => T)) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * 通用数据缓存 Hook
 */
export function useCachedData<T>(
  options: UseCachedDataOptions<T>,
): UseCachedDataResult<T> {
  const {
    cacheKey,
    fetcher,
    staleTime = DATA_CACHE_CONFIG.staleTime,
    cacheTime = DATA_CACHE_CONFIG.cacheTime,
    enabled = true,
    initialData,
    onSuccess,
    onError,
  } = options;

  // 使用 ref 存储 mutate 函数，避免重复创建
  const mutateRef = useRef<
    ((data?: T | ((prev: T | undefined) => T)) => Promise<void>) | null
  >(null);

  // 状态
  const [state, setState] = useState<{
    data: T | undefined;
    isLoading: boolean;
    isValidating: boolean;
    isStale: boolean;
    error: Error | undefined;
  }>(() => {
    // 初始化时检查缓存
    const cached = dataCache.getSync<T>(cacheKey);
    return {
      data: cached.data ?? initialData,
      isLoading: !cached.data && !initialData && enabled,
      isValidating: false,
      isStale: cached.isStale,
      error: undefined,
    };
  });

  // 获取数据
  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setState((prev) => ({
      ...prev,
      isLoading: !prev.data,
      isValidating: true,
    }));

    try {
      const result = await dataCache.get({
        cacheKey,
        fetcher,
        staleTime,
        cacheTime,
        onSuccess,
        onError,
      });

      mutateRef.current = result.mutate;

      setState({
        data: result.data,
        isLoading: false,
        isValidating: result.isValidating,
        isStale: result.isStale,
        error: result.error,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isValidating: false,
        error: error as Error,
      }));
    }
  }, [cacheKey, fetcher, staleTime, cacheTime, enabled, onSuccess, onError]);

  // 首次加载
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 订阅缓存变化
  useEffect(() => {
    const unsubscribe = dataCache.subscribe(cacheKey, (entry) => {
      if (entry) {
        setState((prev) => ({
          ...prev,
          data: entry.data as T,
          isValidating: entry.isValidating,
          isStale: false,
          error: entry.error,
        }));
      }
    });

    return unsubscribe;
  }, [cacheKey]);

  // mutate 函数
  const mutate = useCallback(
    async (data?: T | ((prev: T | undefined) => T)) => {
      if (mutateRef.current) {
        await mutateRef.current(data);
      }
    },
    [],
  );

  // refetch 函数（强制刷新）
  const refetch = useCallback(async () => {
    dataCache.invalidate(cacheKey);
    await fetchData();
  }, [cacheKey, fetchData]);

  return {
    ...state,
    mutate,
    refetch,
  };
}

// ============================================
// 预定义的业务数据 Hook
// ============================================

/**
 * 书签列表 Hook
 */
export function useBookmarks(
  userId: string | undefined,
  platform?: string,
  options?: { enabled?: boolean },
) {
  const cacheKey = userId ? CACHE_KEYS.bookmarks(userId, platform) : "";
  const config = getDataCacheConfig("bookmarks");

  return useCachedData({
    cacheKey,
    fetcher: async () => {
      if (!userId) return [];

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // 浏览器书签平台列表（使用 Platform 类型值）
      const browserPlatforms = [
        "BROWSER_CHROME",
        "BROWSER_EDGE",
        "BROWSER_FIREFOX",
        "BROWSER_SAFARI",
      ] as const;

      let query = supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      // 平台筛选逻辑
      if (platform && platform !== "all") {
        if (platform === "BROWSER") {
          // 浏览器书签：包含所有浏览器平台
          query = query.in("platform", browserPlatforms);
        } else {
          // 单一平台筛选（使用类型断言确保类型安全）
          query = query.eq(
            "platform",
            platform as (typeof browserPlatforms)[number],
          );
        }
      } else {
        // "全部"时排除浏览器书签
        query = query.not("platform", "in", `(${browserPlatforms.join(",")})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: config.staleTime,
    cacheTime: config.cacheTime,
    enabled: !!userId && options?.enabled !== false,
  });
}

/**
 * 文件夹列表 Hook
 */
export function useFolders(
  userId: string | undefined,
  options?: { enabled?: boolean },
) {
  const cacheKey = userId ? CACHE_KEYS.folders(userId) : "";
  const config = getDataCacheConfig("folders");

  return useCachedData({
    cacheKey,
    fetcher: async () => {
      if (!userId) return [];

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("sort_order");

      if (error) throw error;
      return data || [];
    },
    staleTime: config.staleTime,
    cacheTime: config.cacheTime,
    enabled: !!userId && options?.enabled !== false,
  });
}

/**
 * 用户资料 Hook
 */
export function useProfile(
  userId: string | undefined,
  options?: { enabled?: boolean },
) {
  const cacheKey = userId ? CACHE_KEYS.profile(userId) : "";
  const config = getDataCacheConfig("profile");

  return useCachedData({
    cacheKey,
    fetcher: async () => {
      if (!userId) return null;

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data;
    },
    staleTime: config.staleTime,
    cacheTime: config.cacheTime,
    enabled: !!userId && options?.enabled !== false,
  });
}

/**
 * 统计数据 Hook
 */
export function useAnalytics(
  userId: string | undefined,
  options?: { enabled?: boolean },
) {
  const cacheKey = userId ? CACHE_KEYS.analytics(userId) : "";
  const config = getDataCacheConfig("analytics");

  return useCachedData({
    cacheKey,
    fetcher: async () => {
      if (!userId) return null;

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // 获取书签统计
      const { data: bookmarks, error: bookmarksError } = await supabase
        .from("bookmarks")
        .select("platform, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (bookmarksError) throw bookmarksError;

      // 按平台分组统计
      const platformStats = (bookmarks || []).reduce(
        (acc, bookmark) => {
          acc[bookmark.platform] = (acc[bookmark.platform] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      // 按月份分组统计
      const monthlyStats = (bookmarks || []).reduce(
        (acc, bookmark) => {
          if (!bookmark.created_at) return acc;
          const month = new Date(bookmark.created_at).toISOString().slice(0, 7);
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        total: bookmarks?.length || 0,
        platformStats,
        monthlyStats,
      };
    },
    staleTime: config.staleTime,
    cacheTime: config.cacheTime,
    enabled: !!userId && options?.enabled !== false,
  });
}

/**
 * 预取数据（用于预热缓存）
 */
export async function prefetchBookmarks(
  userId: string,
  platform?: string,
): Promise<void> {
  const cacheKey = CACHE_KEYS.bookmarks(userId, platform);

  await dataCache.prefetch(cacheKey, async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    // 浏览器书签平台列表（使用 Platform 类型值）
    const browserPlatforms = [
      "BROWSER_CHROME",
      "BROWSER_EDGE",
      "BROWSER_FIREFOX",
      "BROWSER_SAFARI",
    ] as const;

    let query = supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (platform && platform !== "all") {
      if (platform === "BROWSER") {
        query = query.in("platform", browserPlatforms);
      } else {
        // 单一平台筛选（使用类型断言确保类型安全）
        query = query.eq(
          "platform",
          platform as (typeof browserPlatforms)[number],
        );
      }
    } else {
      query = query.not("platform", "in", `(${browserPlatforms.join(",")})`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  });
}
