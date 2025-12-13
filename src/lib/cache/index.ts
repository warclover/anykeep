/**
 * 缓存系统统一导出
 */

// 配置
export {
  KEEP_ALIVE_CONFIG,
  DATA_CACHE_CONFIG,
  PAGE_CACHE_CONFIG,
  DATA_TYPE_CONFIG,
  CACHE_KEYS,
  getPageCacheConfig,
  getDataCacheConfig,
  type CachePriority,
} from "./cache-config";

// 数据缓存
export {
  dataCache,
  cacheInvalidation,
  type FetchOptions,
  type FetchResult,
} from "./data-cache";

// Hooks
export {
  useCachedData,
  useBookmarks,
  useFolders,
  useProfile,
  useAnalytics,
  prefetchBookmarks,
} from "./hooks/use-cached-data";

// 增强版书签 Hook (SWR 模式)
export { useBookmarksSWR } from "./hooks/use-bookmarks-swr";

// KeepAlive 页面缓存
export {
  KeepAliveProvider,
  KeepAliveOutlet,
  useKeepAlive,
  usePageKeepAlive,
  shouldCachePage,
  getPagePriority,
} from "./keep-alive";

// V5.0.1: 性能追踪
export {
  cachePerformanceTracker,
  useCachePerformanceTracking,
} from "./cache-performance-tracker";
