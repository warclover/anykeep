"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { DisplayMessage, SuggestionItem } from "../types";
import { adaptBackendChunk, processUnifiedChunk } from "../types";
import type { AgentStreamChunk } from "@/lib/ai-agent";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";
import { clientLogger } from "@/lib/client-logger";

export interface UsePanelMessagesOptions {
  initialConversationId?: string;
  bookmarkIds?: number[];
  folderId?: number;
  useUnifiedEngine?: boolean;
  /** 外部回调：当收到 confirmation chunk 时追加到外部 pendingConfirmations */
  onConfirmation?: (confirmation: PendingConfirmation) => void;
  /** 外部回调：当收到 memory chunk（AI 记住了）时 */
  onMemory?: () => void;
}

export function usePanelMessages({
  initialConversationId,
  bookmarkIds,
  folderId,
  useUnifiedEngine = true,
  onConfirmation,
  onMemory,
}: UsePanelMessagesOptions) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // 2.4.1: 前端主动生成 conversationId（如未提供）
  const [conversationId, setConversationId] = useState<string>(
    () => initialConversationId || crypto.randomUUID(),
  );

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // 消息变化时滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /**
   * 处理原有 Agent API 的流式数据块（兼容模式）
   */
  const handleAgentChunk = useCallback(
    (
      chunk: AgentStreamChunk,
      messageId: string,
      currentMessage: DisplayMessage,
      updateMessage: (msg: DisplayMessage) => void,
    ) => {
      let toolCalls = currentMessage.toolCalls || [];
      const confirmations = currentMessage.pendingConfirmations || [];

      if (chunk.type === "text" && chunk.text) {
        const newContent = (currentMessage.content || "") + chunk.text;
        const updatedMessage = { ...currentMessage, content: newContent };
        updateMessage(updatedMessage);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMessage : m)),
        );
      } else if (chunk.type === "tool-call" && chunk.toolCall) {
        toolCalls = [...toolCalls, chunk.toolCall];
        const updatedMessage = { ...currentMessage, toolCalls };
        updateMessage(updatedMessage);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMessage : m)),
        );
      } else if (chunk.type === "confirmation" && chunk.confirmation) {
        const confirmation = chunk.confirmation;
        confirmations.push(confirmation);
        const updatedMessage = {
          ...currentMessage,
          pendingConfirmations: [...confirmations],
        };
        updateMessage(updatedMessage);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMessage : m)),
        );
        onConfirmation?.(confirmation);
      } else if (chunk.type === "done" && chunk.result) {
        if (chunk.result.conversationId) {
          setConversationId(chunk.result.conversationId);
        }
        const updatedMessage = {
          ...currentMessage,
          content: currentMessage.content || chunk.result.content,
          status: "completed" as const,
          toolCalls: chunk.result.toolCalls,
          pendingConfirmations:
            confirmations.length > 0 ? confirmations : undefined,
        };
        updateMessage(updatedMessage);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMessage : m)),
        );
      } else if (chunk.type === "error") {
        const updatedMessage = {
          ...currentMessage,
          status: "error" as const,
          error: chunk.error,
        };
        updateMessage(updatedMessage);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMessage : m)),
        );
      }
    },
    [onConfirmation],
  );

  /**
   * 核心发送消息逻辑
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        status: "sent",
        createdAt: new Date(),
      };

      // 添加用户消息
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      // 创建助手消息占位
      const assistantMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        status: "streaming",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // 创建 AbortController
      abortControllerRef.current = new AbortController();

      try {
        // 构建消息历史
        const messageHistory = messages
          .filter(
            (m) =>
              m.status === "completed" &&
              (m.role === "user" || m.role === "assistant"),
          )
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        // 始终使用统一 API（通过 enableUnified 参数控制模式）
        const apiEndpoint = "/api/agent/unified";

        // 调用 API
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userMessage.content,
            conversationId,
            messageHistory,
            bookmarkIds,
            folderId,
            options: {
              streaming: true,
              enableUnified: useUnifiedEngine,
            },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "请求失败");
        }

        // 处理 SSE 流式响应
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("无法获取响应流");
        }

        const decoder = new TextDecoder();
        let currentMessage: DisplayMessage = { ...assistantMessage };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const rawChunk = JSON.parse(line.slice(6));

                if (useUnifiedEngine) {
                  // 使用适配器转换后端格式为前端格式
                  const chunk = adaptBackendChunk(rawChunk);

                  // 使用统一引擎处理
                  currentMessage = processUnifiedChunk(chunk, currentMessage);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id ? currentMessage : m,
                    ),
                  );

                  // 处理待确认操作
                  if (chunk.type === "confirmation" && chunk.confirmation) {
                    onConfirmation?.(chunk.confirmation);
                  }

                  // 从 done chunk 中提取 conversationId（用于记忆功能）
                  if (chunk.type === "done" && chunk.data.conversationId) {
                    setConversationId(chunk.data.conversationId);
                  }

                  // 处理记忆块（显示"AI 记住了"提示）
                  if (chunk.type === "memory" && chunk.memory?.resolved) {
                    onMemory?.();
                  }
                } else {
                  // 使用原有 Agent API 处理（兼容模式）
                  const agentChunk = rawChunk as AgentStreamChunk;
                  handleAgentChunk(
                    agentChunk,
                    assistantMessage.id,
                    currentMessage,
                    (msg) => {
                      currentMessage = msg;
                    },
                  );
                }
              } catch (parseError) {
                if (process.env.NODE_ENV === "development") {
                  const errorMessage =
                    parseError instanceof Error
                      ? parseError.message
                      : String(parseError);
                  clientLogger.error(
                    {
                      error: errorMessage,
                      lineLength: line.length,
                      linePreview: line.slice(0, 200),
                      lineTail:
                        line.length > 200 ? line.slice(-100) : undefined,
                    },
                    "SSE parse error",
                  );
                }
              }
            }
          }
        }

        // 如果没有收到 done 事件，手动标记完成
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id && m.status === "streaming"
              ? { ...m, status: "completed" }
              : m,
          ),
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, status: "completed", content: m.content || "已取消" }
                : m,
            ),
          );
        } else {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? {
                    ...m,
                    status: "error",
                    error: errorMessage,
                  }
                : m,
            ),
          );
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      isLoading,
      conversationId,
      bookmarkIds,
      folderId,
      messages,
      useUnifiedEngine,
      handleAgentChunk,
      onConfirmation,
      onMemory,
    ],
  );

  // 发送消息（从输入框提交）
  const handleSubmit = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  // 清除对话
  // 2.4.4: 新会话时重置 conversationId，确保上下文隔离
  const handleClear = useCallback(() => {
    setMessages([]);
    setConversationId(crypto.randomUUID());
  }, []);

  // 重试最后一条消息
  const handleRetry = useCallback(() => {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (!lastUserMessage) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "assistant" && lastMessage.status === "error") {
      setMessages((prev) => prev.slice(0, -1));
    }

    setInput(lastUserMessage.content);
  }, [messages]);

  // 处理建议点击
  const handleSuggestionClick = useCallback(
    (suggestion: SuggestionItem) => {
      const messageContent = suggestion.action || suggestion.text;
      sendMessage(messageContent);
    },
    [sendMessage],
  );

  return {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    conversationId,
    scrollRef,
    sendMessage,
    handleSubmit,
    handleClear,
    handleRetry,
    handleSuggestionClick,
  };
}
