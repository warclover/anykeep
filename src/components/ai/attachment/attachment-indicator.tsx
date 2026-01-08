/**
 * 附件指示器组件
 *
 * 显示已选附件摘要，支持清除和预览操作
 * 增强版：显示附件内容状态（加载中/就绪/错误/空）
 *
 * @version 1.2.0
 * @since 2025-12-26
 * @updated 2026-01-08 - 添加内容状态显示
 */

"use client";

import {
  Paperclip,
  Eye,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
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

/**
 * 获取状态图标
 */
function getStatusIcon(item: AttachmentItem) {
  switch (item.contentStatus) {
    case "loading":
      return (
        <Loader2
          className="size-3 animate-spin text-blue-500"
          aria-hidden="true"
        />
      );
    case "ready":
      return (
        <CheckCircle className="size-3 text-green-500" aria-hidden="true" />
      );
    case "error":
      return <AlertCircle className="size-3 text-red-500" aria-hidden="true" />;
    case "empty":
      return (
        <AlertCircle className="size-3 text-amber-500" aria-hidden="true" />
      );
    default:
      return null;
  }
}

/**
 * 获取状态提示文本
 */
function getStatusTooltip(item: AttachmentItem): string {
  switch (item.contentStatus) {
    case "loading":
      return "正在加载内容...";
    case "ready":
      return "内容已就绪";
    case "error":
      return item.errorMessage || "内容加载失败";
    case "empty":
      return "无内容摘要（仅有标题）";
    default:
      return "";
  }
}

function AttachmentTag({ item, onPreview, onRemove }: AttachmentTagProps) {
  const isBookmark = item.type === "bookmark";
  const typeLabel = isBookmark ? "书签" : "文件";
  const statusIcon = getStatusIcon(item);
  const statusTooltip = getStatusTooltip(item);

  // 根据状态调整样式
  const getBackgroundStyle = () => {
    if (item.contentStatus === "error") {
      return isBookmark ? "bg-red-100 text-red-700" : "bg-red-100 text-red-700";
    }
    if (item.contentStatus === "loading") {
      return isBookmark
        ? "bg-blue-100 text-blue-700"
        : "bg-blue-100 text-blue-700";
    }
    if (item.contentStatus === "empty") {
      return isBookmark
        ? "bg-amber-100 text-amber-700"
        : "bg-amber-100 text-amber-700";
    }
    // ready or default
    return isBookmark
      ? "bg-pink-100 text-pink-700"
      : "bg-blue-100 text-blue-700";
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full",
        "text-xs",
        getBackgroundStyle(),
      )}
      role="listitem"
      title={statusTooltip}
    >
      {/* 状态图标 */}
      {statusIcon}

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

  // 计算状态统计
  const loadingCount = items.filter(
    (i) => i.contentStatus === "loading",
  ).length;
  const readyCount = items.filter((i) => i.contentStatus === "ready").length;
  const errorCount = items.filter((i) => i.contentStatus === "error").length;
  const emptyCount = items.filter((i) => i.contentStatus === "empty").length;
  const allReady = readyCount + emptyCount === items.length;

  // 状态摘要文本
  const getStatusSummary = () => {
    if (loadingCount > 0) {
      return `加载中 ${loadingCount}/${items.length}`;
    }
    if (errorCount > 0) {
      return `${errorCount} 个失败`;
    }
    if (emptyCount > 0 && readyCount === 0) {
      return "无内容";
    }
    if (allReady) {
      return "就绪";
    }
    return "";
  };

  const statusSummary = getStatusSummary();

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
      {/* 图标和状态 */}
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
        {/* 状态摘要 */}
        {statusSummary && (
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
              loadingCount > 0 && "bg-blue-100 text-blue-600",
              errorCount > 0 && !loadingCount && "bg-red-100 text-red-600",
              allReady && !errorCount && "bg-green-100 text-green-600",
            )}
          >
            {loadingCount > 0 && (
              <Loader2 className="inline size-2.5 mr-0.5 animate-spin" />
            )}
            {statusSummary}
          </span>
        )}
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
