/**
 * 未读消息数量 Hook
 * @description 获取未读消息数量，支持轮询刷新和延迟加载
 * @version 2.0.0 - 性能优化：增加延迟加载、请求去重、认证优化
 */

"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import type { UnreadCounts } from "@/lib/messages";
import { authFetcher } from "@/lib/api/fetch-with-auth";

// ============================================
// 配置常量
// ============================================

/** 默认轮询间隔（60秒，从 30 秒增加以减少请求） */
const DEFAULT_REFRESH_INTERVAL = 60_000;

/** 默认延迟加载时间（1.5秒） */
const DEFAULT_LOAD_DELAY = 1500;

// ============================================
// 类型定义
// ============================================

export interface UseUnreadCountOptions {
  /** 轮询间隔（毫秒），设为 0 禁用轮询 */
  refreshInterval?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 延迟加载时间（毫秒），0 表示立即加载 */
  loadDelay?: number;
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
// Fetcher（使用带认证的 fetcher）
// ============================================

async function fetcher(url: string): Promise<UnreadCounts> {
  const result = await authFetcher<{
    success: boolean;
    data: UnreadCounts;
    error?: { message: string };
  }>(url);
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
  const {
    refreshInterval = DEFAULT_REFRESH_INTERVAL,
    enabled = true,
    loadDelay = DEFAULT_LOAD_DELAY,
  } = options;

  // 延迟加载控制
  const [shouldFetch, setShouldFetch] = useState(loadDelay === 0);

  // 延迟加载逻辑
  useEffect(() => {
    if (!enabled || loadDelay === 0 || shouldFetch) return;

    let cleanup: (() => void) | undefined;

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => setShouldFetch(true), {
        timeout: loadDelay + 1000,
      });
      cleanup = () => window.cancelIdleCallback(idleId);
    } else {
      const timerId = setTimeout(() => setShouldFetch(true), loadDelay);
      cleanup = () => clearTimeout(timerId);
    }

    return cleanup;
  }, [enabled, loadDelay, shouldFetch]);

  const { data, error, isLoading, mutate } = useSWR<UnreadCounts>(
    enabled && shouldFetch ? "/api/messages/unread-count" : null,
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

  const refresh = async () => {
    await mutate();
  };

  return {
    total: data?.total ?? 0,
    silent: data?.silent ?? 0,
    normal: data?.normal ?? 0,
    important: data?.important ?? 0,
    isLoading: !shouldFetch || isLoading,
    error: error || null,
    refresh,
  };
}
