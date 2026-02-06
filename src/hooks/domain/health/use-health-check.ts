/**
 * 健康检测 Hooks
 *
 * @version 2.0.0 - 迁移到 TanStack Query
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { healthKeys } from "@/hooks/queries/keys";
import type {
  HealthOverview,
  BrokenLinkIssue,
  DuplicateGroup,
  StaleContentItem,
} from "@/lib/ai-skills/skills/health-check/types";

// ============================================
// 常量
// ============================================

/** 缓存时间：30 秒 */
const STALE_TIME = 30 * 1000;

// ============================================
// Fetcher
// ============================================

const fetcher = async <T>(url: string): Promise<T> => {
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
  const { data, error, isLoading, refetch } = useQuery<HealthOverview>({
    queryKey: healthKeys.overview(),
    queryFn: () => fetcher<HealthOverview>("/api/content-health"),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  return {
    overview: data,
    isLoading,
    error: error?.message,
    refresh: refetch,
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
  const { data, error, isLoading, refetch } = useQuery<BrokenLinksData>({
    queryKey: healthKeys.brokenLinks(page, pageSize),
    queryFn: () =>
      fetcher<BrokenLinksData>(
        `/api/health/broken-links?page=${page}&pageSize=${pageSize}`,
      ),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  return {
    brokenLinks: data?.items || [],
    total: data?.total || 0,
    isLoading,
    error: error?.message,
    refresh: refetch,
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
  const { data, error, isLoading, refetch } = useQuery<DuplicatesData>({
    queryKey: healthKeys.duplicates(page, pageSize),
    queryFn: () =>
      fetcher<DuplicatesData>(
        `/api/health/duplicates?page=${page}&pageSize=${pageSize}`,
      ),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  return {
    groups: data?.groups || [],
    totalGroups: data?.totalGroups || 0,
    totalDuplicates: data?.totalDuplicates || 0,
    isLoading,
    error: error?.message,
    refresh: refetch,
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
  const { data, error, isLoading, refetch } = useQuery<StaleContentData>({
    queryKey: healthKeys.staleContent(days, page, pageSize),
    queryFn: () =>
      fetcher<StaleContentData>(
        `/api/health/stale?days=${days}&page=${page}&pageSize=${pageSize}`,
      ),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  return {
    staleContent: data?.items || [],
    total: data?.total || 0,
    thresholds: data?.thresholds,
    isLoading,
    error: error?.message,
    refresh: refetch,
  };
}

// ============================================
// 健康扫描 Hook
// ============================================

interface ScanStatus {
  lastRun: {
    id: string;
    status: "running" | "completed" | "failed";
    progress: number;
    totalChecked: number;
    brokenLinksCount: number;
    duplicatesCount: number;
    staleCount: number;
    startedAt: string;
    completedAt: string | null;
  } | null;
  totalIssues: number;
}

interface ScanResult {
  runId: string;
  duplicatesFound: number;
  brokenLinksChecked: number;
  scanDuration: number;
  timestamp: string;
}

export function useHealthScan() {
  const queryClient = useQueryClient();

  const { data, error, isLoading, refetch } = useQuery<ScanStatus>({
    queryKey: healthKeys.scanStatus(),
    queryFn: () => fetcher<ScanStatus>("/api/health/scan"),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const startScan = useCallback(
    async (checkTypes: string[] = ["duplicate", "broken_link"]) => {
      const res = await fetch("/api/health/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ checkTypes }),
      });

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "扫描失败");
      }

      // 刷新所有健康检查数据
      await queryClient.invalidateQueries({ queryKey: healthKeys.all });

      return result.data as ScanResult;
    },
    [queryClient],
  );

  return {
    scanStatus: data,
    isLoading,
    error: error?.message,
    refresh: refetch,
    startScan,
  };
}

// ============================================
// 修复操作 Hook
// ============================================

export function useHealthFix() {
  const queryClient = useQueryClient();

  const invalidateHealth = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: healthKeys.all });
  }, [queryClient]);

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

    // 刷新健康检查数据
    await invalidateHealth();

    return data.data;
  };

  return {
    fixBrokenLinks: (action: string, issueIds: string[]) =>
      executeFix("/api/health/broken-links", action, { issueIds }),

    fixDuplicates: (
      action: string,
      params: {
        groupId?: string;
        keepBookmarkId?: number | null;
        deleteBookmarkIds?: number[];
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

      // 刷新健康检查数据
      await invalidateHealth();

      return data.data;
    },
  };
}
