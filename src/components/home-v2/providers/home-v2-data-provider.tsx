/**
 * Home V2 数据层 Provider
 *
 * 设计原则：
 * - Context value 只包含数据和少量操作（解决 A12：useMemo 依赖 ≤ 5）
 * - 纯 TanStack Query，不引入 SWR（解决 A17）
 * - 不做数据源优先级判断（解决 A18）
 * - 通过 queryClient 操作缓存（解决 A2：不传递 getBookmarks 回调）
 *
 * @since home-v2
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { bookmarkKeys } from "@/hooks/queries/keys";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import {
  useHomeBookmarks,
  getPageSizeForViewMode,
} from "../hooks/use-home-bookmarks";
import type { BookmarkWithFolder } from "@/components/home/types";

// ============================================================================
// Context 类型定义（精简版）
// ============================================================================

interface HomeV2DataContextValue {
  /** 扁平化的书签列表 */
  bookmarks: BookmarkWithFolder[];
  /** 是否正在加载首页 */
  isLoading: boolean;
  /** 是否有更多数据 */
  hasMore: boolean;
  /** 加载下一页 */
  fetchNextPage: () => void;
  /** 是否正在加载下一页 */
  isFetchingNextPage: boolean;
  /** 重新获取数据 */
  refetch: () => void;
}

const HomeV2DataContext = createContext<HomeV2DataContextValue | null>(null);

// ============================================================================
// Provider 实现
// ============================================================================

export interface HomeV2DataProviderProps {
  children: ReactNode;
  /** SSR 预加载的初始书签 */
  initialBookmarks?: BookmarkWithFolder[];
  /** URL 参数 */
  platform: string;
  sort: string;
  folder: string;
  usageTags?: string[];
  /** 视图模式（用于确定分页大小） */
  viewMode?: string;
}

export function HomeV2DataProvider({
  children,
  initialBookmarks,
  platform,
  sort,
  folder,
  usageTags,
  viewMode = "card",
}: HomeV2DataProviderProps) {
  const pageSize = getPageSizeForViewMode(viewMode);
  const queryClient = useQueryClient();

  const {
    bookmarks,
    isLoading,
    hasMore,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useHomeBookmarks({
    platform,
    sort,
    folder,
    usageTags,
    pageSize,
    initialBookmarks,
  });

  // 监听 BOOKMARK_CREATED 事件 — 乐观插入新书签到列表顶部
  useEffect(() => {
    const unsubscribe = uiEventBus.on(
      UIEvents.BOOKMARK_CREATED,
      (payload: { bookmark?: BookmarkWithFolder }) => {
        const newBookmark = payload?.bookmark;
        if (!newBookmark) return;

        // 检查筛选条件：新书签是否应插入当前列表
        const shouldInsert =
          !platform ||
          platform === newBookmark.platform ||
          (platform === "browser" &&
            typeof newBookmark.platform === "string" &&
            newBookmark.platform.startsWith("BROWSER_"));

        // 仅在未筛选文件夹时插入（有文件夹筛选时需 refetch 确认归属）
        if (shouldInsert && !folder) {
          queryClient.setQueriesData(
            { queryKey: bookmarkKeys.lists() },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (oldData: any) => {
              if (!oldData?.pages?.[0]) return oldData;
              const firstPage = oldData.pages[0];
              return {
                ...oldData,
                pages: [
                  {
                    ...firstPage,
                    bookmarks: [
                      newBookmark,
                      ...(firstPage.bookmarks || firstPage.items || []),
                    ],
                  },
                  ...oldData.pages.slice(1),
                ],
              };
            },
          );
        }
      },
    );

    return unsubscribe;
  }, [platform, folder, queryClient]);

  // A12 修复：useMemo 依赖项 ≤ 7（全部是稳定引用或原始值）
  const value = useMemo<HomeV2DataContextValue>(
    () => ({
      bookmarks,
      isLoading,
      hasMore,
      fetchNextPage,
      isFetchingNextPage,
      refetch,
    }),
    [bookmarks, isLoading, hasMore, fetchNextPage, isFetchingNextPage, refetch],
  );

  return (
    <HomeV2DataContext.Provider value={value}>
      {children}
    </HomeV2DataContext.Provider>
  );
}

// ============================================================================
// Consumer Hook
// ============================================================================

/**
 * 读取 home-v2 书签数据
 *
 * @throws 在 HomeV2DataProvider 外部调用时抛出错误
 */
export function useHomeV2Data(): HomeV2DataContextValue {
  const ctx = useContext(HomeV2DataContext);
  if (!ctx) {
    throw new Error("useHomeV2Data must be used within HomeV2DataProvider");
  }
  return ctx;
}

// ============================================================================
// 缓存操作辅助函数
// ============================================================================

/**
 * 创建缓存操作函数（在组件中使用 queryClient 操作书签缓存）
 *
 * 设计原则：
 * - 不通过 Context 传递（解决 A2：避免不稳定回调引用）
 * - 直接使用 queryClient 操作（解决 A12：减少 Context value 复杂度）
 */
export function useHomeV2CacheOps() {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      /**
       * 从缓存中移除指定 ID 的书签（乐观删除）
       */
      removeCacheItem: (id: number) => {
        queryClient.setQueriesData(
          { queryKey: bookmarkKeys.lists() },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (oldData: any) => {
            if (!oldData?.pages) return oldData;
            return {
              ...oldData,
              pages: oldData.pages.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (page: any) => ({
                  ...page,
                  bookmarks: (page.bookmarks || page.items || []).filter(
                    (b: { id: number }) => b.id !== id,
                  ),
                }),
              ),
            };
          },
        );
      },

      /**
       * 更新缓存中指定 ID 的书签
       */
      updateCacheItem: (
        id: number,
        updater: (bookmark: BookmarkWithFolder) => BookmarkWithFolder,
      ) => {
        queryClient.setQueriesData(
          { queryKey: bookmarkKeys.lists() },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (oldData: any) => {
            if (!oldData?.pages) return oldData;
            return {
              ...oldData,
              pages: oldData.pages.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (page: any) => ({
                  ...page,
                  bookmarks: (page.bookmarks || page.items || []).map(
                    (b: BookmarkWithFolder) => (b.id === id ? updater(b) : b),
                  ),
                }),
              ),
            };
          },
        );
      },

      /**
       * 使所有书签列表查询失效（强制重新获取）
       */
      invalidateAll: () => {
        queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      },
    }),
    [queryClient],
  );
}
