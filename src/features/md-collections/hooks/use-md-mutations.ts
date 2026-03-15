/**
 * MD 收藏数据变更 Hook
 * P2-007: Markdown 内容收藏
 *
 * 使用 TanStack Query useMutation 管理状态
 *
 * @version 2.0.0 - 迁移到 useMutation
 */

"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mdCollectionKeys } from "@/hooks/queries/keys";
import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import { API_PATHS } from "@/lib/constants/api-paths";
import { computeContentHash } from "../lib/md-processor";
import type {
  MdCollection,
  MdCollectionCreateRequest,
  MdCollectionUpdateRequest,
  MdCheckDuplicateResponse,
} from "../types";

// ============================================
// 辅助函数：解析 API 响应
// ============================================

async function parseResponse<T>(
  response: Response,
  fallbackMsg: string,
): Promise<T> {
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || fallbackMsg);
  }

  return result.data as T;
}

/**
 * 创建 MD 收藏 Hook
 */
export function useCreateMdCollection() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (
      data: MdCollectionCreateRequest,
    ): Promise<MdCollection> => {
      const response = await fetchWithAuth(API_PATHS.mdCollections.list, {
        method: "POST",
        body: JSON.stringify(data),
      });

      return parseResponse<MdCollection>(response, "创建失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mdCollectionKeys.lists() });
    },
  });

  const create = useCallback(
    async (data: MdCollectionCreateRequest): Promise<MdCollection | null> => {
      try {
        return await mutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutation.mutateAsync],
  );

  return {
    create,
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/**
 * 更新 MD 收藏 Hook
 */
export function useUpdateMdCollection() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: MdCollectionUpdateRequest;
    }): Promise<MdCollection> => {
      const response = await fetchWithAuth(
        API_PATHS.mdCollections.detail(String(id)),
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      );

      return parseResponse<MdCollection>(response, "更新失败");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: mdCollectionKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: mdCollectionKeys.lists() });
    },
  });

  const update = useCallback(
    async (
      id: number,
      data: MdCollectionUpdateRequest,
    ): Promise<MdCollection | null> => {
      try {
        return await mutation.mutateAsync({ id, data });
      } catch {
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutation.mutateAsync],
  );

  return {
    update,
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/**
 * 删除 MD 收藏 Hook
 */
export function useDeleteMdCollection() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const response = await fetchWithAuth(
        API_PATHS.mdCollections.detail(String(id)),
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "删除失败");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mdCollectionKeys.lists() });
    },
  });

  const remove = useCallback(
    async (id: number): Promise<boolean> => {
      try {
        await mutation.mutateAsync(id);
        return true;
      } catch {
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutation.mutateAsync],
  );

  return {
    remove,
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/**
 * 上传 MD 文件 Hook
 *
 * 注意：文件上传使用 FormData，属于允许直接 fetch 的例外场景，
 * 但仍通过 useMutation 管理状态。
 */
export function useUploadMdFile() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      file,
      options,
    }: {
      file: File;
      options?: {
        contentType?: string;
        userTags?: string[];
        folderId?: number;
      };
    }): Promise<MdCollection> => {
      const formData = new FormData();
      formData.append("file", file);

      if (options?.contentType) {
        formData.append("contentType", options.contentType);
      }
      if (options?.userTags) {
        formData.append("userTags", JSON.stringify(options.userTags));
      }
      if (options?.folderId) {
        formData.append("folderId", String(options.folderId));
      }

      const response = await fetchWithAuth(API_PATHS.mdCollections.upload, {
        method: "POST",
        body: formData,
      });

      return parseResponse<MdCollection>(response, "上传失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mdCollectionKeys.lists() });
    },
  });

  const upload = useCallback(
    async (
      file: File,
      options?: {
        contentType?: string;
        userTags?: string[];
        folderId?: number;
      },
    ): Promise<MdCollection | null> => {
      try {
        return await mutation.mutateAsync({ file, options });
      } catch {
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutation.mutateAsync],
  );

  return {
    upload,
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
    progress: mutation.isSuccess ? 100 : 0,
  };
}

/**
 * 检查内容重复 Hook
 */
export function useCheckDuplicate() {
  const mutation = useMutation({
    mutationFn: async (content: string): Promise<MdCheckDuplicateResponse> => {
      const contentHash = computeContentHash(content);

      const response = await fetchWithAuth(
        API_PATHS.mdCollections.checkDuplicate,
        {
          method: "POST",
          body: JSON.stringify({ contentHash }),
        },
      );

      return parseResponse<MdCheckDuplicateResponse>(response, "检查失败");
    },
  });

  return {
    check: async (
      content: string,
    ): Promise<MdCheckDuplicateResponse | null> => {
      try {
        return await mutation.mutateAsync(content);
      } catch {
        return null;
      }
    },
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

/**
 * 触发 AI 处理 Hook
 */
export function useTriggerAIProcess() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      const response = await fetchWithAuth(
        API_PATHS.mdCollections.process(String(id)),
        {
          method: "POST",
        },
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "处理失败");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mdCollectionKeys.lists() });
    },
  });

  return {
    trigger: async (id: number): Promise<boolean> => {
      try {
        await mutation.mutateAsync(id);
        return true;
      } catch {
        return false;
      }
    },
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}
