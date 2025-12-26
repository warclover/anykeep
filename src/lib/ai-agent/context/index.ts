/**
 * AI Agent 上下文模块
 *
 * 提供动态上下文构建和 Prompt 注入功能
 *
 * @module ai-agent/context
 * @version 2.0.0
 * @since 2025-12-26
 * @updated 2025-12-27 - 添加 System-Reminder 注入器和增强置信度计算器
 */

// 类型导出
export type {
  DynamicContext,
  TimeContext,
  TimePeriod,
  StatsContext,
  PlatformStats,
  FolderStats,
  PreferencesContext,
  ResponseStyle,
  RecentActivityContext,
  LastSavedBookmark,
  LastSearch,
  SessionContext,
  CurrentFolder,
  DynamicContextBuildOptions,
  CacheEntry,
} from "./types";

// 动态上下文构建器
export {
  DynamicContextBuilder,
  dynamicContextBuilder,
  buildDynamicContext,
  invalidateStatsCache,
} from "./dynamic-context-builder";

// Prompt 注入
export type { MergePromptOptions } from "./prompt-injector";
export {
  buildContextPrompt,
  buildMinimalContextPrompt,
  mergeSystemPrompt,
  estimateContextTokens,
} from "./prompt-injector";

// 附件上下文构建器（已有）
export {
  buildAttachmentContext,
  hasValidAttachmentContent,
  getAttachmentSummary,
} from "./attachment-context-builder";

// System-Reminder 动态注入器（v2.0 新增）
export type { ReminderTrigger } from "./system-reminder-injector";
export {
  REMINDER_TRIGGERS,
  getActiveReminders,
  injectSystemReminders,
  shouldInjectReminders,
} from "./system-reminder-injector";

// 增强置信度计算器（v2.0 新增）
export type {
  IntentType,
  EntityType,
  ExtractedEntity,
  IntentClassificationLite,
  ConfidenceFactor,
  EnhancedConfidenceResult,
} from "./enhanced-confidence";
export {
  calculateEnhancedConfidence,
  getEnhancedConfidence,
} from "./enhanced-confidence";
