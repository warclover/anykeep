/**
 * BaseSkill 抽象类
 *
 * 所有 AI Skills 的基类，提供：
 * - 输入/输出验证
 * - 执行时间跟踪
 * - 错误处理
 * - 转换为 Vercel AI SDK Tool
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

import type { z } from "zod";
import type { Tool, ToolExecuteFunction } from "ai";
import { logger } from "@/lib/logger";
import { logSkillExecutionAsync } from "./skill-execution-logger";
import type {
  SkillMetadata,
  SkillContext,
  SkillOutput,
  SkillExecutionMetrics,
  ISkill,
} from "./types";

/**
 * BaseSkill 抽象类
 *
 * @example
 * ```typescript
 * class SearchSkill extends BaseSkill<SearchInput, SearchOutput> {
 *   metadata = {
 *     id: 'search',
 *     name: '搜索书签',
 *     description: '根据关键词搜索用户的书签',
 *     category: 'utility',
 *     version: '1.0.0',
 *     author: 'AnyKeep',
 *     capabilities: ['semantic-search', 'keyword-search'],
 *   };
 *
 *   inputSchema = z.object({
 *     query: z.string().describe('搜索关键词'),
 *     limit: z.number().optional().default(10),
 *   });
 *
 *   outputSchema = z.object({
 *     bookmarks: z.array(BookmarkSchema),
 *     total: z.number(),
 *   });
 *
 *   protected async executeInternal(input, context) {
 *     // 实现搜索逻辑
 *   }
 * }
 * ```
 */
export abstract class BaseSkill<TInput = unknown, TOutput = unknown>
  implements ISkill<TInput, TOutput>
{
  /** Skill 元数据 */
  abstract readonly metadata: SkillMetadata;

  /** 输入 Schema */
  abstract readonly inputSchema: z.ZodSchema<TInput>;

  /** 输出 Schema */
  abstract readonly outputSchema: z.ZodSchema<TOutput>;

  /**
   * 执行 Skill（供子类实现）
   * 子类只需实现此方法，无需处理验证、计时、错误处理等
   */
  protected abstract executeInternal(
    input: TInput,
    context: SkillContext,
  ): Promise<TOutput>;

  /**
   * 执行 Skill（公开方法）
   * 包含完整的验证、计时、错误处理逻辑
   */
  async execute(
    input: TInput,
    context: SkillContext,
  ): Promise<SkillOutput<TOutput>> {
    const startTime = performance.now();
    const metrics: SkillExecutionMetrics = {
      executionTimeMs: 0,
      tokensUsed: 0,
      cacheHit: false,
      llmCallCount: 0,
      retryCount: 0,
    };

    try {
      // 1. 验证输入
      const validatedInput = this.validateInput(input);

      // 2. 检查执行超时设置
      const maxTime =
        context.maxExecutionTime || this.metadata.maxExecutionTimeMs || 30000; // 默认 30 秒

      // 3. 执行 Skill（带超时）
      const result = await this.executeWithTimeout(
        () => this.executeInternal(validatedInput, context),
        maxTime,
      );

      // 4. 验证输出
      const validatedOutput = this.validateOutput(result);

      // 5. 计算执行时间
      metrics.executionTimeMs = Math.round(performance.now() - startTime);

      // 6. 记录日志
      if (context.debug) {
        logger.debug(
          {
            skillId: this.metadata.id,
            executionTimeMs: metrics.executionTimeMs,
            traceId: context.traceId,
          },
          `Skill ${this.metadata.id} executed successfully`,
        );
      }

      // 记录成功执行日志（异步，不阻塞）
      logSkillExecutionAsync({
        metadata: this.metadata,
        context,
        input,
        output: validatedOutput,
        status: "success",
        metrics,
      });

      return {
        success: true,
        data: validatedOutput,
        metrics,
      };
    } catch (error) {
      metrics.executionTimeMs = Math.round(performance.now() - startTime);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const errorCode = this.getErrorCode(error);

      logger.error(
        {
          skillId: this.metadata.id,
          error: errorMessage,
          errorCode,
          executionTimeMs: metrics.executionTimeMs,
          traceId: context.traceId,
        },
        `Skill ${this.metadata.id} execution failed`,
      );

      // 记录失败执行日志（异步，不阻塞）
      const status = error instanceof SkillTimeoutError ? "timeout" : "error";
      logSkillExecutionAsync({
        metadata: this.metadata,
        context,
        input,
        status,
        metrics,
        errorMessage,
        errorCode,
      });

      return {
        success: false,
        error: errorMessage,
        errorCode,
        metrics,
      };
    }
  }

  /**
   * 验证输入
   */
  validateInput(input: unknown): TInput {
    const result = this.inputSchema.safeParse(input);
    if (!result.success) {
      throw new SkillValidationError(
        `Input validation failed: ${result.error.message}`,
        "INPUT_VALIDATION_ERROR",
      );
    }
    return result.data;
  }

  /**
   * 验证输出
   */
  validateOutput(output: unknown): TOutput {
    const result = this.outputSchema.safeParse(output);
    if (!result.success) {
      throw new SkillValidationError(
        `Output validation failed: ${result.error.message}`,
        "OUTPUT_VALIDATION_ERROR",
      );
    }
    return result.data;
  }

  /**
   * 转换为 Vercel AI SDK Tool
   *
   * @param contextProvider - 可选的上下文提供函数，用于在 Tool 调用时获取上下文
   */
  toTool(contextProvider?: () => SkillContext): Tool<TInput, TOutput> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const skill = this;

    // 构造符合 Vercel AI SDK Tool 类型的对象
    const executeFn: ToolExecuteFunction<TInput, TOutput> = async (input) => {
      // 获取上下文（如果提供了 contextProvider）
      const context: SkillContext = contextProvider?.() ?? {
        userId: "", // 需要在实际使用时注入
      };

      const result = await skill.execute(input, context);

      if (result.success) {
        return result.data;
      } else {
        // 对于 Tool，抛出错误让 AI SDK 处理
        throw new Error(`${result.error} (${result.errorCode})`);
      }
    };

    return {
      description: this.metadata.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: this.inputSchema as any,
      execute: executeFn,
    } as unknown as Tool<TInput, TOutput>;
  }

  /**
   * 带超时的执行
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new SkillTimeoutError(
                `Skill execution timed out after ${timeoutMs}ms`,
              ),
            ),
          timeoutMs,
        ),
      ),
    ]);
  }

  /**
   * 获取错误代码
   */
  private getErrorCode(error: unknown): string {
    if (error instanceof SkillValidationError) {
      return error.code;
    }
    if (error instanceof SkillTimeoutError) {
      return "TIMEOUT_ERROR";
    }
    if (error instanceof Error) {
      // 尝试从已知错误类型推断
      if (error.message.includes("timeout")) {
        return "TIMEOUT_ERROR";
      }
      if (error.message.includes("network")) {
        return "NETWORK_ERROR";
      }
    }
    return "UNKNOWN_ERROR";
  }
}

// ============================================
// 错误类
// ============================================

/**
 * Skill 验证错误
 */
export class SkillValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "SkillValidationError";
  }
}

/**
 * Skill 超时错误
 */
export class SkillTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillTimeoutError";
  }
}

/**
 * Skill 执行错误
 */
export class SkillExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "SkillExecutionError";
  }
}
