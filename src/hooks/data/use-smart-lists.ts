/**
 * 智能列表 Hook
 * @description 提供智能列表的 CRUD 操作、预览和排序功能
 * @version 10.0.0
 */

"use client";

import useSWR from "swr";
import { useCallback, useState } from "react";
import { authFetcher, fetchWithAuth } from "@/lib/api/fetch-with-auth";
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
  /** 是否加载中 */
  isLoading: boolean;
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

  const [isMutating, setIsMutating] = useState(false);

  // 构建 API URL
  const url = enabled ? `${API_BASE}?includePresets=${includePresets}` : null;

  // SWR 获取数据（优化配置）
  const { data, error, isLoading, mutate } = useSWR<SmartListClient[]>(
    url,
    fetcher,
    {
      refreshInterval: refreshInterval > 0 ? refreshInterval : undefined,
      // 性能优化：减少不必要的重新验证
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // 5 分钟内去重，减少重复请求
      dedupingInterval: 300_000,
      // 使用过期数据先展示，后台刷新
      keepPreviousData: true,
    },
  );

  const smartLists = data ?? [];

  // 分离预设和自定义列表
  const presetLists = smartLists.filter((list) => list.isPreset);
  const customLists = smartLists.filter((list) => !list.isPreset);

  // 刷新
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // 创建
  const create = useCallback(
    async (createData: CreateSmartListRequest): Promise<SmartListClient> => {
      setIsMutating(true);
      try {
        const newList = await createSmartList(createData);
        await mutate((prev) => [...(prev ?? []), newList], {
          revalidate: false,
        });
        return newList;
      } finally {
        setIsMutating(false);
      }
    },
    [mutate],
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
        await mutate(
          (prev) => prev?.map((list) => (list.id === id ? updatedList : list)),
          { revalidate: false },
        );
        return updatedList;
      } finally {
        setIsMutating(false);
      }
    },
    [mutate],
  );

  // 删除
  const remove = useCallback(
    async (id: number): Promise<void> => {
      setIsMutating(true);
      try {
        await deleteSmartList(id);
        await mutate((prev) => prev?.filter((list) => list.id !== id), {
          revalidate: false,
        });
      } finally {
        setIsMutating(false);
      }
    },
    [mutate],
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
        await mutate(
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
          { revalidate: false },
        );
      } finally {
        setIsMutating(false);
      }
    },
    [mutate],
  );

  // 初始化预设
  const initPresets = useCallback(async (): Promise<number> => {
    setIsMutating(true);
    try {
      const count = await initSmartListPresets();
      await mutate(); // 重新获取数据
      return count;
    } finally {
      setIsMutating(false);
    }
  }, [mutate]);

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
    isLoading,
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
