/**
 * V4.2 分拆建议 Hook
 * 管理文件夹分拆建议的获取和执行
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

interface SubCluster {
  suggestedName: string;
  bookmarkCount: number;
  bookmarkIds: number[];
  sampleTitles: string[];
  avgSimilarity: number;
}

interface SplitSuggestion {
  folderId: number;
  folderName: string;
  currentCount: number;
  internalSimilarity: number;
  subClusters: SubCluster[];
  reason: string;
}

interface SplitResult {
  success: boolean;
  message: string;
  newFolders?: Array<{ id: number; name: string; bookmarkCount: number }>;
}

interface UseSplitSuggestionsOptions {
  autoFetch?: boolean;
  folderId?: number;
}

export function useSplitSuggestions(options: UseSplitSuggestionsOptions = {}) {
  const { autoFetch = true, folderId } = options;

  const [suggestions, setSuggestions] = useState<SplitSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取分拆建议
  const fetchSuggestions = useCallback(async () => {
    try {
      setError(null);
      const url = folderId
        ? `/api/folder-evolution/split?folderId=${folderId}`
        : "/api/folder-evolution/split";

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("获取分拆建议失败");
      }

      const result = await response.json();
      if (result.success) {
        setSuggestions(result.data || []);
      } else {
        throw new Error(result.error || "获取分拆建议失败");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "获取分拆建议失败";
      setError(message);
      console.error("[useSplitSuggestions] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [folderId]);

  // 执行分拆
  const executeSplit = useCallback(
    async (
      targetFolderId: number,
      clusters: Array<{ name: string; bookmarkIds: number[] }>,
    ): Promise<SplitResult> => {
      setIsProcessing(true);
      try {
        const response = await fetch("/api/folder-evolution/split", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderId: targetFolderId,
            clusters,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "分拆失败");
        }

        toast.success(result.data?.message || "文件夹分拆成功");

        // 刷新建议列表
        await fetchSuggestions();

        return {
          success: true,
          message: result.data?.message || "分拆成功",
          newFolders: result.data?.newFolders,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "分拆失败";
        toast.error(message);
        console.error("[useSplitSuggestions] execute error:", err);
        return { success: false, message };
      } finally {
        setIsProcessing(false);
      }
    },
    [fetchSuggestions],
  );

  // 忽略建议
  const dismissSuggestion = useCallback(
    async (targetFolderId: number): Promise<boolean> => {
      try {
        // 从本地状态中移除
        setSuggestions((prev) =>
          prev.filter((s) => s.folderId !== targetFolderId),
        );
        toast.success("已忽略该建议");
        return true;
      } catch (err) {
        console.error("[useSplitSuggestions] dismiss error:", err);
        return false;
      }
    },
    [],
  );

  // 初始加载
  useEffect(() => {
    if (autoFetch) {
      fetchSuggestions();
    }
  }, [autoFetch, fetchSuggestions]);

  return {
    // 数据
    suggestions,
    hasSuggestions: suggestions.length > 0,

    // 状态
    isLoading,
    isProcessing,
    error,

    // 操作
    refresh: fetchSuggestions,
    executeSplit,
    dismissSuggestion,
  };
}

export default useSplitSuggestions;
