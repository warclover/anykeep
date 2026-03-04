"use client";

import { lazy, Suspense } from "react";
import { HomeDialogs } from "./home-dialogs";
import { BatchTagDialog } from "@/components/batch/batch-tag-dialog";
import { SynthesisRecommendBubble } from "@/components/synthesis/synthesis-recommend-bubble";
import type { Bookmark } from "@/types/supabase";
import type { RecommendedTopic } from "@/lib/synthesis/types/recommend";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

const SynthesisConfirmDialog = lazy(() =>
  import("./synthesis-confirm-dialog").then((mod) => ({
    default: mod.SynthesisConfirmDialog,
  })),
);

interface HomeDialogsSectionProps {
  showImportDialog: boolean;
  showBrowserImportDialog: boolean;
  showExportDialog: boolean;
  showMoveDialog: boolean;
  showCreateDialog: boolean;
  setShowImportDialog: (v: boolean) => void;
  setShowBrowserImportDialog: (v: boolean) => void;
  setShowExportDialog: (v: boolean) => void;
  setShowMoveDialog: (v: boolean) => void;
  setShowCreateDialog: (v: boolean) => void;
  bookmarks: BookmarkWithFolder[];
  selectedIds: Set<number>;
  onBookmarkCreated: (bookmark: {
    id: number;
    title: string;
    folder_id?: number | null;
    ai_summary?: string | null;
    ai_tags?: string[] | null;
  }) => void;
  onMoveSuccess: () => void;
  showBatchTagDialog: boolean;
  setShowBatchTagDialog: (v: boolean) => void;
  updateCacheItem: (
    id: number,
    updater: (bookmark: BookmarkWithFolder) => BookmarkWithFolder,
  ) => void;
  showSynthesisDialog: boolean;
  setShowSynthesisDialog: (v: boolean) => void;
  isCreatingSynthesis: boolean;
  onCreateSynthesis: () => void;
  currentRecommend: RecommendedTopic | null;
  shouldShowBubble: boolean;
  onAcceptRecommend: (topic: RecommendedTopic) => void;
  onDismissRecommend: (neverShowAgain?: boolean) => Promise<void>;
  onCloseBubble: () => void;
}

export function HomeDialogsSection({
  showImportDialog,
  showBrowserImportDialog,
  showExportDialog,
  showMoveDialog,
  showCreateDialog,
  setShowImportDialog,
  setShowBrowserImportDialog,
  setShowExportDialog,
  setShowMoveDialog,
  setShowCreateDialog,
  bookmarks,
  selectedIds,
  onBookmarkCreated,
  onMoveSuccess,
  showBatchTagDialog,
  setShowBatchTagDialog,
  updateCacheItem,
  showSynthesisDialog,
  setShowSynthesisDialog,
  isCreatingSynthesis,
  onCreateSynthesis,
  currentRecommend,
  shouldShowBubble,
  onAcceptRecommend,
  onDismissRecommend,
  onCloseBubble,
}: HomeDialogsSectionProps) {
  return (
    <>
      <HomeDialogs
        showImportDialog={showImportDialog}
        showBrowserImportDialog={showBrowserImportDialog}
        showExportDialog={showExportDialog}
        showMoveDialog={showMoveDialog}
        showCreateDialog={showCreateDialog}
        setShowImportDialog={setShowImportDialog}
        setShowBrowserImportDialog={setShowBrowserImportDialog}
        setShowExportDialog={setShowExportDialog}
        setShowMoveDialog={setShowMoveDialog}
        setShowCreateDialog={setShowCreateDialog}
        bookmarks={bookmarks}
        selectedIds={selectedIds}
        onBookmarkCreated={onBookmarkCreated}
        onMoveSuccess={onMoveSuccess}
      />

      <BatchTagDialog
        open={showBatchTagDialog}
        onOpenChange={setShowBatchTagDialog}
        selectedIds={Array.from(selectedIds)}
        selectedBookmarks={bookmarks.filter((b) => selectedIds.has(b.id))}
        onSuccess={(result) => {
          result.affectedIds.forEach((id) => {
            updateCacheItem(id, (bookmark) => {
              if (result.action === "add") {
                const newTags = [
                  ...new Set([...(bookmark.user_tags || []), ...result.tags]),
                ];
                return { ...bookmark, user_tags: newTags };
              } else {
                const newTags = (bookmark.user_tags || []).filter(
                  (t) => !result.tags.includes(t),
                );
                return { ...bookmark, user_tags: newTags };
              }
            });
          });
        }}
      />

      {showSynthesisDialog && (
        <Suspense fallback={null}>
          <SynthesisConfirmDialog
            open={showSynthesisDialog}
            onOpenChange={setShowSynthesisDialog}
            selectedCount={selectedIds.size}
            isCreating={isCreatingSynthesis}
            onConfirm={onCreateSynthesis}
          />
        </Suspense>
      )}

      <SynthesisRecommendBubble
        recommend={currentRecommend}
        visible={shouldShowBubble}
        onAccept={onAcceptRecommend}
        onDismiss={onDismissRecommend}
        onClose={onCloseBubble}
      />
    </>
  );
}
