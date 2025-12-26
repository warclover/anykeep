/**
 * 附件面板内容组件
 *
 * 弹出面板的内容部分，桌面端和移动端共用
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { useCallback, useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AttachmentSearchInput } from "./attachment-search-input";
import { BookmarkSelectList } from "./bookmark-select-list";
import { FileUploadZone } from "./file-upload-zone";
import {
  ATTACHMENT_LIMITS,
  ATTACHMENT_TEXT,
  type AttachmentItem,
} from "./types";
import type { Bookmark } from "@/types/supabase";

// =============================================================================
// 类型定义
// =============================================================================

export interface AttachmentPanelContentProps {
  /** 已选附件列表 */
  selectedItems: AttachmentItem[];
  /** 选择变化回调 */
  onSelectionChange: (items: AttachmentItem[]) => void;
  /** 最大数量 */
  maxCount?: number;
  /** 关闭回调 */
  onClose: () => void;
  /** 书签列表 */
  bookmarks: Bookmark[];
  /** 是否正在加载书签 */
  isLoadingBookmarks?: boolean;
  /** 搜索关键词 */
  searchQuery: string;
  /** 搜索关键词变化回调 */
  onSearchChange: (query: string) => void;
  /** 是否正在搜索 */
  isSearching?: boolean;
  /** 是否为搜索模式（显示搜索结果标题） */
  isSearchMode?: boolean;
  /** 文件处理中 */
  isProcessingFile?: boolean;
  /** 添加文件回调 */
  onFilesAdd: (files: File[]) => void;
  /** 自定义类名 */
  className?: string;
}

// =============================================================================
// 组件实现
// =============================================================================

export function AttachmentPanelContent({
  selectedItems,
  onSelectionChange,
  maxCount = ATTACHMENT_LIMITS.MAX_COUNT,
  onClose,
  bookmarks,
  isLoadingBookmarks = false,
  searchQuery,
  onSearchChange,
  isSearching = false,
  isSearchMode = false,
  isProcessingFile = false,
  onFilesAdd,
  className,
}: AttachmentPanelContentProps) {
  // 分离书签附件和文件附件
  const bookmarkItems = useMemo(
    () => selectedItems.filter((item) => item.type === "bookmark"),
    [selectedItems],
  );
  const fileItems = useMemo(
    () => selectedItems.filter((item) => item.type === "file"),
    [selectedItems],
  );

  // 已选书签 ID 集合
  const selectedBookmarkIds = useMemo(
    () => new Set(bookmarkItems.map((item) => item.id)),
    [bookmarkItems],
  );

  // 计算剩余槽位
  const remainingSlots = maxCount - selectedItems.length;
  const canAddMore = remainingSlots > 0;

  // 处理书签切换
  const handleBookmarkToggle = useCallback(
    (bookmark: Bookmark) => {
      const bookmarkId = String(bookmark.id);
      const isSelected = selectedBookmarkIds.has(bookmarkId);

      if (isSelected) {
        // 取消选中
        onSelectionChange(
          selectedItems.filter((item) => item.id !== bookmarkId),
        );
      } else if (canAddMore) {
        // 添加选中
        const newItem: AttachmentItem = {
          id: bookmarkId,
          type: "bookmark",
          title: bookmark.title,
          url: bookmark.url,
          content: bookmark.ai_summary || bookmark.description || undefined,
          platform: bookmark.platform,
        };
        onSelectionChange([...selectedItems, newItem]);
      }
    },
    [selectedBookmarkIds, selectedItems, canAddMore, onSelectionChange],
  );

  // 处理文件移除
  const handleFileRemove = useCallback(
    (fileId: string) => {
      onSelectionChange(selectedItems.filter((item) => item.id !== fileId));
    },
    [selectedItems, onSelectionChange],
  );

  return (
    <div className={cn("flex flex-col", className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[10px]">
            {ATTACHMENT_TEXT.POPOVER_TITLE}
          </h3>
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full",
              canAddMore
                ? "bg-pink-100 text-pink-600"
                : "bg-orange-100 text-orange-600",
            )}
          >
            {selectedItems.length}/{maxCount}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* 搜索框 - 固定在顶部 */}
      <div className="px-3 py-2 border-b flex-shrink-0">
        <AttachmentSearchInput
          value={searchQuery}
          onChange={onSearchChange}
          isSearching={isSearching}
        />
      </div>

      {/* 书签列表 - 固定高度滚动区域（约10条） */}
      <div className="flex-shrink-0">
        <div className="px-3 pt-2 pb-1">
          <h4 className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
            📚{" "}
            {isSearchMode
              ? ATTACHMENT_TEXT.SEARCH_RESULTS_TITLE
              : ATTACHMENT_TEXT.RECENT_BOOKMARKS_TITLE}
          </h4>
        </div>
        <ScrollArea className="h-[240px]">
          <div className="px-3 pb-2">
            <BookmarkSelectList
              bookmarks={bookmarks}
              selectedIds={selectedBookmarkIds}
              onToggle={handleBookmarkToggle}
              isLoading={isLoadingBookmarks}
              disableUnselected={!canAddMore}
              emptyMessage={
                isSearchMode
                  ? ATTACHMENT_TEXT.EMPTY_NO_RESULTS
                  : ATTACHMENT_TEXT.EMPTY_NO_BOOKMARKS
              }
            />
          </div>
        </ScrollArea>
      </div>

      {/* 文件上传 - 固定在底部 */}
      <div className="px-3 py-2 border-t flex-shrink-0">
        <h4 className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          📎 {ATTACHMENT_TEXT.FILE_UPLOAD_TITLE}
        </h4>
        <FileUploadZone
          files={fileItems}
          onFilesAdd={onFilesAdd}
          onFileRemove={handleFileRemove}
          remainingSlots={remainingSlots}
          disabled={!canAddMore}
          isProcessing={isProcessingFile}
        />
      </div>

      {/* 底部确认按钮 */}
      <div className="px-3 py-2 border-t flex-shrink-0">
        <Button
          onClick={onClose}
          size="sm"
          className={cn(
            "w-full h-7 text-[10px]",
            "bg-gradient-to-r from-pink-400 to-rose-400",
            "hover:from-pink-500 hover:to-rose-500",
          )}
        >
          {ATTACHMENT_TEXT.CONFIRM_BUTTON}
        </Button>
      </div>
    </div>
  );
}

export default AttachmentPanelContent;
