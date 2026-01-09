/**
 * 工作流状态管理器
 *
 * 负责执行状态的持久化和查询
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  WorkflowDefinition,
  WorkflowExecution,
  ExecutionStatus,
  StepResult,
  TriggerType,
  ListExecutionsOptions,
} from "../types";

/**
 * 工作流状态管理器
 */
export class StateManager {
  /**
   * 创建执行记录
   */
  async createExecution(
    workflow: WorkflowDefinition,
    userId: string,
    triggerType: TriggerType = "manual",
    triggerContext: Record<string, unknown> = {},
  ): Promise<WorkflowExecution> {
    const supabase = await createClient();

    // 首先获取工作流的数据库 ID
    const { data: workflowData, error: workflowError } = await supabase
      .from("workflows")
      .select("id")
      .eq("definition->>id", workflow.id)
      .single();

    if (workflowError || !workflowData) {
      logger.error(
        { error: workflowError, workflowId: workflow.id },
        "StateManager: Workflow not found in database",
      );
      throw new Error(`Workflow not found in database: ${workflow.id}`);
    }

    const { data, error } = await supabase
      .from("workflow_executions")
      .insert({
        workflow_id: workflowData.id,
        user_id: userId,
        status: "pending",
        trigger_type: triggerType,
        trigger_context: triggerContext as unknown as Record<string, never>,
        current_step_index: 0,
        step_results: [] as unknown as Record<string, never>[],
      })
      .select()
      .single();

    if (error || !data) {
      logger.error(
        { error, workflowId: workflow.id },
        "StateManager: Failed to create execution",
      );
      throw new Error(`Failed to create execution: ${error?.message}`);
    }

    logger.info(
      { executionId: data.id, workflowId: workflow.id, userId },
      "StateManager: Execution created",
    );

    return this.mapToExecution(data, workflow);
  }

  /**
   * 获取执行记录
   */
  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workflow_executions")
      .select("*, workflows(*)")
      .eq("id", executionId)
      .single();

    if (error || !data) {
      if (error?.code === "PGRST116") {
        return null; // Not found
      }
      logger.error(
        { error, executionId },
        "StateManager: Failed to get execution",
      );
      throw new Error(`Failed to get execution: ${error?.message}`);
    }

    const workflow = data.workflows?.definition as unknown as
      | WorkflowDefinition
      | undefined;
    return this.mapToExecution(data, workflow);
  }

  /**
   * 更新执行状态
   */
  async updateStatus(
    executionId: string,
    status: ExecutionStatus,
    errorMessage?: string,
  ): Promise<void> {
    const supabase = await createClient();

    const updates: Record<string, unknown> = { status };

    if (
      status === "completed" ||
      status === "failed" ||
      status === "cancelled"
    ) {
      updates.completed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    const { error } = await supabase
      .from("workflow_executions")
      .update(updates)
      .eq("id", executionId);

    if (error) {
      logger.error(
        { error, executionId, status },
        "StateManager: Failed to update status",
      );
      throw new Error(`Failed to update status: ${error.message}`);
    }

    logger.info({ executionId, status }, "StateManager: Status updated");
  }

  /**
   * 更新当前步骤索引
   */
  async updateCurrentStep(
    executionId: string,
    stepIndex: number,
  ): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from("workflow_executions")
      .update({ current_step_index: stepIndex })
      .eq("id", executionId);

    if (error) {
      logger.error(
        { error, executionId, stepIndex },
        "StateManager: Failed to update step index",
      );
    }
  }

  /**
   * 记录步骤结果
   */
  async recordStepResult(
    executionId: string,
    stepResult: StepResult,
  ): Promise<void> {
    const supabase = await createClient();

    // 获取当前步骤结果
    const { data } = await supabase
      .from("workflow_executions")
      .select("step_results")
      .eq("id", executionId)
      .single();

    const stepResults = (data?.step_results || []) as unknown as StepResult[];

    // 查找是否已存在该步骤的结果（更新）或新增
    const existingIndex = stepResults.findIndex(
      (r) => r.stepId === stepResult.stepId,
    );
    if (existingIndex >= 0) {
      stepResults[existingIndex] = stepResult;
    } else {
      stepResults.push(stepResult);
    }

    const { error } = await supabase
      .from("workflow_executions")
      .update({
        step_results: stepResults as unknown as Record<string, never>[],
      })
      .eq("id", executionId);

    if (error) {
      logger.error(
        { error, executionId, stepId: stepResult.stepId },
        "StateManager: Failed to record step result",
      );
    }
  }

  /**
   * 获取用户的执行历史
   */
  async listExecutions(
    userId: string,
    options: ListExecutionsOptions = {},
  ): Promise<WorkflowExecution[]> {
    const supabase = await createClient();
    const { workflowId, limit = 20, status } = options;

    let query = supabase
      .from("workflow_executions")
      .select("*, workflows(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (workflowId) {
      query = query.eq("workflow_id", workflowId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        { error, userId },
        "StateManager: Failed to list executions",
      );
      return [];
    }

    return (data || []).map((row) => {
      const workflow = row.workflows?.definition as unknown as
        | WorkflowDefinition
        | undefined;
      return this.mapToExecution(row, workflow);
    });
  }

  /**
   * 映射数据库行到执行对象
   */
  private mapToExecution(
    row: Record<string, unknown>,
    workflow?: WorkflowDefinition,
  ): WorkflowExecution {
    const stepResults = (row.step_results as StepResult[]) || [];
    const totalSteps = workflow?.steps?.length || 0;
    const completedSteps = stepResults.filter(
      (r) => r.status === "completed" || r.status === "skipped",
    ).length;

    // 获取工作流名称
    let workflowName = "Unknown";
    if (workflow?.name) {
      workflowName = workflow.name;
    } else if (row.workflows && typeof row.workflows === "object") {
      const workflows = row.workflows as { name?: string };
      if (workflows.name) {
        workflowName = workflows.name;
      }
    }

    return {
      id: row.id as string,
      workflowId: row.workflow_id as string,
      workflowName,
      userId: row.user_id as string,
      status: row.status as ExecutionStatus,
      triggerType: row.trigger_type as TriggerType,
      triggerContext: (row.trigger_context as Record<string, unknown>) || {},
      currentStepIndex: row.current_step_index as number,
      steps: stepResults,
      totalSteps,
      progress:
        totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      errorMessage: row.error_message as string | undefined,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | undefined,
    };
  }
}

// 单例
let stateManagerInstance: StateManager | null = null;

/**
 * 获取 StateManager 单例
 */
export function getStateManager(): StateManager {
  if (!stateManagerInstance) {
    stateManagerInstance = new StateManager();
  }
  return stateManagerInstance;
}
