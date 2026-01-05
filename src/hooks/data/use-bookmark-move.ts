/**
 * 书签移动 Hook
 *
 * 提供书签移动到文件夹的功能，支持单个和批量移动
 * 使用乐观更新确保即时反馈
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { mutate } from "swr";

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

  const moveBookmarks = useCallback(
    async (bookmarkIds: number[], folderId: number): Promise<boolean> => {
      if (bookmarkIds.length === 0) return false;

      setIsMoving(true);

      try {
        const response = await fetch("/api/bookmarks/batch-move", {
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

        // 刷新相关的 SWR 缓存
        // 使用正则匹配所有书签相关的缓存 key
        await mutate(
          (key: string) =>
            typeof key === "string" && key.includes("/api/bookmarks"),
          undefined,
          { revalidate: true },
        );

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
    [options],
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
