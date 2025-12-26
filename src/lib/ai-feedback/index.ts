/**
 * AI 反馈服务模块
 *
 * @module ai-feedback
 * @version 1.0.0
 * @since 2025-12-26
 */

export {
  FeedbackService,
  feedbackService,
  createFeedbackService,
} from "./feedback.service";

export type {
  FeedbackType,
  NegativeFeedbackReason,
  FeedbackRecord,
  CreateFeedbackParams,
  FeedbackStats,
  NegativeReasonDistribution,
  FeedbackServiceResult,
} from "./types";
