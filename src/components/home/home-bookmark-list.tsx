"use client";

import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrowserBookmarkEmptyState } from "@/components/bookmark/browser-bookmark-empty-state";
import { EmptyState } from "@/components/bookmark/empty-state";
import { ErrorMessage } from "@/components/ui/error-message";
import { VirtualListSkeleton } from "./virtual-list-skeleton";
import type { ViewMode, LayoutMode } from "./constants";
import type { BookmarkWithFolder } from "./types";

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

interface HomeBookmarkListProps {
  bookmarks: BookmarkWithFolder[];
  isInitialLoading: boolean;
  error?: string;
  isBrowserPlatform: boolean;
  isTrashFolder: boolean;
  viewMode: ViewMode;
  layoutMode: LayoutMode;
  enableFlipCard: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  isSelectionMode: boolean;
  selectedIds: Set<number>;
  scrollContainer: HTMLDivElement | null;
  onLoadMore: () => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onRestore: (id: number) => void;
  onPermanentDelete: (id: number) => void;
  onToggleRead: (id: number, isRead: boolean) => void;
  onToggleSelect: (id: number) => void;
  onRetry: () => void;
  onOpenBrowserImport: () => void;
}

export function HomeBookmarkList({
  bookmarks,
  isInitialLoading,
  error,
  isBrowserPlatform,
  isTrashFolder,
  viewMode,
  layoutMode,
  enableFlipCard,
  hasMore,
  isLoadingMore,
  isSelectionMode,
  selectedIds,
  scrollContainer,
  onLoadMore,
  onEdit,
  onDelete,
  onRestore,
  onPermanentDelete,
  onToggleRead,
  onToggleSelect,
  onRetry,
  onOpenBrowserImport,
}: HomeBookmarkListProps) {
  if (isInitialLoading) {
    return <VirtualListSkeleton variant="grid" count={8} />;
  }

  if (error) {
    return <ErrorMessage message={error} retry={onRetry} />;
  }

  if (!bookmarks || bookmarks.length === 0) {
    if (isBrowserPlatform) {
      return <BrowserBookmarkEmptyState onImport={onOpenBrowserImport} />;
    }
    return <EmptyState />;
  }

  return (
    <>
      {isBrowserPlatform ? (
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
      ) : isTrashFolder ? (
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
            customScrollParent={scrollContainer}
          />
        </Suspense>
      ) : (
        <>
          {viewMode === "card" && (
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
                customScrollParent={scrollContainer}
              />
            </Suspense>
          )}

          {(viewMode === "list" || viewMode === "compact") && (
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
                customScrollParent={scrollContainer}
              />
            </Suspense>
          )}
        </>
      )}

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
}
