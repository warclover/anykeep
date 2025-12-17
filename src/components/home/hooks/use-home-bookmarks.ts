/**
 * V4.2.17: 首页书签数据管理 Hook
 *
 * Phase 2.2 - 适配层构建
 * 整合数据获取逻辑，提供类型安全的接口
 *
 * 设计原则：
 * 1. 单一职责 - 仅负责书签数据的获取和管理
 * 2. 类型安全 - 使用 types.ts 中定义的类型契约
 * 3. 向后兼容 - 可与现有组件并行使用
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useInitData } from "@/hooks/use-init-data";
import { useBookmarksSWR, cachePerformanceTracker } from "@/lib/cache";
import { useProcessingPoller } from "@/hooks/use-processing-poller";
import { useClassificationPolling } from "@/hooks/use-classification-polling";
import { getPageSizeByView } from "../constants";
import type { BookmarkWithFolder, ReadonlyBookmarks } from "../types";

// ============================================================================
// Hook 参数类型
// ============================================================================

export interface UseHomeBookmarksOptions {
  /** 当前平台筛选 */
  platform: string;
  /** 当前排序方式 */
  sort: string;
  /** 当前文件夹筛选 */
  folder: string;
  /** 用途标签筛选 */
  usageTags: readonly string[];
  /** SSR 传入的初始数据 */
  initialBookmarks?: readonly BookmarkWithFolder[];
  /** 当前视图模式（用于计算 pageSize） */
  viewMode?: "card" | "list" | "compact";
  /** 是否启用（默认 true） */
  enabled?: boolean;
}

// ============================================================================
// Hook 返回类型
// ============================================================================

export interface UseHomeBookmarksReturn {
  /** 书签列表（只读） */
  readonly bookmarks: ReadonlyBookmarks;
  /** 是否正在加载 */
  readonly isLoading: boolean;
  /** 是否正在验证（后台刷新） */
  readonly isValidating: boolean;
  /** 错误信息 */
  readonly error: Error | null;
  /** 是否有更多数据 */
  readonly hasMore: boolean;
  /** 是否数据过期 */
  readonly isStale: boolean;

  // ===== 数据操作 =====
  /** 加载更多 */
  loadMore: () => Promise<void>;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 手动更新书签列表（乐观更新） */
  mutate: (
    updater:
      | BookmarkWithFolder[]
      | ((prev: BookmarkWithFolder[]) => BookmarkWithFolder[]),
  ) => void;
  /** 设置是否有更多数据 */
  setHasMore: (hasMore: boolean) => void;

  // ===== 单条操作（乐观更新） =====
  /** 更新单条书签 */
  updateBookmark: (
    id: number,
    updater: (bookmark: BookmarkWithFolder) => BookmarkWithFolder,
  ) => void;
  /** 删除单条书签（从列表移除） */
  removeBookmark: (id: number) => void;
  /** 添加新书签到列表头部 */
  addBookmark: (bookmark: BookmarkWithFolder) => void;

  // ===== 分类追踪 =====
  /** 追踪新书签的分类状态（用于新建后轮询） */
  trackBookmarkClassification: (bookmarkId: number) => void;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useHomeBookmarks(
  options: UseHomeBookmarksOptions,
): UseHomeBookmarksReturn {
  const {
    platform,
    sort,
    folder,
    usageTags,
    initialBookmarks,
    viewMode = "card",
    enabled = true,
  } = options;

  // ========== 动态 pageSize ==========
  const pageSize = getPageSizeByView(viewMode);

  // ========== 聚合数据获取（性能优化） ==========
  // 当没有 SSR 初始数据且无筛选条件时，使用聚合 API
  const shouldUseInitData =
    !initialBookmarks?.length && !platform && !folder && usageTags.length === 0;

  const { bookmarks: initBookmarks, isLoading: isInitDataLoading } =
    useInitData({
      enabled: shouldUseInitData && enabled,
    });

  // ========== 确定有效初始数据 ==========
  const effectiveInitialData = initialBookmarks?.length
    ? [...initialBookmarks] // 转换为可变数组
    : initBookmarks.length
      ? initBookmarks
      : undefined;

  // ========== SWR 数据缓存 ==========
  const {
    data: bookmarks,
    hasMore,
    isLoading: isSWRLoading,
    isValidating,
    isStale,
    error: swrError,
    mutate: mutateBookmarks,
    setHasMore,
    refetch,
    loadMore: swrLoadMore,
    updateCacheItem,
    removeCacheItem,
    appendToCache: _appendToCache,
  } = useBookmarksSWR({
    platform,
    sort,
    folder,
    usageTags: [...usageTags], // 转换为可变数组
    pageSize,
    initialData: effectiveInitialData,
    enabled: enabled && (!shouldUseInitData || !isInitDataLoading),
  });

  // ========== 性能追踪 ==========
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

  // ========== 处理中书签轮询 ==========
  useProcessingPoller({
    bookmarks,
    onUpdate: useCallback(
      (updatedBookmark: BookmarkWithFolder) => {
        mutateBookmarks((prev) =>
          prev.map((b) => (b.id === updatedBookmark.id ? updatedBookmark : b)),
        );
      },
      [mutateBookmarks],
    ),
    enabled: enabled && !isSWRLoading,
  });

  // ========== 分类轮询 ==========
  const { trackBookmark } = useClassificationPolling();

  // ========== 组合加载状态 ==========
  const isLoading =
    (shouldUseInitData && isInitDataLoading) ||
    (!shouldUseInitData && isSWRLoading);

  // ========== 封装操作方法 ==========

  const loadMore = useCallback(async () => {
    await swrLoadMore();
  }, [swrLoadMore]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const updateBookmark = useCallback(
    (
      id: number,
      updater: (bookmark: BookmarkWithFolder) => BookmarkWithFolder,
    ) => {
      updateCacheItem(id, updater);
    },
    [updateCacheItem],
  );

  const removeBookmark = useCallback(
    (id: number) => {
      removeCacheItem(id);
    },
    [removeCacheItem],
  );

  const addBookmark = useCallback(
    (bookmark: BookmarkWithFolder) => {
      mutateBookmarks((prev) => [bookmark, ...prev]);
    },
    [mutateBookmarks],
  );

  const trackBookmarkClassification = useCallback(
    (bookmarkId: number) => {
      trackBookmark(bookmarkId);
    },
    [trackBookmark],
  );

  // ========== 返回 ==========
  return {
    bookmarks,
    isLoading,
    isValidating,
    error: swrError ?? null,
    hasMore,
    isStale,
    loadMore,
    refresh,
    mutate: mutateBookmarks,
    setHasMore,
    updateBookmark,
    removeBookmark,
    addBookmark,
    trackBookmarkClassification,
  };
}
