/**
 * AI Agent 类型定义
 *
 * @version 1.1.0
 * @since 2025-12-22
 */

import type { CoreMessage, ToolResultPart } from "ai";
import type { PendingConfirmation } from "../tools/types";
import type { DynamicContext, SessionContext } from "../context/types";

/**
 * Agent 类型枚举
 */
export type AgentType = "knowledge" | "research" | "learning";

/**
 * Agent 状态
 */
export type AgentStatus =
  | "idle" // 空闲
  | "thinking" // 思考中
  | "executing" // 执行工具
  | "responding" // 生成响应
  | "error"; // 错误

/**
 * 消息角色
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/**
 * Agent 消息
 */
export interface AgentMessage {
  /** 消息 ID */
  id: string;
  /** 角色 */
  role: MessageRole;
  /** 内容 */
  content: string;
  /** 工具调用记录 */
  toolCalls?: AgentToolCall[];
  /** 工具执行结果 */
  toolResults?: ToolResultPart[];
  /** 创建时间 */
  createdAt: Date;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 工具调用记录
 */
export interface AgentToolCall {
  /** 工具调用 ID */
  id: string;
  /** 工具名称（Skill ID） */
  toolName: string;
  /** 调用参数 */
  args: Record<string, unknown>;
  /** 执行状态 */
  status: "pending" | "running" | "completed" | "failed";
  /** 执行结果 */
  result?: unknown;
  /** 错误信息 */
  error?: string;
  /** 执行耗时 (ms) */
  durationMs?: number;
}

/**
 * Agent 会话
 */
export interface AgentConversation {
  /** 会话 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 会话标题 */
  title?: string;
  /** Agent 类型 */
  agentType: AgentType;
  /** 关联的书签 ID */
  contextBookmarkIds?: number[];
  /** 消息列表 */
  messages: AgentMessage[];
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * Agent 上下文
 */
export interface AgentContext {
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  conversationId?: string;
  /** 关联的书签 ID */
  bookmarkIds?: number[];
  /** 前端提供的消息历史（用于无状态环境） */
  messageHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  /** 用户偏好 */
  userPreferences?: Record<string, unknown>;
  /** 最大执行时间 (ms) */
  maxExecutionTimeMs?: number;
  /** 系统提示语 */
  systemPrompt?: string;
  /** 追踪 ID */
  traceId?: string;
  /** 动态上下文（包含时间、统计、偏好等） */
  dynamicContext?: DynamicContext;
  /** 会话上下文（选中书签、当前文件夹等） */
  sessionContext?: SessionContext;
  /** 搜索结果记录回调（用于上下文保持） */
  onSearchResults?: (query: string, resultIds: number[]) => void;
}

/**
 * Agent 执行选项
 */
export interface AgentExecuteOptions {
  /** 是否启用流式响应 */
  streaming?: boolean;
  /** 最大工具调用轮数 */
  maxToolRounds?: number;
  /** 温度参数 */
  temperature?: number;
  /** 最大 Token 数 */
  maxTokens?: number;
  /** 超时时间 (ms) */
  timeout?: number;
  /** 信号（用于取消） */
  signal?: AbortSignal;
}

/**
 * Agent 执行结果
 */
export interface AgentExecuteResult {
  /** 是否成功 */
  success: boolean;
  /** 会话 ID（用于后续消息关联） */
  conversationId?: string;
  /** 响应内容 */
  content: string;
  /** 工具调用记录 */
  toolCalls: AgentToolCall[];
  /** 使用的 Token 数 */
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** 执行耗时 (ms) */
  durationMs: number;
  /** 错误信息 */
  error?: string;
  /** 完成原因 */
  finishReason?: "stop" | "length" | "tool-calls" | "error";
}

/**
 * Agent 流式响应块
 */
export interface AgentStreamChunk {
  /** 块类型 */
  type:
    | "text"
    | "tool-call"
    | "tool-result"
    | "confirmation"
    | "error"
    | "done";
  /** 文本内容（type=text 时） */
  text?: string;
  /** 工具调用（type=tool-call 时） */
  toolCall?: AgentToolCall;
  /** 工具结果（type=tool-result 时） */
  toolResult?: ToolResultPart;
  /** 待确认操作（type=confirmation 时） */
  confirmation?: PendingConfirmation;
  /** 错误信息（type=error 时） */
  error?: string;
  /** 最终结果（type=done 时） */
  result?: AgentExecuteResult;
}

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** Agent 类型 */
  type: AgentType;
  /** Agent 名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 系统提示语 */
  systemPrompt: string;
  /** 启用的 Skills */
  enabledSkills: string[];
  /** 默认选项 */
  defaultOptions?: AgentExecuteOptions;
}

/**
 * 将 AgentMessage 转换为 CoreMessage
 */
export function toCorMessages(messages: AgentMessage[]): CoreMessage[] {
  return messages.map((msg) => {
    if (msg.role === "tool" && msg.toolResults) {
      return {
        role: "tool" as const,
        content: msg.toolResults,
      };
    }

    return {
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    };
  });
}
