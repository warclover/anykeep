"use client";

import useSWR from "swr";

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  category: "builtin" | "user_defined";
  version: string;
  stepCount: number;
  triggers: Array<{
    type: string;
  }>;
}

interface UseWorkflowListReturn {
  workflows: WorkflowSummary[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

const fetcher = async (
  url: string,
): Promise<{ workflows: WorkflowSummary[] }> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch workflows");
  }
  return res.json();
};

/**
 * 工作流列表 Hook
 *
 * 获取用户可用的工作流列表
 */
export function useWorkflowList(): UseWorkflowListReturn {
  const { data, error, isLoading, mutate } = useSWR("/api/workflow", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 1 分钟去重
  });

  return {
    workflows: data?.workflows || [],
    isLoading,
    error: error || null,
    refresh: () => mutate(),
  };
}
