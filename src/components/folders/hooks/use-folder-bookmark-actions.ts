"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBookmarkActions } from "@/hooks/domain/bookmark/use-bookmark-actions";
import { clearFoldersCache } from "@/lib/folder/cache";
import type {
  FolderWithStats,
  FolderSelection,
} from "@/components/folders/types";
import type { Bookmark } from "@/types/supabase";

interface UseFolderBookmarkActionsParams {
  bookmarks: Bookmark[];
  mutateBookmarks: (data: Bookmark[], revalidate: boolean) => void;
  selection: FolderSelection | null;
  setLocalFolders: React.Dispatch<React.SetStateAction<FolderWithStats[]>>;
}

export function useFolderBookmarkActions({
  bookmarks,
  mutateBookmarks,
  selection,
  setLocalFolders,
}: UseFolderBookmarkActionsParams) {
  const router = useRouter();
  const { deleteBookmark, toggleReadStatus, toggleStarredStatus } =
    useBookmarkActions();

  const adjustFolderCount = useCallback(
    (delta: number) => {
      if (selection?.type === "folder" || selection?.type === "system") {
        const folderId = selection.folderId;
        setLocalFolders((prev) =>
          prev.map((f) =>
            f.id === folderId
              ? {
                  ...f,
                  bookmark_count: Math.max(0, (f.bookmark_count || 0) + delta),
                }
              : f,
          ),
        );
      }
    },
    [selection, setLocalFolders],
  );

  const handleEditBookmark = useCallback(
    (id: number) => {
      router.push(`/bookmark/${id}/edit`);
    },
    [router],
  );

  const handleDeleteBookmark = useCallback(
    async (id: number) => {
      const snapshot = bookmarks;
      mutateBookmarks(
        bookmarks.filter((b) => b.id !== id),
        false,
      );
      adjustFolderCount(-1);
      const result = await deleteBookmark(id);
      if (!result.success) {
        mutateBookmarks(snapshot, false);
        adjustFolderCount(1);
      }
    },
    [bookmarks, mutateBookmarks, deleteBookmark, adjustFolderCount],
  );

  const handleToggleRead = useCallback(
    async (id: number, isRead: boolean) => {
      const snapshot = bookmarks;
      mutateBookmarks(
        bookmarks.map((b) => (b.id === id ? { ...b, is_read: isRead } : b)),
        false,
      );
      const result = await toggleReadStatus(id, isRead);
      if (!result.success) mutateBookmarks(snapshot, false);
    },
    [bookmarks, mutateBookmarks, toggleReadStatus],
  );

  const handleToggleStarred = useCallback(
    async (id: number, isStarred: boolean) => {
      const snapshot = bookmarks;
      mutateBookmarks(
        bookmarks.map((b) =>
          b.id === id ? { ...b, is_starred: isStarred } : b,
        ),
        false,
      );
      const result = await toggleStarredStatus(id, isStarred);
      if (!result.success) mutateBookmarks(snapshot, false);
    },
    [bookmarks, mutateBookmarks, toggleStarredStatus],
  );

  const handleBatchMoveSuccess = useCallback(
    (movedIds: number[]) => {
      adjustFolderCount(-movedIds.length);
      mutateBookmarks(
        bookmarks.filter((b) => !movedIds.includes(b.id)),
        false,
      );
      clearFoldersCache();
    },
    [bookmarks, mutateBookmarks, adjustFolderCount],
  );

  const handleBatchDeleteSuccess = useCallback(
    (deletedIds: number[]) => {
      adjustFolderCount(-deletedIds.length);
      mutateBookmarks(
        bookmarks.filter((b) => !deletedIds.includes(b.id)),
        false,
      );
      clearFoldersCache();
    },
    [bookmarks, mutateBookmarks, adjustFolderCount],
  );

  return {
    handleEditBookmark,
    handleDeleteBookmark,
    handleToggleRead,
    handleToggleStarred,
    handleBatchMoveSuccess,
    handleBatchDeleteSuccess,
  };
}
