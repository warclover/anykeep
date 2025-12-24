/**
 * 导入历史记录 Hook
 * 提供导入历史的查询、删除和统计功能
 */

import { useState, useEffect, useCallback } from "react";
import {
  getImportHistory,
  deleteImportHistory,
  summarizeHistory,
  type ImportHistoryResult,
} from "@/lib/browser-bookmark";
import { clientLogger } from "@/lib/client-logger";
import type { ImportHistory, ImportSource } from "@/types/supabase";

// ============================================
// 类型定义
// ============================================

export interface UseImportHistoryOptions {
  /** 初始加载数量 */
  initialLimit?: number;
  /** 按来源筛选 */
  source?: ImportSource;
  /** 是否自动加载 */
  autoLoad?: boolean;
}

export interface UseImportHistoryReturn {
  /** 历史记录列表 */
  history: ImportHistory[];
  /** 总数 */
  total: number;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 统计信息 */
  stats: {
    totalImports: number;
    totalBookmarks: number;
    totalSuccess: number;
    totalFailed: number;
    totalSkipped: number;
    averageSuccessRate: number;
  };
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 加载更多 */
  loadMore: () => Promise<void>;
  /** 删除记录 */
  remove: (id: number) => Promise<void>;
  /** 按批次 ID 删除 */
  removeByBatchId: (batchId: string) => Promise<void>;
}

// ============================================
// Hook 实现
// ============================================

export function useImportHistory(
  options: UseImportHistoryOptions = {},
): UseImportHistoryReturn {
  const { initialLimit = 20, source, autoLoad = true } = options;

  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  // 加载数据
  const loadHistory = useCallback(
    async (reset = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const currentOffset = reset ? 0 : offset;
        const result: ImportHistoryResult = await getImportHistory({
          limit: initialLimit,
          offset: currentOffset,
          source,
        });

        if (reset) {
          setHistory(result.history);
          setOffset(initialLimit);
        } else {
          setHistory((prev) => [...prev, ...result.history]);
          setOffset((prev) => prev + initialLimit);
        }
        setTotal(result.total);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "加载失败";
        setError(errorMsg);
        clientLogger.error({ err }, "[ImportHistory] 加载导入历史失败");
      } finally {
        setIsLoading(false);
      }
    },
    [initialLimit, offset, source],
  );

  // 刷新
  const refresh = useCallback(async () => {
    await loadHistory(true);
  }, [loadHistory]);

  // 加载更多
  const loadMore = useCallback(async () => {
    if (isLoading || history.length >= total) return;
    await loadHistory(false);
  }, [isLoading, history.length, total, loadHistory]);

  // 删除记录
  const remove = useCallback(async (id: number) => {
    try {
      await deleteImportHistory(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "删除失败";
      setError(errorMsg);
      throw err;
    }
  }, []);

  // 按批次 ID 删除
  const removeByBatchId = useCallback(async (batchId: string) => {
    try {
      await deleteImportHistory(undefined, batchId);
      setHistory((prev) => prev.filter((h) => h.import_batch_id !== batchId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "删除失败";
      setError(errorMsg);
      throw err;
    }
  }, []);

  // 自动加载
  useEffect(() => {
    if (autoLoad) {
      loadHistory(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, source]);

  // 计算统计信息
  const stats = summarizeHistory(history);

  return {
    history,
    total,
    isLoading,
    error,
    hasMore: history.length < total,
    stats,
    refresh,
    loadMore,
    remove,
    removeByBatchId,
  };
}

export default useImportHistory;
