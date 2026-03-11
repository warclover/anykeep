/**
 * Classification Learning Module
 * V4.2 分类学习模块导出
 *
 * ⚠️ 活跃模块 — 全部 6 个服务文件均有外部消费者，请勿删除任何一个
 *
 * 依赖链：
 *   书签移动 API（3 条路由）
 *     → trigger-move-learning.ts
 *       → learning-event-handler.ts
 *         → negative-sample.service.ts（写入 folder_exclusions 表）
 *         → preference-learner.ts（学习用户偏好）
 *
 *   confirmation.service.ts → preferenceLearner
 *   cron/classification-optimize → feedbackLoopService
 *   cron/profile-updates → profileUpdater
 *   analytics 路由（v1 + v2）→ profileUpdater + feedbackLoopService
 *   learning/insights 路由 → negativeSampleService + feedbackLoopService
 *   learning/negative 路由 → negativeSampleService
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

// Preference Learner
export { PreferenceLearner, preferenceLearner } from "./preference-learner";

export type {
  LearningEventType,
  UserPreferences,
  FolderPreference,
  SourcePreference,
  TimePreference,
  LearningEvent,
  LearningStats,
} from "./preference-learner";

// Profile Updater
export { ProfileUpdater, profileUpdater } from "./profile-updater";

export type { UpdateConfig, ProfileHealthStatus } from "./profile-updater";

// Feedback Loop
export {
  FeedbackLoopService,
  feedbackLoopService,
  handleUserFeedback,
  getSystemHealthReport,
} from "./feedback-loop";

export type {
  FeedbackSignal,
  FeedbackData,
  LearningAdjustment,
  SystemHealthReport,
  FeedbackResult,
} from "./feedback-loop";

// Negative Sample Service (V4.2)
export { negativeSampleService } from "./negative-sample.service";

export type {
  ExclusionType,
  CreatedFrom,
  FolderExclusionRecord,
  CreateExclusionInput,
  BatchCreateExclusionInput,
  ExclusionQueryFilters,
  NegativeSampleMatch,
  LearnFromMoveInput,
} from "./negative-sample.service";

// Learning Event Handler (V4.2)
export {
  learningEventHandler,
  initializeLearningEventHandler,
  shutdownLearningEventHandler,
} from "./learning-event-handler";

export type {
  LearningEventHandlerConfig,
  LearningEventStats,
} from "./learning-event-handler";
