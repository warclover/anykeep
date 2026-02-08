/**
 * 浏览器书签列表项组件 (V4.2.2)
 * 专为浏览器书签设计的紧凑列表视图
 *
 * 性能优化：
 * - 使用本地域名首字母头像，无外部 favicon 网络请求
 * - 确定性配色：同域名始终同色
 *
 * V4.2.2 更新：
 * - favicon 改为纯本地首字母方案，消除 DuckDuckGo/Google 超时
 * V4.2.1 更新：
 * - 添加快照状态指示器支持
 */

"use client";

import { useMemo, memo, useCallback } from "react";
import Link from "next/link";
import {
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  Folder,
  Camera,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BookmarkWithSnapshot } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { getMergedTags, limitTags } from "@/lib/utils/unified-tags";
import { getFaviconInfo } from "@/lib/utils/favicon";
import { useSnapshotFeature } from "@/lib/feature-flags";

interface BookmarkListItemProps {
  bookmark: BookmarkWithSnapshot & {
    folders?: { name: string } | null;
  };
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  // 批量选择模式
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
}

/**
 * 浏览器书签列表项组件
 *
 * @performance 使用 React.memo 优化，避免不必要的重渲染
 * @since V4.2.2 添加 memo + useCallback 优化
 */
export const BookmarkListItem = memo(function BookmarkListItem({
  bookmark,
  onEdit,
  onDelete,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: BookmarkListItemProps) {
  const isSnapshotEnabled = useSnapshotFeature();

  // V4.2.1: 快照状态显示
  const hasSnapshot = isSnapshotEnabled && bookmark.has_snapshot;

  // 性能优化：使用 useCallback 避免每次渲染创建新函数
  const handleDelete = useCallback(() => {
    onDelete?.(bookmark.id);
  }, [onDelete, bookmark.id]);

  const handleEdit = useCallback(() => {
    onEdit?.(bookmark.id);
  }, [onEdit, bookmark.id]);

  const handleToggleSelect = useCallback(() => {
    onToggleSelect?.(bookmark.id);
  }, [onToggleSelect, bookmark.id]);

  // 性能优化：缓存 Favicon 信息（纯本地生成，无网络请求）
  const favicon = useMemo(() => getFaviconInfo(bookmark.url), [bookmark.url]);

  // 性能优化：缓存合并后的标签
  const mergedTags = useMemo(() => getMergedTags(bookmark), [bookmark]);
  const { visible: displayTags, remaining: moreTagsCount } = useMemo(
    () => limitTags(mergedTags, 3),
    [mergedTags],
  );

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 transition-colors",
        "hover:bg-gray-50 dark:hover:bg-gray-800/50",
        isSelectionMode && "cursor-pointer",
        isSelected && "bg-blue-50 dark:bg-blue-900/20",
      )}
      onClick={isSelectionMode ? handleToggleSelect : undefined}
    >
      {/* 选择框（批量选择模式） */}
      {isSelectionMode && (
        <div
          className={cn(
            "w-4 h-4 border-2 rounded flex items-center justify-center flex-shrink-0",
            isSelected
              ? "bg-blue-500 border-blue-500"
              : "border-gray-300 dark:border-gray-600",
          )}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      )}

      {/* Favicon - 纯本地首字母头像，无外部网络请求 */}
      <div
        className={cn(
          "w-4 h-4 flex-shrink-0 relative rounded text-[10px] font-medium flex items-center justify-center",
          favicon.bgClass,
          favicon.textClass,
        )}
      >
        {favicon.letter}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-w-0">
        {/* 标题 */}
        <Link
          href={`/bookmark/${bookmark.id}`}
          className={cn(
            "block text-sm font-medium truncate transition-colors",
            bookmark.title === "正在获取标题..."
              ? "text-gray-400 dark:text-gray-500 italic animate-pulse"
              : "text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400",
          )}
        >
          {bookmark.title || "无标题"}
        </Link>

        {/* URL */}
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {bookmark.url}
        </p>

        {/* 标签 + 文件夹 + 快照状态 */}
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
          {/* V4.2.1: 快照状态指示器 */}
          {hasSnapshot && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-0.5 text-green-600 dark:text-green-400 flex-shrink-0">
                    <Camera className="w-3 h-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  已保存网页快照
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* 标签（统一显示 ai_tags + user_tags） */}
          {displayTags.length > 0 && (
            <div className="flex items-center gap-1 truncate">
              {displayTags.map((tag) => (
                <span key={tag} className="text-blue-600 dark:text-blue-400">
                  #{tag}
                </span>
              ))}
              {moreTagsCount > 0 && (
                <span className="text-gray-400">+{moreTagsCount}</span>
              )}
            </div>
          )}

          {/* 文件夹 */}
          {bookmark.folders && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Folder className="w-3 h-3" />
              <span className="truncate max-w-[120px]">
                {bookmark.folders.name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 操作菜单 */}
      {!isSelectionMode && (
        <div
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label={`书签操作: ${bookmark.title || bookmark.url}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  打开链接
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="mr-2 h-4 w-4" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-red-600 focus:text-red-600 dark:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
});

// 辅助组件：Check Icon（用于选择框）
function Check({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
