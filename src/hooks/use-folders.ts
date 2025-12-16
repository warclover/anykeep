/**
 * 文件夹列表缓存 Hook
 * @version V4.2.24 - 性能优化：使用 SWR 统一缓存，避免重复请求
 *
 * 解决的问题：
 * - 之前多个组件独立调用 /api/folders，导致 5+ 次重复请求
 * - 现在统一使用 SWR 缓存，所有组件共享同一份数据
 */

"use client";

import useSWR from "swr";
import type { Folder } from "@/types/supabase";

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

/** SWR 缓存 Key */
const SWR_KEY = "/api/folders";

/** 缓存时间：5 分钟 */
const DEDUPING_INTERVAL = 300000;

// ============================================
// Fetcher 函数
// ============================================

/**
 * 文件夹列表 Fetcher
 */
async function foldersFetcher(url: string): Promise<Folder[]> {
  const response = await fetch(url);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || "获取文件夹列表失败");
  }

  const data = await response.json();
  return data.data?.folders || data.folders || [];
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

  const {
    data,
    error: swrError,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<Folder[]>(enabled ? SWR_KEY : null, foldersFetcher, {
    // 5 分钟内不重复请求
    dedupingInterval: DEDUPING_INTERVAL,
    // 不在聚焦时自动刷新
    revalidateOnFocus: false,
    // 网络恢复时不自动刷新
    revalidateOnReconnect: false,
    // 保持之前的数据（避免闪烁）
    keepPreviousData: true,
    // 错误重试配置
    errorRetryCount: 2,
    errorRetryInterval: 3000,
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
    isValidating,
    error: swrError || null,
    refresh: async () => {
      await mutate();
    },
    mutate,
  };
}

/**
 * 预取文件夹数据（用于预热缓存）
 */
export async function prefetchFolders(): Promise<void> {
  // 触发一次请求，SWR 会自动缓存
  await foldersFetcher(SWR_KEY);
}

export default useFolders;
