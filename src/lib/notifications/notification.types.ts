/**
 * 通知系统类型定义
 * @module notifications/types
 */

// ============================================================================
// 基础类型
// ============================================================================

/** 通知通道 */
export type NotificationChannel = "toast" | "inbox" | "modal" | "push";

/** 通知优先级 */
export type NotificationPriority =
  | "silent"
  | "normal"
  | "important"
  | "critical";

/** 通知状态 */
export type NotificationStatus = "unread" | "read" | "archived";

/** 通知分类 */
export type NotificationCategory = "ai" | "system" | "user" | "billing";

/** 关联实体类型 */
export type NotificationEntityType =
  | "bookmark"
  | "folder"
  | "import"
  | "synthesis";

/** 日期分组 */
export type NotificationDateGroup =
  | "today"
  | "yesterday"
  | "this_week"
  | "earlier";

// ============================================================================
// 数据模型
// ============================================================================

/** 通知类型配置（对应 notification_types 表） */
export interface NotificationType {
  code: string;
  category: NotificationCategory;
  label: string;
  icon: string;
  color: string;
  defaultChannels: NotificationChannel[];
  defaultPriority: NotificationPriority;
  deprecated?: boolean;
}

/** 通知实体（对应 user_notifications 表） */
export interface Notification {
  id: string;
  userId: string;
  typeCode: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  title: string;
  body?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata: Record<string, unknown>;
  status: NotificationStatus;
  readAt?: string;
  createdAt: string;
  expiresAt: string;
  // 关联的类型配置（JOIN 查询时填充）
  type?: NotificationType;
}

/** 通知分组 */
export interface NotificationGroup {
  dateGroup: NotificationDateGroup;
  label: string;
  notifications: Notification[];
}

// ============================================================================
// 请求/响应类型
// ============================================================================

/** 发送通知请求 */
export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  body?: string;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  entityType?: NotificationEntityType;
  entityId?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
}

/** 查询通知参数 */
export interface NotificationQueryParams {
  status?: NotificationStatus | "all";
  priority?: NotificationPriority[];
  category?: NotificationCategory[];
  limit?: number;
  offset?: number;
}

/** 未读计数 */
export interface NotificationCounts {
  total: number;
  silent: number;
  normal: number;
  important: number;
  critical: number;
}

// ============================================================================
// 数据库行类型（Supabase 返回的原始类型）
// ============================================================================

/** user_notifications 表行类型 */
export interface NotificationRow {
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
  // JOIN 时的嵌套类型
  notification_types?: NotificationTypeRow;
}

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

// ============================================================================
// 常量
// ============================================================================

/** 日期分组标签映射 */
export const DATE_GROUP_LABELS: Record<NotificationDateGroup, string> = {
  today: "今天",
  yesterday: "昨天",
  this_week: "本周",
  earlier: "更早",
};

/** 优先级配置 */
export const PRIORITY_CONFIG: Record<
  NotificationPriority,
  {
    label: string;
    indicatorColor: string;
    iconColor: string;
    bgColor: string;
  }
> = {
  silent: {
    label: "静默",
    indicatorColor: "bg-transparent",
    iconColor: "text-muted-foreground",
    bgColor: "bg-transparent",
  },
  normal: {
    label: "普通",
    indicatorColor: "bg-primary",
    iconColor: "text-primary",
    bgColor: "bg-primary/5",
  },
  important: {
    label: "重要",
    indicatorColor: "bg-orange-500",
    iconColor: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
  },
  critical: {
    label: "紧急",
    indicatorColor: "bg-red-500",
    iconColor: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/20",
  },
};
