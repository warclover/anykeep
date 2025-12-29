/**
 * Plan Executor
 *
 * 按计划执行工具调用
 * 支持变量解析、错误处理、重试机制
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type {
  ExecutionPlan,
  PlanStep,
  ExecutionEvent,
  StepResult,
  ExecutorConfig,
} from "./types";
import { DEFAULT_EXECUTOR_CONFIG } from "./types";
import { toolRegistry } from "../tools/tool-registry";
import { toolRequiresConfirmation, type ToolContext } from "../tools/types";
import { logger } from "@/lib/logger";

// ============================================
// PlanExecutor Class
// ============================================

/**
 * 计划执行器
 *
 * @example
 * ```typescript
 * const executor = new PlanExecutor(context);
 *
 * for await (const event of executor.execute(plan)) {
 *   switch (event.type) {
 *     case "step_start":
 *       console.log(`Executing step ${event.stepIndex + 1}/${event.totalSteps}`);
 *       break;
 *     case "step_complete":
 *       console.log(`Step ${event.step.id} completed`);
 *       break;
 *     case "plan_complete":
 *       console.log(`Plan completed in ${event.totalExecutionTimeMs}ms`);
 *       break;
 *     case "confirmation_required":
 *       // 等待用户确认
 *       break;
 *   }
 * }
 * ```
 */
export class PlanExecutor {
  private context: ToolContext;
  private config: ExecutorConfig;
  private variables = new Map<string, unknown>();
  private results: StepResult[] = [];

  constructor(context: ToolContext, config: Partial<ExecutorConfig> = {}) {
    this.context = context;
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
  }

  /**
   * 执行计划
   *
   * @param plan - 执行计划
   * @yields 执行事件流
   */
  async *execute(plan: ExecutionPlan): AsyncGenerator<ExecutionEvent> {
    const startTime = performance.now();

    logger.info(
      {
        planId: plan.id,
        intent: plan.intent,
        stepCount: plan.steps.length,
        riskLevel: plan.riskLevel,
      },
      "PlanExecutor: Starting plan execution",
    );

    // 发送计划开始事件
    yield {
      type: "plan_start",
      plan,
      timestamp: new Date(),
    };

    // 逐步执行
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      // 检查条件
      if (step.condition && !this.evaluateCondition(step.condition)) {
        yield {
          type: "step_skipped",
          step,
          reason: `Condition not met: ${step.condition}`,
          timestamp: new Date(),
        };
        continue;
      }

      // 发送步骤开始事件
      yield {
        type: "step_start",
        step,
        stepIndex: i,
        totalSteps: plan.steps.length,
        timestamp: new Date(),
      };

      // 检查是否需要确认
      const tool = toolRegistry.get(step.tool);
      if (
        tool &&
        toolRequiresConfirmation(tool.definition) &&
        !this.context.confirmed
      ) {
        const confirmationId = crypto.randomUUID();

        yield {
          type: "confirmation_required",
          step,
          confirmationId,
          description: this.generateConfirmationDescription(step),
          timestamp: new Date(),
        };

        // 中止执行，等待确认
        yield {
          type: "plan_abort",
          reason: `Waiting for confirmation (${confirmationId})`,
          completedSteps: i,
          timestamp: new Date(),
        };

        return;
      }

      // 执行步骤（带重试）
      const result = await this.executeStepWithRetry(step, i);

      // 存储结果
      this.results.push(result);

      // 存储输出变量
      if (step.outputVariable && result.success && result.data) {
        this.variables.set(step.outputVariable.replace(/^\$/, ""), result.data);
      }

      if (result.success) {
        yield {
          type: "step_complete",
          step,
          result,
          executionTimeMs: result.executionTimeMs,
          timestamp: new Date(),
        };
      } else {
        yield {
          type: "step_error",
          step,
          error: result.error || "Unknown error",
          willRetry: false,
          timestamp: new Date(),
        };

        // 根据错误策略决定是否继续
        if (step.onError === "abort") {
          yield {
            type: "plan_abort",
            reason: result.error || "Step execution failed",
            completedSteps: i,
            timestamp: new Date(),
          };
          return;
        }
        // skip: 继续执行下一步
        // retry: 已在 executeStepWithRetry 中处理
      }
    }

    // 发送计划完成事件
    const totalExecutionTimeMs = Math.round(performance.now() - startTime);

    logger.info(
      {
        planId: plan.id,
        totalExecutionTimeMs,
        successfulSteps: this.results.filter((r) => r.success).length,
        failedSteps: this.results.filter((r) => !r.success).length,
      },
      "PlanExecutor: Plan execution completed",
    );

    yield {
      type: "plan_complete",
      results: this.results,
      totalExecutionTimeMs,
      timestamp: new Date(),
    };
  }

  /**
   * 执行单个步骤（带重试）
   */
  private async executeStepWithRetry(
    step: PlanStep,
    _stepIndex: number,
  ): Promise<StepResult> {
    let lastError: string | undefined;
    let retryCount = 0;
    const maxRetries = step.onError === "retry" ? this.config.maxRetries : 0;

    while (retryCount <= maxRetries) {
      const startTime = performance.now();

      try {
        // 解析参数中的变量引用
        const resolvedParams = this.resolveVariables(step.params);

        logger.debug(
          {
            stepId: step.id,
            tool: step.tool,
            params: this.sanitizeParams(resolvedParams),
            retryCount,
          },
          "PlanExecutor: Executing step",
        );

        // 执行工具
        const result = await toolRegistry.execute(
          step.tool,
          resolvedParams,
          this.context,
        );

        const executionTimeMs = Math.round(performance.now() - startTime);

        if (result.success) {
          return {
            stepId: step.id,
            success: true,
            data: result.data,
            executionTimeMs,
          };
        } else {
          lastError = result.error;

          if (retryCount < maxRetries) {
            retryCount++;
            await this.delay(this.config.retryDelayMs * retryCount);
            continue;
          }

          return {
            stepId: step.id,
            success: false,
            error: result.error,
            executionTimeMs,
          };
        }
      } catch (error) {
        const executionTimeMs = Math.round(performance.now() - startTime);
        lastError = error instanceof Error ? error.message : "Unknown error";

        if (retryCount < maxRetries) {
          retryCount++;
          await this.delay(this.config.retryDelayMs * retryCount);
          continue;
        }

        return {
          stepId: step.id,
          success: false,
          error: lastError,
          executionTimeMs,
        };
      }
    }

    // 不应到达这里
    return {
      stepId: step.id,
      success: false,
      error: lastError || "Max retries exceeded",
      executionTimeMs: 0,
    };
  }

  /**
   * 解析变量引用
   *
   * 支持格式:
   * - $variable - 直接引用
   * - $variable.path.to.value - 路径引用
   */
  private resolveVariables(
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      resolved[key] = this.resolveValue(value);
    }

    return resolved;
  }

  /**
   * 解析单个值中的变量引用
   */
  private resolveValue(value: unknown): unknown {
    if (typeof value === "string" && value.startsWith("$")) {
      // 解析 $result_1.data.items 格式
      const parts = value.slice(1).split(".");
      const variableName = parts[0];

      let current: unknown = this.variables.get(variableName);

      for (let i = 1; i < parts.length && current != null; i++) {
        if (typeof current === "object" && current !== null) {
          current = (current as Record<string, unknown>)[parts[i]];
        } else {
          current = undefined;
          break;
        }
      }

      return current;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item));
    }

    if (typeof value === "object" && value !== null) {
      const resolved: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        resolved[k] = this.resolveValue(v);
      }
      return resolved;
    }

    return value;
  }

  /**
   * 评估条件表达式
   *
   * 支持简单表达式:
   * - $variable - 检查变量是否存在且为真值
   * - $variable.length > 0 - 比较表达式
   */
  private evaluateCondition(condition: string): boolean {
    try {
      // 简单实现：检查变量是否存在
      if (condition.startsWith("$")) {
        const parts = condition.split(/\s+/);
        const variablePath = parts[0];
        const value = this.resolveValue(variablePath);

        if (parts.length === 1) {
          // 简单存在性检查
          return value != null && value !== false && value !== 0;
        }

        if (parts.length === 3) {
          // 比较表达式
          const operator = parts[1];
          const compareValue = parts[2];

          switch (operator) {
            case ">":
              return Number(value) > Number(compareValue);
            case "<":
              return Number(value) < Number(compareValue);
            case ">=":
              return Number(value) >= Number(compareValue);
            case "<=":
              return Number(value) <= Number(compareValue);
            case "==":
            case "===":
              return String(value) === compareValue;
            case "!=":
            case "!==":
              return String(value) !== compareValue;
            default:
              return false;
          }
        }
      }

      return true; // 默认为真
    } catch {
      logger.warn({ condition }, "PlanExecutor: Failed to evaluate condition");
      return false;
    }
  }

  /**
   * 生成确认描述
   */
  private generateConfirmationDescription(step: PlanStep): string {
    const tool = toolRegistry.get(step.tool);

    if (!tool) {
      return `Execute ${step.tool}`;
    }

    const toolName = tool.definition.name;
    const params = this.sanitizeParams(step.params);

    return `Execute "${toolName}" with parameters: ${JSON.stringify(params)}`;
  }

  /**
   * 清理敏感参数用于日志
   */
  private sanitizeParams(
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (
        key.toLowerCase().includes("password") ||
        key.toLowerCase().includes("secret")
      ) {
        sanitized[key] = "***";
      } else if (typeof value === "string" && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + "...";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * 延迟执行
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取变量值
   */
  getVariable(name: string): unknown {
    return this.variables.get(name.replace(/^\$/, ""));
  }

  /**
   * 获取所有结果
   */
  getResults(): StepResult[] {
    return [...this.results];
  }

  /**
   * 重置执行器状态
   */
  reset(): void {
    this.variables.clear();
    this.results = [];
  }
}
