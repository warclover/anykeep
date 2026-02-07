/**
 * 通知系统服务端模块导出
 * @description 仅供服务端使用的模块（包含 next/headers 依赖）
 * @version 1.0.0
 * @since 2026-02-07
 *
 * ⚠️ 此文件仅供服务端使用（Server Components、API Routes、Server Actions）
 * 客户端组件请使用: import { type Notification, PRIORITY_CONFIG } from "@/lib/notifications"
 */

// 核心服务 - 仅服务端使用
export { NotificationService } from "./notification.service";

// 业务快捷方法 - 仅服务端使用
export { Notify } from "./notification.helpers";

// 重新导出类型（方便服务端代码一次性导入）
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
