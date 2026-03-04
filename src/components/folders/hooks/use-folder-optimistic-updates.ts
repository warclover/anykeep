"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setFoldersCache, clearFoldersCache } from "@/lib/folder/cache";
import { useUser } from "@/contexts/user-context";
import type {
  FolderWithStats,
  FolderCategory,
  LockStatusMap,
  FolderSelection,
} from "@/components/folders/types";
import type { Folder as FolderType } from "@/types/supabase";
import { getDefaultSelection } from "./use-folder-selection";

interface UseFolderOptimisticUpdatesParams {
  initialFolders: FolderWithStats[];
  initialCategories: FolderCategory[];
  selection: FolderSelection | null;
  setSelection: (s: FolderSelection | null) => void;
  refreshBookmarks: () => void;
}

export function useFolderOptimisticUpdates({
  initialFolders,
  initialCategories,
  selection,
  setSelection,
  refreshBookmarks,
}: UseFolderOptimisticUpdatesParams) {
  const router = useRouter();
  const { user } = useUser();

  const [localFolders, setLocalFolders] = useState(initialFolders);
  const [localCategories, setLocalCategories] =
    useState<FolderCategory[]>(initialCategories);
  const [lockStatusMap, setLockStatusMap] = useState<LockStatusMap>(() => {
    const map: LockStatusMap = {};
    for (const folder of initialFolders) {
      if (!folder.is_system) {
        map[folder.id] = {
          isLocked: folder.is_locked ?? false,
          isAiRenamable: !(folder.is_locked ?? false),
        };
      }
    }
    return map;
  });

  useEffect(() => {
    queueMicrotask(() => {
      setLocalFolders(initialFolders);
      setLocalCategories(initialCategories);

      const map: LockStatusMap = {};
      for (const folder of initialFolders) {
        if (!folder.is_system) {
          map[folder.id] = {
            isLocked: folder.is_locked ?? false,
            isAiRenamable: !(folder.is_locked ?? false),
          };
        }
      }
      setLockStatusMap(map);
    });

    if (initialFolders.length > 0 && user?.id) {
      setFoldersCache(initialFolders, user.id);
    }
  }, [initialFolders, initialCategories, user?.id]);

  useEffect(() => {
    if (!selection) {
      const next = getDefaultSelection(localFolders, localCategories);
      if (next) {
        setSelection(next);
      }
      return;
    }

    let isValid = true;

    if (selection.type === "folder" || selection.type === "system") {
      isValid = localFolders.some((f) => f.id === selection.folderId);
    } else if (selection.type === "category") {
      isValid = localCategories.some((c) => c.id === selection.categoryId);
    }

    if (!isValid) {
      setSelection(getDefaultSelection(localFolders, localCategories));
    }
  }, [localFolders, localCategories, selection, setSelection]);

  const handleFolderCreated = useCallback((newFolder: FolderType) => {
    const folderWithStats: FolderWithStats = {
      ...newFolder,
      source: newFolder.source ?? null,
      system_type: newFolder.system_type ?? null,
      is_system: newFolder.is_system ?? false,
      is_archived: newFolder.is_archived ?? false,
      ai_generation_source: newFolder.ai_generation_source ?? null,
      crystal_birth_time: newFolder.crystal_birth_time ?? null,
      is_ai_generated: newFolder.is_ai_generated ?? null,
      is_naming_pending: newFolder.is_naming_pending ?? null,
      origin_bookmark_ids: newFolder.origin_bookmark_ids ?? null,
      category_id:
        ((newFolder as Record<string, unknown>).category_id as number | null) ??
        null,
      bookmark_count: 0,
      today_count: 0,
      is_locked: false,
    };

    setLocalFolders((prev) => {
      if (prev.some((f) => f.id === newFolder.id)) {
        return prev;
      }
      return [folderWithStats, ...prev];
    });

    clearFoldersCache();
  }, []);

  const handleFolderDeleted = useCallback(
    (deletedFolderId: number) => {
      setLocalFolders((prev) => prev.filter((f) => f.id !== deletedFolderId));
      clearFoldersCache();

      if (
        selection &&
        (selection.type === "folder" || selection.type === "system") &&
        selection.folderId === deletedFolderId
      ) {
        const remaining = localFolders.filter((f) => f.id !== deletedFolderId);
        setSelection(getDefaultSelection(remaining, localCategories));
      }

      router.refresh();
    },
    [router, selection, localFolders, localCategories, setSelection],
  );

  const handleFolderRenamed = useCallback(
    (folderId: number, newName: string) => {
      setLocalFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f)),
      );
      clearFoldersCache();
    },
    [],
  );

  const handleFolderMerged = useCallback(
    (sourceFolderId: number, targetFolderId: number, movedCount: number) => {
      setLocalFolders((prev) =>
        prev
          .filter((f) => f.id !== sourceFolderId)
          .map((f) =>
            f.id === targetFolderId
              ? { ...f, bookmark_count: (f.bookmark_count || 0) + movedCount }
              : f,
          ),
      );
      clearFoldersCache();
      refreshBookmarks();
    },
    [refreshBookmarks],
  );

  const handleFolderCategoryChanged = useCallback(
    (folderId: number, categoryId: number | null) => {
      setLocalFolders((prev) =>
        prev.map((f) =>
          f.id === folderId ? { ...f, category_id: categoryId } : f,
        ),
      );
      clearFoldersCache();
    },
    [],
  );

  const handleCategoryCreated = useCallback((newCategory: FolderCategory) => {
    setLocalCategories((prev) => {
      if (prev.some((c) => c.id === newCategory.id)) return prev;
      return [...prev, newCategory];
    });
  }, []);

  const handleCategoryDeleted = useCallback(
    (categoryId: number) => {
      setLocalCategories((prev) => prev.filter((c) => c.id !== categoryId));
      if (
        selection?.type === "category" &&
        selection.categoryId === categoryId
      ) {
        const remainingCats = localCategories.filter(
          (c) => c.id !== categoryId,
        );
        setSelection(getDefaultSelection(localFolders, remainingCats));
      }
    },
    [selection, localFolders, localCategories, setSelection],
  );

  const handleCategoryRenamed = useCallback(
    (categoryId: number, newName: string) => {
      setLocalCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, name: newName } : c)),
      );
    },
    [],
  );

  const handleCategoryIconChanged = useCallback(
    (categoryId: number, newIcon: string) => {
      setLocalCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId ? { ...c, icon: newIcon || null } : c,
        ),
      );
    },
    [],
  );

  const handleCategoryColorChanged = useCallback(
    (categoryId: number, newColor: string) => {
      setLocalCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId ? { ...c, color: newColor || null } : c,
        ),
      );
    },
    [],
  );

  const handleCategoryMoved = useCallback(
    (
      categoryId: number,
      newSortOrder: number,
      neighborId: number,
      neighborNewOrder: number,
    ) => {
      setLocalCategories((prev) =>
        prev.map((c) => {
          if (c.id === categoryId) return { ...c, sort_order: newSortOrder };
          if (c.id === neighborId)
            return { ...c, sort_order: neighborNewOrder };
          return c;
        }),
      );
    },
    [],
  );

  return {
    localFolders,
    setLocalFolders,
    localCategories,
    lockStatusMap,
    handleFolderCreated,
    handleFolderDeleted,
    handleFolderRenamed,
    handleFolderMerged,
    handleFolderCategoryChanged,
    handleCategoryCreated,
    handleCategoryDeleted,
    handleCategoryRenamed,
    handleCategoryIconChanged,
    handleCategoryColorChanged,
    handleCategoryMoved,
  };
}
