/**
 * AI 助手组件类型定义
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import type { AgentMessage, AgentToolCall } from "@/lib/ai-agent";

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
  createdAt: Date;
  error?: string;
}

/**
 * AI 助手面板属性
 */
export interface AIAssistantPanelProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 用户 ID */
  userId: string;
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
