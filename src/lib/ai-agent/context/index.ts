/**
 * AI Agent 上下文模块
 *
 * 提供动态上下文构建和 Prompt 注入功能
 *
 * @module ai-agent/context
 * @version 1.0.0
 * @since 2025-12-26
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
