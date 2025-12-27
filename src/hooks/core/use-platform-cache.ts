"use client";

/**
 * 平台数据缓存 Hook
 * 性能优化：缓存已加载的平台数据，避免重复请求
 */

import { useRef, useCallback } from "react";
import type { Bookmark } from "@/types/supabase";

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface CacheEntry {
  data: BookmarkWithFolder[];
  timestamp: number;
  hasMore: boolean;
}

// 缓存过期时间：5分钟
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 生成缓存 key
 * 包含平台、排序、文件夹等参数
 */
function generateCacheKey(params: {
  platform: string;
  sort: string;
  folder: string;
}): string {
  return `${params.platform || "all"}:${params.sort || "created_desc"}:${params.folder || ""}`;
}

/**
 * 平台数据缓存 Hook
 */
export function usePlatformCache() {
  // 使用 Map 存储缓存数据
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  /**
   * 获取缓存数据
   * @returns 缓存数据，如果不存在或已过期返回 null
   */
  const getCache = useCallback(
    (params: { platform: string; sort: string; folder: string }) => {
      const key = generateCacheKey(params);
      const entry = cacheRef.current.get(key);

      if (!entry) {
        return null;
      }

      // 检查是否过期
      if (Date.now() - entry.timestamp > CACHE_TTL) {
        cacheRef.current.delete(key);
        return null;
      }

      return entry;
    },
    [],
  );

  /**
   * 设置缓存数据
   */
  const setCache = useCallback(
    (
      params: { platform: string; sort: string; folder: string },
      data: BookmarkWithFolder[],
      hasMore: boolean,
    ) => {
      const key = generateCacheKey(params);
      cacheRef.current.set(key, {
        data,
        timestamp: Date.now(),
        hasMore,
      });
    },
    [],
  );

  /**
   * 更新缓存中的单条数据
   * 用于乐观更新后同步缓存
   */
  const updateCacheItem = useCallback(
    (
      bookmarkId: number,
      updater: (bookmark: BookmarkWithFolder) => BookmarkWithFolder,
    ) => {
      cacheRef.current.forEach((entry, key) => {
        const index = entry.data.findIndex((b) => b.id === bookmarkId);
        if (index !== -1) {
          const newData = [...entry.data];
          newData[index] = updater(newData[index]);
          cacheRef.current.set(key, {
            ...entry,
            data: newData,
            timestamp: Date.now(),
          });
        }
      });
    },
    [],
  );

  /**
   * 从缓存中移除单条数据
   * 用于删除操作后同步缓存
   */
  const removeCacheItem = useCallback((bookmarkId: number) => {
    cacheRef.current.forEach((entry, key) => {
      const index = entry.data.findIndex((b) => b.id === bookmarkId);
      if (index !== -1) {
        const newData = entry.data.filter((b) => b.id !== bookmarkId);
        cacheRef.current.set(key, {
          ...entry,
          data: newData,
          timestamp: Date.now(),
        });
      }
    });
  }, []);

  /**
   * 清除指定平台的缓存
   */
  const invalidateCache = useCallback(
    (params?: { platform?: string; sort?: string; folder?: string }) => {
      if (!params) {
        // 清除所有缓存
        cacheRef.current.clear();
        return;
      }

      // 清除匹配的缓存
      const keysToDelete: string[] = [];
      cacheRef.current.forEach((_, key) => {
        const [platform, sort, folder] = key.split(":");
        const shouldDelete =
          (!params.platform || platform === params.platform) &&
          (!params.sort || sort === params.sort) &&
          (!params.folder || folder === params.folder);

        if (shouldDelete) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach((key) => cacheRef.current.delete(key));
    },
    [],
  );

  /**
   * 追加数据到缓存（用于加载更多）
   */
  const appendToCache = useCallback(
    (
      params: { platform: string; sort: string; folder: string },
      newData: BookmarkWithFolder[],
      hasMore: boolean,
    ) => {
      const key = generateCacheKey(params);
      const entry = cacheRef.current.get(key);

      if (entry) {
        cacheRef.current.set(key, {
          data: [...entry.data, ...newData],
          timestamp: Date.now(),
          hasMore,
        });
      }
    },
    [],
  );

  return {
    getCache,
    setCache,
    updateCacheItem,
    removeCacheItem,
    invalidateCache,
    appendToCache,
  };
}
