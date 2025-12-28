"use client";

/**
 * Phase 4: AI 增强消息组件
 *
 * 在原有 AIMessage 基础上增加：
 * - MessageActionsBar: 快速操作栏（复制、重新生成、保存、反馈）
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import { memo, useCallback } from "react";
import { Sparkles, User, AlertCircle, Wrench, Zap, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DisplayMessage, SuggestionItem } from "./types";
import { AIProgressIndicatorInline } from "./ai-progress-indicator";
import { AIDeliverableCard } from "./ai-deliverable-card";
import { AISuggestionsInline } from "./ai-suggestions-panel";
import { MemoryIndicator } from "./memory-indicator";
import { AIMarkdown } from "./ai-markdown";
import { MessageActionsBar } from "./phase4/quick-actions";
import { ReactThinkingDisplay } from "./react-thinking-display";
import { CitationList } from "./citation-reference";
import type { FeedbackDetails } from "./phase4/types";
import type { IntentType } from "@/lib/ai-skills/router/types";
import type { ThinkingRecord } from "@/hooks/domain/ai/use-ai-chat";

// =============================================================================
// 类型定义
// =============================================================================

export interface AIMessageEnhancedProps {
  /** 消息数据 */
  message: DisplayMessage;
  /** 是否是最后一条消息 */
  isLast?: boolean;
  /** 会话 ID */
  conversationId?: string;
  /** 建议点击回调 */
  onSuggestionClick?: (suggestion: SuggestionItem) => void;
  /** 重新生成回调 */
  onRegenerate?: (messageId: string) => void;
  /** 保存到笔记回调 */
  onSaveToNote?: (messageId: string, content: string) => void;
  /** 导出回调 */
  onExport?: (messageId: string, content: string) => void;
  /** 反馈回调 */
  onFeedback?: (
    messageId: string,
    type: "like" | "dislike",
    details?: FeedbackDetails,
  ) => void;
  /** 意图纠正回调 */
  onWrongIntent?: (messageId: string, currentIntent: IntentType) => void;
  /** 引用点击回调 */
  onCitationClick?: (bookmarkId: number) => void;
  /** 当前反馈状态 */
  feedbackGiven?: "like" | "dislike" | null;
}

// =============================================================================
// 组件实现
// =============================================================================

export const AIMessageEnhanced = memo(function AIMessageEnhanced({
  message,
  isLast = false,
  conversationId: _conversationId,
  onSuggestionClick,
  onRegenerate,
  onSaveToNote,
  onExport,
  onFeedback,
  onWrongIntent,
  onCitationClick,
  feedbackGiven,
}: AIMessageEnhancedProps) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const hasError = message.status === "error";
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  const hasProgress = message.progress && message.progress.percent < 100;
  const hasDeliverables =
    message.deliverables && message.deliverables.length > 0;
  const hasSuggestions = message.suggestions && message.suggestions.length > 0;
  const hasMemory =
    message.memory &&
    message.memory.resolved &&
    message.memory.referenceCount > 0;
  const hasThinking = message.thinking && message.thinking.length > 0;
  const hasCitations =
    message.citation &&
    message.citation.citationSummary &&
    message.citation.citationSummary.length > 0;
  const isOrchestration = message.executionMode === "orchestration";
  const isCompleted = message.status === "completed";

  // 显示操作栏的条件：助手消息 + 已完成 + 有内容
  const showActionsBar =
    !isUser && isCompleted && message.content && !isStreaming;

  // 处理操作回调
  const handleRegenerate = useCallback(() => {
    onRegenerate?.(message.id);
  }, [message.id, onRegenerate]);

  const handleSave = useCallback(
    (_noteId: string) => {
      onSaveToNote?.(message.id, message.content);
    },
    [message.id, message.content, onSaveToNote],
  );

  const handleExport = useCallback(() => {
    onExport?.(message.id, message.content);
  }, [message.id, message.content, onExport]);

  const handleFeedback = useCallback(
    (type: "like" | "dislike", details?: FeedbackDetails) => {
      onFeedback?.(message.id, type, details);
    },
    [message.id, onFeedback],
  );

  // 处理意图纠正
  const handleWrongIntent = useCallback(() => {
    // 从消息中获取分类的意图类型，默认为 chitchat
    const classifiedIntent = (message.classifiedIntent ||
      "chitchat") as IntentType;
    onWrongIntent?.(message.id, classifiedIntent);
  }, [message.id, message.classifiedIntent, onWrongIntent]);

  return (
    <div
      className={cn(
        "group relative flex gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* 头像 - 糖果色风格 */}
      <div
        className={cn(
          "flex-shrink-0 flex items-center justify-center size-9 rounded-full shadow-md",
          isUser
            ? "bg-gradient-to-r from-pink-400 to-rose-400"
            : "bg-gradient-to-r from-purple-400 to-indigo-400",
        )}
      >
        {isUser ? (
          <User className="size-4 text-white" />
        ) : (
          <Sparkles className="size-4 text-white" />
        )}
      </div>

      {/* 消息内容 */}
      <div
        className={cn(
          "flex flex-col gap-1 max-w-[80%]",
          isUser ? "items-end" : "items-start",
        )}
      >
        {/* 消息气泡 - 糖果色风格 */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-xs shadow-sm",
            isUser
              ? "bg-gradient-to-r from-pink-400 to-rose-400 text-white rounded-tr-md"
              : "bg-white text-gray-700 border border-purple-100 rounded-tl-md",
            hasError && "bg-red-50 border-red-200 text-red-600",
          )}
        >
          {/* 消息文本 - 使用 Markdown 渲染 */}
          {message.content ? (
            <AIMarkdown content={message.content} isUser={isUser} />
          ) : (
            isStreaming && !message.content && "..."
          )}

          {/* 流式加载指示器 - 打字动画 */}
          {isStreaming && isLast && (
            <span className="inline-flex items-center gap-1 mt-1">
              <span className="flex gap-1">
                <span
                  className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </span>
            </span>
          )}

          {/* 错误信息 */}
          {hasError && message.error && (
            <div className="flex items-center gap-1 mt-2 text-red-500 text-xs">
              <AlertCircle className="size-3" />
              <span>{message.error}</span>
            </div>
          )}
        </div>

        {/* 工具调用信息 - 糖果色标签 */}
        {hasToolCalls && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message
              .toolCalls!.filter((tc) => tc != null)
              .map((tc) => (
                <div
                  key={tc.id}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm",
                    tc.status === "completed"
                      ? "bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 border border-emerald-200"
                      : tc.status === "failed"
                        ? "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200"
                        : "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 border border-amber-200",
                  )}
                >
                  <Wrench className="size-3" />
                  <span>{tc.toolName}</span>
                </div>
              ))}
          </div>
        )}

        {/* 执行模式标签 */}
        {!isUser && isOrchestration && (
          <div className="flex items-center gap-1 mt-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 border border-purple-200">
              <Layers className="size-3" />
              <span>编排模式</span>
              {message.skillId && (
                <span className="text-purple-500">· {message.skillId}</span>
              )}
            </span>
          </div>
        )}
        {!isUser && message.executionMode === "atomic" && (
          <div className="flex items-center gap-1 mt-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-200">
              <Zap className="size-3" />
              <span>原子模式</span>
            </span>
          </div>
        )}

        {/* 记忆指示器 - 显示 AI 理解了上下文 */}
        {!isUser && hasMemory && message.memory && (
          <div className="flex items-center gap-1 mt-1">
            <MemoryIndicator memory={message.memory} showDetails />
          </div>
        )}

        {/* ReAct 思考过程展示（零接管/ReAct 模式） */}
        {!isUser && hasThinking && message.thinking && (
          <div className="mt-2 w-full">
            <ReactThinkingDisplay
              thinking={message.thinking as ThinkingRecord[]}
              isThinking={isStreaming}
              defaultExpanded={false}
            />
          </div>
        )}

        {/* 进度显示 */}
        {hasProgress && message.progress && (
          <div className="mt-2">
            <AIProgressIndicatorInline progress={message.progress} />
          </div>
        )}

        {/* 交付物显示 */}
        {hasDeliverables && (
          <div className="mt-3 space-y-2">
            {message.deliverables!.map((deliverable, index) => (
              <AIDeliverableCard
                key={deliverable.id || `deliverable-${index}`}
                deliverable={deliverable}
              />
            ))}
          </div>
        )}

        {/* 建议显示 */}
        {hasSuggestions && !isStreaming && (
          <div className="mt-3">
            <AISuggestionsInline
              suggestions={message.suggestions!}
              onSuggestionClick={onSuggestionClick}
            />
          </div>
        )}

        {/* 引用来源列表 */}
        {!isUser && hasCitations && message.citation && (
          <CitationList
            citations={message.citation.citationSummary}
            onCitationClick={onCitationClick}
          />
        )}

        {/* 时间戳 */}
        <span className="text-xs text-gray-400 mt-0.5">
          {formatTime(message.createdAt)}
        </span>

        {/* 快速操作栏 - Phase 4 */}
        {showActionsBar && (
          <MessageActionsBar
            messageId={message.id}
            content={message.content}
            onRegenerate={handleRegenerate}
            onSave={handleSave}
            onExport={handleExport}
            onFeedback={handleFeedback}
            onWrongIntent={onWrongIntent ? handleWrongIntent : undefined}
            classifiedIntent={message.classifiedIntent}
            feedbackGiven={feedbackGiven}
            isLoading={false}
          />
        )}
      </div>
    </div>
  );
});

// =============================================================================
// 辅助函数
// =============================================================================

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 小于 1 分钟
  if (diff < 60 * 1000) {
    return "刚刚";
  }

  // 小于 1 小时
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes} 分钟前`;
  }

  // 同一天
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // 其他
  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default AIMessageEnhanced;
