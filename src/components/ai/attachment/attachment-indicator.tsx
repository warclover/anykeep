/**
 * 附件指示器组件
 *
 * 显示已选附件摘要，支持清除和预览操作
 * v1.4.0: 折叠设计，默认收起状态，点击可展开查看详情
 *
 * @version 1.4.0
 * @since 2025-12-26
 * @updated 2026-01-08 - 折叠设计，默认收起状态
 */

"use client";

import { useState } from "react";
import {
  Paperclip,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type AttachmentItem } from "./types";

// =============================================================================
// 类型定义
// =============================================================================

export interface AttachmentIndicatorProps {
  /** 附件列表 */
  items: AttachmentItem[];
  /** 清除回调 */
  onClear: () => void;
  /** 点击展开回调（可选，用于打开附件选择面板） */
  onExpand?: () => void;
  /** 预览单个附件回调（可选） */
  onPreview?: (item: AttachmentItem) => void;
  /** 移除单个附件回调（可选） */
  onRemove?: (id: string) => void;
  /** 自定义类名 */
  className?: string;
  /** 默认是否展开（可选，默认 false） */
  defaultExpanded?: boolean;
}

// =============================================================================
// 子组件：紧凑附件标签
// =============================================================================

interface CompactTagProps {
  item: AttachmentItem;
  onPreview?: (item: AttachmentItem) => void;
  onRemove?: (id: string) => void;
}

/**
 * 获取状态图标（紧凑版）
 */
function getStatusIcon(item: AttachmentItem) {
  switch (item.contentStatus) {
    case "loading":
      return <Loader2 className="size-2.5 animate-spin text-blue-500" />;
    case "ready":
      return <CheckCircle className="size-2.5 text-green-500" />;
    case "error":
      return <AlertCircle className="size-2.5 text-red-500" />;
    case "empty":
      return <AlertCircle className="size-2.5 text-amber-500" />;
    default:
      return null;
  }
}

/**
 * 紧凑附件标签
 */
function CompactTag({ item, onPreview, onRemove }: CompactTagProps) {
  const isBookmark = item.type === "bookmark";
  const statusIcon = getStatusIcon(item);

  // 根据状态调整样式
  const getBgStyle = () => {
    if (item.contentStatus === "error") return "bg-red-100 text-red-700";
    if (item.contentStatus === "loading") return "bg-blue-100 text-blue-700";
    if (item.contentStatus === "empty") return "bg-amber-100 text-amber-700";
    return isBookmark
      ? "bg-pink-100 text-pink-700"
      : "bg-blue-100 text-blue-700";
  };

  // 截断标题（更短）
  const shortTitle =
    item.title.length > 15 ? item.title.slice(0, 15) + "..." : item.title;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md",
        "text-xs flex-shrink-0",
        getBgStyle(),
      )}
      title={item.title}
    >
      {statusIcon}
      <button
        type="button"
        onClick={() => onPreview?.(item)}
        className={cn(
          "truncate",
          onPreview && "hover:underline cursor-pointer",
        )}
      >
        {shortTitle}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
          className="p-0.5 rounded-full hover:bg-black/10"
          title="移除"
        >
          <X className="size-3" />
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
  defaultExpanded = false,
}: AttachmentIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (items.length === 0) {
    return null;
  }

  // 计算状态
  const loadingCount = items.filter(
    (i) => i.contentStatus === "loading",
  ).length;
  const readyCount = items.filter((i) => i.contentStatus === "ready").length;
  const errorCount = items.filter((i) => i.contentStatus === "error").length;
  const emptyCount = items.filter((i) => i.contentStatus === "empty").length;
  const allReady = readyCount + emptyCount === items.length;

  // 状态标签样式
  const getStatusStyle = () => {
    if (loadingCount > 0) return "bg-blue-100 text-blue-600";
    if (errorCount > 0) return "bg-red-100 text-red-600";
    if (allReady) return "bg-green-100 text-green-600";
    return "bg-gray-100 text-gray-600";
  };

  // 状态文本
  const getStatusText = () => {
    if (loadingCount > 0) return "加载中";
    if (errorCount > 0) return `${errorCount}失败`;
    if (allReady) return "就绪";
    return "";
  };

  // 切换展开/收起
  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className={cn("bg-pink-50/50 border-b border-pink-100", className)}>
      {/* 收起状态：单行摘要 */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* 左侧：图标 + 数量 + 状态 */}
        <button
          type="button"
          onClick={onExpand}
          className={cn(
            "flex items-center gap-1.5 text-xs text-pink-700 flex-shrink-0",
            onExpand && "hover:text-pink-800 cursor-pointer",
          )}
        >
          <Paperclip className="size-3.5" />
          <span className="font-medium">{items.length}个附件</span>
        </button>

        {/* 状态指示 */}
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-0.5",
            getStatusStyle(),
          )}
        >
          {loadingCount > 0 && <Loader2 className="size-2.5 animate-spin" />}
          {getStatusText()}
        </span>

        {/* 展开/收起按钮 */}
        <button
          type="button"
          onClick={toggleExpand}
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px]",
            "text-pink-600 hover:bg-pink-100 hover:text-pink-700",
          )}
        >
          {isExpanded ? (
            <>
              收起
              <ChevronUp className="size-3" />
            </>
          ) : (
            <>
              详情
              <ChevronDown className="size-3" />
            </>
          )}
        </button>

        {/* 占位，推右侧按钮到最右 */}
        <div className="flex-1" />

        {/* 右侧：清除按钮 */}
        <button
          type="button"
          onClick={onClear}
          className={cn(
            "flex-shrink-0 px-1.5 py-0.5 rounded text-[10px]",
            "text-pink-600 hover:bg-pink-100 hover:text-pink-700",
          )}
        >
          清除全部
        </button>
      </div>

      {/* 展开状态：显示所有附件标签 */}
      {isExpanded && (
        <div className="px-3 pb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {items.map((item) => (
              <CompactTag
                key={item.id}
                item={item}
                onPreview={onPreview}
                onRemove={onRemove}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AttachmentIndicator;
