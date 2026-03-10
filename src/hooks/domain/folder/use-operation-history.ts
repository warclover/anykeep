"use client";

/**
 * useOperationHistory Hook (V5.0)
 * 管理 AI 文件夹操作历史
 *
 * @version 2.0.0 - 迁移到 TanStack Query
 */

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import { operationHistoryKeys } from "@/hooks/queries/keys";
import { API_FOLDER_EVOLUTION } from "@/lib/constants/api-paths";
import type {
  OperationDetail,
  OperationSnapshotAction,
} from "@/types/supabase";

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

/** 缓存时间：1 分钟 */
const STALE_TIME = 60 * 1000;

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
  options: UseOperationHistoryOptions = {},
): UseOperationHistoryReturn {
  const {
    limit = 50,
    includeUndone = false,
    includeExpired = false,
    actionFilter,
    autoRefresh = false,
    refreshInterval = 30000, // 30 秒
  } = options;

  const _queryClient = useQueryClient();
  const [isUndoing, setIsUndoing] = useState(false);

  // 构建请求 URL
  const url = buildQueryUrl({
    limit,
    includeUndone,
    includeExpired,
    actionFilter,
  });

  // 使用 TanStack Query 获取数据
  const { data, error, isLoading, refetch } =
    useQuery<OperationHistoryResponse>({
      queryKey: operationHistoryKeys.list(url),
      queryFn: () => fetcher(url),
      staleTime: STALE_TIME,
      refetchOnWindowFocus: true,
      refetchInterval: autoRefresh ? refreshInterval : undefined,
    });

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
        const response = await fetch(API_FOLDER_EVOLUTION.undo(id), {
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
        await refetch();

        return true;
      } catch (err) {
        clientLogger.error({ err }, "[useOperationHistory] Undo failed");
        toast.error("撤销操作失败，请稍后重试");
        return false;
      } finally {
        setIsUndoing(false);
      }
    },
    [refetch],
  );

  /**
   * 手动刷新
   */
  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    operations,
    isLoading,
    error: error || (data?.success === false ? new Error(data.error) : null),
    undoableCount,
    undoOperation,
    refresh,
    isUndoing,
  };
}

// 导出默认值
export default useOperationHistory;
