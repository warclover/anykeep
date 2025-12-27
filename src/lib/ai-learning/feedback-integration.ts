/**
 * FeedbackIntegration - 反馈与学习系统集成
 *
 * 连接前端 QuickActions 👎 与后端学习系统
 *
 * @module ai-learning
 * @version 1.0.0
 * @since 2025-12-25
 */

import { learningAwareClassifier } from "./learning-aware-classifier";
import { logger } from "@/lib/logger";
import type { IntentType, LearningServiceResult } from "./types";
import type { FeedbackReason } from "@/components/ai/phase4/types";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 反馈数据（从前端传入）
 */
export interface FeedbackData {
  /** 消息 ID */
  messageId: string;
  /** 会话 ID */
  conversationId: string;
  /** 反馈类型 */
  type: "positive" | "negative";
  /** 负面反馈原因 */
  negativeReason?: FeedbackReason;
  /** 用户评论 */
  comment?: string;
  /** 上下文信息 */
  context?: {
    /** 原始用户消息 */
    originalMessage?: string;
    /** 分类的意图 */
    classifiedIntent?: string;
    /** 使用的工具/技能 */
    toolUsed?: string;
    /** 执行模式 */
    executionMode?: string;
    /** 技能 ID */
    skillId?: string;
  };
}

/**
 * 反馈处理结果
 */
export interface FeedbackResult {
  success: boolean;
  /** 是否记录了学习 */
  learningRecorded?: boolean;
  /** 纠正记录 ID */
  correctionId?: string;
  /** 错误信息 */
  error?: string;
}

// =============================================================================
// 反馈原因到正确意图的映射
// =============================================================================

/**
 * 从反馈原因推断正确意图
 */
function inferCorrectIntentFromFeedback(
  reason: FeedbackReason | undefined,
  wrongIntent: IntentType,
): IntentType | undefined {
  if (!reason) return undefined;

  // wrong_intent 表示意图识别错误，但我们不知道正确的是什么
  // 此时返回最可能的替代意图
  if (reason === "wrong_intent") {
    const alternatives: Record<IntentType, IntentType> = {
      query: "organize", // 如果认为是搜索但实际不是，可能是整理
      action: "query", // 如果认为是操作但实际不是，可能是搜索
      organize: "query", // 如果认为是整理但实际不是，可能是搜索
      analyze: "query", // 如果认为是分析但实际不是，可能是搜索
      learn: "query", // 如果认为是学习但实际不是，可能是搜索
      create: "query", // 如果认为是创建但实际不是，可能是搜索
      refine: "query", // 如果认为是筛选但实际不是，可能是搜索
      chitchat: "query", // 闲聊默认尝试搜索
    };
    return alternatives[wrongIntent];
  }

  // 其他原因不表示意图错误，不需要学习
  return undefined;
}

// =============================================================================
// FeedbackIntegration 类
// =============================================================================

export class FeedbackIntegration {
  /**
   * 处理用户反馈
   */
  async handleFeedback(
    userId: string,
    feedback: FeedbackData,
  ): Promise<FeedbackResult> {
    logger.info(
      {
        userId,
        messageId: feedback.messageId,
        type: feedback.type,
        reason: feedback.negativeReason,
      },
      "FeedbackIntegration: Processing feedback",
    );

    // 正面反馈不需要学习
    if (feedback.type === "positive") {
      return { success: true, learningRecorded: false };
    }

    // 检查是否有足够的上下文进行学习
    if (
      !feedback.context?.originalMessage ||
      !feedback.context?.classifiedIntent
    ) {
      logger.debug(
        { context: feedback.context },
        "FeedbackIntegration: Insufficient context for learning",
      );
      return { success: true, learningRecorded: false };
    }

    const wrongIntent = feedback.context.classifiedIntent as IntentType;
    const originalMessage = feedback.context.originalMessage;

    // 尝试推断正确意图
    const correctIntent = inferCorrectIntentFromFeedback(
      feedback.negativeReason,
      wrongIntent,
    );

    if (!correctIntent) {
      logger.debug(
        { reason: feedback.negativeReason, wrongIntent },
        "FeedbackIntegration: Could not infer correct intent",
      );
      return { success: true, learningRecorded: false };
    }

    // 记录到学习系统
    const result = await learningAwareClassifier.handleNegativeFeedback(
      userId,
      originalMessage,
      wrongIntent,
      correctIntent,
      feedback.negativeReason,
    );

    if (result.recorded) {
      logger.info(
        {
          correctionId: result.correctionId,
          wrongIntent,
          correctIntent,
        },
        "FeedbackIntegration: Learning recorded from feedback",
      );
      return {
        success: true,
        learningRecorded: true,
        correctionId: result.correctionId,
      };
    }

    return { success: true, learningRecorded: false };
  }

  /**
   * 获取用户学习统计
   */
  async getUserStats(userId: string): Promise<
    LearningServiceResult<{
      totalCorrections: number;
      totalApplications: number;
      accuracy: number;
    }>
  > {
    const result = await learningAwareClassifier.getStats(userId);

    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const stats = result.data;
    const accuracy =
      stats.totalApplications > 0
        ? stats.totalApplications /
          (stats.totalCorrections + stats.totalApplications)
        : 1;

    return {
      success: true,
      data: {
        totalCorrections: stats.totalCorrections,
        totalApplications: stats.totalApplications,
        accuracy,
      },
    };
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建反馈集成实例
 */
export function createFeedbackIntegration(): FeedbackIntegration {
  return new FeedbackIntegration();
}

// 默认实例
export const feedbackIntegration = createFeedbackIntegration();
