/**
 * Base Service Class
 *
 * 服务层基类，提供统一的日志、错误处理和事务支持
 *
 * @module services/core
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createLogger } from "@/lib/logger";

/**
 * 服务错误类
 *
 * 统一的业务错误表示，包含错误码和原因
 */
export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";

    // 保留原始错误的堆栈信息，便于调试
    if (cause instanceof Error && cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }

  /**
   * 获取对应的 HTTP 状态码
   */
  get httpStatus(): number {
    return SERVICE_ERROR_HTTP_STATUS[this.code] || 500;
  }
}

/**
 * 服务错误码
 */
export type ServiceErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE"
  | "VALIDATION"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR"
  | "DB_ERROR"
  | "EXTERNAL_API_ERROR"
  | "RATE_LIMITED";

/**
 * 错误码到 HTTP 状态码映射
 */
export const SERVICE_ERROR_HTTP_STATUS: Record<ServiceErrorCode, number> = {
  NOT_FOUND: 404,
  DUPLICATE: 409,
  VALIDATION: 400,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  INTERNAL_ERROR: 500,
  DB_ERROR: 500,
  EXTERNAL_API_ERROR: 502,
  RATE_LIMITED: 429,
};

/**
 * 服务基类
 *
 * 所有领域服务应继承此类
 */
export abstract class BaseService {
  protected readonly supabase: SupabaseClient<Database>;
  protected readonly logger: ReturnType<typeof createLogger>;
  protected readonly userId: string;

  constructor(
    supabase: SupabaseClient<Database>,
    userId: string,
    serviceName: string,
  ) {
    this.supabase = supabase;
    this.userId = userId;
    this.logger = createLogger(serviceName);
  }

  /**
   * 执行带日志的操作
   */
  protected async withLogging<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const startTime = Date.now();

    this.logger.debug({ operation, ...metadata }, `Starting ${operation}`);

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      this.logger.info(
        { operation, duration, ...metadata },
        `Completed ${operation}`,
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(
        { operation, duration, error, ...metadata },
        `Failed ${operation}`,
      );

      throw error;
    }
  }

  /**
   * 统一错误处理
   *
   * 将任意错误转换为 ServiceError
   */
  protected handleError(error: unknown, context: string): never {
    this.logger.error({ error, context }, "Service error");

    if (error instanceof ServiceError) {
      throw error;
    }

    // 处理 Supabase 错误
    if (this.isSupabaseError(error)) {
      const code = this.mapSupabaseErrorCode(error.code);
      throw new ServiceError(
        code,
        error.message || `Operation failed: ${context}`,
        error,
      );
    }

    // 处理标准错误
    if (error instanceof Error) {
      throw new ServiceError("INTERNAL_ERROR", error.message, error);
    }

    throw new ServiceError(
      "INTERNAL_ERROR",
      `Operation failed: ${context}`,
      error,
    );
  }

  /**
   * 检查是否为 Supabase 错误
   */
  private isSupabaseError(
    error: unknown,
  ): error is { code: string; message?: string } {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as Record<string, unknown>).code === "string"
    );
  }

  /**
   * 映射 Supabase 错误码到服务错误码
   */
  private mapSupabaseErrorCode(code: string): ServiceErrorCode {
    const mapping: Record<string, ServiceErrorCode> = {
      PGRST116: "NOT_FOUND", // No rows returned
      "23505": "DUPLICATE", // Unique violation
      "23503": "VALIDATION", // Foreign key violation
      "42501": "FORBIDDEN", // Insufficient privilege
      "42P01": "DB_ERROR", // Undefined table
    };

    return mapping[code] || "DB_ERROR";
  }

  /**
   * 确保操作针对当前用户
   *
   * 用于 RLS 之外的额外验证
   */
  protected ensureOwnership<T extends { user_id: string }>(
    resource: T | null,
    resourceName: string,
  ): T {
    if (!resource) {
      throw new ServiceError("NOT_FOUND", `${resourceName} not found`);
    }

    if (resource.user_id !== this.userId) {
      throw new ServiceError("FORBIDDEN", `Access denied to ${resourceName}`);
    }

    return resource;
  }
}
