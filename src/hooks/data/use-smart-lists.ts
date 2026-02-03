/**
 * 智能列表 Hook
 * @description 提供智能列表的 CRUD 操作、预览和排序功能
 * @version 11.0.0 - 迁移到 TanStack Query
 * @version 10.1.0 - 2025-12-21 性能优化：添加 localStorage 缓存支持
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState, useEffect, useRef } from "react";
import { authFetcher, fetchWithAuth } from "@/lib/api/fetch-with-auth";
import {
  getSmartListCache,
  setSmartListCache,
  isCacheFresh,
} from "@/lib/smart-list/cache";
import { smartListKeys } from "@/hooks/queries/keys";
import type {
  SmartListClient,
  SmartListFilters,
  CreateSmartListRequest,
  UpdateSmartListRequest,
} from "@/types/smart-list";

// ============================================
// 配置常量
// ============================================

/** API 基础路径 */
const API_BASE = "/api/smart-lists";

/** 默认刷新间隔（5分钟） */
const DEFAULT_REFRESH_INTERVAL = 5 * 60 * 1000;

// ============================================
// 类型定义
// ============================================

export interface UseSmartListsOptions {
  /** 是否包含预设智能列表 */
  includePresets?: boolean;
  /** 轮询间隔（毫秒），设为 0 禁用轮询 */
  refreshInterval?: number;
  /** 是否启用 */
  enabled?: boolean;
}

export interface UseSmartListsResult {
  /** 智能列表数组 */
  smartLists: SmartListClient[];
  /** 预设智能列表 */
  presetLists: SmartListClient[];
  /** 自定义智能列表 */
  customLists: SmartListClient[];
  /** 是否加载中（有缓存时为 false） */
  isLoading: boolean;
  /** 是否首次加载（无缓存时为 true） */
  isFirstLoad: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 是否正在执行操作 */
  isMutating: boolean;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 创建智能列表 */
  create: (data: CreateSmartListRequest) => Promise<SmartListClient>;
  /** 更新智能列表 */
  update: (
    id: number,
    data: UpdateSmartListRequest,
  ) => Promise<SmartListClient>;
  /** 删除智能列表 */
  remove: (id: number) => Promise<void>;
  /** 预览筛选结果数量 */
  preview: (filters: SmartListFilters) => Promise<number>;
  /** 批量排序 */
  reorder: (ids: number[]) => Promise<void>;
  /** 初始化预设模板 */
  initPresets: () => Promise<number>;
  /** 切换置顶状态 */
  togglePin: (id: number, isPinned: boolean) => Promise<SmartListClient>;
}

// ============================================
// Fetcher（使用带认证的 fetcher）
// ============================================

interface SmartListApiResponse {
  success: boolean;
  data: { smartLists: SmartListClient[] };
  error?: { message: string };
}

async function fetcher(url: string): Promise<SmartListClient[]> {
  const result = await authFetcher<SmartListApiResponse>(url);
  if (!result.success) {
    throw new Error(result.error?.message || "获取智能列表失败");
  }
  return result.data.smartLists;
}

// ============================================
// API 函数
// ============================================

async function createSmartList(
  data: CreateSmartListRequest,
): Promise<SmartListClient> {
  const response = await fetchWithAuth(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const result = await response.json();
  if (!result.success || result.error) {
    throw new Error(result.error || "创建智能列表失败");
  }
  return result.data;
}

async function updateSmartList(
  id: number,
  data: UpdateSmartListRequest,
): Promise<SmartListClient> {
  const response = await fetchWithAuth(`${API_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const result = await response.json();
  if (!result.success || result.error) {
    throw new Error(result.error || "更新智能列表失败");
  }
  return result.data;
}

async function deleteSmartList(id: number): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/${id}`, {
    method: "DELETE",
  });

  const result = await response.json();
  if (!result.success || result.error) {
    throw new Error(result.error || "删除智能列表失败");
  }
}

async function previewSmartList(filters: SmartListFilters): Promise<number> {
  const response = await fetchWithAuth(`${API_BASE}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters }),
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || "预览失败");
  }
  return result.data.count;
}

async function reorderSmartLists(ids: number[]): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE}/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });

  const result = await response.json();
  if (!result.success || result.error) {
    throw new Error(result.error || "排序失败");
  }
}

async function initSmartListPresets(): Promise<number> {
  const response = await fetchWithAuth(`${API_BASE}/init-presets`, {
    method: "POST",
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || "初始化预设失败");
  }
  return result.data.created;
}

// ============================================
// Hook 实现
// ============================================

export function useSmartLists(
  options: UseSmartListsOptions = {},
): UseSmartListsResult {
  const {
    includePresets = true,
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const [isMutating, setIsMutating] = useState(false);

  // V10.1.0: localStorage 缓存支持
  const initialCacheRef = useRef<SmartListClient[] | null>(null);
  const hasMountedRef = useRef(false);

  // 首次挂载时读取缓存
  if (!hasMountedRef.current && typeof window !== "undefined") {
    initialCacheRef.current = getSmartListCache();
    hasMountedRef.current = true;
  }

  // 构建 API URL
  const url = `${API_BASE}?includePresets=${includePresets}`;

  // 检查缓存是否新鲜（60秒内）
  const cacheFresh = isCacheFresh();

  // V11.0.0: 使用 TanStack Query 获取数据
  const { data, error, isLoading, refetch } = useQuery<SmartListClient[]>({
    queryKey: smartListKeys.lists(),
    queryFn: () => fetcher(url),
    enabled,
    // V10.1.0: 使用 localStorage 缓存作为 initialData
    initialData: initialCacheRef.current ?? undefined,
    // 如果缓存新鲜，延长 staleTime
    staleTime: cacheFresh ? 60_000 : 0,
    // 5 分钟缓存时间
    gcTime: 300_000,
    // 性能优化：减少不必要的重新验证
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // 轮询间隔
    refetchInterval: refreshInterval > 0 ? refreshInterval : undefined,
    // 使用过期数据先展示
    placeholderData: (prev) => prev,
  });

  // V10.1.0: 数据更新后同步到 localStorage
  useEffect(() => {
    if (data && data.length > 0) {
      setSmartListCache(data);
    }
  }, [data]);

  // 使用数据或缓存
  const smartLists = data ?? initialCacheRef.current ?? [];

  // 判断是否为首次加载（无缓存且正在加载）
  const isFirstLoad = !initialCacheRef.current && isLoading;

  // 分离预设和自定义列表
  const presetLists = smartLists.filter((list) => list.isPreset);
  const customLists = smartLists.filter((list) => !list.isPreset);

  // 刷新
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // 创建
  const create = useCallback(
    async (createData: CreateSmartListRequest): Promise<SmartListClient> => {
      setIsMutating(true);
      try {
        const newList = await createSmartList(createData);
        // 乐观更新缓存
        queryClient.setQueryData<SmartListClient[]>(
          smartListKeys.lists(),
          (prev) => [...(prev ?? []), newList],
        );
        return newList;
      } finally {
        setIsMutating(false);
      }
    },
    [queryClient],
  );

  // 更新
  const update = useCallback(
    async (
      id: number,
      updateData: UpdateSmartListRequest,
    ): Promise<SmartListClient> => {
      setIsMutating(true);
      try {
        const updatedList = await updateSmartList(id, updateData);
        // 乐观更新缓存
        queryClient.setQueryData<SmartListClient[]>(
          smartListKeys.lists(),
          (prev) => prev?.map((list) => (list.id === id ? updatedList : list)),
        );
        return updatedList;
      } finally {
        setIsMutating(false);
      }
    },
    [queryClient],
  );

  // 删除
  const remove = useCallback(
    async (id: number): Promise<void> => {
      setIsMutating(true);
      try {
        await deleteSmartList(id);
        // 乐观更新缓存
        queryClient.setQueryData<SmartListClient[]>(
          smartListKeys.lists(),
          (prev) => prev?.filter((list) => list.id !== id),
        );
      } finally {
        setIsMutating(false);
      }
    },
    [queryClient],
  );

  // 预览
  const preview = useCallback(
    async (filters: SmartListFilters): Promise<number> => {
      return await previewSmartList(filters);
    },
    [],
  );

  // 排序
  const reorder = useCallback(
    async (ids: number[]): Promise<void> => {
      setIsMutating(true);
      try {
        await reorderSmartLists(ids);
        // 乐观更新本地顺序
        queryClient.setQueryData<SmartListClient[]>(
          smartListKeys.lists(),
          (prev) => {
            if (!prev) return prev;
            const orderedList = ids
              .map((id, index) => {
                const list = prev.find((l) => l.id === id);
                return list ? { ...list, sortOrder: index } : null;
              })
              .filter(Boolean) as SmartListClient[];
            // 保留不在排序列表中的项
            const notInOrder = prev.filter((l) => !ids.includes(l.id));
            return [...orderedList, ...notInOrder];
          },
        );
      } finally {
        setIsMutating(false);
      }
    },
    [queryClient],
  );

  // 初始化预设
  const initPresets = useCallback(async (): Promise<number> => {
    setIsMutating(true);
    try {
      const count = await initSmartListPresets();
      await refetch(); // 重新获取数据
      return count;
    } finally {
      setIsMutating(false);
    }
  }, [refetch]);

  // 切换置顶
  const togglePin = useCallback(
    async (id: number, isPinned: boolean): Promise<SmartListClient> => {
      return await update(id, { isPinned });
    },
    [update],
  );

  return {
    smartLists,
    presetLists,
    customLists,
    // V10.1.0: 有缓存时不显示 loading 状态
    isLoading: isFirstLoad,
    isFirstLoad,
    error: error || null,
    isMutating,
    refresh,
    create,
    update,
    remove,
    preview,
    reorder,
    initPresets,
    togglePin,
  };
}

export default useSmartLists;
