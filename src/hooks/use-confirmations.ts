/**
 * Use Confirmations Hook
 * V4.2 待确认消息管理 Hook
 *
 * @description 提供待确认消息的获取、响应、统计功能
 * - 获取待确认消息列表
 * - 响应确认（确认/拒绝/选择其他）
 * - 批量操作
 * - 实时统计
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useAbortableFetch } from "./use-abortable-fetch";
import type {
  ConfirmationMessageDisplay,
  ConfirmationStatus,
  ConfirmationType,
  ClassificationChoice,
  FolderOperationChoice,
} from "@/types/confirmation";

// ============================================================================
// 类型定义
// ============================================================================

export interface UseConfirmationsOptions {
  /** 状态筛选 */
  status?: ConfirmationStatus;
  /** 类型筛选 */
  type?: ConfirmationType;
  /** 仅待确认 */
  pendingOnly?: boolean;
  /** 每页数量 */
  limit?: number;
  /** 自动刷新间隔（毫秒），0 表示不自动刷新 */
  autoRefreshInterval?: number;
}

export interface ConfirmationTypeCounts {
  classification: number;
  folder_create: number;
  folder_merge: number;
  folder_split: number;
  folder_rename: number;
}

export interface UseConfirmationsReturn {
  /** 确认消息列表 */
  confirmations: ConfirmationMessageDisplay[];
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 待确认总数 */
  pendingCount: number;
  /** 各类型待确认数量 */
  typeCounts: Partial<ConfirmationTypeCounts>;
  /** 分页信息 */
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  /** 刷新列表 */
  refresh: () => Promise<void>;
  /** 加载更多 */
  loadMore: () => Promise<void>;
  /** 确认分类 */
  confirmClassification: (
    id: number,
    choice: ClassificationChoice,
  ) => Promise<boolean>;
  /** 确认文件夹操作 */
  confirmFolderOperation: (
    id: number,
    choice: FolderOperationChoice,
  ) => Promise<boolean>;
  /** 拒绝确认 */
  reject: (id: number) => Promise<boolean>;
  /** 批量确认 */
  batchConfirm: (ids: number[]) => Promise<{ success: number; failed: number }>;
  /** 批量拒绝 */
  batchReject: (ids: number[]) => Promise<{ success: number; failed: number }>;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useConfirmations(
  options: UseConfirmationsOptions = {},
): UseConfirmationsReturn {
  const {
    status,
    type,
    pendingOnly = true,
    limit = 20,
    autoRefreshInterval = 0,
  } = options;

  const { fetchWithAbort } = useAbortableFetch();

  // 状态
  const [confirmations, setConfirmations] = useState<
    ConfirmationMessageDisplay[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [typeCounts, setTypeCounts] = useState<Partial<ConfirmationTypeCounts>>(
    {},
  );
  const [pagination, setPagination] = useState({
    total: 0,
    limit,
    offset: 0,
    hasMore: false,
  });

  // 构建查询参数
  const buildQueryParams = useCallback(
    (offset: number = 0) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (status) params.set("status", status);
      if (type) params.set("type", type);
      if (pendingOnly) params.set("pendingOnly", "true");
      return params.toString();
    },
    [limit, status, type, pendingOnly],
  );

  // 加载确认消息
  const loadConfirmations = useCallback(
    async (offset: number = 0, append: boolean = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const queryString = buildQueryParams(offset);
        const res = await fetchWithAbort(`/api/confirmations?${queryString}`);

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "加载失败");
        }

        const data = await res.json();

        if (data.success) {
          const newConfirmations = data.confirmations || [];

          setConfirmations((prev) =>
            append ? [...prev, ...newConfirmations] : newConfirmations,
          );
          setPendingCount(data.pendingCount || 0);
          setPagination({
            total: data.total || 0,
            limit: data.limit || limit,
            offset: data.offset || offset,
            hasMore: offset + newConfirmations.length < (data.total || 0),
          });

          // 计算各类型数量（如果后端没有提供）
          if (!data.typeCounts) {
            const counts: Partial<ConfirmationTypeCounts> = {};
            for (const conf of newConfirmations) {
              const t = conf.type as keyof ConfirmationTypeCounts;
              counts[t] = (counts[t] || 0) + 1;
            }
            setTypeCounts(counts);
          } else {
            setTypeCounts(data.typeCounts);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "加载失败";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [buildQueryParams, fetchWithAbort, limit],
  );

  // 初始加载
  useEffect(() => {
    loadConfirmations(0, false);
  }, [loadConfirmations]);

  // 自动刷新
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const interval = setInterval(() => {
      loadConfirmations(0, false);
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [autoRefreshInterval, loadConfirmations]);

  // 刷新
  const refresh = useCallback(async () => {
    await loadConfirmations(0, false);
  }, [loadConfirmations]);

  // 加载更多
  const loadMore = useCallback(async () => {
    if (!pagination.hasMore || isLoading) return;
    await loadConfirmations(pagination.offset + pagination.limit, true);
  }, [loadConfirmations, pagination, isLoading]);

  // 确认分类
  const confirmClassification = useCallback(
    async (id: number, choice: ClassificationChoice): Promise<boolean> => {
      try {
        const res = await fetchWithAbort(`/api/confirmations/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedFolderId: choice.selectedFolderId,
            newFolderName: choice.newFolderName,
            feedback: choice.feedback,
            comment: choice.comment,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "确认失败");
        }

        // 更新本地状态
        setConfirmations((prev) => prev.filter((c) => c.id !== id));
        setPendingCount((prev) => Math.max(0, prev - 1));

        return true;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return false;
        const message = err instanceof Error ? err.message : "确认失败";
        toast.error(message);
        return false;
      }
    },
    [fetchWithAbort],
  );

  // 确认文件夹操作
  const confirmFolderOperation = useCallback(
    async (id: number, choice: FolderOperationChoice): Promise<boolean> => {
      try {
        const res = await fetchWithAbort(`/api/confirmations/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accepted: choice.accepted,
            modifications: choice.modifications,
            comment: choice.comment,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "确认失败");
        }

        // 更新本地状态
        setConfirmations((prev) => prev.filter((c) => c.id !== id));
        setPendingCount((prev) => Math.max(0, prev - 1));

        return true;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return false;
        const message = err instanceof Error ? err.message : "确认失败";
        toast.error(message);
        return false;
      }
    },
    [fetchWithAbort],
  );

  // 拒绝
  const reject = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        const res = await fetchWithAbort(`/api/confirmations/${id}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "拒绝失败");
        }

        // 更新本地状态
        setConfirmations((prev) => prev.filter((c) => c.id !== id));
        setPendingCount((prev) => Math.max(0, prev - 1));

        return true;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return false;
        const message = err instanceof Error ? err.message : "拒绝失败";
        toast.error(message);
        return false;
      }
    },
    [fetchWithAbort],
  );

  // 批量确认
  const batchConfirm = useCallback(
    async (ids: number[]): Promise<{ success: number; failed: number }> => {
      try {
        const res = await fetchWithAbort("/api/confirmations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm",
            confirmationIds: ids,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "批量确认失败");
        }

        const data = await res.json();

        // 更新本地状态
        setConfirmations((prev) => prev.filter((c) => !ids.includes(c.id)));
        setPendingCount((prev) => Math.max(0, prev - data.success));

        return { success: data.success || 0, failed: data.failed || 0 };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return { success: 0, failed: ids.length };
        }
        const message = err instanceof Error ? err.message : "批量确认失败";
        toast.error(message);
        return { success: 0, failed: ids.length };
      }
    },
    [fetchWithAbort],
  );

  // 批量拒绝
  const batchReject = useCallback(
    async (ids: number[]): Promise<{ success: number; failed: number }> => {
      try {
        const res = await fetchWithAbort("/api/confirmations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            confirmationIds: ids,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "批量拒绝失败");
        }

        const data = await res.json();

        // 更新本地状态
        setConfirmations((prev) => prev.filter((c) => !ids.includes(c.id)));
        setPendingCount((prev) => Math.max(0, prev - data.success));

        return { success: data.success || 0, failed: data.failed || 0 };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return { success: 0, failed: ids.length };
        }
        const message = err instanceof Error ? err.message : "批量拒绝失败";
        toast.error(message);
        return { success: 0, failed: ids.length };
      }
    },
    [fetchWithAbort],
  );

  return {
    confirmations,
    isLoading,
    error,
    pendingCount,
    typeCounts,
    pagination,
    refresh,
    loadMore,
    confirmClassification,
    confirmFolderOperation,
    reject,
    batchConfirm,
    batchReject,
  };
}

export default useConfirmations;
