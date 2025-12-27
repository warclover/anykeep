/**
 * 消息系统类型定义
 * @description 定义消息类型、等级、状态等核心类型
 */

// ============================================
// 消息类型常量数组（单一数据源）
// ============================================

/**
 * 所有消息类型的常量数组
 * 用于 Zod schema 验证和其他需要枚举的场景
 */
export const MESSAGE_TYPES = [
  // 分类相关
  "classification_auto",
  "classification_batch",
  "classification_suggest",
  "classification_failed",
  "reclassify_complete",
  // 导入相关
  "import_complete",
  "import_partial",
  "import_failed",
  // 批量操作
  "batch_move",
  "batch_delete",
  "batch_tag",
  "batch_restore",
  // 书签状态
  "bookmark_saved",
  "bookmark_invalid",
  "bookmark_expired",
  // 文件夹操作
  "folder_created",
  "folder_merged",
  // 系统消息
  "system_announcement",
  "system_maintenance",
  "system_update",
  // 配额相关
  "quota_warning",
  "quota_critical",
  "quota_exceeded",
  // 用户反馈
  "feedback_received",
  "feedback_response",
  // AI 处理
  "ai_summary_complete",
  "ai_tags_complete",
  "ai_processing_failed",
  // V4.2 新增：AI 文件夹进化
  "folder_auto_created",
  "folder_auto_split",
  "folder_auto_merged",
  "folder_auto_renamed",
  "folder_operation_undone",
  "ai_evolution_report",
  // V4.2 新增：成本监控
  "cost_warning",
  "cost_critical",
  "cost_daily_exceeded",
  // V4.3 新增：页面监控
  "page_content_changed",
  "page_monitor_failed",
  "page_monitor_quota_reached",
] as const;

/**
 * 消息等级常量数组
 */
export const MESSAGE_LEVELS = ["silent", "normal", "important"] as const;

// ============================================
// 消息类型（从常量推断）
// ============================================

export type MessageType = (typeof MESSAGE_TYPES)[number];

// ============================================
// 消息等级类型（从常量推断）
// ============================================

export type MessageLevel = (typeof MESSAGE_LEVELS)[number];

// ============================================
// 消息状态
// ============================================

export type MessageStatus = "unread" | "read" | "archived";

// ============================================
// 日期分组
// ============================================

export type DateGroup = "today" | "yesterday" | "this_week" | "earlier";

// ============================================
// 消息实体
// ============================================

export interface Message {
  id: number;
  user_id: string;
  type: MessageType;
  level: MessageLevel;
  title: string;
  content: string | null;
  action_url: string | null;
  action_label: string | null;
  status: MessageStatus;
  priority: number;
  created_at: string;
  read_at: string | null;
  metadata: Record<string, unknown>;
  related_bookmark_id: number | null;
  related_folder_id: number | null;
  related_import_id?: number | null;
  expires_at?: string;
}

// ============================================
// 带日期分组的消息
// ============================================

export interface MessageWithGroup extends Message {
  date_group: DateGroup;
}

// ============================================
// 消息分组结构
// ============================================

export interface MessageGroup {
  date_group: DateGroup;
  label: string;
  messages: Message[];
}

// ============================================
// 未读消息统计
// ============================================

export interface UnreadCounts {
  total: number;
  silent: number;
  normal: number;
  important: number;
}

// ============================================
// 创建消息参数
// ============================================

export interface CreateMessageParams {
  userId: string;
  type: MessageType;
  data: Record<string, unknown>;
  relatedBookmarkId?: number;
  relatedFolderId?: number;
  relatedImportId?: number;
}

// ============================================
// 消息创建结果
// ============================================

export interface MessageResult {
  success: boolean;
  messageId?: number;
  level: MessageLevel;
  title?: string;
  content?: string;
  actionUrl?: string;
  actionLabel?: string;
  shouldShowToast: boolean;
  shouldShowModal: boolean;
}

// ============================================
// 通知偏好
// ============================================

export interface NotificationPreferences {
  silent_toast: boolean;
  normal_toast: boolean;
  important_toast: boolean;
  web_push_enabled: boolean;
  web_push_subscription: unknown | null;
  do_not_disturb: boolean;
  dnd_start_time: string | null;
  dnd_end_time: string | null;
}

// ============================================
// 消息列表查询参数
// ============================================

export interface GetMessagesParams {
  status?: MessageStatus | "all";
  level?: MessageLevel;
  page?: number;
  limit?: number;
}

// ============================================
// 消息列表响应
// ============================================

export interface GetMessagesResponse {
  groups: MessageGroup[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
