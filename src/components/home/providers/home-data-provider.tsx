/**
 * Phase 3: 首页数据层 Provider
 *
 * 职责：
 * - 封装数据获取逻辑（SWR）
 * - 提供统一的数据操作接口
 * - 管理数据缓存状态
 *
 * @version 3.0.0
 * @since 2026-02-05
 */

"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Bookmark, CustomUsageTag } from "@/types/supabase";
import { useBookmarksSWR, cachePerformanceTracker } from "@/lib/cache";
import { useInitData } from "@/hooks/data";
import { useAbortableFetch } from "@/hooks/core";
import { clientLogger } from "@/lib/client-logger";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import { useProcessingPoller } from "@/hooks/ui";
import { customTagKeys } from "@/hooks/queries/keys";
import { getPageSizeByView } from "../constants";
import type { ViewMode } from "../types";

// 扩展的书签类型（包含文件夹信息）
type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

// ============================================================================
// 类型定义
// ============================================================================

export interface HomeDataContextValue {
  // 数据状态
  bookmarks: BookmarkWithFolder[];
  isLoading: boolean;
  isValidating: boolean;
  isStale: boolean;
  error?: string;
  hasMore: boolean;

  // 数据操作
  setBookmarks: (
    dataOrUpdater:
      | BookmarkWithFolder[]
      | ((prev: BookmarkWithFolder[]) => BookmarkWithFolder[]),
  ) => void;
  mutate: (
    dataOrUpdater:
      | BookmarkWithFolder[]
      | ((prev: BookmarkWithFolder[]) => BookmarkWithFolder[])
      | undefined,
  ) => void;
  refetch: () => Promise<void>;
  loadMore: (viewMode: ViewMode) => Promise<void>;
  updateCacheItem: (
    id: number,
    updater: (bookmark: BookmarkWithFolder) => BookmarkWithFolder,
  ) => void;
  removeCacheItem: (id: number) => void;
  appendToCache: (items: BookmarkWithFolder[], hasMore: boolean) => void;
  setHasMore: (hasMore: boolean) => void;

  // 加载状态
  isLoadingMore: boolean;
  setIsLoadingMore: (loading: boolean) => void;
}

const HomeDataContext = createContext<HomeDataContextValue | null>(null);

// ============================================================================
// Provider Props
// ============================================================================

export interface HomeDataProviderProps {
  children: ReactNode;
  // 初始数据（来自 SSR）
  initialBookmarks?: BookmarkWithFolder[];
  // 筛选参数
  platform: string;
  folder: string;
  usageTags: string[];
  sort: string;
  // 是否启用聚合 API
  enableAggregatedApi?: boolean;
}

// ============================================================================
// Provider 实现
// ============================================================================

export function HomeDataProvider({
  children,
  initialBookmarks = [],
  platform,
  folder,
  usageTags,
  sort,
  enableAggregatedApi = true,
}: HomeDataProviderProps) {
  const queryClient = useQueryClient();
  const { fetchWithAbort } = useAbortableFetch();

  // ========== 聚合数据获取（性能优化） ==========
  // 当没有 SSR 初始数据时，使用聚合 API 一次获取所有数据
  const shouldUseInitData =
    enableAggregatedApi &&
    !initialBookmarks?.length &&
    !platform &&
    !folder &&
    !usageTags.length;

  // 在子组件挂载前同步写入占位缓存，阻止 useCustomUsageTags 发起独立的网络请求。
  // React 先渲染父组件体再渲染子组件，因此此处赋值必定早于子组件首次 useQuery 执行。
  // init 数据到达后会通过下方 useEffect 覆盖为真实值。
  const hasSeededTagCacheRef = useRef(false);
  if (shouldUseInitData && !hasSeededTagCacheRef.current) {
    const existing = queryClient.getQueryData(customTagKeys.list());
    if (existing === undefined) {
      queryClient.setQueryData<CustomUsageTag[]>(customTagKeys.list(), []);
      hasSeededTagCacheRef.current = true;
    }
  }

  const {
    bookmarks: initBookmarks,
    customUsageTags: initCustomUsageTags,
    isLoading: isInitDataLoading,
  } = useInitData({
    enabled: shouldUseInitData,
  });

  // init 数据就绪后，用真实 customUsageTags 覆盖占位缓存
  useEffect(() => {
    if (!shouldUseInitData || isInitDataLoading) return;
    queryClient.setQueryData<CustomUsageTag[]>(
      customTagKeys.list(),
      initCustomUsageTags,
    );
  }, [shouldUseInitData, isInitDataLoading, initCustomUsageTags, queryClient]);

  // 优先使用聚合 API 数据作为初始值
  const effectiveInitialData = initialBookmarks?.length
    ? initialBookmarks
    : initBookmarks.length
      ? initBookmarks
      : undefined;

  // ========== SWR 数据缓存（核心） ==========
  const {
    data: bookmarks,
    hasMore,
    isLoading,
    isValidating,
    isStale,
    error: swrError,
    mutate,
    setHasMore,
    refetch,
    loadMore: _loadMore,
    updateCacheItem,
    removeCacheItem,
    appendToCache,
  } = useBookmarksSWR({
    platform,
    sort,
    folder,
    usageTags,
    initialData: effectiveInitialData,
    enabled: !shouldUseInitData || !isInitDataLoading,
  });

  // ========== 本地状态 ==========
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ========== V5.0.1: 性能追踪 ==========
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

  // ========== 监听新建收藏事件（乐观更新） ==========
  useEffect(() => {
    const unsubscribe = uiEventBus.on(UIEvents.BOOKMARK_CREATED, (payload) => {
      const newBookmark = payload.bookmark as Bookmark & {
        folders?: { name: string } | null;
      };

      const shouldInsert =
        !platform ||
        platform === newBookmark.platform ||
        (platform === "browser" &&
          newBookmark.platform?.startsWith("BROWSER_"));

      if (shouldInsert && !folder) {
        mutate((prev = []) => [newBookmark, ...prev]);
      }
    });

    return unsubscribe;
  }, [platform, folder, mutate]);

  // ========== 智能轮询：自动更新 PROCESSING 状态的书签 ==========
  // V4.2.32: 使用 updateCacheItem 替代 mutate，避免整列表引用变化
  // updateCacheItem 内部已做 immutable 更新，仅更新单条记录
  const handleProcessingUpdate = useCallback(
    (updatedBookmark: Bookmark) => {
      updateCacheItem(
        updatedBookmark.id,
        () => updatedBookmark as BookmarkWithFolder,
      );
    },
    [updateCacheItem],
  );

  useProcessingPoller({
    bookmarks,
    onUpdate: handleProcessingUpdate,
    enabled: !isLoading,
  });

  // ========== 加载更多 ==========
  const loadMore = useCallback(
    async (viewMode: ViewMode) => {
      if (isLoadingMore || !hasMore) return;

      setIsLoadingMore(true);
      try {
        const lastBookmark = bookmarks[bookmarks.length - 1];
        const params = new URLSearchParams({
          cursor: lastBookmark.id.toString(),
          limit: getPageSizeByView(viewMode).toString(),
        });

        if (platform) {
          params.append("platform", platform);
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
        clientLogger.error({ error }, "Load more failed");
      } finally {
        setIsLoadingMore(false);
      }
    },
    [
      isLoadingMore,
      hasMore,
      bookmarks,
      platform,
      fetchWithAbort,
      appendToCache,
    ],
  );

  // ========== Context Value ==========
  // 创建包装函数确保类型正确
  const setBookmarks = useCallback(
    (
      dataOrUpdater:
        | BookmarkWithFolder[]
        | ((prev: BookmarkWithFolder[]) => BookmarkWithFolder[]),
    ) => {
      mutate(dataOrUpdater);
    },
    [mutate],
  );

  // 创建 mutate 的包装函数，确保参数非空
  const mutateWrapper = useCallback(
    (
      dataOrUpdater?:
        | BookmarkWithFolder[]
        | ((prev: BookmarkWithFolder[]) => BookmarkWithFolder[]),
    ) => {
      if (dataOrUpdater === undefined) {
        // 如果没有提供参数，调用 refetch
        return refetch();
      }
      mutate(dataOrUpdater);
    },
    [mutate, refetch],
  );

  const value: HomeDataContextValue = {
    bookmarks: bookmarks || [],
    isLoading,
    isValidating,
    isStale,
    error: swrError?.message,
    hasMore,
    setBookmarks,
    mutate: mutateWrapper,
    refetch,
    loadMore,
    updateCacheItem,
    removeCacheItem,
    appendToCache,
    setHasMore,
    isLoadingMore,
    setIsLoadingMore,
  };

  return (
    <HomeDataContext.Provider value={value}>
      {children}
    </HomeDataContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * 获取首页数据 Context
 */
export function useHomeData(): HomeDataContextValue {
  const context = useContext(HomeDataContext);
  if (!context) {
    throw new Error("useHomeData must be used within HomeDataProvider");
  }
  return context;
}

/**
 * 安全版本：获取首页数据 Context，如果不在 Provider 内则返回 null
 */
export function useHomeDataSafe(): HomeDataContextValue | null {
  return useContext(HomeDataContext);
}
