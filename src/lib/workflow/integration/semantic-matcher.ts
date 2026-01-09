/**
 * 工作流语义匹配器
 *
 * 使用向量相似度进行语义级别的意图匹配
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import { generateEmbedding, generateEmbeddingsBatch } from "@/lib/embedding";
import { logger } from "@/lib/logger";

// ============================================================
// 类型定义
// ============================================================

/**
 * 语义匹配配置
 */
export interface SemanticMatchConfig {
  /** 参考文本列表 */
  referenceTexts: string[];
  /** 相似度阈值 (0-1)，默认 0.75 */
  threshold?: number;
  /** 预计算的向量（可选，用于缓存优化） */
  precomputedEmbeddings?: number[][];
}

/**
 * 语义匹配结果
 */
export interface SemanticMatchResult {
  /** 是否匹配 */
  matched: boolean;
  /** 置信度/相似度分数 */
  confidence: number;
  /** 最佳匹配的参考文本索引 */
  bestMatchIndex?: number;
  /** 最佳匹配的参考文本 */
  bestMatchText?: string;
}

/**
 * 缓存条目
 */
interface EmbeddingCacheEntry {
  embedding: number[];
  expiresAt: number;
}

// ============================================================
// 语义匹配器实现
// ============================================================

/**
 * 语义匹配器
 *
 * 使用向量相似度进行语义级别的意图匹配
 */
export class SemanticMatcher {
  /** 用户消息向量缓存 */
  private messageCache: Map<string, EmbeddingCacheEntry> = new Map();
  /** 参考文本向量缓存 */
  private referenceCache: Map<string, number[]> = new Map();
  /** 缓存 TTL（5 分钟） */
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  /** 默认相似度阈值 */
  private readonly DEFAULT_THRESHOLD = 0.75;

  /**
   * 执行语义匹配
   *
   * @param userMessage - 用户消息
   * @param config - 语义匹配配置
   * @returns 匹配结果
   */
  async match(
    userMessage: string,
    config: SemanticMatchConfig,
  ): Promise<SemanticMatchResult> {
    const startTime = performance.now();
    const threshold = config.threshold ?? this.DEFAULT_THRESHOLD;

    try {
      // 1. 获取用户消息向量
      const messageEmbedding = await this.getMessageEmbedding(userMessage);

      // 2. 获取参考文本向量（优先使用预计算）
      const referenceEmbeddings =
        config.precomputedEmbeddings ??
        (await this.getReferenceEmbeddings(config.referenceTexts));

      // 3. 计算最高相似度
      let maxSimilarity = 0;
      let bestMatchIndex = -1;

      for (let i = 0; i < referenceEmbeddings.length; i++) {
        const similarity = this.cosineSimilarity(
          messageEmbedding,
          referenceEmbeddings[i],
        );

        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestMatchIndex = i;
        }
      }

      const matched = maxSimilarity >= threshold;
      const durationMs = Math.round(performance.now() - startTime);

      logger.debug(
        {
          userMessage: userMessage.substring(0, 50),
          maxSimilarity: maxSimilarity.toFixed(4),
          threshold,
          matched,
          durationMs,
        },
        "SemanticMatcher: Match completed",
      );

      return {
        matched,
        confidence: maxSimilarity,
        bestMatchIndex: matched ? bestMatchIndex : undefined,
        bestMatchText: matched
          ? config.referenceTexts[bestMatchIndex]
          : undefined,
      };
    } catch (error) {
      logger.error(
        { error, userMessage: userMessage.substring(0, 50) },
        "SemanticMatcher: Match failed",
      );

      return {
        matched: false,
        confidence: 0,
      };
    }
  }

  /**
   * 批量预计算参考文本向量
   *
   * 用于工作流定义加载时预计算向量，避免运行时延迟
   *
   * @param referenceTexts - 参考文本列表
   * @returns 向量数组
   */
  async precomputeEmbeddings(referenceTexts: string[]): Promise<number[][]> {
    if (referenceTexts.length === 0) {
      return [];
    }

    try {
      const embeddings = await generateEmbeddingsBatch(referenceTexts);

      // 缓存结果
      for (let i = 0; i < referenceTexts.length; i++) {
        const cacheKey = this.generateCacheKey(referenceTexts[i]);
        this.referenceCache.set(cacheKey, embeddings[i]);
      }

      logger.info(
        { count: referenceTexts.length },
        "SemanticMatcher: Precomputed embeddings",
      );

      return embeddings;
    } catch (error) {
      logger.error(
        { error, count: referenceTexts.length },
        "SemanticMatcher: Failed to precompute embeddings",
      );
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.messageCache.clear();
    this.referenceCache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { messageCount: number; referenceCount: number } {
    return {
      messageCount: this.messageCache.size,
      referenceCount: this.referenceCache.size,
    };
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 获取用户消息向量（带缓存）
   */
  private async getMessageEmbedding(message: string): Promise<number[]> {
    const cacheKey = this.generateCacheKey(message);
    const now = Date.now();

    // 检查缓存
    const cached = this.messageCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.embedding;
    }

    // 生成向量
    const embedding = await generateEmbedding(message);

    // 存入缓存
    this.messageCache.set(cacheKey, {
      embedding,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    // 清理过期条目（惰性清理）
    this.cleanExpiredMessageCache();

    return embedding;
  }

  /**
   * 获取参考文本向量（带缓存）
   */
  private async getReferenceEmbeddings(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    // 检查缓存
    for (let i = 0; i < texts.length; i++) {
      const cacheKey = this.generateCacheKey(texts[i]);
      const cached = this.referenceCache.get(cacheKey);

      if (cached) {
        results[i] = cached;
      } else {
        uncachedTexts.push(texts[i]);
        uncachedIndices.push(i);
      }
    }

    // 批量生成未缓存的向量
    if (uncachedTexts.length > 0) {
      const newEmbeddings = await generateEmbeddingsBatch(uncachedTexts);

      for (let i = 0; i < uncachedTexts.length; i++) {
        const originalIndex = uncachedIndices[i];
        const cacheKey = this.generateCacheKey(uncachedTexts[i]);

        results[originalIndex] = newEmbeddings[i];
        this.referenceCache.set(cacheKey, newEmbeddings[i]);
      }
    }

    return results;
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      logger.warn(
        { aLength: a.length, bLength: b.length },
        "SemanticMatcher: Embedding dimension mismatch",
      );
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);

    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(text: string): string {
    // 使用归一化的文本作为缓存键
    return text.toLowerCase().trim();
  }

  /**
   * 清理过期的消息缓存
   */
  private cleanExpiredMessageCache(): void {
    const now = Date.now();
    const maxSize = 1000; // 最大缓存条目数

    // 如果超过最大数量，清理过期条目
    if (this.messageCache.size > maxSize) {
      for (const [key, entry] of this.messageCache) {
        if (entry.expiresAt < now) {
          this.messageCache.delete(key);
        }
      }
    }
  }
}

// ============================================================
// 单例导出
// ============================================================

let semanticMatcherInstance: SemanticMatcher | null = null;

/**
 * 获取语义匹配器单例
 */
export function getSemanticMatcher(): SemanticMatcher {
  if (!semanticMatcherInstance) {
    semanticMatcherInstance = new SemanticMatcher();
  }
  return semanticMatcherInstance;
}

/**
 * 重置语义匹配器（用于测试）
 */
export function resetSemanticMatcher(): void {
  if (semanticMatcherInstance) {
    semanticMatcherInstance.clearCache();
  }
  semanticMatcherInstance = null;
}
