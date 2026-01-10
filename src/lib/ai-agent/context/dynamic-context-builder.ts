/**
 * 动态上下文构建器
 *
 * 构建每次对话的动态上下文，包含时间、统计、偏好、最近活动等
 *
 * @version 1.1.0
 * @since 2025-12-26
 * @updated 2025-12-30 - 添加 GlobalInsight、CrossSessionMemory、ProactiveBriefing (Phase 1)
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "../config/feature-flags";
import type {
  DynamicContext,
  TimeContext,
  StatsContext,
  PreferencesContext,
  RecentActivityContext,
  DynamicContextBuildOptions,
  TimePeriod,
  PlatformStats,
  FolderStats,
} from "./types";
import type { GlobalInsight } from "../global-insight/types";
import type { CrossSessionMemory } from "@/lib/ai-memory/types";

// =============================================================================
// 常量配置
// =============================================================================

/** 统计数据缓存 TTL（5 分钟） */
const STATS_CACHE_TTL = 5 * 60 * 1000;

/** 缓存最大条目数（LRU 策略） */
const STATS_CACHE_MAX_SIZE = 100;

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
// LRU 缓存管理
// =============================================================================

/**
 * LRU 缓存条目（包含访问顺序信息）
 */
interface LRUCacheEntry<T> {
  data: T;
  expiry: number;
  /** 最后访问时间（用于 LRU） */
  lastAccess: number;
}

/** 统计数据缓存（使用 Map 保持插入顺序） */
const statsCache = new Map<string, LRUCacheEntry<StatsContext>>();

/**
 * 获取缓存的统计数据（LRU 策略）
 */
function getCachedStats(userId: string): StatsContext | null {
  const cacheKey = `stats:${userId}`;
  const cached = statsCache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    // 更新访问时间（LRU 策略核心）
    cached.lastAccess = Date.now();
    // 移动到 Map 末尾（最近访问）
    statsCache.delete(cacheKey);
    statsCache.set(cacheKey, cached);
    return cached.data;
  }

  // 清除过期缓存
  if (cached) {
    statsCache.delete(cacheKey);
  }

  return null;
}

/**
 * 设置统计数据缓存（带 LRU 淘汰）
 */
function setCachedStats(userId: string, stats: StatsContext): void {
  const cacheKey = `stats:${userId}`;

  // 如果缓存已满，淘汰最久未访问的条目
  if (statsCache.size >= STATS_CACHE_MAX_SIZE) {
    evictLRUEntry();
  }

  statsCache.set(cacheKey, {
    data: stats,
    expiry: Date.now() + STATS_CACHE_TTL,
    lastAccess: Date.now(),
  });
}

/**
 * 淘汰最久未访问的缓存条目
 */
function evictLRUEntry(): void {
  // Map 迭代器按插入顺序返回，第一个就是最旧的
  // 但我们需要按 lastAccess 排序
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of statsCache) {
    if (entry.lastAccess < oldestTime) {
      oldestTime = entry.lastAccess;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    statsCache.delete(oldestKey);
    logger.debug({ key: oldestKey }, "DynamicContext: LRU cache evicted");
  }
}

/**
 * 清除用户的统计缓存（执行写操作后调用）
 */
export function invalidateStatsCache(userId: string): void {
  const cacheKey = `stats:${userId}`;
  statsCache.delete(cacheKey);
  logger.debug({ userId }, "DynamicContext: stats cache invalidated");
}

/**
 * 清理所有过期缓存条目
 */
export function cleanupExpiredCache(): number {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, entry] of statsCache) {
    if (entry.expiry <= now) {
      statsCache.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.debug({ cleanedCount }, "DynamicContext: expired cache cleaned");
  }

  return cleanedCount;
}

/**
 * 获取缓存统计信息（用于监控）
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: statsCache.size,
    maxSize: STATS_CACHE_MAX_SIZE,
  };
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
      // 并行获取各部分上下文（基础部分）
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

      // ========== Phase 1 新增：可选加载全局洞察和跨会话记忆 ==========

      // 全局洞察（仅当显式请求且 Feature Flag 启用时）
      if (
        options.includeGlobalInsight &&
        isFeatureEnabled("ENABLE_GLOBAL_INSIGHT")
      ) {
        context.globalInsight = await this.getGlobalInsight(userId);
      }

      // 跨会话记忆（仅当显式请求时）
      if (options.includeCrossSessionMemory && options.conversationId) {
        context.crossSessionMemory = await this.getCrossSessionMemory(
          userId,
          options.conversationId,
        );
      }

      // 主动简报（仅当显式请求且 Feature Flag 启用时）
      if (
        options.includeProactiveBriefing &&
        isFeatureEnabled("ENABLE_PROACTIVE_BRIEFING")
      ) {
        context.proactiveBriefing = await this.getProactiveBriefing(userId);
      }

      logger.debug(
        {
          userId,
          durationMs: Math.round(performance.now() - startTime),
          totalBookmarks: stats.totalBookmarks,
          hasGlobalInsight: !!context.globalInsight,
          hasCrossSessionMemory: !!context.crossSessionMemory,
          hasProactiveBriefing: !!context.proactiveBriefing,
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

  // ========== Phase 1 新增方法 ==========

  /**
   * 获取全局洞察（延迟加载）
   */
  private async getGlobalInsight(
    userId: string,
  ): Promise<GlobalInsight | undefined> {
    try {
      const { GlobalInsightService } = await import(
        "../global-insight/global-insight-service"
      );
      const service = new GlobalInsightService();
      const insight = await service.getInsight(userId);
      return insight || undefined;
    } catch (error) {
      logger.warn({ userId, error }, "DynamicContext: getGlobalInsight failed");
      return undefined;
    }
  }

  /**
   * 获取跨会话记忆（延迟加载）
   */
  private async getCrossSessionMemory(
    userId: string,
    conversationId: string,
  ): Promise<CrossSessionMemory | undefined> {
    try {
      const { CrossSessionMemoryService } = await import(
        "@/lib/ai-memory/cross-session-memory-service"
      );
      const service = new CrossSessionMemoryService();
      const memory = await service.getCrossSessionMemory(
        userId,
        conversationId,
      );
      return Object.keys(memory).length > 0 ? memory : undefined;
    } catch (error) {
      logger.warn(
        { userId, error },
        "DynamicContext: getCrossSessionMemory failed",
      );
      return undefined;
    }
  }

  /**
   * 获取主动简报（延迟加载）
   */
  private async getProactiveBriefing(
    userId: string,
  ): Promise<DynamicContext["proactiveBriefing"]> {
    try {
      const { ProactiveBriefingService } = await import(
        "../proactive-briefing/proactive-briefing-service"
      );
      const service = new ProactiveBriefingService();
      const briefing = await service.generateBriefing(userId);
      return briefing || undefined;
    } catch (error) {
      logger.warn(
        { userId, error },
        "DynamicContext: getProactiveBriefing failed",
      );
      return undefined;
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
   * Code Review P2-1: 启用数据库偏好获取
   * 通过 ENABLE_PREFERENCE_LEARNING Feature Flag 控制
   *
   * @version 1.2.0
   * @updated 2026-01-10 - 启用动态偏好获取 (Code Review P2-1)
   */
  private async getPreferences(userId: string): Promise<PreferencesContext> {
    // P2-1: 检查 Feature Flag
    if (!isFeatureEnabled("ENABLE_PREFERENCE_LEARNING")) {
      return DEFAULT_PREFERENCES;
    }

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("ai_preferences")
        .eq("id", userId)
        .single();

      if (error || !data) {
        // 查询失败或无数据，返回默认偏好
        if (error) {
          logger.debug(
            { userId, error: error.message },
            "DynamicContext: No ai_preferences found, using defaults",
          );
        }
        return DEFAULT_PREFERENCES;
      }

      const prefs = (data.ai_preferences as Record<string, unknown>) ?? {};

      return {
        responseStyle:
          (prefs.responseStyle as PreferencesContext["responseStyle"]) ??
          "auto",
        frequentTags: Array.isArray(prefs.frequentTags)
          ? prefs.frequentTags.slice(0, 5)
          : [],
      };
    } catch (error) {
      logger.warn(
        { userId, error: error instanceof Error ? error.message : error },
        "DynamicContext: getPreferences failed",
      );
      return DEFAULT_PREFERENCES;
    }
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
