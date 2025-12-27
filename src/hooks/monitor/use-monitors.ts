/**
 * 监控数据获取 Hooks
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

"use client";

import useSWR, { useSWRConfig } from "swr";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import type {
  MonitorResponse,
  MonitorDetailResponse,
  MonitorStatsResponse,
} from "@/app/api/monitors/validation";

const API_BASE = "/api/monitors";

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
  const { data, error, isLoading, mutate } = useSWR<MonitorListData>(
    `${API_BASE}?status=${status}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    },
  );

  return {
    monitors: data?.monitors ?? [],
    stats: data?.stats ?? null,
    pagination: data?.pagination ?? null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * 获取单个监控详情 Hook
 */
export function useMonitor(monitorId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<MonitorDetailResponse>(
    monitorId ? `${API_BASE}/${monitorId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return {
    monitor: data ?? null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * 监控操作 Hook
 */
export function useMonitorActions() {
  const { mutate } = useSWRConfig();
  const [isLoading, setIsLoading] = useState(false);

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
        // 刷新列表
        mutate((key) => typeof key === "string" && key.startsWith(API_BASE));
        return json.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "创建失败";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [mutate],
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
        mutate((key) => typeof key === "string" && key.startsWith(API_BASE));
        return json.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "更新失败";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [mutate],
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
        mutate((key) => typeof key === "string" && key.startsWith(API_BASE));
        return json.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "删除失败";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [mutate],
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
        mutate((key) => typeof key === "string" && key.startsWith(API_BASE));
        return json.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "暂停失败";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [mutate],
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

        toast.success("监控已恢复");
        mutate((key) => typeof key === "string" && key.startsWith(API_BASE));
        return json.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "恢复失败";
        toast.error(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [mutate],
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
