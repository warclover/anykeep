/**
 * 智能列表书签数据 Hook
 * @description 根据智能列表 ID 获取筛选后的书签列表
 * @version 10.0.0
 */

"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";
import type { SmartListClient, SmartListFilters } from "@/types/smart-list";
import type { Bookmark } from "@/types/supabase";

// ============================================
// 类型定义
// ============================================

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface SmartListBookmarksData {
  smartList: SmartListClient;
  bookmarks: BookmarkWithFolder[];
  hasMore: boolean;
  total: number;
}

interface UseSmartListBookmarksOptions {
  /** 智能列表 ID */
  smartListId: number | null;
  /** 是否启用 */
  enabled?: boolean;
}

interface UseSmartListBookmarksResult {
  /** 智能列表数据 */
  smartList: SmartListClient | null;
  /** 书签列表 */
  bookmarks: BookmarkWithFolder[];
  /** 是否有更多 */
  hasMore: boolean;
  /** 总数 */
  total: number;
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 加载更多 */
  loadMore: () => Promise<void>;
}

// ============================================
// 工具函数
// ============================================

/**
 * 将智能列表筛选条件转换为 API 查询参数
 */
function filtersToQueryParams(filters: SmartListFilters): URLSearchParams {
  const params = new URLSearchParams();

  // 平台筛选
  if (filters.platform) {
    if (Array.isArray(filters.platform)) {
      params.set("platform", filters.platform.join(","));
    } else {
      params.set("platform", filters.platform);
    }
  }

  // 排除平台
  if (filters.excludePlatforms && filters.excludePlatforms.length > 0) {
    params.set("excludeBrowser", "true");
  }

  // 文件夹筛选
  if (filters.folderId !== undefined) {
    if (filters.folderId === "uncategorized") {
      params.set("folder", "uncategorized");
    } else {
      params.set("folderId", String(filters.folderId));
    }
  }

  // 用途标签筛选
  if (filters.usageTags && filters.usageTags.length > 0) {
    params.set("usageTags", filters.usageTags.join(","));
  }

  // 时间范围筛选
  if (filters.dateRange) {
    if (
      filters.dateRange.type === "relative" &&
      filters.dateRange.value &&
      filters.dateRange.unit
    ) {
      const now = new Date();
      const from = new Date(now);
      const { value, unit } = filters.dateRange;

      switch (unit) {
        case "day":
          from.setDate(from.getDate() - value);
          break;
        case "week":
          from.setDate(from.getDate() - value * 7);
          break;
        case "month":
          from.setMonth(from.getMonth() - value);
          break;
        case "year":
          from.setFullYear(from.getFullYear() - value);
          break;
      }

      params.set("dateFrom", from.toISOString());
    } else if (filters.dateRange.type === "absolute") {
      if (filters.dateRange.from) {
        params.set("dateFrom", filters.dateRange.from);
      }
      if (filters.dateRange.to) {
        params.set("dateTo", filters.dateRange.to);
      }
    }
  }

  // 阅读状态
  if (filters.isRead !== undefined) {
    params.set("isRead", String(filters.isRead));
  }

  // 星标状态
  if (filters.isStarred !== undefined) {
    params.set("isStarred", String(filters.isStarred));
  }

  // 高价值（rating = 5）
  if (filters.isHighValue === true) {
    params.set("isHighValue", "true");
  }

  // 评级范围
  if (filters.rating) {
    if (filters.rating.min !== undefined) {
      params.set("ratingMin", String(filters.rating.min));
    }
    if (filters.rating.max !== undefined) {
      params.set("ratingMax", String(filters.rating.max));
    }
  }

  // 关键词搜索
  if (filters.keyword) {
    params.set("keyword", filters.keyword);
  }

  return params;
}

// ============================================
// Fetcher
// ============================================

async function fetcher(smartListId: number): Promise<SmartListBookmarksData> {
  // 1. 获取智能列表详情
  const smartListRes = await fetch(`/api/smart-lists/${smartListId}`);
  if (!smartListRes.ok) {
    throw new Error("获取智能列表失败");
  }
  const smartListResult = await smartListRes.json();
  if (!smartListResult.success) {
    throw new Error(smartListResult.error?.message || "获取智能列表失败");
  }
  const smartList = smartListResult.data as SmartListClient;

  // 2. 构建书签查询参数
  const params = filtersToQueryParams(smartList.filters);
  params.set("limit", "50");

  // 应用智能列表的排序方式
  if (smartList.sortBy) {
    params.set("sort", smartList.sortBy);
  }

  // 3. 获取书签列表
  const bookmarksRes = await fetch(`/api/bookmarks?${params.toString()}`);
  if (!bookmarksRes.ok) {
    throw new Error("获取书签列表失败");
  }
  const bookmarksResult = await bookmarksRes.json();
  if (!bookmarksResult.success) {
    throw new Error(bookmarksResult.error?.message || "获取书签列表失败");
  }

  return {
    smartList,
    bookmarks: bookmarksResult.data.bookmarks as BookmarkWithFolder[],
    hasMore: bookmarksResult.data.pagination.hasMore,
    total:
      bookmarksResult.data.pagination.total ||
      bookmarksResult.data.bookmarks.length,
  };
}

// ============================================
// Hook 实现
// ============================================

export function useSmartListBookmarks(
  options: UseSmartListBookmarksOptions,
): UseSmartListBookmarksResult {
  const { smartListId, enabled = true } = options;

  // SWR 缓存键
  const cacheKey =
    smartListId && enabled ? `smart-list-bookmarks:${smartListId}` : null;

  // SWR 获取数据
  const { data, error, isLoading, mutate } = useSWR<SmartListBookmarksData>(
    cacheKey,
    () => fetcher(smartListId!),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    },
  );

  // 智能列表数据 - 使用 useMemo 稳定引用，避免不必要的重渲染
  const smartList = useMemo(() => data?.smartList ?? null, [data?.smartList]);
  const bookmarks = useMemo(() => data?.bookmarks ?? [], [data?.bookmarks]);
  const hasMore = data?.hasMore ?? false;
  const total = data?.total ?? 0;

  // 刷新数据
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // 加载更多 - 直接使用 data 避免 bookmarks 依赖导致的频繁重建
  const loadMore = useCallback(async () => {
    if (!data?.smartList || !data.hasMore || data.bookmarks.length === 0)
      return;

    const lastBookmark = data.bookmarks[data.bookmarks.length - 1];
    const params = filtersToQueryParams(data.smartList.filters);
    params.set("cursor", String(lastBookmark.id));
    params.set("limit", "50");

    if (data.smartList.sortBy) {
      params.set("sort", data.smartList.sortBy);
    }

    const res = await fetch(`/api/bookmarks?${params.toString()}`);
    if (!res.ok) {
      throw new Error("加载更多失败");
    }
    const result = await res.json();

    // 合并数据
    await mutate(
      (prev) =>
        prev
          ? {
              ...prev,
              bookmarks: [...prev.bookmarks, ...result.data.bookmarks],
              hasMore: result.data.pagination.hasMore,
            }
          : prev,
      { revalidate: false },
    );
  }, [data, mutate]);

  return {
    smartList,
    bookmarks,
    hasMore,
    total,
    isLoading,
    error: error || null,
    refresh,
    loadMore,
  };
}

export default useSmartListBookmarks;
