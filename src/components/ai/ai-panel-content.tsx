/**
 * AI 面板内容组件
 *
 * 提取的面板核心内容，支持在 Sheet（覆盖式）和 embedded（内嵌式）模式下复用
 * 支持统一智能引擎（原子模式 + 编排模式）
 *
 * ## 版本历史
 * - v2.1.0 (2025-12-24): 集成 Effect Layer 统一确认处理
 * - v2.0.0 (2025-12-24): 集成统一智能引擎
 *
 * @version 2.1.0
 * @since 2025-12-23
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Sparkles,
  Trash2,
  RotateCcw,
  Search,
  FolderOpen,
  BarChart3,
  X,
  BookOpen,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AIMessage } from "./ai-message";
import { AIInput } from "./ai-input";
import { ActionConfirmInline } from "./action-confirm-dialog";
import type { DisplayMessage, SuggestionItem } from "./types";
import { adaptBackendChunk, processUnifiedChunk } from "./types";
import type { AgentStreamChunk } from "@/lib/ai-agent";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";
import { useUnifiedConfirmation } from "@/hooks/domain/ai/use-unified-confirmation";
import { clientLogger } from "@/lib/client-logger";

interface AIPanelContentProps {
  /** 对话 ID（可选，用于继续对话） */
  conversationId?: string;
  /** 关联的书签 ID 列表（可选） */
  bookmarkIds?: number[];
  /** 关联的文件夹 ID（可选） */
  folderId?: number;
  /** 面板标题 */
  title?: string;
  /** 是否显示关闭按钮 */
  showCloseButton?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 自定义 className */
  className?: string;
  /** 是否使用统一引擎（默认 true） */
  useUnifiedEngine?: boolean;
}

/**
 * AI 面板内容组件
 */
export function AIPanelContent({
  conversationId: initialConversationId,
  bookmarkIds,
  folderId,
  title = "AI 知识助手",
  showCloseButton = false,
  onClose,
  className,
  useUnifiedEngine = true,
}: AIPanelContentProps) {
  // 状态
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // 2.4.1: 前端主动生成 conversationId（如未提供）
  // 确保第一次请求就携带 conversationId，支持上下文记忆
  const [conversationId, setConversationId] = useState<string>(
    () => initialConversationId || crypto.randomUUID(),
  );
  // 待确认操作状态
  const [pendingConfirmations, setPendingConfirmations] = useState<
    PendingConfirmation[]
  >([]);
  const [isConfirming, setIsConfirming] = useState(false);
  // 记忆提示状态（显示"AI 记住了"）
  const [showMemoryHint, setShowMemoryHint] = useState(false);

  // Hooks
  const { normalizeConfirmation, confirm, cancel } = useUnifiedConfirmation();

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

  /**
   * 核心发送消息逻辑
   * 提取为独立函数，供 handleSubmit 和 handleSuggestionClick 复用
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
                    setPendingConfirmations((prev) => [
                      ...prev,
                      chunk.confirmation,
                    ]);
                  }

                  // 从 done chunk 中提取 conversationId（用于记忆功能）
                  if (chunk.type === "done" && chunk.data.conversationId) {
                    setConversationId(chunk.data.conversationId);
                  }

                  // 处理记忆块（显示"AI 记住了"提示）
                  if (chunk.type === "memory" && chunk.memory?.resolved) {
                    setShowMemoryHint(true);
                    // 3秒后自动隐藏
                    setTimeout(() => setShowMemoryHint(false), 3000);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleAgentChunk has empty deps and is stable
    [
      isLoading,
      conversationId,
      bookmarkIds,
      folderId,
      messages,
      useUnifiedEngine,
    ],
  );

  // 发送消息（从输入框提交）
  const handleSubmit = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

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
        confirmations.push(chunk.confirmation);
        const updatedMessage = {
          ...currentMessage,
          pendingConfirmations: [...confirmations],
        };
        updateMessage(updatedMessage);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? updatedMessage : m)),
        );
        setPendingConfirmations((prev) => [...prev, chunk.confirmation!]);
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
    [],
  );

  // 处理确认操作
  // v2.1.0: 使用 useUnifiedConfirmation 代替直接 API 调用
  const handleConfirm = useCallback(
    async (confirmationId: string) => {
      const confirmation = pendingConfirmations.find(
        (c) => c.confirmationId === confirmationId,
      );
      if (!confirmation) return;

      setIsConfirming(true);

      try {
        // 使用统一确认 Hook 处理
        const unifiedConfirmation = normalizeConfirmation(confirmation);
        const result = await confirm(unifiedConfirmation);

        clientLogger.debug(
          { confirmationId, success: result.success },
          "AIPanelContent: Confirmation processed",
        );

        // 特殊处理：导出操作的文件下载
        // 注意：导出功能需要从 result.data 中获取文件内容
        // 这个逻辑保留是为了兼容导出工具的特殊返回
        if (
          result.success &&
          confirmation.toolName === "export_bookmarks" &&
          result.data &&
          typeof result.data === "object" &&
          "content" in result.data
        ) {
          const exportData = result.data as {
            content: string;
            filename: string;
            mimeType: string;
            isBase64?: boolean;
          };
          const { content, filename, mimeType, isBase64 } = exportData;
          let blob: Blob;

          if (isBase64) {
            const binaryString = atob(content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            blob = new Blob([bytes], { type: mimeType });
          } else {
            blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }

        const resultMessage: DisplayMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.success
            ? `✅ ${result.message}`
            : `❌ ${result.message}`,
          status: "completed",
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, resultMessage]);

        // 从待确认列表移除
        setPendingConfirmations((prev) =>
          prev.filter((c) => c.confirmationId !== confirmationId),
        );

        // 从消息中的待确认列表移除
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
        clientLogger.error(
          { confirmationId, error },
          "AIPanelContent: Confirmation failed",
        );
        const errorMessage: DisplayMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ 操作执行失败：${error instanceof Error ? error.message : "未知错误"}`,
          status: "error",
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsConfirming(false);
      }
    },
    [pendingConfirmations, normalizeConfirmation, confirm],
  );

  // 处理取消操作
  // v2.1.0: 使用 useUnifiedConfirmation 代替直接 API 调用
  const handleCancel = useCallback(
    async (confirmationId: string) => {
      const confirmation = pendingConfirmations.find(
        (c) => c.confirmationId === confirmationId,
      );
      if (!confirmation) return;

      try {
        // 使用统一确认 Hook 处理取消
        const unifiedConfirmation = normalizeConfirmation(confirmation);
        await cancel(unifiedConfirmation);

        clientLogger.debug(
          { confirmationId },
          "AIPanelContent: Confirmation cancelled",
        );
      } catch {
        // 取消操作失败不影响 UI 更新
        clientLogger.warn(
          { confirmationId },
          "AIPanelContent: Cancel operation failed (ignored)",
        );
      }

      // 从待确认列表移除
      setPendingConfirmations((prev) =>
        prev.filter((c) => c.confirmationId !== confirmationId),
      );

      const cancelMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "❌ 操作已取消",
        status: "completed",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, cancelMessage]);

      // 从消息中的待确认列表移除
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
    [pendingConfirmations, normalizeConfirmation, cancel],
  );

  // 清除对话
  // 2.4.4: 新会话时重置 conversationId，确保上下文隔离
  const handleClear = useCallback(() => {
    setMessages([]);
    setConversationId(crypto.randomUUID()); // 生成新的会话 ID
    setPendingConfirmations([]);
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
      // 直接发送建议内容（优先使用 action，否则使用 text）
      const messageContent = suggestion.action || suggestion.text;
      sendMessage(messageContent);
    },
    [sendMessage],
  );

  return (
    <div className={`flex flex-col h-full ${className || ""}`}>
      {/* 头部 - 糖果色渐变背景（紧凑版） */}
      <div className="relative px-3 py-1.5 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* AI 头像带光环动画 */}
            <div className="relative">
              <div
                className="absolute inset-0 bg-white/30 rounded-full animate-ping opacity-75"
                style={{ animationDuration: "2s" }}
              />
              <div className="relative w-7 h-7 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/40 shadow-md">
                <Sparkles className="size-3.5 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-white">{title}</h3>
              <span className="text-[10px] text-white/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                在线
                {/* 记忆提示 */}
                {showMemoryHint && (
                  <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-white/90 flex items-center gap-0.5 animate-fade-in">
                    <Brain className="size-2.5" />
                    记住了
                  </span>
                )}
              </span>
            </div>
          </div>
          {/* 右侧按钮区域 */}
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleClear}
                title="清除对话"
                className="text-white/80 hover:text-white hover:bg-white/20"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
            {showCloseButton && onClose && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                title="关闭"
                className="text-white/80 hover:text-white hover:bg-white/20"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <ScrollArea
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-gradient-to-b from-pink-50/50 to-white"
      >
        {messages.length === 0 ? (
          /* 欢迎界面 - 糖果风格 */
          <div className="flex flex-col items-center justify-center h-full py-8 px-4">
            <div className="w-full max-w-sm bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-5 border border-pink-100 shadow-sm mb-6">
              <div className="flex items-start gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Sparkles className="size-4 text-white" />
                </div>
                <div>
                  <p className="text-gray-700 font-medium text-[10px]">
                    你好！我是你的 AI 助手 ✨
                  </p>
                  <p className="text-gray-500 text-[10px] mt-0.5">
                    有什么可以帮你的吗？
                  </p>
                </div>
              </div>

              {/* 快捷功能按钮 */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setInput("搜索关于 AI 的文章")}
                  className="px-2.5 py-1 bg-white rounded-full text-[10px] text-pink-600 border border-pink-200 hover:bg-pink-50 hover:border-pink-300 transition-colors flex items-center gap-0.5 shadow-sm"
                >
                  <Search className="size-2.5" />
                  搜索收藏
                </button>
                <button
                  onClick={() => setInput("帮我制定知识复习计划")}
                  className="px-2.5 py-1 bg-white rounded-full text-[10px] text-amber-600 border border-amber-200 hover:bg-amber-50 hover:border-amber-300 transition-colors flex items-center gap-0.5 shadow-sm"
                >
                  <BookOpen className="size-2.5" />
                  知识复习
                </button>
                <button
                  onClick={() => setInput("我有哪些文件夹")}
                  className="px-2.5 py-1 bg-white rounded-full text-[10px] text-purple-600 border border-purple-200 hover:bg-purple-50 hover:border-purple-300 transition-colors flex items-center gap-0.5 shadow-sm"
                >
                  <FolderOpen className="size-2.5" />
                  查看文件夹
                </button>
                <button
                  onClick={() => setInput("统计我的收藏情况")}
                  className="px-2.5 py-1 bg-white rounded-full text-[10px] text-indigo-600 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition-colors flex items-center gap-0.5 shadow-sm"
                >
                  <BarChart3 className="size-2.5" />
                  统计分析
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map((message, index) => (
              <div key={message.id}>
                <AIMessage
                  message={message}
                  isLast={index === messages.length - 1}
                  onSuggestionClick={handleSuggestionClick}
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

      {/* 快捷建议栏 - 有消息时显示 */}
      {messages.length > 0 && !isLoading && (
        <div className="px-4 py-2 border-t border-pink-100 bg-gradient-to-r from-pink-50/50 to-purple-50/50 flex-shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setInput("继续")}
              className="flex-shrink-0 px-3 py-1.5 bg-white border border-pink-200 rounded-full text-xs text-pink-600 hover:bg-pink-50 hover:border-pink-300 transition-colors shadow-sm"
            >
              继续 →
            </button>
            <button
              onClick={() => setInput("帮我制定知识复习计划")}
              className="flex-shrink-0 px-3 py-1.5 bg-white border border-amber-200 rounded-full text-xs text-amber-600 hover:bg-amber-50 hover:border-amber-300 transition-colors shadow-sm flex items-center gap-1"
            >
              <BookOpen className="size-3" />
              知识复习
            </button>
            <button
              onClick={() => setInput("搜索相关内容")}
              className="flex-shrink-0 px-3 py-1.5 bg-white border border-purple-200 rounded-full text-xs text-purple-600 hover:bg-purple-50 hover:border-purple-300 transition-colors shadow-sm"
            >
              🔍 搜索相关
            </button>
            <button
              onClick={() => setInput("给我更多详情")}
              className="flex-shrink-0 px-3 py-1.5 bg-white border border-indigo-200 rounded-full text-xs text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-colors shadow-sm"
            >
              📋 更多详情
            </button>
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <AIInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={isLoading}
        placeholder="输入消息，按 Enter 发送..."
      />
    </div>
  );
}
