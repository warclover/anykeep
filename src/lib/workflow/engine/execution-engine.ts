/**
 * 工作流执行引擎
 *
 * Phase 1: 支持 skill, aggregate, notification 步骤的顺序执行
 *
 * @version 1.1.0
 * @since 2026-01-08
 * @updated 2026-01-09 - 添加 aggregate 和 notification 步骤支持
 * @updated 2026-01-09 - 实现 executeAggregateStep 和 executeNotificationStep 方法
 * @updated 2026-01-09 - 添加工作流级别超时保护（Promise.race 模式）
 */

import { getUnifiedEngine } from "@/lib/ai-skills/register";
import { logger } from "@/lib/logger";
import { getStateManager } from "../state/state-manager";
import { notifyWorkflowCompletion } from "../integration/workflow-notifier";
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
  AggregateStepConfig,
  NotificationStepConfig,
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

    // 工作流级别超时保护
    const timeoutMs = workflow.config?.timeout || 300000; // 默认 5 分钟
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      // 设置超时定时器
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort();
          reject(new Error(`Workflow execution timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // 更新状态为运行中
      await this.stateManager.updateStatus(executionId, "running");

      logger.info(
        {
          executionId,
          workflowId: workflow.id,
          stepCount: workflow.steps.length,
          timeoutMs,
        },
        "ExecutionEngine: Starting workflow execution",
      );

      // 执行工作流主逻辑（带超时保护）
      await Promise.race([
        this.executeWorkflowSteps(
          workflow,
          context,
          abortController,
          userId,
          executionId,
        ),
        timeoutPromise,
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // 区分超时错误和其他错误
      const isTimeout = errorMessage.includes("timeout");
      const status = isTimeout ? "failed" : "failed";
      const reason = isTimeout
        ? `工作流执行超时 (${timeoutMs}ms)`
        : errorMessage;

      await this.stateManager.updateStatus(executionId, status, reason);

      // 发送失败通知
      await this.sendNotification(
        userId,
        workflow,
        executionId,
        "failed",
        isTimeout ? "工作流执行超时" : "工作流执行失败",
        reason,
      );

      logger.error(
        { executionId, error: errorMessage, isTimeout },
        "ExecutionEngine: Workflow execution failed",
      );
    } finally {
      // 清理超时定时器
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * 执行工作流步骤（内部方法，从 execute 中拆分）
   */
  private async executeWorkflowSteps(
    workflow: WorkflowDefinition,
    context: WorkflowContext,
    abortController: AbortController,
    userId: string,
    executionId: string,
  ): Promise<void> {
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

          // 发送失败通知
          await this.sendNotification(
            userId,
            workflow,
            executionId,
            "failed",
            `步骤「${step.name}」执行失败`,
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

    // 发送完成通知
    await this.sendNotification(
      userId,
      workflow,
      executionId,
      "completed",
      this.generateCompletionSummary(workflow, context),
    );

    logger.info(
      { executionId },
      "ExecutionEngine: Workflow completed successfully",
    );
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

        case "aggregate":
          output = await this.executeAggregateStep(step, context);
          break;

        case "notification":
          output = await this.executeNotificationStep(step, context);
          break;

        default:
          // 其他类型步骤暂时跳过
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
   * 执行 Aggregate 步骤
   *
   * 聚合之前步骤的结果，支持三种模式：
   * - collect: 收集所有结果到数组
   * - merge: 合并所有结果对象
   * - report: 使用模板生成报告
   */
  private async executeAggregateStep(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<unknown> {
    const config = step.config as unknown as AggregateStepConfig;
    const mode = config.mode || "collect";

    // 确定要聚合的步骤
    let sourceStepIds = config.sourceSteps;
    if (!sourceStepIds || sourceStepIds.length === 0) {
      // 默认聚合所有已完成步骤
      sourceStepIds = Object.keys(context.stepResults).filter(
        (id) => context.stepResults[id]?.status === "completed",
      );
    }

    logger.info(
      { stepId: step.id, mode, sourceStepIds },
      "ExecutionEngine: Executing aggregate step",
    );

    // 收集源步骤结果
    const sourceResults: Array<{ stepId: string; output: unknown }> = [];
    for (const stepId of sourceStepIds) {
      const result = context.stepResults[stepId];
      if (result && result.status === "completed" && result.output) {
        sourceResults.push({ stepId, output: result.output });
      }
    }

    switch (mode) {
      case "collect":
        // 收集模式：返回结果数组
        return {
          mode: "collect",
          count: sourceResults.length,
          results: sourceResults,
        };

      case "merge":
        // 合并模式：将所有对象结果合并为一个对象
        const merged: Record<string, unknown> = {};
        for (const { stepId, output } of sourceResults) {
          if (output && typeof output === "object" && !Array.isArray(output)) {
            Object.assign(merged, output);
          } else {
            merged[stepId] = output;
          }
        }
        return {
          mode: "merge",
          count: sourceResults.length,
          merged,
        };

      case "report":
        // 报告模式：使用模板生成报告
        let report = config.template || "## 工作流执行报告\n\n";

        // 简单的模板变量替换
        report = report.replace(
          /\{\{stepCount\}\}/g,
          String(sourceResults.length),
        );
        report = report.replace(
          /\{\{stepList\}\}/g,
          sourceResults.map((r) => `- ${r.stepId}`).join("\n"),
        );

        // 替换变量引用
        for (const [key, value] of Object.entries(context.variables)) {
          const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
          report = report.replace(placeholder, String(value ?? ""));
        }

        return {
          mode: "report",
          count: sourceResults.length,
          report,
          results: sourceResults,
        };

      default:
        return {
          mode: "collect",
          count: sourceResults.length,
          results: sourceResults,
        };
    }
  }

  /**
   * 执行 Notification 步骤
   *
   * 发送应用内/邮件/推送通知
   */
  private async executeNotificationStep(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<unknown> {
    const config = step.config as unknown as NotificationStepConfig;

    // 解析模板变量
    let body = config.bodyTemplate;
    for (const [key, value] of Object.entries(context.variables)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      body = body.replace(placeholder, String(value ?? ""));
    }

    // 替换步骤结果变量 {{steps.stepId.output.field}}
    const stepPlaceholderRegex = /\{\{steps\.([^.}]+)\.output\.([^}]+)\}\}/g;
    body = body.replace(stepPlaceholderRegex, (_, stepId, field) => {
      const stepResult = context.stepResults[stepId];
      if (stepResult?.output && typeof stepResult.output === "object") {
        const value = getNestedValue(stepResult.output, field);
        return String(value ?? "");
      }
      return "";
    });

    logger.info(
      {
        stepId: step.id,
        notificationType: config.notificationType,
        title: config.title,
        priority: config.priority,
      },
      "ExecutionEngine: Executing notification step",
    );

    // 根据通知类型发送通知
    switch (config.notificationType) {
      case "in_app":
        // 使用现有的通知机制
        await notifyWorkflowCompletion({
          userId: context.userId,
          workflowId: context.workflowId,
          workflowName: config.title,
          executionId: context.executionId,
          status: "completed",
          summary: body,
        });
        break;

      case "email":
        // Phase 1: 邮件通知暂时记录日志
        logger.info(
          { stepId: step.id, title: config.title, body },
          "ExecutionEngine: Email notification (not implemented yet)",
        );
        break;

      case "push":
        // Phase 1: 推送通知暂时记录日志
        logger.info(
          { stepId: step.id, title: config.title, body },
          "ExecutionEngine: Push notification (not implemented yet)",
        );
        break;
    }

    return {
      notificationType: config.notificationType,
      title: config.title,
      body,
      priority: config.priority || "normal",
      sentAt: new Date().toISOString(),
    };
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

  /**
   * 发送工作流通知
   */
  private async sendNotification(
    userId: string,
    workflow: WorkflowDefinition,
    executionId: string,
    status: "completed" | "failed",
    summary: string,
    error?: string,
  ): Promise<void> {
    try {
      await notifyWorkflowCompletion({
        userId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        executionId,
        status,
        summary,
        error,
      });
    } catch (notifyError) {
      // 通知失败不影响主流程
      logger.warn(
        { executionId, error: notifyError },
        "ExecutionEngine: Failed to send notification",
      );
    }
  }

  /**
   * 生成完成摘要
   */
  private generateCompletionSummary(
    workflow: WorkflowDefinition,
    context: WorkflowContext,
  ): string {
    const completedSteps = Object.values(context.stepResults).filter(
      (r) => r.status === "completed",
    ).length;
    const totalSteps = workflow.steps.length;

    return `已完成 ${completedSteps}/${totalSteps} 个步骤`;
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
