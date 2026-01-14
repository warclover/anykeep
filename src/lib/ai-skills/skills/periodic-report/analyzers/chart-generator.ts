/**
 * 图表数据生成模块
 *
 * @module ai-skills/periodic-report/analyzers/chart-generator
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { ChartData, ChartDataPoint } from "../types";
import type { BookmarkRow } from "../collectors/types";

// ============================================
// 图表数据生成
// ============================================

/**
 * 生成各类图表数据
 */
export function generateChartData(bookmarks: BookmarkRow[]): ChartData {
  // 收藏趋势
  const trendData = new Map<string, number>();
  for (const b of bookmarks) {
    const date = new Date(b.created_at || Date.now())
      .toISOString()
      .split("T")[0];
    trendData.set(date, (trendData.get(date) || 0) + 1);
  }

  const bookmarkTrend: ChartDataPoint[] = Array.from(trendData.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));

  // 平台分布
  const platformData = new Map<string, number>();
  for (const b of bookmarks) {
    platformData.set(b.platform, (platformData.get(b.platform) || 0) + 1);
  }

  const platformDistribution: ChartDataPoint[] = Array.from(
    platformData.entries(),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  // 标签分布
  const tagData = new Map<string, number>();
  for (const b of bookmarks) {
    const tags = [...(b.user_tags || []), ...(b.ai_tags || [])];
    for (const tag of tags) {
      tagData.set(tag, (tagData.get(tag) || 0) + 1);
    }
  }

  const tagDistribution: ChartDataPoint[] = Array.from(tagData.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }));

  // 时段分布
  const hourData = new Map<number, number>();
  for (const b of bookmarks) {
    const hour = new Date(b.created_at || Date.now()).getHours();
    hourData.set(hour, (hourData.get(hour) || 0) + 1);
  }

  const hourlyDistribution: ChartDataPoint[] = Array.from(hourData.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, value]) => ({
      label: `${hour}:00`,
      value,
    }));

  return {
    bookmarkTrend,
    platformDistribution,
    tagDistribution,
    hourlyDistribution,
  };
}
