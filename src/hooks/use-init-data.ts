/**
 * 首页初始化数据 Hook
 * @description 使用聚合 API 一次获取所有首页数据，减少请求数量
 * @version 1.0.0
 *
 * 性能优化：
 * - 7+ 个请求合并为 1 个
 * - 单次认证替代 7+ 次重复认证
 * - 服务端并行获取数据
 */

"use client";

import useSWR from "swr";
import { authFetcher } from "@/lib/api/fetch-with-auth";
import type { SmartListClient } from "@/types/smart-list";
import type { Bookmark, Folder } from "@/types/supabase";

// ============================================
// 类型定义
// ============================================

/** 未读消息数量 */
export interface UnreadCounts {
  total: number;
  silent: number;
  normal: number;
  important: number;
}

/** 初始化数据响应 */
export interface InitData {
  bookmarks: Bookmark[];
  smartLists: SmartListClient[];
  unreadCount: UnreadCounts;
  folders: (Folder & { children?: Folder[] })[];
  _meta?: {
    authMethod: string;
    authDuration: number;
    dataDuration: number;
    totalDuration: number;
  };
}

/** API 响应类型 */
interface InitApiResponse {
  success: boolean;
  data: InitData;
  error?: { message: string };
}

/** Hook 选项 */
export interface UseInitDataOptions {
  /** 平台筛选 */
  platform?: string;
  /** 排序方式 */
  sort?: string;
  /** 文件夹筛选 */
  folder?: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 刷新间隔（毫秒），0 禁用 */
  refreshInterval?: number;
}

/** Hook 返回值 */
export interface UseInitDataResult {
  /** 书签列表 */
  bookmarks: Bookmark[];
  /** 智能列表 */
  smartLists: SmartListClient[];
  /** 未读消息数量 */
  unreadCount: UnreadCounts;
  /** 文件夹树 */
  folders: (Folder & { children?: Folder[] })[];
  /** 性能元数据 */
  meta: InitData["_meta"] | null;
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 更新书签（乐观更新） */
  updateBookmarks: (
    updater: (bookmarks: Bookmark[]) => Bookmark[],
  ) => Promise<void>;
  /** 更新智能列表（乐观更新） */
  updateSmartLists: (
    updater: (lists: SmartListClient[]) => SmartListClient[],
  ) => Promise<void>;
}

// ============================================
// 默认值
// ============================================

const DEFAULT_UNREAD_COUNT: UnreadCounts = {
  total: 0,
  silent: 0,
  normal: 0,
  important: 0,
};

// ============================================
// Fetcher
// ============================================

async function fetcher(url: string): Promise<InitData> {
  const result = await authFetcher<InitApiResponse>(url);
  if (!result.success) {
    throw new Error(result.error?.message || "获取初始数据失败");
  }
  return result.data;
}

// ============================================
// 构建 URL
// ============================================

function buildInitUrl(options: UseInitDataOptions): string {
  const params = new URLSearchParams();

  if (options.platform) {
    params.set("platform", options.platform);
  }
  if (options.sort) {
    params.set("sort", options.sort);
  }
  if (options.folder) {
    params.set("folder", options.folder);
  }

  const queryString = params.toString();
  return queryString ? `/api/init?${queryString}` : "/api/init";
}

// ============================================
// Hook 实现
// ============================================

export function useInitData(
  options: UseInitDataOptions = {},
): UseInitDataResult {
  const { enabled = true, refreshInterval = 0, ...queryOptions } = options;

  // 构建请求 URL
  const url = enabled ? buildInitUrl(queryOptions) : null;

  // SWR 获取数据
  const { data, error, isLoading, mutate } = useSWR<InitData>(url, fetcher, {
    refreshInterval: refreshInterval > 0 ? refreshInterval : undefined,
    // 性能优化配置
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    // 5 分钟内去重
    dedupingInterval: 300_000,
    // 保留旧数据
    keepPreviousData: true,
  });

  // 刷新数据
  const refresh = async () => {
    await mutate();
  };

  // 乐观更新书签
  const updateBookmarks = async (
    updater: (bookmarks: Bookmark[]) => Bookmark[],
  ) => {
    await mutate(
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          bookmarks: updater(prev.bookmarks),
        };
      },
      { revalidate: false },
    );
  };

  // 乐观更新智能列表
  const updateSmartLists = async (
    updater: (lists: SmartListClient[]) => SmartListClient[],
  ) => {
    await mutate(
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          smartLists: updater(prev.smartLists),
        };
      },
      { revalidate: false },
    );
  };

  return {
    bookmarks: data?.bookmarks ?? [],
    smartLists: data?.smartLists ?? [],
    unreadCount: data?.unreadCount ?? DEFAULT_UNREAD_COUNT,
    folders: data?.folders ?? [],
    meta: data?._meta ?? null,
    isLoading,
    error: error ?? null,
    refresh,
    updateBookmarks,
    updateSmartLists,
  };
}

export default useInitData;
