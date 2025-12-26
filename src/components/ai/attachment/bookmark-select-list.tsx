/**
 * 书签选择列表组件
 *
 * 用于在附件面板中显示可选择的书签列表
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { memo, useCallback } from "react";
import { FileText, Globe, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ATTACHMENT_TEXT } from "./types";
import type { Bookmark } from "@/types/supabase";

// =============================================================================
// 类型定义
// =============================================================================

export interface BookmarkSelectListProps {
  /** 书签列表 */
  bookmarks: Bookmark[];
  /** 已选中的书签 ID 集合 */
  selectedIds: Set<string>;
  /** 切换选中状态 */
  onToggle: (bookmark: Bookmark) => void;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 是否禁用（已达上限时禁用未选中项） */
  disableUnselected?: boolean;
  /** 空状态消息 */
  emptyMessage?: string;
  /** 自定义类名 */
  className?: string;
}

// =============================================================================
// 平台图标映射
// =============================================================================

/** 获取平台图标 */
function getPlatformIcon(platform: string) {
  // 浏览器书签平台
  if (
    ["chrome", "edge", "firefox", "safari", "browser_bookmark"].includes(
      platform,
    )
  ) {
    return <Globe className="size-4 text-blue-500" />;
  }

  // 其他平台都使用文档图标
  return <FileText className="size-4 text-gray-500" />;
}

// =============================================================================
// 单个书签项组件
// =============================================================================

interface BookmarkItemProps {
  bookmark: Bookmark;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}

const BookmarkItem = memo(function BookmarkItem({
  bookmark,
  isSelected,
  isDisabled,
  onToggle,
}: BookmarkItemProps) {
  // 截断标题
  const truncatedTitle =
    bookmark.title.length > 30
      ? `${bookmark.title.slice(0, 30)}...`
      : bookmark.title;

  return (
    <label
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
        "hover:bg-pink-50/50",
        isSelected && "bg-pink-50",
        isDisabled && !isSelected && "opacity-50 cursor-not-allowed",
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        disabled={isDisabled && !isSelected}
        className="data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
      />
      <span className="flex-shrink-0">
        {getPlatformIcon(bookmark.platform)}
      </span>
      <span
        className={cn(
          "flex-1 text-sm truncate",
          isSelected ? "text-foreground font-medium" : "text-muted-foreground",
        )}
        title={bookmark.title}
      >
        {truncatedTitle}
      </span>
    </label>
  );
});

// =============================================================================
// 主组件
// =============================================================================

export function BookmarkSelectList({
  bookmarks,
  selectedIds,
  onToggle,
  isLoading = false,
  disableUnselected = false,
  emptyMessage = ATTACHMENT_TEXT.EMPTY_NO_BOOKMARKS,
  className,
}: BookmarkSelectListProps) {
  // 处理切换
  const handleToggle = useCallback(
    (bookmark: Bookmark) => {
      onToggle(bookmark);
    },
    [onToggle],
  );

  // 加载状态
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center py-8 text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-5 animate-spin mr-2" />
        <span className="text-sm">加载中...</span>
      </div>
    );
  }

  // 空状态
  if (bookmarks.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center py-8 text-muted-foreground text-sm",
          className,
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {bookmarks.map((bookmark) => {
        const bookmarkId = String(bookmark.id);
        const isSelected = selectedIds.has(bookmarkId);
        const isDisabled = disableUnselected && !isSelected;

        return (
          <BookmarkItem
            key={bookmark.id}
            bookmark={bookmark}
            isSelected={isSelected}
            isDisabled={isDisabled}
            onToggle={() => handleToggle(bookmark)}
          />
        );
      })}
    </div>
  );
}

export default BookmarkSelectList;
