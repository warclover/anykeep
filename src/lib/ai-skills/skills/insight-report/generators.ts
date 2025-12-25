/**
 * 洞察报告生成器模块
 *
 * 提供洞察、摘要、建议三种生成功能
 *
 * @module insight-report/generators
 * @version 1.0.0
 * @since 2025-12-25
 */

import type {
  ReportType,
  ActivityAnalysis,
  ContentAnalysis,
  TrendAnalysis,
  Insight,
} from "./types";

// ============================================
// 洞察生成
// ============================================

/**
 * 基于分析结果生成洞察建议
 *
 * @param activity - 活跃度分析结果
 * @param content - 内容分析结果
 * @param trends - 趋势分析结果
 * @returns 洞察建议列表
 */
export function generateInsights(
  activity: ActivityAnalysis,
  content: ContentAnalysis,
  trends: TrendAnalysis,
): Insight[] {
  const insights: Insight[] = [];

  // 活跃度洞察
  if (activity.dailyAverage >= 5) {
    insights.push({
      type: "highlight",
      title: "高活跃用户",
      description: `您日均收藏 ${activity.dailyAverage.toFixed(1)} 条内容，是一位活跃的知识收藏者！`,
      priority: "high",
    });
  } else if (activity.dailyAverage < 1 && activity.totalBookmarks > 0) {
    insights.push({
      type: "suggestion",
      title: "提升收藏频率",
      description:
        "您的收藏频率较低，建议养成每日收藏优质内容的习惯，积少成多。",
      priority: "medium",
    });
  }

  // 平台多样性
  if (content.byPlatform.length >= 5) {
    insights.push({
      type: "highlight",
      title: "多平台收藏",
      description: `您从 ${content.byPlatform.length} 个不同平台收藏内容，涉猎广泛！`,
      priority: "medium",
    });
  } else if (content.byPlatform.length === 1 && activity.totalBookmarks > 10) {
    insights.push({
      type: "suggestion",
      title: "扩展内容来源",
      description: `您的收藏主要来自 ${content.byPlatform[0].name}，可以尝试探索其他平台的优质内容。`,
      priority: "low",
    });
  }

  // 标签使用
  if (content.topTags.length === 0 && activity.totalBookmarks > 10) {
    insights.push({
      type: "warning",
      title: "建议添加标签",
      description: "您的收藏暂无标签，添加标签可以帮助更好地分类和检索内容。",
      priority: "high",
    });
  }

  // 评分使用
  if (content.ratedRate < 0.1 && activity.totalBookmarks > 10) {
    insights.push({
      type: "suggestion",
      title: "使用评分功能",
      description: "您很少为收藏评分，评分可以帮助区分内容的重要程度。",
      priority: "low",
    });
  }

  // 趋势洞察
  if (trends.bookmarkTrend.length >= 2) {
    const lastTrend = trends.bookmarkTrend[trends.bookmarkTrend.length - 1];
    if (lastTrend.changeRate && lastTrend.changeRate > 50) {
      insights.push({
        type: "highlight",
        title: "收藏活跃度提升",
        description: `最近的收藏量较之前增长了 ${lastTrend.changeRate.toFixed(0)}%，学习热情高涨！`,
        priority: "high",
      });
    }
  }

  return insights.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// ============================================
// 摘要生成
// ============================================

/**
 * 生成报告摘要文本
 *
 * @param _reportType - 报告类型
 * @param activity - 活跃度分析结果
 * @param content - 内容分析结果
 * @param trends - 趋势分析结果
 * @returns 摘要文本
 */
export function generateSummary(
  _reportType: ReportType,
  activity: ActivityAnalysis,
  content: ContentAnalysis,
  trends: TrendAnalysis,
): string {
  const lines: string[] = [];

  lines.push(
    `在此统计周期内，您共收藏了 **${activity.totalBookmarks}** 条内容，` +
      `日均 **${activity.dailyAverage.toFixed(1)}** 条。`,
  );

  if (content.byPlatform.length > 0) {
    const topPlatform = content.byPlatform[0];
    lines.push(
      `最常收藏的平台是 **${topPlatform.name}**（${topPlatform.percentage.toFixed(0)}%）。`,
    );
  }

  if (content.topTags.length > 0) {
    const topTag = content.topTags[0];
    lines.push(
      `最热门的标签是 **${topTag.name}**（出现 ${topTag.count} 次）。`,
    );
  }

  lines.push(trends.summary);

  return lines.join("");
}

// ============================================
// 建议生成
// ============================================

/**
 * 基于分析和洞察生成后续建议
 *
 * @param activity - 活跃度分析结果
 * @param content - 内容分析结果
 * @param insights - 洞察建议列表
 * @returns 建议列表
 */
export function generateSuggestions(
  activity: ActivityAnalysis,
  content: ContentAnalysis,
  insights: Insight[],
): string[] {
  const suggestions: string[] = [];

  // 基于洞察生成建议
  const warningInsights = insights.filter((i) => i.type === "warning");
  const suggestionInsights = insights.filter((i) => i.type === "suggestion");

  for (const insight of [...warningInsights, ...suggestionInsights].slice(
    0,
    2,
  )) {
    suggestions.push(insight.description);
  }

  // 通用建议
  if (activity.totalBookmarks > 50 && content.byFolder.length < 3) {
    suggestions.push("收藏数量较多，建议创建更多文件夹进行分类管理");
  }

  if (suggestions.length === 0) {
    suggestions.push("继续保持良好的收藏习惯，定期回顾收藏的内容");
  }

  return suggestions;
}
