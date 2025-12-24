/**
 * AI 消息组件
 *
 * 显示单条对话消息，支持用户消息和助手消息
 * 糖果色风格设计，支持统一输出协议
 *
 * @version 2.0.0
 * @since 2025-12-22
 * @updated 2025-12-24 - 添加进度、交付物、建议支持
 */

"use client";

import { memo } from "react";
import { Sparkles, User, AlertCircle, Wrench, Zap, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AIMessageProps, SuggestionItem } from "./types";
import { AIProgressIndicatorInline } from "./ai-progress-indicator";
import { AIDeliverableCard } from "./ai-deliverable-card";
import { AISuggestionsInline } from "./ai-suggestions-panel";

/**
 * AI 消息组件 - 糖果色风格
 */
export const AIMessage = memo(function AIMessage({
  message,
  isLast = false,
  onSuggestionClick,
}: AIMessageProps & {
  onSuggestionClick?: (suggestion: SuggestionItem) => void;
}) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const hasError = message.status === "error";
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  const hasProgress = message.progress && message.progress.percent < 100;
  const hasDeliverables =
    message.deliverables && message.deliverables.length > 0;
  const hasSuggestions = message.suggestions && message.suggestions.length > 0;
  const isOrchestration = message.executionMode === "orchestration";

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
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
            "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
            isUser
              ? "bg-gradient-to-r from-pink-400 to-rose-400 text-white rounded-tr-md"
              : "bg-white text-gray-700 border border-purple-100 rounded-tl-md",
            hasError && "bg-red-50 border-red-200 text-red-600",
          )}
        >
          {/* 消息文本 */}
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content || (isStreaming && !message.content && "...")}
          </div>

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
            {message.toolCalls!.map((tc) => (
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
              <AIDeliverableCard key={index} deliverable={deliverable} />
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

        {/* 时间戳 */}
        <span className="text-xs text-gray-400 mt-0.5">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
});

/**
 * 格式化时间
 */
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
