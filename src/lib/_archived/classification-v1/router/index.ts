/**
 * Classification Router Module
 * V4.2 分类路由模块导出
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

// Content Router
export {
  ContentRouter,
  contentRouter,
  shouldUseFastPath,
  shouldUseSlowPath,
  getPathDisplayName,
} from "./content-router";

export type {
  RoutePath,
  RouteInput,
  RouteDecision,
  FastPathResult,
  ContentComplexity,
} from "./content-router";

// Tag Matcher
export { TagMatcher, tagMatcher } from "./tag-matcher";

export type { TagMatchResult } from "./tag-matcher";

// Title Matcher
export { TitleMatcher, titleMatcher } from "./title-matcher";

export type { TitleMatchResult } from "./title-matcher";

// Cache Manager — 已迁出到 @/lib/cache/fast-path-cache
export {
  FastPathCacheManager,
  fastPathCacheManager,
  getCacheHealthStatus,
} from "@/lib/cache/fast-path-cache";

export type { CacheConfig, CacheStats } from "@/lib/cache/fast-path-cache";
