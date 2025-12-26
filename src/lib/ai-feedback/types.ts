/**
 * AI 反馈服务类型定义
 *
 * @module ai-feedback
 * @version 1.0.0
 * @since 2025-12-26
 */

/**
 * 反馈类型
 */
export type FeedbackType = "positive" | "negative";

/**
 * 负反馈原因
 */
export type NegativeFeedbackReason =
  | "wrong_intent"
  | "inaccurate_result"
  | "bad_format"
  | "incomplete"
  | "other";

/**
 * 反馈记录
 */
export interface FeedbackRecord {
  id: string;
  userId: string;
  conversationId: string;
  messageId: string;
  type: FeedbackType;
  negativeReason?: NegativeFeedbackReason;
  negativeComment?: string;
  originalMessage: string;
  classifiedIntent: string;
  toolUsed: string;
  executionMode?: "atomic" | "orchestration";
  skillId?: string;
  createdAt: Date;
}

/**
 * 创建反馈参数
 */
export interface CreateFeedbackParams {
  userId: string;
  conversationId: string;
  messageId: string;
  type: FeedbackType;
  negativeReason?: NegativeFeedbackReason;
  negativeComment?: string;
  /** 用户指定的正确意图（当 negativeReason 为 wrong_intent 时使用，触发学习） */
  correctIntent?: string;
  originalMessage: string;
  classifiedIntent: string;
  toolUsed: string;
  executionMode?: "atomic" | "orchestration";
  skillId?: string;
}

/**
 * 反馈统计
 */
export interface FeedbackStats {
  totalCount: number;
  positiveCount: number;
  negativeCount: number;
  satisfactionRate: number;
}

/**
 * 负反馈原因分布
 */
export interface NegativeReasonDistribution {
  reason: NegativeFeedbackReason;
  count: number;
  percentage: number;
}

/**
 * 服务结果
 */
export interface FeedbackServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
