"use client";

import { useState, useCallback } from "react";
import type {
  FolderWithStats,
  FolderCategory,
  FolderSelection,
} from "@/components/folders/types";

function getDefaultSelection(
  folders: FolderWithStats[],
  categories: FolderCategory[],
): FolderSelection | null {
  for (const cat of categories) {
    const hasFolder = folders.some(
      (f) => !f.is_archived && !f.is_system && f.category_id === cat.id,
    );
    if (hasFolder) {
      return { type: "category", categoryId: cat.id };
    }
  }

  const uncategorized = folders.find(
    (f) => !f.is_archived && !f.is_system && !f.category_id,
  );
  if (uncategorized) {
    return { type: "folder", folderId: uncategorized.id };
  }

  const sys = folders.find((f) => f.is_system);
  if (sys) {
    return { type: "system", folderId: sys.id };
  }

  return null;
}

function parseSelectionFromUrl(
  searchParams: URLSearchParams,
  folders: FolderWithStats[],
  categories: FolderCategory[],
): FolderSelection | null {
  const catParam = searchParams.get("cat");
  const folderIdParam = searchParams.get("id");

  if (catParam) {
    const catId = parseInt(catParam, 10);
    if (categories.some((c) => c.id === catId)) {
      return { type: "category", categoryId: catId };
    }
  }

  if (folderIdParam) {
    const folderId = parseInt(folderIdParam, 10);
    const folder = folders.find((f) => f.id === folderId);
    if (folder) {
      return folder.is_system
        ? { type: "system", folderId }
        : { type: "folder", folderId };
    }
  }

  return null;
}

export { getDefaultSelection, parseSelectionFromUrl };

interface UseFolderSelectionParams {
  initialFolders: FolderWithStats[];
  initialCategories: FolderCategory[];
  searchParams: URLSearchParams | null;
}

export function useFolderSelection({
  initialFolders,
  initialCategories,
  searchParams,
}: UseFolderSelectionParams) {
  const [selection, setSelection] = useState<FolderSelection | null>(() => {
    if (searchParams) {
      const urlSelection = parseSelectionFromUrl(
        searchParams,
        initialFolders,
        initialCategories,
      );
      if (urlSelection) return urlSelection;
    }
    return getDefaultSelection(initialFolders, initialCategories);
  });

  const updateUrlState = useCallback((newSelection: FolderSelection) => {
    const params = new URLSearchParams();

    if (newSelection.type === "category") {
      params.set("cat", newSelection.categoryId.toString());
    } else if (
      newSelection.type === "folder" ||
      newSelection.type === "system"
    ) {
      params.set("id", newSelection.folderId.toString());
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, []);

  const handleSelectCategory = useCallback(
    (categoryId: number) => {
      const newSelection: FolderSelection = { type: "category", categoryId };
      setSelection(newSelection);
      updateUrlState(newSelection);
    },
    [updateUrlState],
  );

  const handleSelectFolder = useCallback(
    (folderId: number, folders: FolderWithStats[]) => {
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) return;

      const newSelection: FolderSelection = folder.is_system
        ? { type: "system", folderId }
        : { type: "folder", folderId };

      setSelection(newSelection);
      updateUrlState(newSelection);
    },
    [updateUrlState],
  );

  const handleSelectSystem = useCallback(
    (folderId: number) => {
      const newSelection: FolderSelection = { type: "system", folderId };
      setSelection(newSelection);
      updateUrlState(newSelection);
    },
    [updateUrlState],
  );

  return {
    selection,
    setSelection,
    handleSelectCategory,
    handleSelectFolder,
    handleSelectSystem,
    getDefaultSelection,
  };
}
