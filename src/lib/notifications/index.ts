/**
 * 统一通知系统模块导出
 * @description V5.0 重构版 - 统一通知系统
 * @version 2.1.0
 * @since 2026-02-01
 *
 * ⚠️ 重要：服务端模块已分离，避免客户端组件导入服务端代码
 * - 服务端使用: import { NotificationService, Notify } from "@/lib/notifications/server"
 * - 客户端使用: import { type Notification, PRIORITY_CONFIG } from "@/lib/notifications"
 */

// ============================================================================
// 客户端安全导出（不包含 next/headers 等服务端依赖）
// ============================================================================

// 类型定义（客户端安全）
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

// 常量（客户端安全）
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
// 服务端模块（请从 server.ts 导入）
// ============================================================================
// ⚠️ NotificationService 和 Notify 已移至 ./server.ts
// 服务端使用: import { NotificationService, Notify } from "@/lib/notifications/server"
