/**
 * Planning-Execution Model Types
 *
 * 定义执行计划相关的类型和常量
 * 替代复杂的 4 分类器意图路由，使用两步模型：
 * 1. Planner: 分析用户意图，生成执行计划
 * 2. Executor: 按计划执行工具调用
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { ToolRiskLevel } from "../tools/types";

// ============================================
// 执行计划类型
// ============================================

/**
 * 执行计划
 */
export interface ExecutionPlan {
  /** 计划唯一标识 */
  id: string;
  /** 用户意图简述 */
  intent: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 执行步骤 */
  steps: PlanStep[];
  /** 预估总执行时间 (毫秒) */
  estimatedDuration: number;
  /** 风险等级 */
  riskLevel: ToolRiskLevel;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 计划步骤
 */
export interface PlanStep {
  /** 步骤唯一标识 */
  id: string;
  /** 工具名称 */
  tool: string;
  /** 工具参数 */
  params: Record<string, unknown>;
  /** 输出变量名（用于步骤间传参） */
  outputVariable?: string;
  /** 条件表达式（条件执行） */
  condition?: string;
  /** 错误处理策略 */
  onError?: "skip" | "abort" | "retry";
  /** 预估执行时间 (毫秒) */
  estimatedDuration?: number;
}

// ============================================
// 执行事件类型
// ============================================

/**
 * 执行事件基类
 */
interface BaseExecutionEvent {
  timestamp: Date;
}

/**
 * 计划开始事件
 */
export interface PlanStartEvent extends BaseExecutionEvent {
  type: "plan_start";
  plan: ExecutionPlan;
}

/**
 * 步骤开始事件
 */
export interface StepStartEvent extends BaseExecutionEvent {
  type: "step_start";
  step: PlanStep;
  stepIndex: number;
  totalSteps: number;
}

/**
 * 步骤完成事件
 */
export interface StepCompleteEvent extends BaseExecutionEvent {
  type: "step_complete";
  step: PlanStep;
  result: StepResult;
  executionTimeMs: number;
}

/**
 * 步骤错误事件
 */
export interface StepErrorEvent extends BaseExecutionEvent {
  type: "step_error";
  step: PlanStep;
  error: string;
  willRetry: boolean;
}

/**
 * 步骤跳过事件
 */
export interface StepSkippedEvent extends BaseExecutionEvent {
  type: "step_skipped";
  step: PlanStep;
  reason: string;
}

/**
 * 计划完成事件
 */
export interface PlanCompleteEvent extends BaseExecutionEvent {
  type: "plan_complete";
  results: StepResult[];
  totalExecutionTimeMs: number;
}

/**
 * 计划中止事件
 */
export interface PlanAbortEvent extends BaseExecutionEvent {
  type: "plan_abort";
  reason: string;
  completedSteps: number;
}

/**
 * 需要确认事件
 */
export interface ConfirmationRequiredEvent extends BaseExecutionEvent {
  type: "confirmation_required";
  step: PlanStep;
  confirmationId: string;
  description: string;
}

/**
 * 执行事件联合类型
 */
export type ExecutionEvent =
  | PlanStartEvent
  | StepStartEvent
  | StepCompleteEvent
  | StepErrorEvent
  | StepSkippedEvent
  | PlanCompleteEvent
  | PlanAbortEvent
  | ConfirmationRequiredEvent;

// ============================================
// 步骤结果类型
// ============================================

/**
 * 步骤执行结果
 */
export interface StepResult {
  /** 步骤 ID */
  stepId: string;
  /** 是否成功 */
  success: boolean;
  /** 返回数据 */
  data?: unknown;
  /** 错误信息 */
  error?: string;
  /** 执行时间 (毫秒) */
  executionTimeMs: number;
}

// ============================================
// Planner 配置
// ============================================

/**
 * Planner 配置
 */
export interface PlannerConfig {
  /** 最大步骤数 */
  maxSteps: number;
  /** 置信度阈值（低于此值需要澄清） */
  confidenceThreshold: number;
  /** 是否启用变量解析 */
  enableVariables: boolean;
  /** 模型名称 */
  model: string;
}

/**
 * 默认 Planner 配置
 */
export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  maxSteps: 10,
  confidenceThreshold: 0.6,
  enableVariables: true,
  model: "deepseek-chat",
};

// ============================================
// Executor 配置
// ============================================

/**
 * Executor 配置
 */
export interface ExecutorConfig {
  /** 单步最大重试次数 */
  maxRetries: number;
  /** 重试延迟基数 (毫秒) */
  retryDelayMs: number;
  /** 单步超时时间 (毫秒) */
  stepTimeoutMs: number;
  /** 是否启用并行执行（暂不支持） */
  enableParallel: boolean;
}

/**
 * 默认 Executor 配置
 */
export const DEFAULT_EXECUTOR_CONFIG: ExecutorConfig = {
  maxRetries: 2,
  retryDelayMs: 1000,
  stepTimeoutMs: 30000,
  enableParallel: false,
};

// ============================================
// Planner Prompt 模板
// ============================================

/**
 * Planner System Prompt
 */
export const PLANNER_SYSTEM_PROMPT = `你是一个任务规划器。根据用户请求和可用工具，生成一个执行计划。

## 可用工具
{{tools}}

## 用户上下文
{{context}}

## 输出格式
返回 JSON 格式的执行计划:
{
  "intent": "用户意图简述",
  "confidence": 0.0-1.0,
  "steps": [
    {
      "id": "step_1",
      "tool": "工具名称",
      "params": { "参数": "值" },
      "outputVariable": "$result_1",
      "onError": "skip|abort|retry"
    },
    {
      "id": "step_2",
      "tool": "工具名称",
      "params": { "query": "$result_1.data" }
    }
  ],
  "riskLevel": "low|medium|high",
  "estimatedDuration": 3000
}

## 规则
1. 只使用可用工具列表中的工具
2. 步骤间可通过 $变量名 传递数据，格式：$result_N.path.to.value
3. 高风险操作（删除、批量修改）需标记 riskLevel: "high"
4. 尽量减少步骤数量，保持计划简洁
5. 每个步骤需指定合理的 onError 策略
6. 如果用户意图不明确，降低 confidence 值
7. estimatedDuration 以毫秒为单位，根据工具类型估算

## 工具风险等级参考
- search, query, read: low
- action (add_tag, move, classify): medium
- delete, batch_delete: high
`;

/**
 * 低置信度澄清 Prompt
 */
export const CLARIFICATION_PROMPT = `用户的请求不够明确，需要进一步澄清。

用户原始请求：{{userMessage}}
检测到的意图：{{intent}}
置信度：{{confidence}}

请生成 1-3 个选项式问题帮助澄清用户需求。输出 JSON 格式：
{
  "clarificationNeeded": true,
  "questions": [
    {
      "question": "您想要...",
      "options": ["选项A", "选项B", "选项C"]
    }
  ]
}
`;
