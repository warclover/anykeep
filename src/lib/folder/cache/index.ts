/**
 * Folder Cache Module
 * 文件夹缓存模块导出
 *
 * @module folder/cache
 * @version 1.0.0
 * @since 2025-12-24
 */

export {
  FOLDERS_CACHE_KEY,
  CACHE_STALE_TIME,
  CACHE_MAX_AGE,
  getFoldersCache,
  setFoldersCache,
  isFoldersCacheFresh,
  getFoldersCacheTimestamp,
  clearFoldersCache,
} from "./client-cache";
