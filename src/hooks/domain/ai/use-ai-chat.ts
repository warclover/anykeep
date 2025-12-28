"use client";

/**
 * AI 聊天 Hook
 *
 * 提供 AI Agent 聊天功能的可复用 Hook
 * 支持 SSE 流式响应、统一引擎、取消请求、错误处理
 *
 * @version 2.1.0
 * @since 2025-12-24
 * @updated 2025-12-25 - 迁移到统一确认系统 (ConfirmationService)
 * @updated 2025-12-28 - 移除重复类型定义，导入统一类型
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { AgentStreamChunk } from "@/lib/ai-agent/core/types";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";
import type { UnifiedStreamChunk } from "@/lib/ai-skills/output/types";
import { confirmationService } from "@/lib/ai-skills/effects";

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
 * 思考阶段类型
 */
export type ThinkingPhase =
  | "understanding"
  | "planning"
  | "deciding"
  | "executing"
  | "react_think"
  | "react_act"
  | "react_observe"
  | "react_complete";

/**
 * 思考过程记录
 */
export interface ThinkingRecord {
  /** 思考阶段 */
  phase: ThinkingPhase;
  /** 思考内容 */
  content: string;
  /** 时间戳 */
  timestamp: number;
  /** ReAct 轮次（仅 ReAct 模式） */
  round?: number;
  /** 是否为最终状态（仅 ReAct 模式） */
  isFinal?: boolean;
}

/**
 * 引用信息
 */
export interface Citation {
  /** 引用编号 (1-based) */
  index: number;
  /** 引用标题 */
  title: string;
  /** 书签 ID */
  bookmarkId: number;
}

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
  /** 待确认操作列表（多个） */
  pendingConfirmations?: PendingConfirmation[];
  /** 进度信息 */
  progress?: {
    step: string;
    percent: number;
    message?: string;
  };
  /** 交付物 */
  deliverables?: Array<{
    id: string;
    type: string;
    title: string;
    format: string;
    content: unknown;
    downloadable?: boolean;
    shareable?: boolean;
    /** 交付物元数据（包含 skillId 等） */
    metadata?: Record<string, unknown>;
  }>;
  /** 后续建议 */
  suggestions?: Array<{
    label: string;
    action: string;
    params?: Record<string, unknown>;
  }>;
  /** 思考过程记录（ReAct/零接管模式） */
  thinking?: ThinkingRecord[];
  /** 引用列表（引用追踪系统） */
  citations?: Citation[];
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
  /** 是否使用统一引擎 */
  useUnifiedEngine?: boolean;
}

// UnifiedStreamChunk 现在从 @/lib/ai-skills/output/types 导入
// 移除了本地重复定义以确保类型一致性

/**
 * useAIChat 配置
 */
export interface UseAIChatConfig {
  /**
   * @deprecated 已废弃，始终使用 /api/agent/unified
   * 保留仅为向后兼容，将在下个主版本移除
   */
  apiEndpoint?: string;
  /** 默认请求选项 */
  defaultOptions?: ChatRequestOptions;
  /**
   * @deprecated 已废弃，统一引擎已稳定，无需切换
   * 如需回退到 KnowledgeAgent，请在 options 中设置 enableUnified: false
   */
  useUnifiedEngine?: boolean;
  /** 消息发送前回调 */
  onBeforeSend?: (message: string) => void;
  /** 流式响应回调 */
  onStream?: (chunk: AgentStreamChunk | UnifiedStreamChunk) => void;
  /** 完成回调 */
  onComplete?: (message: ChatMessage) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 确认操作回调 */
  onConfirmation?: (confirmation: PendingConfirmation) => void;
  /** 进度更新回调 */
  onProgress?: (step: string, percent: number, message?: string) => void;
  /** 消息变化回调 */
  onMessagesChange?: (messages: ChatMessage[]) => void;
  /** 思考过程回调（ReAct/零接管模式） */
  onThinking?: (thinking: ThinkingRecord) => void;
  /** 引用建立回调（引用追踪系统） */
  onCitation?: (citations: Citation[], query?: string) => void;
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
  /** 当前进度 */
  progress: { step: string; percent: number; message?: string } | null;
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
  /** 滚动区域 Ref */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** 处理确认 */
  handleConfirm: (confirmationId: string) => Promise<void>;
  /** 处理取消确认 */
  handleCancel: (confirmationId: string) => Promise<void>;
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
function parseSSELine(
  line: string,
): AgentStreamChunk | UnifiedStreamChunk | null {
  if (!line.startsWith("data: ")) return null;

  try {
    return JSON.parse(line.slice(6));
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
 * 统一使用 /api/agent/unified 端点，支持智能路由和编排模式。
 *
 * @param config - 配置选项
 * @returns 聊天状态和操作方法
 *
 * @example
 * ```tsx
 * const {
 *   messages,
 *   sendMessage,
 *   isLoading,
 *   currentResponse,
 *   progress,
 * } = useAIChat({
 *   defaultOptions: { streaming: true },
 *   onProgress: (step, percent) => console.log(`${step}: ${percent}%`),
 * });
 *
 * // 发送消息
 * await sendMessage('帮我分析最近收藏的文章');
 *
 * // 回退到 KnowledgeAgent（不使用智能路由）
 * await sendMessage('简单问题', { useUnifiedEngine: false });
 *
 * // 取消请求
 * cancel();
 * ```
 */
export function useAIChat(config: UseAIChatConfig = {}): UseAIChatReturn {
  const {
    // @deprecated - 保留向后兼容，但不再使用
    apiEndpoint: _apiEndpoint,
    useUnifiedEngine: _useUnifiedEngine,
    defaultOptions = {},
    onBeforeSend,
    onStream,
    onComplete,
    onError,
    onConfirmation,
    onProgress,
    onMessagesChange,
    onThinking,
    onCitation,
  } = config;

  // 状态
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [currentResponse, setCurrentResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmations, setPendingConfirmations] = useState<
    PendingConfirmation[]
  >([]);
  const [progress, setProgress] = useState<{
    step: string;
    percent: number;
    message?: string;
  } | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastMessageRef = useRef<string | null>(null);
  const lastOptionsRef = useRef<ChatRequestOptions | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 消息变化时通知
  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // 消息变化时滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingConfirmations, scrollToBottom]);

  /**
   * 处理统一引擎流式数据块
   */
  const handleUnifiedChunk = useCallback(
    (
      chunk: UnifiedStreamChunk,
      messageId: string,
      currentMessage: ChatMessage,
      updateMessage: (msg: ChatMessage) => void,
    ) => {
      const confirmations = currentMessage.pendingConfirmations || [];
      const deliverables = currentMessage.deliverables || [];

      switch (chunk.type) {
        case "text":
          if (chunk.data?.text) {
            const newContent = (currentMessage.content || "") + chunk.data.text;
            const updated = { ...currentMessage, content: newContent };
            updateMessage(updated);
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? updated : m)),
            );
            setCurrentResponse(newContent);
          }
          break;

        case "progress":
          if (chunk.data) {
            const progressData = {
              step: chunk.data.step || "",
              percent: chunk.data.percent || 0,
              message: chunk.data.message,
            };
            const updated = { ...currentMessage, progress: progressData };
            updateMessage(updated);
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? updated : m)),
            );
            setProgress(progressData);
            onProgress?.(
              progressData.step,
              progressData.percent,
              progressData.message,
            );
          }
          break;

        case "deliverable":
          if (chunk.data) {
            const deliverable = {
              id: chunk.data.id || generateMessageId(),
              type: chunk.data.type || "document",
              title: chunk.data.title || "交付物",
              format: chunk.data.format || "markdown",
              content: chunk.data.content,
              downloadable: chunk.data.downloadable,
              shareable: chunk.data.shareable,
              metadata: chunk.data.metadata,
            };
            deliverables.push(deliverable);
            const updated = {
              ...currentMessage,
              deliverables: [...deliverables],
            };
            updateMessage(updated);
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? updated : m)),
            );
          }
          break;

        case "suggestions":
          if (chunk.data?.suggestions) {
            // 将 Suggestion 类型映射到 ChatMessage.suggestions 格式
            const mappedSuggestions = chunk.data.suggestions.map((s) => ({
              label: s.text,
              action: s.action,
              params: s.params,
            }));
            const updated = {
              ...currentMessage,
              suggestions: mappedSuggestions,
            };
            updateMessage(updated);
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? updated : m)),
            );
          }
          break;

        case "confirmation":
          // ConfirmationChunk.data 包含确认数据，需要映射到 PendingConfirmation 格式
          if (chunk.data?.id && chunk.data?.title) {
            // 从 ConfirmationChunk 映射到 PendingConfirmation
            const confirmation: PendingConfirmation = {
              confirmationId: chunk.data.id as string,
              toolName: "confirmation",
              description: chunk.data.title as string,
              impactSummary: chunk.data.message as string,
              params: {
                options: chunk.data.options,
                preview: chunk.data.preview,
              },
              expiresAt: new Date(
                Date.now() + ((chunk.data.timeout as number) ?? 300000),
              ),
              riskLevel: "medium",
            };
            confirmations.push(confirmation);
            const updated = {
              ...currentMessage,
              pendingConfirmations: [...confirmations],
            };
            updateMessage(updated);
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? updated : m)),
            );
            setPendingConfirmations((prev) => [...prev, confirmation]);
            onConfirmation?.(confirmation);
          }
          break;

        case "error":
          setError(chunk.data?.message || "发生错误");
          setStatus("error");
          break;

        case "thinking":
          if (chunk.data?.phase && chunk.data?.content !== undefined) {
            const thinkingRecords = currentMessage.thinking || [];
            const newThinking: ThinkingRecord = {
              phase: chunk.data.phase,
              content: String(chunk.data.content || ""),
              timestamp: chunk.data.timestamp || Date.now(),
              round: chunk.data.round,
              isFinal: chunk.data.isFinal,
            };
            thinkingRecords.push(newThinking);
            const updated = {
              ...currentMessage,
              thinking: [...thinkingRecords],
            };
            updateMessage(updated);
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? updated : m)),
            );
            onThinking?.(newThinking);
          }
          break;

        case "citation":
          if (chunk.data?.indexed && chunk.data?.citationSummary) {
            const citations: Citation[] = chunk.data.citationSummary.map(
              (item) => ({
                index: item.index,
                title: item.title,
                bookmarkId: item.bookmarkId,
              }),
            );
            const updated = {
              ...currentMessage,
              citations,
            };
            updateMessage(updated);
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? updated : m)),
            );
            onCitation?.(citations, chunk.data.query);
          }
          break;

        case "done":
          const finalMessage: ChatMessage = {
            ...currentMessage,
            isStreaming: false,
          };
          updateMessage(finalMessage);
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? finalMessage : m)),
          );
          break;
      }
    },
    [onConfirmation, onProgress, onThinking, onCitation],
  );

  /**
   * 处理原有 Agent API 的流式数据块
   */
  const handleAgentChunk = useCallback(
    (
      chunk: AgentStreamChunk,
      messageId: string,
      currentMessage: ChatMessage,
      updateMessage: (msg: ChatMessage) => void,
    ) => {
      const confirmations = currentMessage.pendingConfirmations || [];

      switch (chunk.type) {
        case "text":
          if (chunk.text) {
            const newContent = (currentMessage.content || "") + chunk.text;
            const updated = { ...currentMessage, content: newContent };
            updateMessage(updated);
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? updated : m)),
            );
            setCurrentResponse(newContent);
          }
          break;

        case "confirmation":
          if (chunk.confirmation) {
            confirmations.push(chunk.confirmation);
            const updated = {
              ...currentMessage,
              pendingConfirmations: [...confirmations],
            };
            updateMessage(updated);
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? updated : m)),
            );
            setPendingConfirmations((prev) => [...prev, chunk.confirmation!]);
            onConfirmation?.(chunk.confirmation);
          }
          break;

        case "error":
          setError(chunk.error || "发生错误");
          setStatus("error");
          break;

        case "done":
          break;
      }
    },
    [onConfirmation],
  );

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
      setProgress(null);

      // 创建 AbortController
      abortControllerRef.current = new AbortController();

      try {
        const mergedOptions = { ...defaultOptions, ...options };

        // 统一使用 /api/agent/unified（支持通过 enableUnified: false 回退到 KnowledgeAgent）
        const endpoint = "/api/agent/unified";
        const enableUnified = mergedOptions.useUnifiedEngine ?? true;

        const res = await fetch(endpoint, {
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
              enableUnified,
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
        const assistantMessageId = generateMessageId();
        let assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          createdAt: new Date(),
          isStreaming: true,
        };

        // 添加助手消息占位
        setMessages((prev) => [...prev, assistantMessage]);

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

            // 统一 API 返回的 chunk 需要根据模式处理
            if (enableUnified) {
              handleUnifiedChunk(
                chunk as UnifiedStreamChunk,
                assistantMessageId,
                assistantMessage,
                (msg) => {
                  assistantMessage = msg;
                },
              );
            } else {
              // enableUnified: false 时回退到 KnowledgeAgent 格式
              handleAgentChunk(
                chunk as AgentStreamChunk,
                assistantMessageId,
                assistantMessage,
                (msg) => {
                  assistantMessage = msg;
                },
              );
            }
          }
        }

        // 最终更新
        assistantMessage = {
          ...assistantMessage,
          isStreaming: false,
          content: assistantMessage.content || "AI 没有返回内容",
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMessageId ? assistantMessage : m)),
        );
        setStatus("idle");
        setProgress(null);

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
      defaultOptions,
      onBeforeSend,
      onStream,
      onComplete,
      onError,
      handleUnifiedChunk,
      handleAgentChunk,
    ],
  );

  /**
   * 处理确认操作
   * @updated 2025-12-25 - 迁移到统一确认系统 (ConfirmationService)
   */
  const handleConfirm = useCallback(
    async (confirmationId: string) => {
      const confirmation = pendingConfirmations.find(
        (c) => c.confirmationId === confirmationId,
      );
      if (!confirmation) return;

      try {
        // 使用新的统一确认服务
        const success = confirmationService.respondToConfirmation(
          confirmationId,
          "confirm",
          { toolName: confirmation.toolName, params: confirmation.params },
        );

        if (!success) {
          throw new Error("确认操作失败或已过期");
        }

        const resultMessage: ChatMessage = {
          id: generateMessageId(),
          role: "assistant",
          content: `✅ 操作已确认：${confirmation.description}`,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, resultMessage]);

        // 移除已处理的确认
        setPendingConfirmations((prev) =>
          prev.filter((c) => c.confirmationId !== confirmationId),
        );

        setMessages((prev) =>
          prev.map((m) =>
            m.pendingConfirmations?.some(
              (c) => c.confirmationId === confirmationId,
            )
              ? {
                  ...m,
                  pendingConfirmations: m.pendingConfirmations?.filter(
                    (c) => c.confirmationId !== confirmationId,
                  ),
                }
              : m,
          ),
        );
      } catch (err) {
        const errorMessage: ChatMessage = {
          id: generateMessageId(),
          role: "assistant",
          content: `❌ 操作执行失败：${err instanceof Error ? err.message : "未知错误"}`,
          createdAt: new Date(),
          error: err instanceof Error ? err.message : "未知错误",
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    },
    [pendingConfirmations],
  );

  /**
   * 处理取消确认
   * @updated 2025-12-25 - 迁移到统一确认系统 (ConfirmationService)
   */
  const handleCancel = useCallback(
    async (confirmationId: string) => {
      const confirmation = pendingConfirmations.find(
        (c) => c.confirmationId === confirmationId,
      );
      if (!confirmation) return;

      // 使用新的统一确认服务取消操作
      confirmationService.cancelConfirmation(confirmationId, "用户取消");

      // 立即移除确认
      setPendingConfirmations((prev) =>
        prev.filter((c) => c.confirmationId !== confirmationId),
      );

      const cancelMessage: ChatMessage = {
        id: generateMessageId(),
        role: "assistant",
        content: "❌ 操作已取消",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, cancelMessage]);

      setMessages((prev) =>
        prev.map((m) =>
          m.pendingConfirmations?.some(
            (c) => c.confirmationId === confirmationId,
          )
            ? {
                ...m,
                pendingConfirmations: m.pendingConfirmations?.filter(
                  (c) => c.confirmationId !== confirmationId,
                ),
              }
            : m,
        ),
      );
    },
    [pendingConfirmations],
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
    setProgress(null);
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
    setProgress(null);
  }, []);

  /**
   * 重试最后一条消息
   */
  const retry = useCallback(async () => {
    if (lastMessageRef.current) {
      // 移除最后的用户消息（如果有）
      setMessages((prev) => {
        // 兼容 ES2022 以下的 findLastIndex 实现
        let lastUserIndex = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === "user") {
            lastUserIndex = i;
            break;
          }
        }
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
    progress,
    sendMessage,
    cancel,
    clearResponse,
    clearMessages,
    retry,
    scrollRef,
    handleConfirm,
    handleCancel,
  };
}

export default useAIChat;
