/**
 * useInfiniteBookmarks - TanStack Query Infinite Scroll Hook
 *
 * 提供书签列表的无限滚动加载功能
 * 支持分页、筛选和自动加载
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { bookmarkKeys, type BookmarkFilters } from "./keys";
import type { BookmarkListResponse } from "@/contracts";

// ============================================
// 常量配置
// ============================================

/** 每页默认数量 */
const DEFAULT_PAGE_SIZE = 20;

// ============================================
// API Fetcher
// ============================================

/**
 * 构建查询参数
 */
function buildQueryParams(
  filters: Omit<BookmarkFilters, "offset">,
  offset: number,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.folderId !== undefined && filters.folderId !== null) {
    params.set("folderId", String(filters.folderId));
  }
  if (filters.platform) {
    params.set("platform", filters.platform);
  }
  if (filters.isRead !== undefined) {
    params.set("isRead", String(filters.isRead));
  }
  if (filters.isStarred !== undefined) {
    params.set("isStarred", String(filters.isStarred));
  }
  if (filters.isInTrash !== undefined) {
    params.set("isInTrash", String(filters.isInTrash));
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.sortBy) {
    params.set("sortBy", filters.sortBy);
  }
  if (filters.sortOrder) {
    params.set("sortOrder", filters.sortOrder);
  }

  params.set("limit", String(filters.limit || DEFAULT_PAGE_SIZE));
  params.set("offset", String(offset));

  return params;
}

/**
 * 获取书签分页数据
 */
async function fetchBookmarksPage(
  filters: Omit<BookmarkFilters, "offset">,
  pageParam: number,
): Promise<BookmarkListResponse> {
  const params = buildQueryParams(filters, pageParam);
  // 使用 v1 API
  const response = await fetch(`/api/v1/bookmarks?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "获取书签列表失败");
  }

  const data = await response.json();
  const limit = filters.limit || DEFAULT_PAGE_SIZE;

  // 适配新旧两种 API 响应格式
  // v1 API: { success, data: { items, total, hasMore, ... } }
  // 旧 API: { success, data: { bookmarks, pagination: { total, hasMore } } }
  const inner = data.data || {};
  const items = inner.items || inner.bookmarks || [];
  const total = inner.total ?? inner.pagination?.total ?? items.length;
  const hasMore =
    inner.hasMore ?? inner.pagination?.hasMore ?? items.length === limit;

  return {
    items,
    total,
    limit,
    offset: pageParam,
    hasMore,
  };
}

// ============================================
// Hook 实现
// ============================================

/**
 * 无限滚动书签列表 Hook
 *
 * @example
 * ```tsx
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetchingNextPage,
 *   isLoading,
 * } = useInfiniteBookmarks({ folderId: 1 });
 *
 * // 获取所有已加载的书签
 * const allBookmarks = data?.pages.flatMap(page => page.items) ?? [];
 *
 * // 加载更多
 * if (hasNextPage) {
 *   fetchNextPage();
 * }
 * ```
 */
export function useInfiniteBookmarks(
  filters: Omit<BookmarkFilters, "offset"> = {},
) {
  const pageSize = filters.limit || DEFAULT_PAGE_SIZE;

  return useInfiniteQuery({
    queryKey: bookmarkKeys.infinite(filters),

    queryFn: ({ pageParam }) => fetchBookmarksPage(filters, pageParam),

    initialPageParam: 0,

    getNextPageParam: (lastPage, allPages) => {
      // 如果没有更多数据，返回 undefined 停止加载
      if (!lastPage.hasMore) {
        return undefined;
      }

      // 计算下一页的 offset
      const currentOffset = allPages.reduce(
        (acc, page) => acc + page.items.length,
        0,
      );

      return currentOffset;
    },

    getPreviousPageParam: (firstPage) => {
      // 如果当前是第一页，返回 undefined
      if (firstPage.offset === 0) {
        return undefined;
      }

      // 计算前一页的 offset
      return Math.max(0, firstPage.offset - pageSize);
    },

    staleTime: 5 * 60 * 1000, // 5 分钟
  });
}

// ============================================
// 辅助 Hooks
// ============================================

/**
 * 获取所有已加载的书签（扁平化）
 *
 * @example
 * ```tsx
 * const { bookmarks, isLoading, ... } = useFlatBookmarks({ folderId: 1 });
 * ```
 */
export function useFlatBookmarks(
  filters: Omit<BookmarkFilters, "offset"> = {},
) {
  const query = useInfiniteBookmarks(filters);

  return {
    ...query,
    /** 所有已加载的书签（扁平数组） */
    bookmarks: query.data?.pages.flatMap((page) => page.items) ?? [],
    /** 总数（从第一页获取） */
    total: query.data?.pages[0]?.total ?? 0,
    /** 已加载数量 */
    loadedCount:
      query.data?.pages.reduce((acc, page) => acc + page.items.length, 0) ?? 0,
  };
}
