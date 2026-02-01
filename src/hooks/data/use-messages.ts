/**
 * 消息列表 Hook
 * @description 获取消息列表，代理到新的 useNotifications Hook
 * @version 2.0.0 - 重构：使用 useNotifications 代理
 */

"use client";

import { useCallback, useMemo } from "react";
import {
  useNotifications,
  type UseNotificationsOptions,
} from "./use-notifications";
import type {
  NotificationStatus,
  NotificationPriority,
} from "@/lib/notifications";

// ============================================
// 类型定义（保持向后兼容）
// ============================================

export type MessageStatus = NotificationStatus;
export type MessageLevel = NotificationPriority;

export interface MessageGroup {
  date_group: string;
  label: string;
  messages: Message[];
}

export interface Message {
  id: string;
  user_id: string;
  type: string;
  level: MessageLevel;
  title: string;
  content: string | null;
  action_url: string | null;
  action_label: string | null;
  status: MessageStatus;
  priority: number;
  created_at: string;
  read_at: string | null;
  expires_at?: string;
  metadata: Record<string, unknown>;
  related_bookmark_id: string | null;
  related_folder_id: string | null;
  related_import_id: string | null;
}

export interface UseMessagesOptions {
  /** 状态筛选 */
  status?: MessageStatus | "all";
  /** 等级筛选 */
  level?: MessageLevel;
  /** 每页数量 */
  limit?: number;
  /** 是否自动刷新 */
  refreshInterval?: number;
}

export interface UseMessagesResult {
  /** 消息分组列表 */
  groups: MessageGroup[];
  /** 是否加载中 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 分页信息 */
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 加载更多 */
  loadMore: () => void;
  /** 标记消息已读 */
  markAsRead: (messageId: number | string) => Promise<boolean>;
  /** 删除消息 */
  deleteMessage: (messageId: number | string) => Promise<boolean>;
  /** 标记所有已读 */
  markAllAsRead: () => Promise<boolean>;
  /** 归档消息 */
  archiveMessage: (messageId: number | string) => Promise<boolean>;
}

// ============================================
// Hook 实现（代理到新 Hook）
// ============================================

/**
 * 获取消息列表
 * @deprecated 建议直接使用 useNotifications
 */
export function useMessages(
  options: UseMessagesOptions = {},
): UseMessagesResult {
  const { status = "all", level, limit = 20 } = options;

  // 映射到新 Hook 的参数
  const notificationOptions: UseNotificationsOptions = {
    status: status === "all" ? undefined : status,
    priority: level ? [level] : undefined,
    limit,
  };

  const {
    groups: notificationGroups,
    notifications,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refresh,
    markAsRead: notificationMarkAsRead,
    markAllAsRead: notificationMarkAllAsRead,
    deleteNotification,
    archiveNotification,
  } = useNotifications(notificationOptions);

  // 转换为旧格式的消息分组
  const groups: MessageGroup[] = useMemo(() => {
    return notificationGroups.map((group) => ({
      date_group: group.dateGroup,
      label: group.label,
      messages: group.notifications.map((n) => ({
        id: n.id,
        user_id: n.userId,
        type: n.typeCode,
        level: n.priority as MessageLevel,
        title: n.title,
        content: n.body ?? null,
        action_url: n.actionUrl ?? null,
        action_label: n.actionLabel ?? null,
        status: n.status as MessageStatus,
        priority: getPriorityNumber(n.priority),
        created_at: n.createdAt,
        read_at: n.readAt ?? null,
        expires_at: n.expiresAt,
        metadata: n.metadata ?? {},
        related_bookmark_id:
          n.entityType === "bookmark" ? (n.entityId ?? null) : null,
        related_folder_id:
          n.entityType === "folder" ? (n.entityId ?? null) : null,
        related_import_id:
          n.entityType === "import" ? (n.entityId ?? null) : null,
      })),
    }));
  }, [notificationGroups]);

  // 加载更多
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 标记已读
  const markAsRead = useCallback(
    async (messageId: number | string): Promise<boolean> => {
      const id = typeof messageId === "number" ? String(messageId) : messageId;
      return notificationMarkAsRead(id);
    },
    [notificationMarkAsRead],
  );

  // 删除消息
  const deleteMessage = useCallback(
    async (messageId: number | string): Promise<boolean> => {
      const id = typeof messageId === "number" ? String(messageId) : messageId;
      return deleteNotification(id);
    },
    [deleteNotification],
  );

  // 标记所有已读
  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    return notificationMarkAllAsRead();
  }, [notificationMarkAllAsRead]);

  // 归档消息
  const archiveMessage = useCallback(
    async (messageId: number | string): Promise<boolean> => {
      const id = typeof messageId === "number" ? String(messageId) : messageId;
      return archiveNotification(id);
    },
    [archiveNotification],
  );

  return {
    groups,
    isLoading,
    error: error ?? null,
    pagination: {
      page: 1,
      limit,
      total: notifications.length,
      hasMore: hasNextPage,
    },
    refresh: async () => {
      refresh();
    },
    loadMore,
    markAsRead,
    deleteMessage,
    markAllAsRead,
    archiveMessage,
  };
}

// ============================================
// 辅助函数
// ============================================

function getPriorityNumber(priority: NotificationPriority): number {
  const priorityMap: Record<NotificationPriority, number> = {
    silent: 1,
    normal: 5,
    important: 8,
    critical: 10,
  };
  return priorityMap[priority] ?? 5;
}
