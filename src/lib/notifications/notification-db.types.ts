/**
 * Supabase 类型扩展
 * @description 为新增的通知系统表和函数添加类型定义
 * 当 Docker Desktop 可用时，运行 `npm run supabase:gen:types` 重新生成完整类型
 *
 * @version 1.0.0
 * @since 2026-02-02
 */

import type { SupabaseClient as BaseSupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// 通知系统表类型
// ============================================================================

/** notification_types 表行类型 */
export interface NotificationTypeRow {
  code: string;
  category: string;
  label: string;
  icon: string | null;
  color: string | null;
  default_channels: string[];
  default_priority: string;
  deprecated: boolean;
  created_at: string;
}

/** user_notifications 表行类型 */
export interface UserNotificationRow {
  id: string;
  user_id: string;
  type_code: string;
  channels: string[];
  priority: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  action_label: string | null;
  metadata: Record<string, unknown>;
  status: string;
  read_at: string | null;
  created_at: string;
  expires_at: string;
  notification_types?: NotificationTypeRow;
}

/** user_notifications 表插入类型 */
export interface UserNotificationInsert {
  user_id: string;
  type_code: string;
  channels?: string[];
  priority?: string;
  title: string;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
  action_label?: string | null;
  metadata?: Record<string, unknown>;
  status?: string;
}

/** user_notifications 表更新类型 */
export interface UserNotificationUpdate {
  status?: string;
  read_at?: string | null;
}

// ============================================================================
// RPC 函数参数和返回类型
// ============================================================================

/** mark_notifications_read 参数 */
export interface MarkNotificationsReadParams {
  p_user_id: string;
  p_ids: string[];
}

/** mark_all_notifications_read 参数 */
export interface MarkAllNotificationsReadParams {
  p_user_id: string;
}

/** get_notification_counts 参数 */
export interface GetNotificationCountsParams {
  p_user_id: string;
}

/** get_notification_counts 返回类型 */
export interface NotificationCountRow {
  priority: string;
  count: number;
}

/** get_unread_notification_count 参数 */
export interface GetUnreadNotificationCountParams {
  p_user_id: string;
}

/** get_notifications_grouped 参数 */
export interface GetNotificationsGroupedParams {
  p_user_id: string;
  p_status?: string | null;
  p_priority?: string | null;
  p_limit?: number;
  p_offset?: number;
}

/** cleanup_expired_notifications 返回类型 */
export type CleanupExpiredNotificationsResult = number;

// ============================================================================
// 扩展 Database 类型
// ============================================================================

/** 通知系统相关的扩展表定义 */
export interface NotificationTables {
  notification_types: {
    Row: NotificationTypeRow;
    Insert: Omit<NotificationTypeRow, "created_at">;
    Update: Partial<Omit<NotificationTypeRow, "code" | "created_at">>;
  };
  user_notifications: {
    Row: UserNotificationRow;
    Insert: UserNotificationInsert;
    Update: UserNotificationUpdate;
  };
}

/** 通知系统相关的 RPC 函数定义 */
export interface NotificationFunctions {
  mark_notifications_read: {
    Args: MarkNotificationsReadParams;
    Returns: number;
  };
  mark_all_notifications_read: {
    Args: MarkAllNotificationsReadParams;
    Returns: number;
  };
  get_notification_counts: {
    Args: GetNotificationCountsParams;
    Returns: NotificationCountRow[];
  };
  get_unread_notification_count: {
    Args: GetUnreadNotificationCountParams;
    Returns: number;
  };
  get_notifications_grouped: {
    Args: GetNotificationsGroupedParams;
    Returns: (UserNotificationRow & { date_group: string })[];
  };
  cleanup_expired_notifications: {
    Args: Record<string, never>;
    Returns: number;
  };
}

// ============================================================================
// 类型辅助函数
// ============================================================================

/**
 * 创建带通知系统类型的 Supabase 客户端类型别名
 * 用于在需要明确类型的地方使用
 */
export type NotificationSupabaseClient = BaseSupabaseClient<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  "public",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;
