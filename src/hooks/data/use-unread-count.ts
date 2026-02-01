/**
 * 未读通知数量 Hook
 * @description 获取未读通知数量，基于新的 user_notifications 表
 * @version 3.0.0 - 重构：使用 useNotificationCounts 代理
 */

"use client";

import { useNotificationCounts } from "./use-notifications";

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
  /** 紧急级别未读数 */
  critical: number;
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 刷���数据 */
  refresh: () => Promise<void>;
}

// ============================================
// Hook 实现（代理到新 Hook）
// ============================================

/**
 * 获取未读通知数量
 * @deprecated 建议直接使用 useNotificationCounts
 */
export function useUnreadCount(
  options: UseUnreadCountOptions = {},
): UseUnreadCountResult {
  const { enabled = true } = options;

  const { counts, isLoading, refresh } = useNotificationCounts();

  return {
    total: enabled ? counts.total : 0,
    silent: enabled ? counts.silent : 0,
    normal: enabled ? counts.normal : 0,
    important: enabled ? counts.important : 0,
    critical: enabled ? counts.critical : 0,
    isLoading: enabled ? isLoading : false,
    error: null,
    refresh: async () => {
      if (enabled) {
        refresh();
      }
    },
  };
}
