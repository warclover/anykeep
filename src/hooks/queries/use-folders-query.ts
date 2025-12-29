/**
 * useFoldersQuery - TanStack Query Hook for Folders
 *
 * 提供文件夹的查询、创建、更新、删除等操作
 * 支持树形结构查询
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { folderKeys, type FolderFilters } from "./keys";
import type {
  FolderWithCountResponse,
  FolderTreeNodeResponse,
  CreateFolderInput,
  UpdateFolderInput,
  MoveFolderInput,
} from "@/contracts";
import type { Folder } from "@/types/supabase";

// ============================================
// 内部类型定义（适配 API 响应）
// ============================================

/**
 * 文件夹列表响应（内部使用）
 */
interface InternalFolderListResponse {
  folders: FolderWithCountResponse[];
  total: number;
}

/**
 * 文件夹树响应（内部使用）
 */
interface InternalFolderTreeResponse {
  tree: FolderTreeNodeResponse[];
  total: number;
}

// ============================================
// API Fetchers
// ============================================

/**
 * 获取文件夹列表（扁平）
 */
async function fetchFolders(
  filters?: FolderFilters,
): Promise<InternalFolderListResponse> {
  const params = new URLSearchParams();

  if (filters?.parentId !== undefined && filters.parentId !== null) {
    params.set("parentId", String(filters.parentId));
  }
  if (filters?.includeArchived) {
    params.set("includeArchived", "true");
  }

  // 使用 v1 API
  const url = params.toString()
    ? `/api/v1/folders?${params}`
    : "/api/v1/folders";
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "获取文件夹列表失败");
  }

  const data = await response.json();

  // 适配新旧两种 API 响应格式
  // v1 API: { success, data: { folders, total } }
  // 旧 API: { success, data: [...folders...] } 或 { folders: [...] }
  const inner = data.data || data;
  const folders = inner.folders || (Array.isArray(inner) ? inner : []);

  return {
    folders,
    total: inner.total ?? folders.length,
  };
}

/**
 * 获取文件夹树形结构
 */
async function fetchFolderTree(): Promise<InternalFolderTreeResponse> {
  // 使用 v1 API
  const response = await fetch("/api/v1/folders?view=tree");

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "获取文件夹树失败");
  }

  const data = await response.json();

  // 适配新旧两种 API 响应格式
  // v1 API: { success, data: { tree, total } }
  // 旧 API: { success, data: [...folders...] }
  const inner = data.data || data;
  const tree =
    inner.tree || inner.folders || (Array.isArray(inner) ? inner : []);

  return {
    tree,
    total: inner.total ?? tree.length,
  };
}

/**
 * 获取文件夹详情
 */
async function fetchFolder(id: number): Promise<FolderWithCountResponse> {
  // 使用 v1 API
  const response = await fetch(`/api/v1/folders/${id}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "获取文件夹详情失败");
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * 获取文件夹路径（面包屑）
 */
async function fetchFolderPath(id: number): Promise<Folder[]> {
  // 使用 v1 API
  const response = await fetch(`/api/v1/folders/${id}/path`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "获取文件夹路径失败");
  }

  const data = await response.json();

  // 适配 v1 API 响应格式: { success, data: { path: [...] } }
  const inner = data.data || data;
  return inner.path || (Array.isArray(inner) ? inner : []);
}

// ============================================
// Query Hooks
// ============================================

/**
 * 文件夹列表查询（扁平结构）
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useFoldersQuery();
 * ```
 */
export function useFoldersQuery(filters?: FolderFilters) {
  return useQuery({
    queryKey: folderKeys.list(filters),
    queryFn: () => fetchFolders(filters),
    staleTime: 5 * 60 * 1000, // 5 分钟
  });
}

/**
 * 文件夹树形结构查询
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useFolderTree();
 * ```
 */
export function useFolderTree() {
  return useQuery({
    queryKey: folderKeys.tree(),
    queryFn: fetchFolderTree,
    staleTime: 5 * 60 * 1000, // 5 分钟
  });
}

/**
 * 文件夹详情查询
 */
export function useFolderDetail(id: number | null) {
  return useQuery({
    queryKey: folderKeys.detail(id!),
    queryFn: () => fetchFolder(id!),
    enabled: id !== null && id !== undefined,
  });
}

/**
 * 文件夹路径查询（面包屑）
 */
export function useFolderPath(id: number | null) {
  return useQuery({
    queryKey: folderKeys.path(id!),
    queryFn: () => fetchFolderPath(id!),
    enabled: id !== null && id !== undefined,
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * 创建文件夹
 */
export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateFolderInput) => {
      // 使用 v1 API
      const response = await fetch("/api/v1/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "创建文件夹失败");
      }

      return response.json();
    },
    onSuccess: () => {
      // 使所有文件夹相关查询失效
      queryClient.invalidateQueries({ queryKey: folderKeys.all });
    },
  });
}

/**
 * 更新文件夹
 */
export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: UpdateFolderInput;
    }) => {
      // 使用 v1 API
      const response = await fetch(`/api/v1/folders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "更新文件夹失败");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: folderKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: folderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: folderKeys.tree() });
    },
  });
}

/**
 * 删除文件夹（乐观更新）
 */
export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      // 使用 v1 API
      const response = await fetch(`/api/v1/folders/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "删除文件夹失败");
      }
    },

    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: folderKeys.all });

      const previousTree = queryClient.getQueryData<InternalFolderTreeResponse>(
        folderKeys.tree(),
      );
      const previousLists =
        queryClient.getQueriesData<InternalFolderListResponse>({
          queryKey: folderKeys.lists(),
        });

      // 乐观更新树形结构
      if (previousTree) {
        queryClient.setQueryData<InternalFolderTreeResponse>(
          folderKeys.tree(),
          {
            ...previousTree,
            tree: filterFolderTree(previousTree.tree, deletedId),
            total: previousTree.total - 1,
          },
        );
      }

      // 乐观更新列表
      queryClient.setQueriesData<InternalFolderListResponse>(
        { queryKey: folderKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            folders: old.folders.filter((f) => f.id !== deletedId),
            total: old.total - 1,
          };
        },
      );

      return { previousTree, previousLists };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousTree) {
        queryClient.setQueryData(folderKeys.tree(), context.previousTree);
      }
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: folderKeys.all });
    },
  });
}

/**
 * 移动文件夹
 */
export function useMoveFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MoveFolderInput & { id: number }) => {
      // 使用 v1 API
      const response = await fetch(`/api/v1/folders/${data.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetParentId: data.targetParentId }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "移动文件夹失败");
      }

      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderKeys.all });
    },
  });
}

/**
 * 批量排序文件夹
 */
export function useBatchSortFolders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      items: Array<{ id: number; sortOrder: number }>;
    }) => {
      // 使用 v1 API (转换参数格式)
      const response = await fetch("/api/v1/folders/batch-sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderings: data.items }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "排序文件夹失败");
      }

      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderKeys.all });
    },
  });
}

// ============================================
// Helper Functions
// ============================================

/**
 * 递归过滤文件夹树（移除指定 ID 的节点）
 */
function filterFolderTree(
  folders: FolderTreeNodeResponse[],
  idToRemove: number,
): FolderTreeNodeResponse[] {
  return folders
    .filter((f) => f.id !== idToRemove)
    .map((f) => ({
      ...f,
      children: f.children ? filterFolderTree(f.children, idToRemove) : [],
    }));
}
