/**
 * 消息类型映射表
 * @description 将旧的 MessageType 映射到新的 NotificationType code
 * @version 1.0.0
 * @since 2026-02-02
 */

import type { MessageType } from "./types";

/**
 * 旧消息类型 → 新通知类型编码映射
 */
export const MESSAGE_TYPE_TO_NOTIFICATION_CODE: Record<MessageType, string> = {
  // 分类相关
  classification_auto: "ai.classification.auto",
  classification_batch: "ai.classification.batch",
  classification_suggest: "ai.classification.auto", // 已废弃，映射到 auto
  classification_failed: "ai.classification.failed",
  reclassify_complete: "ai.classification.batch",

  // 导入相关
  import_complete: "import.complete",
  import_partial: "import.partial",
  import_failed: "import.failed",

  // 批量操作
  batch_move: "batch.move",
  batch_delete: "batch.delete",
  batch_tag: "batch.tag",
  batch_restore: "batch.restore",

  // 书签状态
  bookmark_saved: "bookmark.saved",
  bookmark_invalid: "bookmark.invalid",
  bookmark_expired: "bookmark.expired",

  // 文件夹操作
  folder_created: "folder.created",
  folder_merged: "folder.merged",

  // 系统消息
  system_announcement: "system.announcement",
  system_maintenance: "system.maintenance",
  system_update: "system.update",

  // 配额相关
  quota_warning: "quota.warning",
  quota_critical: "quota.critical",
  quota_exceeded: "quota.exceeded",

  // 用户反馈
  feedback_received: "feedback.received",
  feedback_response: "feedback.response",

  // AI 处理
  ai_summary_complete: "ai.summary.complete",
  ai_tags_complete: "ai.tags.complete",
  ai_processing_failed: "ai.processing.failed",

  // V4.2 新增：AI 文件夹进化
  folder_auto_created: "folder.auto_created",
  folder_auto_split: "folder.auto_split",
  folder_auto_merged: "folder.auto_merged",
  folder_auto_renamed: "folder.auto_renamed",
  folder_operation_undone: "folder.operation_undone",
  ai_evolution_report: "ai.evolution_report",

  // V4.2 新增：成本监控
  cost_warning: "quota.warning",
  cost_critical: "cost.daily_exceeded",
  cost_daily_exceeded: "cost.daily_exceeded",

  // V4.3 新增：页面监控
  page_content_changed: "monitor.content_changed",
  page_monitor_failed: "monitor.failed",
  page_monitor_quota_reached: "monitor.quota_reached",
};

/**
 * 消息等级 → 通知优先级映射
 */
export const MESSAGE_LEVEL_TO_PRIORITY: Record<string, string> = {
  silent: "silent",
  normal: "normal",
  important: "important",
};

/**
 * 实体类型映射
 */
export const ENTITY_TYPE_MAP: Record<string, string> = {
  bookmark: "bookmark",
  folder: "folder",
  import: "import",
};
