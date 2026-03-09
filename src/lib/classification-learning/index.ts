/**
 * Classification Learning Module
 * V4.2 分类学习模块导出
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
