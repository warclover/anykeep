/**
 * Virtual Bookmark Grid
 * V4.2.2: 卡片网格虚拟滚动组件
 *
 * 基于 react-virtuoso VirtuosoGrid 实现，支持：
 * - 响应式网格布局
 * - 无限滚动自动加载
 * - 智能预取（80%位置触发）
 * - 批��选择模式
 *
 * V4.2.32 性能优化：
 * - 使用 ref 存储回调，减少 renderItem 依赖项（8→3）
 * - 回调引用稳定化，避免 Virtuoso 不必要的重渲染
 */

"use client";

import { useCallback, useRef, memo, useMemo, forwardRef } from "react";
import { VirtuosoGrid, type VirtuosoGridHandle } from "react-virtuoso";
import { Loader2 } from "lucide-react";
import { BookmarkCard } from "./bookmark-card";
import { FlipBookmarkCard } from "./bookmark-card-flip";
import type { Bookmark, CustomUsageTag } from "@/types/supabase";
import type { BookmarkV42Fields } from "@/lib/classification-v2/types/legacy-compat";
import { cn } from "@/lib/utils";

export type BookmarkWithFolder = Bookmark &
  Partial<BookmarkV42Fields> & {
    folders?: { name: string } | null;
  };

interface VirtualBookmarkGridProps {
  /** 书签数据 */
  bookmarks: BookmarkWithFolder[];
  /** 是否启用翻转卡片 */
  enableFlipCard?: boolean;
  /** 是否有更多数据 */
  hasMore?: boolean;
  /** 是否正在加载更多 */
  isLoadingMore?: boolean;
  /** 加载更多回调 */
  onLoadMore?: () => void;
  /** 编辑回调 */
  onEdit?: (id: number) => void;
  /** 删除回调 */
  onDelete?: (id: number) => void;
  /** 切换已读状态回调 */
  onToggleRead?: (id: number, isRead: boolean) => void;
  /** 切换星标回调 */
  onToggleStarred?: (id: number, isStarred: boolean) => void;
  /** 是否为批量选择模式 */
  isSelectionMode?: boolean;
  /** 已选中的书签 ID */
  selectedIds?: Set<number>;
  /** 切换选中状态回调 */
  onToggleSelect?: (id: number) => void;
  /** 自定义用途标签 */
  customUsageTags?: CustomUsageTag[];
  /** 布局模式（auto 映射为 row） */
  layoutMode?: "auto" | "row" | "column";
  /** 自定义高度（已废弃，使用 customScrollParent 时忽略） */
  height?: string;
  /** 预取阈值（0-1，默认 0.8 即 80%） */
  prefetchThreshold?: number;
  /** 自定义滚动父元素（用于嵌套滚动容器场景） */
  customScrollParent?: HTMLElement | null;
}

/**
 * 单个书签卡片渲染组件（使用 memo 优化）
 */
const GridBookmarkItem = memo(function GridBookmarkItem({
  bookmark,
  enableFlipCard,
  onEdit,
  onDelete,
  onToggleRead,
  onToggleStarred,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  customUsageTags,
}: {
  bookmark: BookmarkWithFolder;
  enableFlipCard?: boolean;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onToggleRead?: (id: number, isRead: boolean) => void;
  onToggleStarred?: (id: number, isStarred: boolean) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  customUsageTags?: CustomUsageTag[];
}) {
  if (enableFlipCard) {
    return (
      <FlipBookmarkCard
        bookmark={bookmark}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleRead={onToggleRead}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        enableFlip={true}
      />
    );
  }

  return (
    <BookmarkCard
      bookmark={bookmark}
      onEdit={onEdit}
      onDelete={onDelete}
      onToggleRead={onToggleRead}
      onToggleStarred={onToggleStarred}
      isSelectionMode={isSelectionMode}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
      customUsageTags={customUsageTags}
      variant="card"
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
  layoutMode?: "auto" | "row" | "column";
}

const ListContainer = memo(
  forwardRef<HTMLDivElement, ListContainerProps>(function ListContainer(
    { className, children, style, layoutMode = "row", ...props },
    ref,
  ) {
    // auto 模式映射为 row
    const effectiveLayoutMode = layoutMode === "auto" ? "row" : layoutMode;

    return (
      <div
        ref={ref}
        className={cn(
          // 基础网格样式
          "grid gap-4 p-4",
          // 响应式列数：移动端1列，sm 2列，md 2列，lg 3列，xl 4列
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          // 布局模式（不使用 auto-rows-fr，避免无明确高度的容器中行高为 0）
          effectiveLayoutMode === "column" && "grid-flow-col",
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
 * 虚拟滚动书签网格
 *
 * @example
 * ```tsx
 * <VirtualBookmarkGrid
 *   bookmarks={bookmarks}
 *   enableFlipCard={true}
 *   hasMore={hasMore}
 *   onLoadMore={handleLoadMore}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 * ```
 */
export function VirtualBookmarkGrid({
  bookmarks,
  enableFlipCard = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onEdit,
  onDelete,
  onToggleRead,
  onToggleStarred,
  isSelectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  customUsageTags,
  layoutMode = "row",
  height = "calc(100vh - 280px)",
  prefetchThreshold = 0.8,
  customScrollParent,
}: VirtualBookmarkGridProps) {
  const virtuosoRef = useRef<VirtuosoGridHandle>(null);
  const prefetchTriggered = useRef(false);

  // V4.2.32: 使用 ref 存储 selectedIds，避免 itemContent 回调因 Set 引用变化而重建
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  // V4.2.32: 使用 ref 存储所有回调，减少 renderItem 依赖项
  // 这样回调的引用变化不会导致 renderItem 重建，从而避免 Virtuoso 重渲染
  const callbacksRef = useRef({
    onEdit,
    onDelete,
    onToggleRead,
    onToggleStarred,
    onToggleSelect,
  });
  callbacksRef.current = {
    onEdit,
    onDelete,
    onToggleRead,
    onToggleStarred,
    onToggleSelect,
  };

  // V4.2.32: 稳定的 itemContent 渲染器
  // 依赖项从 8 个减少到 3 个（仅保留配置项，回调通过 ref 访问）
  const renderItem = useCallback(
    (_index: number, bookmark: BookmarkWithFolder) => (
      <GridBookmarkItem
        key={bookmark.id}
        bookmark={bookmark}
        enableFlipCard={enableFlipCard}
        isSelectionMode={isSelectionMode}
        isSelected={selectedIdsRef.current.has(bookmark.id)}
        customUsageTags={customUsageTags}
        // 回调通过 ref 访问，确保引用稳定
        onEdit={(id) => callbacksRef.current.onEdit?.(id)}
        onDelete={(id) => callbacksRef.current.onDelete?.(id)}
        onToggleRead={(id, isRead) =>
          callbacksRef.current.onToggleRead?.(id, isRead)
        }
        onToggleStarred={(id, isStarred) =>
          callbacksRef.current.onToggleStarred?.(id, isStarred)
        }
        onToggleSelect={(id) => callbacksRef.current.onToggleSelect?.(id)}
      />
    ),
    // 仅保留"配置项"依赖，这些是低频变化的
    [enableFlipCard, isSelectionMode, customUsageTags],
  );

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
        return <ListContainer {...props} ref={ref} layoutMode={layoutMode} />;
      }),
    [layoutMode],
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
        <p className="text-sm">暂无书签</p>
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
        itemContent={renderItem}
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
        itemContent={renderItem}
        components={components}
      />
    </div>
  );
}
