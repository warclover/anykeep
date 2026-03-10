/**
 * MD 收藏数据 SWR Hook
 * 实现 stale-while-revalidate 缓存策略
 *
 * 特点：
 * - 首次访问：显示 loading，等待数据
 * - 再次访问：立即返回缓存，后台刷新
 * - 支持 SSR initialData，避免重复请求
 * - 乐观更新支持
 *
 * V1.1.0: 修复 useEffect 依赖项问题，防止内存泄漏
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { dataCache } from "@/lib/cache/data-cache";
import { DATA_CACHE_CONFIG } from "@/lib/cache/cache-config";
import { API_MD_COLLECTIONS } from "@/lib/constants/api-paths";
import type { MdCollection, MdCollectionListParams } from "../types";

const DEFAULT_LIMIT = 20;

/**
 * 生成缓存键
 * V1.1.0: 添加 isRead 和 isStarred 参数，确保缓存键唯一性
 */
function generateCacheKey(params: {
  folderId?: number;
  contentType?: string;
  keyword?: string;
  sort?: string;
  isRead?: boolean;
  isStarred?: boolean;
}): string {
  const parts = ["md-collections"];
  if (params.folderId) parts.push(`folder:${params.folderId}`);
  if (params.contentType) parts.push(`type:${params.contentType}`);
  if (params.keyword) parts.push(`q:${params.keyword}`);
  if (params.isRead !== undefined) parts.push(`read:${params.isRead}`);
  if (params.isStarred !== undefined) parts.push(`star:${params.isStarred}`);
  parts.push(params.sort || "created_desc");
  return parts.join(":");
}

/**
 * Hook 参数
 */
interface UseMdCollectionsSWROptions extends MdCollectionListParams {
  /** 是否启用（Pro 用户才启用） */
  enabled?: boolean;
  /** SSR 预取的初始数据 */
  initialData?: MdCollection[];
  /** SSR 预取的分页状态 */
  initialHasMore?: boolean;
  /** 后台刷新失败时的回调 */
  onBackgroundError?: (error: Error) => void;
}

/**
 * 缓存快照（用于乐观更新回滚）
 */
interface CacheSnapshot {
  data: MdCollection[];
  hasMore: boolean;
  nextCursor: number | null;
  timestamp: number;
}

/**
 * Hook 返回值
 */
interface UseMdCollectionsSWRReturn {
  // 数据
  collections: MdCollection[];
  hasMore: boolean;
  nextCursor: number | null;

  // 状态
  isLoading: boolean;
  isValidating: boolean;
  isStale: boolean;
  error: string | null;

  // 操作
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;

  // 乐观更新
  updateLocal: (id: number, updates: Partial<MdCollection>) => void;
  removeLocal: (id: number) => void;
  addLocal: (collection: MdCollection) => void;

  // 快照支持
  createSnapshot: () => CacheSnapshot;
  rollback: (snapshot: CacheSnapshot) => void;
}

/**
 * MD 收藏数据 SWR Hook
 */
export function useMdCollectionsSWR(
  options: UseMdCollectionsSWROptions = {},
): UseMdCollectionsSWRReturn {
  const {
    enabled = true,
    limit = DEFAULT_LIMIT,
    folderId,
    contentType,
    keyword,
    sort = "created_desc",
    isRead,
    isStarred,
    initialData = [],
    initialHasMore,
    onBackgroundError,
  } = options;

  // 缓存键（V1.1.0: 添加 isRead 和 isStarred）
  const cacheKey = generateCacheKey({
    folderId,
    contentType,
    keyword,
    sort,
    isRead,
    isStarred,
  });

  /**
   * 使用 useState 初始化函数同步读取缓存
   * 确保首次渲染时就能显示缓存数据
   */
  const [collections, setCollections] = useState<MdCollection[]>(() => {
    // 优先使用 SSR initialData
    if (initialData.length > 0) {
      return initialData;
    }
    // 同步读取内存缓存
    const cached = dataCache.getSync<{
      items: MdCollection[];
      hasMore: boolean;
      nextCursor: number | null;
    }>(cacheKey);
    return cached.data?.items || [];
  });

  const [hasMore, setHasMore] = useState(() => {
    if (initialData.length > 0) {
      return initialHasMore ?? initialData.length === limit;
    }
    const cached = dataCache.getSync<{
      items: MdCollection[];
      hasMore: boolean;
      nextCursor: number | null;
    }>(cacheKey);
    return cached.data?.hasMore ?? true;
  });

  const [nextCursor, setNextCursor] = useState<number | null>(() => {
    if (initialData.length > 0) {
      return initialData[initialData.length - 1]?.id ?? null;
    }
    const cached = dataCache.getSync<{
      items: MdCollection[];
      hasMore: boolean;
      nextCursor: number | null;
    }>(cacheKey);
    return cached.data?.nextCursor ?? null;
  });

  const [isLoading, setIsLoading] = useState(() => {
    if (!enabled) return false;
    if (initialData.length > 0) return false;
    return !dataCache.hasSync(cacheKey);
  });

  const [isValidating, setIsValidating] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 上一次的缓存键
  const prevCacheKeyRef = useRef(cacheKey);
  // 请求控制器
  const abortControllerRef = useRef<AbortController | null>(null);
  // 是否使用了 initialData
  const hasInitialDataRef = useRef(initialData.length > 0);

  /**
   * 构建查询参数
   */
  const buildQueryParams = useCallback(
    (cursor?: number | null): URLSearchParams => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (cursor) params.set("cursor", String(cursor));
      if (folderId) params.set("folderId", String(folderId));
      if (contentType) params.set("contentType", contentType);
      if (keyword) params.set("keyword", keyword);
      if (sort) params.set("sort", sort);
      return params;
    },
    [limit, folderId, contentType, keyword, sort],
  );

  /**
   * 从 API 获取数据
   */
  const fetchFromAPI = useCallback(
    async (
      cursor?: number | null,
      signal?: AbortSignal,
    ): Promise<{
      items: MdCollection[];
      hasMore: boolean;
      nextCursor: number | null;
    }> => {
      const params = buildQueryParams(cursor);
      const response = await fetch(
        `${API_MD_COLLECTIONS.list}?${params.toString()}`,
        {
          credentials: "include",
          signal,
        },
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "加载失败");
      }

      return {
        items: result.data.items,
        hasMore: result.data.hasMore,
        nextCursor: result.data.nextCursor,
      };
    },
    [buildQueryParams],
  );

  /**
   * 同步数据到缓存
   */
  const syncToCache = useCallback(
    (
      items: MdCollection[],
      currentHasMore: boolean,
      currentNextCursor: number | null,
    ) => {
      dataCache.setCache(cacheKey, {
        items,
        hasMore: currentHasMore,
        nextCursor: currentNextCursor,
      });
    },
    [cacheKey],
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
      items: MdCollection[];
      hasMore: boolean;
      nextCursor: number | null;
    }>(cacheKey);

    const now = Date.now();
    const staleTime = DATA_CACHE_CONFIG.staleTime;
    const cacheTime = DATA_CACHE_CONFIG.cacheTime;

    // 情况 1：有新鲜缓存，直接使用
    if (cached.data && cached.timestamp && now - cached.timestamp < staleTime) {
      setCollections(cached.data.items);
      setHasMore(cached.data.hasMore);
      setNextCursor(cached.data.nextCursor);
      setIsLoading(false);
      setIsValidating(false);
      setIsStale(false);
      return;
    }

    // 情况 2：有过期但未失效的缓存，先显示缓存，后台刷新
    if (cached.data && cached.timestamp && now - cached.timestamp < cacheTime) {
      setCollections(cached.data.items);
      setHasMore(cached.data.hasMore);
      setNextCursor(cached.data.nextCursor);
      setIsLoading(false);
      setIsValidating(true);
      setIsStale(true);

      // 后台刷新
      try {
        const result = await fetchFromAPI(null, controller.signal);
        if (controller.signal.aborted) return;

        syncToCache(result.items, result.hasMore, result.nextCursor);
        setCollections(result.items);
        setHasMore(result.hasMore);
        setNextCursor(result.nextCursor);
        setIsValidating(false);
        setIsStale(false);
        setError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setIsValidating(false);
        // 通知后台刷新失败（静默失败但允许上层处理）
        const error = err instanceof Error ? err : new Error("后台刷新失败");
        onBackgroundError?.(error);
      }
      return;
    }

    // 情况 3：无缓存或缓存完全过期，显示 loading
    setIsLoading(true);
    setIsValidating(true);

    try {
      const result = await fetchFromAPI(null, controller.signal);
      if (controller.signal.aborted) return;

      syncToCache(result.items, result.hasMore, result.nextCursor);
      setCollections(result.items);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
      setIsLoading(false);
      setIsValidating(false);
      setIsStale(false);
      setError(null);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "加载失败");
      setIsLoading(false);
      setIsValidating(false);
    }
  }, [cacheKey, enabled, fetchFromAPI, syncToCache, onBackgroundError]);

  /**
   * 参数变化时重新获取数据
   */
  useEffect(() => {
    // 缓存键变化时，检查是否有缓存
    if (prevCacheKeyRef.current !== cacheKey) {
      const cached = dataCache.getSync<{
        items: MdCollection[];
        hasMore: boolean;
        nextCursor: number | null;
      }>(cacheKey);

      if (cached.data) {
        setCollections(cached.data.items);
        setHasMore(cached.data.hasMore);
        setNextCursor(cached.data.nextCursor);
        setIsStale(cached.isStale);
      } else {
        setCollections([]);
        setHasMore(true);
        setNextCursor(null);
      }

      prevCacheKeyRef.current = cacheKey;
    }

    // 如果有 SSR initialData，首次挂载时跳过 fetchData
    if (hasInitialDataRef.current && prevCacheKeyRef.current === cacheKey) {
      hasInitialDataRef.current = false;
      return;
    }

    fetchData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cacheKey, fetchData]);

  /**
   * 初始数据同步到缓存
   */
  useEffect(() => {
    if (initialData.length > 0) {
      const cursor = initialData[initialData.length - 1]?.id ?? null;
      syncToCache(
        initialData,
        initialHasMore ?? initialData.length === limit,
        cursor,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 加载更多
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || isValidating || !nextCursor) return;

    setIsValidating(true);

    try {
      const result = await fetchFromAPI(nextCursor);

      const mergedItems = [...collections, ...result.items];
      setCollections(mergedItems);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
      syncToCache(mergedItems, result.hasMore, result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsValidating(false);
    }
  }, [
    hasMore,
    isLoading,
    isValidating,
    nextCursor,
    collections,
    fetchFromAPI,
    syncToCache,
  ]);

  /**
   * 刷新列表
   */
  const refresh = useCallback(async () => {
    dataCache.invalidate(cacheKey);
    await fetchData();
  }, [cacheKey, fetchData]);

  /**
   * 更新本地数据（乐观更新）
   */
  const updateLocal = useCallback(
    (id: number, updates: Partial<MdCollection>) => {
      setCollections((prev) => {
        const newData = prev.map((item) =>
          item.id === id ? { ...item, ...updates } : item,
        );
        syncToCache(newData, hasMore, nextCursor);
        return newData;
      });
    },
    [hasMore, nextCursor, syncToCache],
  );

  /**
   * 从列表中移除（乐观删除）
   */
  const removeLocal = useCallback(
    (id: number) => {
      setCollections((prev) => {
        const newData = prev.filter((item) => item.id !== id);
        syncToCache(newData, hasMore, nextCursor);
        return newData;
      });
    },
    [hasMore, nextCursor, syncToCache],
  );

  /**
   * 添加到列表开头（乐观创建）
   */
  const addLocal = useCallback(
    (collection: MdCollection) => {
      setCollections((prev) => {
        const newData = [collection, ...prev];
        syncToCache(newData, hasMore, collection.id);
        return newData;
      });
    },
    [hasMore, syncToCache],
  );

  /**
   * 创建快照（用于乐观更新回滚）
   */
  const createSnapshot = useCallback((): CacheSnapshot => {
    return {
      data: [...collections],
      hasMore,
      nextCursor,
      timestamp: Date.now(),
    };
  }, [collections, hasMore, nextCursor]);

  /**
   * 从快照回滚
   */
  const rollback = useCallback(
    (snapshot: CacheSnapshot) => {
      setCollections(snapshot.data);
      setHasMore(snapshot.hasMore);
      setNextCursor(snapshot.nextCursor);
      syncToCache(snapshot.data, snapshot.hasMore, snapshot.nextCursor);
    },
    [syncToCache],
  );

  return {
    collections,
    hasMore,
    nextCursor,
    isLoading,
    isValidating,
    isStale,
    error,
    loadMore,
    refresh,
    updateLocal,
    removeLocal,
    addLocal,
    createSnapshot,
    rollback,
  };
}

export type { CacheSnapshot };
