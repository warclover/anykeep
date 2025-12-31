/**
 * 主动简报服务
 *
 * @version 1.0.0
 * @since 2025-12-30
 * @description Phase 0 - 主动简报核心服务
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";
import type { Json } from "@/types/supabase";
import {
  PROACTIVE_BRIEFING_DEFAULTS,
  THRESHOLDS,
  LOG_MODULE,
  ERROR_MESSAGES,
} from "./constants";
import {
  calculateDaysSinceLastVisit,
  calculateOfflineDuration,
  generateInsightId,
  generateActionId,
  calculateTopicDistribution,
  getEmergingTopics,
  generateSimpleSummary,
} from "./utils";
import type {
  ProactiveBriefingConfig,
  ProactiveBriefing,
  ProactiveInsight,
  SuggestedAction,
  OfflineChanges,
  GetInsightsOptions,
  InsightType,
  ActionType,
  InsightGenerator,
} from "./types";

// =============================================================================
// 主服务类
// =============================================================================

/**
 * 主动简报服务
 *
 * 负责生成用户上线时的主动简报，包括：
 * - 离线期间变化统计
 * - 洞察生成
 * - 建议操作生成
 */
export class ProactiveBriefingService {
  private config: ProactiveBriefingConfig;
  private insightGenerators: InsightGenerator[] = [];

  constructor(config: Partial<ProactiveBriefingConfig> = {}) {
    this.config = { ...PROACTIVE_BRIEFING_DEFAULTS, ...config };
  }

  /**
   * 添加自定义洞察生成器
   * @param generator - 洞察生成器
   */
  addInsightGenerator(generator: InsightGenerator): void {
    this.insightGenerators.push(generator);
    logger.debug(
      { module: LOG_MODULE, generatorName: generator.name },
      "Insight generator added",
    );
  }

  // ===========================================================================
  // 公开方法
  // ===========================================================================

  /**
   * 生成主动简报（主入口）
   * @param userId - 用户 ID
   * @returns 简报数据或 null（不满足生成条件时）
   */
  async generateBriefing(userId: string): Promise<ProactiveBriefing | null> {
    // 检查功能开关
    if (!FeatureFlags.ENABLE_PROACTIVE_BRIEFING) {
      return null;
    }

    const startTime = Date.now();

    try {
      // 1. 获取上次访问时间
      const lastVisit = await this.getLastVisitTime(userId);

      if (!lastVisit) {
        // 新用户，无上次访问记录
        await this.updateLastVisitTime(userId);
        return null;
      }

      const offlineDuration = calculateOfflineDuration(lastVisit);

      // 2. 检查是否满足生成条件
      if (!this.shouldGenerateBriefing(offlineDuration)) {
        logger.debug(
          { module: LOG_MODULE, userId, offlineDuration },
          "Offline duration too short, skip briefing",
        );
        return null;
      }

      // 3. 收集离线期间的变化数据
      const changes = await this.collectOfflineChanges(userId, lastVisit);

      // 4. 生成洞察
      const insights = await this.generateInsights(userId, changes);

      // 5. 生成建议操作
      const suggestions = await this.generateSuggestions(
        userId,
        changes,
        insights,
      );

      // 6. 生成摘要
      const topTopics = getEmergingTopics(changes.topicDistribution);
      const daysSinceLastVisit = calculateDaysSinceLastVisit(lastVisit);

      let topicChangeSummary: string | undefined;
      if (this.config.enableLLMSummary && changes.newBookmarksCount > 0) {
        // Phase 0 简化版：使用硬编码摘要
        topicChangeSummary = generateSimpleSummary(
          changes.newBookmarksCount,
          daysSinceLastVisit,
          topTopics,
        );
      }

      const briefing: ProactiveBriefing = {
        enabled: true,
        lastVisit: lastVisit.toISOString(),
        daysSinceLastVisit,
        newCollectionsCount: changes.newBookmarksCount,
        topicChangeSummary,
        pendingInsights: insights.slice(0, this.config.maxInsights),
        suggestedActions: suggestions.slice(0, this.config.maxSuggestions),
        generatedAt: new Date().toISOString(),
      };

      // 7. 保存简报到数据库
      await this.saveBriefing(userId, briefing);

      // 8. 更新最后访问时间
      await this.updateLastVisitTime(userId);

      const duration = Date.now() - startTime;
      logger.info(
        {
          module: LOG_MODULE,
          userId,
          insightCount: insights.length,
          suggestionCount: suggestions.length,
          duration,
        },
        "Proactive briefing generated",
      );

      return briefing;
    } catch (error) {
      logger.error(
        { module: LOG_MODULE, userId, error },
        ERROR_MESSAGES.GENERATION_FAILED,
      );
      return null;
    }
  }

  /**
   * 获取未读洞察数量
   * @param userId - 用户 ID
   * @returns 未读数量
   */
  async getUnreadInsightCount(userId: string): Promise<number> {
    try {
      const supabase = await createClient();

      const { count, error } = await supabase
        .from("proactive_insights")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false)
        .eq("is_dismissed", false);

      if (error) {
        logger.error(
          { module: LOG_MODULE, userId, error },
          "Failed to get unread insight count",
        );
        return 0;
      }

      return count ?? 0;
    } catch (error) {
      logger.error(
        { module: LOG_MODULE, userId, error },
        "Failed to get unread insight count",
      );
      return 0;
    }
  }

  /**
   * 标记洞察为已读
   * @param userId - 用户 ID
   * @param insightId - 洞察 ID
   */
  async markInsightAsRead(userId: string, insightId: string): Promise<void> {
    try {
      const supabase = await createClient();

      const { error } = await supabase
        .from("proactive_insights")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", insightId)
        .eq("user_id", userId);

      if (error) {
        logger.error(
          { module: LOG_MODULE, userId, insightId, error },
          "Failed to mark insight as read",
        );
      }
    } catch (error) {
      logger.error(
        { module: LOG_MODULE, userId, insightId, error },
        "Failed to mark insight as read",
      );
    }
  }

  /**
   * 忽略洞察
   * @param userId - 用户 ID
   * @param insightId - 洞察 ID
   */
  async dismissInsight(userId: string, insightId: string): Promise<void> {
    try {
      const supabase = await createClient();

      const { error } = await supabase
        .from("proactive_insights")
        .update({ is_dismissed: true })
        .eq("id", insightId)
        .eq("user_id", userId);

      if (error) {
        logger.error(
          { module: LOG_MODULE, userId, insightId, error },
          "Failed to dismiss insight",
        );
      }
    } catch (error) {
      logger.error(
        { module: LOG_MODULE, userId, insightId, error },
        "Failed to dismiss insight",
      );
    }
  }

  /**
   * 获取洞察列表
   * @param userId - 用户 ID
   * @param options - 分页和过滤选项
   * @returns 洞察列表
   */
  async getInsights(
    userId: string,
    options: GetInsightsOptions = {},
  ): Promise<{ insights: ProactiveInsight[]; total: number }> {
    try {
      const supabase = await createClient();

      const { unreadOnly = false, limit = 10, offset = 0, types } = options;

      let query = supabase
        .from("proactive_insights")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .eq("is_dismissed", false)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (unreadOnly) {
        query = query.eq("is_read", false);
      }

      if (types && types.length > 0) {
        query = query.in("type", types);
      }

      const { data, count, error } = await query;

      if (error) {
        logger.error(
          { module: LOG_MODULE, userId, error },
          "Failed to get insights",
        );
        return { insights: [], total: 0 };
      }

      const insights: ProactiveInsight[] = (data ?? []).map((row) => ({
        id: row.id,
        type: row.type as InsightType,
        title: row.title,
        summary: row.summary,
        relatedBookmarkIds: row.related_bookmark_ids ?? [],
        priority: row.priority,
        createdAt: row.created_at,
        isRead: row.is_read,
        metadata: (row.metadata as Record<string, unknown>) ?? undefined,
      }));

      return { insights, total: count ?? 0 };
    } catch (error) {
      logger.error(
        { module: LOG_MODULE, userId, error },
        "Failed to get insights",
      );
      return { insights: [], total: 0 };
    }
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 获取用户上次访问时间
   */
  private async getLastVisitTime(userId: string): Promise<Date | null> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("profiles")
        .select("last_visit_at")
        .eq("id", userId)
        .single();

      if (error || !data?.last_visit_at) {
        return null;
      }

      return new Date(data.last_visit_at);
    } catch (error) {
      logger.error(
        { module: LOG_MODULE, userId, error },
        "Failed to get last visit time",
      );
      return null;
    }
  }

  /**
   * 更新用户上次访问时间
   */
  private async updateLastVisitTime(userId: string): Promise<void> {
    try {
      const supabase = await createClient();

      const { error } = await supabase.rpc("update_last_visit_time", {
        p_user_id: userId,
      });

      if (error) {
        logger.error(
          { module: LOG_MODULE, userId, error },
          "Failed to update last visit time",
        );
      }
    } catch (error) {
      logger.error(
        { module: LOG_MODULE, userId, error },
        "Failed to update last visit time",
      );
    }
  }

  /**
   * 收集离线期间的变化数据
   */
  private async collectOfflineChanges(
    userId: string,
    since: Date,
  ): Promise<OfflineChanges> {
    try {
      const supabase = await createClient();

      // 并行查询多个维度的变化
      const [newBookmarksResult, untaggedResult, pendingReviewsResult] =
        await Promise.all([
          // 新增书签
          supabase
            .from("bookmarks")
            .select("id, title, platform, user_tags, created_at")
            .eq("user_id", userId)
            .gte("created_at", since.toISOString())
            .order("created_at", { ascending: false }),

          // 未标签数量
          supabase
            .from("bookmarks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .or("user_tags.is.null,user_tags.eq.{}"),

          // 待复习数量（简化版：统计总数的 10%）
          supabase
            .from("bookmarks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId),
        ]);

      const newBookmarks = (newBookmarksResult.data ?? []).map((b) => ({
        id: b.id,
        title: b.title ?? "",
        platform: b.platform ?? "unknown",
        tags: b.user_tags ?? [],
        created_at: b.created_at ?? "",
      }));

      const topicDistribution = calculateTopicDistribution(newBookmarks);

      return {
        newBookmarksCount: newBookmarks.length,
        newBookmarks,
        topicDistribution,
        untaggedCount: untaggedResult.count ?? 0,
        pendingReviewsCount: Math.ceil((pendingReviewsResult.count ?? 0) * 0.1),
        since,
      };
    } catch (error) {
      logger.error(
        { module: LOG_MODULE, userId, error },
        "Failed to collect offline changes",
      );
      return {
        newBookmarksCount: 0,
        newBookmarks: [],
        topicDistribution: [],
        untaggedCount: 0,
        pendingReviewsCount: 0,
        since,
      };
    }
  }

  /**
   * 生成洞察列表
   */
  private async generateInsights(
    userId: string,
    changes: OfflineChanges,
  ): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];
    const now = new Date().toISOString();

    // 1. 新主题涌现洞察
    const emergingTopics = getEmergingTopics(
      changes.topicDistribution,
      THRESHOLDS.TOPIC_EMERGENCE_MIN_COUNT,
    );

    if (emergingTopics.length > 0) {
      const topTopic = emergingTopics[0];
      const topicCount =
        changes.topicDistribution.find((t) => t.tag === topTopic)?.count ?? 0;

      const relatedIds = changes.newBookmarks
        .filter((b) => b.tags.includes(topTopic))
        .map((b) => b.id);

      insights.push({
        id: generateInsightId("topic_emergence"),
        type: "topic_emergence",
        title: `发现新主题：${topTopic}`,
        summary: `最近你收藏了 ${topicCount} 条关于「${topTopic}」的内容，是否需要整理到专门的文件夹？`,
        relatedBookmarkIds: relatedIds,
        priority: 8,
        createdAt: now,
        isRead: false,
      });
    }

    // 2. 未标签提醒
    if (changes.untaggedCount >= THRESHOLDS.UNTAGGED_SUGGESTION_THRESHOLD) {
      insights.push({
        id: generateInsightId("recommendation"),
        type: "recommendation",
        title: "有未分类的收藏",
        summary: `有 ${changes.untaggedCount} 条收藏还没有添加标签，需要我帮你自动分类吗？`,
        relatedBookmarkIds: [],
        priority: 6,
        createdAt: now,
        isRead: false,
      });
    }

    // 3. 模式检测（简化版：基于平台分布）
    const platformCounts = new Map<string, number>();
    for (const bookmark of changes.newBookmarks) {
      platformCounts.set(
        bookmark.platform,
        (platformCounts.get(bookmark.platform) ?? 0) + 1,
      );
    }

    if (platformCounts.size > 0) {
      const topPlatform = Array.from(platformCounts.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0];

      if (topPlatform[1] >= 3) {
        insights.push({
          id: generateInsightId("pattern_detected"),
          type: "pattern_detected",
          title: `${topPlatform[0]} 内容增多`,
          summary: `最近你从 ${topPlatform[0]} 收藏了 ${topPlatform[1]} 条内容，看起来你对这个平台很感兴趣。`,
          relatedBookmarkIds: changes.newBookmarks
            .filter((b) => b.platform === topPlatform[0])
            .map((b) => b.id),
          priority: 5,
          createdAt: now,
          isRead: false,
        });
      }
    }

    // 按优先级排序
    return insights.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 生成建议操作
   */
  private async generateSuggestions(
    userId: string,
    changes: OfflineChanges,
    insights: ProactiveInsight[],
  ): Promise<SuggestedAction[]> {
    const suggestions: SuggestedAction[] = [];

    // 1. 未标签建议
    if (changes.untaggedCount >= THRESHOLDS.UNTAGGED_SUGGESTION_THRESHOLD) {
      suggestions.push({
        id: generateActionId("tag_untagged"),
        type: "tag_untagged" as ActionType,
        label: "智能标签",
        description: `为 ${changes.untaggedCount} 条未分类收藏添加标签`,
        affectedCount: changes.untaggedCount,
        executeParams: { skillId: "smart_tagging" },
      });
    }

    // 2. 待复习建议
    if (changes.pendingReviewsCount >= THRESHOLDS.PENDING_REVIEW_THRESHOLD) {
      suggestions.push({
        id: generateActionId("review_unread"),
        type: "review_unread" as ActionType,
        label: "开始复习",
        description: `有 ${changes.pendingReviewsCount} 条内容等待复习`,
        affectedCount: changes.pendingReviewsCount,
        executeParams: { skillId: "active_recall" },
      });
    }

    // 3. 主题整理建议（基于洞察）
    const topicInsight = insights.find((i) => i.type === "topic_emergence");
    if (topicInsight) {
      suggestions.push({
        id: generateActionId("organize_topic"),
        type: "organize_topic" as ActionType,
        label: "整理新主题",
        description: topicInsight.summary,
        affectedCount: topicInsight.relatedBookmarkIds.length,
        executeParams: {
          skillId: "batch_organize",
          bookmarkIds: topicInsight.relatedBookmarkIds,
        },
      });
    }

    return suggestions;
  }

  /**
   * 保存简报到数据库
   * Phase 0 MVP: 如果表不存在则静默失败
   */
  private async saveBriefing(
    userId: string,
    briefing: ProactiveBriefing,
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // 将洞察保存到数据库
      const insightsToInsert = briefing.pendingInsights.map((insight) => ({
        id: insight.id,
        user_id: userId,
        type: insight.type as string,
        title: insight.title,
        summary: insight.summary,
        related_bookmark_ids: insight.relatedBookmarkIds,
        priority: insight.priority,
        is_read: false,
        is_dismissed: false,
        metadata: (insight.metadata ?? {}) as Json,
      }));

      if (insightsToInsert.length > 0) {
        const { error } = await supabase
          .from("proactive_insights")
          .upsert(insightsToInsert, { onConflict: "id" });

        if (error) {
          // Phase 0 MVP: 如果表不存在则静默失败
          if (
            error.message?.includes("does not exist") ||
            error.code === "42P01"
          ) {
            logger.debug(
              { module: LOG_MODULE, userId },
              "proactive_insights table not found, skipping save",
            );
            return;
          }
          logger.error(
            { module: LOG_MODULE, userId, error },
            "Failed to save insights",
          );
        }
      }
    } catch (error) {
      logger.error(
        { module: LOG_MODULE, userId, error },
        "Failed to save briefing",
      );
    }
  }

  /**
   * 检查是否应该生成简报
   */
  private shouldGenerateBriefing(offlineDuration: number): boolean {
    return offlineDuration >= this.config.minOfflineDuration;
  }

  /**
   * 释放服务资源
   */
  dispose(): void {
    // 目前无需清理资源
    logger.debug({ module: LOG_MODULE }, "ProactiveBriefingService disposed");
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建主动简报服务实例
 * @param config - 可选配置
 * @returns ProactiveBriefingService 实例
 */
export function createProactiveBriefingService(
  config: Partial<ProactiveBriefingConfig> = {},
): ProactiveBriefingService {
  return new ProactiveBriefingService(config);
}
