/**
 * 书签卡片 - 水平列表变体
 *
 * 水平布局：缩略图（左）+ 内容区（右）+ 操作菜单
 */

"use client";

import { memo } from "react";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PlatformBadge } from "@/components/ui/platform-badge";
import { BookmarkRatingDisplay } from "@/components/bookmark/bookmark-rating-display";
import { ContentTypeBadge } from "@/components/bookmark/content-type-badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/date-utils";
import { getDisplaySummary } from "@/lib/summary/types/ai-summary";
import {
  separateUserTagsExtended,
  getUsageTagStyleExtended,
  getAiTagColor,
} from "@/lib/constants/usage-tags";
import type { ContentType } from "@/lib/summary/content-type-detector";
import type { BookmarkCardViewProps } from "./bookmark-card-types";
import { BookmarkActionMenu } from "./bookmark-card-action-menu";
import { BookmarkSelectionCheckbox } from "./bookmark-card-selection-checkbox";

export const BookmarkCardList = memo(function BookmarkCardList({
  bookmark,
  bookmarkHref,
  isDeleting,
  isSelected,
  isSelectionMode,
  titleLoading,
  coverImage,
  handleImageError,
  handleItemClick,
  handlePrefetch,
  handlePrefetchCancel,
  actionMenuProps,
  customUsageTags,
  t,
}: BookmarkCardViewProps) {
  return (
    <a
      href={bookmarkHref}
      onClick={handleItemClick}
      onMouseEnter={handlePrefetch}
      onMouseLeave={handlePrefetchCancel}
      className="block cursor-pointer no-underline text-inherit"
    >
      <Card
        className={cn(
          "flex flex-row hover:shadow-md transition-shadow cursor-pointer group overflow-hidden",
          isDeleting && "opacity-50 pointer-events-none",
          isSelected && "ring-2 ring-blue-500 dark:ring-blue-400",
        )}
      >
        {/* 选择复选框 */}
        {isSelectionMode && (
          <div className="flex items-center pl-2 sm:pl-3">
            <BookmarkSelectionCheckbox isSelected={isSelected} />
          </div>
        )}

        {/* 缩略图：移动端 80×80 正方形，桌面端保持宽幅比例 */}
        <div className="relative w-20 sm:w-32 md:w-48 flex-shrink-0">
          <div className="relative aspect-square sm:aspect-[2.35/1] h-full sm:h-auto overflow-hidden">
            <Image
              src={coverImage}
              alt={bookmark.title ?? ""}
              fill
              sizes="(max-width: 640px) 80px, (max-width: 768px) 128px, 192px"
              className="object-cover"
              onError={handleImageError}
            />
          </div>
          {/* 平台标识：移动端隐藏（空间不足），桌面端左下角 */}
          <div className="absolute bottom-1 left-1 hidden sm:block">
            <PlatformBadge
              platform={bookmark.platform ?? "UNKNOWN"}
              size="sm"
              showName
            />
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 p-2 sm:p-3 md:p-4 flex flex-col justify-between min-w-0">
          <div>
            {/* 标题行：移动端含平台图标 */}
            <div className="flex items-start gap-1.5 mb-0.5">
              {/* 移动端内联平台图标（替代缩略图上的 Badge） */}
              <div className="flex-shrink-0 mt-0.5 sm:hidden">
                <PlatformBadge
                  platform={bookmark.platform ?? "UNKNOWN"}
                  size="sm"
                />
              </div>
              <h3
                className={cn(
                  "font-semibold line-clamp-1 text-sm sm:text-base flex-1",
                  titleLoading
                    ? "text-gray-400 dark:text-gray-500 italic animate-pulse"
                    : "text-gray-900 dark:text-white",
                )}
              >
                {bookmark.title ?? ""}
              </h3>
            </div>
            {(() => {
              const displaySummary = getDisplaySummary(bookmark.ai_summary);
              return displaySummary ? (
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-1 sm:line-clamp-2">
                  {displaySummary}
                </p>
              ) : null;
            })()}
          </div>

          <div className="flex items-center justify-between gap-2 mt-1 sm:mt-2">
            {/* 左侧：标签和评级 */}
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap min-w-0">
              {/* V6.0新增：评级显示（List视图） */}
              <BookmarkRatingDisplay
                rating={bookmark.rating ?? 0}
                isLocked={bookmark.is_locked ?? false}
                variant="compact"
                className="flex-shrink-0"
              />
              {/* V12.0: AI 整理中状态指示器（list视图） */}
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
              {/* V9.0: AI内容类型徽章 */}
              {bookmark.ai_content_type && (
                <ContentTypeBadge
                  type={bookmark.ai_content_type as ContentType}
                  size="sm"
                  iconOnly
                  className="flex-shrink-0"
                />
              )}
              {/* P3: 标签 - 列表视图简化显示 */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* AI标签标识 */}
                {bookmark.ai_tags && bookmark.ai_tags.length > 0 && (
                  <>
                    <Badge
                      variant="outline"
                      className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300 text-xs"
                    >
                      <Zap className="size-2.5 mr-0.5" />
                      {t.bookmark.ai}
                    </Badge>
                    {bookmark.ai_tags.slice(0, 1).map((tag) => {
                      const colorStyle = getAiTagColor(tag);
                      return (
                        <Badge
                          key={`ai-${tag}`}
                          variant="outline"
                          className={cn(
                            "text-xs hidden sm:inline-flex",
                            colorStyle.bgLight,
                            colorStyle.bgDark,
                            colorStyle.borderLight,
                            colorStyle.borderDark,
                            colorStyle.textLight,
                            colorStyle.textDark,
                          )}
                        >
                          {tag}
                        </Badge>
                      );
                    })}
                  </>
                )}
                {/* 用途标签（仅显示首个） */}
                {(() => {
                  const { usageTags } = separateUserTagsExtended(
                    bookmark.user_tags,
                    customUsageTags,
                  );
                  if (usageTags.length === 0) return null;
                  const tagStyle = getUsageTagStyleExtended(
                    usageTags[0],
                    customUsageTags,
                  );
                  if (!tagStyle) return null;
                  return (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs hidden sm:inline-flex",
                        tagStyle.style.bgLight,
                        tagStyle.style.bgDark,
                        tagStyle.style.borderLight,
                        tagStyle.style.borderDark,
                        tagStyle.style.textLight,
                        tagStyle.style.textDark,
                      )}
                    >
                      {tagStyle.label}
                    </Badge>
                  );
                })()}
              </div>
            </div>

            {/* 右侧：元信息 */}
            <div className="flex items-center gap-1 sm:gap-2 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              <span className="truncate max-w-[60px] sm:max-w-none">
                {bookmark.source_name || bookmark.author || t.common.other}
              </span>
              <span>·</span>
              <span>
                {formatRelativeTime(
                  bookmark.publish_time || bookmark.created_at || new Date(),
                )}
              </span>
            </div>
          </div>
        </div>

        {/* 操作按钮：移动端始终可见，桌面端悬停强调 */}
        {!isSelectionMode && (
          <div className="flex items-center px-1 sm:px-3 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
            <BookmarkActionMenu {...actionMenuProps} />
          </div>
        )}
      </Card>
    </a>
  );
});
