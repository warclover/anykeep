/**
 * 洞察报告分析器模块
 *
 * 提供活跃度、内容、趋势三个维度的分析功能
 *
 * @module insight-report/analyzers
 * @version 1.0.0
 * @since 2025-12-25
 */

import type {
  InsightReportInput,
  ActivityAnalysis,
  ContentAnalysis,
  TrendAnalysis,
  TrendDataPoint,
  DistributionItem,
  TopItem,
  BookmarkRow,
} from "./types";

// ============================================
// 辅助函数
// ============================================

/**
 * 获取文件夹名称
 */
export function getFolderName(bookmark: BookmarkRow): string | null {
  if (!bookmark.folders) return null;
  const folder = Array.isArray(bookmark.folders)
    ? bookmark.folders[0]
    : bookmark.folders;
  return folder?.name || null;
}

// ============================================
// 活跃度分析
// ============================================

/**
 * 分析用户收藏活跃度
 *
 * @param bookmarks - 书签数据
 * @param input - 报告输入参数
 * @returns 活跃度分析结果
 */
export function analyzeActivity(
  bookmarks: BookmarkRow[],
  input: InsightReportInput,
): ActivityAnalysis {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // 计算时间范围天数
  let rangeDays = 30;
  switch (input.timeRange) {
    case "week":
      rangeDays = 7;
      break;
    case "month":
      rangeDays = 30;
      break;
    case "quarter":
      rangeDays = 90;
      break;
    case "year":
      rangeDays = 365;
      break;
    case "all":
      rangeDays = Math.max(
        1,
        bookmarks.length > 0
          ? Math.ceil(
              (now -
                new Date(
                  bookmarks[bookmarks.length - 1].created_at || Date.now(),
                ).getTime()) /
                dayMs,
            )
          : 1,
      );
      break;
  }

  // 统计每天的收藏数
  const dailyCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();

  for (const bookmark of bookmarks) {
    if (!bookmark.created_at) continue;
    const date = new Date(bookmark.created_at || Date.now());
    const dateKey = date.toISOString().split("T")[0];
    const hour = date.getHours();

    dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }

  // 找出最活跃的日期和时段
  let mostActiveDay = "";
  let maxDayCount = 0;
  for (const [day, count] of dailyCounts) {
    if (count > maxDayCount) {
      maxDayCount = count;
      mostActiveDay = day;
    }
  }

  let mostActiveHour = 0;
  let maxHourCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > maxHourCount) {
      maxHourCount = count;
      mostActiveHour = hour;
    }
  }

  return {
    totalBookmarks: bookmarks.length,
    newBookmarks: bookmarks.length,
    dailyAverage: bookmarks.length / rangeDays,
    mostActiveDay,
    mostActiveHour,
    activeDays: dailyCounts.size,
  };
}

// ============================================
// 内容分析
// ============================================

/**
 * 分析收藏内容分布
 *
 * @param bookmarks - 书签数据
 * @returns 内容分析结果
 */
export function analyzeContent(bookmarks: BookmarkRow[]): ContentAnalysis {
  const total = bookmarks.length;

  // 平台分布
  const platformCounts = new Map<string, number>();
  for (const b of bookmarks) {
    if (!b.created_at) continue;
    platformCounts.set(b.platform, (platformCounts.get(b.platform) || 0) + 1);
  }

  const byPlatform: DistributionItem[] = Array.from(platformCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: (count / total) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  // 文件夹分布
  const folderCounts = new Map<string, number>();
  for (const b of bookmarks) {
    if (!b.created_at) continue;
    const folderName = getFolderName(b) || "未分类";
    folderCounts.set(folderName, (folderCounts.get(folderName) || 0) + 1);
  }

  const byFolder: DistributionItem[] = Array.from(folderCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      percentage: (count / total) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  // 热门标签
  const tagCounts = new Map<string, number>();
  for (const b of bookmarks) {
    if (!b.created_at) continue;
    const tags = [...(b.user_tags || [])];
    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const topTags: TopItem[] = Array.from(tagCounts.entries())
    .map(([name, count], index) => ({
      name,
      count,
      rank: index + 1,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  // AI 标签分布
  const aiTagCounts = new Map<string, number>();
  for (const b of bookmarks) {
    if (!b.created_at) continue;
    const aiTags = b.ai_tags || [];
    for (const tag of aiTags) {
      aiTagCounts.set(tag, (aiTagCounts.get(tag) || 0) + 1);
    }
  }

  const topAiTags: TopItem[] = Array.from(aiTagCounts.entries())
    .map(([name, count], index) => ({
      name,
      count,
      rank: index + 1,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  // 评分统计
  const ratedBookmarks = bookmarks.filter((b) => b.rating !== null);
  const ratedRate = ratedBookmarks.length / total;
  const averageRating =
    ratedBookmarks.length > 0
      ? ratedBookmarks.reduce((sum, b) => sum + (b.rating || 0), 0) /
        ratedBookmarks.length
      : null;

  return {
    byPlatform,
    byFolder,
    topTags,
    topAiTags,
    summaryRate: 0, // 需要 ai_summary 字段，暂时设为 0
    ratedRate,
    averageRating,
  };
}

// ============================================
// 趋势分析
// ============================================

/**
 * 分析收藏趋势变化
 *
 * @param bookmarks - 书签数据
 * @param input - 报告输入参数
 * @returns 趋势分析结果
 */
export function analyzeTrends(
  bookmarks: BookmarkRow[],
  input: InsightReportInput,
): TrendAnalysis {
  // 按时间粒度分组
  const granularity =
    input.timeRange === "week"
      ? "day"
      : input.timeRange === "month"
        ? "day"
        : "week";

  const trendData = new Map<string, number>();

  for (const b of bookmarks) {
    if (!b.created_at) continue;
    const date = new Date(b.created_at || Date.now());
    let key: string;

    if (granularity === "day") {
      key = date.toISOString().split("T")[0];
    } else {
      // 按周分组
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split("T")[0];
    }

    trendData.set(key, (trendData.get(key) || 0) + 1);
  }

  // 转换为趋势数据点
  const bookmarkTrend: TrendDataPoint[] = Array.from(trendData.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value], index, arr) => {
      const prevValue = index > 0 ? arr[index - 1][1] : value;
      const changeRate =
        prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : 0;
      return { label, value, changeRate };
    });

  // 平台趋势（简化实现）
  const platformTrend: Record<string, TrendDataPoint[]> = {};

  // 标签趋势（简化实现）
  const tagTrend = {
    rising: [] as TopItem[],
    declining: [] as TopItem[],
  };

  // 生成趋势摘要
  const totalChange =
    bookmarkTrend.length >= 2
      ? bookmarkTrend[bookmarkTrend.length - 1].value - bookmarkTrend[0].value
      : 0;

  const summary =
    totalChange > 0
      ? `收藏量呈上升趋势，期末比期初增加了 ${totalChange} 条`
      : totalChange < 0
        ? `收藏量有所下降，期末比期初减少了 ${Math.abs(totalChange)} 条`
        : "收藏量保持稳定";

  return {
    bookmarkTrend,
    platformTrend,
    tagTrend,
    summary,
  };
}
