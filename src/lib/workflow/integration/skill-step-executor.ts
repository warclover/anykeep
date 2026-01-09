/**
 * Skill 步骤执行器
 *
 * 复用 OrchestrationEngine 执行 Skill 步骤
 * 使用 StreamResultCollector 适配 AsyncGenerator 返回值
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { createOrchestrationEngine } from "@/lib/ai-skills/engine/orchestration-engine";
import { collectStreamResult } from "../utils/stream-result-collector";
import { logger } from "@/lib/logger";
import type { WorkflowStep, WorkflowContext, StepResult } from "../types";
import type { IntegrationSkillStepConfig, SkillExecuteResult } from "./types";

/**
 * Skill 步骤执行器
 *
 * 复用 OrchestrationEngine 执行 Skill 步骤
 * 使用 StreamResultCollector 适配 AsyncGenerator 返回值
 */
export class SkillStepExecutor {
  private engine = createOrchestrationEngine();

  /**
   * 执行 Skill 步骤
   *
   * @param step - 工作流步骤
   * @param context - 工作流执行上下文
   * @returns 步骤执行结果
   */
  async execute(
    step: WorkflowStep,
    context: WorkflowContext,
  ): Promise<StepResult> {
    const startTime = performance.now();
    const config = step.config as IntegrationSkillStepConfig;

    try {
      // 1. 解析输入参数
      const resolvedInput = this.resolveInput(config.inputMapping, context);

      logger.debug(
        {
          stepId: step.id,
          skillId: config.skillId,
          input: resolvedInput,
        },
        "SkillStepExecutor: Executing skill step",
      );

      // 2. 通过 OrchestrationEngine 执行 Skill（使用 StreamResultCollector）
      const skillResult = await this.executeSkillWithCollector(
        config.skillId,
        resolvedInput,
        context,
      );

      // 3. 处理输出映射
      const outputVariables = config.outputMapping
        ? this.mapOutput(skillResult.data, config.outputMapping)
        : {};

      const duration = Math.round(performance.now() - startTime);

      logger.info(
        {
          stepId: step.id,
          skillId: config.skillId,
          success: skillResult.success,
          durationMs: duration,
        },
        "SkillStepExecutor: Skill step completed",
      );

      return {
        stepId: step.id,
        stepName: step.name,
        status: skillResult.success ? "completed" : "failed",
        output: {
          ...(skillResult.data && typeof skillResult.data === "object"
            ? (skillResult.data as Record<string, unknown>)
            : {}),
          ...outputVariables,
        },
        error: skillResult.error,
        duration,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error(
        {
          stepId: step.id,
          skillId: config.skillId,
          error: errorMessage,
          durationMs: duration,
        },
        "SkillStepExecutor: Skill step failed",
      );

      return {
        stepId: step.id,
        stepName: step.name,
        status: "failed",
        error: errorMessage,
        duration,
        completedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * 执行 Skill 并收集结果
   *
   * 关键修复：使用 StreamResultCollector 适配 AsyncGenerator
   */
  private async executeSkillWithCollector(
    skillId: string,
    input: Record<string, unknown>,
    context: WorkflowContext,
  ): Promise<SkillExecuteResult> {
    try {
      // 构造 Skill 执行上下文
      const skillContext = {
        userId: context.userId,
        conversationId: context.executionId,
      };

      // 将输入转换为消息格式
      const message = this.formatSkillMessage(skillId, input);

      // 调用 OrchestrationEngine（返回 AsyncGenerator）
      const stream = this.engine.execute(skillId, message, skillContext);

      // 使用 StreamResultCollector 收集流式结果
      const collectedResult = await collectStreamResult(stream, {
        timeout: 60000, // 60 秒超时
        signal: context.abortSignal,
        onProgress: (chunk) => {
          // 可选：进度回调
          if (chunk.type === "progress") {
            logger.debug({ skillId, progress: chunk.data }, "Skill progress");
          }
        },
      });

      return {
        success:
          collectedResult.status === "completed" && !collectedResult.error,
        data:
          collectedResult.deliverables.length > 0
            ? collectedResult.deliverables[0].content
            : collectedResult.text || undefined,
        error: collectedResult.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 格式化 Skill 消息
   */
  private formatSkillMessage(
    skillId: string,
    input: Record<string, unknown>,
  ): string {
    // 将输入参数格式化为自然语言消息
    const inputStr = Object.entries(input)
      .map(([key, value]) => {
        if (typeof value === "object") {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${value}`;
      })
      .join(", ");

    return inputStr || `执行 ${skillId}`;
  }

  /**
   * 解析输入参数
   */
  private resolveInput(
    mapping: Record<string, string | unknown>,
    context: WorkflowContext,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(mapping)) {
      if (typeof value === "string" && value.startsWith("$")) {
        // 变量引用，从上下文解析
        const varPath = value.slice(1); // 移除 $ 前缀
        // 将 WorkflowContext 转换为 Record 以支持嵌套查找
        const contextRecord: Record<string, unknown> = {
          userId: context.userId,
          workflowId: context.workflowId,
          executionId: context.executionId,
          variables: context.variables,
          stepResults: context.stepResults,
        };
        resolved[key] = this.getNestedValue(contextRecord, varPath);
      } else {
        // 直接值
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * 从嵌套对象获取值
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * 输出映射
   */
  private mapOutput(
    data: unknown,
    mapping: Record<string, string>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (!data || typeof data !== "object") {
      return result;
    }

    const dataObj = data as Record<string, unknown>;

    for (const [targetKey, sourcePath] of Object.entries(mapping)) {
      result[targetKey] = this.getNestedValue(dataObj, sourcePath);
    }

    return result;
  }
}

// 单例导出
let executorInstance: SkillStepExecutor | null = null;

export function getSkillStepExecutor(): SkillStepExecutor {
  if (!executorInstance) {
    executorInstance = new SkillStepExecutor();
  }
  return executorInstance;
}
