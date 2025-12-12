/**
 * Event Bus Module
 * V4.2 事件总线模块入口
 *
 * 提供分类模块与自组织模块之间的解耦通信机制
 *
 * @example
 * ```typescript
 * import { eventBus, EventName } from '@/lib/shared/event-bus';
 *
 * // 订阅分类事件
 * eventBus.on('classification:bookmark_classified', (payload) => {
 *   // 更新文件夹画像
 *   if (payload.folderId) {
 *     profileService.scheduleUpdate(payload.userId, payload.folderId);
 *   }
 * });
 *
 * // 发布事件
 * eventBus.emit('classification:bookmark_classified', {
 *   userId: 'user-123',
 *   bookmarkId: 456,
 *   folderId: 789,
 *   folderName: '技术文章',
 *   confidence: 0.85,
 *   action: 'classify',
 *   timestamp: new Date().toISOString(),
 * });
 * ```
 */

// Core
export { EventBus, eventBus, createEventBus } from "./event-bus";
export type { EventBusOptions } from "./event-bus";

// System Coordinator (V4.2 GAP-10)
export {
  SystemCoordinatorService,
  initSystemCoordinator,
  getSystemCoordinator,
  stopSystemCoordinator,
  createSystemCoordinator,
} from "./system-coordinator.service";
export type {
  SystemCoordinatorConfig,
  SystemCoordinatorStatus,
} from "./system-coordinator.service";

// Types
export type {
  // Event type mappings
  EventTypes,
  EventName,
  EventPayload,
  // Classification events
  ClassificationEventTypes,
  BookmarkClassifiedEvent,
  BatchClassificationCompletedEvent,
  ClassificationFeedbackEvent,
  // Organization events
  OrganizationEventTypes,
  FolderProfileUpdatedEvent,
  SuggestionGeneratedEvent,
  OperationUndoneEvent,
  FolderCreatedEvent,
  FoldersMergedEvent,
  FolderSplitEvent,
  // Summary events (V4.2 GAP-10)
  SummaryEventTypes,
  SummaryCompletedEvent,
  TagsGeneratedEvent,
  // Job queue events
  JobQueueEventTypes,
  JobEnqueuedEvent,
  JobCompletedEvent,
  // Cost monitor events
  CostMonitorEventTypes,
  CostAlertEvent,
} from "./event-types";

// ============================================================================
// 事件名称常量（便于使用）
// ============================================================================

/** 分类模块事件名称 */
export const ClassificationEvents = {
  BOOKMARK_CLASSIFIED: "classification:bookmark_classified",
  BATCH_COMPLETED: "classification:batch_completed",
  FEEDBACK_RECEIVED: "classification:feedback_received",
} as const;

/** 自组织模块事件名称 */
export const OrganizationEvents = {
  PROFILE_UPDATED: "organization:profile_updated",
  SUGGESTION_GENERATED: "organization:suggestion_generated",
  OPERATION_UNDONE: "organization:operation_undone",
  FOLDER_CREATED: "organization:folder_created",
  FOLDERS_MERGED: "organization:folders_merged",
  FOLDER_SPLIT: "organization:folder_split",
} as const;

/** 任务队列事件名称 */
export const JobQueueEvents = {
  ENQUEUED: "job:enqueued",
  COMPLETED: "job:completed",
} as const;

/** 成本监控事件名称 */
export const CostMonitorEvents = {
  ALERT_TRIGGERED: "cost:alert_triggered",
} as const;

/** AI 摘要事件名称 (V4.2 GAP-10) */
export const SummaryEvents = {
  COMPLETED: "summary:completed",
  TAGS_GENERATED: "summary:tags_generated",
} as const;
