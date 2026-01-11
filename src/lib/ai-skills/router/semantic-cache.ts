/**
 * SemanticCache - 语义意图缓存服务
 *
 * 提供基于向量相似度的意图分类缓存能力：
 * - L2 缓存层：基于 pgvector 的语义匹配
 * - 支持预热和持久化
 * - 支持统计和监控
 *
 * 设计原则：
 * - 不缓存低置信度结果（< 0.75）
 * - 不缓存 chitchat 类型
 * - 异步写入，不阻塞主流程
 * - 命中统计异步更新
 *
 * @version 1.0.0
 * @since 2026-01-12
 */

import { createServiceClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/embedding";
import { logger } from "@/lib/logger";
import type { IntentClassification } from "./types";
import type { Json } from "@/types/supabase";

// ============================================
// 类型定义
// ============================================

/**
 * 语义缓存配置
 */
export interface SemanticCacheConfig {
  /** 相似度阈值（0-1），高于此值才认为匹配 */
  similarityThreshold: number;
  /** 缓存过期天数 */
  ttlDays: number;
  /** 查询返回的最大结果数 */
  maxResults: number;
  /** 最低缓存置信度阈值 */
  minConfidence: number;
  /** 是否存储原始消息 */
  storeOriginalMessage: boolean;
  /** 是否启用预热 */
  enableWarmup: boolean;
  /** 预热条目数量 */
  warmupCount: number;
}

/**
 * 语义缓存统计
 */
export interface SemanticCacheStats {
  /** 查询次数 */
  queries: number;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 写入次数 */
  writes: number;
  /** 写入失败次数 */
  writeErrors: number;
  /** 平均相似度（命中时） */
  avgSimilarity: number;
  /** 预热条目数 */
  warmedUpCount: number;
}

/**
 * 数据库返回的缓存条目
 */
interface DbCacheEntry {
  id: number;
  input_hash: string;
  normalized_input: string;
  original_message: string | null;
  intent_type: string;
  intent_subtype: string | null;
  confidence: number;
  method: string;
  slots: Record<string, unknown> | null;
  similarity: number;
}

// ============================================
// 默认配置
// ============================================

export const DEFAULT_SEMANTIC_CACHE_CONFIG: SemanticCacheConfig = {
  similarityThreshold: 0.95,
  ttlDays: 7,
  maxResults: 1,
  minConfidence: 0.75,
  storeOriginalMessage: true,
  enableWarmup: true,
  warmupCount: 100,
};

// ============================================
// SemanticCache 类
// ============================================

/**
 * 语义意图缓存服务
 *
 * @example
 * ```typescript
 * const cache = new SemanticCache();
 *
 * // 查询缓存
 * const cached = await cache.get("搜索 React 教程");
 * if (cached) {
 *   return { ...cached, source: 'cache_l2' };
 * }
 *
 * // 分类后写入缓存
 * const result = await classifier.classify(message);
 * cache.set(message, result); // 异步，不阻塞
 * ```
 */
export class SemanticCache {
  private config: SemanticCacheConfig;
  private stats: SemanticCacheStats;
  private isWarmedUp = false;

  constructor(config?: Partial<SemanticCacheConfig>) {
    this.config = { ...DEFAULT_SEMANTIC_CACHE_CONFIG, ...config };
    this.stats = {
      queries: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      writes: 0,
      writeErrors: 0,
      avgSimilarity: 0,
      warmedUpCount: 0,
    };

    logger.debug(
      {
        similarityThreshold: this.config.similarityThreshold,
        ttlDays: this.config.ttlDays,
        minConfidence: this.config.minConfidence,
      },
      "SemanticCache: Initialized",
    );
  }

  /**
   * 查询语义缓存
   *
   * @param message - 用户消息
   * @returns 缓存的分类结果，未命中返回 null
   */
  async get(message: string): Promise<IntentClassification | null> {
    this.stats.queries++;

    try {
      // 计算消息向量
      const embedding = await generateEmbedding(message);
      // pgvector 需要字符串格式 "[1,2,3,...]"
      const embeddingStr = `[${embedding.join(",")}]`;

      // 向量相似度搜索
      const supabase = await createServiceClient();
      const { data, error } = await supabase.rpc(
        "match_intent_cache_semantic",
        {
          query_embedding: embeddingStr,
          similarity_threshold: this.config.similarityThreshold,
          match_count: this.config.maxResults,
        },
      );

      if (error) {
        logger.error(
          { error: error.message, code: error.code },
          "SemanticCache: Query failed",
        );
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      const results = data as DbCacheEntry[] | null;
      if (!results || results.length === 0) {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      const cached = results[0];

      // 更新统计
      this.stats.hits++;
      this.updateAvgSimilarity(cached.similarity);
      this.updateHitRate();

      // 异步更新命中计数
      this.incrementHitCount(cached.id).catch((err) => {
        logger.warn(
          { error: err, cacheId: cached.id },
          "SemanticCache: Failed to update hit count",
        );
      });

      logger.debug(
        {
          messagePreview: message.slice(0, 30),
          intentType: cached.intent_type,
          similarity: cached.similarity.toFixed(4),
        },
        "SemanticCache: L2 cache hit",
      );

      // 构建分类结果
      return {
        type: cached.intent_type as IntentClassification["type"],
        subType: cached.intent_subtype || undefined,
        confidence: cached.confidence,
        entities: [],
        slots: cached.slots as unknown as IntentClassification["slots"],
        source: "cache_l2" as const,
        requiresMultiStep: false,
        hasDeliverableExpectation: false,
      };
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "SemanticCache: Query error",
      );
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * 写入语义缓存
   *
   * @param message - 用户消息
   * @param classification - 分类结果
   * @param options - 可选配置
   * @returns 是否成功（异步操作，返回 Promise）
   */
  async set(
    message: string,
    classification: IntentClassification,
    options?: { ttlDays?: number },
  ): Promise<boolean> {
    // 不缓存低置信度结果
    if (classification.confidence < this.config.minConfidence) {
      logger.debug(
        {
          messagePreview: message.slice(0, 30),
          confidence: classification.confidence,
          threshold: this.config.minConfidence,
        },
        "SemanticCache: Skipped (low confidence)",
      );
      return false;
    }

    // 不缓存 chitchat
    if (classification.type === "chitchat") {
      logger.debug(
        { messagePreview: message.slice(0, 30) },
        "SemanticCache: Skipped (chitchat)",
      );
      return false;
    }

    try {
      this.stats.writes++;

      // 计算消息向量
      const embedding = await generateEmbedding(message);
      // pgvector 需要字符串格式 "[1,2,3,...]"
      const embeddingStr = `[${embedding.join(",")}]`;
      const inputHash = this.hashMessage(message);
      const normalizedInput = this.normalizeMessage(message);
      const ttlDays = options?.ttlDays ?? this.config.ttlDays;

      // 写入数据库
      const supabase = await createServiceClient();
      const { error } = await supabase.rpc("upsert_intent_cache_semantic", {
        p_input_hash: inputHash,
        p_normalized_input: normalizedInput,
        p_original_message: this.config.storeOriginalMessage ? message : null,
        p_intent_type: classification.type,
        p_intent_subtype: classification.subType || null,
        p_confidence: classification.confidence,
        p_method: classification.source || "rule",
        p_slots: (classification.slots || {}) as Json,
        p_message_embedding: embeddingStr,
        p_ttl_days: ttlDays,
      });

      if (error) {
        this.stats.writeErrors++;
        logger.error(
          { error: error.message, code: error.code },
          "SemanticCache: Write failed",
        );
        return false;
      }

      logger.debug(
        {
          messagePreview: message.slice(0, 30),
          intentType: classification.type,
          confidence: classification.confidence,
        },
        "SemanticCache: Cached",
      );

      return true;
    } catch (err) {
      this.stats.writeErrors++;
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "SemanticCache: Write error",
      );
      return false;
    }
  }

  /**
   * 预热缓存（加载热门条目）
   *
   * @param count - 预热条目数量
   * @returns 预热的条目数
   */
  async warmup(count?: number): Promise<number> {
    if (this.isWarmedUp) {
      logger.debug("SemanticCache: Already warmed up");
      return this.stats.warmedUpCount;
    }

    const topK = count ?? this.config.warmupCount;

    try {
      const supabase = await createServiceClient();
      const { data, error } = await supabase.rpc(
        "get_top_intent_cache_entries",
        {
          top_k: topK,
        },
      );

      if (error) {
        logger.error({ error: error.message }, "SemanticCache: Warmup failed");
        return 0;
      }

      this.stats.warmedUpCount = data?.length ?? 0;
      this.isWarmedUp = true;

      logger.info(
        { count: this.stats.warmedUpCount },
        "SemanticCache: Warmup completed",
      );

      return this.stats.warmedUpCount;
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "SemanticCache: Warmup error",
      );
      return 0;
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): SemanticCacheStats {
    return { ...this.stats };
  }

  /**
   * 获取数据库级别的缓存统计
   */
  async getDbStats(): Promise<{
    totalCount: number;
    withEmbeddingCount: number;
    expiredCount: number;
    totalHits: number;
    avgConfidence: number;
    cacheTypes: Record<string, number>;
  } | null> {
    try {
      const supabase = await createServiceClient();
      const { data, error } = await supabase.rpc("get_intent_cache_stats");

      if (error) {
        logger.error(
          { error: error.message },
          "SemanticCache: Get DB stats failed",
        );
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const stats = data[0];
      return {
        totalCount: stats.total_count,
        withEmbeddingCount: stats.with_embedding_count,
        expiredCount: stats.expired_count,
        totalHits: stats.total_hits,
        avgConfidence: stats.avg_confidence,
        cacheTypes: (stats.cache_types || {}) as Record<string, number>,
      };
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "SemanticCache: Get DB stats error",
      );
      return null;
    }
  }

  /**
   * 重置统计（不清空数据库缓存）
   */
  resetStats(): void {
    this.stats = {
      queries: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      writes: 0,
      writeErrors: 0,
      avgSimilarity: 0,
      warmedUpCount: this.stats.warmedUpCount,
    };
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 消息哈希（djb2 算法）
   */
  private hashMessage(message: string): string {
    const normalized = this.normalizeMessage(message);
    let hash = 5381;
    for (let i = 0; i < normalized.length; i++) {
      hash = (hash << 5) + hash + normalized.charCodeAt(i);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  /**
   * 消息规范化
   */
  private normalizeMessage(message: string): string {
    return message.toLowerCase().trim().replace(/\s+/g, " ");
  }

  /**
   * 更新命中计数
   */
  private async incrementHitCount(cacheId: number): Promise<void> {
    const supabase = await createServiceClient();
    await supabase.rpc("increment_intent_cache_hit", {
      p_cache_id: cacheId,
    });
  }

  /**
   * 更新平均相似度
   */
  private updateAvgSimilarity(newSimilarity: number): void {
    if (this.stats.hits === 1) {
      this.stats.avgSimilarity = newSimilarity;
    } else {
      // 增量平均
      this.stats.avgSimilarity =
        this.stats.avgSimilarity +
        (newSimilarity - this.stats.avgSimilarity) / this.stats.hits;
    }
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

// ============================================
// 单例管理
// ============================================

let semanticCacheInstance: SemanticCache | null = null;

/**
 * 获取 SemanticCache 单例
 */
export function getSemanticCache(
  config?: Partial<SemanticCacheConfig>,
): SemanticCache {
  if (!semanticCacheInstance) {
    semanticCacheInstance = new SemanticCache(config);
    logger.debug("SemanticCache: Singleton created");
  }
  return semanticCacheInstance;
}

/**
 * 重置 SemanticCache 单例
 * @internal 仅用于测试
 */
export function resetSemanticCache(): void {
  semanticCacheInstance = null;
  logger.debug("SemanticCache: Singleton reset");
}

/**
 * 检查单例是否已初始化
 */
export function isSemanticCacheInitialized(): boolean {
  return semanticCacheInstance !== null;
}
