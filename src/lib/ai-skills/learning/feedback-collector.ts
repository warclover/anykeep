/**
 * FeedbackCollector - 用户反馈收集器
 *
 * Phase 3 个性化学习核心组件
 *
 * 职责：
 * - 收集隐式反馈（根据用户行为推断）
 * - 收集显式反馈（用户主动评价）
 * - 批量写入数据库
 * - 提供反馈统计
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import type {
  UserFeedback,
  UserAction,
  UserBehavior,
  IntentMatchForFeedback,
  ExplicitFeedback,
  ExplicitRating,
  UserFeedbackStats,
  FeedbackCollectorConfig,
} from "./types";
import type { IntentType } from "../router/types";

// ============================================
// 常量配置
// ============================================

const DEFAULT_CONFIG: Required<FeedbackCollectorConfig> = {
  enableImplicitFeedback: true,
  enableExplicitFeedback: true,
  batchWriteThreshold: 10,
  writeIntervalMs: 5000,
  debug: false,
};

// ============================================
// FeedbackCollector 类
// ============================================

/**
 * 用户反馈收集器
 *
 * 支持隐式和显式两种反馈收集方式
 */
export class FeedbackCollector {
  private config: Required<FeedbackCollectorConfig>;
  private feedbackBuffer: UserFeedback[] = [];
  private writeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: FeedbackCollectorConfig = {}) {
    this.config = {
      enableImplicitFeedback:
        config.enableImplicitFeedback ?? DEFAULT_CONFIG.enableImplicitFeedback,
      enableExplicitFeedback:
        config.enableExplicitFeedback ?? DEFAULT_CONFIG.enableExplicitFeedback,
      batchWriteThreshold:
        config.batchWriteThreshold ?? DEFAULT_CONFIG.batchWriteThreshold,
      writeIntervalMs: config.writeIntervalMs ?? DEFAULT_CONFIG.writeIntervalMs,
      debug: config.debug ?? DEFAULT_CONFIG.debug,
    };
  }

  // ============================================
  // 隐式反馈收集
  // ============================================

  /**
   * 收集隐式反馈
   *
   * 根据用户行为自动推断反馈类型
   *
   * @param userId - 用户 ID
   * @param intent - 预测的意图
   * @param action - 用户行为动作
   * @returns 生成的反馈记录
   */
  collectImplicitFeedback(
    userId: string,
    intent: IntentMatchForFeedback,
    action: UserAction,
  ): UserFeedback {
    if (!this.config.enableImplicitFeedback) {
      throw new Error("Implicit feedback collection is disabled");
    }

    // 根据动作类型推断行为
    const behavior = this.inferBehaviorFromAction(action);

    const feedback: UserFeedback = {
      userId,
      sessionId: action.sessionId,
      turnId: action.turnId,
      originalInput: action.originalInput,
      predictedIntent: intent,
      actualBehavior: behavior,
      correctedType: action.correctedIntent
        ? this.parseIntentType(action.correctedIntent)
        : undefined,
      correctedSubType: action.correctedIntent
        ? this.parseIntentSubType(action.correctedIntent)
        : undefined,
      metadata: {
        actionType: action.type,
        collectionMethod: "implicit",
      },
      timestamp: action.timestamp,
    };

    if (this.config.debug) {
      logger.debug(
        {
          userId,
          behavior,
          intentType: intent.type,
          actionType: action.type,
        },
        "FeedbackCollector: Collected implicit feedback",
      );
    }

    // 添加到缓冲区
    this.addToBuffer(feedback);

    return feedback;
  }

  /**
   * 根据用户动作推断行为类型
   */
  private inferBehaviorFromAction(action: UserAction): UserBehavior {
    switch (action.type) {
      case "execute_success":
        return "accepted";
      case "manual_correction":
        return "corrected";
      case "cancel":
      case "retry_different":
      case "undo":
        return "abandoned";
      default:
        return "abandoned";
    }
  }

  /**
   * 解析意图类型（从 "type:subType" 格式）
   */
  private parseIntentType(intentString: string): string {
    const parts = intentString.split(":");
    return parts[0];
  }

  /**
   * 解析意图子类型（从 "type:subType" 格式）
   */
  private parseIntentSubType(intentString: string): string | undefined {
    const parts = intentString.split(":");
    return parts.length > 1 ? parts[1] : undefined;
  }

  // ============================================
  // 显式反馈收集
  // ============================================

  /**
   * 收集显式反馈
   *
   * 用户主动提供的评价
   *
   * @param userId - 用户 ID
   * @param sessionId - 会话 ID
   * @param turnId - 轮次 ID
   * @param rating - 评分
   * @param comment - 评论（可选）
   */
  async collectExplicitFeedback(
    userId: string,
    sessionId: string,
    turnId: string,
    rating: ExplicitRating,
    comment?: string,
  ): Promise<void> {
    if (!this.config.enableExplicitFeedback) {
      throw new Error("Explicit feedback collection is disabled");
    }

    const feedback: ExplicitFeedback = {
      userId,
      sessionId,
      turnId,
      rating,
      comment,
      timestamp: new Date(),
    };

    if (this.config.debug) {
      logger.debug(
        {
          userId,
          sessionId,
          turnId,
          rating,
        },
        "FeedbackCollector: Collected explicit feedback",
      );
    }

    // 显式反馈直接写入数据库
    await this.writeExplicitFeedback(feedback);
  }

  /**
   * 写入显式反馈到数据库
   */
  private async writeExplicitFeedback(
    feedback: ExplicitFeedback,
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // Type assertion for update chain
      type UpdateChain = {
        update: (data: unknown) => {
          eq: (
            col: string,
            val: string,
          ) => {
            eq: (
              col: string,
              val: string,
            ) => {
              eq: (col: string, val: string) => Promise<{ error: unknown }>;
            };
          };
        };
      };
      type FeedbackUpdate = {
        from: (table: string) => UpdateChain;
      };

      // 更新对应的意图反馈记录，添加显式评价
      const { error } = await (supabase as unknown as FeedbackUpdate)
        .from("ai_intent_feedback")
        .update({
          metadata: {
            explicit_rating: feedback.rating,
            explicit_comment: feedback.comment,
            explicit_timestamp: feedback.timestamp.toISOString(),
          },
        })
        .eq("user_id", feedback.userId)
        .eq("session_id", feedback.sessionId)
        .eq("turn_id", feedback.turnId);

      if (error) {
        logger.error(
          { error, feedback },
          "FeedbackCollector: Failed to write explicit feedback",
        );
      }
    } catch (error) {
      logger.error(
        { error },
        "FeedbackCollector: Error writing explicit feedback",
      );
    }
  }

  // ============================================
  // 缓冲区管理
  // ============================================

  /**
   * 添加反馈到缓冲区
   */
  private addToBuffer(feedback: UserFeedback): void {
    this.feedbackBuffer.push(feedback);

    // 检查是否达到批量写入阈值
    if (this.feedbackBuffer.length >= this.config.batchWriteThreshold) {
      this.flushBuffer();
    } else {
      // 启动定时器
      this.scheduleFlush();
    }
  }

  /**
   * 调度缓冲区刷新
   */
  private scheduleFlush(): void {
    if (this.writeTimer) {
      return; // 已有定时器
    }

    this.writeTimer = setTimeout(() => {
      this.flushBuffer();
    }, this.config.writeIntervalMs);
  }

  /**
   * 刷新缓冲区，写入数据库
   */
  async flushBuffer(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }

    if (this.feedbackBuffer.length === 0) {
      return;
    }

    const feedbacksToWrite = [...this.feedbackBuffer];
    this.feedbackBuffer = [];

    try {
      await this.writeFeedbackBatch(feedbacksToWrite);

      if (this.config.debug) {
        logger.debug(
          { count: feedbacksToWrite.length },
          "FeedbackCollector: Flushed feedback buffer",
        );
      }
    } catch (error) {
      logger.error(
        { error, count: feedbacksToWrite.length },
        "FeedbackCollector: Failed to flush buffer, re-queuing",
      );
      // 失败时重新加入缓冲区
      this.feedbackBuffer = [...feedbacksToWrite, ...this.feedbackBuffer];
    }
  }

  /**
   * 批量写入反馈到数据库
   */
  private async writeFeedbackBatch(feedbacks: UserFeedback[]): Promise<void> {
    const supabase = await createClient();

    const records = feedbacks.map((f) => ({
      user_id: f.userId,
      session_id: f.sessionId,
      turn_id: f.turnId,
      original_input: f.originalInput,
      predicted_type: f.predictedIntent.type,
      predicted_subtype: f.predictedIntent.subType ?? null,
      predicted_confidence: f.predictedIntent.confidence,
      actual_behavior: f.actualBehavior,
      corrected_type: f.correctedType ?? null,
      corrected_subtype: f.correctedSubType ?? null,
      metadata: f.metadata ?? {},
      created_at: f.timestamp.toISOString(),
    }));

    // Type assertion for untyped database table
    const { error } = await (
      supabase as unknown as {
        from: (table: string) => {
          insert: (data: unknown) => Promise<{ error: unknown }>;
        };
      }
    )
      .from("ai_intent_feedback")
      .insert(records);

    if (error) {
      throw error;
    }

    logger.info(
      { count: records.length },
      "FeedbackCollector: Wrote feedback batch to database",
    );
  }

  // ============================================
  // 统计查询
  // ============================================

  /**
   * 获取用户反馈统计
   *
   * @param userId - 用户 ID
   * @returns 反馈统计信息
   */
  async getUserFeedbackStats(userId: string): Promise<UserFeedbackStats> {
    const supabase = await createClient();

    // 调用数据库函数（类型断言用于未定义的 RPC 函数）
    const { data, error } = await (
      supabase as unknown as {
        rpc: (
          fn: string,
          params: Record<string, unknown>,
        ) => Promise<{ data: unknown[]; error: unknown }>;
      }
    ).rpc("get_user_feedback_stats", {
      p_user_id: userId,
    });

    if (error) {
      logger.error(
        { error, userId },
        "FeedbackCollector: Failed to get user feedback stats",
      );
      throw error;
    }

    const stats = data?.[0] as
      | {
          total_count?: number;
          accepted_count?: number;
          corrected_count?: number;
          abandoned_count?: number;
          acceptance_rate?: number;
          top_corrected_types?: Array<{
            type: string;
            subtype: string | null;
            count: number;
          }>;
        }
      | undefined;
    if (!stats) {
      return {
        totalCount: 0,
        acceptedCount: 0,
        correctedCount: 0,
        abandonedCount: 0,
        acceptanceRate: 0,
        topCorrectedTypes: [],
      };
    }

    return {
      totalCount: Number(stats.total_count) || 0,
      acceptedCount: Number(stats.accepted_count) || 0,
      correctedCount: Number(stats.corrected_count) || 0,
      abandonedCount: Number(stats.abandoned_count) || 0,
      acceptanceRate: Number(stats.acceptance_rate) || 0,
      topCorrectedTypes: stats.top_corrected_types ?? [],
    };
  }

  /**
   * 获取最近的反馈记录
   *
   * @param userId - 用户 ID
   * @param limit - 返回数量限制
   * @returns 反馈记录列表
   */
  async getRecentFeedback(
    userId: string,
    limit: number = 50,
  ): Promise<UserFeedback[]> {
    const supabase = await createClient();

    // Type assertion for untyped database table
    type FeedbackQuery = {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (
                n: number,
              ) => Promise<{ data: unknown[] | null; error: unknown }>;
            };
          };
        };
      };
    };
    const { data, error } = await (supabase as unknown as FeedbackQuery)
      .from("ai_intent_feedback")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error(
        { error, userId },
        "FeedbackCollector: Failed to get recent feedback",
      );
      throw error;
    }

    // Type for database row
    type FeedbackRow = {
      user_id: string;
      session_id: string;
      turn_id: string;
      original_input: string;
      predicted_type: string;
      predicted_subtype: string | null;
      predicted_confidence: number;
      actual_behavior: string;
      corrected_type: string | null;
      corrected_subtype: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
    };

    return ((data || []) as FeedbackRow[]).map(
      (row): UserFeedback => ({
        userId: row.user_id,
        sessionId: row.session_id,
        turnId: row.turn_id,
        originalInput: row.original_input,
        predictedIntent: {
          type: row.predicted_type as IntentType,
          subType: row.predicted_subtype ?? undefined,
          confidence: Number(row.predicted_confidence),
        },
        actualBehavior: row.actual_behavior as UserBehavior,
        correctedType: row.corrected_type ?? undefined,
        correctedSubType: row.corrected_subtype ?? undefined,
        metadata: row.metadata,
        timestamp: new Date(row.created_at),
      }),
    );
  }

  /**
   * 获取失败案例（用于模式发现）
   *
   * @param options - 查询选项
   * @returns 失败的反馈记录
   */
  async getFailedCases(
    options: {
      limit?: number;
      since?: Date;
      minOccurrences?: number;
    } = {},
  ): Promise<UserFeedback[]> {
    const { limit = 100, since, minOccurrences = 1 } = options;
    const supabase = await createClient();

    // Type assertion for untyped database table with chainable query
    type ChainableQuery = {
      select: (cols: string) => ChainableQuery;
      in: (col: string, vals: string[]) => ChainableQuery;
      order: (col: string, opts: { ascending: boolean }) => ChainableQuery;
      limit: (n: number) => ChainableQuery;
      gte: (col: string, val: string) => ChainableQuery;
      then: <T>(
        resolve: (value: { data: unknown[] | null; error: unknown }) => T,
      ) => Promise<T>;
    };
    type FeedbackQuery = {
      from: (table: string) => ChainableQuery;
    };

    let query = (supabase as unknown as FeedbackQuery)
      .from("ai_intent_feedback")
      .select("*")
      .in("actual_behavior", ["corrected", "abandoned"])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gte("created_at", since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error }, "FeedbackCollector: Failed to get failed cases");
      throw error;
    }

    // Type for database row
    type FeedbackRow = {
      user_id: string;
      session_id: string;
      turn_id: string;
      original_input: string;
      predicted_type: string;
      predicted_subtype: string | null;
      predicted_confidence: number;
      actual_behavior: string;
      corrected_type: string | null;
      corrected_subtype: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
    };

    const feedbacks: UserFeedback[] = ((data || []) as FeedbackRow[]).map(
      (row): UserFeedback => ({
        userId: row.user_id,
        sessionId: row.session_id,
        turnId: row.turn_id,
        originalInput: row.original_input,
        predictedIntent: {
          type: row.predicted_type as IntentType,
          subType: row.predicted_subtype ?? undefined,
          confidence: Number(row.predicted_confidence),
        },
        actualBehavior: row.actual_behavior as UserBehavior,
        correctedType: row.corrected_type ?? undefined,
        correctedSubType: row.corrected_subtype ?? undefined,
        metadata: row.metadata,
        timestamp: new Date(row.created_at),
      }),
    );

    // 过滤最小出现次数
    if (minOccurrences > 1) {
      const inputCounts = new Map<string, number>();
      for (const f of feedbacks) {
        const count = inputCounts.get(f.originalInput) || 0;
        inputCounts.set(f.originalInput, count + 1);
      }

      return feedbacks.filter(
        (f) => (inputCounts.get(f.originalInput) || 0) >= minOccurrences,
      );
    }

    return feedbacks;
  }

  // ============================================
  // 生命周期管理
  // ============================================

  /**
   * 销毁收集器，刷新所有待写入的数据
   */
  async destroy(): Promise<void> {
    await this.flushBuffer();

    if (this.config.debug) {
      logger.debug("FeedbackCollector: Destroyed");
    }
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 FeedbackCollector 实例
 */
export function createFeedbackCollector(
  config?: FeedbackCollectorConfig,
): FeedbackCollector {
  return new FeedbackCollector(config);
}
