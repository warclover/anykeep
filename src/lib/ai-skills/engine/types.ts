/**
 * 执行引擎层类型定义
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

// 注意：以下类型暂时标记为保留导入，供未来扩展使用
// import type { AgentContext, AgentExecuteOptions } from "../../ai-agent/core/types";
// import type { UnifiedStreamChunk } from "../output/types";

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
  /** 信号（用于取消） */
  signal?: AbortSignal;
  /** 附件上下文（用户提供的收藏/文件内容） */
  attachmentContext?: string;
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
  /** 强制使用指定模式 */
  forceMode?: "atomic" | "orchestration";
  /** 强制使用指定 Skill */
  forceSkill?: string;
}

/**
 * 引擎执行结果摘要
 */
export interface EngineExecutionSummary {
  /** 是否成功 */
  success: boolean;
  /** 使用的模式 */
  mode: "atomic" | "orchestration";
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
