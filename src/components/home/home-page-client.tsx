"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelectionMode } from "@/hooks/core";
import { useSnapshotFeature } from "@/components/snapshot";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import type { Bookmark } from "@/types/supabase";
import type { UserSettings } from "@/types/user-settings";
import { useHomeViewMode } from "./hooks/use-home-view-mode";
import { useHomeMutations } from "./hooks/use-home-mutations";
import { useHomeBatch } from "./hooks/use-home-batch";
import { useHomeUrlSync } from "./hooks/use-home-url-sync";
import { useHomeBookmarkData } from "./hooks/use-home-bookmark-data";
import { useHomeLoadMore } from "./hooks/use-home-load-more";
import { useHomeDialogs } from "./hooks/use-home-dialogs";
import { HomeToolbar } from "./home-toolbar";
import { HomeBannersSection } from "./home-banners-section";
import { HomeBookmarkList } from "./home-bookmark-list";
import { HomeDialogsSection } from "./home-dialogs-section";
import { SmartListView } from "@/components/smart-list";

type BookmarkWithFolder = Bookmark & { folders?: { name: string } | null };
interface HomePageClientProps {
  initialBookmarks?: BookmarkWithFolder[];
  error?: string;
  urlFolder?: string;
  urlPlatform?: string;
  smartListId?: number | null;
  userSettings?: UserSettings;
}

export function HomePageClient({
  initialBookmarks,
  error,
  urlFolder: propFolder,
  urlPlatform: propPlatform,
  smartListId,
  userSettings,
}: HomePageClientProps = {}) {
  const router = useRouter();
  const urlSync = useHomeUrlSync({ propPlatform, propFolder }, smartListId);
  const bookmarkData = useHomeBookmarkData({
    currentPlatform: urlSync.currentPlatform,
    currentSort: urlSync.currentSort,
    currentFolder: urlSync.currentFolder,
    localUsageTags: urlSync.localUsageTags,
    initialBookmarks,
  });

  const vm = useHomeViewMode({ isBrowserPlatform: urlSync.isBrowserPlatform });
  const {
    viewMode,
    setViewMode,
    layoutMode,
    setLayoutMode,
    enableFlipCard,
    setEnableFlipCard,
  } = vm;
  const handleFlipCardToggle = () => {
    const v = !enableFlipCard;
    setEnableFlipCard(v);
    uiEventBus.emit(UIEvents.FLIP_CARD_CHANGE, { enabled: v });
  };

  const sel = useSelectionMode();
  const {
    isSelectionMode,
    selectedIds,
    isBatchDeleting,
    toggleSelectionMode,
    toggleSelect,
    selectAll,
    deselectAll,
    exitSelectionMode,
  } = sel;
  const isSnapshotEnabled = useSnapshotFeature();
  const mutations = useHomeMutations({
    getBookmarks: () => bookmarkData.bookmarks,
    setBookmarks: bookmarkData.setBookmarks,
    updateCacheItem: bookmarkData.updateCacheItem,
    removeCacheItem: bookmarkData.removeCacheItem,
  });
  const batch = useHomeBatch({
    getBookmarks: () => bookmarkData.bookmarks,
    setBookmarks: bookmarkData.setBookmarks,
    removeCacheItem: bookmarkData.removeCacheItem,
    selectedIds,
    exitSelectionMode,
  });
  const dialogs = useHomeDialogs({
    homeContext: urlSync.homeContext,
    exitSelectionMode,
    refetch: bookmarkData.refetch,
    selectedIds,
    isSelectionMode,
    toggleSelectionMode,
  });
  const { isLoadingMore, handleLoadMore } = useHomeLoadMore({
    bookmarks: bookmarkData.bookmarks,
    hasMore: bookmarkData.hasMore,
    viewMode,
    currentPlatform: urlSync.currentPlatform,
    appendToCache: bookmarkData.appendToCache,
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
  useLayoutEffect(() => {
    if (scrollContainerRef.current)
      setScrollContainer(scrollContainerRef.current);
  }, []);
  if (urlSync.currentSmartListId) {
    return <SmartListView smartListId={urlSync.currentSmartListId} />;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <HomeToolbar
        viewMode={viewMode}
        layoutMode={layoutMode}
        enableFlipCard={enableFlipCard}
        onViewModeChange={setViewMode}
        onLayoutModeChange={setLayoutMode}
        onFlipCardToggle={handleFlipCardToggle}
        currentPlatform={urlSync.currentPlatform}
        currentSort={urlSync.currentSort}
        onPlatformChange={urlSync.handlePlatformChange}
        onSortChange={urlSync.handleSortChange}
        isSelectionMode={isSelectionMode}
        selectedIds={selectedIds}
        totalCount={bookmarkData.bookmarks.length}
        isBatchDeleting={isBatchDeleting}
        isBatchCreatingSnapshot={batch.isBatchCreatingSnapshot}
        onToggleSelectionMode={toggleSelectionMode}
        onSelectAll={() => selectAll(bookmarkData.bookmarks.map((b) => b.id))}
        onDeselectAll={deselectAll}
        onBatchDelete={batch.handleBatchDelete}
        onOpenMoveDialog={dialogs.openMoveDialog}
        onBatchCreateSnapshot={batch.handleBatchCreateSnapshot}
        onBatchRestore={batch.handleBatchRestore}
        onEmptyTrash={bookmarkData.handleEmptyTrash}
        onOpenImportDialog={dialogs.openImportDialog}
        onOpenBrowserImportDialog={dialogs.openBrowserImportDialog}
        onOpenExportDialog={dialogs.openExportDialog}
        onOpenTagDialog={() => dialogs.setShowBatchTagDialog(true)}
        isBrowserPlatform={urlSync.isBrowserPlatform}
        isTrashFolder={urlSync.isTrashFolder}
        isSnapshotEnabled={isSnapshotEnabled}
        isMobileMoreMenuOpen={dialogs.isMobileMoreMenuOpen}
        onMobileMoreMenuOpenChange={dialogs.setIsMobileMoreMenuOpen}
      />
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1 md:px-2 py-0.5 md:py-1"
      >
        <HomeBannersSection
          deferredAIReady={bookmarkData.deferredAIReady}
          showBriefing={!!userSettings?.notifications?.showWelcomeMessage}
        />
        <HomeBookmarkList
          bookmarks={bookmarkData.bookmarks}
          isInitialLoading={bookmarkData.isInitialLoading}
          error={error}
          isBrowserPlatform={urlSync.isBrowserPlatform}
          isTrashFolder={urlSync.isTrashFolder}
          viewMode={viewMode}
          layoutMode={layoutMode}
          enableFlipCard={enableFlipCard}
          hasMore={bookmarkData.hasMore}
          isLoadingMore={isLoadingMore}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          scrollContainer={scrollContainer}
          onLoadMore={handleLoadMore}
          onEdit={mutations.handleEdit}
          onDelete={mutations.handleDelete}
          onRestore={mutations.handleRestore}
          onPermanentDelete={mutations.handlePermanentDelete}
          onToggleRead={mutations.handleToggleRead}
          onToggleSelect={toggleSelect}
          onRetry={() => router.refresh()}
          onOpenBrowserImport={dialogs.openBrowserImportDialog}
        />
      </div>
      <HomeDialogsSection
        showImportDialog={dialogs.showImportDialog}
        showBrowserImportDialog={dialogs.showBrowserImportDialog}
        showExportDialog={dialogs.showExportDialog}
        showMoveDialog={dialogs.showMoveDialog}
        showCreateDialog={dialogs.showCreateDialog}
        setShowImportDialog={dialogs.setShowImportDialog}
        setShowBrowserImportDialog={dialogs.setShowBrowserImportDialog}
        setShowExportDialog={dialogs.setShowExportDialog}
        setShowMoveDialog={dialogs.setShowMoveDialog}
        setShowCreateDialog={dialogs.setShowCreateDialog}
        bookmarks={bookmarkData.bookmarks}
        selectedIds={selectedIds}
        onBookmarkCreated={bookmarkData.handleBookmarkCreated}
        onMoveSuccess={dialogs.handleMoveSuccess}
        showBatchTagDialog={dialogs.showBatchTagDialog}
        setShowBatchTagDialog={dialogs.setShowBatchTagDialog}
        updateCacheItem={bookmarkData.updateCacheItem}
        showSynthesisDialog={dialogs.showSynthesisDialog}
        setShowSynthesisDialog={dialogs.setShowSynthesisDialog}
        isCreatingSynthesis={dialogs.isCreatingSynthesis}
        onCreateSynthesis={dialogs.handleCreateSynthesis}
        currentRecommend={bookmarkData.currentRecommend}
        shouldShowBubble={bookmarkData.shouldShowBubble}
        onAcceptRecommend={bookmarkData.acceptRecommend}
        onDismissRecommend={bookmarkData.dismissRecommend}
        onCloseBubble={bookmarkData.closeBubble}
      />
    </div>
  );
}
