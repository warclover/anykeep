/**
 * 分发模块错误定义
 *
 * @module distribution/errors
 * @description 定义分发模块的自定义错误类型
 */

import type { DistributionTargetType } from "./types";

/**
 * 分发基础错误
 */
export class DistributionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DistributionError";
  }
}

/**
 * 目标未找到错误
 */
export class TargetNotFoundError extends DistributionError {
  constructor(targetId: string) {
    super(`分发目标不存在: ${targetId}`, "TARGET_NOT_FOUND");
    this.name = "TargetNotFoundError";
  }
}

/**
 * 适配器未找到错误
 */
export class AdapterNotFoundError extends DistributionError {
  constructor(adapterType: DistributionTargetType) {
    super(`适配器不存在: ${adapterType}`, "ADAPTER_NOT_FOUND");
    this.name = "AdapterNotFoundError";
  }
}

/**
 * 目标已禁用错误
 */
export class TargetDisabledError extends DistributionError {
  constructor(targetId: string) {
    super(`分发目标已禁用: ${targetId}`, "TARGET_DISABLED");
    this.name = "TargetDisabledError";
  }
}

/**
 * 平台不支持错误
 */
export class PlatformNotSupportedError extends DistributionError {
  constructor(
    adapterType: DistributionTargetType,
    supportedPlatforms: readonly string[],
  ) {
    super(
      `${adapterType} 适配器仅支持以下平台: ${supportedPlatforms.join(", ")}`,
      "PLATFORM_NOT_SUPPORTED",
    );
    this.name = "PlatformNotSupportedError";
  }
}

/**
 * 配置验证错误
 */
export class ConfigValidationError extends DistributionError {
  constructor(public readonly errors: string[]) {
    super(`配置验证失败: ${errors.join(", ")}`, "CONFIG_VALIDATION_FAILED");
    this.name = "ConfigValidationError";
  }
}

/**
 * 连接测试失败错误
 */
export class ConnectionTestError extends DistributionError {
  constructor(message: string) {
    super(`连接测试失败: ${message}`, "CONNECTION_TEST_FAILED");
    this.name = "ConnectionTestError";
  }
}

/**
 * 分发超时错误
 */
export class DistributionTimeoutError extends DistributionError {
  constructor(targetId: string, timeoutMs: number) {
    super(`分发超时 (${timeoutMs}ms): ${targetId}`, "DISTRIBUTION_TIMEOUT");
    this.name = "DistributionTimeoutError";
  }
}

/**
 * 分发正在进行中错误
 */
export class DistributionInProgressError extends DistributionError {
  constructor(targetId: string) {
    super(`分发正在进行中: ${targetId}`, "DISTRIBUTION_IN_PROGRESS");
    this.name = "DistributionInProgressError";
  }
}

/**
 * OAuth 授权错误
 */
export class OAuthError extends DistributionError {
  constructor(provider: string, message: string) {
    super(`${provider} OAuth 错误: ${message}`, "OAUTH_ERROR");
    this.name = "OAuthError";
  }
}

/**
 * OAuth Token 过期错误
 */
export class OAuthTokenExpiredError extends DistributionError {
  constructor(provider: string) {
    super(`${provider} Token 已过期，请重新授权`, "OAUTH_TOKEN_EXPIRED");
    this.name = "OAuthTokenExpiredError";
  }
}

/**
 * 文件系统错误
 */
export class FileSystemError extends DistributionError {
  constructor(operation: string, path: string, originalError?: Error) {
    super(
      `文件系统操作失败 [${operation}]: ${path}${originalError ? ` - ${originalError.message}` : ""}`,
      "FILE_SYSTEM_ERROR",
    );
    this.name = "FileSystemError";
  }
}

/**
 * API 限流错误
 */
export class RateLimitError extends DistributionError {
  constructor(provider: string, retryAfterSeconds?: number) {
    super(
      `${provider} API 限流${retryAfterSeconds ? `，请 ${retryAfterSeconds} 秒后重试` : ""}`,
      "RATE_LIMIT_ERROR",
    );
    this.name = "RateLimitError";
  }
}

/**
 * Webhook 错误
 */
export class WebhookError extends DistributionError {
  constructor(url: string, statusCode: number, message?: string) {
    super(
      `Webhook 请求失败 [${statusCode}]: ${url}${message ? ` - ${message}` : ""}`,
      "WEBHOOK_ERROR",
    );
    this.name = "WebhookError";
  }
}
