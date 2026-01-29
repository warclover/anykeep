/**
 * Similarity Engine Service
 *
 * 语义相似度关联发现服务
 * 基于向量相似度查找相关书签
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DiscoveredLink } from "../types/link.types";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface SimilarityConfig {
  /** 最小相似度阈值 (0-1) */
  minSimilarity: number;

  /** 最大返回数量 */
  limit: number;
}

export interface SimilarBookmark {
  bookmarkId: number;
  title: string;
  similarity: number;
}

// ============================================================================
// Service Interface
// ============================================================================

export interface ISimilarityEngineService {
  /**
   * 查找语义相似的书签
   */
  findSimilar(
    userId: string,
    bookmarkId: number,
    config?: Partial<SimilarityConfig>,
  ): Promise<DiscoveredLink[]>;

  /**
   * 计算两个书签的相似度
   */
  calculateSimilarity(
    bookmarkId1: number,
    bookmarkId2: number,
  ): Promise<number>;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * 语义相似度引擎服务
 */
export class SimilarityEngineService implements ISimilarityEngineService {
  private defaultConfig: SimilarityConfig = {
    minSimilarity: 0.7,
    limit: 10,
  };

  constructor(private supabase: SupabaseClient = createClient()) {}

  /**
   * 查找语义相似的书签
   */
  async findSimilar(
    userId: string,
    bookmarkId: number,
    config?: Partial<SimilarityConfig>,
  ): Promise<DiscoveredLink[]> {
    const mergedConfig = { ...this.defaultConfig, ...config };

    try {
      // 调用数据库函数查找相似书签
      const { data, error } = await this.supabase.rpc(
        "find_similar_bookmarks_for_linking",
        {
          p_user_id: userId,
          p_bookmark_id: bookmarkId,
          p_min_similarity: mergedConfig.minSimilarity,
          p_limit: mergedConfig.limit,
        },
      );

      if (error) {
        logger.error({ error }, "Failed to find similar bookmarks");
        return [];
      }

      // 映射结果
      return (data || []).map(
        (row: { bookmark_id: number; title: string; similarity: number }) => ({
          targetBookmarkId: row.bookmark_id,
          linkType: "semantic" as const,
          strength: row.similarity,
          evidence: {
            type: "semantic" as const,
            score: row.similarity,
            details: {
              similarityScore: row.similarity,
            },
          },
          algorithm: "vector-cosine-similarity",
        }),
      );
    } catch (error) {
      logger.error({ error }, "Error in findSimilar");
      return [];
    }
  }

  /**
   * 计算两个书签的相似度
   */
  async calculateSimilarity(
    bookmarkId1: number,
    bookmarkId2: number,
  ): Promise<number> {
    try {
      // 获取两个书签的 embedding
      const { data: bookmarks, error } = await this.supabase
        .from("bookmarks")
        .select("id, embedding")
        .in("id", [bookmarkId1, bookmarkId2]);

      if (error || !bookmarks || bookmarks.length !== 2) {
        return 0;
      }

      const b1 = bookmarks.find((b) => b.id === bookmarkId1);
      const b2 = bookmarks.find((b) => b.id === bookmarkId2);

      if (!b1?.embedding || !b2?.embedding) {
        return 0;
      }

      // 计算余弦相似度
      return this.cosineSimilarity(b1.embedding, b2.embedding);
    } catch (error) {
      logger.error({ error }, "Error calculating similarity");
      return 0;
    }
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let similarityEngineInstance: SimilarityEngineService | null = null;

/**
 * 获取 SimilarityEngineService 单例
 */
export function getSimilarityEngineService(): SimilarityEngineService {
  if (!similarityEngineInstance) {
    similarityEngineInstance = new SimilarityEngineService();
  }
  return similarityEngineInstance;
}

/**
 * 重置单例（用于测试）
 */
export function resetSimilarityEngineService(): void {
  similarityEngineInstance = null;
}
