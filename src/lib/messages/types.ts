/**
 * 消息系统类型定义
 * @description 定义消息类型、等级、状态等核心类型
 */

// ============================================
// 消息类型枚举（27种）
// ============================================

export type MessageType =
  // 分类相关
  | "classification_auto" // 自动分类完成（静默）
  | "classification_batch" // 批量分类完成（静默）
  | "classification_suggest" // 分类建议待确认（普通）
  | "classification_failed" // 分类失败（普通）
  // 导入相关
  | "import_complete" // 导入完成（普通）
  | "import_partial" // 部分导入成功（普通）
  | "import_failed" // 导入失败（重要）
  // 批量操作
  | "batch_move" // 批量移动完成（静默）
  | "batch_delete" // 批量删除完成（静默）
  | "batch_tag" // 批量打标签完成（静默）
  | "batch_restore" // 批量恢复完成（静默）
  // 书签状态
  | "bookmark_saved" // 书签保存成功（静默）
  | "bookmark_invalid" // 失效链接检测（普通）
  | "bookmark_expired" // 书签过期提醒（普通）
  // 文件夹操作
  | "folder_created" // 文件夹创建（静默）
  | "folder_merged" // 文件夹合并（普通）
  // 系统消息
  | "system_announcement" // 系统公告（重要）
  | "system_maintenance" // 系统维护通知（重要）
  | "system_update" // 版本更新（普通）
  // 配额相关
  | "quota_warning" // 配额预警 80%（重要）
  | "quota_critical" // 配额临界 95%（紧急）
  | "quota_exceeded" // 配额超限（紧急）
  // 用户反馈
  | "feedback_received" // 反馈已收到（静默）
  | "feedback_response" // 反馈回复（普通）
  // AI 处理
  | "ai_summary_complete" // AI 摘要生成完成（静默）
  | "ai_tags_complete" // AI 标签生成完成（静默）
  | "ai_processing_failed" // AI 处理失败（普通）
  // V4.2 新增：AI 文件夹进化
  | "folder_auto_created" // AI 自动创建文件夹（普通）
  | "folder_auto_split" // AI 自动分拆文件夹（普通）
  | "folder_auto_merged" // AI 自动合并文件夹（普通）
  | "folder_auto_renamed" // AI 自动重命名文件夹（普通）
  | "folder_operation_undone" // 操作已撤销（普通）
  | "ai_evolution_report"; // 月度进化报告（普通）

// ============================================
// 消息等级
// ============================================

export type MessageLevel = "silent" | "normal" | "important";

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
