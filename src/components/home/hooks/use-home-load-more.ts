"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/core";
import { getPageSizeByView } from "../constants";
import type { ViewMode } from "../constants";
import type { Bookmark } from "@/types/supabase";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface UseHomeLoadMoreOptions {
  bookmarks: BookmarkWithFolder[];
  hasMore: boolean;
  viewMode: ViewMode;
  currentPlatform: string;
  appendToCache: (items: BookmarkWithFolder[], hasMore: boolean) => void;
}

export function useHomeLoadMore({
  bookmarks,
  hasMore,
  viewMode,
  currentPlatform,
  appendToCache,
}: UseHomeLoadMoreOptions) {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { fetchWithAbort } = useAbortableFetch();

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const lastBookmark = bookmarks[bookmarks.length - 1];
      const params = new URLSearchParams({
        cursor: lastBookmark.id.toString(),
        limit: getPageSizeByView(viewMode).toString(),
      });

      if (currentPlatform) {
        params.append("platform", currentPlatform);
      }

      const res = await fetchWithAbort(`/api/bookmarks?${params}`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "加载失败");
      }

      const data = await res.json();
      const newBookmarks = data.data.bookmarks;
      const newHasMore = data.data.pagination.hasMore;

      appendToCache(newBookmarks, newHasMore);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast.error(error instanceof Error ? error.message : "加载失败");
    } finally {
      setIsLoadingMore(false);
    }
  };

  return { isLoadingMore, handleLoadMore };
}
