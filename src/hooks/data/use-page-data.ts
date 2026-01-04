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
import type { Bookmark, Platform } from "@/types/supabase";
import type { UserSettings } from "@/types/user-settings";
import { DEFAULT_USER_SETTINGS } from "@/types/user-settings";
import {
  getPlatformName,
  getPlatformHexColor,
} from "@/lib/constants/platforms";
import type { FolderWithStats } from "@/types/domain";

// ==================== 通用类型 ====================

interface DataState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number;
}

// 本地类型定义（绕过 Supabase 类型推断问题）
interface FolderRow {
  id: number;
  user_id: string;
  name: string;
  parent_id: number | null;
  is_system: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  is_archived: boolean | null;
  is_locked?: boolean | null;
  folder_group: string | null;
  sort_order: number | null;
  system_type: string | null;
  source?: string | null;
}

interface BookmarkCountRow {
  folder_id: number | null;
  created_at: string | null;
}

interface _RecentBookmarkRow {
  id: number;
  title: string | null;
  url: string | null;
  platform: string | null;
  created_at: string | null;
  folders: { name: string } | null;
}

interface AnalyticsBookmarkRow {
  id: number;
  platform: string | null;
  folder_id: number | null;
  created_at: string | null;
  source_url?: string | null;
  ai_tags?: string[] | null;
}

// ==================== 收藏夹页面数据 ====================

// 重新导出 FolderWithStats 以保持向后兼容
export type { FolderWithStats } from "@/types/domain";

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
      const { data: folders, error: foldersError } =
        (await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("folders") as any)
          .select("*")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })) as {
          data: FolderRow[] | null;
          error: Error | null;
        };

      if (foldersError) throw foldersError;

      // 计算统计数据
      let foldersWithStats: FolderWithStats[] = [];

      if (folders && folders.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        const folderIds = folders.map((f) => f.id);
        const { data: allBookmarks } =
          (await // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from("bookmarks") as any)
            .select("folder_id, created_at")
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .in("folder_id", folderIds)) as {
            data: BookmarkCountRow[] | null;
            error: Error | null;
          };

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
          (folder): FolderWithStats => ({
            id: folder.id,
            user_id: folder.user_id,
            name: folder.name,
            parent_id: folder.parent_id,
            created_at: folder.created_at,
            updated_at: folder.updated_at,
            deleted_at: folder.deleted_at,
            folder_group: folder.folder_group,
            sort_order: folder.sort_order,
            source: folder.source ?? null,
            system_type: folder.system_type,
            is_system: folder.is_system ?? false,
            is_archived: folder.is_archived ?? false,
            bookmark_count: countMap.get(folder.id) || 0,
            today_count: todayCountMap.get(folder.id) || 0,
          }),
        );
      }

      // 获取最近书签
      const { data: recentBookmarks, error: bookmarksError } =
        (await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("bookmarks") as any)
          .select("*, folders(name)")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(6)) as {
          data: (Bookmark & { folders?: { name: string } | null })[] | null;
          error: Error | null;
        };

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

import type { AnalyticsData } from "@/lib/analytics";
import { isBrowserPlatform } from "@/lib/analytics";

const ANALYTICS_TREND_DAYS = 30;
const ANALYTICS_TOP_TAGS_COUNT = 15;

/**
 * 创建空的 AnalyticsData 对象
 */
function createEmptyAnalyticsData(): AnalyticsData {
  return {
    stats: {
      totalBookmarks: 0,
      contentBookmarks: 0,
      browserBookmarks: 0,
      todayCount: 0,
      weekCount: 0,
      last30DaysCount: 0,
      unclassifiedCount: 0,
      classificationRate: 0,
    },
    trendData: [],
    platformData: [],
    folderData: [],
    tagData: [],
    typeData: [],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 数据统计页面数据获取 Hook
 * 返回与服务层 AnalyticsData 兼容的数据结构
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
      const { data: bookmarks, error } =
        (await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("bookmarks") as any)
          .select("*")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })) as {
          data: AnalyticsBookmarkRow[] | null;
          error: Error | null;
        };

      if (error) throw error;

      if (!bookmarks || bookmarks.length === 0) {
        setState({
          data: createEmptyAnalyticsData(),
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        });
        return;
      }

      // 分离内容收藏和浏览器书签
      const contentBookmarks = bookmarks.filter(
        (b) => !isBrowserPlatform(b.platform as Platform),
      );
      const browserBookmarks = bookmarks.filter((b) =>
        isBrowserPlatform(b.platform as Platform),
      );

      // 计算统计数据
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(todayStart);
      monthStart.setDate(monthStart.getDate() - 30);

      const todayCount = bookmarks.filter(
        (b) => b.created_at && new Date(b.created_at) >= todayStart,
      ).length;
      const weekCount = bookmarks.filter(
        (b) => b.created_at && new Date(b.created_at) >= weekStart,
      ).length;
      const last30DaysCount = bookmarks.filter(
        (b) => b.created_at && new Date(b.created_at) >= monthStart,
      ).length;
      const unclassifiedCount = bookmarks.filter((b) => !b.folder_id).length;

      // 1. 收藏趋势数据
      const trendDaysAgo = new Date();
      trendDaysAgo.setDate(trendDaysAgo.getDate() - ANALYTICS_TREND_DAYS);

      const contentTrendMap = new Map<string, number>();
      const browserTrendMap = new Map<string, number>();

      bookmarks.forEach((bookmark) => {
        if (!bookmark.created_at) return;
        const date = new Date(bookmark.created_at);
        if (date >= trendDaysAgo) {
          const dateKey = date.toISOString().split("T")[0];
          const isBrowser = isBrowserPlatform(bookmark.platform as Platform);

          if (isBrowser) {
            browserTrendMap.set(
              dateKey,
              (browserTrendMap.get(dateKey) || 0) + 1,
            );
          } else {
            contentTrendMap.set(
              dateKey,
              (contentTrendMap.get(dateKey) || 0) + 1,
            );
          }
        }
      });

      const trendData = [];
      for (let i = ANALYTICS_TREND_DAYS - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split("T")[0];
        const count = contentTrendMap.get(dateKey) || 0;
        const browserCount = browserTrendMap.get(dateKey) || 0;

        trendData.push({
          date: dateKey,
          count,
          browserCount,
          total: count + browserCount,
        });
      }

      // 2. 平台分布数据（合并浏览器平台）
      const platformMap = new Map<string, number>();
      bookmarks.forEach((bookmark) => {
        const platform = bookmark.platform as Platform;
        const displayPlatform = isBrowserPlatform(platform)
          ? "BROWSER"
          : platform;
        platformMap.set(
          displayPlatform,
          (platformMap.get(displayPlatform) || 0) + 1,
        );
      });

      const platformData = Array.from(platformMap.entries())
        .map(([platform, value]) => ({
          platform,
          name:
            platform === "BROWSER"
              ? "浏览器书签"
              : getPlatformName(platform as Platform),
          value,
          color:
            platform === "BROWSER"
              ? "#6366f1"
              : getPlatformHexColor(platform as Platform),
          percentage:
            bookmarks.length > 0
              ? Math.round((value / bookmarks.length) * 100)
              : 0,
        }))
        .sort((a, b) => b.value - a.value);

      // 3. 热门标签数据（仅内容收藏）
      const tagMap = new Map<string, number>();
      contentBookmarks.forEach((bookmark) => {
        bookmark.ai_tags?.forEach((tag: string) => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
      });

      const tagData = Array.from(tagMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, ANALYTICS_TOP_TAGS_COUNT)
        .map(([tag, count]) => ({ tag, count }));

      // 4. 内容类型统计（仅内容收藏）
      const typeMap: Record<string, number> = {
        文章: 0,
        视频: 0,
        图文: 0,
      };

      contentBookmarks.forEach((bookmark) => {
        if (bookmark.platform === "BILIBILI") {
          typeMap["视频"]++;
        } else if (bookmark.platform === "XIAOHONGSHU") {
          typeMap["图文"]++;
        } else {
          typeMap["文章"]++;
        }
      });

      const contentTotal = contentBookmarks.length;
      const typeData = Object.entries(typeMap)
        .filter(([_, count]) => count > 0)
        .map(([type, count]) => ({
          type,
          count,
          percentage:
            contentTotal > 0 ? Math.round((count / contentTotal) * 100) : 0,
        }));

      setState({
        data: {
          stats: {
            totalBookmarks: bookmarks.length,
            contentBookmarks: contentBookmarks.length,
            browserBookmarks: browserBookmarks.length,
            todayCount,
            weekCount,
            last30DaysCount,
            unclassifiedCount,
            classificationRate:
              bookmarks.length > 0
                ? Math.round(
                    ((bookmarks.length - unclassifiedCount) /
                      bookmarks.length) *
                      100,
                  )
                : 0,
          },
          trendData,
          platformData,
          folderData: [], // 客户端 hook 暂不获取文件夹分布
          tagData,
          typeData,
          generatedAt: new Date().toISOString(),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: bookmarks } = (await (supabase.from("bookmarks") as any)
        .select("ai_tags")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .not("ai_tags", "is", null)
        .limit(100)) as {
        data: { ai_tags: string[] | null }[] | null;
        error: Error | null;
      };

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
      setState((prev) => {
        if (!prev.data) return prev;
        return {
          ...prev,
          data: { ...prev.data, hotTags },
        };
      });
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
