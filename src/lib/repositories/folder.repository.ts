/**
 * Folder Repository
 * @description Phase 2 架构优化 - 文件夹数据仓库
 * @version 1.0.0
 *
 * 职责：
 * - 统一文件夹数据的获取和缓存管理
 * - 提供类型安全的数据访问接口
 * - 封装 SWR 缓存逻辑
 * - 支持树形结构操作
 */

import useSWR, { mutate as globalMutate } from "swr";
import { apiClient } from "@/lib/api/client";
import type { Folder } from "@/types/supabase";
import type {
  CreateFolderParams,
  UpdateFolderParams,
  ReorderFoldersParams,
} from "@/lib/api/client";

// ============================================================================
// 类型定义
// ============================================================================

/** 带子文件夹的文件夹类型 */
export type FolderWithChildren = Folder & { children?: FolderWithChildren[] };

// ============================================================================
// 缓存键管理
// ============================================================================

/**
 * 文件夹相关的 SWR 缓存键
 */
export const folderKeys = {
  /** 所有文件夹相关键的前缀 */
  all: ["folders"] as const,

  /** 文件夹列表（树形）键 */
  tree: () => [...folderKeys.all, "tree"] as const,

  /** 文件夹详情键 */
  details: () => [...folderKeys.all, "detail"] as const,

  /** 特定文件夹详情键 */
  detail: (id: number) => [...folderKeys.details(), id] as const,

  /** 文件夹建议键 */
  suggestions: (bookmarkId?: number) =>
    [...folderKeys.all, "suggestions", bookmarkId] as const,
} as const;

// ============================================================================
// Repository Hooks
// ============================================================================

/**
 * 使用文件夹树
 *
 * @example
 * ```typescript
 * const { folders, isLoading, error, refresh } = useFolderTree();
 * ```
 */
export function useFolderTree() {
  const { data, error, isLoading, mutate } = useSWR(
    folderKeys.tree(),
    () => apiClient.folders.list(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300_000, // 5 分钟去重
      keepPreviousData: true,
    },
  );

  return {
    folders: data ?? [],
    isLoading,
    error: error ?? null,
    refresh: () => mutate(),
    /**
     * 乐观更新文件夹树
     */
    optimisticUpdate: async (
      updater: (folders: FolderWithChildren[]) => FolderWithChildren[],
    ) => {
      await mutate((prev) => (prev ? updater(prev) : prev), {
        revalidate: false,
      });
    },
  };
}

/**
 * 使用单个文件夹详情
 *
 * @example
 * ```typescript
 * const { folder, isLoading, error } = useFolderDetail(123);
 * ```
 */
export function useFolderDetail(id: number | null) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? folderKeys.detail(id) : null,
    () => (id ? apiClient.folders.get(id) : null),
    {
      revalidateOnFocus: false,
    },
  );

  return {
    folder: data ?? null,
    isLoading,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

/**
 * 使用文件夹建议
 *
 * @example
 * ```typescript
 * const { suggestions, isLoading } = useFolderSuggestions(bookmarkId);
 * ```
 */
export function useFolderSuggestions(bookmarkId?: number) {
  const { data, error, isLoading, mutate } = useSWR(
    folderKeys.suggestions(bookmarkId),
    () => apiClient.folders.suggestions(bookmarkId),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  return {
    suggestions: data ?? [],
    isLoading,
    error: error ?? null,
    refresh: () => mutate(),
  };
}

// ============================================================================
// Repository 操作方法
// ============================================================================

/**
 * 文件夹数据仓库
 *
 * @example
 * ```typescript
 * // 获取文件夹树
 * const folders = await folderRepository.getTree();
 *
 * // 创建文件夹
 * const folder = await folderRepository.create({ name: 'New Folder' });
 *
 * // 更新文件夹
 * await folderRepository.update(123, { name: 'Renamed' });
 * ```
 */
export const folderRepository = {
  /**
   * 获取文件夹树
   */
  async getTree(): Promise<FolderWithChildren[]> {
    return apiClient.folders.list();
  },

  /**
   * 获取单个文件夹
   */
  async get(id: number): Promise<Folder> {
    return apiClient.folders.get(id);
  },

  /**
   * 创建文件夹
   */
  async create(params: CreateFolderParams): Promise<Folder> {
    const folder = await apiClient.folders.create(params);

    // 失效文件夹树缓存
    await globalMutate(folderKeys.tree(), undefined, { revalidate: true });

    return folder;
  },

  /**
   * 更新文件夹
   */
  async update(id: number, params: UpdateFolderParams): Promise<Folder> {
    const folder = await apiClient.folders.update(id, params);

    // 更新详情缓存
    await globalMutate(folderKeys.detail(id), folder, { revalidate: false });

    // 失效树缓存
    await globalMutate(folderKeys.tree(), undefined, { revalidate: true });

    return folder;
  },

  /**
   * 删除文件夹
   */
  async delete(id: number): Promise<void> {
    await apiClient.folders.delete(id);

    // 清除详情缓存
    await globalMutate(folderKeys.detail(id), undefined, { revalidate: false });

    // 失效树缓存
    await globalMutate(folderKeys.tree(), undefined, { revalidate: true });
  },

  /**
   * 重排序文件夹
   */
  async reorder(params: ReorderFoldersParams): Promise<void> {
    await apiClient.folders.reorder(params);

    // 失效树缓存
    await globalMutate(folderKeys.tree(), undefined, { revalidate: true });
  },

  /**
   * 获取文件夹建议
   */
  async getSuggestions(
    bookmarkId?: number,
  ): Promise<{ folders: Folder[]; reason: string }[]> {
    return apiClient.folders.suggestions(bookmarkId);
  },

  /**
   * 失效所有文件夹缓存
   */
  async invalidateAll(): Promise<void> {
    await globalMutate(
      (key) => Array.isArray(key) && key[0] === "folders",
      undefined,
      { revalidate: true },
    );
  },

  /**
   * 在树中查找文件夹
   */
  findInTree(
    folders: FolderWithChildren[],
    id: number,
  ): FolderWithChildren | null {
    for (const folder of folders) {
      if (folder.id === id) {
        return folder;
      }
      if (folder.children) {
        const found = folderRepository.findInTree(folder.children, id);
        if (found) return found;
      }
    }
    return null;
  },

  /**
   * 获取文件夹路径（从根到目标）
   */
  getPath(folders: FolderWithChildren[], id: number): FolderWithChildren[] {
    const path: FolderWithChildren[] = [];

    function findPath(items: FolderWithChildren[], targetId: number): boolean {
      for (const item of items) {
        path.push(item);
        if (item.id === targetId) {
          return true;
        }
        if (item.children && findPath(item.children, targetId)) {
          return true;
        }
        path.pop();
      }
      return false;
    }

    findPath(folders, id);
    return path;
  },

  /**
   * 扁平化文件夹树
   */
  flatten(folders: FolderWithChildren[]): Folder[] {
    const result: Folder[] = [];

    function traverse(items: FolderWithChildren[]) {
      for (const item of items) {
        // 移除 children 属性后添加到结果

        const { children, ...folder } = item;
        result.push(folder);
        if (children) {
          traverse(children);
        }
      }
    }

    traverse(folders);
    return result;
  },
};

// 导出类型
export type FolderRepository = typeof folderRepository;
