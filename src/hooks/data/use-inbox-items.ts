/**
 * 收件箱 Tab 书签列表 Hook
 *
 * 为每个 Tab 提供独立的缓存，支持无限滚动分页加载
 * 默认每页加载 10 条，滚动到底部自动加载下一页
 *
 * @version 2.0.0
 * @since 2026-02-10
 */

"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { inboxKeys } from "@/hooks/queries/keys";
import { INBOX_TABS, type InboxTabId } from "@/lib/constants/inbox-tabs";
import type { Bookmark } from "@/types/supabase";

// ==================== 常量 ====================

/** 每页加载数量 */
const PAGE_SIZE = 10;

// ==================== 类型定义 ====================

type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

interface InboxPage {
  items: BookmarkWithFolder[];
  nextCursor: number | null;
  totalFetched: number;
}

interface UseInboxItemsReturn {
  items: BookmarkWithFolder[];
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  fetchNextPage: () => void;
}

// ==================== 数据获取 ====================

async function fetchInboxPage(
  tabId: InboxTabId,
  cursor: number,
): Promise<InboxPage> {
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
    .range(cursor, cursor + PAGE_SIZE - 1);

  if (error) {
    throw new Error(error.message);
  }

  const items = (data as BookmarkWithFolder[]) || [];

  return {
    items,
    nextCursor: items.length === PAGE_SIZE ? cursor + PAGE_SIZE : null,
    totalFetched: cursor + items.length,
  };
}

// ==================== Hook ====================

/** 缓存时间：1 分钟 */
const STALE_TIME = 60 * 1000;

/**
 * 收件箱 Tab 书签列表 Hook（无限滚动版）
 *
 * 每个 Tab 独立缓存，默认加载 10 条，滚动到底部自动加载更多
 *
 * @example
 * ```tsx
 * const { items, isLoading, hasNextPage, fetchNextPage } = useInboxItems("uncategorized");
 * ```
 */
export function useInboxItems(tabId: InboxTabId): UseInboxItemsReturn {
  const {
    data,
    error,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery<InboxPage, Error>({
    queryKey: inboxKeys.itemsByTab(tabId),
    queryFn: ({ pageParam }) =>
      fetchInboxPage(tabId, (pageParam as number) ?? 0),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // 将所有分页数据合并为扁平列表
  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const handleFetchNextPage = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    items,
    isLoading,
    isFetching,
    isFetchingNextPage: isFetchingNextPage ?? false,
    hasNextPage: hasNextPage ?? false,
    error: error ?? null,
    refresh,
    fetchNextPage: handleFetchNextPage,
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
