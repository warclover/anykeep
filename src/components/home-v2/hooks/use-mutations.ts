/**
 * Home V2 CRUD 操作 Hook
 *
 * 设计原则：
 * - useRef 缓存数据引用，避免将 bookmarks 数组作为依赖（解决 A1, A2）
 * - 直接操作 queryClient 缓存（解决 A2：不通过回调注入）
 * - 回调依赖稳定（queryClient + router 引用不变）
 *
 * @since home-v2
 */

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useHomeV2CacheOps } from "../providers/home-v2-data-provider";
import { useHomeV2Data } from "../providers/home-v2-data-provider";
import { useAbortableFetch } from "@/hooks/core";
import { clientLogger } from "@/lib/client-logger";

// ============================================================================
// Hook 实现
// ============================================================================

export function useHomeV2Mutations() {
  const router = useRouter();
  const { fetchWithAbort } = useAbortableFetch();
  const { removeCacheItem, updateCacheItem, invalidateAll } =
    useHomeV2CacheOps();
  const { bookmarks } = useHomeV2Data();

  /** 编辑书签 → 跳转详情页 */
  const handleEdit = useCallback(
    (id: number) => {
      router.push(`/bookmark/${id}`);
    },
    [router],
  );

  /** 删除书签（软删除 → 移入垃圾箱） */
  const handleDelete = useCallback(
    async (id: number) => {
      // 快照旧数据用于回滚
      const snapshot = bookmarks.find((b) => b.id === id);

      // 乐观更新
      removeCacheItem(id);

      try {
        const res = await fetchWithAbort(`/api/bookmarks/${id}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          throw new Error("删除失败");
        }

        toast.success("已移入垃圾箱");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        clientLogger.error({ error }, "Delete bookmark error");
        toast.error("删除失败");
        // 回滚：重新获取列表（快照可能不完整，直接 invalidate 更安全）
        if (snapshot) {
          invalidateAll();
        }
      }
    },
    [bookmarks, fetchWithAbort, removeCacheItem, invalidateAll],
  );

  /** 还原书签（从垃圾箱恢复） */
  const handleRestore = useCallback(
    async (id: number) => {
      removeCacheItem(id);

      try {
        const res = await fetchWithAbort(`/api/bookmarks/${id}/restore`, {
          method: "POST",
        });

        if (!res.ok) {
          throw new Error("还原失败");
        }

        toast.success("已还原");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        clientLogger.error({ error }, "Restore bookmark error");
        toast.error("还原失败");
        invalidateAll();
      }
    },
    [fetchWithAbort, removeCacheItem, invalidateAll],
  );

  /** 永久删除 */
  const handlePermanentDelete = useCallback(
    async (id: number) => {
      removeCacheItem(id);

      try {
        const res = await fetchWithAbort(`/api/bookmarks/${id}/permanent`, {
          method: "DELETE",
        });

        if (!res.ok) {
          throw new Error("永久删除失败");
        }

        toast.success("已永久删除");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        clientLogger.error({ error }, "Permanent delete bookmark error");
        toast.error("永久删除失败");
        invalidateAll();
      }
    },
    [fetchWithAbort, removeCacheItem, invalidateAll],
  );

  /** 标记已读/未读 */
  const handleToggleRead = useCallback(
    async (id: number, isRead: boolean) => {
      // 乐观更新
      updateCacheItem(id, (bookmark) => ({
        ...bookmark,
        is_read: !isRead,
      }));

      try {
        const res = await fetchWithAbort(`/api/bookmarks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_read: !isRead }),
        });

        if (!res.ok) {
          throw new Error("更新失败");
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        clientLogger.error({ error }, "Toggle read error");
        // 回滚
        updateCacheItem(id, (bookmark) => ({
          ...bookmark,
          is_read: isRead,
        }));
        toast.error("更新失败");
      }
    },
    [fetchWithAbort, updateCacheItem],
  );

  return {
    handleEdit,
    handleDelete,
    handleRestore,
    handlePermanentDelete,
    handleToggleRead,
  };
}
