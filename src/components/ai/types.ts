/**
 * AI 助手组件类型定义
 *
 * @version 1.2.0
 * @since 2025-12-22
 * @updated 2025-12-24 - 添加统一输出类型支持
 */

import type { AgentMessage, AgentToolCall } from "@/lib/ai-agent";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";

// ============================================
// 统一输出块类型（来自 UnifiedEngine）
// ============================================

/**
 * 进度信息
 */
export interface ProgressInfo {
  /** 当前步骤名称 */
  step: string;
  /** 进度百分比 0-100 */
  percent: number;
  /** 进度消息 */
  message?: string;
  /** 当前步骤索引 */
  stepIndex?: number;
  /** 总步骤数 */
  totalSteps?: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 交付物类型
 */
export type DeliverableType =
  | "report"
  | "list"
  | "cards"
  | "document"
  | "mindmap"
  | "graph"
  | "table";

/**
 * 交付物数据
 */
export interface DeliverableData {
  /** 交付物 ID */
  id: string;
  /** 交付物类型 */
  type: DeliverableType;
  /** 交付物标题 */
  title: string;
  /** 输出格式 */
  format: "markdown" | "html" | "json" | "cards" | "mindmap" | "plain";
  /** 交付物内容 */
  content: unknown;
  /** 是否可下载 */
  downloadable?: boolean;
  /** 是否可分享 */
  shareable?: boolean;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 后续建议
 */
export interface SuggestionItem {
  /** 建议显示文本 */
  text: string;
  /** 建议标签（可选，用于分类） */
  label?: string;
  /** 触发的动作（可选） */
  action?: string;
  /** 动作按钮标签 */
  actionLabel?: string;
  /** 动作参数 */
  params?: Record<string, unknown>;
  /** 图标 */
  icon?: string;
}

/**
 * 路由信息（调试用）
 */
export interface RoutingInfo {
  /** 执行模式 */
  mode: "atomic" | "orchestration";
  /** 路由理由 */
  reason: string;
  /** 建议的 Skill */
  skill: string | null;
  /** 意图类型 */
  intentType?: string;
  /** 复杂度级别 */
  complexityLevel?: string;
}

/**
 * 回退信息
 */
export interface FallbackInfo {
  /** 回退原因 */
  reason: string;
  /** 原始模式 */
  originalMode: "orchestration";
  /** 回退模式 */
  fallbackMode: "atomic";
}

/**
 * 消息显示状态
 */
export type MessageDisplayStatus =
  | "sending"
  | "sent"
  | "streaming"
  | "completed"
  | "error";

/**
 * 显示消息（用于 UI 展示）
 */
export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: MessageDisplayStatus;
  toolCalls?: AgentToolCall[];
  /** 待确认操作列表 */
  pendingConfirmations?: PendingConfirmation[];
  createdAt: Date;
  error?: string;

  // ============================================
  // 统一输出扩展字段（来自 UnifiedEngine）
  // ============================================

  /** 进度信息 */
  progress?: ProgressInfo;
  /** 交付物列表 */
  deliverables?: DeliverableData[];
  /** 后续建议 */
  suggestions?: SuggestionItem[];
  /** 路由信息（调试用） */
  routing?: RoutingInfo;
  /** 回退信息 */
  fallback?: FallbackInfo;
  /** 执行模式 */
  executionMode?: "atomic" | "orchestration";
  /** Skill ID */
  skillId?: string;
}

/**
 * AI 助手面板属性
 */
export interface AIAssistantPanelProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 用户 ID（可选，API 层会从 session 获取） */
  userId?: string;
  /** 会话 ID（可选，用于恢复会话） */
  conversationId?: string;
  /** 关联的书签 ID（可选，提供上下文） */
  bookmarkIds?: number[];
  /** 自定义系统提示语 */
  systemPrompt?: string;
  /** 面板标题 */
  title?: string;
  /** 面板描述 */
  description?: string;
}

/**
 * AI 助手按钮属性
 */
export interface AIAssistantButtonProps {
  /** 用户 ID */
  userId: string;
  /** 关联的书签 ID（可选） */
  bookmarkIds?: number[];
  /** 自定义类名 */
  className?: string;
  /** 按钮尺寸 */
  size?: "sm" | "default" | "lg";
  /** 按钮变体 */
  variant?: "default" | "outline" | "ghost";
}

/**
 * 消息组件属性
 */
export interface AIMessageProps {
  message: DisplayMessage;
  isLast?: boolean;
}

/**
 * 输入框属性
 */
export interface AIInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * 将 AgentMessage 转换为 DisplayMessage
 */
export function toDisplayMessage(
  msg: AgentMessage,
  status: MessageDisplayStatus = "completed",
): DisplayMessage {
  return {
    id: msg.id,
    role: msg.role as "user" | "assistant" | "system",
    content: msg.content,
    status,
    toolCalls: msg.toolCalls,
    createdAt: msg.createdAt,
  };
}

// ============================================
// 统一流式块类型（用于前端处理）
// ============================================

/**
 * 统一流式块（前端版本）
 *
 * 与后端 UnifiedStreamChunk 保持兼容，
 * 但简化为前端需要的字段
 */
export type UnifiedStreamChunkFrontend =
  | { type: "text"; text: string; isPartial?: boolean }
  | { type: "progress"; progress: ProgressInfo }
  | { type: "tool-call"; toolCall: AgentToolCall }
  | { type: "confirmation"; confirmation: PendingConfirmation }
  | { type: "deliverable"; deliverable: DeliverableData }
  | { type: "suggestions"; suggestions: SuggestionItem[] }
  | { type: "routing"; routing: RoutingInfo }
  | { type: "fallback"; fallback: FallbackInfo }
  | {
      type: "error";
      error: string;
      errorCode?: string;
      retryable?: boolean;
    }
  | {
      type: "done";
      data: {
        success: boolean;
        summary?: string;
        tokensUsed?: number;
        durationMs?: number;
        mode?: "atomic" | "orchestration";
        skillId?: string;
        conversationId?: string;
        content?: string;
        toolCalls?: AgentToolCall[];
      };
    };

/**
 * 处理统一流式块，更新 DisplayMessage
 *
 * @param chunk - 收到的流式块
 * @param message - 当前消息
 * @returns 更新后的消息
 */
export function processUnifiedChunk(
  chunk: UnifiedStreamChunkFrontend,
  message: DisplayMessage,
): DisplayMessage {
  switch (chunk.type) {
    case "text":
      return {
        ...message,
        content: message.content + chunk.text,
      };

    case "progress":
      return {
        ...message,
        progress: chunk.progress,
      };

    case "tool-call":
      return {
        ...message,
        toolCalls: [...(message.toolCalls || []), chunk.toolCall],
      };

    case "confirmation":
      return {
        ...message,
        pendingConfirmations: [
          ...(message.pendingConfirmations || []),
          chunk.confirmation,
        ],
      };

    case "deliverable":
      return {
        ...message,
        deliverables: [...(message.deliverables || []), chunk.deliverable],
      };

    case "suggestions":
      return {
        ...message,
        suggestions: chunk.suggestions,
      };

    case "routing":
      return {
        ...message,
        routing: chunk.routing,
      };

    case "fallback":
      return {
        ...message,
        fallback: chunk.fallback,
      };

    case "error":
      return {
        ...message,
        status: "error",
        error: chunk.error,
      };

    case "done":
      return {
        ...message,
        status: "completed",
        executionMode: chunk.data.mode,
        skillId: chunk.data.skillId,
        content: chunk.data.content || message.content,
        toolCalls: chunk.data.toolCalls || message.toolCalls,
      };

    default:
      return message;
  }
}
