/**
 * 执行引擎层类型定义
 *
 * @version 1.1.0
 * @since 2025-12-24
 * @updated 2025-12-27 - 添加取消令牌支持
 */

import type { CancellationToken } from "../orchestration/types";
import type { EpisodicMemoryContext } from "../../ai-agent/memory/types";
import type { DebugOverrideConfig } from "../../ai-agent/config/feature-flag-overrides";
import type { IntentSlotSchema } from "../router/types";

// 注意：以下类型暂时标记为保留导入，供未来扩展使用
// import type { AgentContext, AgentExecuteOptions } from "../../ai-agent/core/types";
// import type { UnifiedStreamChunk } from "../output/types";

// 重新导出情景记忆类型
export type { EpisodicMemoryContext };

/**
 * 搜索结果记录回调
 */
export type OnSearchResultsCallback = (
  query: string,
  resultIds: number[],
) => void;

/**
 * 最近的搜索结果（用于上下文保持）
 */
export interface LastSearchResults {
  /** 搜索查询词 */
  query: string;
  /** 结果书签 ID 列表 */
  resultIds: number[];
  /** 搜索时间戳 */
  searchedAt: number;
}

/**
 * 引擎上下文
 *
 * 统一的执行上下文，兼容原子模式和编排模式
 */
export interface EngineContext {
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  conversationId?: string;
  /** 关联的书签 ID 列表 */
  bookmarkIds?: number[];
  /** 关联的文件夹 ID */
  folderId?: number;
  /** 消息历史 */
  messageHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  /** 用户偏好 */
  userPreferences?: Record<string, unknown>;
  /** 用户书签总数（用于复杂度评估） */
  totalBookmarks?: number;
  /** 用户文件夹数量 */
  totalFolders?: number;
  /** 追踪 ID */
  traceId?: string;
  /** 是否调试模式 */
  debug?: boolean;
  /** 信号（用于取消 - Web 标准） */
  signal?: AbortSignal;
  /** 取消令牌（用于编排模式取消） */
  cancellationToken?: CancellationToken;
  /** 请求 ID（用于取消支持） */
  requestId?: string;
  /** 附件上下文（用户提供的收藏/文件内容） */
  attachmentContext?: string;
  /** 附件书签 ID 数组（用于 Tool 查询和 Skill 操作） */
  attachmentBookmarkIds?: number[];
  /** 附件元数据（用于追踪和展示） */
  attachmentMetadata?: {
    /** 书签附件数量 */
    bookmarkCount: number;
    /** 文件附件数量 */
    fileCount: number;
    /** 总内容长度 */
    totalContentLength: number;
    /** 是否所有附件内容都就绪 */
    allReady: boolean;
  };
  /** 文件夹列表（用于任务理解） */
  folders?: Array<{ id: number; name: string }>;
  /** 标签列表（用于任务理解） */
  tags?: string[];
  /** 搜索结果记录回调（用于上下文保持） */
  onSearchResults?: OnSearchResultsCallback;
  /** 最近的搜索结果（用于上下文保持） */
  lastSearchResults?: LastSearchResults;
  /** 情景记忆上下文（跨会话记忆） */
  episodicMemory?: EpisodicMemoryContext;
  /** 调试覆盖配置（来自 Cookie） */
  debugOverrides?: DebugOverrideConfig | null;

  // ============================================
  // P0-4 新增：增强置信度计算所需的用户数据
  // ============================================

  /** 最近 7 天新增书签数 */
  recentWeekCount?: number;

  /** 常用文件夹（前 5 个，按书签数排序） */
  topFolders?: Array<{ id: number; name: string; count: number }>;

  /** 主要平台（占比最高的平台） */
  topPlatform?: {
    name: string;
    code: string;
    count: number;
  };

  /** 常用标签（按频率排序） */
  frequentTags?: string[];

  // ============================================
  // 意图驱动工具加载（性能优化）
  // ============================================

  /** 意图类型（用于智能工具加载） */
  intentType?: string;
  /** 意图子类型 */
  intentSubType?: string;
  /** 意图置信度 */
  intentConfidence?: number;
  /** 意图槽位（时间范围等结构化参数） */
  slots?: IntentSlotSchema;

  // ============================================
  // 置信度分层执行策略 [v2.0 新增]
  // ============================================

  /**
   * 响应策略（基于增强置信度）
   * - silent: 高置信度（≥80%），静默执行，简短结果
   * - explain: 中置信度（60-79%），执行 + 解释为什么这样做
   * - clarify: 低置信度（<60%），生成澄清选项
   */
  responseStrategy?: "silent" | "explain" | "clarify";

  /**
   * 置信度级别
   */
  confidenceLevel?: "high" | "medium" | "low";

  /**
   * 增强置信度值（0-1）
   */
  enhancedConfidence?: number;

  // ============================================
  // P0-4 新增：防止重复执行标记
  // ============================================

  /**
   * 已执行的工具 ID 集合（用于回退时避免重复执行）
   */
  executedToolIds?: Set<string>;
}

/**
 * 引擎执行选项
 */
export interface EngineExecuteOptions {
  /** 最大工具调用轮数（原子模式） */
  maxToolRounds?: number;
  /** 温度参数 */
  temperature?: number;
  /** 最大 Token 数 */
  maxTokens?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否包含路由信息 */
  includeRoutingInfo?: boolean;
  /** 强制使用指定模式 [P1-8 扩展支持 workflow] */
  forceMode?: "atomic" | "orchestration" | "workflow";
  /** 强制使用指定 Skill */
  forceSkill?: string;

  // ============================================
  // Phase 2: 推测执行与消歧选项
  // ============================================

  /**
   * 是否等待用户消歧选择
   * - true: 暂停执行，等待用户从选项中选择真实意图
   * - false (默认): 使用最高置信度意图继续执行
   */
  waitForDisambiguation?: boolean;

  /**
   * 跳过高风险操作确认
   * - true: 即使是删除等高风险操作也直接执行（慎用）
   * - false (默认): 高风险操作需用户确认
   */
  skipConfirmation?: boolean;

  /**
   * 跳过低置信度澄清
   * - true: 置信度低于阈值也直接执行最高置信度意图
   * - false (默认): 低置信度时请求用户澄清
   */
  skipClarification?: boolean;

  /**
   * 用户已确认的意图（来自消歧选择）
   * 格式: "type:subType"
   */
  confirmedIntent?: string;

  /**
   * 用户已确认执行高风险操作
   */
  userConfirmedRisk?: boolean;

  // ============================================
  // P0-4 新增：回退模式标记
  // ============================================

  /**
   * 是否为回退执行（从 orchestration 降级到 atomic）
   * 用于避免重复执行已执行过的工具
   */
  isFallback?: boolean;
}

/**
 * 引擎执行结果摘要
 */
export interface EngineExecutionSummary {
  /** 是否成功 */
  success: boolean;
  /** 使用的模式 [P1-8 扩展支持 workflow] */
  mode: "atomic" | "orchestration" | "workflow";
  /** 使用的 Skill（编排模式） */
  skillId?: string;
  /** 响应摘要 */
  summary?: string;
  /** Token 使用量 */
  tokensUsed?: number;
  /** 执行时间（毫秒） */
  durationMs: number;
  /** 错误信息 */
  error?: string;
  /** 是否发生回退 */
  didFallback: boolean;
}

/**
 * 统一引擎配置
 */
export interface UnifiedEngineConfig {
  /** 是否启用统一引擎 */
  enabled?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 是否包含路由信息 */
  includeRoutingInfo?: boolean;
  /** 是否启用上下文记忆 */
  enableMemory?: boolean;
  /** 是否启用智能预测（IntentPredictor + RuleExtractor） */
  enablePrediction?: boolean;
  /** 默认执行选项 */
  defaultOptions?: EngineExecuteOptions;
}

/**
 * 编排引擎配置
 */
export interface OrchestrationEngineConfig {
  /** 默认超时时间（毫秒） */
  defaultTimeoutMs?: number;
  /** 最大并发 Skill 数 */
  maxConcurrentSkills?: number;
  /** 是否启用自动回退 */
  enableAutoFallback?: boolean;
}
