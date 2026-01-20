/**
 * 智能分类 v5.1 - 混合检索器
 *
 * 实现混合检索（内容向量 70% + 行为向量 30%）和 RRF 融合
 * v5.1 新增：语义护栏（名称相似度分数），解决大文件夹马太效应
 */

import type { LoggerService } from "../shared/logger";
import type { VectorSearchService } from "../shared/vector-search";
import type { IEmbeddingService } from "../shared/embedding";
import type { HybridRetrievalResult } from "./types";

/**
 * 混合检索器配置
 */
export interface HybridRetrieverConfig {
  /** 内容向量权重 */
  contentWeight: number;
  /** 行为向量权重 */
  behaviorWeight: number;
  /** RRF 常数 */
  rrfK: number;
  /** 返回结果数量 */
  topK: number;
}

/**
 * 混合检索器类
 */
export class HybridRetriever {
  private logger: LoggerService;
  private vectorSearch: VectorSearchService;
  private embeddingService?: IEmbeddingService;
  private config: HybridRetrieverConfig;
  /** v5.1: 是否启用名称相似度护栏 */
  private enableNameGuardrail: boolean;

  constructor(
    logger: LoggerService,
    vectorSearch: VectorSearchService,
    config?: Partial<HybridRetrieverConfig>,
    embeddingService?: IEmbeddingService,
  ) {
    this.logger = logger.child({ service: "HybridRetriever" });
    this.vectorSearch = vectorSearch;
    this.embeddingService = embeddingService;

    this.config = {
      contentWeight: config?.contentWeight ?? 0.7,
      behaviorWeight: config?.behaviorWeight ?? 0.3,
      rrfK: config?.rrfK ?? 60,
      topK: config?.topK ?? 5,
    };

    this.enableNameGuardrail =
      process.env.CLASSIFICATION_V5_1_ENABLED !== "false" &&
      embeddingService !== undefined;
  }

  /**
   * 执行混合检索
   * v5.1: 支持名称相似度护栏
   */
  async retrieve(
    userId: string,
    contentEmbedding: number[],
    behaviorEmbedding: number[],
    bookmarkTitle?: string,
  ): Promise<HybridRetrievalResult[]> {
    this.logger.debug("开始混合检索", {
      userId,
      contentWeight: this.config.contentWeight,
      behaviorWeight: this.config.behaviorWeight,
      enableNameGuardrail: this.enableNameGuardrail,
    });

    // 1. 内容向量检索
    const contentResults = await this.vectorSearch.search({
      userId,
      contentEmbedding,
      limit: 10, // 检索更多候选，用于融合
    });

    // 2. 行为向量检索
    const behaviorResults = await this.vectorSearch.search({
      userId,
      behaviorEmbedding,
      limit: 10,
    });

    // 3. RRF 融合
    const fusedResults = this.fuseWithRRF(contentResults, behaviorResults);

    // 4. v5.1: 如果启用名称护栏，应用名称相似度分数
    let finalResults = fusedResults;
    if (this.enableNameGuardrail && bookmarkTitle) {
      finalResults = await this.applyNameGuardrail(fusedResults, bookmarkTitle);
    }

    // 5. 返回 Top K
    return finalResults.slice(0, this.config.topK);
  }

  /**
   * v5.1: 应用名称相似度护栏
   *
   * 如果书签标题与文件夹名高度匹配（>0.85），强制提升排名
   */
  private async applyNameGuardrail(
    results: HybridRetrievalResult[],
    bookmarkTitle: string,
  ): Promise<HybridRetrievalResult[]> {
    if (!this.embeddingService) {
      return results;
    }

    // 生成书签标题向量
    const bookmarkTitleEmbedding =
      await this.embeddingService.generateEmbedding(bookmarkTitle);

    // 为每个结果计算名称相似度
    const resultsWithNameScore = await Promise.all(
      results.map(async (result) => {
        // 生成文件夹名称向量
        const folderNameEmbedding =
          await this.embeddingService!.generateEmbedding(result.folderName);

        // 计算名称相似度
        const nameSimilarity = this.cosineSimilarity(
          bookmarkTitleEmbedding.embedding,
          folderNameEmbedding.embedding,
        );

        // 如果名称相似度 > 0.85，给予加成
        let adjustedScore = result.fusedScore;
        if (nameSimilarity > 0.85) {
          adjustedScore += 0.15; // 强制提升排名
          this.logger.debug("名称匹配度高，提升排名", {
            folderId: result.folderId,
            folderName: result.folderName,
            nameSimilarity,
            originalScore: result.fusedScore,
            adjustedScore,
          });
        }

        return {
          ...result,
          nameSimilarity,
          fusedScore: adjustedScore,
        };
      }),
    );

    // 按调整后的分数重新排序
    return resultsWithNameScore.sort((a, b) => b.fusedScore - a.fusedScore);
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error("Vectors must have the same dimension");
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * RRF（Reciprocal Rank Fusion）融合
   */
  private fuseWithRRF(
    contentResults: Array<{
      folderId: string;
      folderName: string;
      similarity: number;
    }>,
    behaviorResults: Array<{
      folderId: string;
      folderName: string;
      similarity: number;
    }>,
  ): HybridRetrievalResult[] {
    const scoreMap = new Map<
      string,
      {
        folderName: string;
        contentSimilarity: number;
        behaviorSimilarity: number;
        fusedScore: number;
      }
    >();

    // 内容向量贡献
    contentResults.forEach((result, index) => {
      const rrf = 1 / (this.config.rrfK + index + 1);
      const score = this.config.contentWeight * rrf;

      scoreMap.set(result.folderId, {
        folderName: result.folderName,
        contentSimilarity: result.similarity,
        behaviorSimilarity: 0,
        fusedScore: score,
      });
    });

    // 行为向量贡献
    behaviorResults.forEach((result, index) => {
      const rrf = 1 / (this.config.rrfK + index + 1);
      const score = this.config.behaviorWeight * rrf;

      const existing = scoreMap.get(result.folderId);
      if (existing) {
        existing.behaviorSimilarity = result.similarity;
        existing.fusedScore += score;
      } else {
        scoreMap.set(result.folderId, {
          folderName: result.folderName,
          contentSimilarity: 0,
          behaviorSimilarity: result.similarity,
          fusedScore: score,
        });
      }
    });

    // 排序并返回
    return Array.from(scoreMap.entries())
      .map(([folderId, data]) => ({
        folderId,
        folderName: data.folderName,
        contentSimilarity: data.contentSimilarity,
        behaviorSimilarity: data.behaviorSimilarity,
        fusedScore: data.fusedScore,
      }))
      .sort((a, b) => b.fusedScore - a.fusedScore);
  }
}
