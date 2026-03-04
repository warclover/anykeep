"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { clientLogger } from "@/lib/client-logger";
import type { BookmarkItem, AnalysisTab } from "../types";

const PAGE_SIZE = 20;

export function useBookmarkLoader(activeTab: AnalysisTab) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(true);
  const [bookmarkSearch, setBookmarkSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);
  const searchEffectEverRun = useRef(false);

  const loadBookmarks = useCallback(
    async (pageNum: number, append = false) => {
      if (pageNum === 1) {
        setIsLoadingBookmarks(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String((pageNum - 1) * PAGE_SIZE),
          excludeBrowser: "true",
        });

        if (bookmarkSearch) {
          params.append("keyword", bookmarkSearch);
        }

        const response = await fetch(`/api/bookmarks?${params}`);
        if (response.ok) {
          const result = await response.json();
          const newBookmarks = result.data?.bookmarks || [];

          if (append) {
            setBookmarks((prev) => [...prev, ...newBookmarks]);
          } else {
            setBookmarks(newBookmarks);
          }

          setHasMore(result.data?.pagination?.hasMore ?? false);
        }
      } catch (error) {
        clientLogger.error({ error }, "Failed to load bookmarks:");
      } finally {
        setIsLoadingBookmarks(false);
        setIsLoadingMore(false);
      }
    },
    [bookmarkSearch],
  );

  useEffect(() => {
    if (activeTab === "history") return;
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadBookmarks(1);
  }, [activeTab, loadBookmarks]);

  useEffect(() => {
    if (activeTab === "history") return;
    if (bookmarkSearch === "" && !searchEffectEverRun.current) {
      searchEffectEverRun.current = true;
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      setPage(1);
      loadBookmarks(1);
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [bookmarkSearch, activeTab, loadBookmarks]);

  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadBookmarks(nextPage, true);
  }, [page, loadBookmarks]);

  return {
    bookmarks,
    isLoadingBookmarks,
    bookmarkSearch,
    setBookmarkSearch,
    hasMore,
    isLoadingMore,
    handleLoadMore,
    loadBookmarks,
  };
}
