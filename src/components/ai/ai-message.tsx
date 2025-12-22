/**
 * AI 消息组件
 *
 * 显示单条对话消息，支持用户消息和助手消息
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

"use client";

import { memo } from "react";
import { Bot, User, Loader2, AlertCircle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AIMessageProps } from "./types";

/**
 * AI 消息组件
 */
export const AIMessage = memo(function AIMessage({
  message,
  isLast = false,
}: AIMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const hasError = message.status === "error";
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* 头像 */}
      <div
        className={cn(
          "flex-shrink-0 flex items-center justify-center size-8 rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      {/* 消息内容 */}
      <div
        className={cn(
          "flex flex-col gap-1 max-w-[80%]",
          isUser ? "items-end" : "items-start",
        )}
      >
        {/* 消息气泡 */}
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
            hasError && "bg-destructive/10 text-destructive",
          )}
        >
          {/* 消息文本 */}
          <div className="whitespace-pre-wrap break-words">
            {message.content || (isStreaming && !message.content && "...")}
          </div>

          {/* 流式加载指示器 */}
          {isStreaming && isLast && (
            <span className="inline-flex items-center gap-1 text-muted-foreground mt-1">
              <Loader2 className="size-3 animate-spin" />
            </span>
          )}

          {/* 错误信息 */}
          {hasError && message.error && (
            <div className="flex items-center gap-1 mt-2 text-destructive text-xs">
              <AlertCircle className="size-3" />
              <span>{message.error}</span>
            </div>
          )}
        </div>

        {/* 工具调用信息 */}
        {hasToolCalls && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.toolCalls!.map((tc) => (
              <div
                key={tc.id}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs",
                  tc.status === "completed"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : tc.status === "failed"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                )}
              >
                <Wrench className="size-3" />
                <span>{tc.toolName}</span>
              </div>
            ))}
          </div>
        )}

        {/* 时间戳 */}
        <span className="text-xs text-muted-foreground">
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
