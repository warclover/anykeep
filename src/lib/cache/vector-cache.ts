/**
 * 向量缓存模块
 *
 * 缓存常用查询的向量表示，减少重复 API 调用，
 * 显著提升搜索速度。
 *
 * @module cache/vector-cache
 * @version 1.0.0
 * @since 2025-12-28
 */

import { LRUCache } from "lru-cache";
import { createHash } from "crypto";
import { logger } from "@/lib/logger";

/**
 * 向量缓存配置
 */
export interface VectorCacheConfig {
  /** 最大缓存条目数 */
  maxSize: number;
  /** 过期时间 (ms) */
  ttlMs: number;
  /** 访问时是否刷新 TTL */
  updateAgeOnGet: boolean;
}

/**
 * 缓存统计
 */
export interface VectorCacheStats {
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
}

/**
 * 默认配置
 */
export const DEFAULT_VECTOR_CACHE_CONFIG: VectorCacheConfig = {
  maxSize: 10000, // 最多缓存 10000 个查询
  ttlMs: 1000 * 60 * 60 * 24, // 24 小时
  updateAgeOnGet: true, // 访问时刷新 TTL
};

/**
 * 向量缓存
 *
 * 使用 LRU 策略缓存向量，支持：
 * - 自动过期
 * - 最大容量限制
 * - 命中率统计
 */
export class VectorCache {
  private cache: LRUCache<string, number[]>;
  private config: VectorCacheConfig;
  private hits = 0;
  private misses = 0;

  constructor(config?: Partial<VectorCacheConfig>) {
    this.config = { ...DEFAULT_VECTOR_CACHE_CONFIG, ...config };

    this.cache = new LRUCache<string, number[]>({
      max: this.config.maxSize,
      ttl: this.config.ttlMs,
      updateAgeOnGet: this.config.updateAgeOnGet,
      // 向量数组的大小估算（假设 1536 维，每个 float 8 字节）
      sizeCalculation: (value) => value.length * 8,
      // 最大内存限制：约 120MB (10000 * 1536 * 8)
      maxSize: 120 * 1024 * 1024,
    });
  }

  /**
   * 获取缓存的向量，如果不存在则生成并缓存
   *
   * @param text - 输入文本
   * @param generator - 向量生成函数
   * @returns 向量数组
   */
  async getOrGenerate(
    text: string,
    generator: (text: string) => Promise<number[]>,
  ): Promise<number[]> {
    const cacheKey = this.hashText(text);

    // 尝试从缓存获取
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.hits++;
      logger.debug(
        { textPreview: text.slice(0, 50), cached: true },
        "VectorCache: Cache hit",
      );
      return cached;
    }

    // 缓存未命中，生成向量
    this.misses++;
    const startTime = Date.now();
    const vector = await generator(text);
    const latencyMs = Date.now() - startTime;

    // 存入缓存
    this.cache.set(cacheKey, vector);

    logger.debug(
      {
        textPreview: text.slice(0, 50),
        cached: false,
        latencyMs,
        vectorDim: vector.length,
      },
      "VectorCache: Generated and cached",
    );

    return vector;
  }

  /**
   * 直接获取缓存（不生成）
   */
  get(text: string): number[] | undefined {
    const cacheKey = this.hashText(text);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.hits++;
    } else {
      this.misses++;
    }
    return cached;
  }

  /**
   * 直接设置缓存
   */
  set(text: string, vector: number[]): void {
    const cacheKey = this.hashText(text);
    this.cache.set(cacheKey, vector);
  }

  /**
   * 检查是否存在缓存
   */
  has(text: string): boolean {
    const cacheKey = this.hashText(text);
    return this.cache.has(cacheKey);
  }

  /**
   * 删除缓存
   */
  delete(text: string): boolean {
    const cacheKey = this.hashText(text);
    return this.cache.delete(cacheKey);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    logger.info("VectorCache: Cache cleared");
  }

  /**
   * 获取缓存统计
   */
  getStats(): VectorCacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * 重置统计（不清空缓存）
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 计算文本哈希作为缓存键
   */
  private hashText(text: string): string {
    // 规范化文本：转小写，去除首尾空格
    const normalized = text.toLowerCase().trim();
    return createHash("sha256").update(normalized).digest("hex");
  }

  /**
   * 预热缓存（批量加载）
   */
  async warmup(
    texts: string[],
    generator: (text: string) => Promise<number[]>,
  ): Promise<void> {
    logger.info({ count: texts.length }, "VectorCache: Starting warmup");

    let cached = 0;
    let generated = 0;

    for (const text of texts) {
      if (this.has(text)) {
        cached++;
        continue;
      }

      try {
        const vector = await generator(text);
        this.set(text, vector);
        generated++;
      } catch (error) {
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            text: text.slice(0, 50),
          },
          "VectorCache: Warmup failed for text",
        );
      }
    }

    logger.info(
      { cached, generated, total: texts.length },
      "VectorCache: Warmup completed",
    );
  }
}

// 单例实例
let vectorCacheInstance: VectorCache | null = null;

/**
 * 获取 VectorCache 单例
 */
export function getVectorCache(): VectorCache {
  if (!vectorCacheInstance) {
    vectorCacheInstance = new VectorCache();
  }
  return vectorCacheInstance;
}
