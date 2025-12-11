/**
 * 统一通知系统类型定义
 * @description V4.3 三层通知体系：Toast / Inbox / Activity
 * @version 1.0.0
 * @since 2025-12-12
 */

// ============================================
// 新消息类型枚举（8种，替代原 27 种）
// ============================================

/**
 * 待办类型（L2: 待办中心）
 * - 需要用户处理
 * - 有过期时间
 * - 支持内联操作
 */
export type InboxType =
  | "classification_review" // AI 分类需确认
  | "folder_suggestion" // 文件夹操作建议
  | "import_review"; // 导入审核

/**
 * 活动日志类型（L3: 活动日志）
 * - 仅记录历史
 * - 只读，无需操作
 * - 永久保存
 */
export type ActivityType =
  | "batch_operation" // 批量操作记录
  | "ai_report" // AI 处理报告（月度聚合）
  | "system_announcement" // 系统公告
  | "quota_alert" // 配额预警
  | "error_log"; // 错误日志

/**
 * Toast 类型（L1: 即时反馈）
 * - 不存储到数据库
 * - 3秒后自动消失
 * - 支持撤销操作
 */
export type ToastType =
  | "success" // 操作成功
  | "error" // 操作失败
  | "info" // 信息提示
  | "warning" // 警告提示
  | "progress"; // 进度提示

// ============================================
// 旧类型到新类型映射
// ============================================

/**
 * 旧消息类型到新类型的映射关系
 * 用于数据迁移和向后兼容
 */
export const MESSAGE_TYPE_MIGRATION_MAP: Record<
  string,
  {
    layer: "toast" | "inbox" | "activity";
    newType: ActivityType | InboxType | null;
  }
> = {
  // 即时反馈 → Toast（不存储）
  classification_auto: { layer: "toast", newType: null },
  bookmark_saved: { layer: "toast", newType: null },
  feedback_received: { layer: "toast", newType: null },
  feedback_response: { layer: "toast", newType: null },
  folder_created: { layer: "toast", newType: null },

  // 待办 → Inbox
  classification_suggest: { layer: "inbox", newType: "classification_review" },

  // 批量操作 → Activity
  classification_batch: { layer: "activity", newType: "batch_operation" },
  import_complete: { layer: "activity", newType: "batch_operation" },
  import_partial: { layer: "activity", newType: "batch_operation" },
  batch_move: { layer: "activity", newType: "batch_operation" },
  batch_delete: { layer: "activity", newType: "batch_operation" },
  batch_tag: { layer: "activity", newType: "batch_operation" },
  batch_restore: { layer: "activity", newType: "batch_operation" },

  // 错误 → Activity (error_log)
  classification_failed: { layer: "activity", newType: "error_log" },
  import_failed: { layer: "activity", newType: "error_log" },
  bookmark_invalid: { layer: "activity", newType: "error_log" },
  bookmark_expired: { layer: "activity", newType: "error_log" },
  ai_processing_failed: { layer: "activity", newType: "error_log" },

  // 文件夹操作 → Activity (batch_operation)
  folder_merged: { layer: "activity", newType: "batch_operation" },
  folder_auto_created: { layer: "activity", newType: "batch_operation" },
  folder_auto_split: { layer: "activity", newType: "batch_operation" },
  folder_auto_merged: { layer: "activity", newType: "batch_operation" },
  folder_auto_renamed: { layer: "activity", newType: "batch_operation" },
  folder_operation_undone: { layer: "activity", newType: "batch_operation" },

  // 系统 → Activity
  system_announcement: { layer: "activity", newType: "system_announcement" },
  system_maintenance: { layer: "activity", newType: "system_announcement" },
  system_update: { layer: "activity", newType: "system_announcement" },

  // 配额 → Activity (quota_alert)
  quota_warning: { layer: "activity", newType: "quota_alert" },
  quota_critical: { layer: "activity", newType: "quota_alert" },
  quota_exceeded: { layer: "activity", newType: "quota_alert" },
  cost_warning: { layer: "activity", newType: "quota_alert" },
  cost_critical: { layer: "activity", newType: "quota_alert" },
  cost_daily_exceeded: { layer: "activity", newType: "quota_alert" },

  // AI 报告 → Activity (ai_report)
  ai_summary_complete: { layer: "activity", newType: "ai_report" },
  ai_tags_complete: { layer: "activity", newType: "ai_report" },
  ai_evolution_report: { layer: "activity", newType: "ai_report" },
};

// ============================================
// 待办中心实体（复用 pending_confirmations）
// ============================================

/**
 * 待办项状态
 */
export type InboxItemStatus =
  | "pending" // 待处理
  | "confirmed" // 已确认
  | "modified" // 已修改
  | "rejected" // 已拒绝
  | "expired"; // 已过期

/**
 * 待办项实体
 * 基于现有 pending_confirmations 表结构
 */
export interface InboxItem {
  id: number;
  user_id: string;
  /** 待办类型 */
  type: InboxType;
  /** 状态 */
  status: InboxItemStatus;
  /** 标题 */
  title: string;
  /** 描述 */
  description: string;
  /** AI 建议数据 */
  suggestion: Record<string, unknown>;
  /** 用户选择 */
  user_choice: Record<string, unknown> | null;
  /** 关联书签 ID */
  bookmark_id: number | null;
  /** 关联文件夹 ID */
  folder_id: number | null;
  /** 创建时间 */
  created_at: string;
  /** 过期时间 */
  expires_at: string;
  /** 处理时间 */
  processed_at: string | null;
}

/**
 * 待办项展示数据
 */
export interface InboxItemDisplay {
  id: number;
  type: InboxType;
  status: InboxItemStatus;
  title: string;
  description: string;
  suggestion: Record<string, unknown>;
  /** 剩余时间（如"还剩 2 天"） */
  expiresIn: string;
  createdAt: string;
  /** 关联内容（书签/文件夹） */
  relatedContent?: {
    type: "bookmark" | "folder";
    id: number;
    title: string;
    url?: string;
  };
}

// ============================================
// 活动日志实体
// ============================================

/**
 * 活动日志实体
 */
export interface ActivityLogItem {
  id: number;
  user_id: string;
  /** 活动类型 */
  type: ActivityType;
  /** 标题 */
  title: string;
  /** 内容 */
  content: string | null;
  /** 详情链接 */
  detail_url: string | null;
  /** 元数据 */
  metadata: Record<string, unknown>;
  /** 创建时间 */
  created_at: string;
  /** 关联书签 IDs */
  related_bookmark_ids: number[] | null;
  /** 关联文件夹 IDs */
  related_folder_ids: number[] | null;
}

/**
 * 活动日志分组（按日期）
 */
export interface ActivityLogGroup {
  /** 日期标签（如"今天"、"昨天"、"12月10日"） */
  label: string;
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 该日期的活动列表 */
  items: ActivityLogItem[];
}

// ============================================
// Toast 配置
// ============================================

/**
 * Toast 配置
 */
export interface ToastConfig {
  type: ToastType;
  title: string;
  description?: string;
  /** 持续时间（毫秒），默认 3000 */
  duration?: number;
  /** 是否可撤销 */
  undoable?: boolean;
  /** 撤销回调 */
  onUndo?: () => void | Promise<void>;
  /** 操作按钮 */
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================
// API 响应类型
// ============================================

/**
 * 待办中心 API 响应
 */
export interface InboxResponse {
  items: InboxItemDisplay[];
  pendingCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * 活动日志 API 响应
 */
export interface ActivityResponse {
  groups: ActivityLogGroup[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ============================================
// 聚合报告类型（月度 AI 报告）
// ============================================

/**
 * AI 月度报告数据
 */
export interface MonthlyAIReport {
  /** 月份 YYYY-MM */
  month: string;
  /** 自动分类数量 */
  autoClassifiedCount: number;
  /** 用户确认数量 */
  userConfirmedCount: number;
  /** 用户修改数量 */
  userModifiedCount: number;
  /** 用户拒绝数量 */
  userRejectedCount: number;
  /** 过期自动执行数量 */
  expiredAutoExecutedCount: number;
  /** 新建文件夹数量 */
  newFoldersCount: number;
  /** 分类准确率（确认 / (确认+修改+拒绝)） */
  accuracyRate: number;
  /** 最常用文件夹 Top 5 */
  topFolders: Array<{
    folderId: number;
    folderName: string;
    count: number;
  }>;
}

// ============================================
// 导出统一类型
// ============================================

export type NotificationType = InboxType | ActivityType;
