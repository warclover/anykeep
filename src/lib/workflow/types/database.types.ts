/**
 * 工作流系统数据库类型定义
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type {
  WorkflowDefinition,
  StepResult,
  ExecutionStatus,
  TriggerType,
} from "./workflow.types";

/**
 * 工作流类别
 */
export type WorkflowCategory = "builtin" | "user_defined";

/**
 * 工作流数据库行
 */
export interface WorkflowRow {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  definition: WorkflowDefinition;
  category: WorkflowCategory;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 工作流执行记录数据库行
 */
export interface WorkflowExecutionRow {
  id: string;
  workflow_id: string;
  user_id: string;
  status: ExecutionStatus;
  trigger_type: TriggerType;
  trigger_context: Record<string, unknown>;
  current_step_index: number;
  step_results: StepResult[];
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

/**
 * 带工作流定义的执行记录
 */
export interface WorkflowExecutionWithWorkflow extends WorkflowExecutionRow {
  workflows: {
    definition: WorkflowDefinition;
    name: string;
  } | null;
}
