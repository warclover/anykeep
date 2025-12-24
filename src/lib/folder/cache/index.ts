/**
 * Folder Cache Module
 * 文件夹缓存模块导出
 *
 * ✅ 此模块是客户端安全的，可在以下环境使用：
 * - Client Components（"use client"）
 * - Server Components
 * - API Routes
 *
 * 客户端组件推荐导入方式：
 * import { setFoldersCache, clearFoldersCache } from "@/lib/folder/cache"
 *
 * @module folder/cache
 * @version 1.1.0
 * @since 2025-12-24
 * @updated 2025-12-25 - Added client-safe documentation
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
