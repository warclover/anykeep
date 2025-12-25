/**
 * AI 自我进化模块
 *
 * 提供意图分类的自我学习和纠正能力
 *
 * @module ai-learning
 * @version 1.0.0
 * @since 2025-12-25
 *
 * @example
 * ```typescript
 * import {
 *   learningAwareClassifier,
 *   correctionDetector,
 *   correctionLearner,
 * } from '@/lib/ai-learning';
 *
 * // 带学习的分类
 * const result = await learningAwareClassifier.classify({
 *   input: "帮我整理一下收藏",
 *   userId: "user_123",
 *   enableLearning: true,
 * });
 *
 * // 检测纠正信号
 * const detection = correctionDetector.detect(
 *   "不对，我是要搜索",
 *   previousOutput,
 *   context
 * );
 *
 * // 记录纠正
 * if (detection.isCorrection) {
 *   await correctionLearner.recordCorrection({...});
 * }
 * ```
 */

// =============================================================================
// 类型导出
// =============================================================================

export type {
  // 基础类型
  IntentType,
  CorrectionSignalType,
  CorrectionSignal,
  CorrectionPattern,

  // AI 输出
  AIOutput,
  ConversationState,

  // 纠正记录
  CorrectionRecord,
  SimilarCorrection,

  // 学习结果
  LearningResult,
  ClassificationRequest,
  ClassificationResponse,

  // 服务响应
  LearningServiceResult,
  DetectionResult,
  LearningStats,
} from "./types";

// =============================================================================
// 纠正检测器
// =============================================================================

export {
  CorrectionDetector,
  createCorrectionDetector,
  correctionDetector,
} from "./correction-detector";

// =============================================================================
// 纠正学习器
// =============================================================================

export {
  CorrectionLearner,
  createCorrectionLearner,
  correctionLearner,
} from "./correction-learner";

export type {
  RecordCorrectionParams,
  FindSimilarParams,
} from "./correction-learner";

// =============================================================================
// 学习感知分类器
// =============================================================================

export {
  LearningAwareClassifier,
  createLearningAwareClassifier,
  learningAwareClassifier,
} from "./learning-aware-classifier";

export type {
  OriginalClassifier,
  LearningAwareClassifierConfig,
} from "./learning-aware-classifier";

// =============================================================================
// 反馈集成
// =============================================================================

export {
  FeedbackIntegration,
  createFeedbackIntegration,
  feedbackIntegration,
} from "./feedback-integration";

export type { FeedbackData, FeedbackResult } from "./feedback-integration";
