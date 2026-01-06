/**
 * 缓存系统统一导出
 *
 * @version 5.5.0
 * @since 2025-12-22
 * @updated 2025-12-28 - 添加 UnifiedCacheFacade
 * @updated 2026-01-06 - 添加事件驱动缓存失效服务 (P2)
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

// V5.2: 文件夹缓存失效
export {
  invalidateFolderCache,
  subscribeFolderCacheInvalidation,
  folderCacheInvalidation,
} from "./folder-cache-invalidation";

// V5.3: 向量缓存 (RAG 优化)
export {
  VectorCache,
  getVectorCache,
  DEFAULT_VECTOR_CACHE_CONFIG,
  type VectorCacheConfig,
  type VectorCacheStats,
} from "./vector-cache";

// V5.4: 统一缓存门面
export {
  unifiedCache,
  createNamespacedCache,
  type CacheLayer,
  type UnifiedCacheOptions,
  type UnifiedCacheStats,
} from "./unified-cache";

// V5.5: 事件驱动缓存失效 (P2)
export {
  cacheInvalidationService,
  createCacheInvalidationService,
  type CacheInvalidationRule,
  type CacheInvalidationServiceConfig,
} from "./event-driven-cache-invalidation";
