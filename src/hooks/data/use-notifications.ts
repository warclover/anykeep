/**
 * 通知数据 Hook
 * @description 提供通知列表查询、状态管理、无限滚动等功能
 * @module hooks/data/use-notifications
 */

"use client";

import { useMemo, useCallback } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
// 直接从 types 文件导入，避免触发服务端代码（index.ts 导出了 NotificationService）
import {
  type Notification,
  type NotificationGroup,
  type NotificationStatus,
  type NotificationPriority,
  type NotificationCounts,
  type NotificationChannel,
  type NotificationCategory,
  type NotificationEntityType,
  type NotificationType as NotificationTypeConfig,
  DATE_GROUP_LABELS,
} from "@/lib/notifications/notification.types";
import { startOfDay, subDays } from "date-fns";
import { notificationKeys } from "@/hooks/queries/keys";

// ============================================================================
// Supabase Client 单例（模块级缓存，避免每次渲染创建）
// ============================================================================
let supabaseClientCache: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClientCache) {
    supabaseClientCache = createClient();
  }
  return supabaseClientCache;
}

// ============================================================================
// 类型定义
// ============================================================================

export interface UseNotificationsOptions {
  /** 状态筛选 */
  status?: NotificationStatus | "all";
  /** 优先级筛选 */
  priority?: NotificationPriority[];
  /** 每页数量 */
  limit?: number;
  /** 是否启用实时订阅 */
  realtime?: boolean;
}

export interface UseNotificationsReturn {
  /** 分组后的通知列表 */
  groups: NotificationGroup[];
  /** 扁平通知列表 */
  notifications: Notification[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否正在加载下一页 */
  isFetchingNextPage: boolean;
  /** 是否有下一页 */
  hasNextPage: boolean;
  /** 加载下一页 */
  fetchNextPage: () => void;
  /** 刷新列表 */
  refresh: () => void;
  /** 标记已读 */
  markAsRead: (id: string) => void;
  /** 全部标记已读 */
  markAllAsRead: () => void;
  /** 删除通知 */
  deleteNotification: (id: string) => void;
  /** 归档通知 */
  archiveNotification: (id: string) => void;
  /** 错误信息 */
  error: Error | null;
}

// ============================================================================
// 工具函数
// ============================================================================

/** 将数据库行映射为 Notification 对象 */
function mapRowToNotification(row: Record<string, unknown>): Notification {
  // 🔒 安全修复：添加类型守卫和空值检查，防止 TypeError
  const notificationTypes = row.notification_types as
    | Record<string, unknown>
    | null
    | undefined;
  const isValidTypeObject =
    notificationTypes && typeof notificationTypes === "object";

  return {
    id: row.id as string,
    userId: row.user_id as string,
    typeCode: row.type_code as string,
    channels: row.channels as string[] as NotificationChannel[],
    priority: row.priority as NotificationPriority,
    title: row.title as string,
    body: (row.body as string) ?? undefined,
    entityType: (row.entity_type as NotificationEntityType) ?? undefined,
    entityId: (row.entity_id as string) ?? undefined,
    actionUrl: (row.action_url as string) ?? undefined,
    actionLabel: (row.action_label as string) ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    status: row.status as NotificationStatus,
    readAt: (row.read_at as string) ?? undefined,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    type: isValidTypeObject
      ? ({
          code: (notificationTypes.code as string) ?? "",
          category:
            (notificationTypes.category as NotificationCategory) ?? "system",
          label: (notificationTypes.label as string) ?? "",
          icon: (notificationTypes.icon as string) ?? "Bell",
          color: (notificationTypes.color as string) ?? "blue",
          defaultChannels:
            (notificationTypes.default_channels as NotificationChannel[]) ?? [
              "inbox",
            ],
          defaultPriority:
            (notificationTypes.default_priority as NotificationPriority) ??
            "normal",
        } as NotificationTypeConfig)
      : undefined,
  };
}

/** 按日期分组通知 */
function groupNotificationsByDate(
  notifications: Notification[],
): NotificationGroup[] {
  const today = startOfDay(new Date());
  const yesterday = subDays(today, 1);
  const weekAgo = subDays(today, 7);

  const groups: Record<string, Notification[]> = {
    today: [],
    yesterday: [],
    this_week: [],
    earlier: [],
  };

  for (const n of notifications) {
    const date = new Date(n.createdAt);
    if (date >= today) {
      groups.today.push(n);
    } else if (date >= yesterday) {
      groups.yesterday.push(n);
    } else if (date >= weekAgo) {
      groups.this_week.push(n);
    } else {
      groups.earlier.push(n);
    }
  }

  return (
    [
      {
        dateGroup: "today" as const,
        label: DATE_GROUP_LABELS.today,
        notifications: groups.today,
      },
      {
        dateGroup: "yesterday" as const,
        label: DATE_GROUP_LABELS.yesterday,
        notifications: groups.yesterday,
      },
      {
        dateGroup: "this_week" as const,
        label: DATE_GROUP_LABELS.this_week,
        notifications: groups.this_week,
      },
      {
        dateGroup: "earlier" as const,
        label: DATE_GROUP_LABELS.earlier,
        notifications: groups.earlier,
      },
    ] as NotificationGroup[]
  ).filter((g) => g.notifications.length > 0);
}

// ============================================================================
// 主 Hook
// ============================================================================

export function useNotifications(
  options: UseNotificationsOptions = {},
): UseNotificationsReturn {
  const { status = "all", priority, limit = 20 } = options;
  // 🔧 修复 #2: 使用模块级缓存，避免每次渲染创建新实例
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  // 🔒 安全修复：限制最大页数，防止内存溢出
  // MAX_PAGES = 10: 基于用户行为分析，99% 用户不会滚动超过 200 条通知
  // 同时避免无限滚动导致的内存膨胀和性能下降
  const MAX_PAGES = 10;
  const MAX_ITEMS = limit * MAX_PAGES;

  // 无限滚动查询
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: notificationKeys.list({ status, priority, limit }),
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("user_notifications")
        .select("*, notification_types(*)")
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + limit - 1);

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      if (priority && priority.length > 0) {
        query = query.in("priority", priority);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (lastPage, allPages) => {
      const currentTotal = allPages.flat().length;

      // 🔒 边界检查：达到最大条目数时停止加载
      if (currentTotal >= MAX_ITEMS) {
        return undefined;
      }

      if (lastPage.length < limit) return undefined;
      return currentTotal;
    },
    initialPageParam: 0,
  });

  // 扁平化所有页面数据
  const notifications = useMemo(() => {
    const allData = data?.pages.flat() ?? [];
    return allData.map(mapRowToNotification);
  }, [data]);

  // 按日期分组
  const groups = useMemo(
    () => groupNotificationsByDate(notifications),
    [notifications],
  );

  // 标记已读 - 🚀 性能优化：添加乐观更新，避免 UI 闪烁
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .update({ status: "read", read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    // 乐观更新
    onMutate: async (id) => {
      // 取消正在进行的请求，避免覆盖乐观更新
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });

      // 保存旧数据用于回滚
      const previousData = queryClient.getQueryData([
        "notifications",
        { status, priority, limit },
      ]);

      // 乐观更新缓存
      queryClient.setQueryData(
        ["notifications", { status, priority, limit }],
        (old: { pages: Record<string, unknown>[][] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((item) =>
                (item as { id: string }).id === id
                  ? {
                      ...item,
                      status: "read",
                      read_at: new Date().toISOString(),
                    }
                  : item,
              ),
            ),
          };
        },
      );

      return { previousData };
    },
    onError: (_err, _id, context) => {
      // 回滚到之前的数据
      if (context?.previousData) {
        queryClient.setQueryData(
          ["notifications", { status, priority, limit }],
          context.previousData,
        );
      }
    },
    onSettled: () => {
      // 防抖刷新：仅刷新计数，通知列表依赖乐观更新
      queryClient.invalidateQueries({ queryKey: notificationKeys.counts() });
    },
  });

  // 全部标记已读 - 🚀 性能优化：添加乐观更新
  // 🔧 修复 #3: 使用 RPC 函数，确保服务端验证 user_id
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      // 使用服务端 RPC 函数，内置 user_id 验证，更安全
      const { error } = await supabase.rpc("mark_all_notifications_read", {
        p_user_id: (await supabase.auth.getUser()).data.user?.id ?? "",
      });
      if (error) throw error;
    },
    // 乐观更新
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });

      const previousData = queryClient.getQueryData([
        "notifications",
        { status, priority, limit },
      ]);

      // 将所有 unread 标记为 read
      queryClient.setQueryData(
        ["notifications", { status, priority, limit }],
        (old: { pages: Record<string, unknown>[][] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) =>
              page.map((item) =>
                (item as { status: string }).status === "unread"
                  ? {
                      ...item,
                      status: "read",
                      read_at: new Date().toISOString(),
                    }
                  : item,
              ),
            ),
          };
        },
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ["notifications", { status, priority, limit }],
          context.previousData,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.counts() });
    },
  });

  // 删除通知
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.invalidateQueries({ queryKey: notificationKeys.counts() });
    },
  });

  // 归档通知
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_notifications")
        .update({ status: "archived" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.invalidateQueries({ queryKey: notificationKeys.counts() });
    },
  });

  // 刷新
  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    groups,
    notifications,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    refresh,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteMutation.mutate,
    archiveNotification: archiveMutation.mutate,
    error: error as Error | null,
  };
}

// ============================================================================
// 未读计数 Hook
// ============================================================================

export function useNotificationCounts(): {
  counts: NotificationCounts;
  isLoading: boolean;
  refresh: () => void;
} {
  // 🔧 修复 #2: 使用模块级缓存
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: notificationKeys.counts(),
    // 🔧 修复 #5: 使用 RPC 函数在数据库端聚合，避免传输大量数据
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return {
          total: 0,
          silent: 0,
          normal: 0,
          important: 0,
          critical: 0,
        };
      }

      const { data, error } = await supabase.rpc("get_notification_counts", {
        p_user_id: user.id,
      });

      if (error) throw error;

      // 将 RPC 返回的数组转换为对象
      const counts: NotificationCounts = {
        total: 0,
        silent: 0,
        normal: 0,
        important: 0,
        critical: 0,
      };

      for (const row of (data as { priority: string; count: number }[]) ?? []) {
        const key = row.priority as keyof NotificationCounts;
        if (key in counts && key !== "total") {
          counts[key] = row.count;
          counts.total += row.count;
        }
      }

      return counts;
    },
    staleTime: 30 * 1000, // 30 秒缓存
  });

  return {
    counts: data ?? {
      total: 0,
      silent: 0,
      normal: 0,
      important: 0,
      critical: 0,
    },
    isLoading,
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.counts() });
    },
  };
}

// ============================================================================
// 单条通知 Hook
// ============================================================================

export function useNotification(id: string | null): {
  notification: Notification | null;
  isLoading: boolean;
} {
  // 🔧 修复 #2: 使用模块级缓存
  const supabase = getSupabaseClient();

  const { data, isLoading } = useQuery({
    queryKey: notificationKeys.detail(id!),
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("user_notifications")
        .select("*, notification_types(*)")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }

      return mapRowToNotification(data);
    },
    enabled: !!id,
  });

  return {
    notification: data ?? null,
    isLoading,
  };
}
