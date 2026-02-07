/**
 * 收件箱 Tab 书签列表 Hook
 *
 * 为每个 Tab 提供独立的缓存，避免 Tab 切换时重复查询
 * 支持 TanStack Query 缓存和自动刷新
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { inboxKeys } from "@/hooks/queries/keys";
import { INBOX_TABS, type InboxTabId } from "@/lib/constants/inbox-tabs";
import type { Bookmark } from "@/types/supabase";

// ==================== 类型定义 ====================

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface UseInboxItemsReturn {
  items: BookmarkWithFolder[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// ==================== 数据获取 ====================

async function fetchInboxItems(
  tabId: InboxTabId,
): Promise<BookmarkWithFolder[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("未登录");
  }

  // 构建基础查询
  let query = supabase
    .from("bookmarks")
    .select("*, folders!bookmarks_folder_id_fkey(name)")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .eq("is_in_trash", false);

  // 应用 Tab 筛选条件
  const tabConfig = INBOX_TABS.find((t) => t.id === tabId);
  if (tabConfig) {
    const filter = tabConfig.getFilter();

    if (filter.folderId === null) {
      query = query.is("folder_id", null);
    }
    if (filter.isRead === false) {
      query = query.eq("is_read", false);
    }
    if (filter.qualityScoreGte) {
      query = query.gte("quality_score", filter.qualityScoreGte);
    }
    if (filter.linkStatus) {
      query = query.eq("link_status", filter.linkStatus);
    }
    if (filter.createdAfter === "7d") {
      query = query.gte(
        "created_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      );
    }
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data as BookmarkWithFolder[]) || [];
}

// ==================== Hook ====================

/** 缓存时间：1 分钟 */
const STALE_TIME = 60 * 1000;

/**
 * 收件箱 Tab 书签列表 Hook
 *
 * 每个 Tab 独立缓存，切换 Tab 时优先使用缓存数据
 *
 * @example
 * ```tsx
 * const { items, isLoading } = useInboxItems("uncategorized");
 * ```
 */
export function useInboxItems(tabId: InboxTabId): UseInboxItemsReturn {
  const { data, error, isLoading, isFetching, refetch } = useQuery<
    BookmarkWithFolder[],
    Error
  >({
    queryKey: inboxKeys.itemsByTab(tabId),
    queryFn: () => fetchInboxItems(tabId),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false, // 避免频繁刷新
    retry: 2,
    retryDelay: 1000,
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    items: data ?? [],
    isLoading,
    isFetching,
    error: error ?? null,
    refresh,
  };
}

/**
 * 使所有 Tab 缓存失效
 */
export function useInvalidateInboxItems() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: inboxKeys.items() });
  }, [queryClient]);
}
