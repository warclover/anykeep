/**
 * MD 收藏数据变更 Hook
 * P2-007: Markdown 内容收藏
 */

"use client";

import { useState, useCallback } from "react";
import { computeContentHash } from "../lib/md-processor";
import type {
  MdCollection,
  MdCollectionCreateRequest,
  MdCollectionUpdateRequest,
  MdCheckDuplicateResponse,
} from "../types";

interface MutationState {
  isLoading: boolean;
  error: string | null;
}

/**
 * 创建 MD 收藏 Hook
 */
export function useCreateMdCollection() {
  const [state, setState] = useState<MutationState>({
    isLoading: false,
    error: null,
  });

  const create = useCallback(
    async (data: MdCollectionCreateRequest): Promise<MdCollection | null> => {
      setState({ isLoading: true, error: null });

      try {
        const response = await fetch("/api/md-collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "创建失败");
        }

        setState({ isLoading: false, error: null });
        return result.data as MdCollection;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "创建失败";
        setState({ isLoading: false, error: errorMessage });
        return null;
      }
    },
    [],
  );

  return {
    create,
    isLoading: state.isLoading,
    error: state.error,
  };
}

/**
 * 更新 MD 收藏 Hook
 */
export function useUpdateMdCollection() {
  const [state, setState] = useState<MutationState>({
    isLoading: false,
    error: null,
  });

  const update = useCallback(
    async (
      id: number,
      data: MdCollectionUpdateRequest,
    ): Promise<MdCollection | null> => {
      setState({ isLoading: true, error: null });

      try {
        const response = await fetch(`/api/md-collections/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "更新失败");
        }

        setState({ isLoading: false, error: null });
        return result.data as MdCollection;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "更新失败";
        setState({ isLoading: false, error: errorMessage });
        return null;
      }
    },
    [],
  );

  return {
    update,
    isLoading: state.isLoading,
    error: state.error,
  };
}

/**
 * 删除 MD 收藏 Hook
 */
export function useDeleteMdCollection() {
  const [state, setState] = useState<MutationState>({
    isLoading: false,
    error: null,
  });

  const remove = useCallback(async (id: number): Promise<boolean> => {
    setState({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/md-collections/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "删除失败");
      }

      setState({ isLoading: false, error: null });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "删除失败";
      setState({ isLoading: false, error: errorMessage });
      return false;
    }
  }, []);

  return {
    remove,
    isLoading: state.isLoading,
    error: state.error,
  };
}

/**
 * 上传 MD 文件 Hook
 */
export function useUploadMdFile() {
  const [state, setState] = useState<MutationState & { progress: number }>({
    isLoading: false,
    error: null,
    progress: 0,
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
      setState({ isLoading: true, error: null, progress: 0 });

      try {
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

        const response = await fetch("/api/md-collections/upload", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "上传失败");
        }

        setState({ isLoading: false, error: null, progress: 100 });
        return result.data as MdCollection;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "上传失败";
        setState({ isLoading: false, error: errorMessage, progress: 0 });
        return null;
      }
    },
    [],
  );

  return {
    upload,
    isLoading: state.isLoading,
    error: state.error,
    progress: state.progress,
  };
}

/**
 * 检查内容重复 Hook
 */
export function useCheckDuplicate() {
  const [state, setState] = useState<MutationState>({
    isLoading: false,
    error: null,
  });

  const check = useCallback(
    async (content: string): Promise<MdCheckDuplicateResponse | null> => {
      setState({ isLoading: true, error: null });

      try {
        const contentHash = computeContentHash(content);

        const response = await fetch("/api/md-collections/check-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentHash }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error?.message || "检查失败");
        }

        setState({ isLoading: false, error: null });
        return result.data as MdCheckDuplicateResponse;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "检查失败";
        setState({ isLoading: false, error: errorMessage });
        return null;
      }
    },
    [],
  );

  return {
    check,
    isLoading: state.isLoading,
    error: state.error,
  };
}

/**
 * 触发 AI 处理 Hook
 */
export function useTriggerAIProcess() {
  const [state, setState] = useState<MutationState>({
    isLoading: false,
    error: null,
  });

  const trigger = useCallback(async (id: number): Promise<boolean> => {
    setState({ isLoading: true, error: null });

    try {
      const response = await fetch(`/api/md-collections/${id}/process`, {
        method: "POST",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "处理失败");
      }

      setState({ isLoading: false, error: null });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "处理失败";
      setState({ isLoading: false, error: errorMessage });
      return false;
    }
  }, []);

  return {
    trigger,
    isLoading: state.isLoading,
    error: state.error,
  };
}
