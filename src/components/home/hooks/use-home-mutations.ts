/**
 * V4.2.17: 首页书签 CRUD 操作 Hook
 *
 * Phase 2.3.1 - 从 home-page-client.tsx 提取
 * v2.0.0 - 迁移到 TanStack Query useMutation
 *
 * 职责：单个书签的增删改操作
 * 特性：乐观更新 + 失败回滚 + TanStack Query 缓存失效
 */

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import { API_PATHS } from "@/lib/constants/api-paths";
import { invalidateBookmarkCaches } from "@/lib/cache/invalidate-caches";
import type { BookmarkWithFolder } from "../types";

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
  const queryClient = useQueryClient();
  const router = useRouter();

  /**
   * 删除书签（移入回收站）
   */
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetchWithAuth(API_PATHS.bookmarks.detail(id), {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || "删除失败");
      }
    },
    onSuccess: () => {
      toast.success("删除成功");
      invalidateBookmarkCaches(queryClient);
    },
  });

  const handleDelete = useCallback(
    async (id: number) => {
      const snapshot = getBookmarks();

      // 乐观更新 UI
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
      removeCacheItem?.(id);

      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        // 失败时恢复快照
        setBookmarks(snapshot);
        toast.error(error instanceof Error ? error.message : "删除失败");
      }
    },
    [getBookmarks, setBookmarks, removeCacheItem, deleteMutation],
  );

  /**
   * 恢复书签（从回收站恢复）
   */
  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetchWithAuth(
        API_PATHS.bookmarks.restoreSingle(id),
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || "恢复失败");
      }
    },
    onSuccess: () => {
      toast.success("已恢复收藏");
      invalidateBookmarkCaches(queryClient);
    },
  });

  const handleRestore = useCallback(
    async (id: number) => {
      const snapshot = getBookmarks();

      // 乐观更新 UI
      setBookmarks((prev) => prev.filter((b) => b.id !== id));

      try {
        await restoreMutation.mutateAsync(id);
      } catch (error) {
        setBookmarks(snapshot);
        toast.error(error instanceof Error ? error.message : "恢复失败");
      }
    },
    [getBookmarks, setBookmarks, restoreMutation],
  );

  /**
   * 永久删除书签
   */
  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetchWithAuth(API_PATHS.bookmarks.permanent(id), {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || "永久删除失败");
      }
    },
    onSuccess: () => {
      toast.success("已永久删除");
      invalidateBookmarkCaches(queryClient);
    },
  });

  const handlePermanentDelete = useCallback(
    async (id: number) => {
      const snapshot = getBookmarks();

      // 乐观更新 UI
      setBookmarks((prev) => prev.filter((b) => b.id !== id));

      try {
        await permanentDeleteMutation.mutateAsync(id);
      } catch (error) {
        setBookmarks(snapshot);
        toast.error(error instanceof Error ? error.message : "永久删除失败");
      }
    },
    [getBookmarks, setBookmarks, permanentDeleteMutation],
  );

  /**
   * 切换已读状态
   */
  const toggleReadMutation = useMutation({
    mutationFn: async ({ id, isRead }: { id: number; isRead: boolean }) => {
      const response = await fetchWithAuth(API_PATHS.bookmarks.detail(id), {
        method: "PATCH",
        body: JSON.stringify({ isRead }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || "更新失败");
      }
    },
    onSuccess: (_, { isRead }) => {
      toast.success(isRead ? "已标记为已读" : "已标记为未读");
      invalidateBookmarkCaches(queryClient);
    },
  });

  const handleToggleRead = useCallback(
    async (id: number, isRead: boolean) => {
      const snapshot = getBookmarks();

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
      updateCacheItem?.(id, (b) => ({
        ...b,
        is_read: isRead,
        read_at: isRead ? new Date().toISOString() : null,
      }));

      try {
        await toggleReadMutation.mutateAsync({ id, isRead });
      } catch (error) {
        setBookmarks(snapshot);
        toast.error(error instanceof Error ? error.message : "更新失败");
      }
    },
    [getBookmarks, setBookmarks, updateCacheItem, toggleReadMutation],
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
