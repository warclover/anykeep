/**
 * 附件指示器组件
 *
 * 显示已选附件摘要，支持清除和预览操作
 *
 * @version 1.1.0
 * @since 2025-12-26
 * @updated 2025-12-26 - 添加预览功能支持
 */

"use client";

import { Paperclip, Eye, X } from "lucide-react";
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
  /** 预览单个附件回调（可选） */
  onPreview?: (item: AttachmentItem) => void;
  /** 移除单个附件回调（可选） */
  onRemove?: (id: string) => void;
  /** 自定义类名 */
  className?: string;
}

// =============================================================================
// 子组件：单个附件标签
// =============================================================================

interface AttachmentTagProps {
  item: AttachmentItem;
  onPreview?: (item: AttachmentItem) => void;
  onRemove?: (id: string) => void;
}

function AttachmentTag({ item, onPreview, onRemove }: AttachmentTagProps) {
  const isBookmark = item.type === "bookmark";
  const typeLabel = isBookmark ? "书签" : "文件";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full",
        "text-xs",
        isBookmark ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700",
      )}
      role="listitem"
    >
      {/* 标题 - 可点击预览 */}
      <button
        type="button"
        onClick={() => onPreview?.(item)}
        className={cn(
          "max-w-[120px] truncate",
          onPreview && "hover:underline cursor-pointer",
          !onPreview && "cursor-default",
        )}
        title={`点击预览: ${item.title}`}
        aria-label={`预览${typeLabel}：${item.title}`}
      >
        {item.title}
      </button>

      {/* 预览按钮 */}
      {onPreview && (
        <button
          type="button"
          onClick={() => onPreview(item)}
          className={cn(
            "p-0.5 rounded-full",
            isBookmark ? "hover:bg-pink-200" : "hover:bg-blue-200",
          )}
          title="预览"
          aria-label={`预览${typeLabel}：${item.title}`}
        >
          <Eye className="size-3" aria-hidden="true" />
        </button>
      )}

      {/* 移除按钮 */}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className={cn(
            "p-0.5 rounded-full",
            isBookmark ? "hover:bg-pink-200" : "hover:bg-blue-200",
          )}
          title="移除"
          aria-label={`移除${typeLabel}：${item.title}`}
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// =============================================================================
// 主组件
// =============================================================================

export function AttachmentIndicator({
  items,
  onClear,
  onExpand,
  onPreview,
  onRemove,
  className,
}: AttachmentIndicatorProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2",
        "bg-pink-50/50 border-b border-pink-100",
        className,
      )}
      role="region"
      aria-label={`已选附件：${items.length} 个`}
    >
      {/* 图标 */}
      <button
        type="button"
        onClick={onExpand}
        className={cn(
          "flex items-center gap-1 text-xs text-pink-700",
          onExpand && "hover:text-pink-800 cursor-pointer",
          !onExpand && "cursor-default",
        )}
        aria-label="展开附件面板"
      >
        <Paperclip className="size-4 flex-shrink-0" aria-hidden="true" />
        <span className="flex-shrink-0">
          {ATTACHMENT_TEXT.INDICATOR_PREFIX}
        </span>
      </button>

      {/* 附件标签列表 */}
      <div
        className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-hide"
        role="list"
        aria-label="附件列表"
      >
        {items.map((item) => (
          <AttachmentTag
            key={item.id}
            item={item}
            onPreview={onPreview}
            onRemove={onRemove}
          />
        ))}
      </div>

      {/* 全部清除按钮 */}
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
