/**
 * 通知计数 Hook
 *
 * 获取用户未读通知数量，用于导航栏徽章显示
 * 支持 Supabase Realtime 实时订阅
 *
 * @version 1.1.0
 * @since 2026-02-07
 * @updated 2026-02-07 - 添加 Realtime 订阅支持
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { clientLogger } from "@/lib/client-logger";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 通知项
 */
export interface NotificationItem {
  id: string;
  typeCode: string;
  title: string;
  body: string | null;
  priority: "silent" | "normal" | "important" | "critical";
  status: "unread" | "read" | "archived";
  actionUrl: string | null;
  createdAt: string;
  entityType: string | null;
  entityId: string | null;
  // 类型元��据
  icon: string | null;
  color: string | null;
  category: string;
}

/**
 * 按优先级分组的计数
 */
export interface NotificationCounts {
  total: number;
  critical: number;
  important: number;
  normal: number;
  silent: number;
}

/**
 * Hook 返回值
 */
export interface UseNotificationCountReturn {
  /** 未读通知总数 */
  unreadCount: number;
  /** 按优先级分组的计数 */
  counts: NotificationCounts;
  /** 通知列表（最近 20 条） */
  notifications: NotificationItem[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 标记单条已读 */
  markAsRead: (ids: string[]) => Promise<void>;
  /** 标记全部已读 */
  markAllAsRead: () => Promise<void>;
  /** 刷新数据 */
  refresh: () => Promise<void>;
}

// ============================================================================
// 查询键
// ============================================================================

const COUNT_QUERY_KEY = ["notification-count"] as const;
const LIST_QUERY_KEY = ["notifications-list"] as const;

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 通知计数 Hook
 *
 * @example
 * ```tsx
 * const { unreadCount, notifications, markAsRead } = useNotificationCount();
 * ```
 */
export function useNotificationCount(): UseNotificationCountReturn {
  const queryClient = useQueryClient();

  // ==================== 计数查询 ====================
  const {
    data: countsData,
    isLoading: isCountLoading,
    error: countError,
  } = useQuery({
    queryKey: COUNT_QUERY_KEY,
    queryFn: async (): Promise<NotificationCounts> => {
      const supabase = createClient();

      const { data, error } = await supabase.rpc("get_notification_counts");

      if (error) {
        clientLogger.warn(
          { error },
          "[useNotificationCount] Failed to get counts",
        );
        throw new Error(error.message);
      }

      // 解析按优先级分组的数据
      const counts: NotificationCounts = {
        total: 0,
        critical: 0,
        important: 0,
        normal: 0,
        silent: 0,
      };

      if (Array.isArray(data)) {
        for (const item of data) {
          const priority = item.priority as keyof NotificationCounts;
          const count = Number(item.count) || 0;
          if (priority in counts) {
            counts[priority] = count;
          }
          counts.total += count;
        }
      }

      return counts;
    },
    staleTime: 30 * 1000, // 30 秒缓存
    refetchInterval: 60 * 1000, // 每分钟刷新
    refetchOnWindowFocus: true,
    // 网络错误退避策略：限制重试次数，防止连接断开时无限重试刷屏
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // 查询失败时暂停轮询，恢复连接后自动恢复
    refetchIntervalInBackground: false,
  });

  // ==================== 通知列表查询 ====================
  const {
    data: notificationsData,
    isLoading: isListLoading,
    error: listError,
  } = useQuery({
    queryKey: LIST_QUERY_KEY,
    queryFn: async (): Promise<NotificationItem[]> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("user_notifications")
        .select(
          `
          id,
          type_code,
          title,
          body,
          priority,
          status,
          action_url,
          created_at,
          entity_type,
          entity_id,
          notification_types!inner(icon, color, category)
        `,
        )
        .eq("status", "unread")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        clientLogger.warn(
          { error },
          "[useNotificationCount] Failed to get notifications",
        );
        throw new Error(error.message);
      }

      return (data || []).map((item: Record<string, unknown>) => {
        const typeInfo = item.notification_types as Record<
          string,
          unknown
        > | null;
        return {
          id: item.id as string,
          typeCode: item.type_code as string,
          title: item.title as string,
          body: item.body as string | null,
          priority: item.priority as NotificationItem["priority"],
          status: item.status as NotificationItem["status"],
          actionUrl: item.action_url as string | null,
          createdAt: item.created_at as string,
          entityType: item.entity_type as string | null,
          entityId: item.entity_id as string | null,
          icon: typeInfo?.icon as string | null,
          color: typeInfo?.color as string | null,
          category: (typeInfo?.category as string) || "system",
        };
      });
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    // 网络错误退避策略：与计数查询保持一致
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // ==================== 标记已读 ====================
  const markReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("mark_notifications_read", {
        p_ids: ids,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COUNT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY });
    },
    onError: (error) => {
      clientLogger.error({ error }, "[useNotificationCount] Mark read failed");
      toast.error("标记已读失败");
    },
  });

  // ==================== 标记全部已读 ====================
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("mark_all_notifications_read");
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COUNT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY });
      toast.success("已全部标记为已读");
    },
    onError: (error) => {
      clientLogger.error(
        { error },
        "[useNotificationCount] Mark all read failed",
      );
      toast.error("操作失败");
    },
  });

  // ==================== 刷新 ====================
  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: COUNT_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY }),
    ]);
  }, [queryClient]);

  // ==================== Realtime 订阅 ====================
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // 创建 Realtime 订阅
    const channel = supabase
      .channel("user-notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "*", // 监听 INSERT, UPDATE, DELETE
          schema: "public",
          table: "user_notifications",
        },
        (payload) => {
          clientLogger.debug(
            { payload },
            "[useNotificationCount] Realtime event received",
          );
          // 收到变更后刷新数据
          refresh();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clientLogger.debug(
            "[useNotificationCount] Realtime subscription active",
          );
        }
      });

    channelRef.current = channel;

    // 清理订阅
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [refresh]);

  // ==================== 返回值 ====================
  return {
    unreadCount: countsData?.total ?? 0,
    counts: countsData ?? {
      total: 0,
      critical: 0,
      important: 0,
      normal: 0,
      silent: 0,
    },
    notifications: notificationsData ?? [],
    isLoading: isCountLoading || isListLoading,
    error: countError?.message ?? listError?.message ?? null,
    markAsRead: markReadMutation.mutateAsync,
    markAllAsRead: markAllReadMutation.mutateAsync,
    refresh,
  };
}
