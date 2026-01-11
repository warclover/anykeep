/**
 * 任务理解层类型定义
 *
 * 基于零接管理念设计，AI 静默理解 → 直接执行 → 事后撤销
 *
 * @version 2.0.0
 * @since 2025-12-26
 */

// =============================================================================
// 核心数据结构
// =============================================================================

/**
 * 任务理解结果（零接管版）
 *
 * 核心变更：
 * - 移除 clarificationsNeeded（不问用户）
 * - 移除 implicitAssumptions（改为 reasoning）
 * - 添加 appliedDefaults（智能默认值记录）
 */
export interface TaskUnderstanding {
  /** 唯一标识 */
  id: string;

  /** 用户原始输入 */
  rawInput: string;

  /** 用户的真正目标（一句话描述） */
  goal: string;

  /** AI 的决策依据（用于展示思考过程） */
  reasoning: string;

  /** 执行计划（静默执行，事后展示） */
  executionPlan: ExecutionStep[];

  /** 理解置信度 (0-1) - 仅用于日志和优化，不影响流程 */
  confidence: number;

  /**
   * 是否需要确认
   * 零接管原则：仅用于不可逆操作（删除）
   */
  requiresConfirmation: boolean;

  /** 确认原因 - 仅用于删除等高风险操作 */
  confirmationReason?: ConfirmationReason;

  /** 任务风险级别 */
  riskLevel: RiskLevel;

  /** 使用的智能默认值（用于偏好学习） */
  appliedDefaults: SmartDefault[];

  /** 匹配的任务模板（如果有） */
  matchedTemplate?: string;

  /** 元数据 */
  metadata: TaskUnderstandingMetadata;
}

/**
 * 确认原因（仅删除操作）
 */
export type ConfirmationReason = "删除操作不可撤销，请确认";

/**
 * 风险级别
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * 任务理解元数据
 */
export interface TaskUnderstandingMetadata {
  /** 创建时间 */
  createdAt: Date;
  /** 来源 */
  source: "llm" | "template" | "hybrid";
  /** 处理耗时（毫秒） */
  processingTimeMs: number;
  /** 使用的模型 */
  model?: string;
}

// =============================================================================
// 智能默认值
// =============================================================================

/**
 * 智能默认值记录
 *
 * 决策优先级：用户偏好 > 上下文推断 > 系统默认
 */
export interface SmartDefault {
  /** 字段名，如 'organizeMethod', 'targetFolder' */
  field: string;

  /** 使用的值 */
  value: string;

  /** 值来源 */
  source: SmartDefaultSource;

  /** 决策置信度 (0-1) */
  confidence: number;

  /** 决策依据说明（可选，用于调试） */
  reason?: string;
}

/**
 * 智能默认值来源
 */
export type SmartDefaultSource =
  | "user_preference" // 用户偏好（历史行为学习）
  | "context_infer" // 上下文推断
  | "system_default"; // 系统默认

// =============================================================================
// 执行计划
// =============================================================================

/**
 * 执行步骤
 */
export interface ExecutionStep {
  /** 步骤序号 */
  step: number;

  /** 步骤描述（面向用户） */
  description: string;

  /** 关联的工具/Skill */
  action?: string;

  /** 步骤参数 */
  params?: Record<string, unknown>;

  /** 预估耗时（秒） */
  estimatedDuration?: number;

  /**
   * 是否需要确认
   * 零接管原则：仅删除步骤需要确认
   */
  requiresConfirmation?: boolean;

  /** 依赖的前置步骤 */
  dependsOn?: number[];
}

// =============================================================================
// 撤销相关
// =============================================================================

/**
 * 可撤销操作记录
 */
export interface UndoableOperation {
  /** 撤销 ID */
  undoId: string;

  /** 用户 ID */
  userId: string;

  /** 关联的任务理解 ID */
  taskUnderstandingId: string;

  /** 操作类型 */
  operationType: OperationType;

  /** 操作前的状态快照 */
  beforeState: OperationSnapshot;

  /** 操作后的状态（用于验证） */
  afterState?: OperationSnapshot;

  /** 创建时间 */
  createdAt: Date;

  /** 过期时间（撤销窗口） */
  expiresAt: Date;

  /** 是否已撤销 */
  undone: boolean;

  /** 撤销时间 */
  undoneAt?: Date;
}

/**
 * 操作类型
 */
export type OperationType =
  | "move_bookmarks"
  | "batch_tags_add"
  | "batch_tags_remove"
  | "batch_organize"
  | "classify"
  | "delete_bookmarks";

/**
 * 操作快照
 */
export interface OperationSnapshot {
  /** 影响的书签 ID */
  bookmarkIds: string[];

  /** 快照数据 */
  data: Record<string, unknown>;

  /** 快照时间 */
  snapshotAt: Date;
}

// =============================================================================
// 执行结果
// =============================================================================

/**
 * 任务执行结果
 */
export interface TaskExecutionResult {
  /** 是否成功 */
  success: boolean;

  /** 结果摘要（展示给用户） */
  summary: string;

  /** 任务理解（含思考过程） */
  understanding: TaskUnderstanding;

  /** 是否可撤销 */
  canUndo: boolean;

  /** 撤销信息 */
  undoInfo?: {
    undoId: string;
    expiresAt: Date;
  };

  /** 详细数据（根据操作类型不同） */
  details?: TaskResultDetails;

  /** 用户调整反馈（如果有） */
  adjustment?: UserAdjustment;

  /** 执行耗时（毫秒） */
  executionTimeMs: number;
}

/**
 * 任务结果详情
 */
export interface TaskResultDetails {
  /** 处理的书签数量 */
  processedCount?: number;

  /** 成功数量 */
  successCount?: number;

  /** 失败数量 */
  failedCount?: number;

  /** 处理的书签列表（前 N 条） */
  processedItems?: Array<{
    id: string;
    title: string;
    action: string;
  }>;

  /** 额外数据 */
  extra?: Record<string, unknown>;
}

/**
 * 用户调整反馈
 */
export interface UserAdjustment {
  /** 调整类型 */
  type: "undo" | "modify" | "feedback";

  /** 调整内容 */
  content: string;

  /** 调整时间 */
  adjustedAt: Date;
}

// =============================================================================
// API 流类型（零接管模式）
// =============================================================================

/**
 * 零接管模式流块类型
 *
 * 原流程: text → understanding → clarification → confirmation → progress → result
 * 新流程: thinking → progress → result → undo_available
 */
export type ZeroTakeoverStreamChunk =
  | ThinkingChunk
  | ProgressChunk
  | ResultChunk
  | UndoAvailableChunk
  | ConfirmationRequiredChunk
  | ErrorChunk;

/**
 * 思考过程块（可选展示）
 */
export interface ThinkingChunk {
  type: "thinking";
  text: string;
}

/**
 * 进度块
 */
export interface ProgressChunk {
  type: "progress";
  step: string;
  percent: number;
  message?: string;
}

/**
 * 结果块
 */
export interface ResultChunk {
  type: "result";
  data: TaskExecutionResult;
}

/**
 * 撤销可用块
 */
export interface UndoAvailableChunk {
  type: "undo_available";
  undoId: string;
  expiresAt: Date;
}

/**
 * 确认请求块（仅删除操作）
 */
export interface ConfirmationRequiredChunk {
  type: "confirmation_required";
  reason: ConfirmationReason;
  operationType: "delete";
  affectedCount: number;
}

/**
 * 错误块
 */
export interface ErrorChunk {
  type: "error";
  message: string;
  code?: string;
}

// =============================================================================
// 上下文相关
// =============================================================================

/**
 * 任务上下文
 */
export interface TaskContext {
  /** 用户 ID */
  userId: string;

  /** 用户输入 */
  input: string;

  /** 收藏统计 */
  stats: TaskContextStats;

  /** 文件夹列表 */
  folders: TaskContextFolder[];

  /** 目标书签（如果有指定） */
  targetBookmarks?: TaskContextBookmark[];

  /** 最近活跃平台 */
  recentPlatforms: string[];

  /** 常用标签 */
  frequentTags: string[];

  /** 上次对话主题 */
  lastTopic?: string;
}

/**
 * 任务上下文统计
 */
export interface TaskContextStats {
  /** 收藏总数 */
  total: number;

  /** 待整理数 */
  inbox: number;

  /** 平台分布 */
  platformDistribution: Record<string, number>;

  /** 本周新增数 */
  weeklyAdded?: number;
}

/**
 * 任务上下文文件夹
 */
export interface TaskContextFolder {
  id: string;
  name: string;
  parentId?: string;
  bookmarkCount?: number;
}

/**
 * 任务上下文书签
 */
export interface TaskContextBookmark {
  id: string;
  title: string;
  platform: string;
  folderId?: string;
  tags?: string[];
}

// =============================================================================
// 偏好学习相关
// =============================================================================

/**
 * 任务理解层用户偏好（用于智能默认值）
 *
 * 注意：此类型专用于任务理解层的偏好学习
 * @see ClassificationPreferences in classification/learning - 分类学习偏好
 * @see SkillExecutionPreferences in ai-skills/core/types - Skill 执行偏好
 */
export interface TaskUserPreferences {
  /** 用户 ID */
  userId: string;

  /** 首选整理方式 */
  preferredOrganizeMethod?: OrganizeMethod;

  /** 常用文件夹 */
  frequentFolders?: string[];

  /** 常用标签 */
  frequentTags?: string[];

  /** 默认值使用统计（用于学习） */
  defaultUsage?: Record<string, Record<string, number>>;

  /** 更新时间 */
  updatedAt: Date;
}

/** @deprecated 使用 TaskUserPreferences 替代 */
export type UserPreferences = TaskUserPreferences;

/**
 * 整理方式
 */
export type OrganizeMethod = "topic" | "time" | "platform" | "author" | "auto";

/**
 * 偏好学习记录
 */
export interface PreferenceLearningRecord {
  /** 用户 ID */
  userId: string;

  /** 任务类型 */
  taskType: string;

  /** 使用的默认值 */
  appliedDefault: SmartDefault;

  /** 用户行为 */
  userAction: "accepted" | "undone" | "adjusted";

  /** 调整后的值（如果调整） */
  adjustedValue?: string;

  /** 记录时间 */
  recordedAt: Date;
}
