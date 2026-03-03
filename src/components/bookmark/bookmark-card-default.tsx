/**
 * 书签卡片 - 默认卡片变体（瀑布流样式）
 *
 * 垂直布局：封面图（顶部）+ 标题摘要 + 标签 + 元信息（底部）
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
import { Circle, Lock, Star, Sparkles } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { PlatformBadge } from "@/components/ui/platform-badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/date-utils";
import { getPlatformHexColor } from "@/lib/constants/platforms";
import { getDisplaySummary } from "@/lib/classification/types/ai-summary";
import {
  separateUserTagsExtended,
  getUsageTagStyleExtended,
  getAiTagColor,
} from "@/lib/constants/usage-tags";
import type { BookmarkCardViewProps } from "./bookmark-card-types";
import { BookmarkActionMenu } from "./bookmark-card-action-menu";
import { BookmarkSelectionCheckbox } from "./bookmark-card-selection-checkbox";

export const BookmarkCardDefault = memo(function BookmarkCardDefault({
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
      className="block h-full cursor-pointer no-underline text-inherit"
    >
      <Card
        className={cn(
          "h-full card-hover-effect cursor-pointer flex flex-col group relative pt-0 pb-0",
          isDeleting && "opacity-50 pointer-events-none",
          isSelected && "ring-2 ring-blue-500 dark:ring-blue-400",
        )}
      >
        {/* 封面图 - 2.35:1 宽幅比例，更好适配微信等平台封面 */}
        <div className="relative aspect-[2.35/1] overflow-hidden rounded-t-xl">
          <Image
            src={coverImage}
            alt={bookmark.title ?? ""}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
            className="object-cover card-cover-top card-cover-zoom"
            onError={handleImageError}
          />
          {/* 平台标识 - P0.5: 缩放70%显示 */}
          <div className="absolute top-3 left-3 scale-[0.7] origin-top-left">
            <PlatformBadge
              platform={bookmark.platform ?? "UNKNOWN"}
              size="lg"
              showName
            />
          </div>

          {/* V6.0新增：锁定图标 - 右上角（优先级高于选择和操作按钮） */}
          {bookmark.is_locked && !isSelectionMode && (
            <div className="absolute top-2 right-2">
              <div className="bg-yellow-500/90 text-white p-1.5 rounded-md shadow-md">
                <Lock className="size-4" />
              </div>
            </div>
          )}

          {/* V8.0新增：星标图标 - 右上角（锁定图标右侧或单独显示） */}
          {bookmark.is_starred && !isSelectionMode && !bookmark.is_locked && (
            <div className="absolute top-2 right-2">
              <div className="bg-yellow-400/90 text-white p-1.5 rounded-md shadow-md">
                <Star className="size-4 fill-white" />
              </div>
            </div>
          )}
          {/* 星标 + 锁定同时显示时 */}
          {bookmark.is_starred && bookmark.is_locked && !isSelectionMode && (
            <div className="absolute top-2 right-12">
              <div className="bg-yellow-400/90 text-white p-1.5 rounded-md shadow-md">
                <Star className="size-4 fill-white" />
              </div>
            </div>
          )}

          {/* 批量选择模式：复选框 */}
          {isSelectionMode && (
            <div className="absolute top-2 right-2">
              <BookmarkSelectionCheckbox isSelected={isSelected} />
            </div>
          )}

          {/* 正常模式：操作按钮 - 移动端始终显示，桌面端悬停显示 */}
          {!isSelectionMode && !bookmark.is_locked && (
            <div className="absolute top-2 right-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <BookmarkActionMenu {...actionMenuProps} variant="mobile" />
            </div>
          )}
        </div>

        {/* V4.2.24: 优化间距以降低卡片高度 */}
        <CardHeader className="pb-0 pt-0.5 px-3">
          <div className="flex items-start gap-2">
            {/* 未读指示器 */}
            {!bookmark.is_read && (
              <Circle className="size-2 mt-2 flex-shrink-0 fill-blue-500 text-blue-500" />
            )}
            {/* V4.2.24: 标题固定两行高度，保持卡片对齐 */}
            <CardTitle
              className={cn(
                "text-sm leading-tight line-clamp-2 min-h-[2.5rem]",
                titleLoading
                  ? "text-gray-400 dark:text-gray-500 italic animate-pulse"
                  : bookmark.is_read
                    ? "text-gray-500 dark:text-gray-400"
                    : "",
              )}
            >
              {bookmark.title ?? ""}
            </CardTitle>
          </div>
          {/* V4.2.24: 摘要固定两行高度，保持卡片对齐 */}
          <CardDescription className="text-xs leading-tight mt-0.5 line-clamp-3 min-h-[2.8125rem] text-muted-foreground">
            {getDisplaySummary(bookmark.ai_summary) || "\u00A0"}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 pb-0 px-3 flex-1 flex flex-col">
          {/* V4.2.24: 标签区域简化 - 单行显示，无背景框 */}
          {(() => {
            const { usageTags, regularTags } = separateUserTagsExtended(
              bookmark.user_tags,
              customUsageTags,
            );
            const hasAiTags = bookmark.ai_tags && bookmark.ai_tags.length > 0;
            const hasUsageTags = usageTags.length > 0;
            const hasRegularTags = regularTags.length > 0;
            const hasTags = hasAiTags || hasUsageTags || hasRegularTags;

            if (!hasTags) return null;

            // 合并所有标签，按优先级：AI标签 > 用途标签 > 普通标签
            const allTags: { tag: string; type: "ai" | "usage" | "regular" }[] =
              [];
            if (hasAiTags) {
              (bookmark.ai_tags ?? []).forEach((tag) =>
                allTags.push({ tag, type: "ai" }),
              );
            }
            usageTags.forEach((tag) => allTags.push({ tag, type: "usage" }));
            regularTags.forEach((tag: string) =>
              allTags.push({ tag, type: "regular" }),
            );

            // V4.2.24: 单行显示，限制最多 2 个标签，其余用 +N 表示
            const maxVisible = 2;
            const visibleTags = allTags.slice(0, maxVisible);
            const hiddenCount = allTags.length - maxVisible;

            return (
              <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
                {visibleTags.map(({ tag, type }) => {
                  if (type === "ai") {
                    const colorStyle = getAiTagColor(tag);
                    return (
                      <Badge
                        key={`ai-${tag}`}
                        variant="outline"
                        className={cn(
                          "text-[11px] py-0 h-5 flex-shrink-0 max-w-[45%] truncate",
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
                  }
                  if (type === "usage") {
                    const tagStyle = getUsageTagStyleExtended(
                      tag,
                      customUsageTags,
                    );
                    if (!tagStyle) return null;
                    return (
                      <Badge
                        key={`usage-${tag}`}
                        variant="outline"
                        className={cn(
                          "text-[11px] py-0 h-5 flex-shrink-0 max-w-[45%] truncate",
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
                  }
                  // regular tag
                  return (
                    <Badge
                      key={`user-${tag}`}
                      variant="outline"
                      className="text-[11px] py-0 h-5 flex-shrink-0 max-w-[45%] truncate bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                    >
                      {tag}
                    </Badge>
                  );
                })}
                {hiddenCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[11px] py-0 h-5 text-gray-500 flex-shrink-0"
                  >
                    +{hiddenCount}
                  </Badge>
                )}
              </div>
            );
          })()}

          {/* 处理状态 */}
          {bookmark.status === "PROCESSING" && (
            <div className="mb-2 flex items-center gap-1 text-xs text-blue-600">
              <span className="animate-pulse">●</span>
              {t.bookmark.processing}
            </div>
          )}
          {bookmark.status === "FAILED" && (
            <div className="mb-2 text-xs text-red-500">{t.bookmark.failed}</div>
          )}

          {/* V12.0: AI 整理中状态（缓存池等待聚类） */}
          {bookmark.pending_cluster && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mb-2 flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 cursor-help">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  <span>{t.bookmark.aiOrganizing}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <p className="text-xs">{t.bookmark.aiOrganizingTooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* V4.2.24: 元信息 - 移除分隔线，减少间距 */}
          <div className="mt-auto">
            <div className="flex items-center justify-between text-xs text-gray-400/70 dark:text-gray-500/70">
              {/* 左侧：来源/作者 */}
              <span className="truncate max-w-[60%]">
                {bookmark.source_name ||
                  bookmark.author ||
                  t.bookmark.unknownSource}
              </span>
              {/* 右侧：时间 */}
              <span className="flex-shrink-0">
                {formatRelativeTime(
                  bookmark.publish_time || bookmark.created_at || new Date(),
                )}
              </span>
            </div>
          </div>
        </CardContent>

        {/* P1.4: 平台主色底部条 */}
        <div
          className="h-1 w-full rounded-b-lg"
          style={{
            backgroundColor: getPlatformHexColor(
              bookmark.platform ?? "UNKNOWN",
            ),
          }}
        />
      </Card>
    </a>
  );
});
