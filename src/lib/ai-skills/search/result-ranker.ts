/**
 * 结果排序器
 *
 * 根据多维因子对搜索结果进行智能排序
 * 支持标题匹配、内容匹配、时间相关性、用户行为和质量信号
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import {
  type ParsedQuery,
  type MatchType,
  type MatchResult,
  type RankingFactors,
  type RelevanceLevel,
  type RankedResult,
  type ResultRankerConfig,
  DEFAULT_RESULT_RANKER_CONFIG,
} from "./types";

// ============================================
// 书签接口（用于排序输入）
// ============================================

/**
 * 排序输入的书签数据
 */
export interface BookmarkForRanking {
  /** 书签 ID */
  id: number;
  /** 标题 */
  title: string;
  /** 摘要/内容 */
  summary?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 最后访问时间 */
  lastAccessedAt?: Date;
  /** 访问次数 */
  accessCount?: number;
  /** 是否收藏 */
  isFavorite?: boolean;
  /** 标签数量 */
  tagCount?: number;
  /** 向量搜索得分（如果有） */
  vectorScore?: number;
}

// ============================================
// ResultRanker 类
// ============================================

/**
 * 结果排序器
 *
 * 使用多维因子对搜索结果进行排序：
 * - 标题匹配 (40%): 关键词在标题中的匹配度
 * - 内容匹配 (25%): 关键词在内容/摘要中的匹配度
 * - 时间相关性 (15%): 内容的时效性
 * - 用户行为 (10%): 访问次数、收藏状态等
 * - 质量信号 (10%): 标签完整度、内容丰富度等
 */
export class ResultRanker {
  private config: Required<ResultRankerConfig>;

  constructor(config: ResultRankerConfig = {}) {
    this.config = { ...DEFAULT_RESULT_RANKER_CONFIG, ...config };
  }

  /**
   * 对书签列表进行排序
   *
   * @param bookmarks - 待排序的书签列表
   * @param query - 解析后的查询
   * @returns 排序后的结果列表
   */
  rank(bookmarks: BookmarkForRanking[], query: ParsedQuery): RankedResult[] {
    const results: RankedResult[] = [];

    for (const bookmark of bookmarks) {
      const factors = this.calculateFactors(bookmark, query);
      const score = this.calculateScore(factors, bookmark.vectorScore);
      const relevance = this.determineRelevance(score);

      results.push({
        bookmarkId: bookmark.id,
        score,
        relevance,
        factors,
      });
    }

    // 按得分降序排序
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * 计算排序因子
   */
  private calculateFactors(
    bookmark: BookmarkForRanking,
    query: ParsedQuery,
  ): RankingFactors {
    return {
      titleMatch: this.calculateTitleMatch(bookmark.title, query),
      contentMatch: this.calculateContentMatch(bookmark.summary || "", query),
      timeRelevance: this.calculateTimeRelevance(
        bookmark.createdAt,
        query.timeRange,
      ),
      userBehavior: this.calculateUserBehavior(bookmark),
      qualitySignal: this.calculateQualitySignal(bookmark),
    };
  }

  /**
   * 计算标题匹配度
   */
  private calculateTitleMatch(title: string, query: ParsedQuery): MatchResult {
    if (!title || query.keywords.length === 0) {
      return { type: "partial", score: 0 };
    }

    const titleLower = title.toLowerCase();
    const positions: number[] = [];
    let exactMatches = 0;
    let partialMatches = 0;

    for (const keyword of query.keywords) {
      const keywordLower = keyword.toLowerCase();
      const index = titleLower.indexOf(keywordLower);

      if (index !== -1) {
        positions.push(index);
        // 检查是否完整词匹配（前后是空格或边界）
        const isExact = this.isExactMatch(titleLower, keywordLower, index);
        if (isExact) {
          exactMatches++;
        } else {
          partialMatches++;
        }
      }
    }

    // 计算匹配得分
    const totalKeywords = query.keywords.length;
    const matchedKeywords = exactMatches + partialMatches;

    if (matchedKeywords === 0) {
      return { type: "semantic", score: 0, positions: [] };
    }

    // 精确匹配权重更高
    const score = (exactMatches * 1.0 + partialMatches * 0.6) / totalKeywords;

    // 确定匹配类型
    let type: MatchType = "partial";
    if (exactMatches === totalKeywords) {
      type = "exact";
    } else if (exactMatches > 0) {
      type = "partial";
    }

    return {
      type,
      score: Math.min(score, 1),
      positions,
    };
  }

  /**
   * 计算内容匹配度
   */
  private calculateContentMatch(
    content: string,
    query: ParsedQuery,
  ): MatchResult {
    if (!content || query.keywords.length === 0) {
      return { type: "partial", score: 0 };
    }

    const contentLower = content.toLowerCase();
    const positions: number[] = [];
    let matches = 0;

    for (const keyword of query.keywords) {
      const keywordLower = keyword.toLowerCase();
      let searchIndex = 0;

      while (true) {
        const index = contentLower.indexOf(keywordLower, searchIndex);
        if (index === -1) break;

        positions.push(index);
        matches++;
        searchIndex = index + keywordLower.length;

        // 限制位置数量
        if (positions.length >= 10) break;
      }
    }

    if (matches === 0) {
      return { type: "semantic", score: 0, positions: [] };
    }

    // 内容匹配得分（考虑匹配次数，但有上限）
    const baseScore = Math.min(matches / query.keywords.length, 1);
    const densityBonus = Math.min(matches / 5, 0.2); // 密度奖励

    return {
      type: positions.length > 0 ? "partial" : "semantic",
      score: Math.min(baseScore + densityBonus, 1),
      positions,
    };
  }

  /**
   * 计算时间相关性
   */
  private calculateTimeRelevance(
    createdAt: Date,
    timeRange?: { start: Date; end: Date },
  ): number {
    const now = new Date();
    const ageInDays =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    // 如果有时间范围过滤
    if (timeRange) {
      const itemTime = createdAt.getTime();
      const startTime = timeRange.start.getTime();
      const endTime = timeRange.end.getTime();

      // 在范围内得满分
      if (itemTime >= startTime && itemTime <= endTime) {
        // 越新越好
        const rangePosition = (itemTime - startTime) / (endTime - startTime);
        return 0.8 + rangePosition * 0.2;
      }

      // 不在范围内
      return 0;
    }

    // 没有时间范围时，使用衰减函数
    // 7天内: 1.0 → 0.9
    // 30天内: 0.9 → 0.7
    // 90天内: 0.7 → 0.5
    // 更早: 0.5 → 0.3
    if (ageInDays <= 7) {
      return 1 - ageInDays * 0.014; // 约 0.9
    } else if (ageInDays <= 30) {
      return 0.9 - (ageInDays - 7) * 0.008; // 约 0.7
    } else if (ageInDays <= 90) {
      return 0.7 - (ageInDays - 30) * 0.003; // 约 0.5
    } else {
      return Math.max(0.3, 0.5 - (ageInDays - 90) * 0.001);
    }
  }

  /**
   * 计算用户行为分数
   */
  private calculateUserBehavior(bookmark: BookmarkForRanking): number {
    let score = 0.3; // 基础分

    // 访问次数（最多 +0.3）
    if (bookmark.accessCount) {
      score += Math.min(bookmark.accessCount / 10, 0.3);
    }

    // 最近访问（最多 +0.2）
    if (bookmark.lastAccessedAt) {
      const daysSinceAccess =
        (Date.now() - bookmark.lastAccessedAt.getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSinceAccess <= 7) {
        score += 0.2;
      } else if (daysSinceAccess <= 30) {
        score += 0.1;
      }
    }

    // 收藏状态（+0.2）
    if (bookmark.isFavorite) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }

  /**
   * 计算质量信号分数
   */
  private calculateQualitySignal(bookmark: BookmarkForRanking): number {
    let score = 0.3; // 基础分

    // 有摘要（+0.3）
    if (bookmark.summary && bookmark.summary.length > 50) {
      score += 0.3;
    } else if (bookmark.summary && bookmark.summary.length > 0) {
      score += 0.15;
    }

    // 有标签（+0.2）
    if (bookmark.tagCount && bookmark.tagCount > 0) {
      score += Math.min(bookmark.tagCount / 5, 0.2);
    }

    // 标题质量（+0.2）
    if (bookmark.title && bookmark.title.length >= 10) {
      score += 0.2;
    } else if (bookmark.title && bookmark.title.length >= 5) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * 计算综合得分
   */
  private calculateScore(
    factors: RankingFactors,
    vectorScore?: number,
  ): number {
    const {
      titleWeight,
      contentWeight,
      timeWeight,
      behaviorWeight,
      qualityWeight,
    } = this.config;

    // 基础加权得分
    let score =
      factors.titleMatch.score * titleWeight +
      factors.contentMatch.score * contentWeight +
      factors.timeRelevance * timeWeight +
      factors.userBehavior * behaviorWeight +
      factors.qualitySignal * qualityWeight;

    // 如果有向量搜索得分，混合使用
    if (vectorScore !== undefined && vectorScore > 0) {
      // 向量得分占 30%，关键词得分占 70%
      score = score * 0.7 + vectorScore * 0.3;
    }

    // 转换为 0-100 分
    return Math.round(score * 100);
  }

  /**
   * 确定相关度等级
   */
  private determineRelevance(score: number): RelevanceLevel {
    if (score >= 70) {
      return "high";
    } else if (score >= 40) {
      return "medium";
    } else {
      return "low";
    }
  }

  /**
   * 检查是否是精确匹配（完整词）
   */
  private isExactMatch(text: string, keyword: string, index: number): boolean {
    // 检查前边界
    if (index > 0) {
      const prevChar = text[index - 1];
      // 如果前一个字符是字母数字，不是完整词
      if (/[a-z0-9\u4e00-\u9fa5]/.test(prevChar)) {
        return false;
      }
    }

    // 检查后边界
    const endIndex = index + keyword.length;
    if (endIndex < text.length) {
      const nextChar = text[endIndex];
      // 如果后一个字符是字母数字，不是完整词
      if (/[a-z0-9\u4e00-\u9fa5]/.test(nextChar)) {
        return false;
      }
    }

    return true;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 ResultRanker 实例
 */
export function createResultRanker(config?: ResultRankerConfig): ResultRanker {
  return new ResultRanker(config);
}

// ============================================
// 便捷方法
// ============================================

/**
 * 快速对结果进行排序（使用默认配置）
 */
export function rankResults(
  bookmarks: BookmarkForRanking[],
  query: ParsedQuery,
): RankedResult[] {
  const ranker = new ResultRanker();
  return ranker.rank(bookmarks, query);
}
