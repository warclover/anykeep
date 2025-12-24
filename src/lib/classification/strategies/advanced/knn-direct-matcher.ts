/**
 * V3.0 k-NN 直接锁定匹配器
 *
 * 当找到高相似度（≥0.9）的历史书签时，直接采用该书签的分类，
 * 跳过后续的 AI 调用，减少 30% 的 AI 调用成本。
 *
 * 工作原理：
 * 1. 向量搜索找到最相似的历史书签（Top 1）
 * 2. 如果相似度 >= 阈值（默认 0.9）
 * 3. 直接返回该书签所在的文件夹
 * 4. 标记 skipAI: true，告知系统跳过 AI 调用
 */

import type {
  IMatcher,
  MatcherOptions,
} from "@/lib/classification/strategies/interfaces";
import type { MatchResult, MatcherContext } from "@/lib/classification/types";
import type { BookmarkRepository } from "@/lib/classification/repositories";
import { FEATURE_FLAGS } from "../../config/feature-flags";
import { logger } from "@/lib/logger";

/**
 * k-NN 直接锁定配置
 */
export interface KnnDirectConfig {
  /** 相似度阈值 (0-1)，默认 0.9 */
  similarityThreshold: number;
  /** 权重（当直接匹配成功时，覆盖其他匹配器） */
  weight: number;
  /** 是否启用 */
  enabled: boolean;
}

const DEFAULT_CONFIG: KnnDirectConfig = {
  similarityThreshold: 0.9,
  weight: 1.0, // 最高权重
  enabled: true,
};

/**
 * k-NN 直接锁定匹配结果
 */
export interface KnnDirectMatchResult extends MatchResult {
  /** 是否跳过 AI 调用 */
  skipAI: boolean;
  /** 匹配的源书签 ID */
  sourceBookmarkId: number;
  /** 向量相似度 (0-1) */
  vectorSimilarity: number;
}

/**
 * k-NN 直接锁定匹配器
 */
export class KnnDirectMatcher implements IMatcher {
  readonly name = "knn-direct";
  readonly weight: number;

  private config: KnnDirectConfig;
  private bookmarkRepo: BookmarkRepository;

  constructor(bookmarkRepo: BookmarkRepository, options?: MatcherOptions) {
    this.bookmarkRepo = bookmarkRepo;
    this.config = {
      ...DEFAULT_CONFIG,
      similarityThreshold:
        options?.thresholds?.similarity ?? FEATURE_FLAGS.knnDirectThreshold,
      weight: options?.weight ?? DEFAULT_CONFIG.weight,
      enabled: FEATURE_FLAGS.enableKnnDirect,
    };
    this.weight = this.config.weight;
  }

  /**
   * 执行 k-NN 直接匹配
   */
  async match(context: MatcherContext): Promise<MatchResult[]> {
    if (!this.config.enabled) {
      return [];
    }

    // 没有向量表示，无法匹配
    if (!context.embedding || context.embedding.length === 0) {
      return [];
    }

    try {
      // 查找最相似的书签（取 Top 3，然后筛选高相似度）
      // 传入 bookmarkId 以排除当前书签（避免自匹配）
      const similar = await this.bookmarkRepo.findSimilarWithFolders(
        context.embedding,
        context.userId,
        3,
        context.bookmarkId, // 排除当前书签
      );

      // 筛选出高于阈值的结果
      const highSimilarity = similar.filter(
        (s) => s.similarity >= this.config.similarityThreshold,
      );

      if (highSimilarity.length === 0) {
        logger.debug(
          {
            action: "knn_direct_no_match",
            threshold: this.config.similarityThreshold,
            topSimilarity: similar[0]?.similarity ?? 0,
          },
          "k-NN Direct: No high-similarity match found",
        );
        return [];
      }

      const match = highSimilarity[0];

      // 确保书签有文件夹，且不是系统文件夹（防御性检查）
      if (
        !match.folderId ||
        !match.folderName ||
        this.isSystemFolder(match.folderName)
      ) {
        if (match.folderName && this.isSystemFolder(match.folderName)) {
          logger.debug(
            {
              action: "knn_direct_skip_system_folder",
              folderName: match.folderName,
            },
            "k-NN Direct: Skipped system folder match",
          );
        }
        return [];
      }

      logger.info(
        {
          action: "knn_direct_match",
          similarity: match.similarity,
          folderId: match.folderId,
          folderName: match.folderName,
          sourceTitle: match.bookmarkTitle?.substring(0, 50),
        },
        `k-NN Direct: Matched with ${(match.similarity * 100).toFixed(1)}% similarity`,
      );

      const result: KnnDirectMatchResult = {
        folderId: match.folderId,
        folderName: match.folderName,
        score: match.similarity * 100,
        confidence: match.similarity * 100,
        reason: `与「${match.bookmarkTitle?.substring(0, 30)}...」高度相似`,
        skipAI: true,
        sourceBookmarkId: match.bookmarkId,
        vectorSimilarity: match.similarity,
        metadata: {
          matchType: "knn_direct",
          sourceBookmarkId: match.bookmarkId,
          vectorSimilarity: match.similarity,
          skipAI: true,
        },
      };

      return [result];
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          action: "knn_direct_error",
        },
        "k-NN Direct: Failed",
      );
      return [];
    }
  }

  /**
   * 检查是否可用
   */
  async isAvailable(context: MatcherContext): Promise<boolean> {
    return (
      this.config.enabled &&
      Boolean(context.embedding) &&
      context.embedding.length > 0
    );
  }

  /**
   * 检查结果是否应该跳过 AI
   */
  static shouldSkipAI(results: MatchResult[]): boolean {
    return results.some(
      (r) =>
        r.metadata?.skipAI === true || r.metadata?.matchType === "knn_direct",
    );
  }

  /**
   * 检查是否是系统文件夹（防御性检查）
   * 数据库层已过滤，这里是额外的安全保障
   */
  private isSystemFolder(folderName: string): boolean {
    const systemFolderNames = ["待整理", "inbox", "Inbox", "INBOX"];
    return systemFolderNames.includes(folderName);
  }
}
