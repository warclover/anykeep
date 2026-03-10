/**
 * URL 路径预分组服务
 *
 * 基于 URL 路径模式进行预分组，如 github.com/facebook/* 归为一组
 *
 * @module classification/batch-classification/pre-grouping/url-path-grouping
 * @version 1.0.0
 * @since 2026-02-01
 */

import type {
  BookmarkWithEmbedding,
  PreGroupingResult,
  PreGroupingConfig,
  SuperNode,
} from "../types";
import {
  DEFAULT_PRE_GROUPING_CONFIG,
  extractMeaningfulDomain,
} from "../config/domain-whitelist";
import { cosineSimilarity } from "../utils/similarity";

// ============================================
// URL 路径预分组服务
// ============================================

/**
 * URL 路径预分组服务
 *
 * 功能：
 * 1. 按 URL 路径模式分组（如 GitHub 组织）
 * 2. 基于有意义的域名分组
 * 3. 减少向量计算量
 */
export class UrlPathGroupingService {
  private config: PreGroupingConfig;

  constructor(config: PreGroupingConfig = DEFAULT_PRE_GROUPING_CONFIG) {
    this.config = config;
  }

  /**
   * 执行 URL 路径预分组
   */
  async preGroupByUrlPath(
    bookmarks: BookmarkWithEmbedding[],
  ): Promise<PreGroupingResult> {
    const groups = new Map<string, number[]>();
    const ungrouped: number[] = [];

    if (!this.config.urlPathGrouping.enabled) {
      return {
        groups,
        ungrouped: bookmarks.map((b) => b.id),
        superNodes: [],
        stats: {
          totalBookmarks: bookmarks.length,
          groupedCount: 0,
          ungroupedCount: bookmarks.length,
          superNodeCount: 0,
          estimatedVectorSavings: 0,
        },
      };
    }

    // 第一步：按 URL 路径模式分组
    for (const bookmark of bookmarks) {
      const groupKey = this.extractGroupKey(bookmark.url);

      if (groupKey) {
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)?.push(bookmark.id);
      } else {
        ungrouped.push(bookmark.id);
      }
    }

    // 第二步：将满足阈值的组转为超级节点
    const superNodes: SuperNode[] = [];
    const bookmarkMap = new Map(bookmarks.map((b) => [b.id, b]));
    const groupsToRemove: string[] = [];

    for (const [groupKey, ids] of groups) {
      const minCount = this.getMinCountForGroup(groupKey);

      if (ids.length >= minCount) {
        const memberBookmarks = ids
          .map((id) => bookmarkMap.get(id))
          .filter((b): b is BookmarkWithEmbedding => b !== undefined);

        const representative = await this.selectRepresentative(memberBookmarks);

        superNodes.push({
          id: `group:url:${groupKey}`,
          keyword: groupKey,
          embedding: representative.embedding,
          memberIds: ids,
          weight: ids.length,
          groupType: "url_path",
        });
      } else {
        // 小组拆散到 ungrouped
        ungrouped.push(...ids);
        groupsToRemove.push(groupKey);
      }
    }

    // 清理小组
    for (const key of groupsToRemove) {
      groups.delete(key);
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
   * 提取分组键
   * 返回 null 表示无法分组
   */
  private extractGroupKey(url: string): string | null {
    try {
      const parsed = new URL(url);

      // 检查是否匹配任何预定义模式
      for (const { pattern, minCount: _ } of this.config.urlPathGrouping
        .patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          return `${parsed.hostname}/${match[1]}`;
        }
      }

      // 使用有意义的域名作为分组键
      const meaningfulDomain = extractMeaningfulDomain(url);
      if (meaningfulDomain !== parsed.hostname) {
        return meaningfulDomain;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * 获取分组的最小数量要求
   */
  private getMinCountForGroup(groupKey: string): number {
    // 检查是否匹配预定义模式
    for (const { pattern, minCount } of this.config.urlPathGrouping.patterns) {
      if (pattern.test(groupKey)) {
        return minCount;
      }
    }

    // 默认使用 3
    return 3;
  }

  /**
   * 选择代表性书签
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

    // 选择与组内其他书签平均相似度最高的书签
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

export const urlPathGroupingService = new UrlPathGroupingService();
