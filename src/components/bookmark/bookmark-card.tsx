/**
 * 收藏卡片组件
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  Check,
  FileText,
  Image as ImageIcon,
  Folder,
  Tag,
  Circle,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Bookmark } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/date-utils";
import { generatePlaceholderImage } from "@/lib/utils/placeholder-image";
import { getProxiedImageUrl } from "@/lib/utils/image-proxy";
import { PlatformBadge } from "@/components/ui/platform-badge";

type ViewVariant = "card" | "list" | "compact";

interface BookmarkCardProps {
  bookmark: Bookmark & {
    folders?: { name: string } | null;
  };
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onToggleRead?: (id: number, isRead: boolean) => void;
  // 批量选择模式
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  // 视图模式
  variant?: ViewVariant;
}

export function BookmarkCard({
  bookmark,
  onEdit,
  onDelete,
  onToggleRead,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  variant = "card",
}: BookmarkCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  // 生成封面图（真实封面或占位符，微信图片使用代理）
  const coverImage =
    getProxiedImageUrl(bookmark.cover_url) ||
    generatePlaceholderImage(bookmark.title, bookmark.platform);

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit?.(bookmark.id);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete?.(bookmark.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenOriginal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
    // 自动标记为已读（如果当前是未读状态）
    if (!bookmark.is_read && onToggleRead) {
      onToggleRead(bookmark.id, true);
    }
  };

  const handleToggleSelect = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleSelect?.(bookmark.id);
  };

  const handleToggleRead = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleRead?.(bookmark.id, !bookmark.is_read);
  };

  // 操作菜单组件（复用）
  const ActionMenu = ({
    className = "",
    variant: menuVariant = "default",
  }: {
    className?: string;
    variant?: "default" | "mobile";
  }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "h-8 w-8 bg-white/95 hover:bg-white dark:bg-gray-800/95 dark:hover:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600",
            menuVariant === "mobile" && "h-9 w-9",
            className,
          )}
        >
          <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleOpenOriginal}>
          <ExternalLink className="mr-2 h-4 w-4" />
          打开原文
        </DropdownMenuItem>
        {onToggleRead && (
          <DropdownMenuItem onClick={handleToggleRead}>
            {bookmark.is_read ? (
              <>
                <Circle className="mr-2 h-4 w-4" />
                标记为未读
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                标记为已读
              </>
            )}
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-red-600 dark:text-red-400"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? "删除中..." : "删除"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // 选择复选框组件（复用）
  const SelectionCheckbox = ({ className = "" }: { className?: string }) => (
    <div
      className={cn(
        "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
        isSelected
          ? "bg-blue-500 border-blue-500"
          : "bg-white/90 border-gray-300 dark:bg-gray-800/90 dark:border-gray-600",
        className,
      )}
    >
      {isSelected && <Check className="w-4 h-4 text-white" />}
    </div>
  );

  // 紧凑列表视图（compact）
  if (variant === "compact") {
    return (
      <Link
        href={isSelectionMode ? "#" : `/bookmark/${bookmark.id}`}
        onClick={isSelectionMode ? handleToggleSelect : undefined}
      >
        <div
          className={cn(
            "flex items-center gap-2 sm:gap-4 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow cursor-pointer group",
            isDeleting && "opacity-50 pointer-events-none",
            isSelected && "ring-2 ring-blue-500 dark:ring-blue-400",
          )}
        >
          {/* 选择复选框 */}
          {isSelectionMode && <SelectionCheckbox />}

          {/* 平台标识 */}
          <PlatformBadge platform={bookmark.platform} size="sm" />

          {/* 标题和元信息 */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-white truncate text-sm sm:text-base">
              {bookmark.title}
            </h3>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {/* compact 视图：简洁显示来源/作者 */}
              <span className="truncate max-w-[80px] sm:max-w-none">
                {bookmark.source_name || bookmark.author || "未知作者"}
              </span>
              <span>·</span>
              <span className="flex-shrink-0">
                {formatRelativeTime(bookmark.created_at)}
              </span>
              {bookmark.folders && (
                <span className="hidden sm:contents">
                  <span>·</span>
                  <span className="truncate">{bookmark.folders.name}</span>
                </span>
              )}
            </div>
          </div>

          {/* 操作按钮 - 移动端始终显示，桌面端悬停显示 */}
          {!isSelectionMode && (
            <div className="flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <ActionMenu />
            </div>
          )}
        </div>
      </Link>
    );
  }

  // 列表视图（list）- 移动端垂直布局，桌面端水平布局
  if (variant === "list") {
    return (
      <Link
        href={isSelectionMode ? "#" : `/bookmark/${bookmark.id}`}
        onClick={isSelectionMode ? handleToggleSelect : undefined}
      >
        <Card
          className={cn(
            "flex flex-col sm:flex-row hover:shadow-md transition-shadow cursor-pointer group overflow-hidden",
            isDeleting && "opacity-50 pointer-events-none",
            isSelected && "ring-2 ring-blue-500 dark:ring-blue-400",
          )}
        >
          {/* 移动端：顶部区域（封面 + 选择框 + 操作按钮） */}
          <div className="relative sm:hidden">
            {/* 封面图 - 移动端全宽 */}
            <div className="aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImage}
                alt={bookmark.title}
                className="w-full h-full object-cover"
              />
            </div>
            {/* 平台标识 */}
            <div className="absolute bottom-2 left-2">
              <PlatformBadge platform={bookmark.platform} size="sm" />
            </div>
            {/* 选择复选框 - 移动端右上角 */}
            {isSelectionMode && (
              <div className="absolute top-2 right-2">
                <SelectionCheckbox />
              </div>
            )}
            {/* 操作按钮 - 移动端右上角 */}
            {!isSelectionMode && (
              <div className="absolute top-2 right-2">
                <ActionMenu variant="mobile" />
              </div>
            )}
          </div>

          {/* 桌面端：选择复选框 */}
          {isSelectionMode && (
            <div className="hidden sm:flex items-center px-3">
              <SelectionCheckbox />
            </div>
          )}

          {/* 桌面端：缩略图 */}
          <div className="relative hidden sm:block w-32 md:w-48 flex-shrink-0">
            <div className="aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImage}
                alt={bookmark.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-2 left-2">
              <PlatformBadge platform={bookmark.platform} size="sm" showName />
            </div>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 p-3 sm:p-3 md:p-4 flex flex-col justify-between min-w-0">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 sm:line-clamp-1 mb-1 text-sm sm:text-base">
                {bookmark.title}
              </h3>
              {bookmark.ai_summary && (
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {bookmark.ai_summary}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 mt-2">
              {/* 标签 - 移动端也显示少量 */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {bookmark.ai_tags && bookmark.ai_tags.length > 0 && (
                  <>
                    <Badge
                      variant="outline"
                      className="bg-pink-100 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700 text-pink-700 dark:text-pink-300 text-xs"
                    >
                      AI
                    </Badge>
                    {bookmark.ai_tags.slice(0, 1).map((tag) => (
                      <Badge
                        key={`ai-${tag}`}
                        variant="secondary"
                        className="text-xs hidden sm:inline-flex"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </>
                )}
              </div>

              {/* 元信息 */}
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                {/* list 视图：简洁显示来源/作者 */}
                <span className="truncate max-w-[80px] sm:max-w-none">
                  {bookmark.source_name || bookmark.author || "未知"}
                </span>
                <span>·</span>
                <span>{formatRelativeTime(bookmark.created_at)}</span>
              </div>
            </div>
          </div>

          {/* 桌面端：操作按钮 */}
          {!isSelectionMode && (
            <div className="hidden sm:flex items-center px-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionMenu />
            </div>
          )}
        </Card>
      </Link>
    );
  }

  // 卡片视图（card，默认 - 瀑布流样式）
  return (
    <Link
      href={isSelectionMode ? "#" : `/bookmark/${bookmark.id}`}
      onClick={isSelectionMode ? handleToggleSelect : undefined}
    >
      <Card
        className={cn(
          "h-full hover:shadow-md transition-shadow cursor-pointer flex flex-col group relative",
          isDeleting && "opacity-50 pointer-events-none",
          isSelected && "ring-2 ring-blue-500 dark:ring-blue-400",
        )}
      >
        {/* 封面图 - 16:9 比例（总是显示，使用真实图片或占位符） */}
        <div className="relative aspect-video overflow-hidden rounded-t-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImage}
            alt={bookmark.title}
            className="w-full h-full object-cover"
          />
          {/* 平台标识 - PRD v4.1: Source Memory 强化 */}
          <div className="absolute top-2 left-2">
            <PlatformBadge platform={bookmark.platform} size="md" showName />
          </div>

          {/* 批量选择模式：复选框 */}
          {isSelectionMode && (
            <div className="absolute top-2 right-2">
              <SelectionCheckbox />
            </div>
          )}

          {/* 正常模式：操作按钮 - 移动端始终显示，桌面端悬停显示 */}
          {!isSelectionMode && (
            <div className="absolute top-2 right-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <ActionMenu variant="mobile" />
            </div>
          )}
        </div>

        <CardHeader className="pb-3">
          <div className="flex items-start gap-2">
            {/* 未读指示器 */}
            {!bookmark.is_read && (
              <Circle className="size-2 mt-2 flex-shrink-0 fill-blue-500 text-blue-500" />
            )}
            <CardTitle
              className={cn(
                "line-clamp-2 text-base min-h-[3rem] leading-6",
                bookmark.is_read && "text-gray-500 dark:text-gray-400",
              )}
            >
              {bookmark.title}
            </CardTitle>
          </div>
          {bookmark.ai_summary && (
            <CardDescription className="line-clamp-2">
              {bookmark.ai_summary}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          {/* 标签区域 */}
          {((bookmark.ai_tags && bookmark.ai_tags.length > 0) ||
            (bookmark.user_tags && bookmark.user_tags.length > 0)) && (
            <div className="flex flex-wrap gap-1 mb-3">
              {/* AI 标签 */}
              {bookmark.ai_tags && bookmark.ai_tags.length > 0 && (
                <>
                  <Badge
                    variant="outline"
                    className="bg-pink-100 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700 text-pink-700 dark:text-pink-300 text-xs"
                  >
                    AI
                  </Badge>
                  {bookmark.ai_tags.slice(0, 2).map((tag) => (
                    <Badge
                      key={`ai-${tag}`}
                      variant="secondary"
                      className="text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </>
              )}
              {/* 用户标签 */}
              {bookmark.user_tags && bookmark.user_tags.length > 0 && (
                <>
                  {bookmark.user_tags.slice(0, 2).map((tag) => (
                    <Badge
                      key={`user-${tag}`}
                      variant="outline"
                      className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-xs"
                    >
                      <Tag className="size-2.5 mr-0.5" />
                      {tag}
                    </Badge>
                  ))}
                </>
              )}
              {/* 溢出计数 */}
              {(bookmark.ai_tags?.length || 0) +
                (bookmark.user_tags?.length || 0) >
                4 && (
                <Badge variant="outline" className="text-xs">
                  +
                  {(bookmark.ai_tags?.length || 0) +
                    (bookmark.user_tags?.length || 0) -
                    4}
                </Badge>
              )}
            </div>
          )}

          {/* 元信息 */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* 来源名称和作者显示逻辑 */}
              {bookmark.source_name &&
              bookmark.author &&
              bookmark.source_name !== bookmark.author ? (
                // 两者都有且不同：显示 "来源 · 作者"
                <span className="truncate">
                  <span className="text-gray-600 dark:text-gray-300">
                    {bookmark.source_name}
                  </span>
                  <span className="mx-1">·</span>
                  <span>{bookmark.author}</span>
                </span>
              ) : (
                // 只显示一个（优先 author）
                <span className="truncate">
                  {bookmark.author || bookmark.source_name || "未知作者"}
                </span>
              )}
              {bookmark.folders && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 truncate">
                    <Folder className="size-3 flex-shrink-0" />
                    <span className="truncate">{bookmark.folders.name}</span>
                  </span>
                </>
              )}
            </div>
            <span className="flex items-center gap-1 flex-shrink-0">
              {bookmark.publish_time ? (
                <>
                  <Calendar className="size-3" />
                  {formatRelativeTime(bookmark.publish_time)}
                </>
              ) : (
                formatRelativeTime(bookmark.created_at)
              )}
            </span>
          </div>

          {/* 内容统计 */}
          {(bookmark.word_count || bookmark.image_count) && (
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600 dark:text-gray-300">
              {bookmark.word_count != null && bookmark.word_count > 0 && (
                <span className="flex items-center gap-1">
                  <FileText className="size-3" />
                  {bookmark.word_count >= 10000
                    ? `${(bookmark.word_count / 10000).toFixed(1)}万字`
                    : `${bookmark.word_count}字`}
                </span>
              )}
              {bookmark.image_count != null && bookmark.image_count > 0 && (
                <span className="flex items-center gap-1">
                  <ImageIcon className="size-3" aria-hidden="true" />
                  {bookmark.image_count}图
                </span>
              )}
            </div>
          )}

          {/* 处理状态 */}
          {bookmark.status === "PROCESSING" && (
            <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
              <span className="animate-pulse">●</span>
              处理中...
            </div>
          )}
          {bookmark.status === "FAILED" && (
            <div className="mt-2 text-xs text-red-500">处理失败</div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
