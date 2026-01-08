/**
 * 工作流触发器类型定义
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

// ============================================================
// 触发器基础类型
// ============================================================

export type TriggerType = "manual" | "conversation" | "scheduled" | "event";

export type ScheduleFrequency = "daily" | "weekly" | "monthly";

// ============================================================
// 定时触发配置
// ============================================================

/**
 * 定时触发配置
 */
export interface ScheduleTriggerConfig {
  /** 调度频率 */
  frequency: ScheduleFrequency;
  /** 执行时间（HH:mm 格式） */
  time: string;
  /** 周几执行（仅 weekly 有效，0-6，0=周日） */
  dayOfWeek?: number;
  /** 每月几号执行（仅 monthly 有效，1-31） */
  dayOfMonth?: number;
  /** 时区 */
  timezone?: string;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 定时执行记录
 */
export interface ScheduledExecution {
  id: string;
  workflowId: string;
  userId: string;
  scheduledAt: Date;
  status: ScheduledExecutionStatus;
  executionId?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export type ScheduledExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

// ============================================================
// 事件触发类型
// ============================================================

/**
 * 事件类型
 */
export type EventType =
  | "bookmark_created"
  | "bookmark_batch_imported"
  | "browser_bookmark_import_completed"
  | "folder_created"
  | "tag_added"
  | "bookmark_count_threshold"
  | "untagged_count_threshold";

/**
 * 事件触发配置
 */
export interface EventTriggerConfig {
  /** 事件类型 */
  eventType: EventType;
  /** 触发条件表达式 */
  condition?: string;
  /** 参数映射 */
  paramMapping?: Record<string, string>;
  /** 去重时间窗口（毫秒） */
  debounceMs?: number;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 工作流事件
 */
export interface WorkflowEvent {
  type: EventType;
  userId: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================
// 对话触发类型
// ============================================================

/**
 * 对话触发配置
 */
export interface ConversationTriggerConfig {
  /** 匹配模式列表 */
  patterns: ConversationPattern[];
  /** 最低置信度阈值 */
  minConfidence: number;
}

/**
 * 对话匹配模式
 */
export interface ConversationPattern {
  /** 模式类型 */
  type: "keyword" | "regex";
  /** 模式内容 */
  pattern: string;
}

// ============================================================
// 触发器定义
// ============================================================

/**
 * 触发器定义
 */
export interface TriggerDefinition {
  type: TriggerType;
  config?:
    | ScheduleTriggerConfig
    | EventTriggerConfig
    | ConversationTriggerConfig;
}
