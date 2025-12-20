/**
 * 批量操作书签列表组件
 * 使用虚拟滚动优化大量书签渲染性能
 */

"use client";

import { memo, useCallback, useState, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import { Loader2, Package } from "lucide-react";
import { BatchBookmarkItem } from "./batch-bookmark-item";
import { BATCH_TEXT } from "./constants";
import type { Bookmark } from "@/types/supabase";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface BatchBookmarkListProps {
  /** 书签列表 */
  bookmarks: BookmarkWithFolder[];
  /** 选中的 ID 集合 */
  selectedIds: Set<number>;
  /** 是否加载中 */
  isLoading: boolean;
  /** 所有书签 ID（用于 Shift 选择） */
  allIds: number[];
  /** 项目点击回调（支持 Shift 选择） */
  onItemClick: (id: number, allIds: number[], isShiftKey: boolean) => void;
}

/**
 * 批量操作书签列表组件
 */
export const BatchBookmarkList = memo(function BatchBookmarkList({
  bookmarks,
  selectedIds,
  isLoading,
  allIds,
  onItemClick,
}: BatchBookmarkListProps) {
  // 客户端挂载状态（防止 Hydration 错误）
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 必须用于 hydration 同步
    setIsMounted(true);
  }, []);

  /**
   * 处理项目点击
   */
  const handleItemClick = useCallback(
    (id: number, event: React.MouseEvent) => {
      onItemClick(id, allIds, event.shiftKey);
    },
    [onItemClick, allIds],
  );

  // 加载中状态（服务端渲染或客户端加载中）
  if (!isMounted || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    );
  }

  // 空状态
  if (bookmarks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <Package className="h-12 w-12" />
          <p className="text-sm font-medium">{BATCH_TEXT.EMPTY_STATE.TITLE}</p>
          <p className="text-xs">{BATCH_TEXT.EMPTY_STATE.DESCRIPTION}</p>
        </div>
      </div>
    );
  }

  return (
    <Virtuoso
      data={bookmarks}
      overscan={200}
      itemContent={(index, bookmark) => (
        <BatchBookmarkItem
          key={bookmark.id}
          bookmark={bookmark}
          isSelected={selectedIds.has(bookmark.id)}
          onClick={handleItemClick}
        />
      )}
      className="flex-1"
    />
  );
});
