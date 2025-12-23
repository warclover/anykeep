/**
 * AI 助手面板组件
 *
 * 提供与 AI 助手对话的完整界面
 * 通过 API 路由与后端 Agent 交互
 *
 * @version 1.2.0
 * @since 2025-12-22
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Bot, Trash2, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AIMessage } from "./ai-message";
import { AIInput } from "./ai-input";
import { ActionConfirmInline } from "./action-confirm-dialog";
import type { AIAssistantPanelProps, DisplayMessage } from "./types";
import type { AgentStreamChunk, AgentToolCall } from "@/lib/ai-agent";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";

/**
 * AI 助手面板组件
 */
export function AIAssistantPanel({
  open,
  onOpenChange,
  // userId 由 API 层从 session 获取，此处不直接使用
  userId: _userId,
  conversationId: initialConversationId,
  bookmarkIds,
  title = "AI 知识助手",
  description = "我可以帮你搜索、分类和整理你的收藏内容",
}: AIAssistantPanelProps) {
  // 状态
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId,
  );
  // 待确认操作状态
  const [pendingConfirmations, setPendingConfirmations] = useState<
    PendingConfirmation[]
  >([]);
  const [isConfirming, setIsConfirming] = useState(false);

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
  }, [messages, pendingConfirmations, scrollToBottom]);

  // 发送消息
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
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
      // 构建消息历史（不包含刚添加的用户消息，因为那会在 message 字段单独发送）
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

      // 调用 Agent API
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
          messageHistory,
          bookmarkIds,
          options: {
            streaming: true,
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
      let fullContent = "";
      let toolCalls: AgentToolCall[] = [];
      const confirmations: PendingConfirmation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const chunk: AgentStreamChunk = JSON.parse(line.slice(6));

              if (chunk.type === "text" && chunk.text) {
                fullContent += chunk.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, content: fullContent }
                      : m,
                  ),
                );
              } else if (chunk.type === "tool-call" && chunk.toolCall) {
                toolCalls = [...toolCalls, chunk.toolCall];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id ? { ...m, toolCalls } : m,
                  ),
                );
              } else if (chunk.type === "confirmation" && chunk.confirmation) {
                // 收到确认请求
                confirmations.push(chunk.confirmation);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, pendingConfirmations: [...confirmations] }
                      : m,
                  ),
                );
                // 同时更新全局状态
                setPendingConfirmations((prev) => [
                  ...prev,
                  chunk.confirmation!,
                ]);
              } else if (chunk.type === "done" && chunk.result) {
                // 保存 conversationId 用于后续消息关联
                if (chunk.result.conversationId) {
                  setConversationId(chunk.result.conversationId);
                }
                // 标记完成
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? {
                          ...m,
                          content: fullContent || chunk.result!.content,
                          status: "completed",
                          toolCalls: chunk.result!.toolCalls,
                          pendingConfirmations:
                            confirmations.length > 0
                              ? confirmations
                              : undefined,
                        }
                      : m,
                  ),
                );
              } else if (chunk.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? {
                          ...m,
                          status: "error",
                          error: chunk.error,
                        }
                      : m,
                  ),
                );
              }
            } catch (parseError) {
              // SSE 解析错误：开发环境记录，生产环境静默忽略
              if (process.env.NODE_ENV === "development") {
                console.error("SSE parse error:", parseError, "Line:", line);
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
      // 处理错误
      if (error instanceof Error && error.name === "AbortError") {
        // 用户取消，不显示错误
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
  }, [input, isLoading, conversationId, bookmarkIds, messages]);

  // 处理确认操作
  const handleConfirm = useCallback(
    async (confirmationId: string) => {
      const confirmation = pendingConfirmations.find(
        (c) => c.confirmationId === confirmationId,
      );
      if (!confirmation) return;

      setIsConfirming(true);

      try {
        // 调用确认 API
        const response = await fetch("/api/agent/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmationId: confirmation.confirmationId,
            toolName: confirmation.toolName,
            params: confirmation.params,
            action: "confirm",
          }),
        });

        const result = await response.json();

        // 添加结果消息
        const resultMessage: DisplayMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.success
            ? `✅ 操作已完成：${result.data?.message || confirmation.description}`
            : `❌ 操作失败：${result.error || "未知错误"}`,
          status: "completed",
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, resultMessage]);

        // 从待确认列表中移除
        setPendingConfirmations((prev) =>
          prev.filter((c) => c.confirmationId !== confirmationId),
        );

        // 清除消息中的确认状态
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
      } catch (error) {
        // 处理网络错误
        const errorMessage: DisplayMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ 操作执行失败：${error instanceof Error ? error.message : "网络错误"}`,
          status: "error",
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsConfirming(false);
      }
    },
    [pendingConfirmations],
  );

  // 处理取消操作
  const handleCancel = useCallback(
    async (confirmationId: string) => {
      const confirmation = pendingConfirmations.find(
        (c) => c.confirmationId === confirmationId,
      );
      if (!confirmation) return;

      // 通知后端取消（非阻塞）
      fetch("/api/agent/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmationId: confirmation.confirmationId,
          toolName: confirmation.toolName,
          params: confirmation.params,
          action: "cancel",
        }),
      }).catch(() => {
        // 忽略取消通知的错误
      });

      // 从待确认列表中移除
      setPendingConfirmations((prev) =>
        prev.filter((c) => c.confirmationId !== confirmationId),
      );

      // 添加取消消息
      const cancelMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "❌ 操作已取消",
        status: "completed",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, cancelMessage]);

      // 清除消息中的确认状态
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

  // 清除对话
  const handleClear = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setPendingConfirmations([]);
  }, []);

  // 停止生成（供后续使用）
  const _handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  // 重试最后一条消息
  const handleRetry = useCallback(() => {
    // 找到最后一条用户消息
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (!lastUserMessage) return;

    // 移除最后一条助手消息（如果有错误）
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "assistant" && lastMessage.status === "error") {
      setMessages((prev) => prev.slice(0, -1));
    }

    // 重新发送
    setInput(lastUserMessage.content);
  }, [messages]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col w-full sm:max-w-md p-0"
      >
        {/* 头部 */}
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary">
                <Bot className="size-4" />
              </div>
              <div>
                <SheetTitle className="text-base">{title}</SheetTitle>
                <SheetDescription className="text-xs">
                  {description}
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleClear}
                  title="清除对话"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* 消息列表 */}
        <ScrollArea ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <Bot className="size-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">
                有什么可以帮你的？
              </h3>
              <p className="text-sm text-muted-foreground/70 mt-1 max-w-[200px]">
                试着问我：&ldquo;搜索关于 AI 的文章&rdquo;
              </p>
            </div>
          ) : (
            <div className="py-2">
              {messages.map((message, index) => (
                <div key={message.id}>
                  <AIMessage
                    message={message}
                    isLast={index === messages.length - 1}
                  />

                  {/* 显示待确认操作 */}
                  {message.pendingConfirmations &&
                    message.pendingConfirmations.length > 0 && (
                      <div className="px-4 py-2 space-y-2">
                        {message.pendingConfirmations.map((confirmation) => (
                          <ActionConfirmInline
                            key={confirmation.confirmationId}
                            confirmation={confirmation}
                            onConfirm={handleConfirm}
                            onCancel={handleCancel}
                            isLoading={isConfirming}
                          />
                        ))}
                      </div>
                    )}
                </div>
              ))}

              {/* 重试按钮 */}
              {messages[messages.length - 1]?.status === "error" && (
                <div className="flex justify-center py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    className="gap-1"
                  >
                    <RotateCcw className="size-3" />
                    重试
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* 输入区域 */}
        <AIInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={isLoading}
          placeholder="输入消息，按 Enter 发送..."
        />
      </SheetContent>
    </Sheet>
  );
}
