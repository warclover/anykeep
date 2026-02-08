/**
 * 收藏卡片组件
 * V4.2.1: 使用 React.memo 优化，避免列表中其他卡片变化时的不必要重渲染
 */

"use client";

import { useState, memo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  Check,
  Circle,
  CheckCircle2,
  Zap,
  Lock,
  Star,
  Sparkles,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Bookmark, CustomUsageTag, Platform } from "@/types/supabase";
import type { BookmarkV42Fields } from "@/lib/classification/types";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/date-utils";
import { getPlatformHexColor } from "@/lib/constants/platforms";
import { generatePlaceholderImage } from "@/lib/utils/placeholder-image";
import { getProxiedImageUrl } from "@/lib/utils/image-proxy";
import { PlatformBadge } from "@/components/ui/platform-badge";
import { prefetchCustomUsageTags } from "@/hooks/data";
import { BookmarkRatingDisplay } from "@/components/bookmark/bookmark-rating-display";
import { ContentTypeBadge } from "@/components/bookmark/content-type-badge";
import type { ContentType } from "@/lib/classification/content-type-detector";
import {
  separateUserTagsExtended,
  getUsageTagStyleExtended,
  getAiTagColor,
} from "@/lib/constants/usage-tags";
import "./bookmark-card-flip.css"; // 复用卡片优化样式
import { getDisplaySummary } from "@/lib/classification/types/ai-summary";
// V4.2.1: 快照功能（功能开关 + 菜单项组件）
import { SnapshotMenuItem, useSnapshotFeature } from "@/components/snapshot";
// TTS 语音朗读
import { TTSPlayerButton } from "@/components/tts";
// 国际化
import { useUiText } from "@/lib/i18n";

type ViewVariant = "card" | "list" | "compact";

// ──────────────────────────────────────────────────────────
// 提取的子组件 Props 类型
// ──────────────────────────────────────────────────────────

interface ActionMenuProps {
  className?: string;
  variant?: "default" | "mobile";
  bookmark: Bookmark &
    Partial<BookmarkV42Fields> & {
      folders?: { name: string } | null;
    };
  isSnapshotEnabled: boolean;
  isDeleting: boolean;
  onOpenOriginal: (e: React.MouseEvent) => void;
  onToggleRead?: (e: React.MouseEvent) => void;
  onToggleStarred?: (e: React.MouseEvent) => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  t: ReturnType<typeof useUiText>;
}

interface SelectionCheckboxProps {
  className?: string;
  isSelected: boolean;
}

// ──────────────────────────────────────────────────────────
// 提取的外部 memo 子组件（避免父组件渲染时重建引用）
// ──────────────────────────────────────────────────────────

/** 操作菜单组件 - 提取为外部 memo 组件避免不必要的重挂载 */
const ActionMenu = memo(function ActionMenu({
  className = "",
  variant: menuVariant = "default",
  bookmark,
  isSnapshotEnabled,
  isDeleting,
  onOpenOriginal,
  onToggleRead,
  onToggleStarred,
  onEdit,
  onDelete,
  t,
}: ActionMenuProps) {
  return (
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
        <DropdownMenuItem onClick={onOpenOriginal}>
          <ExternalLink className="mr-2 h-4 w-4" />
          {t.bookmark.openOriginal}
        </DropdownMenuItem>
        {/* TTS 语音朗读 */}
        {bookmark.ai_summary && (
          <TTSPlayerButton
            bookmarkId={bookmark.id}
            variant="menu-item"
            disabled={!bookmark.ai_summary}
          />
        )}
        {/* V4.2.1: 快照功能入口 */}
        {isSnapshotEnabled && (
          <SnapshotMenuItem
            bookmarkId={bookmark.id}
            bookmarkUrl={bookmark.url}
            hasSnapshot={(bookmark as { has_snapshot?: boolean }).has_snapshot}
            snapshotStatus={
              (bookmark as { snapshot_status?: string }).snapshot_status as
                | "pending"
                | "processing"
                | "completed"
                | "failed"
                | null
            }
          />
        )}
        {onToggleRead && (
          <DropdownMenuItem onClick={onToggleRead}>
            {bookmark.is_read ? (
              <>
                <Circle className="mr-2 h-4 w-4" />
                {t.bookmark.markAsUnread}
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t.bookmark.markAsRead}
              </>
            )}
          </DropdownMenuItem>
        )}
        {onToggleStarred && (
          <DropdownMenuItem onClick={onToggleStarred}>
            {bookmark.is_starred ? (
              <>
                <Star className="mr-2 h-4 w-4 fill-yellow-400 text-yellow-400" />
                {t.bookmark.removeStar}
              </>
            ) : (
              <>
                <Star className="mr-2 h-4 w-4" />
                {t.bookmark.addStar}
              </>
            )}
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            {t.common.edit}
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-600 dark:text-red-400"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? t.bookmark.deleting : t.common.delete}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

/** 选择复选框组件 - 提取为外部 memo 组件避免不必要的重挂载 */
const SelectionCheckbox = memo(function SelectionCheckbox({
  className = "",
  isSelected,
}: SelectionCheckboxProps) {
  return (
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
});

/**
 * BookmarkCard 组件属性
 *
 * @example
 * ```tsx
 * // 基本用法
 * <BookmarkCard
 *   bookmark={bookmark}
 *   onEdit={(id) => openEditDialog(id)}
 *   onDelete={(id) => confirmDelete(id)}
 * />
 *
 * // 批量选择模式
 * <BookmarkCard
 *   bookmark={bookmark}
 *   isSelectionMode={true}
 *   isSelected={selectedIds.has(bookmark.id)}
 *   onToggleSelect={(id) => toggleSelect(id)}
 * />
 *
 * // 紧凑列表视图
 * <BookmarkCard
 *   bookmark={bookmark}
 *   variant="compact"
 * />
 * ```
 */
interface BookmarkCardProps {
  /** 书签数据（包含可选的 V4.2 扩展字段和文件夹信息） */
  bookmark: Bookmark &
    Partial<BookmarkV42Fields> & {
      folders?: { name: string } | null;
    };
  /** 编辑回调，传入书签 ID */
  onEdit?: (id: number) => void;
  /** 删除回调，传入书签 ID */
  onDelete?: (id: number) => void;
  /** 切换已读状态回调 */
  onToggleRead?: (id: number, isRead: boolean) => void;
  /** 切换星标状态回调 (V8.0) */
  onToggleStarred?: (id: number, isStarred: boolean) => void;
  /** 是否处于批量选择模式 */
  isSelectionMode?: boolean;
  /** 当前卡片是否被选中 */
  isSelected?: boolean;
  /** 切换选中状态回调 */
  onToggleSelect?: (id: number) => void;
  /** 视图变体：card（卡片）| list（列表）| compact（紧凑） */
  variant?: ViewVariant;
  /** 用户自定义用途标签，用于标签样式渲染 (V9.0) */
  customUsageTags?: CustomUsageTag[];
}

// 判断是否是正在获取中的占位符标题
const isLoadingTitle = (title: string, loadingText: string) =>
  title === loadingText;

/**
 * V4.2.1: 自定义比较函数，避免不必要的重渲染
 * 只比较会影响渲染的关键属性
 */
function arePropsEqual(
  prevProps: BookmarkCardProps,
  nextProps: BookmarkCardProps,
): boolean {
  // 比较书签核心数据
  const prevBookmark = prevProps.bookmark;
  const nextBookmark = nextProps.bookmark;

  if (
    prevBookmark.id !== nextBookmark.id ||
    prevBookmark.title !== nextBookmark.title ||
    prevBookmark.cover_url !== nextBookmark.cover_url ||
    prevBookmark.platform !== nextBookmark.platform ||
    prevBookmark.is_read !== nextBookmark.is_read ||
    prevBookmark.is_starred !== nextBookmark.is_starred ||
    prevBookmark.is_locked !== nextBookmark.is_locked ||
    prevBookmark.rating !== nextBookmark.rating ||
    prevBookmark.status !== nextBookmark.status ||
    prevBookmark.pending_cluster !== nextBookmark.pending_cluster ||
    prevBookmark.ai_summary !== nextBookmark.ai_summary ||
    prevBookmark.ai_content_type !== nextBookmark.ai_content_type
  ) {
    return false;
  }

  // 比较数组类型（简单长度比较，避免深度比较开销）
  if (
    prevBookmark.ai_tags?.length !== nextBookmark.ai_tags?.length ||
    prevBookmark.user_tags?.length !== nextBookmark.user_tags?.length
  ) {
    return false;
  }

  // 比较其他 props
  if (
    prevProps.isSelectionMode !== nextProps.isSelectionMode ||
    prevProps.isSelected !== nextProps.isSelected ||
    prevProps.variant !== nextProps.variant
  ) {
    return false;
  }

  // 回调函数引用比较（如果父组件使用 useCallback 则稳定）
  // 这里不比较回调函数，因为它们通常是稳定的

  return true;
}

export const BookmarkCard = memo(function BookmarkCard({
  bookmark,
  onEdit,
  onDelete,
  onToggleRead,
  onToggleStarred,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  variant = "card",
  customUsageTags = [],
}: BookmarkCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // 国际化
  const t = useUiText();
  const [isDeleting, setIsDeleting] = useState(false);
  // V4.2.27: 图片加载失败状态（用于 CDN 防盗链等场景的兜底处理）
  const [imageLoadError, setImageLoadError] = useState(false);
  // V4.2.24: 预加载防抖 timer ref
  const prefetchTimerRef = useRef<NodeJS.Timeout | null>(null);
  // V4.2.1: 快照功能状态
  const isSnapshotEnabled = useSnapshotFeature();

  // 判断标题是否正在加载
  const titleLoading = isLoadingTitle(
    bookmark.title ?? "",
    t.bookmark.loadingTitle,
  );

  // 生成占位图（用于无封面或加载失败时）
  const placeholderImage = generatePlaceholderImage(
    bookmark.title ?? "",
    bookmark.platform as Platform,
  );

  // 生成封面图（真实封面或占位符，微信图片使用代理）
  // V4.2.27: 图片加载失败时回退到占位图
  const coverImage = imageLoadError
    ? placeholderImage
    : getProxiedImageUrl(bookmark.cover_url) || placeholderImage;

  // V4.2.27: 图片加载失败处理（如 CDN 防盗链 403）
  const handleImageError = useCallback(() => {
    setImageLoadError(true);
  }, []);

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

  const handleToggleStarred = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleStarred?.(bookmark.id, !bookmark.is_starred);
  };

  // ActionMenu 共用 props（传递给外部 memo 组件）
  const actionMenuProps = {
    bookmark,
    isSnapshotEnabled,
    isDeleting,
    onOpenOriginal: handleOpenOriginal,
    onToggleRead: onToggleRead ? handleToggleRead : undefined,
    onToggleStarred: onToggleStarred ? handleToggleStarred : undefined,
    onEdit: onEdit ? handleEdit : undefined,
    onDelete: onDelete ? handleDelete : undefined,
    t,
  } satisfies Omit<ActionMenuProps, "className" | "variant">;

  // V4.2.24: 增强预加载 - 预加载路由 JS + 数据（带防抖）
  // 鼠标悬停 150ms 后触发，避免快速划过时的请求风暴
  const handlePrefetch = useCallback(() => {
    // 清除之前的定时器
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
    }
    // 防抖 150ms
    prefetchTimerRef.current = setTimeout(() => {
      // 1. 预加载详情页 JS 和路由
      router.prefetch(bookmarkHref);
      // 2. 预加载自定义标签数据（TanStack Query 会自动去重）
      prefetchCustomUsageTags(queryClient);
    }, 150);
  }, [router, queryClient, bookmarkHref]);

  // 鼠标离开时取消预加载
  const handlePrefetchCancel = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }, []);

  // 书签详情页 URL
  const bookmarkHref = `/bookmark/${bookmark.id}`;

  // 通用的卡片/列表点击处理（语义化 <a> 标签 + 程序化导航）
  const handleItemClick = (e: React.MouseEvent) => {
    // 如果点击的是按钮或内嵌链接，不处理（让按钮/链接自己处理）
    const target = e.target as HTMLElement;
    const closestInteractive = target.closest(
      "button, [data-radix-collection-item]",
    );
    // 排除外层 <a> 自身，只拦截内嵌的交互元素
    const closestAnchor = target.closest("a");
    if (
      target.tagName === "BUTTON" ||
      closestInteractive ||
      (closestAnchor && closestAnchor !== e.currentTarget)
    ) {
      return;
    }

    // 阻止 <a> 的默认导航行为
    e.preventDefault();

    if (isSelectionMode) {
      handleToggleSelect(e);
      return;
    }

    // 使用 Next.js router 进行客户端导航
    // NavigationContext 已支持非主页面（activePage = null），不会被拦截
    router.push(bookmarkHref);
  };

  // 紧凑列表视图（compact）
  if (variant === "compact") {
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
        {isSelectionMode && <SelectionCheckbox isSelected={isSelected} />}

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
            {/* compact 视图：简洁显示来源/作者 */}
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
            <ActionMenu {...actionMenuProps} />
          </div>
        )}
      </a>
    );
  }

  // 列表视图（list）- 移动端垂直布局，桌面端水平布局
  if (variant === "list") {
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
            "flex flex-col sm:flex-row hover:shadow-md transition-shadow cursor-pointer group overflow-hidden",
            isDeleting && "opacity-50 pointer-events-none",
            isSelected && "ring-2 ring-blue-500 dark:ring-blue-400",
          )}
        >
          {/* 移动端：顶部区域（封面 + 选择框 + 操作按钮） */}
          <div className="relative sm:hidden">
            {/* 封面图 - 移动端全宽，2.35:1 宽幅比例 */}
            <div className="aspect-[2.35/1]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImage}
                alt={bookmark.title ?? ""}
                width={400}
                height={170}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                onError={handleImageError}
              />
            </div>
            {/* 平台标识 */}
            <div className="absolute bottom-2 left-2">
              <PlatformBadge
                platform={bookmark.platform ?? "UNKNOWN"}
                size="sm"
              />
            </div>
            {/* 选择复选框 - 移动端右上角 */}
            {isSelectionMode && (
              <div className="absolute top-2 right-2">
                <SelectionCheckbox isSelected={isSelected} />
              </div>
            )}
            {/* 操作按钮 - 移动端右上角 */}
            {!isSelectionMode && (
              <div className="absolute top-2 right-2">
                <ActionMenu {...actionMenuProps} variant="mobile" />
              </div>
            )}
          </div>

          {/* 桌面端：选择复选框 */}
          {isSelectionMode && (
            <div className="hidden sm:flex items-center px-3">
              <SelectionCheckbox isSelected={isSelected} />
            </div>
          )}

          {/* 桌面端：缩略图，2.35:1 宽幅比例 */}
          <div className="relative hidden sm:block w-32 md:w-48 flex-shrink-0">
            <div className="aspect-[2.35/1]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImage}
                alt={bookmark.title ?? ""}
                width={192}
                height={82}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                onError={handleImageError}
              />
            </div>
            <div className="absolute bottom-2 left-2">
              <PlatformBadge
                platform={bookmark.platform ?? "UNKNOWN"}
                size="sm"
                showName
              />
            </div>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 p-3 sm:p-3 md:p-4 flex flex-col justify-between min-w-0">
            <div>
              <h3
                className={cn(
                  "font-semibold line-clamp-2 sm:line-clamp-1 mb-1 text-sm sm:text-base",
                  titleLoading
                    ? "text-gray-400 dark:text-gray-500 italic animate-pulse"
                    : "text-gray-900 dark:text-white",
                )}
              >
                {bookmark.title ?? ""}
              </h3>
              {(() => {
                const displaySummary = getDisplaySummary(bookmark.ai_summary);
                return displaySummary ? (
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {displaySummary}
                  </p>
                ) : null;
              })()}
            </div>

            <div className="flex items-center justify-between gap-2 mt-2">
              {/* 左侧：标签和评级 */}
              <div className="flex items-center gap-2 flex-wrap min-w-0">
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
                        <span>{t.bookmark.aiOrganizing}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      <p className="text-xs">
                        {t.bookmark.aiOrganizingTooltip}
                      </p>
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
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                {/* list 视图：简洁显示来源/作者 */}
                <span className="truncate max-w-[80px] sm:max-w-none">
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

          {/* 桌面端：操作按钮 - 弱显示+悬停强调 */}
          {!isSelectionMode && (
            <div className="hidden sm:flex items-center px-3 opacity-60 group-hover:opacity-100 transition-opacity">
              <ActionMenu {...actionMenuProps} />
            </div>
          )}
        </Card>
      </a>
    );
  }

  // 卡片视图（card，默认 - 瀑布流样式）
  // 使用语义化 <a> 标签，确保可访问性和 SEO
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImage}
            alt={bookmark.title ?? ""}
            width={400}
            height={170}
            className="w-full h-full object-cover card-cover-top card-cover-zoom"
            loading="lazy"
            decoding="async"
            onError={handleImageError}
          />
          {/* 平台标识 - P0.5: 放大 + 固定左上角 */}
          <div className="absolute top-3 left-3">
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
              <SelectionCheckbox isSelected={isSelected} />
            </div>
          )}

          {/* 正常模式：操作按钮 - 移动端始终显示，桌面端悬停显示 */}
          {!isSelectionMode && !bookmark.is_locked && (
            <div className="absolute top-2 right-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <ActionMenu {...actionMenuProps} variant="mobile" />
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
                "text-base leading-tight line-clamp-2 min-h-[2.5rem]",
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
          <CardDescription className="text-sm leading-tight mt-0.5 line-clamp-2 min-h-[2.25rem] text-muted-foreground">
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
}, arePropsEqual);
