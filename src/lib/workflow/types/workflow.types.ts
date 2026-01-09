/**
 * 工作流系统核心类型定义
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

// ============================================================
// 工作流定义类型
// ============================================================

/**
 * 工作流定义
 */
export interface WorkflowDefinition {
  /** 工作流 ID */
  id: string;
  /** 工作流名称 */
  name: string;
  /** 工作流描述 */
  description: string;
  /** 版本号 */
  version: string;
  /** 类别 */
  category: "builtin" | "user_defined";
  /** 触发器配置 */
  triggers: WorkflowTrigger[];
  /** 步骤列表 */
  steps: WorkflowStep[];
  /** 工作流配置 */
  config: WorkflowConfig;
}

/**
 * 工作流触发器
 */
export interface WorkflowTrigger {
  /** 触发类型 */
  type: "manual" | "event" | "schedule" | "conversation";
  /** 事件类型（event 触发） */
  eventType?: string;
  /** 条件表达式 */
  condition?: string;
  /** 定时配置（schedule 触发） */
  schedule?: {
    type: "cron" | "interval";
    value: string;
  };
  /** 匹配模式（conversation 触发，关键词模式） */
  patterns?: string[];
  /** 语义匹配配置（conversation 触发，语义模式） */
  semanticPatterns?: {
    /** 参考文本列表 */
    referenceTexts: string[];
    /** 相似度阈值 (0-1)，默认 0.75 */
    threshold?: number;
  };
}

/**
 * 工作流步骤
 */
export interface WorkflowStep {
  /** 步骤 ID */
  id: string;
  /** 步骤名称 */
  name: string;
  /** 步骤类型 */
  type:
    | "skill"
    | "tool"
    | "condition"
    | "parallel"
    | "aggregate"
    | "notification";
  /** 步骤配置 */
  config: SkillStepConfig | ToolStepConfig | Record<string, unknown>;
  /** 条件表达式（可选） */
  condition?: string;
  /** 错误处理策略 */
  onError?: "stop" | "skip" | "continue";
  /** 是否需要用户确认 */
  requiresConfirmation?: boolean;
  /** 确认消息 */
  confirmationMessage?: string;
}

/**
 * Skill 步骤配置
 */
export interface SkillStepConfig {
  /** Skill ID */
  skillId: string;
  /** 输入参数映射 */
  inputMapping: Record<string, string | unknown>;
  /** 输出参数映射 */
  outputMapping?: Record<string, string>;
}

/**
 * Tool 步骤配置
 */
export interface ToolStepConfig {
  /** Tool 名称 */
  toolName: string;
  /** 参数 */
  args: Record<string, unknown>;
}

/**
 * Aggregate 步骤配置
 */
export interface AggregateStepConfig {
  /** 要聚合的步骤 ID 列表（可选，默认聚合所有已完成步骤） */
  sourceSteps?: string[];
  /** 聚合模式 */
  mode?: "collect" | "merge" | "report";
  /** 报告模板（mode 为 report 时使用） */
  template?: string;
}

/**
 * Notification 步骤配置
 */
export interface NotificationStepConfig {
  /** 通知类型 */
  notificationType: "in_app" | "email" | "push";
  /** 通知标题 */
  title: string;
  /** 通知内容模板（支持 {{变量}} 替换） */
  bodyTemplate: string;
  /** 通知优先级 */
  priority?: "low" | "normal" | "high";
}

/**
 * 工作流配置
 */
export interface WorkflowConfig {
  /** 超时时间（毫秒） */
  timeout: number;
  /** 完成时通知 */
  notifyOnComplete: boolean;
  /** 失败时通知 */
  notifyOnFailure: boolean;
}

// ============================================================
// 执行类型
// ============================================================

/**
 * 执行状态
 */
export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "waiting_confirmation";

/**
 * 触发类型
 */
export type TriggerType = "manual" | "event" | "schedule" | "conversation";

/**
 * 步骤执行结果
 */
export interface StepResult {
  /** 步骤 ID */
  stepId: string;
  /** 步骤名称 */
  stepName: string;
  /** 执行状态 */
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  /** 输出数据 */
  output?: unknown;
  /** 错误信息 */
  error?: string;
  /** 执行时长（毫秒） */
  duration?: number;
  /** 开始时间 */
  startedAt?: string;
  /** 完成时间 */
  completedAt?: string;
}

/**
 * 工作流执行上下文
 */
export interface WorkflowContext {
  /** 用户 ID */
  userId: string;
  /** 工作流 ID */
  workflowId: string;
  /** 执行记录 ID */
  executionId: string;
  /** 变量存储 */
  variables: Record<string, unknown>;
  /** 步骤结果存储 */
  stepResults: Record<string, StepResult>;
  /** 取消信号 */
  abortSignal: AbortSignal;
}

/**
 * 工作流执行状态（API 响应）
 */
export interface WorkflowExecution {
  /** 执行记录 ID */
  id: string;
  /** 工作流 ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 用户 ID */
  userId: string;
  /** 执行状态 */
  status: ExecutionStatus;
  /** 触发类型 */
  triggerType: TriggerType;
  /** 触发上下文 */
  triggerContext: Record<string, unknown>;
  /** 当前步骤索引 */
  currentStepIndex: number;
  /** 步骤结果列表 */
  steps: StepResult[];
  /** 总步骤数 */
  totalSteps: number;
  /** 进度百分比 */
  progress: number;
  /** 错误信息 */
  errorMessage?: string;
  /** 开始时间 */
  startedAt: string;
  /** 完成时间 */
  completedAt?: string;
}

// ============================================================
// 启动选项类型
// ============================================================

/**
 * 启动工作流选项
 */
export interface StartWorkflowOptions {
  /** 触发类型 */
  triggerType?: TriggerType;
  /** 触发上下文 */
  triggerContext?: Record<string, unknown>;
}

/**
 * 列出执行记录选项
 */
export interface ListExecutionsOptions {
  /** 工作流 ID 过滤 */
  workflowId?: string;
  /** 限制数量 */
  limit?: number;
  /** 状态过滤 */
  status?: ExecutionStatus;
}
