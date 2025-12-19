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
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("*")
      .eq("user_id", this.userId)
      .is("deleted_at", null)
      .eq("is_in_trash", false) // 排除垃圾箱书签，保持与首页列表一致
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch bookmarks: ${error.message}`);
    }

    return (data as Bookmark[]) || [];
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

  private calculateStats(
    allBookmarks: Bookmark[],
    contentBookmarks: Bookmark[],
    browserBookmarks: Bookmark[],
  ): AnalyticsStats {
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

    const todayCount = allBookmarks.filter(
      (b) => b.created_at && new Date(b.created_at) >= todayStart,
    ).length;
    const weekCount = allBookmarks.filter(
      (b) => b.created_at && new Date(b.created_at) >= weekStart,
    ).length;
    const last30DaysCount = allBookmarks.filter(
      (b) => b.created_at && new Date(b.created_at) >= monthStart,
    ).length;
    const unclassifiedCount = allBookmarks.filter((b) => !b.folder_id).length;

    return {
      totalBookmarks: allBookmarks.length,
      contentBookmarks: contentBookmarks.length,
      browserBookmarks: browserBookmarks.length,
      todayCount,
      weekCount,
      last30DaysCount,
      unclassifiedCount,
      classificationRate:
        allBookmarks.length > 0
          ? Math.round(
              ((allBookmarks.length - unclassifiedCount) /
                allBookmarks.length) *
                100,
            )
          : 0,
    };
  }

  private calculateTrendData(bookmarks: Bookmark[]): TrendDataItem[] {
    const trendDaysAgo = new Date();
    trendDaysAgo.setDate(trendDaysAgo.getDate() - this.config.trendDays);

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

    const trendData: TrendDataItem[] = [];
    for (let i = this.config.trendDays - 1; i >= 0; i--) {
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
    const now = new Date();

    // 计算各时间点
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const thisWeekStart = new Date(todayStart);
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisMonthStart = new Date(todayStart);
    thisMonthStart.setDate(thisMonthStart.getDate() - 30);
    const lastMonthStart = new Date(thisMonthStart);
    lastMonthStart.setDate(lastMonthStart.getDate() - 30);

    // 计算各周期数量
    const todayCount = bookmarks.filter(
      (b) => b.created_at && new Date(b.created_at) >= todayStart,
    ).length;
    const yesterdayCount = bookmarks.filter(
      (b) =>
        b.created_at &&
        new Date(b.created_at) >= yesterdayStart &&
        new Date(b.created_at) < todayStart,
    ).length;

    const thisWeekCount = bookmarks.filter(
      (b) => b.created_at && new Date(b.created_at) >= thisWeekStart,
    ).length;
    const lastWeekCount = bookmarks.filter(
      (b) =>
        b.created_at &&
        new Date(b.created_at) >= lastWeekStart &&
        new Date(b.created_at) < thisWeekStart,
    ).length;

    const thisMonthCount = bookmarks.filter(
      (b) => b.created_at && new Date(b.created_at) >= thisMonthStart,
    ).length;
    const lastMonthCount = bookmarks.filter(
      (b) =>
        b.created_at &&
        new Date(b.created_at) >= lastMonthStart &&
        new Date(b.created_at) < thisMonthStart,
    ).length;

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
