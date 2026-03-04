"use client";

import { ClusterSuggestionsPanel } from "@/components/inbox/cluster-suggestions-panel";
import { OrganizationSuggestionsPanel } from "@/components/inbox/organization-suggestions-panel";
import { QuickActionSidebar } from "./quick-action-sidebar";
import { BookmarkListCard } from "./bookmark-list-card";
import type { QuickActionType } from "@/lib/organize/types";
import type { Bookmark } from "@/types/supabase";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface PendingTabContentProps {
  bookmarks: BookmarkWithFolder[];
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  tabConfig: { title: string; description: string };
  availableFolders: { id: number; name: string }[];
  isExecuting: boolean;
  onLoadMore: () => void;
  onDelete: (id: number) => void;
  onOrganizeAction: (actionType: QuickActionType) => void;
  onRefreshBookmarks: () => void;
  onSuggestionApplied: () => void;
}

export function PendingTabContent({
  bookmarks,
  isLoading,
  isFetching,
  isFetchingNextPage,
  hasNextPage,
  tabConfig,
  availableFolders,
  isExecuting,
  onLoadMore,
  onDelete,
  onOrganizeAction,
  onRefreshBookmarks,
  onSuggestionApplied,
}: PendingTabContentProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-1 order-2 lg:order-1 space-y-4">
        <QuickActionSidebar
          onAction={onOrganizeAction}
          disabled={isExecuting}
        />
        <ClusterSuggestionsPanel onRefreshBookmarks={onRefreshBookmarks} />
        <OrganizationSuggestionsPanel
          availableFolders={availableFolders}
          onSuggestionApplied={onSuggestionApplied}
        />
      </div>

      <div className="lg:col-span-3 order-1 lg:order-2">
        <BookmarkListCard
          bookmarks={bookmarks}
          isLoading={isLoading}
          isFetching={isFetching}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          onLoadMore={onLoadMore}
          tabConfig={tabConfig}
          onDelete={onDelete}
          columns={3}
        />
      </div>
    </div>
  );
}
