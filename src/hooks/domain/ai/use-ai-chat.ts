/**
 * AI 聊天 Hook
 *
 * 提供 AI Agent 聊天功能的可复用 Hook
 * 支持 SSE 流式响应、取消请求、错误处理
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { useState, useCallback, useRef } from "react";
import type { AgentStreamChunk } from "@/lib/ai-agent/core/types";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";

// ============================================
// 类型定义
// ============================================

/**
 * AI 聊天状态
 */
export type ChatStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "error"
  | "cancelled";

/**
 * 聊天消息
 */
export interface ChatMessage {
  /** 消息 ID */
  id: string;
  /** 角色 */
  role: "user" | "assistant";
  /** 内容 */
  content: string;
  /** 创建时间 */
  createdAt: Date;
  /** 是否正在流式输出 */
  isStreaming?: boolean;
  /** 错误信息 */
  error?: string;
  /** 待确认操作 */
  pendingConfirmation?: PendingConfirmation;
}

/**
 * 聊天请求选项
 */
export interface ChatRequestOptions {
  /** 书签 ID 列表（上下文） */
  bookmarkIds?: number[];
  /** 文件夹 ID（上下文） */
  folderId?: number;
  /** 会话 ID（用于续对话） */
  conversationId?: string;
  /** 是否启用流式响应 */
  streaming?: boolean;
  /** 系统提示语 */
  systemPrompt?: string;
}

/**
 * useAIChat 配置
 */
export interface UseAIChatConfig {
  /** API 端点 */
  apiEndpoint?: string;
  /** 默认请求选项 */
  defaultOptions?: ChatRequestOptions;
  /** 消息发送前回调 */
  onBeforeSend?: (message: string) => void;
  /** 流式响应回调 */
  onStream?: (chunk: AgentStreamChunk) => void;
  /** 完成回调 */
  onComplete?: (message: ChatMessage) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 确认操作回调 */
  onConfirmation?: (confirmation: PendingConfirmation) => void;
}

/**
 * useAIChat 返回值
 */
export interface UseAIChatReturn {
  /** 消息列表 */
  messages: ChatMessage[];
  /** 当前状态 */
  status: ChatStatus;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 当前响应内容（流式输出时实时更新） */
  currentResponse: string | null;
  /** 错误信息 */
  error: string | null;
  /** 待确认操作列表 */
  pendingConfirmations: PendingConfirmation[];
  /** 发送消息 */
  sendMessage: (message: string, options?: ChatRequestOptions) => Promise<void>;
  /** 取消当前请求 */
  cancel: () => void;
  /** 清除当前响应 */
  clearResponse: () => void;
  /** 清除所有消息 */
  clearMessages: () => void;
  /** 重试最后一条消息 */
  retry: () => Promise<void>;
}

// ============================================
// 工具函数
// ============================================

/**
 * 生成唯一消息 ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 解析 SSE 数据行
 */
function parseSSELine(line: string): AgentStreamChunk | null {
  if (!line.startsWith("data: ")) return null;

  try {
    return JSON.parse(line.slice(6)) as AgentStreamChunk;
  } catch {
    return null;
  }
}

// ============================================
// Hook 实现
// ============================================

/**
 * AI 聊天 Hook
 *
 * @param config - 配置选项
 * @returns 聊天状态和操作方法
 *
 * @example
 * ```tsx
 * const { messages, sendMessage, isLoading, currentResponse } = useAIChat({
 *   apiEndpoint: '/api/agent/chat',
 *   defaultOptions: { streaming: true },
 *   onComplete: (msg) => console.log('完成:', msg),
 * });
 *
 * // 发送消息
 * await sendMessage('你好');
 *
 * // 取消请求
 * cancel();
 * ```
 */
export function useAIChat(config: UseAIChatConfig = {}): UseAIChatReturn {
  const {
    apiEndpoint = "/api/agent/chat",
    defaultOptions = {},
    onBeforeSend,
    onStream,
    onComplete,
    onError,
    onConfirmation,
  } = config;

  // 状态
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [currentResponse, setCurrentResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmations, setPendingConfirmations] = useState<
    PendingConfirmation[]
  >([]);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastMessageRef = useRef<string | null>(null);
  const lastOptionsRef = useRef<ChatRequestOptions | null>(null);

  /**
   * 发送消息
   */
  const sendMessage = useCallback(
    async (message: string, options?: ChatRequestOptions) => {
      if (!message.trim()) return;
      if (status === "loading" || status === "streaming") return;

      // 保存用于重试
      lastMessageRef.current = message;
      lastOptionsRef.current = options || null;

      // 回调
      onBeforeSend?.(message);

      // 添加用户消息
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: "user",
        content: message,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // 重置状态
      setStatus("loading");
      setCurrentResponse(null);
      setError(null);

      // 创建 AbortController
      abortControllerRef.current = new AbortController();

      try {
        const mergedOptions = { ...defaultOptions, ...options };

        const res = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            bookmarkIds: mergedOptions.bookmarkIds,
            folderId: mergedOptions.folderId,
            conversationId: mergedOptions.conversationId,
            options: {
              streaming: mergedOptions.streaming ?? true,
              systemPrompt: mergedOptions.systemPrompt,
            },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(
            (errorData as { error?: string }).error ||
              `请求失败 (${res.status})`,
          );
        }

        // 处理 SSE 流式响应
        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error("无法获取响应流");
        }

        setStatus("streaming");

        const decoder = new TextDecoder();
        let fullContent = "";
        const assistantMessageId = generateMessageId();
        const confirmations: PendingConfirmation[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");

          for (const line of lines) {
            const chunk = parseSSELine(line);
            if (!chunk) continue;

            // 回调
            onStream?.(chunk);

            switch (chunk.type) {
              case "text":
                if (chunk.text) {
                  fullContent += chunk.text;
                  setCurrentResponse(fullContent);
                }
                break;

              case "confirmation":
                if (chunk.confirmation) {
                  confirmations.push(chunk.confirmation);
                  onConfirmation?.(chunk.confirmation);
                }
                break;

              case "error":
                setError(chunk.error || "发生错误");
                setStatus("error");
                break;

              case "done":
                // 完成
                break;
            }
          }
        }

        // 创建助手消息
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: fullContent || "AI 没有返回内容",
          createdAt: new Date(),
          pendingConfirmation:
            confirmations.length > 0 ? confirmations[0] : undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setStatus("idle");

        // 更新待确认列表
        if (confirmations.length > 0) {
          setPendingConfirmations((prev) => [...prev, ...confirmations]);
        }

        // 完成回调
        onComplete?.(assistantMessage);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setStatus("cancelled");
          setCurrentResponse(null);
        } else {
          const errorMessage = err instanceof Error ? err.message : "请求失败";
          setError(errorMessage);
          setStatus("error");
          onError?.(err instanceof Error ? err : new Error(errorMessage));
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      status,
      apiEndpoint,
      defaultOptions,
      onBeforeSend,
      onStream,
      onComplete,
      onError,
      onConfirmation,
    ],
  );

  /**
   * 取消当前请求
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus("cancelled");
  }, []);

  /**
   * 清除当前响应
   */
  const clearResponse = useCallback(() => {
    setCurrentResponse(null);
    setError(null);
    setStatus("idle");
  }, []);

  /**
   * 清除所有消息
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentResponse(null);
    setError(null);
    setStatus("idle");
    setPendingConfirmations([]);
  }, []);

  /**
   * 重试最后一条消息
   */
  const retry = useCallback(async () => {
    if (lastMessageRef.current) {
      // 移除最后的用户消息（如果有）
      setMessages((prev) => {
        const lastUserIndex = prev.findLastIndex((m) => m.role === "user");
        if (lastUserIndex !== -1) {
          return prev.slice(0, lastUserIndex);
        }
        return prev;
      });

      await sendMessage(
        lastMessageRef.current,
        lastOptionsRef.current || undefined,
      );
    }
  }, [sendMessage]);

  return {
    messages,
    status,
    isLoading: status === "loading" || status === "streaming",
    currentResponse,
    error,
    pendingConfirmations,
    sendMessage,
    cancel,
    clearResponse,
    clearMessages,
    retry,
  };
}

export default useAIChat;
