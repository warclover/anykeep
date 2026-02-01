"use client";

/**
 * useConfirmations Hook
 * 待确认分类建议 - 数据获取和操作逻辑
 *
 * @description
 * - 静默加载待确认消息（不显示 loading 状态）
 * - 提供确认/拒绝/修改操作
 * - 支持批量操作
 * - 计算统计数据（数量、平均置信度）
 *
 * @version 2.0.0
 * @since 2025-12-14
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import { fetchWithRetry } from "@/lib/utils/fetch-with-retry";
import { useFolders } from "@/hooks/data/use-folders";
import type {
  ConfirmationMessage,
  FolderOption,
  ApiConfirmation,
  UseConfirmationsReturn,
} from "../types";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";

// ============================================================================
// 数据转换
// ============================================================================

/**
 * 将 API 响应转换为组件使用的格式
 */
function transformApiConfirmation(c: ApiConfirmation): ConfirmationMessage {
  return {
    id: c.id,
    bookmarkId: c.bookmarkId || 0,
    bookmarkTitle:
      c.bookmark?.title || (c.metadata?.bookmarkTitle as string) || "无标题",
    bookmarkUrl: c.bookmark?.url || (c.metadata?.bookmarkUrl as string) || "",
    suggestedFolderId: c.suggestion.folderId || 0,
    suggestedFolderName: c.suggestion.folderName || "未知文件夹",
    confidence: c.suggestion.confidence,
    reason: c.suggestion.reason || "",
    status: c.status as ConfirmationMessage["status"],
    createdAt: c.createdAt,
    expiresAt: c.expiresAt || "",
  };
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useConfirmations(): UseConfirmationsReturn {
  const [messages, setMessages] = useState<ConfirmationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false); // 初始为 false，静默加载
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // 🔧 修复重复请求：复用 useFolders 的 TanStack Query 缓存
  // 之前：独立调用 /api/folders，导致多次重复请求
  // 现在：共享全局文件夹缓存，请求数从 4 次降为 1 次
  const { folders: cachedFolders } = useFolders();

  // 转换为 FolderOption 格式
  const folders: FolderOption[] = useMemo(() => {
    return cachedFolders.map((f) => ({
      id: f.id,
      name: f.name,
    }));
  }, [cachedFolders]);

  // ============================================================================
  // 统计计算
  // ============================================================================

  const count = messages.length;

  const averageConfidence = useMemo(() => {
    if (messages.length === 0) return 0;
    const total = messages.reduce((sum, m) => sum + m.confidence, 0);
    return Math.round(total / messages.length);
  }, [messages]);

  // ============================================================================
  // 数据获取
  // ============================================================================

  const fetchConfirmations = useCallback(async () => {
    // 首次加载不显示 loading，后续刷新也静默
    if (isInitialized) {
      // 可选：后续刷新时可以显示轻微的 loading 状态
    }

    try {
      setError(null);

      // 🔧 优化：只获取 confirmations，folders 已通过 useFolders Hook 共享缓存
      const confirmationsRes = await fetchWithRetry(
        API_CLASSIFICATION.confirmations + "?status=pending",
        undefined,
        { requestId: "confirmations-list-v2" },
      );

      if (confirmationsRes.ok) {
        const confirmationsData = await confirmationsRes.json();
        const confirmations = confirmationsData.data?.confirmations || [];
        setMessages(confirmations.map(transformApiConfirmation));
      } else {
        throw new Error("获取确认消息失败");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加载失败";
      setError(errorMessage);
      clientLogger.error({ error: err }, "Failed to fetch confirmations");
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // 初始加载
  useEffect(() => {
    fetchConfirmations();
  }, [fetchConfirmations]);

  // ============================================================================
  // 单条操作
  // ============================================================================

  const confirm = useCallback(async (messageId: number) => {
    try {
      const res = await fetchWithRetry(
        API_CLASSIFICATION.confirmationDetail(messageId.toString()),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm" }),
        },
        { requestId: `confirm-${messageId}` },
      );

      if (!res.ok) throw new Error("确认失败");

      // 从列表中移除
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success("分类已确认");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "操作失败";
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const reject = useCallback(async (messageId: number) => {
    try {
      const res = await fetchWithRetry(
        API_CLASSIFICATION.confirmationDetail(messageId.toString()),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reject" }),
        },
        { requestId: `reject-${messageId}` },
      );

      if (!res.ok) throw new Error("拒绝失败");

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success("已忽略此建议");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "操作失败";
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const modify = useCallback(async (messageId: number, newFolderId: number) => {
    try {
      const res = await fetchWithRetry(
        API_CLASSIFICATION.confirmationDetail(messageId.toString()),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm",
            selectedFolderId: newFolderId,
          }),
        },
        { requestId: `modify-${messageId}` },
      );

      if (!res.ok) throw new Error("修改失败");

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success("分类已修改");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "操作失败";
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  // ============================================================================
  // 批量操作
  // ============================================================================

  const confirmAll = useCallback(
    async (ids?: number[]) => {
      const targetIds = ids || messages.map((m) => m.id);
      if (targetIds.length === 0) return;

      try {
        const res = await fetchWithRetry(
          API_CLASSIFICATION.confirmationsBatch,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actions: targetIds.map((id) => ({
                confirmationId: id,
                action: "confirm",
              })),
            }),
          },
          { requestId: "batch-confirm-v2" },
        );

        if (!res.ok) throw new Error("批量确认失败");

        const result = await res.json();
        const successCount = result.data?.summary?.success || targetIds.length;

        // 从列表中移除已确认的
        const targetIdSet = new Set(targetIds);
        setMessages((prev) => prev.filter((m) => !targetIdSet.has(m.id)));

        toast.success(`已确认 ${successCount} 条分类`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "操作失败";
        toast.error(errorMessage);
        throw err;
      }
    },
    [messages],
  );

  const rejectAll = useCallback(
    async (ids?: number[]) => {
      const targetIds = ids || messages.map((m) => m.id);
      if (targetIds.length === 0) return;

      try {
        const res = await fetchWithRetry(
          API_CLASSIFICATION.confirmationsBatch,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actions: targetIds.map((id) => ({
                confirmationId: id,
                action: "reject",
              })),
            }),
          },
          { requestId: "batch-reject-v2" },
        );

        if (!res.ok) throw new Error("批量忽略失败");

        const result = await res.json();
        const successCount = result.data?.summary?.success || targetIds.length;

        const targetIdSet = new Set(targetIds);
        setMessages((prev) => prev.filter((m) => !targetIdSet.has(m.id)));

        toast.success(`已忽略 ${successCount} 条建议`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "操作失败";
        toast.error(errorMessage);
        throw err;
      }
    },
    [messages],
  );

  // ============================================================================
  // 返回
  // ============================================================================

  return {
    messages,
    folders,
    isLoading,
    error,
    count,
    averageConfidence,
    confirm,
    reject,
    modify,
    confirmAll,
    rejectAll,
    refresh: fetchConfirmations,
  };
}
