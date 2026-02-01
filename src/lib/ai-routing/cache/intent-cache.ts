/**
 * 意图缓存（L1 精确匹配）
 *
 * 基于消息精确匹配的快速缓存
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { ClassifierResult } from "../types";
import type { CacheEntry, CacheStats, CacheStatsPersistence } from "./types";

// ============================================
// 哈希工具
// ============================================

/**
 * 简单的 FNV-1a 哈希算法
 * 用于将长消息转换为固定长度的哈希值
 */
function fnv1aHash(str: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, 保持为 32 位无符号整数
  }
  return hash.toString(36);
}

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

  /** 消息长度阈值，超过此长度使用哈希 */
  private static readonly MESSAGE_HASH_THRESHOLD = 200;

  /**
   * 生成缓存键
   *
   * 解决问题:
   * 1. 长消息占用内存 - 超过阈值使用哈希
   * 2. 特殊字符(:)导致键冲突 - 转义特殊字符
   */
  private generateKey(message: string, userId: string): string {
    const normalizedMessage = message.toLowerCase().trim();
    // 转义 userId 中的分隔符，防止键冲突
    const safeUserId = userId.replace(/:/g, "\\:");

    // 长消息使用哈希以减少内存占用
    if (normalizedMessage.length > IntentCache.MESSAGE_HASH_THRESHOLD) {
      const hash = fnv1aHash(normalizedMessage);
      // 保留前 50 个字符作为可读性前缀
      const prefix = normalizedMessage.slice(0, 50).replace(/:/g, "\\:");
      return `${safeUserId}:h:${prefix}...${hash}`;
    }

    // 短消息直接使用，但转义特殊字符
    const safeMessage = normalizedMessage.replace(/:/g, "\\:");
    return `${safeUserId}:m:${safeMessage}`;
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

  // ============================================
  // M3: 缓存预热机制
  // ============================================

  /**
   * 缓存预热
   *
   * 批量加载常见查询到缓存中，减少冷启动延迟
   *
   * @param entries 预热条目列表
   * @returns 成功加载的条目数
   */
  warmup(
    entries: Array<{
      message: string;
      userId: string;
      result: ClassifierResult;
      ttl?: number;
    }>,
  ): number {
    let loaded = 0;

    for (const entry of entries) {
      // 检查是否还有空间
      if (this.cache.size >= this.config.maxSize) {
        break;
      }

      this.set(entry.message, entry.userId, entry.result, entry.ttl);
      loaded++;
    }

    return loaded;
  }

  /**
   * 从持久化存储恢复统计信息
   */
  restoreStats(persistence: CacheStatsPersistence): void {
    this.stats.hits = persistence.hits;
    this.stats.misses = persistence.misses;
  }

  /**
   * 导出统计信息用于持久化
   */
  exportStats(): CacheStatsPersistence {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      lastUpdatedAt: Date.now(),
    };
  }

  /**
   * 导出缓存条目用于持久化
   *
   * @param maxEntries 最大导出条目数
   * @returns 可持久化的缓存条目
   */
  exportEntries(maxEntries = 100): Array<{
    message: string;
    userId: string;
    result: ClassifierResult;
    accessCount: number;
    expiresAt: number;
  }> {
    const now = Date.now();
    const entries: Array<{
      key: string;
      entry: CacheEntry<ClassifierResult>;
    }> = [];

    // 收集未过期的条目
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt > now) {
        entries.push({ key, entry });
      }
    }

    // 按访问频率排序，优先导出高频条目
    entries.sort((a, b) => b.entry.accessCount - a.entry.accessCount);

    // 只导出前 N 个
    return entries.slice(0, maxEntries).map(({ key, entry }) => {
      // 解析 key 以提取原始信息（简化处理）
      const parts = key.split(":m:");
      const userId = parts[0]?.replace(/\\:/g, ":") ?? "unknown";
      const message = parts[1]?.replace(/\\:/g, ":") ?? "";

      return {
        message,
        userId,
        result: entry.value,
        accessCount: entry.accessCount,
        expiresAt: entry.expiresAt,
      };
    });
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
