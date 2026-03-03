/**
 * Phase 3: 首页内容区组件
 *
 * 职责：
 * - 渲染书签列表/网格
 * - 处理空状态
 * - 处理加载状态
 * - 根据 viewMode 和平台条件渲染不同组件
 *
 * @version 3.0.0
 * @since 2026-02-05
 */

"use client";

import {
  lazy,
  Suspense,
  useRef,
  useLayoutEffect,
  useState,
  memo,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ErrorMessage } from "@/components/ui/error-message";
import { SilentErrorBoundary } from "@/components/ui/lazy-error-boundary";
import { VirtualListSkeleton } from "./virtual-list-skeleton";
import { BrowserBookmarkEmptyState } from "@/components/bookmark/browser-bookmark-empty-state";
import { EmptyState } from "@/components/bookmark/empty-state";
import { useHomePageContext } from "@/contexts/home-page-context";
import { useHomeData } from "./providers/home-data-provider";
import type { ViewMode, LayoutMode } from "./types";
import type { Bookmark } from "@/types/supabase";

// 扩展的书签类型（包含文件夹信息）
type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

// ============================================================================
// 懒加载组件（性能优化）
// ============================================================================

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

// 懒加载 AI 相关组件（首屏非关键）
const ReclassifyBanner = lazy(() =>
  import("@/components/bookmark/reclassify-banner").then((mod) => ({
    default: mod.ReclassifyBanner,
  })),
);

const InboxOrganizationBanner = lazy(() =>
  import("@/components/inbox/inbox-organization-banner").then((mod) => ({
    default: mod.InboxOrganizationBanner,
  })),
);

const PendingConfirmationsSection = lazy(() =>
  import("@/components/classification/pending-confirmations-section").then(
    (mod) => ({
      default: mod.PendingConfirmationsSection,
    }),
  ),
);

// 使用 @/components/ai/briefing 版本（自动获取数据，不需要 briefing prop）
const ProactiveBriefingCard = lazy(() =>
  import("@/components/ai/briefing/proactive-briefing-card").then((mod) => ({
    default: mod.ProactiveBriefingCard,
  })),
);

// ============================================================================
// Props 类型定义
// ============================================================================

export interface HomeContentProps {
  // 视图模式
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  enableFlipCard: boolean;

  // CRUD 操作
  onEdit: (id: number) => void;
  onDelete: (id: number) => void | Promise<void>;
  onRestore: (id: number) => void | Promise<void>;
  onPermanentDelete: (id: number) => void | Promise<void>;
  onToggleRead: (id: number, isRead: boolean) => void | Promise<void>;

  // 选择模式
  isSelectionMode: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;

  // 对话框
  onOpenImportDialog: () => void;

  // 其他
  userSettings?: { notifications?: { showWelcomeMessage?: boolean } };
  deferredAIReady?: boolean;

  // 错误处理
  initialError?: string;
  onRetry?: () => void;
}

// ============================================================================
// 内部组件
// ============================================================================

/**
 * 书签列表/网格渲染组件
 */
const BookmarkListView = memo(function BookmarkListView({
  viewMode,
  layoutMode,
  enableFlipCard,
  bookmarks,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onEdit,
  onDelete,
  onToggleRead,
  isSelectionMode,
  selectedIds,
  onToggleSelect,
  customScrollParent,
}: {
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  enableFlipCard: boolean;
  bookmarks: BookmarkWithFolder[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onToggleRead: (id: number, isRead: boolean) => void;
  isSelectionMode: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  customScrollParent: HTMLElement | null;
}) {
  return (
    <>
      {viewMode === "card" ? (
        <Suspense fallback={<VirtualListSkeleton variant="grid" />}>
          <VirtualBookmarkGrid
            bookmarks={bookmarks}
            enableFlipCard={enableFlipCard}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleRead={onToggleRead}
            isSelectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            layoutMode={layoutMode}
            customScrollParent={customScrollParent}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<VirtualListSkeleton variant="list" />}>
          <VirtualBookmarkList
            bookmarks={bookmarks}
            viewMode={viewMode}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleRead={onToggleRead}
            isSelectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            customScrollParent={customScrollParent}
          />
        </Suspense>
      )}

      {/* 加载更多按钮 */}
      {hasMore && (
        <div className="flex justify-center mt-8">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                加载中...
              </>
            ) : (
              "加载更多"
            )}
          </Button>
        </div>
      )}
    </>
  );
});

/**
 * 垃圾箱视图组件
 */
const TrashView = memo(function TrashView({
  bookmarks,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onRestore,
  onPermanentDelete,
  isSelectionMode,
  selectedIds,
  onToggleSelect,
  customScrollParent,
}: {
  bookmarks: BookmarkWithFolder[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onRestore: (id: number) => void;
  onPermanentDelete: (id: number) => void;
  isSelectionMode: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  customScrollParent: HTMLElement | null;
}) {
  return (
    <Suspense fallback={<VirtualListSkeleton variant="grid" />}>
      <VirtualTrashBookmarkGrid
        bookmarks={bookmarks}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={onLoadMore}
        onRestore={onRestore}
        onPermanentDelete={onPermanentDelete}
        isSelectionMode={isSelectionMode}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        customScrollParent={customScrollParent}
      />
    </Suspense>
  );
});

/**
 * 浏览器书签视图组件
 */
const BrowserBookmarkView = memo(function BrowserBookmarkView({
  bookmarks,
  onEdit,
  onDelete,
  isSelectionMode,
  selectedIds,
  onToggleSelect,
}: {
  bookmarks: BookmarkWithFolder[];
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  isSelectionMode: boolean;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
}) {
  return (
    <Suspense fallback={<VirtualListSkeleton variant="list" />}>
      <BrowserBookmarkVirtualList
        bookmarks={bookmarks}
        onEdit={onEdit}
        onDelete={onDelete}
        isSelectionMode={isSelectionMode}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
      />
    </Suspense>
  );
});

/**
 * 横幅区域组件（懒加载 AI 功能）
 */
const BannerSection = memo(function BannerSection({
  deferredAIReady,
  userSettings,
}: {
  deferredAIReady: boolean;
  userSettings?: { notifications?: { showWelcomeMessage?: boolean } };
}) {
  return (
    <>
      <SilentErrorBoundary>
        <Suspense fallback={null}>
          <ReclassifyBanner className="mb-4" />
        </Suspense>
      </SilentErrorBoundary>

      <SilentErrorBoundary>
        <Suspense fallback={null}>
          <InboxOrganizationBanner className="mb-4" />
        </Suspense>
      </SilentErrorBoundary>

      <SilentErrorBoundary>
        <Suspense fallback={null}>
          <PendingConfirmationsSection className="mb-4" />
        </Suspense>
      </SilentErrorBoundary>

      {deferredAIReady && userSettings?.notifications?.showWelcomeMessage && (
        <SilentErrorBoundary>
          <Suspense fallback={null}>
            <ProactiveBriefingCard className="mb-4" />
          </Suspense>
        </SilentErrorBoundary>
      )}
    </>
  );
});

// ============================================================================
// 主组件实现
// ============================================================================

export const HomeContent = memo(function HomeContent({
  viewMode,
  layoutMode,
  enableFlipCard,
  onEdit,
  onDelete,
  onRestore,
  onPermanentDelete,
  onToggleRead,
  isSelectionMode,
  selectedIds,
  onToggleSelect,
  onOpenImportDialog,
  userSettings,
  deferredAIReady = false,
  initialError,
  onRetry,
}: HomeContentProps) {
  const { filter } = useHomePageContext();
  const { bookmarks, isLoading, hasMore, loadMore, isLoadingMore } =
    useHomeData();

  // V4.2.x: 滚动容器 ref（用于虚拟滚动）
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );

  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      setScrollContainer(scrollContainerRef.current);
    }
  }, []);

  const { isBrowserPlatform, isTrashFolder } = filter;

  // 稳定的 loadMore 回调，避免内联箭头函数导致下游 memo 组件重渲染
  const handleLoadMore = useCallback(() => {
    loadMore(viewMode);
  }, [loadMore, viewMode]);

  // 内容渲染逻辑
  const renderContent = () => {
    // 错误状态
    if (initialError) {
      return <ErrorMessage message={initialError} retry={onRetry} />;
    }

    // 加载状态
    if (isLoading) {
      return <VirtualListSkeleton variant="grid" count={8} />;
    }

    // 空状态
    if (!bookmarks || bookmarks.length === 0) {
      if (isBrowserPlatform) {
        return <BrowserBookmarkEmptyState onImport={onOpenImportDialog} />;
      }
      return <EmptyState />;
    }

    // 有数据
    if (isBrowserPlatform) {
      return (
        <BrowserBookmarkView
          bookmarks={bookmarks}
          onEdit={onEdit}
          onDelete={onDelete}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
        />
      );
    }

    if (isTrashFolder) {
      return (
        <TrashView
          bookmarks={bookmarks}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={handleLoadMore}
          onRestore={onRestore}
          onPermanentDelete={onPermanentDelete}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          customScrollParent={scrollContainer}
        />
      );
    }

    return (
      <BookmarkListView
        viewMode={viewMode}
        layoutMode={layoutMode}
        enableFlipCard={enableFlipCard}
        bookmarks={bookmarks}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={handleLoadMore}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleRead={onToggleRead}
        isSelectionMode={isSelectionMode}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        customScrollParent={scrollContainer}
      />
    );
  };

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1 md:px-2 py-0.5 md:py-1"
    >
      {/* AI 功能横幅区（懒加载） */}
      <BannerSection
        deferredAIReady={deferredAIReady}
        userSettings={userSettings}
      />

      {/* 内容区 */}
      {renderContent()}
    </div>
  );
});
