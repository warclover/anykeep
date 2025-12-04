/**
 * 收藏卡片组件
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  Check,
  FileText,
  Image as ImageIcon,
  Tag,
  Circle,
  CheckCircle2,
  Clock,
  Zap,
  Lock,
  Star,
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
import {
  calculateReadingTime,
  getContentTypeLabel,
} from "@/lib/utils/reading-time";
import { getPlatformHexColor } from "@/lib/constants/platforms";
import { generatePlaceholderImage } from "@/lib/utils/placeholder-image";
import { getProxiedImageUrl } from "@/lib/utils/image-proxy";
import { PlatformBadge } from "@/components/ui/platform-badge";
import { BookmarkRatingDisplay } from "@/components/bookmark/bookmark-rating-display";
import {
  separateUserTags,
  getUsageTagStyle,
  getAiTagColor,
} from "@/lib/constants/usage-tags";
import "./bookmark-card-flip.css"; // 复用卡片优化样式

type ViewVariant = "card" | "list" | "compact";

interface BookmarkCardProps {
  bookmark: Bookmark & {
    folders?: { name: string } | null;
  };
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onToggleRead?: (id: number, isRead: boolean) => void;
  onToggleStarred?: (id: number, isStarred: boolean) => void; // V8.0新增：星标切换
  // 批量选择模式
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  // 视图模式
  variant?: ViewVariant;
}

// 判断是否是正在获取中的占位符标题
const isLoadingTitle = (title: string) => title === "正在获取标题...";

export function BookmarkCard({
  bookmark,
  onEdit,
  onDelete,
  onToggleRead,
  onToggleStarred,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  variant = "card",
}: BookmarkCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  // 判断标题是否正在加载
  const titleLoading = isLoadingTitle(bookmark.title);

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

  const handleToggleStarred = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleStarred?.(bookmark.id, !bookmark.is_starred);
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
        {onToggleStarred && (
          <DropdownMenuItem onClick={handleToggleStarred}>
            {bookmark.is_starred ? (
              <>
                <Star className="mr-2 h-4 w-4 fill-yellow-400 text-yellow-400" />
                取消星标
              </>
            ) : (
              <>
                <Star className="mr-2 h-4 w-4" />
                添加星标
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

  // 通用的卡片/列表点击处理（使用程序化导航确保可靠性）
  const handleItemClick = (e: React.MouseEvent) => {
    // 如果点击的是按钮或链接，不处理（让按钮/链接自己处理）
    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "A" ||
      target.closest("button") ||
      target.closest("a") ||
      target.closest("[data-radix-collection-item]") // Dropdown menu items
    ) {
      return;
    }

    if (isSelectionMode) {
      handleToggleSelect(e);
      return;
    }

    // 使用 Next.js router 进行客户端导航
    // NavigationContext 已支持非主页面（activePage = null），不会被拦截
    router.push(`/bookmark/${bookmark.id}`);
  };

  // 紧凑列表视图（compact）
  if (variant === "compact") {
    return (
      <div
        onClick={handleItemClick}
        className={cn(
          "flex items-center gap-2 sm:gap-4 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow cursor-pointer group",
          isDeleting && "opacity-50 pointer-events-none",
          isSelected && "ring-2 ring-blue-500 dark:ring-blue-400",
        )}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleItemClick(e as unknown as React.MouseEvent);
          }
        }}
      >
        {/* 选择复选框 */}
        {isSelectionMode && <SelectionCheckbox />}

        {/* 平台标识 */}
        <PlatformBadge platform={bookmark.platform} size="sm" />

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
              {bookmark.title}
            </h3>
            {/* V6.0新增：评级显示（Compact视图） */}
            <BookmarkRatingDisplay
              rating={bookmark.rating}
              isLocked={bookmark.is_locked}
              variant="compact"
              className="flex-shrink-0"
            />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {/* compact 视图：简洁显示来源/作者 */}
            <span className="truncate max-w-[80px] sm:max-w-none">
              {bookmark.source_name || bookmark.author || "未知作者"}
            </span>
            <span>·</span>
            <span className="flex-shrink-0">
              {formatRelativeTime(bookmark.publish_time || bookmark.created_at)}
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
    );
  }

  // 列表视图（list）- 移动端垂直布局，桌面端水平布局
  if (variant === "list") {
    return (
      <div
        onClick={handleItemClick}
        className="block cursor-pointer"
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleItemClick(e as unknown as React.MouseEvent);
          }
        }}
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
              <h3
                className={cn(
                  "font-semibold line-clamp-2 sm:line-clamp-1 mb-1 text-sm sm:text-base",
                  titleLoading
                    ? "text-gray-400 dark:text-gray-500 italic animate-pulse"
                    : "text-gray-900 dark:text-white",
                )}
              >
                {bookmark.title}
              </h3>
              {bookmark.ai_summary && (
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {bookmark.ai_summary}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 mt-2">
              {/* 左侧：标签和评级 */}
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {/* V6.0新增：评级显示（List视图） */}
                <BookmarkRatingDisplay
                  rating={bookmark.rating}
                  isLocked={bookmark.is_locked}
                  variant="compact"
                  className="flex-shrink-0"
                />
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
                        AI
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
                    const { usageTags } = separateUserTags(bookmark.user_tags);
                    if (usageTags.length === 0) return null;
                    const style = getUsageTagStyle(usageTags[0]);
                    if (!style) return null;
                    return (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs hidden sm:inline-flex",
                          style.bgLight,
                          style.bgDark,
                          style.borderLight,
                          style.borderDark,
                          style.textLight,
                          style.textDark,
                        )}
                      >
                        {usageTags[0]}
                      </Badge>
                    );
                  })()}
                </div>
              </div>

              {/* 右侧：元信息 */}
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                {/* list 视图：简洁显示来源/作者 */}
                <span className="truncate max-w-[80px] sm:max-w-none">
                  {bookmark.source_name || bookmark.author || "未知"}
                </span>
                <span>·</span>
                <span>
                  {formatRelativeTime(
                    bookmark.publish_time || bookmark.created_at,
                  )}
                </span>
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
      </div>
    );
  }

  // 卡片视图（card，默认 - 瀑布流样式）
  // 完全使用 div + onClick 替代 Link，确保点击事件可靠触发
  return (
    <div
      onClick={handleItemClick}
      className="block h-full cursor-pointer"
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleItemClick(e as unknown as React.MouseEvent);
        }
      }}
    >
      <Card
        className={cn(
          "h-full card-hover-effect cursor-pointer flex flex-col group relative pt-0",
          isDeleting && "opacity-50 pointer-events-none",
          isSelected && "ring-2 ring-blue-500 dark:ring-blue-400",
        )}
      >
        {/* 封面图 - P0.1: 16:9 + 顶部贴边对齐 */}
        <div className="relative aspect-video overflow-hidden rounded-t-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImage}
            alt={bookmark.title}
            className="w-full h-full object-cover card-cover-top card-cover-zoom"
          />
          {/* 平台标识 - P0.5: 放大 + 固定左上角 */}
          <div className="absolute top-3 left-3">
            <PlatformBadge platform={bookmark.platform} size="lg" showName />
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
              <SelectionCheckbox />
            </div>
          )}

          {/* 正常模式：操作按钮 - 移动端始终显示，桌面端悬停显示 */}
          {!isSelectionMode && !bookmark.is_locked && (
            <div className="absolute top-2 right-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <ActionMenu variant="mobile" />
            </div>
          )}
        </div>

        {/* P0.4: 增加图文间距 */}
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-start gap-2">
            {/* 未读指示器 */}
            {!bookmark.is_read && (
              <Circle className="size-2 mt-2 flex-shrink-0 fill-blue-500 text-blue-500" />
            )}
            {/* P0.2: 标题放大 + 渐隐截断 */}
            <CardTitle
              className={cn(
                "card-title-fade text-lg min-h-[3.25rem] leading-snug",
                titleLoading
                  ? "text-gray-400 dark:text-gray-500 italic animate-pulse"
                  : bookmark.is_read
                    ? "text-gray-500 dark:text-gray-400"
                    : "",
              )}
            >
              {bookmark.title}
            </CardTitle>
          </div>
          {/* P0.3: 摘要渐隐效果 */}
          {bookmark.ai_summary && (
            <CardDescription className="card-summary-fade">
              {bookmark.ai_summary}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="pt-0 flex-1 flex flex-col">
          {/* P1.3: 关键信息图标化 - 阅读时长 & 内容类型 */}
          <div className="flex items-center gap-2 mb-2">
            {/* 阅读时长 */}
            {calculateReadingTime(
              bookmark.word_count,
              (bookmark.image_count ?? 0) > 0,
              bookmark.image_count ?? 0,
            ) && (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="size-3" />
                {calculateReadingTime(
                  bookmark.word_count,
                  (bookmark.image_count ?? 0) > 0,
                  bookmark.image_count ?? 0,
                )}
              </span>
            )}
            {/* 内容类型 */}
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              {getContentTypeLabel(
                bookmark.word_count,
                bookmark.image_count,
                bookmark.platform,
              )}
            </span>
            {/* 字数 & 图片数 */}
            {bookmark.word_count != null && bookmark.word_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <FileText className="size-3" />
                {bookmark.word_count >= 10000
                  ? `${(bookmark.word_count / 10000).toFixed(1)}万`
                  : bookmark.word_count}
              </span>
            )}
            {bookmark.image_count != null && bookmark.image_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <ImageIcon className="size-3" aria-hidden="true" />
                {bookmark.image_count}
              </span>
            )}
          </div>

          {/* V6.0新增：评级显示 */}
          <BookmarkRatingDisplay
            rating={bookmark.rating}
            isLocked={bookmark.is_locked}
            variant="default"
            className="mb-2"
          />

          {/* P3: 标签区域优化 - 分区独立显示 */}
          {(() => {
            const { usageTags, regularTags } = separateUserTags(
              bookmark.user_tags,
            );
            const hasAiTags = bookmark.ai_tags && bookmark.ai_tags.length > 0;
            const hasUsageTags = usageTags.length > 0;
            const hasRegularTags = regularTags.length > 0;
            const hasTags = hasAiTags || hasUsageTags || hasRegularTags;

            if (!hasTags) return null;

            return (
              <div className="space-y-2 mb-2">
                {/* P3.1: AI标签区 - 独立显示 + 闪电图标 */}
                {hasAiTags && (
                  <div className="p-2 rounded-lg bg-gradient-to-r from-purple-50/80 to-pink-50/80 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-100 dark:border-purple-800/50">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Zap className="size-3 text-purple-500 dark:text-purple-400" />
                      <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                        AI 提取
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {/* P3.3: AI标签彩色Pill样式 */}
                      {bookmark.ai_tags!.slice(0, 3).map((tag) => {
                        const colorStyle = getAiTagColor(tag);
                        return (
                          <Badge
                            key={`ai-${tag}`}
                            variant="outline"
                            className={cn(
                              "text-xs font-normal",
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
                      {bookmark.ai_tags!.length > 3 && (
                        <Badge
                          variant="outline"
                          className="text-xs text-gray-500"
                        >
                          +{bookmark.ai_tags!.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* P3.2: 用途标签 - 预设彩色样式 */}
                {hasUsageTags && (
                  <div className="flex flex-wrap gap-1">
                    {usageTags.map((tag) => {
                      const style = getUsageTagStyle(tag);
                      if (!style) return null;
                      return (
                        <Badge
                          key={`usage-${tag}`}
                          variant="outline"
                          className={cn(
                            "text-xs font-medium",
                            style.bgLight,
                            style.bgDark,
                            style.borderLight,
                            style.borderDark,
                            style.textLight,
                            style.textDark,
                          )}
                        >
                          {tag}
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* 普通用户标签 */}
                {hasRegularTags && (
                  <div className="flex flex-wrap gap-1">
                    {regularTags.slice(0, 2).map((tag) => (
                      <Badge
                        key={`user-${tag}`}
                        variant="outline"
                        className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-xs"
                      >
                        <Tag className="size-2.5 mr-0.5" />
                        {tag}
                      </Badge>
                    ))}
                    {regularTags.length > 2 && (
                      <Badge
                        variant="outline"
                        className="text-xs text-gray-500"
                      >
                        +{regularTags.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 处理状态 */}
          {bookmark.status === "PROCESSING" && (
            <div className="mb-2 flex items-center gap-1 text-xs text-blue-600">
              <span className="animate-pulse">●</span>
              AI 正在提炼要点...
            </div>
          )}
          {bookmark.status === "FAILED" && (
            <div className="mb-2 text-xs text-red-500">处理失败</div>
          )}

          {/* P1.2: 次要信息弱化到底部一行 */}
          <div className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-400">
              {/* 左侧：来源/作者 */}
              <span className="truncate max-w-[60%]">
                {bookmark.source_name || bookmark.author || "未知来源"}
              </span>
              {/* 右侧：时间 */}
              <span className="flex-shrink-0">
                {formatRelativeTime(
                  bookmark.publish_time || bookmark.created_at,
                )}
              </span>
            </div>
          </div>
        </CardContent>

        {/* P1.4: 平台主色底部条 */}
        <div
          className="h-1 w-full rounded-b-lg"
          style={{ backgroundColor: getPlatformHexColor(bookmark.platform) }}
        />
      </Card>
    </div>
  );
}
