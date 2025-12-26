"use client";

/**
 * Phase 4: AI 增强面板内容组件
 *
 * 在原有 AIPanelContent 基础上集成：
 * - ToolSelector: 工具选择器（跳过意图分类）
 * - ContextPanel: 上下文引用面板
 * - MessageActionsBar: 消息快速操作栏
 * - FeedbackService: 反馈收集
 * - ExplicitToolRouter: 显式工具路由
 * - IntentCorrectionDialog: 意图纠正对话框
 * - AttachmentManager: 附件管理（书签/文件）
 *
 * @version 1.2.0
 * @since 2025-12-25
 * @updated 2025-12-26 - 添加附件管理功能
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Sparkles, Trash2, RotateCcw, X, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AIMessageEnhanced } from "./ai-message-enhanced";
import { AIInputEnhanced } from "./ai-input-enhanced";
import { ActionConfirmInline } from "./action-confirm-dialog";
import {
  ContextPanel,
  useContextItems,
  AIWelcomeScreen,
  AISuggestionBar,
  IntentCorrectionDialog,
} from "./phase4";
import type { ToolType, FeedbackDetails } from "./phase4/types";
import type { IntentType } from "@/lib/ai-skills/router/types";
import type { DisplayMessage, SuggestionItem } from "./types";
import { adaptBackendChunk, processUnifiedChunk } from "./types";
import type { AgentStreamChunk } from "@/lib/ai-agent";
import type { PendingConfirmation } from "@/lib/ai-agent/tools/types";
import { useUnifiedConfirmation } from "@/hooks/domain/ai/use-unified-confirmation";
import { useAttachmentManager } from "@/hooks/ai/use-attachment-manager";
import { buildAttachmentContext } from "@/lib/ai-agent/context/attachment-context-builder";
import { clientLogger } from "@/lib/client-logger";

// =============================================================================
// 类型定义
// =============================================================================

interface AIPanelContentEnhancedProps {
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

// =============================================================================
// 消息反馈状态跟踪
// =============================================================================

type FeedbackMap = Record<string, "like" | "dislike">;

// =============================================================================
// 组件实现
// =============================================================================

export function AIPanelContentEnhanced({
  conversationId: initialConversationId,
  bookmarkIds,
  folderId,
  title = "AI 知识助手",
  showCloseButton = false,
  onClose,
  className,
  useUnifiedEngine = true,
}: AIPanelContentEnhancedProps) {
  // 核心状态
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId,
  );

  // Phase 4 状态
  const [selectedTool, setSelectedTool] = useState<ToolType>("auto");
  const [_showContextPanel, _setShowContextPanel] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<FeedbackMap>({});

  // 待确认操作状态
  const [pendingConfirmations, setPendingConfirmations] = useState<
    PendingConfirmation[]
  >([]);
  const [isConfirming, setIsConfirming] = useState(false);

  // 记忆提示状态
  const [showMemoryHint, setShowMemoryHint] = useState(false);

  // Phase 4: 意图纠正对话框状态
  const [intentCorrectionState, setIntentCorrectionState] = useState<{
    open: boolean;
    messageId: string;
    originalInput: string;
    wrongIntent: IntentType;
  }>({
    open: false,
    messageId: "",
    originalInput: "",
    wrongIntent: "chitchat",
  });

  // 上下文管理 Hook
  const {
    items: contextItems,
    expanded: contextExpanded,
    setExpanded: setContextExpanded,
    addItem: _addContextItem,
    removeItem: removeContextItem,
    clearItems: clearContextItems,
    getContextReferences,
    hasItems: hasContextItems,
  } = useContextItems();

  // 附件管理 Hook
  const {
    attachments,
    addFiles: handleAddFiles,
    setAttachments: handleAttachmentsChange,
    clearAll: handleClearAttachments,
    isProcessingFile,
  } = useAttachmentManager();

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
   */
  const sendMessage = useCallback(
    async (content: string, tool: ToolType = "auto") => {
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

        // 获取上下文引用
        const contextReferences = getContextReferences();

        // 构建附件上下文
        const attachmentContext = buildAttachmentContext(attachments);

        // 构建请求体
        const requestBody: Record<string, unknown> = {
          message: userMessage.content,
          conversationId,
          messageHistory,
          bookmarkIds,
          folderId,
          options: {
            streaming: true,
            enableUnified: useUnifiedEngine,
          },
        };

        // 添加附件上下文
        if (attachmentContext) {
          requestBody.attachmentContext = attachmentContext;
        }

        // Phase 4: 显式工具选择
        if (tool !== "auto") {
          requestBody.explicitTool = {
            toolId: tool,
            skipIntentClassification: true,
          };
        }

        // Phase 4: 上下文引用
        if (contextReferences.bookmarkIds || contextReferences.folderIds) {
          requestBody.contextReferences = contextReferences;
        }

        // 调用 API
        const response = await fetch("/api/agent/unified", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
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
        let sseBuffer = ""; // 用于缓冲不完整的 SSE 行

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // 将新数据追加到缓冲区
          sseBuffer += decoder.decode(value, { stream: true });

          // 按换行符分割，保留最后一个可能不完整的行
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() || ""; // 保留最后一行（可能不完整）

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const rawChunk = JSON.parse(line.slice(6));

                if (useUnifiedEngine) {
                  const chunk = adaptBackendChunk(rawChunk);
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

                  // 从 done chunk 中提取 conversationId
                  if (chunk.type === "done" && chunk.data.conversationId) {
                    setConversationId(chunk.data.conversationId);
                  }

                  // 处理记忆块
                  if (chunk.type === "memory" && chunk.memory?.resolved) {
                    setShowMemoryHint(true);
                    setTimeout(() => setShowMemoryHint(false), 3000);
                  }
                } else {
                  // 兼容模式处理...
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

        // 标记完成
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id && m.status === "streaming"
              ? { ...m, status: "completed" }
              : m,
          ),
        );

        // 发送成功后重置工具选择
        setSelectedTool("auto");
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
                ? { ...m, status: "error", error: errorMessage }
                : m,
            ),
          );
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isLoading,
      conversationId,
      bookmarkIds,
      folderId,
      messages,
      useUnifiedEngine,
      getContextReferences,
      attachments,
    ],
  );

  // 处理提交
  const handleSubmit = useCallback(
    (tool: ToolType) => {
      sendMessage(input, tool);
    },
    [input, sendMessage],
  );

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
  const handleConfirm = useCallback(
    async (confirmationId: string) => {
      const confirmation = pendingConfirmations.find(
        (c) => c.confirmationId === confirmationId,
      );
      if (!confirmation) return;

      setIsConfirming(true);

      try {
        const unifiedConfirmation = normalizeConfirmation(confirmation);
        const result = await confirm(unifiedConfirmation);

        // 处理导出操作的文件下载
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
          "AIPanelContentEnhanced: Confirmation failed",
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
  const handleCancel = useCallback(
    async (confirmationId: string) => {
      const confirmation = pendingConfirmations.find(
        (c) => c.confirmationId === confirmationId,
      );
      if (!confirmation) return;

      try {
        const unifiedConfirmation = normalizeConfirmation(confirmation);
        await cancel(unifiedConfirmation);
      } catch {
        // 取消操作失败不影响 UI 更新
      }

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
  const handleClear = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setPendingConfirmations([]);
    setFeedbackMap({});
    clearContextItems();
  }, [clearContextItems]);

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

  // Phase 4: 重新生成回调
  const handleRegenerate = useCallback(
    (messageId: string) => {
      // 找到对应的用户消息
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex <= 0) return;

      const userMessage = messages[messageIndex - 1];
      if (userMessage.role !== "user") return;

      // 移除当前助手消息
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      // 重新发送用户消息
      sendMessage(userMessage.content);
    },
    [messages, sendMessage],
  );

  // Phase 4: 保存到笔记回调
  const handleSaveToNote = useCallback(
    async (messageId: string, content: string) => {
      try {
        const message = messages.find((m) => m.id === messageId);

        const response = await fetch("/api/ai/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            sourceType: "ai_response",
            sourceConversationId: conversationId,
            sourceMessageId: messageId,
            sourceSkillId: message?.skillId,
            relatedBookmarkIds: bookmarkIds,
          }),
        });

        const result = await response.json();

        if (result.success) {
          clientLogger.info(
            { noteId: result.data.id },
            "Note saved successfully",
          );
        } else {
          clientLogger.error({ error: result.error }, "Failed to save note");
        }
      } catch (error) {
        clientLogger.error({ messageId, error }, "Save to note error");
      }
    },
    [messages, conversationId, bookmarkIds],
  );

  // Phase 4: 导出回调
  const handleExport = useCallback((messageId: string, content: string) => {
    // 简单导出为文本文件
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-response-${messageId.slice(0, 8)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Phase 4: 反馈回调
  const handleFeedback = useCallback(
    async (
      messageId: string,
      type: "like" | "dislike",
      details?: FeedbackDetails,
    ) => {
      // 更新本地状态
      setFeedbackMap((prev) => ({ ...prev, [messageId]: type }));

      // 找到消息获取上下文
      const message = messages.find((m) => m.id === messageId);
      if (!message) return;

      try {
        const response = await fetch("/api/ai/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId,
            conversationId: conversationId || "",
            type: type === "like" ? "positive" : "negative",
            negativeReason: details?.reasons[0],
            comment: details?.comment,
            context: {
              originalMessage: message.content,
              classifiedIntent: message.executionMode || "unknown",
              toolUsed: message.skillId || "chat",
              executionMode: message.executionMode,
              skillId: message.skillId,
            },
          }),
        });

        const result = await response.json();

        if (result.success) {
          clientLogger.info(
            { feedbackId: result.data.feedbackId },
            "Feedback submitted",
          );
        } else {
          clientLogger.error(
            { error: result.error },
            "Failed to submit feedback",
          );
        }
      } catch (error) {
        clientLogger.error({ messageId, error }, "Feedback submission error");
      }
    },
    [messages, conversationId],
  );

  // Phase 4: 意图纠正回调
  const handleWrongIntent = useCallback(
    (messageId: string, currentIntent: IntentType) => {
      // 找到对应的用户消息来获取原始输入
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      let originalInput = "";

      if (messageIndex > 0) {
        const userMessage = messages[messageIndex - 1];
        if (userMessage.role === "user") {
          originalInput = userMessage.content;
        }
      }

      // 打开意图纠正对话框
      setIntentCorrectionState({
        open: true,
        messageId,
        originalInput,
        wrongIntent: currentIntent,
      });
    },
    [messages],
  );

  return (
    <div className={`flex flex-col h-full ${className || ""}`}>
      {/* 头部 - 糖果色渐变背景 */}
      <div className="relative px-5 py-4 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="absolute inset-0 bg-white/30 rounded-full animate-ping opacity-75"
                style={{ animationDuration: "2s" }}
              />
              <div className="relative w-11 h-11 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border-2 border-white/40 shadow-lg">
                <Sparkles className="size-5 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{title}</h3>
              <p className="text-xs text-white/80 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                在线 · 随时为您服务
                {showMemoryHint && (
                  <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-white/90 flex items-center gap-1 animate-fade-in">
                    <Brain className="size-3" />
                    AI 记住了
                  </span>
                )}
              </p>
            </div>
          </div>
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

      {/* 上下文面板 - Phase 4 */}
      {hasContextItems && (
        <div className="px-4 pt-2 flex-shrink-0">
          <ContextPanel
            items={contextItems}
            onRemove={removeContextItem}
            onClear={clearContextItems}
            onAddMore={() => _setShowContextPanel(true)}
            expanded={contextExpanded}
            onExpandedChange={setContextExpanded}
          />
        </div>
      )}

      {/* 消息列表 */}
      <ScrollArea
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-gradient-to-b from-pink-50/50 to-white"
      >
        {messages.length === 0 ? (
          <AIWelcomeScreen onSetInput={setInput} />
        ) : (
          <div className="py-2">
            {messages.map((message, index) => (
              <div key={message.id}>
                <AIMessageEnhanced
                  message={message}
                  isLast={index === messages.length - 1}
                  conversationId={conversationId}
                  onSuggestionClick={handleSuggestionClick}
                  onRegenerate={handleRegenerate}
                  onSaveToNote={handleSaveToNote}
                  onExport={handleExport}
                  onFeedback={handleFeedback}
                  onWrongIntent={handleWrongIntent}
                  feedbackGiven={feedbackMap[message.id] || null}
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

      {/* 快捷建议栏 */}
      <AISuggestionBar
        onSetInput={setInput}
        visible={messages.length > 0 && !isLoading}
      />

      {/* 增强输入区域 - Phase 4 */}
      <AIInputEnhanced
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={isLoading}
        placeholder="输入消息，按 Enter 发送..."
        selectedTool={selectedTool}
        onToolChange={setSelectedTool}
        contextItems={contextItems}
        onExpandContext={() => setContextExpanded(true)}
        onClearContext={clearContextItems}
        attachments={attachments}
        onAttachmentsChange={handleAttachmentsChange}
        onClearAttachments={handleClearAttachments}
        onAddFiles={handleAddFiles}
        isProcessingFile={isProcessingFile}
      />

      {/* Phase 4: 意图纠正对话框 */}
      <IntentCorrectionDialog
        open={intentCorrectionState.open}
        onOpenChange={(open) =>
          setIntentCorrectionState((prev) => ({ ...prev, open }))
        }
        messageId={intentCorrectionState.messageId}
        originalInput={intentCorrectionState.originalInput}
        wrongIntent={intentCorrectionState.wrongIntent}
      />
    </div>
  );
}

export default AIPanelContentEnhanced;
