/**
 * 工作流 AI 集成类型定义
 *
 * @version 1.1.0
 * @since 2026-01-08
 * @updated 2026-01-09 - 添加语义匹配配置类型
 */

// ============================================================
// 触发模式类型
// ============================================================

/**
 * 触发模式类型
 */
export type TriggerPatternType = "keyword" | "regex" | "semantic";

/**
 * 语义模式配置
 */
export interface SemanticPatternConfig {
  /** 参考文本列表 */
  referenceTexts: string[];
  /** 相似度阈值 (0-1)，默认 0.75 */
  threshold?: number;
  /** 预计算的向量（运行时缓存，不存储在数据库） */
  precomputedEmbeddings?: number[][];
}

/**
 * 工作流触发模式
 */
export interface WorkflowTriggerPattern {
  /** 触发模式类型 */
  type: TriggerPatternType;
  /** 模式内容（keyword/regex 类型使用） */
  pattern: string;
  /** 匹配权重 (0-1) */
  weight?: number;
  /** 语义匹配配置（semantic 类型使用） */
  semanticConfig?: SemanticPatternConfig;
}

/**
 * 工作流触发配置
 */
export interface WorkflowTriggerConfig {
  /** 对话触发模式列表 */
  patterns: WorkflowTriggerPattern[];
  /** 最小置信度阈值 */
  minConfidence?: number;
  /** 是否启用语义匹配 */
  enableSemantic?: boolean;
}

// ============================================================
// 匹配结果类型
// ============================================================

/**
 * 工作流匹配结果
 */
export interface WorkflowMatch {
  /** 工作流 ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 匹配置信度 (0-1) */
  confidence: number;
  /** 匹配的模式 */
  matchedPattern: string;
  /** 提取的参数 */
  extractedParams?: Record<string, string>;
}

// ============================================================
// 执行结果类型
// ============================================================

/**
 * 工作流执行状态
 */
export type WorkflowExecuteStatus = "started" | "completed" | "failed";

/**
 * 工作流执行结果
 */
export interface WorkflowExecuteResult {
  /** 结果类型 */
  type: "workflow";
  /** 工作流 ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 执行记录 ID */
  executionId: string;
  /** 执行状态 */
  status: WorkflowExecuteStatus;
  /** 用户消息 */
  message: string;
  /** 执行进度（可选） */
  progress?: {
    current: number;
    total: number;
    currentStep: string;
  };
}

// ============================================================
// 推荐类型
// ============================================================

/**
 * 推荐优先级
 */
export type RecommendationPriority = "high" | "medium" | "low";

/**
 * 工作流推荐
 */
export interface WorkflowRecommendation {
  /** 工作流 ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 推荐原因 */
  reason: string;
  /** 优先级 */
  priority: RecommendationPriority;
  /** 推荐分数 (0-100) */
  score: number;
}

// ============================================================
// 通知类型
// ============================================================

/**
 * 工作流通知状态
 */
export type WorkflowNotificationStatus =
  | "completed"
  | "failed"
  | "waiting_confirmation";

/**
 * 工作流通知上下文
 */
export interface WorkflowNotificationContext {
  /** 用户 ID */
  userId: string;
  /** 工作流 ID */
  workflowId: string;
  /** 工作流名称 */
  workflowName: string;
  /** 执行记录 ID */
  executionId: string;
  /** 状态 */
  status: WorkflowNotificationStatus;
  /** 摘要信息 */
  summary: string;
  /** 输出数据（可选） */
  outputs?: Record<string, unknown>;
  /** 错误信息（可选） */
  error?: string;
}

// ============================================================
// Skill 步骤类型
// ============================================================

/**
 * Skill 步骤配置
 */
export interface IntegrationSkillStepConfig {
  /** Skill ID */
  skillId: string;
  /** 输入参数映射 */
  inputMapping: Record<string, string | unknown>;
  /** 输出参数映射 */
  outputMapping?: Record<string, string>;
}

/**
 * Skill 执行结果
 */
export interface SkillExecuteResult {
  /** 是否成功 */
  success: boolean;
  /** 返回数据 */
  data?: unknown;
  /** 错误信息 */
  error?: string;
}
