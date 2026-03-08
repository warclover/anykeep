/**
 * 页面数据获取 Hooks
 * 为各页面提供客户端数据获取能力，支持 Keep-Alive 模式
 *
 * V5.1: 收藏夹数据支持本地持久化缓存
 * V5.3: P2-2.4 添加 AbortController 请求中断机制
 * V5.5: useFoldersData 迁移到 TanStack Query，消除三条并行 API 路径中的第三条
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/contexts/user-context";
import { clientLogger } from "@/lib/client-logger";
import type { Bookmark } from "@/types/supabase";
import type { UserSettings } from "@/types/user-settings";
import { DEFAULT_USER_SETTINGS } from "@/types/user-settings";
import type { FolderWithStats, FolderCategory } from "@/types/domain";
import { folderKeys, analyticsKeys, settingsKeys } from "@/hooks/queries/keys";
import {
  API_ANALYTICS,
  API_FOLDERS,
  API_USER,
} from "@/lib/constants/api-paths";

// ==================== 收藏夹页面数据 ====================

// 重新导出 FolderWithStats 以保持向后兼容
export type { FolderWithStats } from "@/types/domain";

interface FoldersData {
  folders: FolderWithStats[];
  categories: FolderCategory[];
  recentBookmarks: (Bookmark & { folders?: { name: string } | null })[];
}

async function fetchFoldersWithStats(): Promise<FoldersData> {
  const response = await fetch(
    `${API_FOLDERS.withStats}?include_recent=true&recent_limit=6`,
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || "加载文件夹失败");
  }

  return {
    folders: result.data.folders || [],
    categories: result.data.categories || [],
    recentBookmarks: result.data.recentBookmarks || [],
  };
}

/**
 * 收藏夹页面数据获取 Hook
 * V5.5: 迁移到 TanStack Query（消除自定义 dataCache + AbortController 样板代码）
 *       使用 folderKeys.withStats() 作为唯一缓存键，5 分钟 stale，不随窗口 focus 刷新
 */
export function useFoldersData() {
  const { data, isLoading, isFetching, error, refetch } = useQuery<FoldersData>(
    {
      queryKey: folderKeys.withStats(),
      queryFn: fetchFoldersWithStats,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  return {
    data: data ?? null,
    isLoading,
    isValidating: isFetching && !isLoading,
    error: error ? (error instanceof Error ? error.message : "加载失败") : null,
    lastFetched: 0,
    refetch: async () => {
      await refetch();
    },
  };
}

// ==================== 数据统计页面数据 ====================

import type { AnalyticsData } from "@/lib/analytics";

/**
 * 统计数据 fetcher
 */
async function fetchAnalyticsStats(): Promise<AnalyticsData> {
  const response = await fetch(API_ANALYTICS.stats);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || "加载统计数据失败");
  }

  return result.data;
}

/**
 * 数据统计页面数据获取 Hook
 * V5.2: 使用聚合 API 优化性能
 * V6.0: 迁移到 TanStack Query（消除手写 useState/useEffect/AbortController）
 */
export function useAnalyticsData() {
  const { user } = useUser();

  const { data, isLoading, error, refetch } = useQuery<AnalyticsData>({
    queryKey: analyticsKeys.stats(),
    queryFn: fetchAnalyticsStats,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    meta: {
      onError: (err: unknown) =>
        clientLogger.error({ error: err }, "useAnalyticsData fetch failed"),
    },
  });

  return {
    data: data ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "加载失败") : null,
    lastFetched: 0,
    refetch: async () => {
      await refetch();
    },
  };
}

// ==================== 设置页面数据 ====================

/**
 * 用户设置 fetcher
 */
async function fetchUserSettings(): Promise<UserSettings> {
  const response = await fetch(API_USER.settings);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || "加载设置失败");
  }

  return result.data;
}

/**
 * 设置页面数据获取 Hook
 * 从 API 加载用户设置，支持未登录时显示默认值
 * V6.0: 迁移到 TanStack Query
 */
export function useSettingsData() {
  const { user, isLoading: userLoading } = useUser();

  const { data, isLoading, error, refetch } = useQuery<UserSettings>({
    queryKey: settingsKeys.all,
    queryFn: fetchUserSettings,
    enabled: !!user && !userLoading,
    staleTime: 5 * 60 * 1000,
    placeholderData: DEFAULT_USER_SETTINGS,
    meta: {
      onError: (err: unknown) =>
        clientLogger.error({ error: err }, "Failed to load settings"),
    },
  });

  return {
    data: data ?? DEFAULT_USER_SETTINGS,
    isLoading: userLoading || isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "加载设置失败"
      : null,
    lastFetched: 0,
    refetch: async () => {
      await refetch();
    },
  };
}
