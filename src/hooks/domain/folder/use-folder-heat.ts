/**
 * 文件夹热度 Hook
 *
 * 获取用户所有文件夹的热度数据
 * 使用 TanStack Query 进行缓存管理
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { clientLogger } from "@/lib/client-logger";
import { folderHeatKeys } from "@/hooks/queries/keys";

// ==================== 类型定义 ====================

export interface FolderHeat {
  folderId: number;
  heat: number;
  recentCount: number;
  lastUpdated: string;
}

export interface UseFolderHeatOptions {
  /** 是否自动获取，默认 true */
  enabled?: boolean;
}

export interface UseFolderHeatReturn {
  /** 文件夹热度映射 (folderId -> heat) */
  heatMap: Map<number, number>;
  /** 热度数据列表 */
  heats: FolderHeat[];
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 获取单个文件夹热度 */
  getHeat: (folderId: number) => number;
  /** 刷新热度数据 */
  refresh: () => Promise<void>;
}

// ==================== RPC 返回类型 ====================

interface FolderHeatRpcResult {
  folder_id: number;
  heat_score: number | null;
  recent_additions: number | null;
  updated_at: string | null;
}

// ==================== 常量 ====================

/** 缓存时间：5 分钟 */
const STALE_TIME = 5 * 60 * 1000;

/** 刷新间隔：5 分钟 */
const REFETCH_INTERVAL = 5 * 60 * 1000;

// ==================== 数据获取 ====================

async function fetchFolderHeats(): Promise<FolderHeat[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("未登录");
  }

  // 获取用户所有文件夹的热度数据
  const { data, error } = await supabase
    .from("folder_profiles")
    .select("folder_id, heat_score, recent_additions, updated_at")
    .eq("user_id", user.id)
    .not("heat_score", "is", null);

  if (error) {
    clientLogger.error(
      { error },
      "[useFolderHeat] Failed to fetch folder heats",
    );
    throw new Error(error.message);
  }

  return (data || []).map((item: FolderHeatRpcResult) => ({
    folderId: item.folder_id,
    heat: item.heat_score ?? 0,
    recentCount: item.recent_additions ?? 0,
    lastUpdated: item.updated_at ?? "",
  }));
}

// ==================== Hook ====================

export function useFolderHeat(
  options: UseFolderHeatOptions = {},
): UseFolderHeatReturn {
  const { enabled = true } = options;

  const { data, error, isLoading, refetch } = useQuery<FolderHeat[], Error>({
    queryKey: folderHeatKeys.all,
    queryFn: fetchFolderHeats,
    enabled,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  // 构建热度映射 (使用 useMemo 避免每次渲染重新创建)
  const heatMap = useMemo(() => {
    const map = new Map<number, number>();
    (data || []).forEach((item) => {
      map.set(item.folderId, item.heat);
    });
    return map;
  }, [data]);

  // 获取单个文件夹热度
  const getHeat = useCallback(
    (folderId: number): number => {
      return heatMap.get(folderId) ?? 0;
    },
    [heatMap],
  );

  // 刷新数据
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    heatMap,
    heats: data || [],
    isLoading,
    error: error ?? null,
    getHeat,
    refresh,
  };
}

export default useFolderHeat;
