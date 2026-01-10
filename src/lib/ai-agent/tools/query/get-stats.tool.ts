/**
 * get_stats Tool
 *
 * 获取用户的收藏统计信息
 * 包括总览、趋势、标签分布等
 *
 * @version 1.3.0 - 添加 timeRange 参数支持
 * @since 2025-12-23
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { QUERY_TOOL_DESCRIPTIONS } from "../tool-description-templates";
import {
  timeRangeSchema,
  applyTimeRangeFilter,
  getTimeRangeLabel,
  type TimeRangeValue,
} from "../shared/time-range.utils";

// ============================================
// 常量
// ============================================

/** 浏览器平台列表（与 bookmark-server.repository.ts 保持一致） */
const BROWSER_PLATFORMS = [
  "BROWSER_CHROME",
  "BROWSER_EDGE",
  "BROWSER_FIREFOX",
  "BROWSER_SAFARI",
];

// ============================================
// 参数定义
// ============================================

const paramsSchema = z.object({
  include_trends: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否包含收藏趋势数据（最近30天）"),
  include_tags: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否包含热门标签统计"),
  include_platforms: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否包含平台分布统计"),
  tags_limit: z
    .number()
    .int()
    .min(5)
    .max(50)
    .optional()
    .default(20)
    .describe("返回的热门标签数量"),
  timeRange: timeRangeSchema,
});

type StatsParams = z.infer<typeof paramsSchema>;

// ============================================
// 结果类型
// ============================================

interface OverviewStats {
  /** 总书签数 */
  totalBookmarks: number;
  /** 总文件夹数 */
  totalFolders: number;
  /** 总标签数（去重后） */
  totalTags: number;
  /** 有评分的书签数 */
  ratedBookmarks: number;
  /** 平均评分 */
  averageRating?: number;
}

interface TrendPoint {
  date: string;
  count: number;
}

interface TrendsStats {
  /** 最近7天新增 */
  last7Days: number;
  /** 最近30天新增 */
  last30Days: number;
  /** 每日新增趋势 */
  dailyTrend: TrendPoint[];
}

interface TagStats {
  name: string;
  count: number;
}

interface PlatformStats {
  platform: string;
  count: number;
  percentage: number;
}

interface StatsResult {
  /** 总览统计 */
  overview: OverviewStats;
  /** 收藏趋势 */
  trends?: TrendsStats;
  /** 热门标签 */
  topTags?: TagStats[];
  /** 平台分布 */
  platforms?: PlatformStats[];
  /** 统计时间范围 */
  timeRange: TimeRangeValue;
  /** 时间范围标签 */
  timeRangeLabel: string;
}

// ============================================
// Tool 实现
// ============================================

export const getStatsTool: Tool<StatsParams, StatsResult> = {
  definition: {
    name: "get_stats",
    description: QUERY_TOOL_DESCRIPTIONS.get_stats,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 1000,
  },

  async execute(
    params: StatsParams,
    context: ToolContext,
  ): Promise<ToolResult<StatsResult>> {
    const startTime = performance.now();
    const supabase = await createClient();
    const {
      include_trends = true,
      include_tags = true,
      include_platforms = true,
      tags_limit = 20,
    } = params;
    const timeRange = params.timeRange ?? "all";

    // 并行查询基础数据（排除浏览器书签）
    const browserFilter = `(${BROWSER_PLATFORMS.map((p) => `"${p}"`).join(",")})`;

    // 构建基础查询并应用时间范围过滤
    let bookmarksQuery = supabase
      .from("bookmarks")
      .select("id, platform, user_tags, rating, created_at")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .not("platform", "in", browserFilter);
    bookmarksQuery = applyTimeRangeFilter(bookmarksQuery, timeRange);

    let ratedQuery = supabase
      .from("bookmarks")
      .select("rating")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .not("platform", "in", browserFilter)
      .not("rating", "is", null);
    ratedQuery = applyTimeRangeFilter(ratedQuery, timeRange);

    const [bookmarksResult, foldersResult, ratedResult] = await Promise.all([
      // 获取所有内容书签（排除浏览器书签）
      bookmarksQuery,
      // 获取文件夹数量
      supabase
        .from("folders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId),
      // 获取有评分的书签（排除浏览器书签）
      ratedQuery,
    ]);

    if (bookmarksResult.error) {
      logger.error(
        {
          toolName: "get_stats",
          userId: context.userId,
          error: bookmarksResult.error.message,
        },
        "get_stats: DB Error",
      );

      return {
        success: false,
        error: bookmarksResult.error.message,
        errorCode: "DB_ERROR",
      };
    }

    const bookmarks = bookmarksResult.data || [];
    const totalBookmarks = bookmarks.length;
    const totalFolders = foldersResult.count || 0;

    // 统计标签
    const tagCounts = new Map<string, number>();
    for (const bookmark of bookmarks) {
      for (const tag of bookmark.user_tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    const totalTags = tagCounts.size;

    // 统计评分
    const ratedBookmarks = ratedResult.data?.length || 0;
    const ratings =
      ratedResult.data
        ?.map((b) => b.rating)
        .filter((r): r is number => r != null) || [];
    const averageRating =
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10,
          ) / 10
        : undefined;

    // 构建总览
    const overview: OverviewStats = {
      totalBookmarks,
      totalFolders,
      totalTags,
      ratedBookmarks,
      averageRating,
    };

    const result: StatsResult = {
      overview,
      timeRange,
      timeRangeLabel: getTimeRangeLabel(timeRange),
    };

    // 收藏趋势
    if (include_trends) {
      const now = new Date();
      const last7DaysDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30DaysDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // 计算每日新增
      const dailyMap = new Map<string, number>();
      let last7Days = 0;
      let last30Days = 0;

      for (const bookmark of bookmarks) {
        if (!bookmark.created_at) continue;
        const createdAt = new Date(bookmark.created_at);
        const dateKey = createdAt.toISOString().split("T")[0];

        if (createdAt >= last30DaysDate) {
          last30Days++;
          dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);

          if (createdAt >= last7DaysDate) {
            last7Days++;
          }
        }
      }

      // 生成30天趋势数据
      const dailyTrend: TrendPoint[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split("T")[0];
        dailyTrend.push({
          date: dateKey,
          count: dailyMap.get(dateKey) || 0,
        });
      }

      result.trends = {
        last7Days,
        last30Days,
        dailyTrend,
      };
    }

    // 热门标签
    if (include_tags) {
      result.topTags = Array.from(tagCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, tags_limit);
    }

    // 平台分布
    if (include_platforms) {
      const platformCounts = new Map<string, number>();
      for (const bookmark of bookmarks) {
        const platform = bookmark.platform || "OTHER";
        platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1);
      }

      result.platforms = Array.from(platformCounts.entries())
        .map(([platform, count]) => ({
          platform,
          count,
          percentage:
            totalBookmarks > 0
              ? Math.round((count / totalBookmarks) * 1000) / 10
              : 0,
        }))
        .sort((a, b) => b.count - a.count);
    }

    logger.info(
      {
        toolName: "get_stats",
        userId: context.userId,
        totalBookmarks,
        totalFolders,
        totalTags,
        timeRange,
        includeTrends: include_trends,
        includeTags: include_tags,
        includePlatforms: include_platforms,
        executionTimeMs: Math.round(performance.now() - startTime),
      },
      "get_stats: Success",
    );

    return {
      success: true,
      data: result,
      metadata: {
        executionTimeMs: Math.round(performance.now() - startTime),
        affectedCount: totalBookmarks,
      },
    };
  },
};
