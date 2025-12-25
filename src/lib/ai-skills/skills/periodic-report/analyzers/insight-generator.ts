/**
 * 洞察生成模块
 *
 * @module ai-skills/periodic-report/analyzers/insight-generator
 * @version 1.0.0
 * @since 2025-12-25
 */

import type {
  PeriodStats,
  PeriodComparison,
  HighlightBookmark,
  PeriodInsight,
} from "../types";

// ============================================
// 洞察生成
// ============================================

/**
 * 基于统计和对比数据生成洞察
 */
export function generateInsights(
  stats: PeriodStats,
  comparison: PeriodComparison | undefined,
  highlights: HighlightBookmark[],
): PeriodInsight[] {
  const insights: PeriodInsight[] = [];

  // 活跃度洞察
  if (stats.activeDays >= 5) {
    insights.push({
      type: "achievement",
      title: "活跃用户",
      description: `本周期内有 ${stats.activeDays} 天有收藏记录，保持活跃！`,
      icon: "🏆",
    });
  }

  // 对比洞察
  if (comparison) {
    if (comparison.bookmarksChange.trend === "up") {
      insights.push({
        type: "trend",
        title: "收藏量增长",
        description: `相比上期，收藏量增长了 ${comparison.bookmarksChange.changeRate.toFixed(0)}%`,
        icon: "📈",
      });
    } else if (comparison.bookmarksChange.trend === "down") {
      insights.push({
        type: "suggestion",
        title: "收藏量下降",
        description: `相比上期，收藏量减少了 ${Math.abs(comparison.bookmarksChange.changeRate).toFixed(0)}%，可以多关注感兴趣的内容`,
        icon: "📉",
      });
    }
  }

  // 里程碑洞察
  if (stats.newBookmarks >= 50) {
    insights.push({
      type: "milestone",
      title: "收藏达人",
      description: `本周期收藏了 ${stats.newBookmarks} 条内容，是一位勤奋的知识收藏者！`,
      icon: "🎯",
    });
  }

  // 亮点洞察
  if (highlights.length > 0) {
    insights.push({
      type: "suggestion",
      title: "值得回顾",
      description: `发现 ${highlights.length} 条值得回顾的亮点内容，抽空看看吧`,
      icon: "✨",
    });
  }

  return insights;
}
