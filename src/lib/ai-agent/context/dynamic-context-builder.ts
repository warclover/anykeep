/**
 * 动态上下文构建器
 *
 * 构建每次对话的动态上下文，包含时间、统计、偏好、最近活动等
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  DynamicContext,
  TimeContext,
  StatsContext,
  PreferencesContext,
  RecentActivityContext,
  DynamicContextBuildOptions,
  CacheEntry,
  TimePeriod,
  PlatformStats,
  FolderStats,
} from "./types";

// =============================================================================
// 常量配置
// =============================================================================

/** 统计数据缓存 TTL（5 分钟） */
const STATS_CACHE_TTL = 5 * 60 * 1000;

/** 中文星期映射 */
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** 平台代码到中文名称映射 */
const PLATFORM_NAME_MAP: Record<string, string> = {
  WECHAT: "微信公众号",
  BILIBILI: "B站",
  XIAOHONGSHU: "小红书",
  ZHIHU: "知乎",
  WEIBO: "微博",
  DOUYIN: "抖音",
  BROWSER_CHROME: "Chrome书签",
  BROWSER_EDGE: "Edge书签",
  BROWSER_FIREFOX: "Firefox书签",
  BROWSER_SAFARI: "Safari书签",
  OTHER: "其他",
};

/** 默认平台统计 */
const DEFAULT_PLATFORM: PlatformStats = {
  name: "未知",
  code: "OTHER",
  count: 0,
};

/** 默认偏好 */
const DEFAULT_PREFERENCES: PreferencesContext = {
  responseStyle: "auto",
  frequentTags: [],
};

// =============================================================================
// 缓存管理
// =============================================================================

/** 统计数据缓存 */
const statsCache = new Map<string, CacheEntry<StatsContext>>();

/**
 * 获取缓存的统计数据
 */
function getCachedStats(userId: string): StatsContext | null {
  const cacheKey = `stats:${userId}`;
  const cached = statsCache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  // 清除过期缓存
  if (cached) {
    statsCache.delete(cacheKey);
  }

  return null;
}

/**
 * 设置统计数据缓存
 */
function setCachedStats(userId: string, stats: StatsContext): void {
  const cacheKey = `stats:${userId}`;
  statsCache.set(cacheKey, {
    data: stats,
    expiry: Date.now() + STATS_CACHE_TTL,
  });
}

/**
 * 清除用户的统计缓存（执行写操作后调用）
 */
export function invalidateStatsCache(userId: string): void {
  const cacheKey = `stats:${userId}`;
  statsCache.delete(cacheKey);
  logger.debug({ userId }, "DynamicContext: stats cache invalidated");
}

// =============================================================================
// 动态上下文构建器类
// =============================================================================

/**
 * 动态上下文构建器
 */
export class DynamicContextBuilder {
  /**
   * 构建完整的动态上下文
   */
  async build(
    userId: string,
    options: DynamicContextBuildOptions = {},
  ): Promise<DynamicContext> {
    const startTime = performance.now();

    try {
      // 并行获取各部分上下文
      const [stats, preferences, recentActivity] = await Promise.all([
        options.skipStats ? this.getDefaultStats() : this.getStats(userId),
        this.getPreferences(userId),
        options.skipRecentActivity
          ? { lastSaved: undefined, lastSearch: undefined }
          : this.getRecentActivity(userId),
      ]);

      const context: DynamicContext = {
        time: this.buildTimeContext(),
        stats,
        preferences,
        recentActivity,
        session: options.session ?? {},
      };

      logger.debug(
        {
          userId,
          durationMs: Math.round(performance.now() - startTime),
          totalBookmarks: stats.totalBookmarks,
        },
        "DynamicContext: built successfully",
      );

      return context;
    } catch (error) {
      logger.error(
        { userId, error },
        "DynamicContext: build failed, using defaults",
      );

      // 返回默认上下文，确保不会中断流程
      return {
        time: this.buildTimeContext(),
        stats: this.getDefaultStats(),
        preferences: DEFAULT_PREFERENCES,
        recentActivity: {},
        session: options.session ?? {},
      };
    }
  }

  /**
   * 构建时间上下文（纯计算，无 IO）
   */
  private buildTimeContext(): TimeContext {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // 判断时间段
    let period: TimePeriod;
    if (hour < 12) {
      period = "morning";
    } else if (hour < 18) {
      period = "afternoon";
    } else if (hour < 22) {
      period = "evening";
    } else {
      period = "night";
    }

    // 格式化当前时间
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(hour).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    return {
      current: `${year}-${month}-${day} ${WEEKDAYS[dayOfWeek]} ${hours}:${minutes}`,
      period,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    };
  }

  /**
   * 获取统计数据（带缓存）
   */
  private async getStats(userId: string): Promise<StatsContext> {
    // 检查缓存
    const cached = getCachedStats(userId);
    if (cached) {
      return cached;
    }

    const supabase = await createClient();

    // 计算 7 天前的日期
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // 并行查询
    const [totalResult, recentResult, platformResult, folderResult] =
      await Promise.all([
        // 总数
        supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null),

        // 最近 7 天新增
        supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null)
          .gte("created_at", sevenDaysAgo),

        // 平台分布 Top 1
        supabase
          .from("bookmarks")
          .select("platform")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .not("platform", "is", null),

        // 文件夹 Top 3（通过 folders 表关联统计）
        supabase
          .from("folders")
          .select("id, name, bookmarks(count)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

    // 计算平台统计
    const platformCounts: Record<string, number> = {};
    if (platformResult.data) {
      for (const row of platformResult.data) {
        const platform = row.platform as string;
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      }
    }

    // 找出最常用平台
    let topPlatform = DEFAULT_PLATFORM;
    let maxCount = 0;
    for (const [code, count] of Object.entries(platformCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topPlatform = {
          name: PLATFORM_NAME_MAP[code] || code,
          code,
          count,
        };
      }
    }

    // 处理文件夹统计
    const topFolders: FolderStats[] = [];
    if (folderResult.data) {
      // 计算每个文件夹的书签数并排序
      const foldersWithCount = folderResult.data
        .map((folder) => ({
          id: folder.id as number,
          name: folder.name as string,
          count: Array.isArray(folder.bookmarks)
            ? folder.bookmarks.length
            : typeof folder.bookmarks === "object" &&
                folder.bookmarks !== null &&
                "count" in folder.bookmarks
              ? (folder.bookmarks as { count: number }).count
              : 0,
        }))
        .filter((f) => f.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      topFolders.push(...foldersWithCount);
    }

    const stats: StatsContext = {
      totalBookmarks: totalResult.count ?? 0,
      recentWeekCount: recentResult.count ?? 0,
      topPlatform,
      topFolders,
    };

    // 写入缓存
    setCachedStats(userId, stats);

    return stats;
  }

  /**
   * 获取默认统计数据
   */
  private getDefaultStats(): StatsContext {
    return {
      totalBookmarks: 0,
      recentWeekCount: 0,
      topPlatform: DEFAULT_PLATFORM,
      topFolders: [],
    };
  }

  /**
   * 获取用户偏好
   *
   * 注意：ai_preferences 字段是 P2 任务，数据库迁移尚未执行
   * 当前返回默认偏好，后续迁移完成后启用完整逻辑
   */
  private async getPreferences(_userId: string): Promise<PreferencesContext> {
    // TODO: P2 任务完成后，启用以下逻辑
    // try {
    //   const supabase = await createClient();
    //   const { data, error } = await supabase
    //     .from("profiles")
    //     .select("ai_preferences")
    //     .eq("id", userId)
    //     .single();
    //
    //   if (error || !data) {
    //     return DEFAULT_PREFERENCES;
    //   }
    //
    //   const prefs = (data.ai_preferences as Record<string, unknown>) ?? {};
    //
    //   return {
    //     responseStyle:
    //       (prefs.responseStyle as PreferencesContext["responseStyle"]) ??
    //       "auto",
    //     frequentTags: Array.isArray(prefs.frequentTags)
    //       ? prefs.frequentTags.slice(0, 5)
    //       : [],
    //   };
    // } catch (error) {
    //   logger.warn({ userId, error }, "DynamicContext: getPreferences failed");
    //   return DEFAULT_PREFERENCES;
    // }

    // 当前返回默认偏好
    return DEFAULT_PREFERENCES;
  }

  /**
   * 获取最近活动
   */
  private async getRecentActivity(
    userId: string,
  ): Promise<RecentActivityContext> {
    try {
      const supabase = await createClient();

      // 获取最近保存的书签
      const { data: lastBookmark } = await supabase
        .from("bookmarks")
        .select("title, platform, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      return {
        lastSaved: lastBookmark
          ? {
              title: this.truncateTitle(lastBookmark.title as string),
              platform:
                PLATFORM_NAME_MAP[lastBookmark.platform as string] ||
                (lastBookmark.platform as string),
              time: this.formatRelativeTime(lastBookmark.created_at as string),
            }
          : undefined,
      };
    } catch (error) {
      logger.warn(
        { userId, error },
        "DynamicContext: getRecentActivity failed",
      );
      return {};
    }
  }

  /**
   * 截断标题
   */
  private truncateTitle(title: string, maxLength: number = 30): string {
    if (title.length <= maxLength) {
      return title;
    }
    return title.slice(0, maxLength - 3) + "...";
  }

  /**
   * 格式化相对时间
   */
  private formatRelativeTime(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}天前`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}周前`;

    const months = Math.floor(days / 30);
    return `${months}个月前`;
  }
}

// =============================================================================
// 单例导出
// =============================================================================

/**
 * 全局动态上下文构建器实例
 */
export const dynamicContextBuilder = new DynamicContextBuilder();

/**
 * 构建动态上下文的便捷函数
 */
export async function buildDynamicContext(
  userId: string,
  options?: DynamicContextBuildOptions,
): Promise<DynamicContext> {
  return dynamicContextBuilder.build(userId, options);
}
