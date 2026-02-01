/**
 * 意图缓存（L1 精确匹配）
 *
 * 基于消息精确匹配的快速缓存
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { ClassifierResult } from "../types";
import type { CacheEntry, CacheStats } from "./types";

// ============================================
// 配置
// ============================================

/**
 * 意图缓存配置
 */
export interface IntentCacheConfig {
  /** 最大缓存条目数 */
  maxSize?: number;
  /** 默认 TTL（毫秒） */
  defaultTTL?: number;
  /** 是否启用 LRU 淘汰 */
  enableLRU?: boolean;
}

const DEFAULT_CONFIG: Required<IntentCacheConfig> = {
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000, // 5 分钟
  enableLRU: true,
};

// ============================================
// IntentCache 类
// ============================================

/**
 * 意图缓存
 *
 * L1 级别缓存，基于消息精确匹配
 */
export class IntentCache {
  private cache: Map<string, CacheEntry<ClassifierResult>>;
  private config: Required<IntentCacheConfig>;
  private stats: { hits: number; misses: number };

  constructor(config: IntentCacheConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 生成缓存键
   */
  private generateKey(message: string, userId: string): string {
    return `${userId}:${message.toLowerCase().trim()}`;
  }

  /**
   * 获取缓存
   */
  get(message: string, userId: string): ClassifierResult | null {
    const key = this.generateKey(message, userId);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // 更新访问信息
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    this.stats.hits++;

    return entry.value;
  }

  /**
   * 设置缓存
   */
  set(
    message: string,
    userId: string,
    result: ClassifierResult,
    ttl?: number,
  ): void {
    const key = this.generateKey(message, userId);
    const now = Date.now();

    // 检查是否需要淘汰
    if (this.cache.size >= this.config.maxSize) {
      this.evict();
    }

    const entry: CacheEntry<ClassifierResult> = {
      value: result,
      createdAt: now,
      expiresAt: now + (ttl ?? this.config.defaultTTL),
      accessCount: 1,
      lastAccessedAt: now,
    };

    this.cache.set(key, entry);
  }

  /**
   * 删除缓存
   */
  delete(message: string, userId: string): boolean {
    const key = this.generateKey(message, userId);
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 淘汰策略
   */
  private evict(): void {
    if (!this.config.enableLRU) {
      // 简单淘汰：删除第一个
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
      return;
    }

    // LRU 淘汰：删除最久未访问的
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 清理过期条目
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    let expiredCount = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      expiredCount,
    };
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建意图缓存实例
 */
export function createIntentCache(config?: IntentCacheConfig): IntentCache {
  return new IntentCache(config);
}
