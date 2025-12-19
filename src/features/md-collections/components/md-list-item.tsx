/**
 * MD 收藏列表项组件
 * P2-007: Markdown 内容收藏 - 列表视图项
 *
 * 设计特点：
 * - 紧凑布局，适合大量数据展示
 * - 悬停显示操作按钮
 * - 支持 AI 摘要和标签展示
 */

"use client";

import { Button } from "@/components/ui/button";
import { CONTENT_TYPE_CONFIG, DEFAULT_CONTENT_TYPE_CONFIG } from "../constants";
import type { MdCollection } from "../types";
import { cn } from "@/lib/utils";

export interface MdListItemProps {
  collection: MdCollection;
  onClick: (id: number) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}

export function MdListItem({
  collection,
  onClick,
  onDelete,
  isDeleting,
}: MdListItemProps) {
  const contentTypeConfig = (collection.content_type
    ? CONTENT_TYPE_CONFIG[collection.content_type]
    : null) ??
    DEFAULT_CONTENT_TYPE_CONFIG ?? {
      label: "文档",
      color: "bg-gray-100 text-gray-600",
    };

  return (
    <div
      className="group p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors cursor-pointer"
      onClick={() => onClick(collection.id)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <h3 className="font-medium text-gray-900 dark:text-white truncate mb-1 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
            {collection.title}
          </h3>

          {/* 元信息 */}
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {/* 内容类型 */}
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-xs font-medium",
                contentTypeConfig.color,
              )}
            >
              {contentTypeConfig.label}
            </span>

            {/* 字数 */}
            <span>{collection.word_count?.toLocaleString() || 0} 字</span>

            {/* 阅读时间 */}
            <span>{collection.reading_time_minutes || 1} 分钟</span>

            {/* 处理状态 */}
            {collection.processing_status === "processing" && (
              <span className="text-amber-500">AI 处理中...</span>
            )}
            {collection.processing_status === "failed" && (
              <span className="text-red-500">处理失败</span>
            )}

            {/* 创建时间 */}
            <span>
              {new Date(collection.created_at).toLocaleDateString("zh-CN")}
            </span>
          </div>

          {/* AI 摘要 */}
          {collection.ai_summary && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
              {collection.ai_summary}
            </p>
          )}

          {/* AI 标签 */}
          {collection.ai_tags && collection.ai_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {collection.ai_tags.slice(0, 5).map((tag, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(collection.id);
            }}
            disabled={isDeleting}
          >
            删除
          </Button>
        </div>
      </div>
    </div>
  );
}
