/**
 * Collector 模块索引
 *
 * @module ai-skills/periodic-report/collectors
 * @version 1.0.0
 * @since 2025-12-25
 */

// 类型导出
export type {
  BookmarkRow,
  DateRange,
  PeriodDateRanges,
  DataFilter,
} from "./types";

// 数据收集
export { calculateDateRanges, fetchBookmarks } from "./data-collector";

// 统计收集
export { calculateStats } from "./stats-collector";
