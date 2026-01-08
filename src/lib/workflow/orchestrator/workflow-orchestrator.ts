/**
 * 工作流编排器
 *
 * 统一入口，协调执行引擎和状态管理
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { getStateManager } from "../state/state-manager";
import { getExecutionEngine } from "../engine/execution-engine";
import type {
  WorkflowDefinition,
  WorkflowExecution,
  StartWorkflowOptions,
  ListExecutionsOptions,
} from "../types";

/**
 * 工作流编排器
 */
export class WorkflowOrchestrator {
  private stateManager = getStateManager();
  private executionEngine = getExecutionEngine();

  /**
   * 启动工作流
   */
  async startWorkflow(
    workflowId: string,
    userId: string,
    options: StartWorkflowOptions = {},
  ): Promise<WorkflowExecution> {
    const { triggerType = "manual", triggerContext = {} } = options;

    // 1. 加载工作流定义
    const workflow = await this.getWorkflowDefinition(workflowId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // 2. 创建执行记录
    const execution = await this.stateManager.createExecution(
      workflow,
      userId,
      triggerType,
      triggerContext,
    );

    logger.info(
      { executionId: execution.id, workflowId, userId, triggerType },
      "WorkflowOrchestrator: Workflow started",
    );

    // 3. 异步执行（不阻塞返回）
    this.executeAsync(execution.id, workflow, userId, triggerContext).catch(
      (error) => {
        logger.error(
          { executionId: execution.id, error: error.message },
          "WorkflowOrchestrator: Async execution failed",
        );
      },
    );

    return execution;
  }

  /**
   * 获取执行状态
   */
  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    return this.stateManager.getExecution(executionId);
  }

  /**
   * 取消工作流
   */
  async cancelWorkflow(executionId: string): Promise<boolean> {
    const cancelled = this.executionEngine.cancel(executionId);

    if (cancelled) {
      await this.stateManager.updateStatus(executionId, "cancelled");
      logger.info({ executionId }, "WorkflowOrchestrator: Workflow cancelled");
    }

    return cancelled;
  }

  /**
   * 列出用户的执行历史
   */
  async listExecutions(
    userId: string,
    options?: ListExecutionsOptions,
  ): Promise<WorkflowExecution[]> {
    return this.stateManager.listExecutions(userId, options);
  }

  /**
   * 获取可用的工作流列表
   */
  async listWorkflows(userId: string): Promise<WorkflowDefinition[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workflows")
      .select("*")
      .or(`category.eq.builtin,user_id.eq.${userId}`)
      .eq("enabled", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      logger.error(
        { error, userId },
        "WorkflowOrchestrator: Failed to list workflows",
      );
      return [];
    }

    return (data || []).map(
      (row) => row.definition as unknown as WorkflowDefinition,
    );
  }

  /**
   * 异步执行工作流
   */
  private async executeAsync(
    executionId: string,
    workflow: WorkflowDefinition,
    userId: string,
    triggerContext: Record<string, unknown>,
  ): Promise<void> {
    await this.executionEngine.execute(
      executionId,
      workflow,
      userId,
      triggerContext,
    );
  }

  /**
   * 获取工作流定义
   */
  private async getWorkflowDefinition(
    workflowId: string,
  ): Promise<WorkflowDefinition | null> {
    const supabase = await createClient();

    // 首先尝试通过 UUID 查找
    const { data, error } = await supabase
      .from("workflows")
      .select("definition")
      .eq("id", workflowId)
      .single();

    if (!error && data) {
      return data.definition as unknown as WorkflowDefinition;
    }

    // 尝试通过 definition.id 查找（内置工作流）
    const { data: builtinData } = await supabase
      .from("workflows")
      .select("definition")
      .eq("definition->>id", workflowId)
      .single();

    if (builtinData) {
      return builtinData.definition as unknown as WorkflowDefinition;
    }

    return null;
  }
}

// 单例
let orchestratorInstance: WorkflowOrchestrator | null = null;

/**
 * 获取 WorkflowOrchestrator 单例
 */
export function getWorkflowOrchestrator(): WorkflowOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new WorkflowOrchestrator();
  }
  return orchestratorInstance;
}
