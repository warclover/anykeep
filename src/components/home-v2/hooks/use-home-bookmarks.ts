/**
 * Home V2 专用的 useInfiniteQuery Hook
 *
 * 设计原则：
 * - 纯 TanStack Query（解决 A17：不引入 SWR）
 * - 调用旧 API /api/bookmarks（返回 snake_case，与 UI 组件兼容）
 * - SSR 数据通过 initialData 注入 + staleTime 防止立即 revalidate（解决 B6）
 * - URL 作为唯一真实来源（解决 A19）
 *
 * @since home-v2
 */

"use client";

import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { useMemo } from "react";
import { bookmarkKeys, type BookmarkFilters } from "@/hooks/queries/keys";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_BY_VIEW,
} from "@/components/home/constants";
import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { BookmarkWithFolder } from "@/components/home/types";

// ============================================================================
// 类型定义
// ============================================================================

interface BookmarkPage {
  bookmarks: BookmarkWithFolder[];
  pagination: {
    total: number;
    limit: number;
    nextCursor: number | null;
    hasMore: boolean;
  };
}

export interface UseHomeBookmarksOptions {
  /** 平台筛选 */
  platform: string;
  /** 排序方式 */
  sort: string;
  /** 文件夹/虚拟文件夹 */
  folder: string;
  /** 用途标签 */
  usageTags?: string[];
  /** 每页数量（基于视图模式） */
  pageSize?: number;
  /** SSR 预加载的初始数据 */
  initialBookmarks?: BookmarkWithFolder[];
  /** 是否启用查询 */
  enabled?: boolean;
}

// ============================================================================
// API 请求
// ============================================================================

function buildApiUrl(
  platform: string,
  sort: string,
  folder: string,
  usageTags: string[],
  limit: number,
  offset: number,
): string {
  const params = new URLSearchParams();

  if (platform === "browser") {
    params.set("platform", "browser");
  } else if (platform) {
    params.set("platform", platform);
  } else {
    // "全部"模式排除浏览器平台
    params.set("excludeBrowser", "true");
  }

  if (folder) {
    params.set("folder", folder);
  }

  if (sort) {
    params.set("sort", sort);
  }

  if (usageTags.length > 0) {
    params.set("usageTags", usageTags.join(","));
  }

  params.set("limit", String(limit));
  params.set("offset", String(offset));

  return `/api/bookmarks?${params.toString()}`;
}

async function fetchBookmarkPage(
  platform: string,
  sort: string,
  folder: string,
  usageTags: string[],
  limit: number,
  offset: number,
): Promise<BookmarkPage> {
  const url = buildApiUrl(platform, sort, folder, usageTags, limit, offset);
  const response = await fetchWithAuth(url);

  if (!response.ok) {
    throw new Error("获取书签列表失败");
  }

  const json = await response.json();
  const data = json.data || {};

  return {
    bookmarks: data.bookmarks || [],
    pagination: {
      total: data.pagination?.total ?? 0,
      limit,
      nextCursor: data.pagination?.nextCursor ?? null,
      hasMore: data.pagination?.hasMore ?? false,
    },
  };
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * Home V2 书签列表无限滚动 Hook
 *
 * 用法：
 * ```tsx
 * const { bookmarks, isLoading, hasMore, fetchNextPage, isFetchingNextPage } =
 *   useHomeBookmarks({ platform, sort, folder, initialBookmarks });
 * ```
 */
export function useHomeBookmarks({
  platform,
  sort,
  folder,
  usageTags = [],
  pageSize,
  initialBookmarks,
  enabled = true,
}: UseHomeBookmarksOptions) {
  const limit = pageSize ?? DEFAULT_PAGE_SIZE;

  // 构建 TanStack Query 的 filters 对象（作为 queryKey 的一部分）
  const filters: Omit<BookmarkFilters, "offset"> = useMemo(
    () => ({
      platform: platform || null,
      sortBy: sort?.startsWith("title") ? "title" : "created_at",
      sortOrder: sort?.endsWith("_asc") ? "asc" : "desc",
      isInTrash: folder === "trash" ? true : undefined,
      limit,
    }),
    [platform, sort, folder, limit],
  );

  // 构造 initialData（将 SSR 数据适配为 InfiniteData 格式）
  const initialData = useMemo(():
    | InfiniteData<BookmarkPage, number>
    | undefined => {
    if (!initialBookmarks || initialBookmarks.length === 0) return undefined;

    return {
      pages: [
        {
          bookmarks: initialBookmarks,
          pagination: {
            total: initialBookmarks.length,
            limit,
            nextCursor: null,
            hasMore: initialBookmarks.length >= limit,
          },
        },
      ],
      pageParams: [0],
    };
  }, [initialBookmarks, limit]);

  const query = useInfiniteQuery({
    queryKey: bookmarkKeys.infinite(filters),
    queryFn: ({ pageParam }) =>
      fetchBookmarkPage(platform, sort, folder, usageTags, limit, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.pagination.hasMore) return undefined;
      return allPages.reduce((acc, page) => acc + page.bookmarks.length, 0);
    },
    initialData,
    staleTime: 30_000, // B6: 30 秒内不 revalidate
    enabled,
  });

  // 扁平化所有页的书签
  const bookmarks = useMemo(
    () => query.data?.pages.flatMap((page) => page.bookmarks) ?? [],
    [query.data?.pages],
  );

  const hasMore = query.hasNextPage ?? false;

  return {
    bookmarks,
    isLoading: query.isLoading,
    hasMore,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// 页面大小辅助
// ============================================================================

/**
 * 根据视图模式获取页面大小
 */
export function getPageSizeForViewMode(viewMode: string): number {
  return (
    PAGE_SIZE_BY_VIEW[viewMode as keyof typeof PAGE_SIZE_BY_VIEW] ??
    DEFAULT_PAGE_SIZE
  );
}
