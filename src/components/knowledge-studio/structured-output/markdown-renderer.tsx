/**
 * Markdown 渲染器 (Story 3.2)
 * @module knowledge-studio/structured-output
 *
 * 用于渲染 markdown 类型的结构化输出。
 * 同时作为其他类型验证失败时的降级渲染器。
 */

"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { AIMarkdown } from "@/components/ai/ai-markdown";
import type { MarkdownRendererProps } from "./types";

/**
 * Markdown 渲染器组件
 *
 * - 使用 AIMarkdown 渲染 Markdown 内容
 * - 支持 fallback 提示（当 Schema 验证失败降级时）
 * - 可配置最大高度和滚动
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  data,
  className,
  maxHeight,
}: MarkdownRendererProps) {
  const isFallback = data.meta.isFallback;
  const fallbackReason = data.fallbackReason;

  return (
    <div className={cn("space-y-2", className)}>
      {/* 降级提示 */}
      {isFallback && fallbackReason && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>内容结构解析失败，已降级为 Markdown 显示</span>
          <Badge variant="outline" className="text-xs">
            {fallbackReason}
          </Badge>
        </div>
      )}

      {/* Markdown 内容 */}
      {maxHeight ? (
        <ScrollArea style={{ maxHeight }} className="pr-4">
          <AIMarkdown content={data.content} />
        </ScrollArea>
      ) : (
        <AIMarkdown content={data.content} />
      )}
    </div>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";
