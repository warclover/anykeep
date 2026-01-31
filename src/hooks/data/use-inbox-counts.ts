/**
 * 收件箱各 Tab 计数 Hook
 *
 * 并行查询各筛选条件的书签数量，支持：
 * - SWR 缓存和自动刷新
 * - 乐观更新
 * - 错误处理
 */

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { InboxTabId } from "@/lib/constants/inbox-tabs";

// ==================== 类型定义 ====================

export type InboxCounts = Record<InboxTabId, number>;

interface UseInboxCountsReturn {
  counts: InboxCounts;
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<InboxCounts | undefined>;
}

// ==================== 数据获取 ====================

async function fetchInboxCounts(): Promise<InboxCounts> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("未登录");
  }

  // 基础查询条件
  const baseQuery = () =>
    supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .eq("is_in_trash", false);

  // 并行查询各 Tab 计数
  const [uncategorized, unread, highValue, broken, recent] = await Promise.all([
    // 待分类：folder_id 为 null
    baseQuery().is("folder_id", null),

    // 未读
    baseQuery().eq("is_read", false),

    // 高价值：quality_score >= 0.7
    baseQuery().gte("quality_score", 0.7),

    // 已失效
    baseQuery().eq("link_status", "broken"),

    // 最近7天
    baseQuery().gte(
      "created_at",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    ),
  ]);

  return {
    uncategorized: uncategorized.count ?? 0,
    unread: unread.count ?? 0,
    "high-value": highValue.count ?? 0,
    broken: broken.count ?? 0,
    recent: recent.count ?? 0,
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

export function useInboxCounts(): UseInboxCountsReturn {
  const { data, error, isLoading, mutate } = useSWR<InboxCounts, Error>(
    "inbox-counts",
    fetchInboxCounts,
    {
      refreshInterval: 30000, // 30秒自动刷新
      revalidateOnFocus: true,
      dedupingInterval: 5000, // 5秒内去重
      errorRetryCount: 2,
    },
  );

  return {
    counts: data ?? EMPTY_COUNTS,
    isLoading,
    error,
    refresh: mutate,
  };
}
