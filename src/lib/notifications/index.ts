/**
 * 统一通知系统模块导出
 * @description V4.3 三层通知体系入口
 * @version 1.0.0
 * @since 2025-12-12
 */

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

// Toast Service (L1)
export { toastService } from "./toast/toast.service";

// Inbox Service (L2) - 复用现有 confirmationService
export { confirmationService as inboxService } from "@/lib/confirmation";

// Activity Service (L3)
export { activityService } from "./activity/activity.service";
