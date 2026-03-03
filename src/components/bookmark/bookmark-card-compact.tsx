/**
 * 书签卡片 - 紧凑列表变体
 *
 * 单行布局：平台图标 + 标题 + 元信息 + 操作菜单
 */

"use client";

import { memo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";
import { PlatformBadge } from "@/components/ui/platform-badge";
import { BookmarkRatingDisplay } from "@/components/bookmark/bookmark-rating-display";
import { ContentTypeBadge } from "@/components/bookmark/content-type-badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/date-utils";
import type { ContentType } from "@/lib/classification/content-type-detector";
import type { BookmarkCardViewProps } from "./bookmark-card-types";
import { BookmarkActionMenu } from "./bookmark-card-action-menu";
import { BookmarkSelectionCheckbox } from "./bookmark-card-selection-checkbox";

export const BookmarkCardCompact = memo(function BookmarkCardCompact({
  bookmark,
  bookmarkHref,
  isDeleting,
  isSelected,
  isSelectionMode,
  titleLoading,
  handleItemClick,
  handlePrefetch,
  handlePrefetchCancel,
  actionMenuProps,
  customUsageTags: _customUsageTags,
  t,
}: BookmarkCardViewProps) {
  return (
    <a
      href={bookmarkHref}
      onClick={handleItemClick}
      onMouseEnter={handlePrefetch}
      onMouseLeave={handlePrefetchCancel}
      className={cn(
        "flex items-center gap-2 sm:gap-4 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow cursor-pointer group no-underline text-inherit",
        isDeleting && "opacity-50 pointer-events-none",
        isSelected && "ring-2 ring-blue-500 dark:ring-blue-400",
      )}
    >
      {/* 选择复选框 */}
      {isSelectionMode && <BookmarkSelectionCheckbox isSelected={isSelected} />}

      {/* 平台标识 */}
      <PlatformBadge platform={bookmark.platform ?? "UNKNOWN"} size="sm" />

      {/* 标题和元信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3
            className={cn(
              "font-medium truncate text-sm sm:text-base flex-1",
              titleLoading
                ? "text-gray-400 dark:text-gray-500 italic animate-pulse"
                : "text-gray-900 dark:text-white",
            )}
          >
            {bookmark.title ?? ""}
          </h3>
          {/* V12.0: AI 整理中状态指示器（compact视图） */}
          {bookmark.pending_cluster && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 cursor-help flex-shrink-0">
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  <span className="hidden sm:inline">
                    {t.bookmark.aiOrganizing}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <p className="text-xs">{t.bookmark.aiOrganizingTooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
          {/* V6.0新增：评级显示（Compact视图） */}
          <BookmarkRatingDisplay
            rating={bookmark.rating ?? 0}
            isLocked={bookmark.is_locked ?? false}
            variant="compact"
            className="flex-shrink-0"
          />
          {/* V9.0: AI内容类型徽章（仅图标） */}
          {bookmark.ai_content_type && (
            <ContentTypeBadge
              type={bookmark.ai_content_type as ContentType}
              size="sm"
              iconOnly
              className="flex-shrink-0"
            />
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          <span className="truncate max-w-[80px] sm:max-w-none">
            {bookmark.source_name ||
              bookmark.author ||
              t.bookmark.unknownAuthor}
          </span>
          <span>·</span>
          <span className="flex-shrink-0">
            {formatRelativeTime(
              bookmark.publish_time || bookmark.created_at || new Date(),
            )}
          </span>
          {bookmark.folders && (
            <span className="hidden sm:contents">
              <span>·</span>
              <span className="truncate">{bookmark.folders.name}</span>
            </span>
          )}
        </div>
      </div>

      {/* 操作按钮 - 移动端始终显示，桌面端弱显示+悬停强调 */}
      {!isSelectionMode && (
        <div className="flex-shrink-0 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
          <BookmarkActionMenu {...actionMenuProps} />
        </div>
      )}
    </a>
  );
});
