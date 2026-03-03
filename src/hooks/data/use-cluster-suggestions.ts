/**
 * 聚类建议（inbox?type=suggestions）TanStack Query Hook
 *
 * 用于 ClusterSuggestionsPanel，使用 TanStack Query 去重请求。
 *
 * @version 1.0.0
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { inboxKeys } from "@/hooks/queries/keys";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";
import type { ClusterProcessingStatus } from "@/lib/classification/types/suggestion";

export interface ClusterSuggestionItem {
  id: number;
  suggestedFolderName: string;
  bookmarkIds: number[];
  sampleTitles: string[];
  confidence: number;
  reason: string | null;
  createdAt: string;
}

interface ClusterSuggestionsData {
  suggestions: ClusterSuggestionItem[];
  clusterStatus: ClusterProcessingStatus | null;
}

const STALE_TIME_MS = 60 * 1000;

async function fetchClusterSuggestions(): Promise<ClusterSuggestionsData> {
  const response = await fetch(`${API_CLASSIFICATION.inbox}?type=suggestions`);
  if (!response.ok) {
    throw new Error("加载聚类建议失败");
  }
  const data = await response.json();
  return {
    suggestions: data.data?.suggestions ?? [],
    clusterStatus: data.data?.clusterStatus ?? null,
  };
}

export function useClusterSuggestions(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};
  const queryClient = useQueryClient();
  const key = inboxKeys.suggestions();

  const query = useQuery({
    queryKey: key,
    queryFn: fetchClusterSuggestions,
    enabled,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
  };

  return {
    suggestions: query.data?.suggestions ?? [],
    clusterStatus: query.data?.clusterStatus ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
    refresh,
  };
}
