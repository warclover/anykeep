/**
 * 数据收集模块
 *
 * @module ai-skills/periodic-report/collectors/data-collector
 * @version 1.0.0
 * @since 2025-12-25
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { PERIOD_CONFIG, type ReportPeriod } from "../types";
import type {
  BookmarkRow,
  DateRange,
  PeriodDateRanges,
  DataFilter,
} from "./types";

// ============================================
// 日期范围计算
// ============================================

/**
 * 计算当前周期和上一周期的日期范围
 */
export function calculateDateRanges(period: ReportPeriod): PeriodDateRanges {
  const now = new Date();
  const config = PERIOD_CONFIG[period];
  const dayMs = 24 * 60 * 60 * 1000;

  const currentEnd = now;
  const currentStart = new Date(now.getTime() - config.days * dayMs);

  const previousEnd = new Date(currentStart.getTime() - dayMs);
  const previousStart = new Date(previousEnd.getTime() - config.days * dayMs);

  return {
    currentPeriod: {
      start: currentStart.toISOString(),
      end: currentEnd.toISOString(),
    },
    previousPeriod: {
      start: previousStart.toISOString(),
      end: previousEnd.toISOString(),
    },
  };
}

// ============================================
// 书签数据获取
// ============================================

/**
 * 获取指定日期范围内的收藏书签
 */
export async function fetchBookmarks(
  userId: string,
  dateRange: DateRange,
  filter?: DataFilter,
): Promise<BookmarkRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("bookmarks")
    .select(
      `
      id,
      title,
      url,
      platform,
      ai_tags,
      ai_summary,
      user_tags,
      rating,
      folder_id,
      created_at,
      folders(name)
    `,
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", dateRange.start)
    .lte("created_at", dateRange.end)
    .order("created_at", { ascending: false });

  if (filter?.folderId) {
    query = query.eq("folder_id", filter.folderId);
  }

  if (filter?.platforms?.length) {
    query = query.in("platform", filter.platforms);
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ error }, "PeriodicReportSkill: Failed to fetch bookmarks");
    throw new Error(`获取收藏数据失败: ${error.message}`);
  }

  return (data || []) as BookmarkRow[];
}
