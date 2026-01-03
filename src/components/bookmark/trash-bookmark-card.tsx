/**
 * 垃圾箱收藏卡片组件
 * 显示垃圾箱中的收藏,包含剩余天数、恢复和永久删除功能
 * V4.2: 使用 React.memo 优化，避免列表中其他卡片变化时的不必要重渲染
 */

"use client";

import { useState, memo } from "react";
import Link from "next/link";
import { RotateCcw, Trash2, ExternalLink, Clock, Calendar } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Bookmark, Platform } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { formatFriendlyDate } from "@/lib/utils/date-utils";
import { generatePlaceholderImage } from "@/lib/utils/placeholder-image";
import { getProxiedImageUrl } from "@/lib/utils/image-proxy";
import { PlatformBadge } from "@/components/ui/platform-badge";

interface TrashBookmarkCardProps {
  bookmark: Bookmark & {
    folders?: { name: string } | null;
  };
  onRestore?: (id: number) => void;
  onPermanentDelete?: (id: number) => void;
  // 批量选择模式
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
}

/**
 * 计算剩余保留天数
 */
function calculateRemainingDays(trashedAt: string | null): number {
  if (!trashedAt) return 30;

  const trashed = new Date(trashedAt);
  const now = new Date();
  const diffMs = now.getTime() - trashed.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const remaining = 30 - diffDays;

  return Math.max(0, remaining);
}

export const TrashBookmarkCard = memo(function TrashBookmarkCard({
  bookmark,
  onRestore,
  onPermanentDelete,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: TrashBookmarkCardProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 生成封面图
  const coverImage =
    getProxiedImageUrl(bookmark.cover_url) ||
    generatePlaceholderImage(bookmark.title ?? "", bookmark.platform as Platform);

  // 计算剩余天数
  const remainingDays = calculateRemainingDays(bookmark.trashed_at);

  const handleRestore = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      await onRestore?.(bookmark.id);
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePermanentDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDeleting) return;

    // 二次确认
    if (!confirm("确定要永久删除这个收藏吗?此操作不可恢复!")) {
      return;
    }

    setIsDeleting(true);
    try {
      await onPermanentDelete?.(bookmark.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleSelect = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleSelect?.(bookmark.id);
  };

  const handleOpenOriginal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all hover:shadow-md",
        isSelectionMode && "cursor-pointer",
        isSelected && "ring-2 ring-blue-500",
      )}
      onClick={isSelectionMode ? handleToggleSelect : undefined}
    >
      <CardHeader className="space-y-3 pb-3">
        {/* 标题行 */}
        <div className="flex items-start gap-3">
          {/* 批量选择复选框 */}
          {isSelectionMode && (
            <div
              className={cn(
                "mt-1 size-5 rounded border-2 flex items-center justify-center shrink-0",
                isSelected
                  ? "bg-blue-500 border-blue-500"
                  : "border-gray-300 dark:border-gray-600",
              )}
            >
              {isSelected && (
                <svg
                  className="size-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-2 mb-2">
              <Link
                href={`/bookmark/${bookmark.id}`}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {bookmark.title ?? ""}
              </Link>
            </CardTitle>

            {/* 剩余天数警告 */}
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium",
                remainingDays <= 7
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
              )}
            >
              <Clock className="size-3" />
              剩余 {remainingDays} 天后永久删除
            </div>
          </div>
        </div>

        {/* 描述 */}
        {bookmark.description && (
          <CardDescription className="line-clamp-2 text-sm">
            {bookmark.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 封面图 - 使用原生 img 避免外部域名配置 */}
        {coverImage && (
          <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt={bookmark.title ?? ""}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

        {/* 元信息 */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <PlatformBadge platform={bookmark.platform ?? "UNKNOWN"} />
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            删除于{" "}
            {formatFriendlyDate(
              bookmark.trashed_at || bookmark.created_at || new Date(),
            )}
          </span>
        </div>

        {/* 标签 */}
        {bookmark.ai_tags && bookmark.ai_tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {bookmark.ai_tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {bookmark.ai_tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{bookmark.ai_tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestore}
            disabled={isRestoring}
            className="flex-1"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {isRestoring ? "恢复中..." : "恢复"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenOriginal}
            className="flex-1"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            查看原文
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handlePermanentDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
