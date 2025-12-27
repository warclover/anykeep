/**
 * AI Agent 上下文模块
 *
 * 提供动态上下文构建和 Prompt 注入功能
 *
 * @module ai-agent/context
 * @version 2.2.0
 * @since 2025-12-26
 * @updated 2025-12-27 - 添加 System-Reminder 注入器和增强置信度计算器
 * @updated 2025-12-27 - 添加情景记忆上下文类型和 Prompt 构建
 * @updated 2025-12-27 - 添加对话上下文压缩功能
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
  // 情景记忆类型（v2.1 新增）
  EpisodicMemoryContext,
  RecentSummaryContext,
  PreferencesAnalysisContext,
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
  buildEpisodicMemoryPrompt,
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

// =============================================================================
// 对话上下文压缩（v2.2 新增）
// =============================================================================

// 压缩类型
export type {
  CompressionConfig,
  CompressionTriggerConfig,
  CompressionRetentionConfig,
  CompressionExecutionConfig,
  CompressionContext,
  CompressionResult,
  CompressionMetrics,
  CompressionCheckResult,
  CompressionValidationResult,
  CompressionEvent,
  CompressionEventType,
  ConversationMessage,
} from "./compression-types";

// 压缩验证器
export {
  estimateTokens,
  estimateMessagesTokens,
  validateCompressionSummary,
  validateCompressionEffect,
  calculateTurns,
  calculateTokenUsageRatio,
} from "./compression-validator";

// 压缩 Prompt 模板
export {
  ANYKEEP_COMPRESSION_PROMPT,
  COMPRESSION_USER_PROMPT,
  formatConversationHistory,
  buildCompressionPrompt,
  buildSummaryBlock,
  mergeSystemPromptWithSummary,
  getCompressionMessages,
} from "./compression-prompt";

// 压缩器
export {
  ConversationCompressor,
  conversationCompressor,
} from "./conversation-compressor";

// 压缩降级策略（v2.2.1 新增）
export type {
  CompressionErrorType,
  FallbackLevel,
  FallbackResult,
  FallbackConfig,
} from "./compression-fallback";
export {
  DEFAULT_FALLBACK_CONFIG,
  classifyCompressionError,
  isCompressionRetryable,
  simpleTruncate,
  executeWithFallback,
} from "./compression-fallback";
