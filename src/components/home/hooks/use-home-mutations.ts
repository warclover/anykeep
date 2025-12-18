/**
 * V4.2.17: 首页书签 CRUD 操作 Hook
 *
 * Phase 2.3.1 - 从 home-page-client.tsx 提取
 *
 * 职责：单个书签的增删改操作
 * 特性：乐观更新 + 失败回滚 + 缓存同步
 */

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAbortableFetch } from "@/hooks/use-abortable-fetch";
import { toast } from "sonner";
import type { Bookmark } from "@/types/supabase";

// 带文件夹信息的书签类型
type BookmarkWithFolder = Bookmark & {
  folders?: { name: string } | null;
};

// ============================================================================
// Hook 参数类型
// ============================================================================

export interface UseHomeMutationsOptions {
  /** 获取当前书签列表（用于快照回滚） */
  getBookmarks: () => BookmarkWithFolder[];
  /** 更新书签列表 */
  setBookmarks: (
    updater:
      | BookmarkWithFolder[]
      | ((prev: BookmarkWithFolder[]) => BookmarkWithFolder[]),
  ) => void;
  /** 更新缓存单项（可选，用于 SWR 缓存同步） */
  updateCacheItem?: (
    id: number,
    updater: (b: BookmarkWithFolder) => BookmarkWithFolder,
  ) => void;
  /** 移除缓存单项（可选，用于 SWR 缓存同步） */
  removeCacheItem?: (id: number) => void;
}

// ============================================================================
// Hook 返回类型
// ============================================================================

export interface UseHomeMutationsReturn {
  /** 删除书签（移入回收站） */
  handleDelete: (id: number) => Promise<void>;
  /** 恢复书签（从回收站恢复） */
  handleRestore: (id: number) => Promise<void>;
  /** 永久删除书签 */
  handlePermanentDelete: (id: number) => Promise<void>;
  /** 切换已读状态 */
  handleToggleRead: (id: number, isRead: boolean) => Promise<void>;
  /** 编辑书签（跳转到详情页） */
  handleEdit: (id: number) => void;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useHomeMutations(
  options: UseHomeMutationsOptions,
): UseHomeMutationsReturn {
  const { getBookmarks, setBookmarks, updateCacheItem, removeCacheItem } =
    options;
  const { fetchWithAbort } = useAbortableFetch();
  const router = useRouter();

  /**
   * 删除书签（移入回收站）
   * 乐观更新：立即从列表移除，失败时回滚
   */
  const handleDelete = useCallback(
    async (id: number) => {
      const snapshot = getBookmarks();

      try {
        // 乐观更新 UI
        setBookmarks((prev) => prev.filter((b) => b.id !== id));
        // 同步更新缓存
        removeCacheItem?.(id);

        // 调用删除 API
        const res = await fetchWithAbort(`/api/bookmarks/${id}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "删除失败");
        }

        toast.success("删除成功");
      } catch (error) {
        // 取消错误不显示提示
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        // 失败时恢复快照
        setBookmarks(snapshot);
        toast.error(error instanceof Error ? error.message : "删除失败");
      }
    },
    [getBookmarks, setBookmarks, removeCacheItem, fetchWithAbort],
  );

  /**
   * 恢复书签（从回收站恢复）
   */
  const handleRestore = useCallback(
    async (id: number) => {
      const snapshot = getBookmarks();

      try {
        // 乐观更新 UI
        setBookmarks((prev) => prev.filter((b) => b.id !== id));

        // 调用恢复 API
        const res = await fetchWithAbort(`/api/bookmarks/${id}/restore`, {
          method: "POST",
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "恢复失败");
        }

        toast.success("已恢复收藏");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setBookmarks(snapshot);
        toast.error(error instanceof Error ? error.message : "恢复失败");
      }
    },
    [getBookmarks, setBookmarks, fetchWithAbort],
  );

  /**
   * 永久删除书签
   */
  const handlePermanentDelete = useCallback(
    async (id: number) => {
      const snapshot = getBookmarks();

      try {
        // 乐观更新 UI
        setBookmarks((prev) => prev.filter((b) => b.id !== id));

        // 调用永久删除 API
        const res = await fetchWithAbort(`/api/bookmarks/${id}/permanent`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || "永久删除失败");
        }

        toast.success("已永久删除");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setBookmarks(snapshot);
        toast.error(error instanceof Error ? error.message : "永久删除失败");
      }
    },
    [getBookmarks, setBookmarks, fetchWithAbort],
  );

  /**
   * 切换已读状态
   */
  const handleToggleRead = useCallback(
    async (id: number, isRead: boolean) => {
      const snapshot = getBookmarks();

      try {
        // 乐观更新 UI
        setBookmarks((prev) =>
          prev.map((b) =>
            b.id === id
              ? {
                  ...b,
                  is_read: isRead,
                  read_at: isRead ? new Date().toISOString() : null,
                }
              : b,
          ),
        );
        // 同步更新缓存
        updateCacheItem?.(id, (b) => ({
          ...b,
          is_read: isRead,
          read_at: isRead ? new Date().toISOString() : null,
        }));

        // 调用 PATCH API
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
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setBookmarks(snapshot);
        toast.error(error instanceof Error ? error.message : "更新失败");
      }
    },
    [getBookmarks, setBookmarks, updateCacheItem, fetchWithAbort],
  );

  /**
   * 编辑书签（跳转到详情页）
   */
  const handleEdit = useCallback(
    (id: number) => {
      router.push(`/bookmark/${id}`);
    },
    [router],
  );

  return {
    handleDelete,
    handleRestore,
    handlePermanentDelete,
    handleToggleRead,
    handleEdit,
  };
}
