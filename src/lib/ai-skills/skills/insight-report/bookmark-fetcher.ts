/**
 * 书签数据获取模块
 *
 * 提供洞察报告所需的书签数据获取功能
 *
 * @module insight-report/bookmark-fetcher
 * @version 1.0.0
 * @since 2025-12-25
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { InsightReportInput, ReportTimeRange, BookmarkRow } from "./types";

// ============================================
// 时间范围处理
// ============================================

/**
 * 获取时间范围的描述文本
 *
 * @param timeRange - 时间范围类型
 * @returns 时间范围描述
 */
export function getTimeRangeDescription(timeRange: ReportTimeRange): string {
  const now = new Date();
  switch (timeRange) {
    case "week": {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return `${weekAgo.toLocaleDateString("zh-CN")} - ${now.toLocaleDateString("zh-CN")}`;
    }
    case "month": {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return `${monthAgo.toLocaleDateString("zh-CN")} - ${now.toLocaleDateString("zh-CN")}`;
    }
    case "quarter": {
      const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return `${quarterAgo.toLocaleDateString("zh-CN")} - ${now.toLocaleDateString("zh-CN")}`;
    }
    case "year": {
      return `${now.getFullYear()} 年度`;
    }
    case "all":
      return "全部时间";
  }
}

/**
 * 计算时间范围的起始日期
 *
 * @param timeRange - 时间范围类型
 * @returns 起始日期或 null（表示全部时间）
 */
export function getStartDateForRange(timeRange: ReportTimeRange): Date | null {
  const now = new Date();

  switch (timeRange) {
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "quarter":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
      return null;
  }
}

// ============================================
// 书签数据获取
// ============================================

/**
 * 获取用于报告分析的书签数据
 *
 * @param userId - 用户 ID
 * @param input - 报告输入参数
 * @returns 书签数据列表
 */
export async function fetchBookmarks(
  userId: string,
  input: InsightReportInput,
): Promise<BookmarkRow[]> {
  const supabase = await createClient();

  // 计算时间范围
  const startDate = getStartDateForRange(input.timeRange);

  let query = supabase
    .from("bookmarks")
    .select(
      `
      id,
      title,
      url,
      platform,
      ai_tags,
      user_tags,
      rating,
      folder_id,
      created_at,
      folders(name)
    `,
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (startDate) {
    query = query.gte("created_at", startDate.toISOString());
  }

  if (input.filter?.folderId) {
    query = query.eq("folder_id", input.filter.folderId);
  }

  if (input.filter?.platforms?.length) {
    query = query.in("platform", input.filter.platforms);
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ error }, "InsightReportSkill: Failed to fetch bookmarks");
    throw new Error(`获取收藏数据失败: ${error.message}`);
  }

  return (data || []) as BookmarkRow[];
}
