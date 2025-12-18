/**
 * Bookmark Repository
 * @description Phase 2 架构优化 - 书签数据仓库
 * @version 1.0.0
 *
 * 职责：
 * - 统一书签数据的获取和缓存管理
 * - 提供类型安全的数据访问接口
 * - 封装 SWR 缓存逻辑
 * - 支持乐观更新
 */

import useSWR, { mutate as globalMutate } from "swr";
import { apiClient } from "@/lib/api/client";
import type { Bookmark } from "@/types/supabase";
import type {
  BookmarkListParams,
  CreateBookmarkParams,
  UpdateBookmarkParams,
  BatchMoveParams,
  BatchDeleteParams,
} from "@/lib/api/client";

// ============================================================================
// 缓存键管理
// ============================================================================

/**
 * 书签相关的 SWR 缓存键
 */
export const bookmarkKeys = {
  /** 所有书签相关键的前缀 */
  all: ["bookmarks"] as const,

  /** 书签列表键 */
  lists: () => [...bookmarkKeys.all, "list"] as const,

  /** 特定参数的书签列表键 */
  list: (params: BookmarkListParams) =>
    [...bookmarkKeys.lists(), params] as const,

  /** 书签详情键 */
  details: () => [...bookmarkKeys.all, "detail"] as const,

  /** 特定书签详情键 */
  detail: (id: number) => [...bookmarkKeys.details(), id] as const,
} as const;

// ============================================================================
// Repository Hooks
// ============================================================================

/**
 * 使用书签列表
 *
 * @example
 * ```typescript
 * const { bookmarks, isLoading, error, refresh } = useBookmarkList({
 *   platform: 'WECHAT',
 *   sort: 'created_desc',
 * });
 * ```
 */
export function useBookmarkList(params: BookmarkListParams = {}) {
  const { data, error, isLoading, mutate } = useSWR(
    bookmarkKeys.list(params),
    () => apiClient.bookmarks.list(params),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000, // 1 分钟去重
      keepPreviousData: true,
    },
  );

  return {
    bookmarks: data ?? [],
    isLoading,
    error: error ?? null,
    refresh: () => mutate(),
    /**
     * 乐观更新书签列表
     */
    optimisticUpdate: async (
      updater: (bookmarks: Bookmark[]) => Bookmark[],
    ) => {
      await mutate((prev) => (prev ? updater(prev) : prev), {
        revalidate: false,
      });
    },
  };
}

/**
 * 使用单个书签详情
 *
 * @example
 * ```typescript
 * const { bookmark, isLoading, error } = useBookmarkDetail(123);
 * ```
 */
export function useBookmarkDetail(id: number | null) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? bookmarkKeys.detail(id) : null,
    () => (id ? apiClient.bookmarks.get(id) : null),
    {
      revalidateOnFocus: false,
    },
  );

  return {
    bookmark: data ?? null,
    isLoading,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

// ============================================================================
// Repository 操作方法
// ============================================================================

/**
 * 书签数据仓库
 *
 * @example
 * ```typescript
 * // 创建书签
 * const bookmark = await bookmarkRepository.create({ url: 'https://...' });
 *
 * // 更新书签
 * await bookmarkRepository.update(123, { title: 'New Title' });
 *
 * // 删除书签
 * await bookmarkRepository.delete(123);
 * ```
 */
export const bookmarkRepository = {
  /**
   * 获取书签列表
   */
  async getList(params: BookmarkListParams = {}): Promise<Bookmark[]> {
    return apiClient.bookmarks.list(params);
  },

  /**
   * 获取单个书签
   */
  async get(id: number): Promise<Bookmark> {
    return apiClient.bookmarks.get(id);
  },

  /**
   * 创建书签
   */
  async create(params: CreateBookmarkParams): Promise<Bookmark> {
    const bookmark = await apiClient.bookmarks.create(params);

    // 失效所有书签列表缓存
    await globalMutate(
      (key) =>
        Array.isArray(key) && key[0] === "bookmarks" && key[1] === "list",
      undefined,
      { revalidate: true },
    );

    return bookmark;
  },

  /**
   * 更新书签
   */
  async update(id: number, params: UpdateBookmarkParams): Promise<Bookmark> {
    const bookmark = await apiClient.bookmarks.update(id, params);

    // 更新详情缓存
    await globalMutate(bookmarkKeys.detail(id), bookmark, {
      revalidate: false,
    });

    // 失效列表缓存
    await globalMutate(
      (key) =>
        Array.isArray(key) && key[0] === "bookmarks" && key[1] === "list",
      undefined,
      { revalidate: true },
    );

    return bookmark;
  },

  /**
   * 删除书签
   */
  async delete(id: number): Promise<void> {
    await apiClient.bookmarks.delete(id);

    // 清除详情缓存
    await globalMutate(bookmarkKeys.detail(id), undefined, {
      revalidate: false,
    });

    // 失效列表缓存
    await globalMutate(
      (key) =>
        Array.isArray(key) && key[0] === "bookmarks" && key[1] === "list",
      undefined,
      { revalidate: true },
    );
  },

  /**
   * 批量移动书签
   */
  async batchMove(params: BatchMoveParams): Promise<void> {
    await apiClient.bookmarks.batchMove(params);

    // 失效所有书签缓存
    await bookmarkRepository.invalidateAll();
  },

  /**
   * 批量删除书签
   */
  async batchDelete(params: BatchDeleteParams): Promise<void> {
    await apiClient.bookmarks.batchDelete(params);

    // 清除相关详情缓存
    for (const id of params.bookmarkIds) {
      await globalMutate(bookmarkKeys.detail(id), undefined, {
        revalidate: false,
      });
    }

    // 失效列表缓存
    await globalMutate(
      (key) =>
        Array.isArray(key) && key[0] === "bookmarks" && key[1] === "list",
      undefined,
      { revalidate: true },
    );
  },

  /**
   * 失效所有书签缓存
   */
  async invalidateAll(): Promise<void> {
    await globalMutate(
      (key) => Array.isArray(key) && key[0] === "bookmarks",
      undefined,
      { revalidate: true },
    );
  },

  /**
   * 乐观更新书签（不发请求，仅更新缓存）
   */
  async optimisticUpdate(
    id: number,
    updater: (bookmark: Bookmark) => Bookmark,
  ): Promise<void> {
    // 更新详情缓存
    await globalMutate(
      bookmarkKeys.detail(id),
      (prev: Bookmark | undefined) => (prev ? updater(prev) : prev),
      { revalidate: false },
    );

    // 更新列表缓存中的该书签
    await globalMutate(
      (key) =>
        Array.isArray(key) && key[0] === "bookmarks" && key[1] === "list",
      (prev: Bookmark[] | undefined) =>
        prev?.map((b) => (b.id === id ? updater(b) : b)),
      { revalidate: false },
    );
  },
};

// 导出类型
export type BookmarkRepository = typeof bookmarkRepository;
