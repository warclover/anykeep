"use client";

import { useState, useMemo, useEffect } from "react";
import {
  FolderPageToolbar,
  type SortOption,
  type ViewMode,
} from "@/components/folders/folder-page-toolbar";
import { FolderNavHeader } from "@/components/folders/folder-nav-panel";
import { getSelectionInfo } from "@/components/folders/folder-bookmark-area";
import { usePageToolbar } from "@/contexts/page-toolbar-context";
import type {
  FolderWithStats,
  FolderCategory,
  FolderSelection,
} from "@/components/folders/types";
import { createElement } from "react";

interface UseFolderToolbarParams {
  selection: FolderSelection | null;
  localFolders: FolderWithStats[];
  localCategories: FolderCategory[];
  bookmarks: Array<{
    id: number;
    title?: string | null;
    ai_summary?: string | null;
    ai_tags?: string[] | null;
  }>;
  isLoadingBookmarks: boolean;
  /** 必须用 useCallback 包裹，否则会导致 toolbarElement → context → 重渲染无限循环 */
  onCreateCategory: () => void;
  /** 必须用 useCallback 包裹，否则会导致 toolbarElement → context → 重渲染无限循环 */
  onCreateFolder: (defaultCategoryId?: number) => void;
  /** 必须用 useCallback 包裹，否则会导致 toolbarElement → context → 重渲染无限循环 */
  onOpenAIAssistant: () => void;
}

export function useFolderToolbar({
  selection,
  localFolders,
  localCategories,
  bookmarks,
  isLoadingBookmarks,
  onCreateCategory,
  onCreateFolder,
  onOpenAIAssistant,
}: UseFolderToolbarParams) {
  const pageToolbar = usePageToolbar();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("created");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("folder-bookmark-view-mode");
      if (saved === "card" || saved === "list" || saved === "compact")
        return saved;
    }
    return "list";
  });

  const totalStats = useMemo(() => {
    const active = localFolders.filter((f) => !f.is_archived);
    return {
      folderCount: active.length,
      bookmarkCount: active.reduce(
        (sum, f) => sum + (f.bookmark_count || 0),
        0,
      ),
      todayCount: active.reduce((sum, f) => sum + (f.today_count || 0), 0),
    };
  }, [localFolders]);

  const selectionInfo = useMemo(
    () =>
      selection
        ? getSelectionInfo(selection, localFolders, localCategories)
        : null,
    [selection, localFolders, localCategories],
  );

  const filteredBookmarkCount = useMemo(() => {
    let result = [...bookmarks];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title?.toLowerCase().includes(q) ||
          b.ai_summary?.toLowerCase().includes(q) ||
          b.ai_tags?.some((tag: string) => tag.toLowerCase().includes(q)),
      );
    }
    return result.length;
  }, [bookmarks, searchQuery]);

  // 回调直接传入 toolbarElement，调用方必须确保引用稳定（useCallback）
  // 否则会导致 toolbarElement 重算 → setPageToolbar → context 更新 → 重渲染循环
  const toolbarElement = useMemo(() => {
    if (!selection || !selectionInfo) return null;
    return createElement(
      "div",
      { className: "flex items-stretch w-full" },
      createElement(
        "div",
        {
          className:
            "hidden lg:flex w-[280px] flex-shrink-0 items-center border-r border-gray-200 dark:border-gray-800",
        },
        createElement(FolderNavHeader, {
          totalStats,
          onCreateCategory,
          onCreateFolder,
          className: "!min-h-0 !py-0 !pr-2 !border-0",
        }),
      ),
      createElement(FolderPageToolbar, {
        selectionInfo,
        filteredBookmarkCount,
        isLoading: isLoadingBookmarks,
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        viewMode,
        setViewMode,
        onOpenAIAssistant,
        className: "flex-1 min-w-0",
      }),
    );
  }, [
    selection,
    selectionInfo,
    totalStats,
    filteredBookmarkCount,
    isLoadingBookmarks,
    searchQuery,
    sortBy,
    viewMode,
    onCreateCategory,
    onCreateFolder,
    onOpenAIAssistant,
  ]);

  const setPageToolbar = pageToolbar?.setToolbar;
  useEffect(() => {
    if (!setPageToolbar) return;
    setPageToolbar(toolbarElement);
    return () => setPageToolbar(null);
  }, [setPageToolbar, toolbarElement]);

  return {
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    totalStats,
    selectionInfo,
    filteredBookmarkCount,
  };
}
