/**
 * 工作流执行引擎
 *
 * Phase 1: 仅支持 skill 步骤的顺序执行
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { getUnifiedEngine } from "@/lib/ai-skills/register";
import { logger } from "@/lib/logger";
import { getStateManager } from "../state/state-manager";
import {
  collectStreamResult,
  extractPrimaryDeliverable,
} from "../utils/stream-result-collector";
import { getNestedValue } from "../utils/object-utils";
import { resolveInputMapping } from "../utils/input-mapper";
import type {
  WorkflowDefinition,
  WorkflowStep,
  StepResult,
  WorkflowContext,
  SkillStepConfig,
} from "../types";

/**
 * 工作流执行引擎
 */
export class ExecutionEngine {
  private activeExecutions = new Map<string, AbortController>();
  private stateManager = getStateManager();

  /**
   * 执行工作流
   */
  async execute(
    executionId: string,
    workflow: WorkflowDefinition,
    userId: string,
    triggerContext: Record<string, unknown> = {},
  ): Promise<void> {
    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);

    const context: WorkflowContext = {
      userId,
      workflowId: workflow.id,
      executionId,
      variables: { ...triggerContext, trigger: triggerContext },
      stepResults: {},
      abortSignal: abortController.signal,
    };

    try {
      // 更新状态为运行中
      await this.stateManager.updateStatus(executionId, "running");

      logger.info(
        {
          executionId,
          workflowId: workflow.id,
          stepCount: workflow.steps.length,
        },
        "ExecutionEngine: Starting workflow execution",
      );

      // 顺序执行每个步骤
      for (let i = 0; i < workflow.steps.length; i++) {
        // 检查取消信号
        if (abortController.signal.aborted) {
          logger.info({ executionId }, "ExecutionEngine: Execution cancelled");
          await this.stateManager.updateStatus(executionId, "cancelled");
          return;
        }

        const step = workflow.steps[i];
        await this.stateManager.updateCurrentStep(executionId, i);

        // 执行步骤
        const result = await this.executeStep(step, context);

        // 记录结果
        await this.stateManager.recordStepResult(executionId, result);
        context.stepResults[step.id] = result;

        // 更新变量
        if (result.output && typeof result.output === "object") {
          Object.assign(context.variables, result.output);
        }

        // 检查是否失败
        if (result.status === "failed") {
          const errorHandling = step.onError || "stop";

          if (errorHandling === "stop") {
            await this.stateManager.updateStatus(
              executionId,
              "failed",
              result.error,
            );
            logger.error(
              { executionId, stepId: step.id, error: result.error },
              "ExecutionEngine: Step failed, stopping workflow",
            );
            return;
          }

          // skip 或 continue: 记录错误但继续
          logger.warn(
            {
              executionId,
              stepId: step.id,
              error: result.error,
              handling: errorHandling,
            },
            "ExecutionEngine: Step failed, continuing",
          );
        }
      }

      // 全部完成
      await this.stateManager.updateStatus(executionId, "completed");
      logger.info(
        { executionId },
        "ExecutionEngine: Workflow completed successfully",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.stateManager.updateStatus(executionId, "failed", errorMessage);
      logger.error(
        { executionId, error: errorMessage },
        "ExecutionEngine: Workflow execution failed",
      );
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<StepResult> {
    const startTime = performance.now();
    const startedAt = new Date().toISOString();

    // 先记录开始状态
    const pendingResult: StepResult = {
      stepId: step.id,
      stepName: step.name,
      status: "running",
      startedAt,
    };
    await this.stateManager.recordStepResult(
      context.executionId,
      pendingResult,
    );

    try {
      let output: unknown;

      switch (step.type) {
        case "skill":
          output = await this.executeSkillStep(step, context);
          break;

        case "tool":
          // Phase 1: Tool 步骤暂时跳过
          logger.warn(
            { stepId: step.id },
            "ExecutionEngine: Tool step not implemented, skipping",
          );
          return {
            stepId: step.id,
            stepName: step.name,
            status: "skipped",
            duration: Math.round(performance.now() - startTime),
            startedAt,
            completedAt: new Date().toISOString(),
          };

        default:
          // Phase 1: 其他类型步骤暂时跳过
          logger.warn(
            { stepId: step.id, type: step.type },
            "ExecutionEngine: Step type not implemented, skipping",
          );
          return {
            stepId: step.id,
            stepName: step.name,
            status: "skipped",
            duration: Math.round(performance.now() - startTime),
            startedAt,
            completedAt: new Date().toISOString(),
          };
      }

      const duration = Math.round(performance.now() - startTime);

      logger.info(
        { stepId: step.id, stepName: step.name, duration },
        "ExecutionEngine: Step completed",
      );

      return {
        stepId: step.id,
        stepName: step.name,
        status: "completed",
        output,
        duration,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const duration = Math.round(performance.now() - startTime);

      logger.error(
        { stepId: step.id, stepName: step.name, error: errorMessage },
        "ExecutionEngine: Step failed",
      );

      return {
        stepId: step.id,
        stepName: step.name,
        status: "failed",
        error: errorMessage,
        duration,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * 执行 Skill 步骤
   */
  private async executeSkillStep(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<unknown> {
    const config = step.config as SkillStepConfig;
    const engine = getUnifiedEngine();

    // 解析输入参数（使用提取的工具函数）
    const input = resolveInputMapping(config.inputMapping, context);

    logger.info(
      { stepId: step.id, skillId: config.skillId, input },
      "ExecutionEngine: Executing skill step",
    );

    // 构建消息
    const message =
      typeof input === "string"
        ? input
        : JSON.stringify({
            skillId: config.skillId,
            params: input,
          });

    // 调用 UnifiedEngine（强制使用编排模式）
    const stream = engine.execute(
      message,
      { userId: context.userId, conversationId: context.executionId },
      { forceMode: "orchestration", forceSkill: config.skillId },
    );

    // 收集流式结果
    const collectedResult = await collectStreamResult(stream, {
      timeout: 120000, // 2 分钟超时
      signal: context.abortSignal,
    });

    if (collectedResult.status === "failed") {
      throw new Error(collectedResult.error || "Skill execution failed");
    }

    // 提取主要交付物或文本
    const primaryDeliverable = extractPrimaryDeliverable(collectedResult);

    // 处理输出映射
    if (config.outputMapping && primaryDeliverable) {
      return this.applyOutputMapping(primaryDeliverable, config.outputMapping);
    }

    return primaryDeliverable || { text: collectedResult.text };
  }

  /**
   * 应用输出映射
   */
  private applyOutputMapping(
    result: unknown,
    mapping: Record<string, string>,
  ): Record<string, unknown> {
    const output: Record<string, unknown> = {};

    if (result && typeof result === "object") {
      for (const [resultKey, varName] of Object.entries(mapping)) {
        output[varName] = getNestedValue(result, resultKey);
      }
    }

    return output;
  }

  /**
   * 取消执行
   */
  cancel(executionId: string): boolean {
    const controller = this.activeExecutions.get(executionId);
    if (controller) {
      controller.abort();
      logger.info({ executionId }, "ExecutionEngine: Cancellation requested");
      return true;
    }
    return false;
  }

  /**
   * 检查是否正在执行
   */
  isRunning(executionId: string): boolean {
    return this.activeExecutions.has(executionId);
  }
}

// 单例
let engineInstance: ExecutionEngine | null = null;

/**
 * 获取 ExecutionEngine 单例
 */
export function getExecutionEngine(): ExecutionEngine {
  if (!engineInstance) {
    engineInstance = new ExecutionEngine();
  }
  return engineInstance;
}
