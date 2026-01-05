/**
 * 文件夹书签获取 Hook
 *
 * 根据 FolderSelection 状态获取对应的书签列表
 * 支持分组选择（获取多个文件夹的书签）和单文件夹选择
 */

import useSWR from "swr";
import type {
  FolderSelection,
  FolderWithStats,
} from "@/components/folders/types";
import type { Bookmark } from "@/types/supabase";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

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
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否正在验证（后台刷新） */
  isValidating: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 手动更新数据 */
  mutate: (
    data?: BookmarkWithFolder[],
    shouldRevalidate?: boolean,
  ) => Promise<BookmarkWithFolder[] | undefined>;
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
 * 生成 SWR 缓存 Key
 */
function generateCacheKey(
  selection: FolderSelection | null,
  folders: FolderWithStats[],
): string | null {
  if (!selection) return null;

  const folderIds = getFolderIds(selection, folders);
  if (folderIds.length === 0) return null;

  // 使用选择类型和文件夹 IDs 生成唯一 Key
  return `/api/bookmarks?folderIds=${folderIds.sort().join(",")}`;
}

/**
 * 获取书签数据
 */
async function fetchBookmarks(
  selection: FolderSelection,
  folders: FolderWithStats[],
): Promise<BookmarkWithFolder[]> {
  const folderIds = getFolderIds(selection, folders);

  if (folderIds.length === 0) {
    return [];
  }

  // 单文件夹：使用现有 API
  if (folderIds.length === 1) {
    const response = await fetch(
      `/api/bookmarks?folderId=${folderIds[0]}&limit=100`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch bookmarks");
    }
    const result = await response.json();
    return result.data || [];
  }

  // 多文件夹（分组选择）：并行请求然后合并
  // 注意：这是临时方案，后续可以优化 API 支持批量查询
  const results = await Promise.all(
    folderIds.map(async (folderId) => {
      const response = await fetch(
        `/api/bookmarks?folderId=${folderId}&limit=100`,
      );
      if (!response.ok) {
        return [];
      }
      const result = await response.json();
      return result.data || [];
    }),
  );

  // 合并结果并按创建时间排序
  const allBookmarks = results.flat();
  allBookmarks.sort((a, b) => {
    const aTime = new Date(a.created_at || 0).getTime();
    const bTime = new Date(b.created_at || 0).getTime();
    return bTime - aTime;
  });

  return allBookmarks;
}

/**
 * 文件夹书签获取 Hook
 *
 * @example
 * ```tsx
 * const { bookmarks, isLoading } = useFolderBookmarks({
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
  const cacheKey = enabled ? generateCacheKey(selection, folders) : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    BookmarkWithFolder[]
  >(
    cacheKey,
    () => {
      if (!selection) return Promise.resolve([]);
      return fetchBookmarks(selection, folders);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000, // 30 秒内相同请求去重
      errorRetryCount: 2,
    },
  );

  return {
    bookmarks: data || [],
    isLoading,
    isValidating,
    error: error || null,
    refresh: async () => {
      await mutate();
    },
    mutate: async (newData, shouldRevalidate = true) => {
      return mutate(newData, shouldRevalidate);
    },
  };
}
