"use client";

import useSWR from "swr";
import type { WorkflowExecution } from "./use-workflow-execution";

interface UseExecutionHistoryOptions {
  limit?: number;
  status?: string;
}

interface UseExecutionHistoryReturn {
  executions: WorkflowExecution[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

const fetcher = async (
  url: string,
): Promise<{ executions: WorkflowExecution[] }> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch executions");
  }
  return res.json();
};

/**
 * 执行历史 Hook
 */
export function useExecutionHistory(
  options: UseExecutionHistoryOptions = {},
): UseExecutionHistoryReturn {
  const { limit = 20, status } = options;

  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (status) params.set("status", status);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/workflow/executions?${params.toString()}`,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return {
    executions: data?.executions || [],
    isLoading,
    error: error || null,
    refresh: () => mutate(),
  };
}
