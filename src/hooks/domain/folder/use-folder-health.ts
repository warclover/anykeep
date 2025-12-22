/**
 * V4.2 文件夹健康检查 Hook
 * 管理文件夹健康状态的获取和建议执行
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

// ============================================================================
// 类型定义
// ============================================================================

export type FolderHealthStatus = "healthy" | "needs_attention" | "critical";

export interface MergeSuggestion {
  folder1: {
    id: number;
    name: string;
    bookmarkCount: number;
  };
  folder2: {
    id: number;
    name: string;
    bookmarkCount: number;
  };
  similarity: number;
  reason: string;
  suggestedAction: "merge_to_first" | "merge_to_second" | "rename_and_merge";
}

export interface SplitSuggestion {
  folderId: number;
  folderName: string;
  bookmarkCount: number;
  internalSimilarity: number;
  reason: string;
  suggestedClusters?: number;
}

export interface FolderHealthReport {
  status: FolderHealthStatus;
  totalFolders: number;
  healthyFolders: number;
  foldersNeedingAttention: number;
  mergeSuggestions: MergeSuggestion[];
  splitSuggestions: SplitSuggestion[];
  analyzedAt: string;
}

interface UseFolderHealthOptions {
  autoFetch?: boolean;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useFolderHealth(options: UseFolderHealthOptions = {}) {
  const { autoFetch = true } = options;

  const [report, setReport] = useState<FolderHealthReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取健康报告
  const fetchReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/classification/folder-health");

      if (!response.ok) {
        throw new Error("获取健康报告失败");
      }

      const result = await response.json();

      if (result.success) {
        setReport(result.data);
      } else {
        throw new Error(result.error?.message || "获取健康报告失败");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "获取健康报告失败";
      setError(message);
      console.error("[useFolderHealth] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 执行合并
  const executeMerge = useCallback(
    async (
      sourceFolderIds: number[],
      targetFolderId: number,
      newName?: string,
    ): Promise<boolean> => {
      setIsProcessing(true);
      try {
        const response = await fetch("/api/folder-evolution/confirm-merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceFolderIds,
            targetFolderId,
            newName,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "合并失败");
        }

        toast.success(result.message || "文件夹合并成功");

        // 刷新报告
        await fetchReport();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "合并失败";
        toast.error(message);
        console.error("[useFolderHealth] merge error:", err);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [fetchReport],
  );

  // 执行拆分
  const executeSplit = useCallback(
    async (
      folderId: number,
      subClusters: Array<{ name: string; bookmarkIds: number[] }>,
    ): Promise<boolean> => {
      setIsProcessing(true);
      try {
        const response = await fetch("/api/folder-evolution/confirm-split", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderId,
            subClusters,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "拆分失败");
        }

        toast.success(result.message || "文件夹拆分成功");

        // 刷新报告
        await fetchReport();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "拆分失败";
        toast.error(message);
        console.error("[useFolderHealth] split error:", err);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [fetchReport],
  );

  // 忽略建议（从本地状态移除）
  const dismissMergeSuggestion = useCallback(
    (folder1Id: number, folder2Id: number) => {
      setReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          mergeSuggestions: prev.mergeSuggestions.filter(
            (s) =>
              !(s.folder1.id === folder1Id && s.folder2.id === folder2Id) &&
              !(s.folder1.id === folder2Id && s.folder2.id === folder1Id),
          ),
          foldersNeedingAttention: prev.foldersNeedingAttention - 1,
        };
      });
      toast.success("已忽略该合并建议");
    },
    [],
  );

  const dismissSplitSuggestion = useCallback((folderId: number) => {
    setReport((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        splitSuggestions: prev.splitSuggestions.filter(
          (s) => s.folderId !== folderId,
        ),
        foldersNeedingAttention: prev.foldersNeedingAttention - 1,
      };
    });
    toast.success("已忽略该拆分建议");
  }, []);

  // 初始加载
  useEffect(() => {
    if (autoFetch) {
      fetchReport();
    }
  }, [autoFetch, fetchReport]);

  return {
    // 数据
    report,
    status: report?.status || "healthy",
    totalFolders: report?.totalFolders || 0,
    healthyFolders: report?.healthyFolders || 0,
    mergeSuggestions: report?.mergeSuggestions || [],
    splitSuggestions: report?.splitSuggestions || [],
    hasSuggestions:
      (report?.mergeSuggestions?.length || 0) +
        (report?.splitSuggestions?.length || 0) >
      0,

    // 状态
    isLoading,
    isProcessing,
    error,

    // 操作
    refresh: fetchReport,
    executeMerge,
    executeSplit,
    dismissMergeSuggestion,
    dismissSplitSuggestion,
  };
}

export default useFolderHealth;
