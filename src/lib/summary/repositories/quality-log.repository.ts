/**
 * Quality Log Repository
 *
 * 质量日志仓库实现
 *
 * @version 2.0.0
 * @since 2025-12-12
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";
import type {
  QualityLogEntry,
  QualityStats,
  UserFeedback,
  ProviderName,
} from "../summary.types";
import type {
  IQualityLogRepository,
  TimeRange,
  ProviderUsageStats,
  ProviderCallStats,
} from "./summary.repository.interface";

/**
 * 质量日志仓库实现
 *
 * @example
 * ```typescript
 * const repo = new QualityLogRepository(supabase);
 *
 * // 记录质量日志
 * await repo.logQuality({
 *   bookmarkId: 123,
 *   userId: 'user-uuid',
 *   providerUsed: 'deepseek',
 *   // ...
 * });
 *
 * // 获取统计
 * const stats = await repo.getQualityStats('user-uuid');
 * ```
 */
export class QualityLogRepository implements IQualityLogRepository {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 记录质量日志
   */
  async logQuality(log: QualityLogEntry): Promise<void> {
    try {
      // 注意：表名在数据库中用下划线分隔
      const { error } = await this.supabase
        .from("summary_quality_logs" as never)
        .insert({
          bookmark_id: log.bookmarkId,
          user_id: log.userId,
          content_length: log.contentLength,
          content_type: log.contentType,
          provider_used: log.providerUsed,
          model_used: log.modelUsed,
          prompt_version: log.promptVersion,
          summary_version: 2, // V2 JSON 格式
          summary_length: log.summaryLength,
          tags_count: log.tagsCount,
          latency_ms: log.latencyMs,
          tokens_input: log.tokensInput,
          tokens_output: log.tokensOutput,
          estimated_cost_cents: log.estimatedCost,
          auto_quality_score: log.autoQualityScore,
          error_code: log.errorCode,
          error_message: log.errorMessage,
          fallback_used: log.fallbackUsed,
          retry_count: 0,
        } as never);

      if (error) {
        logger.error(
          {
            error: error.message,
            bookmarkId: log.bookmarkId,
          },
          "QualityLogRepository: Failed to log quality",
        );
        throw error;
      }

      logger.debug(
        {
          bookmarkId: log.bookmarkId,
          provider: log.providerUsed,
          latencyMs: log.latencyMs,
        },
        "QualityLogRepository: Quality logged",
      );
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "QualityLogRepository: logQuality failed",
      );
      throw error;
    }
  }

  /**
   * 获取质量统计
   */
  async getQualityStats(
    userId: string,
    timeRange?: TimeRange,
  ): Promise<QualityStats> {
    try {
      let query = this.supabase
        .from("summary_quality_logs" as never)
        .select("*")
        .eq("user_id", userId);

      if (timeRange) {
        query = query
          .gte("created_at", timeRange.start.toISOString())
          .lte("created_at", timeRange.end.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        logger.error(
          { error: error.message, userId },
          "QualityLogRepository: Failed to get quality stats",
        );
        throw error;
      }

      const logs = (data || []) as Array<{
        error_code: string | null;
        latency_ms: number | null;
        auto_quality_score: number | null;
        fallback_used: boolean | null;
        provider_used: string;
      }>;

      const successLogs = logs.filter((l) => !l.error_code);
      const failedLogs = logs.filter((l) => l.error_code);

      const avgLatency =
        successLogs.length > 0
          ? successLogs.reduce((sum, l) => sum + (l.latency_ms || 0), 0) /
            successLogs.length
          : 0;

      const avgQuality =
        successLogs.length > 0
          ? successLogs.reduce(
              (sum, l) => sum + (l.auto_quality_score || 0),
              0,
            ) / successLogs.length
          : 0;

      const fallbackCount = logs.filter((l) => l.fallback_used).length;

      // 计算 Provider 分布
      const providerCounts: Record<string, number> = {};
      for (const log of logs) {
        const provider = log.provider_used;
        providerCounts[provider] = (providerCounts[provider] || 0) + 1;
      }

      return {
        totalCount: logs.length,
        successCount: successLogs.length,
        failedCount: failedLogs.length,
        averageLatencyMs: Math.round(avgLatency),
        averageQualityScore: Number(avgQuality.toFixed(3)),
        fallbackRate:
          logs.length > 0
            ? Number(((fallbackCount / logs.length) * 100).toFixed(2))
            : 0,
        providerDistribution: providerCounts as Record<ProviderName, number>,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "QualityLogRepository: getQualityStats failed",
      );
      throw error;
    }
  }

  /**
   * 记录用户反馈
   */
  async recordUserFeedback(
    bookmarkId: number,
    userId: string,
    rating: number,
    feedback?: string,
  ): Promise<void> {
    try {
      // 查找最近的质量日志
      const { data: existingLog, error: selectError } = await this.supabase
        .from("summary_quality_logs" as never)
        .select("id")
        .eq("bookmark_id", bookmarkId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        // PGRST116 = no rows
        throw selectError;
      }

      if (existingLog) {
        // 更新已有记录
        const { error: updateError } = await this.supabase
          .from("summary_quality_logs" as never)
          .update({
            user_rating: rating,
            user_feedback: feedback,
          } as never)
          .eq("id", (existingLog as { id: number }).id);

        if (updateError) {
          throw updateError;
        }

        logger.info(
          { bookmarkId, userId, rating },
          "QualityLogRepository: User feedback recorded (updated)",
        );
      } else {
        // 创建新记录（仅包含反馈）
        const { error: insertError } = await this.supabase
          .from("summary_quality_logs" as never)
          .insert({
            bookmark_id: bookmarkId,
            user_id: userId,
            provider_used: "unknown",
            model_used: "unknown",
            user_rating: rating,
            user_feedback: feedback,
          } as never);

        if (insertError) {
          throw insertError;
        }

        logger.info(
          { bookmarkId, userId, rating },
          "QualityLogRepository: User feedback recorded (new)",
        );
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          bookmarkId,
        },
        "QualityLogRepository: recordUserFeedback failed",
      );
      throw error;
    }
  }

  /**
   * 获取用户反馈列表
   */
  async getUserFeedbacks(
    userId: string,
    limit: number = 50,
  ): Promise<UserFeedback[]> {
    try {
      const { data, error } = await this.supabase
        .from("summary_quality_logs" as never)
        .select("bookmark_id, user_rating, user_feedback, created_at")
        .eq("user_id", userId)
        .not("user_rating", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (
        (data || []) as Array<{
          bookmark_id: number;
          user_rating: number;
          user_feedback: string | null;
          created_at: string;
        }>
      ).map((row) => ({
        bookmarkId: row.bookmark_id,
        rating: row.user_rating,
        feedback: row.user_feedback || undefined,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "QualityLogRepository: getUserFeedbacks failed",
      );
      throw error;
    }
  }

  /**
   * 获取 Provider 使用统计
   */
  async getProviderUsageStats(
    userId: string,
    timeRange?: TimeRange,
  ): Promise<ProviderUsageStats> {
    try {
      // 使用数据库函数获取统计
      const days = timeRange
        ? Math.ceil(
            (timeRange.end.getTime() - timeRange.start.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 30;

      const { data, error } = await this.supabase.rpc(
        "get_summary_provider_stats" as never,
        {
          p_user_id: userId,
          p_days: days,
        } as never,
      );

      if (error) {
        // 如果 RPC 不存在，使用备用查询
        logger.warn(
          { error: error.message },
          "QualityLogRepository: RPC failed, using fallback query",
        );
        return this.getProviderUsageStatsFallback(userId, timeRange);
      }

      // 转换结果
      const byProvider: Record<ProviderName, ProviderCallStats> = {
        deepseek: {
          count: 0,
          successCount: 0,
          failedCount: 0,
          avgLatencyMs: 0,
          totalTokens: 0,
        },
        "aliyun-bailian": {
          count: 0,
          successCount: 0,
          failedCount: 0,
          avgLatencyMs: 0,
          totalTokens: 0,
        },
        ollama: {
          count: 0,
          successCount: 0,
          failedCount: 0,
          avgLatencyMs: 0,
          totalTokens: 0,
        },
        local: {
          count: 0,
          successCount: 0,
          failedCount: 0,
          avgLatencyMs: 0,
          totalTokens: 0,
        },
      };

      let totalCalls = 0;

      for (const row of (data || []) as Array<{
        provider: string;
        total_calls: number;
        success_count: number;
        error_count: number;
        avg_latency_ms: number;
        total_tokens: number;
      }>) {
        const provider = row.provider as ProviderName;
        if (byProvider[provider]) {
          byProvider[provider] = {
            count: Number(row.total_calls),
            successCount: Number(row.success_count),
            failedCount: Number(row.error_count),
            avgLatencyMs: Number(row.avg_latency_ms) || 0,
            totalTokens: Number(row.total_tokens) || 0,
          };
          totalCalls += Number(row.total_calls);
        }
      }

      return {
        totalCalls,
        byProvider,
      };
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "QualityLogRepository: getProviderUsageStats failed",
      );
      throw error;
    }
  }

  /**
   * Provider 统计备用查询
   */
  private async getProviderUsageStatsFallback(
    userId: string,
    timeRange?: TimeRange,
  ): Promise<ProviderUsageStats> {
    let query = this.supabase
      .from("summary_quality_logs" as never)
      .select(
        "provider_used, error_code, latency_ms, tokens_input, tokens_output",
      )
      .eq("user_id", userId);

    if (timeRange) {
      query = query
        .gte("created_at", timeRange.start.toISOString())
        .lte("created_at", timeRange.end.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const logs = (data || []) as Array<{
      provider_used: string;
      error_code: string | null;
      latency_ms: number | null;
      tokens_input: number | null;
      tokens_output: number | null;
    }>;

    const byProvider: Record<ProviderName, ProviderCallStats> = {
      deepseek: {
        count: 0,
        successCount: 0,
        failedCount: 0,
        avgLatencyMs: 0,
        totalTokens: 0,
      },
      "aliyun-bailian": {
        count: 0,
        successCount: 0,
        failedCount: 0,
        avgLatencyMs: 0,
        totalTokens: 0,
      },
      ollama: {
        count: 0,
        successCount: 0,
        failedCount: 0,
        avgLatencyMs: 0,
        totalTokens: 0,
      },
      local: {
        count: 0,
        successCount: 0,
        failedCount: 0,
        avgLatencyMs: 0,
        totalTokens: 0,
      },
    };

    const latencies: Record<string, number[]> = {};

    for (const log of logs) {
      const provider = log.provider_used as ProviderName;
      if (!byProvider[provider]) continue;

      byProvider[provider].count++;
      if (log.error_code) {
        byProvider[provider].failedCount++;
      } else {
        byProvider[provider].successCount++;
      }
      byProvider[provider].totalTokens +=
        (log.tokens_input || 0) + (log.tokens_output || 0);

      if (log.latency_ms) {
        if (!latencies[provider]) latencies[provider] = [];
        latencies[provider].push(log.latency_ms);
      }
    }

    // 计算平均延迟
    for (const provider of Object.keys(latencies)) {
      const arr = latencies[provider];
      if (arr.length > 0) {
        byProvider[provider as ProviderName].avgLatencyMs = Math.round(
          arr.reduce((a, b) => a + b, 0) / arr.length,
        );
      }
    }

    return {
      totalCalls: logs.length,
      byProvider,
    };
  }

  /**
   * 清理过期日志
   */
  async cleanupOldLogs(daysOld: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data, error } = await this.supabase
        .from("summary_quality_logs" as never)
        .delete()
        .lt("created_at", cutoffDate.toISOString())
        .select("id");

      if (error) {
        throw error;
      }

      const deletedCount = (data || []).length;

      logger.info(
        { daysOld, deletedCount },
        "QualityLogRepository: Old logs cleaned up",
      );

      return deletedCount;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "QualityLogRepository: cleanupOldLogs failed",
      );
      throw error;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let repositoryInstance: QualityLogRepository | null = null;

/**
 * 获取 QualityLogRepository 实例
 */
export function getQualityLogRepository(
  supabase: SupabaseClient<Database>,
): QualityLogRepository {
  if (!repositoryInstance) {
    repositoryInstance = new QualityLogRepository(supabase);
  }
  return repositoryInstance;
}

/**
 * 重置 QualityLogRepository 实例（主要用于测试）
 */
export function resetQualityLogRepository(): void {
  repositoryInstance = null;
}
