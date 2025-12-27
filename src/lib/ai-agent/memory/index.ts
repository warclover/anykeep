/**
 * AI 记忆系统模块
 *
 * 提供跨会话的情景记忆和用户偏好学习能力
 *
 * @module ai-agent/memory
 * @version 1.0.0
 * @since 2025-12-27
 */

// =============================================================================
// 类型导出
// =============================================================================

export type {
  // 会话摘要
  ConversationSummary,
  ConversationAction,
  ConversationSentiment,
  // 交互日志
  InteractionLogEntry,
  InteractionType,
  UserFeedback,
  AiSuggestion,
  UserChoice,
  InteractionContext,
  // 用户偏好
  UserPreferencesAnalysis,
  InteractionStats,
  // 情景记忆上下文
  EpisodicMemoryContext,
  RecentSummary,
  // 配置
  EpisodicMemoryConfig,
  InteractionLoggerConfig,
  // 数据库返回类型
  DbConversationSummary,
  DbUserPreferences,
  DbInteractionStats,
  DbCleanupResult,
} from "./types";

// =============================================================================
// 服务导出
// =============================================================================

// 情景记忆服务
export {
  EpisodicMemoryService,
  getEpisodicMemoryService,
  resetEpisodicMemoryService,
} from "./episodic-memory";

// 交互日志记录器
export {
  InteractionLogger,
  getInteractionLogger,
  resetInteractionLogger,
} from "./interaction-logger";

// 记忆 Prompt 构建器
export {
  buildMemoryPrompt,
  buildMemoryReminder,
  estimateTokens,
  isEmptyMemoryContext,
} from "./memory-prompt-builder";

// 摘要生成器
export type { SummaryGeneratorConfig } from "./summary-generator";
export {
  SummaryGenerator,
  getSummaryGenerator,
  resetSummaryGenerator,
  generateConversationSummary,
} from "./summary-generator";
