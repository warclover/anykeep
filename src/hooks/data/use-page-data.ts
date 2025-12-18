/**
 * 页面数据获取 Hooks
 * 为各页面提供客户端数据获取能力，支持 Keep-Alive 模式
 *
 * V5.1: 收藏夹数据支持本地持久化缓存
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/user-context";
import { clientLogger } from "@/lib/client-logger";
import { dataCache, CACHE_KEYS } from "@/lib/cache";
import type { Bookmark, Folder, Platform } from "@/types/supabase";
import type { UserSettings } from "@/types/user-settings";
import { DEFAULT_USER_SETTINGS } from "@/types/user-settings";
import {
  getPlatformName,
  getPlatformHexColor,
} from "@/lib/constants/platforms";

// ==================== 通用类型 ====================

interface DataState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number;
}

// ==================== 收藏夹页面数据 ====================

export type FolderWithStats = Folder & {
  bookmark_count: number;
  today_count: number;
};

interface FoldersData {
  folders: FolderWithStats[];
  recentBookmarks: (Bookmark & { folders?: { name: string } | null })[];
}

/**
 * 收藏夹页面数据获取 Hook
 * V5.1: 支持本地持久化缓存，启动即显示
 */
export function useFoldersData() {
  const { user } = useUser();

  // V5.1: 生成缓存键
  const cacheKey = user ? CACHE_KEYS.folders(user.id) : "";

  // V5.1: 同步读取缓存（包括从 localStorage 恢复的数据）
  const [state, setState] = useState<DataState<FoldersData>>(() => {
    if (user && cacheKey) {
      const cached = dataCache.getSync<FoldersData>(cacheKey);
      if (cached.data) {
        return {
          data: cached.data,
          isLoading: false,
          error: null,
          lastFetched: cached.timestamp || 0,
        };
      }
    }
    return {
      data: null,
      isLoading: true,
      error: null,
      lastFetched: 0,
    };
  });

  // V5.1: 后台刷新状态
  const [isValidating, setIsValidating] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    const currentCacheKey = CACHE_KEYS.folders(user.id);

    // V5.1: 有缓存时只设置 isValidating，不阻塞 UI
    const hasCache = dataCache.hasSync(currentCacheKey);
    if (hasCache) {
      setIsValidating(true);
    } else {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      const supabase = createClient();

      // 获取文件夹
      const { data: folders, error: foldersError } = await supabase
        .from("folders")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (foldersError) throw foldersError;

      // 计算统计数据
      let foldersWithStats: FolderWithStats[] = [];

      if (folders && folders.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        const folderIds = folders.map((f) => f.id);
        const { data: allBookmarks } = await supabase
          .from("bookmarks")
          .select("folder_id, created_at")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .in("folder_id", folderIds);

        const countMap = new Map<number, number>();
        const todayCountMap = new Map<number, number>();

        if (allBookmarks) {
          for (const bookmark of allBookmarks) {
            if (bookmark.folder_id) {
              countMap.set(
                bookmark.folder_id,
                (countMap.get(bookmark.folder_id) || 0) + 1,
              );
              if (bookmark.created_at && bookmark.created_at >= todayISO) {
                todayCountMap.set(
                  bookmark.folder_id,
                  (todayCountMap.get(bookmark.folder_id) || 0) + 1,
                );
              }
            }
          }
        }

        const systemFolders = folders.filter((f) => f.is_system);
        const normalFolders = folders.filter((f) => !f.is_system);

        foldersWithStats = [...systemFolders, ...normalFolders].map(
          (folder) => ({
            ...folder,
            bookmark_count: countMap.get(folder.id) || 0,
            today_count: todayCountMap.get(folder.id) || 0,
          }),
        );
      }

      // 获取最近书签
      const { data: recentBookmarks, error: bookmarksError } = await supabase
        .from("bookmarks")
        .select("*, folders(name)")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6);

      if (bookmarksError) throw bookmarksError;

      const newData: FoldersData = {
        folders: foldersWithStats,
        recentBookmarks: recentBookmarks || [],
      };

      // V5.1: 存入缓存（自动持久化到 localStorage）
      dataCache.setCache(currentCacheKey, newData);

      setState({
        data: newData,
        isLoading: false,
        error: null,
        lastFetched: Date.now(),
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "加载失败",
      }));
    } finally {
      setIsValidating(false);
    }
  }, [user]);

  // 初始加载
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    isValidating, // V5.1: 新增后台刷新状态
    refetch: fetchData,
  };
}

// ==================== 数据统计页面数据 ====================

interface AnalyticsData {
  trendData: { date: string; count: number }[];
  platformData: { name: string; value: number; color: string }[];
  tagData: { tag: string; count: number }[];
  typeData: { type: string; count: number }[];
}

const ANALYTICS_TREND_DAYS = 30;
const ANALYTICS_TOP_TAGS_COUNT = 15;

/**
 * 数据统计页面数据获取 Hook
 */
export function useAnalyticsData() {
  const { user } = useUser();
  const [state, setState] = useState<DataState<AnalyticsData>>({
    data: null,
    isLoading: true,
    error: null,
    lastFetched: 0,
  });

  const fetchData = useCallback(async () => {
    if (!user) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const supabase = createClient();

      // 获取所有书签
      const { data: bookmarks, error } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (!bookmarks || bookmarks.length === 0) {
        setState({
          data: {
            trendData: [],
            platformData: [],
            tagData: [],
            typeData: [],
          },
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        });
        return;
      }

      // 1. 收藏趋势数据
      const trendDaysAgo = new Date();
      trendDaysAgo.setDate(trendDaysAgo.getDate() - ANALYTICS_TREND_DAYS);

      const trendMap = new Map<string, number>();
      bookmarks.forEach((bookmark) => {
        if (!bookmark.created_at) return;
        const date = new Date(bookmark.created_at);
        if (date >= trendDaysAgo) {
          const dateKey = date.toISOString().split("T")[0];
          trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + 1);
        }
      });

      const trendData = [];
      for (let i = ANALYTICS_TREND_DAYS - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split("T")[0];
        trendData.push({
          date: dateKey,
          count: trendMap.get(dateKey) || 0,
        });
      }

      // 2. 平台分布数据
      const platformMap = new Map<Platform, number>();
      bookmarks.forEach((bookmark) => {
        const platform = bookmark.platform as Platform;
        platformMap.set(platform, (platformMap.get(platform) || 0) + 1);
      });

      const platformData = Array.from(platformMap.entries()).map(
        ([platform, count]) => ({
          name: getPlatformName(platform),
          value: count,
          color: getPlatformHexColor(platform),
        }),
      );

      // 3. 热门标签数据
      const tagMap = new Map<string, number>();
      bookmarks.forEach((bookmark) => {
        bookmark.ai_tags?.forEach((tag: string) => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
      });

      const tagData = Array.from(tagMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, ANALYTICS_TOP_TAGS_COUNT)
        .map(([tag, count]) => ({ tag, count }));

      // 4. 内容类型统计
      const typeMap: Record<string, number> = {
        文章: 0,
        视频: 0,
        图文: 0,
      };

      bookmarks.forEach((bookmark) => {
        if (bookmark.platform === "BILIBILI") {
          typeMap["视频"]++;
        } else if (bookmark.platform === "XIAOHONGSHU") {
          typeMap["图文"]++;
        } else {
          typeMap["文章"]++;
        }
      });

      const typeData = Object.entries(typeMap)
        .filter(([_, count]) => count > 0)
        .map(([type, count]) => ({ type, count }));

      setState({
        data: {
          trendData,
          platformData,
          tagData,
          typeData,
        },
        isLoading: false,
        error: null,
        lastFetched: Date.now(),
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "加载失败",
      }));
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData,
  };
}

// ==================== 设置页面数据 ====================

/**
 * 设置页面数据获取 Hook
 * 从 API 加载用户设置，支持未登录时显示默认值
 */
export function useSettingsData() {
  const { user, isLoading: userLoading } = useUser();
  const [state, setState] = useState<DataState<UserSettings>>({
    data: DEFAULT_USER_SETTINGS,
    isLoading: true,
    error: null,
    lastFetched: 0,
  });

  const fetchData = useCallback(async () => {
    if (userLoading) return;

    // 未登录时使用默认设置
    if (!user) {
      setState({
        data: DEFAULT_USER_SETTINGS,
        isLoading: false,
        error: null,
        lastFetched: Date.now(),
      });
      return;
    }

    // 从 API 加载用户设置
    try {
      const response = await fetch("/api/user/settings");
      const result = await response.json();

      if (result.success) {
        setState({
          data: result.data,
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        });
      } else {
        throw new Error(result.error?.message || "加载设置失败");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载设置失败";
      clientLogger.error({ error: message }, "Failed to load settings");
      setState({
        data: DEFAULT_USER_SETTINGS,
        isLoading: false,
        error: message,
        lastFetched: Date.now(),
      });
    }
  }, [userLoading, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData,
  };
}

// ==================== 搜索页面数据 ====================

interface SearchData {
  results: (Bookmark & { folders?: { name: string } | null })[];
  hotTags: string[];
}

/**
 * 搜索页面数据获取 Hook
 */
export function useSearchData(query: string, aiMode: boolean) {
  const { user } = useUser();
  const [state, setState] = useState<DataState<SearchData>>({
    data: { results: [], hotTags: [] },
    isLoading: false,
    error: null,
    lastFetched: 0,
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchHotTags = useCallback(async () => {
    if (!user) return [];

    try {
      const supabase = createClient();
      const { data: bookmarks } = await supabase
        .from("bookmarks")
        .select("ai_tags")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .not("ai_tags", "is", null)
        .limit(100);

      if (!bookmarks) return [];

      const tagCount = new Map<string, number>();
      bookmarks.forEach((b) => {
        b.ai_tags?.forEach((tag: string) => {
          tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
        });
      });

      return Array.from(tagCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);
    } catch {
      return [];
    }
  }, [user]);

  const search = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || !user) {
        setState((prev) => ({
          ...prev,
          data: { results: [], hotTags: prev.data?.hotTags || [] },
          isLoading: false,
        }));
        return;
      }

      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const params = new URLSearchParams({
          q: searchQuery,
          mode: aiMode ? "ai" : "text",
        });

        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("搜索失败");

        const result = await res.json();

        setState((prev) => ({
          data: {
            results: result.data.bookmarks || [],
            hotTags: prev.data?.hotTags || [],
          },
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        }));
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : "搜索失败",
        }));
      }
    },
    [user, aiMode],
  );

  // 初始加载热门标签
  useEffect(() => {
    fetchHotTags().then((hotTags) => {
      setState((prev) => ({
        ...prev,
        data: { ...prev.data!, hotTags },
      }));
    });
  }, [fetchHotTags]);

  // 搜索
  useEffect(() => {
    if (query) {
      search(query);
    }
  }, [query, search]);

  // 组件卸载时清理 AbortController
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    search,
    refetch: () => search(query),
  };
}
