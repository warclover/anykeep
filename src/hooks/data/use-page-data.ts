/**
 * 页面数据获取 Hooks
 * 为各页面提供客户端数据获取能力，支持 Keep-Alive 模式
 *
 * V5.1: 收藏夹数据支持本地持久化缓存
 * V5.3: P2-2.4 添加 AbortController 请求中断机制
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/user-context";
import { clientLogger } from "@/lib/client-logger";
import { dataCache, CACHE_KEYS } from "@/lib/cache";
import type { Bookmark } from "@/types/supabase";
import type { UserSettings } from "@/types/user-settings";
import { DEFAULT_USER_SETTINGS } from "@/types/user-settings";
import type { FolderWithStats } from "@/types/domain";

// ==================== 通用类型 ====================

interface DataState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number;
}

// 本地类型定义（绕过 Supabase 类型推断问题）
interface _FolderRow {
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

interface _BookmarkCountRow {
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

interface _AnalyticsBookmarkRow {
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
 * V5.2: 使用聚合 API 优化性能（3次串行查询 → 1次 API 调用）
 * V5.3: P2-2.4 添加 AbortController 请求中断，防止竞态条件
 */
export function useFoldersData() {
  const { user } = useUser();

  // V5.1: 生成缓存键
  const cacheKey = user ? CACHE_KEYS.folders(user.id) : "";

  // V5.3: AbortController ref，用于取消进行中的请求
  const abortControllerRef = useRef<AbortController | null>(null);

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

    // V5.3: 取消之前的请求，防止竞态条件
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentCacheKey = CACHE_KEYS.folders(user.id);

    // V5.1: 有缓存时只设置 isValidating，不阻塞 UI
    const hasCache = dataCache.hasSync(currentCacheKey);
    if (hasCache) {
      setIsValidating(true);
    } else {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      // V5.2: 使用聚合 API 替代 3 次串行数据库查询
      // V5.3: 传入 AbortController signal
      const response = await fetch(
        "/api/folders/with-stats?include_recent=true&recent_limit=6",
        {
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "加载文件夹失败");
      }

      const newData: FoldersData = {
        folders: result.data.folders || [],
        recentBookmarks: result.data.recentBookmarks || [],
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
      // V5.3: 忽略被取消的请求错误
      if ((err as Error).name === "AbortError") {
        return;
      }
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

  // V5.3: 组件卸载时取消进行中的请求
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
    isValidating, // V5.1: 新增后台刷新状态
    refetch: fetchData,
  };
}

// ==================== 数据统计页面数据 ====================

import type { AnalyticsData } from "@/lib/analytics";

// 保留类型导入供未来使用

const _ANALYTICS_TREND_DAYS = 30;

const _ANALYTICS_TOP_TAGS_COUNT = 15;

/**
 * 创建空的 AnalyticsData 对象（保留供未来使用）
 */

function _createEmptyAnalyticsData(): AnalyticsData {
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
 * V5.2: 使用聚合 API 优化性能（全量查询 → 服务端聚合）
 * V5.3: P2-2.4 添加 AbortController 请求中断，防止竞态条件
 */
export function useAnalyticsData() {
  const { user } = useUser();
  const [state, setState] = useState<DataState<AnalyticsData>>({
    data: null,
    isLoading: true,
    error: null,
    lastFetched: 0,
  });

  // V5.3: AbortController ref，用于取消进行中的请求
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    // V5.3: 取消之前的请求，防止竞态条件
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // V5.2: 使用聚合 API 替代客户端全量查询 + 计算
      // V5.3: 传入 AbortController signal
      const response = await fetch("/api/analytics/stats", {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "加载统计数据失败");
      }

      setState({
        data: result.data,
        isLoading: false,
        error: null,
        lastFetched: Date.now(),
      });
    } catch (err) {
      // V5.3: 忽略被取消的请求错误
      if ((err as Error).name === "AbortError") {
        return;
      }
      clientLogger.error({ error: err }, "useAnalyticsData fetch failed");
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

  // V5.3: 组件卸载时取消进行中的请求
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
