/**
 * 精确匹配缓存 - 极简版
 *
 * 设计原则：
 * 1. 不做语义相似度，仅缓存完全相同的请求
 * 2. 内存存储，TTL 过期
 * 3. 简单 LRU 淘汰策略
 *
 * @version 1.0.0
 * @since 2026-01-13
 */

import { logger } from "@/lib/logger";

const log = logger.child({ namespace: "exact-match-cache" });

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  /** 缓存值 */
  value: T;
  /** 过期时间戳 */
  expireAt: number;
  /** 创建时间戳 */
  createdAt: number;
  /** 命中次数 */
  hitCount: number;
}

/**
 * 缓存配置
 */
export interface ExactMatchCacheConfig {
  /** TTL 毫秒数（默认 5 分钟） */
  ttlMs: number;
  /** 最大缓存条目数（默认 1000） */
  maxSize: number;
  /** 是否启用（默认 true） */
  enabled: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ExactMatchCacheConfig = {
  ttlMs: 5 * 60 * 1000, // 5 分钟
  maxSize: 1000,
  enabled: true,
};

/**
 * 缓存统计
 */
export interface CacheStats {
  /** 缓存条目数 */
  size: number;
  /** 命中次数 */
  hitCount: number;
  /** 未命中次数 */
  missCount: number;
  /** 命中率 */
  hitRate: number;
  /** 过期淘汰数 */
  expiredCount: number;
  /** LRU 淘汰数 */
  evictedCount: number;
}

/**
 * 精确匹配缓存类
 *
 * 用于缓存完全相同的请求结果，减少重复 LLM 调用
 */
class ExactMatchCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: ExactMatchCacheConfig;

  // 统计数据
  private hitCount = 0;
  private missCount = 0;
  private expiredCount = 0;
  private evictedCount = 0;

  constructor(config: Partial<ExactMatchCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info(
      {
        ttlMs: this.config.ttlMs,
        maxSize: this.config.maxSize,
        enabled: this.config.enabled,
      },
      "ExactMatchCache initialized",
    );
  }

  /**
   * 标准化输入（用于生成缓存 key）
   */
  private normalize(input: string): string {
    return input.trim().toLowerCase();
  }

  /**
   * 生成缓存 key
   *
   * @param input - 用户输入
   * @param userId - 用户 ID（可选，用于用户隔离）
   */
  private generateKey(input: string, userId?: string): string {
    const normalizedInput = this.normalize(input);
    return userId ? `${userId}:${normalizedInput}` : normalizedInput;
  }

  /**
   * 获取缓存
   *
   * @param input - 用户输入
   * @param userId - 用户 ID（可选）
   * @returns 缓存值，未命中返回 null
   */
  get(input: string, userId?: string): T | null {
    if (!this.config.enabled) {
      return null;
    }

    const key = this.generateKey(input, userId);
    const entry = this.cache.get(key);

    // 未命中
    if (!entry) {
      this.missCount++;
      return null;
    }

    // 已过期
    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      this.expiredCount++;
      this.missCount++;
      log.debug({ key: key.substring(0, 30) }, "Cache entry expired");
      return null;
    }

    // 命中
    entry.hitCount++;
    this.hitCount++;
    log.debug(
      {
        key: key.substring(0, 30),
        hitCount: entry.hitCount,
      },
      "Cache hit",
    );
    return entry.value;
  }

  /**
   * 设置缓存
   *
   * @param input - 用户输入
   * @param value - 缓存值
   * @param userId - 用户 ID（可选）
   * @param ttlMs - 自定义 TTL（可选）
   */
  set(input: string, value: T, userId?: string, ttlMs?: number): void {
    if (!this.config.enabled) {
      return;
    }

    const key = this.generateKey(input, userId);
    const now = Date.now();
    const effectiveTtl = ttlMs ?? this.config.ttlMs;

    // 检查是否需要 LRU 淘汰
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expireAt: now + effectiveTtl,
      createdAt: now,
      hitCount: 0,
    });

    log.debug(
      {
        key: key.substring(0, 30),
        ttlMs: effectiveTtl,
        cacheSize: this.cache.size,
      },
      "Cache set",
    );
  }

  /**
   * 淘汰最旧的条目（简单 LRU）
   */
  private evictOldest(): void {
    // Map 保持插入顺序，第一个就是最旧的
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      this.evictedCount++;
      log.debug(
        { key: firstKey.substring(0, 30) },
        "Cache entry evicted (LRU)",
      );
    }
  }

  /**
   * 检查是否存在缓存
   */
  has(input: string, userId?: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const key = this.generateKey(input, userId);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // 检查是否过期
    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      this.expiredCount++;
      return false;
    }

    return true;
  }

  /**
   * 删除缓存
   */
  delete(input: string, userId?: string): boolean {
    const key = this.generateKey(input, userId);
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    log.info({ clearedCount: size }, "Cache cleared");
  }

  /**
   * 清理过期条目
   */
  cleanup(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expireAt) {
        this.cache.delete(key);
        this.expiredCount++;
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      log.info({ cleanedCount }, "Cache cleanup completed");
    }

    return cleanedCount;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
      expiredCount: this.expiredCount,
      evictedCount: this.evictedCount,
    };
  }

  /**
   * 重置统计数据
   */
  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
    this.expiredCount = 0;
    this.evictedCount = 0;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ExactMatchCacheConfig>): void {
    this.config = { ...this.config, ...config };
    log.info({ config: this.config }, "Cache config updated");
  }

  /**
   * 获取当前配置
   */
  getConfig(): ExactMatchCacheConfig {
    return { ...this.config };
  }
}

// ============================================
// 导出单例实例
// ============================================

/**
 * 查询缓存实例
 *
 * 用于缓存 AI 查询结果
 */
export const queryCache = new ExactMatchCache<{
  response: string;
  intentType?: string;
  toolCalls?: unknown[];
}>({
  ttlMs: 5 * 60 * 1000, // 5 分钟
  maxSize: 500,
});

/**
 * 意图分类缓存实例
 *
 * 用于缓存意图分类结果
 */
export const intentCache = new ExactMatchCache<{
  intentType: string;
  intentSubType?: string;
  confidence: number;
  slots?: Record<string, unknown>;
}>({
  ttlMs: 10 * 60 * 1000, // 10 分钟（意图分类更稳定）
  maxSize: 1000,
});

// 导出类以便测试
export { ExactMatchCache };
