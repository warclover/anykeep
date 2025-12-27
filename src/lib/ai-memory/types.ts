/**
 * AI Memory 模块类型定义
 *
 * 定义会话状态、指代解析等核心类型
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

// ============================================
// 基础类型
// ============================================

/**
 * 消息角色
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * 会话消息
 */
export interface ConversationMessage {
  /** 消息 ID */
  id: string;
  /** 角色 */
  role: MessageRole;
  /** 内容 */
  content: string;
  /** 时间戳 */
  timestamp: number;
  /** 意图类型（如果已分类） */
  intentType?: string;
  /** 子类型 */
  subType?: string;
}

/**
 * 提及的实体
 */
export interface MentionedEntity {
  /** 实体类型 */
  type: "bookmark" | "folder" | "tag" | "platform";
  /** 实体 ID */
  id: number | string;
  /** 实体名称（用于显示） */
  name: string;
  /** 提及时间戳 */
  mentionedAt: number;
  /** 来源消息 ID */
  sourceMessageId?: string;
}

/**
 * 搜索结果项摘要（用于序数引用）
 */
export interface SearchResultItemSummary {
  /** 书签 ID */
  id: number;
  /** 标题 */
  title: string;
  /** 摘要（截取前 100 字符） */
  summary?: string;
}

/**
 * 搜索结果摘要
 */
export interface SearchResultSummary {
  /** 搜索查询 */
  query: string;
  /** 结果数量 */
  resultCount: number;
  /** 结果 ID 列表（书签 ID） */
  resultIds: number[];
  /** 搜索时间戳 */
  searchedAt: number;
  /** 来源消息 ID */
  sourceMessageId?: string;
  /** 结果摘要（前 10 条，用于序数引用时提供上下文） */
  resultSummaries?: SearchResultItemSummary[];
}

/**
 * 最近输出摘要
 */
export interface LastOutputSummary {
  /** 输出类型 */
  type: "text" | "list" | "deliverable" | "confirmation";
  /** 输出内容摘要 */
  summary: string;
  /** 完整内容（可选，用于详细引用） */
  fullContent?: string;
  /** 关联的实体 ID */
  relatedEntityIds?: number[];
  /** 输出时间戳 */
  outputAt: number;
  /** 来源消息 ID */
  sourceMessageId?: string;
}

// ============================================
// 压缩摘要状态
// ============================================

/**
 * 压缩摘要状态
 *
 * 存储对话上下文压缩后的摘要信息，用于长对话的上下文管理
 */
export interface CompressionSummaryState {
  /** 压缩摘要内容 */
  summary: string;
  /** 压缩时间 */
  compressedAt: number;
  /** 压缩前的消息数量 */
  originalMessageCount: number;
  /** 压缩后保留的消息数量 */
  retainedMessageCount: number;
  /** 压缩比率 */
  compressionRatio: number;
  /** 使用的降级级别 */
  fallbackLevel?: "full_compression" | "simple_truncation" | "original";
}

// ============================================
// 会话状态
// ============================================

/**
 * 会话状态
 *
 * 存储单个会话的所有上下文信息
 */
export interface ConversationState {
  /** 会话 ID */
  conversationId: string;
  /** 用户 ID */
  userId: string;
  /** 消息历史（最近 N 条） */
  messages: ConversationMessage[];
  /** 最近的搜索结果 */
  lastSearchResults?: SearchResultSummary;
  /** 最近的输出 */
  lastOutput?: LastOutputSummary;
  /** 提及的书签 */
  mentionedBookmarks: MentionedEntity[];
  /** 提及的文件夹 */
  mentionedFolders: MentionedEntity[];
  /** 提及的标签 */
  mentionedTags: MentionedEntity[];
  /** 会话创建时间 */
  createdAt: number;
  /** 最后活动时间 */
  lastActivityAt: number;
  /** 会话元数据 */
  metadata?: Record<string, unknown>;
  /** 压缩摘要（对话上下文压缩后的摘要，用于长对话） */
  compressionSummary?: CompressionSummaryState;
}

/**
 * 会话状态更新选项
 */
export interface StateUpdateOptions {
  /** 是否追加消息（否则替换） */
  appendMessage?: boolean;
  /** 是否更新最后活动时间 */
  updateLastActivity?: boolean;
  /** 是否清除旧的提及 */
  clearOldMentions?: boolean;
}

// ============================================
// 指代解析
// ============================================

/**
 * 指代词类型
 */
export type ReferenceType =
  | "last_output" // 刚才、刚刚
  | "these_results" // 这些、这几个
  | "that_folder" // 那个文件夹
  | "that_bookmark" // 那篇文章、那个链接
  | "previous" // 上一个
  | "mentioned" // 提到的
  | "ordinal_result" // 第N个（新增）
  | "last_result" // 最后一个（新增）
  | "range_result"; // 前N个/后N个（新增）

/**
 * 解析后的指代
 */
export interface ResolvedReference {
  /** 原始文本 */
  originalText: string;
  /** 指代类型 */
  type: ReferenceType;
  /** 解析后的实体 */
  resolvedEntities: MentionedEntity[];
  /** 解析置信度 0-1 */
  confidence: number;
  /** 解析说明 */
  explanation?: string;
}

/**
 * 指代解析结果
 */
export interface ReferenceResolutionResult {
  /** 原始输入 */
  originalInput: string;
  /** 解析后的输入（替换指代词后） */
  resolvedInput: string;
  /** 检测到的指代 */
  references: ResolvedReference[];
  /** 是否有未解析的指代 */
  hasUnresolvedReferences: boolean;
  /** 未解析的指代（需要澄清） */
  unresolvedReferences?: string[];
}

// ============================================
// 配置类型
// ============================================

/**
 * SessionMemory 配置
 */
export interface SessionMemoryConfig {
  /** 消息历史最大数量 */
  maxMessageHistory?: number;
  /** 提及实体最大数量（每种类型） */
  maxMentionedEntities?: number;
  /** 会话过期时间（毫秒） */
  sessionExpiryMs?: number;
  /** 清理检查间隔（毫秒） */
  cleanupIntervalMs?: number;
}

/**
 * ReferenceResolver 配置
 */
export interface ReferenceResolverConfig {
  /** 最小置信度阈值 */
  minConfidence?: number;
  /** 是否启用模糊匹配 */
  enableFuzzyMatch?: boolean;
}

// ============================================
// 默认配置
// ============================================

/**
 * 默认 SessionMemory 配置
 */
export const DEFAULT_SESSION_MEMORY_CONFIG: Required<SessionMemoryConfig> = {
  maxMessageHistory: 20,
  maxMentionedEntities: 10,
  sessionExpiryMs: 30 * 60 * 1000, // 30 分钟
  cleanupIntervalMs: 5 * 60 * 1000, // 5 分钟检查一次
};

/**
 * 默认 ReferenceResolver 配置
 */
export const DEFAULT_REFERENCE_RESOLVER_CONFIG: Required<ReferenceResolverConfig> =
  {
    minConfidence: 0.6,
    enableFuzzyMatch: true,
  };
