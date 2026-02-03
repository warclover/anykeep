/**
 * 监控数据获取 Hooks
 *
 * @version 2.0.0 - 迁移到 TanStack Query
 * @since 2025-12-28
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { monitorKeys } from "@/hooks/queries/keys";
import type {
  MonitorResponse,
  MonitorDetailResponse,
  MonitorStatsResponse,
} from "@/app/api/monitors/validation";

const API_BASE = "/api/monitors";

/** 缓存时间：1 分钟 */
const STALE_TIME = 60 * 1000;

/**
 * 通用 fetcher
 */
const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "请求失败" }));
    throw new Error(error.message || "请求失败");
  }
  const json = await res.json();
  return json.data;
};

/**
 * 监控列表响应数据
 */
interface MonitorListData {
  monitors: MonitorResponse[];
  stats: MonitorStatsResponse;
  pagination: {
    offset: number;
    limit: number;
    total: number;
  };
}

/**
 * 获取监控列表 Hook
 */
export function useMonitors(
  status: "all" | "active" | "paused" | "failed" = "all",
) {
  const { data, error, isLoading, refetch } = useQuery<MonitorListData>({
    queryKey: monitorKeys.list(status),
    queryFn: () => fetcher<MonitorListData>(`${API_BASE}?status=${status}`),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  return {
    monitors: data?.monitors ?? [],
    stats: data?.stats ?? null,
    pagination: data?.pagination ?? null,
    isLoading,
    error,
    refresh: refetch,
  };
}

/**
 * 获取单个监控详情 Hook
 */
export function useMonitor(monitorId: number | null) {
  const { data, error, isLoading, refetch } = useQuery<MonitorDetailResponse>({
    queryKey: monitorKeys.detail(monitorId ?? 0),
    queryFn: () => fetcher<MonitorDetailResponse>(`${API_BASE}/${monitorId}`),
    enabled: monitorId !== null,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  return {
    monitor: data ?? null,
    isLoading,
    error,
    refresh: refetch,
  };
}

/**
 * 监控操作 Hook
 */
export function useMonitorActions() {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const invalidateMonitors = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: monitorKeys.all });
  }, [queryClient]);

  /**
   * 创建监控
   */
  const createMonitor = useCallback(
    async (params: {
      bookmarkId: number;
      checkInterval?: string;
      customIntervalHours?: number;
      notificationEnabled?: boolean;
    }) => {
      setIsLoading(true);
      try {
        const res = await fetch(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.message || "创建失败");
        }

        toast.success("监控创建成功");
        await invalidateMonitors();
        return json.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "创建失败";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [invalidateMonitors],
  );

  /**
   * 更新监控
   */
  const updateMonitor = useCallback(
    async (
      monitorId: number,
      params: {
        checkInterval?: string;
        customIntervalHours?: number;
        notificationEnabled?: boolean;
      },
    ) => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/${monitorId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.message || "更新失败");
        }

        toast.success("监控设置已更新");
        await invalidateMonitors();
        return json.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "更新失败";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [invalidateMonitors],
  );

  /**
   * 删除监控
   */
  const deleteMonitor = useCallback(
    async (monitorId: number) => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/${monitorId}`, {
          method: "DELETE",
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.message || "删除失败");
        }

        toast.success("监控已删除");
        await invalidateMonitors();
        return json.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "删除失败";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [invalidateMonitors],
  );

  /**
   * 暂停监控
   */
  const pauseMonitor = useCallback(
    async (monitorId: number) => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/${monitorId}/pause`, {
          method: "POST",
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.message || "暂停失败");
        }

        toast.success("监控已暂停");
        await invalidateMonitors();
        return json.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "暂停失败";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [invalidateMonitors],
  );

  /**
   * 恢复监控
   */
  const resumeMonitor = useCallback(
    async (monitorId: number) => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/${monitorId}/resume`, {
          method: "POST",
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.message || "恢复失败");
        }

        toast.success("监控���恢复");
        await invalidateMonitors();
        return json.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "恢复失败";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [invalidateMonitors],
  );

  return {
    createMonitor,
    updateMonitor,
    deleteMonitor,
    pauseMonitor,
    resumeMonitor,
    isLoading,
  };
}
