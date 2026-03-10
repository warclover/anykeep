"use client";

/**
 * V4.2 合并建议 Hook
 * 管理文件夹合并建议的获取和执行
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import { API_FOLDER_EVOLUTION } from "@/lib/constants/api-paths";

interface FolderForMerge {
  id: number;
  name: string;
  bookmarkCount: number;
}

interface MergeSuggestion {
  folders: FolderForMerge[];
  similarity: number;
  suggestedName: string;
  totalBookmarks: number;
  sharedTags: string[];
  reason: string;
}

interface MergeResult {
  success: boolean;
  message: string;
  targetFolder?: { id: number; name: string; bookmarkCount: number };
}

interface UseMergeSuggestionsOptions {
  autoFetch?: boolean;
  minSimilarity?: number;
}

export function useMergeSuggestions(options: UseMergeSuggestionsOptions = {}) {
  const { autoFetch = true, minSimilarity = 70 } = options;

  const [suggestions, setSuggestions] = useState<MergeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取合并建议
  const fetchSuggestions = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(
        `${API_FOLDER_EVOLUTION.merge}?minSimilarity=${minSimilarity}`,
      );

      if (!response.ok) {
        throw new Error("获取合并建议失败");
      }

      const result = await response.json();
      if (result.success) {
        setSuggestions(result.data || []);
      } else {
        throw new Error(result.error || "获取合并建议失败");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "获取合并建议失败";
      setError(message);
      clientLogger.error({ err }, "[useMergeSuggestions] fetch error");
    } finally {
      setIsLoading(false);
    }
  }, [minSimilarity]);

  // 执行合并
  const executeMerge = useCallback(
    async (
      folderIds: number[],
      targetName: string,
      targetFolderId?: number,
    ): Promise<MergeResult> => {
      setIsProcessing(true);
      try {
        const response = await fetch(API_FOLDER_EVOLUTION.merge, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderIds,
            targetName,
            targetFolderId,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "合并失败");
        }

        toast.success(result.data?.message || "文件夹合并成功");

        // 刷新建议列表
        await fetchSuggestions();

        return {
          success: true,
          message: result.data?.message || "合并成功",
          targetFolder: result.data?.targetFolder,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "合并失败";
        toast.error(message);
        clientLogger.error({ err }, "[useMergeSuggestions] execute error");
        return { success: false, message };
      } finally {
        setIsProcessing(false);
      }
    },
    [fetchSuggestions],
  );

  // 忽略建议
  const dismissSuggestion = useCallback(
    async (folderIds: number[]): Promise<boolean> => {
      try {
        // 从本地状态中移除
        setSuggestions((prev) =>
          prev.filter((s) => !s.folders.every((f) => folderIds.includes(f.id))),
        );
        toast.success("已忽略该建议");
        return true;
      } catch (err) {
        clientLogger.error({ err }, "[useMergeSuggestions] dismiss error");
        return false;
      }
    },
    [],
  );

  // 初始加载 - 仅在挂载或关键参数变化时执行
  useEffect(() => {
    if (autoFetch) {
      fetchSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, minSimilarity]);

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
    executeMerge,
    dismissSuggestion,
  };
}

export default useMergeSuggestions;
