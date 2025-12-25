/**
 * 周期对比分析模块
 *
 * @module ai-skills/periodic-report/analyzers/comparison-analyzer
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { PeriodComparison } from "../types";
import type { BookmarkRow, DateRange } from "../collectors/types";

// ============================================
// 周期对比
// ============================================

/**
 * 计算两个周期的对比数据
 */
export function calculateComparison(
  current: BookmarkRow[],
  previous: BookmarkRow[],
  currentRange: DateRange,
  previousRange: DateRange,
): PeriodComparison {
  const currentCount = current.length;
  const previousCount = previous.length;

  const bookmarksChangeRate =
    previousCount > 0
      ? ((currentCount - previousCount) / previousCount) * 100
      : currentCount > 0
        ? 100
        : 0;

  // 计算平台变化
  const currentPlatforms = new Map<string, number>();
  const previousPlatforms = new Map<string, number>();

  for (const b of current) {
    currentPlatforms.set(
      b.platform,
      (currentPlatforms.get(b.platform) || 0) + 1,
    );
  }
  for (const b of previous) {
    previousPlatforms.set(
      b.platform,
      (previousPlatforms.get(b.platform) || 0) + 1,
    );
  }

  const allPlatforms = new Set([
    ...currentPlatforms.keys(),
    ...previousPlatforms.keys(),
  ]);
  const platformChanges = Array.from(allPlatforms).map((platform) => {
    const curr = currentPlatforms.get(platform) || 0;
    const prev = previousPlatforms.get(platform) || 0;
    const changeRate =
      prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0;
    return { platform, current: curr, previous: prev, changeRate };
  });

  // 活跃度对比（基于不同日期的收藏数）
  const currentActiveDays = new Set(
    current.map((b) => new Date(b.created_at).toISOString().split("T")[0]),
  ).size;
  const previousActiveDays = new Set(
    previous.map((b) => new Date(b.created_at).toISOString().split("T")[0]),
  ).size;

  const activityChangeRate =
    previousActiveDays > 0
      ? ((currentActiveDays - previousActiveDays) / previousActiveDays) * 100
      : currentActiveDays > 0
        ? 100
        : 0;

  return {
    currentPeriod: `${new Date(currentRange.start).toLocaleDateString("zh-CN")} - ${new Date(currentRange.end).toLocaleDateString("zh-CN")}`,
    previousPeriod: `${new Date(previousRange.start).toLocaleDateString("zh-CN")} - ${new Date(previousRange.end).toLocaleDateString("zh-CN")}`,
    bookmarksChange: {
      current: currentCount,
      previous: previousCount,
      changeRate: bookmarksChangeRate,
      trend:
        bookmarksChangeRate > 5
          ? "up"
          : bookmarksChangeRate < -5
            ? "down"
            : "stable",
    },
    activityChange: {
      current: currentActiveDays,
      previous: previousActiveDays,
      changeRate: activityChangeRate,
      trend:
        activityChangeRate > 5
          ? "up"
          : activityChangeRate < -5
            ? "down"
            : "stable",
    },
    platformChanges: platformChanges.slice(0, 5),
  };
}
