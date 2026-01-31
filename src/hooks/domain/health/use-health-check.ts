/**
 * 健康检测 Hooks
 */

import useSWR from "swr";
import type {
  HealthOverview,
  BrokenLinkIssue,
  DuplicateGroup,
  StaleContentItem,
} from "@/lib/ai-skills/skills/health-check/types";

// ============================================
// Fetcher
// ============================================

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "请求失败");
  }
  return data.data;
};

// ============================================
// 健康概览 Hook
// ============================================

export function useHealthOverview() {
  const { data, error, isLoading, mutate } = useSWR<HealthOverview>(
    "/api/content-health",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    },
  );

  return {
    overview: data,
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}

// ============================================
// 失效链接 Hook
// ============================================

interface BrokenLinksData {
  items: BrokenLinkIssue[];
  total: number;
  page: number;
  pageSize: number;
}

export function useBrokenLinks(page: number = 1, pageSize: number = 20) {
  const { data, error, isLoading, mutate } = useSWR<BrokenLinksData>(
    `/api/health/broken-links?page=${page}&pageSize=${pageSize}`,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return {
    brokenLinks: data?.items || [],
    total: data?.total || 0,
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}

// ============================================
// 重复内容 Hook
// ============================================

interface DuplicatesData {
  groups: DuplicateGroup[];
  totalGroups: number;
  totalDuplicates: number;
}

export function useDuplicates(page: number = 1, pageSize: number = 20) {
  const { data, error, isLoading, mutate } = useSWR<DuplicatesData>(
    `/api/health/duplicates?page=${page}&pageSize=${pageSize}`,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return {
    groups: data?.groups || [],
    totalGroups: data?.totalGroups || 0,
    totalDuplicates: data?.totalDuplicates || 0,
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}

// ============================================
// 过期内容 Hook
// ============================================

interface StaleContentData {
  items: StaleContentItem[];
  total: number;
  thresholds: {
    warning: number;
    stale: number;
    expired: number;
  };
}

export function useStaleContent(
  days: number = 90,
  page: number = 1,
  pageSize: number = 20,
) {
  const { data, error, isLoading, mutate } = useSWR<StaleContentData>(
    `/api/health/stale?days=${days}&page=${page}&pageSize=${pageSize}`,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return {
    staleContent: data?.items || [],
    total: data?.total || 0,
    thresholds: data?.thresholds,
    isLoading,
    error: error?.message,
    refresh: mutate,
  };
}

// ============================================
// 修复操作 Hook
// ============================================

export function useHealthFix() {
  const executeFix = async (
    endpoint: string,
    action: string,
    params: Record<string, unknown>,
  ) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, ...params }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "操作失败");
    }
    return data.data;
  };

  return {
    fixBrokenLinks: (action: string, issueIds: string[]) =>
      executeFix("/api/health/broken-links", action, { issueIds }),

    fixDuplicates: (
      action: string,
      params: {
        groupId?: string;
        keepBookmarkId?: string;
        deleteBookmarkIds?: string[];
      },
    ) => executeFix("/api/health/duplicates", action, params),

    fixStaleContent: (action: string, bookmarkIds: string[]) =>
      executeFix("/api/health/stale", action, { bookmarkIds }),

    quickFix: async (
      strategy: Record<string, string>,
      dryRun: boolean = false,
    ) => {
      const res = await fetch("/api/health/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ strategy, dryRun }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "一键修复失败");
      }
      return data.data;
    },
  };
}
