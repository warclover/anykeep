/**
 * AI 记忆系统类型定义
 *
 * 情景记忆（Episodic Memory）- 跨会话的对话历史
 * 交互日志（Interaction Log）- 用户偏好学习数据
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

// =============================================================================
// 情景记忆类型
// =============================================================================

/**
 * 会话摘要 - 存储每次对话的关键信息
 */
export interface ConversationSummary {
  /** 记录 ID */
  id: string;
  /** 会话 ID */
  sessionId: string;
  /** 摘要内容 */
  summary: string;
  /** 用户意图关键词 */
  intents: string[];
  /** 执行的重要操作 */
  actions: ConversationAction[];
  /** 未完成的意图（用于下次提醒） */
  pendingIntents: string[];
  /** 学习到的用户偏好 [P2 新增] */
  learnedPreferences?: Record<string, string>;
  /** 消息数量 */
  messageCount: number;
  /** 会话情感基调 */
  sentiment: ConversationSentiment;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 会话中执行的操作
 */
export interface ConversationAction {
  /** 操作类型 */
  type: string;
  /** 操作目标 */
  target: string;
  /** 操作结果 */
  outcome: "success" | "failed" | "cancelled";
}

/**
 * 会话情感基调
 */
export type ConversationSentiment =
  | "positive"
  | "negative"
  | "neutral"
  | "frustrated";

// =============================================================================
// 交互日志类型
// =============================================================================

/**
 * 交互类型
 */
export type InteractionType =
  | "search"
  | "organize"
  | "export"
  | "delete"
  | "tag"
  | "move"
  | "undo"
  | "confirm"
  | "cancel"
  | "clarify";

/**
 * 用户反馈类型
 */
export type UserFeedback = "positive" | "negative" | "modified";

/**
 * 交互日志条目
 */
export interface InteractionLogEntry {
  /** 记录 ID */
  id?: string;
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  sessionId?: string;
  /** 交互类型 */
  actionType: InteractionType;
  /** 操作目标描述 */
  actionTarget?: string;
  /** 用户反馈 */
  userFeedback?: UserFeedback;
  /** AI 建议内容 */
  aiSuggestion?: AiSuggestion;
  /** 用户最终选择 */
  userChoice?: UserChoice;
  /** 上下文信息 */
  context?: InteractionContext;
  /** 创建时间 */
  createdAt?: Date;
}

/**
 * AI 建议内容
 */
export interface AiSuggestion {
  /** 建议的文件夹 */
  suggestedFolder?: string;
  /** 建议的标签 */
  suggestedTags?: string[];
  /** 建议的操作 */
  suggestedAction?: string;
  /** 其他建议数据 */
  [key: string]: unknown;
}

/**
 * 用户最终选择
 */
export interface UserChoice {
  /** 选择的文件夹 */
  chosenFolder?: string;
  /** 选择的标签 */
  chosenTags?: string[];
  /** 选择的操作 */
  chosenAction?: string;
  /** 其他选择数据 */
  [key: string]: unknown;
}

/**
 * 交互上下文
 */
export interface InteractionContext {
  /** 消息数量 */
  messageCount?: number;
  /** 置信度 */
  confidence?: number;
  /** 其他上下文数据 */
  [key: string]: unknown;
}

// =============================================================================
// 用户偏好分析类型
// =============================================================================

/**
 * 用户偏好分析结果
 */
export interface UserPreferencesAnalysis {
  /** 正面反馈率 */
  positiveRate: number;
  /** 最常用操作类型 */
  commonActions: string[];
  /** 总交互次数 */
  totalInteractions: number;
  /** 正面反馈次数 */
  positiveCount: number;
  /** 负面反馈次数 */
  negativeCount: number;
}

/**
 * 交互统计结果
 */
export interface InteractionStats {
  /** 总交互次数 */
  totalInteractions: number;
  /** 按类型统计 */
  byType: Record<string, number>;
  /** 按反馈统计 */
  byFeedback: {
    positive: number;
    negative: number;
    modified: number;
    none: number;
  };
  /** 统计周期（天） */
  periodDays: number;
}

// =============================================================================
// 情景记忆上下文（用于注入 Prompt）
// =============================================================================

/**
 * 情景记忆上下文 - 注入到 DynamicContext 中
 */
export interface EpisodicMemoryContext {
  /** 最近会话摘要 */
  recentSummaries: RecentSummary[];
  /** 未完成的意图 */
  pendingIntents: string[];
  /** 用户偏好 */
  preferences: UserPreferencesAnalysis | null;
}

/**
 * 简化的会话摘要（用于 Prompt 注入）
 */
export interface RecentSummary {
  /** 摘要内容 */
  summary: string;
  /** 主要意图 */
  intents: string[];
  /** 时间描述（如 "2小时前"） */
  timeAgo: string;
  /** 学习到的用户偏好 [P2 新增] */
  learnedPreferences?: Record<string, string>;
}

// =============================================================================
// 服务配置类型
// =============================================================================

/**
 * 情景记忆服务配置
 */
export interface EpisodicMemoryConfig {
  /** 最大摘要数量（默认 3） */
  maxSummaries?: number;
  /** Token 预算（默认 300） */
  tokenBudget?: number;
  /** 未完成意图有效期（天，默认 7） */
  pendingIntentDays?: number;
}

/**
 * 交互日志配置
 */
export interface InteractionLoggerConfig {
  /** 批量缓冲区大小（默认 10） */
  batchSize?: number;
  /** 刷新间隔（毫秒，默认 5000） */
  flushInterval?: number;
  /** 是否启用（默认 true） */
  enabled?: boolean;
}

// =============================================================================
// 数据库函数返回类型
// =============================================================================

/**
 * get_recent_summaries 函数返回类型
 */
export interface DbConversationSummary {
  id: string;
  session_id: string;
  summary: string;
  intents: string[];
  actions: ConversationAction[];
  pending_intents: string[];
  learned_preferences?: Record<string, string>;
  message_count: number;
  sentiment: ConversationSentiment;
  created_at: string;
}

/**
 * analyze_user_preferences 函数返回类型
 */
export interface DbUserPreferences {
  positiveRate: number;
  commonActions: string[];
  totalInteractions: number;
  positiveCount: number;
  negativeCount: number;
}

/**
 * get_interaction_stats 函数返回类型
 */
export interface DbInteractionStats {
  totalInteractions: number;
  byType: Record<string, number>;
  byFeedback: {
    positive: number;
    negative: number;
    modified: number;
    none: number;
  };
  periodDays: number;
}

/**
 * cleanup_old_ai_memory 函数返回类型
 */
export interface DbCleanupResult {
  deletedSummaries: number;
  deletedLogs: number;
  summaryRetentionDays: number;
  logRetentionDays: number;
}
