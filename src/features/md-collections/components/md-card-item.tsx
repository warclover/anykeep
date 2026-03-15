/**
 * MD 收藏卡片组件
 * P2-007: Markdown 内容收藏 - 卡片视图
 */

"use client";

import { memo, useCallback } from "react";
import {
  FileText,
  Clock,
  Tag,
  MoreVertical,
  Trash2,
  Download,
  FileDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONTENT_TYPE_CONFIG, DEFAULT_CONTENT_TYPE_CONFIG } from "../constants";
import type { MdCollection } from "../types";

interface MdCardItemProps {
  /** MD 收藏数据 */
  collection: MdCollection;
  /** 点击回调 */
  onClick?: (id: number) => void;
  /** 删除回调 */
  onDelete?: (id: number) => void;
  /** 下载回调 */
  onDownload?: (collection: MdCollection) => void;
  /** 另存为 TXT 回调 */
  onDownloadAsTxt?: (collection: MdCollection) => void;
  /** 是否正在删除 */
  isDeleting?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * MD 收藏卡片组件
 */
export const MdCardItem = memo(function MdCardItem({
  collection,
  onClick,
  onDelete,
  onDownload,
  onDownloadAsTxt,
  isDeleting = false,
  className,
}: MdCardItemProps) {
  const contentTypeConfig =
    (collection.content_type && CONTENT_TYPE_CONFIG[collection.content_type]) ??
    DEFAULT_CONTENT_TYPE_CONFIG;

  const handleClick = useCallback(() => {
    onClick?.(collection.id);
  }, [onClick, collection.id]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete?.(collection.id);
    },
    [onDelete, collection.id],
  );

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDownload?.(collection);
    },
    [onDownload, collection],
  );

  const handleDownloadAsTxt = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDownloadAsTxt?.(collection);
    },
    [onDownloadAsTxt, collection],
  );

  // 截取摘要
  const truncatedSummary = collection.ai_summary
    ? collection.ai_summary.length > 120
      ? collection.ai_summary.slice(0, 120) + "..."
      : collection.ai_summary
    : null;

  return (
    <div
      className={cn(
        "group relative flex flex-col p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800",
        "hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md",
        "transition-all duration-200 cursor-pointer",
        className,
      )}
      onClick={handleClick}
    >
      {/* 顶部：类型标签和操作 */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded",
            contentTypeConfig.color,
          )}
        >
          <FileText className="w-3 h-3" />
          {contentTypeConfig.label}
        </span>

        {/* 操作菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              下载
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadAsTxt}>
              <FileDown className="w-4 h-4 mr-2" />
              另存为 TXT
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 dark:text-red-400"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 标题 */}
      <h3 className="font-medium text-gray-900 dark:text-white line-clamp-2 mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
        {collection.title}
      </h3>

      {/* 摘要 */}
      {truncatedSummary && (
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 mb-3 flex-1">
          {truncatedSummary}
        </p>
      )}

      {/* AI 标签 */}
      {collection.ai_tags && collection.ai_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {collection.ai_tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded"
            >
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
          {collection.ai_tags.length > 3 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              +{collection.ai_tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* 底部元信息 */}
      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          {/* 字数 */}
          <span>{collection.word_count?.toLocaleString() || 0} 字</span>

          {/* 阅读时间 */}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {collection.reading_time_minutes || 1} 分钟
          </span>
        </div>

        {/* 日期 */}
        <span>
          {new Date(collection.created_at).toLocaleDateString("zh-CN", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      {/* 处理状态指示器 */}
      {collection.processing_status === "processing" && (
        <div className="absolute top-2 right-2">
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </div>
      )}
    </div>
  );
});

export default MdCardItem;
