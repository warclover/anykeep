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
  /** 摘要版本 (1: 纯文本, 2: JSON结构化, 3: 增强版) */
  summaryVersion: 1 | 2 | 3;
  /** 摘要模式 */
  summaryMode?: "standard" | "enhanced";
  /** 生成的标签数量 */
  tagsGenerated: number;
  /** 提取的实体数量 (v3.0) */
  entitiesExtracted?: number;
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

/** 实体提取事件 (v3.0) */
export interface EntitiesExtractedEvent {
  userId: string;
  bookmarkId: number;
  /** 提取的实体列表 */
  entities: Array<{
    name: string;
    type:
      | "person"
      | "company"
      | "tech"
      | "concept"
      | "product"
      | "place"
      | "other";
    confidence?: number;
  }>;
  /** 实体数量 */
  entityCount: number;
  /** 是否需要知识关联处理 */
  needsLinkProcessing: boolean;
  timestamp: string;
}

/** 关键数据提取事件 (v3.0) */
export interface KeyDataExtractedEvent {
  userId: string;
  bookmarkId: number;
  /** 提取的关键数据 */
  keyData: Array<{
    label: string;
    value: string;
    unit?: string;
  }>;
  timestamp: string;
}

/** AI 摘要事件类型映射 */
export interface SummaryEventTypes {
  "summary:completed": SummaryCompletedEvent;
  "summary:tags_generated": TagsGeneratedEvent;
  "summary:entities_extracted": EntitiesExtractedEvent;
  "summary:key_data_extracted": KeyDataExtractedEvent;
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
// 知识关联事件 (Phase 2)
// ============================================================================

/** 关联发现完成事件 */
export interface LinksDiscoveredEvent {
  userId: string;
  bookmarkId: number;
  /** 发现的关联数量 */
  linksDiscovered: number;
  /** 按类型统计 */
  linksByType: {
    semantic: number;
    entity: number;
    tag: number;
    topic: number;
  };
  /** 处理耗时 (ms) */
  processingTimeMs: number;
  timestamp: string;
}

/** 关联重建完成事件 */
export interface LinksRebuiltEvent {
  userId: string;
  bookmarkId: number;
  /** 旧关联数量 */
  oldLinksCount: number;
  /** 新关联数量 */
  newLinksCount: number;
  timestamp: string;
}

/** 知识关联事件类型映射 */
export interface KnowledgeLinkEventTypes {
  "link:discovered": LinksDiscoveredEvent;
  "link:rebuilt": LinksRebuiltEvent;
}

// ============================================================================
// 画像分析事件 (Phase 4)
// ============================================================================

/** 画像推断事件 */
export interface PersonaInferredEvent {
  userId: string;
  personaType: string;
  personaGroup: string;
  confidence: number;
  alternativesCount: number;
  bookmarkCount: number;
  inferenceTimeMs: number;
  timestamp: string;
}

/** 画像设置变更事件 */
export interface PersonaSettingsChangedEvent {
  userId: string;
  changeType: "set_manual" | "reset_to_inferred" | "update_preferences";
  previousType: string | null;
  newType: string | null;
  previousSource: "inferred" | "manual" | null;
  newSource: "inferred" | "manual";
  timestamp: string;
}

/** 画像意图路由事件 */
export interface PersonaIntentRoutedEvent {
  userId: string;
  personaType: string;
  intentType: string;
  intentSubType?: string;
  boostApplied: boolean;
  originalConfidence: number;
  boostedConfidence: number;
  timestamp: string;
}

/** 画像功能错误事件 */
export interface PersonaErrorEvent {
  userId: string;
  errorType:
    | "inference_failed"
    | "settings_save_failed"
    | "prompt_inject_failed";
  errorMessage: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

/** 画像灰度发布检查事件 */
export interface PersonaRolloutCheckEvent {
  userId: string;
  inRollout: boolean;
  rolloutPercentage: number;
  userHash: number;
  timestamp: string;
}

/** 画像分析事件类型映射 */
export interface PersonaEventTypes {
  "persona:inferred": PersonaInferredEvent;
  "persona:settings_changed": PersonaSettingsChangedEvent;
  "persona:intent_routed": PersonaIntentRoutedEvent;
  "persona:error": PersonaErrorEvent;
  "persona:rollout_check": PersonaRolloutCheckEvent;
}

// ============================================================================
// 聚合所有事件类型
// ============================================================================

/** 所有事件类型 */
export type EventTypes = ClassificationEventTypes &
  OrganizationEventTypes &
  SummaryEventTypes &
  JobQueueEventTypes &
  CostMonitorEventTypes &
  KnowledgeLinkEventTypes &
  PersonaEventTypes &
  MdCollectionEventTypes;

/** 事件名称联合类型 */
export type EventName = keyof EventTypes;

/** 获取事件负载类型 */
export type EventPayload<K extends EventName> = EventTypes[K];

// ============================================================================
// 事件名称常量（从 index.ts 移动，避免循环依赖）
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

/** 知识关联事件名称 (Phase 2) */
export const KnowledgeLinkEvents = {
  DISCOVERED: "link:discovered",
  REBUILT: "link:rebuilt",
} as const;

/** 画像分析事件名称 (Phase 4) */
export const PersonaEvents = {
  INFERRED: "persona:inferred",
  SETTINGS_CHANGED: "persona:settings_changed",
  INTENT_ROUTED: "persona:intent_routed",
  ERROR: "persona:error",
  ROLLOUT_CHECK: "persona:rollout_check",
} as const;

// ============================================================================
// MD 收藏 AI 处理事件 (v2.8)
// ============================================================================

/** MD 处理开始事件 */
export interface MdProcessingStartedEvent {
  collectionId: number;
  userId: string;
  /** 处理选项 */
  options: {
    generateSummary?: boolean;
    generateTags?: boolean;
    generateEmbedding?: boolean;
  };
  timestamp: string;
}

/** MD 处理完成事件 */
export interface MdProcessingCompletedEvent {
  collectionId: number;
  userId: string;
  /** 是否成功 */
  success: boolean;
  /** 是否有摘要 */
  hasSummary: boolean;
  /** 是否有标签 */
  hasTags: boolean;
  /** 是否有向量嵌入 */
  hasEmbedding: boolean;
  /** 处理耗时 (ms) */
  durationMs: number;
  timestamp: string;
}

/** MD 处理失败事件 */
export interface MdProcessingFailedEvent {
  collectionId: number;
  userId: string;
  /** 错误信息 */
  error: string;
  /** 错误代码 */
  errorCode: string;
  /** 是否可重试 */
  retryable: boolean;
  timestamp: string;
}

/** MD 标签生成事件 */
export interface MdTagsGeneratedEvent {
  collectionId: number;
  userId: string;
  /** 生成的标签 */
  tags: string[];
  timestamp: string;
}

/** MD 收藏事件类型映射 */
export interface MdCollectionEventTypes {
  "md:processing_started": MdProcessingStartedEvent;
  "md:processing_completed": MdProcessingCompletedEvent;
  "md:processing_failed": MdProcessingFailedEvent;
  "md:tags_generated": MdTagsGeneratedEvent;
}

/** MD 收藏事件名称 */
export const MdCollectionEvents = {
  PROCESSING_STARTED: "md:processing_started",
  PROCESSING_COMPLETED: "md:processing_completed",
  PROCESSING_FAILED: "md:processing_failed",
  TAGS_GENERATED: "md:tags_generated",
} as const;
