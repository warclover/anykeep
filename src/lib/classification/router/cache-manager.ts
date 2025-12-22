/**
 * Fast Path Cache Manager
 * V4.2.7 快速路径缓存管理器
 *
 * @description 统一管理快速路径匹配器的缓存
 * - LRU 淘汰策略
 * - 自动过期清理
 * - 预热机制
 * - 统计监控
 * - V4.2.7: 动态 TTL（活跃用户 2 分钟，非活跃用户 5 分钟）
 *
 * @version 1.1.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { tagMatcher } from "./tag-matcher";
import { titleMatcher } from "./title-matcher";
import { sourceProfileService } from "@/lib/source-profile/source-profile.service";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 缓存过期时间（毫秒） */
  ttlMs: number;
  /** 最大缓存条目数 */
  maxEntries: number;
  /** 是否启用预热 */
  enableWarmup: boolean;
  /** 预热数据量 */
  warmupLimit: number;
}

/**
 * 缓存统计
 */
export interface CacheStats {
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 当前缓存大小 */
  size: number;
  /** 命中率 */
  hitRate: number;
  /** 最后清理时间 */
  lastCleanup: Date | null;
  /** 最后预热时间 */
  lastWarmup: Date | null;
}

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  data: T;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

/**
 * 用户快速路径缓存
 */
interface UserFastPathCache {
  /** 用户 ID */
  userId: string;
  /** 常用文件夹 */
  frequentFolders: Array<{
    folderId: number;
    folderName: string;
    usageCount: number;
    lastUsed: Date;
  }>;
  /** 常用来源 */
  frequentSources: Array<{
    domain: string;
    preferredFolderId: number;
    confidence: number;
  }>;
  /** 常用标签 */
  frequentTags: Array<{
    tag: string;
    preferredFolderId: number;
    count: number;
  }>;
  /** 缓存创建时间 */
  cachedAt: number;
}

// ============================================================================
// 默认配置
// ============================================================================

/**
 * V4.2.7: 动态 TTL 配置
 * - 活跃用户（近期有多次访问）: 较短 TTL，确保数据新鲜度
 * - 非活跃用户: 较长 TTL，减少数据库负载
 */
const DYNAMIC_TTL_CONFIG = {
  /** 活跃用户 TTL (2 分钟) */
  activeTtlMs: 2 * 60 * 1000,
  /** 非活跃用户 TTL (5 分钟) */
  inactiveTtlMs: 5 * 60 * 1000,
  /** 判定为活跃用户的访问次数阈值 */
  activeThreshold: 3,
  /** 判定活跃的时间窗口 (10 分钟) */
  activeWindowMs: 10 * 60 * 1000,
} as const;

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttlMs: DYNAMIC_TTL_CONFIG.activeTtlMs, // V4.2.7: 默认使用活跃用户 TTL
  maxEntries: 100,
  enableWarmup: true,
  warmupLimit: 50,
};

// ============================================================================
// 快速路径缓存管理器
// ============================================================================

/**
 * 快速路径缓存管理器
 */
export class FastPathCacheManager {
  private config: CacheConfig;
  private cache: Map<string, CacheEntry<UserFastPathCache>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    hitRate: 0,
    lastCleanup: null,
    lastWarmup: null,
  };
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * 获取用户快速路径缓存
   * V4.2.7: 支持动态 TTL（活跃用户更短，非活跃用户更长）
   */
  async getUserCache(userId: string): Promise<UserFastPathCache | null> {
    const cacheKey = `user_fast_path_${userId}`;
    const entry = this.cache.get(cacheKey);
    const now = Date.now();

    // V4.2.7: 使用动态 TTL
    if (entry) {
      const effectiveTtl = this.getEffectiveTtl(entry);

      // 检查缓存是否有效
      if (entry.createdAt + effectiveTtl > now) {
        // 更新访问统计
        entry.lastAccessedAt = now;
        entry.accessCount++;
        this.stats.hits++;
        this.updateHitRate();
        return entry.data;
      }
    }

    // 缓存未命中
    this.stats.misses++;
    this.updateHitRate();

    // 加载新数据
    const freshData = await this.loadUserFastPathData(userId);
    if (freshData) {
      this.setCache(cacheKey, freshData);
    }

    return freshData;
  }

  /**
   * V4.2.7: 计算有效 TTL
   * 活跃用户使用较短 TTL，非活跃用户使用较长 TTL
   */
  private getEffectiveTtl(entry: CacheEntry<UserFastPathCache>): number {
    const now = Date.now();
    const timeSinceLastAccess = now - entry.lastAccessedAt;

    // 如果用户在时间窗口内有足够多的访问，认为是活跃用户
    if (
      entry.accessCount >= DYNAMIC_TTL_CONFIG.activeThreshold &&
      timeSinceLastAccess < DYNAMIC_TTL_CONFIG.activeWindowMs
    ) {
      return DYNAMIC_TTL_CONFIG.activeTtlMs;
    }

    // 非活跃用户使用较长 TTL
    return DYNAMIC_TTL_CONFIG.inactiveTtlMs;
  }

  /**
   * 预热用户缓存
   * V4.2.7: 使用动态 TTL 判断缓存有效性
   */
  async warmupUserCache(userId: string): Promise<void> {
    if (!this.config.enableWarmup) {
      return;
    }

    const cacheKey = `user_fast_path_${userId}`;

    // 已有有效缓存则跳过（使用动态 TTL）
    const existing = this.cache.get(cacheKey);
    if (existing) {
      const effectiveTtl = this.getEffectiveTtl(existing);
      if (existing.createdAt + effectiveTtl > Date.now()) {
        return;
      }
    }

    // 加载并缓存数据
    const data = await this.loadUserFastPathData(userId);
    if (data) {
      this.setCache(cacheKey, data);
      this.stats.lastWarmup = new Date();
    }
  }

  /**
   * 批量预热
   */
  async batchWarmup(userIds: string[]): Promise<void> {
    const warmupPromises = userIds
      .slice(0, this.config.warmupLimit)
      .map((userId) => this.warmupUserCache(userId).catch(() => null));
    await Promise.all(warmupPromises);
    this.stats.lastWarmup = new Date();
  }

  /**
   * 清除用户缓存
   */
  clearUserCache(userId: string): void {
    const cacheKey = `user_fast_path_${userId}`;
    this.cache.delete(cacheKey);
    this.stats.size = this.cache.size;

    // 同时清除各匹配器的缓存
    tagMatcher.clearCache(userId);
    titleMatcher.clearCache(userId);
    sourceProfileService.clearUserCache(userId);
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      hitRate: 0,
      lastCleanup: null,
      lastWarmup: null,
    };

    // 清除各匹配器的缓存
    tagMatcher.clearAllCache();
    titleMatcher.clearAllCache();
    sourceProfileService.clearAllCache();
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size,
    };
  }

  /**
   * 标记用户数据已变更（触发缓存失效）
   */
  invalidateUser(userId: string): void {
    this.clearUserCache(userId);
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 加载用户快速路径数据
   */
  private async loadUserFastPathData(
    userId: string,
  ): Promise<UserFastPathCache | null> {
    try {
      const supabase = await createClient();

      // 并行加载数据
      const [foldersResult, bookmarksResult] = await Promise.all([
        // 获取用户文件夹
        supabase
          .from("folders")
          .select("id, name")
          .eq("user_id", userId)
          .eq("is_archived", false)
          .order("updated_at", { ascending: false })
          .limit(this.config.warmupLimit),
        // 获取最近书签 (tags 列可能存在，添加类型断言)
        supabase
          .from("bookmarks")
          .select("folder_id, url, tags")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(200) as unknown as Promise<{
          data: Array<{
            folder_id: number | null;
            url: string;
            tags: string[] | null;
          }> | null;
          error: unknown;
        }>,
      ]);

      if (foldersResult.error || !foldersResult.data) {
        return null;
      }

      // 统计文件夹使用频率
      const folderUsage = new Map<number, { count: number; lastUsed: Date }>();
      const domainPreference = new Map<string, Map<number, number>>();
      const tagPreference = new Map<string, Map<number, number>>();

      if (bookmarksResult.data) {
        for (const bookmark of bookmarksResult.data) {
          if (!bookmark.folder_id) continue;

          // 文件夹使用统计
          const usage = folderUsage.get(bookmark.folder_id) || {
            count: 0,
            lastUsed: new Date(),
          };
          usage.count++;
          folderUsage.set(bookmark.folder_id, usage);

          // 域名偏好统计
          try {
            const domain = new URL(bookmark.url).hostname;
            const domainMap = domainPreference.get(domain) || new Map();
            domainMap.set(
              bookmark.folder_id,
              (domainMap.get(bookmark.folder_id) || 0) + 1,
            );
            domainPreference.set(domain, domainMap);
          } catch {
            // Invalid URL, skip
          }

          // 标签偏好统计
          const tags = bookmark.tags as string[] | null;
          if (tags) {
            for (const tag of tags) {
              const normalizedTag = tag.toLowerCase().trim();
              const tagMap = tagPreference.get(normalizedTag) || new Map();
              tagMap.set(
                bookmark.folder_id,
                (tagMap.get(bookmark.folder_id) || 0) + 1,
              );
              tagPreference.set(normalizedTag, tagMap);
            }
          }
        }
      }

      // 构建常用文件夹
      const frequentFolders = foldersResult.data
        .map((folder) => {
          const usage = folderUsage.get(folder.id);
          return {
            folderId: folder.id,
            folderName: folder.name,
            usageCount: usage?.count || 0,
            lastUsed: usage?.lastUsed || new Date(),
          };
        })
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 20);

      // 构建常用来源
      const frequentSources: UserFastPathCache["frequentSources"] = [];
      for (const [domain, folderMap] of domainPreference.entries()) {
        // 找到最常用的文件夹
        let maxCount = 0;
        let preferredFolderId = 0;
        for (const [folderId, count] of folderMap.entries()) {
          if (count > maxCount) {
            maxCount = count;
            preferredFolderId = folderId;
          }
        }
        if (maxCount >= 3) {
          // 至少 3 个样本
          const totalForDomain = Array.from(folderMap.values()).reduce(
            (a, b) => a + b,
            0,
          );
          frequentSources.push({
            domain,
            preferredFolderId,
            confidence: (maxCount / totalForDomain) * 100,
          });
        }
      }
      frequentSources.sort((a, b) => b.confidence - a.confidence);

      // 构建常用标签
      const frequentTags: UserFastPathCache["frequentTags"] = [];
      for (const [tag, folderMap] of tagPreference.entries()) {
        let maxCount = 0;
        let preferredFolderId = 0;
        for (const [folderId, count] of folderMap.entries()) {
          if (count > maxCount) {
            maxCount = count;
            preferredFolderId = folderId;
          }
        }
        if (maxCount >= 2) {
          // 至少 2 个样本
          frequentTags.push({
            tag,
            preferredFolderId,
            count: maxCount,
          });
        }
      }
      frequentTags.sort((a, b) => b.count - a.count);

      return {
        userId,
        frequentFolders,
        frequentSources: frequentSources.slice(0, 30),
        frequentTags: frequentTags.slice(0, 50),
        cachedAt: Date.now(),
      };
    } catch (error) {
      logger.error({ error, userId }, "Failed to load user fast path data");
      return null;
    }
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, data: UserFastPathCache): void {
    // LRU 淘汰
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 1,
    });

    this.stats.size = this.cache.size;
  }

  /**
   * LRU 淘汰
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccessTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestAccessTime) {
        oldestAccessTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    // 每分钟清理一次过期缓存
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, 60 * 1000);
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt + this.config.ttlMs <= now) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    this.stats.size = this.cache.size;
    this.stats.lastCleanup = new Date();
  }

  /**
   * 销毁（清理定时器）
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

// ============================================================================
// 单例导出
// ============================================================================

export const fastPathCacheManager = new FastPathCacheManager();

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 预热活跃用户缓存
 */
export async function warmupActiveUsers(): Promise<void> {
  try {
    const supabase = await createClient();

    // 获取最近活跃用户
    const { data: activeUsers } = await supabase
      .from("profiles")
      .select("id")
      .gte(
        "updated_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      )
      .limit(50);

    if (activeUsers && activeUsers.length > 0) {
      await fastPathCacheManager.batchWarmup(activeUsers.map((u) => u.id));
    }
  } catch (error) {
    logger.error({ error }, "Failed to warmup active users cache");
  }
}

/**
 * 获取缓存健康状态
 */
export function getCacheHealthStatus(): {
  healthy: boolean;
  stats: CacheStats;
  issues: string[];
} {
  const stats = fastPathCacheManager.getStats();
  const issues: string[] = [];

  // 检查命中率
  if (stats.hits + stats.misses > 100 && stats.hitRate < 50) {
    issues.push(`Low cache hit rate: ${stats.hitRate.toFixed(1)}%`);
  }

  // 检查缓存大小
  if (stats.size > DEFAULT_CACHE_CONFIG.maxEntries * 0.9) {
    issues.push(
      `Cache near capacity: ${stats.size}/${DEFAULT_CACHE_CONFIG.maxEntries}`,
    );
  }

  return {
    healthy: issues.length === 0,
    stats,
    issues,
  };
}
