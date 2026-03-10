/**
 * L1.5 关键词预分组服务
 *
 * 在向量计算前，利用网页自带 keywords 进行预分组，减少后续计算量
 *
 * @module classification/batch-classification/pre-grouping/keyword-grouping
 * @version 1.0.0
 * @since 2026-02-01
 */

import type {
  BookmarkWithEmbedding,
  PreGroupingResult,
  PreGroupingConfig,
  SuperNode,
} from "../types";
import { DEFAULT_PRE_GROUPING_CONFIG } from "../config/domain-whitelist";
import { cosineSimilarity } from "../utils/similarity";

// ============================================
// 关键词预分组服务
// ============================================

/**
 * 关键词预分组服务
 *
 * 功能：
 * 1. 按 keywords 标签预分组
 * 2. 10+ 个同标签书签合并为"超级节点"
 * 3. 减少 30%-50% 向量对比计算量
 */
export class KeywordGroupingService {
  private config: PreGroupingConfig;

  constructor(config: PreGroupingConfig = DEFAULT_PRE_GROUPING_CONFIG) {
    this.config = config;
  }

  /**
   * 执行关键词预分组
   */
  async preGroupByKeywords(
    bookmarks: BookmarkWithEmbedding[],
  ): Promise<PreGroupingResult> {
    const groups = new Map<string, number[]>();
    const ungrouped: number[] = [];

    // 第一步：按关键词分组
    for (const bookmark of bookmarks) {
      const keywords = bookmark.keywords || [];

      if (keywords.length > 0 && this.config.keywordGrouping.enabled) {
        const primaryKeyword = this.normalizeKeyword(keywords[0]);

        if (!groups.has(primaryKeyword)) {
          groups.set(primaryKeyword, []);
        }
        groups.get(primaryKeyword)?.push(bookmark.id);
      } else {
        ungrouped.push(bookmark.id);
      }
    }

    // 第二步：将大组合并为超级节点
    const superNodes: SuperNode[] = [];
    const bookmarkMap = new Map(bookmarks.map((b) => [b.id, b]));

    for (const [keyword, ids] of groups) {
      if (ids.length >= this.config.keywordGrouping.minCount) {
        const memberBookmarks = ids
          .map((id) => bookmarkMap.get(id))
          .filter((b): b is BookmarkWithEmbedding => b !== undefined);

        const representative = await this.selectRepresentative(memberBookmarks);

        superNodes.push({
          id: `group:keyword:${keyword}`,
          keyword,
          embedding: representative.embedding,
          memberIds: ids,
          weight: ids.length,
          groupType: "keyword",
        });
      } else {
        // 小组拆散到 ungrouped
        ungrouped.push(...ids);
        groups.delete(keyword);
      }
    }

    // 计算统计信息
    const groupedCount = bookmarks.length - ungrouped.length;
    const estimatedVectorSavings = Math.round(
      (groupedCount / bookmarks.length) * 100,
    );

    return {
      groups,
      ungrouped,
      superNodes,
      stats: {
        totalBookmarks: bookmarks.length,
        groupedCount,
        ungroupedCount: ungrouped.length,
        superNodeCount: superNodes.length,
        estimatedVectorSavings,
      },
    };
  }

  /**
   * 标准化关键词
   */
  private normalizeKeyword(keyword: string): string {
    return keyword
      .toLowerCase()
      .trim()
      .replace(/[\s_-]+/g, " ")
      .replace(/[^\w\u4e00-\u9fa5\s]/g, ""); // 保留中英文和空格
  }

  /**
   * 选择代表性书签
   * 选择与组内其他书签平均相似度最高的书签
   */
  private async selectRepresentative(
    bookmarks: BookmarkWithEmbedding[],
  ): Promise<BookmarkWithEmbedding> {
    if (bookmarks.length === 0) {
      throw new Error("Cannot select representative from empty array");
    }

    if (bookmarks.length === 1) {
      return bookmarks[0];
    }

    // 计算每个书签与其他��签的平均相似度
    let bestBookmark = bookmarks[0];
    let bestAvgSimilarity = -1;

    for (const bookmark of bookmarks) {
      let totalSimilarity = 0;
      let count = 0;

      for (const other of bookmarks) {
        if (bookmark.id !== other.id) {
          totalSimilarity += cosineSimilarity(
            bookmark.embedding,
            other.embedding,
          );
          count++;
        }
      }

      const avgSimilarity = count > 0 ? totalSimilarity / count : 0;

      if (avgSimilarity > bestAvgSimilarity) {
        bestAvgSimilarity = avgSimilarity;
        bestBookmark = bookmark;
      }
    }

    return bestBookmark;
  }

  /**
   * 计算组的质心向量
   */
  computeGroupCentroid(bookmarks: BookmarkWithEmbedding[]): number[] {
    if (bookmarks.length === 0) {
      return [];
    }

    const dim = bookmarks[0].embedding.length;
    const centroid = new Array<number>(dim).fill(0);

    for (const bookmark of bookmarks) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += bookmark.embedding[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      centroid[i] /= bookmarks.length;
    }

    return centroid;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PreGroupingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// ============================================
// 导出单例
// ============================================

export const keywordGroupingService = new KeywordGroupingService();
