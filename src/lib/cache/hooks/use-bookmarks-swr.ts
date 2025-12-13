"use client";

/**
 * 书签数据 SWR Hook
 * 增强版缓存实现，支持 stale-while-revalidate 策略
 *
 * 特点：
 * - 首次访问：显示 loading，等待数据
 * - 再次访问：立即返回缓存，后台刷新
 * - 平台切换：立即返回缓存（如有），后台刷新
 *
 * V5.0: 本地持久化支持
 * - 应用启动时从 localStorage 同步读取缓存
 * - 有缓存时不显示 loading，立即显示数据
 * - 后台静默刷新，用户无感知
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { dataCache } from "../data-cache";
import { DATA_CACHE_CONFIG } from "../cache-config";
import type { Bookmark } from "@/types/supabase";

// 扩展的书签类型（包含文件夹信息）
type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

// 浏览器平台列表（保留用于未来扩展）
const _BROWSER_PLATFORMS = ["CHROME", "EDGE", "FIREFOX", "SAFARI"];

/**
 * 生成缓存键
 */
function generateCacheKey(params: {
  platform: string;
  sort: string;
  folder: string;
  usageTags?: string[];
}): string {
  const tagsKey = params.usageTags?.length
    ? `:tags:${params.usageTags.sort().join(",")}`
    : "";
  return `bookmarks:${params.platform || "all"}:${params.sort || "created_desc"}:${params.folder || ""}${tagsKey}`;
}

/**
 * Hook 参数
 */
interface UseBookmarksSWROptions {
  platform: string;
  sort: string;
  folder: string;
  /** V9.0新增：用途标签筛选 */
  usageTags?: string[];
  enabled?: boolean;
  initialData?: BookmarkWithFolder[];
}

/**
 * V5.0 增强：快照类型，用于乐观更新的回滚
 */
interface CacheSnapshot {
  data: BookmarkWithFolder[];
  hasMore: boolean;
  timestamp: number;
}

/**
 * Hook 返回值
 */
interface UseBookmarksSWRResult {
  // 数据
  data: BookmarkWithFolder[];
  hasMore: boolean;

  // 状态
  isLoading: boolean; // 首次加载中（无缓存）
  isValidating: boolean; // 后台刷新中（有缓存）
  isStale: boolean; // 数据是否过期
  error: Error | undefined;

  // 操作
  mutate: (
    dataOrUpdater:
      | BookmarkWithFolder[]
      | ((data: BookmarkWithFolder[]) => BookmarkWithFolder[]),
  ) => void;
  setHasMore: (hasMore: boolean) => void;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;

  // 缓存操作（兼容现有接口）
  updateCacheItem: (
    bookmarkId: number,
    updater: (bookmark: BookmarkWithFolder) => BookmarkWithFolder,
  ) => void;
  removeCacheItem: (bookmarkId: number) => void;
  appendToCache: (newData: BookmarkWithFolder[], newHasMore: boolean) => void;

  // V5.0 增强：乐观更新支持
  createSnapshot: () => CacheSnapshot;
  rollback: (snapshot: CacheSnapshot) => void;
}

/**
 * 书签数据 SWR Hook
 */
export function useBookmarksSWR(
  options: UseBookmarksSWROptions,
): UseBookmarksSWRResult {
  const {
    platform,
    sort,
    folder,
    usageTags = [],
    enabled = true,
    initialData,
  } = options;

  // 缓存键（包含用途标签）
  const cacheKey = generateCacheKey({ platform, sort, folder, usageTags });

  /**
   * V5.0: 使用 useState 初始化函数同步读取缓存
   * 这确保在首次渲染时就能显示缓存数据，无需等待 useEffect
   */
  const [data, setData] = useState<BookmarkWithFolder[]>(() => {
    // 优先使用 initialData
    if (initialData && initialData.length > 0) {
      return initialData;
    }
    // 同步读取缓存（包括从 localStorage 恢复的数据）
    const cached = dataCache.getSync<{
      bookmarks: BookmarkWithFolder[];
      hasMore: boolean;
    }>(cacheKey);
    return cached.data?.bookmarks || [];
  });

  const [hasMore, setHasMore] = useState(() => {
    if (initialData && initialData.length > 0) {
      return initialData.length === 50;
    }
    const cached = dataCache.getSync<{
      bookmarks: BookmarkWithFolder[];
      hasMore: boolean;
    }>(cacheKey);
    return cached.data?.hasMore || false;
  });

  /**
   * V5.0: 只有在没有缓存数据时才显示 loading
   * 有缓存时立即显示数据，后台静默刷新
   */
  const [isLoading, setIsLoading] = useState(() => {
    if (!enabled) return false;
    if (initialData && initialData.length > 0) return false;
    // 检查是否有缓存（包括持久化缓存）
    return !dataCache.hasSync(cacheKey);
  });

  const [isValidating, setIsValidating] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  // 上一次的缓存键
  const prevCacheKeyRef = useRef(cacheKey);

  // 请求控制器
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 从 API 获取数据
   */
  const fetchFromAPI = useCallback(
    async (
      signal?: AbortSignal,
    ): Promise<{
      bookmarks: BookmarkWithFolder[];
      hasMore: boolean;
    }> => {
      const apiParams = new URLSearchParams();

      if (platform === "browser") {
        apiParams.set("platform", "browser");
      } else if (platform) {
        apiParams.set("platform", platform);
      } else {
        // "全部" 时排除浏览器平台
        apiParams.set("excludeBrowser", "true");
      }

      apiParams.set("sort", sort || "created_desc");
      apiParams.set("limit", "50");

      if (folder) {
        // 区分虚拟文件夹和真实文件夹 ID
        const virtualFolders = ["trash", "invalid", "high-value"];
        if (virtualFolders.includes(folder)) {
          apiParams.set("folder", folder);
        } else {
          // 数字 ID 使用 folderId 参数
          apiParams.set("folderId", folder);
        }
      }

      // V9.0新增：用途标签筛选
      if (usageTags.length > 0) {
        apiParams.set("usageTags", usageTags.join(","));
      }

      const res = await fetch(`/api/bookmarks?${apiParams.toString()}`, {
        credentials: "include",
        signal,
      });

      if (!res.ok) {
        throw new Error("加载失败");
      }

      const result = await res.json();
      return {
        bookmarks: result.data.bookmarks as BookmarkWithFolder[],
        hasMore: result.data.pagination.hasMore as boolean,
      };
    },
    [platform, sort, folder, usageTags],
  );

  /**
   * 核心数据获取逻辑（SWR 模式）
   */
  const fetchData = useCallback(async () => {
    if (!enabled) return;

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 检查缓存
    const cached = dataCache.getSync<{
      bookmarks: BookmarkWithFolder[];
      hasMore: boolean;
    }>(cacheKey);

    const now = Date.now();
    const staleTime = DATA_CACHE_CONFIG.staleTime;
    const cacheTime = DATA_CACHE_CONFIG.cacheTime;

    // 情况 1：有新鲜缓存，直接使用，不发请求
    if (cached.data && cached.timestamp && now - cached.timestamp < staleTime) {
      setData(cached.data.bookmarks);
      setHasMore(cached.data.hasMore);
      setIsLoading(false);
      setIsValidating(false);
      setIsStale(false);
      return;
    }

    // 情况 2：有过期但未失效的缓存，先显示缓存，后台刷新
    if (cached.data && cached.timestamp && now - cached.timestamp < cacheTime) {
      setData(cached.data.bookmarks);
      setHasMore(cached.data.hasMore);
      setIsLoading(false);
      setIsValidating(true);
      setIsStale(true);

      // 后台刷新
      try {
        const result = await fetchFromAPI(controller.signal);

        // 检查是否被取消
        if (controller.signal.aborted) return;

        // 更新缓存和状态
        dataCache.get({
          cacheKey,
          fetcher: async () => result,
        });

        setData(result.bookmarks);
        setHasMore(result.hasMore);
        setIsValidating(false);
        setIsStale(false);
        setError(undefined);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        // 后台刷新失败不影响已显示的缓存数据
        setIsValidating(false);
      }
      return;
    }

    // 情况 3：无缓存或缓存完全过期，显示 loading，等待请求
    setIsLoading(true);
    setIsValidating(true);

    try {
      const result = await fetchFromAPI(controller.signal);

      // 检查是否被取消
      if (controller.signal.aborted) return;

      // 更新缓存
      await dataCache.get({
        cacheKey,
        fetcher: async () => result,
      });

      setData(result.bookmarks);
      setHasMore(result.hasMore);
      setIsLoading(false);
      setIsValidating(false);
      setIsStale(false);
      setError(undefined);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;

      setError(err as Error);
      setIsLoading(false);
      setIsValidating(false);
    }
  }, [cacheKey, enabled, fetchFromAPI]);

  /**
   * 参数变化时重新获取数据
   */
  useEffect(() => {
    // 如果缓存键变化，检查是否有该键的缓存
    if (prevCacheKeyRef.current !== cacheKey) {
      const cached = dataCache.getSync<{
        bookmarks: BookmarkWithFolder[];
        hasMore: boolean;
      }>(cacheKey);

      // 如果有缓存，立即显示（提供即时反馈）
      if (cached.data) {
        setData(cached.data.bookmarks);
        setHasMore(cached.data.hasMore);
        setIsStale(cached.isStale);
      } else {
        // 无缓存时清空数据
        setData([]);
        setHasMore(false);
      }

      prevCacheKeyRef.current = cacheKey;
    }

    fetchData();

    // 清理函数
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cacheKey, fetchData]);

  /**
   * 初始数据同步
   */
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setData(initialData);
      setHasMore(initialData.length === 50);
      setIsLoading(false);

      // 缓存初始数据
      dataCache.get({
        cacheKey,
        fetcher: async () => ({
          bookmarks: initialData,
          hasMore: initialData.length === 50,
        }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅首次挂载时执行

  /**
   * V5.0 增强：同步更新到持久化缓存
   * 确保乐观更新后数据持久化到 localStorage
   */
  const syncToCache = useCallback(
    (bookmarks: BookmarkWithFolder[], currentHasMore: boolean) => {
      dataCache.setCache(cacheKey, {
        bookmarks,
        hasMore: currentHasMore,
      });
    },
    [cacheKey],
  );

  /**
   * 乐观更新（支持数组或函数两种形式）
   * V5.0 增强：同步更新到内存缓存和 localStorage
   */
  const mutate = useCallback(
    (
      dataOrUpdater:
        | BookmarkWithFolder[]
        | ((data: BookmarkWithFolder[]) => BookmarkWithFolder[]),
    ) => {
      let newData: BookmarkWithFolder[];
      if (typeof dataOrUpdater === "function") {
        setData((prev) => {
          newData = dataOrUpdater(prev);
          // 同步到持久化缓存
          syncToCache(newData, hasMore);
          return newData;
        });
      } else {
        newData = dataOrUpdater;
        setData(newData);
        // 同步到持久化缓存
        syncToCache(newData, hasMore);
      }
    },
    [hasMore, syncToCache],
  );

  /**
   * 直接设置 hasMore 状态
   */
  const setHasMoreState = useCallback((newHasMore: boolean) => {
    setHasMore(newHasMore);
  }, []);

  /**
   * 强制刷新
   */
  const refetch = useCallback(async () => {
    dataCache.invalidate(cacheKey);
    await fetchData();
  }, [cacheKey, fetchData]);

  /**
   * 加载更多
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || isValidating) return;

    const lastBookmark = data[data.length - 1];
    if (!lastBookmark) return;

    setIsValidating(true);

    try {
      const apiParams = new URLSearchParams({
        cursor: lastBookmark.id.toString(),
        limit: "50",
      });

      if (platform === "browser") {
        apiParams.set("platform", "browser");
      } else if (platform) {
        apiParams.set("platform", platform);
      } else {
        apiParams.set("excludeBrowser", "true");
      }

      apiParams.set("sort", sort || "created_desc");

      if (folder) {
        // 区分虚拟文件夹和真实文件夹 ID
        const virtualFolders = ["trash", "invalid", "high-value"];
        if (virtualFolders.includes(folder)) {
          apiParams.set("folder", folder);
        } else {
          apiParams.set("folderId", folder);
        }
      }

      // V9.0新增：用途标签筛选
      if (usageTags.length > 0) {
        apiParams.set("usageTags", usageTags.join(","));
      }

      const res = await fetch(`/api/bookmarks?${apiParams.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("加载失败");
      }

      const result = await res.json();
      const newBookmarks = result.data.bookmarks as BookmarkWithFolder[];
      const newHasMore = result.data.pagination.hasMore as boolean;

      // 合并数据
      const mergedData = [...data, ...newBookmarks];
      setData(mergedData);
      setHasMore(newHasMore);

      // 更新缓存
      await dataCache.get({
        cacheKey,
        fetcher: async () => ({
          bookmarks: mergedData,
          hasMore: newHasMore,
        }),
      });
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsValidating(false);
    }
  }, [
    cacheKey,
    data,
    hasMore,
    isLoading,
    isValidating,
    platform,
    sort,
    folder,
    usageTags,
  ]);

  /**
   * 更新缓存中的单条数据（兼容现有接口）
   * V5.0 增强：同步更新到持久化缓存
   */
  const updateCacheItem = useCallback(
    (
      bookmarkId: number,
      updater: (bookmark: BookmarkWithFolder) => BookmarkWithFolder,
    ) => {
      setData((prev) => {
        const newData = prev.map((b) => (b.id === bookmarkId ? updater(b) : b));
        // 同步到持久化缓存
        syncToCache(newData, hasMore);
        return newData;
      });
    },
    [hasMore, syncToCache],
  );

  /**
   * 从缓存中移除单条数据（兼容现有接口）
   * V5.0 增强：同步更新到持久化缓存
   */
  const removeCacheItem = useCallback(
    (bookmarkId: number) => {
      setData((prev) => {
        const newData = prev.filter((b) => b.id !== bookmarkId);
        // 同步到持久化缓存
        syncToCache(newData, hasMore);
        return newData;
      });
    },
    [hasMore, syncToCache],
  );

  /**
   * 追加数据到缓存（兼容现有接口）
   * V5.0 增强：同步更新到持久化缓存
   */
  const appendToCache = useCallback(
    (newData: BookmarkWithFolder[], newHasMore: boolean) => {
      setData((prev) => {
        const mergedData = [...prev, ...newData];
        // 同步到持久化缓存
        syncToCache(mergedData, newHasMore);
        return mergedData;
      });
      setHasMore(newHasMore);
    },
    [syncToCache],
  );

  /**
   * V5.0 增强：创建快照
   * 在执行乐观更新前调用，用于失败时回滚
   *
   * 使用示例：
   * const snapshot = createSnapshot();
   * removeCacheItem(bookmarkId);
   * try {
   *   await deleteBookmarkAPI(bookmarkId);
   * } catch (error) {
   *   rollback(snapshot);
   *   throw error;
   * }
   */
  const createSnapshot = useCallback((): CacheSnapshot => {
    return {
      data: [...data], // 浅拷贝数组
      hasMore,
      timestamp: Date.now(),
    };
  }, [data, hasMore]);

  /**
   * V5.0 增强：从快照回滚
   * API 请求失败时恢复到之前的状态
   */
  const rollback = useCallback(
    (snapshot: CacheSnapshot) => {
      setData(snapshot.data);
      setHasMore(snapshot.hasMore);
      // 同步回滚到持久化缓存
      syncToCache(snapshot.data, snapshot.hasMore);
      // eslint-disable-next-line no-console -- 回滚操作需要日志记录
      console.log(
        `[useBookmarksSWR] Rolled back to snapshot from ${new Date(snapshot.timestamp).toISOString()}`,
      );
    },
    [syncToCache],
  );

  return {
    data,
    hasMore,
    isLoading,
    isValidating,
    isStale,
    error,
    mutate,
    setHasMore: setHasMoreState,
    refetch,
    loadMore,
    updateCacheItem,
    removeCacheItem,
    appendToCache,
    createSnapshot,
    rollback,
  };
}

// 导出快照类型供外部使用
export type { CacheSnapshot };
