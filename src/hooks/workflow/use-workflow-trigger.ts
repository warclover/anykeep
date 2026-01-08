"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface TriggerResult {
  success: boolean;
  executionId?: string;
  error?: string;
}

interface UseWorkflowTriggerOptions {
  /** 工作流启动成功后回调 */
  onExecutionStart?: (executionId: string, workflowId: string) => void;
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
 * 错误消息映射
 */
function getErrorInfo(error: unknown): {
  title: string;
  description: string;
} {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("network") || message.includes("fetch")) {
      return {
        title: "网络错误",
        description: "请检查网络连接后重试",
      };
    }

    if (message.includes("unauthorized") || message.includes("401")) {
      return {
        title: "认证失败",
        description: "请重新登录后再试",
      };
    }

    if (message.includes("not found") || message.includes("404")) {
      return {
        title: "工作流不存在",
        description: "请刷新页面后重试",
      };
    }

    return {
      title: "启动失败",
      description: error.message,
    };
  }

  return {
    title: "启动失败",
    description: "未知错误，请稍后重试",
  };
}

/**
 * 工作流触发 Hook
 *
 * 用于触发工作流执行并跟踪加载状态
 */
export function useWorkflowTrigger(
  options: UseWorkflowTriggerOptions = {},
): UseWorkflowTriggerReturn {
  const { onExecutionStart } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [loadingWorkflowId, setLoadingWorkflowId] = useState<string | null>(
    null,
  );
  const [lastExecutionId, setLastExecutionId] = useState<string | null>(null);

  // 使用 ref 避免闭包问题
  const onExecutionStartRef = useRef(onExecutionStart);
  onExecutionStartRef.current = onExecutionStart;

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

        logger.info(
          { workflowId, executionId: data.executionId },
          "Workflow triggered successfully",
        );

        toast.success("工作流已启动", {
          description: `执行 ID: ${data.executionId.slice(0, 8)}...`,
          action: {
            label: "查看进度",
            onClick: () => {
              // 使用回调函数，避免 SSR 环境问题
              onExecutionStartRef.current?.(data.executionId, workflowId);
            },
          },
        });

        return { success: true, executionId: data.executionId };
      } catch (error) {
        const errorInfo = getErrorInfo(error);

        logger.error(
          {
            workflowId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to trigger workflow",
        );

        toast.error(errorInfo.title, { description: errorInfo.description });

        return { success: false, error: errorInfo.description };
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
