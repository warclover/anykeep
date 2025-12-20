/**
 * Analytics 服务层
 * 统一管理所有统计数据的查询和计算
 *
 * @module lib/analytics/analytics.service
 * @version 1.0.0
 */

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Platform, Bookmark } from "@/types/supabase";
import {
  getPlatformName,
  getPlatformHexColor,
} from "@/lib/constants/platforms";
import type {
  AnalyticsStats,
  TrendDataItem,
  PlatformDistribution,
  FolderDistribution,
  TagStats,
  ContentTypeStats,
  PeriodComparison,
  TimeComparison,
  AIProcessingStats,
  AnalyticsData,
  AnalyticsConfig,
} from "./types";
import { isBrowserPlatform, DEFAULT_ANALYTICS_CONFIG } from "./types";

// ============================================================================
// AnalyticsService 类
// ============================================================================

export class AnalyticsService {
  private supabase: SupabaseClient;
  private userId: string;
  private config: AnalyticsConfig;

  constructor(
    supabase: SupabaseClient,
    userId: string,
    config: Partial<AnalyticsConfig> = {},
  ) {
    this.supabase = supabase;
    this.userId = userId;
    this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config };
  }

  // ==========================================================================
  // 主要方法
  // ==========================================================================

  /**
   * 获取完整分析数据
   */
  async getFullAnalytics(): Promise<AnalyticsData> {
    // 并行获取所有数据
    const [allBookmarks, folders, classificationStats] = await Promise.all([
      this.fetchAllBookmarks(),
      this.fetchFolders(),
      this.config.includeAIStats ? this.fetchClassificationStats() : null,
    ]);

    // 分离内容收藏和浏览器书签
    const contentBookmarks = allBookmarks.filter(
      (b) => !isBrowserPlatform(b.platform as Platform),
    );
    const browserBookmarks = allBookmarks.filter((b) =>
      isBrowserPlatform(b.platform as Platform),
    );

    // 计算各项统计
    const stats = this.calculateStats(
      allBookmarks,
      contentBookmarks,
      browserBookmarks,
    );
    const trendData = this.calculateTrendData(allBookmarks);
    const platformData = this.calculatePlatformDistribution(allBookmarks);
    const folderData = this.calculateFolderDistribution(allBookmarks, folders);
    const tagData = this.calculateTagStats(contentBookmarks);
    const typeData = this.calculateTypeStats(contentBookmarks);

    const result: AnalyticsData = {
      stats,
      trendData,
      platformData,
      folderData,
      tagData,
      typeData,
      generatedAt: new Date().toISOString(),
    };

    // 可选：时间对比
    if (this.config.includeComparison) {
      result.comparison = this.calculateComparison(allBookmarks);
    }

    // 可选：AI 处理统计
    if (this.config.includeAIStats && classificationStats) {
      result.aiStats = classificationStats;
    }

    return result;
  }

  // ==========================================================================
  // 数据获取方法
  // ==========================================================================

  private async fetchAllBookmarks(): Promise<Bookmark[]> {
    // 分页获取所有书签（Supabase 默认限制 1000 行）
    // 为确保统计数据准确，需要获取所有书签
    const allBookmarks: Bookmark[] = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", this.userId)
        .is("deleted_at", null)
        .eq("is_in_trash", false)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(`Failed to fetch bookmarks: ${error.message}`);
      }

      if (data && data.length > 0) {
        allBookmarks.push(...(data as Bookmark[]));
        offset += data.length;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allBookmarks;
  }

  private async fetchFolders(): Promise<{ id: number; name: string }[]> {
    const { data, error } = await this.supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", this.userId)
      .eq("is_archived", false);

    if (error) {
      throw new Error(`Failed to fetch folders: ${error.message}`);
    }

    return data || [];
  }

  private async fetchClassificationStats(): Promise<AIProcessingStats> {
    // 获取分类建议统计
    const { data: suggestions } = await this.supabase
      .from("classification_suggestions")
      .select("status")
      .eq("user_id", this.userId);

    const total = suggestions?.length || 0;
    const accepted =
      suggestions?.filter((s) => s.status === "accepted").length || 0;
    const rejected =
      suggestions?.filter((s) => s.status === "rejected").length || 0;
    const processed = accepted + rejected;

    return {
      summaryCount: 0, // TODO: 从其他表获取
      tagCount: 0, // TODO: 从其他表获取
      classificationCount: total,
      classificationAcceptRate:
        processed > 0 ? Math.round((accepted / processed) * 100) : 0,
      classificationRejectRate:
        processed > 0 ? Math.round((rejected / processed) * 100) : 0,
    };
  }

  // ==========================================================================
  // 统计计算方法
  // ==========================================================================

  /**
   * 获取北京时间（UTC+8）某一天开始的 UTC 时间戳
   * 服务端在 Vercel 上默认使用 UTC 时区，需要手动调整为用户时区（中国用户）
   *
   * @param daysAgo - 几天前（0 = 今天）
   * @returns UTC 时间点，对应北京时间该日 00:00:00
   */
  private getDayStartInBeijingTime(daysAgo: number = 0): Date {
    const now = new Date();
    // 北京时间偏移量（UTC+8）
    const beijingOffsetMs = 8 * 60 * 60 * 1000;

    // 计算当前北京时间
    const beijingNow = new Date(now.getTime() + beijingOffsetMs);

    // 获取北京时间的日期部分（年月日）
    const year = beijingNow.getUTCFullYear();
    const month = beijingNow.getUTCMonth();
    const day = beijingNow.getUTCDate() - daysAgo;

    // 创建北京时间该日 00:00:00 的 UTC 时间戳
    // UTC 时间 = 北京时间 - 8小时
    const beijingMidnight = Date.UTC(year, month, day, 0, 0, 0, 0);
    return new Date(beijingMidnight - beijingOffsetMs);
  }

  /**
   * 将 UTC 时间转换为北京时间的日期字符串 (YYYY-MM-DD)
   */
  private formatDateInBeijingTime(date: Date): string {
    const beijingOffsetMs = 8 * 60 * 60 * 1000;
    const beijingTime = new Date(date.getTime() + beijingOffsetMs);
    const year = beijingTime.getUTCFullYear();
    const month = String(beijingTime.getUTCMonth() + 1).padStart(2, "0");
    const day = String(beijingTime.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * 获取今天的北京时间日期字符串
   */
  private getTodayInBeijingTime(): string {
    return this.formatDateInBeijingTime(new Date());
  }

  private calculateStats(
    allBookmarks: Bookmark[],
    contentBookmarks: Bookmark[],
    browserBookmarks: Bookmark[],
  ): AnalyticsStats {
    // 使用北京时间计算时间边界
    const todayStart = this.getDayStartInBeijingTime(0);
    const weekStart = this.getDayStartInBeijingTime(7);
    const monthStart = this.getDayStartInBeijingTime(30);

    // 统计基于内容收藏（排除浏览器书签），与首页显示一致
    const todayCount = contentBookmarks.filter((b) => {
      if (!b.created_at) return false;
      const createdAt = new Date(b.created_at);
      return createdAt >= todayStart;
    }).length;

    const weekCount = contentBookmarks.filter((b) => {
      if (!b.created_at) return false;
      const createdAt = new Date(b.created_at);
      return createdAt >= weekStart;
    }).length;

    const last30DaysCount = contentBookmarks.filter((b) => {
      if (!b.created_at) return false;
      const createdAt = new Date(b.created_at);
      return createdAt >= monthStart;
    }).length;

    // 未分类数量基于内容收藏
    const unclassifiedCount = contentBookmarks.filter(
      (b) => !b.folder_id,
    ).length;

    return {
      totalBookmarks: allBookmarks.length,
      contentBookmarks: contentBookmarks.length,
      browserBookmarks: browserBookmarks.length,
      todayCount,
      weekCount,
      last30DaysCount,
      unclassifiedCount,
      classificationRate:
        contentBookmarks.length > 0
          ? Math.round(
              ((contentBookmarks.length - unclassifiedCount) /
                contentBookmarks.length) *
                100,
            )
          : 0,
    };
  }

  private calculateTrendData(bookmarks: Bookmark[]): TrendDataItem[] {
    const trendDaysAgo = this.getDayStartInBeijingTime(this.config.trendDays);

    const contentTrendMap = new Map<string, number>();
    const browserTrendMap = new Map<string, number>();

    bookmarks.forEach((bookmark) => {
      if (!bookmark.created_at) return;
      const date = new Date(bookmark.created_at);
      if (date >= trendDaysAgo) {
        // 使用北京时间日期作为 key
        const dateKey = this.formatDateInBeijingTime(date);
        const isBrowser = isBrowserPlatform(bookmark.platform as Platform);

        if (isBrowser) {
          browserTrendMap.set(dateKey, (browserTrendMap.get(dateKey) || 0) + 1);
        } else {
          contentTrendMap.set(dateKey, (contentTrendMap.get(dateKey) || 0) + 1);
        }
      }
    });

    const trendData: TrendDataItem[] = [];

    for (let i = this.config.trendDays - 1; i >= 0; i--) {
      const dayStart = this.getDayStartInBeijingTime(i);
      const dateKey = this.formatDateInBeijingTime(dayStart);
      const count = contentTrendMap.get(dateKey) || 0;
      const browserCount = browserTrendMap.get(dateKey) || 0;

      trendData.push({
        date: dateKey,
        count,
        browserCount,
        total: count + browserCount,
      });
    }

    return trendData;
  }

  private calculatePlatformDistribution(
    bookmarks: Bookmark[],
  ): PlatformDistribution[] {
    const platformMap = new Map<string, number>();

    bookmarks.forEach((bookmark) => {
      const platform = bookmark.platform as Platform;
      const displayPlatform =
        this.config.mergeBrowserPlatforms && isBrowserPlatform(platform)
          ? "BROWSER"
          : platform;

      platformMap.set(
        displayPlatform,
        (platformMap.get(displayPlatform) || 0) + 1,
      );
    });

    const total = bookmarks.length;

    return Array.from(platformMap.entries())
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
        percentage: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }

  private calculateFolderDistribution(
    bookmarks: Bookmark[],
    folders: { id: number; name: string }[],
  ): FolderDistribution[] {
    const folderCountMap = new Map<number, number>();

    bookmarks.forEach((bookmark) => {
      if (bookmark.folder_id) {
        folderCountMap.set(
          bookmark.folder_id,
          (folderCountMap.get(bookmark.folder_id) || 0) + 1,
        );
      }
    });

    const unclassifiedCount = bookmarks.filter((b) => !b.folder_id).length;
    const total = bookmarks.length;

    const result: FolderDistribution[] = folders
      .map((folder) => ({
        folderId: folder.id,
        name: folder.name,
        value: folderCountMap.get(folder.id) || 0,
        percentage:
          total > 0
            ? Math.round(((folderCountMap.get(folder.id) || 0) / total) * 100)
            : 0,
      }))
      .filter((f) => f.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, this.config.topFoldersCount);

    // 添加未分类
    if (unclassifiedCount > 0) {
      result.push({
        folderId: null,
        name: "未分类",
        value: unclassifiedCount,
        percentage:
          total > 0 ? Math.round((unclassifiedCount / total) * 100) : 0,
      });
    }

    return result;
  }

  private calculateTagStats(bookmarks: Bookmark[]): TagStats[] {
    const tagMap = new Map<string, number>();

    bookmarks.forEach((bookmark) => {
      bookmark.ai_tags?.forEach((tag: string) => {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      });
    });

    return Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.topTagsCount)
      .map(([tag, count]) => ({ tag, count }));
  }

  private calculateTypeStats(contentBookmarks: Bookmark[]): ContentTypeStats[] {
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

    const total = contentBookmarks.length;

    return Object.entries(typeMap)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({
        type,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
  }

  private calculateComparison(bookmarks: Bookmark[]): PeriodComparison {
    // 使用北京时间计算时间边界
    const todayStart = this.getDayStartInBeijingTime(0);
    const yesterdayStart = this.getDayStartInBeijingTime(1);
    const thisWeekStart = this.getDayStartInBeijingTime(7);
    const lastWeekStart = this.getDayStartInBeijingTime(14);
    const thisMonthStart = this.getDayStartInBeijingTime(30);
    const lastMonthStart = this.getDayStartInBeijingTime(60);

    // 过滤出内容收藏（排除浏览器书签）
    const contentBookmarks = bookmarks.filter(
      (b) => !isBrowserPlatform(b.platform as Platform),
    );

    // 计算各周期数量（基于内容收藏）
    const todayCount = contentBookmarks.filter((b) => {
      if (!b.created_at) return false;
      const createdAt = new Date(b.created_at);
      return createdAt >= todayStart;
    }).length;

    const yesterdayCount = contentBookmarks.filter((b) => {
      if (!b.created_at) return false;
      const createdAt = new Date(b.created_at);
      return createdAt >= yesterdayStart && createdAt < todayStart;
    }).length;

    const thisWeekCount = contentBookmarks.filter((b) => {
      if (!b.created_at) return false;
      const createdAt = new Date(b.created_at);
      return createdAt >= thisWeekStart;
    }).length;

    const lastWeekCount = contentBookmarks.filter((b) => {
      if (!b.created_at) return false;
      const createdAt = new Date(b.created_at);
      return createdAt >= lastWeekStart && createdAt < thisWeekStart;
    }).length;

    const thisMonthCount = contentBookmarks.filter((b) => {
      if (!b.created_at) return false;
      const createdAt = new Date(b.created_at);
      return createdAt >= thisMonthStart;
    }).length;

    const lastMonthCount = contentBookmarks.filter((b) => {
      if (!b.created_at) return false;
      const createdAt = new Date(b.created_at);
      return createdAt >= lastMonthStart && createdAt < thisMonthStart;
    }).length;

    return {
      daily: this.createComparison(todayCount, yesterdayCount),
      weekly: this.createComparison(thisWeekCount, lastWeekCount),
      monthly: this.createComparison(thisMonthCount, lastMonthCount),
    };
  }

  private createComparison(current: number, previous: number): TimeComparison {
    const change = current - previous;
    const changePercent =
      previous > 0
        ? Math.round((change / previous) * 100)
        : current > 0
          ? 100
          : 0;

    return {
      current,
      previous,
      change,
      changePercent,
      trend: change > 0 ? "up" : change < 0 ? "down" : "flat",
    };
  }
}

// ============================================================================
// 缓存包装函数
// ============================================================================

/**
 * 获取分析数据（带请求级缓存）
 */
export const getAnalyticsData = cache(
  async (
    supabase: SupabaseClient,
    userId: string,
    config?: Partial<AnalyticsConfig>,
  ): Promise<AnalyticsData> => {
    const service = new AnalyticsService(supabase, userId, config);
    return service.getFullAnalytics();
  },
);
