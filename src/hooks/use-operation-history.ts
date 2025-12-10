"use client";

/**
 * useOperationHistory Hook (V4.2)
 * 管理 AI 文件夹操作历史
 */

import { useState, useCallback } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { OperationDetail, OperationSnapshotAction } from "@/types/supabase";

/**
 * 操作历史 API 响应
 */
interface OperationHistoryResponse {
  success: boolean;
  data?: {
    operations: OperationDetail[];
    undoableCount: number;
    total: number;
  };
  error?: string;
}

/**
 * 撤销 API 响应
 */
interface UndoResponse {
  success: boolean;
  data?: {
    message: string;
    restoredFolders?: number[];
    restoredBookmarks?: number[];
  };
  error?: string;
}

/**
 * Hook 选项
 */
interface UseOperationHistoryOptions {
  limit?: number;
  includeUndone?: boolean;
  includeExpired?: boolean;
  actionFilter?: OperationSnapshotAction[];
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * Hook 返回值
 */
interface UseOperationHistoryReturn {
  operations: OperationDetail[];
  isLoading: boolean;
  error: Error | null;
  undoableCount: number;
  undoOperation: (id: string) => Promise<boolean>;
  refresh: () => void;
  isUndoing: boolean;
}

/**
 * Fetcher 函数
 */
async function fetcher(url: string): Promise<OperationHistoryResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("获取操作历史失败");
  }
  return res.json();
}

/**
 * 构建查询 URL
 */
function buildQueryUrl(options: UseOperationHistoryOptions): string {
  const params = new URLSearchParams();

  if (options.limit) {
    params.set("limit", String(options.limit));
  }
  if (options.includeUndone) {
    params.set("includeUndone", "true");
  }
  if (options.includeExpired) {
    params.set("includeExpired", "true");
  }
  if (options.actionFilter && options.actionFilter.length > 0) {
    params.set("action", options.actionFilter.join(","));
  }

  const query = params.toString();
  return `/api/folder-evolution/history${query ? `?${query}` : ""}`;
}

/**
 * 操作历史 Hook
 */
export function useOperationHistory(
  options: UseOperationHistoryOptions = {}
): UseOperationHistoryReturn {
  const {
    limit = 50,
    includeUndone = false,
    includeExpired = false,
    actionFilter,
    autoRefresh = false,
    refreshInterval = 30000, // 30 秒
  } = options;

  const [isUndoing, setIsUndoing] = useState(false);

  // 构建请求 URL
  const url = buildQueryUrl({
    limit,
    includeUndone,
    includeExpired,
    actionFilter,
  });

  // 使用 SWR 获取数据
  const { data, error, mutate } = useSWR<OperationHistoryResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: autoRefresh ? refreshInterval : 0,
    }
  );

  // 提取数据
  const operations = data?.data?.operations || [];
  const undoableCount = data?.data?.undoableCount || 0;

  /**
   * 执行撤销操作
   */
  const undoOperation = useCallback(
    async (id: string): Promise<boolean> => {
      setIsUndoing(true);

      try {
        const response = await fetch(`/api/folder-evolution/undo/${id}`, {
          method: "POST",
        });

        const result: UndoResponse = await response.json();

        if (!result.success) {
          toast.error(result.error || "撤销操作失败");
          return false;
        }

        // 显示成功提示
        toast.success(result.data?.message || "操作已撤销");

        // 刷新列表
        await mutate();

        return true;
      } catch (err) {
        console.error("[useOperationHistory] Undo failed:", err);
        toast.error("撤销操作失败，请稍后重试");
        return false;
      } finally {
        setIsUndoing(false);
      }
    },
    [mutate]
  );

  /**
   * 手动刷新
   */
  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    operations,
    isLoading: !data && !error,
    error: error || (data?.success === false ? new Error(data.error) : null),
    undoableCount,
    undoOperation,
    refresh,
    isUndoing,
  };
}

// 导出默认值
export default useOperationHistory;
