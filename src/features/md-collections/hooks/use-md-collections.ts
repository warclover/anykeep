/**
 * MD 收藏数据获取 Hook
 * P2-007: Markdown 内容收藏
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import type { MdCollection, MdCollectionListParams } from "../types";

interface UseMdCollectionsOptions extends MdCollectionListParams {
  /** 是否自动加载 */
  autoLoad?: boolean;
  /** 服务端预取的初始数据 */
  initialData?: MdCollection[];
  /** 服务端预取的分页状态 */
  initialHasMore?: boolean;
}

interface UseMdCollectionsReturn {
  /** MD 收藏列表 */
  collections: MdCollection[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 下一页游标 */
  nextCursor: number | null;
  /** 加载更多 */
  loadMore: () => Promise<void>;
  /** 刷新列表 */
  refresh: () => Promise<void>;
  /** 更新本地数据（乐观更新用） */
  updateLocal: (id: number, updates: Partial<MdCollection>) => void;
  /** 从列表中移除（乐观删除用） */
  removeLocal: (id: number) => void;
  /** 添加到列表开头（乐观创建用） */
  addLocal: (collection: MdCollection) => void;
}

const DEFAULT_LIMIT = 20;

export function useMdCollections(
  options: UseMdCollectionsOptions = {},
): UseMdCollectionsReturn {
  const {
    autoLoad = true,
    limit = DEFAULT_LIMIT,
    folderId,
    contentType,
    keyword,
    sort = "created_desc",
    isRead,
    isStarred,
    initialData = [],
    initialHasMore,
  } = options;

  // 使用预取数据初始化状态，避免 loading 闪烁
  const [collections, setCollections] = useState<MdCollection[]>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(initialHasMore ?? true);
  // 从预取数据推断 nextCursor
  const [nextCursor, setNextCursor] = useState<number | null>(
    initialData.length > 0 ? initialData[initialData.length - 1].id : null,
  );

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
      if (isRead !== undefined) params.set("isRead", String(isRead));
      if (isStarred !== undefined) params.set("isStarred", String(isStarred));
      return params;
    },
    [limit, folderId, contentType, keyword, sort, isRead, isStarred],
  );

  /**
   * 加载数据
   */
  const loadData = useCallback(
    async (cursor?: number | null, append = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = buildQueryParams(cursor);
        const response = await fetch(
          `/api/md-collections?${params.toString()}`,
        );
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "加载失败");
        }

        const { items, nextCursor: newCursor, hasMore: more } = result.data;

        if (append) {
          setCollections((prev) => [...prev, ...items]);
        } else {
          setCollections(items);
        }

        setNextCursor(newCursor);
        setHasMore(more);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setIsLoading(false);
      }
    },
    [buildQueryParams],
  );

  /**
   * 加载更多
   */
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !nextCursor) return;
    await loadData(nextCursor, true);
  }, [isLoading, hasMore, nextCursor, loadData]);

  /**
   * 刷新列表
   */
  const refresh = useCallback(async () => {
    setNextCursor(null);
    setHasMore(true);
    await loadData(null, false);
  }, [loadData]);

  /**
   * 更新本地数据（乐观更新）
   */
  const updateLocal = useCallback(
    (id: number, updates: Partial<MdCollection>) => {
      setCollections((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  /**
   * 从列表中移除（乐观删除）
   */
  const removeLocal = useCallback((id: number) => {
    setCollections((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /**
   * 添加到列表开头（乐观创建）
   */
  const addLocal = useCallback((collection: MdCollection) => {
    setCollections((prev) => [collection, ...prev]);
  }, []);

  /**
   * 自动加载
   */
  useEffect(() => {
    if (autoLoad) {
      loadData(null, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, folderId, contentType, keyword, sort, isRead, isStarred]);

  return {
    collections,
    isLoading,
    error,
    hasMore,
    nextCursor,
    loadMore,
    refresh,
    updateLocal,
    removeLocal,
    addLocal,
  };
}

/**
 * 获取单个 MD 收藏详情
 */
export function useMdCollection(id: number | null) {
  const [collection, setCollection] = useState<MdCollection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/md-collections/${id}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "加载失败");
      }

      setCollection(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      load();
    } else {
      setCollection(null);
    }
  }, [id, load]);

  return {
    collection,
    isLoading,
    error,
    refresh: load,
  };
}
