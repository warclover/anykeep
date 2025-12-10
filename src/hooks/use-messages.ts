/**
 * 消息列表 Hook
 * @description 获取消息列表，支持分页、筛选、按日期分组
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import useSWR from "swr";
import type {
  MessageGroup,
  MessageStatus,
  MessageLevel,
  GetMessagesResponse,
} from "@/lib/messages";

// ============================================
// 类型定义
// ============================================

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
  markAsRead: (messageId: number) => Promise<boolean>;
  /** 删除消息 */
  deleteMessage: (messageId: number) => Promise<boolean>;
  /** 标记所有已读 */
  markAllAsRead: () => Promise<boolean>;
  /** 归档消息 */
  archiveMessage: (messageId: number) => Promise<boolean>;
}

// ============================================
// Fetcher
// ============================================

async function fetcher(url: string): Promise<GetMessagesResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("获取消息列表失败");
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || "获取消息列表失败");
  }
  return result.data;
}

// ============================================
// Hook 实现
// ============================================

export function useMessages(
  options: UseMessagesOptions = {},
): UseMessagesResult {
  const { status = "all", level, limit = 20, refreshInterval } = options;

  const [page, setPage] = useState(1);
  const [allGroups, setAllGroups] = useState<MessageGroup[]>([]);

  // 用于追踪筛选条件变化
  const prevFilterKeyRef = useRef(`${status}-${level}`);
  const currentFilterKey = `${status}-${level}`;

  // 构建查询 URL
  const buildUrl = useCallback(
    (pageNum: number) => {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("limit", String(limit));
      if (status !== "all") {
        params.set("status", status);
      }
      if (level) {
        params.set("level", level);
      }
      return `/api/messages?${params.toString()}`;
    },
    [status, level, limit],
  );

  // 当筛选条件变化时重置 page（使用 microtask 异步执行避免 lint 警告）
  useEffect(() => {
    if (prevFilterKeyRef.current !== currentFilterKey) {
      prevFilterKeyRef.current = currentFilterKey;
      queueMicrotask(() => {
        setPage(1);
        setAllGroups([]);
      });
    }
  }, [currentFilterKey]);

  // SWR 获取数据
  const { data, error, isLoading, mutate } = useSWR<GetMessagesResponse>(
    buildUrl(page),
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
    },
  );

  // 合并分页数据
  const prevDataRef = useRef<GetMessagesResponse | undefined>(undefined);
  useEffect(() => {
    if (data && data !== prevDataRef.current) {
      prevDataRef.current = data;
      queueMicrotask(() => {
        if (page === 1) {
          setAllGroups(data.groups);
        } else {
          setAllGroups((prev) => mergeGroups(prev, data.groups));
        }
      });
    }
  }, [data, page]);

  // 加载更多
  const loadMore = useCallback(() => {
    if (data?.pagination.hasMore) {
      setPage((p) => p + 1);
    }
  }, [data?.pagination.hasMore]);

  // 刷新
  const refresh = useCallback(async () => {
    setPage(1);
    setAllGroups([]);
    await mutate();
  }, [mutate]);

  // 乐观更新辅助函数：更新消息状态
  const optimisticUpdateStatus = useCallback(
    (messageId: number, newStatus: MessageStatus) => {
      setAllGroups((prevGroups) =>
        prevGroups.map((group) => ({
          ...group,
          messages: group.messages.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  status: newStatus,
                  read_at:
                    newStatus === "read"
                      ? new Date().toISOString()
                      : msg.read_at,
                }
              : msg,
          ),
        })),
      );
    },
    [],
  );

  // 乐观更新辅助函数：删除消息
  const optimisticDelete = useCallback((messageId: number) => {
    setAllGroups(
      (prevGroups) =>
        prevGroups
          .map((group) => ({
            ...group,
            messages: group.messages.filter((msg) => msg.id !== messageId),
          }))
          .filter((group) => group.messages.length > 0), // 移除空分组
    );
  }, []);

  // 乐观更新辅助函数：标记所有已读
  const optimisticMarkAllRead = useCallback(() => {
    setAllGroups((prevGroups) =>
      prevGroups.map((group) => ({
        ...group,
        messages: group.messages.map((msg) =>
          msg.status === "unread"
            ? {
                ...msg,
                status: "read" as MessageStatus,
                read_at: new Date().toISOString(),
              }
            : msg,
        ),
      })),
    );
  }, []);

  // 标记已读（带乐观更新）
  const markAsRead = useCallback(
    async (messageId: number): Promise<boolean> => {
      // 保存原始状态用于回滚
      const originalGroups = [...allGroups];

      // 乐观更新
      optimisticUpdateStatus(messageId, "read");

      try {
        const response = await fetch(`/api/messages/${messageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "read" }),
        });

        if (!response.ok) {
          // 回滚
          setAllGroups(originalGroups);
          return false;
        }

        // 后台重新验证（不阻塞）
        mutate();
        return true;
      } catch {
        // 回滚
        setAllGroups(originalGroups);
        return false;
      }
    },
    [allGroups, optimisticUpdateStatus, mutate],
  );

  // 删除消息（带乐观更新）
  const deleteMessage = useCallback(
    async (messageId: number): Promise<boolean> => {
      // 保存原始状态用于回滚
      const originalGroups = [...allGroups];

      // 乐观更新
      optimisticDelete(messageId);

      try {
        const response = await fetch(`/api/messages/${messageId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          // 回滚
          setAllGroups(originalGroups);
          return false;
        }

        // 后台重新验证
        mutate();
        return true;
      } catch {
        // 回滚
        setAllGroups(originalGroups);
        return false;
      }
    },
    [allGroups, optimisticDelete, mutate],
  );

  // 标记所有已读（带乐观更新）
  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    // 保存原始状态用于回滚
    const originalGroups = [...allGroups];

    // 乐观更新
    optimisticMarkAllRead();

    try {
      const response = await fetch("/api/messages/batch-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        // 回滚
        setAllGroups(originalGroups);
        return false;
      }

      // 后台重新验证
      mutate();
      return true;
    } catch {
      // 回滚
      setAllGroups(originalGroups);
      return false;
    }
  }, [allGroups, optimisticMarkAllRead, mutate]);

  // 归档消息（带乐观更新）
  const archiveMessage = useCallback(
    async (messageId: number): Promise<boolean> => {
      // 保存原始状态用于回滚
      const originalGroups = [...allGroups];

      // 乐观更新
      optimisticUpdateStatus(messageId, "archived");

      try {
        const response = await fetch(`/api/messages/${messageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "archived" }),
        });

        if (!response.ok) {
          // 回滚
          setAllGroups(originalGroups);
          return false;
        }

        // 后台重新验证
        mutate();
        return true;
      } catch {
        // 回滚
        setAllGroups(originalGroups);
        return false;
      }
    },
    [allGroups, optimisticUpdateStatus, mutate],
  );

  return {
    groups: allGroups,
    isLoading,
    error: error || null,
    pagination: data?.pagination ?? {
      page: 1,
      limit,
      total: 0,
      hasMore: false,
    },
    refresh,
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

/**
 * 合并消息分组（用于加载更多）
 * @description 合并时按 created_at 降序排序，确保时间顺序正确
 */
function mergeGroups(
  existing: MessageGroup[],
  newGroups: MessageGroup[],
): MessageGroup[] {
  const result = [...existing];

  for (const newGroup of newGroups) {
    const existingIndex = result.findIndex(
      (g) => g.date_group === newGroup.date_group,
    );
    if (existingIndex >= 0) {
      // 合并消息，避免重复
      const existingIds = new Set(
        result[existingIndex].messages.map((m) => m.id),
      );
      const uniqueNewMessages = newGroup.messages.filter(
        (m) => !existingIds.has(m.id),
      );

      // 合并后按时间降序排序
      const mergedMessages = [
        ...result[existingIndex].messages,
        ...uniqueNewMessages,
      ].sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeB - timeA; // 降序：最新的在前
      });

      result[existingIndex].messages = mergedMessages;
    } else {
      // 添加新分组
      result.push(newGroup);
    }
  }

  // 确保分组按正确顺序排列（today > yesterday > this_week > earlier）
  const groupOrder: Record<string, number> = {
    today: 0,
    yesterday: 1,
    this_week: 2,
    earlier: 3,
  };

  result.sort((a, b) => {
    const orderA = groupOrder[a.date_group] ?? 4;
    const orderB = groupOrder[b.date_group] ?? 4;
    return orderA - orderB;
  });

  return result;
}
