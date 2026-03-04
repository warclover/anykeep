"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { OrganizeTabs } from "./organize-tabs";
import { useTrustMode, useConfirmations } from "@/hooks/ui";
import { useOrganizeCounts } from "@/hooks/data/use-organize-counts";
import {
  useOrganizeItems,
  useInvalidateOrganizeItems,
} from "@/hooks/data/use-organize-items";
import { useLibrarianAnalysis } from "@/hooks/domain/folder/use-librarian-analysis";
import { useHealthActions } from "@/hooks/domain/organize/use-health-actions";
import { isBookmarkTab } from "@/lib/constants/organize-tabs";
import { useOrganizeTab } from "./hooks/use-organize-tab";
import { useOrganizeFlow } from "./hooks/use-organize-flow";
import { useOneClickOrganize } from "./hooks/use-one-click-organize";
import { useOrganizeBookmarks } from "./hooks/use-organize-bookmarks";
import { OrganizePageHeader } from "./organize-page-header";
import { HealthTabContent } from "./health-tab-content";
import { PendingTabContent } from "./pending-tab-content";
import { BookmarkListCard } from "./bookmark-list-card";
import { TrustModeBanner } from "./trust-mode-banner";
import { CompactStatsBar } from "./compact-stats-bar";

export { OrganizePageSkeleton } from "./organize-page-skeleton";

interface OrganizePageClientProps {
  availableFolders?: { id: number; name: string }[];
}

export function OrganizePageClient({
  availableFolders = [],
}: OrganizePageClientProps) {
  const router = useRouter();
  const urlTab = useSearchParams()?.get("tab") ?? null;

  const { activeTab, handleTabChange, currentTabConfig } = useOrganizeTab({
    urlTab,
  });
  const {
    extendedStats,
    isLoading: isCountsLoading,
    refresh: refreshCounts,
  } = useOrganizeCounts();
  const invalidateOrganizeItems = useInvalidateOrganizeItems();
  const {
    items: displayBookmarks,
    isLoading: isItemsLoading,
    isFetching: isItemsFetching,
    isFetchingNextPage,
    hasNextPage,
    refresh: refreshItems,
    fetchNextPage,
  } = useOrganizeItems(activeTab);
  const {
    isFullAuto,
    isSemiAuto,
    isManual,
    isLoading: isTrustModeLoading,
  } = useTrustMode();
  const { pendingCount } = useConfirmations({
    pendingOnly: true,
    type: "classification",
  });

  const librarianAnalysis = useLibrarianAnalysis({
    enabled: activeTab === "health",
  });
  const { refresh: refreshAnalysis } = librarianAnalysis;
  const healthActions = useHealthActions({
    onSuccess: () => refreshAnalysis(),
  });

  const {
    isRefreshing,
    refreshBookmarks,
    handleSuggestionApplied,
    handleBookmarkDelete,
  } = useOrganizeBookmarks({
    invalidateOrganizeItems,
    refreshItems,
    refreshCounts,
  });

  const {
    state,
    progress,
    organizeError,
    isExecuting,
    beforeSnapshot,
    afterSnapshot,
    hasComparison,
    snapshotError,
    handleOrganizeAction,
    handleReset,
    handleCancel,
  } = useOrganizeFlow({ onAnalysisRefresh: refreshAnalysis });

  const { isOrganizing, handleOneClickOrganize } = useOneClickOrganize({
    bookmarkCount: displayBookmarks.length,
    refreshBookmarks,
    refreshCounts,
  });

  const showOrganizePanels = activeTab === "pending";
  const isBookmarkListTab = isBookmarkTab(activeTab);
  const isLoadingTab = isItemsLoading && displayBookmarks.length === 0;

  return (
    <div className="container max-w-7xl py-4 space-y-4">
      <OrganizePageHeader
        showOneClick={showOrganizePanels && displayBookmarks.length > 0}
        isOrganizing={isOrganizing}
        isRefreshing={isRefreshing}
        isLoadingTab={isLoadingTab}
        onOneClickOrganize={handleOneClickOrganize}
        onRefresh={refreshBookmarks}
      />

      {showOrganizePanels && (
        <TrustModeBanner
          isFullAuto={isFullAuto}
          isSemiAuto={isSemiAuto}
          isManual={isManual}
          isLoading={isTrustModeLoading}
          pendingCount={pendingCount}
          onGoToMessages={() => router.push("/messages")}
          onGoToSettings={() => router.push("/settings")}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <OrganizeTabs activeTab={activeTab} onTabChange={handleTabChange} />
        {showOrganizePanels && (
          <CompactStatsBar stats={extendedStats} isLoading={isCountsLoading} />
        )}
      </div>

      {organizeError && state === "idle" && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="p-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              ⚠️ {organizeError}
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === "health" ? (
        <HealthTabContent
          state={state}
          progress={progress}
          organizeError={organizeError}
          snapshotError={snapshotError}
          isExecuting={isExecuting}
          hasComparison={hasComparison}
          beforeSnapshot={beforeSnapshot}
          afterSnapshot={afterSnapshot}
          librarianAnalysis={librarianAnalysis}
          onOrganizeAction={handleOrganizeAction}
          onCancel={handleCancel}
          onReset={handleReset}
          mergeFolders={healthActions.mergeFolders}
          deleteFolder={healthActions.deleteFolder}
          renameFolder={healthActions.renameFolder}
          createFolder={healthActions.createFolder}
        />
      ) : showOrganizePanels ? (
        <PendingTabContent
          bookmarks={displayBookmarks}
          isLoading={isLoadingTab}
          isFetching={isItemsFetching}
          isFetchingNextPage={isFetchingNextPage ?? false}
          hasNextPage={hasNextPage ?? false}
          tabConfig={currentTabConfig}
          availableFolders={availableFolders}
          isExecuting={isExecuting}
          onLoadMore={fetchNextPage}
          onDelete={handleBookmarkDelete}
          onOrganizeAction={handleOrganizeAction}
          onRefreshBookmarks={refreshBookmarks}
          onSuggestionApplied={handleSuggestionApplied}
        />
      ) : isBookmarkListTab ? (
        <BookmarkListCard
          bookmarks={displayBookmarks}
          isLoading={isLoadingTab}
          isFetching={isItemsFetching}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          onLoadMore={fetchNextPage}
          tabConfig={currentTabConfig}
          onDelete={handleBookmarkDelete}
        />
      ) : null}
    </div>
  );
}
