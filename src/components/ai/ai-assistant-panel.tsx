/**
 * AI 助手面板组件
 *
 * 提供与 AI 助手对话的完整界面
 * 通过 API 路由与后端 Agent 交互
 *
 * @version 1.1.0
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
import type { AIAssistantPanelProps, DisplayMessage } from "./types";
import type { AgentStreamChunk, AgentToolCall } from "@/lib/ai-agent";

/**
 * AI 助手面板组件
 */
export function AIAssistantPanel({
  open,
  onOpenChange,
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
      // 调用 Agent API
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
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
              } else if (chunk.type === "done" && chunk.result) {
                // 标记完成
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? {
                          ...m,
                          content: fullContent || chunk.result!.content,
                          status: "completed",
                          toolCalls: chunk.result!.toolCalls,
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
            } catch {
              // 忽略解析错误
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
  }, [input, isLoading, conversationId, bookmarkIds]);

  // 清除对话
  const handleClear = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
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
                <AIMessage
                  key={message.id}
                  message={message}
                  isLast={index === messages.length - 1}
                />
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
