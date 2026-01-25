/**
 * 浏览器书签虚拟滚动列表组件
 * 基于 react-virtuoso 实现，支持数千条书签流畅渲染
 */

"use client";

import { Virtuoso } from "react-virtuoso";
import { BookmarkListItem } from "./bookmark-list-item";
import type { Bookmark, BookmarkWithSnapshot } from "@/types/supabase";

interface BrowserBookmarkVirtualListProps {
  bookmarks: (Bookmark & {
    folders?: { name: string } | null;
  })[];
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  isSelectionMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  // 自定义高度（可选）
  height?: string;
}

/**
 * 将 Bookmark 转换为 BookmarkWithSnapshot
 * 处理 null vs undefined 的差异
 */
function toBookmarkWithSnapshot(
  bookmark: Bookmark & { folders?: { name: string } | null },
): BookmarkWithSnapshot & { folders?: { name: string } | null } {
  return {
    ...bookmark,
    // 将 null 转换为 false，保持 boolean 类型一致性
    has_snapshot: bookmark.has_snapshot ?? false,
    last_snapshot_at: bookmark.last_snapshot_at,
  };
}

/**
 * 浏览器书签虚拟滚动列表
 *
 * 性能优化：
 * - 仅渲染可见区域 + 少量缓冲
 * - 支持 10,000+ 条书签流畅滚动
 * - 内存占用显著降低
 *
 * @example
 * ```tsx
 * <BrowserBookmarkVirtualList
 *   bookmarks={bookmarks}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 * ```
 */
export function BrowserBookmarkVirtualList({
  bookmarks,
  onEdit,
  onDelete,
  isSelectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  height = "calc(100vh - 280px)", // 默认高度：全屏减去顶部栏和底部按钮
}: BrowserBookmarkVirtualListProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <Virtuoso
        style={{ height }}
        data={bookmarks}
        itemContent={(index, bookmark) => (
          <BookmarkListItem
            key={bookmark.id}
            bookmark={toBookmarkWithSnapshot(bookmark)}
            onEdit={onEdit}
            onDelete={onDelete}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds.has(bookmark.id)}
            onToggleSelect={onToggleSelect}
          />
        )}
        // 性能优化配置
        overscan={200} // 预渲染 200px 范围外的内容
        increaseViewportBy={{ top: 400, bottom: 400 }} // 增加视口缓冲区
        // 空状态占位符
        components={{
          EmptyPlaceholder: () => (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-sm">暂无浏览器书签</p>
            </div>
          ),
        }}
      />
    </div>
  );
}
