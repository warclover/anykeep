/**
 * Event Bus - Event Type Definitions
 * V4.2 事件总线类型定义
 *
 * 用于分类模块与自组织模块之间的解耦通信
 */

// ============================================================================
// 分类模块事件
// ============================================================================

/** 书签分类完成事件 */
export interface BookmarkClassifiedEvent {
  userId: string;
  bookmarkId: number;
  folderId: number | null;
  folderName: string | null;
  confidence: number;
  action: "classify" | "inbox" | "create_folder";
  timestamp: string;
}

/** 批量分类完成事件 */
export interface BatchClassificationCompletedEvent {
  userId: string;
  count: number;
  results: Array<{
    bookmarkId: number;
    folderId: number | null;
    success: boolean;
  }>;
  timestamp: string;
}

/** 分类反馈事件 */
export interface ClassificationFeedbackEvent {
  userId: string;
  bookmarkId: number;
  originalFolderId: number | null;
  /** @deprecated 使用 newFolderId 代替 */
  correctedFolderId?: number;
  newFolderId: number | null;
  feedbackType:
    | "confirmed"
    | "rejected"
    | "corrected"
    | "correct"
    | "incorrect"
    | "manual_move";
  confidence?: number;
  /** 托管模式 */
  trustMode?: "full_auto" | "semi_auto" | "manual";
  /** 书签标签（用于负样本学习） */
  bookmarkTags?: string[];
  /** 来源 ID（用于负样本学习） */
  sourceId?: string;
  timestamp: string;
}

/** 分类模块事件类型映射 */
export interface ClassificationEventTypes {
  "classification:bookmark_classified": BookmarkClassifiedEvent;
  "classification:batch_completed": BatchClassificationCompletedEvent;
  "classification:feedback_received": ClassificationFeedbackEvent;
}

// ============================================================================
// 自组织模块事件
// ============================================================================

/** 文件夹画像更新事件 */
export interface FolderProfileUpdatedEvent {
  userId: string;
  folderId: number;
  folderName: string;
  bookmarkCount: number;
  /** 更新原因 */
  updateReason?:
    | "bookmark_added"
    | "bookmark_removed"
    | "bookmark_moved"
    | "scheduled"
    | "manual";
  /** 更新统计 */
  stats?: {
    bookmarksAdded?: number;
    bookmarksRemoved?: number;
  };
  timestamp: string;
}

/** 建议生成事件 */
export interface SuggestionGeneratedEvent {
  userId: string;
  suggestionId: number;
  type: "merge" | "split" | "rename" | "create_folder";
  confidence: number;
  timestamp: string;
}

/** 操作撤销事件 */
export interface OperationUndoneEvent {
  userId: string;
  snapshotId: string;
  action: "create" | "split" | "merge" | "rename" | "move" | "delete";
  timestamp: string;
}

/** 文件夹创建事件 */
export interface FolderCreatedEvent {
  userId: string;
  folderId: number;
  folderName: string;
  isAiSuggested: boolean;
  bookmarkIds: number[];
  timestamp: string;
}

/** 文件夹合并事件 */
export interface FoldersMergedEvent {
  userId: string;
  targetFolderId: number;
  sourceFolderIds: number[];
  bookmarksMoved: number;
  timestamp: string;
}

/** 文件夹分拆事件 */
export interface FolderSplitEvent {
  userId: string;
  sourceFolderId: number;
  newFolderIds: number[];
  bookmarksMoved: number;
  timestamp: string;
}

/** 自组织模块事件类型映射 */
export interface OrganizationEventTypes {
  "organization:profile_updated": FolderProfileUpdatedEvent;
  "organization:suggestion_generated": SuggestionGeneratedEvent;
  "organization:operation_undone": OperationUndoneEvent;
  "organization:folder_created": FolderCreatedEvent;
  "organization:folders_merged": FoldersMergedEvent;
  "organization:folder_split": FolderSplitEvent;
}

// ============================================================================
// AI 摘要事件 (V4.2 GAP-10)
// ============================================================================

/** AI 摘要完成事件 */
export interface SummaryCompletedEvent {
  userId: string;
  bookmarkId: number;
  /** 摘要版本 (1: 纯文本, 2: JSON结构化) */
  summaryVersion: 1 | 2;
  /** 生成的标签数量 */
  tagsGenerated: number;
  /** 处理耗时 (ms) */
  processingTimeMs: number;
  /** 是否需要分类 */
  needsClassification: boolean;
  timestamp: string;
}

/** AI 标签生成事件 */
export interface TagsGeneratedEvent {
  userId: string;
  bookmarkId: number;
  /** 生成的标签 */
  tags: string[];
  /** 标签来源 */
  source: "ai_summary" | "content_analysis" | "user_input";
  timestamp: string;
}

/** AI 摘要事件类型映射 */
export interface SummaryEventTypes {
  "summary:completed": SummaryCompletedEvent;
  "summary:tags_generated": TagsGeneratedEvent;
}

// ============================================================================
// 任务队列事件
// ============================================================================

/** 任务入队事件 */
export interface JobEnqueuedEvent {
  userId: string;
  jobId: string;
  jobType: string;
  priority: number;
  timestamp: string;
}

/** 任务完成事件 */
export interface JobCompletedEvent {
  userId: string;
  jobId: string;
  jobType: string;
  success: boolean;
  executionTimeMs: number;
  timestamp: string;
}

/** 任务队列事件类型映射 */
export interface JobQueueEventTypes {
  "job:enqueued": JobEnqueuedEvent;
  "job:completed": JobCompletedEvent;
}

// ============================================================================
// 成本监控事件
// ============================================================================

/** 成本告警事件 */
export interface CostAlertEvent {
  userId: string;
  alertType: "daily" | "monthly";
  currentCostCents: number;
  limitCents: number;
  percentUsed: number;
  timestamp: string;
}

/** 成本监控事件类型映射 */
export interface CostMonitorEventTypes {
  "cost:alert_triggered": CostAlertEvent;
}

// ============================================================================
// 聚合所有事件类型
// ============================================================================

/** 所有事件类型 */
export type EventTypes = ClassificationEventTypes &
  OrganizationEventTypes &
  SummaryEventTypes &
  JobQueueEventTypes &
  CostMonitorEventTypes;

/** 事件名称联合类型 */
export type EventName = keyof EventTypes;

/** 获取事件负载类型 */
export type EventPayload<K extends EventName> = EventTypes[K];
