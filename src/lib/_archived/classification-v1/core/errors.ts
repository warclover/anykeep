/**
 * Classification Core Errors
 * 错误类型定义
 *
 * @version 1.0.0
 * @since 2026-01-24 Phase 2
 */

/**
 * 分类错误基类
 */
export class ClassificationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ClassificationError";
  }
}

/**
 * 验证错误
 */
export class ValidationError extends ClassificationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

/**
 * 策略未找到错误
 */
export class StrategyNotFoundError extends ClassificationError {
  constructor(strategyName: string) {
    super(`Strategy "${strategyName}" not found`, "STRATEGY_NOT_FOUND", {
      strategyName,
    });
    this.name = "StrategyNotFoundError";
  }
}

/**
 * 文件夹未找到错误
 */
export class FolderNotFoundError extends ClassificationError {
  constructor(folderId: string | number) {
    super(`Folder "${folderId}" not found`, "FOLDER_NOT_FOUND", { folderId });
    this.name = "FolderNotFoundError";
  }
}

/**
 * 配额超限错误
 */
export class QuotaExceededError extends ClassificationError {
  constructor(quotaType: string, current: number, limit: number) {
    super(
      `${quotaType} quota exceeded: ${current}/${limit}`,
      "QUOTA_EXCEEDED",
      { quotaType, current, limit },
    );
    this.name = "QuotaExceededError";
  }
}

/**
 * 废弃功能错误
 */
export class DeprecatedError extends ClassificationError {
  constructor(feature: string, alternative?: string) {
    const message = alternative
      ? `"${feature}" is deprecated. Use "${alternative}" instead.`
      : `"${feature}" is deprecated and no longer available.`;
    super(message, "DEPRECATED", { feature, alternative });
    this.name = "DeprecatedError";
  }
}

/**
 * Pipeline 执行错误
 */
export class PipelineError extends ClassificationError {
  constructor(stage: string, cause?: Error) {
    super(
      `Pipeline failed at stage "${stage}": ${cause?.message || "Unknown error"}`,
      "PIPELINE_ERROR",
      { stage, cause: cause?.message },
    );
    this.name = "PipelineError";
  }
}
