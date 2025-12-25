/**
 * Collector 模块内部类型定义
 *
 * @module ai-skills/periodic-report/collectors/types
 * @version 1.0.0
 * @since 2025-12-25
 */

/**
 * 书签行数据（数据库查询结果）
 */
export interface BookmarkRow {
  id: number;
  title: string;
  url: string;
  platform: string;
  ai_tags: string[] | null;
  ai_summary: string | null;
  user_tags: string[] | null;
  rating: number | null;
  folder_id: number | null;
  created_at: string;
  folders?: Array<{ name: string }> | { name: string } | null;
}

/**
 * 日期范围
 */
export interface DateRange {
  start: string;
  end: string;
}

/**
 * 周期日期范围组合
 */
export interface PeriodDateRanges {
  currentPeriod: DateRange;
  previousPeriod: DateRange;
}

/**
 * 数据筛选条件
 */
export interface DataFilter {
  folderId?: number;
  platforms?: string[];
  tags?: string[];
}
