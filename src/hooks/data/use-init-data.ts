/**
 * 首页初始化数据 Hook
 * @description 使用聚合 API 一次获取所有首页数据，减少请求数量
 * @version 2.0.0 - 迁移到 TanStack Query，消除 SWR 双缓存问题
 *
 * 性能优化：
 * - 7+ 个请求合并为 1 个
 * - 单次认证替代 7+ 次重复认证
 * - 服务端并行获取数据
 * - 统一使用 TanStack Query 缓存
 *
 * 变更历史：
 * - v1.0.0: SWR 版本
 * - v2.0.0: 迁移到 TanStack Query
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { authFetcher } from "@/lib/api/fetch-with-auth";
import { initDataKeys, type InitDataFilters } from "@/hooks/queries/keys";
import type { SmartListClient } from "@/types/smart-list";
import type { Bookmark, Folder, CustomUsageTag } from "@/types/supabase";

// ============================================
// 类型定义
// ============================================

/** 未读消息数量 */
export interface UnreadCounts {
  total: number;
  silent: number;
  normal: number;
  important: number;
}

/** 初始化数据响应 */
export interface InitData {
  bookmarks: Bookmark[];
  smartLists: SmartListClient[];
  unreadCount: UnreadCounts;
  folders: (Folder & { children?: Folder[] })[];
  /** 自定义用途标签（与 /api/settings/usage-tags 数据相同，避免独立请求） */
  customUsageTags: CustomUsageTag[];
  _meta?: {
    authMethod: string;
    authDuration: number;
    dataDuration: number;
    totalDuration: number;
    /** V4.2.1: 数据版本号，用于客户端缓存失效验证 */
    dataVersion?: string;
  };
}

/** API 响应类型 */
interface InitApiResponse {
  success: boolean;
  data: InitData;
  error?: { message: string };
}

/** Hook 选项 */
export interface UseInitDataOptions {
  /** 平台筛选 */
  platform?: string;
  /** 排序方式 */
  sort?: string;
  /** 文件夹筛选 */
  folder?: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 刷新间隔（毫秒），0 禁用 */
  refreshInterval?: number;
}

/** Hook 返回值 */
export interface UseInitDataResult {
  /** 书签列表 */
  bookmarks: Bookmark[];
  /** 智能列表 */
  smartLists: SmartListClient[];
  /** 未读消息数量 */
  unreadCount: UnreadCounts;
  /** 文件夹树 */
  folders: (Folder & { children?: Folder[] })[];
  /** 自定义用途标签 */
  customUsageTags: CustomUsageTag[];
  /** 性能元数据 */
  meta: InitData["_meta"] | null;
  /** V4.2.1: 数据版本号，用于缓存失效验证 */
  dataVersion: string | null;
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 更新书签（乐观更新） */
  updateBookmarks: (
    updater: (bookmarks: Bookmark[]) => Bookmark[],
  ) => Promise<void>;
  /** 更新智能列表（乐观更新） */
  updateSmartLists: (
    updater: (lists: SmartListClient[]) => SmartListClient[],
  ) => Promise<void>;
}

// ============================================
// 默认值
// ============================================

const DEFAULT_UNREAD_COUNT: UnreadCounts = {
  total: 0,
  silent: 0,
  normal: 0,
  important: 0,
};

/** 缓存时间：5 分钟 */
const STALE_TIME = 5 * 60 * 1000;

// ============================================
// Fetcher
// ============================================

async function fetchInitData(filters: InitDataFilters): Promise<InitData> {
  const params = new URLSearchParams();

  if (filters.platform) {
    params.set("platform", filters.platform);
  }
  if (filters.sort) {
    params.set("sort", filters.sort);
  }
  if (filters.folder) {
    params.set("folder", filters.folder);
  }

  const queryString = params.toString();
  const url = queryString ? `/api/init?${queryString}` : "/api/init";

  const result = await authFetcher<InitApiResponse>(url);
  if (!result.success) {
    throw new Error(result.error?.message || "获取初始数据失败");
  }
  return result.data;
}

// ============================================
// Hook 实现
// ============================================

export function useInitData(
  options: UseInitDataOptions = {},
): UseInitDataResult {
  const { enabled = true, refreshInterval = 0, ...queryOptions } = options;
  const queryClient = useQueryClient();

  // 构建筛选条件
  const filters: InitDataFilters = {
    platform: queryOptions.platform,
    sort: queryOptions.sort,
    folder: queryOptions.folder,
  };

  const queryKey = initDataKeys.filtered(filters);

  // TanStack Query 获取数据
  const { data, error, isLoading, refetch } = useQuery<InitData>({
    queryKey,
    queryFn: () => fetchInitData(filters),
    enabled,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: refreshInterval > 0 ? refreshInterval : undefined,
    retry: 2,
    retryDelay: 3000,
  });

  // 刷新数据
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // 乐观更新书签
  const updateBookmarks = useCallback(
    async (updater: (bookmarks: Bookmark[]) => Bookmark[]) => {
      queryClient.setQueryData<InitData>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          bookmarks: updater(prev.bookmarks),
        };
      });
    },
    [queryClient, queryKey],
  );

  // 乐观更新智能列表
  const updateSmartLists = useCallback(
    async (updater: (lists: SmartListClient[]) => SmartListClient[]) => {
      queryClient.setQueryData<InitData>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          smartLists: updater(prev.smartLists),
        };
      });
    },
    [queryClient, queryKey],
  );

  return {
    bookmarks: data?.bookmarks ?? [],
    smartLists: data?.smartLists ?? [],
    unreadCount: data?.unreadCount ?? DEFAULT_UNREAD_COUNT,
    folders: data?.folders ?? [],
    customUsageTags: data?.customUsageTags ?? [],
    meta: data?._meta ?? null,
    dataVersion: data?._meta?.dataVersion ?? null,
    isLoading,
    error: error ?? null,
    refresh,
    updateBookmarks,
    updateSmartLists,
  };
}

export default useInitData;
