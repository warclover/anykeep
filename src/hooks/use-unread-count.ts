/**
 * 未读消息数量 Hook
 * @description 获取未读消息数量，支持轮询刷新
 */

"use client";

import useSWR from "swr";
import type { UnreadCounts } from "@/lib/messages";

// ============================================
// 配置常量
// ============================================

/** 默认轮询间隔（30秒） */
const DEFAULT_REFRESH_INTERVAL = 30_000;

// ============================================
// 类型定义
// ============================================

export interface UseUnreadCountOptions {
  /** 轮询间隔（毫秒），设为 0 禁用轮询 */
  refreshInterval?: number;
  /** 是否启用 */
  enabled?: boolean;
}

export interface UseUnreadCountResult {
  /** 未读消息总数 */
  total: number;
  /** 静默级别未读数 */
  silent: number;
  /** 普通级别未读数 */
  normal: number;
  /** 重要级别未读数 */
  important: number;
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 刷新数据 */
  refresh: () => Promise<void>;
}

// ============================================
// Fetcher
// ============================================

async function fetcher(url: string): Promise<UnreadCounts> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("获取未读消息数量失败");
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || "获取未读消息数量失败");
  }
  return result.data;
}

// ============================================
// Hook 实现
// ============================================

export function useUnreadCount(
  options: UseUnreadCountOptions = {},
): UseUnreadCountResult {
  const { refreshInterval = DEFAULT_REFRESH_INTERVAL, enabled = true } =
    options;

  const { data, error, isLoading, mutate } = useSWR<UnreadCounts>(
    enabled ? "/api/messages/unread-count" : null,
    fetcher,
    {
      refreshInterval: refreshInterval > 0 ? refreshInterval : undefined,
      revalidateOnFocus: true,
      dedupingInterval: 5000, // 5 秒内去重
    },
  );

  const refresh = async () => {
    await mutate();
  };

  return {
    total: data?.total ?? 0,
    silent: data?.silent ?? 0,
    normal: data?.normal ?? 0,
    important: data?.important ?? 0,
    isLoading,
    error: error || null,
    refresh,
  };
}
