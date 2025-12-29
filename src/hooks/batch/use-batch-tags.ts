/**
 * 批量标签操作 Hook
 * 提供批量添加/移除标签的 API 调用和状态管理
 */

"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { BatchTagsResult } from "@/lib/batch/validation";

interface UseBatchTagsOptions {
  /** 操作成功回调 */
  onSuccess?: (result: BatchTagsResult) => void;
  /** 操作失败回调 */
  onError?: (error: Error) => void;
}

interface UseBatchTagsReturn {
  /** 批量添加标签 */
  batchAddTags: (
    bookmarkIds: number[],
    tags: string[],
  ) => Promise<BatchTagsResult | null>;
  /** 批量移除标签 */
  batchRemoveTags: (
    bookmarkIds: number[],
    tags: string[],
  ) => Promise<BatchTagsResult | null>;
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 错误信息 */
  error: Error | null;
}

/**
 * 批量标签操作 Hook
 */
export function useBatchTags(
  options: UseBatchTagsOptions = {},
): UseBatchTagsReturn {
  const { onSuccess, onError } = options;

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * 执行批量标签操作
   */
  const executeBatchTags = useCallback(
    async (
      action: "add" | "remove",
      bookmarkIds: number[],
      tags: string[],
    ): Promise<BatchTagsResult | null> => {
      if (bookmarkIds.length === 0) {
        toast.error("请选择至少一个书签");
        return null;
      }

      if (tags.length === 0) {
        toast.error("请输入至少一个标签");
        return null;
      }

      setIsProcessing(true);
      setError(null);

      try {
        // 使用 v1 API
        const response = await fetch("/api/v1/bookmarks/batch/tags", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            ids: bookmarkIds,
            tags,
          }),
          credentials: "include",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "批量操作失败");
        }

        const batchResult = result.data as BatchTagsResult;

        // 显示成功提示
        toast.success(batchResult.message);

        // 调用成功回调
        onSuccess?.(batchResult);

        return batchResult;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("未知错误");
        setError(error);
        toast.error(error.message);
        onError?.(error);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [onSuccess, onError],
  );

  /**
   * 批量添加标签
   */
  const batchAddTags = useCallback(
    async (bookmarkIds: number[], tags: string[]) => {
      return executeBatchTags("add", bookmarkIds, tags);
    },
    [executeBatchTags],
  );

  /**
   * 批量移除标签
   */
  const batchRemoveTags = useCallback(
    async (bookmarkIds: number[], tags: string[]) => {
      return executeBatchTags("remove", bookmarkIds, tags);
    },
    [executeBatchTags],
  );

  return {
    batchAddTags,
    batchRemoveTags,
    isProcessing,
    error,
  };
}
