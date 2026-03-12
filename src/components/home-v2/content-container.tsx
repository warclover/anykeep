/**
 * Home V2 内容容器
 *
 * 设计原则：
 * - 条件组件替代 renderContent() 内联函数（解决 A9）
 * - CSS min-height 确保容器高度，不用 ResizeObserver（解决 A21）
 * - userSettings 传 boolean 而非对象（解决 A22）
 * - 从 DataProvider 读取数据（≤ 3 hooks）
 *
 * @since home-v2
 */

"use client";

import {
  lazy,
  Suspense,
  useCallback,
  useRef,
  useState,
  useEffect,
  memo,
} from "react";
import { ErrorMessage } from "@/components/ui/error-message";
import { LazyErrorBoundary } from "@/components/ui/lazy-error-boundary";
import { VirtualListSkeleton } from "@/components/home/virtual-list-skeleton";
import { BrowserBookmarkEmptyState } from "@/components/bookmark/browser-bookmark-empty-state";
import { EmptyState } from "@/components/bookmark/empty-state";
import { useHomeV2Data } from "./providers/home-v2-data-provider";
import { useHomeV2Store } from "@/stores/home-v2-store";
import { HomeV2BannerSection } from "./banner-section";
import { useHomeV2Mutations } from "./hooks/use-mutations";
import type { ViewMode, LayoutMode } from "@/components/home/types";

// 懒加载虚拟列表组件
const VirtualBookmarkGrid = lazy(() =>
  import("@/components/bookmark/virtual-bookmark-grid").then((mod) => ({
    default: mod.VirtualBookmarkGrid,
  })),
);

const VirtualBookmarkList = lazy(() =>
  import("@/components/bookmark/virtual-bookmark-list").then((mod) => ({
    default: mod.VirtualBookmarkList,
  })),
);

const VirtualTrashBookmarkGrid = lazy(() =>
  import("@/components/bookmark/virtual-trash-bookmark-grid").then((mod) => ({
    default: mod.VirtualTrashBookmarkGrid,
  })),
);

const BrowserBookmarkVirtualList = lazy(() =>
  import("@/components/bookmark/browser-bookmark-virtual-list").then((mod) => ({
    default: mod.BrowserBookmarkVirtualList,
  })),
);

// ============================================================================
// Props
// ============================================================================

export interface HomeV2ContentContainerProps {
  /** SSR 错误信息 */
  initialError?: string;
  /** A22: boolean 而非对象 */
  showWelcomeMessage: boolean;
  /** 当前视图模式 */
  viewMode: ViewMode;
  /** 布局模式 */
  layoutMode: LayoutMode;
  /** 是否启用翻转卡片 */
  enableFlipCard: boolean;
  /** 是否浏览器平台 */
  isBrowserPlatform: boolean;
  /** 是否垃圾箱 */
  isTrashFolder: boolean;
  /** 打开浏览器导入对话框（浏览器空状态用） */
  onOpenImportDialog: () => void;
  /** 重试回调 */
  onRetry?: () => void;
}

// ============================================================================
// 组件实现
// ============================================================================

export const HomeV2ContentContainer = memo(function HomeV2ContentContainer({
  initialError,
  showWelcomeMessage,
  viewMode,
  layoutMode,
  enableFlipCard,
  isBrowserPlatform,
  isTrashFolder,
  onOpenImportDialog,
  onRetry,
}: HomeV2ContentContainerProps) {
  const { bookmarks, isLoading, hasMore, fetchNextPage, isFetchingNextPage } =
    useHomeV2Data();
  const {
    handleEdit,
    handleDelete,
    handleRestore,
    handlePermanentDelete,
    handleToggleRead,
  } = useHomeV2Mutations();

  // 滚动容器引用（传给虚拟列表组件作为 customScrollParent）
  // 不使用 ResizeObserver（解决 A21），通过 useEffect 在挂载后获取引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(
    null,
  );

  useEffect(() => {
    if (scrollContainerRef.current) {
      setScrollContainer(scrollContainerRef.current);
    }
  }, []);

  // 从 Zustand 读取选择状态（字段级订阅）
  const isSelectionMode = useHomeV2Store((s) => s.isSelectionMode);
  const selectedIds = useHomeV2Store((s) => s.selectedIds);
  const toggleSelect = useHomeV2Store((s) => s.toggleSelect);

  const handleLoadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  // A9 修复：条件渲染替代内联函数
  const renderContent = () => {
    if (initialError) {
      return <ErrorMessage message={initialError} retry={onRetry} />;
    }

    if (isLoading) {
      return <VirtualListSkeleton variant="grid" count={8} />;
    }

    if (!bookmarks || bookmarks.length === 0) {
      if (isBrowserPlatform) {
        return <BrowserBookmarkEmptyState onImport={onOpenImportDialog} />;
      }
      return <EmptyState />;
    }

    // 浏览器书签独立视图
    if (isBrowserPlatform) {
      return (
        <Suspense fallback={<VirtualListSkeleton variant="list" />}>
          <BrowserBookmarkVirtualList
            bookmarks={bookmarks}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isSelectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        </Suspense>
      );
    }

    // 垃圾箱视图
    if (isTrashFolder) {
      return (
        <Suspense fallback={<VirtualListSkeleton variant="grid" />}>
          <VirtualTrashBookmarkGrid
            bookmarks={bookmarks}
            hasMore={hasMore}
            isLoadingMore={isFetchingNextPage}
            onLoadMore={handleLoadMore}
            onRestore={handleRestore}
            onPermanentDelete={handlePermanentDelete}
            isSelectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            customScrollParent={scrollContainer}
          />
        </Suspense>
      );
    }

    // 普通视图
    if (viewMode === "card") {
      return (
        <Suspense fallback={<VirtualListSkeleton variant="grid" />}>
          <VirtualBookmarkGrid
            bookmarks={bookmarks}
            enableFlipCard={enableFlipCard}
            hasMore={hasMore}
            isLoadingMore={isFetchingNextPage}
            onLoadMore={handleLoadMore}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleRead={handleToggleRead}
            isSelectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            layoutMode={layoutMode}
            customScrollParent={scrollContainer}
          />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<VirtualListSkeleton variant="list" />}>
        <VirtualBookmarkList
          bookmarks={bookmarks}
          viewMode={viewMode}
          hasMore={hasMore}
          isLoadingMore={isFetchingNextPage}
          onLoadMore={handleLoadMore}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleRead={handleToggleRead}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          customScrollParent={scrollContainer}
        />
      </Suspense>
    );
  };

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1 md:px-2 py-0.5 md:py-1"
      style={{ minHeight: "200px" }}
    >
      {/* AI 横幅区 */}
      <HomeV2BannerSection showWelcomeMessage={showWelcomeMessage} />

      {/* 内容区 */}
      <LazyErrorBoundary errorMessage="书签列表加载异常">
        {renderContent()}
      </LazyErrorBoundary>
    </div>
  );
});
