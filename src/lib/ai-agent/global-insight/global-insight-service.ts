/**
 * 全局洞察服务
 *
 * 负责生成用户的"知识画像"，包括：
 * - 主题分布与权重
 * - 兴趣趋势分析
 * - 知识盲区识别
 * - 平台偏好分析
 * - 活跃时段分析
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import { logger } from "@/lib/logger";
import type {
  GlobalInsight,
  GlobalInsightConfig,
  TopicWeight,
  TrendPoint,
  TrendDirection,
  PlatformWeight,
  TimeSlot,
  BookmarkForAnalysis,
} from "./types";
import {
  DEFAULT_CONFIG,
  TIME_CONSTANTS,
  TREND_THRESHOLDS,
  ACTIVITY_PARAMS,
  TOPIC_RELATIONS,
  MAX_KNOWLEDGE_GAPS,
  MIN_BOOKMARKS_FOR_INSIGHT,
  INSIGHT_VERSION,
} from "./constants";

// ============================================
// 服务类
// ============================================

/**
 * 全局洞察服务
 *
 * @example
 * ```typescript
 * const service = new GlobalInsightService();
 * const insight = await service.getInsight(userId);
 * console.log(insight.topicDistribution);
 * ```
 */
export class GlobalInsightService {
  private config: GlobalInsightConfig;
  private supabase: SupabaseClient<Database>;

  constructor(config?: Partial<GlobalInsightConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.supabase = createClient();
  }

  // ============================================
  // 公开方法
  // ============================================

  /**
   * 获取或生成全局洞察
   *
   * @param userId - 用户 ID
   * @param forceRefresh - 是否强制刷新
   * @returns 全局洞察数据，书签不足时返回 null
   */
  async getInsight(
    userId: string,
    forceRefresh = false,
  ): Promise<GlobalInsight | null> {
    try {
      // 非强制刷新时，先检查缓存
      if (!forceRefresh) {
        const cached = await this.getCachedInsight(userId);
        if (cached && !this.shouldRefresh(cached)) {
          return cached;
        }
      }

      // 生成新洞察
      return await this.generateInsight(userId);
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to get global insight",
      );
      return null;
    }
  }

  /**
   * 强制更新全局洞察
   *
   * @param userId - 用户 ID
   * @returns 新生成的洞察数据
   */
  async refreshInsight(userId: string): Promise<GlobalInsight | null> {
    return this.getInsight(userId, true);
  }

  /**
   * 获取用户的核心关注主题
   *
   * @param userId - 用户 ID
   * @param limit - 返回数量限制，默认 5
   * @returns 核心主题列表
   */
  async getCoreTopics(userId: string, limit = 5): Promise<TopicWeight[]> {
    const insight = await this.getInsight(userId);
    if (!insight) {
      return [];
    }

    // 按权重排序，返回核心知识中的主题
    return insight.topicDistribution
      .filter((t) => insight.coreKnowledge.includes(t.topic))
      .slice(0, limit);
  }

  /**
   * 获取知识盲区建议
   *
   * @param userId - 用户 ID
   * @returns 建议学习的主题列表
   */
  async getKnowledgeGaps(userId: string): Promise<string[]> {
    const insight = await this.getInsight(userId);
    if (!insight) {
      return [];
    }
    return insight.knowledgeGaps;
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 生成全局洞察
   */
  private async generateInsight(userId: string): Promise<GlobalInsight | null> {
    const startTime = Date.now();

    try {
      // 获取分析周期内的书签
      const bookmarks = await this.fetchBookmarksForAnalysis(userId);

      if (bookmarks.length < MIN_BOOKMARKS_FOR_INSIGHT) {
        logger.info(
          {
            userId,
            count: bookmarks.length,
            required: MIN_BOOKMARKS_FOR_INSIGHT,
          },
          "Not enough bookmarks for insight generation",
        );
        return null;
      }

      // 分析主题分布
      const topicDistribution = await this.analyzeTopicDistribution(bookmarks);

      // 分析兴趣趋势
      const interestTrend = this.analyzeInterestTrend(
        bookmarks,
        topicDistribution,
      );

      // 识别知识盲区
      const knowledgeGaps = await this.identifyKnowledgeGaps(topicDistribution);

      // 分类核心知识和边缘兴趣
      const { coreKnowledge, peripheralInterests } =
        this.classifyKnowledge(topicDistribution);

      // 分析平台偏好
      const platformPreference = this.analyzePlatformPreference(bookmarks);

      // 分析活跃时段
      const activeTimeSlots = this.analyzeActiveTimeSlots(bookmarks);

      const insight: GlobalInsight = {
        version: INSIGHT_VERSION,
        topicDistribution,
        interestTrend,
        knowledgeGaps,
        coreKnowledge,
        peripheralInterests,
        platformPreference,
        activeTimeSlots,
        lastAnalyzedAt: new Date().toISOString(),
        analyzedBookmarkCount: bookmarks.length,
      };

      // 缓存洞察
      await this.cacheInsight(userId, insight);

      const durationMs = Date.now() - startTime;
      logger.info(
        {
          userId,
          bookmarkCount: bookmarks.length,
          topicCount: topicDistribution.length,
          durationMs,
        },
        "Global insight generated",
      );

      return insight;
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to generate global insight",
      );
      throw error;
    }
  }

  /**
   * 获取分析周期内的书签
   */
  private async fetchBookmarksForAnalysis(
    userId: string,
  ): Promise<BookmarkForAnalysis[]> {
    const periodStart = new Date(
      Date.now() - this.config.analysisPeriodDays * TIME_CONSTANTS.ONE_DAY_MS,
    );

    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("id, title, user_tags, platform, created_at, ai_summary")
      .eq("user_id", userId)
      .gte("created_at", periodStart.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      logger.error(
        { userId, error: error.message },
        "Failed to fetch bookmarks for analysis",
      );
      throw error;
    }

    return (data || [])
      .filter((b) => b.created_at !== null)
      .map((b) => ({
        id: b.id,
        title: b.title,
        tags: b.user_tags as string[] | null,
        platform: b.platform,
        created_at: b.created_at as string,
        summary: b.ai_summary || undefined,
      }));
  }

  /**
   * 分析主题分布
   */
  private async analyzeTopicDistribution(
    bookmarks: BookmarkForAnalysis[],
  ): Promise<TopicWeight[]> {
    const tagCounts = new Map<string, number>();
    const tagBookmarks = new Map<string, BookmarkForAnalysis[]>();

    // 统计标签频次
    for (const bookmark of bookmarks) {
      if (!bookmark.tags || bookmark.tags.length === 0) continue;

      for (const tag of bookmark.tags) {
        const normalizedTag = tag.trim();
        if (!normalizedTag) continue;

        tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);

        const existingBookmarks = tagBookmarks.get(normalizedTag);
        if (existingBookmarks) {
          existingBookmarks.push(bookmark);
        } else {
          tagBookmarks.set(normalizedTag, [bookmark]);
        }
      }
    }

    // 计算总书签数用于权重归一化
    const totalBookmarks = bookmarks.length;

    // 转换为 TopicWeight 数组
    const topicWeights: TopicWeight[] = [];

    for (const [topic, count] of tagCounts.entries()) {
      const topicBookmarks = tagBookmarks.get(topic) ?? [];

      // 计算权重（基于频次）
      const weight = count / totalBookmarks;

      // 计算最近活跃度
      const recentActivity = this.calculateRecentActivity(topicBookmarks);

      // 计算趋势
      const trend = this.calculateTrend(topic, topicBookmarks);

      topicWeights.push({
        topic,
        weight,
        bookmarkCount: count,
        recentActivity,
        trend,
      });
    }

    // 按权重排序，取 top N
    return topicWeights
      .sort((a, b) => b.weight - a.weight)
      .slice(0, this.config.maxTopics);
  }

  /**
   * 计算最近活跃度
   * 基于时间衰减：30 天内的活动权重更高
   */
  private calculateRecentActivity(bookmarks: BookmarkForAnalysis[]): number {
    const now = Date.now();
    let totalWeight = 0;
    let weightedSum = 0;

    for (const bookmark of bookmarks) {
      const createdAt = new Date(bookmark.created_at).getTime();
      const daysSince = (now - createdAt) / TIME_CONSTANTS.ONE_DAY_MS;

      // 指数衰减：30 天内权重较高
      const weight = Math.exp(-daysSince / ACTIVITY_PARAMS.DECAY_PERIOD_DAYS);
      totalWeight += 1;
      weightedSum += weight;
    }

    if (totalWeight === 0) return ACTIVITY_PARAMS.MIN_ACTIVITY;

    return Math.min(
      ACTIVITY_PARAMS.MAX_ACTIVITY,
      Math.max(ACTIVITY_PARAMS.MIN_ACTIVITY, weightedSum / totalWeight),
    );
  }

  /**
   * 计算主题趋势
   */
  private calculateTrend(
    _tag: string,
    bookmarks: BookmarkForAnalysis[],
  ): TrendDirection {
    const now = Date.now();
    const recentPeriodStart =
      now - TIME_CONSTANTS.TREND_PERIOD_DAYS * TIME_CONSTANTS.ONE_DAY_MS;
    const earlierPeriodStart =
      now -
      TIME_CONSTANTS.TREND_COMPARISON_PERIOD_DAYS * TIME_CONSTANTS.ONE_DAY_MS;

    // 最近 30 天的书签
    const recentBookmarks = bookmarks.filter(
      (b) => new Date(b.created_at).getTime() >= recentPeriodStart,
    );

    // 30-60 天的书签
    const earlierBookmarks = bookmarks.filter((b) => {
      const createdAt = new Date(b.created_at).getTime();
      return createdAt >= earlierPeriodStart && createdAt < recentPeriodStart;
    });

    const recentCount = recentBookmarks.length;
    const earlierCount = earlierBookmarks.length;

    // 避免除以零
    if (earlierCount === 0) {
      return recentCount > 0 ? "rising" : "stable";
    }

    const ratio = recentCount / earlierCount;

    if (ratio >= TREND_THRESHOLDS.RISING_MULTIPLIER) {
      return "rising";
    } else if (ratio <= TREND_THRESHOLDS.DECLINING_MULTIPLIER) {
      return "declining";
    }
    return "stable";
  }

  /**
   * 分析兴趣趋势（30 天内的每日活跃度）
   */
  private analyzeInterestTrend(
    bookmarks: BookmarkForAnalysis[],
    topics: TopicWeight[],
  ): TrendPoint[] {
    const trendPoints: TrendPoint[] = [];
    const topTopics = topics.slice(0, 5).map((t) => t.topic);

    // 只分析最近 30 天
    const now = new Date();
    for (let i = 0; i < TIME_CONSTANTS.TREND_PERIOD_DAYS; i++) {
      const date = new Date(now.getTime() - i * TIME_CONSTANTS.ONE_DAY_MS);
      const dateStr = date.toISOString().split("T")[0];

      // 当天的书签
      const dayBookmarks = bookmarks.filter((b) =>
        b.created_at.startsWith(dateStr),
      );

      for (const topic of topTopics) {
        const topicBookmarks = dayBookmarks.filter((b) =>
          b.tags?.includes(topic),
        );
        const activity =
          topicBookmarks.length > 0
            ? Math.min(1, topicBookmarks.length / 5)
            : 0;

        trendPoints.push({
          date: dateStr,
          topic,
          activity,
        });
      }
    }

    return trendPoints;
  }

  /**
   * 识别知识盲区
   * 基于已有主题的关联主题进行推荐
   */
  private async identifyKnowledgeGaps(
    topicDistribution: TopicWeight[],
  ): Promise<string[]> {
    const userTopics = new Set(topicDistribution.map((t) => t.topic));
    const suggestions = new Map<string, number>();

    // 遍历用户的主题，找到相关但用户没有的主题
    for (const topicWeight of topicDistribution) {
      const relatedTopics = TOPIC_RELATIONS[topicWeight.topic] || [];

      for (const related of relatedTopics) {
        if (!userTopics.has(related)) {
          // 按关联主题的权重累加推荐分数
          suggestions.set(
            related,
            (suggestions.get(related) || 0) + topicWeight.weight,
          );
        }
      }
    }

    // 按推荐分数排序
    return Array.from(suggestions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_KNOWLEDGE_GAPS)
      .map(([topic]) => topic);
  }

  /**
   * 分类核心知识和边缘兴趣
   * 核心知识：权重累计达到阈值前的主题
   * 边缘兴趣：其余主题
   */
  private classifyKnowledge(topicDistribution: TopicWeight[]): {
    coreKnowledge: string[];
    peripheralInterests: string[];
  } {
    const sortedTopics = [...topicDistribution].sort(
      (a, b) => b.weight - a.weight,
    );
    const totalWeight = sortedTopics.reduce((sum, t) => sum + t.weight, 0);
    const threshold = (this.config.coreKnowledgeThreshold / 100) * totalWeight;

    const coreKnowledge: string[] = [];
    const peripheralInterests: string[] = [];
    let accumulatedWeight = 0;

    for (const topic of sortedTopics) {
      if (accumulatedWeight < threshold) {
        coreKnowledge.push(topic.topic);
        accumulatedWeight += topic.weight;
      } else {
        peripheralInterests.push(topic.topic);
      }
    }

    return { coreKnowledge, peripheralInterests };
  }

  /**
   * 分析平台偏好
   */
  private analyzePlatformPreference(
    bookmarks: BookmarkForAnalysis[],
  ): PlatformWeight[] {
    const platformCounts = new Map<string, number>();

    for (const bookmark of bookmarks) {
      const platform = bookmark.platform || "unknown";
      platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1);
    }

    const totalBookmarks = bookmarks.length;

    return Array.from(platformCounts.entries())
      .map(([platform, count]) => ({
        platform,
        weight: count / totalBookmarks,
        bookmarkCount: count,
      }))
      .sort((a, b) => b.weight - a.weight);
  }

  /**
   * 分析活跃时段
   */
  private analyzeActiveTimeSlots(bookmarks: BookmarkForAnalysis[]): TimeSlot[] {
    // 按星期几和小时统计
    const slotCounts = new Map<string, number>();
    let maxCount = 0;

    for (const bookmark of bookmarks) {
      const date = new Date(bookmark.created_at);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      const key = `${dayOfWeek}-${hour}`;

      const count = (slotCounts.get(key) || 0) + 1;
      slotCounts.set(key, count);
      maxCount = Math.max(maxCount, count);
    }

    if (maxCount === 0) return [];

    // 转换为 TimeSlot 数组，归一化活跃度
    return Array.from(slotCounts.entries())
      .map(([key, count]) => {
        const [dayOfWeek, hour] = key.split("-").map(Number);
        return {
          dayOfWeek,
          hour,
          activity: count / maxCount,
        };
      })
      .sort((a, b) => b.activity - a.activity);
  }

  /**
   * 获取缓存的洞察
   */
  private async getCachedInsight(
    userId: string,
  ): Promise<GlobalInsight | null> {
    try {
      const { data, error } = await this.supabase.rpc("get_ai_global_insight", {
        p_user_id: userId,
      });

      if (error) {
        logger.warn(
          { userId, error: error.message },
          "Failed to get cached insight",
        );
        return null;
      }

      if (!data || typeof data !== "object") {
        return null;
      }

      return data as unknown as GlobalInsight;
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error getting cached insight",
      );
      return null;
    }
  }

  /**
   * 缓存洞察到数据库
   */
  private async cacheInsight(
    userId: string,
    insight: GlobalInsight,
  ): Promise<void> {
    try {
      const { error } = await this.supabase.rpc("update_ai_global_insight", {
        p_user_id: userId,
        p_insight: insight as unknown as Json,
      });

      if (error) {
        logger.error(
          { userId, error: error.message },
          "Failed to cache insight",
        );
      }
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Error caching insight",
      );
    }
  }

  /**
   * 检查是否需要刷新洞察
   */
  private shouldRefresh(insight: GlobalInsight): boolean {
    const lastAnalyzed = new Date(insight.lastAnalyzedAt).getTime();
    const refreshInterval =
      this.config.updateIntervalHours * TIME_CONSTANTS.ONE_HOUR_MS;
    return Date.now() - lastAnalyzed > refreshInterval;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 GlobalInsightService 实例
 */
export function createGlobalInsightService(
  config?: Partial<GlobalInsightConfig>,
): GlobalInsightService {
  return new GlobalInsightService(config);
}

export default GlobalInsightService;
