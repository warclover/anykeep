/**
 * 整理建议（inbox 分析）TanStack Query Hook
 *
 * 用于 OrganizationSuggestionsPanel，与 ClusterSuggestionsPanel 的请求分离。
 * 使用 TanStack Query 去重同一 key 的请求，避免 Strict Mode 或多次挂载导致重复 15s+ 请求。
 *
 * @version 1.0.0
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { inboxOrganizationKeys } from "@/hooks/queries/keys";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";
import type { OrganizationAnalysis } from "@/lib/classification";

const STALE_TIME_MS = 60 * 1000;

async function fetchInboxAnalysis(): Promise<OrganizationAnalysis | null> {
  const response = await fetch(API_CLASSIFICATION.inbox);
  const data = await response.json();
  if (!response.ok) {
    const errorMsg =
      data?.error?.message || data?.error?.details || response.statusText;
    throw new Error(errorMsg);
  }
  return data.data ?? null;
}

export function useInboxOrganizationAnalysis(options?: {
  enabled?: boolean;
  initialData?: OrganizationAnalysis | null;
}) {
  const { enabled = true, initialData } = options ?? {};
  const queryClient = useQueryClient();
  const key = inboxOrganizationKeys.analysis();

  const query = useQuery({
    queryKey: key,
    queryFn: fetchInboxAnalysis,
    enabled,
    staleTime: STALE_TIME_MS,
    initialData: initialData ?? undefined,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
  };

  const setAnalysis = (data: OrganizationAnalysis | null) => {
    queryClient.setQueryData(key, data);
  };

  return {
    analysis: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
    refresh,
    setAnalysis,
  };
}
