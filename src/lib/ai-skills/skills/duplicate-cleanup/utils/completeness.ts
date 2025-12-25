/**
 * 书签完整度分析工具
 *
 * 分析书签的完整度并根据保留策略确定推荐保留项
 *
 * @module duplicate-cleanup/utils/completeness
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { DuplicateGroup, DuplicateBookmark, KeepStrategy } from "../types";
import { DUPLICATE_CLEANUP_CONFIG } from "../types";

// ============================================
// 完整度计算
// ============================================

/**
 * 计算单个书签的完整度评分
 */
export function calculateCompleteness(bookmark: DuplicateBookmark): number {
  const weights = DUPLICATE_CLEANUP_CONFIG.COMPLETENESS_WEIGHTS;
  let score = 0;

  if (bookmark.hasSummary) score += weights.hasSummary;
  if (bookmark.tagCount > 0) score += weights.hasTags;
  if (bookmark.folderId) score += weights.hasFolder;

  return Math.min(100, score);
}

// ============================================
// 完整度分析
// ============================================

/**
 * 分析重复组的完整度并确定保留策略
 */
export function analyzeGroupCompleteness(
  groups: DuplicateGroup[],
  keepStrategy: KeepStrategy,
): DuplicateGroup[] {
  return groups.map((group) => {
    // 计算每个书签的完整度
    const withScores = group.bookmarks.map((b) => ({
      ...b,
      completeness: calculateCompleteness(b),
    }));

    // 根据策略排序
    let sorted: typeof withScores;
    let reason: string;

    switch (keepStrategy) {
      case "oldest":
        sorted = withScores.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        reason = "保留最早创建的书签";
        break;
      case "newest":
        sorted = withScores.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        reason = "保留最新创建的书签";
        break;
      case "most_complete":
      default:
        sorted = withScores.sort((a, b) => b.completeness - a.completeness);
        reason = `保留完整度最高的书签 (${sorted[0].completeness}%)`;
        break;
    }

    return {
      ...group,
      bookmarks: sorted,
      recommendedKeep: sorted[0].id,
      reason,
    };
  });
}
