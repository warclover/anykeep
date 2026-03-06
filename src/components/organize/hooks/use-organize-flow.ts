"use client";

import { useState, useCallback } from "react";
import { useOrganizeComparison } from "@/hooks/domain/organize/use-organize-comparison";
import { useAIChat } from "@/hooks/domain/ai";
import { clientLogger } from "@/lib/client-logger";
import type { OrganizePageState, QuickActionType } from "@/lib/organize/types";
import type { OrganizeSnapshot } from "@/lib/organize/types";

const ACTION_MESSAGES: Record<QuickActionType, string> = {
  "one-click": "帮我一键整理收藏",
  "clean-duplicates": "清理重复的收藏",
  "smart-categorize": "智能分类未分类的收藏",
  "auto-tag": "为没有标签的收藏自动打标签",
  "archive-stale": "归档长期未读的内容",
};

const PROGRESS_STEP_THRESHOLDS = [
  { maxPercent: 15, step: 0 },
  { maxPercent: 30, step: 1 },
  { maxPercent: 50, step: 2 },
  { maxPercent: 70, step: 3 },
  { maxPercent: 90, step: 4 },
] as const;

function calculateStep(percent: number): number {
  for (const { maxPercent, step } of PROGRESS_STEP_THRESHOLDS) {
    if (percent < maxPercent) return step;
  }
  return PROGRESS_STEP_THRESHOLDS.length - 1;
}

export interface ProgressState {
  message: string;
  percent: number;
  step: number;
}

interface UseOrganizeFlowOptions {
  onAnalysisRefresh: () => Promise<void> | void;
}

export function useOrganizeFlow({ onAnalysisRefresh }: UseOrganizeFlowOptions) {
  const [state, setState] = useState<OrganizePageState>("idle");
  const [progress, setProgress] = useState<ProgressState>({
    message: "",
    percent: 0,
    step: 0,
  });
  const [organizeError, setOrganizeError] = useState<string | null>(null);

  const {
    beforeSnapshot,
    afterSnapshot,
    captureBeforeSnapshot,
    captureAfterSnapshot,
    reset: resetSnapshots,
    hasComparison,
    error: snapshotError,
  } = useOrganizeComparison();

  const { sendMessage, cancel } = useAIChat({
    onStream: (chunk) => {
      if ("type" in chunk && chunk.type === "progress") {
        const data = chunk.data as {
          step?: string;
          percent?: number;
          message?: string;
        };
        setProgress((prev) => {
          const newPercent =
            typeof data.percent === "number" ? data.percent : prev.percent;
          return {
            message: data.step ?? prev.message,
            percent: newPercent,
            step: calculateStep(newPercent),
          };
        });
      }
    },
    onComplete: async () => {
      try {
        await captureAfterSnapshot();
        await onAnalysisRefresh();
        setState("complete");
      } catch (error) {
        clientLogger.error({ error }, "Failed to capture after snapshot");
        setState("complete");
        setOrganizeError("获取整理后统计数据失败，但整理已完成");
      }
    },
    onError: (error) => {
      clientLogger.error({ error }, "Organize error");
      setOrganizeError(error.message || "整理过程中发生错误");
      setState("idle");
    },
  });

  const handleOrganizeAction = useCallback(
    async (actionType: QuickActionType) => {
      setState("analyzing");
      setProgress({ message: "正在分析您的收藏...", percent: 0, step: 0 });
      setOrganizeError(null);

      try {
        await captureBeforeSnapshot();
        setState("executing");
        await sendMessage(ACTION_MESSAGES[actionType], {
          useUnifiedEngine: true,
        });
      } catch (error) {
        clientLogger.error({ error }, "Organize action failed");
        setOrganizeError(
          error instanceof Error ? error.message : "整理操作失败",
        );
        setState("idle");
      }
    },
    [captureBeforeSnapshot, sendMessage],
  );

  const handleReset = useCallback(() => {
    setState("idle");
    setProgress({ message: "", percent: 0, step: 0 });
    setOrganizeError(null);
    resetSnapshots();
  }, [resetSnapshots]);

  const handleCancel = useCallback(() => {
    cancel();
    setState("idle");
    setProgress({ message: "", percent: 0, step: 0 });
    setOrganizeError(null);
    resetSnapshots();
  }, [cancel, resetSnapshots]);

  const isExecuting = state === "analyzing" || state === "executing";

  return {
    state,
    progress,
    organizeError,
    isExecuting,
    beforeSnapshot: beforeSnapshot as OrganizeSnapshot | null,
    afterSnapshot: afterSnapshot as OrganizeSnapshot | null,
    hasComparison,
    snapshotError,
    handleOrganizeAction,
    handleReset,
    handleCancel,
  };
}
