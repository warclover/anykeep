/**
 * 文件夹书签获取 Hook (v2.1 分页加载)
 *
 * 根据 FolderSelection 状态获取对应的书签列表
 * 支持分组选择（获取多个文件夹的书签）和单文件夹选择
 * 支持无限滚动分页加载
 */

import useSWRInfinite from "swr/infinite";
import { useCallback, useMemo } from "react";
import { API_PATHS } from "@/lib/constants/api-paths";
import type {
  FolderSelection,
  FolderWithStats,
  BookmarkWithFolder,
} from "@/components/folders/types";

/** 每页书签数量 */
const PAGE_SIZE = 50;

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
  ) => Promise<BookmarkWithFolder[][] | undefined>;
}

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
    case "group": {
      // 获取该分组下所有文件夹的 ID
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
}

/**
 * 获取书签数据（分页版本）
 */
async function fetchBookmarksPage(
  folderIds: number[],
  offset: number,
): Promise<BookmarkWithFolder[]> {
  if (folderIds.length === 0) {
    return [];
  }

  const response = await fetch(
    `${API_PATHS.bookmarks.list}?folderIds=${folderIds.join(",")}&limit=${PAGE_SIZE}&offset=${offset}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch bookmarks");
  }

  const result = await response.json();
  // v1 API 返回 { data: { items: [...] } }，旧版返回 { data: { bookmarks: [...] } } 或 { data: [...] }
  return result.data?.items || result.data?.bookmarks || result.data || [];
}

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
  // 计算 folderIds（用于缓存 key 和请求）
  const folderIds = useMemo(
    () => (selection ? getFolderIds(selection, folders) : []),
    [selection, folders],
  );
  const folderIdsKey = useMemo(
    () => [...folderIds].sort().join(","),
    [folderIds],
  );

  // 生成分页 key
  const getKey = useCallback(
    (pageIndex: number, previousPageData: BookmarkWithFolder[] | null) => {
      // 禁用时返回 null
      if (!enabled || !selection || folderIds.length === 0) return null;

      // 上一页没有数据或数据不足一页，说明没有更多了
      if (previousPageData && previousPageData.length < PAGE_SIZE) return null;

      // 返回缓存 key（包含 offset）
      return `${API_PATHS.bookmarks.list}?folderIds=${folderIdsKey}&page=${pageIndex}`;
    },
    [enabled, selection, folderIds.length, folderIdsKey],
  );

  // 请求函数
  const fetcher = useCallback(
    async (key: string) => {
      // 从 key 中提取页码
      const match = key.match(/page=(\d+)/);
      const pageIndex = match ? parseInt(match[1], 10) : 0;
      const offset = pageIndex * PAGE_SIZE;

      return fetchBookmarksPage(folderIds, offset);
    },
    [folderIds],
  );

  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<BookmarkWithFolder[]>(getKey, fetcher, {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateFirstPage: false,
      dedupingInterval: 30000,
      errorRetryCount: 2,
    });

  // 展平分页数据
  const bookmarks = data ? data.flat() : [];

  // 判断是否有更多数据
  const lastPage = data ? data[data.length - 1] : null;
  const hasMore = lastPage ? lastPage.length >= PAGE_SIZE : false;

  // 是否正在加载更多
  const isLoadingMore =
    isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");

  // 加载更多
  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      setSize(size + 1);
    }
  }, [isLoadingMore, hasMore, setSize, size]);

  // 刷新数据（重置分页）
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // 手动更新数据（用于乐观更新）
  const updateData = useCallback(
    async (newData?: BookmarkWithFolder[], shouldRevalidate = true) => {
      if (newData) {
        // 将展平的数据分页存储
        const pages: BookmarkWithFolder[][] = [];
        for (let i = 0; i < newData.length; i += PAGE_SIZE) {
          pages.push(newData.slice(i, i + PAGE_SIZE));
        }
        // 确保至少有一页
        if (pages.length === 0) pages.push([]);
        return mutate(pages, shouldRevalidate);
      }
      return mutate(undefined, shouldRevalidate);
    },
    [mutate],
  );

  return {
    bookmarks,
    isLoading,
    isLoadingMore: !!isLoadingMore,
    isValidating,
    hasMore,
    error: error || null,
    loadMore,
    refresh,
    mutate: updateData,
  };
}
