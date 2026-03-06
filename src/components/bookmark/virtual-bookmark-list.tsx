/**
 * Virtual Bookmark List
 * V4.2.1: 通用虚拟滚动书��列表组件
 *
 * 基于 react-virtuoso 实现，支持：
 * - 多种视图模式 (card/list/compact)
 * - 无限滚动自动加载
 * - 智能预取（80%位置触发）
 * - 批量选择模式
 *
 * V4.2.32 性能优化：
 * - 使用 ref 存储回调，减少 renderItem 依赖项（12→5）
 * - 回调引用稳定化，避免 Virtuoso 不必要的重渲染
 */

"use client";

import { useCallback, useRef, memo, useMemo } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { Loader2 } from "lucide-react";
import { BookmarkCard } from "./bookmark-card";
import { FlipBookmarkCard } from "./bookmark-card-flip";
import { DraggableBookmark } from "@/components/folders/draggable-bookmark";
import type { Bookmark, CustomUsageTag } from "@/types/supabase";
import type { BookmarkV42Fields } from "@/lib/classification/types";
import { cn } from "@/lib/utils";

type ViewVariant = "card" | "list" | "compact";

export type BookmarkWithFolder = Bookmark &
  Partial<BookmarkV42Fields> & {
    folders?: { name: string } | null;
  };

interface VirtualBookmarkListProps {
  /** 书签数据 */
  bookmarks: BookmarkWithFolder[];
  /** 视图模式 */
  viewMode: ViewVariant;
  /** 是否启用翻转卡片（仅 card 模式有效） */
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
  /** 移动到文件夹回调 */
  onMove?: (id: number) => void;
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
  /** 布局模式 (card 视图专用) */
  layoutMode?: "row" | "column";
  /** 自定义高度（已废弃，使用 customScrollParent 时忽略） */
  height?: string;
  /** 预取阈值（0-1，默认 0.8 即 80%） */
  prefetchThreshold?: number;
  /** 自定义滚动父元素（用于嵌套滚动容器场景） */
  customScrollParent?: HTMLElement | null;
  /** 是否启用拖拽到文件夹功能 */
  draggable?: boolean;
}

/**
 * 单个书签项渲染组件（使用 memo 优化）
 */
const BookmarkItem = memo(function BookmarkItem({
  bookmark,
  viewMode,
  enableFlipCard,
  onEdit,
  onDelete,
  onMove,
  onToggleRead,
  onToggleStarred,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  customUsageTags,
  layoutMode,
  draggable,
}: {
  bookmark: BookmarkWithFolder;
  viewMode: ViewVariant;
  enableFlipCard?: boolean;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onMove?: (id: number) => void;
  onToggleRead?: (id: number, isRead: boolean) => void;
  onToggleStarred?: (id: number, isStarred: boolean) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  customUsageTags?: CustomUsageTag[];
  layoutMode?: "row" | "column";
  draggable?: boolean;
}) {
  // 渲染书签卡片内容
  const renderContent = () => {
    // Card 视图
    if (viewMode === "card") {
      return (
        <div
          className={cn(
            "masonry-item",
            layoutMode === "row" && "layout-row",
            layoutMode === "column" && "layout-column",
          )}
        >
          {enableFlipCard ? (
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
          ) : (
            <BookmarkCard
              bookmark={bookmark}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              onToggleRead={onToggleRead}
              onToggleStarred={onToggleStarred}
              isSelectionMode={isSelectionMode}
              isSelected={isSelected}
              onToggleSelect={onToggleSelect}
              customUsageTags={customUsageTags}
              variant="card"
            />
          )}
        </div>
      );
    }

    // List 或 Compact 视图
    return (
      <BookmarkCard
        bookmark={bookmark}
        onEdit={onEdit}
        onDelete={onDelete}
        onMove={onMove}
        onToggleRead={onToggleRead}
        onToggleStarred={onToggleStarred}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        customUsageTags={customUsageTags}
        variant={viewMode}
      />
    );
  };

  // 如果启用拖拽，包装 DraggableBookmark
  if (draggable) {
    return (
      <DraggableBookmark
        bookmarkId={bookmark.id}
        bookmarkTitle={bookmark.title || "无标题"}
      >
        {renderContent()}
      </DraggableBookmark>
    );
  }

  return renderContent();
});

/**
 * 虚拟滚动书签列表
 *
 * @example
 * ```tsx
 * <VirtualBookmarkList
 *   bookmarks={bookmarks}
 *   viewMode="card"
 *   hasMore={hasMore}
 *   onLoadMore={handleLoadMore}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 * ```
 */
export function VirtualBookmarkList({
  bookmarks,
  viewMode,
  enableFlipCard = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onEdit,
  onDelete,
  onMove,
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
  draggable = false,
}: VirtualBookmarkListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const prefetchTriggered = useRef(false);

  // V4.2.33: 使用 ref 存储易变的加载状态，避免 rangeChanged/endReached 回调频繁重建
  // 回调引用变化会导致 Virtuoso 内部 urx 流重订阅并重触发事件，形成无限循环
  const loadStateRef = useRef({
    hasMore,
    isLoadingMore,
    onLoadMore,
    bookmarksLength: bookmarks.length,
  });
  loadStateRef.current = {
    hasMore,
    isLoadingMore,
    onLoadMore,
    bookmarksLength: bookmarks.length,
  };

  // 智能预取：当滚动到指定位置时提前加载
  // 依赖项仅保留 prefetchThreshold（配置项，几乎不变），其余通过 ref 访问
  const handleRangeChanged = useCallback(
    ({ endIndex }: { startIndex: number; endIndex: number }) => {
      const {
        hasMore: _hasMore,
        isLoadingMore: _isLoading,
        onLoadMore: _onLoadMore,
        bookmarksLength,
      } = loadStateRef.current;
      if (!_hasMore || _isLoading || !_onLoadMore) return;

      const threshold = Math.floor(bookmarksLength * prefetchThreshold);

      if (endIndex >= threshold && !prefetchTriggered.current) {
        prefetchTriggered.current = true;
        _onLoadMore();
        // 加载完成后重置
        setTimeout(() => {
          prefetchTriggered.current = false;
        }, 1000);
      }
    },
    [prefetchThreshold],
  );

  // 兜底：滚动到底部时加载
  const handleEndReached = useCallback(() => {
    const {
      hasMore: _hasMore,
      isLoadingMore: _isLoading,
      onLoadMore: _onLoadMore,
    } = loadStateRef.current;
    if (_hasMore && !_isLoading && _onLoadMore) {
      _onLoadMore();
    }
  }, []);

  // 根据视图模式决定容器样式（保留以供未来使用）
  const _containerClassName = cn(
    viewMode === "card" && "masonry-grid",
    viewMode === "card" && layoutMode === "row" && "layout-row",
    viewMode === "card" && layoutMode === "column" && "layout-column",
    viewMode === "list" && "space-y-4",
    viewMode === "compact" && "space-y-2",
  );

  // V4.2.32: 使用 ref 存储 selectedIds，避免 renderItem 回调因 Set 引用变化而重建
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  // V4.2.32: 使用 ref 存储所有回调，减少 renderItem 依赖项
  const callbacksRef = useRef({
    onEdit,
    onDelete,
    onMove,
    onToggleRead,
    onToggleStarred,
    onToggleSelect,
  });
  callbacksRef.current = {
    onEdit,
    onDelete,
    onMove,
    onToggleRead,
    onToggleStarred,
    onToggleSelect,
  };

  // V4.2.32: 稳定的 itemContent 渲染器
  // 依赖项从 12 个减少到 5 个（仅保留配置项，回调通过 ref 访问）
  const renderItem = useCallback(
    (_index: number, bookmark: BookmarkWithFolder) => (
      <BookmarkItem
        key={bookmark.id}
        bookmark={bookmark}
        viewMode={viewMode}
        enableFlipCard={enableFlipCard}
        isSelectionMode={isSelectionMode}
        isSelected={selectedIdsRef.current.has(bookmark.id)}
        customUsageTags={customUsageTags}
        layoutMode={layoutMode}
        draggable={draggable}
        // 回调通过 ref 访问，确保引用稳定
        onEdit={(id) => callbacksRef.current.onEdit?.(id)}
        onDelete={(id) => callbacksRef.current.onDelete?.(id)}
        onMove={(id) => callbacksRef.current.onMove?.(id)}
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
    [
      viewMode,
      enableFlipCard,
      isSelectionMode,
      customUsageTags,
      layoutMode,
      draggable,
    ],
  );

  // V4.2.33: 使用 ref 存储 isLoadingMore，使 Footer 组件引用保持稳定
  // 内联函数组件在 useMemo 依赖变化时会被 React 视为不同组件类型，
  // 导致 unmount/remount → Virtuoso 重新测量 → urx 流循环 → 无限更新
  const isLoadingMoreRef = useRef(isLoadingMore);
  isLoadingMoreRef.current = isLoadingMore;

  const components = useMemo(
    () => ({
      Footer: () =>
        isLoadingMoreRef.current ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null,
      EmptyPlaceholder: () => (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-sm">暂无书签</p>
        </div>
      ),
    }),
    [], // 空依赖 - 组件引用始终稳定，通过 ref 读取最新状态
  );

  // 根据视图模式计算估算项高度（优化 Virtuoso 渲染性能）
  // V4.2.33: card 视图也提供默认值（200px），避免 undefined 导致 Virtuoso 初始测量不稳定
  const estimatedItemSize = useMemo(() => {
    switch (viewMode) {
      case "compact":
        return 72; // 64px 内容 + 8px 间距
      case "list":
        return 96; // 80px 内容（水平布局） + 16px 间距
      default:
        return 200; // card 视图默认估算高度
    }
  }, [viewMode]);

  // 当使用 customScrollParent 时，不需要固定高度容器
  // Virtuoso 会使用外部容器的滚动
  if (customScrollParent) {
    return (
      <Virtuoso
        ref={virtuosoRef}
        customScrollParent={customScrollParent}
        data={bookmarks}
        rangeChanged={handleRangeChanged}
        endReached={handleEndReached}
        itemContent={renderItem}
        overscan={200}
        increaseViewportBy={{ top: 200, bottom: 400 }}
        components={components}
        defaultItemHeight={estimatedItemSize}
      />
    );
  }

  // 默认模式：使用固定高度容器
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
      <Virtuoso
        ref={virtuosoRef}
        style={{ height }}
        data={bookmarks}
        rangeChanged={handleRangeChanged}
        endReached={handleEndReached}
        itemContent={renderItem}
        overscan={200}
        increaseViewportBy={{ top: 200, bottom: 400 }}
        components={components}
        defaultItemHeight={estimatedItemSize}
      />
    </div>
  );
}
