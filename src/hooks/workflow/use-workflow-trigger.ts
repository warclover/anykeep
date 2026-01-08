"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";

interface TriggerResult {
  success: boolean;
  executionId?: string;
  error?: string;
}

interface UseWorkflowTriggerReturn {
  triggerWorkflow: (
    workflowId: string,
    context?: Record<string, unknown>,
  ) => Promise<TriggerResult>;
  isLoading: boolean;
  loadingWorkflowId: string | null;
  lastExecutionId: string | null;
}

/**
 * 工作流触发 Hook
 *
 * 用于触发工作流执行并跟踪加载状态
 */
export function useWorkflowTrigger(): UseWorkflowTriggerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingWorkflowId, setLoadingWorkflowId] = useState<string | null>(
    null,
  );
  const [lastExecutionId, setLastExecutionId] = useState<string | null>(null);

  const triggerWorkflow = useCallback(
    async (
      workflowId: string,
      triggerContext: Record<string, unknown> = {},
    ): Promise<TriggerResult> => {
      setIsLoading(true);
      setLoadingWorkflowId(workflowId);

      try {
        const response = await fetch("/api/workflow/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflowId, triggerContext }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.message || "启动工作流失败");
        }

        setLastExecutionId(data.executionId);

        toast.success("工作流已启动", {
          description: `执行 ID: ${data.executionId.slice(0, 8)}...`,
          action: {
            label: "查看进度",
            onClick: () => {
              // 触发打开进度面板的回调
              window.dispatchEvent(
                new CustomEvent("workflow:show-progress", {
                  detail: { executionId: data.executionId },
                }),
              );
            },
          },
        });

        return { success: true, executionId: data.executionId };
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误";

        toast.error("启动失败", { description: message });

        return { success: false, error: message };
      } finally {
        setIsLoading(false);
        setLoadingWorkflowId(null);
      }
    },
    [],
  );

  return {
    triggerWorkflow,
    isLoading,
    loadingWorkflowId,
    lastExecutionId,
  };
}
