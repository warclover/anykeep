/**
 * Home V2 批量操作 Hook
 *
 * 设计原则：
 * - 从 Zustand store 读取 selectedIds（解决 A3：不通过 props 传递 Set）
 * - 直接操作 queryClient 缓存（解决 A2）
 * - 回调依赖稳定（useHomeV2Store selector 引用稳定）
 *
 * @since home-v2
 */

"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useHomeV2Store } from "@/stores/home-v2-store";
import { useHomeV2CacheOps } from "../providers/home-v2-data-provider";
import { useAbortableFetch } from "@/hooks/core";
import { clientLogger } from "@/lib/client-logger";

// ============================================================================
// Hook 实现
// ============================================================================

export function useHomeV2BatchOps() {
  const { fetchWithAbort } = useAbortableFetch();
  const { removeCacheItem, invalidateAll } = useHomeV2CacheOps();

  // Zustand selector — 只订阅需要的字段
  const selectedIds = useHomeV2Store((s) => s.selectedIds);
  const exitSelectionMode = useHomeV2Store((s) => s.exitSelectionMode);
  const setBatchDeleting = useHomeV2Store((s) => s.setBatchDeleting);
  const setBatchCreatingSnapshot = useHomeV2Store(
    (s) => s.setBatchCreatingSnapshot,
  );

  /** 批量删除（含确认对话框） */
  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(
      `确定要删除选中的 ${selectedIds.size} 个收藏吗？`,
    );
    if (!confirmed) return;

    setBatchDeleting(true);
    const ids = Array.from(selectedIds);

    // 乐观移除
    ids.forEach((id) => removeCacheItem(id));

    try {
      const res = await fetchWithAbort("/api/bookmarks/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        throw new Error("批量删除失败");
      }

      toast.success(`已删除 ${ids.length} 个收藏`);
      exitSelectionMode();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      clientLogger.error({ error }, "Batch delete error");
      toast.error("批量删除失败");
      invalidateAll(); // 回滚：重新获取
    } finally {
      setBatchDeleting(false);
    }
  }, [
    selectedIds,
    fetchWithAbort,
    removeCacheItem,
    invalidateAll,
    exitSelectionMode,
    setBatchDeleting,
  ]);

  /** 批量还原（垃圾箱模式） */
  const handleBatchRestore = useCallback(async () => {
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    ids.forEach((id) => removeCacheItem(id));

    try {
      const res = await fetchWithAbort("/api/bookmarks/batch-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        throw new Error("批量还原失败");
      }

      toast.success(`已还原 ${ids.length} 个收藏`);
      exitSelectionMode();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      clientLogger.error({ error }, "Batch restore error");
      toast.error("批量还原失败");
      invalidateAll();
    }
  }, [
    selectedIds,
    fetchWithAbort,
    removeCacheItem,
    invalidateAll,
    exitSelectionMode,
  ]);

  /** 批量创建快照 */
  const handleBatchCreateSnapshot = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setBatchCreatingSnapshot(true);
    const ids = Array.from(selectedIds);

    try {
      const res = await fetchWithAbort("/api/snapshots/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarkIds: ids }),
      });

      if (!res.ok) {
        throw new Error("批量快照失败");
      }

      toast.success(`已为 ${ids.length} 个收藏创建快照`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      clientLogger.error({ error }, "Batch snapshot error");
      toast.error("批量快照失败");
    } finally {
      setBatchCreatingSnapshot(false);
    }
  }, [selectedIds, fetchWithAbort, setBatchCreatingSnapshot]);

  return {
    handleBatchDelete,
    handleBatchRestore,
    handleBatchCreateSnapshot,
  };
}
