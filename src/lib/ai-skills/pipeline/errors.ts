/**
 * 流水线错误定义
 *
 * 统一的错误类型和错误码
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { PipelineStage } from "./types";

// ============================================
// 错误码定义
// ============================================

/**
 * 流水线错误码
 */
export const PIPELINE_ERROR_CODES = {
  // 解析阶段
  SKILL_NOT_FOUND: "SKILL_NOT_FOUND",
  SKILL_DISABLED: "SKILL_DISABLED",

  // 验证阶段
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INPUT_TOO_SHORT: "INPUT_TOO_SHORT",
  INPUT_TOO_LONG: "INPUT_TOO_LONG",
  INPUT_INVALID: "INPUT_INVALID",

  // 风险检查阶段
  RISK_CONFIRMATION_REQUIRED: "RISK_CONFIRMATION_REQUIRED",
  RISK_CONFIRMATION_DENIED: "RISK_CONFIRMATION_DENIED",

  // 执行阶段
  EXECUTION_FAILED: "EXECUTION_FAILED",
  EXECUTION_TIMEOUT: "EXECUTION_TIMEOUT",
  EXECUTION_CANCELLED: "EXECUTION_CANCELLED",

  // 通用错误
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type PipelineErrorCode =
  (typeof PIPELINE_ERROR_CODES)[keyof typeof PIPELINE_ERROR_CODES];

// ============================================
// 错误类
// ============================================

/**
 * 流水线错误基类
 *
 * 所有流水线错误都继承自此类
 */
export class PipelineError extends Error {
  /** 错误名称 */
  readonly name = "PipelineError";

  constructor(
    message: string,
    /** 发生错误的阶段 */
    public readonly stage: PipelineStage,
    /** 错误码 */
    public readonly code: PipelineErrorCode,
    /** 是否可重试 */
    public readonly retryable: boolean = false,
    /** 原始错误 */
    public readonly cause?: Error,
  ) {
    super(message);

    // 确保原型链正确
    Object.setPrototypeOf(this, PipelineError.prototype);
  }

  /**
   * 转换为 JSON 格式
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      stage: this.stage,
      code: this.code,
      retryable: this.retryable,
      cause: this.cause?.message,
    };
  }
}

// ============================================
// 特定错误类
// ============================================

/**
 * Skill 未找到错误
 */
export class SkillNotFoundError extends PipelineError {
  readonly name = "SkillNotFoundError";

  constructor(skillId: string) {
    super(
      `Skill "${skillId}" 未找到，请检查 Skill ID 是否正确`,
      PipelineStage.RESOLVE,
      PIPELINE_ERROR_CODES.SKILL_NOT_FOUND,
      false,
    );
    Object.setPrototypeOf(this, SkillNotFoundError.prototype);
  }
}

/**
 * Skill 已禁用错误
 */
export class SkillDisabledError extends PipelineError {
  readonly name = "SkillDisabledError";

  constructor(skillId: string) {
    super(
      `Skill "${skillId}" 已被禁用`,
      PipelineStage.RESOLVE,
      PIPELINE_ERROR_CODES.SKILL_DISABLED,
      false,
    );
    Object.setPrototypeOf(this, SkillDisabledError.prototype);
  }
}

/**
 * 输入验证失败错误
 */
export class ValidationError extends PipelineError {
  readonly name = "ValidationError";

  constructor(
    message: string,
    code: PipelineErrorCode = PIPELINE_ERROR_CODES.VALIDATION_FAILED,
    public readonly warnings: string[] = [],
  ) {
    super(message, PipelineStage.VALIDATE, code, false);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 需要风险确认错误
 *
 * 这不是真正的"错误"，而是表示需要用户确认才能继续
 */
export class RiskConfirmationRequiredError extends PipelineError {
  readonly name = "RiskConfirmationRequiredError";

  constructor(
    message: string,
    /** 风险级别 */
    public readonly riskLevel: "medium" | "high",
    /** 影响数量 */
    public readonly affectedCount: number,
  ) {
    super(
      message,
      PipelineStage.RISK_CHECK,
      PIPELINE_ERROR_CODES.RISK_CONFIRMATION_REQUIRED,
      false,
    );
    Object.setPrototypeOf(this, RiskConfirmationRequiredError.prototype);
  }
}

/**
 * 执行超时错误
 */
export class ExecutionTimeoutError extends PipelineError {
  readonly name = "ExecutionTimeoutError";

  constructor(timeoutMs: number) {
    super(
      `Skill 执行超时（${timeoutMs}ms）`,
      PipelineStage.EXECUTE,
      PIPELINE_ERROR_CODES.EXECUTION_TIMEOUT,
      true, // 超时可重试
    );
    Object.setPrototypeOf(this, ExecutionTimeoutError.prototype);
  }
}

/**
 * 执行被取消错误
 */
export class ExecutionCancelledError extends PipelineError {
  readonly name = "ExecutionCancelledError";

  constructor(reason?: string) {
    super(
      reason || "用户取消了操作",
      PipelineStage.EXECUTE,
      PIPELINE_ERROR_CODES.EXECUTION_CANCELLED,
      false,
    );
    Object.setPrototypeOf(this, ExecutionCancelledError.prototype);
  }
}

/**
 * 执行失败错误
 */
export class ExecutionFailedError extends PipelineError {
  readonly name = "ExecutionFailedError";

  constructor(message: string, cause?: Error, retryable: boolean = false) {
    super(
      message,
      PipelineStage.EXECUTE,
      PIPELINE_ERROR_CODES.EXECUTION_FAILED,
      retryable,
      cause,
    );
    Object.setPrototypeOf(this, ExecutionFailedError.prototype);
  }
}

// ============================================
// 错误工厂函数
// ============================================

/**
 * 根据阶段和错误码创建错误
 */
export function createPipelineError(
  stage: PipelineStage,
  code: PipelineErrorCode,
  message: string,
  options?: {
    retryable?: boolean;
    cause?: Error;
  },
): PipelineError {
  return new PipelineError(
    message,
    stage,
    code,
    options?.retryable ?? false,
    options?.cause,
  );
}

/**
 * 判断是否为流水线错误
 */
export function isPipelineError(error: unknown): error is PipelineError {
  return error instanceof PipelineError;
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: unknown): boolean {
  if (isPipelineError(error)) {
    return error.retryable;
  }
  return false;
}
