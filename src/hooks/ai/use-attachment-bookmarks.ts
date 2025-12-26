/**
 * 附件书签获取 Hook
 *
 * 用于获取最近收藏或搜索全库收藏
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/user-context";
import { ATTACHMENT_LIMITS } from "@/components/ai/attachment/types";
import type { Bookmark } from "@/types/supabase";

// =============================================================================
// 类型定义
// =============================================================================

export interface UseAttachmentBookmarksOptions {
  /** 搜索关键词（空 = 最近收藏） */
  searchQuery?: string;
  /** 是否启用查询 */
  enabled?: boolean;
  /** 防抖延迟（毫秒） */
  debounceMs?: number;
}

export interface UseAttachmentBookmarksReturn {
  /** 书签列表 */
  bookmarks: Bookmark[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否正在搜索（防抖中或请求中） */
  isSearching: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 是否为搜索模式 */
  isSearchMode: boolean;
  /** 刷新数据 */
  refresh: () => void;
}

// =============================================================================
// Hook 实现
// =============================================================================

export function useAttachmentBookmarks({
  searchQuery = "",
  enabled = true,
  debounceMs = 300,
}: UseAttachmentBookmarksOptions = {}): UseAttachmentBookmarksReturn {
  const { user } = useUser();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 防抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 请求版本号，用于取消过期请求
  const requestVersionRef = useRef(0);

  const isSearchMode = searchQuery.trim().length > 0;

  // 获取最近收藏
  const fetchRecentBookmarks = useCallback(async () => {
    if (!user) return;

    const currentVersion = ++requestVersionRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .is("is_in_trash", false)
        .order("created_at", { ascending: false })
        .limit(ATTACHMENT_LIMITS.RECENT_BOOKMARKS_LIMIT);

      // 检查请求是否过期
      if (currentVersion !== requestVersionRef.current) return;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setBookmarks(data || []);
    } catch (err) {
      if (currentVersion === requestVersionRef.current) {
        setError(err instanceof Error ? err : new Error("获取收藏失败"));
      }
    } finally {
      if (currentVersion === requestVersionRef.current) {
        setIsLoading(false);
      }
    }
  }, [user]);

  // 搜索全库收藏
  const searchBookmarks = useCallback(
    async (query: string) => {
      if (!user || !query.trim()) return;

      const currentVersion = ++requestVersionRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        // 搜索标题、URL、标签
        const searchTerm = `%${query.trim()}%`;

        const { data, error: searchError } = await supabase
          .from("bookmarks")
          .select("*")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .is("is_in_trash", false)
          .or(
            `title.ilike.${searchTerm},url.ilike.${searchTerm},user_tags.cs.{${query.trim()}}`,
          )
          .order("created_at", { ascending: false })
          .limit(20); // 搜索结果限制 20 条

        // 检查请求是否过期
        if (currentVersion !== requestVersionRef.current) return;

        if (searchError) {
          throw new Error(searchError.message);
        }

        setBookmarks(data || []);
      } catch (err) {
        if (currentVersion === requestVersionRef.current) {
          setError(err instanceof Error ? err : new Error("搜索失败"));
        }
      } finally {
        if (currentVersion === requestVersionRef.current) {
          setIsLoading(false);
          setIsSearching(false);
        }
      }
    },
    [user],
  );

  // 处理搜索变化（带防抖）
  useEffect(() => {
    if (!enabled || !user) {
      setBookmarks([]);
      return;
    }

    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (isSearchMode) {
      // 搜索模式：设置防抖
      setIsSearching(true);
      debounceTimerRef.current = setTimeout(() => {
        searchBookmarks(searchQuery);
      }, debounceMs);
    } else {
      // 最近收藏模式：立即获取
      setIsSearching(false);
      fetchRecentBookmarks();
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    user,
    enabled,
    searchQuery,
    isSearchMode,
    debounceMs,
    fetchRecentBookmarks,
    searchBookmarks,
  ]);

  // 刷新函数
  const refresh = useCallback(() => {
    if (isSearchMode) {
      searchBookmarks(searchQuery);
    } else {
      fetchRecentBookmarks();
    }
  }, [isSearchMode, searchQuery, searchBookmarks, fetchRecentBookmarks]);

  return {
    bookmarks,
    isLoading,
    isSearching: isSearching || isLoading,
    error,
    isSearchMode,
    refresh,
  };
}

export default useAttachmentBookmarks;
