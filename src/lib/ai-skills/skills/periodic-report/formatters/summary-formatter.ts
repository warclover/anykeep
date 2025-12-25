/**
 * 摘要格式化模块
 *
 * @module ai-skills/periodic-report/formatters/summary-formatter
 * @version 1.0.0
 * @since 2025-12-25
 */

import {
  PERIOD_CONFIG,
  type PeriodStats,
  type PeriodComparison,
  type PeriodInsight,
  type ReportPeriod,
} from "../types";

// ============================================
// 摘要生成
// ============================================

/**
 * 生成报告摘要文本
 */
export function generateSummary(
  stats: PeriodStats,
  comparison: PeriodComparison | undefined,
  period: ReportPeriod,
): string {
  const periodConfig = PERIOD_CONFIG[period];
  const lines: string[] = [];

  lines.push(
    `本${periodConfig.name.replace("报", "")}您共收藏了 **${stats.newBookmarks}** 条内容，`,
  );
  lines.push(`日均 **${stats.dailyAverage.toFixed(1)}** 条。`);

  if (stats.mostActiveDay) {
    lines.push(`最活跃的一天是 **${stats.mostActiveDay}**。`);
  }

  if (comparison) {
    const trend =
      comparison.bookmarksChange.trend === "up"
        ? "增长"
        : comparison.bookmarksChange.trend === "down"
          ? "下降"
          : "持平";
    lines.push(
      `与上期相比，收藏量${trend}了 ${Math.abs(comparison.bookmarksChange.changeRate).toFixed(0)}%。`,
    );
  }

  return lines.join("");
}

// ============================================
// 建议生成
// ============================================

/**
 * 生成操作建议
 */
export function generateSuggestions(
  stats: PeriodStats,
  insights: PeriodInsight[],
): string[] {
  const suggestions: string[] = [];

  // 基于统计的建议
  if (stats.dailyAverage < 1) {
    suggestions.push("建议养成每日收藏的习惯，积少成多");
  }

  if (stats.activeDays < 3) {
    suggestions.push("本周期活跃天数较少，尝试每天花几分钟浏览感兴趣的内容");
  }

  // 基于洞察的建议
  for (const insight of insights) {
    if (insight.type === "suggestion") {
      suggestions.push(insight.description);
    }
  }

  // 默认建议
  if (suggestions.length === 0) {
    suggestions.push("继续保持良好的收藏习惯，定期回顾已收藏的内容");
  }

  return suggestions.slice(0, 3);
}
