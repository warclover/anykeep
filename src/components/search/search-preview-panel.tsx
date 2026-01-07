/**
 * 搜索结果预览面板
 *
 * 鼠标悬停搜索结果时，显示更多内容预览
 * 支持快捷操作和详细信息展示
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

"use client";

import { memo, useState } from "react";
import {
  ExternalLink,
  Calendar,
  Tag,
  Folder,
  Eye,
  Copy,
  Share2,
  Clock,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Bookmark } from "@/types/supabase";

// ============================================
// 类型定义
// ============================================

export interface SearchPreviewPanelProps {
  /** 书签数据 */
  bookmark: Bookmark & { folders?: { name: string } | null };
  /** 是否显示 */
  visible: boolean;
  /** 位置（相对于触发元素） */
  position?: "left" | "right";
  /** 关闭回调 */
  onClose?: () => void;
  /** 查看详情回调 */
  onViewDetail?: (bookmark: Bookmark) => void;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 常量
// ============================================

const PLATFORM_COLORS: Record<string, string> = {
  wechat: "bg-green-100 text-green-700 border-green-200",
  bilibili: "bg-pink-100 text-pink-700 border-pink-200",
  xiaohongshu: "bg-red-100 text-red-700 border-red-200",
  zhihu: "bg-blue-100 text-blue-700 border-blue-200",
  juejin: "bg-sky-100 text-sky-700 border-sky-200",
  csdn: "bg-orange-100 text-orange-700 border-orange-200",
  browser: "bg-gray-100 text-gray-700 border-gray-200",
};

// ============================================
// 组件
// ============================================

/**
 * 搜索预览面板
 */
export const SearchPreviewPanel = memo(function SearchPreviewPanel({
  bookmark,
  visible,
  position = "right",
  onClose,
  onViewDetail,
  className,
}: SearchPreviewPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!visible) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(bookmark.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 复制失败时静默处理
    }
  };

  const handleOpenLink = () => {
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: bookmark.title,
          url: bookmark.url,
        });
      } catch {
        // 分享取消或失败时静默处理
      }
    } else {
      handleCopyUrl();
    }
  };

  const platformColor =
    PLATFORM_COLORS[bookmark.platform?.toLowerCase() || "browser"] ||
    PLATFORM_COLORS.browser;

  // 格式化日期
  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // 计算阅读时间（假设每分钟 300 字）
  const estimateReadTime = () => {
    const content = bookmark.ai_summary || bookmark.title || "";
    const wordCount = content.length;
    const minutes = Math.ceil(wordCount / 300);
    return minutes < 1 ? "< 1 分钟" : `${minutes} 分钟`;
  };

  // 合并 AI 标签和用户标签
  const allTags = [...(bookmark.ai_tags || []), ...(bookmark.user_tags || [])];

  return (
    <div
      className={cn(
        "absolute z-50 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        position === "right" ? "left-full ml-4" : "right-full mr-4",
        "top-0",
        className,
      )}
      onMouseLeave={onClose}
    >
      {/* 封面图（如果有） */}
      {bookmark.cover_url && (
        <div className="relative h-32 overflow-hidden rounded-t-xl">
          <img
            src={bookmark.cover_url}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      <div className="p-4">
        {/* 标题 */}
        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2">
          {bookmark.title}
        </h3>

        {/* 平台和时间 */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className={cn("text-xs", platformColor)}>
            {bookmark.platform || "未知"}
          </Badge>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Calendar className="size-3" />
            {formatDate(bookmark.created_at || new Date())}
          </span>
        </div>

        {/* 摘要 */}
        {bookmark.ai_summary && (
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-4 mb-3">
            {bookmark.ai_summary}
          </p>
        )}

        {/* 标签 */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {allTags.slice(0, 5).map((tag: string) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
              >
                <Tag className="size-2.5 mr-1" />
                {tag}
              </Badge>
            ))}
            {allTags.length > 5 && (
              <span className="text-xs text-gray-400">
                +{allTags.length - 5}
              </span>
            )}
          </div>
        )}

        {/* 元数据 */}
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
          {bookmark.folders?.name && (
            <span className="flex items-center gap-1">
              <Folder className="size-3" />
              {bookmark.folders.name}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {estimateReadTime()}
          </span>
          {bookmark.word_count && (
            <span className="flex items-center gap-1">
              <FileText className="size-3" />
              {bookmark.word_count.toLocaleString()} 字
            </span>
          )}
        </div>

        {/* 快捷操作 */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 flex-1"
                onClick={() => onViewDetail?.(bookmark)}
              >
                <Eye className="size-4 mr-1" />
                详情
              </Button>
            </TooltipTrigger>
            <TooltipContent>查看详情</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 flex-1"
                onClick={handleOpenLink}
              >
                <ExternalLink className="size-4 mr-1" />
                打开
              </Button>
            </TooltipTrigger>
            <TooltipContent>在新标签页打开</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={handleCopyUrl}
              >
                <Copy className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copied ? "已复制!" : "复制链接"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={handleShare}
              >
                <Share2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>分享</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});

export default SearchPreviewPanel;
