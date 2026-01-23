/**
 * 统一缓存门面（Facade）
 *
 * 提供简化的缓存 API，整合各种缓存策略：
 * - 内存缓存（LRU）
 * - 向量缓存（RAG 优化）
 * - 文件夹缓存失效
 *
 * @version 1.0.1
 * @since 2025-12-28
 * @updated 2025-12-28 - 修复 API 兼容性问题
 */

import { dataCache } from "./data-cache";
import { getVectorCache } from "./vector-cache";
import { cachePerformanceTracker } from "./cache-performance-tracker";
import { invalidateFolderCache } from "./folder-cache-invalidation";
import { DATA_CACHE_CONFIG, CACHE_KEYS } from "./cache-config";

// ============================================
// 类型定义
// ============================================

/**
 * 缓存层级
 */
export type CacheLayer = "memory" | "vector";

/**
 * 缓存配置选项
 */
export interface UnifiedCacheOptions {
  /** 缓存键 */
  key: string;
  /** 缓存层级（默认: memory） */
  layer?: CacheLayer;
  /** 过期时间（毫秒） */
  ttl?: number;
  /** 缓存标签（用于批量失效） */
  tags?: string[];
}

/**
 * 缓存统计信息
 */
export interface UnifiedCacheStats {
  /** 内存缓存条目数 */
  memoryEntries: number;
  /** 向量缓存条目数 */
  vectorEntries: number;
  /** 内存缓存命中率 */
  cacheHitRate: number;
}

// ============================================
// 统一缓存门面类
// ============================================

/**
 * 统一缓存门面
 *
 * 提供简化的缓存操作接口
 *
 * @example
 * ```typescript
 * // 简单的内存缓存
 * unifiedCache.set('user:123', userData);
 * const user = unifiedCache.get<User>('user:123');
 *
 * // 使用 fetch 模式（自动缓存）
 * const data = await unifiedCache.fetch('bookmarks:all', {
 *   fetcher: () => api.getBookmarks(),
 *   ttl: 60000,
 * });
 *
 * // 批量失效
 * unifiedCache.invalidateByTag('bookmarks');
 * ```
 */
class UnifiedCacheFacade {
  private tagIndex = new Map<string, Set<string>>();

  /**
   * 获取缓存值（同步）
   *
   * 注意：这是同步方法，直接从内存缓存获取
   */
  get<T>(key: string): T | undefined {
    const result = dataCache.getSync<T>(key);
    return result.data;
  }

  /**
   * 设置缓存值
   */
  set<T>(
    key: string,
    value: T,
    options: Partial<UnifiedCacheOptions> = {},
  ): void {
    const { tags = [] } = options;

    // 更新标签索引
    for (const tag of tags) {
      const tagKeys = this.tagIndex.get(tag);
      if (tagKeys) {
        tagKeys.add(key);
      } else {
        this.tagIndex.set(tag, new Set([key]));
      }
    }

    dataCache.setCache(key, value);
  }

  /**
   * 删除缓存值
   */
  delete(key: string): void {
    dataCache.invalidate(key);

    // 从标签索引中移除
    for (const [, keys] of this.tagIndex) {
      keys.delete(key);
    }
  }

  /**
   * 获取或设置缓存（fetch 模式）
   *
   * 如果缓存存在则返回，否则执行 fetcher 并缓存结果
   */
  async fetch<T>(
    key: string,
    options: {
      fetcher: () => Promise<T>;
      ttl?: number;
      staleTime?: number;
      tags?: string[];
    },
  ): Promise<T> {
    const { fetcher, ttl, staleTime, tags = [] } = options;

    // 更新标签索引
    for (const tag of tags) {
      const tagKeys = this.tagIndex.get(tag);
      if (tagKeys) {
        tagKeys.add(key);
      } else {
        this.tagIndex.set(tag, new Set([key]));
      }
    }

    // 使用 dataCache 的 SWR 模式
    const result = await dataCache.get<T>({
      cacheKey: key,
      fetcher,
      staleTime: staleTime ?? ttl ?? DATA_CACHE_CONFIG.staleTime,
      cacheTime: ttl ?? DATA_CACHE_CONFIG.cacheTime,
    });

    return result.data as T;
  }

  /**
   * 按标签批量失效
   */
  invalidateByTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    let count = 0;
    for (const key of keys) {
      this.delete(key);
      count++;
    }

    this.tagIndex.delete(tag);
    return count;
  }

  /**
   * 失效文件夹相关缓存
   */
  invalidateFolderRelated(folderId: number): void {
    invalidateFolderCache(String(folderId));
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): UnifiedCacheStats {
    const dataCacheStats = dataCache.getStats();
    const vectorCache = getVectorCache();
    const vectorStats = vectorCache.getStats();
    const perfStats = cachePerformanceTracker.getStats();

    return {
      memoryEntries: dataCacheStats.size,
      vectorEntries: vectorStats.size,
      cacheHitRate: perfStats.cacheHitRate,
    };
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    dataCache.clear();
    this.tagIndex.clear();
  }

  /**
   * 预热缓存
   *
   * 用于应用启动时预加载常用数据
   */
  async warmup(
    userId: string,
    fetchers: {
      profile?: () => Promise<unknown>;
      bookmarks?: () => Promise<unknown>;
      folders?: () => Promise<unknown>;
    },
  ): Promise<void> {
    const warmupPromises: Promise<void>[] = [];

    // 预热 Profile
    if (fetchers.profile) {
      warmupPromises.push(
        dataCache.prefetch(CACHE_KEYS.profile(userId), fetchers.profile),
      );
    }

    // 预热书签
    if (fetchers.bookmarks) {
      warmupPromises.push(
        dataCache.prefetch(CACHE_KEYS.bookmarks(userId), fetchers.bookmarks),
      );
    }

    // 预热文件夹
    if (fetchers.folders) {
      warmupPromises.push(
        dataCache.prefetch(CACHE_KEYS.folders(userId), fetchers.folders),
      );
    }

    await Promise.all(warmupPromises);
  }
}

// ============================================
// 导出
// ============================================

/**
 * 统一缓存实例
 */
export const unifiedCache = new UnifiedCacheFacade();

/**
 * 创建带命名空间的缓存
 *
 * @example
 * ```typescript
 * const userCache = createNamespacedCache('user');
 * userCache.set('profile', userData);
 * const profile = userCache.get<User>('profile');
 * // 实际键名: user:profile
 * ```
 */
export function createNamespacedCache(namespace: string) {
  return {
    get: <T>(key: string) => unifiedCache.get<T>(`${namespace}:${key}`),

    set: <T>(key: string, value: T, options?: Partial<UnifiedCacheOptions>) =>
      unifiedCache.set(`${namespace}:${key}`, value, options),

    delete: (key: string) => unifiedCache.delete(`${namespace}:${key}`),

    fetch: <T>(
      key: string,
      options: {
        fetcher: () => Promise<T>;
        ttl?: number;
        staleTime?: number;
        tags?: string[];
      },
    ) => unifiedCache.fetch(`${namespace}:${key}`, options),
  };
}
