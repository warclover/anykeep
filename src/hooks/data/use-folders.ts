/**
 * 文件夹列表缓存 Hook
 * @version V5.5 - 统一 API 端点，消除 /api/folders 与 /api/v1/folders 双路径冲突
 *
 * 解决的问题：
 * - V5.4: SWR → TanStack Query 迁移
 * - V5.5: 端点统一到 /api/v1/folders，与 use-folders-query.ts 共享同一 fetcher
 *   两个 hook 现在使用相同的 cache key + 相同的 endpoint，彻底消除缓存数据不一致
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { folderKeys } from "@/hooks/queries/keys";
import type { Folder } from "@/types/supabase";
import { API_FOLDERS } from "@/lib/constants/api-paths";

// ============================================
// 类型定义
// ============================================

interface UseFoldersOptions {
  /** 是否启用数据获取（默认 true） */
  enabled?: boolean;
  /** 是否仅获取可用于移动的文件夹（排除系统文件夹等） */
  forMove?: boolean;
}

interface UseFoldersResult {
  /** 文件夹列表 */
  folders: Folder[];
  /** 是否正在加载（首次） */
  isLoading: boolean;
  /** 是否正在后台刷新 */
  isValidating: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 手动刷新 */
  refresh: () => Promise<void>;
  /** 乐观更新 */
  mutate: (
    data?: Folder[] | ((prev: Folder[] | undefined) => Folder[] | undefined),
    shouldRevalidate?: boolean,
  ) => Promise<Folder[] | undefined>;
}

// ============================================
// 常量配置
// ============================================

/** 缓存时间：5 分钟 */
const STALE_TIME = 5 * 60 * 1000;

// ============================================
// Fetcher 函数
// ============================================

/**
 * 文件夹列表 Fetcher
 * 使用 /api/v1/folders 端点（与 use-folders-query.ts 共享同一端点 + 同一 cache key）
 */
async function foldersFetcher(): Promise<Folder[]> {
  const response = await fetch(API_FOLDERS.v1List);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.error?.message || data.message || "获取文件夹列表失败",
    );
  }

  const data = await response.json();
  // v1 API 返回 { success: true, data: { folders: [...], total: N } }
  const inner = data.data || data;
  return inner.folders || (Array.isArray(inner) ? inner : []);
}

// ============================================
// Hook 实现
// ============================================

/**
 * 文件夹列表缓存 Hook
 *
 * @example
 * ```tsx
 * // 基本用法
 * const { folders, isLoading } = useFolders();
 *
 * // 用于移动对话框（排除系统文件夹）
 * const { folders } = useFolders({ forMove: true });
 *
 * // 条件获取
 * const { folders } = useFolders({ enabled: isDialogOpen });
 * ```
 */
export function useFolders(options: UseFoldersOptions = {}): UseFoldersResult {
  const { enabled = true, forMove = false } = options;
  const queryClient = useQueryClient();

  const {
    data,
    error: queryError,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<Folder[]>({
    // 使用统一的 folderKeys，与 use-folders-query.ts 共享缓存
    queryKey: folderKeys.list(),
    queryFn: foldersFetcher,
    enabled,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
    retryDelay: 3000,
  });

  // 过滤文件夹（用于移动场景）
  let folders = data || [];
  if (forMove && folders.length > 0) {
    folders = folders.filter(
      (f) =>
        // 排除已删除
        !f.deleted_at &&
        // 排除已停用
        !f.is_archived,
    );
  }

  return {
    folders,
    isLoading,
    isValidating: isFetching && !isLoading,
    error: queryError || null,
    refresh: async () => {
      await refetch();
    },
    mutate: async (updater, shouldRevalidate = true) => {
      if (typeof updater === "function") {
        const prev = queryClient.getQueryData<Folder[]>(folderKeys.list());
        const next = updater(prev);
        if (next !== undefined) {
          queryClient.setQueryData(folderKeys.list(), next);
        }
        if (shouldRevalidate) {
          await refetch();
        }
        return next;
      } else if (updater !== undefined) {
        queryClient.setQueryData(folderKeys.list(), updater);
        if (shouldRevalidate) {
          await refetch();
        }
        return updater;
      }
      if (shouldRevalidate) {
        await refetch();
      }
      return queryClient.getQueryData<Folder[]>(folderKeys.list());
    },
  };
}

/**
 * 预取文件夹数据（用于预热缓存）
 */
export async function prefetchFolders(): Promise<void> {
  // 触发一次请求，TanStack Query 会自动缓存
  await foldersFetcher();
}

export default useFolders;
