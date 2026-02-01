/**
 * 统一通知系统模块导出
 * @description V5.0 重构版 - 统一通知系统
 * @version 2.0.0
 * @since 2026-02-01
 */

// ============================================================================
// V5.0 新通知系统（推荐使用）
// ============================================================================

// 核心服务 - 仅服务端使用，请从 ./notification.service 直接导入
// export { NotificationService } from "./notification.service";

// 业务快捷方法 - 仅服务端使用，请从 ./notification.helpers 直接导入
// export { Notify } from "./notification.helpers";

// 类型定义
export type {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationCategory,
  NotificationEntityType,
  NotificationDateGroup,
  NotificationType as NotificationTypeConfig,
  Notification,
  NotificationGroup,
  NotificationPayload,
  NotificationQueryParams,
  NotificationCounts,
} from "./notification.types";

// 常量
export { DATE_GROUP_LABELS, PRIORITY_CONFIG } from "./notification.types";

// ============================================================================
// V4.3 旧版导出（兼容性保留，后续迁移后删除）
// ============================================================================

// Types
export type {
  // 新类型
  InboxType,
  ActivityType,
  ToastType,
  NotificationType,
  // 待办中心
  InboxItemStatus,
  InboxItem,
  InboxItemDisplay,
  InboxResponse,
  // 活动日志
  ActivityLogItem,
  ActivityLogGroup,
  ActivityResponse,
  // Toast
  ToastConfig,
  // AI 报告
  MonthlyAIReport,
} from "./types";

export { MESSAGE_TYPE_MIGRATION_MAP } from "./types";

// Toast Service (L1) - 客户端安全
export { toastService } from "./toast/toast.service";

// ============================================================================
// 服务端模块（请直接导入，避免污染客户端）
// ============================================================================
// Inbox Service (L2) - 仅服务端使用
// import { confirmationService } from "@/lib/confirmation";

// Activity Service (L3) - 仅服务端使用
// import { activityService } from "./activity/activity.service";
