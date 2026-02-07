/**
 * V4.2.17: 首页批量操作 Hook
 *
 * Phase 2.3.2 - 从 home-page-client.tsx 提取
 *
 * 职责：批量删除、恢复、快照等操作
 * 特性：确认对话框 + API 调用 + 状态同步
 */

"use client";

import { useState, useCallback } from "react";
import { useAbortableFetch } from "@/hooks/core";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import type { Bookmark } from "@/types/supabase";

// 带文件夹信息的书签类型
type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

// ============================================================================
// Hook 参数类型
// ============================================================================

export interface UseHomeBatchOptions {
  /** 获取当前书签列表（用于快照回滚） */
  getBookmarks: () => BookmarkWithFolder[];
  /** 更新书签列表 */
  setBookmarks: (
    updater:
      | BookmarkWithFolder[]
      | ((prev: BookmarkWithFolder[]) => BookmarkWithFolder[]),
  ) => void;
  /** 移除缓存项（用于 SWR 缓存同步） */
  removeCacheItem?: (id: number) => void;
  /** 选中的 ID 集合 */
  selectedIds: Set<number>;
  /** 退出选择模式回调 */
  exitSelectionMode: () => void;
}

// ============================================================================
// Hook 返回类型
// ============================================================================

export interface UseHomeBatchReturn {
  /** 批量删除中状态 */
  isBatchDeleting: boolean;
  /** 批量创建快照中状态 */
  isBatchCreatingSnapshot: boolean;
  /** 批量删除（移入回收站） */
  handleBatchDelete: () => Promise<void>;
  /** 批量恢复（从回收站） */
  handleBatchRestore: () => Promise<void>;
  /** 批量创建快照 */
  handleBatchCreateSnapshot: () => Promise<void>;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useHomeBatch(options: UseHomeBatchOptions): UseHomeBatchReturn {
  const {
    getBookmarks,
    setBookmarks,
    removeCacheItem,
    selectedIds,
    exitSelectionMode,
  } = options;

  const { fetchWithAbort } = useAbortableFetch();

  // 操作状态
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isBatchCreatingSnapshot, setIsBatchCreatingSnapshot] = useState(false);

  /**
   * 批量删除（移入回收站）
   */
  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    // 确认对话框
    const confirmed = window.confirm(
      `确定要删除选中的 ${selectedIds.size} 条收藏吗？删除后可在回收站恢复。`,
    );
    if (!confirmed) return;

    const snapshot = getBookmarks();
    setIsBatchDeleting(true);

    try {
      // 使用 v1 API
      const response = await fetchWithAbort("/api/v1/bookmarks/batch/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "批量删除失败");
      }

      // 更新本地状态
      setBookmarks((prev) => prev.filter((b) => !selectedIds.has(b.id)));

      // 同步更新缓存
      selectedIds.forEach((id) => removeCacheItem?.(id));

      exitSelectionMode();
      toast.success(`已删除 ${selectedIds.size} 条收藏`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      // 失败时恢复快照
      setBookmarks(snapshot);
      clientLogger.error({ error }, "Batch delete error");
      toast.error(error instanceof Error ? error.message : "批量删除失败");
    } finally {
      setIsBatchDeleting(false);
    }
  }, [
    selectedIds,
    getBookmarks,
    setBookmarks,
    removeCacheItem,
    exitSelectionMode,
    fetchWithAbort,
  ]);

  /**
   * 批量恢复（从回收站）
   */
  const handleBatchRestore = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    const snapshot = getBookmarks();

    try {
      // 乐观更新：从列表移除
      setBookmarks((prev) => prev.filter((b) => !selectedIds.has(b.id)));

      // 使用 v1 API
      const res = await fetchWithAbort("/api/v1/bookmarks/batch/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "批量恢复失败");
      }

      exitSelectionMode();
      toast.success(`已恢复 ${ids.length} 条收藏`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      // 失败时恢复快照
      setBookmarks(snapshot);
      toast.error(error instanceof Error ? error.message : "批量恢复失败");
    }
  }, [
    selectedIds,
    getBookmarks,
    setBookmarks,
    exitSelectionMode,
    fetchWithAbort,
  ]);

  /**
   * 批量创建快照
   * 优化：调用批量 API，避免 N 次单独请求
   */
  const handleBatchCreateSnapshot = useCallback(async () => {
    if (selectedIds.size === 0) return;

    // 获取选中的书签
    const bookmarks = getBookmarks();
    const selectedBookmarks = bookmarks.filter((b) => selectedIds.has(b.id));
    const validBookmarks = selectedBookmarks.filter((b) => b.url);

    if (validBookmarks.length === 0) {
      toast.error("选中的收藏都没有有效链接，无法创建快照");
      return;
    }

    if (validBookmarks.length < selectedIds.size) {
      toast.info(
        `${selectedIds.size - validBookmarks.length} 条收藏因无有效链接而跳过`,
      );
    }

    setIsBatchCreatingSnapshot(true);

    try {
      // 调用批量快照 API（单次请求）
      const response = await fetchWithAbort(
        "/api/v1/bookmarks/batch/snapshot",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: validBookmarks.map((b) => b.id),
            snapshotType: "basic",
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "批量创建快照失败");
      }

      const { data } = await response.json();

      if (data.totalCreated > 0) {
        toast.success(`成功创建 ${data.totalCreated} 个快照`);
      }
      if (data.totalSkipped > 0) {
        toast.info(`${data.totalSkipped} 个书签已有快照，已跳过`);
      }

      exitSelectionMode();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      clientLogger.error({ error }, "Batch snapshot error");
      toast.error(error instanceof Error ? error.message : "批量创建快照失败");
    } finally {
      setIsBatchCreatingSnapshot(false);
    }
  }, [selectedIds, getBookmarks, exitSelectionMode, fetchWithAbort]);

  return {
    isBatchDeleting,
    isBatchCreatingSnapshot,
    handleBatchDelete,
    handleBatchRestore,
    handleBatchCreateSnapshot,
  };
}
