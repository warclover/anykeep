"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import { API_SYNTHESIS } from "@/lib/constants/api-paths";
import type {
  SynthesisReportSummary,
  SynthesisDepthMode,
  SynthesisOutputStyle,
} from "@/lib/synthesis";
import type { AnalysisTab } from "../types";

interface UseReportActionsOptions {
  activeTab: AnalysisTab;
  depthMode: SynthesisDepthMode;
  outputStyle: SynthesisOutputStyle;
  selectedIds: Set<number>;
  canStartAnalysis: boolean;
  refetch: () => void;
}

export function useReportActions({
  activeTab,
  depthMode,
  outputStyle,
  selectedIds,
  canStartAnalysis,
  refetch,
}: UseReportActionsOptions) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<SynthesisReportSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleStartAnalysis = useCallback(async () => {
    if (!canStartAnalysis) return;
    setIsCreating(true);

    try {
      const requestBody = {
        sourceType: "selection",
        depthMode,
        outputStyle: activeTab === "compare" ? "comparison" : outputStyle,
        bookmarkIds: Array.from(selectedIds),
      };

      const response = await fetch(API_SYNTHESIS.list, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "创建失败");
      }

      const { data: result } = await response.json();
      router.push(`/synthesis/${result.id}?generate=true`);
    } catch (error) {
      clientLogger.error({ error }, "Create analysis error:");
      toast.error("创建分析失败，请重试");
    } finally {
      setIsCreating(false);
    }
  }, [
    canStartAnalysis,
    depthMode,
    outputStyle,
    selectedIds,
    activeTab,
    router,
  ]);

  const handleDelete = useCallback((report: SynthesisReportSummary) => {
    setDeleteTarget(report);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/synthesis/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("删除失败");
      toast.success("删除成功");
      refetch();
    } catch (error) {
      clientLogger.error({ error }, "Delete synthesis error:");
      toast.error("删除失败，请重试");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, refetch]);

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleRetry = useCallback(
    async (reportId: string) => {
      try {
        const response = await fetch(`/api/synthesis/${reportId}/regenerate`, {
          method: "POST",
        });
        if (!response.ok) throw new Error("重新生成失败");
        toast.success("已开始重新生成");
        router.push(`/synthesis/${reportId}?generate=true`);
      } catch (error) {
        clientLogger.error({ error }, "Retry synthesis error:");
        toast.error("重新生成失败，请重试");
      }
    },
    [router],
  );

  return {
    isCreating,
    deleteTarget,
    isDeleting,
    handleStartAnalysis,
    handleDelete,
    confirmDelete,
    cancelDelete,
    handleRetry,
  };
}
