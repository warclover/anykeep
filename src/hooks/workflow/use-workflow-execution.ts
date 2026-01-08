"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useWorkflowSSE } from "./use-workflow-sse";
import { logger } from "@/lib/logger";

export interface ExecutionStep {
  stepId: string;
  stepName: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  output?: unknown;
  error?: string;
  duration?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  userId: string;
  status:
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "waiting_confirmation";
  triggerType: string;
  triggerContext: Record<string, unknown>;
  currentStepIndex: number;
  steps: ExecutionStep[];
  totalSteps: number;
  progress: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

interface UseWorkflowExecutionOptions {
  /** 是否启用实时更新（默认 true） */
  realtime?: boolean;
  /** 首选 SSE，不可用时降级为轮询（默认 true） */
  preferSSE?: boolean;
  /** 轮询间隔（毫秒，默认 1000，仅降级时使用） */
  pollingInterval?: number;
  /** 完成回调 */
  onComplete?: (execution: WorkflowExecution) => void;
  /** 失败回调 */
  onError?: (execution: WorkflowExecution) => void;
}

interface UseWorkflowExecutionReturn {
  execution: WorkflowExecution | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
  cancelExecution: () => Promise<boolean>;
}

const fetcher = async (url: string): Promise<WorkflowExecution> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch execution");
  }
  return res.json();
};

/**
 * 工作流执行状态 Hook
 *
 * 用于获取和轮询工作流执行状态，支持 SSE 实时更新
 */
export function useWorkflowExecution(
  executionId: string | null,
  options: UseWorkflowExecutionOptions = {},
): UseWorkflowExecutionReturn {
  const {
    realtime = true,
    preferSSE = true,
    pollingInterval = 1000,
    onComplete,
    onError,
  } = options;

  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [isSSEActive, setIsSSEActive] = useState(false);

  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const prevStatusRef = useRef<string | null>(null);

  // 更新 refs
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  // SSE Hook
  const {
    isFallback: sseFallback,
    addExecutionId,
    removeExecutionId,
  } = useWorkflowSSE({
    enabled: realtime && preferSSE,
    onExecutionUpdate: (id, exec) => {
      if (id === executionId) {
        setExecution(exec);
        setIsSSEActive(true);
      }
    },
    onFallbackToPolling: () => {
      setIsSSEActive(false);
    },
  });

  // 添加/移除 SSE 监听
  useEffect(() => {
    if (executionId && preferSSE) {
      addExecutionId(executionId);
      return () => removeExecutionId(executionId);
    }
  }, [executionId, preferSSE, addExecutionId, removeExecutionId]);

  // SWR 轮询（仅当 SSE 降级时启用）
  const shouldPoll = realtime && (!preferSSE || sseFallback);

  const { data, error, isLoading, mutate } = useSWR<WorkflowExecution>(
    executionId ? `/api/workflow/execution/${executionId}` : null,
    fetcher,
    {
      refreshInterval: (latestData) => {
        if (!shouldPoll) return 0;
        if (!latestData) return pollingInterval;
        const isActive = [
          "pending",
          "running",
          "waiting_confirmation",
        ].includes(latestData.status);
        return isActive ? pollingInterval : 0;
      },
      revalidateOnFocus: false,
    },
  );

  // 同步 SWR 数据到 execution（仅轮询模式）
  useEffect(() => {
    if (!isSSEActive && data) {
      setExecution(data);
    }
  }, [data, isSSEActive]);

  // 处理完成/失败回调
  useEffect(() => {
    if (!execution) return;

    const currentStatus = execution.status;

    // 仅在状态变化时触发回调
    if (currentStatus !== prevStatusRef.current) {
      prevStatusRef.current = currentStatus;

      if (currentStatus === "completed" && onCompleteRef.current) {
        onCompleteRef.current(execution);
      }

      if (currentStatus === "failed" && onErrorRef.current) {
        onErrorRef.current(execution);
      }
    }
  }, [execution]);

  const cancelExecution = useCallback(async (): Promise<boolean> => {
    if (!executionId) return false;

    try {
      const response = await fetch(
        `/api/workflow/execution/${executionId}/cancel`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to cancel");
      }

      const result = await response.json();
      mutate(); // 刷新状态

      return result.cancelled;
    } catch (error) {
      logger.error(
        {
          executionId,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to cancel execution",
      );
      return false;
    }
  }, [executionId, mutate]);

  return {
    execution,
    isLoading,
    error: error || null,
    refresh: () => mutate(),
    cancelExecution,
  };
}
