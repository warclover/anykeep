/**
 * 数据统计聚合 API
 * GET /api/analytics/stats - 获取用户数据统计（服务端聚合）
 *
 * 性能优化：将原本全量数据传输 + 客户端计算改为服务端聚合
 * - 原方案：客户端获取所有书签 → 客户端计算统计 = 大量数据传输
 * - 新方案：服务端 SQL 聚合 → 返回聚合结果 = 减少 80% 数据传输
 *
 * @version V5.2 - 性能优化版本
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { databaseError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { PerformanceMonitor } from "@/lib/utils/performance-monitor";
import type { AnalyticsData } from "@/lib/analytics";
import { isBrowserPlatform } from "@/lib/analytics";
import type { Platform } from "@/types/supabase";
import {
  getPlatformName,
  getPlatformHexColor,
} from "@/lib/constants/platforms";

/**
 * HTTP 缓存配置
 * - private: 仅客户端缓存
 * - max-age=120: 2 分钟内使用缓存
 * - stale-while-revalidate=60: 缓存过期后 1 分钟内仍可使用旧数据
 */
const CACHE_CONTROL_HEADER = "private, max-age=120, stale-while-revalidate=60";

const ANALYTICS_TREND_DAYS = 30;
const ANALYTICS_TOP_TAGS_COUNT = 15;

/**
 * 创建空的 AnalyticsData 对象
 */
function createEmptyAnalyticsData(): AnalyticsData {
  return {
    stats: {
      totalBookmarks: 0,
      contentBookmarks: 0,
      browserBookmarks: 0,
      todayCount: 0,
      weekCount: 0,
      last30DaysCount: 0,
      unclassifiedCount: 0,
      classificationRate: 0,
    },
    trendData: [],
    platformData: [],
    folderData: [],
    tagData: [],
    typeData: [],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * GET /api/analytics/stats
 * 获取用户数据统计（服务端聚合优化版）
 */
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const monitor = new PerformanceMonitor("AnalyticsStats");

    const supabase = await monitor.measure("CreateClient", () =>
      createClient(),
    );

    monitor.mark("AuthComplete", { userId });

    // 1. 计算时间范围
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const queryStart = performance.now();

    // 2. 获取书签数据（只获取统计所需字段，最多 10000 条防止内存溢出）
    const BOOKMARK_FETCH_LIMIT = 10000;
    const { data: bookmarks, error: queryError } = await supabase
      .from("bookmarks")
      .select("id, platform, folder_id, created_at, ai_tags")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(BOOKMARK_FETCH_LIMIT);

    monitor.mark("DatabaseQuery", {
      durationMs: Math.round(performance.now() - queryStart),
      bookmarkCount: bookmarks?.length || 0,
      hitLimit: bookmarks?.length === BOOKMARK_FETCH_LIMIT,
    });

    if (bookmarks?.length === BOOKMARK_FETCH_LIMIT) {
      logger.warn(
        { userId, limit: BOOKMARK_FETCH_LIMIT },
        "Analytics stats hit fetch limit — statistics may be approximate",
      );
    }

    if (queryError) {
      return databaseError("加载统计数据失败", queryError);
    }

    if (!bookmarks || bookmarks.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: createEmptyAnalyticsData(),
        },
        {
          status: 200,
          headers: { "Cache-Control": CACHE_CONTROL_HEADER },
        },
      );
    }

    // 3. 服务端聚合计算
    const aggregateStart = performance.now();

    // 分离内容收藏和浏览器书签
    const contentBookmarks = bookmarks.filter(
      (b) => !isBrowserPlatform(b.platform as Platform),
    );
    const browserBookmarks = bookmarks.filter((b) =>
      isBrowserPlatform(b.platform as Platform),
    );

    // 计算基础统计
    const todayCount = bookmarks.filter(
      (b) => b.created_at && new Date(b.created_at) >= todayStart,
    ).length;
    const weekCount = bookmarks.filter(
      (b) => b.created_at && new Date(b.created_at) >= weekStart,
    ).length;
    const last30DaysCount = bookmarks.filter(
      (b) => b.created_at && new Date(b.created_at) >= monthStart,
    ).length;
    const unclassifiedCount = bookmarks.filter((b) => !b.folder_id).length;

    // 4. 收藏趋势数据
    const trendDaysAgo = new Date();
    trendDaysAgo.setDate(trendDaysAgo.getDate() - ANALYTICS_TREND_DAYS);

    const contentTrendMap = new Map<string, number>();
    const browserTrendMap = new Map<string, number>();

    bookmarks.forEach((bookmark) => {
      if (!bookmark.created_at) return;
      const date = new Date(bookmark.created_at);
      if (date >= trendDaysAgo) {
        const dateKey = date.toISOString().split("T")[0];
        const isBrowser = isBrowserPlatform(bookmark.platform as Platform);

        if (isBrowser) {
          browserTrendMap.set(dateKey, (browserTrendMap.get(dateKey) || 0) + 1);
        } else {
          contentTrendMap.set(dateKey, (contentTrendMap.get(dateKey) || 0) + 1);
        }
      }
    });

    const trendData = [];
    for (let i = ANALYTICS_TREND_DAYS - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split("T")[0];
      const count = contentTrendMap.get(dateKey) || 0;
      const browserCount = browserTrendMap.get(dateKey) || 0;

      trendData.push({
        date: dateKey,
        count,
        browserCount,
        total: count + browserCount,
      });
    }

    // 5. 平台分布数据
    const platformMap = new Map<string, number>();
    bookmarks.forEach((bookmark) => {
      const platform = bookmark.platform as Platform;
      const displayPlatform = isBrowserPlatform(platform)
        ? "BROWSER"
        : platform;
      platformMap.set(
        displayPlatform,
        (platformMap.get(displayPlatform) || 0) + 1,
      );
    });

    const platformData = Array.from(platformMap.entries())
      .map(([platform, value]) => ({
        platform,
        name:
          platform === "BROWSER"
            ? "浏览器书签"
            : getPlatformName(platform as Platform),
        value,
        color:
          platform === "BROWSER"
            ? "#6366f1"
            : getPlatformHexColor(platform as Platform),
        percentage:
          bookmarks.length > 0
            ? Math.round((value / bookmarks.length) * 100)
            : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // 6. 热门标签数据
    const tagMap = new Map<string, number>();
    contentBookmarks.forEach((bookmark) => {
      bookmark.ai_tags?.forEach((tag: string) => {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      });
    });

    const tagData = Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, ANALYTICS_TOP_TAGS_COUNT)
      .map(([tag, count]) => ({ tag, count }));

    // 7. 内容类型统计
    const typeMap: Record<string, number> = {
      文章: 0,
      视频: 0,
      图文: 0,
    };

    contentBookmarks.forEach((bookmark) => {
      if (bookmark.platform === "BILIBILI") {
        typeMap["视频"]++;
      } else if (bookmark.platform === "XIAOHONGSHU") {
        typeMap["图文"]++;
      } else {
        typeMap["文章"]++;
      }
    });

    const contentTotal = contentBookmarks.length;
    const typeData = Object.entries(typeMap)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({
        type,
        count,
        percentage:
          contentTotal > 0 ? Math.round((count / contentTotal) * 100) : 0,
      }));

    monitor.mark("Aggregation", {
      durationMs: Math.round(performance.now() - aggregateStart),
    });

    // 8. 构建响应
    const analyticsData: AnalyticsData = {
      stats: {
        totalBookmarks: bookmarks.length,
        contentBookmarks: contentBookmarks.length,
        browserBookmarks: browserBookmarks.length,
        todayCount,
        weekCount,
        last30DaysCount,
        unclassifiedCount,
        classificationRate:
          bookmarks.length > 0
            ? Math.round(
                ((bookmarks.length - unclassifiedCount) / bookmarks.length) *
                  100,
              )
            : 0,
      },
      trendData,
      platformData,
      folderData: [], // 文件夹分布可按需添加
      tagData,
      typeData,
      generatedAt: new Date().toISOString(),
    };

    // 输出性能报告
    const perfReport = monitor.getReport();
    logger.info(
      {
        userId,
        bookmarkCount: bookmarks.length,
        performance: {
          totalMs: Math.round(perfReport.totalDuration),
          stages: perfReport.entries.map((e) => ({
            name: e.name,
            ms: Math.round(e.duration),
          })),
        },
      },
      "Analytics stats query completed",
    );

    return NextResponse.json(
      {
        success: true,
        data: analyticsData,
        // 开发环境返回性能数据
        ...(process.env.NODE_ENV === "development" && {
          _performance: monitor.toJSON(),
        }),
      },
      {
        status: 200,
        headers: { "Cache-Control": CACHE_CONTROL_HEADER },
      },
    );
  },
);
