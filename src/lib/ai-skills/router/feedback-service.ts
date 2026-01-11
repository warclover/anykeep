/**
 * FeedbackService - 意图反馈收集服务
 *
 * 收集用户对意图分类结果的反馈，支持隐式和显式两种方式
 *
 * 隐式反馈:
 * - 用户接受并执行了建议的操作 → accepted
 * - 用户纠正了意图（重新输入） → corrected
 * - 用户放弃/取消了操作 → abandoned
 *
 * 显式反馈:
 * - 用户点击"这不是我想要的"按钮
 * - 用户选择正确的意图类型
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import { createClient } from "@/lib/supabase/client";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { FeatureFlags } from "@/lib/ai-agent/config/feature-flags";

// ============================================
// 类型定义
// ============================================

/**
 * 反馈行为类型
 */
export type FeedbackBehavior = "accepted" | "corrected" | "abandoned";

/**
 * 反馈来源
 */
export type FeedbackSource = "implicit" | "explicit" | "auto";

/**
 * 反馈记录
 */
export interface FeedbackRecord {
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  sessionId: string;
  /** 对话轮次 ID */
  turnId: string;
  /** 原始用户输入 */
  originalInput: string;
  /** AI 预测的意图类型 */
  predictedType: string;
  /** AI 预测的意图子类型 */
  predictedSubtype: string | null;
  /** AI 预测的置信度 */
  predictedConfidence: number;
  /** 用户实际行为 */
  actualBehavior: FeedbackBehavior;
  /** 用户纠正后的意图类型（如果有） */
  correctedType?: string;
  /** 用户纠正后的意图子类型（如果有） */
  correctedSubtype?: string;
  /** 反馈来源 */
  source: FeedbackSource;
  /** 附加元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 反馈统计
 */
export interface FeedbackStats {
  /** 用户 ID */
  userId: string;
  /** 总反馈数 */
  totalCount: number;
  /** 接受数 */
  acceptedCount: number;
  /** 纠正数 */
  correctedCount: number;
  /** 放弃数 */
  abandonedCount: number;
  /** 接受率 */
  acceptanceRate: number;
  /** 最常被纠正的意图类型 */
  topCorrectedTypes: Array<{
    type: string;
    subtype: string | null;
    count: number;
  }>;
}

/**
 * 服务配置
 */
export interface FeedbackServiceConfig {
  /** 是否启用（受 Feature Flag 控制） */
  enabled: boolean;
  /** 是否使用批量写入 */
  batchWrite: boolean;
  /** 批量写入阈值 */
  batchSize: number;
  /** 批量写入间隔（毫秒） */
  batchIntervalMs: number;
}

// ============================================
// 默认配置
// ============================================

export const DEFAULT_FEEDBACK_SERVICE_CONFIG: FeedbackServiceConfig = {
  enabled: true,
  batchWrite: true,
  batchSize: 10,
  batchIntervalMs: 5000,
};

// ============================================
// FeedbackService 类
// ============================================

/**
 * 意图反馈收集服务
 *
 * @example
 * ```typescript
 * const feedbackService = new FeedbackService();
 *
 * // 记录隐式反馈（用户接受了建议）
 * await feedbackService.recordFeedback({
 *   userId: 'user-123',
 *   sessionId: 'session-456',
 *   turnId: 'turn-789',
 *   originalInput: '搜索 React 教程',
 *   predictedType: 'query',
 *   predictedSubtype: 'search',
 *   predictedConfidence: 0.92,
 *   actualBehavior: 'accepted',
 *   source: 'implicit',
 * });
 *
 * // 获取用户反馈统计
 * const stats = await feedbackService.getUserStats('user-123');
 * ```
 */
export class FeedbackService {
  private config: FeedbackServiceConfig;
  private pendingFeedbacks: FeedbackRecord[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isServer: boolean;

  constructor(config?: Partial<FeedbackServiceConfig>) {
    this.config = { ...DEFAULT_FEEDBACK_SERVICE_CONFIG, ...config };
    this.isServer = typeof window === "undefined";

    // 启动批量写入定时器
    if (this.config.batchWrite && this.config.enabled) {
      this.startFlushTimer();
    }

    logger.debug(
      { config: this.config, isServer: this.isServer },
      "FeedbackService: Initialized",
    );
  }

  /**
   * 记录反馈
   */
  async recordFeedback(record: FeedbackRecord): Promise<boolean> {
    // 检查 Feature Flag
    if (!FeatureFlags.ENABLE_FEEDBACK_COLLECTION) {
      logger.debug("FeedbackService: Feedback collection is disabled");
      return false;
    }

    if (!this.config.enabled) {
      return false;
    }

    if (this.config.batchWrite) {
      // 批量模式：添加到队列
      this.pendingFeedbacks.push(record);

      if (this.pendingFeedbacks.length >= this.config.batchSize) {
        await this.flush();
      }

      return true;
    } else {
      // 立即写入
      return this.writeFeedback(record);
    }
  }

  /**
   * 记录用户接受反馈（快捷方法）
   */
  async recordAccepted(params: {
    userId: string;
    sessionId: string;
    turnId: string;
    originalInput: string;
    predictedType: string;
    predictedSubtype?: string;
    predictedConfidence: number;
    source?: FeedbackSource;
    metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    return this.recordFeedback({
      ...params,
      predictedSubtype: params.predictedSubtype ?? null,
      actualBehavior: "accepted",
      source: params.source ?? "implicit",
    });
  }

  /**
   * 记录用户纠正反馈（快捷方法）
   */
  async recordCorrected(params: {
    userId: string;
    sessionId: string;
    turnId: string;
    originalInput: string;
    predictedType: string;
    predictedSubtype?: string;
    predictedConfidence: number;
    correctedType: string;
    correctedSubtype?: string;
    source?: FeedbackSource;
    metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    return this.recordFeedback({
      ...params,
      predictedSubtype: params.predictedSubtype ?? null,
      actualBehavior: "corrected",
      source: params.source ?? "implicit",
    });
  }

  /**
   * 记录用户放弃反馈（快捷方法）
   */
  async recordAbandoned(params: {
    userId: string;
    sessionId: string;
    turnId: string;
    originalInput: string;
    predictedType: string;
    predictedSubtype?: string;
    predictedConfidence: number;
    source?: FeedbackSource;
    metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    return this.recordFeedback({
      ...params,
      predictedSubtype: params.predictedSubtype ?? null,
      actualBehavior: "abandoned",
      source: params.source ?? "implicit",
    });
  }

  /**
   * 获取用户反馈统计
   */
  async getUserStats(userId: string): Promise<FeedbackStats | null> {
    try {
      const supabase = this.isServer
        ? await createServiceClient()
        : createClient();

      // 调用 RPC 函数获取统计
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(
        "get_user_feedback_stats",
        {
          p_user_id: userId,
        },
      );

      if (error) {
        logger.error(
          { error: error.message, userId },
          "FeedbackService: Failed to get user stats",
        );
        return null;
      }

      if (!data) {
        return {
          userId,
          totalCount: 0,
          acceptedCount: 0,
          correctedCount: 0,
          abandonedCount: 0,
          acceptanceRate: 0,
          topCorrectedTypes: [],
        };
      }

      return {
        userId,
        totalCount: data.total_count ?? 0,
        acceptedCount: data.accepted_count ?? 0,
        correctedCount: data.corrected_count ?? 0,
        abandonedCount: data.abandoned_count ?? 0,
        acceptanceRate: data.acceptance_rate ?? 0,
        topCorrectedTypes: data.top_corrected_types ?? [],
      };
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err), userId },
        "FeedbackService: Error getting user stats",
      );
      return null;
    }
  }

  /**
   * 获取全局反馈统计（服务端专用）
   */
  async getGlobalStats(): Promise<{
    totalFeedbacks: number;
    acceptanceRate: number;
    topCorrectedIntents: Array<{
      type: string;
      subtype: string | null;
      count: number;
    }>;
    recentTrend: {
      last7Days: { accepted: number; corrected: number; abandoned: number };
      last30Days: { accepted: number; corrected: number; abandoned: number };
    };
  } | null> {
    if (!this.isServer) {
      logger.warn("FeedbackService: getGlobalStats is server-side only");
      return null;
    }

    try {
      const supabase = await createServiceClient();

      // 获取总体统计
      const { data: totalData, error: totalError } = await supabase
        .from("ai_intent_feedback")
        .select("actual_behavior", { count: "exact" });

      if (totalError) {
        throw totalError;
      }

      const total = totalData?.length ?? 0;
      const accepted =
        totalData?.filter((r) => r.actual_behavior === "accepted").length ?? 0;
      // Note: corrected and abandoned counts calculated but reserved for future use
      const _corrected =
        totalData?.filter((r) => r.actual_behavior === "corrected").length ?? 0;
      const _abandoned =
        totalData?.filter((r) => r.actual_behavior === "abandoned").length ?? 0;
      void _corrected; // Suppress unused variable warning
      void _abandoned; // Suppress unused variable warning

      // 获取最常被纠正的意图
      const { data: topCorrected } = await supabase
        .from("ai_intent_feedback")
        .select("predicted_type, predicted_subtype")
        .eq("actual_behavior", "corrected")
        .limit(1000);

      const correctedCounts = new Map<string, number>();
      for (const row of topCorrected ?? []) {
        const key = `${row.predicted_type}:${row.predicted_subtype ?? ""}`;
        correctedCounts.set(key, (correctedCounts.get(key) ?? 0) + 1);
      }

      const topCorrectedIntents = Array.from(correctedCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => {
          const [type, subtype] = key.split(":");
          return { type, subtype: subtype || null, count };
        });

      // 最近趋势（简化版，后续可优化）
      const now = new Date();
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const { data: recent7 } = await supabase
        .from("ai_intent_feedback")
        .select("actual_behavior")
        .gte("created_at", last7Days.toISOString());

      const { data: recent30 } = await supabase
        .from("ai_intent_feedback")
        .select("actual_behavior")
        .gte("created_at", last30Days.toISOString());

      const countBehaviors = (
        data: Array<{ actual_behavior: string }> | null,
      ) => ({
        accepted:
          data?.filter((r) => r.actual_behavior === "accepted").length ?? 0,
        corrected:
          data?.filter((r) => r.actual_behavior === "corrected").length ?? 0,
        abandoned:
          data?.filter((r) => r.actual_behavior === "abandoned").length ?? 0,
      });

      return {
        totalFeedbacks: total,
        acceptanceRate: total > 0 ? accepted / total : 0,
        topCorrectedIntents,
        recentTrend: {
          last7Days: countBehaviors(recent7),
          last30Days: countBehaviors(recent30),
        },
      };
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "FeedbackService: Error getting global stats",
      );
      return null;
    }
  }

  /**
   * 刷新待写入的反馈
   */
  async flush(): Promise<number> {
    if (this.pendingFeedbacks.length === 0) {
      return 0;
    }

    const toWrite = [...this.pendingFeedbacks];
    this.pendingFeedbacks = [];

    let written = 0;
    for (const record of toWrite) {
      const success = await this.writeFeedback(record);
      if (success) {
        written++;
      }
    }

    logger.debug(
      { written, total: toWrite.length },
      "FeedbackService: Flushed pending feedbacks",
    );

    return written;
  }

  /**
   * 停止服务（清理定时器）
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // 尝试刷新剩余的反馈
    if (this.pendingFeedbacks.length > 0) {
      this.flush().catch((err) => {
        logger.error(
          { error: err instanceof Error ? err.message : String(err) },
          "FeedbackService: Failed to flush on stop",
        );
      });
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 写入单条反馈
   */
  private async writeFeedback(record: FeedbackRecord): Promise<boolean> {
    try {
      const supabase = this.isServer
        ? await createServiceClient()
        : createClient();

      const { error } = await supabase.from("ai_intent_feedback").insert({
        user_id: record.userId,
        session_id: record.sessionId,
        turn_id: record.turnId,
        original_input: record.originalInput,
        predicted_type: record.predictedType,
        predicted_subtype: record.predictedSubtype,
        predicted_confidence: record.predictedConfidence,
        actual_behavior: record.actualBehavior,
        corrected_type: record.correctedType ?? null,
        corrected_subtype: record.correctedSubtype ?? null,
        metadata: {
          ...record.metadata,
          source: record.source,
        },
      });

      if (error) {
        logger.error(
          {
            error: error.message,
            record: {
              ...record,
              originalInput: record.originalInput.slice(0, 30),
            },
          },
          "FeedbackService: Failed to write feedback",
        );
        return false;
      }

      logger.debug(
        {
          userId: record.userId,
          behavior: record.actualBehavior,
          predictedType: record.predictedType,
        },
        "FeedbackService: Feedback recorded",
      );

      return true;
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "FeedbackService: Error writing feedback",
      );
      return false;
    }
  }

  /**
   * 启动定时刷新
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      if (this.pendingFeedbacks.length > 0) {
        this.flush().catch((err) => {
          logger.error(
            { error: err instanceof Error ? err.message : String(err) },
            "FeedbackService: Flush timer error",
          );
        });
      }
    }, this.config.batchIntervalMs);
  }
}

// ============================================
// 单例管理
// ============================================

let feedbackServiceInstance: FeedbackService | null = null;

/**
 * 获取 FeedbackService 单例
 */
export function getFeedbackService(
  config?: Partial<FeedbackServiceConfig>,
): FeedbackService {
  if (!feedbackServiceInstance) {
    feedbackServiceInstance = new FeedbackService(config);
    logger.debug("FeedbackService: Singleton created");
  }
  return feedbackServiceInstance;
}

/**
 * 重置 FeedbackService 单例
 * @internal 仅用于测试
 */
export function resetFeedbackService(): void {
  if (feedbackServiceInstance) {
    feedbackServiceInstance.stop();
    feedbackServiceInstance = null;
  }
  logger.debug("FeedbackService: Singleton reset");
}
