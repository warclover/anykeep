/**
 * Folder Cache (Backward Compatibility)
 *
 * @deprecated This module is deprecated. Please import from "@/lib/folder" instead.
 * This file is kept for backward compatibility during migration.
 *
 * @version 1.1.0
 * @since V4.2.26 收藏夹性能优化
 * @deprecated 2025-12-24 - Use @/lib/folder instead
 */

// Re-export everything from the new unified folder module
export {
  FOLDERS_CACHE_KEY,
  CACHE_STALE_TIME,
  CACHE_MAX_AGE,
  getFoldersCache,
  setFoldersCache,
  isFoldersCacheFresh,
  getFoldersCacheTimestamp,
  clearFoldersCache,
} from "@/lib/folder";
