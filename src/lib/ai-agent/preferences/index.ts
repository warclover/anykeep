/**
 * AI 偏好模块导出
 *
 * @module ai-agent/preferences
 * @version 1.0.0
 * @since 2025-12-26
 */

// 类型导出
export type {
  AIPreferences,
  LearnedPreferences,
  ExplicitPreferences,
  ResponseStylePreference,
  PreferencesUpdateRequest,
  LearningEvent,
  LearningEventType,
  TagUsageStats,
  FolderUsageStats,
} from "./types";

// 默认值导出
export {
  DEFAULT_AI_PREFERENCES,
  DEFAULT_LEARNED_PREFERENCES,
  DEFAULT_EXPLICIT_PREFERENCES,
} from "./types";

// 偏好服务
export {
  PreferencesService,
  preferencesService,
  getAIPreferences,
  updateAIPreferences,
} from "./preferences-service";

// 学习服务
export {
  PreferenceLearningService,
  preferenceLearningService,
  recordToolUsage,
} from "./learning-service";
