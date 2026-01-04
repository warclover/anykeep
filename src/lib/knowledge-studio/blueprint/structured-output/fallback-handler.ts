/**
 * 结构化输出降级处理器 (Story 3.3)
 * @module knowledge-studio/blueprint/structured-output
 *
 * 处理 Schema 验证失败时的自动重试和降级逻辑。
 *
 * 降级策略：
 * 1. 首次验证失败 → 重试（最多 2 次）
 * 2. 重试失败 → 降级到 Markdown
 * 3. 记录降级原因，供 UI 显示
 */

import { createLogger } from "@/lib/logger";
import {
  validateOutput,
  createFallbackMeta,
  inferOutputType,
  type SchemaValidationResult,
} from "./index";
import type {
  StructuredOutputType,
  AnyStructuredOutput,
  MarkdownOutput,
} from "./types";

// ============================================================
// Logger
// ============================================================

const logger = createLogger("blueprint:fallback-handler");

// ============================================================
// Types
// ============================================================

/**
 * 降级策略
 */
export type FallbackStrategy =
  | "retry" // 重试原始请求
  | "simplify" // 简化输出结构
  | "markdown"; // 降级到纯 Markdown

/**
 * 降级上下文
 */
export interface FallbackContext {
  /** 原始输出类型 */
  originalType: StructuredOutputType;
  /** 蓝图 ID */
  blueprintId: string;
  /** 尝试次数 */
  attemptCount: number;
  /** 最后一次错误 */
  lastErrors: Array<{ path: string; message: string }>;
  /** 降级原因 */
  fallbackReason?: string;
}

/**
 * 降级配置
 */
export interface FallbackConfig {
  /** 最大重试次数（默认 2） */
  maxRetries: number;
  /** 是否启用简化策略（默认 true） */
  enableSimplification: boolean;
  /** 重试延迟（毫秒，默认 500） */
  retryDelayMs: number;
  /** 是否总是保留原始数据（默认 true） */
  preserveRawData: boolean;
}

/**
 * 降级结果
 */
export interface FallbackResult {
  /** 处理后的输出 */
  output: AnyStructuredOutput;
  /** 是否发生降级 */
  degraded: boolean;
  /** 降级策略 */
  strategy?: FallbackStrategy;
  /** 尝试次数 */
  attempts: number;
  /** 降级原因 */
  reason?: string;
  /** 原始验证错误 */
  originalErrors?: Array<{ path: string; message: string }>;
}

/**
 * 重试生成函数类型
 */
export type RetryGeneratorFn = (simplify: boolean) => Promise<unknown>;

// ============================================================
// Default Config
// ============================================================

export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  maxRetries: 2,
  enableSimplification: true,
  retryDelayMs: 500,
  preserveRawData: true,
};

// ============================================================
// Fallback Handler
// ============================================================

/**
 * 结构化输出降级处理器
 *
 * 处理验证失败的结构化输出，尝试重试或降级。
 *
 * @example
 * ```typescript
 * const handler = new FallbackHandler({
 *   maxRetries: 2,
 *   enableSimplification: true,
 * });
 *
 * const result = await handler.handleWithRetry(
 *   rawOutput,
 *   'feature_matrix',
 *   'geek-arxiv',
 *   async (simplify) => {
 *     // 调用 LLM 重新生成
 *     return await regenerate(simplify);
 *   },
 * );
 *
 * if (result.degraded) {
 *   console.log(`降级原因: ${result.reason}`);
 * }
 * ```
 */
export class FallbackHandler {
  private config: FallbackConfig;

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_FALLBACK_CONFIG, ...config };
  }

  /**
   * 验证并处理输出（无重试）
   *
   * 如果验证失败，直接降级到 Markdown。
   */
  validateAndFallback(
    rawOutput: unknown,
    expectedType: StructuredOutputType,
    blueprintId: string,
  ): FallbackResult {
    // 保存原始数据的深拷贝，防止验证过程中被修改
    const originalData = this.deepClone(rawOutput);

    // 类型断言：验证函数接受 string | object
    const dataToValidate = rawOutput as string | object;

    // 首先尝试验证
    const validation = validateOutput(dataToValidate, expectedType);

    if (validation.valid && validation.data) {
      logger.debug({ expectedType, blueprintId }, "Output validation passed");

      return {
        output: validation.data as AnyStructuredOutput,
        degraded: false,
        attempts: 1,
      };
    }

    // 验证失败，降级到 Markdown
    logger.warn(
      {
        expectedType,
        blueprintId,
        errors: validation.errors,
      },
      "Output validation failed, degrading to markdown",
    );

    // 使用原始数据创建降级输出
    const fallbackOutput = this.createMarkdownFallback(
      originalData,
      expectedType,
      blueprintId,
      validation.errors,
    );

    return {
      output: fallbackOutput,
      degraded: true,
      strategy: "markdown",
      attempts: 1,
      reason: this.formatErrorsAsReason(validation.errors),
      originalErrors: validation.errors,
    };
  }

  /**
   * 验证并处理输出（带重试）
   *
   * 流程：
   * 1. 验证原始输出
   * 2. 失败则调用 retryFn 重新生成
   * 3. 最多重试 maxRetries 次
   * 4. 全部失败则降级到 Markdown
   */
  async handleWithRetry(
    rawOutput: unknown,
    expectedType: StructuredOutputType,
    blueprintId: string,
    retryFn: RetryGeneratorFn,
  ): Promise<FallbackResult> {
    let currentOutput: string | object = rawOutput as string | object;
    let attempts = 0;
    let lastValidation: SchemaValidationResult | null = null;

    // 首次验证
    attempts++;
    lastValidation = validateOutput(currentOutput, expectedType);

    if (lastValidation.valid && lastValidation.data) {
      logger.debug(
        { expectedType, blueprintId, attempts },
        "Output validation passed on first attempt",
      );

      return {
        output: lastValidation.data as AnyStructuredOutput,
        degraded: false,
        attempts,
      };
    }

    // 重试循环
    while (attempts < this.config.maxRetries + 1) {
      attempts++;
      // 从第二次重试开始启用简化策略（即 attempts > 2）
      const shouldSimplify = this.config.enableSimplification && attempts > 2;

      logger.info(
        {
          expectedType,
          blueprintId,
          attempt: attempts,
          simplify: shouldSimplify,
          previousErrors: lastValidation?.errors?.length ?? 0,
        },
        "Retrying structured output generation",
      );

      // 等待重试延迟
      if (this.config.retryDelayMs > 0) {
        await this.delay(this.config.retryDelayMs);
      }

      try {
        currentOutput = (await retryFn(shouldSimplify)) as string | object;
        lastValidation = validateOutput(currentOutput, expectedType);

        if (lastValidation.valid && lastValidation.data) {
          logger.info(
            { expectedType, blueprintId, attempts },
            "Output validation passed after retry",
          );

          return {
            output: lastValidation.data as AnyStructuredOutput,
            degraded: false,
            strategy: shouldSimplify ? "simplify" : "retry",
            attempts,
          };
        }
      } catch (error) {
        logger.warn(
          {
            expectedType,
            blueprintId,
            attempt: attempts,
            error: error instanceof Error ? error.message : String(error),
          },
          "Retry generation failed",
        );

        // 继续下一次重试
      }
    }

    // 所有重试都失败，降级到 Markdown
    logger.warn(
      {
        expectedType,
        blueprintId,
        totalAttempts: attempts,
        errors: lastValidation?.errors,
      },
      "All retries failed, degrading to markdown",
    );

    const fallbackOutput = this.createMarkdownFallback(
      currentOutput,
      expectedType,
      blueprintId,
      lastValidation?.errors ?? [],
    );

    return {
      output: fallbackOutput,
      degraded: true,
      strategy: "markdown",
      attempts,
      reason: this.formatErrorsAsReason(lastValidation?.errors ?? []),
      originalErrors: lastValidation?.errors,
    };
  }

  /**
   * 创建 Markdown 降级输出
   */
  private createMarkdownFallback(
    rawOutput: unknown,
    originalType: StructuredOutputType,
    blueprintId: string,
    errors: Array<{ path: string; message: string }>,
  ): MarkdownOutput {
    const meta = createFallbackMeta(originalType, blueprintId);
    const reason = this.formatErrorsAsReason(errors);

    // 尝试从原始数据提取内容
    let content: string;

    if (typeof rawOutput === "string") {
      content = rawOutput;
    } else if (rawOutput && typeof rawOutput === "object") {
      const obj = rawOutput as Record<string, unknown>;

      // 尝试提取 content 字段
      if (typeof obj.content === "string") {
        content = obj.content;
      }
      // 尝试提取 title 和其他字段
      else if (typeof obj.title === "string") {
        content = this.extractMarkdownFromObject(obj);
      }
      // 最后手段：JSON 格式化
      else {
        content = "```json\n" + JSON.stringify(rawOutput, null, 2) + "\n```";
      }
    } else {
      content = String(rawOutput ?? "无法解析的内容");
    }

    return {
      meta,
      content,
      fallbackReason: reason,
    };
  }

  /**
   * 从对象提取 Markdown 内容
   */
  private extractMarkdownFromObject(obj: Record<string, unknown>): string {
    const lines: string[] = [];

    // 标题
    if (typeof obj.title === "string") {
      lines.push(`# ${obj.title}\n`);
    }

    // 摘要/概述
    if (typeof obj.summary === "string") {
      lines.push(`${obj.summary}\n`);
    }
    if (typeof obj.overview === "string") {
      lines.push(`${obj.overview}\n`);
    }

    // 主体内容
    if (typeof obj.content === "string") {
      lines.push(obj.content);
    }

    // 章节
    if (Array.isArray(obj.sections)) {
      for (const section of obj.sections) {
        if (section && typeof section === "object") {
          const s = section as Record<string, unknown>;
          if (typeof s.title === "string") {
            const level = typeof s.level === "number" ? s.level : 2;
            lines.push(`\n${"#".repeat(level)} ${s.title}\n`);
          }
          if (typeof s.content === "string") {
            lines.push(s.content);
          }
        }
      }
    }

    // 如果没有提取到任何内容，返回 JSON
    if (lines.length === 0) {
      return "```json\n" + JSON.stringify(obj, null, 2) + "\n```";
    }

    return lines.join("\n");
  }

  /**
   * 格式化错误为可读原因
   */
  private formatErrorsAsReason(
    errors: Array<{ path: string; message: string }>,
  ): string {
    if (errors.length === 0) {
      return "验证失败（原因未知）";
    }

    if (errors.length === 1) {
      return `${errors[0].path}: ${errors[0].message}`;
    }

    // 多个错误时，只显示前 3 个
    const displayed = errors.slice(0, 3);
    const remaining = errors.length - 3;

    let reason = displayed.map((e) => `${e.path}: ${e.message}`).join("; ");

    if (remaining > 0) {
      reason += `（还有 ${remaining} 个错误）`;
    }

    return reason;
  }

  /**
   * 延迟工具函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 深拷贝工具函数
   * 使用 JSON 序列化/反序列化实现深拷贝
   */
  private deepClone<T>(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      // 如果序列化失败，返回原对象
      return obj;
    }
  }
}

// ============================================================
// Convenience Functions
// ============================================================

/**
 * 创建默认降级处理器
 */
export function createFallbackHandler(
  config?: Partial<FallbackConfig>,
): FallbackHandler {
  return new FallbackHandler(config);
}

/**
 * 快速验证并降级
 *
 * 便捷函数，用于简单的验证+降级场景。
 */
export function validateAndFallbackToMarkdown(
  rawOutput: unknown,
  expectedType: StructuredOutputType,
  blueprintId: string,
): FallbackResult {
  const handler = new FallbackHandler({ maxRetries: 0 });
  return handler.validateAndFallback(rawOutput, expectedType, blueprintId);
}

/**
 * 尝试推断类型并验证
 *
 * 如果无法推断类型，直接返回 Markdown。
 */
export function validateWithTypeInference(
  rawOutput: unknown,
  blueprintId: string,
  fallbackType: StructuredOutputType = "markdown",
): FallbackResult {
  const handler = new FallbackHandler({ maxRetries: 0 });

  // 类型断言
  const dataToInfer = rawOutput as string | object;

  // 尝试推断类型
  const inferredType = inferOutputType(dataToInfer) ?? fallbackType;

  return handler.validateAndFallback(rawOutput, inferredType, blueprintId);
}
