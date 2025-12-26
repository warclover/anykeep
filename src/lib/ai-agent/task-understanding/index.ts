/**
 * 任务理解层模块入口
 *
 * 提供零接管模式的任务理解能力
 *
 * @version 2.1.0
 * @since 2025-12-26
 * @updated 2025-12-26 - 添加模板引擎支持
 */

// =============================================================================
// 类型导出
// =============================================================================

export type {
  // 核心类型
  TaskUnderstanding,
  SmartDefault,
  SmartDefaultSource,
  ExecutionStep,
  RiskLevel,
  ConfirmationReason,
  TaskUnderstandingMetadata,

  // 撤销相关
  UndoableOperation,
  OperationType,
  OperationSnapshot,

  // 执行结果
  TaskExecutionResult,
  TaskResultDetails,
  UserAdjustment,

  // API 流类型
  ZeroTakeoverStreamChunk,
  ThinkingChunk,
  ProgressChunk,
  ResultChunk,
  UndoAvailableChunk,
  ConfirmationRequiredChunk,
  ErrorChunk,

  // 上下文
  TaskContext,
  TaskContextStats,
  TaskContextFolder,
  TaskContextBookmark,

  // 偏好
  UserPreferences,
  OrganizeMethod,
  PreferenceLearningRecord,
} from "./types";

// =============================================================================
// 服务导出
// =============================================================================

// 撤销服务
export {
  UndoService,
  getUndoService,
  resetUndoService,
  type UndoServiceConfig,
  type UndoResult,
  type UndoableOperationInfo,
} from "./undo/undo-service";

// 智能默认值服务
export {
  SmartDefaultsService,
  createSmartDefaultsService,
  type PreferencesProvider,
} from "./defaults/smart-defaults-service";

// 偏好学习服务
export {
  PreferenceLearningServiceV2,
  createPreferenceLearningServiceV2,
  InMemoryPreferenceLearningStorage,
  type PreferenceLearningStorage,
  type LearningConfig,
} from "./defaults/preference-learning-service-v2";

// 任务分析器
export {
  TaskAnalyzer,
  createTaskAnalyzer,
  type TaskAnalyzerConfig,
} from "./analyzer/task-analyzer";

// =============================================================================
// 模板引擎导出
// =============================================================================

export {
  // 引擎
  TaskTemplateEngine,
  createTaskTemplateEngine,
  // 类型
  type TaskTemplate,
  type TaskTemplateType,
  type ExecutionStepTemplate,
  type TemplateMatchResult,
  type TemplateMatchDetails,
  type TaskTemplateEngineConfig,
  // 预定义模板
  defaultTemplates,
  cancelOperationTemplate,
  searchSimpleTemplate,
  organizeToFolderTemplate,
  organizeGeneralTemplate,
  organizeByTimeTemplate,
  moveToFolderTemplate,
  exportGeneralTemplate,
  exportWithFormatTemplate,
  queryStatsTemplate,
  deleteBookmarksTemplate,
  batchAddTagsTemplate,
  batchRemoveTagsTemplate,
  reviewKnowledgeTemplate,
} from "./templates";
