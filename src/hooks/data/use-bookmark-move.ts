/**
 * 书签移动 Hook
 *
 * 提供书签移动到文件夹的功能，支持单个和批量移动
 * 使用乐观更新确保即时反馈
 *
 * @version 2.0.0 - 迁移到 TanStack Query
 */

"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_PATHS } from "@/lib/constants/api-paths";
import { bookmarkKeys, folderBookmarkKeys } from "@/hooks/queries/keys";

interface MoveBookmarkOptions {
  /** 移动完成后的回调 */
  onSuccess?: (movedCount: number, folderName: string) => void;
  /** 移动失败后的回调 */
  onError?: (error: Error) => void;
}

interface MoveBookmarkResult {
  /** 是否正在移动 */
  isMoving: boolean;
  /** 移动单个书签到文件夹 */
  moveBookmark: (bookmarkId: number, folderId: number) => Promise<boolean>;
  /** 批量移动书签到文件夹 */
  moveBookmarks: (bookmarkIds: number[], folderId: number) => Promise<boolean>;
}

/**
 * 书签移动 Hook
 *
 * @example
 * ```tsx
 * const { moveBookmark, isMoving } = useBookmarkMove({
 *   onSuccess: (count, name) => console.log(`Moved ${count} to ${name}`),
 * });
 *
 * await moveBookmark(123, 456);
 * ```
 */
export function useBookmarkMove(
  options: MoveBookmarkOptions = {},
): MoveBookmarkResult {
  const [isMoving, setIsMoving] = useState(false);
  const queryClient = useQueryClient();

  const moveBookmarks = useCallback(
    async (bookmarkIds: number[], folderId: number): Promise<boolean> => {
      if (bookmarkIds.length === 0) return false;

      setIsMoving(true);

      try {
        const response = await fetch(API_PATHS.bookmarks.batchMove, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: bookmarkIds, folderId }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "移动失败");
        }

        const result = await response.json();
        const movedCount = result.data?.movedCount ?? bookmarkIds.length;
        const folderName = result.data?.folderName ?? "目标文件夹";

        // 刷新相关的 TanStack Query 缓存
        await queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
        await queryClient.invalidateQueries({
          queryKey: folderBookmarkKeys.all,
        });

        toast.success(`已移动 ${movedCount} 条收藏到「${folderName}」`);
        options.onSuccess?.(movedCount, folderName);

        return true;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("移动失败");
        toast.error(err.message);
        options.onError?.(err);
        return false;
      } finally {
        setIsMoving(false);
      }
    },
    [options, queryClient],
  );

  const moveBookmark = useCallback(
    async (bookmarkId: number, folderId: number): Promise<boolean> => {
      return moveBookmarks([bookmarkId], folderId);
    },
    [moveBookmarks],
  );

  return {
    isMoving,
    moveBookmark,
    moveBookmarks,
  };
}
