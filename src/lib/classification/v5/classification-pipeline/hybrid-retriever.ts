/**
 * 智能分类 v5.0 - 混合检索器
 *
 * 实现混合检索（内容向量 70% + 行为向量 30%）和 RRF 融合
 */

import type { LoggerService } from '../shared/logger';
import type { VectorSearchService } from '../shared/vector-search';
import type { HybridRetrievalResult } from './types';

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
  private config: HybridRetrieverConfig;

  constructor(
    logger: LoggerService,
    vectorSearch: VectorSearchService,
    config?: Partial<HybridRetrieverConfig>
  ) {
    this.logger = logger.child({ service: 'HybridRetriever' });
    this.vectorSearch = vectorSearch;

    this.config = {
      contentWeight: config?.contentWeight ?? 0.7,
      behaviorWeight: config?.behaviorWeight ?? 0.3,
      rrfK: config?.rrfK ?? 60,
      topK: config?.topK ?? 5,
    };
  }

  /**
   * 执行混合检索
   */
  async retrieve(
    userId: string,
    contentEmbedding: number[],
    behaviorEmbedding: number[]
  ): Promise<HybridRetrievalResult[]> {
    this.logger.debug('开始混合检索', {
      userId,
      contentWeight: this.config.contentWeight,
      behaviorWeight: this.config.behaviorWeight,
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

    // 4. 返回 Top K
    return fusedResults.slice(0, this.config.topK);
  }

  /**
   * RRF（Reciprocal Rank Fusion）融合
   */
  private fuseWithRRF(
    contentResults: Array<{ folderId: string; folderName: string; similarity: number }>,
    behaviorResults: Array<{ folderId: string; folderName: string; similarity: number }>
  ): HybridRetrievalResult[] {
    const scoreMap = new Map<string, {
      folderName: string;
      contentSimilarity: number;
      behaviorSimilarity: number;
      fusedScore: number;
    }>();

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
