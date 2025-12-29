/**
 * TanStack Query Hooks 模块导出
 *
 * 提供书签、文件夹等数据的查询和变更操作
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

// ============================================
// Query Keys
// ============================================

export {
  bookmarkKeys,
  folderKeys,
  searchKeys,
  smartListKeys,
  type BookmarkFilters,
  type FolderFilters,
} from "./keys";

// ============================================
// Bookmark Hooks
// ============================================

export {
  // Queries
  useBookmarks,
  useBookmark,
  useBookmarkStats,
  useUserTags,
  // Mutations
  useCreateBookmark,
  useUpdateBookmark,
  useDeleteBookmark,
  useBatchDeleteBookmarks,
  useBatchMoveBookmarks,
  useBatchAddTags,
  useBatchRemoveTags,
  useToggleStar,
  useToggleRead,
} from "./use-bookmarks";

// ============================================
// Folder Hooks
// ============================================

export {
  // Queries
  useFoldersQuery,
  useFolderTree,
  useFolderDetail,
  useFolderPath,
  // Mutations
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useMoveFolder,
  useBatchSortFolders,
} from "./use-folders-query";

// ============================================
// Infinite Scroll Hooks
// ============================================

export {
  useInfiniteBookmarks,
  useFlatBookmarks,
} from "./use-infinite-bookmarks";
