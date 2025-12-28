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

// UI Event Bus (V4.2 Phase 1)
export { UIEventBus, uiEventBus, createUIEventBus } from "./ui-event-bus";
export type { UIEventBusOptions } from "./ui-event-bus";

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
  // Persona events (Phase 4)
  PersonaEventTypes,
  PersonaInferredEvent,
  PersonaSettingsChangedEvent,
  PersonaIntentRoutedEvent,
  PersonaErrorEvent,
  PersonaRolloutCheckEvent,
} from "./event-types";

// UI Event Types (V4.2 Phase 1)
export type {
  UIEventTypes,
  UIEventName,
  UIEventPayload,
  ViewModeChangeEvent,
  LayoutModeChangeEvent,
  FlipCardChangeEvent,
  PlatformChangeEvent,
  UsageTagFilterChangeEvent,
  OpenDialogEvent,
  CloseDialogEvent,
  ToggleSelectionModeEvent,
  BookmarkCreatedEvent,
  BookmarkUpdatedEvent,
  BookmarkDeletedEvent,
} from "./ui-event-types";
export { LEGACY_EVENT_MAP } from "./ui-event-types";
export type { LegacyEventName } from "./ui-event-types";

// ============================================================================
// 事件名称常量（从 event-types.ts 重导出，避免循环依赖）
// ============================================================================

export {
  ClassificationEvents,
  OrganizationEvents,
  JobQueueEvents,
  CostMonitorEvents,
  SummaryEvents,
  KnowledgeLinkEvents,
  PersonaEvents,
} from "./event-types";

/** UI 事件名称 (V4.2 Phase 1) */
export const UIEvents = {
  // 视图模式
  VIEW_MODE_CHANGE: "ui:view:mode:change",
  LAYOUT_MODE_CHANGE: "ui:view:layout:change",
  FLIP_CARD_CHANGE: "ui:view:flipCard:change",
  // 筛选
  PLATFORM_CHANGE: "ui:filter:platform:change",
  USAGE_TAGS_CHANGE: "ui:filter:usageTags:change",
  // 对话框
  DIALOG_OPEN: "ui:dialog:open",
  DIALOG_CLOSE: "ui:dialog:close",
  // 选择模式
  SELECTION_TOGGLE: "ui:selection:toggle",
  // 书签
  BOOKMARK_CREATED: "ui:bookmark:created",
  BOOKMARK_UPDATED: "ui:bookmark:updated",
  BOOKMARK_DELETED: "ui:bookmark:deleted",
} as const;
