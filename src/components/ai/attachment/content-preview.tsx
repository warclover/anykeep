/**
 * 内容预览共享组件
 *
 * 提供统一的内容预览样式和截断处理
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ATTACHMENT_LIMITS } from "./types";

// =============================================================================
// 类型定义
// =============================================================================

export interface ContentPreviewProps {
  /** 内容文本 */
  content?: string;
  /** 是否已被截断（来自数据源） */
  truncated?: boolean;
  /** 最大长度，默认使用 ATTACHMENT_LIMITS.MAX_CONTENT_LENGTH */
  maxLength?: number;
  /** 空状态文本 */
  emptyText?: string;
  /** 截断提示文本 */
  truncatedText?: string;
  /** 是否使用等宽字体（代码/文件内容） */
  monospace?: boolean;
  /** 自定义类名 */
  className?: string;
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 截断内容，防止渲染过长文本导致性能问题
 */
export function truncateContent(
  content: string | undefined,
  maxLength: number = ATTACHMENT_LIMITS.MAX_CONTENT_LENGTH,
): { text: string; isTruncated: boolean } {
  if (!content) {
    return { text: "", isTruncated: false };
  }
  if (content.length <= maxLength) {
    return { text: content, isTruncated: false };
  }
  return {
    text: content.slice(0, maxLength),
    isTruncated: true,
  };
}

// =============================================================================
// 常量
// =============================================================================

const CONTENT_PREVIEW_TEXT = {
  EMPTY: "暂无内容",
  TRUNCATED: "（内容已截断）",
} as const;

// =============================================================================
// 主组件
// =============================================================================

/**
 * 内容预览组件
 *
 * 统一处理内容显示、截断和空状态
 */
export function ContentPreview({
  content,
  truncated = false,
  maxLength = ATTACHMENT_LIMITS.MAX_CONTENT_LENGTH,
  emptyText = CONTENT_PREVIEW_TEXT.EMPTY,
  truncatedText = CONTENT_PREVIEW_TEXT.TRUNCATED,
  monospace = false,
  className,
}: ContentPreviewProps) {
  // 截断内容
  const { text: displayContent, isTruncated } = useMemo(
    () => truncateContent(content, maxLength),
    [content, maxLength],
  );

  const showTruncatedHint = truncated || isTruncated;

  // 空状态
  if (!displayContent) {
    return (
      <div className={cn("rounded-lg bg-muted/50 p-4", className)}>
        <p className="text-xs text-muted-foreground italic">{emptyText}</p>
      </div>
    );
  }

  // 内容显示
  return (
    <div className={cn("rounded-lg bg-muted/50 p-4", className)}>
      {monospace ? (
        <pre className="text-xs text-foreground whitespace-pre-wrap font-mono break-words">
          {displayContent}
          {showTruncatedHint && (
            <span className="text-muted-foreground">{truncatedText}</span>
          )}
        </pre>
      ) : (
        <p className="text-xs text-foreground whitespace-pre-wrap break-words">
          {displayContent}
          {showTruncatedHint && (
            <span className="text-muted-foreground">{truncatedText}</span>
          )}
        </p>
      )}
    </div>
  );
}

export default ContentPreview;
