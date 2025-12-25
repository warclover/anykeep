/**
 * 统计数据收集模块
 *
 * @module ai-skills/periodic-report/collectors/stats-collector
 * @version 1.0.0
 * @since 2025-12-25
 */

import { PERIOD_CONFIG, type PeriodStats, type ReportPeriod } from "../types";
import type { BookmarkRow } from "./types";

// ============================================
// 统计计算
// ============================================

/**
 * 计算周期统计数据
 */
export function calculateStats(
  bookmarks: BookmarkRow[],
  period: ReportPeriod,
): PeriodStats {
  const periodDays = PERIOD_CONFIG[period].days;

  // 统计每天的收藏
  const dailyCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();

  for (const bookmark of bookmarks) {
    const date = new Date(bookmark.created_at);
    const dateKey = date.toISOString().split("T")[0];
    const hour = date.getHours();

    dailyCounts.set(dateKey, (dailyCounts.get(dateKey) || 0) + 1);
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }

  // 找出最活跃的日期
  let mostActiveDay = "";
  let maxDayCount = 0;
  for (const [day, count] of dailyCounts) {
    if (count > maxDayCount) {
      maxDayCount = count;
      mostActiveDay = day;
    }
  }

  // 找出最活跃的时段
  let mostActiveHour = 0;
  let maxHourCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > maxHourCount) {
      maxHourCount = count;
      mostActiveHour = hour;
    }
  }

  // 估算阅读时长（假设每条收藏平均阅读 5 分钟）
  const estimatedReadingTime = bookmarks.length * 5;

  return {
    newBookmarks: bookmarks.length,
    activeDays: dailyCounts.size,
    dailyAverage: bookmarks.length / periodDays,
    estimatedReadingTime,
    mostActiveDay,
    mostActiveHour,
  };
}
