/**
 * 整理中心各 Tab 计数 Hook
 *
 * 并行查询各筛选条件的书签数量
 * 复用原收件箱的计数逻辑
 *
 * @version 1.0.0
 * @since 2026-02-13
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { organizeKeys } from "@/hooks/queries/keys";

// ==================== 类型定义 ====================

/** 书签 Tab 计数（不含健康诊断） */
export type OrganizeCounts = {
  pending: number;
  unread: number;
  "high-value": number;
  broken: number;
  recent: number;
};

/** 扩展统计信息（智能计数卡片使用） */
export interface OrganizeExtendedStats {
  /** AI 处理中的书签数量 */
  processing: number;
  /** 高价值内容数量 */
  highValue: number;
  /** 待分类数量 */
  pending: number;
  /** 兼容旧组件 InboxStatsCards */
  uncategorized: number;
}

/** 完整的整理中心统计数据 */
interface OrganizeCountsData {
  counts: OrganizeCounts;
  extendedStats: OrganizeExtendedStats;
}

interface UseOrganizeCountsReturn {
  counts: OrganizeCounts;
  /** 扩展统计信息（用于智能计数卡片） */
  extendedStats: OrganizeExtendedStats;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/** RPC 返回类型 */
interface OrganizeCountsRpcResult {
  uncategorized: number;
  unread: number;
  high_value: number;
  broken: number;
  recent: number;
  processing: number;
}

// ==================== 数据获取 ====================

/**
 * 使用 RPC 函数获取整理中心计数
 * 将 6 次数据库往返合并为 1 次，提升性能
 */
async function fetchOrganizeCounts(): Promise<OrganizeCountsData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("未登录");
  }

  // 使用 RPC 函数一次查询获取所有计数
  const { data, error } = await supabase.rpc(
    "get_inbox_counts" as never,
    {
      p_user_id: user.id,
    } as never,
  );

  if (error) {
    // RPC 不可用时降级到并行查询
    return fetchOrganizeCountsFallback(supabase, user.id);
  }

  const result = data as unknown as OrganizeCountsRpcResult | null;

  return {
    counts: {
      pending: result?.uncategorized ?? 0,
      unread: result?.unread ?? 0,
      "high-value": result?.high_value ?? 0,
      broken: result?.broken ?? 0,
      recent: result?.recent ?? 0,
    },
    extendedStats: {
      processing: result?.processing ?? 0,
      highValue: result?.high_value ?? 0,
      pending: result?.uncategorized ?? 0,
      uncategorized: result?.uncategorized ?? 0, // 兼容旧组件
    },
  };
}

/**
 * 降级方案：并行查询（RPC 不可用时使用）
 */
async function fetchOrganizeCountsFallback(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<OrganizeCountsData> {
  const baseQuery = () =>
    supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("is_in_trash", false);

  const [pending, unread, highValue, broken, recent] = await Promise.all([
    baseQuery().is("folder_id", null),
    baseQuery().eq("is_read", false),
    baseQuery().gte("quality_score", 0.7),
    baseQuery().eq("link_status", "broken"),
    baseQuery().gte(
      "created_at",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    ),
  ]);

  const pendingCount = pending.count ?? 0;
  const highValueCount = highValue.count ?? 0;
  const processingCount = 0;

  return {
    counts: {
      pending: pendingCount,
      unread: unread.count ?? 0,
      "high-value": highValueCount,
      broken: broken.count ?? 0,
      recent: recent.count ?? 0,
    },
    extendedStats: {
      processing: processingCount,
      highValue: highValueCount,
      pending: pendingCount,
      uncategorized: pendingCount, // 兼容旧组件
    },
  };
}

// ==================== Hook ====================

const EMPTY_COUNTS: OrganizeCounts = {
  pending: 0,
  unread: 0,
  "high-value": 0,
  broken: 0,
  recent: 0,
};

const EMPTY_EXTENDED_STATS: OrganizeExtendedStats = {
  processing: 0,
  highValue: 0,
  pending: 0,
  uncategorized: 0,
};

/** 缓存时间：30 秒（实时性数据） */
const STALE_TIME = 30 * 1000;

/** 刷新间隔：30 秒 */
const REFETCH_INTERVAL = 30 * 1000;

export function useOrganizeCounts(): UseOrganizeCountsReturn {
  const _queryClient = useQueryClient();

  const { data, error, isLoading, refetch } = useQuery<
    OrganizeCountsData,
    Error
  >({
    queryKey: organizeKeys.counts(),
    queryFn: fetchOrganizeCounts,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
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
