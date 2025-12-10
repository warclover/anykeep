/**
 * V4.2 重命名建议 Hook
 * 管理文件夹重命名建议的获取和执行
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";

interface RenameSuggestion {
  folderId: number;
  currentName: string;
  suggestedName: string;
  confidence: number;
  reason: string;
  sampleTitles: string[];
  commonTags: string[];
}

interface RenameResult {
  success: boolean;
  message: string;
  oldName?: string;
  newName?: string;
  snapshotId?: string;
}

interface UseRenameSuggestionsOptions {
  autoFetch?: boolean;
  folderId?: number;
  limit?: number;
}

export function useRenameSuggestions(options: UseRenameSuggestionsOptions = {}) {
  const { autoFetch = true, folderId, limit = 5 } = options;

  const [suggestions, setSuggestions] = useState<RenameSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取重命名建议
  const fetchSuggestions = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (folderId) params.set("folderId", String(folderId));
      params.set("limit", String(limit));

      const url = `/api/folder-evolution/rename?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("获取重命名建议失败");
      }

      const result = await response.json();
      if (result.success) {
        setSuggestions(result.data || []);
      } else {
        throw new Error(result.error || "获取重命名建议失败");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "获取重命名建议失败";
      setError(message);
      console.error("[useRenameSuggestions] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [folderId, limit]);

  // 执行重命名
  const executeRename = useCallback(
    async (targetFolderId: number, newName: string): Promise<RenameResult> => {
      setIsProcessing(true);
      try {
        const response = await fetch("/api/folder-evolution/rename", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderId: targetFolderId,
            newName,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "重命名失败");
        }

        toast.success(result.data?.message || "文件夹重命名成功");

        // 刷新建议列表
        await fetchSuggestions();

        return {
          success: true,
          message: result.data?.message || "重命名成功",
          oldName: result.data?.oldName,
          newName: result.data?.newName,
          snapshotId: result.data?.snapshotId,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "重命名失败";
        toast.error(message);
        console.error("[useRenameSuggestions] execute error:", err);
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
        console.error("[useRenameSuggestions] dismiss error:", err);
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
    executeRename,
    dismissSuggestion,
  };
}

export default useRenameSuggestions;
