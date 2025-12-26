/**
 * FeedbackService - AI 反馈服务
 *
 * 职责：
 * - 收集用户对 AI 回答的反馈
 * - 提供反馈统计分析
 * - 与 CorrectionLearner 集成（负反馈触发学习）
 *
 * @module ai-feedback
 * @version 1.0.0
 * @since 2025-12-26
 */

import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { correctionLearner } from "@/lib/ai-learning";
import type { IntentType } from "@/lib/ai-learning";
import type {
  FeedbackRecord,
  FeedbackType,
  NegativeFeedbackReason,
  CreateFeedbackParams,
  FeedbackStats,
  NegativeReasonDistribution,
  FeedbackServiceResult,
} from "./types";

/**
 * AI 反馈服务
 */
export class FeedbackService {
  /**
   * 提交反馈
   */
  async submitFeedback(
    params: CreateFeedbackParams,
  ): Promise<FeedbackServiceResult<{ id: string }>> {
    try {
      const supabase = createClient();

      logger.info(
        {
          userId: params.userId,
          type: params.type,
          messageId: params.messageId,
        },
        "FeedbackService: Submitting feedback",
      );

      const { data, error } = await supabase
        .from("ai_feedback")
        .insert({
          user_id: params.userId,
          conversation_id: params.conversationId,
          message_id: params.messageId,
          type: params.type,
          negative_reason: params.negativeReason,
          negative_comment: params.negativeComment,
          original_message: params.originalMessage,
          classified_intent: params.classifiedIntent,
          tool_used: params.toolUsed,
          execution_mode: params.executionMode,
          skill_id: params.skillId,
        })
        .select("id")
        .single();

      if (error) {
        logger.error({ error }, "FeedbackService: Failed to submit feedback");
        return { success: false, error: error.message };
      }

      // 如果是"理解错了意图"的负反馈，触发学习
      if (
        params.type === "negative" &&
        params.negativeReason === "wrong_intent"
      ) {
        await this.triggerLearning(params);
      }

      logger.info(
        { feedbackId: data?.id },
        "FeedbackService: Feedback submitted successfully",
      );

      return { success: true, data: { id: data?.id || "" } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "FeedbackService: Exception submitting feedback",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 获取用户反馈统计
   */
  async getStats(
    userId: string,
  ): Promise<FeedbackServiceResult<FeedbackStats>> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase.rpc("get_ai_feedback_stats", {
        p_user_id: userId,
      });

      if (error) {
        logger.error({ error }, "FeedbackService: Failed to get stats");
        return { success: false, error: error.message };
      }

      const row = Array.isArray(data) ? data[0] : data;

      return {
        success: true,
        data: {
          totalCount: row?.total_count || 0,
          positiveCount: row?.positive_count || 0,
          negativeCount: row?.negative_count || 0,
          satisfactionRate: row?.satisfaction_rate || 0,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "FeedbackService: Exception getting stats",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 获取负反馈原因分布
   */
  async getNegativeReasonDistribution(
    limit: number = 100,
  ): Promise<FeedbackServiceResult<NegativeReasonDistribution[]>> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase.rpc(
        "get_negative_feedback_reasons",
        { p_limit: limit },
      );

      if (error) {
        logger.error(
          { error },
          "FeedbackService: Failed to get reason distribution",
        );
        return { success: false, error: error.message };
      }

      const distribution = (data || []).map(
        (row: { reason: string; count: number; percentage: number }) => ({
          reason: row.reason as NegativeReasonDistribution["reason"],
          count: row.count,
          percentage: row.percentage,
        }),
      );

      return { success: true, data: distribution };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "FeedbackService: Exception getting reason distribution",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 获取用户反馈历史
   */
  async getUserFeedback(
    userId: string,
    limit: number = 50,
  ): Promise<FeedbackServiceResult<FeedbackRecord[]>> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("ai_feedback")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        logger.error({ error }, "FeedbackService: Failed to get user feedback");
        return { success: false, error: error.message };
      }

      const records: FeedbackRecord[] = (data || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        conversationId: row.conversation_id,
        messageId: row.message_id,
        type: row.type as FeedbackType,
        negativeReason: row.negative_reason as
          | NegativeFeedbackReason
          | undefined,
        negativeComment: row.negative_comment ?? undefined,
        originalMessage: row.original_message ?? "",
        classifiedIntent: row.classified_intent ?? "",
        toolUsed: row.tool_used ?? "",
        executionMode: row.execution_mode as
          | "atomic"
          | "orchestration"
          | undefined,
        skillId: row.skill_id ?? undefined,
        createdAt: new Date(row.created_at),
      }));

      return { success: true, data: records };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { error: message },
        "FeedbackService: Exception getting user feedback",
      );
      return { success: false, error: message };
    }
  }

  /**
   * 触发学习（内部方法）
   *
   * 当用户提供了 correctIntent 时，调用 CorrectionLearner 记录纠正
   */
  private async triggerLearning(params: CreateFeedbackParams): Promise<void> {
    try {
      // 如果用户指定了正确意图，记录纠正以便学习
      if (params.correctIntent) {
        const validIntents: IntentType[] = [
          "query",
          "action",
          "organize",
          "analyze",
          "learn",
          "create",
          "chitchat",
        ];

        // 验证 correctIntent 是否为有效的 IntentType
        if (validIntents.includes(params.correctIntent as IntentType)) {
          logger.info(
            {
              wrongIntent: params.classifiedIntent,
              correctIntent: params.correctIntent,
              originalMessage: params.originalMessage.substring(0, 50),
            },
            "FeedbackService: Recording correction for learning",
          );

          const result = await correctionLearner.recordCorrection({
            userId: params.userId,
            originalMessage: params.originalMessage,
            wrongIntent: params.classifiedIntent as IntentType,
            correctIntent: params.correctIntent as IntentType,
            signal: {
              signal: "negative_feedback",
              confidence: 0.9,
              originalInput: params.originalMessage,
              wrongIntent: params.classifiedIntent as IntentType,
              correctionInput: params.negativeComment || "",
              inferredCorrectIntent: params.correctIntent as IntentType,
            },
          });

          if (result.success) {
            logger.info(
              { correctionId: result.data?.id },
              "FeedbackService: Correction recorded successfully",
            );
          } else {
            logger.warn(
              { error: result.error },
              "FeedbackService: Failed to record correction",
            );
          }
        } else {
          logger.warn(
            { correctIntent: params.correctIntent },
            "FeedbackService: Invalid correctIntent provided, skipping learning",
          );
        }
      } else if (params.negativeComment) {
        // 没有明确的 correctIntent，只记录日志供后续分析
        logger.info(
          { feedback: params.negativeComment },
          "FeedbackService: Negative feedback without correctIntent, learning skipped",
        );
      }
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : "Unknown" },
        "FeedbackService: Failed to trigger learning",
      );
    }
  }
}

// =============================================================================
// 工厂函数和默认实例
// =============================================================================

/**
 * 创建反馈服务实例
 */
export function createFeedbackService(): FeedbackService {
  return new FeedbackService();
}

/**
 * 默认反馈服务实例
 */
export const feedbackService = createFeedbackService();
