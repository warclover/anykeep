/**
 * IntentCache - 意图分类结果缓存
 *
 * 提供两层缓存机制：
 * - L1: 精确匹配缓存（内存 LRU）
 * - L2: 语义匹配缓存（pgvector，Phase 2 实现）
 *
 * 设计原则：
 * - 不缓存低置信度结果（< 0.75）
 * - 不缓存 chitchat 类型（闲聊无需缓存）
 * - 支持统计和监控
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import { LRUCache } from "lru-cache";
import { logger } from "@/lib/logger";
import type { IntentClassification } from "./types";

// ============================================
// 类型定义
// ============================================

/**
 * 缓存条目
 */
export interface CachedIntentEntry {
  /** 缓存的分类结果 */
  classification: IntentClassification;
  /** 缓存时间戳 */
  cachedAt: number;
  /** 命中次数 */
  hitCount: number;
  /** 原始消息（用于调试） */
  originalMessage?: string;
}

/**
 * 缓存配置
 */
export interface IntentCacheConfig {
  /** 最大缓存条目数 */
  maxSize: number;
  /** 过期时间 (ms)，Infinity 表示永不过期（仅 LRU 淘汰） */
  ttlMs: number;
  /** 访问时是否刷新 TTL */
  updateAgeOnGet: boolean;
  /** 最低缓存置信度阈值 */
  minConfidence: number;
  /** 是否记录原始消息（调试用） */
  storeOriginalMessage: boolean;
}

/**
 * 缓存统计
 */
export interface IntentCacheStats {
  /** 当前缓存大小 */
  size: number;
  /** 最大缓存大小 */
  maxSize: number;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 命中率 (0-1) */
  hitRate: number;
  /** 跳过缓存次数（低置信度等） */
  skipped: number;
}

// ============================================
// 默认配置
// ============================================

export const DEFAULT_INTENT_CACHE_CONFIG: IntentCacheConfig = {
  maxSize: 10000,
  ttlMs: Infinity, // 永不过期，仅 LRU 淘汰
  updateAgeOnGet: true,
  minConfidence: 0.75,
  storeOriginalMessage: false,
};

// ============================================
// IntentCache 类
// ============================================

/**
 * 意图分类结果缓存
 *
 * @example
 * ```typescript
 * const cache = new IntentCache();
 *
 * // 查询缓存
 * const cached = cache.get("搜索 React");
 * if (cached) {
 *   return { ...cached, source: 'cache_l1' };
 * }
 *
 * // 分类后写入缓存
 * const result = await classifier.classify(message);
 * cache.set(message, result);
 * ```
 */
export class IntentCache {
  private cache: LRUCache<string, CachedIntentEntry>;
  private config: IntentCacheConfig;
  private hits = 0;
  private misses = 0;
  private skipped = 0;

  constructor(config?: Partial<IntentCacheConfig>) {
    this.config = { ...DEFAULT_INTENT_CACHE_CONFIG, ...config };

    this.cache = new LRUCache<string, CachedIntentEntry>({
      max: this.config.maxSize,
      ttl: this.config.ttlMs === Infinity ? undefined : this.config.ttlMs,
      updateAgeOnGet: this.config.updateAgeOnGet,
    });

    logger.debug(
      {
        maxSize: this.config.maxSize,
        ttlMs: this.config.ttlMs,
        minConfidence: this.config.minConfidence,
      },
      "IntentCache: Initialized",
    );
  }

  /**
   * 获取缓存的分类结果
   *
   * @param message - 用户消息
   * @returns 缓存的分类结果，未命中返回 null
   */
  get(message: string): IntentClassification | null {
    const key = this.normalizeKey(message);
    const entry = this.cache.get(key);

    if (entry) {
      this.hits++;
      entry.hitCount++;

      logger.debug(
        {
          messagePreview: message.slice(0, 30),
          intentType: entry.classification.type,
          hitCount: entry.hitCount,
        },
        "IntentCache: L1 cache hit",
      );

      // 返回带 cache_l1 source 的分类结果
      return {
        ...entry.classification,
        source: "cache_l1" as const,
      };
    }

    this.misses++;
    return null;
  }

  /**
   * 写入缓存
   *
   * @param message - 用户消息
   * @param classification - 分类结果
   * @returns 是否成功写入（低置信度等情况会跳过）
   */
  set(message: string, classification: IntentClassification): boolean {
    // 不缓存低置信度结果
    if (classification.confidence < this.config.minConfidence) {
      this.skipped++;
      logger.debug(
        {
          messagePreview: message.slice(0, 30),
          confidence: classification.confidence,
          threshold: this.config.minConfidence,
        },
        "IntentCache: Skipped (low confidence)",
      );
      return false;
    }

    // 不缓存 chitchat
    if (classification.type === "chitchat") {
      this.skipped++;
      logger.debug(
        { messagePreview: message.slice(0, 30) },
        "IntentCache: Skipped (chitchat)",
      );
      return false;
    }

    const key = this.normalizeKey(message);
    const entry: CachedIntentEntry = {
      classification,
      cachedAt: Date.now(),
      hitCount: 0,
      originalMessage: this.config.storeOriginalMessage ? message : undefined,
    };

    this.cache.set(key, entry);

    logger.debug(
      {
        messagePreview: message.slice(0, 30),
        intentType: classification.type,
        confidence: classification.confidence,
      },
      "IntentCache: Cached",
    );

    return true;
  }

  /**
   * 检查是否存在缓存
   */
  has(message: string): boolean {
    const key = this.normalizeKey(message);
    return this.cache.has(key);
  }

  /**
   * 删除缓存条目
   */
  delete(message: string): boolean {
    const key = this.normalizeKey(message);
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.skipped = 0;
    logger.info("IntentCache: Cleared");
  }

  /**
   * 获取缓存统计
   */
  getStats(): IntentCacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      skipped: this.skipped,
    };
  }

  /**
   * 重置统计（不清空缓存）
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.skipped = 0;
  }

  /**
   * 获取热门缓存条目（按命中次数排序）
   */
  getTopEntries(limit: number = 10): Array<{
    key: string;
    intentType: string;
    hitCount: number;
    cachedAt: number;
  }> {
    const entries: Array<{
      key: string;
      intentType: string;
      hitCount: number;
      cachedAt: number;
    }> = [];

    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key,
        intentType: `${entry.classification.type}:${entry.classification.subType || ""}`,
        hitCount: entry.hitCount,
        cachedAt: entry.cachedAt,
      });
    }

    return entries.sort((a, b) => b.hitCount - a.hitCount).slice(0, limit);
  }

  /**
   * 规范化缓存键
   * - 转小写
   * - 去除首尾空格
   * - 统一空白字符
   */
  private normalizeKey(message: string): string {
    return message.toLowerCase().trim().replace(/\s+/g, " ");
  }
}

// ============================================
// 单例管理
// ============================================

let intentCacheInstance: IntentCache | null = null;

/**
 * 获取 IntentCache 单例
 */
export function getIntentCache(
  config?: Partial<IntentCacheConfig>,
): IntentCache {
  if (!intentCacheInstance) {
    intentCacheInstance = new IntentCache(config);
    logger.debug("IntentCache: Singleton created");
  }
  return intentCacheInstance;
}

/**
 * 重置 IntentCache 单例
 * @internal 仅用于测试
 */
export function resetIntentCache(): void {
  if (intentCacheInstance) {
    intentCacheInstance.clear();
    intentCacheInstance = null;
    logger.debug("IntentCache: Singleton reset");
  }
}

/**
 * 检查单例是否已初始化
 */
export function isIntentCacheInitialized(): boolean {
  return intentCacheInstance !== null;
}
