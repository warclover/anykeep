/**
 * 收件箱各 Tab 计数 Hook
 *
 * 并行查询各筛选条件的书签数量，支持：
 * - TanStack Query 缓存和自动刷新
 * - 乐观更新
 * - 错误处理
 * - 扩展统计（智能计数卡片）
 *
 * @version 2.1.0 - 添加扩展统计支持
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { inboxKeys } from "@/hooks/queries/keys";
import type { InboxTabId } from "@/lib/constants/inbox-tabs";

// ==================== 类型定义 ====================

export type InboxCounts = Record<InboxTabId, number>;

/** 扩展统计信息（智能计数卡片使用） */
export interface InboxExtendedStats {
  /** AI 处理中的书签数量 */
  processing: number;
  /** 高价值内容数量 */
  highValue: number;
  /** 待分类数量 */
  uncategorized: number;
}

/** 完整的收件箱统计数据 */
interface InboxCountsData {
  counts: InboxCounts;
  extendedStats: InboxExtendedStats;
}

interface UseInboxCountsReturn {
  counts: InboxCounts;
  /** 扩展统计信息（用于智能计数卡片） */
  extendedStats: InboxExtendedStats;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/** RPC 返回类型 */
interface InboxCountsRpcResult {
  uncategorized: number;
  unread: number;
  high_value: number;
  broken: number;
  recent: number;
  processing: number;
}

// ==================== 数据获取 ====================

/**
 * 使用 RPC 函数获取收件箱计数
 * 将 6 次数据库往返合并为 1 次，提升性能
 */
async function fetchInboxCounts(): Promise<InboxCountsData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("未登录");
  }

  // 使用 RPC 函数一次查询获取所有计数
  // 注意：RPC 函数需要运行迁移后才可用，否则自动降级
  const { data, error } = await supabase.rpc(
    "get_inbox_counts" as never,
    {
      p_user_id: user.id,
    } as never,
  );

  if (error) {
    // RPC 不可用时降级到并行查询
    return fetchInboxCountsFallback(supabase, user.id);
  }

  const result = data as unknown as InboxCountsRpcResult | null;

  return {
    counts: {
      uncategorized: result?.uncategorized ?? 0,
      unread: result?.unread ?? 0,
      "high-value": result?.high_value ?? 0,
      broken: result?.broken ?? 0,
      recent: result?.recent ?? 0,
    },
    extendedStats: {
      processing: result?.processing ?? 0,
      highValue: result?.high_value ?? 0,
      uncategorized: result?.uncategorized ?? 0,
    },
  };
}

/**
 * 降级方案：并行查询（RPC 不可用时使用）
 */
async function fetchInboxCountsFallback(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<InboxCountsData> {
  const baseQuery = () =>
    supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_in_trash", false);

  // 注意：bookmarks 表无 processing_status 列（仅 md_collections 表有），暂返回 0
  const [uncategorized, unread, highValue, broken, recent] = await Promise.all([
    baseQuery().is("folder_id", null),
    baseQuery().eq("is_read", false),
    baseQuery().gte("quality_score", 0.7),
    baseQuery().eq("link_status", "broken"),
    baseQuery().gte(
      "created_at",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    ),
  ]);

  const uncategorizedCount = uncategorized.count ?? 0;
  const highValueCount = highValue.count ?? 0;
  const processingCount = 0;

  return {
    counts: {
      uncategorized: uncategorizedCount,
      unread: unread.count ?? 0,
      "high-value": highValueCount,
      broken: broken.count ?? 0,
      recent: recent.count ?? 0,
    },
    extendedStats: {
      processing: processingCount,
      highValue: highValueCount,
      uncategorized: uncategorizedCount,
    },
  };
}

// ==================== Hook ====================

const EMPTY_COUNTS: InboxCounts = {
  uncategorized: 0,
  unread: 0,
  "high-value": 0,
  broken: 0,
  recent: 0,
};

const EMPTY_EXTENDED_STATS: InboxExtendedStats = {
  processing: 0,
  highValue: 0,
  uncategorized: 0,
};

/** 缓存时间：60 秒（角标数据不需要高频刷新） */
const STALE_TIME = 60 * 1000;

/** 刷新间隔：60 秒（从 30s 延长，降低后台 CPU 占用） */
const REFETCH_INTERVAL = 60 * 1000;

export function useInboxCounts(): UseInboxCountsReturn {
  const _queryClient = useQueryClient();

  const { data, error, isLoading, refetch } = useQuery<InboxCountsData, Error>({
    queryKey: inboxKeys.counts(),
    queryFn: fetchInboxCounts,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    retry: 2,
    retryDelay: 3000,
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    counts: data?.counts ?? EMPTY_COUNTS,
    extendedStats: data?.extendedStats ?? EMPTY_EXTENDED_STATS,
    isLoading,
    error: error ?? null,
    refresh,
  };
}
