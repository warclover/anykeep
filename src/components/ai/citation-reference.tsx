/**
 * 引用渲染组件
 *
 * 将 AI 响应中的 [^N] 引用标注渲染为可交互的链接
 * 支持 Tooltip 显示书签标题，点击跳转到书签
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

"use client";

import { memo, useMemo, useCallback } from "react";
import { ExternalLink, BookOpen } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Citation } from "@/hooks/domain/ai/use-ai-chat";

// ============================================
// 类型定义
// ============================================

export interface CitationReferenceProps {
  /** 引用信息 */
  citation: Citation;
  /** 点击回调 */
  onClick?: (bookmarkId: number) => void;
  /** 自定义类名 */
  className?: string;
  /** 是否内联显示（不换行） */
  inline?: boolean;
}

export interface CitationListProps {
  /** 引用列表 */
  citations: Citation[];
  /** 点击回调 */
  onCitationClick?: (bookmarkId: number) => void;
  /** 自定义类名 */
  className?: string;
  /** 标题 */
  title?: string;
}

export interface CitationTextProps {
  /** 包含 [^N] 引用的文本 */
  text: string;
  /** 引用列表 */
  citations: Citation[];
  /** 点击回调 */
  onCitationClick?: (bookmarkId: number) => void;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 辅助组件
// ============================================

/**
 * 单个引用标注组件
 */
export const CitationReference = memo(function CitationReference({
  citation,
  onClick,
  className,
  inline = true,
}: CitationReferenceProps) {
  const handleClick = useCallback(() => {
    onClick?.(citation.bookmarkId);
  }, [onClick, citation.bookmarkId]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            className={cn(
              "inline-flex items-center justify-center",
              "text-xs font-medium",
              "text-blue-600 dark:text-blue-400",
              "hover:text-blue-700 dark:hover:text-blue-300",
              "hover:underline",
              "transition-colors",
              "cursor-pointer",
              inline ? "mx-0.5" : "",
              className,
            )}
          >
            <sup className="text-[10px]">[{citation.index}]</sup>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <BookOpen className="size-3 flex-shrink-0" />
              <span className="text-sm font-medium line-clamp-2">
                {citation.title}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs opacity-70">
              <ExternalLink className="size-3" />
              <span>点击查看书签</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

/**
 * 引用列表组件（显示在响应末尾）
 */
export const CitationList = memo(function CitationList({
  citations,
  onCitationClick,
  className,
  title = "参考来源",
}: CitationListProps) {
  if (citations.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-4 pt-4 border-t border-gray-200 dark:border-gray-700",
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="size-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {title}
        </span>
      </div>
      <ol className="space-y-1.5 list-none pl-0">
        {citations.map((citation) => (
          <li key={citation.index} className="flex items-start gap-2">
            <span className="flex-shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400 min-w-[1.5rem]">
              [{citation.index}]
            </span>
            <button
              type="button"
              onClick={() => onCitationClick?.(citation.bookmarkId)}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-left transition-colors"
            >
              {citation.title}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
});

/**
 * 带引用解析的文本组件
 *
 * 将文本中的 [^N] 替换为可交互的引用链接
 */
export const CitationText = memo(function CitationText({
  text,
  citations,
  onCitationClick,
  className,
}: CitationTextProps) {
  // 创建引用索引映射
  const citationMap = useMemo(() => {
    const map = new Map<number, Citation>();
    for (const citation of citations) {
      map.set(citation.index, citation);
    }
    return map;
  }, [citations]);

  // 解析文本，将 [^N] 替换为组件
  const parsedContent = useMemo(() => {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // 创建新的正则表达式实例（避免修改全局常量）
    const pattern = /\[\^(\d+)\]/g;

    while ((match = pattern.exec(text)) !== null) {
      // 添加匹配前的文本
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      // 添加引用组件
      const citationIndex = parseInt(match[1], 10);
      const citation = citationMap.get(citationIndex);

      if (citation) {
        parts.push(
          <CitationReference
            key={`citation-${match.index}`}
            citation={citation}
            onClick={onCitationClick}
          />,
        );
      } else {
        // 如果找不到引用，保留原文
        parts.push(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    // 添加剩余文本
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  }, [text, citationMap, onCitationClick]);

  return <span className={className}>{parsedContent}</span>;
});

/**
 * 引用摘要指示器（显示引用数量）
 */
export const CitationIndicator = memo(function CitationIndicator({
  count,
  onClick,
  className,
}: {
  count: number;
  onClick?: () => void;
  className?: string;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5",
        "text-xs font-medium",
        "bg-blue-50 dark:bg-blue-900/30",
        "text-blue-600 dark:text-blue-400",
        "rounded-full",
        "hover:bg-blue-100 dark:hover:bg-blue-900/50",
        "transition-colors",
        className,
      )}
    >
      <BookOpen className="size-3" />
      <span>{count} 个引用</span>
    </button>
  );
});

export default CitationReference;
