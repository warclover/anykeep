/**
 * 书签操作 Hook
 * 提供书签 CRUD 操作的 API 调用封装
 *
 * 设计原则：
 * - 不管理状态，由调用方负责乐观更新
 * - 提供标准化的错误处理
 * - 支持请求取消
 */

"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useAbortableFetch } from "./use-abortable-fetch";

// ==================== 类型定义 ====================

interface BookmarkActionResult {
  success: boolean;
  error?: string;
}

interface BatchActionResult extends BookmarkActionResult {
  count?: number;
}

// ==================== Hook 定义 ====================

/**
 * 书签操作 Hook
 *
 * @example
 * ```tsx
 * const { deleteBookmark, restoreBookmark } = useBookmarkActions();
 *
 * // 在组件中使用
 * const handleDelete = async (id: number) => {
 *   // 1. 乐观更新 UI
 *   setBookmarks(prev => prev.filter(b => b.id !== id));
 *
 *   // 2. 调用 API
 *   const result = await deleteBookmark(id);
 *
 *   // 3. 失败时回滚
 *   if (!result.success) {
 *     setBookmarks(snapshot);
 *   }
 * };
 * ```
 */
export function useBookmarkActions() {
  const { fetchWithAbort } = useAbortableFetch();

  /**
   * 删除书签（软删除，移入垃圾箱）
   */
  const deleteBookmark = useCallback(
    async (id: number): Promise<BookmarkActionResult> => {
      try {
        const res = await fetchWithAbort(`/api/bookmarks/${id}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "删除失败");
        }

        toast.success("删除成功");
        return { success: true };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return { success: false, error: "请求已取消" };
        }

        const message = error instanceof Error ? error.message : "删除失败";
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [fetchWithAbort],
  );

  /**
   * 恢复书签（从垃圾箱恢复）
   */
  const restoreBookmark = useCallback(
    async (id: number): Promise<BookmarkActionResult> => {
      try {
        const res = await fetchWithAbort(`/api/bookmarks/${id}/restore`, {
          method: "POST",
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "恢复失败");
        }

        toast.success("已恢复收藏");
        return { success: true };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return { success: false, error: "请求已取消" };
        }

        const message = error instanceof Error ? error.message : "恢复失败";
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [fetchWithAbort],
  );

  /**
   * 永久删除书签
   */
  const permanentDeleteBookmark = useCallback(
    async (id: number): Promise<BookmarkActionResult> => {
      try {
        const res = await fetchWithAbort(`/api/bookmarks/${id}/permanent`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "永久删除失败");
        }

        toast.success("已永久删除");
        return { success: true };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return { success: false, error: "请求已取消" };
        }

        const message = error instanceof Error ? error.message : "永久删除失败";
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [fetchWithAbort],
  );

  /**
   * 批量恢复书签
   */
  const batchRestoreBookmarks = useCallback(
    async (ids: number[]): Promise<BatchActionResult> => {
      if (ids.length === 0) {
        return { success: false, error: "未选择书签" };
      }

      try {
        const res = await fetchWithAbort("/api/bookmarks/batch-restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookmarkIds: ids }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "批量恢复失败");
        }

        toast.success(`已恢复 ${ids.length} 个收藏`);
        return { success: true, count: ids.length };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return { success: false, error: "请求已取消" };
        }

        const message = error instanceof Error ? error.message : "批量恢复失败";
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [fetchWithAbort],
  );

  /**
   * 清空垃圾箱
   */
  const emptyTrash = useCallback(async (): Promise<BookmarkActionResult> => {
    try {
      const res = await fetchWithAbort("/api/trash/empty", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "清空垃圾箱失败");
      }

      toast.success("垃圾箱已清空");
      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { success: false, error: "请求已取消" };
      }

      const message = error instanceof Error ? error.message : "清空垃圾箱失败";
      toast.error(message);
      return { success: false, error: message };
    }
  }, [fetchWithAbort]);

  /**
   * 切换已读状态
   */
  const toggleReadStatus = useCallback(
    async (id: number, isRead: boolean): Promise<BookmarkActionResult> => {
      try {
        const res = await fetchWithAbort(`/api/bookmarks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "更新失败");
        }

        toast.success(isRead ? "已标记为已读" : "已标记为未读");
        return { success: true };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return { success: false, error: "请求已取消" };
        }

        const message = error instanceof Error ? error.message : "更新失败";
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [fetchWithAbort],
  );

  return {
    // 单个操作
    deleteBookmark,
    restoreBookmark,
    permanentDeleteBookmark,
    toggleReadStatus,

    // 批量操作
    batchRestoreBookmarks,
    emptyTrash,
  };
}

export type { BookmarkActionResult, BatchActionResult };
