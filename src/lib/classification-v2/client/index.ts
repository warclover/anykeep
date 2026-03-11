/**
 * Classification v2 client-side utilities
 *
 * 客户端分类工具：标签预匹配、文件夹缓存同步
 */

export {
  TagPreMatcher,
  tagPreMatcher,
  type CachedFolder,
  type PreMatchResult,
  type TagPreMatcherConfig,
} from "./tag-pre-matcher";

export {
  FolderCacheSyncService,
  folderCacheSync,
  type SyncResult,
  type FolderCacheSyncConfig,
} from "./folder-cache-sync";
