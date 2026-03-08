/**
 * useBookmarks - TanStack Query Hook for Bookmarks
 *
 * 提供书签的查询、创建、更新、删除等操作
 * 支持乐观更新和缓存失效
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { bookmarkKeys, type BookmarkFilters } from "./keys";
import { invalidateBookmarkCaches } from "@/lib/cache/invalidate-caches";
import { API_PATHS } from "@/lib/constants/api-paths";
import type {
  BookmarkListResponse,
  BookmarkDetailResponse,
  BookmarkStatsResponse,
  BatchOperationResponse,
  UserTagsResponse,
  CreateBookmarkInput,
  UpdateBookmarkInput,
  BatchMoveInput,
  BatchAddTagsInput,
  BatchRemoveTagsInput,
} from "@/contracts";

// ============================================
// API Fetchers
// ============================================

/**
 * 构建查询参数
 */
function buildQueryParams(filters: BookmarkFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.folderId !== undefined && filters.folderId !== null) {
    params.set("folderId", String(filters.folderId));
  }
  if (filters.platform) {
    params.set("platform", filters.platform);
  }
  if (filters.isRead !== undefined) {
    params.set("isRead", String(filters.isRead));
  }
  if (filters.isStarred !== undefined) {
    params.set("isStarred", String(filters.isStarred));
  }
  if (filters.isInTrash !== undefined) {
    params.set("isInTrash", String(filters.isInTrash));
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }
  if (filters.offset) {
    params.set("offset", String(filters.offset));
  }
  if (filters.sortBy) {
    params.set("sortBy", filters.sortBy);
  }
  if (filters.sortOrder) {
    params.set("sortOrder", filters.sortOrder);
  }

  return params;
}

/**
 * 获取书签列表
 */
async function fetchBookmarks(
  filters: BookmarkFilters,
): Promise<BookmarkListResponse> {
  const params = buildQueryParams(filters);
  // 使用 v1 API
  const response = await fetch(`${API_PATHS.bookmarks.list}?${params}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "获取书签列表失败");
  }

  const data = await response.json();

  // 适配新旧两种 API 响应格式
  // v1 API: { success, data: { items, total, hasMore, ... } }
  // 旧 API: { success, data: { bookmarks, pagination: { total, hasMore } } }
  const inner = data.data || {};
  const limit = filters.limit || 20;
  const items = inner.items || inner.bookmarks || [];
  const total = inner.total ?? inner.pagination?.total ?? items.length;
  const hasMore =
    inner.hasMore ?? inner.pagination?.hasMore ?? items.length === limit;

  return {
    items,
    total,
    limit,
    offset: filters.offset || 0,
    hasMore,
  };
}

/**
 * 获取书签详情
 */
async function fetchBookmark(id: number): Promise<BookmarkDetailResponse> {
  // 使用 v1 API
  const response = await fetch(API_PATHS.bookmarks.detail(id));

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "获取书签详情失败");
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * 获取书签统计
 */
async function fetchBookmarkStats(): Promise<BookmarkStatsResponse> {
  // 使用 v1 API
  const response = await fetch(API_PATHS.bookmarks.stats);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "获取书签统计失败");
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * 获取用户标签
 */
async function fetchUserTags(): Promise<UserTagsResponse> {
  // 使用 v1 API
  const response = await fetch(API_PATHS.bookmarks.tags);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "获取用户标签失败");
  }

  const data = await response.json();
  // 适配 v1 响应格式: { success, data: { tags, total } }
  const inner = data.data || data;
  return {
    tags: inner.tags || [],
    total: inner.total || (inner.tags?.length ?? 0),
  };
}

// ============================================
// Query Hooks
// ============================================

/**
 * 书签列表查询
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useBookmarks({ folderId: 1, limit: 20 });
 * ```
 */
export function useBookmarks(filters: BookmarkFilters = {}) {
  return useQuery({
    queryKey: bookmarkKeys.list(filters),
    queryFn: () => fetchBookmarks(filters),
    staleTime: 5 * 60 * 1000, // 5 分钟
    placeholderData: keepPreviousData, // 搜索时保持之前数据，避免闪烁
  });
}

/**
 * 书签详情查询
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useBookmark(123);
 * ```
 */
export function useBookmark(id: number | null) {
  return useQuery({
    queryKey: bookmarkKeys.detail(id as number),
    queryFn: () => fetchBookmark(id as number),
    enabled: id !== null && id !== undefined,
  });
}

/**
 * 书签统计查询
 */
export function useBookmarkStats() {
  return useQuery({
    queryKey: bookmarkKeys.stats(),
    queryFn: fetchBookmarkStats,
    staleTime: 2 * 60 * 1000, // 2 分钟
  });
}

/**
 * 用户标签查询
 */
export function useUserTags() {
  return useQuery({
    queryKey: bookmarkKeys.userTags(),
    queryFn: fetchUserTags,
    staleTime: 10 * 60 * 1000, // 10 分钟
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * 创建书签
 */
export function useCreateBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBookmarkInput) => {
      // 使用 v1 API
      const response = await fetch(API_PATHS.bookmarks.list, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "创建书签失败");
      }

      return response.json();
    },
    onSuccess: () => {
      // 使所有列表查询失效
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.stats() });
    },
  });
}

/**
 * 更新书签
 */
export function useUpdateBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: UpdateBookmarkInput;
    }) => {
      // 使用 v1 API
      const response = await fetch(API_PATHS.bookmarks.detail(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "更新书签失败");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // 更新详情缓存
      queryClient.invalidateQueries({
        queryKey: bookmarkKeys.detail(variables.id),
      });
      // 使列表缓存失效
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    },
  });
}

/**
 * 删除书签（乐观更新）
 */
export function useDeleteBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      // 使用 v1 API
      const response = await fetch(API_PATHS.bookmarks.detail(id), {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "删除书签失败");
      }
    },

    // 乐观更新
    onMutate: async (deletedId) => {
      // 取消进行中的请求
      await queryClient.cancelQueries({ queryKey: bookmarkKeys.lists() });

      // 快照当前数据
      const previousLists = queryClient.getQueriesData<BookmarkListResponse>({
        queryKey: bookmarkKeys.lists(),
      });

      // 乐观更新所有列表
      queryClient.setQueriesData<BookmarkListResponse>(
        { queryKey: bookmarkKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((b) => b.id !== deletedId),
            total: old.total - 1,
          };
        },
      );

      return { previousLists };
    },

    // 错误回滚
    onError: (_err, _deletedId, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },

    // 完成后重新获取
    onSettled: () => {
      invalidateBookmarkCaches(queryClient);
    },
  });
}

/**
 * 批量删除书签
 */
export function useBatchDeleteBookmarks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: number[]): Promise<BatchOperationResponse> => {
      // 使用 v1 API
      const response = await fetch(API_PATHS.bookmarks.batchDelete, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "批量删除失败");
      }

      return response.json();
    },

    onMutate: async (deletedIds) => {
      await queryClient.cancelQueries({ queryKey: bookmarkKeys.lists() });

      const previousLists = queryClient.getQueriesData<BookmarkListResponse>({
        queryKey: bookmarkKeys.lists(),
      });

      queryClient.setQueriesData<BookmarkListResponse>(
        { queryKey: bookmarkKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((b) => !deletedIds.includes(b.id)),
            total: old.total - deletedIds.length,
          };
        },
      );

      return { previousLists };
    },

    onError: (_err, _vars, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.stats() });
    },
  });
}

/**
 * 批量移动书签（乐观更新）
 */
export function useBatchMoveBookmarks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: BatchMoveInput,
    ): Promise<BatchOperationResponse> => {
      // 使用 v1 API
      const response = await fetch(API_PATHS.bookmarks.batchMove, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "批量移动失败");
      }

      return response.json();
    },

    onMutate: async ({ ids, folderId }) => {
      await queryClient.cancelQueries({ queryKey: bookmarkKeys.lists() });

      const previousLists = queryClient.getQueriesData<BookmarkListResponse>({
        queryKey: bookmarkKeys.lists(),
      });

      // 乐观更新: 更新书签的 folderId
      queryClient.setQueriesData<BookmarkListResponse>(
        { queryKey: bookmarkKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((b) =>
              ids.includes(b.id) ? { ...b, folderId } : b,
            ),
          };
        },
      );

      return { previousLists };
    },

    onError: (_err, _vars, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    },
  });
}

/**
 * 批量添加标签
 */
export function useBatchAddTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: BatchAddTagsInput,
    ): Promise<BatchOperationResponse> => {
      // 使用 v1 API
      const response = await fetch(API_PATHS.bookmarks.batchTags, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: data.ids, tags: data.tags, action: "add" }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "批量添加标签失败");
      }

      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.userTags() });
    },
  });
}

/**
 * 批量移除标签
 */
export function useBatchRemoveTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: BatchRemoveTagsInput,
    ): Promise<BatchOperationResponse> => {
      // 使用 v1 API
      const response = await fetch(API_PATHS.bookmarks.batchTags, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: data.ids,
          tags: data.tags,
          action: "remove",
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "批量移除标签失败");
      }

      return response.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.lists() });
    },
  });
}

/**
 * 切换收藏状态
 */
export function useToggleStar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      isStarred,
    }: {
      id: number;
      isStarred: boolean;
    }) => {
      const response = await fetch(API_PATHS.bookmarks.detail(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStarred }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "切换收藏状态失败");
      }

      return response.json();
    },

    onMutate: async ({ id, isStarred }) => {
      const previousLists = queryClient.getQueriesData<BookmarkListResponse>({
        queryKey: bookmarkKeys.lists(),
      });

      queryClient.setQueriesData<BookmarkListResponse>(
        { queryKey: bookmarkKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((b) =>
              b.id === id ? { ...b, isStarred } : b,
            ),
          };
        },
      );

      return { previousLists };
    },

    onError: (_err, _vars, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.stats() });
    },
  });
}

/**
 * 标记已读/未读
 */
export function useToggleRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isRead }: { id: number; isRead: boolean }) => {
      const response = await fetch(API_PATHS.bookmarks.detail(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "切换已读状态失败");
      }

      return response.json();
    },

    onMutate: async ({ id, isRead }) => {
      const previousLists = queryClient.getQueriesData<BookmarkListResponse>({
        queryKey: bookmarkKeys.lists(),
      });

      queryClient.setQueriesData<BookmarkListResponse>(
        { queryKey: bookmarkKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((b) => (b.id === id ? { ...b, isRead } : b)),
          };
        },
      );

      return { previousLists };
    },

    onError: (_err, _vars, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.stats() });
    },
  });
}
