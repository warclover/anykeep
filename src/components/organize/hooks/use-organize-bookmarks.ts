"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { dataCache } from "@/lib/cache";

interface UseOrganizeBookmarksOptions {
  invalidateOrganizeItems: () => void;
  refreshItems: () => Promise<unknown>;
  refreshCounts: () => void;
}

export function useOrganizeBookmarks({
  invalidateOrganizeItems,
  refreshItems,
  refreshCounts,
}: UseOrganizeBookmarksOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshBookmarks = useCallback(async () => {
    setIsRefreshing(true);
    try {
      dataCache.invalidate(/^bookmarks:/);
      invalidateOrganizeItems();
      await refreshItems();
      refreshCounts();
    } catch {
      toast.error("刷新失败");
    } finally {
      setIsRefreshing(false);
    }
  }, [invalidateOrganizeItems, refreshItems, refreshCounts]);

  const handleSuggestionApplied = useCallback(() => {
    refreshBookmarks();
    toast.success("整理建议已应用");
  }, [refreshBookmarks]);

  const handleBookmarkDelete = useCallback(
    async (_id: number) => {
      dataCache.invalidate(/^bookmarks:/);
      invalidateOrganizeItems();
      await refreshItems();
      refreshCounts();
      toast.success("书签已删除");
    },
    [invalidateOrganizeItems, refreshItems, refreshCounts],
  );

  return {
    isRefreshing,
    refreshBookmarks,
    handleSuggestionApplied,
    handleBookmarkDelete,
  };
}
