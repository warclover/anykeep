/**
 * 文件夹书签获取 Hook (v3.0 TanStack Query 版本)
 *
 * 根据 FolderSelection 状态获取对应的书签列表
 * 支持分组选择（获取多个文件夹的书签）和单文件夹选择
 * 支持无限滚动分页加载
 *
 * @version 3.0.0 - 迁移到 TanStack Query，消除 SWR 双缓存问题
 * @since 2025-12-29
 *
 * 变更历史：
 * - v2.1: SWR Infinite 分页加载
 * - v3.0: 迁移到 TanStack Query useInfiniteQuery
 */

"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { API_PATHS } from "@/lib/constants/api-paths";
import { folderBookmarkKeys } from "@/hooks/queries/keys";
import type {
  FolderSelection,
  FolderWithStats,
  BookmarkWithFolder,
} from "@/components/folders/types";

/** 每页书签数量 */
const PAGE_SIZE = 50;

/** 缓存时间：2 分钟 */
const STALE_TIME = 2 * 60 * 1000;

interface UseFolderBookmarksOptions {
  /** 当前选择状态 */
  selection: FolderSelection | null;
  /** 文件夹列表（用于分组选择时获取文件夹 IDs） */
  folders: FolderWithStats[];
  /** 是否启用 */
  enabled?: boolean;
}

interface UseFolderBookmarksResult {
  /** 书签列表 */
  bookmarks: BookmarkWithFolder[];
  /** 是否正在加载首页 */
  isLoading: boolean;
  /** 是否正在加载更多 */
  isLoadingMore: boolean;
  /** 是否正在验证（后台刷新） */
  isValidating: boolean;
  /** 是否有更多数据 */
  hasMore: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 加载更多 */
  loadMore: () => void;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 手动更新数据 */
  mutate: (
    data?: BookmarkWithFolder[],
    shouldRevalidate?: boolean,
  ) => Promise<BookmarkWithFolder[] | undefined>;
}

// ============================================
// 响应类型
// ============================================

interface FolderBookmarksPage {
  items: BookmarkWithFolder[];
  offset: number;
  hasMore: boolean;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 根据选择状态获取 folder IDs
 */
function getFolderIds(
  selection: FolderSelection,
  folders: FolderWithStats[],
): number[] {
  switch (selection.type) {
    case "folder":
    case "system":
      return [selection.folderId];
    case "category":
      return folders
        .filter(
          (f) =>
            !f.is_archived &&
            !f.is_system &&
            f.category_id === selection.categoryId,
        )
        .map((f) => f.id);
    case "group":
      return folders
        .filter(
          (f) =>
            !f.is_archived &&
            !f.is_system &&
            (f.folder_group || "other") === selection.groupId,
        )
        .map((f) => f.id);
  }
}

/**
 * 获取书签数据（分页版本）
 */
async function fetchBookmarksPage(
  folderIds: number[],
  offset: number,
): Promise<FolderBookmarksPage> {
  if (folderIds.length === 0) {
    return { items: [], offset, hasMore: false };
  }

  const response = await fetch(
    `${API_PATHS.bookmarks.list}?folderIds=${folderIds.join(",")}&limit=${PAGE_SIZE}&offset=${offset}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch bookmarks");
  }

  const result = await response.json();
  // v1 API 返回 { data: { items: [...] } }，旧版返回 { data: { bookmarks: [...] } } 或 { data: [...] }
  const items: BookmarkWithFolder[] =
    result.data?.items || result.data?.bookmarks || result.data || [];

  return {
    items,
    offset,
    hasMore: items.length >= PAGE_SIZE,
  };
}

// ============================================
// Hook 实现
// ============================================

/**
 * 文件夹书签获取 Hook（支持分页）
 *
 * @example
 * ```tsx
 * const { bookmarks, isLoading, hasMore, loadMore } = useFolderBookmarks({
 *   selection: { type: "folder", folderId: 123 },
 *   folders: allFolders,
 * });
 * ```
 */
export function useFolderBookmarks({
  selection,
  folders,
  enabled = true,
}: UseFolderBookmarksOptions): UseFolderBookmarksResult {
  const queryClient = useQueryClient();

  // 计算 folderIds（用于缓存 key 和请求）
  const folderIds = useMemo(
    () => (selection ? getFolderIds(selection, folders) : []),
    [selection, folders],
  );

  // 判断是否应该启用查询
  const shouldFetch = enabled && selection !== null && folderIds.length > 0;

  // 使用 TanStack Query 的 useInfiniteQuery
  const {
    data,
    error,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery<FolderBookmarksPage>({
    queryKey: folderBookmarkKeys.byFolderIds(folderIds),

    queryFn: ({ pageParam }) =>
      fetchBookmarksPage(folderIds, pageParam as number),

    initialPageParam: 0,

    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) {
        return undefined;
      }
      return lastPage.offset + lastPage.items.length;
    },

    enabled: shouldFetch,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
    retryDelay: 3000,
  });

  // 展平分页数据
  const bookmarks = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  // 加载更多
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 刷新数据（重置分页）
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // 手动更新数据（用于乐观更新）
  const updateData = useCallback(
    async (
      newData?: BookmarkWithFolder[],
      shouldRevalidate = true,
    ): Promise<BookmarkWithFolder[] | undefined> => {
      const queryKey = folderBookmarkKeys.byFolderIds(folderIds);

      if (newData) {
        // 将展平的数据分页存储
        const pages: FolderBookmarksPage[] = [];
        for (let i = 0; i < newData.length; i += PAGE_SIZE) {
          const pageItems = newData.slice(i, i + PAGE_SIZE);
          pages.push({
            items: pageItems,
            offset: i,
            hasMore: i + PAGE_SIZE < newData.length,
          });
        }
        // 确保至少有一页
        if (pages.length === 0) {
          pages.push({ items: [], offset: 0, hasMore: false });
        }

        queryClient.setQueryData(queryKey, {
          pages,
          pageParams: pages.map((_, idx) => idx * PAGE_SIZE),
        });

        if (shouldRevalidate) {
          await refetch();
        }
        return newData;
      }

      if (shouldRevalidate) {
        await refetch();
      }
      return bookmarks;
    },
    [folderIds, queryClient, refetch, bookmarks],
  );

  return {
    bookmarks,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    isValidating: isFetching && !isLoading,
    hasMore: !!hasNextPage,
    error: error || null,
    loadMore,
    refresh,
    mutate: updateData,
  };
}
