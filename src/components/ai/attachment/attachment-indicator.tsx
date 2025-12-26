/**
 * 附件指示器组件
 *
 * 显示已选附件摘要，支持清除操作
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { ATTACHMENT_TEXT, type AttachmentItem } from "./types";

// =============================================================================
// 类型定义
// =============================================================================

export interface AttachmentIndicatorProps {
  /** 附件列表 */
  items: AttachmentItem[];
  /** 清除回调 */
  onClear: () => void;
  /** 点击展开回调（可选） */
  onExpand?: () => void;
  /** 自定义类名 */
  className?: string;
}

// =============================================================================
// 组件实现
// =============================================================================

export function AttachmentIndicator({
  items,
  onClear,
  onExpand,
  className,
}: AttachmentIndicatorProps) {
  if (items.length === 0) {
    return null;
  }

  const firstItem = items[0];
  const hasMore = items.length > 1;
  const moreCount = items.length - 1;

  // 构建显示文本
  const displayText = hasMore
    ? `${firstItem.title} · +${moreCount} ${ATTACHMENT_TEXT.INDICATOR_MORE}`
    : firstItem.title;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2",
        "bg-pink-50/50 border-b border-pink-100",
        className,
      )}
    >
      {/* 图标和文本 */}
      <button
        type="button"
        onClick={onExpand}
        className={cn(
          "flex-1 flex items-center gap-2 text-left",
          "text-sm text-pink-700",
          onExpand && "hover:text-pink-800 cursor-pointer",
          !onExpand && "cursor-default",
        )}
      >
        <Paperclip className="size-4 flex-shrink-0" />
        <span className="flex-shrink-0">
          {ATTACHMENT_TEXT.INDICATOR_PREFIX}
        </span>
        <span className="truncate" title={displayText}>
          {displayText}
        </span>
      </button>

      {/* 清除按钮 */}
      <button
        type="button"
        onClick={onClear}
        className={cn(
          "flex-shrink-0 px-2 py-1 rounded-md",
          "text-xs text-pink-600",
          "hover:bg-pink-100 hover:text-pink-700",
          "transition-colors",
        )}
        aria-label={ATTACHMENT_TEXT.CLEAR_BUTTON}
      >
        {ATTACHMENT_TEXT.CLEAR_BUTTON}
      </button>
    </div>
  );
}

export default AttachmentIndicator;
