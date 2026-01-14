/**
 * Collector 模块内部类型定义
 *
 * @module ai-skills/periodic-report/collectors/types
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { BookmarkRow as BookmarkRowBase } from "@/types/domain";

/**
 * 书签行数据（数据库查询结果）- 扩展统一类型
 */
export type BookmarkRow = Pick<
  BookmarkRowBase,
  | "id"
  | "title"
  | "url"
  | "platform"
  | "ai_tags"
  | "ai_summary"
  | "user_tags"
  | "rating"
  | "folder_id"
  | "created_at"
> & {
  folders?: Array<{ name: string }> | { name: string } | null;
};

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
