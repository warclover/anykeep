/**
 * Classification Metrics Service
 *
 * 记录分类服务的详细指标，用于效果验证和监控
 *
 * @version 1.0.0
 * @since 2025-12-09
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * 分类动作类型
 * 注意：与 classification.ts 中的 ClassificationAction 保持一致
 */
export type ClassificationAction =
  | "classify"
  | "inbox"
  | "suggest"
  | "suggest_new"
  | "suggest_create"
  | "auto_create";

/**
 * 匹配类型
 */
export type MatchType =
  | "profile"
  | "name"
  | "ai_select"
  | "ai_create"
  | "correction_cache"
  | "history"
  | "universal";

/**
 * 用户反馈类型
 */
export type UserFeedback = "accept" | "reject" | "modify";

/**
 * 记录指标的请求参数
 */
export interface RecordClassificationMetricsRequest {
  userId: string;
  bookmarkId?: number;
  bookmarkUrl?: string;

  // 分类结果
  action: ClassificationAction;
  folderId?: number | null;
  folderName?: string | null;
  confidence: number;

  // 分层信息
  tier: 0 | 1 | 2 | 3;
  cacheHit?: boolean;
  aiCalled?: boolean;

  // 匹配详情
  matchType?: MatchType;
  vectorScore?: number;
  historyScore?: number;
  aiScore?: number;

  // 性能指标
  executionTimeMs: number;
  tier0TimeMs?: number;
  tier1TimeMs?: number;
  tier2TimeMs?: number;
  tier3TimeMs?: number;

  // 追踪信息
  traceId?: string;
  decisionReason?: string;
}

/**
 * 指标查询结果
 */
export interface ClassificationMetricsSummary {
  date: string;
  totalCount: number;
  uniqueUsers?: number;
  tierCounts: {
    inbox: number;
    tier1: number;
    tier2: number;
    tier3: number;
  };
  aiCallRate: number;
  aiSkipRate: number;
  cacheHitRate: number;
  avgConfidence: number;
  avgExecutionTimeMs: number;
  p95ExecutionTimeMs: number;
  acceptanceRate: number | null;
  feedbackCount: number;
}

/**
 * Classification Metrics Service
 */
export class ClassificationMetricsService {
  /**
   * 记录分类指标
   *
   * @returns 指标记录 ID
   */
  async recordMetrics(
    request: RecordClassificationMetricsRequest,
  ): Promise<number | null> {
    try {
      const supabase = await createClient();

      const { data, error } = await supabase.rpc(
        "record_classification_metrics",
        {
          p_user_id: request.userId,
          p_bookmark_id: request.bookmarkId ?? undefined,
          p_bookmark_url: request.bookmarkUrl ?? undefined,
          p_action: request.action,
          p_folder_id: request.folderId ?? undefined,
          p_folder_name: request.folderName ?? undefined,
          p_confidence: request.confidence,
          p_tier: request.tier,
          p_cache_hit: request.cacheHit ?? false,
          p_ai_called: request.aiCalled ?? false,
          p_match_type: request.matchType ?? undefined,
          p_vector_score: request.vectorScore ?? undefined,
          p_history_score: request.historyScore ?? undefined,
          p_ai_score: request.aiScore ?? undefined,
          p_execution_time_ms: request.executionTimeMs,
          p_tier0_time_ms: request.tier0TimeMs ?? undefined,
          p_tier1_time_ms: request.tier1TimeMs ?? undefined,
          p_tier2_time_ms: request.tier2TimeMs ?? undefined,
          p_tier3_time_ms: request.tier3TimeMs ?? undefined,
          p_trace_id: request.traceId ?? undefined,
          p_decision_reason: request.decisionReason ?? undefined,
        },
      );

      if (error) {
        logger.error(
          { error: error.message, userId: request.userId.slice(0, 8) + "..." },
          "ClassificationMetrics: Failed to record metrics",
        );
        return null;
      }

      logger.debug(
        {
          metricsId: data,
          tier: request.tier,
          action: request.action,
          confidence: request.confidence,
          aiCalled: request.aiCalled,
          executionTimeMs: request.executionTimeMs,
        },
        "ClassificationMetrics: Metrics recorded",
      );

      return data;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "ClassificationMetrics: Exception while recording metrics",
      );
      return null;
    }
  }

  /**
   * 更新用户反馈
   */
  async updateFeedback(
    metricsId: number,
    userId: string,
    feedback: UserFeedback,
    feedbackFolderId?: number,
  ): Promise<boolean> {
    try {
      const supabase = await createClient();

      const { error } = await supabase
        .from("classification_metrics")
        .update({
          user_feedback: feedback,
          feedback_folder_id: feedbackFolderId || null,
          feedback_at: new Date().toISOString(),
        })
        .eq("id", metricsId)
        .eq("user_id", userId);

      if (error) {
        logger.error(
          { error: error.message, metricsId },
          "ClassificationMetrics: Failed to update feedback",
        );
        return false;
      }

      logger.info(
        { metricsId, feedback },
        "ClassificationMetrics: Feedback updated",
      );
      return true;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "ClassificationMetrics: Exception while updating feedback",
      );
      return false;
    }
  }

  /**
   * 获取用户每日指标
   */
  async getUserDailyMetrics(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ClassificationMetricsSummary[]> {
    try {
      const supabase = await createClient();

      let query = supabase
        .from("classification_metrics_daily")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (startDate) {
        query = query.gte("date", startDate.toISOString());
      }

      if (endDate) {
        query = query.lte("date", endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        logger.error(
          { error: error.message, userId: userId.slice(0, 8) + "..." },
          "ClassificationMetrics: Failed to get user daily metrics",
        );
        return [];
      }

      // 类型断言以避免隐式 any
      type DailyMetricsRow = {
        date: string;
        total_count: number;
        inbox_count: number;
        tier1_count: number;
        tier2_count: number;
        tier3_count: number;
        ai_call_rate?: number;
        cache_hit_rate?: number;
        avg_confidence?: number;
        avg_execution_time_ms?: number;
        p95_execution_time_ms?: number;
        acceptance_rate?: number | null;
        feedback_count?: number;
      };

      return ((data || []) as DailyMetricsRow[]).map(
        (row: DailyMetricsRow) => ({
          date: row.date,
          totalCount: row.total_count,
          tierCounts: {
            inbox: row.inbox_count,
            tier1: row.tier1_count,
            tier2: row.tier2_count,
            tier3: row.tier3_count,
          },
          aiCallRate: row.ai_call_rate || 0,
          aiSkipRate: 1 - (row.ai_call_rate || 0),
          cacheHitRate: row.cache_hit_rate || 0,
          avgConfidence: row.avg_confidence || 0,
          avgExecutionTimeMs: row.avg_execution_time_ms || 0,
          p95ExecutionTimeMs: row.p95_execution_time_ms || 0,
          acceptanceRate: row.acceptance_rate ?? null,
          feedbackCount: row.feedback_count || 0,
        }),
      );
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "ClassificationMetrics: Exception while getting user daily metrics",
      );
      return [];
    }
  }

  /**
   * 获取用户分类效果统计
   */
  async getUserStats(userId: string): Promise<{
    totalClassifications: number;
    aiCallRate: number;
    cacheHitRate: number;
    avgConfidence: number;
    avgExecutionTimeMs: number;
    acceptanceRate: number | null;
    tierDistribution: Record<string, number>;
  } | null> {
    try {
      const supabase = await createClient();

      // 获取最近 30 天的数据
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("classification_metrics")
        .select(
          "tier, ai_called, cache_hit, confidence, execution_time_ms, user_feedback",
        )
        .eq("user_id", userId)
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (error) {
        logger.error(
          { error: error.message },
          "ClassificationMetrics: Failed to get user stats",
        );
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // 类型断言以避免隐式 any
      type MetricsRow = {
        tier: number;
        ai_called: boolean;
        cache_hit: boolean;
        confidence: number;
        execution_time_ms: number;
        user_feedback: string | null;
      };
      const typedData = data as MetricsRow[];

      const totalClassifications = typedData.length;
      const aiCallCount = typedData.filter(
        (d: MetricsRow) => d.ai_called,
      ).length;
      const cacheHitCount = typedData.filter(
        (d: MetricsRow) => d.cache_hit,
      ).length;
      const feedbackData = typedData.filter(
        (d: MetricsRow) => d.user_feedback !== null,
      );
      const acceptCount = feedbackData.filter(
        (d: MetricsRow) => d.user_feedback === "accept",
      ).length;

      const tierDistribution: Record<string, number> = {
        inbox: 0,
        tier1: 0,
        tier2: 0,
        tier3: 0,
      };

      typedData.forEach((d: MetricsRow) => {
        switch (d.tier) {
          case 0:
            tierDistribution.inbox++;
            break;
          case 1:
            tierDistribution.tier1++;
            break;
          case 2:
            tierDistribution.tier2++;
            break;
          case 3:
            tierDistribution.tier3++;
            break;
        }
      });

      return {
        totalClassifications,
        aiCallRate:
          totalClassifications > 0 ? aiCallCount / totalClassifications : 0,
        cacheHitRate:
          totalClassifications > 0 ? cacheHitCount / totalClassifications : 0,
        avgConfidence:
          typedData.reduce(
            (sum: number, d: MetricsRow) => sum + d.confidence,
            0,
          ) / totalClassifications,
        avgExecutionTimeMs:
          typedData.reduce(
            (sum: number, d: MetricsRow) => sum + d.execution_time_ms,
            0,
          ) / totalClassifications,
        acceptanceRate:
          feedbackData.length > 0 ? acceptCount / feedbackData.length : null,
        tierDistribution,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "ClassificationMetrics: Exception while getting user stats",
      );
      return null;
    }
  }
}

// Singleton instance
export const classificationMetricsService = new ClassificationMetricsService();
