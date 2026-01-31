/**
 * 健康问题操作 Hook
 *
 * 提供文件夹健康问题的修复操作
 * - 合并重复文件夹
 * - 删除空文件夹
 * - 重命名文件夹
 * - 创建缺失分类
 *
 * @version 1.0.0
 * @since 2026-01-31
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { fetchWithRetry } from "@/lib/utils/fetch-with-retry";
import { clientLogger } from "@/lib/client-logger";

// ============================================================================
// 类型定义
// ============================================================================

interface UseHealthActionsOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseHealthActionsReturn {
  // 状态
  isLoading: boolean;
  loadingAction: string | null;

  // 操作
  mergeFolders: (
    sourceFolderId: number,
    targetFolderId: number,
  ) => Promise<boolean>;
  deleteFolder: (folderId: number) => Promise<boolean>;
  renameFolder: (folderId: number, newName: string) => Promise<boolean>;
  createFolder: (name: string, parentId?: number) => Promise<boolean>;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useHealthActions(
  options: UseHealthActionsOptions = {},
): UseHealthActionsReturn {
  const { onSuccess, onError } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  /**
   * 合并文件夹
   * POST /api/folders/[sourceFolderId]/merge
   */
  const mergeFolders = useCallback(
    async (
      sourceFolderId: number,
      targetFolderId: number,
    ): Promise<boolean> => {
      setIsLoading(true);
      setLoadingAction(`merge-${sourceFolderId}`);

      try {
        const res = await fetchWithRetry(
          `/api/folders/${sourceFolderId}/merge`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetFolderId }),
          },
          { requestId: `merge-folders-${sourceFolderId}-${targetFolderId}` },
        );

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "合并失败");
        }

        const result = await res.json();
        toast.success(
          `已合并到「${result.data?.targetFolderName || "目标文件夹"}」，移动了 ${result.data?.bookmarksMoved || 0} 条书签`,
        );
        onSuccess?.();
        return true;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("合并失败");
        clientLogger.error({ error }, "Failed to merge folders");
        toast.error(err.message);
        onError?.(err);
        return false;
      } finally {
        setIsLoading(false);
        setLoadingAction(null);
      }
    },
    [onSuccess, onError],
  );

  /**
   * 删除空文件夹
   * DELETE /api/folders/[folderId]
   */
  const deleteFolder = useCallback(
    async (folderId: number): Promise<boolean> => {
      setIsLoading(true);
      setLoadingAction(`delete-${folderId}`);

      try {
        const res = await fetchWithRetry(
          `/api/folders/${folderId}`,
          {
            method: "DELETE",
          },
          { requestId: `delete-folder-${folderId}` },
        );

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "删除失败");
        }

        const result = await res.json();
        toast.success(`已删除文件夹「${result.data?.folderName || ""}」`);
        onSuccess?.();
        return true;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("删除失败");
        clientLogger.error({ error }, "Failed to delete folder");
        toast.error(err.message);
        onError?.(err);
        return false;
      } finally {
        setIsLoading(false);
        setLoadingAction(null);
      }
    },
    [onSuccess, onError],
  );

  /**
   * 重命名文件夹
   * PUT /api/folders/[folderId]
   */
  const renameFolder = useCallback(
    async (folderId: number, newName: string): Promise<boolean> => {
      setIsLoading(true);
      setLoadingAction(`rename-${folderId}`);

      try {
        const res = await fetchWithRetry(
          `/api/folders/${folderId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName }),
          },
          { requestId: `rename-folder-${folderId}` },
        );

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "重命名失败");
        }

        toast.success(`已重命名为「${newName}」`);
        onSuccess?.();
        return true;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("重命名失败");
        clientLogger.error({ error }, "Failed to rename folder");
        toast.error(err.message);
        onError?.(err);
        return false;
      } finally {
        setIsLoading(false);
        setLoadingAction(null);
      }
    },
    [onSuccess, onError],
  );

  /**
   * 创建文件夹
   * POST /api/folders
   */
  const createFolder = useCallback(
    async (name: string, parentId?: number): Promise<boolean> => {
      setIsLoading(true);
      setLoadingAction(`create-${name}`);

      try {
        const res = await fetchWithRetry(
          `/api/folders`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, parentId }),
          },
          { requestId: `create-folder-${name}` },
        );

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "创建失败");
        }

        toast.success(`已创建文件夹「${name}」`);
        onSuccess?.();
        return true;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("创建失败");
        clientLogger.error({ error }, "Failed to create folder");
        toast.error(err.message);
        onError?.(err);
        return false;
      } finally {
        setIsLoading(false);
        setLoadingAction(null);
      }
    },
    [onSuccess, onError],
  );

  return {
    isLoading,
    loadingAction,
    mergeFolders,
    deleteFolder,
    renameFolder,
    createFolder,
  };
}
