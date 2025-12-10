/**
 * AI 对话 Hook
 * Phase 4.3: 管理对话状态和流式响应
 *
 * @version 1.0.0
 * @since 2025-12-09
 */

"use client";

import { useState, useCallback, useRef } from "react";

/**
 * 引用来源
 */
export interface Citation {
  bookmarkId: number;
  title: string;
  url: string;
  folderName: string | null;
  similarity: number;
}

/**
 * 对话消息
 */
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: Date;
  isStreaming?: boolean;
}

/**
 * 对话选项
 */
export interface ChatOptions {
  folderId?: number;
  bookmarkIds?: number[];
  limit?: number;
}

/**
 * Hook 返回类型
 */
export interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  citations: Citation[];
  sendMessage: (query: string, options?: ChatOptions) => Promise<void>;
  clearMessages: () => void;
  stopGeneration: () => void;
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * AI 对话 Hook
 */
export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 发送消息
   */
  const sendMessage = useCallback(
    async (query: string, options?: ChatOptions) => {
      if (!query.trim() || isLoading) return;

      setIsLoading(true);
      setError(null);

      // 添加用户消息
      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: query,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // 创建助手消息占位
      const assistantId = generateId();
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // 准备请求
      abortControllerRef.current = new AbortController();

      try {
        // 构建对话历史（最近 10 轮）
        const conversationHistory = messages.slice(-20).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            conversationHistory,
            options: {
              stream: true,
              folderId: options?.folderId,
              bookmarkIds: options?.bookmarkIds,
              limit: options?.limit || 5,
            },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "对话请求失败");
        }

        // 处理流式响应
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("无法读取响应");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let messageCitations: Citation[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const event = JSON.parse(data);

                switch (event.type) {
                  case "retrieval":
                    // 收到检索结果
                    messageCitations = event.data.bookmarks || [];
                    setCitations(messageCitations);
                    break;

                  case "content":
                    // 收到内容片段
                    fullContent += event.data.delta || "";
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? { ...m, content: fullContent }
                          : m
                      )
                    );
                    break;

                  case "done":
                    // 完成
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? {
                              ...m,
                              content: fullContent,
                              citations: messageCitations,
                              isStreaming: false,
                            }
                          : m
                      )
                    );
                    break;

                  case "error":
                    throw new Error(event.data.message);
                }
              } catch (parseError) {
                // 忽略解析错误
                if (parseError instanceof Error && parseError.message) {
                  throw parseError;
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // 用户取消
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + "\n\n[已取消]", isStreaming: false }
                : m
            )
          );
        } else {
          setError(err instanceof Error ? err.message : "对话失败");
          // 移除失败的助手消息
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isLoading]
  );

  /**
   * 清空消息
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setCitations([]);
    setError(null);
  }, []);

  /**
   * 停止生成
   */
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    messages,
    isLoading,
    error,
    citations,
    sendMessage,
    clearMessages,
    stopGeneration,
  };
}
