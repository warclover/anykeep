/**
 * 工作流模式执行器
 *
 * 在 UnifiedEngine 中处理工作流模式的执行
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { getWorkflowOrchestrator } from "../orchestrator";
import { getWorkflowIntentMatcher } from "./workflow-intent-matcher";
import { logger } from "@/lib/logger";
import type { WorkflowMatch, WorkflowExecuteResult } from "./types";

/**
 * 执行上下文（简化版）
 */
export interface WorkflowExecutionContext {
  userId: string;
  conversationId?: string;
}

/**
 * 工作流模式执行器
 *
 * 在 UnifiedEngine 中处理工作流模式的执行
 */
export class WorkflowModeExecutor {
  private intentMatcher = getWorkflowIntentMatcher();
  private orchestrator = getWorkflowOrchestrator();

  /**
   * 检测并执行工作流
   *
   * @param message - 用户消息
   * @param context - 执行上下文
   * @returns 工作流执行结果，如果不匹配返回 null
   */
  async tryExecuteWorkflow(
    message: string,
    context: WorkflowExecutionContext,
  ): Promise<WorkflowExecuteResult | null> {
    // 1. 匹配工作流
    const match = await this.intentMatcher.matchWorkflow(
      message,
      context.userId,
    );

    if (!match || match.confidence < 0.7) {
      return null;
    }

    // 2. 启动工作流
    return this.executeWorkflow(match, context);
  }

  /**
   * 执行匹配的工作流
   */
  async executeWorkflow(
    match: WorkflowMatch,
    context: WorkflowExecutionContext,
  ): Promise<WorkflowExecuteResult> {
    const startTime = performance.now();

    try {
      // 启动工作流
      const execution = await this.orchestrator.startWorkflow(
        match.workflowId,
        context.userId,
        "conversation",
        {
          conversationId: context.conversationId,
          matchedPattern: match.matchedPattern,
          extractedParams: match.extractedParams,
        },
      );

      logger.info(
        {
          workflowId: match.workflowId,
          executionId: execution.id,
          userId: context.userId,
          durationMs: Math.round(performance.now() - startTime),
        },
        "WorkflowModeExecutor: Workflow started",
      );

      return {
        type: "workflow",
        workflowId: match.workflowId,
        workflowName: match.workflowName,
        executionId: execution.id,
        status: "started",
        message: this.generateStartMessage(match.workflowName),
      };
    } catch (error) {
      logger.error(
        { error, workflowId: match.workflowId, userId: context.userId },
        "WorkflowModeExecutor: Workflow start failed",
      );

      return {
        type: "workflow",
        workflowId: match.workflowId,
        workflowName: match.workflowName,
        executionId: "",
        status: "failed",
        message: `启动「${match.workflowName}」工作流失败，请稍后重试`,
      };
    }
  }

  /**
   * 生成启动消息
   */
  private generateStartMessage(workflowName: string): string {
    const templates = [
      `好的，正在为您执行「${workflowName}」...`,
      `已启动「${workflowName}」工作流，请稍候...`,
      `「${workflowName}」正在运行中...`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }
}

// 单例导出
let executorInstance: WorkflowModeExecutor | null = null;

export function getWorkflowModeExecutor(): WorkflowModeExecutor {
  if (!executorInstance) {
    executorInstance = new WorkflowModeExecutor();
  }
  return executorInstance;
}
