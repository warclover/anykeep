"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useAbortableFetch } from "@/hooks/core";
import { useInitData } from "@/hooks/data";
import { useBookmarksSWR, cachePerformanceTracker } from "@/lib/cache";
import { useClassificationPolling } from "@/hooks/ui";
import { useProcessingPoller } from "@/hooks/ui";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import { useSynthesisRecommend } from "@/hooks/synthesis/use-synthesis-recommend";
import { DEFAULT_PAGE_SIZE } from "../constants";
import type { BookmarkWithFolder } from "../types";

interface UseHomeBookmarkDataOptions {
  currentPlatform: string;
  currentSort: string;
  currentFolder: string;
  localUsageTags: string[];
  initialBookmarks?: BookmarkWithFolder[];
}

export function useHomeBookmarkData({
  currentPlatform,
  currentSort,
  currentFolder,
  localUsageTags,
  initialBookmarks,
}: UseHomeBookmarkDataOptions) {
  // E8: 延迟 AI 功能加载
  const [deferredAIReady, setDeferredAIReady] = useState(false);

  const {
    currentRecommend,
    shouldShowBubble,
    acceptRecommend,
    dismissRecommend,
    closeBubble,
    refresh: refreshSynthesisRecommend,
  } = useSynthesisRecommend({
    autoFetch: false,
    autoShowBubble: true,
  });

  useEffect(() => {
    let idleCallbackId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        idleCallbackId = (
          window as Window & {
            requestIdleCallback: (
              cb: () => void,
              opts?: { timeout: number },
            ) => number;
          }
        ).requestIdleCallback(
          () => {
            setDeferredAIReady(true);
            refreshSynthesisRecommend();
          },
          { timeout: 3000 },
        );
      } else {
        timeoutId = setTimeout(() => {
          setDeferredAIReady(true);
          refreshSynthesisRecommend();
        }, 1500);
      }
    }

    return () => {
      if (idleCallbackId !== undefined && "cancelIdleCallback" in window) {
        (
          window as Window & { cancelIdleCallback: (id: number) => void }
        ).cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [refreshSynthesisRecommend]);

  // 聚合数据获取
  const shouldUseInitData =
    !initialBookmarks?.length &&
    !currentPlatform &&
    !currentFolder &&
    !localUsageTags.length;

  const { bookmarks: initBookmarks, isLoading: isInitDataLoading } =
    useInitData({
      enabled: shouldUseInitData,
    });

  const effectiveInitialData = initialBookmarks?.length
    ? initialBookmarks
    : initBookmarks.length
      ? initBookmarks
      : undefined;

  const {
    data: bookmarks,
    hasMore,
    isLoading: isInitialLoading,
    isValidating: _isValidating,
    isStale: _isStale,
    error: _swrError,
    mutate: mutateBookmarks,
    setHasMore,
    refetch,
    loadMore: _loadMore,
    updateCacheItem,
    removeCacheItem,
    appendToCache,
  } = useBookmarksSWR({
    platform: currentPlatform,
    sort: currentSort,
    folder: currentFolder,
    usageTags: localUsageTags,
    initialData: effectiveInitialData,
    enabled: !shouldUseInitData || !isInitDataLoading,
  });

  const setBookmarks = mutateBookmarks;

  // 首次渲染性能追踪
  const hasTrackedFirstRenderRef = useRef(false);
  useEffect(() => {
    if (bookmarks.length > 0 && !hasTrackedFirstRenderRef.current) {
      hasTrackedFirstRenderRef.current = true;
      cachePerformanceTracker.markFirstRender("data-cache");
      setTimeout(() => {
        cachePerformanceTracker.endSession("data-cache");
      }, 100);
    }
  }, [bookmarks]);

  // BOOKMARK_CREATED 事件监听
  useEffect(() => {
    const unsubscribe = uiEventBus.on(UIEvents.BOOKMARK_CREATED, (payload) => {
      const newBookmark = payload.bookmark as BookmarkWithFolder;

      const shouldInsert =
        !currentPlatform ||
        currentPlatform === newBookmark.platform ||
        (currentPlatform === "browser" &&
          newBookmark.platform?.startsWith("BROWSER_"));

      if (shouldInsert && !currentFolder) {
        setBookmarks((prev) => [newBookmark, ...prev]);
      }
    });

    return unsubscribe;
  }, [currentPlatform, currentFolder, setBookmarks]);

  // 智能轮询：自动更新 PROCESSING 状态的书签
  useProcessingPoller({
    bookmarks,
    onUpdate: useCallback(
      (updatedBookmark: BookmarkWithFolder) => {
        setBookmarks((prev) =>
          prev.map((b) => (b.id === updatedBookmark.id ? updatedBookmark : b)),
        );
      },
      [setBookmarks],
    ),
    enabled: !isInitialLoading,
  });

  // SSR 数据同步
  const prevInitialBookmarksRef = useRef<BookmarkWithFolder[] | undefined>(
    initialBookmarks,
  );

  useEffect(() => {
    if (!initialBookmarks) return;

    const prevData = prevInitialBookmarksRef.current;
    if (prevData === undefined) {
      prevInitialBookmarksRef.current = initialBookmarks;
      return;
    }

    if (prevData === initialBookmarks) return;

    const prevFirstId = prevData[0]?.id;
    const prevLastId = prevData[prevData.length - 1]?.id;
    const newFirstId = initialBookmarks[0]?.id;
    const newLastId = initialBookmarks[initialBookmarks.length - 1]?.id;

    const hasChanged =
      prevData.length !== initialBookmarks.length ||
      prevFirstId !== newFirstId ||
      prevLastId !== newLastId;

    if (hasChanged) {
      setBookmarks(initialBookmarks);
      setHasMore(initialBookmarks.length === DEFAULT_PAGE_SIZE);
      prevInitialBookmarksRef.current = initialBookmarks;
    }
  }, [initialBookmarks, setBookmarks, setHasMore]);

  // V3.1 分类轮询
  const { trackBookmark } = useClassificationPolling();

  const handleBookmarkCreated = (bookmark: {
    id: number;
    title: string;
    folder_id?: number | null;
    ai_summary?: string | null;
    ai_tags?: string[] | null;
  }) => {
    if (!bookmark.folder_id) {
      trackBookmark(bookmark.id);
    }
  };

  const { fetchWithAbort } = useAbortableFetch();

  const handleEmptyTrash = useCallback(async () => {
    try {
      const res = await fetchWithAbort("/api/trash/empty", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "清空垃圾箱失败");
      }
      setBookmarks([]);
      toast.success("垃圾箱已清空");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "清空垃圾箱失败");
    }
  }, [fetchWithAbort, setBookmarks]);

  return {
    bookmarks,
    hasMore,
    isInitialLoading,
    setBookmarks,
    setHasMore,
    refetch,
    updateCacheItem,
    removeCacheItem,
    appendToCache,
    handleBookmarkCreated,
    handleEmptyTrash,
    deferredAIReady,
    currentRecommend,
    shouldShowBubble,
    acceptRecommend,
    dismissRecommend,
    closeBubble,
  };
}
