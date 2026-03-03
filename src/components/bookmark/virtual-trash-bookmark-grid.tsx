/**
 * Virtual Trash Bookmark Grid
 * 垃圾箱书签虚拟滚动网格组件
 *
 * 基于 react-virtuoso VirtuosoGrid 实现，支持：
 * - 响应式网格布局
 * - 无限滚动自动加载
 * - 批量选择模式
 * - 恢复/永久删除操作
 */

"use client";

import { useCallback, useRef, memo, useMemo, forwardRef } from "react";
import { VirtuosoGrid, type VirtuosoGridHandle } from "react-virtuoso";
import { Loader2 } from "lucide-react";
import { TrashBookmarkCard } from "./trash-bookmark-card";
import type { Bookmark } from "@/types/supabase";
import { cn } from "@/lib/utils";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface VirtualTrashBookmarkGridProps {
  /** 书签数据 */
  bookmarks: BookmarkWithFolder[];
  /** 是否有更多数据 */
  hasMore?: boolean;
  /** 是否正在加载更多 */
  isLoadingMore?: boolean;
  /** 加载更多回调 */
  onLoadMore?: () => void;
  /** 恢复回调 */
  onRestore?: (id: number) => void;
  /** 永久删除回调 */
  onPermanentDelete?: (id: number) => void;
  /** 是否为批量选择模式 */
  isSelectionMode?: boolean;
  /** 已选中的书签 ID */
  selectedIds?: Set<number>;
  /** 切换选中状态回调 */
  onToggleSelect?: (id: number) => void;
  /** 自定义高度（使用 customScrollParent 时忽略） */
  height?: string;
  /** 预取阈值（0-1，默认 0.8 即 80%） */
  prefetchThreshold?: number;
  /** 自定义滚动父元素（用于嵌套滚动容器场景） */
  customScrollParent?: HTMLElement | null;
}

/**
 * 单个垃圾箱书签卡片渲染组件（使用 memo 优化）
 */
const GridTrashBookmarkItem = memo(function GridTrashBookmarkItem({
  bookmark,
  onRestore,
  onPermanentDelete,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}: {
  bookmark: BookmarkWithFolder;
  onRestore?: (id: number) => void;
  onPermanentDelete?: (id: number) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
}) {
  return (
    <TrashBookmarkCard
      bookmark={bookmark}
      onRestore={onRestore}
      onPermanentDelete={onPermanentDelete}
      isSelectionMode={isSelectionMode}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
    />
  );
});

/**
 * 网格列表容器组件（支持 ref 转发）
 */
interface ListContainerProps {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const ListContainer = memo(
  forwardRef<HTMLDivElement, ListContainerProps>(function ListContainer(
    { className, children, style, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          // 基础网格样式
          "grid gap-4 p-4",
          // 响应式列数：移动端1列，sm 2列，md 2列，lg 3列，xl 4列
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          className,
        )}
        style={{
          // 确保网格行有最小高度，防止 react-virtuoso "Zero-sized element" 警告
          gridAutoRows: "minmax(120px, auto)",
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }),
);

/**
 * 单个网格项容器组件
 * 添加 min-height 防止 react-virtuoso "Zero-sized element" 警告
 */
const ItemContainer = memo(function ItemContainer({
  children,
  ...props
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col" style={{ minHeight: 120 }} {...props}>
      {children}
    </div>
  );
});

/**
 * 虚拟滚动垃圾箱书签网格
 *
 * @example
 * ```tsx
 * <VirtualTrashBookmarkGrid
 *   bookmarks={trashBookmarks}
 *   hasMore={hasMore}
 *   onLoadMore={handleLoadMore}
 *   onRestore={handleRestore}
 *   onPermanentDelete={handlePermanentDelete}
 *   customScrollParent={scrollContainer}
 * />
 * ```
 */
export function VirtualTrashBookmarkGrid({
  bookmarks,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onRestore,
  onPermanentDelete,
  isSelectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  height = "calc(100vh - 280px)",
  prefetchThreshold = 0.8,
  customScrollParent,
}: VirtualTrashBookmarkGridProps) {
  const virtuosoRef = useRef<VirtuosoGridHandle>(null);
  const prefetchTriggered = useRef(false);

  // 智能预取：当滚动到指定位置时提前加载
  const handleRangeChanged = useCallback(
    ({ endIndex }: { startIndex: number; endIndex: number }) => {
      if (!hasMore || isLoadingMore || !onLoadMore) return;

      const threshold = Math.floor(bookmarks.length * prefetchThreshold);

      if (endIndex >= threshold && !prefetchTriggered.current) {
        prefetchTriggered.current = true;
        onLoadMore();
        // 加载完成后重置
        setTimeout(() => {
          prefetchTriggered.current = false;
        }, 1000);
      }
    },
    [bookmarks.length, hasMore, isLoadingMore, onLoadMore, prefetchThreshold],
  );

  // 兜底：滚动到底部时加载
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  // 创建支持 ref 转发的 List 组件
  const List = useMemo(
    () =>
      forwardRef<
        HTMLDivElement,
        {
          className?: string;
          children?: React.ReactNode;
          style?: React.CSSProperties;
        }
      >(function List(props, ref) {
        return <ListContainer {...props} ref={ref} />;
      }),
    [],
  );

  // Memoized 组件引用
  const components = useMemo(
    () => ({
      List,
      Item: ItemContainer,
      Footer: () =>
        isLoadingMore ? (
          <div className="flex justify-center py-4 col-span-full">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null,
    }),
    [List, isLoadingMore],
  );

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">垃圾箱是空的</p>
      </div>
    );
  }

  // 当使用 customScrollParent 时，不需要固定高度容器
  // VirtuosoGrid 会使用外部容器的滚动
  if (customScrollParent) {
    return (
      <VirtuosoGrid
        ref={virtuosoRef}
        customScrollParent={customScrollParent}
        data={bookmarks}
        rangeChanged={handleRangeChanged}
        endReached={handleEndReached}
        overscan={200}
        initialTopMostItemIndex={0}
        itemContent={(index, bookmark) => (
          <GridTrashBookmarkItem
            key={bookmark.id}
            bookmark={bookmark}
            onRestore={onRestore}
            onPermanentDelete={onPermanentDelete}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds.has(bookmark.id)}
            onToggleSelect={onToggleSelect}
          />
        )}
        components={components}
      />
    );
  }

  // 默认模式：使用固定高度容器
  return (
    <div
      className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden"
      style={{ height, minHeight: "400px" }}
    >
      <VirtuosoGrid
        ref={virtuosoRef}
        style={{ height: "100%" }}
        data={bookmarks}
        rangeChanged={handleRangeChanged}
        endReached={handleEndReached}
        overscan={200}
        initialTopMostItemIndex={0}
        itemContent={(index, bookmark) => (
          <GridTrashBookmarkItem
            key={bookmark.id}
            bookmark={bookmark}
            onRestore={onRestore}
            onPermanentDelete={onPermanentDelete}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds.has(bookmark.id)}
            onToggleSelect={onToggleSelect}
          />
        )}
        components={components}
      />
    </div>
  );
}
