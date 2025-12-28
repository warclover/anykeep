/**
 * 搜索结果卡片组件
 *
 * 展示单个搜索结果，包括标题、摘要、相关度等信息
 * 支持关键词高亮和相关度标签
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

"use client";

import { memo } from "react";
import { ExternalLink, Calendar, Tag, Folder, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  SearchResultItem,
  RelevanceLevel,
} from "@/lib/ai-skills/search/types";

// ============================================
// 类型定义
// ============================================

export interface SearchResultCardProps {
  /** 搜索结果项 */
  result: SearchResultItem;
  /** 点击回调 */
  onClick?: (result: SearchResultItem) => void;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 常量
// ============================================

const RELEVANCE_CONFIG: Record<
  RelevanceLevel,
  { label: string; color: string; bgColor: string }
> = {
  high: {
    label: "高度相关",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100 border-emerald-200",
  },
  medium: {
    label: "相关",
    color: "text-amber-700",
    bgColor: "bg-amber-100 border-amber-200",
  },
  low: {
    label: "可能相关",
    color: "text-gray-600",
    bgColor: "bg-gray-100 border-gray-200",
  },
};

// ============================================
// 组件
// ============================================

/**
 * 搜索结果卡片
 */
export const SearchResultCard = memo(function SearchResultCard({
  result,
  onClick,
  showDetails = true,
  className,
}: SearchResultCardProps) {
  const relevanceConfig = RELEVANCE_CONFIG[result.relevance];

  const handleClick = () => {
    onClick?.(result);
  };

  const handleOpenLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-white p-4 shadow-sm transition-all",
        "hover:shadow-md hover:border-purple-200",
        onClick && "cursor-pointer",
        className,
      )}
      onClick={handleClick}
    >
      {/* 相关度指示器 */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "text-xs font-medium",
            relevanceConfig.bgColor,
            relevanceConfig.color,
          )}
        >
          <Circle
            className={cn(
              "size-2 mr-1",
              result.relevance === "high" && "fill-emerald-500",
              result.relevance === "medium" && "fill-amber-500",
              result.relevance === "low" && "fill-gray-400",
            )}
          />
          {relevanceConfig.label}
        </Badge>
      </div>

      {/* 标题 */}
      <h3 className="pr-24 font-medium text-gray-900 line-clamp-2 group-hover:text-purple-700 transition-colors">
        <HighlightedText text={result.title} />
      </h3>

      {/* 平台和时间 */}
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100">
          {result.platform}
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar className="size-3" />
          {formatDate(result.createdAt)}
        </span>
      </div>

      {/* 摘要（高亮关键词） */}
      {result.summary && showDetails && (
        <p className="mt-3 text-sm text-gray-600 line-clamp-3">
          <HighlightedText text={result.summary} />
        </p>
      )}

      {/* 标签和文件夹 */}
      {showDetails && (result.tags?.length || result.folderName) && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {result.folderName && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Folder className="size-3" />
              {result.folderName}
            </span>
          )}
          {result.tags?.slice(0, 3).map((tag) => (
            <Badge
              key={`tag-${tag}`}
              variant="secondary"
              className="text-xs bg-purple-50 text-purple-700 border-purple-100"
            >
              <Tag className="size-2.5 mr-1" />
              {tag}
            </Badge>
          ))}
          {result.tags && result.tags.length > 3 && (
            <span className="text-xs text-gray-400">
              +{result.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={handleOpenLink}
        >
          <ExternalLink className="size-3 mr-1" />
          打开链接
        </Button>
      </div>
    </div>
  );
});

/**
 * 高亮文本组件
 *
 * 将 **keyword** 格式转换为高亮显示
 */
function HighlightedText({ text }: { text: string }) {
  // 匹配 **text** 格式
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          // 高亮部分
          const highlighted = part.slice(2, -2);
          return (
            <mark
              key={`hl-${index}-${highlighted.slice(0, 10)}`}
              className="bg-yellow-200 text-yellow-900 px-0.5 rounded"
            >
              {highlighted}
            </mark>
          );
        }
        return <span key={`txt-${index}`}>{part}</span>;
      })}
    </>
  );
}

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return "今天";
  } else if (days === 1) {
    return "昨天";
  } else if (days < 7) {
    return `${days} 天前`;
  } else if (days < 30) {
    return `${Math.floor(days / 7)} 周前`;
  } else {
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
  }
}

export default SearchResultCard;
